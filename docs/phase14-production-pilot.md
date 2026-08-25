# 🚀 Phase 14: Production Pilot Architecture & Safety Model

## 1. Pilot Safety Model: Zero Autonomous Mutations

In Pilot Mode:
- **`isPilotActive`**: `true`
- **`autonomousMutationsAllowed`**: `false` (Strictly enforced in code)
- The merchant can view all insights, forecasts, simulations, and priority cards.
- **Every state mutation** (stock reorder, price markdown, coupon generation) **requires explicit 1-click merchant confirmation**.

---

## 2. Cold-Start Capability Matrix

| Historical Data Depth | Basic Sales | Inventory Alerts | 7d Forecast | 30d Forecast | Seasonality & CLV |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **$< 7$ Days** | Available | Low Confidence | Low Confidence | Unavailable | Unavailable |
| **$7 - 29$ Days** | Available | Available | Available | Low Confidence | Low Confidence |
| **$30 - 89$ Days** | Available | Available | Available | Available | Low Confidence |
| **$\ge 90$ Days** | Available | Available | Available | Available | Available |
