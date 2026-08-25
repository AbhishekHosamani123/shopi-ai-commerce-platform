import { BaseMerchantConnector } from './base-connector';
import {
  ConnectorProviderType,
  ConnectorConfig,
  TestConnectionResult,
  PaginationParams,
  PaginatedResult,
  ExternalProduct,
  ExternalCustomer,
  ExternalOrder,
  ExternalOrderItem,
  ExternalInventory,
  ExternalReturn,
  ExternalPayment,
  SyncReceipt
} from './connector-types';

/**
 * 💳 Razorpay Direct Payment & Order Connector
 */
export class RazorpayPaymentsConnector extends BaseMerchantConnector {
  readonly provider: ConnectorProviderType = 'RAZORPAY_DIRECT';
  private baseUrl = 'https://api.razorpay.com/v1';

  async testConnection(config?: ConnectorConfig): Promise<TestConnectionResult> {
    const keyId = config?.credentials.apiKey || this.config?.credentials.apiKey || process.env.RAZORPAY_KEY_ID;
    const keySecret = config?.credentials.apiSecret || this.config?.credentials.apiSecret || process.env.RAZORPAY_KEY_SECRET;
    const start = Date.now();

    if (!keyId || !keySecret) {
      return {
        success: false,
        provider: this.provider,
        latencyMs: 0,
        message: 'Razorpay API credentials missing (Key ID / Key Secret required).',
        error: 'Missing credentials'
      };
    }

    try {
      const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const res = await this.httpClient.get(`${this.baseUrl}/payments?count=1`, {
        headers: { 'Authorization': authHeader },
        timeout: 5000
      });

      return {
        success: true,
        provider: this.provider,
        latencyMs: Date.now() - start,
        message: 'Successfully verified Razorpay API credentials.',
        serverVersion: 'v1'
      };
    } catch (err: any) {
      // In local dev without live keys, return informative status
      return {
        success: false,
        provider: this.provider,
        latencyMs: Date.now() - start,
        message: 'Razorpay API validation returned error.',
        error: err.message
      };
    }
  }

  async getProducts(params: PaginationParams): Promise<PaginatedResult<ExternalProduct>> {
    return { data: [], limit: params.limit || 50, hasMore: false };
  }

  async getCustomers(params: PaginationParams): Promise<PaginatedResult<ExternalCustomer>> {
    const keyId = this.config?.credentials.apiKey || process.env.RAZORPAY_KEY_ID;
    const keySecret = this.config?.credentials.apiSecret || process.env.RAZORPAY_KEY_SECRET;
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const res = await this.requestWithRetry<any>({
      url: `${this.baseUrl}/customers?count=${params.limit || 50}`,
      headers: { 'Authorization': authHeader },
      method: 'GET'
    });

    const customers: ExternalCustomer[] = (res.data?.items || []).map((c: any) => ({
      externalId: c.id,
      name: c.name || 'Razorpay Customer',
      email: c.email || '',
      phone: c.contact,
      createdAt: new Date(c.created_at * 1000).toISOString(),
      updatedAt: new Date(c.created_at * 1000).toISOString()
    }));

    return { data: customers, limit: params.limit || 50, hasMore: false };
  }

  async getOrders(params: PaginationParams): Promise<PaginatedResult<ExternalOrder>> {
    const keyId = this.config?.credentials.apiKey || process.env.RAZORPAY_KEY_ID;
    const keySecret = this.config?.credentials.apiSecret || process.env.RAZORPAY_KEY_SECRET;
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const res = await this.requestWithRetry<any>({
      url: `${this.baseUrl}/orders?count=${params.limit || 50}`,
      headers: { 'Authorization': authHeader },
      method: 'GET'
    });

    const orders: ExternalOrder[] = (res.data?.items || []).map((o: any) => ({
      externalId: o.id,
      externalCustomerId: 'cust_razorpay',
      orderNumber: o.receipt || o.id,
      orderDate: new Date(o.created_at * 1000).toISOString(),
      orderStatus: o.status === 'paid' ? 'COMPLETED' : 'PENDING',
      currency: o.currency || 'INR',
      subtotal: (o.amount || 0) / 100,
      discountTotal: 0,
      shippingTotal: 0,
      taxTotal: 0,
      totalAmount: (o.amount || 0) / 100,
      items: [],
      updatedAt: new Date(o.created_at * 1000).toISOString()
    }));

    return { data: orders, limit: params.limit || 50, hasMore: false };
  }

  async getOrderItems(orderId: string): Promise<ExternalOrderItem[]> {
    return [];
  }

  async getInventory(params: PaginationParams): Promise<PaginatedResult<ExternalInventory>> {
    return { data: [], limit: params.limit || 50, hasMore: false };
  }

  async getReturns(params: PaginationParams): Promise<PaginatedResult<ExternalReturn>> {
    return { data: [], limit: params.limit || 50, hasMore: false };
  }

  async getPayments(params: PaginationParams): Promise<PaginatedResult<ExternalPayment>> {
    return { data: [], limit: params.limit || 50, hasMore: false };
  }

  async syncIncremental(merchantId: string, since: Date): Promise<SyncReceipt> {
    const { liveSyncEngine } = await import('./live-sync-engine');
    return liveSyncEngine.runIncrementalSync(this, merchantId, since);
  }
}
