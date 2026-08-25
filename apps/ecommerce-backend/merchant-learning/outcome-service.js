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
exports.outcomeService = exports.OutcomeService = void 0;
const outcome_ledger_1 = require("./outcome-ledger");
class OutcomeService {
    recordDecision(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return outcome_ledger_1.outcomeLedger.recordPrediction(input);
        });
    }
    recordOutcome(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return outcome_ledger_1.outcomeLedger.recordActualOutcome(input);
        });
    }
    listOutcomes(merchantId, filter) {
        return __awaiter(this, void 0, void 0, function* () {
            return outcome_ledger_1.outcomeLedger.listOutcomes(merchantId, filter);
        });
    }
    getLearningTimeline() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const outcomes = yield outcome_ledger_1.outcomeLedger.listOutcomes(merchantId, { limit: 20 });
            return outcomes.map(o => {
                const isEvaluated = o.outcomeStatus === 'EVALUATED';
                let lessonLearned = 'Outcome pending empirical realization.';
                if (isEvaluated) {
                    if (o.percentageError && o.percentageError <= 15) {
                        lessonLearned = `Prediction accurate: Realized ${o.actualValue} vs predicted ${o.predictedMid} (${o.percentageError}% variance).`;
                    }
                    else if (o.biasClassification === 'OVER_FORECASTING') {
                        lessonLearned = `Over-forecasting detected (${o.percentageError}% error). Adjusted future safety buffer.`;
                    }
                    else if (o.biasClassification === 'UNDER_FORECASTING') {
                        lessonLearned = `Demand exceeded predicted midpoint by +${o.percentageError}%. Increased forecast elasticity weight.`;
                    }
                }
                return {
                    date: o.decisionTimestamp,
                    decisionId: o.decisionId,
                    actionType: o.actionType,
                    predicted: `${o.predictedMid} (Range: ${o.predictedMin || 'N/A'} - ${o.predictedMax || 'N/A'})`,
                    actual: o.actualValue !== null ? o.actualValue : 'Pending',
                    errorPct: o.percentageError !== null ? `${o.percentageError}%` : 'Pending',
                    status: o.outcomeStatus,
                    lessonLearned
                };
            });
        });
    }
}
exports.OutcomeService = OutcomeService;
exports.outcomeService = new OutcomeService();
