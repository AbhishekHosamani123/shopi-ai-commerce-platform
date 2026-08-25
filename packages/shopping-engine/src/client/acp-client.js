"use strict";
/**
 * ACP Client - Interaction with ACP-enabled merchants
 *
 * Implements the Agentic Commerce Protocol (OpenAI/Stripe) checkout session
 * lifecycle: create, get, update, complete, cancel.
 *
 * ACP spec: https://github.com/agentic-commerce-protocol/agentic-commerce-protocol
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
exports.AcpApiError = exports.AcpClient = void 0;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_API_VERSION = '2026-01-30';
class AcpClient {
    constructor(options) {
        var _a, _b, _c;
        this.endpoint = options.endpoint.replace(/\/+$/, '');
        this.apiKey = options.apiKey;
        this.apiVersion = (_a = options.apiVersion) !== null && _a !== void 0 ? _a : DEFAULT_API_VERSION;
        this.timeoutMs = (_b = options.timeoutMs) !== null && _b !== void 0 ? _b : DEFAULT_TIMEOUT_MS;
        this.fetchFn = (_c = options.fetch) !== null && _c !== void 0 ? _c : globalThis.fetch.bind(globalThis);
    }
    /**
     * Create a new checkout session.
     * POST /checkout_sessions
     *
     * Pass `idempotencyKey` (v0.9) to make this request safe to retry — the
     * merchant returns the original session on duplicate keys instead of
     * creating two checkouts.
     */
    createCheckout(params_1) {
        return __awaiter(this, arguments, void 0, function* (params, opts = {}) {
            return this.request('POST', '/checkout_sessions', params, opts);
        });
    }
    /**
     * Get an existing checkout session.
     * GET /checkout_sessions/:id
     */
    getCheckout(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('GET', `/checkout_sessions/${sessionId}`);
        });
    }
    /**
     * Update a checkout session (e.g., add shipping address, select payment handler).
     * POST /checkout_sessions/:id
     */
    updateCheckout(sessionId_1, params_1) {
        return __awaiter(this, arguments, void 0, function* (sessionId, params, opts = {}) {
            return this.request('POST', `/checkout_sessions/${sessionId}`, params, opts);
        });
    }
    /**
     * Complete a checkout session with payment.
     * POST /checkout_sessions/:id/complete
     *
     * Strongly recommended to pass `idempotencyKey` here — completing a
     * checkout charges the buyer, so retries without a key risk double charges.
     */
    completeCheckout(sessionId_1, params_1) {
        return __awaiter(this, arguments, void 0, function* (sessionId, params, opts = {}) {
            return this.request('POST', `/checkout_sessions/${sessionId}/complete`, params, opts);
        });
    }
    /**
     * Cancel a checkout session.
     * POST /checkout_sessions/:id/cancel
     */
    cancelCheckout(sessionId_1) {
        return __awaiter(this, arguments, void 0, function* (sessionId, opts = {}) {
            return this.request('POST', `/checkout_sessions/${sessionId}/cancel`, undefined, opts);
        });
    }
    /**
     * Fetch a completed order by id.
     *
     * NOTE: ACP defines no canonical order-pull endpoint — orders are delivered via
     * the `order_create` / `order_update` webhook (see ADR 0009 and
     * {@link ./acp-order-events.ts}). This method targets the agorio **convention**
     * path `GET /orders/{id}` and returns the **canonical** `Order` shape. Use it to
     * reconcile a missed webhook; prefer webhook ingestion as the primary path.
     */
    getOrder(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('GET', `/orders/${orderId}`);
        });
    }
    /**
     * List orders (agorio convention path `GET /orders` — see {@link getOrder}).
     * Returns the canonical `Order[]`.
     */
    listOrders() {
        return __awaiter(this, arguments, void 0, function* (params = {}) {
            var _a;
            const qs = params.checkout_session_id
                ? `?checkout_session_id=${encodeURIComponent(params.checkout_session_id)}`
                : '';
            const res = yield this.request('GET', `/orders${qs}`);
            return (_a = res.orders) !== null && _a !== void 0 ? _a : [];
        });
    }
    /**
     * Get the configured endpoint URL.
     */
    getEndpoint() {
        return this.endpoint;
    }
    // ─── Internal ───
    request(method_1, path_1, body_1) {
        return __awaiter(this, arguments, void 0, function* (method, path, body, opts = {}) {
            const url = `${this.endpoint}${path}`;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);
            const headers = {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'API-Version': this.apiVersion,
                'Request-Id': `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            };
            if (opts.idempotencyKey) {
                headers['Idempotency-Key'] = opts.idempotencyKey;
            }
            try {
                const response = yield this.fetchFn(url, Object.assign(Object.assign({ method,
                    headers }, (body ? { body: JSON.stringify(body) } : {})), { signal: controller.signal }));
                if (!response.ok) {
                    const errorBody = yield response.text().catch(() => '');
                    const parsed = parseAcpError(errorBody);
                    const detail = parsed ? ` (${parsed.type}/${parsed.code}: ${parsed.message})` : '';
                    throw new AcpApiError(`ACP API call failed: ${method} ${path} → ${response.status}${detail}`, response.status, errorBody, parsed);
                }
                return (yield response.json());
            }
            finally {
                clearTimeout(timer);
            }
        });
    }
}
exports.AcpClient = AcpClient;
// ─── Error classes ───
/** Best-effort parse of an ACP structured error body. Returns null if not ACP-shaped. */
function parseAcpError(body) {
    if (!body)
        return undefined;
    try {
        const obj = JSON.parse(body);
        if (obj && typeof obj === 'object' && typeof obj.code === 'string' && typeof obj.type === 'string') {
            return Object.assign({ type: obj.type, code: obj.code, message: typeof obj.message === 'string' ? obj.message : '' }, (typeof obj.param === 'string' ? { param: obj.param } : {}));
        }
    }
    catch (_a) {
        /* not JSON — fall through */
    }
    return undefined;
}
class AcpApiError extends Error {
    constructor(message, statusCode, responseBody, error) {
        super(message);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
        this.name = 'AcpApiError';
        this.error = error;
    }
    /** Structured error category, if present (`invalid_request` | `processing_error` | `service_unavailable`). */
    get errorType() {
        var _a;
        return (_a = this.error) === null || _a === void 0 ? void 0 : _a.type;
    }
    /** Implementation-defined error code, if present (e.g. `idempotency_conflict`). */
    get code() {
        var _a;
        return (_a = this.error) === null || _a === void 0 ? void 0 : _a.code;
    }
    /** JSONPath of the offending field, if the merchant provided one. */
    get param() {
        var _a;
        return (_a = this.error) === null || _a === void 0 ? void 0 : _a.param;
    }
    /** The session needs buyer authentication (HTTP 401/403, or an auth-flavoured code). */
    isAuthenticationRequired() {
        return (this.statusCode === 401 ||
            this.statusCode === 403 ||
            this.code === 'authentication_required' ||
            this.code === 'requires_signin');
    }
    /** A duplicate idempotency key conflicted with an in-flight or prior request. */
    isIdempotencyConflict() {
        return this.code === 'idempotency_conflict' || this.code === 'idempotency_in_flight';
    }
    /** Payment was declined while completing the checkout (HTTP 402). */
    isPaymentDeclined() {
        return this.statusCode === 402 || this.code === 'payment_declined';
    }
}
exports.AcpApiError = AcpApiError;
