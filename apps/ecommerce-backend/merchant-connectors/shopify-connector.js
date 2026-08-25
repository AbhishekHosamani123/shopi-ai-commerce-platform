"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.ShopifyConnector = void 0;
const base_connector_1 = require("./base-connector");
/**
 * 🛍️ Shopify REST / GraphQL Admin API Connector
 */
class ShopifyConnector extends base_connector_1.BaseMerchantConnector {
    constructor() {
        super(...arguments);
        this.provider = 'SHOPIFY';
        this.apiVersion = '2024-01';
    }
    getShopUrl() {
        var _a;
        const store = ((_a = this.config) === null || _a === void 0 ? void 0 : _a.storeIdentifier.replace(/^https?:\/\//, '').replace(/\/$/, '')) || 'example.myshopify.com';
        return `https://${store}/admin/api/${this.apiVersion}`;
    }
    testConnection(config) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const store = ((config === null || config === void 0 ? void 0 : config.storeIdentifier) || ((_a = this.config) === null || _a === void 0 ? void 0 : _a.storeIdentifier) || '').replace(/^https?:\/\//, '');
            const token = (config === null || config === void 0 ? void 0 : config.credentials.accessToken) || ((_b = this.config) === null || _b === void 0 ? void 0 : _b.credentials.accessToken);
            const start = Date.now();
            if (!store || !token) {
                return {
                    success: false,
                    provider: this.provider,
                    latencyMs: 0,
                    message: 'Shopify connection failed: store identifier and access token are required.',
                    error: 'Missing credentials'
                };
            }
            try {
                const res = yield this.httpClient.get(`https://${store}/admin/api/${this.apiVersion}/shop.json`, {
                    headers: { 'X-Shopify-Access-Token': token },
                    timeout: 8000
                });
                return {
                    success: true,
                    provider: this.provider,
                    latencyMs: Date.now() - start,
                    message: `Successfully connected to Shopify store (${((_c = res.data.shop) === null || _c === void 0 ? void 0 : _c.name) || store})`,
                    serverVersion: this.apiVersion
                };
            }
            catch (err) {
                return {
                    success: false,
                    provider: this.provider,
                    latencyMs: Date.now() - start,
                    message: 'Shopify store connection failed.',
                    error: ((_e = (_d = err.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.errors) || err.message
                };
            }
        });
    }
    getProducts(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.getShopUrl()}/products.json?limit=${params.limit || 50}`;
            const res = yield this.requestWithRetry({ url, method: 'GET' });
            const products = (res.data.products || []).map((p) => {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                return ({
                    externalId: String(p.id),
                    sku: ((_b = (_a = p.variants) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.sku) || `SKU-${p.id}`,
                    title: p.title,
                    category: p.product_type || 'General',
                    price: parseFloat(((_d = (_c = p.variants) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.price) || '0'),
                    cost: parseFloat(((_f = (_e = p.variants) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.cost) || '0') || undefined,
                    stock: ((_h = (_g = p.variants) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.inventory_quantity) || 0,
                    updatedAt: p.updated_at,
                    status: p.status === 'active' ? 'ACTIVE' : 'DRAFT'
                });
            });
            return {
                data: products,
                limit: params.limit || 50,
                hasMore: products.length >= (params.limit || 50)
            };
        });
    }
    getCustomers(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.getShopUrl()}/customers.json?limit=${params.limit || 50}`;
            const res = yield this.requestWithRetry({ url, method: 'GET' });
            const customers = (res.data.customers || []).map((c) => ({
                externalId: String(c.id),
                name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Shopify Customer',
                email: c.email || '',
                phone: c.phone,
                totalOrders: c.orders_count || 0,
                totalSpent: parseFloat(c.total_spent || '0'),
                createdAt: c.created_at,
                updatedAt: c.updated_at
            }));
            return {
                data: customers,
                limit: params.limit || 50,
                hasMore: customers.length >= (params.limit || 50)
            };
        });
    }
    getOrders(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = new URLSearchParams();
            query.append('limit', String(params.limit || 50));
            query.append('status', 'any');
            if (params.updatedSince)
                query.append('updated_at_min', params.updatedSince.toISOString());
            const url = `${this.getShopUrl()}/orders.json?${query.toString()}`;
            const res = yield this.requestWithRetry({ url, method: 'GET' });
            const orders = (res.data.orders || []).map((o) => {
                var _a, _b, _c;
                return ({
                    externalId: String(o.id),
                    externalCustomerId: String(((_a = o.customer) === null || _a === void 0 ? void 0 : _a.id) || 'cust_guest'),
                    orderNumber: o.name || String(o.order_number),
                    orderDate: o.created_at,
                    orderStatus: o.cancelled_at ? 'CANCELLED' : (o.financial_status === 'refunded' ? 'REFUNDED' : 'COMPLETED'),
                    currency: o.currency || 'INR',
                    subtotal: parseFloat(o.subtotal_price || '0'),
                    discountTotal: parseFloat(o.total_discounts || '0'),
                    shippingTotal: parseFloat(((_c = (_b = o.total_shipping_price_set) === null || _b === void 0 ? void 0 : _b.shop_money) === null || _c === void 0 ? void 0 : _c.amount) || '0'),
                    taxTotal: parseFloat(o.total_tax || '0'),
                    totalAmount: parseFloat(o.total_price || '0'),
                    items: (o.line_items || []).map((li) => ({
                        externalItemId: String(li.id),
                        externalOrderId: String(o.id),
                        externalProductId: String(li.product_id),
                        sku: li.sku || '',
                        title: li.title,
                        quantity: li.quantity,
                        unitPrice: parseFloat(li.price || '0'),
                        discount: parseFloat(li.total_discount || '0'),
                        totalPrice: parseFloat(li.price || '0') * li.quantity
                    })),
                    updatedAt: o.updated_at
                });
            });
            return {
                data: orders,
                limit: params.limit || 50,
                hasMore: orders.length >= (params.limit || 50)
            };
        });
    }
    getOrderItems(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.getShopUrl()}/orders/${orderId}.json`;
            const res = yield this.requestWithRetry({ url, method: 'GET' });
            const o = res.data.order;
            if (!o)
                return [];
            return (o.line_items || []).map((li) => ({
                externalItemId: String(li.id),
                externalOrderId: String(o.id),
                externalProductId: String(li.product_id),
                sku: li.sku || '',
                title: li.title,
                quantity: li.quantity,
                unitPrice: parseFloat(li.price || '0'),
                discount: parseFloat(li.total_discount || '0'),
                totalPrice: parseFloat(li.price || '0') * li.quantity
            }));
        });
    }
    getInventory(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.getShopUrl()}/inventory_levels.json?limit=${params.limit || 50}`;
            const res = yield this.requestWithRetry({ url, method: 'GET' });
            const inv = (res.data.inventory_levels || []).map((lvl) => ({
                externalProductId: String(lvl.inventory_item_id),
                sku: `SKU-INV-${lvl.inventory_item_id}`,
                availableStock: lvl.available || 0,
                reservedStock: 0,
                updatedAt: lvl.updated_at || new Date().toISOString()
            }));
            return { data: inv, limit: params.limit || 50, hasMore: inv.length >= (params.limit || 50) };
        });
    }
    getReturns(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.getShopUrl()}/refunds.json?limit=${params.limit || 50}`;
            const res = yield this.requestWithRetry({ url, method: 'GET' });
            const rets = (res.data.refunds || []).map((r) => {
                var _a, _b;
                return ({
                    externalReturnId: String(r.id),
                    externalOrderId: String(r.order_id),
                    returnReason: r.note || 'Return / Refund',
                    refundAmount: parseFloat(((_b = (_a = r.transactions) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.amount) || '0'),
                    status: 'COMPLETED',
                    createdAt: r.created_at
                });
            });
            return { data: rets, limit: params.limit || 50, hasMore: false };
        });
    }
    getPayments(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return { data: [], limit: params.limit || 50, hasMore: false };
        });
    }
    syncIncremental(merchantId, since) {
        return __awaiter(this, void 0, void 0, function* () {
            const { liveSyncEngine } = yield Promise.resolve().then(() => __importStar(require('./live-sync-engine')));
            return liveSyncEngine.runIncrementalSync(this, merchantId, since);
        });
    }
}
exports.ShopifyConnector = ShopifyConnector;
