"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markdownTimingEngine = exports.MarkdownTimingEngine = void 0;
const DB_1 = require("../data/DB");
const promotion_conflict_detector_1 = require("../merchant-cannibalization/promotion-conflict-detector");
class MarkdownTimingEngine {
    /**
     * Evaluates inventory age curves and determines exactly WHEN and HOW MUCH to discount each SKU.
     */
    evaluateProductMarkdownTiming(productId_1) {
        return __awaiter(this, arguments, void 0, function* (productId, merchantId = 'default_merchant') {
            const prodRes = yield DB_1.client.query(`
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
            if (prodRes.rows.length === 0)
                return null;
            const prod = prodRes.rows[0];
            const currentStock = parseInt(prod.stock, 10) || 0;
            const ageDays = Math.max(1, prod.age_days);
            const velocity = Math.max(0.05, parseFloat(prod.velocity_30d));
            const projectedStockoutDays = Math.round(currentStock / velocity);
            let urgency = 'NO_DISCOUNT';
            let recommendedDiscountPct = 0;
            let timingRationale = '';
            // Deterministic Inventory Age Curve
            if (ageDays <= 30 && projectedStockoutDays <= 45) {
                urgency = 'NO_DISCOUNT';
                recommendedDiscountPct = 0;
                timingRationale = `New inventory (${ageDays} days in stock) with healthy sell-through. Maintain full margin price.`;
            }
            else if (ageDays <= 60 && projectedStockoutDays <= 90) {
                urgency = 'WATCH';
                recommendedDiscountPct = 0;
                timingRationale = `Mid-cycle inventory (${ageDays} days in stock). Monitor velocity for 14 days before introducing discounts.`;
            }
            else if (ageDays <= 90 || projectedStockoutDays > 90) {
                urgency = 'DISCOUNT_NOW';
                recommendedDiscountPct = 15;
                timingRationale = `Maturing stock (${ageDays} days in inventory, ~${projectedStockoutDays}d projected cover). Apply 15% markdown to accelerate turnover.`;
            }
            else if (ageDays > 90 && currentStock > 20) {
                urgency = 'CLEARANCE';
                recommendedDiscountPct = 30;
                timingRationale = `Aged inventory (${ageDays} days in stock). Move into clearance to liquidate working capital.`;
            }
            else {
                urgency = 'WATCH';
                recommendedDiscountPct = 10;
                timingRationale = `Inventory velocity slowing down. Consider moderate promotional incentive.`;
            }
            // Check substitute cannibalization conflict
            let cannibalizationWarning;
            if (recommendedDiscountPct > 0) {
                const conflict = yield promotion_conflict_detector_1.promotionConflictDetector.checkPromotionConflict(productId, recommendedDiscountPct, merchantId);
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
        });
    }
    /**
     * Scans entire catalog and lists markdown schedule recommendations.
     */
    scanCatalogMarkdownSchedules() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const prodRes = yield DB_1.client.query('SELECT productid FROM products ORDER BY stock DESC LIMIT 20');
            const schedules = [];
            for (const p of prodRes.rows) {
                const sched = yield this.evaluateProductMarkdownTiming(p.productid, merchantId);
                if (sched)
                    schedules.push(sched);
            }
            return schedules;
        });
    }
}
exports.MarkdownTimingEngine = MarkdownTimingEngine;
exports.markdownTimingEngine = new MarkdownTimingEngine();
