import { client } from '../../data/DB';
import { ElasticityPredictionResult } from './elasticity-types';
import { bayesianPriceElasticityEngine } from './elasticity-engine';

export class ElasticityPredictor {
  /**
   * Predicts demand lift and revenue impact of a proposed price change using learned Bayesian elasticity.
   */
  async predictPriceChangeImpact(
    productId: number,
    proposedPrice: number,
    merchantId: string = 'default_merchant'
  ): Promise<ElasticityPredictionResult | null> {
    const prodRes = await client.query('SELECT productid, title, price, discount FROM products WHERE productid = $1', [productId]);
    if (prodRes.rows.length === 0) return null;
    const prod = prodRes.rows[0];

    const currentPrice = parseFloat(prod.discount || prod.price);
    const priceChangePct = Math.round(((proposedPrice - currentPrice) / currentPrice) * 10000) / 100;

    // Get learned elasticity model
    const elasticityModel = await bayesianPriceElasticityEngine.getOrLearnProductElasticity(productId, merchantId);
    const learnedElasticity = elasticityModel ? elasticityModel.posteriorElasticity : -1.2;

    // Predicted demand change %
    const predictedDemandChangePct = Math.round(priceChangePct * learnedElasticity * 100) / 100;

    // Calculate baseline weekly sales from last 30 days
    const salesRes = await client.query(`
      SELECT COALESCE(SUM(oi.quantity), 0)::numeric / 4.0 as avg_weekly_units
      FROM orderitems oi
      JOIN orders o ON oi.orderid = o.orderid
      WHERE oi.productid = $1 AND o.createdat >= CURRENT_TIMESTAMP - INTERVAL '30 days';
    `, [productId]);

    const currentWeeklyUnits = Math.max(1, Math.round(parseFloat(salesRes.rows[0]?.avg_weekly_units || '5')));
    const predictedWeeklyUnits = Math.max(0, Math.round(currentWeeklyUnits * (1 + (predictedDemandChangePct / 100))));

    // Expected revenue impact %
    const revenueMultiplier = (1 + (priceChangePct / 100)) * (1 + (predictedDemandChangePct / 100));
    const expectedRevenueChangePct = Math.round((revenueMultiplier - 1) * 10000) / 100;

    let cautionNotice: string | undefined;
    if (elasticityModel?.evidenceType === 'OBSERVATIONAL_SIGNAL') {
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
      confidence: elasticityModel?.confidence || 'LOW',
      evidenceType: elasticityModel?.evidenceType || 'OBSERVATIONAL_SIGNAL',
      cautionNotice
    };
  }
}

export const elasticityPredictor = new ElasticityPredictor();
