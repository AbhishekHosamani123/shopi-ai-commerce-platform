/**
 * Mock ACP Merchant Server
 *
 * A mock merchant implementing the Agentic Commerce Protocol (ACP) for testing.
 * Serves ACP checkout session endpoints and product browsing endpoints.
 *
 * ACP endpoints:
 *   POST   /checkout_sessions              - Create checkout
 *   GET    /checkout_sessions/:id          - Get session
 *   POST   /checkout_sessions/:id          - Update session
 *   POST   /checkout_sessions/:id/complete - Complete with payment
 *   POST   /checkout_sessions/:id/cancel   - Cancel session
 *
 * Product endpoints (for agent browsing):
 *   GET    /products                       - List products
 *   GET    /products/search?q=...          - Search products
 *   GET    /products/:id                   - Get product
 */

import type { Server } from 'node:http';
import type {
  MockAcpMerchantOptions,
  MockProduct,
  AcpCheckoutSession,
  AcpCheckoutStatus,
  AcpLineItem,
  AcpMoney,
  AcpShippingAddress,
  AcpOrder,
  AcpOrderEvent,
  AcpFulfillment,
} from '../types/index.js';
import { DEFAULT_PRODUCTS } from './fixtures.js';
import { buildMerchantSignatureHeader } from '../client/acp-order-events.js';

interface AcpSessionState {
  session: AcpCheckoutSession;
  productIds: string[];
}

export class MockAcpMerchant {
  private server: Server | null = null;
  private port: number;
  private readonly name: string;
  private readonly products: MockProduct[];
  private readonly apiKey: string;
  private readonly webhookSecret: string;

  // Server-side state
  private sessions: Map<string, AcpSessionState> = new Map();
  private orders: Map<string, AcpOrder> = new Map();

  constructor(options: MockAcpMerchantOptions = {}) {
    this.port = options.port ?? 0;
    this.name = options.name ?? 'Mock ACP Merchant';
    this.products = options.products ?? DEFAULT_PRODUCTS;
    this.apiKey = options.apiKey ?? 'test_acp_key';
    this.webhookSecret = options.webhookSecret ?? 'test_webhook_secret';
  }

  async start(): Promise<void> {
    const { default: express } = await import('express');
    const app = express();
    app.use(express.json());

    // ─── Bearer Token Auth (for ACP endpoints) ───
    const authMiddleware = (
      req: import('express').Request,
      res: import('express').Response,
      next: import('express').NextFunction
    ) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== this.apiKey) {
        res.status(401).json({ error: 'Unauthorized: invalid or missing Bearer token' });
        return;
      }
      next();
    };

    // ─── Product API (no auth required — public catalog) ───

    app.get('/products', (_req, res) => {
      let filtered = [...this.products];
      const category = _req.query.category as string | undefined;
      if (category) {
        filtered = filtered.filter(
          p => p.category?.toLowerCase() === category.toLowerCase()
        );
      }
      res.json({ products: filtered, total: filtered.length });
    });

    app.get('/products/search', (req, res) => {
      const q = ((req.query.q as string) ?? '').toLowerCase();
      const filtered = this.products.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.category?.toLowerCase().includes(q) ?? false)
      );
      res.json({ products: filtered, total: filtered.length, query: q });
    });

    app.get('/products/:id', (req, res) => {
      const product = this.products.find(p => p.id === req.params.id);
      if (!product) {
        res.status(404).json({ error: `Product not found: ${req.params.id}` });
        return;
      }
      res.json(product);
    });

    // ─── ACP Checkout Endpoints (auth required) ───

    // POST /checkout_sessions — Create
    app.post('/checkout_sessions', authMiddleware, (req, res) => {
      const lineItemRequests = req.body.line_items as Array<{
        product_id: string;
        quantity: number;
        variant_id?: string;
      }> | undefined;

      if (!lineItemRequests || lineItemRequests.length === 0) {
        res.status(400).json({ error: 'line_items is required and must not be empty' });
        return;
      }

      const lineItems: AcpLineItem[] = [];
      const productIds: string[] = [];

      for (const item of lineItemRequests) {
        const product = this.products.find(p => p.id === item.product_id);
        if (!product) {
          res.status(400).json({ error: `Product not found: ${item.product_id}` });
          return;
        }

        const unitPriceCents = this.dollarsToCents(product.price.amount);
        lineItems.push({
          id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: product.name,
          quantity: item.quantity,
          unit_price: { amount: unitPriceCents, currency: product.price.currency },
          total_price: { amount: unitPriceCents * item.quantity, currency: product.price.currency },
        });
        productIds.push(product.id);
      }

      const subtotal = lineItems.reduce((sum, li) => sum + li.total_price.amount, 0);
      const currency = lineItems[0].unit_price.currency;

      const sessionId = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const status: AcpCheckoutStatus = req.body.shipping_address
        ? 'ready_for_payment'
        : 'not_ready_for_payment';

      const session: AcpCheckoutSession = {
        id: sessionId,
        status,
        line_items: lineItems,
        totals: {
          subtotal: { amount: subtotal, currency },
          total: { amount: subtotal, currency },
        },
        payment_handlers: [
          {
            type: 'stripe_shared_payment_token',
            handler_spec: {
              version: '2026-01-30',
              supported_currencies: ['usd', 'eur', 'gbp'],
            },
          },
        ],
        links: {
          terms_of_use: `${this.baseUrl}/terms`,
          privacy_policy: `${this.baseUrl}/privacy`,
          return_policy: `${this.baseUrl}/returns`,
        },
        ...(req.body.shipping_address ? { shipping_address: req.body.shipping_address } : {}),
      };

      this.sessions.set(sessionId, { session, productIds });
      res.status(201).json(session);
    });

    // GET /checkout_sessions/:id — Get
    app.get('/checkout_sessions/:id', authMiddleware, (req, res) => {
      const state = this.sessions.get(req.params.id as string);
      if (!state) {
        res.status(404).json({ error: `Checkout session not found: ${req.params.id}` });
        return;
      }
      res.json(state.session);
    });

    // POST /checkout_sessions/:id — Update
    app.post('/checkout_sessions/:id', authMiddleware, (req, res) => {
      // Avoid matching /complete and /cancel routes
      if (req.params.id.includes('/')) {
        res.status(404).json({ error: 'Not found' });
        return;
      }

      const state = this.sessions.get(req.params.id as string);
      if (!state) {
        res.status(404).json({ error: `Checkout session not found: ${req.params.id}` });
        return;
      }

      if (state.session.status === 'completed' || state.session.status === 'canceled') {
        res.status(400).json({ error: `Cannot update session in ${state.session.status} state` });
        return;
      }

      if (req.body.shipping_address) {
        state.session.shipping_address = req.body.shipping_address as AcpShippingAddress;
        // Add shipping cost
        const shippingCost: AcpMoney = { amount: 599, currency: state.session.totals.subtotal.currency };
        state.session.totals.shipping = shippingCost;
        state.session.totals.total = {
          amount: state.session.totals.subtotal.amount + shippingCost.amount + (state.session.totals.tax?.amount ?? 0),
          currency: state.session.totals.subtotal.currency,
        };
        state.session.status = 'ready_for_payment';
      }

      res.json(state.session);
    });

    // POST /checkout_sessions/:id/complete — Complete
    app.post('/checkout_sessions/:id/complete', authMiddleware, (req, res) => {
      const state = this.sessions.get(req.params.id as string);
      if (!state) {
        res.status(404).json({ error: `Checkout session not found: ${req.params.id}` });
        return;
      }

      if (state.session.status !== 'ready_for_payment') {
        res.status(400).json({
          type: 'invalid_request',
          code: 'session_not_ready',
          message: `Cannot complete session in ${state.session.status} state. Must be ready_for_payment.`,
        });
        return;
      }

      const { payment_token, payment_handler } = req.body;
      if (!payment_token || !payment_handler) {
        res.status(400).json({
          type: 'invalid_request',
          code: 'missing_required_field',
          message: 'payment_token and payment_handler are required',
          param: payment_token ? '$.payment_handler' : '$.payment_token',
        });
        return;
      }

      // Simulate payment failure
      if (payment_token === 'tok_mock_failure') {
        state.session.status = 'not_ready_for_payment';
        res.status(402).json({
          type: 'processing_error',
          code: 'payment_declined',
          message: 'Payment declined',
        });
        return;
      }

      state.session.status = 'completed';
      // Materialize a canonical Order for the completed session (convention pull + webhook).
      this.orders.set(state.session.id, this.buildOrderFromSession(state.session));
      res.json(state.session);
    });

    // POST /checkout_sessions/:id/cancel — Cancel
    app.post('/checkout_sessions/:id/cancel', authMiddleware, (req, res) => {
      const state = this.sessions.get(req.params.id as string);
      if (!state) {
        res.status(404).json({ error: `Checkout session not found: ${req.params.id}` });
        return;
      }

      if (state.session.status === 'completed') {
        res.status(400).json({ error: 'Cannot cancel a completed session' });
        return;
      }

      state.session.status = 'canceled';
      res.json(state.session);
    });

    // ─── Order convention endpoints (agorio convention — see ADR 0009) ───
    // ACP has no canonical order-pull endpoint; orders are delivered via webhook.
    // These return the canonical Order shape for reconciliation / testing.

    // GET /orders — list (optionally by checkout_session_id)
    app.get('/orders', authMiddleware, (req, res) => {
      const sessionId = req.query.checkout_session_id as string | undefined;
      let orders = [...this.orders.values()];
      if (sessionId) {
        orders = orders.filter((o) => o.checkout_session_id === sessionId);
      }
      res.json({ orders });
    });

    // GET /orders/:id
    app.get('/orders/:id', authMiddleware, (req, res) => {
      const order = [...this.orders.values()].find((o) => o.id === req.params.id);
      if (!order) {
        res.status(404).json({
          type: 'invalid_request',
          code: 'order_not_found',
          message: `Order not found: ${req.params.id}`,
        });
        return;
      }
      res.json(order);
    });

    // ─── Health Check ───
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', merchant: this.name, protocol: 'acp' });
    });

    // Start listening
    return new Promise<void>((resolve) => {
      this.server = app.listen(this.port, () => {
        const addr = this.server!.address();
        if (typeof addr === 'object' && addr) {
          this.port = addr.port;
        }
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((err) => {
        this.server = null;
        if (err) reject(err);
        else resolve();
      });
    });
  }

  get baseUrl(): string {
    return `http://localhost:${this.port}`;
  }

  get domain(): string {
    return `localhost:${this.port}`;
  }

  get acpEndpoint(): string {
    return this.baseUrl;
  }

  get requiredApiKey(): string {
    return this.apiKey;
  }

  getSessions(): AcpCheckoutSession[] {
    return [...this.sessions.values()].map(s => s.session);
  }

  /** All materialized orders (created when a session completes). */
  getOrders(): AcpOrder[] {
    return [...this.orders.values()];
  }

  reset(): void {
    this.sessions.clear();
    this.orders.clear();
  }

  /**
   * Record a fulfillment against the order for a completed session, then return
   * the updated order. Test affordance for fulfillment-tracking coverage.
   */
  addFulfillment(sessionId: string, fulfillment: AcpFulfillment): AcpOrder | undefined {
    const order = this.orders.get(sessionId);
    if (!order) return undefined;
    order.fulfillments = [...(order.fulfillments ?? []), fulfillment];
    order.status = fulfillment.status === 'delivered' ? 'completed' : 'shipped';
    return order;
  }

  /**
   * Record a refund adjustment against the order for a completed session. Test
   * affordance for refund coverage (refunds are Order adjustments, not endpoints).
   */
  addRefund(
    sessionId: string,
    amount: number,
    opts: { status?: 'pending' | 'completed' | 'failed'; reason?: string; currency?: string } = {}
  ): AcpOrder | undefined {
    const order = this.orders.get(sessionId);
    if (!order) return undefined;
    order.adjustments = [
      ...(order.adjustments ?? []),
      {
        id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'refund',
        occurred_at: new Date().toISOString(),
        status: opts.status ?? 'completed',
        amount,
        currency: opts.currency ?? 'usd',
        ...(opts.reason ? { reason: opts.reason } : {}),
      },
    ];
    return order;
  }

  /**
   * Emit a signed `order_create` / `order_update` webhook for a session's order
   * to the given URL. Signs with the configured `webhookSecret` using the ACP
   * `Merchant-Signature` scheme.
   */
  async emitOrderEvent(
    sessionId: string,
    targetUrl: string,
    type: 'order_create' | 'order_update' = 'order_update'
  ): Promise<void> {
    const order = this.orders.get(sessionId);
    if (!order) throw new Error(`No order for session ${sessionId}`);
    const event: AcpOrderEvent = { type, data: { ...order, type: 'order' } };
    const rawBody = JSON.stringify(event);
    const signature = buildMerchantSignatureHeader(rawBody, this.webhookSecret);
    await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Merchant-Signature': signature,
        'Request-Id': `req_${Date.now()}`,
      },
      body: rawBody,
    });
  }

  get webhookSigningSecret(): string {
    return this.webhookSecret;
  }

  // ─── Helpers ───

  private dollarsToCents(dollarString: string): number {
    return Math.round(parseFloat(dollarString) * 100);
  }

  /** Build a canonical ACP Order from a completed checkout session. */
  private buildOrderFromSession(session: AcpCheckoutSession): AcpOrder {
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      type: 'order',
      id: orderId,
      checkout_session_id: session.id,
      order_number: `ORD-${orderId.slice(-6).toUpperCase()}`,
      permalink_url: `${this.baseUrl}/orders/${orderId}`,
      status: 'confirmed',
      line_items: session.line_items.map((li) => ({
        id: li.id,
        title: li.name,
        quantity: { ordered: li.quantity, current: li.quantity, fulfilled: 0 },
        unit_price: li.unit_price.amount,
        subtotal: li.total_price.amount,
        status: 'processing',
      })),
      totals: [
        { type: 'subtotal', display_text: 'Subtotal', amount: session.totals.subtotal.amount },
        ...(session.totals.shipping
          ? [{ type: 'fulfillment' as const, display_text: 'Shipping', amount: session.totals.shipping.amount }]
          : []),
        ...(session.totals.tax
          ? [{ type: 'tax' as const, display_text: 'Tax', amount: session.totals.tax.amount }]
          : []),
        { type: 'total', display_text: 'Total', amount: session.totals.total.amount },
      ],
    };
  }
}
