import { client } from '../data/DB';

export interface LowStockProductItem {
  productId: number;
  sku?: string;
  title: string;
  categoryName: string;
  currentStock: number;
  threshold: number;
  dailyVelocity7d: number;
  estimatedDaysRemaining: number | null;
  restockRecommendedUnits: number;
  urgency: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  price?: number;
  unitCogs?: number;
}

export interface InventoryVelocityItem {
  productId: number;
  sku?: string;
  title: string;
  categoryName: string;
  currentStock: number;
  totalSoldInPeriod: number;
  dailySalesVelocity: number;
  turnoverRate: number;
  stockoutRisk: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Returns products with stock below threshold or with low sales runway
 */
export async function getLowStockProducts(threshold: number = 100): Promise<LowStockProductItem[]> {
  const query = `
    WITH recent_velocity AS (
      SELECT 
        oi.product_id,
        ROUND(COALESCE(SUM(oi.quantity), 0)::numeric / 30.0, 3)::numeric(8,3) as daily_vel_30d
      FROM shopi_order_items oi
      JOIN shopi_orders o ON oi.order_id = o.order_id
      WHERE o.order_placed_at >= CURRENT_DATE - INTERVAL '30 days'
        AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
      GROUP BY oi.product_id
    )
    SELECT 
      p.product_id,
      p.sku,
      p.title,
      COALESCE(p.category, 'General') as category_name,
      p.stock_quantity as current_stock,
      p.selling_price::numeric(10,2) as price,
      cg.total_unit_cost::numeric(10,2) as unit_cogs,
      COALESCE(v.daily_vel_30d, 0.000)::numeric(8,3) as daily_vel_30d
    FROM shopi_products p
    LEFT JOIN shopi_product_cogs cg ON p.product_id = cg.product_id
    LEFT JOIN recent_velocity v ON p.product_id = v.product_id
    WHERE p.stock_quantity <= $1
    ORDER BY p.stock_quantity ASC;
  `;

  const res = await client.query(query, [threshold]);

  return res.rows.map((r: any) => {
    const stock = parseInt(r.current_stock, 10);
    const vel = parseFloat(r.daily_vel_30d) || 0;
    const price = r.price ? parseFloat(r.price) : 0;
    const unitCogs = r.unit_cogs ? parseFloat(r.unit_cogs) : undefined;

    let daysRemaining: number | null = null;
    let urgency: 'CRITICAL' | 'WARNING' | 'HEALTHY' = 'HEALTHY';
    let recommendedUnits = 0;

    if (vel > 0.05) {
      daysRemaining = Math.max(0, Math.round(stock / vel));
      if (daysRemaining <= 14) {
        urgency = 'CRITICAL';
        recommendedUnits = Math.max(0, Math.ceil(45 * vel - stock));
      } else if (daysRemaining <= 30) {
        urgency = 'WARNING';
        recommendedUnits = Math.max(0, Math.ceil(30 * vel - stock));
      } else {
        urgency = 'HEALTHY';
        recommendedUnits = 0;
      }
    } else {
      // Near-zero / zero velocity: Not measurable runway, healthy stock cover
      daysRemaining = null;
      urgency = 'HEALTHY';
      recommendedUnits = 0;
    }

    return {
      productId: parseInt(r.product_id, 10),
      sku: r.sku,
      title: r.title,
      categoryName: r.category_name,
      currentStock: stock,
      threshold,
      dailyVelocity7d: vel,
      estimatedDaysRemaining: daysRemaining,
      restockRecommendedUnits: recommendedUnits,
      urgency,
      price,
      unitCogs
    };
  });
}

/**
 * Calculates turnover rate, sales velocity, and stockout risks per canonical product
 */
export async function getInventoryVelocity(period: string = 'last_30_days'): Promise<InventoryVelocityItem[]> {
  const days = period.includes('7') ? 7 : period.includes('90') ? 90 : 30;

  const query = `
    SELECT 
      p.product_id,
      p.sku,
      p.title,
      COALESCE(p.category, 'General') as category_name,
      p.stock_quantity as current_stock,
      COALESCE(SUM(oi.quantity), 0)::int as total_sold,
      ROUND(COALESCE(SUM(oi.quantity), 0)::numeric / $1::numeric, 2)::numeric(8,2) as daily_velocity
    FROM shopi_products p
    LEFT JOIN shopi_order_items oi ON p.product_id = oi.product_id
    LEFT JOIN shopi_orders o ON oi.order_id = o.order_id AND o.order_placed_at >= CURRENT_DATE - ($1 || ' days')::interval
    GROUP BY p.product_id, p.sku, p.title, p.category, p.stock_quantity
    ORDER BY daily_velocity DESC;
  `;

  const res = await client.query(query, [days]);

  return res.rows.map((r: any) => {
    const stock = parseInt(r.current_stock, 10);
    const sold = parseInt(r.total_sold, 10);
    const dailyVel = parseFloat(r.daily_velocity);
    const avgStock = stock + sold / 2;
    const turnover = avgStock > 0 ? parseFloat((sold / avgStock).toFixed(2)) : 0;

    let risk: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (dailyVel > 0 && (stock / dailyVel) < 15) risk = 'HIGH';
    else if (dailyVel > 0 && (stock / dailyVel) < 30) risk = 'MEDIUM';

    return {
      productId: parseInt(r.product_id, 10),
      sku: r.sku,
      title: r.title,
      categoryName: r.category_name,
      currentStock: stock,
      totalSoldInPeriod: sold,
      dailySalesVelocity: dailyVel,
      turnoverRate: turnover,
      stockoutRisk: risk
    };
  });
}
