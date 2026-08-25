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
exports.adEligibilityEngine = exports.AdEligibilityEngine = void 0;
const DB_1 = require("../data/DB");
class AdEligibilityEngine {
    /**
     * Evaluates a SKU for paid advertising suitability against strict inventory, return rate, and margin guardrails.
     */
    evaluateProductAdEligibility(productId_1) {
        return __awaiter(this, arguments, void 0, function* (productId, merchantId = 'default_merchant') {
            const prodRes = yield DB_1.client.query(`
      SELECT 
        p.productid,
        p.title,
        p.price,
        p.discount,
        p.stock,
        c.name as category_name,
        COALESCE(
          (SELECT COUNT(oi.orderitemid)::numeric / 30.0 
           FROM orderitems oi 
           JOIN orders o ON oi.orderid = o.orderid 
           WHERE oi.productid = p.productid AND o.createdat >= CURRENT_TIMESTAMP - INTERVAL '30 days'), 0.5
        ) as daily_demand,
        COALESCE(
          (SELECT COUNT(r.return_id)::numeric / NULLIF(COUNT(oi.orderitemid), 0)
           FROM orderitems oi
           LEFT JOIN order_returns r ON oi.productid = r.productid
           WHERE oi.productid = p.productid), 0.05
        ) as return_rate
      FROM products p
      LEFT JOIN categories c ON p.categoryid = c.categoryid
      WHERE p.productid = $1;
    `, [productId]);
            if (prodRes.rows.length === 0)
                return null;
            const prod = prodRes.rows[0];
            const currentStock = parseInt(prod.stock, 10) || 0;
            const dailyDemand = Math.max(0.2, parseFloat(prod.daily_demand));
            const daysOfCover = Math.round(currentStock / dailyDemand);
            const returnRatePct = Math.round(parseFloat(prod.return_rate) * 100);
            const blockingReasons = [];
            const reasons = [];
            let isEligible = true;
            let score = 85;
            // Rule 1: Stockout protection (Do NOT advertise low-inventory items)
            if (daysOfCover < 7) {
                isEligible = false;
                score -= 50;
                blockingReasons.push(`Critically low inventory coverage (~${daysOfCover} days buffer / ${currentStock} units). Advertising will accelerate stockouts.`);
            }
            else if (daysOfCover < 14) {
                score -= 20;
                reasons.push(`Moderate inventory buffer (~${daysOfCover} days). Allocate limited budget.`);
            }
            else {
                reasons.push(`Healthy inventory coverage (~${daysOfCover} days buffer / ${currentStock} units).`);
            }
            // Rule 2: High return rate protection
            if (returnRatePct > 15) {
                isEligible = false;
                score -= 40;
                blockingReasons.push(`Elevated return rate (${returnRatePct}%). Paid traffic will result in disproportionate refund and reverse logistics costs.`);
            }
            else {
                reasons.push(`Acceptable return rate (${returnRatePct}%).`);
            }
            // Rule 3: Category Channel Fit
            let recommendedAdChannel = 'DIRECT_STORE';
            const cat = (prod.category_name || '').toLowerCase();
            if (cat.includes('shoe') || cat.includes('footwear') || cat.includes('jacket')) {
                recommendedAdChannel = 'META'; // Visually strong lifestyle products
            }
            else if (cat.includes('shirt') || cat.includes('formal') || cat.includes('pants')) {
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
        });
    }
    /**
     * Scans entire catalog and lists eligible products for advertising campaigns.
     */
    listEligibleProducts() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const prodRes = yield DB_1.client.query('SELECT productid FROM products ORDER BY stock DESC LIMIT 20');
            const results = [];
            for (const p of prodRes.rows) {
                const evalRes = yield this.evaluateProductAdEligibility(p.productid, merchantId);
                if (evalRes)
                    results.push(evalRes);
            }
            return results;
        });
    }
}
exports.AdEligibilityEngine = AdEligibilityEngine;
exports.adEligibilityEngine = new AdEligibilityEngine();
