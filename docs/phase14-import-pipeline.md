# 📋 Phase 14: CSV Import Pipeline & Previews

## 1. 10-Step Secure Ingestion Workflow

1. **Upload**: Accepts merchant raw CSV files (`products.csv`, `orders.csv`, etc.).
2. **Detect Schema**: Auto-maps headers (`product_name` $\to$ `title`, `retail_price` $\to$ `price`).
3. **Map Columns**: Merchant reviews detected mappings and overrides where needed.
4. **Validate**: Checks mandatory fields, positive pricing, unique external IDs.
5. **Preview**: Generates structured summary (total rows, validity %, sample preview rows).
6. **Show Errors**: Flags malformed rows with line numbers and exact root causes.
7. **Confirmation**: Merchant explicitly clicks "Confirm Import".
8. **Transactional Commit**: Uses `ON CONFLICT (merchant_id, external_id) DO UPDATE` for guaranteed idempotency.
9. **Reconcile**: Verifies source revenue matches imported revenue ($0.00$ delta).
10. **Generate Report**: Issues `ImportCommitReceipt` with permanent audit record.
