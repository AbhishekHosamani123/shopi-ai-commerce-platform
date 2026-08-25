export interface MerchantBusinessInfo {
  storeName: string;
  businessCategory: string;
  currency: string;
  primaryMarket: string;
  businessModel: string;
  activeGoals: string[];
}

export interface OnboardingProfile extends MerchantBusinessInfo {
  merchantId: string;
  onboardingCompleted: boolean;
  aiReadinessScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiReadinessDimension {
  domain: string;
  name: string;
  status: 'STRONG' | 'WEAK' | 'MISSING';
  observationCount: number;
  description: string;
  impactOnAi: string;
}

export interface AiReadinessReport {
  overallScore: number;
  status: 'EXCELLENT' | 'READY' | 'NEEDS_DATA' | 'NOT_READY';
  strongAreas: string[];
  weakAreas: string[];
  missingAreas: string[];
  dimensions: AiReadinessDimension[];
  summary: string;
  accuracyImpacts: {
    forecastingAccuracy: string;
    pricingPrecision: string;
    reorderConfidence: string;
    profitMarginVisibility: string;
  };
}
