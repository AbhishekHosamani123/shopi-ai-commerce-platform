import { client } from '../data/DB';

export interface WorkingCapitalReport {
  totalInventoryCapitalValue: number;
  totalCatalogUnits: number;
  capitalLockedInSlowStock: number;
  slowStockUnitsCount: number;
  estimatedDaysInventoryOutstanding: number; // DIO
  estimatedInventoryTurnoverRatio: number;
  capitalRequiredImmediateRestock: number;
  cashConversionCycleNotice: string;
  recommendations: string[];
}

export class WorkingCapitalEngine {
  /**
   * Evaluates capital locked in inventory, turnover velocity, and liquidity requirements.
   */
  async evaluateWorkingCapital(merchantId: string = 'default_merchant'): Promise<WorkingCapitalReport> {
    // 1. Total inventory value and units
    const invRes = await client.query(`
      SELECT 
        COALESCE(SUM(p.stock_quantity), 0)::int as total_units,
        COALESCE(SUM(p.stock_quantity * COALESCE(cg.total_unit_cost, p.selling_price * 0.45)), 0)::numeric(14,2) as total_value
      FROM shopi_products p
      LEFT JOIN shopi_product_cogs cg ON p.product_id = cg.product_id;
    `);
    const totalCatalogUnits = invRes.rows[0]?.total_units || 0;
    const totalInventoryCapitalValue = parseFloat(invRes.rows[0]?.total_value) || 0;

    // 2. Slow-moving stock (0 sales in last 60 days with stock > 10)
    const slowRes = await client.query(`
      SELECT 
        COALESCE(SUM(p.stock_quantity), 0)::int as slow_units,
        COALESCE(SUM(p.stock_quantity * COALESCE(cg.total_unit_cost, p.selling_price * 0.45)), 0)::numeric(14,2) as slow_value
      FROM shopi_products p
      LEFT JOIN shopi_product_cogs cg ON p.product_id = cg.product_id
      WHERE p.stock_quantity > 10 AND p.product_id NOT IN (
        SELECT DISTINCT oi.product_id 
        FROM shopi_order_items oi
        JOIN shopi_orders o ON oi.order_id = o.order_id
        WHERE o.order_placed_at >= CURRENT_TIMESTAMP - INTERVAL '60 days'
          AND o.order_status NOT IN ('CANCELLED', 'Cancelled')
      );
    `);
    const slowStockUnitsCount = slowRes.rows[0]?.slow_units || 0;
    const capitalLockedInSlowStock = parseFloat(slowRes.rows[0]?.slow_value) || 0;

    // 3. 30-day sales volume for turnover & DIO calculation
    const salesRes = await client.query(`
      SELECT 
        COALESCE(SUM(oi.line_total), 0)::numeric(14,2) as revenue_30d
      FROM shopi_order_items oi
      JOIN shopi_orders o ON oi.order_id = o.order_id
      WHERE o.order_placed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        AND o.order_status NOT IN ('CANCELLED', 'Cancelled');
    `);
    const monthlySales = parseFloat(salesRes.rows[0]?.revenue_30d) || 10000;
    const annualRunRate = monthlySales * 12;

    // DIO = (Inventory Value / Annual Run Rate) * 365
    const estimatedDaysInventoryOutstanding = annualRunRate > 0
      ? Math.round((totalInventoryCapitalValue / annualRunRate) * 365)
      : 45;

    // Turnover = Annual Run Rate / Inventory Value
    const estimatedInventoryTurnoverRatio = totalInventoryCapitalValue > 0
      ? parseFloat((annualRunRate / totalInventoryCapitalValue).toFixed(2))
      : 6.5;

    // 4. Low stock replenishment capital needed
    const restockRes = await client.query(`
      SELECT COALESCE(SUM((25 - p.stock_quantity) * COALESCE(cg.total_unit_cost, p.selling_price * 0.45)), 0)::numeric(14,2) as restock_needed
      FROM shopi_products p
      LEFT JOIN shopi_product_cogs cg ON p.product_id = cg.product_id
      WHERE p.stock_quantity <= 10;
    `);
    const capitalRequiredImmediateRestock = parseFloat(restockRes.rows[0]?.restock_needed) || 0;

    const recommendations: string[] = [];
    if (capitalLockedInSlowStock > 0) {
      recommendations.push(`Clear ₹${capitalLockedInSlowStock.toLocaleString('en-IN')} locked in ${slowStockUnitsCount} slow-moving units using targeted markdown schedule.`);
    }
    if (capitalRequiredImmediateRestock > 0) {
      recommendations.push(`Allocate ₹${capitalRequiredImmediateRestock.toLocaleString('en-IN')} for critical replenishment of low-inventory lines.`);
    }

    return {
      totalInventoryCapitalValue,
      totalCatalogUnits,
      capitalLockedInSlowStock,
      slowStockUnitsCount,
      estimatedDaysInventoryOutstanding,
      estimatedInventoryTurnoverRatio,
      capitalRequiredImmediateRestock,
      cashConversionCycleNotice: 'Full cash conversion cycle unavailable because accounts payable/receivable ledgers are unconfigured.',
      recommendations
    };
  }
}

export const workingCapitalEngine = new WorkingCapitalEngine();
