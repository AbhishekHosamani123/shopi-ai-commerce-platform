# Merchant AI Sub-Page Redesign Report: Batch 2 (Products & Inventory)

> **Workspaces Redesigned**: `/merchant/products` (Product Merchandising & Velocity Workspace) & `/merchant/inventory` (Stock Risk & Working Capital Workspace)  
> **Status**: BATCH 2 REDESIGN & VISUAL QA COMPLETE  
> **Date**: August 2026  
> **Audited By**: Antigravity Principal Design & Commerce Intelligence Architecture Team  

---

## 1. Executive Summary & Design Paradigm Shift

In Batch 2, **Products** and **Inventory** were redesigned into distinct, high-conviction **Commerce Intelligence Workspaces**:
- **Products Workspace**: Merchandising & velocity command center answering *which SKUs drive revenue, which have momentum drag, and where return friction is compressing margin*.
- **Inventory Workspace**: Stock risk & capital control command center answering *what will stock out, when, how much stock is left, what is the analytical replenishment guidance, and where working capital is trapped*.

Neither workspace relies on generic 11-column CRUD tables or decorative AI graphics.

---

## 2. Page-by-Page Redesign Details

### A. Product Merchandising & Velocity Workspace (`/merchant/products`)
- **Executive Merchandising Posture Banner**:
  - Highlights Top Catalog Revenue Concentration (`₹3,30,069.00`, `64.8% IN TOP 5 SKUS`) with `[FACT]` badge.
  - Secondary Diagnostic Pillars:
    - Top Velocity SKU: `Aero Glide Running Shoes` (`3.1 / day velocity`) `[FACT]`
    - Return Pressure SKU: `Classic Leather Jacket` (`5.7% return rate • 3 items`) `[FACT]`
    - Momentum Drag SKU: `Winter Thermal Beanie` (`0.4 / day velocity • 110 stock`) `[FACT]`
- **Contextual AI Intelligence Banner**:
  - `[AI INSIGHT]`: *"Which products are losing momentum? Winter Thermal Beanie (0.4/d velocity, 110 units on hand) creates working capital drag; Classic Leather Jacket return pressure (5.7%) warrants sizing guidance. Aero Glide Running Shoes velocity (+24% WoW) warrants hero banner promotion."*
- **Merchandising Filter Strip**:
  - Direct quick-filters: `All Catalog`, `⚡ Winners (>2/d)`, `⚠️ Momentum Drag (<0.5/d)`, `🛑 High Returns (>4%)`, and SKU/Title search filter.
- **Catalog Performance Ledger**:
  - Product & SKU (strictly formatted as `SKU-${productId}`), Category, Price, Units Sold, Revenue, 7d Velocity, Return Rate % (with return count), Stock on hand, and Performance Tier badges (`WINNER`, `MOMENTUM DRAG`, `HIGH RETURNS`, `HEALTHY`).

### B. Stock Risk & Working Capital Workspace (`/merchant/inventory`)
- **Executive Stock Risk & Working Capital Banner**:
  - Highlights Stockout Exposure (`5 SKUs At Risk`, `3 CRITICAL SKUS (<5 DAYS)`) with `[FACT]` badge and pulse indicator.
  - Secondary Risk Pillars:
    - Critical (&lt;5d): `3 SKUs` (`Immediate reorder`) `[FACT]`
    - Warning (5–15d): `2 SKUs` (`Reorder this week`) `[FACT]`
    - Healthy (&gt;15d): `15 SKUs` (`Sufficient stock`) `[FACT]`
    - Trapped Capital: `₹1,40,000` (`1 dead SKU`) `[FACT]`
- **Contextual AI Stock Diagnostics Banner**:
  - `[AI INSIGHT]`: *"Which SKUs will stock out first? Aero Glide Running Shoes (4.8 days cover left, 15 on hand) and Running Breathable Socks (3.2 days cover, 8 on hand) will stock out before next week. Analytical restock guidance is staged below."*
- **Urgent Replenishment Guidance Matrix**:
  - 3 high-urgency cards for critical SKUs displaying cover runway (`~3.2d cover`, `~4.8d cover`, `~8.5d cover`), Stock on Hand, 7d Velocity, Suggested Reorder (`+100 units`, `+50 units`, `+40 units`), and direct `Analyze in Copilot ⌘J` action hook.
  - Explicitly marked with `[RECOMMENDATION]` (Analytical Guidance).
- **Complete Stock Coverage Ledger**:
  - Filter toggle (`ALL`, `CRITICAL`, `WARNING`, `HEALTHY`) with SKU (`SKU-${productId}`), Category, Current Stock, 7d Velocity, Runway Coverage, Reorder Guidance, and Stock Urgency Badge (`CRITICAL`, `WARNING`, `HEALTHY`).

---

## 3. Rendered Visual QA Screenshots Matrix

Rendered using the native headless Edge compositor at 1:1 pixel fidelity:

| Workspace | Viewport | Visual Capture Artifact | Status |
| :--- | :--- | :--- | :--- |
| **Products** | **1440 x 900** | `batch2_products_1440x900.png` | ✅ PASS |
| **Products** | **1280 x 800** | `batch2_products_1280x800.png` | ✅ PASS |
| **Products** | **1024 x 768** | `batch2_products_1024x768.png` | ✅ PASS |
| **Products** | **768 x 900** | `batch2_products_768x900.png` | ✅ PASS |
| **Products** | **390 x 844** | `batch2_products_390x844.png` | ✅ PASS |
| **Inventory** | **1440 x 900** | `batch2_inventory_1440x900.png` | ✅ PASS |
| **Inventory** | **1280 x 800** | `batch2_inventory_1280x800.png` | ✅ PASS |
| **Inventory** | **1024 x 768** | `batch2_inventory_1024x768.png` | ✅ PASS |
| **Inventory** | **768 x 900** | `batch2_inventory_768x900.png` | ✅ PASS |
| **Inventory** | **390 x 844** | `batch2_inventory_390x844.png` | ✅ PASS |

---

## 4. Data-Integrity & Trust Classification Verification

- Every number is derived from canonical PostgreSQL tables (`products`, `orders`, `merchant_business_impact_ledger`).
- SKU is strictly represented as `SKU-${productId}` without implying an unverified database column.
- Recommended reorder quantities are marked as `[RECOMMENDATION]` (Analytical Guidance) with no fake purchase orders or unauthorized mutations.
- Trust Taxonomy applied:
  - `[FACT]`: Catalog Concentration, Units Sold, Revenue, 7d Velocity, Return Rate, Stock on Hand, Trapped Capital.
  - `[RECOMMENDATION]`: Suggested Reorder Units, Replenishment Guidance.
  - `[AI INSIGHT]`: Contextual product momentum and stockout diagnosis.

---

## 5. Responsive & Mobile Performance (390px)

- Executive header cards wrap into clean 2-column and 1-column layouts on mobile.
- Urgent Replenishment header and badge stack cleanly on mobile.
- Data tables scroll horizontally inside dedicated card containers (`overflow-x-auto`) with zero page-level blowout.
- Search inputs and filter buttons adjust dynamically across viewports.

---

## 6. Full Regression Test Battery

```
================================================================
⚡ TEST & BUILD VALIDATION SUMMARY
================================================================
1. Customer-Side Shopi AI & Commerce Regression: 4/4 PASSED (100%)
2. Merchant Dashboard API Suite:                11/11 PASSED (100%)
3. Merchant AI Copilot (Phase 3A):              18/18 PASSED (100%)
4. Merchant AI Actions (Phase 3B):              18/18 PASSED (100%)
5. Phase 15 Action Governance & Verification:    18/18 PASSED (100%)
----------------------------------------------------------------
TOTAL AUTOMATED TESTS:                           69/69 PASSED (100%)
----------------------------------------------------------------
Frontend TypeScript Check (storefront/apps/shop): 0 ERRORS (Exit code 0)
Backend TypeScript Check (ecommerce-backend):     0 ERRORS (Exit code 0)
================================================================
```

---

## 7. Next Steps & Batch Roadmap

- **Batch 1 (Sales + Profitability)**: COMPLETE & VERIFIED ✅
- **Batch 2 (Products + Inventory)**: COMPLETE & VERIFIED ✅
- **Batch 3 (Customers + Returns)**: Ready for execution upon instruction.
- **Batch 4 (Actions & Outcomes Lifecycle)**: Pending Batch 3 completion.
