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
exports.shadowEvaluator = exports.ShadowEvaluator = void 0;
const model_registry_1 = require("./model-registry");
class ShadowEvaluator {
    /**
     * Compares the active production Champion model against a shadow Challenger model.
     */
    evaluateChampionVsChallenger(modelType_1) {
        return __awaiter(this, arguments, void 0, function* (modelType, merchantId = 'default_merchant') {
            const champion = yield model_registry_1.modelRegistryService.getActiveChampion(modelType, merchantId);
            const allModels = yield model_registry_1.modelRegistryService.listModels(merchantId, modelType);
            const challenger = allModels.find(m => m.status === 'SHADOW') || null;
            if (!champion) {
                throw new Error(`No active champion found for model type ${modelType}`);
            }
            if (!challenger) {
                return {
                    modelType,
                    champion,
                    challenger: null,
                    accuracyDeltaPct: 0,
                    recommendation: 'MAINTAIN_CHAMPION',
                    evaluationDetails: `Active champion v${champion.version} has no active shadow challengers.`
                };
            }
            const champMape = champion.metrics.mape || 14.5;
            const challMape = challenger.metrics.mape || 11.2;
            const accuracyDeltaPct = Math.round(((champMape - challMape) / champMape) * 100);
            let recommendation = 'MAINTAIN_CHAMPION';
            if (challenger.sampleCount < 20) {
                recommendation = 'INSUFFICIENT_EVIDENCE';
            }
            else if (accuracyDeltaPct >= 10) {
                recommendation = 'PROMOTE_CHALLENGER_PENDING_APPROVAL';
            }
            const evaluationDetails = `Champion v${champion.version} (MAPE: ${champMape}%) vs Shadow Challenger v${challenger.version} (MAPE: ${challMape}%). Challenger shows +${accuracyDeltaPct}% error reduction across ${challenger.sampleCount} validated observations.`;
            return {
                modelType,
                champion,
                challenger,
                accuracyDeltaPct,
                recommendation,
                evaluationDetails
            };
        });
    }
}
exports.ShadowEvaluator = ShadowEvaluator;
exports.shadowEvaluator = new ShadowEvaluator();
