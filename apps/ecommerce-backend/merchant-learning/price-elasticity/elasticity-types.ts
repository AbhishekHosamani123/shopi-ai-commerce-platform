import { ConfidenceLevel } from '../outcome-types';

export type ElasticityEvidenceType = 'OBSERVATIONAL_SIGNAL' | 'EXPERIMENTALLY_ESTIMATED';

export interface PriceObservation {
  observationId: string;
  productId: number;
  oldPrice: number;
  newPrice: number;
  oldUnitsPerPeriod: number;
  newUnitsPerPeriod: number;
  isControlledExperiment: boolean;
  timestamp: string;
  source: string;
}

export interface BayesianPriceElasticityModel {
  productId: number;
  productTitle: string;
  priorElasticity: number;
  priorVariance: number;
  posteriorElasticity: number;
  posteriorVariance: number;
  credibleInterval: {
    min: number; // 95% credible lower bound (posterior - 1.96*std)
    max: number; // 95% credible upper bound (posterior + 1.96*std)
  };
  sampleObservations: number;
  evidenceType: ElasticityEvidenceType;
  priceRangeObserved: {
    min: number;
    max: number;
  };
  confidence: ConfidenceLevel;
  lastUpdated: string;
  interpretation: string;
}

export interface ElasticityPredictionResult {
  productId: number;
  productTitle: string;
  currentPrice: number;
  proposedPrice: number;
  priceChangePct: number;
  learnedElasticity: number;
  predictedDemandChangePct: number;
  predictedUnitsPerWeek: number;
  currentUnitsPerWeek: number;
  expectedRevenueChangePct: number;
  confidence: ConfidenceLevel;
  evidenceType: ElasticityEvidenceType;
  cautionNotice?: string;
}
