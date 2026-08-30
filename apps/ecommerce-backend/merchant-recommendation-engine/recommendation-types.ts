import { OpportunityType, ConfidenceLevel, FinancialSafetyState } from '../merchant-opportunity-engine/opportunity-types';

export type RecommendationType =
  | 'TARGETED_CUSTOMER_INCENTIVE'
  | 'CART_RECOVERY_INCENTIVE'
  | 'CHECKOUT_RECOVERY_INCENTIVE'
  | 'VIP_RETENTION_REWARD'
  | 'DORMANT_REACTIVATION_OFFER'
  | 'LOYALTY_STABILIZATION'
  | 'PRODUCT_FRICTION_INVESTIGATION'
  | 'INVENTORY_REPLENISHMENT'
  | 'STOCKOUT_PREVENTION_RESTOCK'
  | 'DEAD_STOCK_MARKDOWN'
  | 'RETURN_ROOT_CAUSE_CORRECTION'
  | 'HIGH_MARGIN_MERCHANDISING';

export type RecommendationStatus =
  | 'READY_FOR_REVIEW'
  | 'DRAFT'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'STALE_REQUIRES_RECALCULATION';

export type RejectionReason =
  | 'TOO_RISKY'
  | 'MARGIN_TOO_LOW'
  | 'WRONG_TARGET'
  | 'WRONG_TIMING'
  | 'NOT_RELEVANT'
  | 'ALREADY_HANDLED'
  | 'OTHER';

export interface IncentiveOption {
  optionId: string;
  name: string;
  incentiveType: 'PERCENTAGE_DISCOUNT' | 'FIXED_AMOUNT_DISCOUNT' | 'COUPON' | 'NO_INCENTIVE';
  discountValue: number; // e.g. 10 (%) or 100 (₹)
  projectedSellingPrice: number;
  projectedContribution: number | null;
  contributionChange: number | null;
  isMarginFloorPreserved: boolean;
  isRecommended: boolean;
  rationale: string;
}

export interface FinancialSafetyAnalysis {
  sellingPrice: number;
  cogs: number | null;
  cogsStatus: FinancialSafetyState;
  unitShipping: number;
  shippingStatus: 'KNOWN_ACTUAL' | 'ESTIMATED';
  unitHandling: number;
  handlingStatus: 'KNOWN_ACTUAL' | 'ESTIMATED';
  unitPaymentGatewayCost: number;
  variableCostStatus: 'ESTIMATED';
  totalVariableCost: number;
  currentContribution: number | null;
  currentMarginPct: number | null;
  minimumContributionAmount: number;
  minimumMarginPercent: number;
  maximumDiscountPercent: number;
  policySource: 'MERCHANT_CONFIGURED' | 'SYSTEM_DEFAULT';
  minAllowedContribution: number;
  minMarginFloorPct: number;
  marginPolicyStatus: 'DEFAULT_SAFETY_POLICY' | 'MERCHANT_CONFIGURED_POLICY';
  financiallySafeDiscount: number;
  merchantMaxDiscount: number;
  maxSafeDiscount: number;
  isDiscountSafe: boolean;
  discountBlockReason?: string;
}

export interface ExpectedImpactEstimate {
  targetAudienceCount: number;
  observedBaselineMetric: string;
  modelEstimatedConversionLiftPct: number;
  simulatedIncrementalOrders: number;
  simulatedGrossRevenueDelta: number;
  simulatedDiscountCost: number;
  simulatedIncrementalVariableCost: number;
  simulatedReturnRiskCost: number;
  simulatedNetContributionProfitDelta: number;
}

export interface RecommendationExplanation {
  observation: string;
  proposedActionRationale: string;
  whyThisOptionChosen: string;
  whatAlternativesConsidered: string[];
  financialTradeoff: string;
  risksAndDrawbacks: string[];
  keyAssumptions: string[];
  dataLimitations: string[];
}

export interface ProfitSafeRecommendation {
  recommendationId: string;
  opportunityId: string;
  merchantId: string;
  type: RecommendationType;
  status: RecommendationStatus;
  priorityScore: number;
  target: {
    entityType: 'PRODUCT' | 'CUSTOMER' | 'CUSTOMER_SEGMENT' | 'SUPPLIER';
    entityId?: number | string;
    name: string;
    scope: 'TARGETED' | 'PRODUCT_LEVEL' | 'STORE_WIDE';
    customerId?: string;
    customerName?: string;
    productId?: number;
    productTitle?: string;
    sku?: string;
  };
  proposedAction: {
    actionType: 'INCENTIVE_CAMPAIGN' | 'RESTOCK' | 'MARKDOWN' | 'CONTENT_CORRECTION' | 'MERCHANDISING' | 'MONITOR_ONLY';
    summary: string;
    suggestedIncentive?: IncentiveOption;
    suggestedRestockUnits?: number;
    suggestedMarkdownPct?: number;
    recommendedChannel?: 'STOREFRONT_POPUP' | 'CART_BANNER' | 'CATALOG_BADGE' | 'INTERNAL_TASK';
  };
  alternativeOptions: IncentiveOption[];
  financialAnalysis: FinancialSafetyAnalysis;
  expectedImpact: ExpectedImpactEstimate;
  confidence: ConfidenceLevel;
  staleCheck: {
    snapshotPrice: number;
    snapshotStock: number;
    snapshotCogs: number | null;
    isStale: boolean;
    staleReason?: string;
  };
  explanation: RecommendationExplanation;
  createdAt: string;
  expiresAt: string;
}

export interface RecommendationListFilter {
  type?: RecommendationType;
  status?: RecommendationStatus;
  confidence?: ConfidenceLevel;
  limit?: number;
}
