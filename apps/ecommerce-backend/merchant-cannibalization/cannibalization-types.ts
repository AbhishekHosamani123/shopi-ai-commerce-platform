/**
 * ⚡ Cross-SKU Cannibalization & Substitution Matrix Types (Phase 5)
 */

export type SubstitutionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ProductSimilarity {
  productIdA: number;
  productTitleA: string;
  productIdB: number;
  productTitleB: string;
  categoryMatch: boolean;
  tagOverlapCount: number;
  priceRatio: number; // 0.0 - 1.0
  similarityScore: number; // 0.0 - 1.0
  substitutionConfidence: SubstitutionConfidence;
}

export interface CannibalizationSignal {
  signalId: string;
  productIdA: number;
  productTitleA: string;
  productIdB: number;
  productTitleB: string;
  similarityScore: number;
  velocityDeltaPctA: number;
  velocityDeltaPctB: number;
  estimatedCannibalizedUnits: number;
  interpretation: string;
  evidence: {
    periodADescription: string;
    periodBDescription: string;
    correlationScore: number;
  };
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PromotionConflictWarning {
  hasConflict: boolean;
  targetProductId: number;
  targetProductTitle: string;
  conflictingProducts: {
    productId: number;
    title: string;
    similarityScore: number;
    currentDiscountPct: number;
    reason: string;
  }[];
  warningMessage?: string;
  suggestedRemedy?: string;
  requiresMerchantOverride: boolean;
}
