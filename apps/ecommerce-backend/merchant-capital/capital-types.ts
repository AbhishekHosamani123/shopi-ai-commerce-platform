/**
 * ⚡ Capital Allocation & Investment Portfolio Types (Phase 6)
 */

export type CapitalAllocationCategory =
  | 'RESTOCK_HIGH_VELOCITY'
  | 'CUSTOMER_RETENTION'
  | 'ADVERTISING_ACQUISITION'
  | 'PRICE_PROMOTION_BUFFER'
  | 'WORKING_CAPITAL_RESERVE';

export interface CapitalOpportunity {
  category: CapitalAllocationCategory;
  title: string;
  recommendedAmount: number;
  allocationPercentage: number;
  expectedPaybackPeriodDays: number;
  expectedImpact: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  targetSkuId?: number;
  targetSkuTitle?: string;
  actionRequired: string;
  assumptions: string[];
}

export interface CapitalAllocationPlan {
  allocationId: string;
  merchantId: string;
  totalBudget: number;
  opportunities: CapitalOpportunity[];
  projectedRevenueRange: {
    min: number;
    mid: number;
    max: number;
  };
  totalWorkingCapitalReserve: number;
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  dataHealthNotice?: string;
  createdAt: string;
}

export interface CapitalScenarioSimulationInput {
  totalBudget: number;
  strategyEmphasis?: 'BALANCED' | 'AGGRESSIVE_GROWTH' | 'DEFENSIVE_CASH' | 'INVENTORY_ONLY' | 'ADVERTISING_HEAVY';
  merchantId?: string;
}

export interface CapitalScenarioSimulationResult {
  simulatedLabel: 'SIMULATED / ESTIMATED';
  totalBudget: number;
  strategyEmphasis: string;
  allocatedPortfolio: {
    inventoryRestock: number;
    customerRetention: number;
    advertising: number;
    cashReserve: number;
  };
  projectedReturnRange: {
    minProjectedRevenue: number;
    midProjectedRevenue: number;
    maxProjectedRevenue: number;
    estimatedPaybackDays: number;
  };
  inventoryImpact: string;
  riskAssessment: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  assumptions: string[];
}
