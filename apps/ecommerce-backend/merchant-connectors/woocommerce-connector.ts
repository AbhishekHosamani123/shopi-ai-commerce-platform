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
 * 🛒 WooCommerce REST API v3 Connector
 */
export class WooCommerceConnector extends BaseMerchantConnector {
  readonly provider: ConnectorProviderType = 'WOOCOMMERCE';

  private getBaseUrl(): string {
    const endpoint = this.config?.endpointUrl || this.config?.storeIdentifier || 'https://example-woo-store.com';
    return `${endpoint.replace(/\/$/, '')}/wp-json/wc/v3`;
  }

  async testConnection(config?: ConnectorConfig): Promise<TestConnectionResult> {
    const url = `${(config?.endpointUrl || this.config?.endpointUrl || 'https://example-woo-store.com').replace(/\/$/, '')}/wp-json/wc/v3/system_status`;
    const start = Date.now();

    try {
      const res = await this.httpClient.get(url, { timeout: 8000 });
      return {
        success: true,
        provider: this.provider,
        latencyMs: Date.now() - start,
        message: 'Successfully connected to WooCommerce store.',
        serverVersion: res.data?.environment?.version || 'v3'
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.provider,
        latencyMs: Date.now() - start,
        message: 'WooCommerce connection failed.',
        error: err.message
      };
    }
  }

  async getProducts(params: PaginationParams): Promise<PaginatedResult<ExternalProduct>> {
    const url = `${this.getBaseUrl()}/products?page=${params.page || 1}&per_page=${params.limit || 50}`;
    const res = await this.requestWithRetry<any[]>({ url, method: 'GET' });

    const products: ExternalProduct[] = (res.data || []).map((p: any) => ({
      externalId: String(p.id),
      sku: p.sku || `SKU-WOO-${p.id}`,
      title: p.name,
      category: p.categories?.[0]?.name || 'General',
      price: parseFloat(p.price || '0'),
      cost: undefined,
      stock: p.stock_quantity || 0,
      updatedAt: p.date_modified || new Date().toISOString(),
      status: p.status === 'publish' ? 'ACTIVE' : 'DRAFT'
    }));

    return { data: products, limit: params.limit || 50, hasMore: products.length >= (params.limit || 50) };
  }

  async getCustomers(params: PaginationParams): Promise<PaginatedResult<ExternalCustomer>> {
    const url = `${this.getBaseUrl()}/customers?page=${params.page || 1}&per_page=${params.limit || 50}`;
    const res = await this.requestWithRetry<any[]>({ url, method: 'GET' });

    const customers: ExternalCustomer[] = (res.data || []).map((c: any) => ({
      externalId: String(c.id),
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username || 'Customer',
      email: c.email || '',
      totalOrders: c.orders_count || 0,
      totalSpent: parseFloat(c.total_spent || '0'),
      createdAt: c.date_created || new Date().toISOString(),
      updatedAt: c.date_modified || new Date().toISOString()
    }));

    return { data: customers, limit: params.limit || 50, hasMore: customers.length >= (params.limit || 50) };
  }

  async getOrders(params: PaginationParams): Promise<PaginatedResult<ExternalOrder>> {
    const url = `${this.getBaseUrl()}/orders?page=${params.page || 1}&per_page=${params.limit || 50}`;
    const res = await this.requestWithRetry<any[]>({ url, method: 'GET' });

    const orders: ExternalOrder[] = (res.data || []).map((o: any) => ({
      externalId: String(o.id),
      externalCustomerId: String(o.customer_id || 'cust_guest'),
      orderNumber: o.number || String(o.id),
      orderDate: o.date_created || new Date().toISOString(),
      orderStatus: o.status === 'completed' ? 'COMPLETED' : (o.status === 'refunded' ? 'REFUNDED' : 'PENDING'),
      currency: o.currency || 'INR',
      subtotal: parseFloat(o.total || '0') - parseFloat(o.shipping_total || '0'),
      discountTotal: parseFloat(o.discount_total || '0'),
      shippingTotal: parseFloat(o.shipping_total || '0'),
      taxTotal: parseFloat(o.total_tax || '0'),
      totalAmount: parseFloat(o.total || '0'),
      items: (o.line_items || []).map((li: any) => ({
        externalItemId: String(li.id),
        externalOrderId: String(o.id),
        externalProductId: String(li.product_id),
        sku: li.sku || '',
        title: li.name,
        quantity: li.quantity,
        unitPrice: parseFloat(li.price || '0'),
        discount: 0,
        totalPrice: parseFloat(li.total || '0')
      })),
      updatedAt: o.date_modified || new Date().toISOString()
    }));

    return { data: orders, limit: params.limit || 50, hasMore: orders.length >= (params.limit || 50) };
  }

  async getOrderItems(orderId: string): Promise<ExternalOrderItem[]> {
    const url = `${this.getBaseUrl()}/orders/${orderId}`;
    const res = await this.requestWithRetry<any>({ url, method: 'GET' });
    return (res.data?.line_items || []).map((li: any) => ({
      externalItemId: String(li.id),
      externalOrderId: String(orderId),
      externalProductId: String(li.product_id),
      sku: li.sku || '',
      title: li.name,
      quantity: li.quantity,
      unitPrice: parseFloat(li.price || '0'),
      discount: 0,
      totalPrice: parseFloat(li.total || '0')
    }));
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
