import { client } from '../data/DB';

export interface CustomerSummaryResult {
  totalRegisteredCustomers: number;
  totalActiveBuyers: number;
  repeatBuyersCount: number;
  oneTimeBuyersCount: number;
  repeatCustomerRatePct: number;
  totalLifetimeBuyers: number;
  lifetimeRepeatBuyersCount: number;
  lifetimeOneTimeBuyersCount: number;
  lifetimeRepeatCustomerRatePct: number;
  averageOrdersPerCustomer: number;
  averageCustomerLifetimeValue: number;
  topCity: string;
}

export interface RepeatCustomerCohort {
  orderCountRange: string;
  customersCount: number;
  totalRevenueContribution: number;
  percentageOfCustomers: number;
}

export interface RepeatCustomersResult {
  repeatRatePct: number;
  totalRepeatBuyers: number;
  totalOneTimeBuyers: number;
  repeatRevenueSharePct: number;
  cohorts: RepeatCustomerCohort[];
  topRepeatCustomers: Array<{
    customerId: string;
    customerName: string;
    email: string;
    totalOrders: number;
    totalSpend: number;
    firstPurchaseDate: string;
    lastPurchaseDate: string;
  }>;
}

/**
 * Returns high-level customer health and buying behavior summary from canonical shopi_* tables
 * Distinguishes lifetime repeat classification (>=2 completed orders) and active purchasers in the reporting period.
 */
export async function getCustomerSummary(period: string = 'last_12_months'): Promise<CustomerSummaryResult> {
  const days = period.includes('7') ? 7 : period.includes('30') ? 30 : period.includes('90') ? 90 : 365;

  const query = `
    WITH customer_lifetime AS (
      SELECT 
        c.customer_id,
        c.city,
        COUNT(o.order_id)::int as lifetime_orders,
        COALESCE(SUM(o.total_amount), 0)::numeric(14,2) as lifetime_spend,
        COUNT(CASE WHEN o.order_placed_at >= CURRENT_DATE - ($1 || ' days')::interval THEN o.order_id END)::int as period_orders
      FROM shopi_customers c
      LEFT JOIN shopi_orders o 
        ON c.customer_id = o.customer_id AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
      GROUP BY c.customer_id, c.city
    ),
    city_stats AS (
      SELECT 
        c.city,
        COUNT(o.order_id) as city_orders
      FROM shopi_orders o
      JOIN shopi_customers c ON o.customer_id = c.customer_id
      WHERE o.order_placed_at >= CURRENT_DATE - ($1 || ' days')::interval
        AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
      GROUP BY c.city
      ORDER BY city_orders DESC
      LIMIT 1
    )
    SELECT 
      (SELECT COUNT(*)::int FROM shopi_customers) as total_reg,
      COUNT(DISTINCT cl.customer_id) FILTER (WHERE cl.period_orders > 0)::int as active_buyers,
      COUNT(DISTINCT cl.customer_id) FILTER (WHERE cl.period_orders > 0 AND cl.lifetime_orders > 1)::int as repeat_buyers,
      COUNT(DISTINCT cl.customer_id) FILTER (WHERE cl.period_orders > 0 AND cl.lifetime_orders = 1)::int as onetime_buyers,
      COUNT(DISTINCT cl.customer_id) FILTER (WHERE cl.lifetime_orders > 0)::int as lifetime_buyers,
      COUNT(DISTINCT cl.customer_id) FILTER (WHERE cl.lifetime_orders > 1)::int as lifetime_repeat_buyers,
      COUNT(DISTINCT cl.customer_id) FILTER (WHERE cl.lifetime_orders = 1)::int as lifetime_onetime_buyers,
      ROUND(AVG(cl.lifetime_orders) FILTER (WHERE cl.period_orders > 0), 2)::numeric(8,2) as avg_orders,
      ROUND(AVG(cl.lifetime_spend) FILTER (WHERE cl.period_orders > 0), 2)::numeric(12,2) as avg_clv,
      COALESCE((SELECT city FROM city_stats), 'Bengaluru') as top_city
    FROM customer_lifetime cl;
  `;

  const res = await client.query(query, [days]);
  const row = res.rows[0];

  const activeBuyers = parseInt(row.active_buyers || '0', 10);
  const repeatBuyers = parseInt(row.repeat_buyers || '0', 10);
  const repeatRate = activeBuyers > 0 ? parseFloat(((repeatBuyers / activeBuyers) * 100).toFixed(2)) : 0;

  const lifetimeBuyers = parseInt(row.lifetime_buyers || '0', 10);
  const lifetimeRepeatBuyers = parseInt(row.lifetime_repeat_buyers || '0', 10);
  const lifetimeOneTimeBuyers = parseInt(row.lifetime_onetime_buyers || '0', 10);
  const lifetimeRepeatRate = lifetimeBuyers > 0 ? parseFloat(((lifetimeRepeatBuyers / lifetimeBuyers) * 100).toFixed(2)) : 0;

  return {
    totalRegisteredCustomers: parseInt(row.total_reg, 10),
    totalActiveBuyers: activeBuyers,
    repeatBuyersCount: repeatBuyers,
    oneTimeBuyersCount: parseInt(row.onetime_buyers || '0', 10),
    repeatCustomerRatePct: repeatRate,
    totalLifetimeBuyers: lifetimeBuyers,
    lifetimeRepeatBuyersCount: lifetimeRepeatBuyers,
    lifetimeOneTimeBuyersCount: lifetimeOneTimeBuyers,
    lifetimeRepeatCustomerRatePct: lifetimeRepeatRate,
    averageOrdersPerCustomer: parseFloat(row.avg_orders || '0'),
    averageCustomerLifetimeValue: parseFloat(row.avg_clv || '0'),
    topCity: row.top_city
  };
}

/**
 * Returns deep breakdown of repeat purchase rates, cohorts, and top buyers from canonical shopi_* tables
 */
export async function getRepeatCustomers(period: string = 'last_12_months'): Promise<RepeatCustomersResult> {
  const days = period.includes('7') ? 7 : period.includes('30') ? 30 : period.includes('90') ? 90 : 365;

  const topBuyersQuery = `
    SELECT 
      c.customer_id,
      c.first_name || ' ' || c.last_name as customer_name,
      c.email,
      COUNT(o.order_id)::int as total_orders,
      SUM(o.total_amount)::numeric(14,2) as total_spend,
      MIN(o.order_placed_at)::date::text as first_purchase,
      MAX(o.order_placed_at)::date::text as last_purchase
    FROM shopi_customers c
    JOIN shopi_orders o ON c.customer_id = o.customer_id AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
    GROUP BY c.customer_id, c.first_name, c.last_name, c.email
    HAVING COUNT(o.order_id) >= 1
    ORDER BY total_orders DESC, total_spend DESC
    LIMIT 5;
  `;

  const cohortsQuery = `
    WITH customer_orders AS (
      SELECT 
        c.customer_id,
        COUNT(o.order_id)::int as order_count,
        COALESCE(SUM(o.total_amount), 0)::numeric(14,2) as spend
      FROM shopi_customers c
      JOIN shopi_orders o ON c.customer_id = o.customer_id AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
      GROUP BY c.customer_id
      HAVING COUNT(o.order_id) >= 1
    ),
    cohort_buckets AS (
      SELECT 
        CASE 
          WHEN order_count = 1 THEN '1 Order (One-Time)'
          WHEN order_count BETWEEN 2 AND 5 THEN '2 - 5 Orders (Repeat)'
          WHEN order_count BETWEEN 6 AND 15 THEN '6 - 15 Orders (Frequent)'
          ELSE '16+ Orders (VIP / Power Buyers)'
        END as bucket,
        COUNT(*)::int as cust_count,
        SUM(spend)::numeric(14,2) as bucket_spend
      FROM customer_orders
      GROUP BY 1
    )
    SELECT 
      bucket,
      cust_count,
      bucket_spend,
      ROUND((cust_count::numeric / (SELECT COUNT(*) FROM customer_orders)::numeric) * 100, 2) as pct
    FROM cohort_buckets
    ORDER BY bucket_spend DESC;
  `;

  const [topRes, cohortsRes] = await Promise.all([
    client.query(topBuyersQuery),
    client.query(cohortsQuery)
  ]);

  const topBuyers = topRes.rows.map((r: any) => ({
    customerId: r.customer_id,
    customerName: r.customer_name,
    email: r.email,
    totalOrders: parseInt(r.total_orders, 10),
    totalSpend: parseFloat(r.total_spend),
    firstPurchaseDate: r.first_purchase,
    lastPurchaseDate: r.last_purchase
  }));

  const cohorts: RepeatCustomerCohort[] = cohortsRes.rows.map((r: any) => ({
    orderCountRange: r.bucket,
    customersCount: parseInt(r.cust_count, 10),
    totalRevenueContribution: parseFloat(r.bucket_spend),
    percentageOfCustomers: parseFloat(r.pct)
  }));

  const totalBuyers = cohorts.reduce((sum, c) => sum + c.customersCount, 0);
  const totalRevenue = cohorts.reduce((sum, c) => sum + c.totalRevenueContribution, 0);
  const oneTime = cohorts.find(c => c.orderCountRange.includes('One-Time'))?.customersCount || 0;
  const oneTimeRevenue = cohorts.find(c => c.orderCountRange.includes('One-Time'))?.totalRevenueContribution || 0;
  const repeatBuyers = totalBuyers - oneTime;
  const repeatRevenue = totalRevenue - oneTimeRevenue;
  const repeatRate = totalBuyers > 0 ? parseFloat(((repeatBuyers / totalBuyers) * 100).toFixed(2)) : 0;
  const repeatRevenueShare = totalRevenue > 0 ? parseFloat(((repeatRevenue / totalRevenue) * 100).toFixed(2)) : 0;

  return {
    repeatRatePct: repeatRate,
    totalRepeatBuyers: repeatBuyers,
    totalOneTimeBuyers: oneTime,
    repeatRevenueSharePct: repeatRevenueShare,
    cohorts,
    topRepeatCustomers: topBuyers
  };
}
