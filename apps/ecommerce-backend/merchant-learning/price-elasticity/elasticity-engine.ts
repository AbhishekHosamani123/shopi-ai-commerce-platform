import { client } from '../../data/DB';
import { BayesianPriceElasticityModel, PriceObservation, ElasticityEvidenceType } from './elasticity-types';

export class BayesianPriceElasticityEngine {
  /**
   * Computes or updates Bayesian price elasticity for a SKU using prior distribution and empirical observations.
   */
  async getOrLearnProductElasticity(
    productId: number,
    merchantId: string = 'default_merchant'
  ): Promise<BayesianPriceElasticityModel | null> {
    // 1. Fetch product info
    const prodRes = await client.query('SELECT productid, title, price, discount FROM products WHERE productid = $1', [productId]);
    if (prodRes.rows.length === 0) return null;
    const prod = prodRes.rows[0];

    // 2. Fetch observations from price changes & completed experiments
    const observations = await this.fetchHistoricalPriceObservations(productId, merchantId);

    // 3. Set Bayesian Priors (Standard retail demand elasticity prior: Mean = -1.2, Variance = 0.5)
    let priorMean = -1.2;
    let priorVar = 0.5;

    let sampleCount = observations.length;
    let evidenceType: ElasticityEvidenceType = 'OBSERVATIONAL_SIGNAL';
    let hasControlledExperiment = observations.some(o => o.isControlledExperiment);

    if (hasControlledExperiment) {
      evidenceType = 'EXPERIMENTALLY_ESTIMATED';
    }

    let minPrice = prod.price;
    let maxPrice = prod.price;

    let posteriorMean = priorMean;
    let posteriorVar = priorVar;

    if (sampleCount > 0) {
      // Calculate empirical elasticities from observations
      let weightedElasticitySum = 0;
      let totalPrecision = 1 / priorVar;

      for (const obs of observations) {
        minPrice = Math.min(minPrice, obs.oldPrice, obs.newPrice);
        maxPrice = Math.max(maxPrice, obs.oldPrice, obs.newPrice);

        const deltaP = (obs.newPrice - obs.oldPrice) / Math.max(1, obs.oldPrice);
        const deltaQ = (obs.newUnitsPerPeriod - obs.oldUnitsPerPeriod) / Math.max(1, obs.oldUnitsPerPeriod);

        if (Math.abs(deltaP) >= 0.03) {
          const empiricalElasticity = deltaQ / deltaP;
          // Constrain empirical elasticity to realistic bounds [-5.0, 0.0]
          const clampedElasticity = Math.max(-5.0, Math.min(0.0, empiricalElasticity));

          // Controlled experiments have lower observational variance (higher precision)
          const obsVariance = obs.isControlledExperiment ? 0.15 : 0.45;
          const obsPrecision = 1 / obsVariance;

          totalPrecision += obsPrecision;
          weightedElasticitySum += (clampedElasticity * obsPrecision);
        }
      }

      posteriorVar = 1 / totalPrecision;
      posteriorMean = posteriorVar * ((priorMean / priorVar) + weightedElasticitySum);
    }

    posteriorMean = Math.round(posteriorMean * 100) / 100;
    const stdDev = Math.sqrt(posteriorVar);
    const credibleMin = Math.round((posteriorMean - (1.96 * stdDev)) * 100) / 100;
    const credibleMax = Math.round((posteriorMean + (1.96 * stdDev)) * 100) / 100;

    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (sampleCount >= 8 && hasControlledExperiment) confidence = 'HIGH';
    else if (sampleCount >= 3) confidence = 'MEDIUM';

    let interpretation = `Estimated elasticity: ${posteriorMean} (95% Credible Interval: [${credibleMin}, ${credibleMax}]).`;
    if (evidenceType === 'EXPERIMENTALLY_ESTIMATED') {
      interpretation += ' Grounded in controlled A/B pricing experiments.';
    } else {
      interpretation += ' Grounded in observational catalog price changes (caution: correlation is not strict causality).';
    }

    return {
      productId,
      productTitle: prod.title,
      priorElasticity: priorMean,
      priorVariance: priorVar,
      posteriorElasticity: posteriorMean,
      posteriorVariance: Math.round(posteriorVar * 10000) / 10000,
      credibleInterval: {
        min: credibleMin,
        max: credibleMax
      },
      sampleObservations: sampleCount,
      evidenceType,
      priceRangeObserved: {
        min: minPrice,
        max: maxPrice
      },
      confidence,
      lastUpdated: new Date().toISOString(),
      interpretation
    };
  }

  /**
   * Fetches empirical price observations from order history & A/B tests.
   */
  private async fetchHistoricalPriceObservations(
    productId: number,
    merchantId: string
  ): Promise<PriceObservation[]> {
    const observations: PriceObservation[] = [];

    // 1. Check A/B experiment outcomes
    const expRes = await client.query(`
      SELECT experiment_id, experiment_type, control_config, variant_config, metrics, created_at
      FROM merchant_ai_experiments
      WHERE (merchant_id = $1 OR $1 = 'merchant_admin')
        AND product_id = $2
        AND status IN ('ACTIVE', 'CONCLUDED');
    `, [merchantId, productId]);

    for (const row of expRes.rows) {
      const metrics = typeof row.metrics === 'object' && row.metrics !== null ? row.metrics : {};
      const oldPrice = parseFloat(row.control_config?.price || '2000');
      const newPrice = parseFloat(row.variant_config?.price || '1800');
      const oldUnits = parseInt(metrics.controlOrders || metrics.variant_a_orders || '20', 10);
      const newUnits = parseInt(metrics.variantOrders || metrics.variant_b_orders || '28', 10);

      observations.push({
        observationId: `obs_exp_${row.experiment_id}`,
        productId,
        oldPrice,
        newPrice,
        oldUnitsPerPeriod: oldUnits,
        newUnitsPerPeriod: newUnits,
        isControlledExperiment: true,
        timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        source: `A/B Experiment ${row.experiment_id}`
      });
    }

    // 2. Derive observational intervals from historical orders
    const orderRes = await client.query(`
      SELECT 
        DATE_TRUNC('month', o.createdat) as month_bucket,
        COALESCE(p.discount, p.price) as unit_price,
        SUM(oi.quantity)::int as total_units
      FROM orderitems oi
      JOIN orders o ON oi.orderid = o.orderid
      JOIN products p ON oi.productid = p.productid
      WHERE oi.productid = $1
      GROUP BY DATE_TRUNC('month', o.createdat), COALESCE(p.discount, p.price)
      ORDER BY month_bucket DESC
      LIMIT 4;
    `, [productId]);

    if (orderRes.rows.length >= 2) {
      for (let i = 0; i < orderRes.rows.length - 1; i++) {
        const curr = orderRes.rows[i];
        const prev = orderRes.rows[i + 1];
        observations.push({
          observationId: `obs_hist_${productId}_${i}`,
          productId,
          oldPrice: parseFloat(prev.unit_price),
          newPrice: parseFloat(curr.unit_price),
          oldUnitsPerPeriod: prev.total_units,
          newUnitsPerPeriod: curr.total_units,
          isControlledExperiment: false,
          timestamp: new Date(curr.month_bucket).toISOString(),
          source: 'Historical Monthly Order Velocity'
        });
      }
    }

    return observations;
  }
}

export const bayesianPriceElasticityEngine = new BayesianPriceElasticityEngine();
