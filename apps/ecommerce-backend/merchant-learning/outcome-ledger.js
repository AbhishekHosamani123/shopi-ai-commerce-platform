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
exports.outcomeLedger = exports.OutcomeLedger = void 0;
const DB_1 = require("../data/DB");
const prediction_evaluator_1 = require("./prediction-evaluator");
class OutcomeLedger {
    /**
     * Records a predicted business outcome for an AI recommendation.
     */
    recordPrediction(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const outcomeId = `out_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const res = yield DB_1.client.query(`
      INSERT INTO merchant_ai_outcomes (
        outcome_id, decision_id, merchant_id, action_type, product_id,
        prediction_metric, predicted_min, predicted_mid, predicted_max,
        prediction_confidence, forecast_horizon_days, outcome_status,
        learning_status, metadata, decision_timestamp, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING', 'UNLEARNED', $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `, [
                outcomeId,
                input.decisionId,
                input.merchantId,
                input.actionType,
                input.productId || null,
                input.predictionMetric,
                input.predictedMin !== undefined ? input.predictedMin : null,
                input.predictedMid,
                input.predictedMax !== undefined ? input.predictedMax : null,
                input.predictionConfidence || 'MEDIUM',
                input.forecastHorizonDays || 14,
                JSON.stringify(input.metadata || {})
            ]);
            return this.mapRowToRecord(res.rows[0]);
        });
    }
    /**
     * Records the realized actual outcome, executes prediction vs reality evaluation, and marks status as EVALUATED.
     */
    recordActualOutcome(input) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Fetch pending outcome by outcomeId or decisionId
            let query = 'SELECT * FROM merchant_ai_outcomes WHERE (merchant_id = $1 OR $1 = \'merchant_admin\') ';
            const params = [input.merchantId];
            if (input.outcomeId) {
                query += 'AND outcome_id = $2';
                params.push(input.outcomeId);
            }
            else if (input.decisionId) {
                query += 'AND decision_id = $2';
                params.push(input.decisionId);
            }
            else {
                throw new Error('Either outcomeId or decisionId must be provided.');
            }
            const fetchRes = yield DB_1.client.query(query, params);
            if (fetchRes.rows.length === 0)
                return null;
            const existing = this.mapRowToRecord(fetchRes.rows[0]);
            // 2. Evaluate prediction vs reality
            const evalResult = prediction_evaluator_1.predictionEvaluator.evaluatePrediction(existing.predictedMid, input.actualValue, existing.predictedMin, existing.predictedMax, existing.predictionConfidence, existing.outcomeId, existing.decisionId);
            // 3. Update outcome record in database
            const mergedMetadata = Object.assign(Object.assign(Object.assign({}, (existing.metadata || {})), (input.metadata || {})), { evaluationSummary: evalResult.evaluationSummary });
            const updateRes = yield DB_1.client.query(`
      UPDATE merchant_ai_outcomes SET
        actual_value = $1,
        outcome_timestamp = $2,
        outcome_status = 'EVALUATED',
        absolute_error = $3,
        percentage_error = $4,
        direction_correct = $5,
        bias_classification = $6,
        learning_status = 'UNLEARNED',
        metadata = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE outcome_id = $8 AND (merchant_id = $9 OR $9 = 'merchant_admin')
      RETURNING *;
    `, [
                input.actualValue,
                input.outcomeTimestamp ? new Date(input.outcomeTimestamp) : new Date(),
                evalResult.absoluteError,
                evalResult.percentageError,
                evalResult.directionCorrect,
                evalResult.biasClassification,
                JSON.stringify(mergedMetadata),
                existing.outcomeId,
                input.merchantId
            ]);
            return this.mapRowToRecord(updateRes.rows[0]);
        });
    }
    /**
     * Retrieves an outcome record by ID with tenant scoping.
     */
    getOutcomeById(outcomeId_1) {
        return __awaiter(this, arguments, void 0, function* (outcomeId, merchantId = 'default_merchant') {
            const res = yield DB_1.client.query('SELECT * FROM merchant_ai_outcomes WHERE outcome_id = $1 AND (merchant_id = $2 OR $2 = \'merchant_admin\')', [outcomeId, merchantId]);
            if (res.rows.length === 0)
                return null;
            return this.mapRowToRecord(res.rows[0]);
        });
    }
    /**
     * Lists outcome records with optional filtering and tenant scoping.
     */
    listOutcomes() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant', filters) {
            let sql = 'SELECT * FROM merchant_ai_outcomes WHERE (merchant_id = $1 OR $1 = \'merchant_admin\')';
            const params = [merchantId];
            if (filters === null || filters === void 0 ? void 0 : filters.actionType) {
                params.push(filters.actionType);
                sql += ` AND action_type = $${params.length}`;
            }
            if (filters === null || filters === void 0 ? void 0 : filters.outcomeStatus) {
                params.push(filters.outcomeStatus);
                sql += ` AND outcome_status = $${params.length}`;
            }
            sql += ' ORDER BY decision_timestamp DESC';
            if (filters === null || filters === void 0 ? void 0 : filters.limit) {
                params.push(filters.limit);
                sql += ` LIMIT $${params.length}`;
            }
            else {
                sql += ' LIMIT 100';
            }
            const res = yield DB_1.client.query(sql, params);
            return res.rows.map(r => this.mapRowToRecord(r));
        });
    }
    mapRowToRecord(row) {
        return {
            outcomeId: row.outcome_id,
            decisionId: row.decision_id || row.action_id || row.outcome_id,
            merchantId: row.merchant_id,
            actionType: row.action_type,
            productId: row.product_id ? parseInt(row.product_id, 10) : null,
            decisionTimestamp: row.decision_timestamp ? new Date(row.decision_timestamp).toISOString() : new Date().toISOString(),
            predictionMetric: row.prediction_metric || 'VELOCITY',
            predictedMin: row.predicted_min !== null ? parseFloat(row.predicted_min) : null,
            predictedMid: parseFloat(row.predicted_mid || '0'),
            predictedMax: row.predicted_max !== null ? parseFloat(row.predicted_max) : null,
            predictionConfidence: row.prediction_confidence || 'MEDIUM',
            forecastHorizonDays: parseInt(row.forecast_horizon_days || '14', 10),
            actualValue: row.actual_value !== null ? parseFloat(row.actual_value) : null,
            outcomeTimestamp: row.outcome_timestamp ? new Date(row.outcome_timestamp).toISOString() : null,
            outcomeStatus: row.outcome_status || 'PENDING',
            absoluteError: row.absolute_error !== null ? parseFloat(row.absolute_error) : null,
            percentageError: row.percentage_error !== null ? parseFloat(row.percentage_error) : null,
            directionCorrect: row.direction_correct !== null ? Boolean(row.direction_correct) : null,
            biasClassification: row.bias_classification || null,
            learningStatus: row.learning_status || 'UNLEARNED',
            metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {},
            createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
        };
    }
}
exports.OutcomeLedger = OutcomeLedger;
exports.outcomeLedger = new OutcomeLedger();
