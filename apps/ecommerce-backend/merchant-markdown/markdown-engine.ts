import { client } from '../data/DB';
import { promotionConflictDetector } from '../merchant-cannibalization/promotion-conflict-detector';
import { MarkdownTimingSchedule, MarkdownUrgency } from './markdown-types';

export class MarkdownTimingEngine {
  /**
   * Evaluates inventory age curves and determines exactly WHEN and HOW MUCH to discount each SKU.
   */
  async evaluateProductMarkdownTiming(productId: number, merchantId: string = 'default_merchant'): Promise<MarkdownTimingSchedule | null> {
    const prodRes = await client.query(`
      SELECT 
        p.productid,
        p.title,
        p.price,
        p.discount,
        p.stock,
        COALESCE(EXTRACT(DAY FROM (CURRENT_TIMESTAMP - p.createdat)), 45)::int as age_days,
        COALESCE(
          (SELECT COUNT(oi.orderitemid)::numeric / 30.0 
           FROM orderitems oi 
           JOIN orders o ON oi.orderid = o.orderid 
           WHERE oi.productid = p.productid AND o.createdat >= CURRENT_TIMESTAMP - INTERVAL '30 days'), 0.2
        ) as velocity_30d
      FROM products p
      WHERE p.productid = $1;
    `, [productId]);

    if (prodRes.rows.length === 0) return null;
    const prod = prodRes.rows[0];

    const currentStock = parseInt(prod.stock, 10) || 0;
    const ageDays = Math.max(1, prod.age_days);
    const velocity = Math.max(0.05, parseFloat(prod.velocity_30d));
    const projectedStockoutDays = Math.round(currentStock / velocity);

    let urgency: MarkdownUrgency = 'NO_DISCOUNT';
    let recommendedDiscountPct = 0;
    let timingRationale = '';

    // Deterministic Inventory Age Curve
    if (ageDays <= 30 && projectedStockoutDays <= 45) {
      urgency = 'NO_DISCOUNT';
      recommendedDiscountPct = 0;
      timingRationale = `New inventory (${ageDays} days in stock) with healthy sell-through. Maintain full margin price.`;
    } else if (ageDays <= 60 && projectedStockoutDays <= 90) {
      urgency = 'WATCH';
      recommendedDiscountPct = 0;
      timingRationale = `Mid-cycle inventory (${ageDays} days in stock). Monitor velocity for 14 days before introducing discounts.`;
    } else if (ageDays <= 90 || projectedStockoutDays > 90) {
      urgency = 'DISCOUNT_NOW';
      recommendedDiscountPct = 15;
      timingRationale = `Maturing stock (${ageDays} days in inventory, ~${projectedStockoutDays}d projected cover). Apply 15% markdown to accelerate turnover.`;
    } else if (ageDays > 90 && currentStock > 20) {
      urgency = 'CLEARANCE';
      recommendedDiscountPct = 30;
      timingRationale = `Aged inventory (${ageDays} days in stock). Move into clearance to liquidate working capital.`;
    } else {
      urgency = 'WATCH';
      recommendedDiscountPct = 10;
      timingRationale = `Inventory velocity slowing down. Consider moderate promotional incentive.`;
    }

    // Check substitute cannibalization conflict
    let cannibalizationWarning: string | undefined;
    if (recommendedDiscountPct > 0) {
      const conflict = await promotionConflictDetector.checkPromotionConflict(productId, recommendedDiscountPct, merchantId);
      if (conflict.hasConflict) {
        cannibalizationWarning = conflict.warningMessage;
      }
    }

    const today = new Date();
    const effectiveDate = today.toISOString().split('T')[0];
    const endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return {
      productId: prod.productid,
      productTitle: prod.title,
      currentStock,
      inventoryAgeDays: ageDays,
      salesVelocity30d: parseFloat(velocity.toFixed(2)),
      projectedStockoutDays,
      urgency,
      recommendedDiscountPct,
      recommendedEffectiveDate: effectiveDate,
      recommendedEndDate: endDate,
      timingRationale,
      cannibalizationWarning
    };
  }

  /**
   * Scans entire catalog and lists markdown schedule recommendations.
   */
  async scanCatalogMarkdownSchedules(merchantId: string = 'default_merchant'): Promise<MarkdownTimingSchedule[]> {
    const prodRes = await client.query('SELECT productid FROM products ORDER BY stock DESC LIMIT 20');
    const schedules: MarkdownTimingSchedule[] = [];

    for (const p of prodRes.rows) {
      const sched = await this.evaluateProductMarkdownTiming(p.productid, merchantId);
      if (sched) schedules.push(sched);
    }

    return schedules;
  }
}

export const markdownTimingEngine = new MarkdownTimingEngine();
