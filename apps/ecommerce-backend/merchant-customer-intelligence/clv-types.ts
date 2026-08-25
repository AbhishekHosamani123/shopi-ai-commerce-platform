/**
 * ⚡ Dynamic Customer Lifetime Value (CLV) & Churn Intelligence Types (Phase 5)
 */

export type ChurnRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ClvTrendDirection = 'EXPANDING' | 'STABLE' | 'DECLINING';
export type IntelligenceConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CustomerClvRecord {
  userId: number;
  name: string;
  email: string;
  historicalSpend: number;
  orderCount: number;
  avgOrderValue: number;
  firstOrderDate: string;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  avgRepeatIntervalDays: number;
  currentClv: number;
  expectedClv: number;
  clvTrend: ClvTrendDirection;
  churnRisk: ChurnRiskLevel;
  churnProbabilityPct?: number | null;
  confidence: IntelligenceConfidence;
}

export interface CustomerCohortSummary {
  totalCustomers: number;
  totalHistoricalSpend: number;
  avgClv: number;
  vipCount: number;
  loyalCount: number;
  atRiskCount: number;
  dormantCount: number;
  churnRiskBreakdown: {
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
  overallConfidence: IntelligenceConfidence;
}

export interface CustomerCampaignSimulationRequest {
  targetSegment: 'AT_RISK' | 'VIP' | 'ALL';
  discountPct: number;
  merchantId?: string;
}

export interface CustomerCampaignSimulationResult {
  simulatedLabel: 'SIMULATED / ESTIMATED';
  targetSegment: string;
  audienceSize: number;
  avgHistoricalSpend: number;
  estimatedDiscountCost: number;
  projectedRevenueRange: {
    min: number;
    mid: number;
    max: number;
  };
  assumptions: string[];
  riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: IntelligenceConfidence;
}
