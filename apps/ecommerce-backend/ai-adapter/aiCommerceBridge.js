"use strict";
/**
 * ⚡ Razorpay AI Commerce - AI Shopping & Merchant Intelligence Adapter Bridge
 *
 * Clean architectural boundary connecting:
 * Storefront / Autonomous Agents (Shopi AI) <---> Ecommerce Engine <---> Merchant Intelligence Hub
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiSearchProducts = aiSearchProducts;
exports.aiGetProductDetails = aiGetProductDetails;
exports.aiAddToCart = aiAddToCart;
exports.dispatchMerchantEvent = dispatchMerchantEvent;
const DB_1 = require("../data/DB");
/**
 * 1. AI Product Search & Discovery
 */
function aiSearchProducts(queryText, filters) {
    return __awaiter(this, void 0, void 0, function* () {
        const baseQuery = `
    SELECT p.productid, p.title, c.name AS category, p.price, p.discount, 
           pp.stars, p.stock, pp.isdiscount
    FROM products p
    JOIN categories c ON p.categoryid = c.categoryid
    JOIN productparams pp ON p.productid = pp.productid
    WHERE (p.title ILIKE '%' || $1 || '%' OR p.description ILIKE '%' || $1 || '%' OR p.tags ILIKE '%' || $1 || '%')
    ${(filters === null || filters === void 0 ? void 0 : filters.minPrice) ? `AND p.discount >= ${filters.minPrice}` : ''}
    ${(filters === null || filters === void 0 ? void 0 : filters.maxPrice) ? `AND p.discount <= ${filters.maxPrice}` : ''}
    ${(filters === null || filters === void 0 ? void 0 : filters.minRating) ? `AND pp.stars >= ${filters.minRating}` : ''}
    LIMIT 20;
  `;
        const result = yield DB_1.client.query(baseQuery, [queryText]);
        return result.rows.map(row => ({
            productid: row.productid,
            title: row.title,
            category: row.category,
            price: parseFloat(row.price),
            discountedPrice: parseFloat(row.discount),
            stars: parseFloat(row.stars || 0),
            stock: row.stock,
            colors: [],
            sizes: [],
            isDiscount: row.isdiscount
        }));
    });
}
/**
 * 2. AI Product Inspection & Comparative Analysis
 */
function aiGetProductDetails(productid) {
    return __awaiter(this, void 0, void 0, function* () {
        const prodQuery = `
    SELECT p.productid, p.title, p.description, p.price, p.discount, p.stock,
           c.name as category, pp.stars, pp.sold, pp.views
    FROM products p
    JOIN categories c ON p.categoryid = c.categoryid
    JOIN productparams pp ON p.productid = pp.productid
    WHERE p.productid = $1;
  `;
        const colorQuery = `SELECT colorid, colorname, colorclass FROM productcolors WHERE productid = $1;`;
        const sizeQuery = `SELECT sizeid, sizename, instock FROM productsizes WHERE productid = $1;`;
        const reviewQuery = `SELECT rating, title, comment, createdat FROM reviews WHERE productid = $1 ORDER BY createdat DESC LIMIT 5;`;
        const [prodRes, colorRes, sizeRes, reviewRes] = yield Promise.all([
            DB_1.client.query(prodQuery, [productid]),
            DB_1.client.query(colorQuery, [productid]),
            DB_1.client.query(sizeQuery, [productid]),
            DB_1.client.query(reviewQuery, [productid])
        ]);
        if (prodRes.rows.length === 0)
            return null;
        return Object.assign(Object.assign({}, prodRes.rows[0]), { colors: colorRes.rows, sizes: sizeRes.rows, recentReviews: reviewRes.rows });
    });
}
/**
 * 3. AI Autonomous Cart Operations
 */
function aiAddToCart(userID, productID, quantity, sizeID, colorID) {
    return __awaiter(this, void 0, void 0, function* () {
        const insertQuery = `
    INSERT INTO cartitems (userid, productid, quantity, sizeid, colorid)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (cartitemid) DO NOTHING
    RETURNING cartitemid;
  `;
        const res = yield DB_1.client.query(insertQuery, [userID, productID, quantity, sizeID, colorID]);
        return res.rows[0];
    });
}
/**
 * 4. Merchant Intelligence Telemetry Dispatcher
 */
function dispatchMerchantEvent(event) {
    return __awaiter(this, void 0, void 0, function* () {
        // Dispatches analytics event for Streamlit Merchant Intelligence ingestion
        const eventRecord = Object.assign(Object.assign({}, event), { timestamp: event.timestamp || new Date().toISOString() });
        console.log(`[Merchant Intelligence Event]: ${event.eventType}`, eventRecord);
        return { status: 'dispatched', event: eventRecord };
    });
}
