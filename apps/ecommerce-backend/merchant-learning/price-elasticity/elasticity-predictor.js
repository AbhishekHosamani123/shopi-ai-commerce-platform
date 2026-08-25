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
exports.elasticityPredictor = exports.ElasticityPredictor = void 0;
const DB_1 = require("../../data/DB");
const elasticity_engine_1 = require("./elasticity-engine");
class ElasticityPredictor {
    /**
     * Predicts demand lift and revenue impact of a proposed price change using learned Bayesian elasticity.
     */
    predictPriceChangeImpact(productId_1, proposedPrice_1) {
        return __awaiter(this, arguments, void 0, function* (productId, proposedPrice, merchantId = 'default_merchant') {
            var _a;
            const prodRes = yield DB_1.client.query('SELECT productid, title, price, discount FROM products WHERE productid = $1', [productId]);
            if (prodRes.rows.length === 0)
                return null;
            const prod = prodRes.rows[0];
            const currentPrice = parseFloat(prod.discount || prod.price);
            const priceChangePct = Math.round(((proposedPrice - currentPrice) / currentPrice) * 10000) / 100;
            // Get learned elasticity model
            const elasticityModel = yield elasticity_engine_1.bayesianPriceElasticityEngine.getOrLearnProductElasticity(productId, merchantId);
            const learnedElasticity = elasticityModel ? elasticityModel.posteriorElasticity : -1.2;
            // Predicted demand change %
            const predictedDemandChangePct = Math.round(priceChangePct * learnedElasticity * 100) / 100;
            // Calculate baseline weekly sales from last 30 days
            const salesRes = yield DB_1.client.query(`
      SELECT COALESCE(SUM(oi.quantity), 0)::numeric / 4.0 as avg_weekly_units
      FROM orderitems oi
      JOIN orders o ON oi.orderid = o.orderid
      WHERE oi.productid = $1 AND o.createdat >= CURRENT_TIMESTAMP - INTERVAL '30 days';
    `, [productId]);
            const currentWeeklyUnits = Math.max(1, Math.round(parseFloat(((_a = salesRes.rows[0]) === null || _a === void 0 ? void 0 : _a.avg_weekly_units) || '5')));
            const predictedWeeklyUnits = Math.max(0, Math.round(currentWeeklyUnits * (1 + (predictedDemandChangePct / 100))));
            // Expected revenue impact %
            const revenueMultiplier = (1 + (priceChangePct / 100)) * (1 + (predictedDemandChangePct / 100));
            const expectedRevenueChangePct = Math.round((revenueMultiplier - 1) * 10000) / 100;
            let cautionNotice;
            if ((elasticityModel === null || elasticityModel === void 0 ? void 0 : elasticityModel.evidenceType) === 'OBSERVATIONAL_SIGNAL') {
                cautionNotice = 'Elasticity estimate is based on observational sales trends rather than controlled A/B experiments. Treat prediction as directional guidance.';
            }
            return {
                productId,
                productTitle: prod.title,
                currentPrice,
                proposedPrice,
                priceChangePct,
                learnedElasticity,
                predictedDemandChangePct,
                predictedUnitsPerWeek: predictedWeeklyUnits,
                currentUnitsPerWeek: currentWeeklyUnits,
                expectedRevenueChangePct,
                confidence: (elasticityModel === null || elasticityModel === void 0 ? void 0 : elasticityModel.confidence) || 'LOW',
                evidenceType: (elasticityModel === null || elasticityModel === void 0 ? void 0 : elasticityModel.evidenceType) || 'OBSERVATIONAL_SIGNAL',
                cautionNotice
            };
        });
    }
}
exports.ElasticityPredictor = ElasticityPredictor;
exports.elasticityPredictor = new ElasticityPredictor();
