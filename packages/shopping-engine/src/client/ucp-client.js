"use strict";
/**
 * UCP Client - Discovery and interaction with UCP-enabled merchants
 *
 * Handles:
 * - Profile discovery from /.well-known/ucp
 * - Capability normalization (array + object formats)
 * - Service enumeration and transport resolution
 * - REST API calls to merchant endpoints
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
exports.UcpApiError = exports.UcpDiscoveryError = exports.UcpClient = void 0;
const mcp_client_js_1 = require("./mcp-client.js");
const DEFAULT_TIMEOUT_MS = 30000;
const WELL_KNOWN_PATHS = ['/.well-known/ucp', '/.well-known/ucp.json'];
class UcpClient {
    constructor(options = {}) {
        var _a, _b, _c;
        this.discovery = null;
        this.mcpClient = null;
        this.timeoutMs = (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_TIMEOUT_MS;
        this.fetchFn = (_b = options.fetch) !== null && _b !== void 0 ? _b : globalThis.fetch.bind(globalThis);
        this.headers = Object.assign({ 'Accept': 'application/json', 'User-Agent': '@ucptools/agent-sdk/0.1.0' }, options.headers);
        this.preferredTransport = (_c = options.preferredTransport) !== null && _c !== void 0 ? _c : 'auto';
    }
    /**
     * Discover a UCP merchant by domain.
     * Fetches /.well-known/ucp, normalizes the profile, and caches the result.
     */
    discover(domain) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            // Preserve explicit protocol, default to https
            let baseUrl;
            let cleanDomain;
            if (domain.startsWith('http://') || domain.startsWith('https://')) {
                baseUrl = domain.replace(/\/+$/, '');
                cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
            }
            else {
                cleanDomain = domain.replace(/\/+$/, '');
                baseUrl = `https://${cleanDomain}`;
            }
            let profile = null;
            let profileUrl = '';
            // Try each well-known path; for non-explicit protocol also try http fallback
            const baseUrls = baseUrl.startsWith('http://')
                ? [baseUrl]
                : [baseUrl, baseUrl.replace('https://', 'http://')];
            for (const base of baseUrls) {
                for (const path of WELL_KNOWN_PATHS) {
                    const url = `${base}${path}`;
                    try {
                        const response = yield this.fetchWithTimeout(url);
                        if (response.ok) {
                            profile = (yield response.json());
                            profileUrl = url;
                            break;
                        }
                    }
                    catch (_e) {
                        // Try next path/protocol
                    }
                }
                if (profile)
                    break;
            }
            if (!profile) {
                throw new UcpDiscoveryError(`No UCP profile found at ${baseUrl}. Tried: ${WELL_KNOWN_PATHS.join(', ')}`);
            }
            if (!profile.ucp) {
                throw new UcpDiscoveryError('Invalid UCP profile: missing "ucp" root object');
            }
            const capabilities = this.normalizeCapabilities(profile);
            const services = this.normalizeServices(profile);
            const paymentHandlers = (_b = (_a = profile.payment) === null || _a === void 0 ? void 0 : _a.handlers) !== null && _b !== void 0 ? _b : [];
            const signingKeys = (_c = profile.signing_keys) !== null && _c !== void 0 ? _c : [];
            this.discovery = {
                profile,
                profileUrl,
                domain: cleanDomain,
                version: (_d = profile.ucp.version) !== null && _d !== void 0 ? _d : 'unknown',
                services,
                capabilities,
                paymentHandlers,
                signingKeys,
            };
            return this.discovery;
        });
    }
    /**
     * Get the cached discovery result, or throw if not yet discovered.
     */
    getDiscovery() {
        if (!this.discovery) {
            throw new Error('No discovery result. Call discover() first.');
        }
        return this.discovery;
    }
    /**
     * List all capabilities the merchant supports.
     */
    getCapabilities() {
        return this.getDiscovery().capabilities;
    }
    /**
     * Check if merchant supports a specific capability.
     */
    hasCapability(name) {
        return this.getDiscovery().capabilities.some(c => c.name === name);
    }
    /**
     * Get a specific capability by name.
     */
    getCapability(name) {
        return this.getDiscovery().capabilities.find(c => c.name === name);
    }
    /**
     * Get all services with their transports.
     */
    getServices() {
        return this.getDiscovery().services;
    }
    /**
     * Get the REST endpoint for a service.
     */
    getRestEndpoint(serviceName) {
        var _a;
        const services = this.getDiscovery().services;
        const service = serviceName
            ? services.find(s => s.name === serviceName)
            : services[0];
        return (_a = service === null || service === void 0 ? void 0 : service.transports.rest) === null || _a === void 0 ? void 0 : _a.endpoint;
    }
    /**
     * Get the MCP endpoint for a service.
     */
    getMcpEndpoint(serviceName) {
        var _a;
        const services = this.getDiscovery().services;
        const service = serviceName
            ? services.find(s => s.name === serviceName)
            : services[0];
        return (_a = service === null || service === void 0 ? void 0 : service.transports.mcp) === null || _a === void 0 ? void 0 : _a.endpoint;
    }
    /**
     * Get the A2A (agent-to-agent) agent card URL for a service. (v0.9)
     */
    getA2aEndpoint(serviceName) {
        var _a;
        const services = this.getDiscovery().services;
        const service = serviceName
            ? services.find(s => s.name === serviceName)
            : services[0];
        return (_a = service === null || service === void 0 ? void 0 : service.transports.a2a) === null || _a === void 0 ? void 0 : _a.agentCard;
    }
    /**
     * Get payment handlers.
     */
    getPaymentHandlers() {
        return this.getDiscovery().paymentHandlers;
    }
    /**
     * Get a single payment handler by id. (v0.9)
     *
     * Returned object includes `config`, `config_schema`, and
     * `instrument_schemas` so callers can introspect what the handler accepts.
     */
    getPaymentHandler(id) {
        return this.getDiscovery().paymentHandlers.find(h => h.id === id);
    }
    /**
     * Get all signing keys advertised in the profile. (v0.9)
     */
    getSigningKeys() {
        return this.getDiscovery().signingKeys;
    }
    /**
     * Look up a signing key by its `kid`. (v0.9)
     */
    getSigningKey(kid) {
        return this.getDiscovery().signingKeys.find(k => k.kid === kid);
    }
    /**
     * List capabilities whose `extends` field points at `parentName`. (v0.9)
     *
     * Useful for discovering extensions of a base capability — e.g., every
     * extension of `dev.ucp.shopping.checkout` that the merchant advertises.
     */
    getExtensionsOf(parentName) {
        return this.getDiscovery().capabilities.filter(c => c.extends === parentName);
    }
    /**
     * Walk the `extends` chain from a capability up to its base. (v0.9)
     *
     * Returns the chain ordered from the queried capability to the root. If a
     * capability is not found mid-chain, the walk stops and the partial chain
     * is returned. Loops are guarded.
     */
    getCapabilityLineage(name) {
        const caps = this.getDiscovery().capabilities;
        const lineage = [];
        const seen = new Set();
        let current = caps.find(c => c.name === name);
        while (current && !seen.has(current.name)) {
            seen.add(current.name);
            lineage.push(current);
            if (!current.extends)
                break;
            current = caps.find(c => c.name === current.extends);
        }
        return lineage;
    }
    /**
     * Make an API call to the merchant, using the preferred transport.
     *
     * Transport selection:
     * - 'auto' (default): tries MCP if available, falls back to REST
     * - 'rest': REST only
     * - 'mcp': MCP only (throws if unavailable)
     */
    callApi(path_1) {
        return __awaiter(this, arguments, void 0, function* (path, options = {}) {
            var _a, _b, _c;
            const transport = (_a = options.transport) !== null && _a !== void 0 ? _a : this.preferredTransport;
            const httpMethod = (_b = options.method) !== null && _b !== void 0 ? _b : (options.body ? 'POST' : 'GET');
            // Try MCP first if preferred or auto
            if (transport === 'mcp' || transport === 'auto') {
                const mcpEndpoint = this.getMcpEndpoint(options.serviceName);
                if (mcpEndpoint) {
                    try {
                        return yield this.callViaMcp(mcpEndpoint, path, httpMethod, options.body);
                    }
                    catch (err) {
                        // In auto mode, fall back to REST on MCP failure
                        if (transport === 'auto' && this.getRestEndpoint(options.serviceName)) {
                            // Fall through to REST
                        }
                        else {
                            throw err;
                        }
                    }
                }
                else if (transport === 'mcp') {
                    throw new Error('No MCP endpoint available. Discover the merchant first.');
                }
            }
            // REST transport
            const endpoint = this.getRestEndpoint(options.serviceName);
            if (!endpoint) {
                throw new Error('No REST endpoint available. Discover the merchant first.');
            }
            const url = `${endpoint}${path}`;
            const response = yield this.fetchWithTimeout(url, {
                method: httpMethod,
                headers: Object.assign(Object.assign({}, this.headers), (options.body ? { 'Content-Type': 'application/json' } : {})),
                body: options.body ? JSON.stringify(options.body) : undefined,
            });
            if (!response.ok) {
                const errorBody = yield response.text().catch(() => '');
                throw new UcpApiError(`API call failed: ${httpMethod} ${path} → ${response.status}`, response.status, errorBody);
            }
            const contentType = (_c = response.headers.get('content-type')) !== null && _c !== void 0 ? _c : '';
            if (contentType.includes('application/json')) {
                return response.json();
            }
            return response.text();
        });
    }
    /**
     * Make a direct JSON-RPC call via MCP transport.
     */
    callMcp(method, params, serviceName) {
        return __awaiter(this, void 0, void 0, function* () {
            const mcpEndpoint = this.getMcpEndpoint(serviceName);
            if (!mcpEndpoint) {
                throw new Error('No MCP endpoint available. Discover the merchant first.');
            }
            const client = this.getOrCreateMcpClient(mcpEndpoint);
            return client.call(method, params);
        });
    }
    /**
     * Fetch the OpenAPI schema for a service.
     */
    fetchSchema(serviceName) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const services = this.getDiscovery().services;
            const service = serviceName
                ? services.find(s => s.name === serviceName)
                : services[0];
            const schemaUrl = (_a = service === null || service === void 0 ? void 0 : service.transports.rest) === null || _a === void 0 ? void 0 : _a.schema;
            if (!schemaUrl) {
                throw new Error(`No REST schema URL for service: ${serviceName !== null && serviceName !== void 0 ? serviceName : 'default'}`);
            }
            const response = yield this.fetchWithTimeout(schemaUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch schema from ${schemaUrl}: ${response.status}`);
            }
            return response.json();
        });
    }
    // ─── Internal helpers ───
    fetchWithTimeout(url, init) {
        return __awaiter(this, void 0, void 0, function* () {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);
            try {
                return yield this.fetchFn(url, Object.assign(Object.assign({}, init), { headers: Object.assign(Object.assign({}, this.headers), init === null || init === void 0 ? void 0 : init.headers), signal: controller.signal }));
            }
            finally {
                clearTimeout(timer);
            }
        });
    }
    /**
     * Route a REST-style call through the MCP JSON-RPC transport.
     * Maps REST paths to JSON-RPC method names.
     */
    callViaMcp(mcpEndpoint, path, httpMethod, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.getOrCreateMcpClient(mcpEndpoint);
            const { method, params } = this.restPathToMcpCall(path, httpMethod, body);
            return client.call(method, params);
        });
    }
    /**
     * Map a REST path + method to a JSON-RPC method name + params.
     */
    restPathToMcpCall(path, httpMethod, body) {
        var _a;
        // Strip leading slash and query string for matching
        const [pathPart, queryString] = path.split('?');
        const cleanPath = pathPart.replace(/^\//, '');
        const queryParams = {};
        if (queryString) {
            for (const pair of queryString.split('&')) {
                const [key, value] = pair.split('=');
                queryParams[decodeURIComponent(key)] = decodeURIComponent(value !== null && value !== void 0 ? value : '');
            }
        }
        // products/search?q=X
        if (cleanPath === 'products/search') {
            return { method: 'products/search', params: Object.assign({}, queryParams) };
        }
        // products/:id
        const productMatch = cleanPath.match(/^products\/(.+)$/);
        if (productMatch && httpMethod === 'GET') {
            return { method: 'products/get', params: { id: productMatch[1] } };
        }
        // products (list)
        if (cleanPath === 'products' && httpMethod === 'GET') {
            return { method: 'products/list', params: Object.assign({}, queryParams) };
        }
        // checkout/complete
        if (cleanPath === 'checkout/complete' && httpMethod === 'POST') {
            return { method: 'checkout/complete', params: (body !== null && body !== void 0 ? body : {}) };
        }
        // checkout (create)
        if (cleanPath === 'checkout' && httpMethod === 'POST') {
            return { method: 'checkout/create', params: (body !== null && body !== void 0 ? body : {}) };
        }
        // orders/:id
        const orderMatch = cleanPath.match(/^orders\/(.+)$/);
        if (orderMatch && httpMethod === 'GET') {
            return { method: 'orders/get', params: { id: orderMatch[1] } };
        }
        // Fallback: use the path as the method name
        return {
            method: cleanPath.replace(/\//g, '/'),
            params: Object.assign(Object.assign({}, ((_a = body) !== null && _a !== void 0 ? _a : {})), queryParams),
        };
    }
    getOrCreateMcpClient(endpoint) {
        if (!this.mcpClient || this.mcpClient.getEndpoint() !== endpoint) {
            this.mcpClient = new mcp_client_js_1.McpClient({
                endpoint,
                timeoutMs: this.timeoutMs,
                fetch: this.fetchFn,
                headers: this.headers,
            });
        }
        return this.mcpClient;
    }
    /**
     * Normalize capabilities from both array and object-keyed formats.
     */
    normalizeCapabilities(profile) {
        var _a, _b;
        const caps = profile.ucp.capabilities;
        if (Array.isArray(caps)) {
            return caps.map(c => ({
                name: typeof c === 'string' ? c : c.name,
                version: typeof c === 'string' ? profile.ucp.version : c.version,
                spec: typeof c === 'string' ? '' : c.spec,
                schema: typeof c === 'string' ? '' : c.schema,
                extends: typeof c === 'string' ? undefined : c.extends,
                config: typeof c === 'string' ? undefined : c.config,
            }));
        }
        // Object-keyed format: { "dev.ucp.shopping.checkout": [{ version, spec, schema }] }
        const result = [];
        for (const [name, entries] of Object.entries(caps)) {
            for (const entry of entries) {
                result.push({
                    name,
                    version: entry.version,
                    spec: (_a = entry.spec) !== null && _a !== void 0 ? _a : '',
                    schema: (_b = entry.schema) !== null && _b !== void 0 ? _b : '',
                    extends: entry.extends,
                    config: entry.config,
                });
            }
        }
        return result;
    }
    /**
     * Normalize services from the profile into a flat array.
     */
    normalizeServices(profile) {
        const result = [];
        for (const [name, serviceOrArray] of Object.entries(profile.ucp.services)) {
            const services = Array.isArray(serviceOrArray) ? serviceOrArray : [serviceOrArray];
            for (const svc of services) {
                result.push({
                    name,
                    version: svc.version,
                    spec: svc.spec,
                    transports: {
                        rest: svc.rest,
                        mcp: svc.mcp,
                        a2a: svc.a2a,
                    },
                });
            }
        }
        return result;
    }
}
exports.UcpClient = UcpClient;
// ─── Error classes ───
class UcpDiscoveryError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UcpDiscoveryError';
    }
}
exports.UcpDiscoveryError = UcpDiscoveryError;
class UcpApiError extends Error {
    constructor(message, statusCode, responseBody) {
        super(message);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
        this.name = 'UcpApiError';
    }
}
exports.UcpApiError = UcpApiError;
