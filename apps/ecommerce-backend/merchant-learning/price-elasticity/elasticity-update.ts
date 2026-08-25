import { client } from '../../data/DB';
import { bayesianPriceElasticityEngine } from './elasticity-engine';
import { BayesianPriceElasticityModel } from './elasticity-types';

export class PriceElasticityUpdateService {
  /**
   * Recalibrates Bayesian price elasticity upon completion of a pricing A/B experiment or price adjustment.
   */
  async updateProductElasticityFromExperiment(
    productId: number,
    experimentId: string,
    merchantId: string = 'default_merchant'
  ): Promise<BayesianPriceElasticityModel | null> {
    const updatedModel = await bayesianPriceElasticityEngine.getOrLearnProductElasticity(productId, merchantId);
    if (!updatedModel) return null;

    // Record learning event in outcomes
    await client.query(`
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
  }
}

export const priceElasticityUpdateService = new PriceElasticityUpdateService();
