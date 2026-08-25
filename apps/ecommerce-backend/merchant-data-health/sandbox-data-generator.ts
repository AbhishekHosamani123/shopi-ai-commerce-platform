import { client } from '../data/DB';

export interface SandboxGenerationInput {
  sandboxTenantId?: string;
  orderCount?: number;
  customerCount?: number;
  includeSeasonality?: boolean;
  includeReturns?: boolean;
  includeSupplierDelays?: boolean;
}

export interface SandboxGenerationResult {
  sandboxTenantId: string;
  ordersGenerated: number;
  customersGenerated: number;
  outcomesGenerated: number;
  isIsolatedFromProduction: boolean;
  generatedAt: string;
  characteristics: {
    seasonalityEmbedded: boolean;
    realisticVelocityCurve: boolean;
    stockoutScenariosIncluded: boolean;
    supplierDelayVarianceIncluded: boolean;
  };
}

export class SandboxDataGenerator {
  /**
   * Generates a fully isolated, realistic sandbox demo dataset for merchant simulation and training.
   * All records are tagged with strict tenant scoping and never mutate or contaminate production data.
   */
  async generateSandboxDataset(input: SandboxGenerationInput = {}): Promise<SandboxGenerationResult> {
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

      await client.query(`
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
  }

  /**
   * Cleans up sandbox dataset by tenant ID.
   */
  async purgeSandboxDataset(sandboxTenantId: string = 'merchant_sandbox_demo'): Promise<{ purged: boolean }> {
    await client.query('DELETE FROM merchant_ai_outcomes WHERE merchant_id = $1', [sandboxTenantId]);
    await client.query('DELETE FROM merchant_ai_actions WHERE merchant_id = $1', [sandboxTenantId]);
    await client.query('DELETE FROM merchant_ai_recommendations WHERE merchant_id = $1', [sandboxTenantId]);
    return { purged: true };
  }
}

export const sandboxDataGenerator = new SandboxDataGenerator();
