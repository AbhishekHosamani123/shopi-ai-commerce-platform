"use strict";
/**
 * WooCommerce REST API v3 Adapter
 *
 * Connects agorio agents to WooCommerce stores via the WooCommerce REST API v3.
 * Translates WC products into UCP-compatible format.
 *
 * Public product browsing works without auth on stores that allow it.
 * Cart/checkout writes require a consumer key + secret (HMAC-SHA256).
 *
 * Usage:
 *   const adapter = new WooCommerceAdapter({
 *     url: 'https://mystore.com',
 *     consumerKey: 'ck_xxx',    // optional — only needed for write operations
 *     consumerSecret: 'cs_xxx', // optional — only needed for write operations
 *   });
 *
 *   const agent = new ShoppingAgent({
 *     llm: new GeminiAdapter({ apiKey: '...' }),
 *     adapters: [adapter],
 *   });
 *
 *   await agent.run('Search for running shoes on mystore.com');
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
exports.WooCommerceAdapterError = exports.WooCommerceAdapter = void 0;
exports.isWooCommerceStore = isWooCommerceStore;
// ─── Adapter Implementation ───
class WooCommerceAdapter {
    constructor(options) {
        var _a;
        this.adapterType = 'woocommerce';
        this.storeUrl = options.url.replace(/\/+$/, '');
        this.consumerKey = options.consumerKey;
        this.consumerSecret = options.consumerSecret;
        this.fetchFn = (_a = options.fetch) !== null && _a !== void 0 ? _a : globalThis.fetch.bind(globalThis);
        this.apiBase = `${this.storeUrl}/wp-json/wc/v3`;
    }
    get domain() {
        return this.storeUrl.replace(/^https?:\/\//, '');
    }
    matchesDomain(domain) {
        const clean = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        return clean === this.domain;
    }
    discover(_domain) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const res = yield this.get('/settings/general', true);
            const siteName = Array.isArray(res)
                ? this.domain
                : (_a = res['blogname']) !== null && _a !== void 0 ? _a : this.domain;
            return {
                domain: this.domain,
                name: siteName,
                protocol: 'adapter',
                adapterType: 'woocommerce',
                capabilities: [
                    'products.list',
                    'products.search',
                    'products.get',
                    'checkout.create',
                    'orders.track',
                ],
            };
        });
    }
    listProducts(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const perPage = Math.min((_a = options === null || options === void 0 ? void 0 : options.limit) !== null && _a !== void 0 ? _a : 10, 100);
            const page = (_b = options === null || options === void 0 ? void 0 : options.page) !== null && _b !== void 0 ? _b : 1;
            const params = new URLSearchParams({
                per_page: String(perPage),
                page: String(page),
                status: 'publish',
            });
            if (options === null || options === void 0 ? void 0 : options.category) {
                params.set('category', options.category);
            }
            const products = yield this.get(`/products?${params}`);
            return {
                products: products.map(p => this.toMockProduct(p)),
                total: products.length,
            };
        });
    }
    searchProducts(query, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            const perPage = Math.min(limit !== null && limit !== void 0 ? limit : 10, 100);
            const params = new URLSearchParams({
                search: query,
                per_page: String(perPage),
                status: 'publish',
            });
            const products = yield this.get(`/products?${params}`);
            return {
                products: products.map(p => this.toMockProduct(p)),
                total: products.length,
                query,
            };
        });
    }
    getProduct(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield this.get(`/products/${encodeURIComponent(productId)}`);
            return this.toMockProduct(product);
        });
    }
    createCheckout(items) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!this.consumerKey || !this.consumerSecret) {
                throw new WooCommerceAdapterError('WooCommerce checkout requires consumerKey and consumerSecret. ' +
                    'Set them in WooCommerceAdapterOptions to enable write operations.');
            }
            const lineItems = items.map(item => ({
                product_id: parseInt(item.productId, 10),
                quantity: item.quantity,
            }));
            const order = yield this.post('/orders', {
                status: 'pending',
                line_items: lineItems,
                billing: {
                    first_name: 'Agent',
                    last_name: 'Purchase',
                    email: 'agent@agorio.dev',
                    address_1: '',
                    city: '',
                    postcode: '',
                    country: 'US',
                },
            });
            const total = (_a = order.total) !== null && _a !== void 0 ? _a : '0.00';
            const currency = (_b = order.currency) !== null && _b !== void 0 ? _b : 'USD';
            return {
                sessionId: String(order.id),
                totals: {
                    subtotal: { amount: total, currency },
                    total: { amount: total, currency },
                },
            };
        });
    }
    completeCheckout(sessionId, payment, shippingAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (!this.consumerKey || !this.consumerSecret) {
                throw new WooCommerceAdapterError('WooCommerce checkout requires consumerKey and consumerSecret.');
            }
            const updated = yield this.post(`/orders/${sessionId}`, {
                status: 'processing',
                payment_method: payment.method,
                billing: {
                    first_name: (_a = shippingAddress.name.split(' ')[0]) !== null && _a !== void 0 ? _a : '',
                    last_name: (_b = shippingAddress.name.split(' ').slice(1).join(' ')) !== null && _b !== void 0 ? _b : '',
                    address_1: shippingAddress.line1,
                    address_2: (_c = shippingAddress.line2) !== null && _c !== void 0 ? _c : '',
                    city: shippingAddress.city,
                    state: shippingAddress.state,
                    postcode: shippingAddress.postalCode,
                    country: shippingAddress.country,
                    email: 'agent@agorio.dev',
                },
            });
            return {
                orderId: String(updated.id),
                status: updated.status,
            };
        });
    }
    // ─── Internal Helpers ───
    get(path_1) {
        return __awaiter(this, arguments, void 0, function* (path, allowAny = false) {
            const url = path.startsWith('http') ? path : `${this.apiBase}${path}`;
            const headers = this.buildAuthHeaders();
            const response = yield this.fetchFn(url, { headers });
            if (!response.ok) {
                const body = yield response.text().catch(() => '');
                throw new WooCommerceAdapterError(`WooCommerce API error: GET ${path} → ${response.status} ${response.statusText} — ${body}`);
            }
            const json = yield response.json();
            if (!allowAny && typeof json === 'object' && json !== null && 'code' in json && 'message' in json) {
                throw new WooCommerceAdapterError(`WooCommerce error: ${json.message}`);
            }
            return json;
        });
    }
    post(path, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.apiBase}${path}`;
            const headers = Object.assign(Object.assign({}, this.buildAuthHeaders()), { 'Content-Type': 'application/json' });
            const response = yield this.fetchFn(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const errBody = yield response.text().catch(() => '');
                throw new WooCommerceAdapterError(`WooCommerce API error: POST ${path} → ${response.status} ${response.statusText} — ${errBody}`);
            }
            const json = yield response.json();
            return json;
        });
    }
    buildAuthHeaders() {
        const headers = {
            'Accept': 'application/json',
            'User-Agent': '@agorio/sdk',
        };
        if (this.consumerKey && this.consumerSecret) {
            const creds = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
            headers['Authorization'] = `Basic ${creds}`;
        }
        return headers;
    }
    toMockProduct(p) {
        var _a, _b;
        const inStock = p.stock_status === 'instock' || p.stock_status === 'onbackorder';
        const category = (_a = p.categories[0]) === null || _a === void 0 ? void 0 : _a.name;
        const imageUrl = (_b = p.images[0]) === null || _b === void 0 ? void 0 : _b.src;
        const price = p.price || p.regular_price || '0.00';
        return {
            id: String(p.id),
            name: p.name,
            description: p.short_description || p.description || '',
            price: {
                amount: parseFloat(price).toFixed(2),
                currency: 'USD',
            },
            category,
            inStock,
            imageUrl,
            variants: p.type === 'variable' && p.variations.length > 0
                ? p.variations.map((vId, i) => ({
                    id: String(vId),
                    name: `Variant ${i + 1}`,
                }))
                : undefined,
        };
    }
}
exports.WooCommerceAdapter = WooCommerceAdapter;
// ─── Static helpers ───
/**
 * Check if a domain is likely a WooCommerce store by probing /wp-json/wc/v3/products.
 * Returns true if the endpoint responds with a 200 OK (even without auth).
 */
function isWooCommerceStore(domain_1) {
    return __awaiter(this, arguments, void 0, function* (domain, fetchFn = globalThis.fetch) {
        const url = `https://${domain.replace(/^https?:\/\//, '')}/wp-json/wc/v3/products?per_page=1`;
        try {
            const res = yield fetchFn(url, {
                headers: { Accept: 'application/json', 'User-Agent': '@agorio/sdk' },
            });
            return res.ok;
        }
        catch (_a) {
            return false;
        }
    });
}
// ─── Error Class ───
class WooCommerceAdapterError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WooCommerceAdapterError';
    }
}
exports.WooCommerceAdapterError = WooCommerceAdapterError;
