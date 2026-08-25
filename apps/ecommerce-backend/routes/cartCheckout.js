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
const cartCheckoutValidation_1 = require("../validators/cartCheckoutValidation");
const stripe_1 = __importDefault(require("stripe"));
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
const shippingcharge = 99;
const calculateCartAmount = (userID) => __awaiter(void 0, void 0, void 0, function* () {
    const productCheckQuery = 'SELECT products.discount,cartitems.quantity FROM cartitems INNER JOIN products ON cartitems.productid = products.productid WHERE userid = $1';
    const productCheckResult = yield DB_1.client.query(productCheckQuery, [userID]);
    const priceCalc = productCheckResult.rows.reduce((sum, item) => { return sum + (parseFloat(item.discount) * item.quantity); }, 0);
    const price = (priceCalc + shippingcharge) * 100;
    // Calculate the order total on the server to prevent
    // people from directly manipulating the amount on the client
    return price;
});
router.post("/create/cart-payment/create-payment-intent", cartCheckoutValidation_1.userIDSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const data = (0, express_validator_1.matchedData)(req);
        const userID = data.userID;
        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = yield stripe.paymentIntents.create({
            amount: yield calculateCartAmount(userID),
            currency: "inr",
            // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                userID,
                orderType: 'cart'
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
function fetchProductData(productid, colorid, sizeid, quantity) {
    return __awaiter(this, void 0, void 0, function* () {
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
                shippingcost: 10,
                quantity
            };
        }
        catch (error) {
            return error;
        }
    });
}
router.get('/checkout-cart/product-details/:userID', cartCheckoutValidation_1.userIDSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const data = (0, express_validator_1.matchedData)(req);
        const userID = data.userID;
        try {
            // Fetch product details
            const cartlistQuery = `SELECT productid,sizeid,colorid,quantity FROM cartitems WHERE userid = $1`;
            const cartItems = yield DB_1.client.query(cartlistQuery, [userID]);
            if (cartItems.rows.length === 0) {
                return res.status(404).json({ error: 'cart items not found' });
            }
            const productResult = yield Promise.all(cartItems.rows.map(each => fetchProductData(each.productid, each.colorid, each.sizeid, each.quantity)));
            if (productResult.length === 0) {
                return res.status(404).json({ error: 'Product details not found' });
            }
            res.status(200).json({ products: productResult });
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
function createCashOrder(userid, productid, colorid, sizeid, quantity) {
    return __awaiter(this, void 0, void 0, function* () {
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
                return 404;
            }
            const addressQuery = `
      SELECT addressid FROM addresses WHERE userid = $1 AND is_default = true
    `;
            const addressResult = yield DB_1.client.query(addressQuery, [userid]);
            if (addressResult.rows.length === 0) {
                return 404;
            }
            const addressid = addressResult.rows[0].addressid;
            const amount = productResult.rows[0].discount;
            const orderShipping = shippingcharge;
            const totalAmount = (orderShipping + paymentCharge + parseFloat(amount) * quantity).toFixed(2);
            const conn = yield DB_1.client.connect();
            try {
                yield conn.query('BEGIN');
                const orderRes = yield conn.query(`INSERT INTO orders (userid, totalamount, orderstatus, order_code) VALUES ($1, $2, $3, $4) RETURNING orderid`, [userid, totalAmount, 'Confirmed', 'IN']);
                const orderid = orderRes.rows[0].orderid;
                const trackingnumber = `IN-${orderid}`;
                const shippingRes = yield conn.query(`INSERT INTO shipping (orderid, addressid, shippingmethod, shippingcost, trackingnumber, deliveredat) VALUES ($1, $2, $3, $4, $5, $6) RETURNING shippingid`, [orderid, addressid, 'Express', orderShipping, trackingnumber, deliveryDate]);
                const shippingid = shippingRes.rows[0].shippingid;
                const paymentRes = yield conn.query(`INSERT INTO payments (orderid, paymentmethod, paymentstatus, amount, transactionid, billingaddress) VALUES ($1, $2, $3, $4, $5, $6) RETURNING paymentid`, [orderid, 'Payment on Delivery', 'Pending', parseFloat(amount) * quantity, transactionid, addressid]);
                const paymentid = paymentRes.rows[0].paymentid;
                yield conn.query(`INSERT INTO orderitems (orderid, productid, quantity, shippingid, paymentid, colorid, sizeid) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [orderid, productid, quantity, shippingid, paymentid, colorid, sizeid]);
                yield conn.query(`UPDATE productparams SET sold = sold + 1 WHERE productid = $1`, [productid]);
                yield conn.query('COMMIT');
                return 200;
            }
            catch (error) {
                yield conn.query('ROLLBACK');
                return 500;
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            return 500;
        }
    });
}
router.post('/cart-payment-on-delivery/create-order', cartCheckoutValidation_1.userIDSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const data = (0, express_validator_1.matchedData)(req);
        const userID = data.userID;
        try {
            const cartlistQuery = `SELECT productid,sizeid,colorid,quantity FROM cartitems WHERE userid = $1`;
            const cartItems = yield DB_1.client.query(cartlistQuery, [userID]);
            if (cartItems.rows.length === 0) {
                return res.status(404).json({ error: 'cart items not found' });
            }
            const results = yield Promise.all(cartItems.rows.map(each => createCashOrder(userID, each.productid, each.colorid, each.sizeid, each.quantity)));
            if (results.some(r => r !== 200)) {
                return res.status(500).json({ error: 'One or more orders failed to create' });
            }
            res.status(200).json({ message: 'Successfully created orders' });
        }
        catch (error) {
            res.status(500).json({ error: 'Server Internal Server' });
        }
    }
    else {
        res.status(500).json({ message: 'Validation error' });
    }
}));
function createCardOrder(userid, productid, colorid, sizeid, paymentid, paymentStatus, quantity) {
    return __awaiter(this, void 0, void 0, function* () {
        const paymentState = paymentStatus === 'Succeeded' ? 'Confirmed' : 'Pending';
        const transactionid = `TS-${(0, crypto_1.randomUUID)()}`;
        const deliveryDate = getDateTimeFiveDaysFromNow();
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
                return 404;
            }
            const addressQuery = `
      SELECT addressid FROM addresses WHERE userid = $1 AND is_default = true
    `;
            const addressResult = yield DB_1.client.query(addressQuery, [userid]);
            if (addressResult.rows.length === 0) {
                return 404;
            }
            const addressid = addressResult.rows[0].addressid;
            const amount = productResult.rows[0].discount;
            const orderShipping = shippingcharge;
            const totalAmount = (orderShipping + parseFloat(amount) * quantity).toFixed(2);
            const conn = yield DB_1.client.connect();
            try {
                yield conn.query('BEGIN');
                const orderRes = yield conn.query(`INSERT INTO orders (userid, totalamount, orderstatus, order_code) VALUES ($1, $2, $3, $4) RETURNING orderid`, [userid, totalAmount, 'Confirmed', 'IN']);
                const orderid = orderRes.rows[0].orderid;
                const trackingnumber = `IN-${orderid}`;
                const shippingRes = yield conn.query(`INSERT INTO shipping (orderid, addressid, shippingmethod, shippingcost, trackingnumber, deliveredat) VALUES ($1, $2, $3, $4, $5, $6) RETURNING shippingid`, [orderid, addressid, 'Express', orderShipping, trackingnumber, deliveryDate]);
                const shippingid = shippingRes.rows[0].shippingid;
                const paymentRes = yield conn.query(`INSERT INTO payments (orderid, paymentmethod, paymentstatus, amount, transactionid, billingaddress, paymentgateway_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING paymentid`, [orderid, 'Card', paymentState, parseFloat(amount) * quantity, transactionid, addressid, paymentid]);
                const paymentID = paymentRes.rows[0].paymentid;
                yield conn.query(`INSERT INTO orderitems (orderid, productid, quantity, shippingid, paymentid, colorid, sizeid) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [orderid, productid, quantity, shippingid, paymentID, colorid, sizeid]);
                yield conn.query(`UPDATE productparams SET sold = sold + 1 WHERE productid = $1`, [productid]);
                yield conn.query('COMMIT');
                return 200;
            }
            catch (error) {
                yield conn.query('ROLLBACK');
                console.error('Error creating order:', error);
                return 500;
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            return 500;
        }
    });
}
router.post('/cart-card/create-order', cartCheckoutValidation_1.paymentCreationSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const data = (0, express_validator_1.matchedData)(req);
        const { userID, paymentid, paymentstatus } = data;
        try {
            const cartlistQuery = `SELECT productid,sizeid,colorid,quantity FROM cartitems WHERE userid = $1`;
            const cartItems = yield DB_1.client.query(cartlistQuery, [userID]);
            if (cartItems.rows.length === 0) {
                return res.status(404).json({ error: 'cart items not found' });
            }
            const results = yield Promise.all(cartItems.rows.map(each => createCardOrder(userID, each.productid, each.colorid, each.sizeid, paymentid, paymentstatus, each.quantity)));
            if (results.some(r => r !== 200)) {
                return res.status(500).json({ error: 'One or more orders failed to create' });
            }
            res.status(200).json({ message: 'Successfully created orders' });
        }
        catch (error) {
            res.status(500).json({ error: 'Server Internal Server' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
}));
exports.default = router;
