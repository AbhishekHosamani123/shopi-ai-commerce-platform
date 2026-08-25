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
exports.WooCommerceConnector = void 0;
const base_connector_1 = require("./base-connector");
/**
 * 🛒 WooCommerce REST API v3 Connector
 */
class WooCommerceConnector extends base_connector_1.BaseMerchantConnector {
    constructor() {
        super(...arguments);
        this.provider = 'WOOCOMMERCE';
    }
    getBaseUrl() {
        var _a, _b;
        const endpoint = ((_a = this.config) === null || _a === void 0 ? void 0 : _a.endpointUrl) || ((_b = this.config) === null || _b === void 0 ? void 0 : _b.storeIdentifier) || 'https://example-woo-store.com';
        return `${endpoint.replace(/\/$/, '')}/wp-json/wc/v3`;
    }
    testConnection(config) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const url = `${((config === null || config === void 0 ? void 0 : config.endpointUrl) || ((_a = this.config) === null || _a === void 0 ? void 0 : _a.endpointUrl) || 'https://example-woo-store.com').replace(/\/$/, '')}/wp-json/wc/v3/system_status`;
            const start = Date.now();
            try {
                const res = yield this.httpClient.get(url, { timeout: 8000 });
                return {
                    success: true,
                    provider: this.provider,
                    latencyMs: Date.now() - start,
                    message: 'Successfully connected to WooCommerce store.',
                    serverVersion: ((_c = (_b = res.data) === null || _b === void 0 ? void 0 : _b.environment) === null || _c === void 0 ? void 0 : _c.version) || 'v3'
                };
            }
            catch (err) {
                return {
                    success: false,
                    provider: this.provider,
                    latencyMs: Date.now() - start,
                    message: 'WooCommerce connection failed.',
                    error: err.message
                };
            }
        });
    }
    getProducts(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.getBaseUrl()}/products?page=${params.page || 1}&per_page=${params.limit || 50}`;
            const res = yield this.requestWithRetry({ url, method: 'GET' });
            const products = (res.data || []).map((p) => {
                var _a, _b;
                return ({
                    externalId: String(p.id),
                    sku: p.sku || `SKU-WOO-${p.id}`,
                    title: p.name,
                    category: ((_b = (_a = p.categories) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.name) || 'General',
                    price: parseFloat(p.price || '0'),
                    cost: undefined,
                    stock: p.stock_quantity || 0,
                    updatedAt: p.date_modified || new Date().toISOString(),
                    status: p.status === 'publish' ? 'ACTIVE' : 'DRAFT'
                });
            });
            return { data: products, limit: params.limit || 50, hasMore: products.length >= (params.limit || 50) };
        });
    }
    getCustomers(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.getBaseUrl()}/customers?page=${params.page || 1}&per_page=${params.limit || 50}`;
            const res = yield this.requestWithRetry({ url, method: 'GET' });
            const customers = (res.data || []).map((c) => ({
                externalId: String(c.id),
                name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username || 'Customer',
                email: c.email || '',
                totalOrders: c.orders_count || 0,
                totalSpent: parseFloat(c.total_spent || '0'),
                createdAt: c.date_created || new Date().toISOString(),
                updatedAt: c.date_modified || new Date().toISOString()
            }));
            return { data: customers, limit: params.limit || 50, hasMore: customers.length >= (params.limit || 50) };
        });
    }
    getOrders(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.getBaseUrl()}/orders?page=${params.page || 1}&per_page=${params.limit || 50}`;
            const res = yield this.requestWithRetry({ url, method: 'GET' });
            const orders = (res.data || []).map((o) => ({
                externalId: String(o.id),
                externalCustomerId: String(o.customer_id || 'cust_guest'),
                orderNumber: o.number || String(o.id),
                orderDate: o.date_created || new Date().toISOString(),
                orderStatus: o.status === 'completed' ? 'COMPLETED' : (o.status === 'refunded' ? 'REFUNDED' : 'PENDING'),
                currency: o.currency || 'INR',
                subtotal: parseFloat(o.total || '0') - parseFloat(o.shipping_total || '0'),
                discountTotal: parseFloat(o.discount_total || '0'),
                shippingTotal: parseFloat(o.shipping_total || '0'),
                taxTotal: parseFloat(o.total_tax || '0'),
                totalAmount: parseFloat(o.total || '0'),
                items: (o.line_items || []).map((li) => ({
                    externalItemId: String(li.id),
                    externalOrderId: String(o.id),
                    externalProductId: String(li.product_id),
                    sku: li.sku || '',
                    title: li.name,
                    quantity: li.quantity,
                    unitPrice: parseFloat(li.price || '0'),
                    discount: 0,
                    totalPrice: parseFloat(li.total || '0')
                })),
                updatedAt: o.date_modified || new Date().toISOString()
            }));
            return { data: orders, limit: params.limit || 50, hasMore: orders.length >= (params.limit || 50) };
        });
    }
    getOrderItems(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const url = `${this.getBaseUrl()}/orders/${orderId}`;
            const res = yield this.requestWithRetry({ url, method: 'GET' });
            return (((_a = res.data) === null || _a === void 0 ? void 0 : _a.line_items) || []).map((li) => ({
                externalItemId: String(li.id),
                externalOrderId: String(orderId),
                externalProductId: String(li.product_id),
                sku: li.sku || '',
                title: li.name,
                quantity: li.quantity,
                unitPrice: parseFloat(li.price || '0'),
                discount: 0,
                totalPrice: parseFloat(li.total || '0')
            }));
        });
    }
    getInventory(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return { data: [], limit: params.limit || 50, hasMore: false };
        });
    }
    getReturns(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return { data: [], limit: params.limit || 50, hasMore: false };
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
exports.WooCommerceConnector = WooCommerceConnector;
