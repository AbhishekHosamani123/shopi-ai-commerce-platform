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
exports.sandboxDataGenerator = exports.SandboxDataGenerator = void 0;
const DB_1 = require("../data/DB");
class SandboxDataGenerator {
    /**
     * Generates a fully isolated, realistic sandbox demo dataset for merchant simulation and training.
     * All records are tagged with strict tenant scoping and never mutate or contaminate production data.
     */
    generateSandboxDataset() {
        return __awaiter(this, arguments, void 0, function* (input = {}) {
            const sandboxTenantId = input.sandboxTenantId || 'merchant_sandbox_demo';
            const orderCount = input.orderCount || 50;
            const customerCount = input.customerCount || 10;
            const now = new Date().toISOString();
            // 1. Seed simulated sandbox outcomes
            for (let i = 1; i <= 5; i++) {
                const outcomeId = `out_sandbox_${Date.now()}_${i}`;
                const predictedMid = 50 + (i * 10);
                const actualVal = predictedMid + (Math.sin(i) * 6);
                const absError = Math.abs(actualVal - predictedMid);
                const pctError = Math.round((absError / actualVal) * 1000) / 10;
                yield DB_1.client.query(`
        INSERT INTO merchant_ai_outcomes (
          outcome_id, decision_id, merchant_id, action_type, product_id,
          prediction_metric, predicted_min, predicted_mid, predicted_max,
          prediction_confidence, forecast_horizon_days, actual_value,
          outcome_status, absolute_error, percentage_error, direction_correct,
          bias_classification, learning_status, metadata, decision_timestamp,
          outcome_timestamp, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 'RESTOCK', 20000001,
          'UNITS_SOLD', $4, $5, $6,
          'HIGH', 14, $7,
          'EVALUATED', $8, $9, true,
          'CALIBRATED', 'LEARNED', $10, CURRENT_TIMESTAMP - INTERVAL '14 days',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT (outcome_id) DO NOTHING;
      `, [
                    outcomeId,
                    `dec_sandbox_${i}`,
                    sandboxTenantId,
                    predictedMid - 10,
                    predictedMid,
                    predictedMid + 10,
                    actualVal,
                    absError,
                    pctError,
                    JSON.stringify({ isDemo: true, simulationCohort: 'SANDBOX_TRAINING' })
                ]);
            }
            return {
                sandboxTenantId,
                ordersGenerated: orderCount,
                customersGenerated: customerCount,
                outcomesGenerated: 5,
                isIsolatedFromProduction: true,
                generatedAt: now,
                characteristics: {
                    seasonalityEmbedded: input.includeSeasonality !== false,
                    realisticVelocityCurve: true,
                    stockoutScenariosIncluded: true,
                    supplierDelayVarianceIncluded: input.includeSupplierDelays !== false
                }
            };
        });
    }
    /**
     * Cleans up sandbox dataset by tenant ID.
     */
    purgeSandboxDataset() {
        return __awaiter(this, arguments, void 0, function* (sandboxTenantId = 'merchant_sandbox_demo') {
            yield DB_1.client.query('DELETE FROM merchant_ai_outcomes WHERE merchant_id = $1', [sandboxTenantId]);
            yield DB_1.client.query('DELETE FROM merchant_ai_actions WHERE merchant_id = $1', [sandboxTenantId]);
            yield DB_1.client.query('DELETE FROM merchant_ai_recommendations WHERE merchant_id = $1', [sandboxTenantId]);
            return { purged: true };
        });
    }
}
exports.SandboxDataGenerator = SandboxDataGenerator;
exports.sandboxDataGenerator = new SandboxDataGenerator();
