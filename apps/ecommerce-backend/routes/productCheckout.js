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
const stripe_1 = __importDefault(require("stripe"));
const productCheckoutValidator_1 = require("../validators/productCheckoutValidator");
const express_validator_1 = require("express-validator");
const crypto_1 = require("crypto");
const router = express_1.default.Router();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY);
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
}
;
router.post('/payment-on-delivery/create-order', productCheckoutValidator_1.orderCreationSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userid, productid, colorid, sizeid } = (0, express_validator_1.matchedData)(req);
        const orderid = (0, crypto_1.randomUUID)();
        const shippingid = (0, crypto_1.randomUUID)();
        const paymentid = (0, crypto_1.randomUUID)();
        const transactionid = `TS-${(0, crypto_1.randomUUID)()}`;
        const orderitemid = (0, crypto_1.randomUUID)();
        const trackingnumber = `IN-${orderid}`;
        const deliveryDate = getDateTimeFiveDaysFromNow();
        const paymentCharge = 15;
        try {
            // Check if product with given productid, colorid, and sizeid exists
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
            const addressQuery = `
        SELECT addressid FROM addresses WHERE userid = $1 AND is_default = true
      `;
            const addressResult = yield DB_1.client.query(addressQuery, [userid]);
            if (addressResult.rows.length === 0) {
                return res.status(404).json({ error: 'Address not found' });
            }
            const addressid = addressResult.rows[0].addressid;
            const amount = productResult.rows[0].discount;
            const shippingcharge = 99;
            const totalAmount = (shippingcharge + paymentCharge + parseFloat(amount)).toFixed(2);
            const conn = yield DB_1.client.connect();
            try {
                yield conn.query('BEGIN');
                const orderRes = yield conn.query(`INSERT INTO orders (userid, totalamount, orderstatus, order_code) VALUES ($1, $2, $3, $4) RETURNING orderid`, [userid, totalAmount, 'Confirmed', 'IN']);
                const orderid = orderRes.rows[0].orderid;
                const trackingnumber = `IN-${orderid}`;
                const shippingRes = yield conn.query(`INSERT INTO shipping (orderid, addressid, shippingmethod, shippingcost, trackingnumber, deliveredat) VALUES ($1, $2, $3, $4, $5, $6) RETURNING shippingid`, [orderid, addressid, 'Express', shippingcharge, trackingnumber, deliveryDate]);
                const shippingid = shippingRes.rows[0].shippingid;
                const paymentRes = yield conn.query(`INSERT INTO payments (orderid, paymentmethod, paymentstatus, amount, transactionid, billingaddress) VALUES ($1, $2, $3, $4, $5, $6) RETURNING paymentid`, [orderid, 'Payment on Delivery', 'Pending', amount, transactionid, addressid]);
                const paymentid = paymentRes.rows[0].paymentid;
                yield conn.query(`INSERT INTO orderitems (orderid, productid, quantity, shippingid, paymentid, colorid, sizeid) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [orderid, productid, 1, shippingid, paymentid, colorid, sizeid]);
                yield conn.query(`UPDATE productparams SET sold = sold + 1 WHERE productid = $1`, [productid]);
                yield conn.query('COMMIT');
                res.status(200).json({ orderid });
            }
            catch (error) {
                yield conn.query('ROLLBACK');
                console.error('Error creating order:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error creating order:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    else {
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.post('/card/create-order', productCheckoutValidator_1.orderCreationSchema2, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userid, productid, colorid, sizeid, paymentid, paymentStatus } = (0, express_validator_1.matchedData)(req);
        const paymentState = paymentStatus === 'Succeeded' ? 'Confirmed' : 'Pending';
        const transactionid = `TS-${(0, crypto_1.randomUUID)()}`;
        const deliveryDate = getDateTimeFiveDaysFromNow();
        const shippingcharge = 99;
        try {
            // Check if product with given productid, colorid, and sizeid exists
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
            const addressQuery = `
        SELECT addressid FROM addresses WHERE userid = $1 AND is_default = true
      `;
            const addressResult = yield DB_1.client.query(addressQuery, [userid]);
            if (addressResult.rows.length === 0) {
                return res.status(404).json({ error: 'Address not found' });
            }
            const addressid = addressResult.rows[0].addressid;
            const amount = productResult.rows[0].discount;
            const totalAmount = (shippingcharge + parseFloat(amount)).toFixed(2);
            const conn = yield DB_1.client.connect();
            try {
                yield conn.query('BEGIN');
                const orderRes = yield conn.query(`INSERT INTO orders (userid, totalamount, orderstatus, order_code) VALUES ($1, $2, $3, $4) RETURNING orderid`, [userid, totalAmount, 'Confirmed', 'IN']);
                const orderid = orderRes.rows[0].orderid;
                const trackingnumber = `IN-${orderid}`;
                const shippingRes = yield conn.query(`INSERT INTO shipping (orderid, addressid, shippingmethod, shippingcost, trackingnumber, deliveredat) VALUES ($1, $2, $3, $4, $5, $6) RETURNING shippingid`, [orderid, addressid, 'Express', shippingcharge, trackingnumber, deliveryDate]);
                const shippingid = shippingRes.rows[0].shippingid;
                const paymentRes = yield conn.query(`INSERT INTO payments (orderid, paymentmethod, paymentstatus, amount, transactionid, billingaddress, paymentgateway_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING paymentid`, [orderid, 'Card', paymentState, amount, transactionid, addressid, paymentid]);
                const paymentID = paymentRes.rows[0].paymentid;
                yield conn.query(`INSERT INTO orderitems (orderid, productid, quantity, shippingid, paymentid, colorid, sizeid) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [orderid, productid, 1, shippingid, paymentID, colorid, sizeid]);
                yield conn.query(`UPDATE productparams SET sold = sold + 1 WHERE productid = $1`, [productid]);
                yield conn.query('COMMIT');
                res.status(200).json({ orderid });
            }
            catch (error) {
                yield conn.query('ROLLBACK');
                console.error('Error creating order:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error creating order:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    else {
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.get('/orders/status/:orderID', productCheckoutValidator_1.OrderIDSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { orderID } = (0, express_validator_1.matchedData)(req);
        try {
            // Check if the order with the given orderID exists and fetch relevant details
            const orderQuery = `
        SELECT o.orderstatus, p.paymentstatus, p.paymentmethod
        FROM orders o
        JOIN payments p ON p.orderid = o.orderid
        WHERE o.orderid = $1
      `;
            const orderResult = yield DB_1.client.query(orderQuery, [orderID]);
            if (orderResult.rows.length === 0) {
                return res.status(404).json({ error: 'Order not found' });
            }
            const { orderstatus, paymentstatus, paymentmethod } = orderResult.rows[0];
            // Check conditions and return appropriate status code
            if (orderstatus === 'Confirmed' && paymentstatus === 'Pending' && paymentmethod === 'Payment on Delivery') {
                return res.status(200).json({ orderstatus, paymentstatus, paymentmethod });
            }
            else if (orderstatus === 'Confirmed' && paymentstatus === 'Pending' && paymentmethod === 'Card') {
                return res.status(402).json({ orderstatus, paymentstatus, paymentmethod });
            }
            else if (orderstatus === 'Failed' && paymentstatus === 'Failed') {
                return res.status(400).json({ orderstatus, paymentstatus, paymentmethod });
            }
            else if (orderstatus === 'Confirmed' && paymentstatus === 'Confirmed' && (paymentmethod === 'Card' || paymentmethod === 'Razorpay')) {
                return res.status(200).json({ orderstatus, paymentstatus, paymentmethod });
            }
            else {
                return res.status(404).json({ error: 'Order state not recognized' });
            }
        }
        catch (error) {
            console.error('Error checking order status:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    else {
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.get('/checkout/product-details/:productid/:sizeid/:colorid', productCheckoutValidator_1.checkoutSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { productid, sizeid, colorid } = (0, express_validator_1.matchedData)(req);
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
            const productResult = yield DB_1.client.query(productQuery, [productid, sizeid, colorid]);
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
                shippingcost: 5
            });
        }
        catch (error) {
            console.error('Error fetching product details:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    else {
        res.status(500).json({ message: 'Validation error' });
    }
}));
const calculateOrderAmount = (item) => __awaiter(void 0, void 0, void 0, function* () {
    const shippingcharge = 99;
    const productCheckQuery = 'SELECT discount FROM products WHERE productid = $1';
    const productCheckResult = yield DB_1.client.query(productCheckQuery, [item]);
    const price = (parseFloat(productCheckResult.rows[0].discount) + shippingcharge) * 100;
    // Calculate the order total on the server to prevent
    // people from directly manipulating the amount on the client
    return price;
});
router.post("/create/payment/create-payment-intent", productCheckoutValidator_1.createPaymentIntent, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { item, userID } = req.body;
        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = yield stripe.paymentIntents.create({
            amount: yield calculateOrderAmount(item),
            currency: "inr",
            // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                userID,
                type: 'product',
                productID: item
            }
        });
        res.send({
            clientSecret: paymentIntent.client_secret,
        });
    }
    else {
        res.status(500).json({ message: 'Validation error' });
    }
}));
exports.default = router;
