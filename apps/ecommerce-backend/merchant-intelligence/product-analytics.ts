import { client } from '../data/DB';

export interface ProductPerformanceItem {
  productId: number;
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
 * Returns top-performing products ranked by gross revenue or volume
 */
export async function getTopProducts(limit: number = 5, period: string = 'last_30_days'): Promise<ProductPerformanceItem[]> {
  const days = parseDays(period);

  const query = `
    SELECT 
      p.productid as product_id,
      p.title,
      COALESCE(c.name, 'Uncategorized') as category_name,
      p.price::numeric(12,2),
      COALESCE(p.discount, p.price)::numeric(12,2) as discount,
      p.stock as current_stock,
      COALESCE(SUM(m.units_sold), 0)::int as units_sold,
      COALESCE(SUM(m.gross_revenue), 0)::numeric(14,2) as revenue,
      COALESCE(SUM(m.orders_count), 0)::int as orders_count,
      COALESCE(SUM(m.returns_count), 0)::int as returns_count,
      ROUND(
        (COALESCE(SUM(m.returns_count), 0)::numeric / NULLIF(SUM(m.units_sold), 0)::numeric) * 100, 
        2
      ) as return_rate_pct,
      COALESCE(AVG(m.sales_velocity_7d), 0)::numeric(8,2) as sales_velocity_7d
    FROM products p
    LEFT JOIN categories c ON p.categoryid = c.categoryid
    JOIN merchant_product_daily_metrics m ON p.productid = m.productid
    WHERE m.metric_date >= CURRENT_DATE - ($1 || ' days')::interval
    GROUP BY p.productid, p.title, c.name, p.price, p.discount, p.stock
    ORDER BY revenue DESC
    LIMIT $2;
  `;

  const res = await client.query(query, [days, limit]);
  return res.rows.map((r: any) => ({
    productId: parseInt(r.product_id, 10),
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
 * Returns slowest-selling or worst-performing products
 */
export async function getWorstPerformingProducts(limit: number = 5, period: string = 'last_30_days'): Promise<ProductPerformanceItem[]> {
  const days = parseDays(period);

  const query = `
    SELECT 
      p.productid as product_id,
      p.title,
      COALESCE(c.name, 'Uncategorized') as category_name,
      p.price::numeric(12,2),
      COALESCE(p.discount, p.price)::numeric(12,2) as discount,
      p.stock as current_stock,
      COALESCE(SUM(m.units_sold), 0)::int as units_sold,
      COALESCE(SUM(m.gross_revenue), 0)::numeric(14,2) as revenue,
      COALESCE(SUM(m.orders_count), 0)::int as orders_count,
      COALESCE(SUM(m.returns_count), 0)::int as returns_count,
      ROUND(
        (COALESCE(SUM(m.returns_count), 0)::numeric / NULLIF(SUM(m.units_sold), 0)::numeric) * 100, 
        2
      ) as return_rate_pct,
      COALESCE(AVG(m.sales_velocity_7d), 0)::numeric(8,2) as sales_velocity_7d
    FROM products p
    LEFT JOIN categories c ON p.categoryid = c.categoryid
    JOIN merchant_product_daily_metrics m ON p.productid = m.productid
    WHERE m.metric_date >= CURRENT_DATE - ($1 || ' days')::interval
    GROUP BY p.productid, p.title, c.name, p.price, p.discount, p.stock
    ORDER BY revenue ASC
    LIMIT $2;
  `;

  const res = await client.query(query, [days, limit]);
  return res.rows.map((r: any) => ({
    productId: parseInt(r.product_id, 10),
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
 * Returns breakdown of performance across product categories
 */
export async function getCategoryPerformance(period: string = 'last_30_days'): Promise<CategoryPerformanceItem[]> {
  const days = parseDays(period);

  const query = `
    WITH total_rev AS (
      SELECT COALESCE(SUM(gross_revenue), 1) as grand_total
      FROM merchant_product_daily_metrics
      WHERE metric_date >= CURRENT_DATE - ($1 || ' days')::interval
    )
    SELECT 
      c.categoryid as category_id,
      c.name as category_name,
      COALESCE(c.maincategory, 'General') as main_category,
      COUNT(DISTINCT p.productid)::int as total_products,
      COALESCE(SUM(m.units_sold), 0)::int as units_sold,
      COALESCE(SUM(m.gross_revenue), 0)::numeric(14,2) as gross_revenue,
      COALESCE(SUM(m.orders_count), 0)::int as orders_count,
      ROUND(
        (COALESCE(SUM(m.gross_revenue), 0) / (SELECT grand_total FROM total_rev)) * 100, 
        2
      ) as revenue_share_pct
    FROM categories c
    JOIN products p ON c.categoryid = p.categoryid
    JOIN merchant_product_daily_metrics m ON p.productid = m.productid
    WHERE m.metric_date >= CURRENT_DATE - ($1 || ' days')::interval
    GROUP BY c.categoryid, c.name, c.maincategory
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
    revenueSharePct: parseFloat(r.revenue_share_pct)
  }));
}

/**
 * Returns deep-dive performance metrics for a specific product
 */
export async function getProductDetails(
  productIdOrTitle: string | number,
  period: string = 'last_30_days'
): Promise<ProductPerformanceItem | null> {
  const days = parseDays(period);

  let whereClause = '';
  const params: any[] = [days];

  if (typeof productIdOrTitle === 'number' || /^\d+$/.test(String(productIdOrTitle))) {
    params.push(parseInt(String(productIdOrTitle), 10));
    whereClause = 'p.productid = $2';
  } else {
    params.push(`%${productIdOrTitle}%`);
    whereClause = 'p.title ILIKE $2';
  }

  const query = `
    SELECT 
      p.productid as product_id,
      p.title,
      COALESCE(c.name, 'Uncategorized') as category_name,
      p.price::numeric(12,2),
      COALESCE(p.discount, p.price)::numeric(12,2) as discount,
      p.stock as current_stock,
      COALESCE(SUM(m.units_sold), 0)::int as units_sold,
      COALESCE(SUM(m.gross_revenue), 0)::numeric(14,2) as revenue,
      COALESCE(SUM(m.orders_count), 0)::int as orders_count,
      COALESCE(SUM(m.returns_count), 0)::int as returns_count,
      ROUND(
        (COALESCE(SUM(m.returns_count), 0)::numeric / NULLIF(SUM(m.units_sold), 0)::numeric) * 100, 
        2
      ) as return_rate_pct,
      COALESCE(AVG(m.sales_velocity_7d), 0)::numeric(8,2) as sales_velocity_7d
    FROM products p
    LEFT JOIN categories c ON p.categoryid = c.categoryid
    LEFT JOIN merchant_product_daily_metrics m 
      ON p.productid = m.productid AND m.metric_date >= CURRENT_DATE - ($1 || ' days')::interval
    WHERE ${whereClause}
    GROUP BY p.productid, p.title, c.name, p.price, p.discount, p.stock
    LIMIT 1;
  `;

  const res = await client.query(query, params);
  if (res.rows.length === 0) return null;

  const r = res.rows[0];
  return {
    productId: parseInt(r.product_id, 10),
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

