"use strict";
/**
 * Shopping Agent Orchestrator
 *
 * The core agent loop: plan → act (tool call) → observe (tool result) → repeat.
 *
 * This orchestrates the LLM, UCP client, and tool execution to complete
 * shopping tasks like browsing products, adding to cart, and checking out.
 *
 * v0.4: Multi-merchant support — each discovered merchant gets its own
 * isolated context (cart, checkout, orders). The agent switches between
 * merchants via the `switch_merchant` tool or by discovering new ones.
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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShoppingAgent = void 0;
const ucp_client_js_1 = require("../client/ucp-client.js");
const acp_client_js_1 = require("../client/acp-client.js");
const woocommerce_js_1 = require("../adapters/woocommerce.js");
const tools_js_1 = require("../llm/tools.js");
const index_js_1 = require("../types/index.js");
const sub_agent_js_1 = require("./sub-agent.js");
const DEFAULT_MAX_ITERATIONS = 20;
class ShoppingAgent {
    constructor(options) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        this.steps = [];
        this.pluginsInitialized = false;
        this.iteration = 0;
        // Multi-merchant state
        this.merchants = new Map();
        this.activeMerchantDomain = null;
        // Legacy single-merchant state (for backward compatibility)
        this.protocol = null;
        this.acpBaseUrl = null;
        this.currentMessages = [];
        this.currentTask = null;
        this.hydrated = false;
        // Observability state
        this.runStartTime = 0;
        this.totalPromptTokens = 0;
        this.totalCompletionTokens = 0;
        this.llmCallCount = 0;
        this.toolCallCount = 0;
        this.toolCallLatency = {};
        // Shopping state (legacy — single-merchant backward compat)
        this.cart = [];
        this.checkoutSessionId = null;
        this.shippingAddress = null;
        this.orders = new Map();
        this.options = Object.assign(Object.assign({}, options), { maxIterations: (_a = options.maxIterations) !== null && _a !== void 0 ? _a : DEFAULT_MAX_ITERATIONS, verbose: (_b = options.verbose) !== null && _b !== void 0 ? _b : false });
        this.client = new ucp_client_js_1.UcpClient(options.clientOptions);
        this.acpClient = options.acpOptions
            ? new acp_client_js_1.AcpClient(options.acpOptions)
            : null;
        this.adapters = (_c = options.adapters) !== null && _c !== void 0 ? _c : [];
        this.webhookUrl = (_d = options.webhookUrl) !== null && _d !== void 0 ? _d : null;
        this.webhookSecret = (_e = options.webhookSecret) !== null && _e !== void 0 ? _e : null;
        this.sessionStorage = (_f = options.sessionStorage) !== null && _f !== void 0 ? _f : null;
        this.sessionId = (_g = options.sessionId) !== null && _g !== void 0 ? _g : null;
        this.sessionCustomerId = (_h = options.sessionCustomerId) !== null && _h !== void 0 ? _h : null;
        // Register plugins
        this.plugins = new Map();
        const builtInNames = new Set(tools_js_1.SHOPPING_AGENT_TOOLS.map(t => t.name));
        const pluginTools = [];
        for (const plugin of (_j = options.plugins) !== null && _j !== void 0 ? _j : []) {
            if (builtInNames.has(plugin.name)) {
                throw new Error(`Plugin "${plugin.name}" conflicts with a built-in tool. Choose a different name.`);
            }
            if (this.plugins.has(plugin.name)) {
                throw new Error(`Duplicate plugin name: "${plugin.name}". Each plugin must have a unique name.`);
            }
            this.plugins.set(plugin.name, plugin);
            pluginTools.push({
                name: plugin.name,
                description: plugin.description,
                parameters: plugin.parameters,
            });
        }
        // Register sub-agents
        this.subAgents = new Map();
        this.subAgentDepth = (_k = options._subAgentDepth) !== null && _k !== void 0 ? _k : 0;
        this.subAgentMaxDepth = (_l = options.subAgentMaxDepth) !== null && _l !== void 0 ? _l : sub_agent_js_1.DEFAULT_SUB_AGENT_MAX_DEPTH;
        const subAgentTools = [];
        for (const sub of (_m = options.subAgents) !== null && _m !== void 0 ? _m : []) {
            if (builtInNames.has(sub.name) || this.plugins.has(sub.name)) {
                throw new Error(`Sub-agent "${sub.name}" conflicts with an existing tool/plugin name.`);
            }
            if (this.subAgents.has(sub.name)) {
                throw new Error(`Duplicate sub-agent name: "${sub.name}".`);
            }
            this.subAgents.set(sub.name, sub);
        }
        if (this.subAgents.size > 0) {
            subAgentTools.push({
                name: 'invoke_sub_agent',
                description: 'Delegate a sub-task to a specialized sub-agent. Available sub-agents: ' +
                    [...this.subAgents.values()]
                        .map(s => `"${s.name}" — ${s.description}`)
                        .join('; ') +
                    '. Use this to break a complex task into focused stages (e.g., find-best-price → checkout → track-shipment).',
                parameters: {
                    type: 'object',
                    properties: {
                        sub_agent: {
                            type: 'string',
                            enum: [...this.subAgents.keys()],
                            description: 'Name of the sub-agent to invoke.',
                        },
                        input: {
                            type: 'string',
                            description: 'Task description for the sub-agent (natural language).',
                        },
                    },
                    required: ['sub_agent', 'input'],
                },
            });
        }
        this.allTools = [...tools_js_1.SHOPPING_AGENT_TOOLS, ...pluginTools, ...subAgentTools];
        this.pluginContext = {
            getCart: () => this.getCart(),
            getActiveMerchant: () => this.getActiveMerchant(),
            getCheckoutSessionId: () => this.getActiveCheckoutSessionId(),
            getMerchants: () => this.getMerchants(),
            getSteps: () => [...this.steps],
            getCurrentIteration: () => this.iteration,
        };
        for (const [, plugin] of this.plugins) {
            if ((0, index_js_1.isEnterprisePlugin)(plugin)) {
                if (plugin.onRegister) {
                    plugin.onRegister(this.pluginContext);
                }
                if (plugin.configure && ((_o = options.pluginConfigs) === null || _o === void 0 ? void 0 : _o[plugin.name])) {
                    plugin.configure(options.pluginConfigs[plugin.name]);
                }
            }
        }
    }
    /**
     * Run the agent with a user task.
     *
     * The agent will use the LLM to reason about the task, call tools
     * to interact with the UCP merchant, and return the final result.
     */
    run(task) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            this.resetMetrics();
            const runSpan = (_a = this.options.tracer) === null || _a === void 0 ? void 0 : _a.startSpan('agent.run', { task: task.slice(0, 100) });
            if (!this.pluginsInitialized) {
                for (const [, plugin] of this.plugins) {
                    if ((0, index_js_1.isEnterprisePlugin)(plugin) && plugin.onInit) {
                        yield plugin.onInit(this.pluginContext);
                    }
                }
                this.pluginsInitialized = true;
            }
            const resumed = yield this.tryHydrate();
            const messages = resumed
                ? this.currentMessages
                : [{ role: 'user', content: task }];
            this.currentTask = resumed ? (_b = this.currentTask) !== null && _b !== void 0 ? _b : task : task;
            this.currentMessages = messages;
            if (!resumed) {
                this.iteration = 0;
            }
            this.emitLog('info', resumed ? 'Agent run resumed' : 'Agent run started', {
                task: ((_c = this.currentTask) !== null && _c !== void 0 ? _c : task).slice(0, 200),
                iteration: this.iteration,
                sessionId: (_d = this.sessionId) !== null && _d !== void 0 ? _d : undefined,
            });
            while (this.iteration < this.options.maxIterations) {
                this.iteration++;
                // Ask the LLM what to do next
                const llmStart = Date.now();
                const llmSpan = (_e = this.options.tracer) === null || _e === void 0 ? void 0 : _e.startSpan('agent.llm_call', { iteration: this.iteration });
                const llmResponse = yield this.options.llm.chat(messages, this.allTools);
                const llmLatency = Date.now() - llmStart;
                llmSpan === null || llmSpan === void 0 ? void 0 : llmSpan.end();
                this.trackLlmUsage(llmResponse.usage, llmLatency);
                // Record thinking step
                if (llmResponse.content) {
                    const thinkingStep = this.recordStep({
                        type: 'thinking',
                        content: llmResponse.content,
                    });
                    this.log(`[Think] ${thinkingStep.content}`);
                }
                // If no tool calls, the agent is done
                if (llmResponse.finishReason === 'stop' || llmResponse.toolCalls.length === 0) {
                    this.emitLog('info', 'Agent run completed', { iterations: this.iteration, success: true });
                    runSpan === null || runSpan === void 0 ? void 0 : runSpan.end();
                    const result = this.buildResult(true, llmResponse.content);
                    yield ((_g = (_f = this.options).onComplete) === null || _g === void 0 ? void 0 : _g.call(_f, result));
                    return result;
                }
                // Add the assistant's response (with tool calls) to message history
                messages.push({
                    role: 'assistant',
                    content: llmResponse.content,
                    toolCalls: llmResponse.toolCalls,
                });
                // Execute each tool call
                for (const toolCall of llmResponse.toolCalls) {
                    this.recordStep({
                        type: 'tool_call',
                        toolName: toolCall.name,
                        toolInput: toolCall.arguments,
                    });
                    this.log(`[Tool] ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
                    const toolStart = Date.now();
                    const toolSpan = (_h = this.options.tracer) === null || _h === void 0 ? void 0 : _h.startSpan('agent.tool_call', { tool: toolCall.name });
                    let result;
                    try {
                        result = yield this.executeTool(toolCall);
                    }
                    catch (err) {
                        result = { error: err instanceof Error ? err.message : String(err) };
                        this.emitLog('warn', `Tool ${toolCall.name} failed`, { error: result.error });
                    }
                    const toolLatency = Date.now() - toolStart;
                    toolSpan === null || toolSpan === void 0 ? void 0 : toolSpan.end();
                    this.trackToolCall(toolCall.name, toolLatency);
                    this.recordStep({
                        type: 'tool_result',
                        toolName: toolCall.name,
                        toolOutput: result,
                    });
                    this.log(`[Result] ${JSON.stringify(result).slice(0, 200)}`);
                    this.emitLog('debug', `Tool ${toolCall.name} completed`, { latencyMs: toolLatency });
                    // Add tool result to message history
                    messages.push({
                        role: 'tool',
                        content: JSON.stringify(result),
                        toolCallId: toolCall.name,
                    });
                }
                yield this.persistSession();
            }
            // Max iterations reached
            this.emitLog('warn', 'Agent reached max iterations', { maxIterations: this.options.maxIterations });
            runSpan === null || runSpan === void 0 ? void 0 : runSpan.end();
            const result = this.buildResult(false, `Agent reached maximum iterations (${this.options.maxIterations}) without completing the task.`);
            yield ((_k = (_j = this.options).onComplete) === null || _k === void 0 ? void 0 : _k.call(_j, result));
            return result;
        });
    }
    /**
     * Run the agent with streaming output.
     *
     * Yields AgentStreamEvent objects as the agent reasons and acts.
     * If the LLM adapter supports chatStream(), text is streamed in real-time.
     * Otherwise, falls back to chat() and emits the full text as a single delta.
     */
    runStream(task) {
        return __asyncGenerator(this, arguments, function* runStream_1() {
            var _a, e_1, _b, _c;
            var _d, _e, _f, _g, _h, _j, _k, _l, _m;
            this.resetMetrics();
            const runSpan = (_d = this.options.tracer) === null || _d === void 0 ? void 0 : _d.startSpan('agent.runStream', { task: task.slice(0, 100) });
            if (!this.pluginsInitialized) {
                for (const [, plugin] of this.plugins) {
                    if ((0, index_js_1.isEnterprisePlugin)(plugin) && plugin.onInit) {
                        yield __await(plugin.onInit(this.pluginContext));
                    }
                }
                this.pluginsInitialized = true;
            }
            const messages = [
                { role: 'user', content: task },
            ];
            this.iteration = 0;
            const adapter = this.options.llm;
            const supportsStreaming = typeof adapter.chatStream === 'function';
            this.emitLog('info', 'Agent stream started', { task: task.slice(0, 200) });
            try {
                while (this.iteration < this.options.maxIterations) {
                    this.iteration++;
                    let textContent = '';
                    let toolCalls = [];
                    const llmStart = Date.now();
                    const llmSpan = (_e = this.options.tracer) === null || _e === void 0 ? void 0 : _e.startSpan('agent.llm_call', { iteration: this.iteration, streaming: supportsStreaming });
                    if (supportsStreaming) {
                        let streamUsage;
                        try {
                            for (var _o = true, _p = (e_1 = void 0, __asyncValues(adapter.chatStream(messages, this.allTools))), _q; _q = yield __await(_p.next()), _a = _q.done, !_a; _o = true) {
                                _c = _q.value;
                                _o = false;
                                const chunk = _c;
                                switch (chunk.type) {
                                    case 'text_delta':
                                        textContent += chunk.text;
                                        yield yield __await({
                                            type: 'text_delta',
                                            iteration: this.iteration,
                                            text: chunk.text,
                                            timestamp: Date.now(),
                                        });
                                        break;
                                    case 'tool_call_complete':
                                        toolCalls.push(chunk.toolCall);
                                        break;
                                    case 'done':
                                        textContent = chunk.response.content || textContent;
                                        toolCalls = chunk.response.toolCalls.length > 0
                                            ? chunk.response.toolCalls
                                            : toolCalls;
                                        streamUsage = chunk.response.usage;
                                        break;
                                }
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (!_o && !_a && (_b = _p.return)) yield __await(_b.call(_p));
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                        const llmLatency = Date.now() - llmStart;
                        llmSpan === null || llmSpan === void 0 ? void 0 : llmSpan.end();
                        this.trackLlmUsage(streamUsage, llmLatency);
                    }
                    else {
                        const response = yield __await(adapter.chat(messages, this.allTools));
                        const llmLatency = Date.now() - llmStart;
                        llmSpan === null || llmSpan === void 0 ? void 0 : llmSpan.end();
                        this.trackLlmUsage(response.usage, llmLatency);
                        textContent = response.content;
                        toolCalls = response.toolCalls;
                        if (textContent) {
                            yield yield __await({
                                type: 'text_delta',
                                iteration: this.iteration,
                                text: textContent,
                                timestamp: Date.now(),
                            });
                        }
                    }
                    // Record thinking step
                    if (textContent) {
                        this.recordStep({ type: 'thinking', content: textContent });
                        this.log(`[Think] ${textContent}`);
                    }
                    // If no tool calls, the agent is done
                    if (toolCalls.length === 0) {
                        this.emitLog('info', 'Agent stream completed', { iterations: this.iteration, success: true });
                        runSpan === null || runSpan === void 0 ? void 0 : runSpan.end();
                        const result = this.buildResult(true, textContent);
                        yield __await(((_g = (_f = this.options).onComplete) === null || _g === void 0 ? void 0 : _g.call(_f, result)));
                        yield yield __await({ type: 'done', result, iteration: this.iteration, timestamp: Date.now() });
                        return yield __await(void 0);
                    }
                    // Add assistant message to history
                    messages.push({
                        role: 'assistant',
                        content: textContent,
                        toolCalls,
                    });
                    // Execute each tool call
                    for (const toolCall of toolCalls) {
                        this.recordStep({
                            type: 'tool_call',
                            toolName: toolCall.name,
                            toolInput: toolCall.arguments,
                        });
                        this.log(`[Tool] ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
                        yield yield __await({
                            type: 'tool_call',
                            iteration: this.iteration,
                            toolName: toolCall.name,
                            toolInput: toolCall.arguments,
                            timestamp: Date.now(),
                        });
                        const toolStart = Date.now();
                        const toolSpan = (_h = this.options.tracer) === null || _h === void 0 ? void 0 : _h.startSpan('agent.tool_call', { tool: toolCall.name });
                        let result;
                        try {
                            result = yield __await(this.executeTool(toolCall));
                        }
                        catch (err) {
                            result = { error: err instanceof Error ? err.message : String(err) };
                            this.emitLog('warn', `Tool ${toolCall.name} failed`, { error: result.error });
                        }
                        const toolLatency = Date.now() - toolStart;
                        toolSpan === null || toolSpan === void 0 ? void 0 : toolSpan.end();
                        this.trackToolCall(toolCall.name, toolLatency);
                        this.recordStep({
                            type: 'tool_result',
                            toolName: toolCall.name,
                            toolOutput: result,
                        });
                        this.log(`[Result] ${JSON.stringify(result).slice(0, 200)}`);
                        this.emitLog('debug', `Tool ${toolCall.name} completed`, { latencyMs: toolLatency });
                        yield yield __await({
                            type: 'tool_result',
                            iteration: this.iteration,
                            toolName: toolCall.name,
                            toolOutput: result,
                            timestamp: Date.now(),
                        });
                        messages.push({
                            role: 'tool',
                            content: JSON.stringify(result),
                            toolCallId: toolCall.name,
                        });
                    }
                }
                // Max iterations reached
                this.emitLog('warn', 'Agent reached max iterations', { maxIterations: this.options.maxIterations });
                runSpan === null || runSpan === void 0 ? void 0 : runSpan.end();
                const result = this.buildResult(false, `Agent reached maximum iterations (${this.options.maxIterations}) without completing the task.`);
                yield __await(((_k = (_j = this.options).onComplete) === null || _k === void 0 ? void 0 : _k.call(_j, result)));
                yield yield __await({ type: 'done', result, iteration: this.iteration, timestamp: Date.now() });
            }
            catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                this.emitLog('error', 'Agent stream error', { error: errMsg });
                runSpan === null || runSpan === void 0 ? void 0 : runSpan.end();
                const result = this.buildResult(false, '', errMsg);
                yield __await(((_m = (_l = this.options).onComplete) === null || _m === void 0 ? void 0 : _m.call(_l, result)));
                yield yield __await({
                    type: 'error',
                    iteration: this.iteration,
                    error: errMsg,
                    timestamp: Date.now(),
                });
            }
        });
    }
    /**
     * Get the names of all registered plugins.
     */
    getPlugins() {
        return [...this.plugins.keys()];
    }
    /**
     * Get the current cart state (active merchant's cart).
     */
    getCart() {
        const ctx = this.getActiveMerchantContext();
        const cart = ctx ? ctx.cart : this.cart;
        return {
            items: [...cart],
            subtotal: this.calculateSubtotal(cart),
            itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
        };
    }
    /**
     * Get all discovered merchants.
     */
    getMerchants() {
        return [...this.merchants.keys()];
    }
    /**
     * Get the active merchant domain.
     */
    getActiveMerchant() {
        return this.activeMerchantDomain;
    }
    // ─── Multi-Merchant Helpers ───
    getActiveMerchantContext() {
        var _a;
        if (!this.activeMerchantDomain)
            return null;
        return (_a = this.merchants.get(this.activeMerchantDomain)) !== null && _a !== void 0 ? _a : null;
    }
    getActiveCart() {
        const ctx = this.getActiveMerchantContext();
        return ctx ? ctx.cart : this.cart;
    }
    setActiveCart(cart) {
        const ctx = this.getActiveMerchantContext();
        if (ctx) {
            ctx.cart = cart;
        }
        else {
            this.cart = cart;
        }
    }
    getActiveOrders() {
        const ctx = this.getActiveMerchantContext();
        return ctx ? ctx.orders : this.orders;
    }
    getActiveCheckoutSessionId() {
        const ctx = this.getActiveMerchantContext();
        return ctx ? ctx.checkoutSessionId : this.checkoutSessionId;
    }
    setActiveCheckoutSessionId(id) {
        const ctx = this.getActiveMerchantContext();
        if (ctx) {
            ctx.checkoutSessionId = id;
        }
        else {
            this.checkoutSessionId = id;
        }
    }
    getActiveShippingAddress() {
        const ctx = this.getActiveMerchantContext();
        return ctx ? ctx.shippingAddress : this.shippingAddress;
    }
    setActiveShippingAddress(address) {
        const ctx = this.getActiveMerchantContext();
        if (ctx) {
            ctx.shippingAddress = address;
        }
        else {
            this.shippingAddress = address;
        }
    }
    getActiveProtocol() {
        const ctx = this.getActiveMerchantContext();
        return ctx ? ctx.protocol : this.protocol;
    }
    getActiveAdapter() {
        var _a;
        return (_a = this.getActiveMerchantContext()) === null || _a === void 0 ? void 0 : _a.adapter;
    }
    /**
     * Find an adapter that matches a given domain.
     */
    findAdapterForDomain(domain) {
        const clean = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        for (const adapter of this.adapters) {
            if ('matchesDomain' in adapter && typeof adapter.matchesDomain === 'function') {
                if (adapter.matchesDomain(clean)) {
                    return adapter;
                }
            }
        }
        return undefined;
    }
    // ─── Tool Execution ───
    executeTool(toolCall) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = toolCall.arguments;
            for (const [, plugin] of this.plugins) {
                if ((0, index_js_1.isEnterprisePlugin)(plugin) && plugin.onBeforeToolCall) {
                    const decision = yield plugin.onBeforeToolCall(toolCall.name, args, this.pluginContext);
                    if (!decision.allow) {
                        this.emitLog('info', `Plugin blocked tool ${toolCall.name}`, { reason: decision.reason });
                        return { blocked: true, tool: toolCall.name, reason: decision.reason };
                    }
                    if (decision.modifiedArgs) {
                        Object.assign(args, decision.modifiedArgs);
                    }
                }
            }
            let result;
            switch (toolCall.name) {
                case 'discover_merchant':
                    result = yield this.toolDiscoverMerchant(args.domain);
                    break;
                case 'list_capabilities':
                    result = yield this.toolListCapabilities();
                    break;
                case 'browse_products':
                    result = yield this.toolBrowseProducts(args);
                    break;
                case 'search_products':
                    result = yield this.toolSearchProducts(args);
                    break;
                case 'get_product':
                    result = yield this.toolGetProduct(args.productId);
                    break;
                case 'add_to_cart':
                    result = yield this.toolAddToCart(args);
                    break;
                case 'view_cart':
                    result = yield this.toolViewCart();
                    break;
                case 'remove_from_cart':
                    result = yield this.toolRemoveFromCart(args.productId);
                    break;
                case 'initiate_checkout':
                    result = yield this.toolInitiateCheckout();
                    break;
                case 'submit_shipping':
                    result = yield this.toolSubmitShipping(args);
                    break;
                case 'submit_payment':
                    result = yield this.toolSubmitPayment(args);
                    break;
                case 'get_order_status':
                    result = yield this.toolGetOrderStatus(args.orderId);
                    break;
                case 'switch_merchant':
                    result = yield this.toolSwitchMerchant(args.domain);
                    break;
                case 'get_product_reviews':
                    result = yield this.toolGetProductReviews(args.productId, args.limit);
                    break;
                case 'apply_discount_code':
                    result = yield this.toolApplyDiscountCode(args.code);
                    break;
                case 'compare_prices':
                    result = yield this.toolComparePrices(args.query);
                    break;
                case 'subscribe_order_updates':
                    result = yield this.toolSubscribeOrderUpdates(args.orderId);
                    break;
                case 'invoke_sub_agent':
                    result = yield this.toolInvokeSubAgent(args.sub_agent, args.input);
                    break;
                default: {
                    const plugin = this.plugins.get(toolCall.name);
                    if (plugin) {
                        result = yield plugin.handler(args);
                    }
                    else {
                        result = { error: `Unknown tool: ${toolCall.name}` };
                    }
                }
            }
            for (const [, plugin] of this.plugins) {
                if ((0, index_js_1.isEnterprisePlugin)(plugin) && plugin.onAfterToolCall) {
                    yield plugin.onAfterToolCall(toolCall.name, args, result, this.pluginContext);
                }
            }
            return result;
        });
    }
    toolDiscoverMerchant(domain) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            // Check if an adapter matches this domain
            const adapter = this.findAdapterForDomain(domain);
            if (adapter) {
                try {
                    const discovery = yield adapter.discover(domain);
                    const ctx = {
                        domain: discovery.domain,
                        protocol: 'adapter',
                        adapter,
                        cart: [],
                        checkoutSessionId: null,
                        shippingAddress: null,
                        orders: new Map(),
                        discoveryInfo: discovery,
                    };
                    this.merchants.set(discovery.domain, ctx);
                    this.activeMerchantDomain = discovery.domain;
                    this.protocol = null; // Adapter handles routing
                    this.log(`[Discovery] Adapter (${adapter.adapterType}) connected to ${discovery.domain}`);
                    return {
                        domain: discovery.domain,
                        protocol: 'adapter',
                        adapterType: adapter.adapterType,
                        name: discovery.name,
                        capabilities: discovery.capabilities,
                    };
                }
                catch (err) {
                    this.emitLog('warn', `Adapter discovery failed for ${domain}`, {
                        error: err instanceof Error ? err.message : String(err),
                    });
                    // Fall through to UCP/ACP
                }
            }
            // Try UCP discovery
            try {
                const discovery = yield this.client.discover(domain);
                this.protocol = 'ucp';
                const ctx = {
                    domain: discovery.domain,
                    protocol: 'ucp',
                    cart: [],
                    checkoutSessionId: null,
                    shippingAddress: null,
                    orders: new Map(),
                    discoveryInfo: {
                        version: discovery.version,
                        capabilities: discovery.capabilities.map(c => c.name),
                    },
                };
                this.merchants.set(discovery.domain, ctx);
                this.activeMerchantDomain = discovery.domain;
                this.log(`[Discovery] UCP protocol detected for ${domain}`);
                return {
                    domain: discovery.domain,
                    protocol: 'ucp',
                    version: discovery.version,
                    capabilities: discovery.capabilities.map(c => c.name),
                    services: discovery.services.map(s => ({
                        name: s.name,
                        transports: Object.keys(s.transports).filter(t => s.transports[t]),
                    })),
                    paymentHandlers: discovery.paymentHandlers.map(h => ({
                        id: h.id,
                        name: h.name,
                    })),
                };
            }
            catch (_h) {
                // UCP discovery failed — try ACP if configured
            }
            if (this.acpClient) {
                // Derive product base URL from ACP endpoint or domain
                const acpEndpoint = this.acpClient.getEndpoint();
                this.acpBaseUrl = acpEndpoint;
                // Verify ACP merchant is reachable by hitting /health or /products
                try {
                    const fetchFn = (_b = (_a = this.options.clientOptions) === null || _a === void 0 ? void 0 : _a.fetch) !== null && _b !== void 0 ? _b : globalThis.fetch.bind(globalThis);
                    const res = yield fetchFn(`${this.acpBaseUrl}/health`);
                    if (res.ok) {
                        this.protocol = 'acp';
                        const info = yield res.json();
                        const ctx = {
                            domain,
                            protocol: 'acp',
                            cart: [],
                            checkoutSessionId: null,
                            shippingAddress: null,
                            orders: new Map(),
                        };
                        this.merchants.set(domain, ctx);
                        this.activeMerchantDomain = domain;
                        this.log(`[Discovery] ACP protocol detected for ${domain}`);
                        return {
                            domain,
                            protocol: 'acp',
                            version: '2026-01-30',
                            capabilities: ['checkout'],
                            merchant: (_c = info.merchant) !== null && _c !== void 0 ? _c : domain,
                            paymentHandlers: [{ type: 'stripe_shared_payment_token' }],
                        };
                    }
                }
                catch (_j) {
                    // ACP health check failed — try products endpoint
                }
                // Fallback: try product listing to confirm merchant is reachable
                try {
                    const fetchFn = (_e = (_d = this.options.clientOptions) === null || _d === void 0 ? void 0 : _d.fetch) !== null && _e !== void 0 ? _e : globalThis.fetch.bind(globalThis);
                    const res = yield fetchFn(`${this.acpBaseUrl}/products`);
                    if (res.ok) {
                        this.protocol = 'acp';
                        const ctx = {
                            domain,
                            protocol: 'acp',
                            cart: [],
                            checkoutSessionId: null,
                            shippingAddress: null,
                            orders: new Map(),
                        };
                        this.merchants.set(domain, ctx);
                        this.activeMerchantDomain = domain;
                        this.log(`[Discovery] ACP protocol detected for ${domain} (via products)`);
                        return {
                            domain,
                            protocol: 'acp',
                            version: '2026-01-30',
                            capabilities: ['checkout'],
                            paymentHandlers: [{ type: 'stripe_shared_payment_token' }],
                        };
                    }
                }
                catch (_k) {
                    // Both checks failed
                }
            }
            // Auto-detect WooCommerce via /wp-json/wc/v3 probe
            try {
                const fetchFn = (_g = (_f = this.options.clientOptions) === null || _f === void 0 ? void 0 : _f.fetch) !== null && _g !== void 0 ? _g : globalThis.fetch.bind(globalThis);
                const isWc = yield (0, woocommerce_js_1.isWooCommerceStore)(domain, fetchFn);
                if (isWc) {
                    const wcAdapter = new woocommerce_js_1.WooCommerceAdapter({ url: `https://${domain}`, fetch: fetchFn });
                    const discovery = yield wcAdapter.discover(domain);
                    const ctx = {
                        domain: discovery.domain,
                        protocol: 'adapter',
                        adapter: wcAdapter,
                        cart: [],
                        checkoutSessionId: null,
                        shippingAddress: null,
                        orders: new Map(),
                        discoveryInfo: discovery,
                    };
                    this.merchants.set(discovery.domain, ctx);
                    this.activeMerchantDomain = discovery.domain;
                    this.log(`[Discovery] WooCommerce auto-detected at ${domain}`);
                    return {
                        domain: discovery.domain,
                        protocol: 'adapter',
                        adapterType: 'woocommerce',
                        name: discovery.name,
                        capabilities: discovery.capabilities,
                    };
                }
            }
            catch (_l) {
                // WooCommerce probe failed — fall through to error
            }
            return { error: `Could not discover merchant at ${domain}. No UCP profile found and ACP is not configured.` };
        });
    }
    toolSwitchMerchant(domain) {
        const clean = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        // Try exact match first, then partial match
        let found = null;
        for (const key of this.merchants.keys()) {
            if (key === clean || key.includes(clean) || clean.includes(key)) {
                found = key;
                break;
            }
        }
        if (!found) {
            return {
                error: `Merchant "${domain}" has not been discovered yet. Call discover_merchant first.`,
                discoveredMerchants: [...this.merchants.keys()],
            };
        }
        this.activeMerchantDomain = found;
        const ctx = this.merchants.get(found);
        // Sync legacy state for UCP/ACP protocol handlers
        if (ctx.protocol === 'ucp') {
            this.protocol = 'ucp';
        }
        else if (ctx.protocol === 'acp') {
            this.protocol = 'acp';
        }
        return {
            success: true,
            activeMerchant: found,
            protocol: ctx.protocol,
            cartItems: ctx.cart.length,
        };
    }
    toolListCapabilities() {
        var _a;
        const activeProtocol = this.getActiveProtocol();
        if (activeProtocol === 'adapter') {
            const ctx = this.getActiveMerchantContext();
            const discovery = ctx === null || ctx === void 0 ? void 0 : ctx.discoveryInfo;
            return {
                capabilities: ((_a = discovery === null || discovery === void 0 ? void 0 : discovery.capabilities) !== null && _a !== void 0 ? _a : []).map(c => ({
                    name: c,
                    version: 'adapter',
                })),
            };
        }
        if (activeProtocol === 'acp') {
            return {
                capabilities: [
                    { name: 'acp.checkout', version: '2026-01-30' },
                ],
            };
        }
        const caps = this.client.getCapabilities();
        return {
            capabilities: caps.map(c => ({
                name: c.name,
                version: c.version,
                extends: c.extends,
            })),
        };
    }
    /**
     * Protocol-agnostic merchant API call.
     * Routes to adapter, UcpClient, or direct fetch depending on active merchant.
     */
    fetchMerchantApi(path, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            // Adapter route
            const activeAdapter = this.getActiveAdapter();
            if (activeAdapter) {
                // Route common paths through adapter methods
                if (path === '/products' || path.startsWith('/products?')) {
                    const result = yield activeAdapter.listProducts();
                    return { products: result.products, total: result.total };
                }
                if (path.startsWith('/products/search')) {
                    const qMatch = path.match(/[?&]q=([^&]*)/);
                    const q = qMatch ? decodeURIComponent(qMatch[1]) : '';
                    const result = yield activeAdapter.searchProducts(q);
                    return { products: result.products, total: result.total, query: q };
                }
                const productMatch = path.match(/^\/products\/(.+)$/);
                if (productMatch) {
                    return activeAdapter.getProduct(productMatch[1]);
                }
                throw new Error(`Adapter does not support path: ${path}`);
            }
            if (this.protocol === 'acp' && this.acpBaseUrl) {
                const url = `${this.acpBaseUrl}${path}`;
                const method = (_a = options === null || options === void 0 ? void 0 : options.method) !== null && _a !== void 0 ? _a : ((options === null || options === void 0 ? void 0 : options.body) ? 'POST' : 'GET');
                const fetchFn = (_c = (_b = this.options.clientOptions) === null || _b === void 0 ? void 0 : _b.fetch) !== null && _c !== void 0 ? _c : globalThis.fetch.bind(globalThis);
                const response = yield fetchFn(url, Object.assign({ method, headers: Object.assign({ Accept: 'application/json' }, ((options === null || options === void 0 ? void 0 : options.body) ? { 'Content-Type': 'application/json' } : {})) }, ((options === null || options === void 0 ? void 0 : options.body) ? { body: JSON.stringify(options.body) } : {})));
                if (!response.ok) {
                    const body = yield response.text().catch(() => '');
                    throw new Error(`ACP API: ${method} ${path} → ${response.status}: ${body}`);
                }
                return response.json();
            }
            return this.client.callApi(path, options);
        });
    }
    toolBrowseProducts(args) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const page = (_a = args.page) !== null && _a !== void 0 ? _a : 1;
            const limit = Math.min((_b = args.limit) !== null && _b !== void 0 ? _b : 10, 50);
            const category = args.category;
            try {
                // Use adapter directly if available
                const activeAdapter = this.getActiveAdapter();
                if (activeAdapter) {
                    const result = yield activeAdapter.listProducts({ page, limit, category });
                    return {
                        products: result.products.map(p => {
                            var _a;
                            return ({
                                id: p.id,
                                name: p.name,
                                price: p.price,
                                category: p.category,
                                inStock: (_a = p.inStock) !== null && _a !== void 0 ? _a : true,
                            });
                        }),
                        total: result.total,
                        page,
                        limit,
                    };
                }
                const result = yield this.fetchMerchantApi('/products', {
                    method: 'GET',
                });
                let products = ((_c = result.products) !== null && _c !== void 0 ? _c : result);
                if (category) {
                    products = products.filter(p => { var _a; return ((_a = p.category) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === category.toLowerCase(); });
                }
                const start = (page - 1) * limit;
                const paged = products.slice(start, start + limit);
                return {
                    products: paged.map(p => {
                        var _a;
                        return ({
                            id: p.id,
                            name: p.name,
                            price: p.price,
                            category: p.category,
                            inStock: (_a = p.inStock) !== null && _a !== void 0 ? _a : true,
                        });
                    }),
                    total: products.length,
                    page,
                    limit,
                };
            }
            catch (_d) {
                return { products: [], total: 0, page, limit };
            }
        });
    }
    toolSearchProducts(args) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const query = args.query.toLowerCase();
            const limit = Math.min((_a = args.limit) !== null && _a !== void 0 ? _a : 10, 50);
            try {
                // Use adapter directly if available
                const activeAdapter = this.getActiveAdapter();
                if (activeAdapter) {
                    const result = yield activeAdapter.searchProducts(query, limit);
                    return {
                        products: result.products.slice(0, limit).map(p => {
                            var _a;
                            return ({
                                id: p.id,
                                name: p.name,
                                price: p.price,
                                description: p.description,
                                inStock: (_a = p.inStock) !== null && _a !== void 0 ? _a : true,
                            });
                        }),
                        total: result.total,
                        query: args.query,
                    };
                }
                const result = yield this.fetchMerchantApi(`/products/search?q=${encodeURIComponent(query)}`);
                const products = ((_b = result.products) !== null && _b !== void 0 ? _b : result);
                return {
                    products: products.slice(0, limit).map(p => {
                        var _a;
                        return ({
                            id: p.id,
                            name: p.name,
                            price: p.price,
                            description: p.description,
                            inStock: (_a = p.inStock) !== null && _a !== void 0 ? _a : true,
                        });
                    }),
                    total: products.length,
                    query: args.query,
                };
            }
            catch (_d) {
                // Fallback: browse all and filter client-side
                try {
                    const result = yield this.fetchMerchantApi('/products');
                    const all = ((_c = result.products) !== null && _c !== void 0 ? _c : result);
                    const filtered = all.filter(p => {
                        var _a;
                        return p.name.toLowerCase().includes(query) ||
                            ((_a = p.description) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(query));
                    });
                    return {
                        products: filtered.slice(0, limit).map(p => {
                            var _a;
                            return ({
                                id: p.id,
                                name: p.name,
                                price: p.price,
                                description: p.description,
                                inStock: (_a = p.inStock) !== null && _a !== void 0 ? _a : true,
                            });
                        }),
                        total: filtered.length,
                        query: args.query,
                    };
                }
                catch (_e) {
                    return { products: [], total: 0, query: args.query };
                }
            }
        });
    }
    toolGetProduct(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const activeAdapter = this.getActiveAdapter();
            if (activeAdapter) {
                return activeAdapter.getProduct(productId);
            }
            const result = yield this.fetchMerchantApi(`/products/${productId}`);
            return result;
        });
    }
    /**
     * Add to cart with price enrichment.
     * Fetches the real product price from the merchant to fix the $0 placeholder bug.
     */
    toolAddToCart(args) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const productId = args.productId;
            const quantity = (_a = args.quantity) !== null && _a !== void 0 ? _a : 1;
            const cart = this.getActiveCart();
            const existing = cart.find(item => item.productId === productId);
            if (existing) {
                existing.quantity += quantity;
            }
            else {
                // Enrich cart item with real product data
                let name = productId;
                let price = { amount: '0', currency: 'USD' };
                try {
                    const product = yield this.toolGetProduct(productId);
                    if (product && product.name) {
                        name = product.name;
                    }
                    if (product && product.price) {
                        price = product.price;
                    }
                }
                catch (_b) {
                    // Product fetch failed — use placeholders
                    this.emitLog('warn', `Could not fetch product ${productId} for price enrichment`);
                }
                cart.push({
                    productId,
                    name,
                    quantity,
                    price,
                });
            }
            this.setActiveCart(cart);
            return {
                success: true,
                cart: this.getCart(),
            };
        });
    }
    toolViewCart() {
        return this.getCart();
    }
    toolRemoveFromCart(productId) {
        const cart = this.getActiveCart();
        const idx = cart.findIndex(item => item.productId === productId);
        if (idx === -1) {
            return { success: false, error: 'Item not found in cart' };
        }
        cart.splice(idx, 1);
        this.setActiveCart(cart);
        return { success: true, cart: this.getCart() };
    }
    toolInitiateCheckout() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const cart = this.getActiveCart();
            if (cart.length === 0) {
                return { error: 'Cart is empty. Add items before checking out.' };
            }
            const activeProtocol = this.getActiveProtocol();
            // Adapter checkout flow
            const activeAdapter = this.getActiveAdapter();
            if (activeAdapter && activeAdapter.createCheckout) {
                try {
                    const result = yield activeAdapter.createCheckout(cart);
                    this.setActiveCheckoutSessionId(result.sessionId);
                    return {
                        protocol: 'adapter',
                        sessionId: result.sessionId,
                        totals: result.totals,
                        shippingOptions: result.shippingOptions,
                        checkoutUrl: result.checkoutUrl,
                        requiredSteps: ['shipping', 'payment'],
                    };
                }
                catch (err) {
                    return {
                        error: `Adapter checkout failed: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
            }
            // ACP checkout flow
            if (activeProtocol === 'acp' && this.acpClient) {
                try {
                    const session = yield this.acpClient.createCheckout({
                        line_items: cart.map(item => ({
                            product_id: item.productId,
                            quantity: item.quantity,
                        })),
                    });
                    this.setActiveCheckoutSessionId(session.id);
                    return {
                        protocol: 'acp',
                        sessionId: session.id,
                        status: session.status,
                        lineItems: session.line_items,
                        totals: session.totals,
                        paymentHandlers: session.payment_handlers,
                        requiredSteps: session.status === 'not_ready_for_payment'
                            ? ['shipping', 'payment']
                            : ['payment'],
                    };
                }
                catch (err) {
                    return {
                        error: `ACP checkout failed: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
            }
            // UCP checkout flow
            if (!this.client.hasCapability('dev.ucp.shopping.checkout')) {
                return { error: 'Merchant does not support checkout capability.' };
            }
            try {
                const result = yield this.client.callApi('/checkout', {
                    method: 'POST',
                    body: { items: cart },
                });
                const data = result;
                this.setActiveCheckoutSessionId(((_a = data.sessionId) !== null && _a !== void 0 ? _a : data.id));
                return Object.assign({ protocol: 'ucp', sessionId: this.getActiveCheckoutSessionId(), items: cart, subtotal: this.calculateSubtotal(cart), requiredSteps: ['shipping', 'payment'] }, (data.shipping ? { shippingOptions: data.shipping } : {}));
            }
            catch (err) {
                return {
                    error: `Checkout failed: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        });
    }
    toolSubmitShipping(address) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.getActiveCheckoutSessionId()) {
                return { error: 'No active checkout session. Call initiate_checkout first.' };
            }
            this.setActiveShippingAddress(address);
            // ACP: update session with shipping address
            if (this.getActiveProtocol() === 'acp' && this.acpClient) {
                try {
                    const session = yield this.acpClient.updateCheckout(this.getActiveCheckoutSessionId(), {
                        shipping_address: {
                            name: address.name,
                            line1: address.line1,
                            line2: address.line2,
                            city: address.city,
                            state: address.state,
                            postal_code: address.postalCode,
                            country: address.country,
                        },
                    });
                    return {
                        success: true,
                        sessionId: session.id,
                        status: session.status,
                        totals: session.totals,
                        nextStep: 'payment',
                    };
                }
                catch (err) {
                    return {
                        error: `ACP shipping update failed: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
            }
            return {
                success: true,
                sessionId: this.getActiveCheckoutSessionId(),
                shippingAddress: address,
                nextStep: 'payment',
            };
        });
    }
    toolSubmitPayment(args) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const sessionId = this.getActiveCheckoutSessionId();
            if (!sessionId) {
                return { error: 'No active checkout session. Call initiate_checkout first.' };
            }
            const shippingAddress = this.getActiveShippingAddress();
            if (!shippingAddress) {
                return { error: 'Shipping address required before payment. Call submit_shipping first.' };
            }
            const paymentMethod = args.paymentMethod;
            const paymentToken = args.paymentToken;
            const cart = this.getActiveCart();
            const orders = this.getActiveOrders();
            // ACP payment flow
            if (this.getActiveProtocol() === 'acp' && this.acpClient) {
                try {
                    const session = yield this.acpClient.completeCheckout(sessionId, {
                        payment_token: paymentToken !== null && paymentToken !== void 0 ? paymentToken : 'tok_mock_success',
                        payment_handler: paymentMethod !== null && paymentMethod !== void 0 ? paymentMethod : 'stripe_shared_payment_token',
                    });
                    const orderId = `acp_${session.id}`;
                    const order = {
                        id: orderId,
                        status: 'confirmed',
                        items: [...cart],
                        subtotal: this.calculateSubtotal(cart),
                        total: this.calculateSubtotal(cart),
                        shippingAddress,
                        createdAt: new Date().toISOString(),
                    };
                    orders.set(orderId, order);
                    this.setActiveCart([]);
                    this.setActiveCheckoutSessionId(null);
                    this.setActiveShippingAddress(null);
                    return {
                        success: true,
                        orderId,
                        status: session.status,
                        protocol: 'acp',
                        order,
                    };
                }
                catch (err) {
                    return {
                        error: `ACP payment failed: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
            }
            // UCP payment flow
            try {
                const result = yield this.client.callApi('/checkout/complete', {
                    method: 'POST',
                    body: {
                        sessionId,
                        items: cart,
                        shippingAddress,
                        payment: {
                            method: paymentMethod,
                            token: paymentToken !== null && paymentToken !== void 0 ? paymentToken : 'tok_mock_success',
                        },
                    },
                });
                const data = result;
                const orderId = ((_b = (_a = data.orderId) !== null && _a !== void 0 ? _a : data.id) !== null && _b !== void 0 ? _b : `ord_${Date.now()}`);
                const order = {
                    id: orderId,
                    status: 'confirmed',
                    items: [...cart],
                    subtotal: this.calculateSubtotal(cart),
                    total: this.calculateSubtotal(cart),
                    shippingAddress,
                    createdAt: new Date().toISOString(),
                };
                orders.set(orderId, order);
                this.setActiveCart([]);
                this.setActiveCheckoutSessionId(null);
                this.setActiveShippingAddress(null);
                return {
                    success: true,
                    orderId,
                    status: 'confirmed',
                    order,
                };
            }
            catch (err) {
                return {
                    error: `Payment failed: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        });
    }
    toolGetOrderStatus(orderId) {
        // Search across all merchant contexts
        for (const ctx of this.merchants.values()) {
            const order = ctx.orders.get(orderId);
            if (order)
                return { order };
        }
        // Fall back to legacy orders
        const order = this.orders.get(orderId);
        if (!order) {
            return { error: `Order not found: ${orderId}` };
        }
        return { order };
    }
    // ─── New v0.4 Tools ───
    toolGetProductReviews(productId, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            const activeAdapter = this.getActiveAdapter();
            // Try adapter reviews if available
            if (activeAdapter && activeAdapter.getProductReviews) {
                try {
                    return yield activeAdapter.getProductReviews(productId, limit);
                }
                catch (err) {
                    return {
                        error: `Could not fetch reviews: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
            }
            // Try fetching from UCP/ACP merchant endpoint
            try {
                const result = yield this.fetchMerchantApi(`/products/${productId}/reviews`);
                return result;
            }
            catch (_a) {
                return {
                    productId,
                    averageRating: 0,
                    totalReviews: 0,
                    reviews: [],
                    note: 'Reviews not available for this merchant.',
                };
            }
        });
    }
    toolApplyDiscountCode(code) {
        return __awaiter(this, void 0, void 0, function* () {
            const sessionId = this.getActiveCheckoutSessionId();
            if (!sessionId) {
                return { error: 'No active checkout session. Initiate checkout first.' };
            }
            try {
                const result = yield this.fetchMerchantApi('/checkout/discount', {
                    method: 'POST',
                    body: { sessionId, code },
                });
                return result;
            }
            catch (err) {
                return {
                    error: `Could not apply discount code: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        });
    }
    toolComparePrices(query) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this.merchants.size < 2) {
                return {
                    error: 'Need at least 2 discovered merchants to compare prices. Discover more merchants first.',
                    discoveredMerchants: [...this.merchants.keys()],
                };
            }
            const results = [];
            // Save current active merchant
            const previousActive = this.activeMerchantDomain;
            for (const [domain, ctx] of this.merchants) {
                try {
                    // Switch to this merchant
                    this.activeMerchantDomain = domain;
                    if (ctx.protocol === 'ucp')
                        this.protocol = 'ucp';
                    else if (ctx.protocol === 'acp')
                        this.protocol = 'acp';
                    const searchResult = yield this.toolSearchProducts({ query, limit: 5 });
                    const products = (_a = searchResult.products) !== null && _a !== void 0 ? _a : [];
                    results.push({
                        merchant: domain,
                        protocol: ctx.protocol,
                        products,
                    });
                }
                catch (_b) {
                    results.push({
                        merchant: domain,
                        protocol: ctx.protocol,
                        products: [],
                    });
                }
            }
            // Restore previous active merchant
            this.activeMerchantDomain = previousActive;
            if (previousActive) {
                const prevCtx = this.merchants.get(previousActive);
                if ((prevCtx === null || prevCtx === void 0 ? void 0 : prevCtx.protocol) === 'ucp')
                    this.protocol = 'ucp';
                else if ((prevCtx === null || prevCtx === void 0 ? void 0 : prevCtx.protocol) === 'acp')
                    this.protocol = 'acp';
            }
            return {
                query,
                merchants: results,
                summary: `Compared "${query}" across ${results.length} merchants.`,
            };
        });
    }
    toolSubscribeOrderUpdates(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.webhookUrl) {
                return {
                    error: 'No webhook URL configured. Pass webhookUrl in AgentOptions to enable order update subscriptions.',
                };
            }
            // Find which merchant has this order
            let merchantDomain = null;
            for (const [domain, ctx] of this.merchants) {
                if (ctx.orders.has(orderId)) {
                    merchantDomain = domain;
                    break;
                }
            }
            if (!merchantDomain && this.orders.has(orderId)) {
                merchantDomain = this.activeMerchantDomain;
            }
            if (!merchantDomain) {
                return { error: `Order not found: ${orderId}` };
            }
            try {
                const result = yield this.fetchMerchantApi('/webhooks/subscribe', {
                    method: 'POST',
                    body: {
                        orderId,
                        callbackUrl: this.webhookUrl,
                        secret: this.webhookSecret,
                    },
                });
                return Object.assign({ subscribed: true, orderId,
                    merchantDomain }, result);
            }
            catch (err) {
                return {
                    error: `Failed to subscribe to order updates: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        });
    }
    // ─── Session persistence ───
    buildSnapshot() {
        var _a, _b;
        if (!this.sessionStorage || !this.sessionId)
            return null;
        const merchantStates = [...this.merchants.entries()].map(([domain, ctx]) => ({
            domain,
            protocol: ctx.protocol,
            cart: ctx.cart.map(item => (Object.assign({}, item))),
            checkoutSessionId: ctx.checkoutSessionId,
            shippingAddress: ctx.shippingAddress,
        }));
        const pluginState = {};
        for (const [name, plugin] of this.plugins) {
            if ((0, index_js_1.isEnterprisePlugin)(plugin) && plugin.getState) {
                try {
                    pluginState[name] = plugin.getState();
                }
                catch (err) {
                    this.emitLog('warn', `Plugin getState failed for ${name}`, {
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            }
        }
        return {
            sessionId: this.sessionId,
            task: (_a = this.currentTask) !== null && _a !== void 0 ? _a : '',
            iteration: this.iteration,
            messages: this.currentMessages,
            merchants: merchantStates,
            activeMerchantDomain: this.activeMerchantDomain,
            pluginState: Object.keys(pluginState).length > 0 ? pluginState : undefined,
            customerId: (_b = this.sessionCustomerId) !== null && _b !== void 0 ? _b : undefined,
            savedAt: new Date().toISOString(),
        };
    }
    persistSession() {
        return __awaiter(this, void 0, void 0, function* () {
            const snapshot = this.buildSnapshot();
            if (!snapshot || !this.sessionStorage)
                return;
            try {
                yield this.sessionStorage.save(snapshot);
            }
            catch (err) {
                this.emitLog('warn', 'Session save failed', {
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        });
    }
    tryHydrate() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.hydrated)
                return false;
            if (!this.sessionStorage || !this.sessionId)
                return false;
            let state = null;
            try {
                state = yield this.sessionStorage.load(this.sessionId);
            }
            catch (err) {
                this.emitLog('warn', 'Session load failed', {
                    error: err instanceof Error ? err.message : String(err),
                });
            }
            if (!state)
                return false;
            this.currentTask = state.task;
            this.currentMessages = state.messages;
            this.iteration = state.iteration;
            this.activeMerchantDomain = state.activeMerchantDomain;
            this.merchants = new Map();
            for (const m of state.merchants) {
                const adapter = m.protocol === 'adapter' ? this.findAdapterForDomain(m.domain) : undefined;
                this.merchants.set(m.domain, {
                    domain: m.domain,
                    protocol: m.protocol,
                    adapter,
                    cart: m.cart,
                    checkoutSessionId: m.checkoutSessionId,
                    shippingAddress: m.shippingAddress,
                    orders: new Map(),
                });
            }
            if (state.pluginState) {
                for (const [name, pluginSnap] of Object.entries(state.pluginState)) {
                    const plugin = this.plugins.get(name);
                    if (plugin && (0, index_js_1.isEnterprisePlugin)(plugin) && plugin.hydrate) {
                        try {
                            plugin.hydrate(pluginSnap);
                        }
                        catch (err) {
                            this.emitLog('warn', `Plugin hydrate failed for ${name}`, {
                                error: err instanceof Error ? err.message : String(err),
                            });
                        }
                    }
                }
            }
            this.hydrated = true;
            return true;
        });
    }
    toolInvokeSubAgent(subAgentName, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const subAgent = this.subAgents.get(subAgentName);
            if (!subAgent) {
                return { error: `Unknown sub-agent: ${subAgentName}` };
            }
            if (typeof input !== 'string' || input.length === 0) {
                return { error: 'invoke_sub_agent: "input" must be a non-empty string' };
            }
            try {
                const result = yield (0, sub_agent_js_1.runSubAgent)({
                    subAgent,
                    input,
                    parentTracer: this.options.tracer,
                    parentOnLog: this.options.onLog,
                    maxDepth: this.subAgentMaxDepth,
                    parentDepth: this.subAgentDepth,
                });
                return {
                    sub_agent: subAgentName,
                    success: result.success,
                    answer: result.answer,
                    iterations: result.iterations,
                    usage: result.usage,
                    error: result.error,
                };
            }
            catch (err) {
                return {
                    sub_agent: subAgentName,
                    success: false,
                    error: err instanceof Error ? err.message : String(err),
                };
            }
        });
    }
    // ─── Observability Helpers ───
    resetMetrics() {
        this.runStartTime = Date.now();
        this.totalPromptTokens = 0;
        this.totalCompletionTokens = 0;
        this.llmCallCount = 0;
        this.toolCallCount = 0;
        this.toolCallLatency = {};
    }
    trackLlmUsage(usage, latencyMs) {
        var _a, _b;
        this.llmCallCount++;
        if (usage) {
            this.totalPromptTokens += usage.promptTokens;
            this.totalCompletionTokens += usage.completionTokens;
        }
        this.emitLog('debug', 'LLM call completed', {
            latencyMs,
            promptTokens: (_a = usage === null || usage === void 0 ? void 0 : usage.promptTokens) !== null && _a !== void 0 ? _a : 0,
            completionTokens: (_b = usage === null || usage === void 0 ? void 0 : usage.completionTokens) !== null && _b !== void 0 ? _b : 0,
        });
    }
    trackToolCall(toolName, latencyMs) {
        this.toolCallCount++;
        if (!this.toolCallLatency[toolName]) {
            this.toolCallLatency[toolName] = [];
        }
        this.toolCallLatency[toolName].push(latencyMs);
    }
    buildUsageSummary() {
        return {
            totalTokens: this.totalPromptTokens + this.totalCompletionTokens,
            promptTokens: this.totalPromptTokens,
            completionTokens: this.totalCompletionTokens,
            llmCalls: this.llmCallCount,
            toolCalls: this.toolCallCount,
            toolCallLatency: Object.assign({}, this.toolCallLatency),
            totalLatencyMs: Date.now() - this.runStartTime,
        };
    }
    emitLog(level, message, data) {
        var _a, _b;
        (_b = (_a = this.options).onLog) === null || _b === void 0 ? void 0 : _b.call(_a, {
            level,
            message,
            data,
            timestamp: Date.now(),
        });
    }
    // ─── Helpers ───
    calculateSubtotal(cart) {
        var _a, _b;
        const items = cart !== null && cart !== void 0 ? cart : this.getActiveCart();
        let total = 0;
        for (const item of items) {
            total += parseFloat(item.price.amount) * item.quantity;
        }
        return {
            amount: total.toFixed(2),
            currency: (_b = (_a = items[0]) === null || _a === void 0 ? void 0 : _a.price.currency) !== null && _b !== void 0 ? _b : 'USD',
        };
    }
    recordStep(partial) {
        var _a, _b;
        const step = Object.assign(Object.assign({}, partial), { iteration: this.iteration, timestamp: Date.now() });
        this.steps.push(step);
        (_b = (_a = this.options).onStep) === null || _b === void 0 ? void 0 : _b.call(_a, step);
        return step;
    }
    buildResult(success, answer, error) {
        const discovery = (() => {
            // Check multi-merchant contexts first
            if (this.activeMerchantDomain) {
                const ctx = this.merchants.get(this.activeMerchantDomain);
                if ((ctx === null || ctx === void 0 ? void 0 : ctx.protocol) === 'adapter') {
                    return {
                        domain: ctx.domain,
                        profile: {
                            ucp: { version: 'adapter', services: {}, capabilities: [] },
                        },
                    };
                }
            }
            if (this.protocol === 'acp' && this.acpBaseUrl) {
                return {
                    domain: this.acpBaseUrl.replace(/^https?:\/\//, ''),
                    profile: {
                        ucp: { version: 'acp-2026-01-30', services: {}, capabilities: [] },
                    },
                };
            }
            try {
                const d = this.client.getDiscovery();
                return { domain: d.domain, profile: d.profile };
            }
            catch (_a) {
                return null;
            }
        })();
        // Gather orders from all merchant contexts + legacy
        const allOrders = [];
        for (const ctx of this.merchants.values()) {
            allOrders.push(...ctx.orders.values());
        }
        allOrders.push(...this.orders.values());
        const lastOrder = allOrders.pop();
        const checkout = lastOrder
            ? {
                orderId: lastOrder.id,
                status: lastOrder.status === 'confirmed' ? 'completed' : 'pending',
                items: lastOrder.items,
                total: lastOrder.total,
                paymentMethod: 'mock',
                fulfillment: {
                    method: 'standard',
                    estimatedDelivery: new Date(Date.now() + 5 * 86400000)
                        .toISOString()
                        .split('T')[0],
                },
            }
            : undefined;
        return {
            success,
            answer,
            steps: [...this.steps],
            iterations: this.iteration,
            merchant: discovery !== null && discovery !== void 0 ? discovery : undefined,
            checkout,
            usage: this.buildUsageSummary(),
            error,
        };
    }
    log(message) {
        if (this.options.verbose) {
            console.log(`[ShoppingAgent] ${message}`);
        }
    }
}
exports.ShoppingAgent = ShoppingAgent;
