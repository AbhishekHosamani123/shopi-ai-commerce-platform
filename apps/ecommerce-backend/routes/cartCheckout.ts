import express, { Request, Response } from 'express';
import { dispatchOrderConfirmationEmail } from '../merchant-communication/order-email-dispatcher';
import { client } from '../data/DB';
import ShopiCatalogService from '../data/shopiCatalogService';
import { ensureCheckoutSchemaReady } from './razorpay';
import { paymentCreationSchema, userIDSchema } from '../validators/cartCheckoutValidation';
import Stripe from 'stripe';
import { validationResult,matchedData } from 'express-validator';
import { randomUUID } from 'crypto';
const router = express.Router();
const stripeApiKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_mock_stripe_key_2026';
const stripe = new Stripe(stripeApiKey);
function getDateTimeFiveDaysFromNow() {
  const today = new Date();
  const fiveDaysFromNow = new Date(today);
  fiveDaysFromNow.setDate(today.getDate() + 5);

  const year = fiveDaysFromNow.getFullYear();
  const month = String(fiveDaysFromNow.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
  const date = String(fiveDaysFromNow.getDate()).padStart(2, '0');
  const hours = String(fiveDaysFromNow.getHours()).padStart(2, '0');
  const minutes = String(fiveDaysFromNow.getMinutes()).padStart(2, '0');
  const seconds = String(fiveDaysFromNow.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
};

const shippingcharge = 99;
const calculateCartAmount = async (userID:any) => {
  const productCheckQuery = 'SELECT products.discount,cartitems.quantity FROM cartitems INNER JOIN products ON cartitems.productid = products.productid WHERE userid = $1';
  const productCheckResult = await client.query(productCheckQuery, [userID]);
  const priceCalc = productCheckResult.rows.reduce((sum,item)=>{return sum + (parseFloat(item.discount)*item.quantity)},0)
  const price = (priceCalc + shippingcharge) * 100;
  // Calculate the order total on the server to prevent
  // people from directly manipulating the amount on the client
  return price;
};
router.post("/create/cart-payment/create-payment-intent",userIDSchema, async (req:Request, res:Response) => {
  const result = validationResult(req);
  if(result.isEmpty()){
    const data = matchedData(req);
    const userID = data.userID;
    // Create a PaymentIntent with the order amount and currency
    const paymentIntent =  await stripe.paymentIntents.create({
      amount: await calculateCartAmount(userID),
      currency: "inr",
      // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
      automatic_payment_methods: {
        enabled: true,
      },
      metadata:{
        userID,
        orderType:'cart'
      }
    });
  
    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  }else
  {
      res.status(500).json({ message: 'Validation error' });
  }
});
async function fetchProductData(productid:string,colorid:string,sizeid:string,quantity:number){
  try {
    // Variant-tolerant fetch: chatbot-added items may carry NULL color/size
    // (auto-resolved defaults), and INNER JOINs on NULL never match, which
    // made those items silently vanish from checkout (empty products list).
    // LEFT JOINs + COALESCE keep the product visible; exact variant ids are
    // still preferred when present.
    const productQuery = `
      SELECT
        p.title,
        p.price,
        p.discount,
        COALESCE(ps.sizename, (SELECT ps2.sizename FROM productsizes ps2 WHERE ps2.productid = p.productid ORDER BY ps2.sizeid LIMIT 1), 'Standard') AS sizename,
        COALESCE(pc.colorname, (SELECT pc2.colorname FROM productcolors pc2 WHERE pc2.productid = p.productid ORDER BY pc2.colorid LIMIT 1), 'Standard') AS colorname,
        pi.imglink,
        pi.imgalt
      FROM products p
      LEFT JOIN productSizes ps ON ps.productid = p.productid AND ps.sizeid = $2
      LEFT JOIN productcolors pc ON pc.productid = p.productid AND pc.colorid = $3
      LEFT JOIN productimages pi ON pi.productid = p.productid AND pi.isprimary = true
      WHERE p.productid = $1
    `;
    const productResult = await client.query(productQuery, [productid, sizeid, colorid]);

    if (productResult.rows.length === 0) {
      // The legacy products table is sparsely populated (the live catalog is
      // served by ShopiCatalogService). Fall back to the catalog so a cart
      // item whose product only exists there still renders at checkout —
      // previously the endpoint returned an empty entry (products:[[]]) and
      // the checkout page showed the item with blank price / NaN totals.
      try {
        const supProd = await ShopiCatalogService.getProduct(String(productid));
        if (supProd) {
          const color = supProd.colors?.find((c: any) => Number(c.colorid) === Number(colorid));
          const size = supProd.sizes?.find((s: any) => Number(s.sizeid) === Number(sizeid));
          return {
            title: supProd.title,
            price: supProd.price,
            discount: supProd.selling_price ?? supProd.discount ?? supProd.price,
            sizename: size?.sizename || supProd.sizes?.[0]?.sizename || 'Standard',
            colorname: color?.colorname || supProd.colors?.[0]?.colorname || 'Standard',
            imglink: supProd.imglink,
            imgalt: supProd.title,
            shippingcost: 10,
            quantity
          };
        }
      } catch (catalogErr: any) {
        console.warn('[checkout-cart] catalog fallback failed for', productid, catalogErr?.message);
      }
      return [];
    }

    const productDetails = productResult.rows[0];

    return {
      title: productDetails.title,
      price: productDetails.price,
      discount: productDetails.discount,
      sizename: productDetails.sizename,
      colorname: productDetails.colorname,
      imglink: productDetails.imglink,
      imgalt: productDetails.imgalt,
      shippingcost:10,
      quantity
    };
  } catch (error) {
    return error;
  }
}
router.get('/checkout-cart/product-details/:userID',userIDSchema, async (req:Request, res:Response) => {
  const result = validationResult(req);
  if(result.isEmpty()){
    const data = matchedData(req);
    const userID = data.userID;
    try {
      // Fetch product details
      const cartlistQuery = `SELECT productid,sizeid,colorid,quantity FROM cartitems WHERE userid = $1`;
      const cartItems = await client.query(cartlistQuery,[userID]);
      if(cartItems.rows.length===0){
        return res.status(404).json({ error: 'cart items not found' });
      }
      const productResult = await Promise.all(
          cartItems.rows.map(each => fetchProductData(each.productid, each.colorid, each.sizeid,each.quantity))
      );
  
      if (productResult.length === 0) {
        return res.status(404).json({ error: 'Product details not found' });
      }
      res.status(200).json({products:productResult});
    } catch (error) {
      console.error('Error fetching product details:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }else
  {
      res.status(500).json({ message: 'Validation error' });
  }
});
/**
 * Creates one COD order inside its own transaction.
 * Returns the created orderid on success, or a numeric HTTP-like error code
 * (404/500/503) on failure. Returning the exact orderid (instead of the old
 * 200 + a later "latest orders" guess) keeps the confirmation email tied to
 * the orders this call actually created — the old guess sorted VARCHAR
 * orderids as strings ('9' > '12'), attaching the WRONG orders to the email
 * once ids passed single digits.
 */
async function createCashOrder(userid:string,productid:string, colorid:string, sizeid:string,quantity:number): Promise<number | string> {
  // Rebuild checkout tables if a provider DB reset wiped them (shipping,
  // payments were never created by the old recovery — COD order creation
  // failed with the transaction error after every reset).
  if (!(await ensureCheckoutSchemaReady())) return 503;
  const orderid = randomUUID();
  const shippingid = randomUUID();
  const paymentid = randomUUID();
  const transactionid = `TS-${randomUUID()}`;
  const orderitemid = randomUUID();
  const trackingnumber = `IN-${orderid}`;
  const deliveryDate = getDateTimeFiveDaysFromNow();
const paymentCharge = 15;
  try {
    // Resolve the price. Chatbot-added cart items carry NULL colorid/sizeid
    // (auto-resolved defaults); an INNER JOIN on NULL never matches and the
    // item silently 404'd, failing the whole COD order. LEFT JOIN + COALESCE
    // falls back to the product's first variant (same fix the checkout
    // product-details endpoint received).
    const productQuery = `
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
    const productResult = await client.query(productQuery, [productid, colorid, sizeid]);

    // Resolve price + effective variants. When the product only exists in the
    // live catalog (legacy products table is sparsely populated), fall back
    // to ShopiCatalogService so the item is still orderable (see
    // fetchProductData for the display-side equivalent).
    let amount: string | number;
    let effectiveColorid: number | null;
    let effectiveSizeid: number | null;
    if (productResult.rows.length === 0) {
      try {
        const supProd = await ShopiCatalogService.getProduct(String(productid));
        if (!supProd) return 404;
        const cColor = supProd.colors?.find((c: any) => Number(c.colorid) === Number(colorid)) || supProd.colors?.[0];
        const cSize = supProd.sizes?.find((s: any) => Number(s.sizeid) === Number(sizeid)) || supProd.sizes?.[0];
        amount = supProd.selling_price ?? supProd.discount ?? supProd.price;
        effectiveColorid = cColor?.colorid ?? null;
        effectiveSizeid = cSize?.sizeid ?? null;
      } catch {
        return 404;
      }
    } else {
      amount = productResult.rows[0].discount;
      effectiveColorid = productResult.rows[0].colorid;
      effectiveSizeid = productResult.rows[0].sizeid;
    }
    const addressQuery = `
      SELECT addressid FROM addresses WHERE userid = $1 AND is_default = true
    `;
    const addressResult = await client.query(addressQuery, [userid]);

    if (addressResult.rows.length === 0) {
      return 404;
    }
    const addressid = addressResult.rows[0].addressid;
    const orderShipping = shippingcharge;
    const totalAmount = (orderShipping+paymentCharge+parseFloat(String(amount))*quantity).toFixed(2);

    const conn = await client.connect();
    try {
      await conn.query('BEGIN');

      const orderRes = await conn.query(
        `INSERT INTO orders (userid, totalamount, orderstatus, order_code) VALUES ($1, $2, $3, $4) RETURNING orderid`,
        [userid, totalAmount, 'Confirmed', 'IN']
      );
      const orderid = orderRes.rows[0].orderid;
      const trackingnumber = `IN-${orderid}`;

      const shippingRes = await conn.query(
        `INSERT INTO shipping (orderid, addressid, shippingmethod, shippingcost, trackingnumber, deliveredat) VALUES ($1, $2, $3, $4, $5, $6) RETURNING shippingid`,
        [orderid, addressid, 'Express', orderShipping, trackingnumber, deliveryDate]
      );
      const shippingid = shippingRes.rows[0].shippingid;

      const paymentRes = await conn.query(
        `INSERT INTO payments (orderid, paymentmethod, paymentstatus, amount, transactionid, billingaddress) VALUES ($1, $2, $3, $4, $5, $6) RETURNING paymentid`,
        [orderid, 'Payment on Delivery', 'Pending', parseFloat(String(amount))*quantity, transactionid, addressid]
      );
      const paymentid = paymentRes.rows[0].paymentid;

      await conn.query(
        `INSERT INTO orderitems (orderid, productid, quantity, shippingid, paymentid, colorid, sizeid, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [orderid, productid, quantity, shippingid, paymentid, effectiveColorid, effectiveSizeid, parseFloat(String(amount)) * quantity]
      );
      await conn.query(`UPDATE productparams SET sold = sold + 1 WHERE productid = $1`, [productid]);

      await conn.query('COMMIT');
      return orderid;
    } catch (error: any) {
      try { await conn.query('ROLLBACK'); } catch { /* already aborted */ }
      console.error('[createCashOrder] transaction failed:', error?.message || error);
      return 500;
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('[createCashOrder] pre-transaction failure:', error?.message || error);
    return 500;
  }
}
router.post('/cart-payment-on-delivery/create-order',userIDSchema, async (req:Request, res:Response) => {
  const result = validationResult(req);
  if(result.isEmpty()){
    const data = matchedData(req);
    const userID = data.userID;
    try {
      const cartlistQuery = `SELECT productid,sizeid,colorid,quantity FROM cartitems WHERE userid = $1`;
      const cartItems = await client.query(cartlistQuery,[userID]);
      if(cartItems.rows.length===0){
        return res.status(404).json({ error: 'cart items not found' });
      }
      
      const results = await Promise.all(cartItems.rows.map(each=>createCashOrder(userID,each.productid,each.colorid,each.sizeid,each.quantity)));
      // Error codes (404/500/503) are numbers; created orderids are strings.
      if (results.some(r => typeof r === 'number')) {
        return res.status(500).json({ error: 'One or more orders failed to create' });
      }
      // Transactional confirmation email — best-effort, never blocks checkout.
      // Uses the EXACT orderids created above (the old "latest orders" query
      // sorted VARCHAR orderids lexicographically, so past order 9 the email
      // could reference the wrong — older — orders).
      const createdOrderIds = results as string[];
      void dispatchOrderConfirmationEmail(userID, createdOrderIds).catch(() => {});
      res.status(200).json({message:'Successfully created orders', orderIds: createdOrderIds});
    } catch (error) {
      res.status(500).json({error:'Server Internal Server'});
    }
  }else
  {
      res.status(500).json({ message: 'Validation error' });
  }
});
// Returns the created orderid on success (see createCashOrder contract) or a
// numeric error code.
async function createCardOrder(userid:string, productid:string, colorid:string, sizeid:string, paymentid:string , paymentStatus:string,quantity:number): Promise<number | string>{
  // See createCashOrder: ensure the transaction tables exist first.
  if (!(await ensureCheckoutSchemaReady())) return 503;
  const paymentState = paymentStatus==='Succeeded' ? 'Confirmed' : 'Pending';
  const transactionid = `TS-${randomUUID()}`;
  const deliveryDate = getDateTimeFiveDaysFromNow();
  try {
    // Resolve the price with the same NULL-variant fallback as createCashOrder
    // (chatbot-added cart items carry NULL colorid/sizeid; an INNER JOIN on
    // NULL never matches and the item silently 404'd).
    const productQuery = `
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
    const productResult = await client.query(productQuery, [productid, colorid, sizeid]);

    // Resolve price + effective variants (catalog fallback — see
    // createCashOrder).
    let amount: string | number;
    let effectiveColorid: number | null;
    let effectiveSizeid: number | null;
    if (productResult.rows.length === 0) {
      try {
        const supProd = await ShopiCatalogService.getProduct(String(productid));
        if (!supProd) return 404;
        const cColor = supProd.colors?.find((c: any) => Number(c.colorid) === Number(colorid)) || supProd.colors?.[0];
        const cSize = supProd.sizes?.find((s: any) => Number(s.sizeid) === Number(sizeid)) || supProd.sizes?.[0];
        amount = supProd.selling_price ?? supProd.discount ?? supProd.price;
        effectiveColorid = cColor?.colorid ?? null;
        effectiveSizeid = cSize?.sizeid ?? null;
      } catch {
        return 404;
      }
    } else {
      amount = productResult.rows[0].discount;
      effectiveColorid = productResult.rows[0].colorid;
      effectiveSizeid = productResult.rows[0].sizeid;
    }
    const addressQuery = `
      SELECT addressid FROM addresses WHERE userid = $1 AND is_default = true
    `;
    const addressResult = await client.query(addressQuery, [userid]);

    if (addressResult.rows.length === 0) {
      return 404;
    }
    const addressid = addressResult.rows[0].addressid;
    const orderShipping = shippingcharge;
    const totalAmount = (orderShipping+parseFloat(String(amount))*quantity).toFixed(2);

    const conn = await client.connect();
    try {
      await conn.query('BEGIN');

      const orderRes = await conn.query(
        `INSERT INTO orders (userid, totalamount, orderstatus, order_code) VALUES ($1, $2, $3, $4) RETURNING orderid`,
        [userid, totalAmount, 'Confirmed', 'IN']
      );
      const orderid = orderRes.rows[0].orderid;
      const trackingnumber = `IN-${orderid}`;

      const shippingRes = await conn.query(
        `INSERT INTO shipping (orderid, addressid, shippingmethod, shippingcost, trackingnumber, deliveredat) VALUES ($1, $2, $3, $4, $5, $6) RETURNING shippingid`,
        [orderid, addressid, 'Express', orderShipping, trackingnumber, deliveryDate]
      );
      const shippingid = shippingRes.rows[0].shippingid;

      const paymentRes = await conn.query(
        `INSERT INTO payments (orderid, paymentmethod, paymentstatus, amount, transactionid, billingaddress, paymentgateway_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING paymentid`,
        [orderid, 'Card', paymentState, parseFloat(String(amount))*quantity, transactionid, addressid, paymentid]
      );
      const paymentID = paymentRes.rows[0].paymentid;

      await conn.query(
        `INSERT INTO orderitems (orderid, productid, quantity, shippingid, paymentid, colorid, sizeid, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [orderid, productid, quantity, shippingid, paymentID, effectiveColorid, effectiveSizeid, parseFloat(String(amount)) * quantity]
      );
      await conn.query(`UPDATE productparams SET sold = sold + 1 WHERE productid = $1`, [productid]);

      await conn.query('COMMIT');
      return orderid;
    } catch (error: any) {
      try { await conn.query('ROLLBACK'); } catch { /* already aborted */ }
      console.error('[createCardOrder] transaction failed:', error?.message || error);
      return 500;
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('[createCardOrder] pre-transaction failure:', error?.message || error);
    return 500;
  }
}
router.post('/cart-card/create-order',paymentCreationSchema, async (req:Request, res:Response) => {
  const result = validationResult(req);
  if(result.isEmpty()){
    const data = matchedData(req);
    const { userID,paymentid,paymentstatus } = data;
    try {
      const cartlistQuery = `SELECT productid,sizeid,colorid,quantity FROM cartitems WHERE userid = $1`;
      const cartItems = await client.query(cartlistQuery,[userID]);
      if(cartItems.rows.length===0){
        return res.status(404).json({ error: 'cart items not found' });
      }
      
      const results = await Promise.all(cartItems.rows.map(each=>createCardOrder(userID,each.productid,each.colorid,each.sizeid,paymentid,paymentstatus,each.quantity)));
      // Error codes are numbers; created orderids are strings.
      if (results.some(r => typeof r === 'number')) {
        return res.status(500).json({ error: 'One or more orders failed to create' });
      }
      // Exact created ids (see COD route comment).
      const createdOrderIds = results as string[];
      void dispatchOrderConfirmationEmail(userID, createdOrderIds).catch(() => {});
      res.status(200).json({message:'Successfully created orders', orderIds: createdOrderIds});
    } catch (error) {
      res.status(500).json({error:'Server Internal Server'});
    }
  }else
  {
      console.log(result);
      res.status(500).json({ message: 'Validation error' });
  }
});

export default router;