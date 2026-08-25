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
 * 🛍️ Shopify REST / GraphQL Admin API Connector
 */
export class ShopifyConnector extends BaseMerchantConnector {
  readonly provider: ConnectorProviderType = 'SHOPIFY';
  private apiVersion = '2024-01';

  private getShopUrl(): string {
    const store = this.config?.storeIdentifier.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'example.myshopify.com';
    return `https://${store}/admin/api/${this.apiVersion}`;
  }

  async testConnection(config?: ConnectorConfig): Promise<TestConnectionResult> {
    const store = (config?.storeIdentifier || this.config?.storeIdentifier || '').replace(/^https?:\/\//, '');
    const token = config?.credentials.accessToken || this.config?.credentials.accessToken;
    const start = Date.now();

    if (!store || !token) {
      return {
        success: false,
        provider: this.provider,
        latencyMs: 0,
        message: 'Shopify connection failed: store identifier and access token are required.',
        error: 'Missing credentials'
      };
    }

    try {
      const res = await this.httpClient.get(`https://${store}/admin/api/${this.apiVersion}/shop.json`, {
        headers: { 'X-Shopify-Access-Token': token },
        timeout: 8000
      });

      return {
        success: true,
        provider: this.provider,
        latencyMs: Date.now() - start,
        message: `Successfully connected to Shopify store (${res.data.shop?.name || store})`,
        serverVersion: this.apiVersion
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.provider,
        latencyMs: Date.now() - start,
        message: 'Shopify store connection failed.',
        error: err.response?.data?.errors || err.message
      };
    }
  }

  async getProducts(params: PaginationParams): Promise<PaginatedResult<ExternalProduct>> {
    const url = `${this.getShopUrl()}/products.json?limit=${params.limit || 50}`;
    const res = await this.requestWithRetry<any>({ url, method: 'GET' });

    const products: ExternalProduct[] = (res.data.products || []).map((p: any) => ({
      externalId: String(p.id),
      sku: p.variants?.[0]?.sku || `SKU-${p.id}`,
      title: p.title,
      category: p.product_type || 'General',
      price: parseFloat(p.variants?.[0]?.price || '0'),
      cost: parseFloat(p.variants?.[0]?.cost || '0') || undefined,
      stock: p.variants?.[0]?.inventory_quantity || 0,
      updatedAt: p.updated_at,
      status: p.status === 'active' ? 'ACTIVE' : 'DRAFT'
    }));

    return {
      data: products,
      limit: params.limit || 50,
      hasMore: products.length >= (params.limit || 50)
    };
  }

  async getCustomers(params: PaginationParams): Promise<PaginatedResult<ExternalCustomer>> {
    const url = `${this.getShopUrl()}/customers.json?limit=${params.limit || 50}`;
    const res = await this.requestWithRetry<any>({ url, method: 'GET' });

    const customers: ExternalCustomer[] = (res.data.customers || []).map((c: any) => ({
      externalId: String(c.id),
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Shopify Customer',
      email: c.email || '',
      phone: c.phone,
      totalOrders: c.orders_count || 0,
      totalSpent: parseFloat(c.total_spent || '0'),
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));

    return {
      data: customers,
      limit: params.limit || 50,
      hasMore: customers.length >= (params.limit || 50)
    };
  }

  async getOrders(params: PaginationParams): Promise<PaginatedResult<ExternalOrder>> {
    const query = new URLSearchParams();
    query.append('limit', String(params.limit || 50));
    query.append('status', 'any');
    if (params.updatedSince) query.append('updated_at_min', params.updatedSince.toISOString());

    const url = `${this.getShopUrl()}/orders.json?${query.toString()}`;
    const res = await this.requestWithRetry<any>({ url, method: 'GET' });

    const orders: ExternalOrder[] = (res.data.orders || []).map((o: any) => ({
      externalId: String(o.id),
      externalCustomerId: String(o.customer?.id || 'cust_guest'),
      orderNumber: o.name || String(o.order_number),
      orderDate: o.created_at,
      orderStatus: o.cancelled_at ? 'CANCELLED' : (o.financial_status === 'refunded' ? 'REFUNDED' : 'COMPLETED'),
      currency: o.currency || 'INR',
      subtotal: parseFloat(o.subtotal_price || '0'),
      discountTotal: parseFloat(o.total_discounts || '0'),
      shippingTotal: parseFloat(o.total_shipping_price_set?.shop_money?.amount || '0'),
      taxTotal: parseFloat(o.total_tax || '0'),
      totalAmount: parseFloat(o.total_price || '0'),
      items: (o.line_items || []).map((li: any) => ({
        externalItemId: String(li.id),
        externalOrderId: String(o.id),
        externalProductId: String(li.product_id),
        sku: li.sku || '',
        title: li.title,
        quantity: li.quantity,
        unitPrice: parseFloat(li.price || '0'),
        discount: parseFloat(li.total_discount || '0'),
        totalPrice: parseFloat(li.price || '0') * li.quantity
      })),
      updatedAt: o.updated_at
    }));

    return {
      data: orders,
      limit: params.limit || 50,
      hasMore: orders.length >= (params.limit || 50)
    };
  }

  async getOrderItems(orderId: string): Promise<ExternalOrderItem[]> {
    const url = `${this.getShopUrl()}/orders/${orderId}.json`;
    const res = await this.requestWithRetry<any>({ url, method: 'GET' });
    const o = res.data.order;
    if (!o) return [];

    return (o.line_items || []).map((li: any) => ({
      externalItemId: String(li.id),
      externalOrderId: String(o.id),
      externalProductId: String(li.product_id),
      sku: li.sku || '',
      title: li.title,
      quantity: li.quantity,
      unitPrice: parseFloat(li.price || '0'),
      discount: parseFloat(li.total_discount || '0'),
      totalPrice: parseFloat(li.price || '0') * li.quantity
    }));
  }

  async getInventory(params: PaginationParams): Promise<PaginatedResult<ExternalInventory>> {
    const url = `${this.getShopUrl()}/inventory_levels.json?limit=${params.limit || 50}`;
    const res = await this.requestWithRetry<any>({ url, method: 'GET' });

    const inv: ExternalInventory[] = (res.data.inventory_levels || []).map((lvl: any) => ({
      externalProductId: String(lvl.inventory_item_id),
      sku: `SKU-INV-${lvl.inventory_item_id}`,
      availableStock: lvl.available || 0,
      reservedStock: 0,
      updatedAt: lvl.updated_at || new Date().toISOString()
    }));

    return { data: inv, limit: params.limit || 50, hasMore: inv.length >= (params.limit || 50) };
  }

  async getReturns(params: PaginationParams): Promise<PaginatedResult<ExternalReturn>> {
    const url = `${this.getShopUrl()}/refunds.json?limit=${params.limit || 50}`;
    const res = await this.requestWithRetry<any>({ url, method: 'GET' });
    const rets: ExternalReturn[] = (res.data.refunds || []).map((r: any) => ({
      externalReturnId: String(r.id),
      externalOrderId: String(r.order_id),
      returnReason: r.note || 'Return / Refund',
      refundAmount: parseFloat(r.transactions?.[0]?.amount || '0'),
      status: 'COMPLETED',
      createdAt: r.created_at
    }));
    return { data: rets, limit: params.limit || 50, hasMore: false };
  }

  async getPayments(params: PaginationParams): Promise<PaginatedResult<ExternalPayment>> {
    return { data: [], limit: params.limit || 50, hasMore: false };
  }

  async syncIncremental(merchantId: string, since: Date): Promise<SyncReceipt> {
    const { liveSyncEngine } = await import('./live-sync-engine');
    return liveSyncEngine.runIncrementalSync(this, merchantId, since);
  }
}
