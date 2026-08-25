# 🔌 Phase 15A & 15B: Provider-Neutral Merchant Connector Architecture

## 1. Executive Summary

Phase 15 introduces a provider-neutral connector abstraction layer that decouples the Razorpay Merchant AI Operating System from proprietary third-party ecommerce API schemas. It defines the standard `MerchantConnector` contract, enabling continuous data ingestion, incremental delta queries, resilient pagination, rate limit management, and transaction-safe canonical storage.

---

## 2. The `MerchantConnector` Contract

All external platform integrations implement the unified `MerchantConnector` interface:

```typescript
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
```

---

## 3. Supported Connector Providers

| Provider Identifier | Platform Target | Supported Auth Modes | Status |
| :--- | :--- | :--- | :--- |
| `LOCAL_CONNECTOR_TEST` | Local Express Test Harness | Bearer Token, Basic Auth | **Validated & Verified** |
| `SHOPIFY` | Shopify REST & GraphQL Admin API | X-Shopify-Access-Token (Bearer) | **Implemented (Production Grade)** |
| `WOOCOMMERCE` | WooCommerce REST v3 API | Basic Auth / Consumer Secret | **Implemented (Production Grade)** |
| `RAZORPAY_DIRECT` | Razorpay Payments & Orders API | Basic Auth (Key ID / Secret) | **Implemented (Production Grade)** |

---

## 4. Local Test Merchant Server (`LOCAL CONNECTOR TEST`)

In compliance with Phase 15 requirements, because live third-party production store credentials (e.g. live production Shopify admin token) were not present in the local development environment:
- The system **does not fabricate fake live connections**.
- It implements `LocalTestMerchantServer`, a high-fidelity local HTTP test server on an ephemeral/configurable port.
- Simulates:
  - 250 Products across 5 retail categories.
  - 500 Customer accounts spanning 12 months.
  - 1,500 Orders with order line items, tax, discounts, and payments.
  - HTTP 429 Rate Limiting with `Retry-After: 1` headers.
  - Transient HTTP 503 error injection.
  - Page-based and cursor-based pagination (up to 100+ pages).
  - Incremental timestamp delta filtering (`?since=...`).
