/**
 * 🔌 Phase 15: Provider-Neutral Merchant Connector Types & Contracts
 */

export type ConnectorProviderType = 'SHOPIFY' | 'WOOCOMMERCE' | 'RAZORPAY_DIRECT' | 'CUSTOM_REST' | 'LOCAL_CONNECTOR_TEST';

export type ConnectorStatus = 'NOT_CONNECTED' | 'CONNECTING' | 'CONNECTED' | 'SYNCING' | 'SYNC_FAILED' | 'DISCONNECTED';

export type AuthType = 'BEARER_TOKEN' | 'API_KEY_SECRET' | 'OAUTH2' | 'BASIC_AUTH';

export interface ConnectorConfig {
  connectorId?: string;
  merchantId: string;
  provider: ConnectorProviderType;
  storeIdentifier: string;
  authType: AuthType;
  endpointUrl?: string;
  credentials: {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    webhookSecret?: string;
    username?: string;
    password?: string;
  };
  autoSyncEnabled?: boolean;
  syncFrequencyMinutes?: number;
}

export interface ConnectionResult {
  success: boolean;
  connectorId: string;
  merchantId: string;
  provider: ConnectorProviderType;
  storeIdentifier: string;
  status: ConnectorStatus;
  message: string;
  discoveredEntities?: {
    estimatedProducts: number;
    estimatedOrders: number;
    estimatedCustomers: number;
    historicalCoverageDays: number;
  };
  connectedAt?: string;
  error?: string;
}

export interface TestConnectionResult {
  success: boolean;
  provider: ConnectorProviderType;
  latencyMs: number;
  message: string;
  serverVersion?: string;
  rateLimitRemaining?: number;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
  updatedSince?: Date;
  createdSince?: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount?: number;
  page?: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
  rateLimitRemaining?: number;
}

export interface ExternalProduct {
  externalId: string;
  title: string;
  category: string;
  price: number;
  cost?: number;
  stock: number;
  sku: string;
  updatedAt: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
}

export interface ExternalCustomer {
  externalId: string;
  name: string;
  email: string;
  phone?: string;
  totalOrders?: number;
  totalSpent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalOrderItem {
  externalItemId: string;
  externalOrderId: string;
  externalProductId: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
}

export interface ExternalOrder {
  externalId: string;
  externalCustomerId: string;
  orderNumber: string;
  orderDate: string;
  orderStatus: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PROCESSING';
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  totalAmount: number;
  items: ExternalOrderItem[];
  updatedAt: string;
}

export interface ExternalInventory {
  externalProductId: string;
  sku: string;
  availableStock: number;
  reservedStock: number;
  warehouseId?: string;
  updatedAt: string;
}

export interface ExternalReturn {
  externalReturnId: string;
  externalOrderId: string;
  externalProductId?: string;
  returnReason: string;
  refundAmount: number;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  createdAt: string;
}

export interface ExternalPayment {
  externalPaymentId: string;
  externalOrderId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: 'CAPTURED' | 'FAILED' | 'REFUNDED';
  paidAt: string;
}

export interface SyncCheckpoint {
  checkpointId: string;
  syncId: string;
  merchantId: string;
  provider: ConnectorProviderType;
  entityType: 'PRODUCTS' | 'CUSTOMERS' | 'ORDERS' | 'INVENTORY' | 'RETURNS';
  cursorToken?: string;
  pageNumber: number;
  rowsProcessed: number;
  rowsImported: number;
  rowsFailed: number;
  isComplete: boolean;
  updatedAt: string;
}

export interface SyncReceipt {
  syncId: string;
  merchantId: string;
  provider: ConnectorProviderType;
  syncType: 'INITIAL' | 'INCREMENTAL';
  status: 'COMPLETED' | 'FAILED' | 'FAILED_RECONCILIATION' | 'PARTIAL';
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  rowsProcessed: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsRejected: number;
  reconciliation: {
    sourceOrdersCount: number;
    importedOrdersCount: number;
    sourceRevenue: number;
    importedRevenue: number;
    revenueDelta: number;
    status: 'RECONCILED' | 'FAILED_RECONCILIATION';
  };
  freshness: {
    lastSyncTimestamp: string;
    dataAgeSeconds: number;
    historicalCoverageDays: number;
    healthStatus: 'HEALTHY' | 'STALE' | 'FAILING';
  };
  checkpoints: SyncCheckpoint[];
  errors: string[];
}

export interface WebhookEventPayload {
  eventId: string;
  merchantId: string;
  provider: ConnectorProviderType;
  eventType: 'order.created' | 'order.updated' | 'order.cancelled' | 'refund.created' | 'inventory.updated' | 'product.updated';
  timestamp: string;
  data: any;
  signature?: string;
  idempotencyKey: string;
}

export interface DataLineageRecord {
  lineageId: string;
  merchantId: string;
  metricName: string;
  metricValue: number;
  sourceName: string;
  entityType: string;
  periodStart: string;
  periodEnd: string;
  recordsEvaluated: number;
  calculationFormula: string;
  reconciliationStatus: 'RECONCILED' | 'UNVERIFIED';
  computedAt: string;
}

/**
 * 🛡️ Provider-Neutral Merchant Connector Interface
 */
export interface MerchantConnector {
  readonly provider: ConnectorProviderType;
  
  connect(config: ConnectorConfig): Promise<ConnectionResult>;
  disconnect(merchantId: string): Promise<boolean>;
  testConnection(config?: ConnectorConfig): Promise<TestConnectionResult>;
  
  getProducts(params: PaginationParams): Promise<PaginatedResult<ExternalProduct>>;
  getCustomers(params: PaginationParams): Promise<PaginatedResult<ExternalCustomer>>;
  getOrders(params: PaginationParams): Promise<PaginatedResult<ExternalOrder>>;
  getOrderItems(orderId: string): Promise<ExternalOrderItem[]>;
  getInventory(params: PaginationParams): Promise<PaginatedResult<ExternalInventory>>;
  getReturns(params: PaginationParams): Promise<PaginatedResult<ExternalReturn>>;
  getPayments(params: PaginationParams): Promise<PaginatedResult<ExternalPayment>>;
  
  getLastSync(merchantId: string): Promise<SyncReceipt | null>;
  syncIncremental(merchantId: string, since: Date): Promise<SyncReceipt>;
}
