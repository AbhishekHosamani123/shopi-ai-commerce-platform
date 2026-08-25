"use strict";
/**
 * ⚡ Shopi AI Shopping Route (POST /api/ai/chat) - Stateful Conversational Intelligence
 *
 * Implements:
 * 1. Conversation State Management (persistence of recommendations, cart state, last actions)
 * 2. Intent Classification (ADD_TO_CART_ALL, ADD_TO_CART_SINGLE, COMPARE, REMOVE, SEARCH, etc.)
 * 3. Deterministic Entity & Reference Resolution ("all the results", "that", "the cheaper one", "the second one")
 * 4. Grounded Product Identity & Zero Hallucination
 * 5. Real-Time PostgreSQL Cart Control
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const RazorpayCommerceAdapter_1 = require("../ai-adapter/RazorpayCommerceAdapter");
const SemanticProductMatcher_1 = require("../ai-adapter/SemanticProductMatcher");
const ConversationalStateManager_1 = require("../ai-adapter/ConversationalStateManager");
const ConversationalResolver_1 = require("../ai-adapter/ConversationalResolver");
const router = express_1.default.Router();
const JWT_SECRET = process.env.JWT_ENCRYPTION_KEY;
const DEFAULT_DEMO_USER_ID = 666574596;
function extractAuthenticatedUserID(req) {
    try {
        const authHeader = req.headers['authorization'];
        let token;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        else if (req.headers['x-user-token']) {
            token = req.headers['x-user-token'];
        }
        if (!token || !JWT_SECRET)
            return null;
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded.userID || null;
    }
    catch (_a) {
        return null;
    }
}
function formatCartItemList(items) {
    return items.map(i => `• ${i.name} ×${i.quantity} — ₹${i.price.toLocaleString('en-IN')}`).join('\n');
}
function toCanonicalProduct(p) {
    var _a, _b, _c;
    const priceVal = typeof p.price === 'number'
        ? p.price
        : parseFloat(((_a = p.price) === null || _a === void 0 ? void 0 : _a.amount) || p.discount || p.price || 0);
    const rawId = String(p.id || p.productid || p.productId || '');
    return {
        id: rawId,
        productId: rawId,
        title: p.name || p.title || '',
        name: p.name || p.title || '',
        price: priceVal,
        currency: ((_b = p.price) === null || _b === void 0 ? void 0 : _b.currency) || p.currency || 'INR',
        category: p.category || (p.categories ? p.categories.subcategory || p.categories.maincategory : undefined),
        imageUrl: p.imageUrl || p.imglink || '',
        inStock: (_c = p.inStock) !== null && _c !== void 0 ? _c : (p.stock === undefined || p.stock > 0),
        stars: p.stars || 0,
        rating: p.rating || p.reviewCount || 0,
        description: p.description || '',
    };
}
/**
 * POST /api/ai/chat
 */
router.post('/chat', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { message, userId, conversationId } = req.body;
    // 1. Validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Message is required and must be a non-empty string.',
        });
    }
    const cleanMessage = message.trim();
    const authUserId = extractAuthenticatedUserID(req);
    const isAuthUser = Boolean(authUserId || (userId && typeof userId === 'number' && userId > 0));
    const targetUserId = authUserId || (typeof userId === 'number' ? userId : parseInt(userId, 10)) || DEFAULT_DEMO_USER_ID;
    try {
        const adapter = new RazorpayCommerceAdapter_1.RazorpayCommerceAdapter({
            domain: 'localhost:3000',
            merchantName: 'Razorpay AI Commerce',
            defaultCurrency: 'INR',
        });
        // 2. Fetch current cart state and conversation state
        let currentCart = yield adapter.getCart(targetUserId);
        const state = ConversationalStateManager_1.conversationManager.getState(conversationId, targetUserId);
        state.cartState = currentCart;
        // 3. Classify Intent & Resolve References
        const intent = (0, ConversationalResolver_1.classifyIntent)(cleanMessage, state);
        const resolved = (0, ConversationalResolver_1.resolveReferences)(intent, state, currentCart);
        // Development logging
        console.log(`\n========================================`);
        console.log(`[Shopi AI Intent Resolution]`);
        console.log(`USER: "${cleanMessage}"`);
        console.log(`INTENT: ${intent.type}`);
        console.log(`REFERENCE: ${intent.referenceType || 'NONE'}`);
        console.log(`RESOLVED PRODUCTS: [${resolved.resolvedProducts.map(p => `${p.productId} (${p.title})`).join(', ')}]`);
        console.log(`========================================\n`);
        // ──────────────────────────────────────────────────────────────────────────
        // 4. ACTION DISPATCH & EXECUTION ROUTER
        // ──────────────────────────────────────────────────────────────────────────
        // ── Intent 1: Checkout ──
        if (intent.type === 'CHECKOUT') {
            currentCart = yield adapter.getCart(targetUserId);
            if (currentCart.items.length === 0) {
                return res.status(200).json({
                    success: true,
                    intent: 'checkout',
                    message: 'Your cart is currently empty. Add something before checking out.',
                    products: [],
                    cart: currentCart,
                    checkout: {
                        available: false,
                        url: '/cart-checkout',
                        isCartEmpty: true,
                        itemCount: 0,
                        total: 0,
                    },
                    userId: targetUserId,
                    conversationId: conversationId || undefined,
                });
            }
            const itemLines = currentCart.items
                .map((i) => `• ${i.name} ×${i.quantity} — ₹${i.price.toLocaleString('en-IN')}`)
                .join('\n');
            const checkoutMessage = `You're ready to checkout! 🛒\n\nYour cart:\n${itemLines}\n\nTotal: ₹${currentCart.total.toLocaleString('en-IN')} INR`;
            return res.status(200).json({
                success: true,
                intent: 'checkout',
                message: checkoutMessage,
                products: [],
                cart: currentCart,
                checkout: {
                    available: true,
                    url: '/cart-checkout',
                    isCartEmpty: false,
                    itemCount: currentCart.itemCount,
                    total: currentCart.total,
                },
                userId: targetUserId,
                conversationId: conversationId || undefined,
            });
        }
        // ── Intent 2: Saved Address Retrieval ──
        if (intent.type === 'ADDRESS_LIST') {
            if (!isAuthUser) {
                return res.status(200).json({
                    success: true,
                    intent: 'address_list',
                    message: 'Please sign in to view your saved delivery addresses, or proceed to checkout to enter an address.',
                    products: [],
                    cart: currentCart,
                    checkout: { available: true, url: '/cart-checkout' },
                    userId: targetUserId,
                    conversationId: conversationId || undefined,
                });
            }
            const addresses = yield adapter.getUserAddresses(targetUserId);
            if (addresses.length === 0) {
                return res.status(200).json({
                    success: true,
                    intent: 'address_list',
                    message: "You don't have any saved delivery addresses yet. Please enter your delivery address on the checkout page, and I'll use it for your order.",
                    products: [],
                    cart: currentCart,
                    checkout: { available: true, url: '/cart-checkout' },
                    userId: targetUserId,
                    conversationId: conversationId || undefined,
                });
            }
            const formattedAddresses = addresses.map((addr, idx) => {
                const defaultBadge = addr.is_default ? '\n   ⭐ Default shipping address' : '';
                const line2 = addr.addressLine2 ? `, ${addr.addressLine2}` : '';
                return `${idx + 1}. ${addr.userName}\n   ${addr.addressLine1}${line2}\n   ${addr.city}, ${addr.state} - ${addr.postalCode}${defaultBadge}`;
            }).join('\n\n');
            return res.status(200).json({
                success: true,
                intent: 'address_list',
                message: `Here are your saved delivery addresses:\n\n${formattedAddresses}`,
                addresses,
                products: [],
                cart: currentCart,
                checkout: { available: true, url: '/cart-checkout' },
                userId: targetUserId,
                conversationId: conversationId || undefined,
            });
        }
        // ── Intent 3: Use Default Address ──
        if (intent.type === 'ADDRESS_DEFAULT') {
            if (!isAuthUser) {
                return res.status(200).json({
                    success: true,
                    intent: 'address_selected',
                    message: 'Please sign in to use your saved delivery address, or proceed to checkout to enter your address.',
                    products: [],
                    cart: currentCart,
                    checkout: { available: true, url: '/cart-checkout' },
                    userId: targetUserId,
                    conversationId: conversationId || undefined,
                });
            }
            const defaultAddr = yield adapter.getDefaultAddress(targetUserId);
            if (!defaultAddr) {
                return res.status(200).json({
                    success: true,
                    intent: 'address_selected',
                    message: "You don't have a default address saved yet. Please enter your delivery address on the checkout page.",
                    products: [],
                    cart: currentCart,
                    checkout: { available: true, url: '/cart-checkout' },
                    userId: targetUserId,
                    conversationId: conversationId || undefined,
                });
            }
            const line2 = defaultAddr.addressLine2 ? `, ${defaultAddr.addressLine2}` : '';
            return res.status(200).json({
                success: true,
                intent: 'address_selected',
                message: `I'll use your default delivery address for your order:\n\n📍 ${defaultAddr.userName}\n${defaultAddr.addressLine1}${line2}\n${defaultAddr.city}, ${defaultAddr.state} - ${defaultAddr.postalCode}\n\nReady to proceed to checkout!`,
                selectedAddress: defaultAddr,
                products: [],
                cart: currentCart,
                checkout: { available: true, url: '/cart-checkout' },
                userId: targetUserId,
                conversationId: conversationId || undefined,
            });
        }
        // ── Intent 4: Add New Address ──
        if (intent.type === 'ADDRESS_NEW') {
            return res.status(200).json({
                success: true,
                intent: 'address_new',
                message: "Sure! Please enter your delivery address on the checkout page, and I'll use it for your order.",
                products: [],
                cart: currentCart,
                checkout: { available: true, url: '/cart-checkout' },
                userId: targetUserId,
                conversationId: conversationId || undefined,
            });
        }
        // ── Intent 5: Query What Was Just Added ──
        if (intent.type === 'CHECK_LAST_ADDED') {
            if (state.lastAddedProducts && state.lastAddedProducts.length > 0) {
                const productLines = state.lastAddedProducts
                    .map(p => `• ${p.title} — ₹${p.price.toLocaleString('en-IN')}`)
                    .join('\n');
                return res.status(200).json({
                    success: true,
                    intent: 'check_last_added',
                    message: `You recently added:\n\n${productLines}\n\nYour cart currently has ${currentCart.itemCount} item(s) totaling ₹${currentCart.total.toLocaleString('en-IN')} INR.`,
                    products: state.lastAddedProducts,
                    cart: currentCart,
                    userId: targetUserId,
                    conversationId: conversationId || undefined,
                });
            }
            return res.status(200).json({
                success: true,
                intent: 'check_last_added',
                message: "You haven't added any products in this conversation yet.",
                products: [],
                cart: currentCart,
                userId: targetUserId,
                conversationId: conversationId || undefined,
            });
        }
        // ── Intent 6: Check Cart / Cart Summary ──
        if (intent.type === 'CHECK_CART') {
            currentCart = yield adapter.getCart(targetUserId);
            if (currentCart.items.length === 0) {
                return res.status(200).json({
                    success: true,
                    intent: 'check_cart',
                    message: 'Your shopping cart is currently empty.',
                    products: [],
                    cart: currentCart,
                    userId: targetUserId,
                    conversationId: conversationId || undefined,
                });
            }
            const itemLines = currentCart.items
                .map((i) => `• ${i.name} ×${i.quantity} — ₹${(i.price * i.quantity).toLocaleString('en-IN')}`)
                .join('\n');
            return res.status(200).json({
                success: true,
                intent: 'check_cart',
                message: `Your shopping cart has ${currentCart.itemCount} item(s):\n\n${itemLines}\n\nTotal: ₹${currentCart.total.toLocaleString('en-IN')} INR`,
                products: [],
                cart: currentCart,
                userId: targetUserId,
                conversationId: conversationId || undefined,
            });
        }
        // ── Intent 7: Clear Cart ──
        if (intent.type === 'CLEAR_CART') {
            const clearRes = yield adapter.clearCart(targetUserId);
            currentCart = clearRes.cart;
            ConversationalStateManager_1.conversationManager.updateState(conversationId, targetUserId, {
                lastAddedProducts: [],
                lastActiveProduct: undefined,
                cartState: currentCart,
            });
            return res.status(200).json({
                success: true,
                intent: 'clear_cart',
                message: "I've cleared all items from your shopping cart.",
                products: [],
                cart: currentCart,
                userId: targetUserId,
                conversationId: conversationId || undefined,
            });
        }
        // ── Intent 8: View / Navigate to Product ──
        if (intent.type === 'VIEW_PRODUCT') {
            if (resolved.resolvedProducts.length > 0) {
                const prod = resolved.resolvedProducts[0];
                ConversationalStateManager_1.conversationManager.updateState(conversationId, targetUserId, {
                    lastViewedProduct: prod,
                    lastActiveProduct: prod,
                    lastMentionedProducts: [prod],
                });
                return res.status(200).json({
                    success: true,
                    intent: 'view_product',
                    message: `Here is "${prod.title}" (₹${prod.price.toLocaleString('en-IN')}):`,
                    products: [prod],
                    cart: currentCart,
                    userId: targetUserId,
                    conversationId: conversationId || undefined,
                });
            }
            return res.status(200).json({
                success: true,
                intent: 'view_product',
                message: resolved.notFoundReason || "I couldn't find the product you're referring to.",
                products: [],
                cart: currentCart,
                userId: targetUserId,
                conversationId: conversationId || undefined,
            });
        }
        // ── Intent 9: Compare Recommendations (NO NEW SEARCH) ──
        if (intent.type === 'COMPARE_RECOMMENDATIONS') {
            const recs = state.lastRecommendedProducts;
            if (recs && recs.length > 0) {
                if (intent.targetExtremum === 'cheapest') {
                    const sorted = [...recs].sort((a, b) => a.price - b.price);
                    const cheapest = sorted[0];
                    ConversationalStateManager_1.conversationManager.updateState(conversationId, targetUserId, {
                        lastComparedProducts: [cheapest],
                        lastMentionedProducts: [cheapest],
                        lastActiveProduct: cheapest,
                    });
                    return res.status(200).json({
                        success: true,
                        intent: 'compare',
                        message: `Between the options, "${cheapest.title}" is the cheapest at ₹${cheapest.price.toLocaleString('en-IN')}.`,
                        products: [cheapest],
                        cart: currentCart,
                        userId: targetUserId,
                        conversationId: conversationId || undefined,
                    });
                }
                if (intent.targetExtremum === 'expensive') {
                    const sorted = [...recs].sort((a, b) => b.price - a.price);
                    const priciest = sorted[0];
                    ConversationalStateManager_1.conversationManager.updateState(conversationId, targetUserId, {
                        lastComparedProducts: [priciest],
                        lastMentionedProducts: [priciest],
                        lastActiveProduct: priciest,
                    });
                    return res.status(200).json({
                        success: true,
                        intent: 'compare',
                        message: `Between the options, "${priciest.title}" is the most expensive at ₹${priciest.price.toLocaleString('en-IN')}.`,
                        products: [priciest],
                        cart: currentCart,
                        userId: targetUserId,
                        conversationId: conversationId || undefined,
                    });
                }
                // General Comparison
                const comparisonLines = recs
                    .map((p, idx) => `${idx + 1}. **${p.title}** — ₹${p.price.toLocaleString('en-IN')} (Rating: ${p.stars || '4.5'}★)`)
                    .join('\n');
                ConversationalStateManager_1.conversationManager.updateState(conversationId, targetUserId, {
                    lastComparedProducts: recs,
                    lastMentionedProducts: recs,
                });
                return res.status(200).json({
                    success: true,
                    intent: 'compare',
                    message: `Here is the comparison of the recommended products:\n\n${comparisonLines}`,
                    products: recs,
                    cart: currentCart,
                    userId: targetUserId,
                    conversationId: conversationId || undefined,
                });
            }
            return res.status(200).json({
                success: true,
                intent: 'compare',
                message: "I don't have any previous recommendations to compare. Tell me what product you'd like to find!",
                products: [],
                cart: currentCart,
                userId: targetUserId,
                conversationId: conversationId || undefined,
            });
        }
        // ── Intent 10: Remove from Cart ──
        if (intent.type === 'REMOVE_FROM_CART') {
            if (resolved.targetCartItem) {
                const item = resolved.targetCartItem;
                const remRes = yield adapter.removeFromCart(targetUserId, item.productId);
                currentCart = remRes.cart;
                ConversationalStateManager_1.conversationManager.updateState(conversationId, targetUserId, {
                    lastAddedProducts: (state.lastAddedProducts || []).filter(p => p.productId !== item.productId),
                    lastActiveProduct: undefined,
                    cartState: currentCart,
                });
                return res.status(200).json({
                    success: true,
                    intent: 'remove_from_cart',
                    message: `I've removed "${item.name}" from your cart.`,
                    products: [],
                    cart: currentCart,
                    userId: targetUserId,
                    conversationId: conversationId || undefined,
                });
            }
            if (resolved.isAmbiguous) {
                return res.status(200).json({
                    success: true,
                    intent: 'disambiguate_remove',
                    message: `Which product would you like me to remove?\n\nYour cart contains:\n${formatCartItemList(resolved.ambiguousCartItems || currentCart.items)}`,
                    products: [],
                    cart: currentCart,
                    userId: targetUserId,
                    conversationId: conversationId || undefined,
                });
            }
            return res.status(200).json({
                success: true,
                intent: 'remove_from_cart',
                message: resolved.notFoundReason || 'Your shopping cart is currently empty.',
                products: [],
                cart: currentCart,
                userId: targetUserId,
                conversationId: conversationId || undefined,
            });
        }
        // ── Intent 11: Add to Cart (Deterministic Reference Resolution: "all", "that", "the first one", "both") ──
        if ((intent.type === 'ADD_TO_CART_ALL' || intent.type === 'ADD_TO_CART_SINGLE') &&
            resolved.isReferenceResolved &&
            resolved.resolvedProducts.length > 0) {
            const addedList = [];
            for (const prod of resolved.resolvedProducts) {
                const addRes = yield adapter.addToCart(targetUserId, prod.productId, 1);
                currentCart = addRes.cart;
                addedList.push(prod);
            }
            ConversationalStateManager_1.conversationManager.updateState(conversationId, targetUserId, {
                lastAddedProducts: addedList,
                lastActiveProduct: addedList[addedList.length - 1],
                cartState: currentCart,
            });
            let responseText = '';
            if (addedList.length === 1) {
                responseText = `Added "${addedList[0].title}" — ₹${addedList[0].price.toLocaleString('en-IN')} to your cart.`;
            }
            else if (addedList.length === 2) {
                const listText = addedList.map(p => `• ${p.title} — ₹${p.price.toLocaleString('en-IN')}`).join('\n');
                responseText = `Added both products to your cart:\n\n${listText}\n\n2 items added.`;
            }
            else {
                const listText = addedList.map(p => `• ${p.title} — ₹${p.price.toLocaleString('en-IN')}`).join('\n');
                responseText = `Added all ${addedList.length} products to your cart:\n\n${listText}\n\n${addedList.length} items added.`;
            }
            return res.status(200).json({
                success: true,
                intent: 'add_to_cart',
                message: responseText,
                products: addedList,
                cart: currentCart,
                userId: targetUserId,
                conversationId: conversationId || undefined,
            });
        }
        // If reference resolution failed on a reference-type query (e.g. user said "add all of them" with 0 previous recommendations)
        if ((intent.type === 'ADD_TO_CART_ALL' || (intent.type === 'ADD_TO_CART_SINGLE' && intent.referenceType !== undefined)) &&
            resolved.notFoundReason) {
            return res.status(200).json({
                success: true,
                intent: 'add_to_cart_error',
                message: resolved.notFoundReason,
                products: [],
                cart: currentCart,
                userId: targetUserId,
                conversationId: conversationId || undefined,
            });
        }
        // ── Intent 12: Search Refinement (Inheriting previous context) ──
        let searchQuery = cleanMessage;
        let maxPriceFilter = null;
        let minPriceFilter = null;
        if (intent.type === 'REFINE_SEARCH' && resolved.inheritedFilters) {
            searchQuery = state.lastSearchQuery || 'products';
            maxPriceFilter = (_a = resolved.inheritedFilters.maxPrice) !== null && _a !== void 0 ? _a : null;
            minPriceFilter = (_b = resolved.inheritedFilters.minPrice) !== null && _b !== void 0 ? _b : null;
        }
        else {
            const intentInfo = (0, SemanticProductMatcher_1.extractSemanticIntent)(cleanMessage);
            maxPriceFilter = intentInfo.maxPrice;
            minPriceFilter = intentInfo.minPrice;
        }
        // ── Intent 13: Product Discovery / Catalog Search ──
        const searchRes = yield adapter.searchProducts(searchQuery, 20);
        let candidates = searchRes.products || [];
        if (candidates.length === 0) {
            const listRes = yield adapter.listProducts({ page: 1, limit: 50 });
            candidates = listRes.products || [];
        }
        // Apply semantic relevance ranking
        const ranked = (0, SemanticProductMatcher_1.rankAndFilterProducts)(candidates, searchQuery);
        candidates = ranked.length > 0 ? ranked : candidates;
        // Apply Price Filters
        if (maxPriceFilter !== null) {
            candidates = candidates.filter(p => {
                var _a;
                const price = typeof p.price === 'number' ? p.price : parseFloat(String(((_a = p.price) === null || _a === void 0 ? void 0 : _a.amount) || p.price || '0'));
                return price <= maxPriceFilter;
            });
        }
        if (minPriceFilter !== null) {
            candidates = candidates.filter(p => {
                var _a;
                const price = typeof p.price === 'number' ? p.price : parseFloat(String(((_a = p.price) === null || _a === void 0 ? void 0 : _a.amount) || p.price || '0'));
                return price >= minPriceFilter;
            });
        }
        // Deduplicate & take top results
        const seenIds = new Set();
        const finalCanonical = [];
        for (const p of candidates) {
            const can = toCanonicalProduct(p);
            if (!seenIds.has(can.productId) && finalCanonical.length < 5) {
                seenIds.add(can.productId);
                finalCanonical.push(can);
            }
        }
        // Update conversation state with canonical recommendations
        ConversationalStateManager_1.conversationManager.updateState(conversationId, targetUserId, {
            lastSearchQuery: searchQuery,
            lastSearchFilters: {
                maxPrice: maxPriceFilter,
                minPrice: minPriceFilter,
            },
            lastRecommendedProducts: finalCanonical,
            lastActiveProduct: finalCanonical.length === 1 ? finalCanonical[0] : undefined,
        });
        let resultMessage = '';
        if (finalCanonical.length > 0) {
            resultMessage = `I found ${finalCanonical.length} product(s) matching your request:`;
        }
        else {
            resultMessage = `I could not find any products matching "${cleanMessage}" in our store catalog.`;
        }
        return res.status(200).json({
            success: true,
            intent: 'product_search',
            message: resultMessage,
            products: finalCanonical,
            cart: currentCart,
            userId: targetUserId,
            conversationId: conversationId || undefined,
        });
    }
    catch (error) {
        console.error('[Shopi AI Error]:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An error occurred while processing your AI shopping request.',
        });
    }
}));
exports.default = router;
