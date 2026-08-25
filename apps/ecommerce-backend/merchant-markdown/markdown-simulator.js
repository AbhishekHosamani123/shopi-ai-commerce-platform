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
exports.markdownSimulator = exports.MarkdownSimulator = void 0;
const DB_1 = require("../data/DB");
const promotion_conflict_detector_1 = require("../merchant-cannibalization/promotion-conflict-detector");
class MarkdownSimulator {
    /**
     * Simulates demand lift, inventory depletion, and cross-SKU substitution consequences of markdown discounts.
     */
    simulateMarkdown(input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const prodRes = yield DB_1.client.query('SELECT productid, title, price, discount, stock FROM products WHERE productid = $1', [input.productId]);
            if (prodRes.rows.length === 0)
                return null;
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
            const conflict = yield promotion_conflict_detector_1.promotionConflictDetector.checkPromotionConflict(input.productId, discountPct, input.merchantId);
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
                    substituteProductId: (_a = conflict.conflictingProducts[0]) === null || _a === void 0 ? void 0 : _a.productId,
                    substituteProductTitle: (_b = conflict.conflictingProducts[0]) === null || _b === void 0 ? void 0 : _b.title,
                    estimatedDivertedUnits,
                    netCategoryRevenueImpact: hasSubstituteConflict
                        ? `~${estimatedDivertedUnits} units projected to be diverted from substitute product variant (${(_c = conflict.conflictingProducts[0]) === null || _c === void 0 ? void 0 : _c.title}).`
                        : 'Zero cross-SKU demand diversion detected.'
                },
                confidence: 'HIGH',
                assumptions: [
                    `Price elasticity of demand modeled at -1.6 for category apparel.`,
                    `Assumes promotion duration of ${input.durationDays || 14} days.`,
                    'Cannibalization assessed via catalog token and attribute cosine similarity.'
                ]
            };
        });
    }
}
exports.MarkdownSimulator = MarkdownSimulator;
exports.markdownSimulator = new MarkdownSimulator();
