import express, { Request, Response } from 'express';
import http from 'http';
import { ExternalProduct, ExternalCustomer, ExternalOrder, ExternalOrderItem, ExternalInventory, ExternalReturn, ExternalPayment } from './connector-types';

/**
 * 🧪 Local Test Merchant Server (LOCAL CONNECTOR TEST)
 * 
 * Simulates a production ecommerce platform (e.g. Shopify/WooCommerce REST API)
 * with bearer token auth, cursor & page pagination (1 to 100+ pages),
 * 429 rate limiting with Retry-After, transient 500 error injection,
 * and incremental delta filtering.
 */
export class LocalTestMerchantServer {
  private app: express.Application;
  private server: http.Server | null = null;
  public readonly port: number;
  public readonly validBearerToken = 'mock_ext_token_sec_2026_test';

  // Seeded dataset stores
  private products: ExternalProduct[] = [];
  private customers: ExternalCustomer[] = [];
  private orders: ExternalOrder[] = [];
  private orderItems: ExternalOrderItem[] = [];
  private inventory: ExternalInventory[] = [];
  private returns: ExternalReturn[] = [];
  private payments: ExternalPayment[] = [];

  // Chaos & rate limit flags
  public rateLimitTriggerCount = 0;
  public transientErrorCountdown = 0;

  constructor(port: number = 3899) {
    this.port = port;
    this.app = express();
    this.app.use(express.json());
    this.seedMockData();
    this.setupRoutes();
  }

  private seedMockData() {
    // 1. Seed 250 Products across 5 categories
    const categories = ['Footwear', 'Apparel', 'Home & Kitchen', 'Electronics', 'Personal Care'];
    for (let i = 1; i <= 250; i++) {
      const cat = categories[i % categories.length];
      const price = 500 + ((i * 137) % 4500);
      const stock = (i * 7) % 200;
      this.products.push({
        externalId: `EXT-PROD-${1000 + i}`,
        sku: `SKU-EXT-${1000 + i}`,
        title: `Premium ${cat} Item #${i}`,
        category: cat,
        price,
        cost: Math.round(price * 0.45),
        stock,
        updatedAt: new Date(Date.now() - (250 - i) * 3600000).toISOString(),
        status: stock > 0 ? 'ACTIVE' : 'DRAFT'
      });

      this.inventory.push({
        externalProductId: `EXT-PROD-${1000 + i}`,
        sku: `SKU-EXT-${1000 + i}`,
        availableStock: stock,
        reservedStock: stock > 10 ? 3 : 0,
        updatedAt: new Date().toISOString()
      });
    }

    // 2. Seed 500 Customers
    for (let c = 1; c <= 500; c++) {
      this.customers.push({
        externalId: `EXT-CUST-${2000 + c}`,
        name: `Customer Test ${c}`,
        email: `cust_${c}@localmerchantsim.com`,
        phone: `+9198765${String(c).padStart(5, '0')}`,
        totalOrders: 1 + (c % 5),
        totalSpent: 0,
        createdAt: new Date(Date.now() - (600 - c) * 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // 3. Seed 1,500 Orders spanning 365 days
    let orderNum = 5000;
    for (let o = 1; o <= 1500; o++) {
      orderNum++;
      const cust = this.customers[o % this.customers.length];
      const prod1 = this.products[o % this.products.length];
      const prod2 = this.products[(o + 7) % this.products.length];
      const qty1 = 1 + (o % 3);
      const qty2 = 1 + ((o + 1) % 2);

      const item1: ExternalOrderItem = {
        externalItemId: `EXT-ITEM-${orderNum}-1`,
        externalOrderId: `EXT-ORD-${orderNum}`,
        externalProductId: prod1.externalId,
        sku: prod1.sku,
        title: prod1.title,
        quantity: qty1,
        unitPrice: prod1.price,
        discount: 0,
        totalPrice: prod1.price * qty1
      };

      const item2: ExternalOrderItem = {
        externalItemId: `EXT-ITEM-${orderNum}-2`,
        externalOrderId: `EXT-ORD-${orderNum}`,
        externalProductId: prod2.externalId,
        sku: prod2.sku,
        title: prod2.title,
        quantity: qty2,
        unitPrice: prod2.price,
        discount: 0,
        totalPrice: prod2.price * qty2
      };

      const subtotal = item1.totalPrice + item2.totalPrice;
      const discountTotal = o % 5 === 0 ? Math.round(subtotal * 0.1) : 0;
      const totalAmount = subtotal - discountTotal;

      const orderDate = new Date(Date.now() - (1500 - o) * (365 * 86400000 / 1500)).toISOString();
      const status = o % 40 === 0 ? 'CANCELLED' : (o % 30 === 0 ? 'REFUNDED' : 'COMPLETED');

      const order: ExternalOrder = {
        externalId: `EXT-ORD-${orderNum}`,
        externalCustomerId: cust.externalId,
        orderNumber: `ORD-${orderNum}`,
        orderDate,
        orderStatus: status,
        currency: 'INR',
        subtotal,
        discountTotal,
        shippingTotal: 0,
        taxTotal: Math.round(totalAmount * 0.18),
        totalAmount,
        items: [item1, item2],
        updatedAt: orderDate
      };

      this.orders.push(order);
      this.orderItems.push(item1, item2);

      if (status === 'REFUNDED') {
        this.returns.push({
          externalReturnId: `EXT-RET-${orderNum}`,
          externalOrderId: order.externalId,
          externalProductId: prod1.externalId,
          returnReason: 'Damaged item / Defect',
          refundAmount: totalAmount,
          status: 'COMPLETED',
          createdAt: orderDate
        });
      }

      this.payments.push({
        externalPaymentId: `EXT-PAY-${orderNum}`,
        externalOrderId: order.externalId,
        amount: totalAmount,
        currency: 'INR',
        paymentMethod: 'UPI',
        status: status === 'REFUNDED' ? 'REFUNDED' : 'CAPTURED',
        paidAt: orderDate
      });
    }
  }

  private setupRoutes() {
    // Auth & Rate-Limit Middleware
    this.app.use((req: Request, res: Response, next) => {
      // 1. Check transient error injection
      if (this.transientErrorCountdown > 0) {
        this.transientErrorCountdown--;
        return res.status(503).json({ error: 'Service Unavailable (Simulated Transient Error)' });
      }

      // 2. Check rate limit simulation
      if (this.rateLimitTriggerCount > 0) {
        this.rateLimitTriggerCount--;
        res.setHeader('Retry-After', '1');
        return res.status(429).json({ error: 'Too Many Requests (Rate Limit Exceeded)' });
      }

      // 3. Check Bearer Auth
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== this.validBearerToken) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Bearer Token' });
      }

      next();
    });

    // Health & Connection Test Endpoint
    this.app.get('/api/v1/ping', (req: Request, res: Response) => {
      res.json({
        status: 'OK',
        provider: 'LOCAL_CONNECTOR_TEST',
        version: '2026.8.24',
        store: 'Local Simulated Merchant Store',
        counts: {
          products: this.products.length,
          orders: this.orders.length,
          customers: this.customers.length
        }
      });
    });

    // Paginated Products
    this.app.get('/api/v1/products', (req: Request, res: Response) => {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '50', 10);
      const since = req.query.since ? new Date(req.query.since as string) : null;

      let filtered = this.products;
      if (since && !isNaN(since.getTime())) {
        filtered = filtered.filter(p => new Date(p.updatedAt) >= since);
      }

      const startIndex = (page - 1) * limit;
      const data = filtered.slice(startIndex, startIndex + limit);
      const hasMore = startIndex + limit < filtered.length;
      const nextCursor = hasMore ? Buffer.from(`cursor_prod_${page + 1}`).toString('base64') : undefined;

      res.json({
        data,
        totalCount: filtered.length,
        page,
        limit,
        hasMore,
        nextCursor
      });
    });

    // Paginated Customers
    this.app.get('/api/v1/customers', (req: Request, res: Response) => {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '50', 10);
      const since = req.query.since ? new Date(req.query.since as string) : null;

      let filtered = this.customers;
      if (since && !isNaN(since.getTime())) {
        filtered = filtered.filter(c => new Date(c.updatedAt) >= since);
      }

      const startIndex = (page - 1) * limit;
      const data = filtered.slice(startIndex, startIndex + limit);
      const hasMore = startIndex + limit < filtered.length;

      res.json({
        data,
        totalCount: filtered.length,
        page,
        limit,
        hasMore
      });
    });

    // Paginated Orders
    this.app.get('/api/v1/orders', (req: Request, res: Response) => {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '50', 10);
      const since = req.query.since ? new Date(req.query.since as string) : null;

      let filtered = this.orders;
      if (since && !isNaN(since.getTime())) {
        filtered = filtered.filter(o => new Date(o.updatedAt) >= since);
      }

      const startIndex = (page - 1) * limit;
      const data = filtered.slice(startIndex, startIndex + limit);
      const hasMore = startIndex + limit < filtered.length;
      const nextCursor = hasMore ? Buffer.from(`cursor_ord_${page + 1}`).toString('base64') : undefined;

      res.json({
        data,
        totalCount: filtered.length,
        page,
        limit,
        hasMore,
        nextCursor
      });
    });

    // Order Items
    this.app.get('/api/v1/orders/:orderId/items', (req: Request, res: Response) => {
      const orderId = req.params.orderId;
      const items = this.orderItems.filter(i => i.externalOrderId === orderId);
      res.json({ data: items });
    });

    // Paginated Inventory
    this.app.get('/api/v1/inventory', (req: Request, res: Response) => {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '50', 10);
      const startIndex = (page - 1) * limit;
      const data = this.inventory.slice(startIndex, startIndex + limit);
      const hasMore = startIndex + limit < this.inventory.length;

      res.json({
        data,
        totalCount: this.inventory.length,
        page,
        limit,
        hasMore
      });
    });

    // Paginated Returns
    this.app.get('/api/v1/returns', (req: Request, res: Response) => {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '50', 10);
      const startIndex = (page - 1) * limit;
      const data = this.returns.slice(startIndex, startIndex + limit);
      const hasMore = startIndex + limit < this.returns.length;

      res.json({
        data,
        totalCount: this.returns.length,
        page,
        limit,
        hasMore
      });
    });

    // Paginated Payments
    this.app.get('/api/v1/payments', (req: Request, res: Response) => {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '50', 10);
      const startIndex = (page - 1) * limit;
      const data = this.payments.slice(startIndex, startIndex + limit);
      const hasMore = startIndex + limit < this.payments.length;

      res.json({
        data,
        totalCount: this.payments.length,
        page,
        limit,
        hasMore
      });
    });

    // Incremental Delta Injector (Helper for testing incremental additions)
    this.app.post('/api/v1/test/inject-incremental', (req: Request, res: Response) => {
      const newOrderId = `EXT-ORD-INC-${Date.now()}`;
      const newOrder: ExternalOrder = {
        externalId: newOrderId,
        externalCustomerId: this.customers[0].externalId,
        orderNumber: `ORD-INC-${Date.now()}`,
        orderDate: new Date().toISOString(),
        orderStatus: 'COMPLETED',
        currency: 'INR',
        subtotal: 4999,
        discountTotal: 0,
        shippingTotal: 0,
        taxTotal: 900,
        totalAmount: 4999,
        items: [{
          externalItemId: `EXT-ITEM-INC-${Date.now()}`,
          externalOrderId: newOrderId,
          externalProductId: this.products[0].externalId,
          sku: this.products[0].sku,
          title: this.products[0].title,
          quantity: 1,
          unitPrice: 4999,
          discount: 0,
          totalPrice: 4999
        }],
        updatedAt: new Date().toISOString()
      };

      this.orders.unshift(newOrder);
      res.json({ success: true, order: newOrder });
    });
  }

  /**
   * Starts the local test server
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        resolve();
      });
    });
  }

  /**
   * Stops the local test server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
