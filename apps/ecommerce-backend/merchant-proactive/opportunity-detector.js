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
exports.detectGrowthOpportunities = detectGrowthOpportunities;
exports.detectCategorySurges = detectCategorySurges;
exports.detectCustomerRetentionMilestones = detectCustomerRetentionMilestones;
const merchant_intelligence_1 = require("../merchant-intelligence");
/**
 * Detects catalog revenue expansion opportunities and promotional candidates.
 */
function detectGrowthOpportunities() {
    return __awaiter(this, void 0, void 0, function* () {
        const events = [];
        const topProducts = yield (0, merchant_intelligence_1.getTopProducts)(3, 'last_30_days');
        if (topProducts.length > 0) {
            const champion = topProducts[0];
            if (champion.currentStock >= 50 && champion.salesVelocity7d >= 1.0) {
                events.push({
                    alertType: 'PRODUCT_GROWTH_CHAMPION',
                    severity: 'OPPORTUNITY',
                    title: `Promotional Champion: ${champion.title}`,
                    summary: `"${champion.title}" is driving ₹${champion.revenue.toLocaleString('en-IN')} with strong velocity (${champion.salesVelocity7d} units/day) and healthy stock (${champion.currentStock} units).`,
                    evidence: {
                        productId: champion.productId,
                        revenue: champion.revenue,
                        unitsSold: champion.unitsSold,
                        currentStock: champion.currentStock,
                        salesVelocity7d: champion.salesVelocity7d
                    },
                    relatedProductId: champion.productId,
                    relatedCategory: champion.categoryName,
                    recommendedAction: 'Feature in storefront hero banner and email campaign.'
                });
            }
        }
        return events;
    });
}
/**
 * Detects category market share expansions.
 */
function detectCategorySurges() {
    return __awaiter(this, void 0, void 0, function* () {
        const events = [];
        const categories = yield (0, merchant_intelligence_1.getCategoryPerformance)('last_30_days');
        if (categories.length > 0) {
            const topCat = categories[0];
            if (topCat.revenueSharePct >= 20.0) {
                events.push({
                    alertType: 'CATEGORY_MARKET_LEADER',
                    severity: 'OPPORTUNITY',
                    title: `Category Expansion: ${topCat.categoryName}`,
                    summary: `"${topCat.categoryName}" contributes ${topCat.revenueSharePct}% of store revenue (₹${topCat.grossRevenue.toLocaleString('en-IN')}, ${topCat.unitsSold} units).`,
                    evidence: {
                        categoryName: topCat.categoryName,
                        grossRevenue: topCat.grossRevenue,
                        revenueSharePct: topCat.revenueSharePct,
                        unitsSold: topCat.unitsSold
                    },
                    relatedCategory: topCat.categoryName,
                    recommendedAction: 'Expand color and size variant lines in this category.'
                });
            }
        }
        return events;
    });
}
/**
 * Detects positive customer retention trends.
 */
function detectCustomerRetentionMilestones() {
    return __awaiter(this, void 0, void 0, function* () {
        const events = [];
        const repeatData = yield (0, merchant_intelligence_1.getRepeatCustomers)();
        if (repeatData.repeatRatePct >= 20.0) {
            events.push({
                alertType: 'STRONG_CUSTOMER_RETENTION',
                severity: 'INFO',
                title: `Healthy Repeat Customer Rate (${repeatData.repeatRatePct}%)`,
                summary: `${repeatData.totalRepeatBuyers} buyers have placed multiple orders, demonstrating strong brand loyalty and recurring revenue stability.`,
                evidence: {
                    repeatRatePct: repeatData.repeatRatePct,
                    repeatBuyersCount: repeatData.totalRepeatBuyers,
                    singleOrderBuyersCount: repeatData.totalOneTimeBuyers
                },
                recommendedAction: 'Launch VIP loyalty perks for top tier customers.'
            });
        }
        return events;
    });
}
