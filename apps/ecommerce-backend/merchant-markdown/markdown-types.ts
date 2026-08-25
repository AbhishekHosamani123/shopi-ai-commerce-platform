/**
 * ⚡ Dynamic Markdown Timing & Inventory Clearance Curves (Phase 6)
 */

export type MarkdownUrgency = 'NO_DISCOUNT' | 'WATCH' | 'DISCOUNT_NOW' | 'DEEP_DISCOUNT' | 'CLEARANCE';

export interface MarkdownTimingSchedule {
  productId: number;
  productTitle: string;
  currentStock: number;
  inventoryAgeDays: number;
  salesVelocity30d: number;
  projectedStockoutDays: number;
  urgency: MarkdownUrgency;
  recommendedDiscountPct: number;
  recommendedEffectiveDate: string;
  recommendedEndDate: string;
  timingRationale: string;
  cannibalizationWarning?: string;
}

export interface MarkdownCascadeSimulationInput {
  productId: number;
  discountPct: number;
  durationDays?: number;
  merchantId?: string;
}

export interface MarkdownCascadeSimulationResult {
  simulatedLabel: 'SIMULATED / ESTIMATED';
  productId: number;
  productTitle: string;
  proposedDiscountPct: number;
  estimatedDemandLiftPct: number;
  projectedUnitsSold: number;
  projectedRevenue: number;
  substituteCannibalizationImpact: {
    hasSubstituteConflict: boolean;
    substituteProductId?: number;
    substituteProductTitle?: string;
    estimatedDivertedUnits: number;
    netCategoryRevenueImpact: string;
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  assumptions: string[];
}
