# Phase 8 Data Readiness & Sufficiency Audit

**Date:** August 24, 2026  
**Auditor:** Merchant AI Core Architecture Team  
**Database:** PostgreSQL `razorpay_ecommerce`  

---

## 1. Historical Dataset Telemetry Depth

| Data Asset | Record Count | Time Horizon | Integrity Status |
| :--- | :--- | :--- | :--- |
| **Total Orders** | 15,049 | 767 days (2024-07-17 to 2026-08-23) | Fully Verified |
| **Order Items** | 24,325 | 767 days | Fully Verified |
| **Active Catalog SKUs** | 40 SKUs | Continuous Live Inventory | Fully Verified |
| **Total Inventory Movements** | 25,701 records | 767 days | Fully Verified |
| **Registered Customers** | 658 accounts | 767 days | Fully Verified |
| **Order Returns** | 1,175 records | 767 days | Fully Verified |
| **Order Cancellations** | 356 records | 767 days | Fully Verified |
| **Payments Ledger** | 15,049 records | 767 days | Fully Verified |
| **AI Outcomes Ledger** | Evaluated historical decisions | Multi-horizon tracking | Fully Verified |

---

## 2. 12-Domain Data Health Evaluation

| Telemetry Domain | Telemetry Source | Sufficiency Status | Notes |
| :--- | :--- | :--- | :--- |
| **Orders & Sales History** | `orders`, `orderitems` | `AVAILABLE` (HIGH) | 15,049 orders over 767 days. Strong statistical significance for forecasting. |
| **Product Catalog & Stock** | `products` | `AVAILABLE` (HIGH) | 40 active SKUs with live stock counts, pricing, and category metadata. |
| **Inventory Movements** | `inventory_movements` | `AVAILABLE` (HIGH) | 25,701 movements. Full velocity and depletion tracking. |
| **Customer Behavior & RFM** | `orders`, `users` | `AVAILABLE` (HIGH) | 658 customer accounts. Repeat purchase rate and RFM segmentation active. |
| **Returns & Quality** | `order_returns` | `AVAILABLE` (HIGH) | 1,175 return records with reason codes and refund amounts. |
| **Cancellations & Ops** | `order_cancellations` | `AVAILABLE` (HIGH) | 356 cancellation records for operational friction tracking. |
| **Supplier & PO History** | `merchant_suppliers`, `merchant_purchase_orders` | `AVAILABLE` (HIGH) | Historical lead times and reliability variance metrics active. |
| **Multi-Warehouse Nodes** | `merchant_warehouses`, `merchant_warehouse_inventory` | `AVAILABLE` (HIGH) | Regional fulfillment node tracking and stock distribution active. |
| **AI Decisions & Outcomes** | `merchant_ai_actions`, `merchant_ai_outcomes` | `AVAILABLE` (HIGH) | Closed-loop prediction vs reality telemetry tracking. |
| **Price Experiments & Elasticity** | `merchant_ai_experiments`, `merchant_model_versions` | `AVAILABLE` (HIGH) | Bayesian posterior elasticity models calibrated on empirical data. |
| **Product COGS / Costing** | `merchant_product_cogs` | `PARTIAL` (MEDIUM) | Partially populated; unconfigured SKUs use transparent gross-margin fallbacks. |
| **External Ad Network Pixels** | Third-party ad engines | `PARTIAL` (OPPORTUNITY) | Third-party ad pixels not configured; engine utilizes opportunity-based scoring. |

---

## 3. Data Sufficiency Standards

The Merchant AI platform enforces strict data sufficiency guardrails across all automated modules:
- **`HIGH` Sufficiency ($\ge 30$ observations):** Enables Bayesian predictive models, auto-calculated reorder points, and automated price adjustments.
- **`MEDIUM` Sufficiency ($10-29$ observations):** Requires wider credible intervals, conservative safety buffers, and explicit merchant confirmation.
- **`LOW` Sufficiency ($< 10$ observations):** Blocks automated execution; flags recommendations with transparent data sufficiency notices and suggests manual review.
