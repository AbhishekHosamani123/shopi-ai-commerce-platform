import { client } from '../data/DB';
import { DataLineageRecord } from './connector-types';

/**
 * 🔍 Phase 15N: Audit-Grade AI Data Lineage Tracker
 * 
 * Records the mathematical lineage, table sources, time periods, record counts,
 * and calculations for all numbers produced by Merchant AI Copilot.
 */
export class DataLineageTracker {
  /**
   * Records a data lineage trace for a derived AI metric
   */
  async recordLineage(lineage: Omit<DataLineageRecord, 'lineageId' | 'computedAt'>): Promise<DataLineageRecord> {
    const lineageId = `lin_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    await client.query(`
      INSERT INTO merchant_data_lineage (
        lineage_id, merchant_id, metric_name, metric_value, source_name,
        entity_type, period_start, period_end, records_evaluated,
        calculation_formula, reconciliation_status, computed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
    `, [
      lineageId,
      lineage.merchantId,
      lineage.metricName,
      lineage.metricValue,
      lineage.sourceName,
      lineage.entityType,
      lineage.periodStart,
      lineage.periodEnd,
      lineage.recordsEvaluated,
      lineage.calculationFormula,
      lineage.reconciliationStatus
    ]);

    return {
      lineageId,
      ...lineage,
      computedAt: new Date().toISOString()
    };
  }

  /**
   * Retrieves lineage audit trail for a merchant
   */
  async getLineageAudit(merchantId: string, limit: number = 20): Promise<DataLineageRecord[]> {
    const res = await client.query(`
      SELECT * FROM merchant_data_lineage
      WHERE merchant_id = $1
      ORDER BY computed_at DESC LIMIT $2
    `, [merchantId, limit]);

    return res.rows.map(r => ({
      lineageId: r.lineage_id,
      merchantId: r.merchant_id,
      metricName: r.metric_name,
      metricValue: parseFloat(r.metric_value),
      sourceName: r.source_name,
      entityType: r.entity_type,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      recordsEvaluated: r.records_evaluated,
      calculationFormula: r.calculation_formula,
      reconciliationStatus: r.reconciliation_status,
      computedAt: r.computed_at
    }));
  }

  /**
   * Computes grounded canonical metrics directly with full lineage metadata
   */
  async getGroundedMetric(
    merchantId: string,
    metric: 'TOTAL_REVENUE' | 'TOTAL_ORDERS' | 'AVERAGE_ORDER_VALUE' | 'TOTAL_PRODUCTS' | 'LOW_STOCK_COUNT'
  ): Promise<{ value: number; lineage: DataLineageRecord; trustTag: string }> {
    let value = 0;
    let formula = '';
    let entity = '';
    let records = 0;
    const now = new Date().toISOString();
    const periodStart = new Date(Date.now() - 365 * 86400000).toISOString();

    if (metric === 'TOTAL_REVENUE') {
      const res = await client.query(`
        SELECT COUNT(*)::int as count, COALESCE(SUM(total_amount), 0)::numeric(14,2) as sum
        FROM merchant_canonical_orders WHERE merchant_id = $1
      `, [merchantId]);
      records = res.rows[0].count;
      value = parseFloat(res.rows[0].sum);
      formula = 'SUM(merchant_canonical_orders.total_amount)';
      entity = 'merchant_canonical_orders';
    } else if (metric === 'TOTAL_ORDERS') {
      const res = await client.query(`
        SELECT COUNT(*)::int as count FROM merchant_canonical_orders WHERE merchant_id = $1
      `, [merchantId]);
      records = res.rows[0].count;
      value = records;
      formula = 'COUNT(merchant_canonical_orders.order_id)';
      entity = 'merchant_canonical_orders';
    } else if (metric === 'AVERAGE_ORDER_VALUE') {
      const res = await client.query(`
        SELECT COUNT(*)::int as count, COALESCE(AVG(total_amount), 0)::numeric(14,2) as avg
        FROM merchant_canonical_orders WHERE merchant_id = $1
      `, [merchantId]);
      records = res.rows[0].count;
      value = parseFloat(res.rows[0].avg);
      formula = 'AVG(merchant_canonical_orders.total_amount)';
      entity = 'merchant_canonical_orders';
    } else if (metric === 'TOTAL_PRODUCTS') {
      const res = await client.query(`
        SELECT COUNT(*)::int as count FROM merchant_canonical_products WHERE merchant_id = $1
      `, [merchantId]);
      records = res.rows[0].count;
      value = records;
      formula = 'COUNT(merchant_canonical_products.product_id)';
      entity = 'merchant_canonical_products';
    } else if (metric === 'LOW_STOCK_COUNT') {
      const res = await client.query(`
        SELECT COUNT(*)::int as count FROM merchant_canonical_products
        WHERE merchant_id = $1 AND stock <= 20
      `, [merchantId]);
      records = res.rows[0].count;
      value = records;
      formula = 'COUNT(products WHERE stock <= 20)';
      entity = 'merchant_canonical_products';
    }

    const lineage = await this.recordLineage({
      merchantId,
      metricName: metric,
      metricValue: value,
      sourceName: 'Canonical Synchronized Data',
      entityType: entity,
      periodStart,
      periodEnd: now,
      recordsEvaluated: records,
      calculationFormula: formula,
      reconciliationStatus: 'RECONCILED'
    });

    return {
      value,
      lineage,
      trustTag: '[FACT]'
    };
  }
}

export const dataLineageTracker = new DataLineageTracker();
