export type ActionType = 
  | 'RESTOCK'
  | 'DISCOUNT'
  | 'PRICE_CHANGE'
  | 'PROMOTION'
  | 'AD_ALLOCATION'
  | 'WAREHOUSE_TRANSFER'
  | 'CAPITAL_ALLOCATION'
  | 'CUSTOMER_REENGAGE';

export type OutcomeStatus = 'PENDING' | 'OBSERVED' | 'EVALUATED' | 'EXPIRED' | 'CANCELLED';
export type LearningStatus = 'UNLEARNED' | 'LEARNED' | 'IGNORED';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type BiasClassification = 'OVER_FORECASTING' | 'UNDER_FORECASTING' | 'CALIBRATED';

export interface OutcomeRecord {
  outcomeId: string;
  decisionId: string;
  merchantId: string;
  actionType: ActionType;
  productId?: number | null;
  decisionTimestamp: string;
  predictionMetric: string;
  predictedMin?: number | null;
  predictedMid: number;
  predictedMax?: number | null;
  predictionConfidence: ConfidenceLevel;
  forecastHorizonDays: number;
  actualValue?: number | null;
  outcomeTimestamp?: string | null;
  outcomeStatus: OutcomeStatus;
  absoluteError?: number | null;
  percentageError?: number | null;
  directionCorrect?: boolean | null;
  biasClassification?: BiasClassification | null;
  learningStatus: LearningStatus;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOutcomeInput {
  decisionId: string;
  merchantId: string;
  actionType: ActionType;
  productId?: number | null;
  predictionMetric: string;
  predictedMin?: number | null;
  predictedMid: number;
  predictedMax?: number | null;
  predictionConfidence?: ConfidenceLevel;
  forecastHorizonDays?: number;
  metadata?: Record<string, any>;
}

export interface RecordActualOutcomeInput {
  outcomeId?: string;
  decisionId?: string;
  actualValue: number;
  outcomeTimestamp?: string;
  merchantId: string;
  metadata?: Record<string, any>;
}

export interface PredictionEvaluation {
  outcomeId: string;
  decisionId: string;
  predictedMid: number;
  predictedMin?: number | null;
  predictedMax?: number | null;
  actualValue: number;
  absoluteError: number;
  percentageError: number;
  directionCorrect: boolean;
  biasClassification: BiasClassification;
  confidenceCalibration: 'WELL_CALIBRATED' | 'OVERCONFIDENT' | 'UNDERCONFIDENT';
  isAccurate: boolean;
  evaluationSummary: string;
}

export interface ForecastAccuracySummary {
  horizonDays: number;
  sampleCount: number;
  mae: number;
  mape: number;
  biasScore: number;
  biasClassification: BiasClassification;
  directionAccuracyPct: number;
  dataDepthDays: number;
  confidence: ConfidenceLevel;
  confidenceReason: string;
}

export interface SKUForecastAccuracy {
  productId: number;
  productTitle: string;
  category: string;
  sampleCount: number;
  mae: number;
  mape: number;
  biasClassification: BiasClassification;
  isHardToForecast: boolean;
  volatilityScore: number;
}
