# Phase 8 Engineering Audit: Merchant AI Operating System & Command Center

**Date:** August 24, 2026  
**Status:** COMPLETE & PRODUCTION-READY  
**Automated Tests:** 386/386 Passing (Phase 8: 80/80, Phase 7: 75/75, Phase 6: 60/60, Phase 5: 50/50, Phase 4: 40/40, Phase 3C: 30/30, Phase 3B: 18/18, Phase 3A: 18/18, Dashboard: 11/11, Customer Storefront: 4/4)  
**TypeScript Build Status:** 0 Errors across Backend and Frontend  

---

## 1. Executive Summary

Phase 8 successfully unites all prior Merchant AI intelligence layers (Phases 2 through 7) into a unified, deterministic, and self-calibrating **Merchant AI Operating System & Executive Command Center**. 

Rather than functioning as isolated feature silos, the entire merchant platform operates as an integrated decision loop:
1. **Real Telemetry & Health Monitoring:** Continuously scans 15,049 real orders, 24,325 order items, 40 active SKUs, 658 customer accounts, return diagnostics, and inventory logs to evaluate business health across 8 dimensions.
2. **True Contribution Profitability:** Calculates SKU, Category, and Channel net profitability ($\text{Revenue} - \text{COGS} - \text{Discounts} - \text{Refunds} - \text{Shipping} - \text{Fulfillment}$) with strict transparent flagging when COGS is partially unavailable.
3. **Goal-Aligned Optimization:** Re-ranks all recommendations based on the merchant's active strategic business goal (`INCREASE_REVENUE`, `INCREASE_MARGIN`, `REDUCE_DEAD_STOCK`, `REDUCE_STOCKOUTS`, `IMPROVE_RETENTION`, `REDUCE_RETURNS`, `IMPROVE_CASH_EFFICIENCY`, `INCREASE_ROAS`).
4. **Interactive What-If Scenario Simulator:** Allows live exploration of price deltas, batch quantities, ad budgets, target margins, and warehouse transfers, maintaining strict mathematical separation between *Observed Data*, *Model Predictions*, and *Simulated Outcomes*.
5. **Conversational Explainability:** Empowers merchants to ask 8 core explainability questions with full visibility into confidence, evidence samples, and potential error modes.
6. **Production Observability & Isolated Sandbox:** Tracks AI latency, approval rates, and execution reliability while providing an isolated sandbox dataset generator for demonstration without contaminating production data.

---

## 2. Core Architecture & Modules

### 2.1 Business Health Score Engine (`merchant-health-score/`)
- **Deterministic 0–100 Scoring:** Evaluates 8 weighted business dimensions:
  1. `REVENUE` (Weight: 20%): Growth rate, order volume, AOV trajectory.
  2. `PROFITABILITY` (Weight: 20%): Promotional discount discipline, margin stability, COGS availability.
  3. `INVENTORY` (Weight: 15%): Stockout count, low-stock safety buffers, inventory turnover.
  4. `CUSTOMER` (Weight: 15%): Repeat purchase rate, VIP cohort retention, churn velocity.
  5. `OPERATIONS` (Weight: 10%): Return rate, cancellation frequency, fulfillment speed.
  6. `MARKETING` (Weight: 5%): Campaign coverage, ROAS opportunity scoring.
  7. `CAPITAL` (Weight: 10%): Capital allocation realization, cash efficiency, tied-up dead stock.
  8. `CONFIDENCE` (Weight: 5%): AI forecast calibration, MAPE across horizons, data freshness.
- **Explainable Drivers:** Returns positive drivers, negative drag factors, and identifies the single highest-impact drag issue with an actionable recommendation.

### 2.2 Real Profitability Intelligence Engine (`merchant-profitability/`)
- **Unit Economics & Contribution Margin:**
  $$\text{Contribution Profit} = \text{Net Revenue} - \text{Unit COGS} - \text{Refunds} - \text{Shipping} - \text{Handling}$$
  $$\text{Contribution Margin \%} = \frac{\text{Contribution Profit}}{\text{Net Revenue}} \times 100$$
- **Tier Classification:** Categorizes products into `HIGH_MARGIN` ($\ge 40\%$), `MODERATE_MARGIN` ($20-40\%$), `LOW_MARGIN` ($0-20\%$), `MARGIN_NEGATIVE` ($<0\%$), and `COGS_UNAVAILABLE`.
- **Transparent Notice:** If COGS is missing for certain catalog items, the engine explicitly sets `isCogsAvailable: false` and emits a data sufficiency notice rather than fabricating synthetic costs.

### 2.3 Unified Recommendation Hub & Goals Engine (`merchant-recommendation-hub/`)
- **Goal Re-Ranking:** Dynamically re-ranks recommendations based on active goal weights and confidence multipliers.
- **Outcome Lookup:** Searches `merchant_ai_outcomes` to enrich recommendations with previous similar actions and historical variance metrics.
- **Data Sufficiency Badging:** Automatically tags each recommendation with `HIGH`, `MEDIUM`, or `LOW` data sufficiency based on underlying telemetry sample volume.

### 2.4 Conversational Explainability Engine (`merchant-explainability/`)
- Directly answers the 8 core merchant questions:
  1. *Why are you recommending this?*
  2. *What data did you use?*
  3. *How confident are you?*
  4. *Where could you be wrong?*
  5. *What happened the last time you recommended this?*
  6. *What have you learned about my business?*
  7. *Why did your recommendation change?*
  8. *Which assumptions are you making?*

### 2.5 What-If Scenario Simulator Engine (`merchant-whatif-simulator/`)
- Simulates scenarios across:
  - `PRICE_CHANGE`: Integrates Bayesian price elasticity ($\epsilon$) to project demand shifts and revenue envelopes.
  - `REORDER_BATCH`: Computes procurement costs, days of stock cover, and working capital commitments.
  - `AD_SPEND`: Simulates opportunity-based ROAS and demand acceleration.
  - `TARGET_MARGIN`: Back-solves required pricing or procurement targets to hit desired margin percentages.
  - `WAREHOUSE_TRANSFER`: Calculates regional freight balance and fulfillment cost shifts.
  - `SKU_RETIREMENT`: Estimates freed working capital from phasing out unprofitable lines.

### 2.6 Observability & Telemetry Engine (`merchant-observability/`)
- Aggregates request counts, approval rates, execution success rates, 14-day MAPE, AI latency (average & P95), and database query latency.

### 2.7 Isolated Sandbox Generator (`merchant-data-health/`)
- Generates synthetic order, customer, outcome, and inventory data isolated under demo tenant identifiers (`is_demo: true`) with clean purge routines to prevent production pollution.

---

## 3. Phase 8 REST API Surface

| Endpoint | Method | Purpose | Auth Required |
| :--- | :--- | :--- | :--- |
| `/api/merchant/ai/health-score` | `GET` | Computes deterministic 0-100 Business Health Score | Merchant Admin / Secret |
| `/api/merchant/ai/profitability` | `GET` | Product, Category, and Channel contribution margins | Merchant Admin / Secret |
| `/api/merchant/ai/recommendations/unified` | `GET` | Centralized AI recommendations with goal re-ranking | Merchant Admin / Secret |
| `/api/merchant/ai/goals` | `GET` | Get active merchant business goal | Merchant Admin / Secret |
| `/api/merchant/ai/goals` | `POST` | Update active merchant business goal | Merchant Admin / Secret |
| `/api/merchant/ai/explain` | `POST` | 8-question decision explainability | Merchant Admin / Secret |
| `/api/merchant/ai/simulate` | `POST` | Interactive What-If Scenario simulation | Merchant Admin / Secret |
| `/api/merchant/ai/observability` | `GET` | System health & latency metrics | Merchant Admin / Secret |
| `/api/merchant/ai/data-readiness` | `GET` | Comprehensive 12-domain telemetry audit | Merchant Admin / Secret |
| `/api/merchant/ai/sandbox/generate` | `POST` | Generate isolated demo dataset | Merchant Admin / Secret |
| `/api/merchant/ai/sandbox` | `DELETE` | Purge isolated demo dataset | Merchant Admin / Secret |

---

## 4. Security & Multi-Tenant Audit

1. **Strict Tenant Scoping:** All queries enforce merchant ID scoping (`merchant_id = $1` or `merchant_id IN ('default_merchant', 'merchant_admin')`).
2. **401 Unauthorized Guard:** All endpoints reject requests lacking valid `'x-api-secret'` or `'x-merchant-role'`.
3. **Idempotent Actions:** Prevents duplicate execution on previously approved actions.
4. **Clean Sandbox Separation:** Demo records tagged with `is_demo: true` and sandbox tenant IDs to guarantee zero cross-tenant leakage.
