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
exports.LocalTestConnector = void 0;
const base_connector_1 = require("./base-connector");
/**
 * 🧪 Local Test Connector Implementation (LOCAL CONNECTOR TEST)
 * Connects to the local test server to validate real HTTP interactions,
 * pagination, rate-limiting retries, and delta syncs.
 */
class LocalTestConnector extends base_connector_1.BaseMerchantConnector {
    constructor(config) {
        super(config);
        this.provider = 'LOCAL_CONNECTOR_TEST';
        this.baseUrl = (config === null || config === void 0 ? void 0 : config.endpointUrl) || 'http://127.0.0.1:3899';
    }
    testConnection(config) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const targetUrl = (config === null || config === void 0 ? void 0 : config.endpointUrl) || this.baseUrl;
            const token = (config === null || config === void 0 ? void 0 : config.credentials.accessToken) || ((_a = this.config) === null || _a === void 0 ? void 0 : _a.credentials.accessToken);
            const start = Date.now();
            try {
                const res = yield this.httpClient.get(`${targetUrl}/api/v1/ping`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    timeout: 5000
                });
                return {
                    success: true,
                    provider: this.provider,
                    latencyMs: Date.now() - start,
                    message: 'Successfully established local connector test connection.',
                    serverVersion: res.data.version
                };
            }
            catch (err) {
                return {
                    success: false,
                    provider: this.provider,
                    latencyMs: Date.now() - start,
                    message: 'Local connector test connection failed.',
                    error: err.message
                };
            }
        });
    }
    getProducts(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = new URLSearchParams();
            if (params.page)
                query.append('page', String(params.page));
            if (params.limit)
                query.append('limit', String(params.limit));
            if (params.updatedSince)
                query.append('since', params.updatedSince.toISOString());
            const res = yield this.requestWithRetry({
                url: `${this.baseUrl}/api/v1/products?${query.toString()}`,
                method: 'GET'
            });
            return res.data;
        });
    }
    getCustomers(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = new URLSearchParams();
            if (params.page)
                query.append('page', String(params.page));
            if (params.limit)
                query.append('limit', String(params.limit));
            if (params.updatedSince)
                query.append('since', params.updatedSince.toISOString());
            const res = yield this.requestWithRetry({
                url: `${this.baseUrl}/api/v1/customers?${query.toString()}`,
                method: 'GET'
            });
            return res.data;
        });
    }
    getOrders(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = new URLSearchParams();
            if (params.page)
                query.append('page', String(params.page));
            if (params.limit)
                query.append('limit', String(params.limit));
            if (params.updatedSince)
                query.append('since', params.updatedSince.toISOString());
            const res = yield this.requestWithRetry({
                url: `${this.baseUrl}/api/v1/orders?${query.toString()}`,
                method: 'GET'
            });
            return res.data;
        });
    }
    getOrderItems(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.requestWithRetry({
                url: `${this.baseUrl}/api/v1/orders/${encodeURIComponent(orderId)}/items`,
                method: 'GET'
            });
            return res.data.data || [];
        });
    }
    getInventory(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = new URLSearchParams();
            if (params.page)
                query.append('page', String(params.page));
            if (params.limit)
                query.append('limit', String(params.limit));
            const res = yield this.requestWithRetry({
                url: `${this.baseUrl}/api/v1/inventory?${query.toString()}`,
                method: 'GET'
            });
            return res.data;
        });
    }
    getReturns(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = new URLSearchParams();
            if (params.page)
                query.append('page', String(params.page));
            if (params.limit)
                query.append('limit', String(params.limit));
            const res = yield this.requestWithRetry({
                url: `${this.baseUrl}/api/v1/returns?${query.toString()}`,
                method: 'GET'
            });
            return res.data;
        });
    }
    getPayments(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = new URLSearchParams();
            if (params.page)
                query.append('page', String(params.page));
            if (params.limit)
                query.append('limit', String(params.limit));
            const res = yield this.requestWithRetry({
                url: `${this.baseUrl}/api/v1/payments?${query.toString()}`,
                method: 'GET'
            });
            return res.data;
        });
    }
    syncIncremental(merchantId, since) {
        return __awaiter(this, void 0, void 0, function* () {
            const { liveSyncEngine } = yield Promise.resolve().then(() => __importStar(require('./live-sync-engine')));
            return liveSyncEngine.runIncrementalSync(this, merchantId, since);
        });
    }
}
exports.LocalTestConnector = LocalTestConnector;
