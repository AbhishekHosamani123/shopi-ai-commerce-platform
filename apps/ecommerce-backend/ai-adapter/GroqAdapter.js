"use strict";
/**
 * ⚡ Groq LLM Adapter for Shopi Shopping Agent
 *
 * Connects Shopi ShoppingAgent to Groq's high-speed inference API (Llama 3.3 70B, etc.)
 * with full function/tool calling support for autonomous commerce.
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
exports.GroqAdapter = void 0;
class GroqAdapter {
    constructor(options = {}) {
        var _a, _b;
        this.apiKey = options.apiKey || process.env.GROQ_API_KEY || '';
        this.modelName = options.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
        this.systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();
        this.temperature = (_a = options.temperature) !== null && _a !== void 0 ? _a : 0.2;
        this.maxTokens = (_b = options.maxTokens) !== null && _b !== void 0 ? _b : 2048;
        this.baseUrl = options.baseUrl || 'https://api.groq.com/openai/v1';
        this.customFetch = options.fetch || globalThis.fetch;
    }
    /**
     * Execute chat completion with Groq API
     */
    chat(messages, tools) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!this.apiKey) {
                throw new Error('GROQ_API_KEY is required to use GroqAdapter. Please configure GROQ_API_KEY in your environment variables.');
            }
            const groqMessages = this.toGroqMessages(messages);
            const groqTools = tools && tools.length > 0 ? this.toGroqTools(tools) : undefined;
            const payload = {
                model: this.modelName,
                messages: groqMessages,
                temperature: this.temperature,
                max_tokens: this.maxTokens,
            };
            if (groqTools && groqTools.length > 0) {
                payload.tools = groqTools;
                payload.tool_choice = 'auto';
            }
            const response = yield this.customFetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorText = yield response.text();
                let errorJson;
                try {
                    errorJson = JSON.parse(errorText);
                }
                catch (_b) {
                    errorJson = { error: { message: errorText } };
                }
                throw new Error(`Groq API Error (${response.status}): ${((_a = errorJson.error) === null || _a === void 0 ? void 0 : _a.message) || errorText}`);
            }
            const data = yield response.json();
            return this.parseResponse(data);
        });
    }
    /**
     * Convert ChatMessages into OpenAI/Groq compatible message objects
     */
    toGroqMessages(messages) {
        const groqMsgs = [
            { role: 'system', content: this.systemPrompt }
        ];
        for (const msg of messages) {
            if (msg.role === 'tool') {
                groqMsgs.push({
                    role: 'tool',
                    tool_call_id: msg.toolCallId || 'call_0',
                    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                });
            }
            else if (msg.role === 'assistant') {
                const assistantMsg = {
                    role: 'assistant',
                    content: msg.content || null,
                };
                if (msg.toolCalls && msg.toolCalls.length > 0) {
                    assistantMsg.tool_calls = msg.toolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
                        },
                    }));
                }
                groqMsgs.push(assistantMsg);
            }
            else if (msg.role === 'system') {
                groqMsgs.push({ role: 'system', content: msg.content });
            }
            else {
                groqMsgs.push({ role: 'user', content: msg.content });
            }
        }
        return groqMsgs;
    }
    /**
     * Convert ToolDefinitions into OpenAI/Groq tool format
     */
    toGroqTools(tools) {
        return tools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            },
        }));
    }
    /**
     * Parse Groq Chat Completion JSON Response
     */
    parseResponse(data) {
        var _a, _b, _c, _d, _e;
        const choice = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0];
        if (!choice) {
            return {
                content: 'I was unable to find product information for that request.',
                toolCalls: [],
                finishReason: 'error',
            };
        }
        const message = choice.message;
        const toolCalls = [];
        if (message.tool_calls && Array.isArray(message.tool_calls)) {
            for (const tc of message.tool_calls) {
                let parsedArgs = {};
                try {
                    parsedArgs = typeof ((_b = tc.function) === null || _b === void 0 ? void 0 : _b.arguments) === 'string'
                        ? JSON.parse(tc.function.arguments)
                        : ((_c = tc.function) === null || _c === void 0 ? void 0 : _c.arguments) || {};
                }
                catch (err) {
                    console.warn('[GroqAdapter] Failed to parse tool call arguments:', (_d = tc.function) === null || _d === void 0 ? void 0 : _d.arguments);
                }
                toolCalls.push({
                    id: tc.id || `call_${Math.random().toString(36).substring(2, 9)}`,
                    name: ((_e = tc.function) === null || _e === void 0 ? void 0 : _e.name) || '',
                    arguments: parsedArgs,
                });
            }
        }
        return {
            content: message.content || '',
            toolCalls,
            finishReason: choice.finish_reason === 'tool_calls' || toolCalls.length > 0 ? 'tool_calls' : 'stop',
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0,
            } : undefined,
        };
    }
    /**
     * Default system instructions for shopping intelligence & cart control
     */
    getDefaultSystemPrompt() {
        return `You are Shopi AI, the expert AI Shopping Assistant for Razorpay AI Commerce, an online storefront.
Your job is to help users discover products, inspect details, and control their real shopping cart.

TOOLS & CAPABILITIES:
1. search_products(query, limit): Search products by keyword, category, or price (e.g. "jacket under 3000", "running shoes").
2. browse_products(page, limit, category): Browse the catalog with pagination.
3. get_product(productId): Get complete product details by ID.
4. get_product_reviews(productId): Check ratings and customer reviews.
5. add_to_cart(productId, quantity): Add a product to the customer's real shopping cart.
6. remove_from_cart(productId): Remove a product from the shopping cart.
7. update_cart_quantity(productId, quantity): Change item quantity in the cart.
8. view_cart(): View the customer's current shopping cart items and total.

RULES:
1. When the user asks to add an item described in text (e.g. "Add the ₹2299 jacket", "Add the black jacket", "Add the cheapest one"), first search or inspect the catalog to find the exact real product ID, then call add_to_cart.
2. NEVER invent, fabricate, or hallucinate product IDs or names. Only use real products returned by tools.
3. All prices must be represented in Indian Rupees (INR / ₹).
4. When cart actions occur, confirm the action and summarize the current cart status in ₹ INR.`;
    }
}
exports.GroqAdapter = GroqAdapter;
