/**
 * ⚡ Merchant AI Experimentation / A-B Test Foundation Types (Phase 4)
 */

export type ExperimentType = 'PRICE_TEST' | 'DISCOUNT_TEST' | 'PROMOTION_TEST';
export type ExperimentStatus = 'DRAFT' | 'RUNNING' | 'CONCLUDED' | 'CANCELLED';

export interface CreateExperimentInput {
  merchantId?: string;
  name: string;
  experimentType: ExperimentType;
  productId: number;
  controlConfig: {
    price?: number;
    discountPct?: number;
  };
  variantConfig: {
    price?: number;
    discountPct?: number;
  };
}

export interface MerchantExperimentRecord {
  experimentId: string;
  merchantId: string;
  name: string;
  experimentType: ExperimentType;
  status: ExperimentStatus;
  productId: number;
  productTitle?: string;
  controlConfig: Record<string, any>;
  variantConfig: Record<string, any>;
  metrics: {
    controlUnits?: number;
    variantUnits?: number;
    controlRevenue?: number;
    variantRevenue?: number;
    confidenceLevelPct?: number;
  };
  startedAt?: string | null;
  concludedAt?: string | null;
  createdAt: string;
}
