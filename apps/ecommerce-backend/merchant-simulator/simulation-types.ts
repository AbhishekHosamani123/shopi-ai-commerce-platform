/**
 * ⚡ Merchant AI What-If Simulator Types (Phase 4)
 */

export type SimulationScenarioType =
  | 'PRICE_CHANGE'
  | 'DISCOUNT_CLEARANCE'
  | 'RESTOCK_EXPANSION'
  | 'CATEGORY_PROMOTION';

export interface SimulationRequest {
  scenarioType: SimulationScenarioType;
  productId?: number;
  categoryName?: string;
  parameters: {
    newPrice?: number;
    priceChangePct?: number;
    discountPct?: number;
    reorderUnits?: number;
    campaignBudget?: number;
  };
  merchantId?: string;
}

export interface SimulationResult {
  simulationId: string;
  scenarioType: SimulationScenarioType;
  productId?: number | null;
  productTitle?: string | null;
  parameters: Record<string, any>;
  currentState: {
    price: number;
    stock: number;
    dailyVelocity: number;
    monthlyRevenue: number;
  };
  projectedState: {
    projectedPrice: number;
    projectedDailyVelocity: number;
    projectedMonthlyRevenueMin: number;
    projectedMonthlyRevenueMax: number;
    projectedMonthlyRevenueMid: number;
    projectedDaysToDepletion: number | null;
    revenueDeltaPct: number;
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  assumptions: string[];
  riskAssessment: string;
  recommendationText: string;
  simulatedLabel: 'SIMULATED / ESTIMATED';
  createdAt: string;
}
