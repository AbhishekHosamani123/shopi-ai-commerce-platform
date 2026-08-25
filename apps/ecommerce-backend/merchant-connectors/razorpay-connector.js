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
exports.RazorpayPaymentsConnector = void 0;
const base_connector_1 = require("./base-connector");
/**
 * 💳 Razorpay Direct Payment & Order Connector
 */
class RazorpayPaymentsConnector extends base_connector_1.BaseMerchantConnector {
    constructor() {
        super(...arguments);
        this.provider = 'RAZORPAY_DIRECT';
        this.baseUrl = 'https://api.razorpay.com/v1';
    }
    testConnection(config) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const keyId = (config === null || config === void 0 ? void 0 : config.credentials.apiKey) || ((_a = this.config) === null || _a === void 0 ? void 0 : _a.credentials.apiKey) || process.env.RAZORPAY_KEY_ID;
            const keySecret = (config === null || config === void 0 ? void 0 : config.credentials.apiSecret) || ((_b = this.config) === null || _b === void 0 ? void 0 : _b.credentials.apiSecret) || process.env.RAZORPAY_KEY_SECRET;
            const start = Date.now();
            if (!keyId || !keySecret) {
                return {
                    success: false,
                    provider: this.provider,
                    latencyMs: 0,
                    message: 'Razorpay API credentials missing (Key ID / Key Secret required).',
                    error: 'Missing credentials'
                };
            }
            try {
                const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
                const res = yield this.httpClient.get(`${this.baseUrl}/payments?count=1`, {
                    headers: { 'Authorization': authHeader },
                    timeout: 5000
                });
                return {
                    success: true,
                    provider: this.provider,
                    latencyMs: Date.now() - start,
                    message: 'Successfully verified Razorpay API credentials.',
                    serverVersion: 'v1'
                };
            }
            catch (err) {
                // In local dev without live keys, return informative status
                return {
                    success: false,
                    provider: this.provider,
                    latencyMs: Date.now() - start,
                    message: 'Razorpay API validation returned error.',
                    error: err.message
                };
            }
        });
    }
    getProducts(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return { data: [], limit: params.limit || 50, hasMore: false };
        });
    }
    getCustomers(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const keyId = ((_a = this.config) === null || _a === void 0 ? void 0 : _a.credentials.apiKey) || process.env.RAZORPAY_KEY_ID;
            const keySecret = ((_b = this.config) === null || _b === void 0 ? void 0 : _b.credentials.apiSecret) || process.env.RAZORPAY_KEY_SECRET;
            const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
            const res = yield this.requestWithRetry({
                url: `${this.baseUrl}/customers?count=${params.limit || 50}`,
                headers: { 'Authorization': authHeader },
                method: 'GET'
            });
            const customers = (((_c = res.data) === null || _c === void 0 ? void 0 : _c.items) || []).map((c) => ({
                externalId: c.id,
                name: c.name || 'Razorpay Customer',
                email: c.email || '',
                phone: c.contact,
                createdAt: new Date(c.created_at * 1000).toISOString(),
                updatedAt: new Date(c.created_at * 1000).toISOString()
            }));
            return { data: customers, limit: params.limit || 50, hasMore: false };
        });
    }
    getOrders(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const keyId = ((_a = this.config) === null || _a === void 0 ? void 0 : _a.credentials.apiKey) || process.env.RAZORPAY_KEY_ID;
            const keySecret = ((_b = this.config) === null || _b === void 0 ? void 0 : _b.credentials.apiSecret) || process.env.RAZORPAY_KEY_SECRET;
            const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
            const res = yield this.requestWithRetry({
                url: `${this.baseUrl}/orders?count=${params.limit || 50}`,
                headers: { 'Authorization': authHeader },
                method: 'GET'
            });
            const orders = (((_c = res.data) === null || _c === void 0 ? void 0 : _c.items) || []).map((o) => ({
                externalId: o.id,
                externalCustomerId: 'cust_razorpay',
                orderNumber: o.receipt || o.id,
                orderDate: new Date(o.created_at * 1000).toISOString(),
                orderStatus: o.status === 'paid' ? 'COMPLETED' : 'PENDING',
                currency: o.currency || 'INR',
                subtotal: (o.amount || 0) / 100,
                discountTotal: 0,
                shippingTotal: 0,
                taxTotal: 0,
                totalAmount: (o.amount || 0) / 100,
                items: [],
                updatedAt: new Date(o.created_at * 1000).toISOString()
            }));
            return { data: orders, limit: params.limit || 50, hasMore: false };
        });
    }
    getOrderItems(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            return [];
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
exports.RazorpayPaymentsConnector = RazorpayPaymentsConnector;
