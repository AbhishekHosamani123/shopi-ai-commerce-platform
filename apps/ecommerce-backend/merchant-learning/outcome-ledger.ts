import { client } from '../data/DB';
import { OutcomeRecord, CreateOutcomeInput, RecordActualOutcomeInput } from './outcome-types';
import { predictionEvaluator } from './prediction-evaluator';

export class OutcomeLedger {
  /**
   * Records a predicted business outcome for an AI recommendation.
   */
  async recordPrediction(input: CreateOutcomeInput): Promise<OutcomeRecord> {
    const outcomeId = `out_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const res = await client.query(`
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
  }

  /**
   * Records the realized actual outcome, executes prediction vs reality evaluation, and marks status as EVALUATED.
   */
  async recordActualOutcome(input: RecordActualOutcomeInput): Promise<OutcomeRecord | null> {
    // 1. Fetch pending outcome by outcomeId or decisionId
    let query = 'SELECT * FROM merchant_ai_outcomes WHERE (merchant_id = $1 OR $1 = \'merchant_admin\') ';
    const params: any[] = [input.merchantId];
    if (input.outcomeId) {
      query += 'AND outcome_id = $2';
      params.push(input.outcomeId);
    } else if (input.decisionId) {
      query += 'AND decision_id = $2';
      params.push(input.decisionId);
    } else {
      throw new Error('Either outcomeId or decisionId must be provided.');
    }

    const fetchRes = await client.query(query, params);
    if (fetchRes.rows.length === 0) return null;
    const existing = this.mapRowToRecord(fetchRes.rows[0]);

    // 2. Evaluate prediction vs reality
    const evalResult = predictionEvaluator.evaluatePrediction(
      existing.predictedMid,
      input.actualValue,
      existing.predictedMin,
      existing.predictedMax,
      existing.predictionConfidence,
      existing.outcomeId,
      existing.decisionId
    );

    // 3. Update outcome record in database
    const mergedMetadata = { ...(existing.metadata || {}), ...(input.metadata || {}), evaluationSummary: evalResult.evaluationSummary };

    const updateRes = await client.query(`
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
  }

  /**
   * Retrieves an outcome record by ID with tenant scoping.
   */
  async getOutcomeById(outcomeId: string, merchantId: string = 'default_merchant'): Promise<OutcomeRecord | null> {
    const res = await client.query(
      'SELECT * FROM merchant_ai_outcomes WHERE outcome_id = $1 AND (merchant_id = $2 OR $2 = \'merchant_admin\')',
      [outcomeId, merchantId]
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToRecord(res.rows[0]);
  }

  /**
   * Lists outcome records with optional filtering and tenant scoping.
   */
  async listOutcomes(
    merchantId: string = 'default_merchant',
    filters?: { actionType?: string; outcomeStatus?: string; limit?: number }
  ): Promise<OutcomeRecord[]> {
    let sql = 'SELECT * FROM merchant_ai_outcomes WHERE (merchant_id = $1 OR $1 = \'merchant_admin\')';
    const params: any[] = [merchantId];

    if (filters?.actionType) {
      params.push(filters.actionType);
      sql += ` AND action_type = $${params.length}`;
    }
    if (filters?.outcomeStatus) {
      params.push(filters.outcomeStatus);
      sql += ` AND outcome_status = $${params.length}`;
    }

    sql += ' ORDER BY decision_timestamp DESC';
    if (filters?.limit) {
      params.push(filters.limit);
      sql += ` LIMIT $${params.length}`;
    } else {
      sql += ' LIMIT 100';
    }

    const res = await client.query(sql, params);
    return res.rows.map(r => this.mapRowToRecord(r));
  }

  private mapRowToRecord(row: any): OutcomeRecord {
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

export const outcomeLedger = new OutcomeLedger();
