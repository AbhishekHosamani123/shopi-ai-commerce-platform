# 📖 Phase 12: Outcome Ledger Schema & Baseline Snapshots

## 1. Outcome Record Schema Specification

Every recommendation and approved action tracks a complete lifecycle record in `merchant_business_impact_ledger`:

| Field | Type | Description |
| :--- | :--- | :--- |
| `impact_id` | `VARCHAR(100)` | Primary unique identifier (`imp_...`) |
| `recommendation_id` | `VARCHAR(100)` | Linked AI recommendation identifier |
| `action_id` | `VARCHAR(100)` | Linked action center task identifier |
| `merchant_id` | `VARCHAR(100)` | Multi-tenant tenant identifier |
| `product_id` | `INT` | Target SKU identifier |
| `recommendation_type` | `VARCHAR(50)` | `RESTOCK`, `DISCOUNT`, `PROMOTION`, `RETENTION`, `TRANSFER` |
| `baseline_metrics` | `JSONB` | Pre-execution snapshot (`stock`, `velocity7d`, `dailyRevenue`, `marginPct`) |
| `post_action_metrics`| `JSONB` | Realized metrics post-observation window |
| `expected_impact` | `JSONB` | Predicted units, revenue, and profit deltas |
| `actual_impact` | `JSONB` | Realized units, revenue, and profit deltas |
| `impact_delta_pct` | `NUMERIC(8,2)`| Percentage variance above/below expected |
| `confidence_at_recommendation` | `NUMERIC(5,2)` | AI calibrated confidence (0.00–1.00) |
| `final_outcome` | `VARCHAR(30)` | `POSITIVE`, `NEUTRAL`, `NEGATIVE`, `INCONCLUSIVE`, `FAILED` |
| `model_version` | `VARCHAR(50)` | Model version tag (e.g. `v1.4_demand`) |
| `rule_version` | `VARCHAR(50)` | Rule version tag (e.g. `v2.1_inventory`) |
| `merchant_feedback` | `JSONB` | Qualitative feedback (`rating`, `notes`, `submittedAt`) |
| `negative_analysis` | `JSONB` | 7-point diagnostic for negative outcomes |

---

## 2. Configurable Observation Windows

| Action Category | Supported Windows | Evaluation Rule |
| :--- | :--- | :--- |
| **Inventory / Restock** | 7 / 14 / 30 Days | Evaluated only after goods receipt turnaround. |
| **Price Markdown / Discount** | 3 / 7 / 14 Days | Evaluates sell-through acceleration vs margin dilution. |
| **Marketing Promotions** | 3 / 7 / 14 Days | Evaluates conversion lift and campaign cohort conversion. |
| **VIP Retention** | 30 / 60 / 90 Days | Evaluates 60-day repeat repurchase rate. |
