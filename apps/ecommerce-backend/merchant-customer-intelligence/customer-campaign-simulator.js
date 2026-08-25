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
exports.customerCampaignSimulator = exports.CustomerCampaignSimulator = void 0;
const clv_engine_1 = require("./clv-engine");
class CustomerCampaignSimulator {
    /**
     * Simulates commercial audience, cost, and revenue envelope for a targeted customer campaign.
     */
    simulateCampaign(req) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const profiles = yield clv_engine_1.clvEngine.listCustomerClvProfiles(100);
            let targetCohort = profiles;
            if (req.targetSegment === 'AT_RISK') {
                targetCohort = profiles.filter(p => p.churnRisk === 'HIGH' || p.churnRisk === 'MEDIUM');
            }
            else if (req.targetSegment === 'VIP') {
                targetCohort = profiles.filter(p => p.historicalSpend >= 10000);
            }
            const audienceSize = targetCohort.length;
            const totalSpend = targetCohort.reduce((sum, p) => sum + p.historicalSpend, 0);
            const avgHistoricalSpend = audienceSize > 0 ? parseFloat((totalSpend / audienceSize).toFixed(2)) : 0;
            if (audienceSize === 0) {
                return {
                    simulatedLabel: 'SIMULATED / ESTIMATED',
                    targetSegment: req.targetSegment,
                    audienceSize: 0,
                    avgHistoricalSpend: 0,
                    estimatedDiscountCost: 0,
                    projectedRevenueRange: { min: 0, mid: 0, max: 0 },
                    assumptions: ['No customers matched selected cohort criteria.'],
                    riskAssessment: 'LOW',
                    confidence: 'LOW'
                };
            }
            // Assumed conversion elasticity benchmark (e.g. 15% - 25% response rate for targeted incentive)
            const discountFactor = req.discountPct / 100;
            const baseAov = avgHistoricalSpend / Math.max(1, (((_a = targetCohort[0]) === null || _a === void 0 ? void 0 : _a.orderCount) || 1));
            const estimatedCost = parseFloat((audienceSize * baseAov * discountFactor * 0.20).toFixed(2));
            const projectedMid = parseFloat((audienceSize * 0.20 * baseAov * (1 - discountFactor)).toFixed(2));
            const projectedMin = parseFloat((projectedMid * 0.70).toFixed(2));
            const projectedMax = parseFloat((projectedMid * 1.35).toFixed(2));
            return {
                simulatedLabel: 'SIMULATED / ESTIMATED',
                targetSegment: req.targetSegment,
                audienceSize,
                avgHistoricalSpend,
                estimatedDiscountCost: estimatedCost,
                projectedRevenueRange: {
                    min: projectedMin,
                    mid: projectedMid,
                    max: projectedMax
                },
                assumptions: [
                    `Assumes 15% - 25% conversion response across ${audienceSize} customer cohort.`,
                    `Average historical order value estimated at ₹${baseAov.toFixed(2)}.`,
                    `Incentive discount applied at ${req.discountPct}%.`
                ],
                riskAssessment: req.discountPct > 20 ? 'HIGH' : 'MEDIUM',
                confidence: audienceSize >= 15 ? 'HIGH' : 'MEDIUM'
            };
        });
    }
}
exports.CustomerCampaignSimulator = CustomerCampaignSimulator;
exports.customerCampaignSimulator = new CustomerCampaignSimulator();
