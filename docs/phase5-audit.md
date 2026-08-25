# Phase 5 System Audit: Merchant AI Advanced Intelligence & Real-World Commerce

**Date:** 2026-08-24  
**Workspace:** `d:/Razorpay-Ai-Commerce`  
**Target:** Architecture Audit & Phase 5 Integration Roadmap

---

## 1. Existing Capabilities

| Phase | Core Capability | Status | Key Modules |
| :--- | :--- | :---: | :--- |
| **Phase 2** | Merchant Analytics Dashboard & KPIs | Active | `merchant-intelligence/`, `/api/merchant/*` |
| **Phase 3A** | Conversational Copilot & Period Resolver | Active | `merchant-copilot/`, Groq LLM Adapter |
| **Phase 3B** | Action & Approval Engine (Human-in-the-Loop) | Active | `merchant-actions/`, `merchant_ai_actions` |
| **Phase 3C** | Proactive Alerts, Digests & Document Generation | Active | `merchant-proactive/`, `merchant-digests/`, `merchant-promotions/`, `merchant-documents/` |
| **Phase 4** | Optimization, Pricing, Forecasting & What-If Simulator | Active | `merchant-optimization/`, `merchant-simulator/`, `merchant-experiments/` |

---

## 2. Existing Database Tables
- `products`: 40 active SKUs (`productid`, `title`, `description`, `categoryid`, `price`, `discount`, `stock`, `tags`).
- `categories`: Category hierarchy (`categoryid`, `name`, `slug`, `maincategory`).
- `orders`: 15,049 records across 767 calendar days.
- `orderitems`: 24,325 line items with `orderid`, `productid`, `quantity`.
- `inventory_movements`: 25,701 warehouse ledger events.
- `order_returns`: 1,175 return records with `return_reason`, `refund_amount`.
- `order_cancellations`: 356 cancellation records with `cancel_reason`.
- `users`: 658 customer accounts.
- `merchant_ai_actions`: 98 audit action records with lifecycle and expiration.
- `merchant_ai_alerts`: 13 proactive alert records with SHA fingerprinting.
- `merchant_ai_digests`: Executive daily/weekly digests.
- `merchant_ai_coupons`: Active promotional coupons.
- `merchant_ai_recommendations`: Goal-ranked optimization records.
- `merchant_ai_simulations`: What-If scenario projections.
- `merchant_ai_experiments`: A/B test draft and concluded records.
- `merchant_ai_outcomes`: Post-action velocity and revenue outcome measurements.

---

## 3. Existing APIs
- **Analytics**: `/overview`, `/sales`, `/products`, `/inventory`, `/categories`, `/customers`, `/returns`, `/alerts`, `/comparison`.
- **Copilot**: `POST /ai/chat`.
- **Actions**: `GET /ai/actions`, `POST /ai/actions/:id/approve`, `POST /ai/actions/:id/reject`, `POST /ai/actions/create`.
- **Proactive & Operations**: `POST /ai/proactive/scan`, `GET /ai/alerts`, `POST /ai/digest/run`, `GET /ai/digests`, `GET/PUT /ai/settings`, `POST /ai/documents/purchase-order`, `GET/POST /ai/coupons`.
- **Optimization & Simulator**: `/ai/optimization/recommendations`, `/ai/optimization/simulate`, `/ai/optimization/products/:id`, `/ai/optimization/customers`, `/ai/optimization/categories`, `/ai/optimization/forecast`, `/ai/optimization/outcomes`, `/ai/optimization/experiments`, `/ai/optimization/data-health`.

---

## 4. Existing Action Types
- `RESTOCK`: Inventory replenishment with stock mutation.
- `DISCOUNT`: Markdown application with product discount mutation.
- `PROMOTION`: Spotlight campaign and promotional coupon publishing.
- `PRICE_CHANGE`: Safe base price adjustments.
- `CUSTOMER_REENGAGE`: Targeted customer retention offers.

---

## 5. Existing Recommendation Types
- `INVENTORY`: Critical restocks, low stock warnings, reorder points.
- `PRICING`: Price increase on inelastic high-velocity SKUs, clearance markdowns.
- `PROMOTION`: Spotlight merchandising, bundles, clearance discounts.
- `CUSTOMER`: RFM at-risk win-backs and VIP rewards.

---

## 6. Existing Forecasting Logic
- Deterministic weighted moving average ($0.6 \times v_7 + 0.4 \times v_{30}$) with trend acceleration adjustments ($\pm\%$).
- 7d, 14d, 30d projections and days-to-depletion.

---

## 7. Existing Simulation Logic
- What-If simulator (`businessSimulator.simulate`) supporting `PRICE_CHANGE`, `DISCOUNT_CLEARANCE`, `RESTOCK_EXPANSION`, `CATEGORY_PROMOTION` with min/max/mid revenue ranges and `[SIMULATED / ESTIMATED]` labeling.

---

## 8. Existing Customer Analytics
- RFM segmentation (`VIP`, `LOYAL`, `REPEAT`, `NEW`, `AT_RISK`, `DORMANT`, `ONE_TIME`) with churn risk flags.

---

## 9. Existing Inventory Analytics
- Average daily velocity, safety stock ($SS = \lceil d \times 3.0 \rceil$), Reorder Point ($ROP = d \times L + SS$), 21-day batch replenishment.

---

## 10. Existing Limitations & Missing Elements
1. **No Supplier Master & EDI Abstraction**: Supplier lead times, reliability scores, and PO lifecycle state machine were not tracked as distinct entities.
2. **Cross-SKU Cannibalization Unmodeled**: Promotions on substitute products did not check for demand cannibalization across similar catalog items.
3. **CLV & Churn Decay**: Customer value trends over time (30d vs 60d vs 90d) were not quantified dynamically.
4. **Second-Order Effects**: Recommendations did not explicitly evaluate trade-offs (e.g. margin dilution, capital lockup, substitute product depression).
5. **Procurement Cost (COGS) Gap**: Products table lacks procurement cost columns; system must honestly report missing margin data rather than fabricating margins.

---

## 11. Exact Integration Points for Phase 5
1. **`merchant-suppliers/`**: Supplier master, reliability scoring, PO lifecycle state machine, and EDI adapter interfaces.
2. **`merchant-cannibalization/`**: Product similarity matrix, cross-SKU substitution detection, and promotion conflict radar.
3. **`merchant-customer-intelligence/`**: Dynamic CLV calculation, churn probability modeling, value decay curves, and campaign simulation.
4. **`merchant-decision-engine/`**: Executive decision engine synthesizing today's TOP 3 priorities with second-order effect explanations.
5. **Phase 3B Action & Approval Linkage**: All PO approvals, supplier transmissions, customer campaigns, and price changes route through `merchant_ai_actions`.
6. **Phase 3C Proactive Alerts Linkage**: Supplier delay risks, cannibalization warnings, and churn alerts integrate into `merchant_ai_alerts`.
7. **Phase 4 Optimization Linkage**: Supplier reliability and lead-time variability feed directly into inventory reorder calculations and What-If simulations.
