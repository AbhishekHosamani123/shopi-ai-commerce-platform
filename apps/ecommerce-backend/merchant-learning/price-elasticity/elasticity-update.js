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
exports.priceElasticityUpdateService = exports.PriceElasticityUpdateService = void 0;
const DB_1 = require("../../data/DB");
const elasticity_engine_1 = require("./elasticity-engine");
class PriceElasticityUpdateService {
    /**
     * Recalibrates Bayesian price elasticity upon completion of a pricing A/B experiment or price adjustment.
     */
    updateProductElasticityFromExperiment(productId_1, experimentId_1) {
        return __awaiter(this, arguments, void 0, function* (productId, experimentId, merchantId = 'default_merchant') {
            const updatedModel = yield elasticity_engine_1.bayesianPriceElasticityEngine.getOrLearnProductElasticity(productId, merchantId);
            if (!updatedModel)
                return null;
            // Record learning event in outcomes
            yield DB_1.client.query(`
      INSERT INTO merchant_ai_outcomes (
        outcome_id, decision_id, merchant_id, action_type, product_id,
        prediction_metric, predicted_mid, actual_value, outcome_status,
        learning_status, metadata, decision_timestamp, outcome_timestamp,
        created_at, updated_at
      ) VALUES ($1, $2, $3, 'PRICE_CHANGE', $4, 'PRICE_ELASTICITY', $5, $6, 'EVALUATED', 'LEARNED', $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `, [
                `out_elast_${Date.now()}`,
                `exp_${experimentId}`,
                merchantId,
                productId,
                updatedModel.priorElasticity,
                updatedModel.posteriorElasticity,
                JSON.stringify({
                    experimentId,
                    credibleInterval: updatedModel.credibleInterval,
                    evidenceType: updatedModel.evidenceType
                })
            ]);
            return updatedModel;
        });
    }
}
exports.PriceElasticityUpdateService = PriceElasticityUpdateService;
exports.priceElasticityUpdateService = new PriceElasticityUpdateService();
