# 🔒 Phase 14: Data Ingestion Security & Tenant Isolation

## 1. Multi-Tenant Isolation Specification

Every record in `merchant_canonical_products`, `merchant_canonical_customers`, and `merchant_canonical_orders` is strictly indexed by `(merchant_id, external_id)`.
- Cross-tenant queries are structurally prevented by repository parameterized query constraints.
- Verified in [test_phase14_tenant_isolation.ts](file:///d:/Razorpay-Ai-Commerce/scratch/test_phase14_tenant_isolation.ts) (0 records leaked across tenants).

---

## 2. Injection Resistance
- **Formula Injection**: All incoming string fields starting with `=, +, -, @, cmd` are automatically prefixed with an apostrophe `'`.
- **SQL Injection**: All database operations use strict parameterized SQL queries ($1, $2, etc.).
