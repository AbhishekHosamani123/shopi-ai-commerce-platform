import { client } from '../data/DB';

export interface BusinessRiskItem {
  riskType: 'SKU_CONCENTRATION' | 'CUSTOMER_CONCENTRATION' | 'SUPPLIER_CONCENTRATION' | 'WAREHOUSE_CONCENTRATION' | 'DISCOUNT_DEPENDENCY';
  title: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  metricValue: string;
  explanation: string;
  mitigationRecommendation: string;
}

export interface BusinessRiskRadarReport {
  overallRiskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  identifiedRisks: BusinessRiskItem[];
  concentrationIndexScore: number; // 0 - 100 (higher = more concentrated/risky)
  evaluatedAt: string;
}

export class BusinessRiskRadar {
  /**
   * Scans multi-dimensional business concentration and operational risks.
   */
  async scanBusinessRisks(merchantId: string = 'default_merchant'): Promise<BusinessRiskRadarReport> {
    const risks: BusinessRiskItem[] = [];

    // 1. SKU Concentration Check (Revenue share of top 2 SKUs)
    const skuRes = await client.query(`
      SELECT 
        p.product_id,
        p.title,
        COALESCE(SUM(oi.line_total), 0)::numeric as sku_revenue
      FROM shopi_products p
      JOIN shopi_order_items oi ON p.product_id = oi.product_id
      JOIN shopi_orders o ON oi.order_id = o.order_id
      WHERE o.order_placed_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'
        AND o.order_status NOT IN ('CANCELLED', 'Cancelled')
      GROUP BY p.product_id, p.title
      ORDER BY sku_revenue DESC;
    `);

    const totalSkuRev = skuRes.rows.reduce((acc, r) => acc + parseFloat(r.sku_revenue), 0);
    const top2Rev = (parseFloat(skuRes.rows[0]?.sku_revenue) || 0) + (parseFloat(skuRes.rows[1]?.sku_revenue) || 0);
    const skuConcentrationPct = totalSkuRev > 0 ? Math.round((top2Rev / totalSkuRev) * 100) : 25;

    if (skuConcentrationPct > 35) {
      risks.push({
        riskType: 'SKU_CONCENTRATION',
        title: 'High Catalog SKU Concentration',
        severity: skuConcentrationPct > 45 ? 'HIGH' : 'MEDIUM',
        metricValue: `${skuConcentrationPct}% of revenue from top 2 SKUs`,
        explanation: `Top 2 products ("${skuRes.rows[0]?.title}" and "${skuRes.rows[1]?.title}") account for ${skuConcentrationPct}% of 90-day gross revenue.`,
        mitigationRecommendation: 'Promote secondary category lines and introduce adjacent variants to broaden revenue baseline.'
      });
    }

    // 2. Customer Concentration Check
    const custRes = await client.query(`
      SELECT 
        c.customer_id,
        COALESCE(SUM(o.total_amount), 0)::numeric as user_spend
      FROM shopi_customers c
      JOIN shopi_orders o ON c.customer_id = o.customer_id
      WHERE o.order_status NOT IN ('CANCELLED', 'Cancelled')
      GROUP BY c.customer_id
      ORDER BY user_spend DESC;
    `);
    const totalCustSpend = custRes.rows.reduce((acc, r) => acc + parseFloat(r.user_spend), 0);
    const top5CustSpend = custRes.rows.slice(0, 5).reduce((acc, r) => acc + parseFloat(r.user_spend), 0);
    const custConcentrationPct = totalCustSpend > 0 ? Math.round((top5CustSpend / totalCustSpend) * 100) : 10;

    if (custConcentrationPct > 15) {
      risks.push({
        riskType: 'CUSTOMER_CONCENTRATION',
        title: 'Customer Cohort Concentration',
        severity: custConcentrationPct > 25 ? 'HIGH' : 'MEDIUM',
        metricValue: `${custConcentrationPct}% from top 5 customer accounts`,
        explanation: `A narrow segment of 5 buyers generates ${custConcentrationPct}% of all customer lifetime revenue.`,
        mitigationRecommendation: 'Expand acquisition campaigns and loyalty programs to cultivate a wider mid-tier buyer base.'
      });
    }

    // 3. Supplier Concentration Check
    const suppRes = await client.query(`
      SELECT COUNT(*)::int as supplier_count FROM merchant_suppliers WHERE merchant_id = $1 OR $1 = 'merchant_admin';
    `, [merchantId]);
    const supplierCount = suppRes.rows[0]?.supplier_count || 0;

    if (supplierCount <= 2) {
      risks.push({
        riskType: 'SUPPLIER_CONCENTRATION',
        title: 'Single/Dual Supplier Dependency',
        severity: supplierCount <= 1 ? 'HIGH' : 'MEDIUM',
        metricValue: `${supplierCount} active suppliers configured`,
        explanation: 'Fulfillment relies on a limited supplier base. Operational disruptions or lead-time spikes pose high stockout exposure.',
        mitigationRecommendation: 'Onboard secondary backup suppliers for top velocity lines to build procurement resilience.'
      });
    }

    // 4. Warehouse Concentration Check
    const whRes = await client.query(`
      SELECT 
        warehouse_id,
        COALESCE(SUM(available_quantity), 0) as wh_stock
      FROM merchant_warehouse_inventory
      WHERE merchant_id = $1 OR $1 = 'merchant_admin'
      GROUP BY warehouse_id
      ORDER BY wh_stock DESC;
    `, [merchantId]);
    const totalWhStock = whRes.rows.reduce((acc, r) => acc + parseInt(r.wh_stock, 10), 0);
    const topWhStock = parseInt(whRes.rows[0]?.wh_stock, 10) || 0;
    const whConcentrationPct = totalWhStock > 0 ? Math.round((topWhStock / totalWhStock) * 100) : 50;

    if (whConcentrationPct > 55) {
      risks.push({
        riskType: 'WAREHOUSE_CONCENTRATION',
        title: 'Asymmetric Warehouse Stock Allocation',
        severity: 'MEDIUM',
        metricValue: `${whConcentrationPct}% stock held in single facility`,
        explanation: `Over half of all available catalog inventory is concentrated in one primary warehouse node.`,
        mitigationRecommendation: 'Execute inter-warehouse rebalancing transfers to distribute stock closer to regional demand centers.'
      });
    }

    // 5. Discount Dependency Check
    const discRes = await client.query(`
      SELECT 
        COUNT(CASE WHEN discount_percentage > 0 THEN 1 END)::int as discounted_skus,
        COUNT(product_id)::int as total_skus
      FROM shopi_products;
    `);
    const discountedSkus = discRes.rows[0]?.discounted_skus || 0;
    const totalSkus = discRes.rows[0]?.total_skus || 40;
    const discountPct = Math.round((discountedSkus / totalSkus) * 100);

    if (discountPct > 50) {
      risks.push({
        riskType: 'DISCOUNT_DEPENDENCY',
        title: 'High Promotion Dependency',
        severity: 'MEDIUM',
        metricValue: `${discountPct}% of catalog SKUs discounted`,
        explanation: `More than half of the product catalog is currently selling at markdown prices.`,
        mitigationRecommendation: 'Gradually restore full price points on inelastic products to avoid brand margin erosion.'
      });
    }

    const highCount = risks.filter(r => r.severity === 'HIGH').length;
    const overallRiskLevel = highCount >= 2 ? 'HIGH' : highCount === 1 ? 'MEDIUM' : 'LOW';
    const concentrationIndexScore = Math.min(100, Math.round((skuConcentrationPct * 0.4) + (custConcentrationPct * 0.3) + (whConcentrationPct * 0.3)));

    return {
      overallRiskLevel,
      identifiedRisks: risks,
      concentrationIndexScore,
      evaluatedAt: new Date().toISOString()
    };
  }
}

export const businessRiskRadar = new BusinessRiskRadar();
