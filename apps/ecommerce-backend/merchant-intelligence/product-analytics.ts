import { client } from '../data/DB';

export interface ProductPerformanceItem {
  productId: number;
  sku?: string;
  title: string;
  categoryName: string;
  price: number;
  discount: number;
  unitsSold: number;
  revenue: number;
  ordersCount: number;
  returnsCount: number;
  returnRatePct: number;
  currentStock: number;
  salesVelocity7d: number;
}

export interface CategoryPerformanceItem {
  categoryId: number;
  categoryName: string;
  mainCategory: string;
  totalProducts: number;
  unitsSold: number;
  grossRevenue: number;
  ordersCount: number;
  revenueSharePct: number;
}

function parseDays(period: string = 'last_30_days'): number {
  switch (period.toLowerCase()) {
    case 'last_7_days':
    case '7d':
      return 7;
    case 'last_30_days':
    case '30d':
      return 30;
    case 'last_90_days':
    case '90d':
      return 90;
    case 'last_12_months':
    case '12m':
    case 'all':
      return 365;
    default:
      return 30;
  }
}

/**
 * Returns top-performing products ranked by gross revenue from canonical shopi_* tables
 */
export async function getTopProducts(limit: number = 5, period: string = 'last_30_days'): Promise<ProductPerformanceItem[]> {
  const days = parseDays(period);

  const query = `
    WITH period_sales AS (
      SELECT 
        oi.product_id,
        SUM(oi.quantity)::int as units_sold,
        SUM(oi.line_total)::numeric(14,2) as revenue,
        COUNT(DISTINCT oi.order_id)::int as orders_count
      FROM shopi_order_items oi
      JOIN shopi_orders o ON oi.order_id = o.order_id
      WHERE o.order_placed_at >= CURRENT_DATE - ($1 || ' days')::interval
        AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
      GROUP BY oi.product_id
    ),
    period_returns AS (
      SELECT 
        r.product_id,
        COUNT(DISTINCT r.return_id)::int as returns_count
      FROM shopi_order_returns r
      WHERE r.created_at >= CURRENT_DATE - ($1 || ' days')::interval
      GROUP BY r.product_id
    )
    SELECT 
      p.product_id,
      p.sku,
      p.title,
      COALESCE(p.category, 'General') as category_name,
      p.selling_price::numeric(12,2) as price,
      p.selling_price::numeric(12,2) as discount,
      p.stock_quantity as current_stock,
      COALESCE(s.units_sold, 0)::int as units_sold,
      COALESCE(s.revenue, 0)::numeric(14,2) as revenue,
      COALESCE(s.orders_count, 0)::int as orders_count,
      COALESCE(r.returns_count, 0)::int as returns_count,
      ROUND(
        (COALESCE(r.returns_count, 0)::numeric / NULLIF(COALESCE(s.units_sold, 0), 0)::numeric) * 100, 
        2
      ) as return_rate_pct,
      COALESCE(ROUND(COALESCE(s.units_sold, 0)::numeric / 30.0, 2), 0.0)::numeric(8,2) as sales_velocity_7d
    FROM shopi_products p
    LEFT JOIN period_sales s ON p.product_id = s.product_id
    LEFT JOIN period_returns r ON p.product_id = r.product_id
    ORDER BY revenue DESC, units_sold DESC
    LIMIT $2;
  `;

  const res = await client.query(query, [days, limit]);
  return res.rows.map((r: any) => ({
    productId: parseInt(r.product_id, 10),
    sku: r.sku,
    title: r.title,
    categoryName: r.category_name,
    price: parseFloat(r.price),
    discount: parseFloat(r.discount),
    unitsSold: parseInt(r.units_sold, 10),
    revenue: parseFloat(r.revenue),
    ordersCount: parseInt(r.orders_count, 10),
    returnsCount: parseInt(r.returns_count, 10),
    returnRatePct: parseFloat(r.return_rate_pct || '0'),
    currentStock: parseInt(r.current_stock, 10),
    salesVelocity7d: parseFloat(r.sales_velocity_7d)
  }));
}

/**
 * Returns slowest-selling or lowest-revenue products from canonical shopi_* tables
 */
export async function getWorstPerformingProducts(limit: number = 5, period: string = 'last_30_days'): Promise<ProductPerformanceItem[]> {
  const days = parseDays(period);

  const query = `
    WITH period_sales AS (
      SELECT 
        oi.product_id,
        SUM(oi.quantity)::int as units_sold,
        SUM(oi.line_total)::numeric(14,2) as revenue,
        COUNT(DISTINCT oi.order_id)::int as orders_count
      FROM shopi_order_items oi
      JOIN shopi_orders o ON oi.order_id = o.order_id
      WHERE o.order_placed_at >= CURRENT_DATE - ($1 || ' days')::interval
        AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
      GROUP BY oi.product_id
    ),
    period_returns AS (
      SELECT 
        r.product_id,
        COUNT(DISTINCT r.return_id)::int as returns_count
      FROM shopi_order_returns r
      WHERE r.created_at >= CURRENT_DATE - ($1 || ' days')::interval
      GROUP BY r.product_id
    )
    SELECT 
      p.product_id,
      p.sku,
      p.title,
      COALESCE(p.category, 'General') as category_name,
      p.selling_price::numeric(12,2) as price,
      p.selling_price::numeric(12,2) as discount,
      p.stock_quantity as current_stock,
      COALESCE(s.units_sold, 0)::int as units_sold,
      COALESCE(s.revenue, 0)::numeric(14,2) as revenue,
      COALESCE(s.orders_count, 0)::int as orders_count,
      COALESCE(r.returns_count, 0)::int as returns_count,
      ROUND(
        (COALESCE(r.returns_count, 0)::numeric / NULLIF(COALESCE(s.units_sold, 0), 0)::numeric) * 100, 
        2
      ) as return_rate_pct,
      COALESCE(ROUND(COALESCE(s.units_sold, 0)::numeric / 30.0, 2), 0.0)::numeric(8,2) as sales_velocity_7d
    FROM shopi_products p
    LEFT JOIN period_sales s ON p.product_id = s.product_id
    LEFT JOIN period_returns r ON p.product_id = r.product_id
    ORDER BY revenue ASC, units_sold ASC
    LIMIT $2;
  `;

  const res = await client.query(query, [days, limit]);
  return res.rows.map((r: any) => ({
    productId: parseInt(r.product_id, 10),
    sku: r.sku,
    title: r.title,
    categoryName: r.category_name,
    price: parseFloat(r.price),
    discount: parseFloat(r.discount),
    unitsSold: parseInt(r.units_sold, 10),
    revenue: parseFloat(r.revenue),
    ordersCount: parseInt(r.orders_count, 10),
    returnsCount: parseInt(r.returns_count, 10),
    returnRatePct: parseFloat(r.return_rate_pct || '0'),
    currentStock: parseInt(r.current_stock, 10),
    salesVelocity7d: parseFloat(r.sales_velocity_7d)
  }));
}

/**
 * Returns category breakdown from canonical shopi_* tables scoped strictly to the requested period
 */
export async function getCategoryPerformance(period: string = 'last_30_days'): Promise<CategoryPerformanceItem[]> {
  const days = parseDays(period);

  const query = `
    WITH period_items AS (
      SELECT 
        oi.product_id,
        oi.quantity,
        oi.line_total,
        oi.order_id
      FROM shopi_order_items oi
      JOIN shopi_orders o ON oi.order_id = o.order_id
      WHERE o.order_placed_at >= CURRENT_DATE - ($1 || ' days')::interval
        AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
    ),
    total_rev AS (
      SELECT COALESCE(SUM(line_total), 1) as grand_total
      FROM period_items
    )
    SELECT 
      ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(pi.line_total), 0) DESC)::int as category_id,
      COALESCE(p.category, 'General') as category_name,
      COALESCE(p.department, 'Apparel') as main_category,
      COUNT(DISTINCT p.product_id)::int as total_products,
      COALESCE(SUM(pi.quantity), 0)::int as units_sold,
      COALESCE(SUM(pi.line_total), 0)::numeric(14,2) as gross_revenue,
      COUNT(DISTINCT pi.order_id)::int as orders_count,
      ROUND(
        (COALESCE(SUM(pi.line_total), 0) / NULLIF((SELECT grand_total FROM total_rev), 0)) * 100, 
        2
      ) as revenue_share_pct
    FROM shopi_products p
    JOIN period_items pi ON p.product_id = pi.product_id
    GROUP BY p.category, p.department
    ORDER BY gross_revenue DESC;
  `;

  const res = await client.query(query, [days]);
  return res.rows.map((r: any) => ({
    categoryId: parseInt(r.category_id, 10),
    categoryName: r.category_name,
    mainCategory: r.main_category,
    totalProducts: parseInt(r.total_products, 10),
    unitsSold: parseInt(r.units_sold, 10),
    grossRevenue: parseFloat(r.gross_revenue),
    ordersCount: parseInt(r.orders_count, 10),
    revenueSharePct: parseFloat(r.revenue_share_pct || '0')
  }));
}

/**
 * Returns details for a specific canonical product
 */
export async function getProductDetails(
  productIdOrSku: string | number,
  period: string = 'last_30_days'
): Promise<ProductPerformanceItem | null> {
  const days = parseDays(period);

  let whereClause = '';
  const params: any[] = [days];

  if (typeof productIdOrSku === 'number' || /^\d+$/.test(String(productIdOrSku))) {
    params.push(parseInt(String(productIdOrSku), 10));
    whereClause = 'p.product_id = $2';
  } else {
    params.push(`%${productIdOrSku}%`);
    whereClause = '(p.sku ILIKE $2 OR p.title ILIKE $2)';
  }

  const query = `
    WITH period_sales AS (
      SELECT 
        oi.product_id,
        SUM(oi.quantity)::int as units_sold,
        SUM(oi.line_total)::numeric(14,2) as revenue,
        COUNT(DISTINCT oi.order_id)::int as orders_count
      FROM shopi_order_items oi
      JOIN shopi_orders o ON oi.order_id = o.order_id
      WHERE o.order_placed_at >= CURRENT_DATE - ($1 || ' days')::interval
        AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
      GROUP BY oi.product_id
    ),
    period_returns AS (
      SELECT 
        r.product_id,
        COUNT(DISTINCT r.return_id)::int as returns_count
      FROM shopi_order_returns r
      WHERE r.created_at >= CURRENT_DATE - ($1 || ' days')::interval
      GROUP BY r.product_id
    )
    SELECT 
      p.product_id,
      p.sku,
      p.title,
      COALESCE(p.category, 'General') as category_name,
      p.selling_price::numeric(12,2) as price,
      p.selling_price::numeric(12,2) as discount,
      p.stock_quantity as current_stock,
      COALESCE(s.units_sold, 0)::int as units_sold,
      COALESCE(s.revenue, 0)::numeric(14,2) as revenue,
      COALESCE(s.orders_count, 0)::int as orders_count,
      COALESCE(r.returns_count, 0)::int as returns_count,
      ROUND(
        (COALESCE(r.returns_count, 0)::numeric / NULLIF(COALESCE(s.units_sold, 0), 0)::numeric) * 100, 
        2
      ) as return_rate_pct,
      COALESCE(ROUND(COALESCE(s.units_sold, 0)::numeric / 30.0, 2), 0.0)::numeric(8,2) as sales_velocity_7d
    FROM shopi_products p
    LEFT JOIN period_sales s ON p.product_id = s.product_id
    LEFT JOIN period_returns r ON p.product_id = r.product_id
    WHERE ${whereClause}
    LIMIT 1;
  `;

  const res = await client.query(query, params);
  if (res.rows.length === 0) return null;

  const r = res.rows[0];
  return {
    productId: parseInt(r.product_id, 10),
    sku: r.sku,
    title: r.title,
    categoryName: r.category_name,
    price: parseFloat(r.price),
    discount: parseFloat(r.discount),
    unitsSold: parseInt(r.units_sold || '0', 10),
    revenue: parseFloat(r.revenue || '0'),
    ordersCount: parseInt(r.orders_count || '0', 10),
    returnsCount: parseInt(r.returns_count || '0', 10),
    returnRatePct: parseFloat(r.return_rate_pct || '0'),
    currentStock: parseInt(r.current_stock, 10),
    salesVelocity7d: parseFloat(r.sales_velocity_7d || '0')
  };
}
