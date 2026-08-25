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
const productsValidation_1 = require("../validators/productsValidation");
const express_validator_1 = require("express-validator");
const crypto_1 = require("crypto");
const router = express_1.default.Router();
function calculateStarAverage(productID) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = `SELECT rating FROM reviews WHERE productid = $1`;
        const ratingQuery = `UPDATE productparams SET stars = $2 WHERE productid = $1`;
        try {
            const result = yield DB_1.client.query(query, [productID]);
            if (result.rows.length === 0) {
                yield DB_1.client.query(ratingQuery, [productID, 0]);
                return;
            }
            const totalStars = result.rows.reduce((sum, review) => sum + review.rating, 0);
            const totalReviews = result.rows.length;
            const averageStars = totalStars / totalReviews;
            yield DB_1.client.query(ratingQuery, [productID, averageStars]);
            return;
        }
        catch (error) {
            console.error(error);
            return;
        }
    });
}
;
router.post('/product/create', productsValidation_1.createProductSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (!result.isEmpty())
        return res.status(400).json({ message: 'Validation error', errors: result.array() });
    const { title, description, price, discount, stock, tags, imgLink, imgAlt, isSale, isNew, isDiscount, categoryID } = (0, express_validator_1.matchedData)(req);
    const productQuery = `INSERT INTO products (productid, title, description, categoryid, price, discount, stock, tags, imgid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;
    const productImagesQuery = `INSERT INTO productimages (imageid, productid, imglink, imgalt, isprimary) VALUES ($1, $2, $3, $4, $5)`;
    const productParamsQuery = `INSERT INTO productparams (productid, issale, isnew, isdiscount) VALUES ($1, $2, $3, $4)`;
    const productID = (0, crypto_1.randomUUID)();
    const imageID = (0, crypto_1.randomUUID)();
    try {
        yield DB_1.client.query(productQuery, [productID, title, description, categoryID, price, discount, stock, tags, imageID]);
        yield DB_1.client.query(productImagesQuery, [imageID, productID, imgLink, imgAlt, true]);
        yield DB_1.client.query(productParamsQuery, [productID, isSale, isNew, isDiscount]);
        return res.status(200).json({ message: 'Product Added Successfully' });
    }
    catch (error) {
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}));
router.post('/product/create/image', productsValidation_1.createProductImageSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (!result.isEmpty())
        return res.status(400).json({ message: 'Validation error', errors: result.array() });
    const { productID, imgLink, imgAlt } = (0, express_validator_1.matchedData)(req);
    const imageID = (0, crypto_1.randomUUID)();
    const productImagesQuery = `INSERT INTO productimages (imageid, productid, imglink, imgalt, isprimary) VALUES ($1, $2, $3, $4, $5)`;
    try {
        yield DB_1.client.query(productImagesQuery, [imageID, productID, imgLink, imgAlt, false]);
        res.status(200).json({ message: 'Image Added Successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
}));
router.post('/product/create/size', productsValidation_1.createProductSizeSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (!result.isEmpty())
        return res.status(400).json({ message: 'Validation error', errors: result.array() });
    const { productID, sizeName, inStock } = (0, express_validator_1.matchedData)(req);
    const sizeID = (0, crypto_1.randomUUID)();
    const productSizesQuery = `INSERT INTO productparams (sizeid,productid,sizename,instock) VALUES ($1, $2, $3, $4)`;
    try {
        yield DB_1.client.query(productSizesQuery, [sizeID, productID, sizeName, inStock]);
        res.status(200).json({ message: 'Size Added Successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
}));
router.post('/product/create/color', productsValidation_1.createProductColorSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (!result.isEmpty())
        return res.status(400).json({ message: 'Validation error', errors: result.array() });
    const { productID, colorName, colorClass } = (0, express_validator_1.matchedData)(req);
    const colorID = (0, crypto_1.randomUUID)();
    const productColorsQuery = `INSERT INTO productcolors (colorid, productid, colorname, colorclass) VALUES ($1, $2, $3, $4)`;
    try {
        yield DB_1.client.query(productColorsQuery, [colorID, productID, colorName, colorClass]);
        res.status(200).json({ message: 'Color Added Successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
}));
function review(productID) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield DB_1.client.query(`SELECT reviews.reviewid,reviews.userid,reviews.rating,reviews.title,reviews.comment,users.username,reviews.createdat,productparams.stars AS productstars FROM reviews INNER JOIN users ON users.userid = reviews.userid INNER JOIN productparams ON reviews.productid = productparams.productid WHERE reviews.productid = $1 ORDER BY reviews.createdat LIMIT 10`, [productID]);
            if (result.rows.length === 0) {
                return [0, []];
            }
            return [result.rowCount, result.rows];
        }
        catch (error) {
            console.error(error);
            return [0, []];
        }
    });
}
function getColors(productID) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield DB_1.client.query(`SELECT colorid,colorname,colorclass FROM productcolors WHERE productid = $1`, [productID]);
            if (result.rows.length === 0) {
                return [];
            }
            return result.rows;
        }
        catch (error) {
            return [];
        }
    });
}
function getSizes(productID) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield DB_1.client.query(`SELECT sizeid,sizename,instock FROM productsizes WHERE productid = $1`, [productID]);
            if (result.rows.length === 0) {
                return [];
            }
            return result.rows;
        }
        catch (error) {
            return [];
        }
    });
}
function getImages(productID) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield DB_1.client.query(`SELECT imageid,imglink,imgalt FROM productimages WHERE productid = $1`, [productID]);
            if (result.rows.length === 0) {
                return [];
            }
            return result.rows;
        }
        catch (error) {
            return [];
        }
    });
}
router.get('/product/:productID', productsValidation_1.productIDSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { productID } = (0, express_validator_1.matchedData)(req);
        try {
            const result = yield DB_1.client.query(`SELECT products.productid,products.title,products.description,products.stock,products.discount,products.price,productparams.stars,productimages.imglink,productimages.imgalt,sellers.company_name,categories.name AS categoryname,categories.maincategory
                FROM products
                INNER JOIN productparams ON products.productid = productparams.productid 
                INNER JOIN productimages ON productimages.productid = products.productid 
                INNER JOIN sellers ON sellers.seller_id = products.seller_id
                INNER JOIN categories ON products.categoryid = categories.categoryid
                WHERE products.productid = $1 AND productimages.isprimary = true`, [productID]);
            const assignedData = result.rows[0];
            if (!assignedData) {
                return res.status(404).json({ message: 'Not Found' });
            }
            const [colors, sizes, images] = yield Promise.all([
                getColors(productID),
                getSizes(productID),
                getImages(productID)
            ]);
            const [reviewCounts, reviews] = yield review(productID);
            const data = {
                productid: assignedData.productid,
                title: assignedData.title,
                description: assignedData.description,
                stock: assignedData.stock,
                discountedprice: assignedData.discount,
                price: assignedData.price,
                stars: assignedData.stars,
                seller: assignedData.company_name,
                reviewcount: reviewCounts,
                categories: { subcategory: assignedData.categoryname, maincategory: assignedData.maincategory },
                imglink: assignedData.imglink,
                imgalt: assignedData.imgalt,
                imgcollection: images,
                colors: colors,
                sizes: sizes,
                reviews
            };
            const updateViewQuery = `UPDATE productparams SET views = views + 1 WHERE productid = $1`;
            DB_1.client.query(updateViewQuery, [productID]).catch((err) => console.error('View count update error:', err));
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(404).json({ message: 'Not Found' });
        }
    }
    else {
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.post('/review/create', productsValidation_1.createReviewSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { userID, productID, rating, title, comment } = (0, express_validator_1.matchedData)(req);
        const checkQuery = `SELECT reviewid FROM reviews WHERE userid = $1 AND productid = $2`;
        const checkValue = [userID, productID];
        try {
            const response = yield DB_1.client.query(checkQuery, checkValue);
            if (response.rows.length > 0) {
                return res.status(409).json({ message: 'Review Already Exists' });
            }
        }
        catch (error) {
            return res.status(500).json({ error: 'Server Error' });
        }
        const orderCheck = `SELECT orders.userid,orderitems.productid FROM orders INNER JOIN orderitems ON orders.orderid = orderitems.orderid WHERE orders.userid = $1 AND orderitems.productid = $2`;
        const orderValue = [userID, productID];
        try {
            const response = yield DB_1.client.query(orderCheck, orderValue);
            if (response.rows.length === 0) {
                return res.status(403).json({ message: 'Order does not exist' });
            }
        }
        catch (error) {
            return res.status(500).json({ error: 'Server Error' });
        }
        const query = `INSERT INTO reviews (userid,productid,rating,title,comment) VALUES ($1,$2,$3,$4,$5) RETURNING reviewid`;
        const value = [userID, productID, rating, title, comment];
        try {
            yield DB_1.client.query(query, value);
            yield calculateStarAverage(productID);
            const updateViewQuery = `UPDATE productparams SET rating = rating + 1 WHERE productid = $1`;
            yield DB_1.client.query(updateViewQuery, [productID]);
            res.status(200).json({ message: 'Review Successfully Created' });
        }
        catch (error) {
            res.status(500).json({ error: 'Server Error' });
        }
    }
    else {
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.patch('/review/edit', productsValidation_1.editReviewSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { reviewID, userID, productID, rating, title, comment } = (0, express_validator_1.matchedData)(req);
        const checkQuery = `SELECT reviewid FROM reviews WHERE userid = $1 AND productid = $2 AND reviewid = $3`;
        const checkValue = [userID, productID, reviewID];
        try {
            const response = yield DB_1.client.query(checkQuery, checkValue);
            if (response.rows.length === 0) {
                return res.status(404).json({ message: 'Review Does Not Exist' });
            }
        }
        catch (error) {
            return res.status(500).json({ error: 'Server Error' });
        }
        const query = `UPDATE reviews SET rating = $1, comment = $2, title = $3 WHERE productid = $4 AND userid = $5 AND reviewid = $6`;
        const value = [rating, comment, title, productID, userID, reviewID];
        try {
            yield DB_1.client.query(query, value);
            return res.status(200).json({ message: 'Review Successfully Updated' });
        }
        catch (error) {
            return res.status(500).json({ error: 'Server Error' });
        }
    }
    else {
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.delete('/review/delete', productsValidation_1.deleteReviewSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { reviewID, userID, productID } = (0, express_validator_1.matchedData)(req);
        const checkQuery = `SELECT reviewid FROM reviews WHERE userid = $1 AND productid = $2 AND reviewid = $3`;
        const checkValue = [userID, productID, reviewID];
        try {
            const response = yield DB_1.client.query(checkQuery, checkValue);
            if (response.rows.length === 0) {
                return res.status(404).json({ message: 'Review Does Not Exist' });
            }
        }
        catch (error) {
            return res.status(500).json({ error: 'Server Error' });
        }
        const query = `DELETE FROM reviews WHERE userid = $1 AND productid = $2 AND reviewid = $3`;
        const value = [userID, productID, reviewID];
        try {
            yield DB_1.client.query(query, value);
            yield calculateStarAverage(productID);
            const updateViewQuery = `UPDATE productparams SET rating = rating - 1 WHERE productid = $1`;
            yield DB_1.client.query(updateViewQuery, [productID]);
            res.status(200).json({ message: 'Review Successfully Deleted' });
        }
        catch (error) {
            res.status(500).json({ error: 'Server Error' });
        }
    }
    else {
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.get('/reviews/:productID', productsValidation_1.getReviewSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { productID } = (0, express_validator_1.matchedData)(req);
        try {
            const result = yield DB_1.client.query(`SELECT 
                    reviews.reviewid, reviews.userid, reviews.rating, 
                    reviews.title, reviews.comment, users.username, 
                    reviews.createdat, productparams.stars AS productstars 
                FROM reviews 
                INNER JOIN users ON users.userid = reviews.userid 
                INNER JOIN productparams ON reviews.productid = productparams.productid 
                WHERE reviews.productid = $1 
                ORDER BY reviews.createdat`, [productID]);
            if (result.rows.length === 0) {
                return res.status(200).json({ data: [] });
            }
            res.status(200).json({ data: result.rows });
        }
        catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    else {
        res.status(500).json({ message: 'Validation error' });
    }
}));
exports.default = router;
