# Merchant AI Sub-Page Redesign Report: Batch 4 (AI Decision & Outcome Control Center)

> **Workspace Redesigned**: `/merchant/actions` (AI Decision & Outcome Control Center)  
> **Status**: BATCH 4 REDESIGN & VISUAL QA COMPLETE  
> **Date**: August 2026  
> **Audited By**: Antigravity Principal Design & Commerce Intelligence Architecture Team  

---

## 1. Existing Implementation Audit

Prior to Batch 4, the `/merchant/actions` page functioned largely as an isolated action log with a generic KPI wall. Specifically:
- **Generic Metric Cards**: The top row mirrored standard dashboard cards rather than establishing an operational decision governance posture.
- **Unsegmented Active Observation**: Actions in their 14-day observation window (`outcomeStatus: 'PENDING'`) were mixed into the general historical table without an active telemetry stream.
- **Drawer Hierarchy**: The Action Detail Drawer lacked clear analytical visual separation between pre-action baselines, expected impact, realized variance, and destructive rollback confirmations.

---

## 2. Backend Data Sources & Traceability

All metrics on `/merchant/actions` are directly derived from canonical PostgreSQL tables and services:
- **`merchant_ai_actions`**: Provides recommendation lifecycle states (`PENDING_APPROVAL`, `COMPLETED`, `REJECTED`, `ROLLED_BACK`), action payloads, timestamps, and approver IDs.
- **`merchant_business_impact_ledger`**: Provides pre-action telemetry baselines (`stockOnHand`, `velocity7d`, `dailyRevenue`, `contributionMarginPct`), expected impact deltas, realized post-action revenue deltas, and 14-day outcome classifications (`POSITIVE`, `NEUTRAL`, `NEGATIVE`, `PENDING`, `ROLLED_BACK`).
- **`business-outcome-engine.ts`**: Provides learning transparency modes (`GLOBAL_BASELINE_COLD_START` vs `MERCHANT_SPECIFIC_TUNED`) and confidence calibration scores.

---

## 3. Design Changes & Architecture

The workspace was rebuilt into a dedicated **AI Decision & Outcome Control Center** structured into 5 cohesive tiers:
1. **Executive Decision Posture Strip**:
   - Primary metric: Pending Approvals (`X PENDING DECISION REQUESTS`) with `[FACT]` badge and pulse indicator.
   - Secondary pillars: Executed Decisions (`48`), Verified Value Delivered (`₹2,51,400`), Positive Alignment (`81.5%`), and Rolled Back count (`1`).
2. **Contextual Decision Governance Guidance Banner**:
   - Labeled `[AI INSIGHT]`: Explains active pending authorizations, lifetime verified value, and post-action observation accuracy.
3. **Pending Merchant Approvals Queue**:
   - Card-based high-priority approval queue. Surfaces target product & `SKU-${productId}`, supporting inventory telemetry, expected revenue delta (`+₹X`), model confidence (`X%`), and instant **Approve & Execute** / **Review Audit** triggers.
4. **Active Outcome Verification Stream**:
   - Dedicated card stream for completed actions whose 14-day observation window is actively aggregating post-action revenue telemetry (`[OUTCOME PENDING]`).
5. **Historical Decision & Outcome Ledger**:
   - Dense analytical table with tab filters (`All Decisions`, `Needs Approval`, `Observing`, `Completed`, `Rolled Back`), right-aligned financial deltas, human-readable timestamps, outcome status pills, and 1-click audit drawer access.

---

## 4. Action Queue & Outcome Verification UX

- **Human-in-the-Loop Approval**: Every pending action requires explicit merchant sign-off (`POST /api/merchant/actions/:actionId/approve`). Zero autonomous execution occurs without human authorization.
- **Outcome Verification Clarity**:
  - `POSITIVE`: Revenue lift &ge; 85% of expectation with contribution margin preserved.
  - `NEUTRAL`: Moderate revenue realization without margin erosion.
  - `NEGATIVE`: Revenue shortfall or margin dilution; triggers 7-point root cause diagnostic decomposition.
  - `OBSERVING / PENDING`: Actively tracking telemetry within the 14-day post-execution window.

---

## 5. Action Detail Drawer & Rollback Governance

- **Decision Audit Structure**:
  1. Header with lifecycle badge and canonical Action ID (`[FACT]`).
  2. Target Entity & Root Cause Recommendation Context.
  3. Pre-Action Telemetry Baseline (Stock, Velocity, Daily Revenue, Margin %).
  4. Expected vs Observed Variance Box (Expected Revenue, Observed Revenue, Delta %, Outcome Status).
  5. 7-Point Diagnostic Decomposition (rendered when outcome is negative).
  6. Model Confidence & Learning State notice.
  7. Destructive Rollback Confirmation Modal: Explains the exact inverse catalog mutation before execution and commits a compensating ledger entry.

---

## 6. Rendered Visual QA Screenshots Matrix

Rendered using the native headless Edge compositor at 1:1 pixel fidelity across all 5 viewports:

| Target | Viewport | Screenshot Artifact | Status |
| :--- | :--- | :--- | :--- |
| **Actions Table** | **1440 x 900** | `batch4_actions_table_1440x900.png` | ✅ PASS |
| **Actions Table** | **1280 x 800** | `batch4_actions_table_1280x800.png` | ✅ PASS |
| **Actions Table** | **1024 x 768** | `batch4_actions_table_1024x768.png` | ✅ PASS |
| **Actions Table** | **768 x 900** | `batch4_actions_table_768x900.png` | ✅ PASS |
| **Actions Table** | **390 x 844** | `batch4_actions_table_390x844.png` | ✅ PASS |
| **Action Drawer** | **1440 x 900** | `batch4_actions_drawer_1440x900.png` | ✅ PASS |
| **Action Drawer** | **1280 x 800** | `batch4_actions_drawer_1280x800.png` | ✅ PASS |
| **Action Drawer** | **1024 x 768** | `batch4_actions_drawer_1024x768.png` | ✅ PASS |
| **Action Drawer** | **768 x 900** | `batch4_actions_drawer_768x900.png` | ✅ PASS |
| **Action Drawer** | **390 x 844** | `batch4_actions_drawer_390x844.png` | ✅ PASS |

---

## 7. Data-Integrity & Trust Classification

- Zero fabricated metrics, synthetic confidence scores, or fake timestamps.
- Explicit Trust Taxonomy:
  - `[FACT]`: Executed count, pending count, baseline metrics, observed outcome revenue, rollback status.
  - `[DERIVED]`: Total verified value created, positive outcome alignment rate %, variance realization %.
  - `[RECOMMENDATION]`: Expected revenue impact, target units delta.
  - `[AI INSIGHT]`: Governance posture guidance, negative diagnostic breakdown.

---

## 8. Exact Files Modified

1. [`storefront/apps/shop/app/merchant/actions/page.tsx`](file:///d:/Razorpay-Ai-Commerce/storefront/apps/shop/app/merchant/actions/page.tsx) — Redesigned into AI Decision & Outcome Control Center.
2. [`storefront/apps/shop/components/Merchant/v2/ActionDetailDrawer.tsx`](file:///d:/Razorpay-Ai-Commerce/storefront/apps/shop/components/Merchant/v2/ActionDetailDrawer.tsx) — Redesigned decision audit drawer with variance ledger and rollback modal.
3. [`docs/merchant-batch-4-audit.md`](file:///d:/Razorpay-Ai-Commerce/docs/merchant-batch-4-audit.md) — Pre-implementation audit document.
4. [`docs/merchant-batch-4-redesign-report.md`](file:///d:/Razorpay-Ai-Commerce/docs/merchant-batch-4-redesign-report.md) — Comprehensive Batch 4 redesign report.

---

## 9. Full Automated Regression Test Battery & Route Verification

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
All 8 Workspaces Verified Live:
- GET /merchant                   : HTTP 200 ✅
- GET /merchant/sales             : HTTP 200 ✅
- GET /merchant/profitability     : HTTP 200 ✅
- GET /merchant/products          : HTTP 200 ✅
- GET /merchant/inventory         : HTTP 200 ✅
- GET /merchant/customers         : HTTP 200 ✅
- GET /merchant/returns           : HTTP 200 ✅
- GET /merchant/actions           : HTTP 200 ✅
----------------------------------------------------------------
Frontend TypeScript Check (storefront/apps/shop): 0 ERRORS (Exit code 0)
Backend TypeScript Check (ecommerce-backend):     0 ERRORS (Exit code 0)
================================================================
```

---

## 10. Critical UX & Product Analysis: Top 5 Remaining Product Observations

1. **Pending Queue Volume Scalability**:
   - If a catalog generates &gt;10 pending actions simultaneously, horizontal wrapping of queue cards on tablet screens requires pagination or horizontal scrolling.
2. **Observation Window Temporal Precision**:
   - The 14-day observation window currently displays `OUTCOME PENDING` as a status badge. Adding a dynamic `Day X of 14` countdown pill will give merchants greater visibility into when an evaluation will finalize.
3. **Rollback Parameter Visibility**:
   - While the rollback modal explains the revert conceptually, displaying the exact previous numerical value (e.g. *Reverting price from ₹3,399 back to ₹3,999*) directly in the confirmation modal improves merchant confidence.
4. **Historical Ledger Multi-Sort**:
   - The ledger currently sorts by creation date descending. Adding column header sorting for Variance % and Realized Revenue will allow merchants to quickly identify top value-generating decisions.
5. **Contextual Copilot Prompt Seeding from Drawer**:
   - Clicking "Ask AI" from within the Action Detail Drawer should seed the Copilot drawer prompt with the active `actionId` to enable seamless multi-turn inquiries about specific decision telemetry.

---

## 11. Final Roadmap & Next Step

- **Batch 1 (Sales + Profitability)**: COMPLETE & VERIFIED ✅
- **Batch 2 (Products + Inventory)**: COMPLETE & VERIFIED ✅
- **Batch 3 (Customers + Returns)**: COMPLETE & VERIFIED ✅
- **Batch 4 (Actions & Outcomes Control Center)**: COMPLETE & VERIFIED ✅
- **Next Step**: **FULL MERCHANT AI END-TO-END ACCEPTANCE AUDIT**.
