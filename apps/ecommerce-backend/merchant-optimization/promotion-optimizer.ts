import { getProductHistoricalProfile } from './historical-analytics';

export type PromotionStrategyType =
  | 'PROMOTE'
  | 'DISCOUNT'
  | 'BUNDLE'
  | 'FEATURE'
  | 'RESTOCK_AND_PROMOTE'
  | 'NO_PROMOTION';

export interface PromotionStrategyResult {
  productId: number;
  title: string;
  strategy: PromotionStrategyType;
  recommendedAction: string;
  reason: string;
  projectedLiftPct: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Optimizes promotion and discounting strategy per SKU.
 */
export async function optimizeProductPromotionStrategy(productId: number): Promise<PromotionStrategyResult | null> {
  const profile = await getProductHistoricalProfile(productId);
  if (!profile) return null;

  const v7 = profile.last7Days.dailyVelocity;
  const stock = profile.currentStock;
  const growth = profile.growthPct;

  let strategy: PromotionStrategyType = 'NO_PROMOTION';
  let recommendedAction = 'Maintain organic merchandising placement.';
  let reason = 'Organic sales velocity is healthy with current pricing.';
  let projectedLiftPct = 0;
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';

  // Strategy 1: High Demand + Low Stock -> Do NOT discount, restock first!
  if (v7 >= 2.0 && stock < 30) {
    strategy = 'RESTOCK_AND_PROMOTE';
    recommendedAction = 'Restock inventory before launching promotional spotlight.';
    reason = `Product has high organic demand (${v7} units/day) but low stock (${stock} units). Discounting would cause immediate stockouts without maximizing revenue.`;
    projectedLiftPct = 0;
  }
  // Strategy 2: High Demand + Healthy Stock -> Promote / Feature
  else if (v7 >= 1.5 && stock >= 50) {
    strategy = 'PROMOTE';
    recommendedAction = 'Feature in homepage hero banner and category top picks.';
    reason = `Strong demand trajectory (+${growth}% growth) backed by robust inventory buffer (${stock} units). High return-on-exposure candidate.`;
    projectedLiftPct = 25;
  }
  // Strategy 3: Stagnant Demand + High Stock -> 10-15% Clearance Discount
  else if (v7 <= 0.5 && stock > 80) {
    strategy = 'DISCOUNT';
    recommendedAction = 'Stage 10% promotional clearance discount.';
    reason = `Slow velocity (${v7} units/day) with high inventory holding (${stock} units). Targeted discount stimulates conversion and recovers working capital.`;
    projectedLiftPct = 35;
  }
  // Strategy 4: Moderate Demand + Slower Growth -> Bundle
  else if (stock > 40 && growth < 0) {
    strategy = 'BUNDLE';
    recommendedAction = 'Bundle with top-selling accessories.';
    reason = `Moderate stock with slowing momentum. Cross-merchandising improves basket size without direct margin dilution.`;
    projectedLiftPct = 15;
  }

  return {
    productId: profile.productId,
    title: profile.title,
    strategy,
    recommendedAction,
    reason,
    projectedLiftPct,
    confidence
  };
}
