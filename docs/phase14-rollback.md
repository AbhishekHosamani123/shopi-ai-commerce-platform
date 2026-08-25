# 🔄 Phase 14: 1-Click Batch Rollback & Partial Failure Recovery

## 1. Batch Rollback Mechanics

Every import receives a persistent UUID `import_id` (e.g. `imp_real_1771829...`).
- When a merchant triggers **Rollback**, the engine executes:
  ```sql
  DELETE FROM merchant_canonical_products WHERE import_id = $1 AND merchant_id = $2;
  DELETE FROM merchant_canonical_orders WHERE import_id = $1 AND merchant_id = $2;
  ```
- **Guaranteed Batch Isolation**: Rollback strictly deletes only rows from that specific batch. All prior or subsequent batches remain 100% intact.
- Verified in [test_phase14_rollback.ts](file:///d:/Razorpay-Ai-Commerce/scratch/test_phase14_rollback.ts).
