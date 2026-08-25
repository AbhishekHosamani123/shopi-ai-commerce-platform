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
exports.promotionConflictDetector = exports.PromotionConflictDetector = void 0;
const DB_1 = require("../data/DB");
const product_similarity_1 = require("./product-similarity");
class PromotionConflictDetector {
    /**
     * Checks if promoting a SKU conflicts with active promotions on highly substitutable items.
     */
    checkPromotionConflict(targetProductId_1) {
        return __awaiter(this, arguments, void 0, function* (targetProductId, plannedDiscountPct = 10, merchantId = 'default_merchant') {
            const targetRes = yield DB_1.client.query('SELECT productid, title, price, discount FROM products WHERE productid = $1', [targetProductId]);
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
            const similar = yield (0, product_similarity_1.findSimilarProducts)(targetProductId, 5);
            const conflictingProducts = [];
            for (const sim of similar) {
                if (sim.similarityScore >= 0.55) {
                    const otherRes = yield DB_1.client.query('SELECT productid, title, price, discount FROM products WHERE productid = $1', [sim.productIdB]);
                    if (otherRes.rows.length > 0) {
                        const other = otherRes.rows[0];
                        const price = parseFloat(other.price || '0');
                        const discountPrice = other.discount ? parseFloat(other.discount) : null;
                        const isDiscounted = discountPrice !== null && discountPrice < price;
                        const discPct = isDiscounted ? Math.round(((price - discountPrice) / price) * 100) : 0;
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
        });
    }
}
exports.PromotionConflictDetector = PromotionConflictDetector;
exports.promotionConflictDetector = new PromotionConflictDetector();
