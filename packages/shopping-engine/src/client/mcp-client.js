"use strict";
/**
 * MCP Client - JSON-RPC 2.0 transport for MCP-enabled servers
 *
 * Two layers of API:
 *
 *  1. Generic JSON-RPC: `call(method, params)` / `notify(method, params)`.
 *     Works against any JSON-RPC 2.0 endpoint. Used by UCP's MCP-transport
 *     mapping and by the agorio commerce mock merchants.
 *
 *  2. MCP-spec methods (v0.9): `initialize()`, `listTools()`, `callTool(...)`,
 *     `listResources()`, `readResource(...)`, `listPrompts()`, `getPrompt(...)`.
 *     Lets the SDK talk to any standard MCP server (filesystem, GitHub, custom
 *     internal servers) without going through UCP discovery.
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
exports.McpError = exports.McpClient = exports.MCP_PROTOCOL_VERSION = void 0;
const DEFAULT_TIMEOUT_MS = 30000;
/** MCP protocol version this client speaks. */
exports.MCP_PROTOCOL_VERSION = '2025-06-18';
// ─── Client ───
class McpClient {
    constructor(options) {
        var _a, _b;
        this.requestId = 0;
        this.endpoint = options.endpoint;
        this.timeoutMs = (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_TIMEOUT_MS;
        this.fetchFn = (_b = options.fetch) !== null && _b !== void 0 ? _b : globalThis.fetch.bind(globalThis);
        this.headers = Object.assign({ 'Content-Type': 'application/json', 'Accept': 'application/json' }, options.headers);
    }
    /**
     * Send a JSON-RPC 2.0 request and return the result.
     */
    call(method, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const id = ++this.requestId;
            const body = {
                jsonrpc: '2.0',
                method,
                params: params !== null && params !== void 0 ? params : {},
                id,
            };
            const response = yield this.fetchWithTimeout(this.endpoint, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                throw new McpError(-32000, `MCP HTTP error: ${response.status} ${response.statusText}`, { method, httpStatus: response.status });
            }
            const json = (yield response.json());
            if ('error' in json && json.error) {
                throw new McpError(json.error.code, json.error.message, json.error.data);
            }
            return json.result;
        });
    }
    /**
     * Send a JSON-RPC 2.0 notification (no response expected).
     */
    notify(method, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const body = {
                jsonrpc: '2.0',
                method,
                params: params !== null && params !== void 0 ? params : {},
            };
            yield this.fetchWithTimeout(this.endpoint, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(body),
            });
        });
    }
    // ─── MCP spec methods (v0.9) ───
    /**
     * Perform the MCP lifecycle handshake. Servers reply with their
     * `protocolVersion`, `serverInfo`, and `capabilities`. Call once per session.
     * Per spec, follow with `notifyInitialized()`.
     */
    initialize(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const result = yield this.call('initialize', {
                protocolVersion: (_a = opts === null || opts === void 0 ? void 0 : opts.protocolVersion) !== null && _a !== void 0 ? _a : exports.MCP_PROTOCOL_VERSION,
                clientInfo: (_b = opts === null || opts === void 0 ? void 0 : opts.clientInfo) !== null && _b !== void 0 ? _b : { name: '@agorio/sdk', version: '0.9.0' },
                capabilities: (_c = opts === null || opts === void 0 ? void 0 : opts.capabilities) !== null && _c !== void 0 ? _c : {},
            });
            return result;
        });
    }
    /** Notify the server that initialization is complete. */
    notifyInitialized() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.notify('notifications/initialized');
        });
    }
    /** List the tools the server exposes. Supports cursor pagination. */
    listTools(cursor) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = {};
            if (cursor)
                params.cursor = cursor;
            return (yield this.call('tools/list', params));
        });
    }
    /** Invoke a tool by name with arbitrary JSON arguments. */
    callTool(name, args) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.call('tools/call', { name, arguments: args !== null && args !== void 0 ? args : {} }));
        });
    }
    /** List resources the server exposes. */
    listResources(cursor) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = {};
            if (cursor)
                params.cursor = cursor;
            return (yield this.call('resources/list', params));
        });
    }
    /** Read a resource by URI. */
    readResource(uri) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.call('resources/read', { uri }));
        });
    }
    /** List prompts the server exposes. */
    listPrompts(cursor) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = {};
            if (cursor)
                params.cursor = cursor;
            return (yield this.call('prompts/list', params));
        });
    }
    /** Materialize a prompt with the given arguments. */
    getPrompt(name, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = { name };
            if (args)
                params.arguments = args;
            return (yield this.call('prompts/get', params));
        });
    }
    /** Get the endpoint URL. */
    getEndpoint() {
        return this.endpoint;
    }
    fetchWithTimeout(url, init) {
        return __awaiter(this, void 0, void 0, function* () {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);
            try {
                return yield this.fetchFn(url, Object.assign(Object.assign({}, init), { signal: controller.signal }));
            }
            finally {
                clearTimeout(timer);
            }
        });
    }
}
exports.McpClient = McpClient;
// ─── Error class ───
class McpError extends Error {
    constructor(code, message, data) {
        super(message);
        this.code = code;
        this.data = data;
        this.name = 'McpError';
    }
}
exports.McpError = McpError;
