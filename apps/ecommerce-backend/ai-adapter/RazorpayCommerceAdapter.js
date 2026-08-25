"use strict";
/**
 * ⚡ RazorpayCommerceAdapter - Shopi AI Shopping Merchant Adapter
 *
 * Implements MerchantAdapter interface to connect Shopi ShoppingAgent
 * directly to the real Razorpay AI Commerce PostgreSQL database (40 products, 69 categories).
 *
 * Features:
 * - Real product catalog discovery (discover)
 * - Intelligent natural query search with keyword & price constraints (searchProducts)
 * - Paginated & categorized catalog browsing (listProducts)
 * - Detailed product retrieval with colors/sizes variants in INR (getProduct)
 * - Customer review analysis & ratings retrieval (getProductReviews)
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
exports.RazorpayCommerceAdapter = void 0;
const DB_1 = require("../data/DB");
const SemanticProductMatcher_1 = require("./SemanticProductMatcher");
class RazorpayCommerceAdapter {
    constructor(options = {}) {
        this.adapterType = 'razorpay-commerce';
        this.domain = options.domain || 'localhost:3000';
        this.merchantName = options.merchantName || 'Razorpay AI Commerce';
        this.defaultCurrency = options.defaultCurrency || 'INR';
    }
    /**
     * Domain Matcher for Multi-Merchant Router
     */
    matchesDomain(domain) {
        if (!domain)
            return true;
        const clean = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
        return clean === this.domain.toLowerCase() ||
            clean.includes('localhost') ||
            clean.includes('razorpay') ||
            clean.includes('shop') ||
            clean.includes('store') ||
            clean === 'default';
    }
    /**
     * 1. Discover Merchant Capabilities
     */
    discover(domain) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                domain: domain || this.domain,
                name: this.merchantName,
                protocol: 'adapter',
                adapterType: this.adapterType,
                capabilities: [
                    'catalog.browse',
                    'catalog.search',
                    'catalog.reviews',
                    'catalog.variants',
                    'cart.manage',
                    'checkout.razorpay'
                ],
                ucpProfile: {
                    version: '2026-01-01',
                    capabilities: [
                        { name: 'catalog', version: '1.0' },
                        { name: 'cart', version: '1.0' },
                        { name: 'checkout.razorpay', version: '1.0' }
                    ]
                }
            };
        });
    }
    /**
     * 2. List Products with Pagination and Optional Category Filtering
     */
    listProducts(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const page = Math.max((options === null || options === void 0 ? void 0 : options.page) || 1, 1);
            const limit = Math.min(Math.max((options === null || options === void 0 ? void 0 : options.limit) || 10, 1), 50);
            const offset = (page - 1) * limit;
            let whereClause = 'WHERE 1=1';
            const params = [];
            if ((options === null || options === void 0 ? void 0 : options.category) && options.category.trim() !== '') {
                params.push(`%${options.category.trim()}%`);
                whereClause += ` AND (c.name ILIKE $${params.length} OR c.maincategory ILIKE $${params.length})`;
            }
            const countQuery = `
      SELECT COUNT(DISTINCT p.productid) as total
      FROM products p
      LEFT JOIN categories c ON p.categoryid = c.categoryid
      ${whereClause};
    `;
            const countRes = yield DB_1.client.query(countQuery, params);
            const total = parseInt(((_a = countRes.rows[0]) === null || _a === void 0 ? void 0 : _a.total) || '0', 10);
            const listQuery = `
      SELECT p.productid, p.title, p.description, p.price, p.discount, p.stock,
             c.name AS category_name, c.maincategory,
             pi.imglink, pi.imgalt,
             pp.stars
      FROM products p
      LEFT JOIN categories c ON p.categoryid = c.categoryid
      LEFT JOIN productimages pi ON p.productid = pi.productid AND pi.isprimary = true
      LEFT JOIN productparams pp ON p.productid = pp.productid
      ${whereClause}
      ORDER BY p.productid ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;
            const queryParams = [...params, limit, offset];
            const res = yield DB_1.client.query(listQuery, queryParams);
            const products = yield Promise.all(res.rows.map((row) => this.formatProductRow(row)));
            return { products, total };
        });
    }
    /**
     * 3. Natural Product Search (Supports keywords, categories, and price constraints)
     */
    searchProducts(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, limit = 10) {
            const maxLimit = Math.min(Math.max(limit || 10, 1), 50);
            const rawQuery = (query || '').trim();
            // Extract price constraints if present (e.g. "under 3000", "under ₹2000", "below 1500", "less than 500")
            let maxPriceConstraint = null;
            let minPriceConstraint = null;
            let cleanedKeywords = rawQuery;
            const underMatch = rawQuery.match(/(?:under|below|less than|within)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
            if (underMatch && underMatch[1]) {
                maxPriceConstraint = parseFloat(underMatch[1]);
                cleanedKeywords = cleanedKeywords.replace(underMatch[0], ' ').trim();
            }
            const aboveMatch = rawQuery.match(/(?:above|over|more than|exceeding)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
            if (aboveMatch && aboveMatch[1]) {
                minPriceConstraint = parseFloat(aboveMatch[1]);
                cleanedKeywords = cleanedKeywords.replace(aboveMatch[0], ' ').trim();
            }
            // Exact price match (e.g. "₹2299", "2299 rs", "price 2499")
            let exactPriceConstraint = null;
            const exactMatch = rawQuery.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i);
            if (exactMatch && exactMatch[1] && maxPriceConstraint === null && minPriceConstraint === null) {
                exactPriceConstraint = parseFloat(exactMatch[1]);
                cleanedKeywords = cleanedKeywords.replace(exactMatch[0], ' ').trim();
            }
            // Stop words to ignore during natural language search
            const STOP_WORDS = new Set([
                'show', 'find', 'get', 'give', 'me', 'some', 'all', 'any', 'the', 'a', 'an',
                'product', 'products', 'item', 'items', 'thing', 'things', 'something', 'anything',
                'everything', 'one', 'ones', 'good', 'best', 'cheap', 'affordable', 'for', 'with',
                'in', 'on', 'at', 'to', 'of', 'and', 'or', 'is', 'are', 'want', 'need', 'looking'
            ]);
            // Clean search tokens and filter out stop words
            const tokens = cleanedKeywords
                .replace(/[^\w\s'-]/g, ' ')
                .split(/\s+/)
                .map(t => t.trim().toLowerCase())
                .filter(t => t.length > 1 && !STOP_WORDS.has(t));
            const params = [];
            let whereConditions = [];
            if (tokens.length > 0) {
                // Build word conditions across title, description, tags, category name, and maincategory
                const tokenClauses = tokens.map(token => {
                    // Strip trailing 's' for simple plural matching (e.g. tops -> top, shoes -> shoe)
                    const singular = token.endsWith('s') && token.length > 3 ? token.slice(0, -1) : token;
                    params.push(`%${singular}%`);
                    const idx = params.length;
                    return `(p.title ILIKE $${idx} OR p.description ILIKE $${idx} OR p.tags ILIKE $${idx} OR c.name ILIKE $${idx} OR c.maincategory ILIKE $${idx})`;
                });
                whereConditions.push(`(${tokenClauses.join(' OR ')})`);
            }
            if (maxPriceConstraint !== null) {
                params.push(maxPriceConstraint);
                whereConditions.push(`CAST(p.discount AS numeric) <= $${params.length}`);
            }
            if (minPriceConstraint !== null) {
                params.push(minPriceConstraint);
                whereConditions.push(`CAST(p.discount AS numeric) >= $${params.length}`);
            }
            if (exactPriceConstraint !== null) {
                params.push(exactPriceConstraint);
                whereConditions.push(`(CAST(p.discount AS numeric) = $${params.length} OR CAST(p.price AS numeric) = $${params.length})`);
            }
            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
            const orderByClause = tokens.length > 0
                ? `ORDER BY 
          CASE 
            WHEN p.title ILIKE $1 THEN 1
            WHEN p.tags ILIKE $1 THEN 2
            ELSE 3
          END ASC,
          pp.stars DESC NULLS LAST,
          p.productid ASC`
                : `ORDER BY CAST(p.discount AS numeric) ASC, pp.stars DESC NULLS LAST, p.productid ASC`;
            const searchQuery = `
      SELECT p.productid, p.title, p.description, p.price, p.discount, p.stock,
             c.name AS category_name, c.maincategory,
             pi.imglink, pi.imgalt,
             pp.stars
      FROM products p
      LEFT JOIN categories c ON p.categoryid = c.categoryid
      LEFT JOIN productimages pi ON p.productid = pi.productid AND pi.isprimary = true
      LEFT JOIN productparams pp ON p.productid = pp.productid
      ${whereClause}
      ${orderByClause}
      LIMIT $${params.length + 1};
    `;
            const candidateFetchLimit = Math.max(maxLimit * 3, 30);
            // If no search tokens provided, fallback to standard listing
            let res;
            if (params.length === 0) {
                res = yield DB_1.client.query(`SELECT p.productid, p.title, p.description, p.price, p.discount, p.stock,
                c.name AS category_name, c.maincategory,
                pi.imglink, pi.imgalt,
                pp.stars
         FROM products p
         LEFT JOIN categories c ON p.categoryid = c.categoryid
         LEFT JOIN productimages pi ON p.productid = pi.productid AND pi.isprimary = true
         LEFT JOIN productparams pp ON p.productid = pp.productid
         ORDER BY pp.stars DESC NULLS LAST
         LIMIT $1`, [candidateFetchLimit]);
            }
            else {
                res = yield DB_1.client.query(searchQuery, [...params, candidateFetchLimit]);
            }
            const rawCandidates = yield Promise.all(res.rows.map((row) => this.formatProductRow(row)));
            // Apply semantic scoring, demographic alignment, and relevance ranking
            const ranked = (0, SemanticProductMatcher_1.rankAndFilterProducts)(rawCandidates, rawQuery);
            const finalProducts = ranked.length > 0 ? ranked.slice(0, maxLimit) : rawCandidates.slice(0, maxLimit);
            return {
                products: finalProducts,
                total: finalProducts.length,
                query: rawQuery
            };
        });
    }
    /**
     * 4. Get Full Product Details by ID
     */
    getProduct(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const id = parseInt(productId, 10);
            if (isNaN(id)) {
                throw new Error(`Invalid product ID format: "${productId}". Must be an integer.`);
            }
            const query = `
      SELECT p.productid, p.title, p.description, p.price, p.discount, p.stock,
             c.name AS category_name, c.maincategory,
             pi.imglink, pi.imgalt,
             pp.stars
      FROM products p
      LEFT JOIN categories c ON p.categoryid = c.categoryid
      LEFT JOIN productimages pi ON p.productid = pi.productid AND pi.isprimary = true
      LEFT JOIN productparams pp ON p.productid = pp.productid
      WHERE p.productid = $1;
    `;
            const res = yield DB_1.client.query(query, [id]);
            if (res.rows.length === 0) {
                throw new Error(`Product with ID "${productId}" was not found in catalog.`);
            }
            return this.formatProductRow(res.rows[0], true);
        });
    }
    /**
     * 5. Get Product Reviews & Ratings
     */
    getProductReviews(productId_1) {
        return __awaiter(this, arguments, void 0, function* (productId, limit = 10) {
            var _a;
            const id = parseInt(productId, 10);
            if (isNaN(id)) {
                throw new Error(`Invalid product ID format: "${productId}". Must be an integer.`);
            }
            const maxLimit = Math.min(Math.max(limit || 10, 1), 50);
            const reviewsQuery = `
      SELECT r.reviewid, r.userid, r.rating, r.title, r.comment, r.createdat,
             u.username
      FROM reviews r
      LEFT JOIN users u ON r.userid = u.userid
      WHERE r.productid = $1
      ORDER BY r.createdat DESC
      LIMIT $2;
    `;
            const [reviewsRes, ratingRes] = yield Promise.all([
                DB_1.client.query(reviewsQuery, [id, maxLimit]),
                DB_1.client.query(`SELECT stars, rating FROM productparams WHERE productid = $1;`, [id])
            ]);
            const averageRating = ((_a = ratingRes.rows[0]) === null || _a === void 0 ? void 0 : _a.stars)
                ? parseFloat(ratingRes.rows[0].stars)
                : reviewsRes.rows.length > 0
                    ? reviewsRes.rows.reduce((acc, r) => acc + parseFloat(r.rating || 0), 0) / reviewsRes.rows.length
                    : 4.5;
            const totalReviews = reviewsRes.rows.length;
            const reviews = reviewsRes.rows.map((row) => ({
                id: row.reviewid ? row.reviewid.toString() : `rev_${Math.random()}`,
                author: row.username || 'Verified Customer',
                rating: parseFloat(row.rating || 5),
                title: row.title || 'Product Review',
                body: row.comment || 'Great quality product.',
                date: row.createdat ? new Date(row.createdat).toISOString() : new Date().toISOString(),
                verified: true
            }));
            return {
                productId: productId.toString(),
                averageRating: parseFloat(averageRating.toFixed(1)),
                totalReviews,
                reviews
            };
        });
    }
    /**
     * 6. Real Cart: Get Current Cart for User
     */
    getCart(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `
      SELECT c.cartitemid, c.productid, c.quantity, c.colorid, c.sizeid,
             p.title, p.discount, p.price, p.stock,
             cat.name AS category_name, cat.maincategory,
             pi.imglink, pi.imgalt,
             pc.colorname,
             ps.sizename
      FROM cartitems c
      INNER JOIN products p ON c.productid = p.productid
      LEFT JOIN categories cat ON p.categoryid = cat.categoryid
      LEFT JOIN productimages pi ON p.productid = pi.productid AND pi.isprimary = true
      LEFT JOIN productcolors pc ON c.colorid = pc.colorid
      LEFT JOIN productsizes ps ON c.sizeid = ps.sizeid
      WHERE c.userid = $1
      ORDER BY c.cartitemid ASC;
    `;
            const res = yield DB_1.client.query(query, [userId]);
            let total = 0;
            let itemCount = 0;
            const items = res.rows.map((row) => {
                const unitPrice = parseFloat(row.discount || row.price || 0);
                const qty = parseInt(row.quantity || 1, 10);
                const itemTotal = unitPrice * qty;
                total += itemTotal;
                itemCount += qty;
                return {
                    cartItemId: row.cartitemid,
                    productId: row.productid.toString(),
                    name: row.title || 'Product',
                    price: unitPrice,
                    quantity: qty,
                    currency: this.defaultCurrency,
                    imageUrl: row.imglink || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
                    category: row.category_name || row.maincategory,
                    color: row.colorname || undefined,
                    size: row.sizename || undefined,
                    itemTotal: parseFloat(itemTotal.toFixed(2)),
                };
            });
            return {
                items,
                itemCount,
                total: parseFloat(total.toFixed(2)),
                currency: this.defaultCurrency,
            };
        });
    }
    /**
     * 7. Real Cart: Add Product to Cart for User
     */
    addToCart(userId_1, productId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, productId, quantity = 1, colorId, sizeId) {
            const id = parseInt(productId, 10);
            if (isNaN(id)) {
                throw new Error(`Invalid product ID: "${productId}". Must be an integer.`);
            }
            const qty = Math.max(1, Math.min(quantity || 1, 10));
            // Verify product exists and is in stock
            const prodQuery = `
      SELECT p.productid, p.title, p.discount, p.price, p.stock,
             pi.imglink,
             (SELECT colorid FROM productcolors WHERE productid = p.productid LIMIT 1) AS default_colorid,
             (SELECT sizeid FROM productsizes WHERE productid = p.productid LIMIT 1) AS default_sizeid
      FROM products p
      LEFT JOIN productimages pi ON p.productid = pi.productid AND pi.isprimary = true
      WHERE p.productid = $1;
    `;
            const prodRes = yield DB_1.client.query(prodQuery, [id]);
            if (prodRes.rows.length === 0) {
                throw new Error(`Product with ID "${productId}" does not exist in catalog.`);
            }
            const prod = prodRes.rows[0];
            if (prod.stock !== null && prod.stock !== undefined && prod.stock <= 0) {
                throw new Error(`Product "${prod.title}" is currently out of stock.`);
            }
            const finalColorId = colorId !== undefined ? colorId : prod.default_colorid;
            const finalSizeId = sizeId !== undefined ? sizeId : prod.default_sizeid;
            // Check if item is already in user's cart
            const checkQuery = `
      SELECT cartitemid, quantity 
      FROM cartitems 
      WHERE userid = $1 AND productid = $2;
    `;
            const checkRes = yield DB_1.client.query(checkQuery, [userId, id]);
            if (checkRes.rows.length > 0) {
                const existingCartItemId = checkRes.rows[0].cartitemid;
                const updateQuery = `
        UPDATE cartitems 
        SET quantity = quantity + $1, updatedat = CURRENT_TIMESTAMP 
        WHERE cartitemid = $2 
        RETURNING cartitemid, quantity;
      `;
                yield DB_1.client.query(updateQuery, [qty, existingCartItemId]);
            }
            else {
                const insertQuery = `
        INSERT INTO cartitems (userid, productid, quantity, colorid, sizeid) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING cartitemid, quantity;
      `;
                yield DB_1.client.query(insertQuery, [userId, id, qty, finalColorId, finalSizeId]);
            }
            const updatedCart = yield this.getCart(userId);
            const addedItem = updatedCart.items.find(i => i.productId === productId);
            return {
                success: true,
                message: `Added "${prod.title}" (Qty: ${qty}) to your cart.`,
                cart: updatedCart,
                addedItem,
            };
        });
    }
    /**
     * 8. Real Cart: Remove Product or Cart Item from User's Cart
     */
    removeFromCart(userId, productIdOrCartItemId) {
        return __awaiter(this, void 0, void 0, function* () {
            const id = typeof productIdOrCartItemId === 'string' ? parseInt(productIdOrCartItemId, 10) : productIdOrCartItemId;
            if (isNaN(id)) {
                throw new Error(`Invalid ID: "${productIdOrCartItemId}".`);
            }
            const deleteQuery = `
      DELETE FROM cartitems 
      WHERE userid = $1 AND (productid = $2 OR cartitemid = $2)
      RETURNING cartitemid, productid;
    `;
            const res = yield DB_1.client.query(deleteQuery, [userId, id]);
            const updatedCart = yield this.getCart(userId);
            if (res.rows.length === 0) {
                return {
                    success: false,
                    message: `Item was not found in your cart.`,
                    cart: updatedCart,
                };
            }
            return {
                success: true,
                message: `Item has been removed from your cart.`,
                cart: updatedCart,
            };
        });
    }
    /**
     * 9. Real Cart: Update Product Quantity in User's Cart
     */
    updateCartQuantity(userId, productIdOrCartItemId, newQuantity) {
        return __awaiter(this, void 0, void 0, function* () {
            const id = typeof productIdOrCartItemId === 'string' ? parseInt(productIdOrCartItemId, 10) : productIdOrCartItemId;
            if (isNaN(id)) {
                throw new Error(`Invalid ID: "${productIdOrCartItemId}".`);
            }
            if (newQuantity <= 0) {
                return this.removeFromCart(userId, id);
            }
            const qty = Math.min(newQuantity, 10);
            const updateQuery = `
      UPDATE cartitems 
      SET quantity = $1, updatedat = CURRENT_TIMESTAMP 
      WHERE userid = $2 AND (productid = $3 OR cartitemid = $3)
      RETURNING cartitemid, quantity;
    `;
            const res = yield DB_1.client.query(updateQuery, [qty, userId, id]);
            const updatedCart = yield this.getCart(userId);
            if (res.rows.length === 0) {
                return {
                    success: false,
                    message: `Item was not found in your cart.`,
                    cart: updatedCart,
                };
            }
            return {
                success: true,
                message: `Cart quantity updated to ${qty}.`,
                cart: updatedCart,
            };
        });
    }
    /**
     * 9b. Clear All Items in User's Cart
     */
    clearCart(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield DB_1.client.query('DELETE FROM cartitems WHERE userid = $1', [userId]);
            const updatedCart = yield this.getCart(userId);
            return {
                success: true,
                message: 'Your cart has been cleared.',
                cart: updatedCart,
            };
        });
    }
    /**
     * 10. Real Addresses: Get All Saved Addresses for a User
     */
    getUserAddresses(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `
      SELECT addressid, userid, addresstype, contactnumber, addressline1, addressline2,
             city, state, country, postalcode, username, is_default
      FROM addresses
      WHERE userid = $1
      ORDER BY is_default DESC, addressid ASC;
    `;
            const res = yield DB_1.client.query(query, [userId]);
            return res.rows.map(row => ({
                addressID: row.addressid,
                userID: row.userid,
                addressType: row.addresstype || 'HOME',
                userName: row.username || 'Valued Customer',
                contactNumber: row.contactnumber ? String(row.contactnumber) : '',
                addressLine1: row.addressline1 || '',
                addressLine2: row.addressline2 || '',
                city: row.city || '',
                state: row.state || '',
                country: row.country || 'India',
                postalCode: row.postalcode || '',
                is_default: Boolean(row.is_default),
            }));
        });
    }
    /**
     * 11. Real Addresses: Get Default / Primary Address for a User
     */
    getDefaultAddress(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const addresses = yield this.getUserAddresses(userId);
            if (addresses.length === 0)
                return null;
            const defaultAddr = addresses.find(a => a.is_default);
            return defaultAddr || addresses[0];
        });
    }
    /**
     * Helper: Format Database Product Row into Standard Product Object
     */
    formatProductRow(row_1) {
        return __awaiter(this, arguments, void 0, function* (row, includeVariants = false) {
            const productId = row.productid;
            const finalPrice = parseFloat(row.discount || row.price || '0').toFixed(2);
            let variants = [];
            if (includeVariants) {
                const [colorRes, sizeRes] = yield Promise.all([
                    DB_1.client.query(`SELECT colorid, colorname FROM productcolors WHERE productid = $1;`, [productId]),
                    DB_1.client.query(`SELECT sizeid, sizename, instock FROM productsizes WHERE productid = $1;`, [productId])
                ]);
                const colors = colorRes.rows;
                const sizes = sizeRes.rows;
                if (colors.length > 0 && sizes.length > 0) {
                    for (const col of colors) {
                        for (const sz of sizes) {
                            variants.push({
                                id: `${col.colorid}-${sz.sizeid}`,
                                name: `${col.colorname || 'Standard'} / ${sz.sizename || 'One Size'}`,
                                price: { amount: finalPrice, currency: this.defaultCurrency }
                            });
                        }
                    }
                }
                else if (sizes.length > 0) {
                    variants = sizes.map((sz) => ({
                        id: sz.sizeid.toString(),
                        name: sz.sizename || 'Standard Size',
                        price: { amount: finalPrice, currency: this.defaultCurrency }
                    }));
                }
                else if (colors.length > 0) {
                    variants = colors.map((col) => ({
                        id: col.colorid.toString(),
                        name: col.colorname || 'Standard Color',
                        price: { amount: finalPrice, currency: this.defaultCurrency }
                    }));
                }
            }
            return {
                id: productId.toString(),
                name: row.title || 'Untitled Product',
                description: row.description || 'Premium product from Razorpay AI Commerce store catalog.',
                price: {
                    amount: finalPrice,
                    currency: this.defaultCurrency
                },
                category: row.category_name || row.maincategory || 'Apparel',
                inStock: (row.stock === null || row.stock === undefined) ? true : row.stock > 0,
                imageUrl: row.imglink || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
                variants: variants.length > 0 ? variants : undefined
            };
        });
    }
}
exports.RazorpayCommerceAdapter = RazorpayCommerceAdapter;
