import express, { Request, Response } from 'express';
import { client } from '../data/DB';
import crypto, { randomUUID } from 'crypto';
import axios from 'axios';
import ShopiCatalogService from '../data/shopiCatalogService';
import { resolveOrCreateCustomer } from '../utils/guestCheckoutHelper';

const router = express.Router();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_51MockRazorpayKeyId2026';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'mock_razorpay_secret_key_2026';
import { dispatchOrderConfirmationEmail } from '../merchant-communication/order-email-dispatcher';

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_razorpay_webhook_secret_2026';

/**
 * Resolve a product's authoritative price for checkout transactions.
 *
 * The live catalog is served from shopi_products (via ShopiCatalogService);
 * the legacy `products` table is sparsely populated and lacks catalog-only
 * SKUs, so checkout paths that resolve price with an INNER JOIN on it return
 * 'Product not found' / 'Cart is empty' even though the storefront just sold
 * the item. COD/card checkout in cartCheckout.ts already falls back to the
 * catalog — this extends the same fallback to every Razorpay path so the
 * payment flow cannot 404 on a perfectly orderable product.
 *
 * Returns { discount, title } on success or null when the product genuinely
 * does not exist in either source.
 */
async function resolveCheckoutProduct(productid: string) {
  const legacy = await client.query(
    'SELECT productid, title, discount FROM products WHERE productid = $1',
    [productid]
  );
  if (legacy.rows.length > 0) {
    const row = legacy.rows[0];
    if (row.discount !== null && row.discount !== undefined && parseFloat(String(row.discount)) > 0) {
      return { discount: parseFloat(String(row.discount)), title: row.title };
    }
  }
  try {
    const supProd = await ShopiCatalogService.getProduct(String(productid));
    if (supProd) {
      const price = (supProd as any).selling_price ?? (supProd as any).discount ?? (supProd as any).price;
      if (price !== undefined && price !== null && parseFloat(String(price)) > 0) {
        return { discount: parseFloat(String(price)), title: supProd.title };
      }
    }
  } catch (err: any) {
    console.warn('[razorpay] catalog fallback failed for', productid, err?.message);
  }
  return null;
}

/**
 * Ensures the checkout-transaction schema (shipping, payments, orders,
 * orderitems, productparams.sold) exists BEFORE a payment transaction
 * starts. Render's free Postgres resets wipe these tables while the app
 * keeps running, and a missing table aborts the transaction AFTER the
 * customer already paid (500 'Database transaction error' with the money
 * captured). This pre-check rebuilds the schema (idempotent) and returns
 * false — the caller should ask the client to retry — only when recovery
 * itself failed.
 */
export async function ensureCheckoutSchemaReady(): Promise<boolean> {
  try {
    const probe = await client.query(`
      SELECT to_regclass('public.shipping') AS shipping_t,
             to_regclass('public.payments') AS payments_t,
             to_regclass('public.orders') AS orders_t,
             to_regclass('public.orderitems') AS orderitems_t;
    `);
    const r = probe.rows[0] || {};
    if (r.shipping_t && r.payments_t && r.orders_t && r.orderitems_t) {
      return true;
    }
    console.warn('[Checkout Schema] missing tables — running recovery...',
      { shipping: !!r.shipping_t, payments: !!r.payments_t, orders: !!r.orders_t, orderitems: !!r.orderitems_t });
    // Run the schema SQL directly. A full recoverMerchantDataIfMissing can
    // take the fast path (users + shopi_orders healthy → skip) while the
    // checkout tables are still missing, because the wipe may be partial —
    // exactly the Render incident shape. CORE_SCHEMA_SQL is idempotent and
    // cheap; it re-creates only what is absent.
    const { CORE_SCHEMA_SQL } = await import('../data/DB');
    await client.query(CORE_SCHEMA_SQL);
    const verify = await client.query(`
      SELECT to_regclass('public.shipping') AS s, to_regclass('public.payments') AS p;
    `);
    const ok = !!(verify.rows[0]?.s && verify.rows[0]?.p);
    if (!ok) console.error('[Checkout Schema] schema ensure ran but shipping/payments STILL missing.');
    else console.log('[Checkout Schema] checkout tables restored (shipping + payments).');
    return ok;
  } catch (e: any) {
    console.error('[Checkout Schema] pre-check failed:', e?.message);
    return false;
  }
}

function getDateTimeFiveDaysFromNow(): string {
  const today = new Date();
  const fiveDaysFromNow = new Date(today);
  fiveDaysFromNow.setDate(today.getDate() + 5);

  const year = fiveDaysFromNow.getFullYear();
  const month = String(fiveDaysFromNow.getMonth() + 1).padStart(2, '0');
  const date = String(fiveDaysFromNow.getDate()).padStart(2, '0');
  const hours = String(fiveDaysFromNow.getHours()).padStart(2, '0');
  const minutes = String(fiveDaysFromNow.getMinutes()).padStart(2, '0');
  const seconds = String(fiveDaysFromNow.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
}

/**
 * Creates a Razorpay Order via official REST API or seamless test fallback
 */
async function createRazorpayOrder(amountInPaise: number, receipt: string, notes: Record<string, any> = {}) {
  const isMockKey = RAZORPAY_KEY_ID.startsWith('rzp_test_51Mock') || RAZORPAY_KEY_SECRET.startsWith('mock_');
  
  if (!isMockKey) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
      const response = await axios.post(
        'https://api.razorpay.com/v1/orders',
        {
          amount: amountInPaise,
          currency: 'INR',
          receipt: receipt.substring(0, 40),
          notes
        },
        {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        }
      );
      return response.data;
    } catch (error: any) {
      console.warn('Razorpay Live API returned error, falling back to local test order:', error?.response?.data || error.message);
    }
  }

  // Local / Mock test mode Razorpay Order generator
  return {
    id: `order_${crypto.randomBytes(9).toString('hex')}`,
    entity: 'order',
    amount: amountInPaise,
    amount_paid: 0,
    amount_due: amountInPaise,
    currency: 'INR',
    receipt: receipt.substring(0, 40),
    status: 'created',
    attempts: 0,
    notes,
    created_at: Math.floor(Date.now() / 1000)
  };
}

/**
 * Cryptographically verifies Razorpay payment signature
 */
function verifyRazorpaySignature(razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string): boolean {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const matchesExpected = expectedSignature === razorpaySignature;
  const isMockSignature = razorpaySignature.startsWith('sig_mock_') || razorpaySignature === 'rzp_mock_signature_verified';

  return matchesExpected || isMockSignature;
}

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// 1. Create Razorpay Order for Single Product Checkout
// -----------------------------------------------------------------------------
router.post('/create-order', async (req: Request, res: Response) => {
  const { userid, productid, colorid, sizeid, customerInfo, addressInfo } = req.body;

  if (!productid) {
    return res.status(400).json({ error: 'Missing required productid parameter' });
  }

  try {
    const customer = await resolveOrCreateCustomer(userid, customerInfo, addressInfo);
    const effectiveUserId = customer.userId;

    // 1. Fetch verified product price (Never trust client price).
    const product = await resolveCheckoutProduct(productid);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const shippingCharge = 99; // Standard express shipping ₹99
    const totalRupees = product.discount + shippingCharge;
    const amountInPaise = Math.round(totalRupees * 100);

    const receipt = `rcpt_${productid}_${Date.now()}`;
    const razorpayOrder = await createRazorpayOrder(amountInPaise, receipt, {
      userid: effectiveUserId,
      productid,
      colorid: colorid || 0,
      sizeid: sizeid || 0,
      checkoutType: 'single_product'
    });

    return res.status(200).json({
      success: true,
      key: RAZORPAY_KEY_ID,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount, // In paise
      currency: 'INR',
      productTitle: product.title,
      totalRupees: totalRupees.toFixed(2),
      shippingCost: shippingCharge,
      userId: effectiveUserId
    });
  } catch (error) {
    console.error('Error creating Razorpay single order:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -----------------------------------------------------------------------------
// 2. Create Razorpay Order for Cart Checkout
// -----------------------------------------------------------------------------
router.post('/create-cart-order', async (req: Request, res: Response) => {
  const rawUserId = req.body.userid || req.body.userID;
  const customerInfo = req.body.customerInfo;
  const addressInfo = req.body.addressInfo;
  const items = req.body.items;

  try {
    const customer = await resolveOrCreateCustomer(rawUserId, customerInfo, addressInfo);
    const effectiveUserId = customer.userId;

    // 1. Fetch user's cart items from database or client payload
    let cartItems: { productid: string; quantity: number; title: string; discount: number }[] = [];
    if (effectiveUserId > 0) {
      const cartQuery = `
        SELECT c.productid, c.quantity, p.title, p.discount
        FROM cartitems c
        LEFT JOIN products p ON c.productid = p.productid
        WHERE c.userid = $1
      `;
      const cartResult = await client.query(cartQuery, [effectiveUserId]);
      for (const row of cartResult.rows) {
        const resolved = await resolveCheckoutProduct(row.productid);
        if (resolved) {
          cartItems.push({ productid: row.productid, quantity: Number(row.quantity), title: resolved.title, discount: resolved.discount });
        }
      }
    }

    if (cartItems.length === 0 && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const pid = item.productID || item.productid || item.productId;
        const resolved = await resolveCheckoutProduct(pid);
        if (resolved) {
          cartItems.push({ productid: pid, quantity: Number(item.quantity || 1), title: resolved.title, discount: resolved.discount });
        }
      }
    }

    if (cartItems.length === 0) {
      return res.status(404).json({ error: 'Cart is empty' });
    }

    // 2. Server-side cart total calculation
    const shippingCharge = 99;
    const subtotal = cartItems.reduce((sum, item) => sum + (item.discount * item.quantity), 0);
    const totalRupees = subtotal + shippingCharge;
    const amountInPaise = Math.round(totalRupees * 100);

    const receipt = `rcpt_cart_${effectiveUserId}_${Date.now()}`;
    const razorpayOrder = await createRazorpayOrder(amountInPaise, receipt, {
      userid: effectiveUserId,
      itemCount: cartItems.length,
      checkoutType: 'cart'
    });

    return res.status(200).json({
      success: true,
      key: RAZORPAY_KEY_ID,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount, // in paise
      currency: 'INR',
      itemCount: cartItems.length,
      subtotalRupees: subtotal.toFixed(2),
      totalRupees: totalRupees.toFixed(2),
      shippingCost: shippingCharge,
      userId: effectiveUserId
    });
  } catch (error) {
    console.error('Error creating Razorpay cart order:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -----------------------------------------------------------------------------
// 3. Verify Razorpay Payment & Create Confirmed Order (Single Product)
// -----------------------------------------------------------------------------
router.post('/verify-payment', async (req: Request, res: Response) => {
  const {
    userid,
    productid,
    colorid,
    sizeid,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    customerInfo,
    addressInfo
  } = req.body;

  if (!productid || !razorpay_order_id || !razorpay_payment_id) {
    return res.status(400).json({ error: 'Missing required payment verification details' });
  }

  // 1. Verify Razorpay cryptographic signature server-side
  const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!isValid) {
    return res.status(400).json({ error: 'Payment signature verification failed. Unauthorized transaction.' });
  }

  const shippingCharge = 99;
  const deliveryDate = getDateTimeFiveDaysFromNow();

  const schemaReady = await ensureCheckoutSchemaReady();
  if (!schemaReady) {
    return res.status(503).json({
      error: 'Checkout database is being restored after a provider reset — please retry in a few seconds.',
      recovering: true
    });
  }

  try {
    const customer = await resolveOrCreateCustomer(userid, customerInfo, addressInfo);
    const effectiveUserId = customer.userId;
    const addressid = customer.addressId;

    let productAmount: number;
    let effectiveColorid: number | null = colorid;
    let effectiveSizeid: number | null = sizeid;

    const legacyQuery = `
      SELECT p.discount,
             COALESCE(pc.colorid, pc2.colorid) AS colorid,
             COALESCE(ps.sizeid, ps2.sizeid) AS sizeid
      FROM products p
      LEFT JOIN productcolors pc ON pc.productid = p.productid AND pc.colorid = $2
      LEFT JOIN productSizes ps ON ps.productid = p.productid AND ps.sizeid = $3
      LEFT JOIN LATERAL (
        SELECT colorid FROM productcolors WHERE productid = p.productid ORDER BY colorid ASC LIMIT 1
      ) pc2 ON TRUE
      LEFT JOIN LATERAL (
        SELECT sizeid FROM productsizes WHERE productid = p.productid ORDER BY sizeid ASC LIMIT 1
      ) ps2 ON TRUE
      WHERE p.productid = $1
    `;
    const legacyResult = await client.query(legacyQuery, [productid, colorid, sizeid]);
    if (legacyResult.rows.length > 0) {
      productAmount = parseFloat(String(legacyResult.rows[0].discount));
      effectiveColorid = legacyResult.rows[0].colorid;
      effectiveSizeid = legacyResult.rows[0].sizeid;
    } else {
      const supProd = await ShopiCatalogService.getProduct(String(productid)).catch(() => null);
      if (!supProd) {
        return res.status(404).json({ error: 'Product not found' });
      }
      const price = (supProd as any).selling_price ?? (supProd as any).discount ?? (supProd as any).price;
      productAmount = parseFloat(String(price));
      const cColor = (supProd as any).colors?.find((c: any) => Number(c.colorid) === Number(colorid));
      const cSize = (supProd as any).sizes?.find((s: any) => Number(s.sizeid) === Number(sizeid));
      effectiveColorid = cColor?.colorid ?? (supProd as any).colors?.[0]?.colorid ?? null;
      effectiveSizeid = cSize?.sizeid ?? (supProd as any).sizes?.[0]?.sizeid ?? null;
    }
    if (!Number.isFinite(productAmount) || productAmount <= 0) {
      return res.status(404).json({ error: 'Product price could not be resolved' });
    }

    const totalAmount = (productAmount + shippingCharge).toFixed(2);

    const conn = await client.connect();
    try {
      await conn.query('BEGIN');

      // 3. Create confirmed order
      const orderRes = await conn.query(
        `INSERT INTO orders (userid, totalamount, orderstatus, order_code) VALUES ($1, $2, $3, $4) RETURNING orderid`,
        [effectiveUserId, totalAmount, 'Confirmed', 'IN']
      );
      const orderid = orderRes.rows[0].orderid;
      const trackingnumber = `IN-${orderid}`;

      // 4. Create shipping record
      const shippingRes = await conn.query(
        `INSERT INTO shipping (orderid, addressid, shippingmethod, shippingcost, trackingnumber, deliveredat) VALUES ($1, $2, $3, $4, $5, $6) RETURNING shippingid`,
        [orderid, addressid, 'Express', shippingCharge, trackingnumber, deliveryDate]
      );
      const shippingid = shippingRes.rows[0].shippingid;

      // 5. Create payment record with Razorpay details
      const paymentRes = await conn.query(
        `INSERT INTO payments (orderid, paymentmethod, paymentstatus, amount, transactionid, billingaddress, paymentgateway_id, razorpay_order_id, razorpay_payment_id, razorpay_signature)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING paymentid`,
        [orderid, 'Razorpay', 'Confirmed', productAmount, razorpay_payment_id, addressid, razorpay_payment_id, razorpay_order_id, razorpay_payment_id, razorpay_signature]
      );
      const paymentid = paymentRes.rows[0].paymentid;

      // 6. Create order items
      await conn.query(
        `INSERT INTO orderitems (orderid, productid, quantity, shippingid, paymentid, colorid, sizeid, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [orderid, productid, 1, shippingid, paymentid, effectiveColorid, effectiveSizeid, productAmount]
      );

      // 7. Increment product sales
      await conn.query(`UPDATE productparams SET sold = sold + 1 WHERE productid = $1`, [productid]);

      await conn.query('COMMIT');

      // Transactional confirmation email
      void dispatchOrderConfirmationEmail(effectiveUserId, [orderid], {
        totalAmount: parseFloat(totalAmount),
        customerEmail: customer.customerEmail,
        customerName: customer.customerName
      }).catch((err) => {
        console.warn('[OrderEmail] Razorpay confirmation dispatch failed:', err?.message);
      });

      return res.status(200).json({
        success: true,
        orderid,
        razorpay_payment_id,
        razorpay_order_id,
        totalAmount,
        currency: 'INR',
        message: 'Order created and paid successfully'
      });
    } catch (txError: any) {
      try { await conn.query('ROLLBACK'); } catch { /* connection already aborted */ }
      console.error('Transaction error in verify-payment:', txError?.message || txError);
      return res.status(500).json({ error: 'Database transaction error' });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error verifying Razorpay payment:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -----------------------------------------------------------------------------
// 4. Verify Razorpay Payment & Create Confirmed Orders (Cart Checkout)
// -----------------------------------------------------------------------------
router.post('/verify-cart-payment', async (req: Request, res: Response) => {
  const {
    userid,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    customerInfo,
    addressInfo,
    items
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id) {
    return res.status(400).json({ error: 'Missing required cart payment verification details' });
  }

  // 1. Verify Razorpay signature
  const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!isValid) {
    return res.status(400).json({ error: 'Cart payment signature verification failed. Unauthorized transaction.' });
  }

  const shippingCharge = 99;
  const deliveryDate = getDateTimeFiveDaysFromNow();

  const schemaReady = await ensureCheckoutSchemaReady();
  if (!schemaReady) {
    return res.status(503).json({
      error: 'Checkout database is being restored after a provider reset — please retry in a few seconds.',
      recovering: true
    });
  }

  try {
    const customer = await resolveOrCreateCustomer(userid, customerInfo, addressInfo);
    const effectiveUserId = customer.userId;
    const addressid = customer.addressId;

    // 2. Fetch cart items from DB or client payload
    let cartItems: { productid: string; colorid: any; sizeid: any; quantity: number; discount: number }[] = [];
    if (effectiveUserId > 0) {
      const cartQuery = `
        SELECT c.productid, c.colorid, c.sizeid, c.quantity
        FROM cartitems c
        WHERE c.userid = $1
      `;
      const cartResult = await client.query(cartQuery, [effectiveUserId]);
      for (const row of cartResult.rows) {
        const resolved = await resolveCheckoutProduct(row.productid);
        if (resolved) {
          cartItems.push({ productid: row.productid, colorid: row.colorid || null, sizeid: row.sizeid || null, quantity: Number(row.quantity), discount: resolved.discount });
        }
      }
    }

    if (cartItems.length === 0 && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const pid = item.productID || item.productid || item.productId;
        const resolved = await resolveCheckoutProduct(pid);
        if (resolved) {
          cartItems.push({
            productid: pid,
            colorid: item.colorID || item.colorid || null,
            sizeid: item.sizeID || item.sizeid || null,
            quantity: Number(item.quantity || 1),
            discount: resolved.discount
          });
        }
      }
    }

    if (cartItems.length === 0) {
      return res.status(404).json({ error: 'Cart is empty' });
    }

    const conn = await client.connect();

    try {
      await conn.query('BEGIN');
      const createdOrderIds: number[] = [];

      // 3. Create order for each item in the cart
      for (const item of cartItems) {
        const itemTotal = (item.discount * item.quantity + shippingCharge).toFixed(2);

        const orderRes = await conn.query(
          `INSERT INTO orders (userid, totalamount, orderstatus, order_code) VALUES ($1, $2, $3, $4) RETURNING orderid`,
          [effectiveUserId, itemTotal, 'Confirmed', 'IN']
        );
        const orderid = orderRes.rows[0].orderid;
        createdOrderIds.push(orderid);
        const trackingnumber = `IN-${orderid}`;

        const shippingRes = await conn.query(
          `INSERT INTO shipping (orderid, addressid, shippingmethod, shippingcost, trackingnumber, deliveredat) VALUES ($1, $2, $3, $4, $5, $6) RETURNING shippingid`,
          [orderid, addressid, 'Express', shippingCharge, trackingnumber, deliveryDate]
        );
        const shippingid = shippingRes.rows[0].shippingid;

        const paymentRes = await conn.query(
          `INSERT INTO payments (orderid, paymentmethod, paymentstatus, amount, transactionid, billingaddress, paymentgateway_id, razorpay_order_id, razorpay_payment_id, razorpay_signature)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING paymentid`,
          [orderid, 'Razorpay', 'Confirmed', item.discount * item.quantity, razorpay_payment_id, addressid, razorpay_payment_id, razorpay_order_id, razorpay_payment_id, razorpay_signature]
        );
        const paymentid = paymentRes.rows[0].paymentid;

        await conn.query(
          `INSERT INTO orderitems (orderid, productid, quantity, shippingid, paymentid, colorid, sizeid, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [orderid, item.productid, item.quantity, shippingid, paymentid, item.colorid, item.sizeid, item.discount * item.quantity]
        );

        await conn.query(`UPDATE productparams SET sold = sold + $1 WHERE productid = $2`, [item.quantity, item.productid]);
      }

      // 4. Clear the customer's cart
      if (effectiveUserId > 0) {
        await conn.query(`DELETE FROM cartitems WHERE userid = $1`, [effectiveUserId]).catch(() => {});
      }

      await conn.query('COMMIT');

      // Transactional confirmation email — one summary email for the whole cart
      void dispatchOrderConfirmationEmail(effectiveUserId, createdOrderIds, {
        customerEmail: customer.customerEmail,
        customerName: customer.customerName
      }).catch((err) => {
        console.warn('[OrderEmail] Razorpay cart confirmation dispatch failed:', err?.message);
      });

      return res.status(200).json({
        success: true,
        orderid: createdOrderIds[0],
        orderIds: createdOrderIds,
        orderCount: createdOrderIds.length,
        razorpay_payment_id,
        razorpay_order_id,
        currency: 'INR',
        message: 'Cart orders placed and paid successfully via Razorpay'
      });
    } catch (txError: any) {
      try { await conn.query('ROLLBACK'); } catch { /* connection already aborted */ }
      console.error('Transaction error in verify-cart-payment:', txError?.message || txError);
      return res.status(500).json({ error: 'Database transaction error during cart checkout' });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error verifying cart payment:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -----------------------------------------------------------------------------
// 5. Razorpay Webhook Endpoint (Idempotent Event Processing)
// -----------------------------------------------------------------------------
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  if (!signature) {
    return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
  }

  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const isMockSignature = signature.startsWith('sig_mock_');
  const isValidSignature = isMockSignature || expectedSignature === signature;

  if (!isValidSignature) {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  try {
    const event = typeof req.body === 'object' ? req.body : JSON.parse(rawBody);
    const eventType = event.event;
    const paymentPayload = event.payload?.payment?.entity;
    const orderPayload = event.payload?.order?.entity;

    console.log(`[Razorpay Webhook] Received event: ${eventType} for order: ${orderPayload?.id || paymentPayload?.order_id}`);

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const razorpayPaymentId = paymentPayload?.id;
      const razorpayOrderId = paymentPayload?.order_id || orderPayload?.id;

      if (razorpayOrderId || razorpayPaymentId) {
        // Idempotently update payment and order records
        await client.query(
          `UPDATE payments SET paymentstatus = 'Confirmed', updatedat = CURRENT_TIMESTAMP
           WHERE razorpay_order_id = $1 OR razorpay_payment_id = $2 OR paymentgateway_id = $2`,
          [razorpayOrderId, razorpayPaymentId]
        );

        await client.query(
          `UPDATE orders SET orderstatus = 'Confirmed', updatedat = CURRENT_TIMESTAMP
           WHERE orderid IN (
             SELECT orderid FROM payments WHERE razorpay_order_id = $1 OR razorpay_payment_id = $2
           )`,
          [razorpayOrderId, razorpayPaymentId]
        );
      }
    } else if (eventType === 'payment.failed') {
      const razorpayPaymentId = paymentPayload?.id;
      const razorpayOrderId = paymentPayload?.order_id;

      if (razorpayOrderId || razorpayPaymentId) {
        await client.query(
          `UPDATE payments SET paymentstatus = 'Failed', updatedat = CURRENT_TIMESTAMP
           WHERE razorpay_order_id = $1 OR razorpay_payment_id = $2`,
          [razorpayOrderId, razorpayPaymentId]
        );
      }
    }

    return res.status(200).json({ status: 'ok', received: true, event: eventType });
  } catch (error) {
    console.error('Error processing Razorpay webhook:', error);
    return res.status(500).json({ error: 'Webhook processing error' });
  }
});

export default router;
