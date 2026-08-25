/**
 * ⚡ Merchant AI Optimization, Pricing & Growth Types (Phase 4)
 */

export type BusinessGoal =
  | 'MAXIMIZE_REVENUE'
  | 'MAXIMIZE_UNITS'
  | 'CLEAR_INVENTORY'
  | 'PROTECT_MARGIN'
  | 'GROW_CUSTOMERS'
  | 'INCREASE_REPEAT_PURCHASES';

export type RecommendationCategory =
  | 'PRICING'
  | 'INVENTORY'
  | 'PROMOTION'
  | 'CUSTOMER'
  | 'CATEGORY';

export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type UrgencyLevel = 'CRITICAL' | 'WARNING' | 'INFO';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DataHealthSummary {
  orderHistoryDays: number;
  orderCoverageStatus: 'OPTIMAL' | 'SUFFICIENT' | 'INSUFFICIENT';
  productCount: number;
  productCoverageStatus: 'OPTIMAL' | 'SUFFICIENT' | 'INSUFFICIENT';
  priceVariationCount: number;
  priceHistoryStatus: 'OPTIMAL' | 'SUFFICIENT' | 'INSUFFICIENT';
  inventoryHistoryDays: number;
  inventoryCoverageStatus: 'OPTIMAL' | 'SUFFICIENT' | 'INSUFFICIENT';
  customerHistoryDays: number;
  customerCoverageStatus: 'OPTIMAL' | 'SUFFICIENT' | 'INSUFFICIENT';
  overallHealthScore: number; // 0 - 100
  notes: string[];
}

export interface ProductHistoricalProfile {
  productId: number;
  title: string;
  categoryName: string;
  currentStock: number;
  price: number;
  discountPrice?: number | null;
  last7Days: {
    revenue: number;
    units: number;
    dailyVelocity: number;
  };
  last30Days: {
    revenue: number;
    units: number;
    dailyVelocity: number;
  };
  previous30Days: {
    revenue: number;
    units: number;
  };
  growthPct: number;
  returnRatePct: number;
  estimatedCoverageDays: number | null;
  dataPointsCount: number;
}

export interface DemandForecastResult {
  productId: number;
  title: string;
  historicalDailyVelocity7d: number;
  historicalDailyVelocity30d: number;
  trendAdjustmentPct: number;
  forecastDailyDemand: number;
  forecast7DaysUnits: number;
  forecast14DaysUnits: number;
  forecast30DaysUnits: number;
  currentStock: number;
  daysUntilStockout: number | null;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  explanation: string;
  isReliable: boolean;
}

export interface InventoryOptimizationPlan {
  productId: number;
  title: string;
  currentStock: number;
  averageDailyDemand: number;
  forecastDailyDemand: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  recommendedReorderQuantity: number;
  daysOfCover: number | null;
  urgency: UrgencyLevel;
  reason: string;
}

export interface PricingRecommendation {
  productId: number;
  title: string;
  currentPrice: number;
  recommendedPrice: number;
  priceDelta: number;
  priceDeltaPct: number;
  direction: 'INCREASE' | 'DECREASE' | 'MAINTAIN';
  estimatedElasticity: number | null;
  elasticityLabel: string;
  confidence: ConfidenceLevel;
  reason: string;
  actionId?: string | null;
}

export interface CustomerRfmSegment {
  userId: number;
  username: string;
  email: string;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  recencyScore: number; // 1-5
  frequencyScore: number; // 1-5
  monetaryScore: number; // 1-5
  segment: 'VIP' | 'LOYAL' | 'REPEAT' | 'NEW' | 'AT_RISK' | 'DORMANT' | 'ONE_TIME';
}

export interface CustomerGrowthSummary {
  totalCustomers: number;
  vipCount: number;
  loyalCount: number;
  repeatCount: number;
  newCount: number;
  atRiskCount: number;
  dormantCount: number;
  oneTimeCount: number;
  topAtRiskCustomers: CustomerRfmSegment[];
  growthOpportunities: string[];
}

export interface MerchantAiRecommendationRecord {
  recommendationId: string;
  merchantId: string;
  category: RecommendationCategory;
  goal: BusinessGoal;
  title: string;
  summary: string;
  productId?: number | null;
  impact: ImpactLevel;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  urgency: UrgencyLevel;
  risk: RiskLevel;
  actionType?: string | null;
  actionId?: string | null;
  evidence: Record<string, any>;
  status: 'ACTIVE' | 'ACCEPTED' | 'DISMISSED' | 'EXPIRED';
  createdAt: string;
  expiresAt?: string | null;
}

export interface PostActionOutcomeRecord {
  outcomeId: string;
  merchantId: string;
  actionId: string;
  actionType: string;
  productId?: number | null;
  beforeMetrics: {
    unitsPerDay: number;
    revenuePerDay: number;
    returnRatePct: number;
  };
  afterMetrics: {
    unitsPerDay: number;
    revenuePerDay: number;
    returnRatePct: number;
  };
  velocityChangePct: number;
  revenueChangePct: number;
  evaluationSummary: string;
  measuredAt: string;
}
