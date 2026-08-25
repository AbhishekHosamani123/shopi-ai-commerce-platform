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
exports.adBudgetEngine = exports.AdBudgetEngine = void 0;
const ad_eligibility_engine_1 = require("./ad-eligibility-engine");
class AdBudgetEngine {
    /**
     * Distributes an advertising budget across eligible catalog SKUs based on inventory health and demand opportunity.
     */
    allocateAdBudget() {
        return __awaiter(this, arguments, void 0, function* (totalBudget = 25000, merchantId = 'default_merchant') {
            const budget = Math.max(5000, totalBudget);
            const eligibleList = yield ad_eligibility_engine_1.adEligibilityEngine.listEligibleProducts(merchantId);
            const eligibleOnly = eligibleList.filter(p => p.isEligible);
            // Sort by eligibility score descending
            eligibleOnly.sort((a, b) => b.eligibilityScore - a.eligibilityScore);
            const topTargets = eligibleOnly.slice(0, 3);
            const productAllocations = [];
            let allocatedSpend = 0;
            const weights = [0.45, 0.30, 0.15]; // Allocate up to 90% of budget, keeping 10% reserve
            topTargets.forEach((target, index) => {
                const weight = weights[index] || 0.10;
                const amount = Math.round(budget * weight);
                allocatedSpend += amount;
                productAllocations.push({
                    productId: target.productId,
                    productTitle: target.productTitle,
                    channel: target.recommendedAdChannel,
                    allocatedBudget: amount,
                    allocationPercentage: Math.round(weight * 100),
                    opportunityScore: target.eligibilityScore,
                    expectedImpressionBand: `~${Math.round(amount * 18).toLocaleString('en-IN')} - ${Math.round(amount * 26).toLocaleString('en-IN')} impressions`,
                    expectedDemandLiftPct: Math.round(15 + (weight * 30)),
                    rationale: `Strong inventory buffer (${target.daysOfCover}d) and low return rate (${target.returnRatePct}%). Suitable for ${target.recommendedAdChannel} campaigns.`
                });
            });
            const unallocatedReserve = budget - allocatedSpend;
            return {
                totalBudget: budget,
                allocatedSpend,
                unallocatedReserve,
                providerStatus: {
                    DIRECT_STORE: 'ACTIVE',
                    GOOGLE: 'NOT_CONFIGURED',
                    META: 'NOT_CONFIGURED',
                    AMAZON: 'NOT_CONFIGURED',
                    OTHER: 'NOT_CONFIGURED'
                },
                productAllocations,
                dataHealthNotice: 'Historical advertising performance (ROAS/CPA) is unavailable. Budget allocation is opportunity-based on inventory health and demand velocity rather than fabricated ROAS.',
                createdAt: new Date().toISOString()
            };
        });
    }
}
exports.AdBudgetEngine = AdBudgetEngine;
exports.adBudgetEngine = new AdBudgetEngine();
