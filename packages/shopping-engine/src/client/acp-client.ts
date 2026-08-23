/**
 * ACP Client - Interaction with ACP-enabled merchants
 *
 * Implements the Agentic Commerce Protocol (OpenAI/Stripe) checkout session
 * lifecycle: create, get, update, complete, cancel.
 *
 * ACP spec: https://github.com/agentic-commerce-protocol/agentic-commerce-protocol
 */

import type {
  AcpClientOptions,
  AcpCheckoutSession,
  AcpShippingAddress,
  AcpOrder,
  AcpErrorBody,
} from '../types/index.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_API_VERSION = '2026-01-30';

export class AcpClient {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly apiVersion: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(options: AcpClientOptions) {
    this.endpoint = options.endpoint.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.apiVersion = options.apiVersion ?? DEFAULT_API_VERSION;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Create a new checkout session.
   * POST /checkout_sessions
   *
   * Pass `idempotencyKey` (v0.9) to make this request safe to retry — the
   * merchant returns the original session on duplicate keys instead of
   * creating two checkouts.
   */
  async createCheckout(
    params: {
      line_items: Array<{
        product_id: string;
        quantity: number;
        variant_id?: string;
      }>;
      shipping_address?: AcpShippingAddress;
    },
    opts: { idempotencyKey?: string } = {}
  ): Promise<AcpCheckoutSession> {
    return this.request('POST', '/checkout_sessions', params, opts);
  }

  /**
   * Get an existing checkout session.
   * GET /checkout_sessions/:id
   */
  async getCheckout(sessionId: string): Promise<AcpCheckoutSession> {
    return this.request('GET', `/checkout_sessions/${sessionId}`);
  }

  /**
   * Update a checkout session (e.g., add shipping address, select payment handler).
   * POST /checkout_sessions/:id
   */
  async updateCheckout(
    sessionId: string,
    params: {
      shipping_address?: AcpShippingAddress;
      payment_handler?: string;
      discount_code?: string;
    },
    opts: { idempotencyKey?: string } = {}
  ): Promise<AcpCheckoutSession> {
    return this.request('POST', `/checkout_sessions/${sessionId}`, params, opts);
  }

  /**
   * Complete a checkout session with payment.
   * POST /checkout_sessions/:id/complete
   *
   * Strongly recommended to pass `idempotencyKey` here — completing a
   * checkout charges the buyer, so retries without a key risk double charges.
   */
  async completeCheckout(
    sessionId: string,
    params: {
      payment_token: string;
      payment_handler: string;
    },
    opts: { idempotencyKey?: string } = {}
  ): Promise<AcpCheckoutSession> {
    return this.request(
      'POST',
      `/checkout_sessions/${sessionId}/complete`,
      params,
      opts
    );
  }

  /**
   * Cancel a checkout session.
   * POST /checkout_sessions/:id/cancel
   */
  async cancelCheckout(
    sessionId: string,
    opts: { idempotencyKey?: string } = {}
  ): Promise<AcpCheckoutSession> {
    return this.request('POST', `/checkout_sessions/${sessionId}/cancel`, undefined, opts);
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
  async getOrder(orderId: string): Promise<AcpOrder> {
    return this.request('GET', `/orders/${orderId}`);
  }

  /**
   * List orders (agorio convention path `GET /orders` — see {@link getOrder}).
   * Returns the canonical `Order[]`.
   */
  async listOrders(params: { checkout_session_id?: string } = {}): Promise<AcpOrder[]> {
    const qs = params.checkout_session_id
      ? `?checkout_session_id=${encodeURIComponent(params.checkout_session_id)}`
      : '';
    const res = await this.request<{ orders: AcpOrder[] }>('GET', `/orders${qs}`);
    return res.orders ?? [];
  }

  /**
   * Get the configured endpoint URL.
   */
  getEndpoint(): string {
    return this.endpoint;
  }

  // ─── Internal ───

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts: { idempotencyKey?: string } = {}
  ): Promise<T> {
    const url = `${this.endpoint}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'API-Version': this.apiVersion,
      'Request-Id': `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
    if (opts.idempotencyKey) {
      headers['Idempotency-Key'] = opts.idempotencyKey;
    }

    try {
      const response = await this.fetchFn(url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const parsed = parseAcpError(errorBody);
        const detail = parsed ? ` (${parsed.type}/${parsed.code}: ${parsed.message})` : '';
        throw new AcpApiError(
          `ACP API call failed: ${method} ${path} → ${response.status}${detail}`,
          response.status,
          errorBody,
          parsed
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─── Error classes ───

/** Best-effort parse of an ACP structured error body. Returns null if not ACP-shaped. */
function parseAcpError(body: string): AcpErrorBody | undefined {
  if (!body) return undefined;
  try {
    const obj = JSON.parse(body);
    if (obj && typeof obj === 'object' && typeof obj.code === 'string' && typeof obj.type === 'string') {
      return {
        type: obj.type,
        code: obj.code,
        message: typeof obj.message === 'string' ? obj.message : '',
        ...(typeof obj.param === 'string' ? { param: obj.param } : {}),
      };
    }
  } catch {
    /* not JSON — fall through */
  }
  return undefined;
}

export class AcpApiError extends Error {
  /** Parsed structured error body, when the merchant returned the ACP error shape. */
  public readonly error?: AcpErrorBody;

  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string,
    error?: AcpErrorBody
  ) {
    super(message);
    this.name = 'AcpApiError';
    this.error = error;
  }

  /** Structured error category, if present (`invalid_request` | `processing_error` | `service_unavailable`). */
  get errorType(): string | undefined {
    return this.error?.type;
  }

  /** Implementation-defined error code, if present (e.g. `idempotency_conflict`). */
  get code(): string | undefined {
    return this.error?.code;
  }

  /** JSONPath of the offending field, if the merchant provided one. */
  get param(): string | undefined {
    return this.error?.param;
  }

  /** The session needs buyer authentication (HTTP 401/403, or an auth-flavoured code). */
  isAuthenticationRequired(): boolean {
    return (
      this.statusCode === 401 ||
      this.statusCode === 403 ||
      this.code === 'authentication_required' ||
      this.code === 'requires_signin'
    );
  }

  /** A duplicate idempotency key conflicted with an in-flight or prior request. */
  isIdempotencyConflict(): boolean {
    return this.code === 'idempotency_conflict' || this.code === 'idempotency_in_flight';
  }

  /** Payment was declined while completing the checkout (HTTP 402). */
  isPaymentDeclined(): boolean {
    return this.statusCode === 402 || this.code === 'payment_declined';
  }
}
