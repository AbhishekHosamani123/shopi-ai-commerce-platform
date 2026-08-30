export type OfferCategory =
  | 'NO_DISCOUNT'
  | 'SAFE_FIXED_DISCOUNT'
  | 'SAFE_PERCENT_DISCOUNT'
  | 'NO_SAFE_OFFER'
  | 'OFFER_NOT_ELIGIBLE';

export type OfferSafetyStatus = 'SAFE' | 'BLOCKED' | 'OFFER_NOT_ELIGIBLE';

export interface CandidateOfferSimulation {
  candidateId: string;
  category: OfferCategory;
  discountAmount: number;
  discountPercent?: number;
  discountedPrice: number;
  discountedContribution: number;
  discountedMarginPct: number;
  contributionSacrificed: number;
  breakEvenIncrementalOrders: number;
  breakEvenIncrementalSales: number;
  isMarginFloorPreserved: boolean;
  safetyStatus: OfferSafetyStatus;
  rankingScore: number;
  selectionRationale: string;
}

export interface CustomerOfferEligibility {
  isEligible: boolean;
  targetCustomerExists: boolean;
  isOpportunityFresh: boolean;
  isSubsequentPurchaseSuppressed: boolean;
  isConsentVerified: boolean;
  isCooldownSatisfied: boolean;
  suppressionReason?: string;
}

export interface ProfitSafeOfferStructuredExplanation {
  observed: string;
  calculated: string;
  modelEstimate: string;
  recommendation: string;
  risk: string;
}

export interface ProfitSafeOfferRecommendation {
  recommendationId: string;
  opportunityId: string;
  merchantId: string;
  customerId: string;
  customerName: string;
  productId: number;
  sku: string;
  productTitle: string;
  variantId: number | null;
  variantSku?: string;
  category: OfferCategory;
  offerValue: number; // Discount in rupees
  offerText: string;  // e.g. "₹50 OFF", "5% OFF", "No Discount"
  sellingPrice: number;
  cogsUnitCost: number | null;
  marginFloorPct: number;
  maxSafeDiscount: number;
  discountedPrice: number;
  postOfferContribution: number | null;
  postOfferMarginPct: number | null;
  breakEvenIncrementalOrders: number;
  safetyStatus: OfferSafetyStatus;
  candidateSimulations: CandidateOfferSimulation[];
  eligibility: CustomerOfferEligibility;
  structuredExplanation: ProfitSafeOfferStructuredExplanation;
  action: {
    actionType: string;
    requiresMerchantApproval: true;
    status: 'PENDING_APPROVAL';
  };
  createdAt: string;
  expiresAt: string;
}

export interface OfferEvaluationFilter {
  customerId?: string;
  productId?: number;
  category?: OfferCategory;
  safetyStatus?: OfferSafetyStatus;
  limit?: number;
}
