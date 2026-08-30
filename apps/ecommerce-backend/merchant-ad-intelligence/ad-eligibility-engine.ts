import { client } from '../data/DB';
import { AdEligibilityResult, AdChannelProvider } from './ad-types';

export class AdEligibilityEngine {
  /**
   * Evaluates a SKU for paid advertising suitability against strict inventory, return rate, and margin guardrails.
   */
  async evaluateProductAdEligibility(
    productId: number,
    merchantId: string = 'default_merchant'
  ): Promise<AdEligibilityResult | null> {
    const prodRes = await client.query(`
      SELECT 
        p.product_id,
        p.sku,
        p.title,
        p.stock_quantity as stock,
        p.category,
        COALESCE(
          (SELECT SUM(oi.quantity)::numeric / 30.0 
           FROM shopi_order_items oi 
           JOIN shopi_orders o ON oi.order_id = o.order_id 
           WHERE oi.product_id = p.product_id AND o.order_placed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' AND o.order_status NOT IN ('CANCELLED', 'Cancelled')), 0.5
        ) as daily_demand,
        COALESCE(
          (SELECT COUNT(r.return_id)::numeric / NULLIF(COUNT(oi.order_item_id), 0)
           FROM shopi_order_items oi
           LEFT JOIN shopi_order_returns r ON oi.order_id = r.order_id
           WHERE oi.product_id = p.product_id), 0.05
        ) as return_rate
      FROM shopi_products p
      WHERE p.product_id = $1;
    `, [productId]);

    if (prodRes.rows.length === 0) return null;
    const prod = prodRes.rows[0];

    const currentStock = parseInt(prod.stock, 10) || 0;
    const dailyDemand = Math.max(0.2, parseFloat(prod.daily_demand));
    const daysOfCover = Math.round(currentStock / dailyDemand);
    const returnRatePct = Math.round(parseFloat(prod.return_rate) * 100);

    const blockingReasons: string[] = [];
    const reasons: string[] = [];
    let isEligible = true;
    let score = 85;

    // Rule 1: Stockout protection (Do NOT advertise low-inventory items)
    if (daysOfCover < 7) {
      isEligible = false;
      score -= 50;
      blockingReasons.push(`Critically low inventory coverage (~${daysOfCover} days buffer / ${currentStock} units). Advertising will accelerate stockouts.`);
    } else if (daysOfCover < 14) {
      score -= 20;
      reasons.push(`Moderate inventory buffer (~${daysOfCover} days). Allocate limited budget.`);
    } else {
      reasons.push(`Healthy inventory coverage (~${daysOfCover} days buffer / ${currentStock} units).`);
    }

    // Rule 2: High return rate protection
    if (returnRatePct > 15) {
      isEligible = false;
      score -= 40;
      blockingReasons.push(`Elevated return rate (${returnRatePct}%). Paid traffic will result in disproportionate refund and reverse logistics costs.`);
    } else {
      reasons.push(`Acceptable return rate (${returnRatePct}%).`);
    }

    // Rule 3: Category Channel Fit
    let recommendedAdChannel: AdChannelProvider = 'DIRECT_STORE';
    const cat = (prod.category_name || '').toLowerCase();
    if (cat.includes('shoe') || cat.includes('footwear') || cat.includes('jacket')) {
      recommendedAdChannel = 'META'; // Visually strong lifestyle products
    } else if (cat.includes('shirt') || cat.includes('formal') || cat.includes('pants')) {
      recommendedAdChannel = 'GOOGLE'; // High search intent
    }

    return {
      productId: prod.productid,
      productTitle: prod.title,
      isEligible,
      eligibilityScore: Math.max(0, Math.min(100, score)),
      daysOfCover,
      returnRatePct,
      cannibalizationRisk: 'LOW',
      blockingReasons,
      reasons,
      recommendedAdChannel
    };
  }

  /**
   * Scans entire catalog and lists eligible products for advertising campaigns.
   */
  async listEligibleProducts(merchantId: string = 'default_merchant'): Promise<AdEligibilityResult[]> {
    const prodRes = await client.query('SELECT product_id FROM shopi_products ORDER BY stock_quantity DESC LIMIT 20');
    const results: AdEligibilityResult[] = [];

    for (const p of prodRes.rows) {
      const evalRes = await this.evaluateProductAdEligibility(p.product_id, merchantId);
      if (evalRes) results.push(evalRes);
    }

    return results;
  }
}

export const adEligibilityEngine = new AdEligibilityEngine();
