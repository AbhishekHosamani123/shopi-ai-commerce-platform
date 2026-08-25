# 🎮 Phase 13: Time Machine & Simulation Environment

## 1. Simulation Time Controller

The Simulation Time Machine allows advancing virtual store time without waiting real-world days:
- Supported increments: `+1 Day`, `+7 Days`, `+30 Days`, `+90 Days`.
- When time advances:
  - Pending orders mature.
  - Inventory updates dynamically.
  - Observation windows elapse.
  - Closed-loop outcomes are computed and verified.

---

## 2. 12 Preset Business Scenarios

1. `HEALTHY_MERCHANT`: Steady 8% MoM growth, 45% margin, low returns.
2. `RAPID_GROWTH`: 25% MoM growth, stockout pressure.
3. `SALES_DECLINE`: -15% MoM demand decay, markdown urgency.
4. `INVENTORY_CRISIS`: Imbalanced supply, 40% dead stock.
5. `DEAD_STOCK_CRISIS`: Capital trapped in stagnant winter apparel.
6. `HIGH_RETURN_CRISIS`: 22% return rate due to sizing issues.
7. `MARGIN_COMPRESSION`: Revenue up but margin compressed to 28%.
8. `SEASONAL_PEAK`: 2.5x surge in festive gifting SKUs.
9. `PROMOTION_FAILURE`: Low conversion response to discounting.
10. `STOCKOUT_CRISIS`: Champion products hitting zero stock repeatedly.
11. `CUSTOMER_CHURN`: VIP retention rate dropping below 40%.
12. `MIXED_CONDITIONS`: Multi-category enterprise variations.
