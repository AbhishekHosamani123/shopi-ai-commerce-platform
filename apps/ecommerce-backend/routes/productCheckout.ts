import express, { Request, Response } from 'express';
import { dispatchOrderConfirmationEmail } from '../merchant-communication/order-email-dispatcher';
import { client } from '../data/DB';
import { ensureCheckoutSchemaReady } from './razorpay';
import Stripe from 'stripe';
import {orderCreationSchema,orderCreationSchema2,checkoutSchema,OrderIDSchema,createPaymentIntent} from '../validators/productCheckoutValidator';
import { matchedData, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import ShopiCatalogService from '../data/shopiCatalogService';
import { resolveOrCreateCustomer } from '../utils/guestCheckoutHelper';
const router = express.Router();
const stripeApiKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_mock_stripe_key_2026';
const stripe = new Stripe(stripeApiKey);

/**
 * Resolve the single-product checkout price + effective variant ids.
 * Legacy products table first, then the live shopi catalog — catalog-only SKUs
 * are orderable (the old products-only lookup 404'd them). NULL-variant
 * tolerant: chatbot-added items carry no color/size; falls back to the
 * product's first variant so orderitems never carry unmatched references.
 */
async function resolveSingleProductCheckout(productid: string, colorid: any, sizeid: any) {
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
  if (productResult.rows.length > 0) {
    const row = productResult.rows[0];
    if (row.discount !== null && row.discount !== undefined && parseFloat(String(row.discount)) > 0) {
      return { amount: String(row.discount), colorid: row.colorid, sizeid: row.sizeid };
    }
  }
  const supProd = await ShopiCatalogService.getProduct(String(productid)).catch(() => null);
  if (!supProd) return null;
  const price = (supProd as any).selling_price ?? (supProd as any).discount ?? (supProd as any).price;
  const cColor = (supProd as any).colors?.find((c: any) => Number(c.colorid) === Number(colorid));
  const cSize = (supProd as any).sizes?.find((s: any) => Number(s.sizeid) === Number(sizeid));
  return {
    amount: String(price),
    colorid: cColor?.colorid ?? (supProd as any).colors?.[0]?.colorid ?? null,
    sizeid: cSize?.sizeid ?? (supProd as any).sizes?.[0]?.sizeid ?? null
  };
}

function getDateTimeFiveDaysFromNow():string {
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

router.post('/payment-on-delivery/create-order', async (req:Request, res:Response) => {
  try {
    const { userid, productid, colorid, sizeid, customerInfo, addressInfo } = req.body;

    if (!productid) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    if (!(await ensureCheckoutSchemaReady())) {
      return res.status(503).json({
        error: 'Checkout database is being restored after a provider reset — please retry in a few seconds.',
        recovering: true
      });
    }

    const customer = await resolveOrCreateCustomer(userid, customerInfo, addressInfo);
    const effectiveUserId = customer.userId;
    const addressid = customer.addressId;

    const deliveryDate = getDateTimeFiveDaysFromNow();
    const paymentCharge = 15;
    const transactionid = `TS-${randomUUID()}`;

    const resolved = await resolveSingleProductCheckout(productid, colorid, sizeid);
    if (!resolved) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const amount = resolved.amount;
    const shippingcharge = 99;
    const totalAmount = (shippingcharge + paymentCharge + parseFloat(amount)).toFixed(2);

    const conn = await client.connect();
    try {
      await conn.query('BEGIN');
      const orderRes = await conn.query(
        `INSERT INTO orders (userid, totalamount, orderstatus, order_code) VALUES ($1, $2, $3, $4) RETURNING orderid`,
        [effectiveUserId, totalAmount, 'Confirmed', 'IN']
      );
      const orderid = orderRes.rows[0].orderid;
      const trackingnumber = `IN-${orderid}`;

      const shippingRes = await conn.query(
        `INSERT INTO shipping (orderid, addressid, shippingmethod, shippingcost, trackingnumber, deliveredat) VALUES ($1, $2, $3, $4, $5, $6) RETURNING shippingid`,
        [orderid, addressid, 'Express', shippingcharge, trackingnumber, deliveryDate]
      );
      const shippingid = shippingRes.rows[0].shippingid;

      const paymentRes = await conn.query(
        `INSERT INTO payments (orderid, paymentmethod, paymentstatus, amount, transactionid, billingaddress) VALUES ($1, $2, $3, $4, $5, $6) RETURNING paymentid`,
        [orderid, 'Payment on Delivery', 'Pending', amount, transactionid, addressid]
      );
      const paymentid = paymentRes.rows[0].paymentid;

      await conn.query(
        `INSERT INTO orderitems (orderid, productid, quantity, shippingid, paymentid, colorid, sizeid, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [orderid, productid, 1, shippingid, paymentid, resolved.colorid, resolved.sizeid, amount]
      );
      await conn.query(`UPDATE productparams SET sold = sold + 1 WHERE productid = $1`, [productid]);
      await conn.query('COMMIT');

      void dispatchOrderConfirmationEmail(effectiveUserId, [orderid], {
        customerEmail: customer.customerEmail,
        customerName: customer.customerName
      }).catch((err) => {
        console.warn('[OrderEmail] Single product COD confirmation dispatch failed:', err?.message);
      });

      res.status(200).json({ orderid });
    } catch (error) {
      await conn.query('ROLLBACK');
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/card/create-order', async (req:Request, res:Response) => {
  try {
    const { userid, productid, colorid, sizeid, paymentid, paymentStatus, customerInfo, addressInfo } = req.body;

    if (!productid) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    if (!(await ensureCheckoutSchemaReady())) {
      return res.status(503).json({
        error: 'Checkout database is being restored after a provider reset — please retry in a few seconds.',
        recovering: true
      });
    }

    const customer = await resolveOrCreateCustomer(userid, customerInfo, addressInfo);
    const effectiveUserId = customer.userId;
    const addressid = customer.addressId;

    const paymentState = paymentStatus === 'Succeeded' ? 'Confirmed' : 'Pending';
    const effectivePaymentId = paymentid || `card_${Date.now()}`;
    const transactionid = `TS-${randomUUID()}`;
    const deliveryDate = getDateTimeFiveDaysFromNow();
    const shippingcharge = 99;

    const resolved = await resolveSingleProductCheckout(productid, colorid, sizeid);
    if (!resolved) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const amount = resolved.amount;
    const totalAmount = (shippingcharge + parseFloat(amount)).toFixed(2);

    const conn = await client.connect();
    try {
      await conn.query('BEGIN');
      const orderRes = await conn.query(
        `INSERT INTO orders (userid, totalamount, orderstatus, order_code) VALUES ($1, $2, $3, $4) RETURNING orderid`,
        [effectiveUserId, totalAmount, 'Confirmed', 'IN']
      );
      const orderid = orderRes.rows[0].orderid;
      const trackingnumber = `IN-${orderid}`;

      const shippingRes = await conn.query(
        `INSERT INTO shipping (orderid, addressid, shippingmethod, shippingcost, trackingnumber, deliveredat) VALUES ($1, $2, $3, $4, $5, $6) RETURNING shippingid`,
        [orderid, addressid, 'Express', shippingcharge, trackingnumber, deliveryDate]
      );
      const shippingid = shippingRes.rows[0].shippingid;

      const paymentRes = await conn.query(
        `INSERT INTO payments (orderid, paymentmethod, paymentstatus, amount, transactionid, billingaddress, paymentgateway_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING paymentid`,
        [orderid, 'Card', paymentState, amount, transactionid, addressid, effectivePaymentId]
      );
      const paymentID = paymentRes.rows[0].paymentid;

      await conn.query(
        `INSERT INTO orderitems (orderid, productid, quantity, shippingid, paymentid, colorid, sizeid, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [orderid, productid, 1, shippingid, paymentID, resolved.colorid, resolved.sizeid, amount]
      );
      await conn.query(`UPDATE productparams SET sold = sold + 1 WHERE productid = $1`, [productid]);
      await conn.query('COMMIT');

      void dispatchOrderConfirmationEmail(effectiveUserId, [orderid], {
        customerEmail: customer.customerEmail,
        customerName: customer.customerName
      }).catch(() => {});

      res.status(200).json({ orderid });
    } catch (error) {
      await conn.query('ROLLBACK');
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
router.get('/orders/status/:orderID',OrderIDSchema, async (req:Request, res:Response) => {
  const result = validationResult(req);
  if(result.isEmpty()){
    const { orderID } = matchedData(req);
    try {
      // Check if the order with the given orderID exists and fetch relevant details
      const orderQuery = `
        SELECT o.orderstatus, p.paymentstatus, p.paymentmethod
        FROM orders o
        JOIN payments p ON p.orderid = o.orderid
        WHERE o.orderid = $1
      `;
      const orderResult = await client.query(orderQuery, [orderID]);
  
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
  
      const { orderstatus, paymentstatus, paymentmethod } = orderResult.rows[0];
      // Check conditions and return appropriate status code
      if (orderstatus === 'Confirmed' && paymentstatus === 'Pending' && paymentmethod === 'Payment on Delivery') {
        return res.status(200).json({ orderstatus, paymentstatus, paymentmethod });
      } else if (orderstatus === 'Confirmed' && paymentstatus === 'Pending' && paymentmethod === 'Card') {
        return res.status(402).json({ orderstatus, paymentstatus, paymentmethod });
      } else if (orderstatus === 'Failed' && paymentstatus === 'Failed') {
        return res.status(400).json({ orderstatus, paymentstatus, paymentmethod });
      } else if (orderstatus === 'Confirmed' && paymentstatus === 'Confirmed' && (paymentmethod === 'Card' || paymentmethod === 'Razorpay')) {
        return res.status(200).json({ orderstatus, paymentstatus, paymentmethod });
      } else {
        return res.status(404).json({ error: 'Order state not recognized' });
      }
    } catch (error) {
      console.error('Error checking order status:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }else
  {
      res.status(500).json({ message: 'Validation error' });
  }
});

router.get('/checkout/product-details/:productid/:sizeid/:colorid',checkoutSchema, async (req:Request, res:Response) => {
  const result = validationResult(req)
  if(result.isEmpty()){
    const { productid, sizeid, colorid } = matchedData(req);
    try {
      // Fetch product details
      const productQuery = `
        SELECT
          p.title,
          p.price,
          p.discount,
          ps.sizename,
          pc.colorname,
          pi.imglink,
          pi.imgalt
        FROM products p
        JOIN productSizes ps ON ps.productid = p.productid AND ps.sizeid = $2
        JOIN productcolors pc ON pc.productid = p.productid AND pc.colorid = $3
        JOIN productimages pi ON pi.productid = p.productid AND pi.isprimary = true
        WHERE p.productid = $1
      `;
      const productResult = await client.query(productQuery, [productid, sizeid, colorid]);
  
      if (productResult.rows.length === 0) {
        return res.status(404).json({ error: 'Product details not found' });
      }
  
      const productDetails = productResult.rows[0];
  
      res.status(200).json({
        title: productDetails.title,
        price: productDetails.price,
        discount: productDetails.discount,
        sizename: productDetails.sizename,
        colorname: productDetails.colorname,
        imglink: productDetails.imglink,
        imgalt: productDetails.imgalt,
        shippingcost:5
      });
    } catch (error) {
      console.error('Error fetching product details:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }else
  {

      res.status(500).json({ message: 'Validation error' });
  }
  
});


const calculateOrderAmount = async (item:any) => {
  const shippingcharge = 99;
  const productCheckQuery = 'SELECT discount FROM products WHERE productid = $1';
  const productCheckResult = await client.query(productCheckQuery, [item]);
  const price = (parseFloat(productCheckResult.rows[0].discount)+shippingcharge) * 100;
  // Calculate the order total on the server to prevent
  // people from directly manipulating the amount on the client
  return price;
};

router.post("/create/payment/create-payment-intent",createPaymentIntent, async (req:Request, res:Response) => {
  const result = validationResult(req);
  if(result.isEmpty()){
    const { item,userID } = req.body;
    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: await calculateOrderAmount(item),
      currency: "inr",
      // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
      automatic_payment_methods: {
        enabled: true,
      },
      metadata:{
        userID,
        type:'product',
        productID:item
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


export default router;
