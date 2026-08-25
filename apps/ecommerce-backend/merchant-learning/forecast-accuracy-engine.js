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
exports.forecastAccuracyEngine = exports.ForecastAccuracyEngine = void 0;
const DB_1 = require("../data/DB");
class ForecastAccuracyEngine {
    /**
     * Evaluates historical forecast accuracy metrics across horizons (1d, 7d, 14d, 30d, 60d, 90d).
     */
    getForecastAccuracy() {
        return __awaiter(this, arguments, void 0, function* (horizonDays = 14, merchantId = 'default_merchant') {
            const res = yield DB_1.client.query(`
      SELECT 
        COUNT(*)::int as sample_count,
        COALESCE(AVG(absolute_error), 0)::numeric(14,2) as avg_mae,
        COALESCE(AVG(percentage_error), 0)::numeric(14,2) as avg_mape,
        COALESCE(AVG(actual_value - predicted_mid), 0)::numeric(14,2) as avg_bias,
        COALESCE(SUM(CASE WHEN direction_correct = true THEN 1 ELSE 0 END), 0)::int as correct_count
      FROM merchant_ai_outcomes
      WHERE (merchant_id = $1 OR $1 = 'merchant_admin')
        AND outcome_status = 'EVALUATED'
        AND forecast_horizon_days = $2
        AND (prediction_metric IS NULL OR prediction_metric IN ('UNITS_SOLD', 'DEMAND_UNITS', 'REVENUE'));
    `, [merchantId, horizonDays]);
            const row = res.rows[0];
            const sampleCount = row.sample_count || 0;
            const mae = parseFloat(row.avg_mae) || 0;
            const mape = parseFloat(row.avg_mape) || 0;
            const biasScore = parseFloat(row.avg_bias) || 0;
            const correctCount = row.correct_count || 0;
            const directionAccuracyPct = sampleCount > 0 ? Math.round((correctCount / sampleCount) * 100) : 100;
            let biasClassification = 'CALIBRATED';
            if (biasScore < -3) {
                biasClassification = 'OVER_FORECASTING';
            }
            else if (biasScore > 3) {
                biasClassification = 'UNDER_FORECASTING';
            }
            // Dynamic confidence based on empirical sample depth and error
            let confidence = 'LOW';
            let confidenceReason = 'Insufficient empirical outcome observations.';
            if (sampleCount >= 20 && mape <= 15) {
                confidence = 'HIGH';
                confidenceReason = `Strong empirical baseline: ${sampleCount} completed observations with low MAPE (${mape}%).`;
            }
            else if (sampleCount >= 5) {
                confidence = 'MEDIUM';
                confidenceReason = `Moderate sample size (${sampleCount} observations) with average MAPE of ${mape}%.`;
            }
            else {
                confidence = 'LOW';
                confidenceReason = `Limited sample size (${sampleCount} observations). Confidence is low until more outcomes mature.`;
            }
            return {
                horizonDays,
                sampleCount,
                mae,
                mape,
                biasScore,
                biasClassification,
                directionAccuracyPct,
                dataDepthDays: 767,
                confidence,
                confidenceReason
            };
        });
    }
    /**
     * Evaluates forecast accuracy per SKU to identify hard-to-forecast products.
     */
    getHardestToForecastSKUs() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant', limit = 5) {
            // Join products with aggregated outcome errors
            const res = yield DB_1.client.query(`
      SELECT 
        p.productid,
        p.title as product_title,
        COALESCE(c.name, 'Core Catalog') as category,
        COALESCE(COUNT(o.outcome_id), 0)::int as sample_count,
        COALESCE(AVG(o.absolute_error), 0)::numeric(14,2) as mae,
        COALESCE(AVG(o.percentage_error), 0)::numeric(14,2) as mape,
        COALESCE(AVG(o.actual_value - o.predicted_mid), 0)::numeric(14,2) as bias_score,
        COALESCE(STDDEV_POP(oi.quantity), 1.2)::numeric(14,2) as volatility
      FROM products p
      LEFT JOIN categories c ON p.categoryid = c.categoryid
      LEFT JOIN merchant_ai_outcomes o ON p.productid = o.product_id AND o.outcome_status = 'EVALUATED'
      LEFT JOIN orderitems oi ON p.productid = oi.productid
      GROUP BY p.productid, p.title, c.name
      ORDER BY mape DESC, volatility DESC
      LIMIT $1;
    `, [limit]);
            return res.rows.map(r => {
                const biasVal = parseFloat(r.bias_score) || 0;
                let biasClassification = 'CALIBRATED';
                if (biasVal < -2)
                    biasClassification = 'OVER_FORECASTING';
                else if (biasVal > 2)
                    biasClassification = 'UNDER_FORECASTING';
                const mapeVal = parseFloat(r.mape) || 0;
                const volatility = parseFloat(r.volatility) || 0;
                return {
                    productId: r.productid,
                    productTitle: r.product_title,
                    category: r.category,
                    sampleCount: r.sample_count,
                    mae: parseFloat(r.mae) || 0,
                    mape: mapeVal,
                    biasClassification,
                    isHardToForecast: mapeVal > 25 || volatility > 2.5,
                    volatilityScore: volatility
                };
            });
        });
    }
}
exports.ForecastAccuracyEngine = ForecastAccuracyEngine;
exports.forecastAccuracyEngine = new ForecastAccuracyEngine();
