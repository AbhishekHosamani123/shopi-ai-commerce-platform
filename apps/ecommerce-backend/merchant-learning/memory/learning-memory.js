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
exports.learningMemoryEngine = exports.LearningMemoryEngine = void 0;
const merchant_preferences_1 = require("./merchant-preferences");
const decision_history_1 = require("./decision-history");
class LearningMemoryEngine {
    /**
     * Aggregates the full merchant memory state.
     */
    getMemorySnapshot() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const [preferences, recentDecisions] = yield Promise.all([
                merchant_preferences_1.merchantPreferencesEngine.getPreferences(merchantId),
                decision_history_1.decisionHistoryService.getDecisionHistory(merchantId, 20)
            ]);
            const totalDecisions = recentDecisions.length;
            const rejectedDecisions = recentDecisions.filter(d => d.status === 'REJECTED').length;
            const rejectionRatePct = totalDecisions > 0 ? Math.round((rejectedDecisions / totalDecisions) * 100) : 10;
            return {
                preferences,
                recentDecisions,
                rejectionRatePct,
                dominantOptimizationGoal: 'MAXIMIZE_REVENUE',
                preferredRiskTolerance: 'BALANCED',
                safetyOverrideNotice: 'Merchant preference memory is active for recommendation prioritization. Hard safety boundaries (minimum stock, negative margin guards) always remain enforced.'
            };
        });
    }
}
exports.LearningMemoryEngine = LearningMemoryEngine;
exports.learningMemoryEngine = new LearningMemoryEngine();
