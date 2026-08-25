import { client } from '../data/DB';

export interface CustomerSummaryResult {
  totalRegisteredCustomers: number;
  totalActiveBuyers: number;
  repeatBuyersCount: number;
  oneTimeBuyersCount: number;
  repeatCustomerRatePct: number;
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
  cohorts: RepeatCustomerCohort[];
  topRepeatCustomers: Array<{
    userId: number;
    username: string;
    email: string;
    totalOrders: number;
    totalSpend: number;
    firstPurchaseDate: string;
    lastPurchaseDate: string;
  }>;
}

/**
 * Returns high-level customer health and buying behavior summary
 */
export async function getCustomerSummary(period: string = 'last_12_months'): Promise<CustomerSummaryResult> {
  const days = period.includes('30') ? 30 : period.includes('90') ? 90 : 365;

  const query = `
    WITH customer_stats AS (
      SELECT 
        u.userid,
        COUNT(o.orderid)::int as orders_count,
        COALESCE(SUM(o.totalamount), 0) as total_spend
      FROM users u
      LEFT JOIN orders o 
        ON u.userid = o.userid AND o.createdat >= CURRENT_DATE - ($1 || ' days')::interval
      WHERE u.role = 'customer'
      GROUP BY u.userid
    ),
    city_stats AS (
      SELECT 
        a.city,
        COUNT(o.orderid) as city_orders
      FROM orders o
      JOIN addresses a ON o.userid = a.userid
      WHERE o.createdat >= CURRENT_DATE - ($1 || ' days')::interval
      GROUP BY a.city
      ORDER BY city_orders DESC
      LIMIT 1
    )
    SELECT 
      (SELECT COUNT(*)::int FROM users WHERE role = 'customer') as total_reg,
      COUNT(DISTINCT cs.userid) FILTER (WHERE cs.orders_count > 0)::int as active_buyers,
      COUNT(DISTINCT cs.userid) FILTER (WHERE cs.orders_count > 1)::int as repeat_buyers,
      COUNT(DISTINCT cs.userid) FILTER (WHERE cs.orders_count = 1)::int as onetime_buyers,
      ROUND(AVG(cs.orders_count) FILTER (WHERE cs.orders_count > 0), 2)::numeric(8,2) as avg_orders,
      ROUND(AVG(cs.total_spend) FILTER (WHERE cs.orders_count > 0), 2)::numeric(12,2) as avg_clv,
      COALESCE((SELECT city FROM city_stats), 'Mumbai') as top_city
    FROM customer_stats cs;
  `;

  const res = await client.query(query, [days]);
  const row = res.rows[0];

  const activeBuyers = parseInt(row.active_buyers || '0', 10);
  const repeatBuyers = parseInt(row.repeat_buyers || '0', 10);
  const repeatRate = activeBuyers > 0 ? parseFloat(((repeatBuyers / activeBuyers) * 100).toFixed(2)) : 0;

  return {
    totalRegisteredCustomers: parseInt(row.total_reg, 10),
    totalActiveBuyers: activeBuyers,
    repeatBuyersCount: repeatBuyers,
    oneTimeBuyersCount: parseInt(row.onetime_buyers || '0', 10),
    repeatCustomerRatePct: repeatRate,
    averageOrdersPerCustomer: parseFloat(row.avg_orders || '0'),
    averageCustomerLifetimeValue: parseFloat(row.avg_clv || '0'),
    topCity: row.top_city
  };
}

/**
 * Returns deep breakdown of repeat purchase rates, cohorts, and top buyers
 */
export async function getRepeatCustomers(period: string = 'last_12_months'): Promise<RepeatCustomersResult> {
  const days = period.includes('30') ? 30 : period.includes('90') ? 90 : 365;

  const topBuyersQuery = `
    SELECT 
      u.userid as user_id,
      u.username,
      u.email,
      COUNT(o.orderid)::int as total_orders,
      SUM(o.totalamount)::numeric(14,2) as total_spend,
      MIN(o.createdat)::date::text as first_purchase,
      MAX(o.createdat)::date::text as last_purchase
    FROM users u
    JOIN orders o ON u.userid = o.userid
    WHERE o.createdat >= CURRENT_DATE - ($1 || ' days')::interval
    GROUP BY u.userid, u.username, u.email
    ORDER BY total_orders DESC, total_spend DESC
    LIMIT 5;
  `;

  const cohortsQuery = `
    WITH customer_orders AS (
      SELECT 
        u.userid,
        COUNT(o.orderid)::int as order_count,
        COALESCE(SUM(o.totalamount), 0) as spend
      FROM users u
      JOIN orders o ON u.userid = o.userid
      WHERE o.createdat >= CURRENT_DATE - ($1 || ' days')::interval
      GROUP BY u.userid
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
    client.query(topBuyersQuery, [days]),
    client.query(cohortsQuery, [days])
  ]);

  const topBuyers = topRes.rows.map((r: any) => ({
    userId: parseInt(r.user_id, 10),
    username: r.username,
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
  const oneTime = cohorts.find(c => c.orderCountRange.includes('One-Time'))?.customersCount || 0;
  const repeatBuyers = totalBuyers - oneTime;
  const repeatRate = totalBuyers > 0 ? parseFloat(((repeatBuyers / totalBuyers) * 100).toFixed(2)) : 0;

  return {
    repeatRatePct: repeatRate,
    totalRepeatBuyers: repeatBuyers,
    totalOneTimeBuyers: oneTime,
    cohorts,
    topRepeatCustomers: topBuyers
  };
}
