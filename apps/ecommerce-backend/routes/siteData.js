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
const siteDataValidation_1 = require("../validators/siteDataValidation");
const express_validator_1 = require("express-validator");
const router = express_1.default.Router();
const articleTable = 'articles';
const categoryTable = 'categories';
const productTable = 'products';
router.get('/articles', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `SELECT * FROM ${articleTable}`;
    try {
        const response = yield DB_1.client.query(query);
        res.status(200).json({ data: response.rows });
    }
    catch (error) {
        res.status(404).json({ error: 'Server Error' });
    }
}));
const fetchProducts = (categoryid) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `SELECT products.productid,products.title,categories.name AS category,products.price,products.discount,productparams.stars,productparams.isnew,productparams.issale,productparams.isdiscount FROM products 
    INNER JOIN categories ON products.categoryid = categories.categoryid 
    INNER JOIN productparams ON products.productid = productparams.productid
    WHERE products.categoryid = $1`;
    try {
        const response = yield DB_1.client.query(query, [categoryid]);
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
router.get('/category/:category', siteDataValidation_1.categorySchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if ((0, express_validator_1.validationResult)(req).isEmpty()) {
        const { category } = (0, express_validator_1.matchedData)(req);
        const query = `SELECT categoryid, name FROM ${categoryTable} WHERE maincategory = $1`;
        const value = [category.toUpperCase()];
        try {
            const response = yield DB_1.client.query(query, value);
            const productsPromises = response.rows.map(each => fetchProducts(each.categoryid));
            const products = yield Promise.all(productsPromises);
            const data = {
                categories: response.rows,
                products: products.flat() // Flatten the array of products
            };
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(500).json({ error: 'Server Error' });
        }
    }
    else
        res.status(500).json({ error: 'Validation Error' });
}));
const fetchFilteredProducts = (minPrice, maxPrice, categoryID, minRating) => __awaiter(void 0, void 0, void 0, function* () {
    const query = `SELECT products.productid,products.title,categories.name AS category,products.price,products.discount,productparams.stars,productparams.isnew,productparams.issale,productparams.isdiscount FROM products 
    INNER JOIN categories ON products.categoryid = categories.categoryid 
    INNER JOIN productparams ON products.productid = productparams.productid
    WHERE products.categoryid = $1 AND products.discount >= $2 AND products.discount <= $3 AND productparams.stars >= $4`;
    try {
        const response = yield DB_1.client.query(query, [categoryID, minPrice, maxPrice, minRating]);
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
        return [];
    }
});
router.get('/filter/category/:minPrice/:maxPrice/:categoryID/:minRating/:categoryName', siteDataValidation_1.filterSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { minPrice, maxPrice, categoryID, minRating, categoryName } = (0, express_validator_1.matchedData)(req);
        try {
            const query = `SELECT products.productid,products.title,categories.name AS category,products.price,products.discount,productparams.stars,productparams.isnew,productparams.issale,productparams.isdiscount FROM products 
            INNER JOIN categories ON products.categoryid = categories.categoryid 
            INNER JOIN productparams ON products.productid = productparams.productid
            WHERE products.categoryid = $1 AND products.price >= $2 AND products.price <= $3 AND productparams.stars >= $4`;
            if (categoryID != 0) {
                const response = yield DB_1.client.query(query, [categoryID, minPrice, maxPrice, minRating]);
                if (response.rows.length === 0)
                    return res.status(200).json({ data: [] });
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
                res.status(200).json({ data: products });
            }
            else {
                const query = `SELECT categoryid, name FROM ${categoryTable} WHERE maincategory = $1`;
                const value = [categoryName.toUpperCase()];
                const response = yield DB_1.client.query(query, value);
                const productsPromises = response.rows.map(each => fetchFilteredProducts(minPrice, maxPrice, each.categoryid, minRating));
                const products = yield Promise.all(productsPromises);
                res.status(200).json({ data: products.flat() });
            }
        }
        catch (error) {
            res.status(500).json({ error: 'failed' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ error: 'Validation Error' });
    }
}));
router.get('/filter/category-only/:categoryID/:categoryName', siteDataValidation_1.getCategorySchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if ((0, express_validator_1.validationResult)(req).isEmpty()) {
        const { categoryID, categoryName } = (0, express_validator_1.matchedData)(req);
        try {
            const query = `SELECT products.productid,products.title,categories.name AS category,products.price,products.discount,productparams.stars,productparams.isnew,productparams.issale,productparams.isdiscount FROM products 
            INNER JOIN categories ON products.categoryid = categories.categoryid 
            INNER JOIN productparams ON products.productid = productparams.productid
            WHERE products.categoryid = $1`;
            if (categoryID != 0) {
                const response = yield DB_1.client.query(query, [categoryID]);
                if (response.rows.length === 0)
                    return res.status(200).json({ data: [] });
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
                res.status(200).json({ data: products });
            }
            else {
                const query = `SELECT categoryid, name FROM ${categoryTable} WHERE maincategory = $1`;
                const value = [categoryName.toUpperCase()];
                const response = yield DB_1.client.query(query, value);
                const productsPromises = response.rows.map(each => fetchProducts(each.categoryid));
                const products = yield Promise.all(productsPromises);
                res.status(200).json({ data: products.flat() });
            }
        }
        catch (error) {
            res.status(500).json({ error: 'Failed' });
        }
    }
    else
        res.status(500).json({ error: 'Validation Error' });
}));
function searchProducts(productName) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = `SELECT products.productid, products.title, categories.name AS category, 
        products.price, products.discount, productparams.stars, 
        productparams.isnew, productparams.issale, productparams.isdiscount 
        FROM products 
        INNER JOIN categories ON products.categoryid = categories.categoryid 
        INNER JOIN productparams ON products.productid = productparams.productid
        WHERE products.title ILIKE '%' || $1 || '%' 
        OR products.description ILIKE '%' || $1 || '%' 
        OR products.tags ILIKE '%' || $1 || '%'`;
        try {
            const response = yield DB_1.client.query(query, [productName]);
            if (response.rows.length === 0)
                return [];
            const products = yield Promise.all(response.rows.map((product) => __awaiter(this, void 0, void 0, function* () {
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
            return [];
        }
    });
}
function searchFilteredProducts(productName, minPrice, maxPrice, rating) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = `SELECT products.productid, products.title, categories.name AS category, 
       products.price, products.discount, productparams.stars, 
       productparams.isnew, productparams.issale, productparams.isdiscount 
        FROM products 
        INNER JOIN categories ON products.categoryid = categories.categoryid 
        INNER JOIN productparams ON products.productid = productparams.productid
        WHERE products.discount >= $2 
        AND products.discount <= $3 
        AND productparams.stars >= $4 
        AND (
      products.title ILIKE '%' || $1 || '%' 
      OR products.description ILIKE '%' || $1 || '%' 
      OR products.tags ILIKE '%' || $1 || '%')`;
        try {
            const response = yield DB_1.client.query(query, [productName, minPrice, maxPrice, rating]);
            if (response.rows.length === 0)
                return [];
            const products = yield Promise.all(response.rows.map((product) => __awaiter(this, void 0, void 0, function* () {
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
            return [];
        }
    });
}
const removeDuplicates = (products) => {
    const seen = new Set();
    return products.filter(product => {
        const duplicate = seen.has(product.productid);
        seen.add(product.productid);
        return !duplicate;
    });
};
router.get('/search/product/:productName', siteDataValidation_1.getProductNameSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if ((0, express_validator_1.validationResult)(req).isEmpty()) {
        const { productName } = (0, express_validator_1.matchedData)(req);
        const filteredProductName = productName.split('-');
        try {
            const productsPromises = filteredProductName.map(each => searchProducts(each));
            const products = yield Promise.all(productsPromises);
            const flatProducts = products.flat();
            const uniqueProducts = removeDuplicates(flatProducts);
            res.status(200).json({ data: uniqueProducts });
        }
        catch (error) {
            res.status(500).json({ error: 'Server Error' });
        }
    }
    else
        res.status(500).json({ error: 'Validation Error' });
}));
router.get('/search/filtered-product/:productName/:minPrice/:maxPrice/:rating', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if ((0, express_validator_1.validationResult)(req).isEmpty()) {
        const { productName, minPrice, maxPrice, rating } = req.params;
        const filteredProductName = productName.split('-');
        try {
            const productsPromises = filteredProductName.map(each => searchFilteredProducts(each, minPrice, maxPrice, rating));
            const products = yield Promise.all(productsPromises);
            const flatProducts = products.flat();
            const uniqueProducts = removeDuplicates(flatProducts);
            return res.status(200).json({ data: uniqueProducts });
        }
        catch (error) {
            return res.sendStatus(500);
        }
    }
    else
        res.status(500).json({ error: 'Validation Error' });
}));
// Helper function to capitalize the first letter of a string
const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
};
// Helper function to format subCategory
const formatSubCategory = (string) => {
    return string
        .split('-')
        .map(word => capitalizeFirstLetter(word))
        .join(' ');
};
router.get('/sub-category/:mainCategory/:subCategory', siteDataValidation_1.MainSubCategorySchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if ((0, express_validator_1.validationResult)(req).isEmpty()) {
        const { mainCategory, subCategory } = (0, express_validator_1.matchedData)(req);
        // Capitalize mainCategory
        const formattedMainCategory = mainCategory.toUpperCase();
        // Format subCategory
        const formattedSubCategory = formatSubCategory(subCategory);
        const query = `SELECT categoryid FROM categories WHERE maincategory = $1 AND name = $2`;
        try {
            // Assuming you have a function to query the database
            const queryCategory = yield DB_1.client.query(query, [formattedMainCategory, formattedSubCategory]);
            if (queryCategory.rows.length > 0) {
                const categoryID = queryCategory.rows[0].categoryid;
                const products = yield fetchProducts(categoryID);
                return res.status(200).json({ data: products, categoryid: categoryID });
            }
            res.status(200).json({ data: [], categoryid: 0 });
        }
        catch (error) {
            console.error('Error fetching data:', error);
            return res.status(500).json({ error: 'Failed to fetch data' });
        }
    }
    else
        res.status(500).json({ error: 'Validation Error' });
}));
router.get('/sub-category/filtered-product/:categoryID/:minPrice/:maxPrice/:rating', siteDataValidation_1.categoryFilterSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if ((0, express_validator_1.validationResult)(req).isEmpty()) {
        const { categoryID, minPrice, maxPrice, rating } = (0, express_validator_1.matchedData)(req);
        try {
            const products = yield fetchFilteredProducts(minPrice, maxPrice, parseInt(categoryID), rating);
            res.status(200).json({ data: products });
        }
        catch (error) {
            res.status(500).json({ error: 'Server Error' });
        }
    }
    else
        res.status(500).json({ error: 'Validation Error' });
}));
exports.default = router;
