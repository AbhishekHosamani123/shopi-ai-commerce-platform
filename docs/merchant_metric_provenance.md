# MERCHANT AI METRIC PROVENANCE & DATA LINEAGE

**Phase:** Phase 12 — Data Truth & Reconciliation  
**Source of Truth:** Canonical Supabase Commerce Dataset (`shopi_*` tables)  
**Standard Provenance Tags:** `[OBSERVED]`, `[CALCULATED]`, `[MODEL_ESTIMATE]`, `[DATA_UNAVAILABLE]`  

---

## 1. Provenance & Lineage Framework

Every metric rendered in the Merchant Dashboard or processed by Merchant AI carries explicit provenance metadata to guarantee mathematical transparency and auditability:

```
[Raw Canonical DB: shopi_*] 
  ↳ [Merchant Data Services: MerchantSupabaseService]
    ↳ [Canonical Semantic Layer: CanonicalMetricsService]
      ↳ [Intelligence & Simulation Engines]
        ↳ [Express API Routes: /api/merchant/*]
          ↳ [Next.js Linear-Style Workspaces with TrustBadges]
```

---

## 2. Core Metric Provenance Table

| Metric Key | Display Name | Classification | Source Table(s) | Backend Computation Service | Formula & Denominator | Included Statuses | Excluded Statuses | Timezone | Workspaces Consuming Metric |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `grossRevenue` | Gross Revenue | `OBSERVED` | `shopi_orders`, `shopi_order_items` | `CanonicalMetricsService.getFinancialSummary` | $\sum (\text{subtotal\_amount})$ | `COMPLETED`, `DELIVERED`, `PROCESSING`, `PENDING` | `CANCELLED` | UTC / Storefront Local (IST) | Overview (`/merchant`), Sales (`/merchant/sales`), Copilot (`⌘J`) |
| `netRevenue` | Net Revenue | `OBSERVED` | `shopi_orders` | `CanonicalMetricsService.getFinancialSummary` | $\sum (\text{total\_amount}) = \text{Gross} - \text{Discounts} + \text{Taxes} + \text{Shipping}$ | `COMPLETED`, `DELIVERED`, `PROCESSING` | `CANCELLED` | UTC / IST | Overview, Sales, Profitability (`/merchant/profitability`) |
| `totalOrders` | Total Orders | `OBSERVED` | `shopi_orders` | `CanonicalMetricsService.getFinancialSummary` | $\text{COUNT}(\text{DISTINCT } \text{order\_id})$ | `COMPLETED`, `DELIVERED`, `PROCESSING`, `PENDING` | `CANCELLED` | UTC / IST | Overview, Sales, Returns, Customer Intelligence, Copilot |
| `unitsSold` | Units Sold | `OBSERVED` | `shopi_order_items` | `CanonicalMetricsService.getFinancialSummary` | $\sum (\text{quantity})$ joined with qualifying orders | `COMPLETED`, `DELIVERED`, `PROCESSING` | `CANCELLED` | UTC / IST | Sales, Product Performance, Inventory |
| `averageOrderValue` | Average Order Value (AOV) | `CALCULATED` | `shopi_orders` | `CanonicalMetricsService.getFinancialSummary` | $\frac{\text{Net Paid Revenue}}{\text{Total Completed Orders}}$ | `COMPLETED`, `DELIVERED`, `PROCESSING` | `CANCELLED` | UTC / IST | Overview, Sales, Customer Intelligence, Copilot |
| `repeatBuyersCount` | Repeat Buyers Count | `OBSERVED` | `shopi_customers`, `shopi_orders` | `CanonicalMetricsService.getCustomerSummary` | $\text{COUNT}(\text{customer\_id})$ with $\ge 2$ completed orders | `COMPLETED`, `DELIVERED` | `CANCELLED` | UTC / IST | Customer Intelligence (`/merchant/customers`), Copilot |
| `oneTimeBuyersCount` | One-Time Buyers Count | `OBSERVED` | `shopi_customers`, `shopi_orders` | `CanonicalMetricsService.getCustomerSummary` | $\text{COUNT}(\text{customer\_id})$ with exactly 1 completed order | `COMPLETED`, `DELIVERED` | `CANCELLED` | UTC / IST | Customer Intelligence, Cohort Segmentation |
| `dormantCustomersCount` | Dormant Customers Count | `OBSERVED` | `shopi_customers`, `shopi_orders` | `CanonicalMetricsService.getCustomerSummary` | $\text{COUNT}(\text{customer\_id})$ with $>60$ days elapsed since last purchase | `COMPLETED`, `DELIVERED` | `CANCELLED` | UTC / IST | Customer Intelligence, Reactivation Opportunities |
| `highIntentProspectsCount`| High-Intent Prospects | `OBSERVED` | `shopi_customer_events`, `shopi_customers` | `CanonicalMetricsService.getCustomerSummary` | $\text{COUNT}(\text{customer\_id})$ with $\ge 3$ intent signals in event stream | `PRODUCT_VIEW`, `ADD_TO_CART`, `CHECKOUT_STARTED` | Converted Purchasers | UTC / IST | Customer Intelligence, Opportunity Matrix, Campaigns |
| `cartAbandonersCount` | Cart Abandoners | `OBSERVED` | `shopi_customer_events`, `shopi_orders` | `MerchantSupabaseService.getCartAbandoners` | Cart adds without subsequent order placement | `ADD_TO_CART` | Completed Orders | UTC / IST | Customer Intelligence, Recovery Campaigns |
| `checkoutAbandonersCount` | Checkout Abandoners | `OBSERVED` | `shopi_customer_events`, `shopi_orders` | `MerchantSupabaseService.getCheckoutAbandoners` | Checkout initiated without completed payment | `CHECKOUT_STARTED` | Completed Orders | UTC / IST | Customer Intelligence, Recovery Campaigns |
| `unitCogs` | Unit Cost of Goods Sold | `OBSERVED` | `shopi_product_cogs` | `MerchantSupabaseService.getProductCogs` | $\text{Manufacturing} + \text{Shipping} + \text{Packaging} + \text{Processing Fee}$ | Verified records (77/77 catalog coverage) | None | UTC / IST | Profitability Workspace, Financial Policy Service |
| `contributionProfit` | Contribution Profit | `CALCULATED` | `shopi_orders`, `shopi_order_items`, `shopi_product_cogs`, `shopi_order_returns` | `profitabilityEngine.computeProfitabilityOverview` | $\text{Net Revenue} - \text{COGS} - \text{Refunds} - \text{Variable Fulfillment}$ | `COMPLETED`, `DELIVERED` | `CANCELLED` | UTC / IST | Overview, Profitability Workspace, Recommendation Hub |
| `contributionMarginPct` | Contribution Margin (%) | `CALCULATED` | `shopi_orders`, `shopi_product_cogs` | `profitabilityEngine.computeProfitabilityOverview` | $\frac{\text{Contribution Profit}}{\text{Net Revenue}} \times 100$ | `COMPLETED`, `DELIVERED` | `CANCELLED` | UTC / IST | Profitability Workspace, Campaign Builder, Copilot |
| `trappedStagnantCapitalCost`| Trapped Working Capital | `CALCULATED` | `shopi_products`, `shopi_product_cogs`, `shopi_order_items` | `CanonicalMetricsService.getInventorySummary` | $\sum (\text{current\_stock} \times \text{total\_unit\_cost})$ for SKUs with velocity $\le 0.05$/day | Stagnant SKUs ($\text{vel} \le 0.05$) | Active SKUs | UTC / IST | Overview (`/merchant`), Stock Risk & Runway (`/merchant/inventory`) |
| `dailySalesVelocity` | Daily Sales Velocity | `CALCULATED` | `shopi_order_items`, `shopi_orders` | `CanonicalMetricsService.getInventorySummary` | $\frac{\sum (\text{Units Sold in Period})}{\text{Period Days (30d)}}$ | `COMPLETED`, `DELIVERED` | `CANCELLED` | UTC / IST | Inventory Workspace, Product Analytics |
| `daysStockCover` | Days of Stock Cover (Runway) | `CALCULATED` | `shopi_products`, `shopi_order_items` | `MerchantSupabaseService.getStockRunway` | $\frac{\text{Current Stock}}{\text{Daily Velocity}}$; `null` (`NOT_MEASURABLE`) if velocity $\le 0.05$ | Non-cancelled orders | None | UTC / IST | Inventory Workspace |
| `recommendedReorderUnits`| Recommended Restock Units | `CALCULATED` | `shopi_products`, `shopi_order_items` | `inventory-analytics.getLowStockProducts` | $\max(0, \lceil(\text{Target Cover} \times \text{Velocity}) - \text{Stock}\rceil)$; 0 if $\text{Stock} \ge \text{ROP}$ | Active SKUs | Overstocked SKUs | UTC / IST | Inventory Workspace, Decision Inbox |
| `overallReturnRatePct` | Delivered Return Rate (%) | `CALCULATED` | `shopi_order_returns`, `shopi_order_items` | `CanonicalMetricsService.getReturnsSummary` | $\frac{\text{COUNT}(\text{return\_id})}{\sum (\text{delivered units})} \times 100$ | `COMPLETED`, `DELIVERED` | `CANCELLED` | UTC / IST | Returns Workspace (`/merchant/returns`), Product Details |
| `overallCancellationRatePct`| Cancellation Rate (%) | `CALCULATED` | `shopi_orders` | `CanonicalMetricsService.getReturnsSummary` | $\frac{\text{Cancelled Orders}}{\text{Total Orders Placed}} \times 100$ | `CANCELLED`, `Cancelled` | Non-cancelled | UTC / IST | Returns Workspace |
| `campaignEligibleAudience`| Eligible Campaign Audience | `OBSERVED` | `shopi_customer_events`, `merchant_communication_eligibility` | `campaignBuilderService.buildCampaignFromRecommendation` | Segment population passing quiet hours & frequency limits | Eligible prospects | Opted-out / Fatigued | UTC / IST | Actions Workspace (`/merchant/actions`), Campaign Builder |
| `observedRevenueDeltaPct`| Revenue Growth Delta (%) | `CALCULATED` | `shopi_orders` | `CanonicalMetricsService.getFinancialSummary` | $\frac{\text{Current Gross} - \text{Previous Gross}}{\text{Previous Gross}} \times 100$ | `COMPLETED`, `DELIVERED` | `CANCELLED` | UTC / IST | Executive Overview, Sales Analytics, Copilot |
| `businessHealthScore` | Business Health Score (0-100) | `CALCULATED` | Multi-domain telemetry | `businessHealthScoreEngine.computeHealthScore` | Deterministic weighted score across 8 domains | Complete store telemetry | None | UTC / IST | Executive Overview, Pilot Dashboard (`/merchant/pilot`) |
| `priceElasticityScore` | Learned Price Elasticity | `MODEL_ESTIMATE` | Order history & pricing experiments | `bayesianPriceElasticityEngine.getOrLearnProductElasticity` | Bayesian posterior log-log regression ($\epsilon = \frac{\% \Delta Q}{\% \Delta P}$) | Historical transactions | Outliers | UTC / IST | What-If Simulator, Pricing Recommendations |
| `simulatedProfitDelta` | Simulated Impact Delta | `MODEL_ESTIMATE` | What-If Simulator | `whatIfSimulatorEngine.runSimulation` | Projected revenue and contribution margin under parameter changes | Hypothetical scenarios | None | UTC / IST | What-If Simulator, Recommendation Impact Cards |

---

## 3. Data Freshness & Refresh Protocol

1. **Continuous Real-Time Telemetry:** Orders, order items, and returns are grounded in real-time transactions (`shopi_orders`, `shopi_order_items`, `shopi_order_returns`).
2. **Deterministic Computation:** No metrics are estimated using random numbers or hardcoded mock constants.
3. **Graceful Fallbacks:** If a product lacks verified COGS, financial intelligence explicitly emits `DATA_UNAVAILABLE` rather than guessing margins.
4. **Provenance Metadata In Response:** Every `/api/merchant/*` payload includes `dataFreshness.provenance` records detailing the exact data sources, formulas, and calculation timestamps.
