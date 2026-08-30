export type OpportunityType =
  // Canonical Phase 13 Customer Opportunities
  | 'HIGH_INTENT_PRODUCT'
  | 'HIGH_INTENT_CUSTOMERS' // Backward-compatible alias
  | 'CART_ABANDONMENT'
  | 'CHECKOUT_ABANDONMENT'
  | 'REPEAT_BUYER_RETENTION'
  | 'REPEAT_CUSTOMER_RETENTION' // Backward-compatible alias
  | 'ONE_TIME_BUYER_CONVERSION'
  | 'DORMANT_CUSTOMER_REACTIVATION'
  | 'DORMANT_REACTIVATION' // Backward-compatible alias
  | 'VIP_RETENTION'
  | 'VIP_AT_RISK' // Backward-compatible alias
  | 'PRODUCT_REPURCHASE'
  // Product & Inventory Opportunities
  | 'HIGH_INTEREST_LOW_CONVERSION'
  | 'HIGH_DEMAND_LOW_STOCK'
  | 'STOCKOUT_RISK'
  | 'DEAD_STOCK'
  | 'RETURN_PROBLEM'
  | 'HIGH_MARGIN_WINNER';

export type OpportunityPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type OpportunityStatus = 'NEW' | 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'EXPIRED';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_EVIDENCE';

export type UrgencyLevel = 'IMMEDIATE' | 'THIS_WEEK' | 'MONITOR';

export type BusinessImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type FinancialSafetyState = 'KNOWN_COGS' | 'ESTIMATED_COGS' | 'MISSING_COGS';

export interface OpportunityTarget {
  entityType: 'PRODUCT' | 'CUSTOMER_SEGMENT' | 'CUSTOMER' | 'INVENTORY_CATEGORY';
  entityId?: string | number | null;
  name: string;
  customerId?: string | null;
  productId?: number | null;
  sku?: string | null;
  variantId?: string | number | null;
}

export interface OpportunityEvidence {
  telemetrySource: string;
  sampleSize: number;
  signals: Record<string, any>;
  observedAt: string;
}

export interface OpportunityFinancialContext {
  sellingPrice: number;
  cogsUnitCost: number | null;
  contributionMargin: number | null;
  marginFloorPct: number;
  maxSafeDiscount: number | null;
  discountAllowed: boolean;
  reason: string;
}

export interface OpportunityMetrics {
  potentialRevenue?: number;
  impactedCustomers?: number;
  unitsAtRisk?: number;
  marginImpactPct?: number | null;
  currentConversionRatePct?: number | null;
  returnRatePct?: number | null;
  deadStockCapitalTiedUp?: number | null;
}

export interface StructuredOpportunityExplanation {
  observed: string;
  calculated: string;
  modelEstimate: string;
  recommendation: string;
  risk: string;
}

export interface OpportunityExplanation {
  observation: string;
  hypothesis: string[];
  questionsToInvestigate: string[];
  limitations: string[];
  structured?: StructuredOpportunityExplanation;
}

export interface MerchantOpportunity {
  opportunityId: string;
  merchantId: string;
  type: OpportunityType;
  priority: OpportunityPriority;
  status: OpportunityStatus;
  priorityScore: number; // 0 - 100
  title: string;
  summary: string;
  target: OpportunityTarget;
  evidence: OpportunityEvidence;
  metrics: OpportunityMetrics;
  confidence: ConfidenceLevel;
  urgency: UrgencyLevel;
  businessImpact: BusinessImpactLevel;
  financialSafety: FinancialSafetyState;
  financialContext?: OpportunityFinancialContext;
  recommendedAction?: string;
  detectedAt: string;
  expiresAt: string;
  explanation: OpportunityExplanation;
  structuredExplanation?: StructuredOpportunityExplanation;
}

export interface OpportunityListFilter {
  type?: OpportunityType;
  priority?: OpportunityPriority;
  status?: OpportunityStatus;
  confidence?: ConfidenceLevel;
  customerId?: string;
  productId?: number;
  limit?: number;
}
