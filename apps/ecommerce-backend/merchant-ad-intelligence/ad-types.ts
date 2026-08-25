/**
 * ⚡ Advertising Intelligence & Budget Allocation Types (Phase 6)
 */

export type AdChannelProvider = 'GOOGLE' | 'META' | 'AMAZON' | 'DIRECT_STORE' | 'OTHER';

export interface AdEligibilityResult {
  productId: number;
  productTitle: string;
  isEligible: boolean;
  eligibilityScore: number; // 0 - 100
  daysOfCover: number;
  returnRatePct: number;
  cannibalizationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  blockingReasons: string[];
  reasons: string[];
  recommendedAdChannel: AdChannelProvider;
}

export interface AdProductBudgetAllocation {
  productId: number;
  productTitle: string;
  channel: AdChannelProvider;
  allocatedBudget: number;
  allocationPercentage: number;
  opportunityScore: number;
  expectedImpressionBand: string;
  expectedDemandLiftPct: number;
  rationale: string;
}

export interface AdBudgetAllocationPlan {
  totalBudget: number;
  allocatedSpend: number;
  unallocatedReserve: number;
  providerStatus: Record<AdChannelProvider, 'ACTIVE' | 'NOT_CONFIGURED' | 'SIMULATED'>;
  productAllocations: AdProductBudgetAllocation[];
  dataHealthNotice: string;
  createdAt: string;
}

export interface AdSpendSimulationInput {
  productId: number;
  adSpend: number;
  channel?: AdChannelProvider;
  merchantId?: string;
}

export interface AdSpendSimulationResult {
  simulatedLabel: 'SIMULATED / ESTIMATED';
  productId: number;
  productTitle: string;
  adSpend: number;
  channel: AdChannelProvider;
  inventoryCoverageDays: number;
  projectedDemandRange: {
    minUnits: number;
    midUnits: number;
    maxUnits: number;
  };
  projectedRevenueRange: {
    minRevenue: number;
    midRevenue: number;
    maxRevenue: number;
  };
  stockoutRiskAfterAdLift: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  assumptions: string[];
}
