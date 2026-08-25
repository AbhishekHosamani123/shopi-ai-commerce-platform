import { client } from '../../data/DB';

export interface AdaptiveReorderPointResult {
  productId: number;
  productTitle: string;
  nominalSupplierLeadTimeDays: number;
  empiricalSupplierLeadTimeDays: number;
  leadTimeVarianceDays: number;
  dailyDemandMean: number;
  dailyDemandStdDev: number;
  baselineSafetyStock: number;
  adaptiveSafetyStock: number;
  adaptiveReorderPoint: number;
  safetyStockAdjustmentReason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sampleObservations: number;
}

export class AdaptiveReorderEngine {
  /**
   * Learns empirical demand volatility and supplier lead-time variance to compute adaptive safety stock & ROP.
   */
  async computeAdaptiveReorderPoint(
    productId: number,
    merchantId: string = 'default_merchant'
  ): Promise<AdaptiveReorderPointResult | null> {
    const prodRes = await client.query('SELECT productid, title, stock FROM products WHERE productid = $1', [productId]);
    if (prodRes.rows.length === 0) return null;
    const prod = prodRes.rows[0];

    // 1. Fetch empirical supplier lead time from purchase orders
    const poRes = await client.query(`
      SELECT 
        COALESCE(AVG(EXTRACT(EPOCH FROM (received_at - created_at)) / 86400), 8.5)::numeric(8,2) as actual_lead_time,
        COALESCE(STDDEV_POP(EXTRACT(EPOCH FROM (received_at - created_at)) / 86400), 1.8)::numeric(8,2) as lead_time_std,
        COUNT(*)::int as po_count
      FROM merchant_purchase_orders
      WHERE (merchant_id = $1 OR $1 = 'merchant_admin')
        AND status = 'RECEIVED';
    `, [merchantId]);

    const poRow = poRes.rows[0];
    const empiricalLeadTime = parseFloat(poRow?.actual_lead_time || '8.5');
    const leadTimeStd = parseFloat(poRow?.lead_time_std || '1.8');
    const poCount = poRow?.po_count || 3;
    const nominalLeadTime = 7.0;

    // 2. Fetch daily sales mean and standard deviation
    const salesRes = await client.query(`
      WITH daily_sales AS (
        SELECT 
          d.date::date as day,
          COALESCE(SUM(oi.quantity), 0)::numeric as units
        FROM generate_series(CURRENT_TIMESTAMP - INTERVAL '60 days', CURRENT_TIMESTAMP, INTERVAL '1 day') d(date)
        LEFT JOIN orders o ON DATE_TRUNC('day', o.createdat) = d.date::date
        LEFT JOIN orderitems oi ON o.orderid = oi.orderid AND oi.productid = $1
        GROUP BY d.date::date
      )
      SELECT 
        AVG(units)::numeric(8,2) as mean_daily,
        COALESCE(STDDEV_POP(units), 0.8)::numeric(8,2) as std_daily
      FROM daily_sales;
    `, [productId]);

    const dailyMean = Math.max(0.5, parseFloat(salesRes.rows[0]?.mean_daily || '2.0'));
    const dailyStd = Math.max(0.2, parseFloat(salesRes.rows[0]?.std_daily || '0.8'));

    // 3. Compute Adaptive Safety Stock using standard formula:
    // SS = Z * sqrt( (LeadTime * Var_Demand) + (Demand^2 * Var_LeadTime) )
    // Using Z = 1.65 (95% service level)
    const zScore = 1.65;
    const demandVarianceTerm = empiricalLeadTime * Math.pow(dailyStd, 2);
    const leadTimeVarianceTerm = Math.pow(dailyMean, 2) * Math.pow(leadTimeStd, 2);
    const totalVariance = demandVarianceTerm + leadTimeVarianceTerm;
    
    const adaptiveSafetyStock = Math.max(5, Math.ceil(zScore * Math.sqrt(totalVariance)));
    const baselineSafetyStock = Math.ceil(zScore * Math.sqrt(nominalLeadTime * Math.pow(dailyStd, 2)));

    const adaptiveROP = Math.max(adaptiveSafetyStock + 1, Math.ceil((Math.max(1, dailyMean) * empiricalLeadTime) + adaptiveSafetyStock));

    const leadTimeDeltaPct = Math.round(((empiricalLeadTime - nominalLeadTime) / nominalLeadTime) * 100);

    let safetyStockAdjustmentReason = 'Baseline demand variance and lead times aligned.';
    if (leadTimeDeltaPct > 10) {
      safetyStockAdjustmentReason = `Reorder buffer increased because actual supplier lead time (${empiricalLeadTime}d) exceeded nominal lead time (${nominalLeadTime}d) by ${leadTimeDeltaPct}%.`;
    } else if (leadTimeDeltaPct < -10) {
      safetyStockAdjustmentReason = `Reorder buffer optimized because supplier fulfilled faster than expected (${empiricalLeadTime}d vs ${nominalLeadTime}d).`;
    }

    const confidence = poCount >= 5 ? 'HIGH' : poCount >= 2 ? 'MEDIUM' : 'LOW';

    return {
      productId,
      productTitle: prod.title,
      nominalSupplierLeadTimeDays: nominalLeadTime,
      empiricalSupplierLeadTimeDays: empiricalLeadTime,
      leadTimeVarianceDays: leadTimeStd,
      dailyDemandMean: dailyMean,
      dailyDemandStdDev: dailyStd,
      baselineSafetyStock,
      adaptiveSafetyStock,
      adaptiveReorderPoint: adaptiveROP,
      safetyStockAdjustmentReason,
      confidence,
      sampleObservations: poCount
    };
  }
}

export const adaptiveReorderEngine = new AdaptiveReorderEngine();
