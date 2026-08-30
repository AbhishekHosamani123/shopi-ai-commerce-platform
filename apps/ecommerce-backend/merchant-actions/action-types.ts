/**
 * ⚡ Merchant AI Action & Approval Engine — Type Definitions (Phase 3B)
 */

export type MerchantActionType =
  | 'RESTOCK'
  | 'DISCOUNT'
  | 'PROMOTION'
  | 'MARK_FOR_REVIEW'
  | 'PRICE_CHANGE'
  | 'INVENTORY_UPDATE'
  | 'SUPPLIER_ORDER'
  | 'CAMPAIGN_CREATE'
  | 'COUPON_CREATE'
  | 'CUSTOMER_REENGAGE';

export type MerchantActionStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'FAILED'
  | 'CANCELLED'
  | 'ROLLED_BACK';

export interface ActionPayload {
  // Snapshot metrics at creation time for revalidation
  stockAtRecommendation?: number;
  dailyVelocity7d?: number;
  estimatedCoverageDays?: number;
  reorderTargetUnits?: number;
  
  // Pricing & discount snapshots
  originalPrice?: number;
  currentDiscount?: number;
  recommendedDiscountPct?: number;
  suggestedDiscountPrice?: number;
  targetSellThroughUnits?: number;

  // Promotional metrics
  revenueGrowthPct?: number;
  salesVelocity?: number;
  recommendedChannel?: string;

  // Additional context
  categoryName?: string;
  urgency?: 'CRITICAL' | 'WARNING' | 'HEALTHY' | 'OPPORTUNITY' | 'INFO';
  [key: string]: any;
}

export interface ActionOutcomeDetails {
  outcomeStatus: 'PENDING' | 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'INCONCLUSIVE' | 'INSUFFICIENT_DATA' | 'ROLLED_BACK';
  baselineMetrics?: {
    stockOnHand?: number;
    velocity7d?: number;
    dailyRevenue?: number;
    contributionMarginPct?: number;
    conversionRatePct?: number;
  };
  expectedImpact?: {
    expectedUnitsDelta?: number;
    expectedRevenueDelta?: number;
    expectedProfitDelta?: number;
  };
  actualImpact?: {
    observedUnitsDelta?: number;
    observedRevenueDelta?: number;
    observedProfitDelta?: number;
  };
  impactDeltaPct?: number;
  observationWindowDays?: number;
  evaluatedAt?: string | null;
  negativeAnalysis?: {
    whatWasRecommended: string;
    whyRecommended: string;
    whatHappened: string;
    whatWasExpected: string;
    whatActuallyHappened: string;
    whyDifferenceOccurred: string;
    whatShouldChange: string;
  };
  confidenceAtRecommendation?: number;
  learningTransparency?: {
    learningMode: 'GLOBAL_BASELINE_COLD_START' | 'MERCHANT_SPECIFIC_TUNED';
    observationCount: number;
    notice: string;
  };
}

export interface MerchantAiActionRecord {
  actionId: string;
  merchantId: string;
  actionType: MerchantActionType;
  status: MerchantActionStatus;
  productId?: number | null;
  productName?: string | null;
  quantity?: number | null;
  payload: ActionPayload;
  reason: string;
  createdAt: string;
  expiresAt: string;
  approvedAt?: string | null;
  completedAt?: string | null;
  rejectedAt?: string | null;
  approvedBy?: string | null;
  executionResult?: Record<string, any> | null;
  failureReason?: string | null;
  idempotencyKey?: string | null;
  requiresApproval: boolean;
  canRollback?: boolean;
  isReversible?: boolean;
  rollbackAt?: string | null;
  rollbackBy?: string | null;
  outcome?: ActionOutcomeDetails | null;
}

export interface ActionPreview {
  actionId: string;
  type: MerchantActionType;
  status: MerchantActionStatus;
  productId?: number | null;
  productName?: string | null;
  quantity?: number | null;
  currentStock?: number;
  recommendedChange?: string;
  estimatedCoverage?: string;
  reason: string;
  impact: string;
  expiresAt: string;
  requiresApproval: boolean;
  payload?: ActionPayload;
  outcome?: ActionOutcomeDetails | null;
}

export interface CreateActionInput {
  merchantId?: string;
  actionType: MerchantActionType;
  productId?: number | null;
  productName?: string | null;
  quantity?: number | null;
  payload: ActionPayload;
  reason: string;
  expiresInMinutes?: number;
  idempotencyKey?: string;
}

export interface ActionResult {
  success: boolean;
  action: MerchantAiActionRecord;
  message: string;
  error?: string;
}

export interface ActionSummaryKpis {
  totalActions: number;
  pendingCount: number;
  approvedCount: number;
  completedTodayCount: number;
  rejectedCount: number;
  expiredCount: number;
  rolledBackCount?: number;
  totalVerifiedValueCreated?: number;
  positiveOutcomeRatePct?: number;
  verifiedActionCount?: number;
  pendingObservationCount?: number;
  verifiedRevenueDelta?: number;
  outcomeAlignmentPct?: number;
}

