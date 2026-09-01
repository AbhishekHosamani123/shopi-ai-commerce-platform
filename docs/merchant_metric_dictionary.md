# CANONICAL MERCHANT AI METRIC DICTIONARY

**Phase:** Phase 12 — Data Truth & Reconciliation  
**Source of Truth:** Canonical Supabase Commerce Dataset (`shopi_*` tables)  
**Architecture:** Supabase Data Layer $\rightarrow$ Merchant Data Services $\rightarrow$ Canonical Metrics Service $\rightarrow$ Intelligence Engines $\rightarrow$ APIs $\rightarrow$ Frontend Workspaces  

---

## 1. Executive Revenue & Order Metrics

### 1. Gross Revenue
- **Classification:** `OBSERVED`
- **Source Table(s):** `shopi_orders.subtotal_amount` or $\sum (\text{shopi\_order\_items.line\_total})$
- **Formula:** $\sum (\text{item\_quantity} \times \text{unit\_selling\_price})$ for qualifying orders in period.
- **Denominator:** None (Monetary Sum)
- **Included Statuses:** `COMPLETED`, `DELIVERED`, `PROCESSING`, `PENDING`
- **Excluded Statuses:** `CANCELLED`, `Cancelled`
- **Timezone:** UTC / Storefront Local (IST)
- **Shared Workspaces:** Executive Overview (`/merchant`), Sales Analytics (`/merchant/sales`), Merchant Copilot (`⌘J`).

### 2. Net Revenue
- **Classification:** `OBSERVED`
- **Source Table(s):** `shopi_orders.total_amount`
- **Formula:** $\text{Gross Revenue} - \text{Discounts} + \text{Taxes} + \text{Shipping}$
- **Denominator:** None (Monetary Sum)
- **Included Statuses:** `COMPLETED`, `DELIVERED`, `PROCESSING`
- **Excluded Statuses:** `CANCELLED`, `Cancelled`
- **Timezone:** UTC / Storefront Local (IST)
- **Shared Workspaces:** Executive Overview (`/merchant`), Sales Analytics (`/merchant/sales`), Profitability (`/merchant/profitability`).

### 3. Orders (Order Volume)
- **Classification:** `OBSERVED`
- **Source Table(s):** `shopi_orders.order_id`
- **Formula:** $\text{COUNT}(\text{DISTINCT } \text{order\_id})$
- **Denominator:** None (Integer Count)
- **Included Statuses:** `COMPLETED`, `DELIVERED`, `PROCESSING`, `PENDING`
- **Excluded Statuses:** `CANCELLED`, `Cancelled`
- **Timezone:** UTC / Storefront Local (IST)
- **Shared Workspaces:** Overview, Sales, Returns, Customer Intelligence, Copilot.

### 4. Units Sold
- **Classification:** `OBSERVED`
- **Source Table(s):** `shopi_order_items.quantity` joined with qualifying `shopi_orders`
- **Formula:** $\sum (\text{shopi\_order\_items.quantity})$
- **Denominator:** None (Integer Count)
- **Included Statuses:** Non-cancelled orders
- **Excluded Statuses:** `CANCELLED`
- **Timezone:** UTC / Storefront Local (IST)
- **Shared Workspaces:** Sales Analytics, Product Performance, Inventory Runway.

### 5. Average Order Value (AOV)
- **Classification:** `CALCULATED`
- **Source Table(s):** `shopi_orders`
- **Formula:** $\frac{\text{Net Paid Revenue}}{\text{Total Completed Orders}}$ (or $\frac{\text{Gross Revenue}}{\text{Total Orders}}$ for Gross AOV)
- **Denominator:** Total Qualifying Orders in Selected Period
- **Included Statuses:** `COMPLETED`, `DELIVERED`, `PROCESSING`
- **Excluded Statuses:** `CANCELLED`, `Cancelled`
- **Timezone:** UTC / Storefront Local (IST)
- **Shared Workspaces:** Overview, Sales, Customer Intelligence, Copilot.

---

## 2. Customer Cohorts & Intelligence Metrics

### 6. Active Customer (Active Purchaser)
- **Classification:** `OBSERVED`
- **Source Table(s):** `shopi_customers` joined with `shopi_orders`
- **Formula:** Customer with $\ge 1$ completed order in history.
- **Denominator:** None (Integer Count)
- **Included Statuses:** Non-cancelled orders
- **Shared Workspaces:** Executive Overview, Customer Value & Retention Workspace.

### 7. Repeat Buyer
- **Classification:** `OBSERVED`
- **Source Table(s):** `shopi_customers` joined with `shopi_orders`
- **Formula:** Customer with $\ge 2$ completed qualifying orders in history.
- **Denominator:** None (Integer Count = 38 customers in canonical dataset)
- **Included Statuses:** `COMPLETED`, `DELIVERED`
- **Shared Workspaces:** Customer Intelligence (`/merchant/customers`), Opportunity Matrix, Copilot.

### 8. One-Time Buyer
- **Classification:** `OBSERVED`
- **Source Table(s):** `shopi_customers` joined with `shopi_orders`
- **Formula:** Customer with exactly 1 completed qualifying order in history (17 customers).
- **Denominator:** None (Integer Count)
- **Shared Workspaces:** Customer Intelligence, Cohort Segmentation.

### 9. Dormant Customer
- **Classification:** `OBSERVED`
- **Source Table(s):** `shopi_customers`, `shopi_orders`
- **Formula:** Prior purchaser with $>60$ days elapsed since most recent completed order (20 customers).
- **Denominator:** None (Integer Count)
- **Shared Workspaces:** Customer Intelligence, Reactivation Opportunities.

### 10. High-Intent Customer (High-Intent Prospect)
- **Classification:** `OBSERVED`
- **Source Table(s):** `shopi_customer_events`, `shopi_customers`
- **Formula:** Customer with $\ge 3$ intent signals (`PRODUCT_VIEW`, `ADD_TO_CART`, `CHECKOUT_STARTED`) across sessions without recent purchase (83 prospects).
- **Denominator:** None (Integer Count)
- **Shared Workspaces:** Customer Intelligence, Commercial Opportunities, Campaign Builder.

### 11. Cart Abandoner
- **Classification:** `OBSERVED`
- **Source Table(s):** `shopi_customer_events` (`ADD_TO_CART`), `shopi_orders`
- **Formula:** Added product to cart with no subsequent completed order (25 customers).
- **Denominator:** None (Integer Count)
- **Shared Workspaces:** Customer Intelligence, Abandoned Cart Campaigns.

### 12. Checkout Abandoner
- **Classification:** `OBSERVED`
- **Source Table(s):** `shopi_customer_events` (`CHECKOUT_STARTED`), `shopi_orders`
- **Formula:** Initiated checkout with no completed order payment (20 customers).
- **Denominator:** None (Integer Count)
- **Shared Workspaces:** Customer Intelligence, Checkout Recovery Campaigns.

### 13. Product Conversion Rate
- **Classification:** `CALCULATED`
- **Source Table(s):** `shopi_order_items`, `shopi_customer_events`
- **Formula:** $\frac{\text{Unique Customers Purchased Product}}{\text{Unique Customers Viewed Product}} \times 100$
- **Denominator:** Total Unique Product View Sessions
- **Shared Workspaces:** Product Performance (`/merchant/products`), Merchandising Intelligence.

---

## 3. Product, Inventory & Supply Chain Metrics

### 14. Return Rate (%)
- **Classification:** `CALCULATED`
- **Source Table(s):** `shopi_order_returns`, `shopi_order_items`, `shopi_orders`
- **Formula:** $\frac{\text{COUNT}(\text{return\_id})}{\sum (\text{qualifying delivered units})} \times 100$
- **Denominator:** Total Qualifying Delivered Units in Period (e.g. 4 returns / 82 units = 4.88% in 30d)
- **Shared Workspaces:** Returns Workspace (`/merchant/returns`), Product Performance.

### 15. Cancellation Rate (%)
- **Classification:** `CALCULATED`
- **Source Table(s):** `shopi_orders`
- **Formula:** $\frac{\text{Cancelled Orders}}{\text{Total Orders Placed}} \times 100$
- **Denominator:** Total Orders Placed in Period
- **Shared Workspaces:** Returns & Health Diagnostics.

### 16. Cost of Goods Sold (COGS)
- **Classification:** `OBSERVED` (Unit Cost) / `CALCULATED` (Aggregate COGS)
- **Source Table(s):** `shopi_product_cogs` (`total_unit_cost`, `unit_manufacturing_cost`, `unit_shipping_cost`, `unit_packaging_cost`)
- **Formula:** $\text{Unit COGS} = \text{Manufacturing} + \text{Shipping} + \text{Packaging} + \text{Payment Fee}$; $\text{Aggregate COGS} = \sum (\text{Units Sold} \times \text{Unit COGS})$.
- **Coverage:** 77 of 77 canonical products have verified COGS records.
- **Shared Workspaces:** Profitability Workspace (`/merchant/profitability`), Financial Safety Calculator.

### 17. Contribution Profit
- **Classification:** `CALCULATED`
- **Source Table(s):** `shopi_orders`, `shopi_order_items`, `shopi_product_cogs`, `shopi_order_returns`
- **Formula:** $\text{Net Revenue} - \text{COGS} - \text{Refunds} - \text{Variable Fulfillment}$
- **Denominator:** None (Monetary Sum)
- **Shared Workspaces:** Executive Overview, Profitability Workspace, Recommendation Hub.

### 18. Contribution Margin (%)
- **Classification:** `CALCULATED`
- **Source Table(s):** `shopi_orders`, `shopi_product_cogs`
- **Formula:** $\frac{\text{Contribution Profit}}{\text{Net Revenue}} \times 100$
- **Safety Policy:** Minimum contribution margin floor is **15.0%**. Unsafe discount actions violating this floor are blocked.
- **Shared Workspaces:** Profitability, Campaign Builder, Copilot.

### 19. Trapped Working Capital (Stagnant Inventory)
- **Classification:** `CALCULATED`
- **Source Table(s):** `shopi_products`, `shopi_product_cogs`, `shopi_order_items`
- **Formula:** $\sum (\text{current\_stock} \times \text{total\_unit\_cost})$ for products with 30-day daily velocity $\le 0.05$ units/day (₹8,82,450 at cost).
- **Denominator:** None (Monetary Sum at Unit Cost)
- **Shared Workspaces:** Executive Overview, Stock Risk & Runway (`/merchant/inventory`).

### 20. Inventory Velocity (Daily Sales Velocity)
- **Classification:** `CALCULATED`
- **Source Table(s):** `shopi_order_items`, `shopi_orders`
- **Formula:** $\frac{\sum (\text{Units Sold in Period})}{\text{Period Days (30d)}}$
- **Policy:** If velocity $\le 0.05$ units/day, velocity is near-zero and runway is designated as `NOT_MEASURABLE`.
- **Shared Workspaces:** Inventory Workspace, Product Analytics.

### 21. Inventory Cover / Runway (Days of Cover)
- **Classification:** `CALCULATED`
- **Source Table(s):** `shopi_products`, `shopi_order_items`
- **Formula:** $\frac{\text{Current Stock Quantity}}{\text{Daily Sales Velocity}}$
- **Edge Case Policy:** If velocity $\le 0.05$, days of cover is `null` (`NOT_MEASURABLE`). No fabricated numbers (1667d/5000d) are permitted.
- **Shared Workspaces:** Inventory Workspace.

### 22. Reorder Quantity (Economic Restock Target)
- **Classification:** `CALCULATED`
- **Source Table(s):** `shopi_products`, `shopi_order_items`
- **Formula:** $\max(0, \lceil(\text{Target Cover Days} \times \text{Velocity}) - \text{Current Stock}\rceil)$. If current stock exceeds Reorder Point ($\text{ROP} = (\text{Lead Time} + \text{Safety Buffer}) \times \text{Velocity}$), recommended reorder is **0 units**.
- **Shared Workspaces:** Inventory Workspace, Priority Decision Inbox.

---

## 4. Marketing, Optimization & Health Diagnostics

### 23. Campaign Eligible Audience
- **Classification:** `OBSERVED`
- **Source Table(s):** `shopi_customer_events`, `shopi_customers`, `merchant_communication_eligibility`
- **Formula:** Qualifying prospects in target segment passing frequency capping, quiet hours, and channel opt-in constraints.
- **Shared Workspaces:** Unified Action Center (`/merchant/actions`), Campaign Builder.

### 24. Observed Revenue Delta (% Period Change)
- **Classification:** `CALCULATED`
- **Source Table(s):** `shopi_orders`
- **Formula:** $\frac{\text{Current Period Gross Revenue} - \text{Preceding Period Gross Revenue}}{\text{Preceding Period Gross Revenue}} \times 100$
- **Comparison Windows:**
  - 30d: `vs Preceding 30 Days (T-30 to T-60)`
  - 7d: `vs Preceding 7 Days (T-7 to T-14)`
  - MoM: `vs Previous Calendar Month`
- **Shared Workspaces:** Executive Overview, Sales Analytics, Copilot.

### 25. AI Business Health Score
- **Classification:** `CALCULATED`
- **Source Table(s):** Multi-domain telemetry (Revenue, Margins, Inventory, Customer, Operations, Marketing, Working Capital, Forecasting)
- **Formula:** Weighted deterministic score (0–100) across 8 operational dimensions.
- **Shared Workspaces:** Executive Overview, Health Scorecard (`/merchant/pilot`).
