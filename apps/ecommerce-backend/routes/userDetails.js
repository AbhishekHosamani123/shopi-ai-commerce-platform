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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const userDetailsValidation_1 = require("../validators/userDetailsValidation");
const express_validator_1 = require("express-validator");
const router = express_1.default.Router();
const JWT_SECRET = process.env.JWT_ENCRYPTION_KEY;
const fetchAddresses = (userID) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `
        SELECT addressID, userID, addressType, userName, contactNumber, addressLine1, addressLine2, city, state, country, postalCode, is_default
        FROM Addresses
        WHERE userID = $1;
    `;
    const values = [userID];
    const result = yield DB_1.client.query(query, values);
    return result.rows;
});
const fetchColor = (productID) => __awaiter(void 0, void 0, void 0, function* () {
    const colorQuery = `
        SELECT colorclass, colorname, colorid
        FROM productcolors
        WHERE productid = $1
        LIMIT 1;
    `;
    const colorValues = [productID];
    const colorResult = yield DB_1.client.query(colorQuery, colorValues);
    return colorResult.rows[0];
});
const fetchSize = (productID) => __awaiter(void 0, void 0, void 0, function* () {
    const sizeQuery = `
        SELECT sizeid, sizename, instock
        FROM productsizes
        WHERE productid = $1
        LIMIT 1;
    `;
    const sizeValues = [productID];
    const sizeResult = yield DB_1.client.query(sizeQuery, sizeValues);
    return sizeResult.rows[0];
});
const fetchCartItems = (userID) => __awaiter(void 0, void 0, void 0, function* () {
    const cartQuery = `
        SELECT cartitems.productid, cartitems.quantity, products.title, products.discount, cartitems.cartitemid, 
               productimages.imglink, productimages.imgalt
        FROM cartitems 
        INNER JOIN products ON cartitems.productid = products.productid 
        INNER JOIN productimages ON cartitems.productid = productimages.productid 
        WHERE productimages.isprimary = true AND cartitems.userid = $1;
    `;
    const cartValues = [userID];
    const cartResult = yield DB_1.client.query(cartQuery, cartValues);
    const cartItems = yield Promise.all(cartResult.rows.map((item) => __awaiter(void 0, void 0, void 0, function* () {
        const color = yield fetchColor(item.productid);
        const size = yield fetchSize(item.productid);
        return Object.assign(Object.assign(Object.assign({}, item), color), size);
    })));
    return cartItems;
});
const fetchWishlistItems = (userID) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `
        SELECT wishlistitems.productid, products.title, products.discount, wishlistitems.wishlistitemid, 
               productimages.imglink, productimages.imgalt 
        FROM wishlistitems 
        INNER JOIN products ON wishlistitems.productid = products.productid 
        INNER JOIN productimages ON products.productid = productimages.productid 
        WHERE productimages.isprimary = true AND wishlistitems.userid = $1;
    `;
    const values = [userID];
    const result = yield DB_1.client.query(query, values);
    return result.rows;
});
const fetchCoupons = (userID) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `SELECT usercoupons.couponid,coupons.code,coupons.description,coupons.discountpercentage,coupons.maxdiscountamount,coupons.minpurchaseamount,coupons.validuntil 
    FROM usercoupons 
    INNER JOIN coupons ON usercoupons.couponid = coupons.couponid 
    WHERE usercoupons.userid = $1 ORDER BY usercoupons.createdat DESC`;
    const values = [userID];
    const result = yield DB_1.client.query(query, values);
    return result.rows;
});
const fetchGiftCards = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `SELECT cardid,cardname,cardcode,description,balance,currency,expirydate,sendername,message,status FROM giftcards WHERE recipientemail = $1`;
    const values = [email];
    const result = yield DB_1.client.query(query, values);
    return result.rows;
});
router.post('/user/addresses', userDetailsValidation_1.userIDSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userID } = (0, express_validator_1.matchedData)(req);
        try {
            // Query to fetch addresses by userID, excluding createdAt and updatedAt
            const query = `
                SELECT addressID, addressType, contactNumber, addressLine1, addressLine2, city, state, country, postalCode, userName, is_default
                FROM Addresses
                WHERE userID = $1;
            `;
            const values = [userID];
            const result = yield DB_1.client.query(query, values);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'No addresses found for this user' });
            }
            res.status(200).json(result.rows);
        }
        catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.post('/user/cart-items', userDetailsValidation_1.userIDSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userID } = (0, express_validator_1.matchedData)(req);
        try {
            // Query to fetch cart items by userID, including size and color
            const query = `
                SELECT cartitems.productid,cartitems.quantity,products.title,products.discount,cartitems.cartitemid,productimages.imglink,productimages.imgalt,productcolors.colorclass,productcolors.colorname,productcolors.colorid,productsizes.sizeid,productsizes.sizename,productsizes.instock
                 FROM cartitems INNER JOIN products ON cartitems.productid = products.productid 
                 INNER JOIN productimages ON cartitems.productid = productimages.productid 
                 INNER JOIN productcolors ON cartitems.productid = productcolors.productid 
                 INNER JOIN productsizes ON cartitems.productid = productsizes.productid 
                 WHERE productimages.isprimary = true AND cartitems.userid = $1;
            `;
            const values = [userID];
            const result = yield DB_1.client.query(query, values);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'No cart items found for this user' });
            }
            res.status(200).json(result.rows);
        }
        catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.post('/user/wishlist-items', userDetailsValidation_1.userIDSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userID } = (0, express_validator_1.matchedData)(req);
        try {
            const query = `
                SELECT wishlistitems.wishlistitemid,wishlistitems.productid,products.discount,productimages.imglink,productimages.imgalt,products.title
                 FROM wishlistitems
                 INNER JOIN products ON wishlistitems.productid = products.productid 
                 INNER JOIN productimages ON products.productid = productimages.productid 
                 WHERE productimages.isprimary = true AND wishlistitems.userid = $1;
            `;
            const values = [userID];
            const result = yield DB_1.client.query(query, values);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'No wishlist items found for this user' });
            }
            res.status(200).json(result.rows);
        }
        catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.post('/user/coupons', userDetailsValidation_1.userIDSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userID } = (0, express_validator_1.matchedData)(req);
        const query = `SELECT usercoupons.couponid,coupons.code,coupons.description,coupons.discountpercentage,coupons.maxdiscountamount,coupons.minpurchaseamount,coupons.validuntil FROM usercoupons INNER JOIN coupons ON usercoupons.couponid = coupons.couponid WHERE usercoupons.userid = $1 ORDER BY usercoupons.createdat DESC`;
        try {
            const values = [userID];
            const result = yield DB_1.client.query(query, values);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'No coupons found for this user' });
            }
            res.status(200).json({ data: result.rows });
        }
        catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.post('/user/all-data', userDetailsValidation_1.userTokenSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userIDToken } = (0, express_validator_1.matchedData)(req);
        try {
            const userID = jsonwebtoken_1.default.verify(userIDToken, JWT_SECRET);
            const [addresses, cartItems, wishlistItems, coupons] = yield Promise.all([
                fetchAddresses(userID.userID),
                fetchCartItems(userID.userID),
                fetchWishlistItems(userID.userID),
                fetchCoupons(userID.userID),
            ]);
            const getEmail = yield DB_1.client.query(`SELECT email FROM users WHERE userid = $1`, [userID.userID]);
            const giftcards = getEmail.rows.length > 0 && getEmail.rows[0].email ? yield fetchGiftCards(getEmail.rows[0].email) : [];
            res.status(200).json({
                addresses,
                cartItems,
                wishlistItems,
                coupons,
                giftcards
            });
        }
        catch (error) {
            console.error('[all-data Server error]:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
    else {
        console.error('[all-data validation error]:', result.array());
        res.status(500).json({ message: 'Validation error', errors: result.array() });
    }
}));
router.post('/user/insert/address', userDetailsValidation_1.AddressInsertSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userID, addressType, userName, contactNumber, addressLine1, addressLine2, city, state, country, postalCode } = (0, express_validator_1.matchedData)(req);
        const query = `INSERT INTO addresses(userid,addresstype,username,contactnumber,addressline1,addressline2,city,state,country,postalcode,is_default)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false) RETURNING addressid`;
        const values = [userID, addressType, userName, contactNumber, addressLine1, addressLine2, city, state, country, postalCode];
        try {
            const insertRes = yield DB_1.client.query(query, values);
            res.status(200).json({ message: 'Address added Successfully', addressid: insertRes.rows[0].addressid });
        }
        catch (error) {
            console.error('Error inserting address:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.post('/user/orders', userDetailsValidation_1.userTokenSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userIDToken } = (0, express_validator_1.matchedData)(req);
        const query = `SELECT orders.orderid,orders.totalamount,orders.orderstatus,orders.createdat,shipping.deliveredat,products.title,productimages.imglink,productimages.imgalt,products.description,products.discount,orders.order_code,products.productid 
        FROM orders
         INNER JOIN orderitems on orders.orderid = orderitems.orderid INNER JOIN products ON products.productid = orderitems.productid
          INNER JOIN productimages ON products.productid = productimages.productid 
          INNER JOIN shipping on orderitems.shippingid = shipping.shippingid
          WHERE orders.userid = $1 AND productimages.isprimary = true ORDER BY orders.createdat DESC`;
        try {
            const userID = jsonwebtoken_1.default.verify(userIDToken, JWT_SECRET);
            const values = [userID.userID];
            const result = yield DB_1.client.query(query, values);
            res.status(200).json({ data: result.rows });
        }
        catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.post('/user/insert/cartitem', userDetailsValidation_1.cartItemSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userID, productID, quantity, sizeID, colorID } = (0, express_validator_1.matchedData)(req);
        const checkQuery = `
            SELECT cartitemid, quantity 
            FROM cartitems 
            WHERE userid = $1 AND productid = $2 AND sizeid = $3 AND colorid = $4
        `;
        const checkValues = [userID, productID, sizeID, colorID];
        const insertQuery = `
            INSERT INTO cartitems (userid, productid, quantity, sizeid, colorid) 
            VALUES ($1, $2, $3, $4, $5)
        `;
        const insertValues = [userID, productID, quantity, sizeID, colorID];
        const updateQuery = `
            UPDATE cartitems 
            SET quantity = quantity + $1 
            WHERE cartitemid = $2
        `;
        try {
            const checkResult = yield DB_1.client.query(checkQuery, checkValues);
            if (checkResult.rows.length > 0) {
                // Item already exists, update its quantity
                const existingCartItemID = checkResult.rows[0].cartitemid;
                yield DB_1.client.query(updateQuery, [quantity, existingCartItemID]);
            }
            else {
                // Item does not exist, insert a new row
                yield DB_1.client.query(insertQuery, insertValues);
            }
            res.status(200).json({ message: 'CartItem added or updated successfully' });
        }
        catch (error) {
            console.error('Error inserting cart item:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.delete('/user/delete/cartitem', userDetailsValidation_1.cartActionSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userID, cartItemID } = (0, express_validator_1.matchedData)(req);
        const query = `DELETE FROM cartitems WHERE userid = $1 AND cartitemid = $2`;
        const values = [userID, cartItemID];
        try {
            yield DB_1.client.query(query, values);
            res.status(200).json({ message: 'Item deleted Successfully' });
        }
        catch (error) {
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.post('/user/insert/wishlistitem', userDetailsValidation_1.wishlistActionSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userID, productID } = (0, express_validator_1.matchedData)(req);
        const checkQuery = `
            SELECT wishlistitemid 
            FROM wishlistitems 
            WHERE userid = $1 AND productid = $2
        `;
        const checkValues = [userID, productID];
        const insertQuery = `
            INSERT INTO wishlistitems (userid, productid) 
            VALUES ($1, $2)
        `;
        const insertValues = [userID, productID];
        try {
            const checkResult = yield DB_1.client.query(checkQuery, checkValues);
            if (checkResult.rows.length > 0) {
                // Item already exists, do not insert again
                res.status(200).json({ message: 'Item already exists in wishlist' });
            }
            else {
                // Item does not exist, insert a new row
                yield DB_1.client.query(insertQuery, insertValues);
                res.status(200).json({ message: 'Item added Successfully' });
            }
        }
        catch (error) {
            console.error('Error inserting wishlist item:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
    else
        res.status(500).json({ message: 'Internal Server Error' });
}));
router.delete('/user/delete/wishlistitem', userDetailsValidation_1.wishlistRemoveSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userID, wishlistItemID } = (0, express_validator_1.matchedData)(req);
        const query = `DELETE FROM wishlistitems WHERE wishlistitemid = $1 AND userid = $2`;
        const values = [wishlistItemID, userID];
        try {
            yield DB_1.client.query(query, values);
            res.status(200).json({ message: 'Item deleted Successfully' });
        }
        catch (error) {
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
}));
const fetchOrderAddresses = (userID, addressID) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `
        SELECT userName, contactNumber, addressLine1, addressLine2, city, state, country, postalCode
        FROM Addresses
        WHERE userid = $1 AND addressid = $2;
    `;
    const values = [userID, addressID];
    const result = yield DB_1.client.query(query, values);
    return result.rows[0];
});
const fetchOrderColor = (productID, colorID) => __awaiter(void 0, void 0, void 0, function* () {
    const colorQuery = `
        SELECT colorname
        FROM productcolors
        WHERE productid = $1 AND colorid = $2
        LIMIT 1;
    `;
    const colorValues = [productID, colorID];
    const colorResult = yield DB_1.client.query(colorQuery, colorValues);
    if (colorResult.rows.length === 0)
        return { colorname: null };
    else
        return colorResult.rows[0];
});
const fetchOrderSize = (productID, sizeID) => __awaiter(void 0, void 0, void 0, function* () {
    const sizeQuery = `
        SELECT sizename
        FROM productsizes
        WHERE productid = $1 AND sizeid = $2
        LIMIT 1;
    `;
    const sizeValues = [productID, sizeID];
    const sizeResult = yield DB_1.client.query(sizeQuery, sizeValues);
    if (sizeResult.rows.length === 0)
        return { sizename: null };
    else
        return sizeResult.rows[0];
});
router.get('/user/order-detail/:userIDToken/:orderID', userDetailsValidation_1.orderSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userIDToken, orderID } = (0, express_validator_1.matchedData)(req);
        const query = `SELECT 
        orders.orderid,
        orders.createdat,
        shipping.deliveredat,
        orders.orderstatus,
        payments.paymentstatus,
        payments.paymentmethod,
        users.username,
        users.email,
        users.mobile_number,
        products.title,
        products.discount,
        products.price,
        shipping.shippingcost,
        orderitems.quantity,
        productimages.imglink,
        productimages.imgalt,
        payments.billingaddress,
        shipping.addressid,
        orderitems.colorid,
        orderitems.sizeid,
        orderitems.productid,
        orders.order_code,
        orders.totalamount
        FROM orders
        INNER JOIN users ON orders.userid = users.userid
        INNER JOIN orderitems ON orders.orderid = orderitems.orderid
        INNER JOIN shipping ON orderitems.shippingid = shipping.shippingid
        INNER JOIN payments ON orderitems.paymentid = payments.paymentid
        INNER JOIN products ON orderitems.productid = products.productid
        INNER JOIN productimages ON products.productid = productimages.productid AND productimages.isprimary = true
        WHERE orders.orderid = $1 AND orders.userid = $2;`;
        try {
            const userID = jsonwebtoken_1.default.verify(userIDToken, JWT_SECRET);
            const values = [orderID, userID.userID];
            const result = yield DB_1.client.query(query, values);
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Data not Found' });
            }
            const [shippingAddress, billingAddress, color, size] = yield Promise.all([
                fetchOrderAddresses(userID.userID, result.rows[0].addressid),
                fetchOrderAddresses(userID.userID, result.rows[0].billingaddress),
                fetchOrderColor(result.rows[0].productid, result.rows[0].colorid),
                fetchOrderSize(result.rows[0].productid, result.rows[0].sizeid)
            ]);
            const data = Object.assign(Object.assign(Object.assign(Object.assign({}, result.rows[0]), { shippingaddress: Object.assign({}, shippingAddress), billingaddress: Object.assign({}, billingAddress) }), color), size);
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
}));
exports.default = router;
