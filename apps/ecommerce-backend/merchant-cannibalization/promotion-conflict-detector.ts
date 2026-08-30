import { client } from '../data/DB';
import { findSimilarProducts } from './product-similarity';
import { PromotionConflictWarning } from './cannibalization-types';

export class PromotionConflictDetector {
  /**
   * Checks if promoting a SKU conflicts with active promotions on highly substitutable items.
   */
  async checkPromotionConflict(
    targetProductId: number,
    plannedDiscountPct: number = 10,
    merchantId: string = 'default_merchant'
  ): Promise<PromotionConflictWarning> {
    const targetRes = await client.query('SELECT product_id, title, selling_price, discount_percentage FROM shopi_products WHERE product_id = $1', [targetProductId]);
    if (targetRes.rows.length === 0) {
      return {
        hasConflict: false,
        targetProductId,
        targetProductTitle: 'Unknown Product',
        conflictingProducts: [],
        requiresMerchantOverride: false
      };
    }

    const target = targetRes.rows[0];
    const similar = await findSimilarProducts(targetProductId, 5);

    const conflictingProducts: {
      productId: number;
      title: string;
      similarityScore: number;
      currentDiscountPct: number;
      reason: string;
    }[] = [];

    for (const sim of similar) {
      if (sim.similarityScore >= 0.55) {
        const otherRes = await client.query('SELECT product_id, title, selling_price, discount_percentage FROM shopi_products WHERE product_id = $1', [sim.productIdB]);
        if (otherRes.rows.length > 0) {
          const other = otherRes.rows[0];
          const discPct = other.discount_percentage || 0;
          const isDiscounted = discPct > 0;

          if (isDiscounted && discPct >= 5) {
            conflictingProducts.push({
              productId: other.productid,
              title: other.title,
              similarityScore: sim.similarityScore,
              currentDiscountPct: discPct,
              reason: `High substitution similarity (${Math.round(sim.similarityScore * 100)}%) and already discounted by ${discPct}%.`
            });
          }
        }
      }
    }

    if (conflictingProducts.length > 0) {
      return {
        hasConflict: true,
        targetProductId,
        targetProductTitle: target.title,
        conflictingProducts,
        warningMessage: `These two products have strong substitution signals. Promoting both simultaneously may shift demand rather than create incremental demand.`,
        suggestedRemedy: `Stagger promotions sequentially or feature '${target.title}' in a complementary bundle instead of double-discounting.`,
        requiresMerchantOverride: true
      };
    }

    return {
      hasConflict: false,
      targetProductId,
      targetProductTitle: target.title,
      conflictingProducts: [],
      requiresMerchantOverride: false
    };
  }
}

export const promotionConflictDetector = new PromotionConflictDetector();
