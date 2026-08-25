# Merchant OS Phase 4 — Business & Commerce Workspace Implementation Plan

> **Scope**: Redesign and implement the primary Business and Commerce workspace pages for the Merchant OS:
> 1. `/merchant/sales` (Sales Analytics & Revenue Drivers)
> 2. `/merchant/profitability` (COGS, Contribution Margin & Net Profitability)
> 3. `/merchant/customers` (Customer Health, Cohorts & CLV Retention)
> 4. `/merchant/products` (Catalog Management, Velocity & SKU Matrix)
> 5. `/merchant/inventory` (Stockout Risk, Coverage & Reorder Operations)
> 6. `/merchant/orders` (Operational Order & Settlement Ledger — **BLOCKED / DATA GAP**)
> 7. `/merchant/returns` (Returns Diagnostics, Refund Loss & Quality Analysis)

---

## 1. Executive Architectural Overview & Design System Consistency

All pages inherit the **exact visual identity and design system** established and verified on the `/merchant` Overview dashboard. Every screen reflects the restrained, dense, analytical aesthetic of **Shopify Admin + Stripe Dashboard + Linear**.

### 1.1 Visual & Token Constraints
- **Canvas & Surface Palette**:
  - Background: `#F8FAFC` (`bg-slate-50`)
  - Surface Cards: `#FFFFFF` (`bg-white`)
  - Border System: 1px solid `#E2E8F0` (`border-slate-200/90`)
  - Text Primary: `#0F172A` (`text-slate-900 font-medium`)
  - Text Muted: `#64748B` (`text-slate-500`)
  - Text Micro-labels: `#94A3B8` (`text-slate-400 font-mono text-[10px]`)
- **Semantic Data Colors Only**:
  - Growth / Positive / Reconciled: Emerald (`text-emerald-700`, `bg-emerald-50`, `border-emerald-200`)
  - Warning / At-Risk: Amber (`text-amber-800`, `bg-amber-50`, `border-amber-200`)
  - Critical / Stockout / Loss: Rose (`text-rose-700`, `bg-rose-50`, `border-rose-200`)
  - Interaction / Action / Focus: Slate & Indigo (`bg-slate-900 text-white`, `border-indigo-200 text-indigo-700`)
- **Geometry & Spacing**:
  - Radius: Strict 8px (`rounded-lg`) for primary cards, 6px (`rounded-md`) for controls and table inputs.
  - Shadow: Micro-border shadow (`shadow-2xs`), zero heavy drop shadows.
  - Information Density: Fixed card padding (`p-4.5`), compact table rows (`py-2 px-2.5`), grid spacing (`gap-3.5` to `gap-4`).
- **Typography & Alignment**:
  - Inter / System Sans hierarchy with strict tabular numbers (`tabular-nums font-mono`) for all monetary values, percentages, and unit counts.
  - Uppercase tracked section headers (`text-xs font-bold text-slate-900 uppercase tracking-wider`).
- **AI Subordination**:
  - AI is never a giant hero banner. It appears as an analytical annotation card or contextual trigger leading to the global slide-over Copilot drawer (`⌘J` / `Ctrl+J`).

---

## 2. API & Data Contract Verification

Every proposed endpoint was verified against actual backend route handlers, TypeScript types, and database queries in `storefront/apps/ecommerce-backend/`.

| Page | Endpoint | Method | Exists | Actual Fields Verified | Data Gaps Identified | Frontend Ready |
| :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| **Sales** | `/api/merchant/sales`<br/>`/api/merchant/categories`<br/>`/api/merchant/overview` | `GET` | **YES** | `dataPoints` (`date`, `orders`, `unitsSold`, `grossRevenue`, `netRevenue`, `averageOrderValue`), `growth` (`monthOverMonth`, `weekOverWeek`), `categories` (`categoryName`, `unitsSold`, `grossRevenue`, `revenueSharePct`). | None. All metrics directly supported. | **READY (A)** |
| **Profitability** | `/api/merchant/ai/profitability`<br/>`/api/merchant/categories` | `GET` | **YES** | `totalNetRevenue`, `totalEstimatedCogs`, `totalDiscounts`, `totalRefunds`, `totalShippingCost`, `totalFulfillmentCost`, `totalContributionProfit`, `overallContributionMarginPct`, `overallGrossMarginPct`, `products[]` (`unitCogs`, `totalCogs`, `contributionProfit`, `contributionMarginPct`, `grossMarginPct`, `profitPerUnit`, `profitabilityTier`), `categories[]`. | None. Comprehensive product, category, and cost breakdown verified. | **READY (A)** |
| **Customers** | `/api/merchant/customers` | `GET` | **YES** | `summary` (`totalRegisteredCustomers`, `totalActiveBuyers`, `repeatBuyersCount`, `repeatCustomerRatePct`, `averageCustomerLifetimeValue`, `topCity`), `cohorts[]` (`orderCountRange`, `customersCount`, `totalRevenueContribution`, `percentageOfCustomers`), `topBuyerSamples[]` (`userId`, `username`, `totalOrders`, `totalSpend`, `firstPurchaseDate`, `lastPurchaseDate`). | Separate `/ai/customers/value` & `/risk` endpoints do not exist; all data is consolidated in canonical `/customers`. | **READY (A)** |
| **Products** | `/api/merchant/products`<br/>`/api/merchant/categories` | `GET` | **YES** | `topProducts[]` & `worstProducts[]` (`productId`, `title`, `categoryName`, `price`, `discount`, `unitsSold`, `revenue`, `ordersCount`, `returnsCount`, `returnRatePct`, `currentStock`, `salesVelocity7d`). | Product `SKU` is formatted as `SKU-${productId}` (no separate DB column). | **READY (A)** |
| **Inventory** | `/api/merchant/inventory`<br/>`/api/merchant/ai/actions` | `GET` | **YES** | `summary` (`criticalCount`, `warningCount`, `healthyCount`), `criticalStock[]`, `lowStock[]`, `allTrackedStock[]` (`productId`, `title`, `categoryName`, `currentStock`, `dailyVelocity7d`, `estimatedDaysRemaining`, `restockRecommendedUnits`, `urgency`: `CRITICAL`/`WARNING`/`HEALTHY`), `velocityMatrix[]`. | None. Stockout risk, coverage days, and replenishment units verified. | **READY (A)** |
| **Orders** | `/api/merchant/orders` (Proposed) | `GET` | ❌ **NO** | `totalOrders` is in `/overview` and `/sales`. Individual order listing ledger is **NOT** exposed to merchant API layer. | **[DATA GAP]**: Missing `GET /api/merchant/orders` endpoint for merchant order ledger. Missing pre-aggregated `averageDeliveryDays`, `fulfillmentRate`, and `reconciledRate`. | ❌ **BLOCKED (C)** |
| **Returns** | `/api/merchant/returns`<br/>`/api/merchant/ai/profitability` | `GET` | **YES** | `returns` (`totalDeliveredItems`, `totalReturnedItems`, `overallReturnRatePct`, `totalRefundAmount`, `reasonBreakdown[]`, `highestReturnProducts[]`), `cancellations` (`totalOrders`, `totalCancellations`, `cancellationRatePct`, `reasonBreakdown[]`). | None. Return rates, refund losses, reason distributions, product lists, and cancellations verified. | **READY (A)** |

---

## 3. Implementation Boundary

### Category A: Fully Implementable Immediately (Verified Canonical APIs)
The following **6 pages** have 100% verified backend APIs, validated schemas, and zero data gaps:
1. **`/merchant/sales`**
2. **`/merchant/profitability`**
3. **`/merchant/customers`**
4. **`/merchant/products`**
5. **`/merchant/inventory`**
6. **`/merchant/returns`**

### Category B / C: Blocked (Requires Backend API Contract)
The following **1 page** is blocked from frontend implementation to prevent mock/fabricated data:
- **`/merchant/orders`**:
  - *Reason*: There is no merchant-scoped order listing endpoint in `routes/merchant.ts`.
  - *Required Backend API Contract*:
    - Endpoint: `GET /api/merchant/orders`
    - Query Parameters: `?page=1&limit=50&status=all&search=`
    - Response Schema:
      ```typescript
      interface MerchantOrdersResponse {
        success: boolean;
        totalOrders: number;
        page: number;
        limit: number;
        orders: Array<{
          orderId: number;
          orderCode: string;
          createdAt: string;
          customerName: string;
          customerEmail: string;
          totalAmount: number;
          orderStatus: 'Confirmed' | 'Delivered' | 'Pending' | 'Cancelled';
          paymentMethod: string;
          reconciliationStatus: 'RECONCILED' | 'PENDING';
          itemCount: number;
          itemsSummary: string;
        }>;
      }
      ```
  - *Action*: **Defer `/merchant/orders` until backend API is implemented in a controlled backend phase. Do NOT implement `/merchant/orders` with mock data.**

---

## 4. Page-by-Page Specifications (Verified Ready Pages)

---

### Page 1: Sales Analytics (`/merchant/sales`)
- **Purpose**: Granular insight into top-line revenue performance, temporal sales patterns, channel/category mix, and historical growth velocity.
- **KPI Row**: Gross Revenue (`[FACT]`), Net Revenue (`[FACT]`), Total Orders (`[FACT]`), Average Order Value (`[FACT]`).
- **Analytics Grid**:
  - Left (2/3): Multi-Series Sales Trend Chart (`dataPoints`) with selectable intervals (Daily, Weekly, Monthly), solid current curve vs. dashed comparison baseline.
  - Right (1/3): Sales Drivers & AI Summary Card with category growth bullet points and contextual trigger `Ask AI: "Why did revenue change?"`.
- **Tables**: Category Breakdown Matrix (`categories`) + Periodic Sales Summary Table (`dataPoints`).
- **API**: `GET /api/merchant/sales`, `GET /api/merchant/categories`, `GET /api/merchant/overview`.

---

### Page 2: Profitability & Margins (`/merchant/profitability`)
- **Purpose**: Financial view of store profitability, unpacking COGS, supplier costs, shipping/handling expenses, return friction, and net contribution margins.
- **KPI Row**: Net Contribution Margin % (`[FACT]`), Total COGS & Supplier Cost (`[FACT]`), Gross Profit Margin % (`[FACT]`), Return & Discount Friction (`[FACT]`).
- **Analytics Grid**:
  - Left (2/3): Margin Structure & Cost Waterfall (Gross Revenue ➔ COGS ➔ Discounts ➔ Returns ➔ Net Contribution Profit).
  - Right (1/3): Profitability Risk Callout (`Ask AI: "What compressed my margin?"`).
- **Tables**: Product Contribution Margin Table (`products[]`) + Category Profitability Matrix (`categories[]`).
- **API**: `GET /api/merchant/ai/profitability?periodDays=30`, `GET /api/merchant/categories`.

---

### Page 3: Customer Intelligence & Retention (`/merchant/customers`)
- **Purpose**: Customer health, repeat buying velocity, customer lifetime value (CLV), and cohort retention.
- **KPI Row**: Total Active Buyers (`[FACT]`), Repeat Customer Rate % (`[FACT]`), Average Customer LTV (`[FACT]`), Total Registered Customers (`[FACT]`).
- **Analytics Grid**:
  - Left (2/3): Repeat Buyer Order Frequency Matrix (`cohorts[]`: 1 order, 2–3 orders, 4–6 orders, 7+ orders).
  - Right (1/3): Customer Retention Diagnostics (`Ask AI: "Which customer segment needs attention?"`).
- **Tables**: Top VIP Customer Value Table (`topBuyerSamples[]`).
- **API**: `GET /api/merchant/customers?period={period}`.

---

### Page 4: Catalog & Product Intelligence (`/merchant/products`)
- **Purpose**: Operational catalog management, monitoring revenue, volume, velocity, return rates, and stock status.
- **KPI Row**: Active Catalog SKUs (`[FACT]`), Top Revenue Driver (`[FACT]`), Average Catalog Margin % (`[FACT]`), Catalog Return Rate % (`[FACT]`).
- **Tables**: Dense Enterprise Catalog Table (`topProducts[]` & `worstProducts[]`) with search, category filter, sorting, and pagination.
- **Bottom Panels**: Top 5 Revenue Drivers vs. Worst Performing Items.
- **API**: `GET /api/merchant/products?limit=50&sortBy=revenue`, `GET /api/merchant/categories`.

---

### Page 5: Inventory & Replenishment (`/merchant/inventory`)
- **Purpose**: Mission-critical inventory health and supply-chain operations, tracking stock levels, daily burn velocity, stockout forecasts, and replenishment.
- **KPI Row**: Critical Stockouts (`[FORECAST]` Rose), Low Stock Warnings (`[FORECAST]` Amber), Healthy Inventory SKUs (`[FACT]`), Total Checked SKUs (`[FACT]`).
- **Tables**: Stockout Risk & Replenishment Operations Table (`criticalStock[]` & `lowStock[]` with stock, velocity, days remaining, urgency tag, recommended restock units) + Inventory Velocity Matrix (`velocityMatrix[]`).
- **Action Trigger**: Direct trigger to Merchant Action Engine (`POST /api/merchant/ai/actions/{id}/approve`).
- **API**: `GET /api/merchant/inventory?threshold=200`, `GET /api/merchant/ai/actions`.

---

### Page 6: Returns & Quality Diagnostics (`/merchant/returns`)
- **Purpose**: Root-cause diagnostic workspace for return rates, cancellation patterns, refund capital losses, and product quality anomalies.
- **KPI Row**: Store Return Rate % (`[FACT]`), Total Refund Capital Loss (`[FACT]`), Returned Units (`[FACT]`), Order Cancellation Rate % (`[FACT]`).
- **Analytics Grid**:
  - Left (2/3): Return Reason Distribution Breakdown (`returns.reasonBreakdown[]`).
  - Right (1/3): Cancellation Reason Diagnostics (`cancellations.reasonBreakdown[]`) + `Ask AI: "Why are returns increasing?"`.
- **Tables**: High-Return Product Diagnostic Table (`highestReturnProducts[]`).
- **API**: `GET /api/merchant/returns?period=last_30_days`, `GET /api/merchant/ai/profitability`.

---

## 5. Component Architecture & Reusability Matrix

| Component | Shared Across Pages | Customization / Props |
| :--- | :--- | :--- |
| **`AppShell`** | All pages | Master responsive shell, 224px sidebar (>=1024px), mobile drawer (<1024px), 48px TopBar, Copilot drawer. |
| **`TopBar`** | All pages | Dynamic breadcrumb (`Merchant AI / Sales`, `Merchant AI / Profitability`, etc.), sync status, Ask AI. |
| **`KpiMetricCard`** | All pages | Equal height (`h-28`), tabular numbers, period comparison deltas, inline `TrustBadge`. |
| **`TrustBadge`** | All pages | Subdued metadata tags: `[FACT]`, `[AI INSIGHT]`, `[FORECAST]`, `[RECOMMENDATION]`. |
| **`AnalyticalChartCard`** | Sales, Profitability, Returns | Multi-series area/line charts, interval toggles (Daily/Weekly/Monthly), Y/X axes, hover tooltips. |
| **`AiSummaryCard`** | Sales, Profitability, Customers, Returns | Subordinate analytical annotation widget with narrative text, bulleted drivers, risk callout, and `Ask AI` shortcut. |
| **`DataTable` (Dense)** | Products, Inventory, Returns, Sales | Standardized enterprise table wrapper with `border-slate-200/90`, `bg-slate-50/50` header, hover row fills, and `min-w` cell constraints. |
| **`CopilotDrawer`** | All pages | Global slide-over AI assistant (`⌘J` / `Ctrl+J`) grounded in canonical merchant telemetry with live action approval. |

---

## 6. Updated Phase 4 Implementation Order

To maintain strict data integrity and prevent any mock data creation, implementation proceeds in 3 controlled batches:

1. **Batch 1 (Commerce Analytics)**:
   - `/merchant/sales`
   - `/merchant/profitability`
2. **Batch 2 (Merchandise & Supply Chain)**:
   - `/merchant/products`
   - `/merchant/inventory`
3. **Batch 3 (Customer & Quality Intelligence)**:
   - `/merchant/customers`
   - `/merchant/returns`
4. **Deferred**:
   - `/merchant/orders` (Deferred until dedicated backend endpoint `GET /api/merchant/orders` is created in an approved backend phase).

---

**STATUS: API & Data Contract Verification Complete. Ready for review.**
