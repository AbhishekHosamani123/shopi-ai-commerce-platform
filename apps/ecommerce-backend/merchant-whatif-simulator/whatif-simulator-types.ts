export type ScenarioSimulationType =
  | 'PRICE_CHANGE'
  | 'REORDER_BATCH'
  | 'AD_SPEND'
  | 'SKU_RETIREMENT'
  | 'WAREHOUSE_TRANSFER'
  | 'TARGET_MARGIN';

export interface WhatIfSimulationInput {
  simulationType: ScenarioSimulationType;
  productId?: number;
  priceDeltaPct?: number;
  orderQuantity?: number;
  adSpendAmount?: number;
  sourceWarehouseId?: string;
  targetWarehouseId?: string;
  targetMarginPct?: number;
  merchantId?: string;
}

export interface WhatIfSimulationResult {
  simulationId: string;
  simulationType: ScenarioSimulationType;
  title: string;
  summary: string;
  observedBaseline: {
    unitsPerMonth: number;
    monthlyRevenue: number;
    contributionMarginPct: number;
    stockOnHand: number;
    workingCapitalLocked: number;
    telemetrySource: string;
  };
  modelPrediction: {
    expectedUnitChangePct: number;
    expectedUnits: number;
    expectedRevenue: number;
    expectedContributionProfit: number;
    expectedMarginPct: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    confidenceScore: number;
  };
  simulationOutcome: {
    projectedNetRevenueDelta: number;
    projectedProfitDelta: number;
    capitalImpact: number;
    daysStockCover: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    riskAnalysis: string;
  };
  keyAssumptions: string[];
  dataSufficiencyNotice?: string;
  timestamp: string;
}
