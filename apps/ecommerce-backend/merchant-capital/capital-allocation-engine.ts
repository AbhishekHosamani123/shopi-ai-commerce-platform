import { client } from '../data/DB';
import { CapitalAllocationPlan, CapitalOpportunity } from './capital-types';

export class CapitalAllocationEngine {
  /**
   * Generates optimal capital allocation breakdown for any provided budget.
   */
  async allocateCapital(totalBudget: number = 100000, merchantId: string = 'default_merchant'): Promise<CapitalAllocationPlan> {
    const budget = Math.max(10000, totalBudget);
    const allocationId = `cap_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    // 1. Fetch high-demand / low-stock SKUs
    const prodRes = await client.query(`
      SELECT 
        p.product_id as productid,
        p.sku,
        p.title,
        p.selling_price::numeric(10,2) as price,
        p.stock_quantity as stock,
        COALESCE(SUM(oi.quantity), 0) as units_sold_30d
      FROM shopi_products p
      LEFT JOIN shopi_order_items oi ON p.product_id = oi.product_id
      LEFT JOIN shopi_orders o ON oi.order_id = o.order_id AND o.order_placed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' AND o.order_status NOT IN ('CANCELLED', 'Cancelled')
      GROUP BY p.product_id, p.sku, p.title, p.selling_price, p.stock_quantity
      ORDER BY units_sold_30d DESC, p.stock_quantity ASC
      LIMIT 3;
    `);

    const topProd = prodRes.rows[0];
    const secondProd = prodRes.rows[1] || topProd;

    // 2. Fetch at-risk customer count
    const custRes = await client.query(`
      SELECT COUNT(DISTINCT c.customer_id)::int as at_risk_count
      FROM shopi_customers c
      JOIN shopi_orders o ON c.customer_id = o.customer_id
      WHERE o.order_placed_at < CURRENT_TIMESTAMP - INTERVAL '60 days'
        AND o.order_status NOT IN ('CANCELLED', 'Cancelled');
    `);
    const atRiskCount = custRes.rows[0]?.at_risk_count || 12;

    // 3. Build structured allocation opportunities
    const opportunities: CapitalOpportunity[] = [];

    // Category 1: High-Velocity Restock (40%)
    const restock1Amt = Math.round(budget * 0.40);
    opportunities.push({
      category: 'RESTOCK_HIGH_VELOCITY',
      title: `Inventory Replenishment: ${topProd?.title || 'Fast-Moving SKU'}`,
      recommendedAmount: restock1Amt,
      allocationPercentage: 40,
      expectedPaybackPeriodDays: 28,
      expectedImpact: `Replenishes ~${Math.max(15, Math.round(restock1Amt / parseFloat(topProd?.price || '1200')))} units. Prevents estimated ₹${Math.round(restock1Amt * 1.6).toLocaleString('en-IN')} in lost stockout revenue.`,
      confidence: 'HIGH',
      risk: 'LOW',
      targetSkuId: topProd?.productid,
      targetSkuTitle: topProd?.title,
      actionRequired: 'Draft Purchase Order',
      assumptions: ['Maintains current 30-day velocity cadence', 'Supplier lead time 7 days']
    });

    // Category 2: Secondary Line Buffer (25%)
    const restock2Amt = Math.round(budget * 0.25);
    opportunities.push({
      category: 'RESTOCK_HIGH_VELOCITY',
      title: `Secondary Line Safety Stock: ${secondProd?.title || 'Core Catalog Line'}`,
      recommendedAmount: restock2Amt,
      allocationPercentage: 25,
      expectedPaybackPeriodDays: 35,
      expectedImpact: `Buffers ~${Math.max(10, Math.round(restock2Amt / parseFloat(secondProd?.price || '1000')))} units against sudden regional demand spikes.`,
      confidence: 'HIGH',
      risk: 'LOW',
      targetSkuId: secondProd?.productid,
      targetSkuTitle: secondProd?.title,
      actionRequired: 'Draft Purchase Order',
      assumptions: ['Regional demand stable across North and South hubs']
    });

    // Category 3: Customer Retention & Win-Back Incentives (15%)
    const retentionAmt = Math.round(budget * 0.15);
    opportunities.push({
      category: 'CUSTOMER_RETENTION',
      title: `Targeted Win-Back Retention for ${atRiskCount} Dormant Accounts`,
      recommendedAmount: retentionAmt,
      allocationPercentage: 15,
      expectedPaybackPeriodDays: 14,
      expectedImpact: `Funds tailored re-engagement incentives. Projected to reactivate ~${Math.round(atRiskCount * 0.25)} high-LTV customer accounts.`,
      confidence: 'MEDIUM',
      risk: 'LOW',
      actionRequired: 'Stage Phase 3B Retention Action',
      assumptions: ['20-25% win-back conversion baseline on historical cohorts']
    });

    // Category 4: Controlled Advertising & Acquisition (10%)
    const adAmt = Math.round(budget * 0.10);
    opportunities.push({
      category: 'ADVERTISING_ACQUISITION',
      title: `Paid Acquisition Test for High-Inventory Stable SKUs`,
      recommendedAmount: adAmt,
      allocationPercentage: 10,
      expectedPaybackPeriodDays: 21,
      expectedImpact: `Generates incremental top-of-funnel traffic without risking stockouts on eligible SKUs.`,
      confidence: 'MEDIUM',
      risk: 'MEDIUM',
      actionRequired: 'Stage Ad Budget Allocation Action',
      assumptions: ['Opportunity-based test budget; provider neutral']
    });

    // Category 5: Working Capital Cash Reserve (10%)
    const reserveAmt = budget - restock1Amt - restock2Amt - retentionAmt - adAmt;
    opportunities.push({
      category: 'WORKING_CAPITAL_RESERVE',
      title: `Unallocated Working Capital Liquidity Buffer`,
      recommendedAmount: reserveAmt,
      allocationPercentage: 10,
      expectedPaybackPeriodDays: 0,
      expectedImpact: `Guarantees cash runway for operational shipping variances or supplier prepayment discounts.`,
      confidence: 'HIGH',
      risk: 'LOW',
      actionRequired: 'Hold in Cash Reserves',
      assumptions: ['Preserves minimum operational liquidity']
    });

    const plan: CapitalAllocationPlan = {
      allocationId,
      merchantId,
      totalBudget: budget,
      opportunities,
      projectedRevenueRange: {
        min: Math.round(budget * 1.35),
        mid: Math.round(budget * 1.70),
        max: Math.round(budget * 2.10)
      },
      totalWorkingCapitalReserve: reserveAmt,
      overallRisk: 'LOW',
      confidence: 'HIGH',
      dataHealthNotice: 'Revenue projections are based on top-line historical velocity. True net margin ROI requires COGS procurement cost data.',
      createdAt: new Date().toISOString()
    };

    // Save to database
    await client.query(`
      INSERT INTO merchant_capital_allocations (
        allocation_id, merchant_id, total_budget, allocations,
        projected_revenue_min, projected_revenue_max, confidence, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PROPOSED');
    `, [
      plan.allocationId, merchantId, plan.totalBudget, JSON.stringify(plan.opportunities),
      plan.projectedRevenueRange.min, plan.projectedRevenueRange.max, plan.confidence
    ]);

    return plan;
  }
}

export const capitalAllocationEngine = new CapitalAllocationEngine();
