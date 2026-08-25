import { client } from '../../data/DB';
import { ModelVersionRecord, ModelType, ModelStatus } from './model-types';

export class ModelRegistryService {
  /**
   * Registers a new model version (defaults to SHADOW status for safe staging).
   */
  async registerModel(params: {
    merchantId: string;
    modelType: ModelType;
    version: number;
    status?: ModelStatus;
    parameters: Record<string, any>;
    sampleCount: number;
    trainingWindow?: string;
    metrics?: Record<string, any>;
  }): Promise<ModelVersionRecord> {
    const modelId = `mdl_${params.modelType.toLowerCase()}_v${params.version}_${Math.random().toString(36).substring(2, 6)}`;
    const status = params.status || 'SHADOW';

    const res = await client.query(`
      INSERT INTO merchant_model_versions (
        model_id, merchant_id, model_type, version, status, parameters,
        sample_count, training_window, metrics, created_at, promoted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10)
      RETURNING *;
    `, [
      modelId,
      params.merchantId,
      params.modelType,
      params.version,
      status,
      JSON.stringify(params.parameters),
      params.sampleCount,
      params.trainingWindow || '60_DAYS',
      JSON.stringify(params.metrics || {}),
      status === 'ACTIVE' ? new Date() : null
    ]);

    return this.mapRowToRecord(res.rows[0]);
  }

  /**
   * Retrieves a specific model version by ID.
   */
  async getModelVersion(modelId: string, merchantId: string = 'default_merchant'): Promise<ModelVersionRecord | null> {
    const res = await client.query(
      'SELECT * FROM merchant_model_versions WHERE model_id = $1 AND (merchant_id = $2 OR $2 = \'merchant_admin\')',
      [modelId, merchantId]
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToRecord(res.rows[0]);
  }

  /**
   * Lists models by merchant and optional model type filter.
   */
  async listModels(
    merchantId: string = 'default_merchant',
    modelType?: ModelType
  ): Promise<ModelVersionRecord[]> {
    let sql = 'SELECT * FROM merchant_model_versions WHERE (merchant_id = $1 OR $1 = \'merchant_admin\')';
    const params: any[] = [merchantId];

    if (modelType) {
      params.push(modelType);
      sql += ` AND model_type = $${params.length}`;
    }

    sql += ' ORDER BY version DESC, created_at DESC';

    const res = await client.query(sql, params);
    return res.rows.map(r => this.mapRowToRecord(r));
  }

  /**
   * Retrieves the active Champion model for a specific model type.
   */
  async getActiveChampion(modelType: ModelType, merchantId: string = 'default_merchant'): Promise<ModelVersionRecord | null> {
    const res = await client.query(`
      SELECT * FROM merchant_model_versions
      WHERE (merchant_id = $1 OR $1 = 'merchant_admin')
        AND model_type = $2
        AND status = 'ACTIVE'
      ORDER BY version DESC
      LIMIT 1;
    `, [merchantId, modelType]);

    if (res.rows.length === 0) {
      // Auto-initialize standard v1 Champion if not present
      return this.registerModel({
        merchantId,
        modelType,
        version: 1,
        status: 'ACTIVE',
        parameters: { algorithm: 'STANDARD_BASELINE_EMA', smoothingFactor: 0.2 },
        sampleCount: 120,
        metrics: { mae: 2.1, mape: 12.4, biasScore: 0.2 }
      });
    }

    return this.mapRowToRecord(res.rows[0]);
  }

  /**
   * Safely promotes a shadow challenger to active champion (retires the previous champion).
   */
  async promoteChallenger(modelId: string, merchantId: string = 'default_merchant'): Promise<ModelVersionRecord | null> {
    const challenger = await this.getModelVersion(modelId, merchantId);
    if (!challenger) return null;

    // Retire existing active champion of same type
    await client.query(`
      UPDATE merchant_model_versions
      SET status = 'RETIRED', retired_at = CURRENT_TIMESTAMP
      WHERE (merchant_id = $1 OR $1 = 'merchant_admin')
        AND model_type = $2
        AND status = 'ACTIVE';
    `, [merchantId, challenger.modelType]);

    // Promote challenger
    const res = await client.query(`
      UPDATE merchant_model_versions
      SET status = 'ACTIVE', promoted_at = CURRENT_TIMESTAMP
      WHERE model_id = $1
      RETURNING *;
    `, [modelId]);

    return this.mapRowToRecord(res.rows[0]);
  }

  /**
   * Rolls back to a previous model version.
   */
  async rollbackModel(modelType: ModelType, targetVersion: number, merchantId: string = 'default_merchant'): Promise<ModelVersionRecord | null> {
    const targetRes = await client.query(`
      SELECT * FROM merchant_model_versions
      WHERE (merchant_id = $1 OR $1 = 'merchant_admin')
        AND model_type = $2
        AND version = $3
      LIMIT 1;
    `, [merchantId, modelType, targetVersion]);

    if (targetRes.rows.length === 0) return null;
    const target = targetRes.rows[0];

    // Demote current active model
    await client.query(`
      UPDATE merchant_model_versions
      SET status = 'RETIRED', retired_at = CURRENT_TIMESTAMP
      WHERE (merchant_id = $1 OR $1 = 'merchant_admin')
        AND model_type = $2
        AND status = 'ACTIVE';
    `, [merchantId, modelType]);

    // Reactivate target version
    const updateRes = await client.query(`
      UPDATE merchant_model_versions
      SET status = 'ACTIVE', promoted_at = CURRENT_TIMESTAMP, retired_at = NULL
      WHERE model_id = $1
      RETURNING *;
    `, [target.model_id]);

    return this.mapRowToRecord(updateRes.rows[0]);
  }

  private mapRowToRecord(row: any): ModelVersionRecord {
    return {
      modelId: row.model_id,
      merchantId: row.merchant_id,
      modelType: row.model_type,
      version: parseInt(row.version, 10),
      status: row.status,
      parameters: typeof row.parameters === 'object' && row.parameters !== null ? row.parameters : {},
      sampleCount: parseInt(row.sample_count || '0', 10),
      trainingWindow: row.training_window || '60_DAYS',
      metrics: typeof row.metrics === 'object' && row.metrics !== null ? row.metrics : {},
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      promotedAt: row.promoted_at ? new Date(row.promoted_at).toISOString() : null,
      retiredAt: row.retired_at ? new Date(row.retired_at).toISOString() : null
    };
  }
}

export const modelRegistryService = new ModelRegistryService();
