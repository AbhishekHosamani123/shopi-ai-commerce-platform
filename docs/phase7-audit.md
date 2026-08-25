# Phase 7 System Audit: Merchant AI Self-Learning & Adaptive Optimization Engine

## 1. Executive Summary
This document provides an audit of all existing telemetry, prediction engines, decision frameworks, and outcome records across Phases 2 through 6 in the Razorpay AI Commerce platform (`razorpay_ecommerce`). It establishes the architectural blueprint for Phase 7: transitioning from static analysis and heuristic simulation into an explainable, statistical, Bayesian, and closed-loop self-learning commerce operating system.

---

## 2. Inventory of Existing System Assets & Telemetry

### A. Core Telemetry & Transactional Foundations
| Domain / Table | Record Count | Time Depth | Description & Learning Utility |
| :--- | :---: | :---: | :--- |
| `orders` & `orderitems` | 15,049 orders / 24,325 items | 767 days | Continuous historical daily sales velocity, basket values, customer order intervals, and seasonal purchase trends. |
| `products` | 40 SKUs | Multi-category | Catalog base prices, discounts, current stock, reorder levels, category hierarchy. |
| `inventory_movements` | 25,701 movements | Full history | Granular restock, dispatch, adjustments, and transfer movements with explicit `stock_before` and `stock_after`. |
| `users` | 658 accounts | Full history | Historical order frequency, recency, CLV, and churn indicators. |
| `returns` & `order_cancellations` | 1,175 returns / 356 cancels | Full history | Return reasons, defect tracking, and SKU-level refund rates. |
| `merchant_ai_actions` | Audited actions | Phases 3B–6 | Consequential commercial recommendations (RESTOCK, DISCOUNT, PROMOTION, PO, TRANSFER) with approval lifecycle. |
| `merchant_ab_experiments` | Active/Staged tests | Phase 4 | A/B test definitions, variant assignments, and test metrics. |
| `merchant_suppliers` & `merchant_purchase_orders` | 2 suppliers / audited POs | Phase 5 | Lead time estimates, on-time delivery tracking, fill rates, and goods receipt timestamps. |
| `merchant_warehouses` & `merchant_inventory_transfers` | 3 regional hubs / transfers | Phase 6 | Multi-node inventory distribution, routing performance, and transfer durations. |
| `merchant_capital_allocations` & `merchant_ad_campaigns` | Staged allocations | Phase 6 | Capital deployments across 5 portfolio buckets and ad spend tests. |
| `merchant_product_cogs` | Margin schema | Phase 6 | Unit costs, supplier costs, shipping costs, and handling costs. |

---

## 3. Existing Predictions & Models across Phases 2–6

1. **Demand Forecasting (`merchant-optimization/demand-forecast.ts`)**:
   - Generates 7-day, 14-day, and 30-day demand predictions using rolling exponential moving averages and trend slopes.
   - *Current limitation*: Predictions were generated without automated post-period error logging (MAE/MAPE/Bias).
2. **Pricing & Elasticity Heuristics (`merchant-optimization/pricing-optimizer.ts`)**:
   - Computes point price elasticity using observational price changes and discounts.
   - *Current limitation*: Did not maintain Bayesian priors/posteriors or separate observational signals from controlled experiments.
3. **Supplier Performance Scoring (`merchant-suppliers/supplier-service.ts`)**:
   - Calculates on-time delivery percentage and fill rate.
   - *Current limitation*: Uses static weights rather than Bayesian updating on newly received POs.
4. **Customer CLV & Churn Scoring (`merchant-customer-intelligence/`)**:
   - Calculates CLV decay and churn risk tiers (`HIGH`, `MEDIUM`, `LOW`).
   - *Current limitation*: Thresholds are static without precision/recall calibration against actual customer reorder intervals.
5. **Cross-SKU Cannibalization (`merchant-cannibalization/`)**:
   - Detects substitution risk using title embeddings and category price ratios.
   - *Current limitation*: Did not track empirical demand diversion during actual promotional markdown events.
6. **Capital Allocation & Scenario Simulators (`merchant-capital/` & `merchant-simulator/`)**:
   - Generates $[\text{min}, \text{mid}, \text{max}]$ revenue envelopes and payback periods.
   - *Current limitation*: Did not track actual realized revenue vs. projected midpoints upon completion.

---

## 4. Missing Learning Signals to be Built in Phase 7

1. **Closed-Loop Decision Outcome Ledger**: A standardized schema to log every recommendation, prediction envelope, actual realization, and variance.
2. **Prediction vs. Reality Evaluator**: Automated computation of Absolute Error, Percentage Error, Directional Accuracy, and Bias across all prediction horizons ($1\text{d}, 7\text{d}, 14\text{d}, 30\text{d}, 60\text{d}, 90\text{d}$).
3. **Bayesian Price Elasticity Engine**: Conjugate normal/log-linear Bayesian updating of SKU price responsiveness with sample counts, credible intervals, and experimental distinction.
4. **Adaptive Safety Stock & Reorder Point Learning**: Dynamic adjustment of safety stock based on empirical supplier lead-time variance and forecast residuals.
5. **Model Registry & Versioning**: Multi-version tracking of decision models (`ACTIVE`, `SHADOW`, `RETIRED`) with strict Champion/Challenger evaluation gates.
6. **Merchant Feedback & Preference Memory**: Capturing merchant thumbs up/down, risk preferences, and objective weighting without compromising hard safety guardrails.
7. **Comprehensive Decision Quality Scoring**: Holistic index (0–100) combining accuracy, business outcome, merchant acceptance, and safety compliance.

---

## 5. Non-Negotiables & Strict Principles

- **No Fake Machine Learning**: We do not invoke LLMs and label text synthesis as "statistical learning". We employ transparent, mathematically sound statistical/Bayesian online algorithms (e.g., recursive mean/variance updating, conjugate Bayesian elasticity, empirical error tracking).
- **Explainability**: Every learned parameter must provide `sampleCount`, `confidence`, `prior`, `posterior/currentEstimate`, `lastUpdated`, and `dataDepth`.
- **Shadow Mode & Champion/Challenger Safety**: Learned models run in shadow mode first; challenger models cannot automatically mutate live financial or procurement parameters without merchant approval.
- **Tenant Isolation**: Multi-merchant scoping (`merchant_id`) enforced across all outcome ledgers, model versions, and feedback tables.
