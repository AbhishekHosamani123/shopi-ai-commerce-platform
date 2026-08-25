# Merchant AI Batch 4 Initial Architecture & Metric Audit

> **Target Workspace**: `/merchant/actions` (AI Decision & Outcome Control Center)  
> **Audited Files**:
> - Frontend: `storefront/apps/shop/app/merchant/actions/page.tsx`
> - Frontend Drawer: `storefront/apps/shop/components/Merchant/v2/ActionDetailDrawer.tsx`
> - Backend Service: `storefront/apps/ecommerce-backend/merchant-actions/` (`action-service.ts`, `action-executor.ts`, `action-validator.ts`, `action-audit.ts`)
> - Outcome Ledger: `storefront/apps/ecommerce-backend/merchant-learning/business-outcome-engine.ts`
> - Routing: `storefront/apps/ecommerce-backend/routes/merchant.ts` (L395–555)  
> **Date**: August 2026  
> **Status**: PRE-IMPLEMENTATION AUDIT COMPLETE  

---

## 1. Backend Endpoint & Metric Traceability Matrix

| Metric / Field Name | Source Endpoint | Backend Module / Table | Calculation / Logic | Trust Taxonomy |
| :--- | :--- | :--- | :--- | :--- |
| `pendingCount` | `GET /api/merchant/actions` | `merchant_ai_actions` table | `COUNT(*) WHERE status = 'PENDING_APPROVAL'` | `[FACT]` |
| `approvedCount` | `GET /api/merchant/actions` | `merchant_ai_actions` table | `COUNT(*) WHERE status IN ('APPROVED', 'COMPLETED')` | `[FACT]` |
| `completedTodayCount` | `GET /api/merchant/actions` | `merchant_ai_actions` table | `COUNT(*) WHERE completed_at >= CURRENT_DATE` | `[FACT]` |
| `rejectedCount` | `GET /api/merchant/actions` | `merchant_ai_actions` table | `COUNT(*) WHERE status = 'REJECTED'` | `[FACT]` |
| `rolledBackCount` | `GET /api/merchant/actions` | `merchant_ai_actions` table | `COUNT(*) WHERE status = 'ROLLED_BACK'` | `[FACT]` |
| `totalVerifiedValueCreated` | `GET /api/merchant/actions` | `merchant_business_impact_ledger` | `SUM((actual_impact->>'observedRevenueDelta')::numeric)` for evaluated positive outcomes | `[DERIVED]` |
| `positiveOutcomeRatePct` | `GET /api/merchant/actions` | `merchant_business_impact_ledger` | `(COUNT(POSITIVE) / COUNT(EVALUATED)) * 100` | `[DERIVED]` |
| `confidenceAtRecommendation` | `action.outcome` | `merchant_business_impact_ledger` | Staged confidence score (0.00 – 1.00) from Copilot / rule engine | `[FACT]` |
| `baselineMetrics` (stock, velocity, revenue, margin) | `action.outcome` | `merchant_business_impact_ledger` | Pre-action snapshot captured at recommendation creation | `[FACT]` |
| `expectedImpact` (units, revenue, profit delta) | `action.outcome` | `merchant_business_impact_ledger` | Predicted delta from business engine at recommendation time | `[RECOMMENDATION]` |
| `actualImpact` (observed units, revenue, profit) | `action.outcome` | `merchant_business_impact_ledger` | Realized post-action metrics measured at evaluation time | `[FACT]` |
| `impactDeltaPct` (variance) | `action.outcome` | `merchant_business_impact_ledger` | `((observedRevenue - expectedRevenue) / expectedRevenue) * 100` | `[DERIVED]` |
| `outcomeStatus` | `action.outcome` | `merchant_business_impact_ledger` | Status: `PENDING` (window active), `POSITIVE`, `NEUTRAL`, `NEGATIVE`, `ROLLED_BACK` | `[FACT]` |
| `learningMode` | `action.outcome` | `business-outcome-engine.ts` | `GLOBAL_BASELINE_COLD_START` (<20 obs) vs `MERCHANT_SPECIFIC_TUNED` (≥20 obs) | `[FACT]` |

---

## 2. Issues Found in Existing `/merchant/actions` Implementation

1. **KPI Card Overcrowding**:
   - The page currently uses generic KPI cards across the top, mimicking a dashboard rather than an operational Decision & Outcome Control Center.
2. **Missing Active Observation Section**:
   - Actions with `status === 'COMPLETED'` and `outcome.outcomeStatus === 'PENDING'` (currently within their 14-day observation window) are mixed into the general historical table rather than highlighted in an Active Verification stream.
3. **Information Hierarchy in ActionDetailDrawer**:
   - The drawer has good data but needs clearer visual segmentation:
     - Recommendation & Evidence
     - Pre-Action Telemetry Baseline
     - Expected vs Observed Variance Box
     - Rollback Governance (destructive secondary modal with explicit parameter rollback explanation)
     - Learning Transparency (cold start vs tuned)
4. **Trust Badges Consistency**:
   - Ensure every card, metric, and analytical prediction is labeled with accurate trust taxonomy tags (`[FACT]`, `[DERIVED]`, `[RECOMMENDATION]`, `[AI INSIGHT]`).

---

## 3. Redesign Plan for Batch 4

### A. Compact AI Decision Posture Banner
- Replaces the KPI wall with an executive decision posture strip:
  - Pending Approvals (`X Pending Decision Requests`) with `[FACT]` badge
  - Executed Decisions (`Y Completed Decisions`) `[FACT]`
  - Verified Value Delivered (`₹Z Verified Revenue Delta`) `[DERIVED]`
  - Positive Outcome Accuracy (`W% Positive Realization Rate`) `[DERIVED]`

### B. High-Priority Pending Decisions Queue
- Card-based queue for actions in `PENDING_APPROVAL`:
  - Target SKU (`SKU-${productId}`) and Product Name
  - Clear Action Type pill (`RESTOCK`, `DISCOUNT`, `PROMOTION`, `PRICE_CHANGE`)
  - Grounded Business Reason and Supporting Telemetry (Current stock, velocity, runway cover)
  - Expected Impact & Model Confidence
  - Dual-Action Controls: **Review Details** (opens Drawer) and **Approve & Execute** (Human-in-the-loop transaction)

### C. Active Observation Window Stream
- Shows actions whose post-action observation window is currently in progress:
  - Observation runway countdown (e.g. `14-Day Post-Execution Window • Active`)
  - Captured Baseline Metrics vs Real-Time Progress
  - Status: `[OUTCOME PENDING]`

### D. Historical Decision Ledger
- Dense, analytical table of historical decisions:
  - Decision & Target Product (`SKU-${productId}`)
  - Execution Timestamp & Approver ID
  - Expected Revenue vs Observed Outcome
  - Variance Delta %
  - Outcome Status (`POSITIVE`, `NEUTRAL`, `NEGATIVE`, `ROLLED_BACK`)
  - 1-Click Drawer Audit & Rollback controls

### E. Action Detail Drawer Redesign
- Structured as a comprehensive decision audit:
  1. Header & Lifecycle Progress Bar
  2. Recommendation & Root Cause Reason
  3. Evidence & Pre-Action Telemetry Baseline
  4. Expected vs Observed Variance Ledger
  5. 7-Point Diagnostic Breakdown (for negative outcomes)
  6. Learning State & Confidence Calibration
  7. Rollback Governance Modal (Destructive confirmation showing exact inverse stock/price mutation)

---

## 4. Next Step
Proceed to implement the redesigned `/merchant/actions/page.tsx` and `ActionDetailDrawer.tsx` in full alignment with the Commerce Intelligence Operating System.
