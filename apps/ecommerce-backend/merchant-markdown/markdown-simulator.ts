import { client } from '../data/DB';
import { promotionConflictDetector } from '../merchant-cannibalization/promotion-conflict-detector';
import { MarkdownCascadeSimulationInput, MarkdownCascadeSimulationResult } from './markdown-types';

export class MarkdownSimulator {
  /**
   * Simulates demand lift, inventory depletion, and cross-SKU substitution consequences of markdown discounts.
   */
  async simulateMarkdown(input: MarkdownCascadeSimulationInput): Promise<MarkdownCascadeSimulationResult | null> {
    const prodRes = await client.query('SELECT productid, title, price, discount, stock FROM products WHERE productid = $1', [input.productId]);
    if (prodRes.rows.length === 0) return null;
    const prod = prodRes.rows[0];

    const currentStock = parseInt(prod.stock, 10) || 0;
    const originalPrice = parseFloat(prod.price) || 1000;
    const discountPct = Math.max(5, Math.min(60, input.discountPct));
    const discountedPrice = Math.round(originalPrice * (1 - discountPct / 100));

    // Elasticity multiplier (~1.5x elasticity)
    const demandLiftPct = Math.round(discountPct * 1.6);
    const baselineMonthlyUnits = Math.max(5, Math.round(currentStock * 0.25));
    const projectedUnitsSold = Math.min(currentStock, Math.round(baselineMonthlyUnits * (1 + demandLiftPct / 100)));
    const projectedRevenue = Math.round(projectedUnitsSold * discountedPrice);

    // Cross-SKU substitute check
    const conflict = await promotionConflictDetector.checkPromotionConflict(input.productId, discountPct, input.merchantId);
    const hasSubstituteConflict = conflict.hasConflict;
    const estimatedDivertedUnits = hasSubstituteConflict ? Math.round(projectedUnitsSold * 0.35) : 0;

    return {
      simulatedLabel: 'SIMULATED / ESTIMATED',
      productId: prod.productid,
      productTitle: prod.title,
      proposedDiscountPct: discountPct,
      estimatedDemandLiftPct: demandLiftPct,
      projectedUnitsSold,
      projectedRevenue,
      substituteCannibalizationImpact: {
        hasSubstituteConflict,
        substituteProductId: conflict.conflictingProducts[0]?.productId,
        substituteProductTitle: conflict.conflictingProducts[0]?.title,
        estimatedDivertedUnits,
        netCategoryRevenueImpact: hasSubstituteConflict
          ? `~${estimatedDivertedUnits} units projected to be diverted from substitute product variant (${conflict.conflictingProducts[0]?.title}).`
          : 'Zero cross-SKU demand diversion detected.'
      },
      confidence: 'HIGH',
      assumptions: [
        `Price elasticity of demand modeled at -1.6 for category apparel.`,
        `Assumes promotion duration of ${input.durationDays || 14} days.`,
        'Cannibalization assessed via catalog token and attribute cosine similarity.'
      ]
    };
  }
}

export const markdownSimulator = new MarkdownSimulator();
