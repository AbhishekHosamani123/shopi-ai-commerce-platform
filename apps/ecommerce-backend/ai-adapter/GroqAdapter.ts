/**
 * ⚡ Groq LLM Adapter for Shopi Shopping Agent
 * 
 * Connects Shopi ShoppingAgent to Groq's high-speed inference API (Llama 3.3 70B, etc.)
 * with full function/tool calling support for autonomous commerce.
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmResponse {
  content: string;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LlmStreamChunk {
  type: 'text_delta' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_complete' | 'done';
  text?: string;
  toolCallId?: string;
  toolName?: string;
  argsDelta?: string;
  toolCall?: ToolCall;
  response?: LlmResponse;
}

export interface LlmAdapter {
  readonly modelName: string;
  chat(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<LlmResponse>;
  chatStream?(messages: ChatMessage[], tools?: ToolDefinition[]): AsyncGenerator<LlmStreamChunk>;
}

export interface GroqAdapterOptions {
  /** Groq API Key (defaults to process.env.GROQ_API_KEY) */
  apiKey?: string;
  /** Model name (default: llama-3.3-70b-versatile) */
  model?: string;
  /** System prompt for the model */
  systemPrompt?: string;
  /** Temperature (0-2, default: 0.2) */
  temperature?: number;
  /** Maximum tokens to generate (default: 2048) */
  maxTokens?: number;
  /** Base URL for Groq API (default: https://api.groq.com/openai/v1) */
  baseUrl?: string;
  /** Custom fetch implementation for testing */
  fetch?: typeof globalThis.fetch;
}

export class GroqAdapter implements LlmAdapter {
  private readonly apiKey: string;
  readonly modelName: string;
  private readonly systemPrompt: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly baseUrl: string;
  private readonly customFetch: typeof globalThis.fetch;

  constructor(options: GroqAdapterOptions = {}) {
    this.apiKey = options.apiKey || process.env.GROQ_API_KEY || '';
    this.modelName = options.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    this.systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();
    this.temperature = options.temperature ?? 0.2;
    this.maxTokens = options.maxTokens ?? 2048;
    this.baseUrl = options.baseUrl || 'https://api.groq.com/openai/v1';
    this.customFetch = options.fetch || globalThis.fetch;
  }

  /**
   * Execute chat completion with Groq API
   */
  async chat(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<LlmResponse> {
    if (!this.apiKey) {
      throw new Error(
        'GROQ_API_KEY is required to use GroqAdapter. Please configure GROQ_API_KEY in your environment variables.'
      );
    }

    const groqMessages = this.toGroqMessages(messages);
    const groqTools = tools && tools.length > 0 ? this.toGroqTools(tools) : undefined;

    const payload: Record<string, any> = {
      model: this.modelName,
      messages: groqMessages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    };

    if (groqTools && groqTools.length > 0) {
      payload.tools = groqTools;
      payload.tool_choice = 'auto';
    }

    const response = await this.customFetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: any;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { error: { message: errorText } };
      }
      throw new Error(
        `Groq API Error (${response.status}): ${errorJson.error?.message || errorText}`
      );
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  /**
   * Convert ChatMessages into OpenAI/Groq compatible message objects
   */
  private toGroqMessages(messages: ChatMessage[]): any[] {
    const groqMsgs: any[] = [
      { role: 'system', content: this.systemPrompt }
    ];

    for (const msg of messages) {
      if (msg.role === 'tool') {
        groqMsgs.push({
          role: 'tool',
          tool_call_id: msg.toolCallId || 'call_0',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        });
      } else if (msg.role === 'assistant') {
        const assistantMsg: any = {
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
      } else if (msg.role === 'system') {
        groqMsgs.push({ role: 'system', content: msg.content });
      } else {
        groqMsgs.push({ role: 'user', content: msg.content });
      }
    }

    return groqMsgs;
  }

  /**
   * Convert ToolDefinitions into OpenAI/Groq tool format
   */
  private toGroqTools(tools: ToolDefinition[]): any[] {
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
  private parseResponse(data: any): LlmResponse {
    const choice = data.choices?.[0];
    if (!choice) {
      return {
        content: 'I was unable to find product information for that request.',
        toolCalls: [],
        finishReason: 'error',
      };
    }

    const message = choice.message;
    const toolCalls: ToolCall[] = [];

    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = typeof tc.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function?.arguments || {};
        } catch (err) {
          console.warn('[GroqAdapter] Failed to parse tool call arguments:', tc.function?.arguments);
        }

        toolCalls.push({
          id: tc.id || `call_${Math.random().toString(36).substring(2, 9)}`,
          name: tc.function?.name || '',
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
  private getDefaultSystemPrompt(): string {
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
