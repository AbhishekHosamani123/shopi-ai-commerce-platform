import { client } from '../data/DB';

export interface ReturnReasonBreakdown {
  reason: string;
  count: number;
  totalRefundAmount: number;
  percentageOfReturns: number;
}

export interface ReturnAnalyticsResult {
  totalDeliveredItems: number;
  totalReturnedItems: number;
  overallReturnRatePct: number;
  totalRefundAmount: number;
  reasonBreakdown: ReturnReasonBreakdown[];
  highestReturnProducts: Array<{
    productId: number;
    title: string;
    unitsSold: number;
    returnsCount: number;
    returnRatePct: number;
    refundAmount: number;
  }>;
}

export interface CancellationReasonBreakdown {
  reason: string;
  count: number;
  percentageOfCancels: number;
}

export interface CancellationAnalyticsResult {
  totalOrders: number;
  totalCancellations: number;
  cancellationRatePct: number;
  reasonBreakdown: CancellationReasonBreakdown[];
}

function parseDays(period: string = 'last_12_months'): number {
  if (period.includes('7')) return 7;
  if (period.includes('30')) return 30;
  if (period.includes('90')) return 90;
  return 365;
}

/**
 * Returns complete return analytics, reason distribution, and high-return items
 */
/**
 * Returns complete return analytics, reason distribution, and high-return items from canonical shopi_* tables
 */
export async function getReturnAnalytics(period: string = 'last_12_months'): Promise<ReturnAnalyticsResult> {
  const days = parseDays(period);

  const summaryQuery = `
    WITH delivered_items AS (
      SELECT COALESCE(SUM(oi.quantity), 0)::int as total_items
      FROM shopi_order_items oi
      JOIN shopi_orders o ON oi.order_id = o.order_id
      WHERE o.order_placed_at >= CURRENT_DATE - ($1 || ' days')::interval
        AND o.order_status NOT IN ('Cancelled', 'CANCELLED')
    ),
    period_returns AS (
      SELECT 
        COUNT(r.return_id)::int as total_returns,
        COALESCE(SUM(r.refund_amount), 0)::numeric(14,2) as total_refunds
      FROM shopi_order_returns r
      WHERE r.created_at >= CURRENT_DATE - ($1 || ' days')::interval
    )
    SELECT 
      (SELECT total_items FROM delivered_items) as total_items,
      (SELECT total_returns FROM period_returns) as total_returns,
      (SELECT total_refunds FROM period_returns) as total_refunds;
  `;

  const reasonsQuery = `
    WITH total_ret AS (
      SELECT COUNT(*)::numeric as grand_total 
      FROM shopi_order_returns 
      WHERE created_at >= CURRENT_DATE - ($1 || ' days')::interval
    )
    SELECT 
      COALESCE(return_reason, 'General Return') as reason,
      COUNT(*)::int as count,
      SUM(refund_amount)::numeric(12,2) as total_refund_amount,
      ROUND((COUNT(*)::numeric / NULLIF((SELECT grand_total FROM total_ret), 0)) * 100, 2) as percentage
    FROM shopi_order_returns
    WHERE created_at >= CURRENT_DATE - ($1 || ' days')::interval
    GROUP BY return_reason
    ORDER BY count DESC;
  `;

  const topReturnedQuery = `
    SELECT 
      p.product_id,
      p.title,
      COALESCE(SUM(oi.quantity), 0)::int as units_sold,
      COUNT(DISTINCT r.return_id)::int as returns_count,
      ROUND(
        (COUNT(DISTINCT r.return_id)::numeric / NULLIF(SUM(oi.quantity), 0)::numeric) * 100, 
        2
      ) as return_rate_pct,
      COALESCE(SUM(r.refund_amount), 0)::numeric(12,2) as refund_amount
    FROM shopi_products p
    JOIN shopi_order_returns r ON p.product_id = r.product_id AND r.created_at >= CURRENT_DATE - ($1 || ' days')::interval
    LEFT JOIN shopi_order_items oi ON p.product_id = oi.product_id
    GROUP BY p.product_id, p.title
    ORDER BY return_rate_pct DESC, returns_count DESC
    LIMIT 5;
  `;

  const [sumRes, reasonsRes, topRetRes] = await Promise.all([
    client.query(summaryQuery, [days]),
    client.query(reasonsQuery, [days]),
    client.query(topReturnedQuery, [days])
  ]);

  const summary = sumRes.rows[0];
  const totalItems = parseInt(summary.total_items || '0', 10);
  const totalReturns = parseInt(summary.total_returns || '0', 10);
  const returnRate = totalItems > 0 ? parseFloat(((totalReturns / totalItems) * 100).toFixed(2)) : 0;

  return {
    totalDeliveredItems: totalItems,
    totalReturnedItems: totalReturns,
    overallReturnRatePct: returnRate,
    totalRefundAmount: parseFloat(summary.total_refunds || '0'),
    reasonBreakdown: reasonsRes.rows.map((r: any) => ({
      reason: r.reason,
      count: parseInt(r.count, 10),
      totalRefundAmount: parseFloat(r.total_refund_amount || '0'),
      percentageOfReturns: parseFloat(r.percentage || '0')
    })),
    highestReturnProducts: topRetRes.rows.map((r: any) => ({
      productId: parseInt(r.product_id, 10),
      title: r.title,
      unitsSold: parseInt(r.units_sold || '0', 10),
      returnsCount: parseInt(r.returns_count || '0', 10),
      returnRatePct: parseFloat(r.return_rate_pct || '0'),
      refundAmount: parseFloat(r.refund_amount || '0')
    }))
  };
}

/**
 * Returns cancellation analytics from canonical shopi_orders
 */
export async function getCancellationAnalytics(period: string = 'last_12_months'): Promise<CancellationAnalyticsResult> {
  const days = parseDays(period);

  const summaryQuery = `
    SELECT 
      COUNT(CASE WHEN order_status NOT IN ('Cancelled', 'CANCELLED') THEN 1 END)::int as completed_orders,
      COUNT(CASE WHEN order_status IN ('Cancelled', 'CANCELLED') THEN 1 END)::int as total_cancels
    FROM shopi_orders
    WHERE order_placed_at >= CURRENT_DATE - ($1 || ' days')::interval;
  `;

  const sumRes = await client.query(summaryQuery, [days]);
  const summary = sumRes.rows[0];
  const completedOrders = parseInt(summary.completed_orders || '0', 10);
  const totalCancels = parseInt(summary.total_cancels || '0', 10);
  const totalOrders = completedOrders + totalCancels;
  const cancelRate = totalOrders > 0 ? parseFloat(((totalCancels / totalOrders) * 100).toFixed(2)) : 0;

  return {
    totalOrders,
    totalCancellations: totalCancels,
    cancellationRatePct: cancelRate,
    reasonBreakdown: [
      {
        reason: 'Customer Requested Cancellation',
        count: totalCancels,
        percentageOfCancels: totalCancels > 0 ? 100 : 0
      }
    ]
  };
}
