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
 * 🧪 Local Test Connector Implementation (LOCAL CONNECTOR TEST)
 * Connects to the local test server to validate real HTTP interactions,
 * pagination, rate-limiting retries, and delta syncs.
 */
export class LocalTestConnector extends BaseMerchantConnector {
  readonly provider: ConnectorProviderType = 'LOCAL_CONNECTOR_TEST';
  private baseUrl: string;

  constructor(config?: ConnectorConfig) {
    super(config);
    this.baseUrl = config?.endpointUrl || 'http://127.0.0.1:3899';
  }

  async testConnection(config?: ConnectorConfig): Promise<TestConnectionResult> {
    const targetUrl = config?.endpointUrl || this.baseUrl;
    const token = config?.credentials.accessToken || this.config?.credentials.accessToken;
    const start = Date.now();

    try {
      const res = await this.httpClient.get(`${targetUrl}/api/v1/ping`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 5000
      });

      return {
        success: true,
        provider: this.provider,
        latencyMs: Date.now() - start,
        message: 'Successfully established local connector test connection.',
        serverVersion: res.data.version
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.provider,
        latencyMs: Date.now() - start,
        message: 'Local connector test connection failed.',
        error: err.message
      };
    }
  }

  async getProducts(params: PaginationParams): Promise<PaginatedResult<ExternalProduct>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.updatedSince) query.append('since', params.updatedSince.toISOString());

    const res = await this.requestWithRetry<PaginatedResult<ExternalProduct>>({
      url: `${this.baseUrl}/api/v1/products?${query.toString()}`,
      method: 'GET'
    });

    return res.data;
  }

  async getCustomers(params: PaginationParams): Promise<PaginatedResult<ExternalCustomer>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.updatedSince) query.append('since', params.updatedSince.toISOString());

    const res = await this.requestWithRetry<PaginatedResult<ExternalCustomer>>({
      url: `${this.baseUrl}/api/v1/customers?${query.toString()}`,
      method: 'GET'
    });

    return res.data;
  }

  async getOrders(params: PaginationParams): Promise<PaginatedResult<ExternalOrder>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.updatedSince) query.append('since', params.updatedSince.toISOString());

    const res = await this.requestWithRetry<PaginatedResult<ExternalOrder>>({
      url: `${this.baseUrl}/api/v1/orders?${query.toString()}`,
      method: 'GET'
    });

    return res.data;
  }

  async getOrderItems(orderId: string): Promise<ExternalOrderItem[]> {
    const res = await this.requestWithRetry<{ data: ExternalOrderItem[] }>({
      url: `${this.baseUrl}/api/v1/orders/${encodeURIComponent(orderId)}/items`,
      method: 'GET'
    });

    return res.data.data || [];
  }

  async getInventory(params: PaginationParams): Promise<PaginatedResult<ExternalInventory>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const res = await this.requestWithRetry<PaginatedResult<ExternalInventory>>({
      url: `${this.baseUrl}/api/v1/inventory?${query.toString()}`,
      method: 'GET'
    });

    return res.data;
  }

  async getReturns(params: PaginationParams): Promise<PaginatedResult<ExternalReturn>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const res = await this.requestWithRetry<PaginatedResult<ExternalReturn>>({
      url: `${this.baseUrl}/api/v1/returns?${query.toString()}`,
      method: 'GET'
    });

    return res.data;
  }

  async getPayments(params: PaginationParams): Promise<PaginatedResult<ExternalPayment>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const res = await this.requestWithRetry<PaginatedResult<ExternalPayment>>({
      url: `${this.baseUrl}/api/v1/payments?${query.toString()}`,
      method: 'GET'
    });

    return res.data;
  }

  async syncIncremental(merchantId: string, since: Date): Promise<SyncReceipt> {
    const { liveSyncEngine } = await import('./live-sync-engine');
    return liveSyncEngine.runIncrementalSync(this, merchantId, since);
  }
}
