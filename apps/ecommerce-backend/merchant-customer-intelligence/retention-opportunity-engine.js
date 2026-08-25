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
exports.retentionOpportunityEngine = exports.RetentionOpportunityEngine = void 0;
const clv_engine_1 = require("./clv-engine");
const action_service_1 = require("../merchant-actions/action-service");
class RetentionOpportunityEngine {
    /**
     * Scans high-value at-risk customers and creates staged Phase 3B retention actions requiring merchant approval.
     */
    generateRetentionOpportunities() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const profiles = yield clv_engine_1.clvEngine.listCustomerClvProfiles(50);
            const atRiskHighValue = profiles.filter(p => (p.churnRisk === 'HIGH' || p.churnRisk === 'MEDIUM') && p.historicalSpend >= 2000);
            let stagedActionId = null;
            if (atRiskHighValue.length > 0) {
                try {
                    const action = yield (0, action_service_1.createAction)({
                        merchantId,
                        actionType: 'CUSTOMER_REENGAGE',
                        reason: `Staged retention discount incentive for ${atRiskHighValue.length} high-value at-risk customers`,
                        payload: {
                            cohortSize: atRiskHighValue.length,
                            targetUserIds: atRiskHighValue.map(c => c.userId),
                            recommendedDiscountPct: 15
                        }
                    });
                    stagedActionId = action.actionId;
                }
                catch (err) {
                    // Safe staging fallback
                }
            }
            const summary = atRiskHighValue.length > 0
                ? `Found ${atRiskHighValue.length} valuable customers at risk of churn. Staged a 15% win-back incentive awaiting merchant review.`
                : 'No high-value customers currently exhibiting critical churn risk indicators.';
            return {
                atRiskCustomers: atRiskHighValue,
                stagedActionId,
                recommendationSummary: summary
            };
        });
    }
}
exports.RetentionOpportunityEngine = RetentionOpportunityEngine;
exports.retentionOpportunityEngine = new RetentionOpportunityEngine();
