export type MerchantGoalType = 
  | 'INCREASE_REVENUE'
  | 'INCREASE_MARGIN'
  | 'REDUCE_DEAD_STOCK'
  | 'REDUCE_STOCKOUTS'
  | 'IMPROVE_RETENTION'
  | 'REDUCE_RETURNS'
  | 'IMPROVE_CASH_EFFICIENCY'
  | 'INCREASE_ROAS';

export interface UnifiedRecommendation {
  recommendationId: string;
  merchantId: string;
  title: string;
  category: 'INVENTORY' | 'PRICING' | 'PROMOTIONS' | 'MARKETING' | 'SUPPLIER' | 'CAPITAL' | 'RETENTION' | 'OPERATIONS';
  businessProblem: string;
  evidence: {
    telemetrySource: string;
    sampleCount: number;
    metrics: Record<string, any>;
  };
  expectedImpact: {
    unitChange?: number;
    revenueImpact: number;
    marginImpactPct?: number;
    paybackDays?: number;
    description: string;
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceScore: number; // 0.0 - 1.0
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  riskDescription: string;
  dataSufficiency: 'HIGH' | 'MEDIUM' | 'LOW';
  dataSufficiencyReason: string;
  requiredAction: {
    actionType: string;
    targetId?: number | string;
    targetName?: string;
    payload: Record<string, any>;
    stagedActionId?: string;
  };
  estimatedFinancialImpact: {
    min: number;
    mid: number;
    max: number;
  };
  expirationTimestamp: string;
  status: 'PENDING' | 'APPROVED' | 'EXECUTED' | 'REJECTED' | 'EXPIRED';
  priorityScore: number; // 0 - 100
  previousSimilarRecommendation?: {
    recommendationId: string;
    actionType: string;
    executedAt?: string;
    status: string;
  };
  previousOutcome?: {
    outcomeId: string;
    predictedMid: number;
    actualValue: number;
    percentageError: number;
    directionCorrect: boolean;
  };
}

export interface MerchantGoalConfig {
  merchantId: string;
  activeGoal: MerchantGoalType;
  targetDescription: string;
  deadlineDays: number;
  updatedAt: string;
}
