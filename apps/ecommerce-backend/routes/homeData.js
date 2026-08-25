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
const router = express_1.default.Router();
router.get('/home/banner', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const fetchQuery = `SELECT * FROM banners`;
    try {
        const response = yield DB_1.client.query(fetchQuery);
        res.status(200).json({ data: response.rows });
    }
    catch (error) {
        res.sendStatus(500);
    }
}));
const getImage = (productID) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield DB_1.client.query(`SELECT imageid, imglink, imgalt 
             FROM productimages 
             WHERE productid = $1 AND isprimary = true`, [productID]);
        return result.rows[0];
    }
    catch (error) {
        return { imageid: 0, imglink: '', imgalt: '' };
    }
});
router.get('/home/deals', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const fetchQuery = `SELECT deals.productid,products.title,productparams.stars,products.description,products.price,products.discount,deals.sold,deals.available,productparams.rating,productimages.imglink,productimages.imgalt,deals.end_time
    FROM deals 
    INNER JOIN products ON deals.productid = products.productid 
    INNER JOIN productparams ON productparams.productid = deals.productid
    INNER JOIN productimages ON productimages.productid = deals.productid
    WHERE deals.productid = productimages.productid AND productimages.isprimary = true`;
    try {
        const response = yield DB_1.client.query(fetchQuery);
        res.status(200).json({ data: response.rows });
    }
    catch (error) {
        res.sendStatus(500);
    }
}));
router.get('/home/trending', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const fetchQuery = `SELECT products.productid,products.title,products.price,products.discount,productimages.imglink,productimages.imgalt,categories.name AS category_name,categories.maincategory
    FROM products 
    INNER JOIN productparams ON productparams.productid = products.productid
    INNER JOIN productimages ON productimages.productid = products.productid
    INNER JOIN categories ON categories.categoryid = products.categoryid
    WHERE productimages.isprimary = true
    ORDER BY productparams.views DESC
    LIMIT 8`;
    const fetchQuery1 = `SELECT products.productid,products.title,products.price,products.discount,productimages.imglink,productimages.imgalt,categories.name AS category_name,categories.maincategory
    FROM products 
    INNER JOIN productparams ON productparams.productid = products.productid
    INNER JOIN productimages ON productimages.productid = products.productid
    INNER JOIN categories ON categories.categoryid = products.categoryid
    WHERE productimages.isprimary = true
    ORDER BY productparams.rating DESC
    LIMIT 8`;
    const fetchQuery2 = `SELECT products.productid,products.title,products.price,products.discount,productimages.imglink,productimages.imgalt,categories.name AS category_name,categories.maincategory
    FROM products 
    INNER JOIN productparams ON productparams.productid = products.productid
    INNER JOIN productimages ON productimages.productid = products.productid
    INNER JOIN categories ON categories.categoryid = products.categoryid
    WHERE productimages.isprimary = true
    ORDER BY products.createdat DESC
    LIMIT 8`;
    try {
        const response = yield DB_1.client.query(fetchQuery);
        const response1 = yield DB_1.client.query(fetchQuery1);
        const response2 = yield DB_1.client.query(fetchQuery2);
        res.status(200).json({ data: { trending: response.rows, top_rated: response1.rows, new_arrival: response2.rows } });
    }
    catch (error) {
        res.sendStatus(500);
    }
}));
router.get('/home/best-sellers', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const fetchQuery = `SELECT products.productid,products.title,products.price,products.discount,productimages.imglink,productimages.imgalt,categories.name AS category_name,productparams.stars,productparams.rating
    FROM products 
    INNER JOIN productparams ON productparams.productid = products.productid
    INNER JOIN productimages ON productimages.productid = products.productid
    INNER JOIN categories ON categories.categoryid = products.categoryid
    WHERE productimages.isprimary = true
    ORDER BY productparams.sold DESC
    LIMIT 4`;
    try {
        const response = yield DB_1.client.query(fetchQuery);
        res.status(200).json({ data: response.rows });
    }
    catch (error) {
        res.sendStatus(500);
    }
}));
const fetchProducts = () => __awaiter(void 0, void 0, void 0, function* () {
    const query = `SELECT products.productid,products.title,categories.name AS category,categories.maincategory,products.price,products.discount,productparams.stars,productparams.isnew,productparams.issale,productparams.isdiscount FROM products 
    INNER JOIN categories ON products.categoryid = categories.categoryid 
    INNER JOIN productparams ON products.productid = productparams.productid
    ORDER BY productparams.stars DESC,productparams.rating DESC
    LIMIT 12`;
    try {
        const response = yield DB_1.client.query(query, []);
        if (response.rows.length === 0)
            return [];
        const products = yield Promise.all(response.rows.map((product) => __awaiter(void 0, void 0, void 0, function* () {
            const productID = product.productid;
            const [colors, sizes, reviewCount, images] = yield Promise.all([
                getColors(productID),
                getSizes(productID),
                review(productID),
                getImage(productID)
            ]);
            return Object.assign(Object.assign({}, product), { colors,
                sizes,
                reviewCount,
                images });
        })));
        return products;
    }
    catch (error) {
        console.error(error);
        return [];
    }
});
const review = (productID) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield DB_1.client.query(`SELECT reviews.reviewid
             FROM reviews 
             INNER JOIN users ON users.userid = reviews.userid 
             WHERE productid = $1 `, [productID]);
        return result.rowCount === 0 ? 0 : result.rowCount;
    }
    catch (error) {
        return 0;
    }
});
const getColors = (productID) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield DB_1.client.query(`SELECT colorid, colorname, colorclass 
             FROM productcolors 
             WHERE productid = $1`, [productID]);
        return result.rows.length === 0 ? [] : result.rows;
    }
    catch (error) {
        return [];
    }
});
const getSizes = (productID) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield DB_1.client.query(`SELECT sizeid, sizename, instock 
             FROM productsizes 
             WHERE productid = $1`, [productID]);
        return result.rows.length === 0 ? [] : result.rows;
    }
    catch (error) {
        return [];
    }
});
router.get('/home/products', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield fetchProducts();
        res.status(200).json({ data: response });
    }
    catch (error) {
        res.sendStatus(500);
    }
}));
exports.default = router;
