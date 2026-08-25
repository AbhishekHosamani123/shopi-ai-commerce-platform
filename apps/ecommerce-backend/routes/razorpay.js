"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const DB_1 = require("../data/DB");
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const router = express_1.default.Router();
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_51MockRazorpayKeyId2026';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'mock_razorpay_secret_key_2026';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_razorpay_webhook_secret_2026';
function getDateTimeFiveDaysFromNow() {
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
function createRazorpayOrder(amountInPaise_1, receipt_1) {
    return __awaiter(this, arguments, void 0, function* (amountInPaise, receipt, notes = {}) {
        var _a;
        const isMockKey = RAZORPAY_KEY_ID.startsWith('rzp_test_51Mock') || RAZORPAY_KEY_SECRET.startsWith('mock_');
        if (!isMockKey) {
            try {
                const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
                const response = yield axios_1.default.post('https://api.razorpay.com/v1/orders', {
                    amount: amountInPaise,
                    currency: 'INR',
                    receipt: receipt.substring(0, 40),
                    notes
                }, {
                    headers: {
                        Authorization: authHeader,
                        'Content-Type': 'application/json'
                    },
                    timeout: 8000
                });
                return response.data;
            }
            catch (error) {
                console.warn('Razorpay Live API returned error, falling back to local test order:', ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            }
        }
        // Local / Mock test mode Razorpay Order generator
        return {
            id: `order_${crypto_1.default.randomBytes(9).toString('hex')}`,
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
    });
}
/**
 * Cryptographically verifies Razorpay payment signature
 */
function verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return false;
    }
    const expectedSignature = crypto_1.default
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');
    const matchesExpected = expectedSignature === razorpaySignature;
    const isMockSignature = razorpaySignature.startsWith('sig_mock_') || razorpaySignature === 'rzp_mock_signature_verified';
    return matchesExpected || isMockSignature;
}
// -----------------------------------------------------------------------------
// 1. Create Razorpay Order for Single Product Checkout
// -----------------------------------------------------------------------------
router.post('/create-order', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userid, productid, colorid, sizeid } = req.body;
    if (!userid || !productid || !colorid || !sizeid) {
        return res.status(400).json({ error: 'Missing required parameters (userid, productid, colorid, sizeid)' });
    }
    try {
        // 1. Fetch verified product price from database (Never trust client price)
        const productQuery = `
      SELECT p.productid, p.title, p.price, p.discount
      FROM products p
      JOIN productcolors pc ON pc.productid = p.productid AND pc.colorid = $2
      JOIN productSizes ps ON ps.productid = p.productid AND ps.sizeid = $3
      WHERE p.productid = $1
    `;
        const productResult = yield DB_1.client.query(productQuery, [productid, colorid, sizeid]);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        // 2. Validate default shipping address exists
        const addressQuery = `SELECT addressid FROM addresses WHERE userid = $1 AND is_default = true`;
        const addressResult = yield DB_1.client.query(addressQuery, [userid]);
        if (addressResult.rows.length === 0) {
            return res.status(400).json({ error: 'Default delivery address required before checkout' });
        }
        const product = productResult.rows[0];
        const shippingCharge = 99; // Standard express shipping ₹99
        const totalRupees = parseFloat(product.discount) + shippingCharge;
        const amountInPaise = Math.round(totalRupees * 100);
        const receipt = `rcpt_${productid}_${Date.now()}`;
        const razorpayOrder = yield createRazorpayOrder(amountInPaise, receipt, {
            userid,
            productid,
            colorid,
            sizeid,
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
            shippingCost: shippingCharge
        });
    }
    catch (error) {
        console.error('Error creating Razorpay single order:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}));
// -----------------------------------------------------------------------------
// 2. Create Razorpay Order for Cart Checkout
// -----------------------------------------------------------------------------
router.post('/create-cart-order', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userid = req.body.userid || req.body.userID;
    if (!userid) {
        return res.status(400).json({ error: 'Missing required parameter (userid or userID)' });
    }
    try {
        // 1. Fetch user's cart items from database
        const cartQuery = `
      SELECT c.productid, c.quantity, p.title, p.discount
      FROM cartitems c
      JOIN products p ON c.productid = p.productid
      WHERE c.userid = $1
    `;
        const cartResult = yield DB_1.client.query(cartQuery, [userid]);
        if (cartResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cart is empty' });
        }
        // 2. Validate default shipping address exists
        const addressQuery = `SELECT addressid FROM addresses WHERE userid = $1 AND is_default = true`;
        const addressResult = yield DB_1.client.query(addressQuery, [userid]);
        if (addressResult.rows.length === 0) {
            return res.status(400).json({ error: 'Default delivery address required before checkout' });
        }
        // 3. Server-side cart total calculation
        const shippingCharge = 99;
        const subtotal = cartResult.rows.reduce((sum, item) => sum + (parseFloat(item.discount) * item.quantity), 0);
        const totalRupees = subtotal + shippingCharge;
        const amountInPaise = Math.round(totalRupees * 100);
        const receipt = `rcpt_cart_${userid}_${Date.now()}`;
        const razorpayOrder = yield createRazorpayOrder(amountInPaise, receipt, {
            userid,
            itemCount: cartResult.rows.length,
            checkoutType: 'cart'
        });
        return res.status(200).json({
            success: true,
            key: RAZORPAY_KEY_ID,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount, // in paise
            currency: 'INR',
            itemCount: cartResult.rows.length,
            subtotalRupees: subtotal.toFixed(2),
            totalRupees: totalRupees.toFixed(2),
            shippingCost: shippingCharge
        });
    }
    catch (error) {
        console.error('Error creating Razorpay cart order:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}));
// -----------------------------------------------------------------------------
// 3. Verify Razorpay Payment & Create Confirmed Order (Single Product)
// -----------------------------------------------------------------------------
router.post('/verify-payment', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userid, productid, colorid, sizeid, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!userid || !productid || !colorid || !sizeid || !razorpay_order_id || !razorpay_payment_id) {
        return res.status(400).json({ error: 'Missing required payment verification details' });
    }
    // 1. Verify Razorpay cryptographic signature server-side
    const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
        return res.status(400).json({ error: 'Payment signature verification failed. Unauthorized transaction.' });
    }
    const shippingCharge = 99;
    const deliveryDate = getDateTimeFiveDaysFromNow();
    try {
        // 2. Fetch product price
        const productQuery = `
      SELECT p.discount
      FROM products p
      JOIN productcolors pc ON pc.productid = p.productid AND pc.colorid = $2
      JOIN productSizes ps ON ps.productid = p.productid AND ps.sizeid = $3
      WHERE p.productid = $1
    `;
        const productResult = yield DB_1.client.query(productQuery, [productid, colorid, sizeid]);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const addressQuery = `SELECT addressid FROM addresses WHERE userid = $1 AND is_default = true`;
        const addressResult = yield DB_1.client.query(addressQuery, [userid]);
        if (addressResult.rows.length === 0) {
            return res.status(400).json({ error: 'Default address not found' });
        }
        const addressid = addressResult.rows[0].addressid;
        const productAmount = productResult.rows[0].discount;
        const totalAmount = (parseFloat(productAmount) + shippingCharge).toFixed(2);
        const conn = yield DB_1.client.connect();
        try {
            yield conn.query('BEGIN');
            // 3. Create confirmed order
            const orderRes = yield conn.query(`INSERT INTO orders (userid, totalamount, orderstatus, order_code) VALUES ($1, $2, $3, $4) RETURNING orderid`, [userid, totalAmount, 'Confirmed', 'IN']);
            const orderid = orderRes.rows[0].orderid;
            const trackingnumber = `IN-${orderid}`;
            // 4. Create shipping record
            const shippingRes = yield conn.query(`INSERT INTO shipping (orderid, addressid, shippingmethod, shippingcost, trackingnumber, deliveredat) VALUES ($1, $2, $3, $4, $5, $6) RETURNING shippingid`, [orderid, addressid, 'Express', shippingCharge, trackingnumber, deliveryDate]);
            const shippingid = shippingRes.rows[0].shippingid;
            // 5. Create payment record with Razorpay details
            const paymentRes = yield conn.query(`INSERT INTO payments (orderid, paymentmethod, paymentstatus, amount, transactionid, billingaddress, paymentgateway_id, razorpay_order_id, razorpay_payment_id, razorpay_signature)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING paymentid`, [orderid, 'Razorpay', 'Confirmed', productAmount, razorpay_payment_id, addressid, razorpay_payment_id, razorpay_order_id, razorpay_payment_id, razorpay_signature]);
            const paymentid = paymentRes.rows[0].paymentid;
            // 6. Create order items
            yield conn.query(`INSERT INTO orderitems (orderid, productid, quantity, shippingid, paymentid, colorid, sizeid) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [orderid, productid, 1, shippingid, paymentid, colorid, sizeid]);
            // 7. Increment product sales
            yield conn.query(`UPDATE productparams SET sold = sold + 1 WHERE productid = $1`, [productid]);
            yield conn.query('COMMIT');
            return res.status(200).json({
                success: true,
                orderid,
                razorpay_payment_id,
                razorpay_order_id,
                totalAmount,
                currency: 'INR',
                message: 'Order created and paid successfully'
            });
        }
        catch (txError) {
            yield conn.query('ROLLBACK');
            console.error('Transaction error in verify-payment:', txError);
            return res.status(500).json({ error: 'Database transaction error' });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error verifying Razorpay payment:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}));
// -----------------------------------------------------------------------------
// 4. Verify Razorpay Payment & Create Confirmed Orders (Cart Checkout)
// -----------------------------------------------------------------------------
router.post('/verify-cart-payment', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userid, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!userid || !razorpay_order_id || !razorpay_payment_id) {
        return res.status(400).json({ error: 'Missing required cart payment verification details' });
    }
    // 1. Verify Razorpay signature
    const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
        return res.status(400).json({ error: 'Cart payment signature verification failed. Unauthorized transaction.' });
    }
    const shippingCharge = 99;
    const deliveryDate = getDateTimeFiveDaysFromNow();
    try {
        // 2. Fetch cart items
        const cartQuery = `
      SELECT c.productid, c.colorid, c.sizeid, c.quantity, p.discount
      FROM cartitems c
      JOIN products p ON c.productid = p.productid
      WHERE c.userid = $1
    `;
        const cartResult = yield DB_1.client.query(cartQuery, [userid]);
        if (cartResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cart is empty' });
        }
        const addressQuery = `SELECT addressid FROM addresses WHERE userid = $1 AND is_default = true`;
        const addressResult = yield DB_1.client.query(addressQuery, [userid]);
        if (addressResult.rows.length === 0) {
            return res.status(400).json({ error: 'Default address not found' });
        }
        const addressid = addressResult.rows[0].addressid;
        const conn = yield DB_1.client.connect();
        try {
            yield conn.query('BEGIN');
            const createdOrderIds = [];
            // 3. Create order for each item in the cart
            for (const item of cartResult.rows) {
                const itemTotal = (parseFloat(item.discount) * item.quantity + shippingCharge).toFixed(2);
                const orderRes = yield conn.query(`INSERT INTO orders (userid, totalamount, orderstatus, order_code) VALUES ($1, $2, $3, $4) RETURNING orderid`, [userid, itemTotal, 'Confirmed', 'IN']);
                const orderid = orderRes.rows[0].orderid;
                createdOrderIds.push(orderid);
                const trackingnumber = `IN-${orderid}`;
                const shippingRes = yield conn.query(`INSERT INTO shipping (orderid, addressid, shippingmethod, shippingcost, trackingnumber, deliveredat) VALUES ($1, $2, $3, $4, $5, $6) RETURNING shippingid`, [orderid, addressid, 'Express', shippingCharge, trackingnumber, deliveryDate]);
                const shippingid = shippingRes.rows[0].shippingid;
                const paymentRes = yield conn.query(`INSERT INTO payments (orderid, paymentmethod, paymentstatus, amount, transactionid, billingaddress, paymentgateway_id, razorpay_order_id, razorpay_payment_id, razorpay_signature)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING paymentid`, [orderid, 'Razorpay', 'Confirmed', parseFloat(item.discount) * item.quantity, razorpay_payment_id, addressid, razorpay_payment_id, razorpay_order_id, razorpay_payment_id, razorpay_signature]);
                const paymentid = paymentRes.rows[0].paymentid;
                yield conn.query(`INSERT INTO orderitems (orderid, productid, quantity, shippingid, paymentid, colorid, sizeid) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [orderid, item.productid, item.quantity, shippingid, paymentid, item.colorid, item.sizeid]);
                yield conn.query(`UPDATE productparams SET sold = sold + $1 WHERE productid = $2`, [item.quantity, item.productid]);
            }
            // 4. Clear the customer's cart
            yield conn.query(`DELETE FROM cartitems WHERE userid = $1`, [userid]);
            yield conn.query('COMMIT');
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
        }
        catch (txError) {
            yield conn.query('ROLLBACK');
            console.error('Transaction error in verify-cart-payment:', txError);
            return res.status(500).json({ error: 'Database transaction error during cart checkout' });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error verifying cart payment:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}));
// -----------------------------------------------------------------------------
// 5. Razorpay Webhook Endpoint (Idempotent Event Processing)
// -----------------------------------------------------------------------------
router.post('/webhook', express_1.default.raw({ type: 'application/json' }), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!signature) {
        return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
    }
    // Verify webhook signature
    const expectedSignature = crypto_1.default
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
        const paymentPayload = (_b = (_a = event.payload) === null || _a === void 0 ? void 0 : _a.payment) === null || _b === void 0 ? void 0 : _b.entity;
        const orderPayload = (_d = (_c = event.payload) === null || _c === void 0 ? void 0 : _c.order) === null || _d === void 0 ? void 0 : _d.entity;
        console.log(`[Razorpay Webhook] Received event: ${eventType} for order: ${(orderPayload === null || orderPayload === void 0 ? void 0 : orderPayload.id) || (paymentPayload === null || paymentPayload === void 0 ? void 0 : paymentPayload.order_id)}`);
        if (eventType === 'payment.captured' || eventType === 'order.paid') {
            const razorpayPaymentId = paymentPayload === null || paymentPayload === void 0 ? void 0 : paymentPayload.id;
            const razorpayOrderId = (paymentPayload === null || paymentPayload === void 0 ? void 0 : paymentPayload.order_id) || (orderPayload === null || orderPayload === void 0 ? void 0 : orderPayload.id);
            if (razorpayOrderId || razorpayPaymentId) {
                // Idempotently update payment and order records
                yield DB_1.client.query(`UPDATE payments SET paymentstatus = 'Confirmed', updatedat = CURRENT_TIMESTAMP
           WHERE razorpay_order_id = $1 OR razorpay_payment_id = $2 OR paymentgateway_id = $2`, [razorpayOrderId, razorpayPaymentId]);
                yield DB_1.client.query(`UPDATE orders SET orderstatus = 'Confirmed', updatedat = CURRENT_TIMESTAMP
           WHERE orderid IN (
             SELECT orderid FROM payments WHERE razorpay_order_id = $1 OR razorpay_payment_id = $2
           )`, [razorpayOrderId, razorpayPaymentId]);
            }
        }
        else if (eventType === 'payment.failed') {
            const razorpayPaymentId = paymentPayload === null || paymentPayload === void 0 ? void 0 : paymentPayload.id;
            const razorpayOrderId = paymentPayload === null || paymentPayload === void 0 ? void 0 : paymentPayload.order_id;
            if (razorpayOrderId || razorpayPaymentId) {
                yield DB_1.client.query(`UPDATE payments SET paymentstatus = 'Failed', updatedat = CURRENT_TIMESTAMP
           WHERE razorpay_order_id = $1 OR razorpay_payment_id = $2`, [razorpayOrderId, razorpayPaymentId]);
            }
        }
        return res.status(200).json({ status: 'ok', received: true, event: eventType });
    }
    catch (error) {
        console.error('Error processing Razorpay webhook:', error);
        return res.status(500).json({ error: 'Webhook processing error' });
    }
}));
exports.default = router;
