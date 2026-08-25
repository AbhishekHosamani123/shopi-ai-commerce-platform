export type ModelStatus = 'ACTIVE' | 'SHADOW' | 'RETIRED' | 'CANDIDATE';

export type ModelType = 
  | 'DEMAND_FORECAST'
  | 'PRICE_ELASTICITY'
  | 'REORDER_POINT'
  | 'SUPPLIER_RELIABILITY'
  | 'CHURN_RISK'
  | 'CANNIBALIZATION'
  | 'AD_RESPONSE'
  | 'CAPITAL_PAYBACK';

export interface ModelVersionRecord {
  modelId: string;
  merchantId: string;
  modelType: ModelType;
  version: number;
  status: ModelStatus;
  parameters: Record<string, any>;
  sampleCount: number;
  trainingWindow: string;
  metrics: {
    mae?: number;
    mape?: number;
    biasScore?: number;
    directionAccuracyPct?: number;
    precisionPct?: number;
    recallPct?: number;
  };
  createdAt: string;
  promotedAt?: string | null;
  retiredAt?: string | null;
}

export interface ChampionChallengerComparison {
  modelType: ModelType;
  champion: ModelVersionRecord;
  challenger?: ModelVersionRecord | null;
  accuracyDeltaPct: number;
  recommendation: 'MAINTAIN_CHAMPION' | 'PROMOTE_CHALLENGER_PENDING_APPROVAL' | 'INSUFFICIENT_EVIDENCE';
  evaluationDetails: string;
}
