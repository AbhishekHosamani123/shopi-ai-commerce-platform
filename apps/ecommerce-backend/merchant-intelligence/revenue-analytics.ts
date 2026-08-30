import { client } from '../data/DB';

export interface RevenueSummaryResult {
  period: string;
  startDate: string;
  endDate: string;
  grossRevenue: number;
  totalDiscounts: number;
  totalRefunds: number;
  netRevenue: number;
  totalOrders: number;
  unitsSold: number;
  averageOrderValue: number;
}

export interface SalesTrendDataPoint {
  date: string;
  orders: number;
  unitsSold: number;
  grossRevenue: number;
  netRevenue: number;
  averageOrderValue: number;
}

export interface PeriodComparisonResult {
  currentPeriod: {
    label: string;
    revenue: number;
    orders: number;
    unitsSold: number;
    averageOrderValue: number;
  };
  previousPeriod: {
    label: string;
    revenue: number;
    orders: number;
    unitsSold: number;
    averageOrderValue: number;
  };
  growth: {
    revenueChangePct: number | null;
    ordersChangePct: number | null;
    unitsChangePct: number | null;
    aovChangePct: number | null;
    isComparable: boolean;
    growthStatus: 'NORMAL' | 'NO_COMPARABLE_BASELINE';
    absoluteRevenueChange: number;
    absoluteOrdersChange: number;
    absoluteUnitsChange: number;
  };
}

function calculateMetricGrowth(current: number, previous: number) {
  if (previous <= 0) {
    return {
      changePct: null,
      isComparable: false,
      growthStatus: 'NO_COMPARABLE_BASELINE' as const,
      absoluteChange: Math.round((current - previous) * 100) / 100
    };
  }
  return {
    changePct: parseFloat((((current - previous) / previous) * 100).toFixed(2)),
    isComparable: true,
    growthStatus: 'NORMAL' as const,
    absoluteChange: Math.round((current - previous) * 100) / 100
  };
}

export function parsePeriodClause(period: string = 'last_30_days'): { days: number; label: string } {
  switch (period.toLowerCase()) {
    case 'last_7_days':
    case '7d':
      return { days: 7, label: 'Last 7 Days' };
    case 'last_30_days':
    case '30d':
      return { days: 30, label: 'Last 30 Days' };
    case 'last_90_days':
    case '90d':
      return { days: 90, label: 'Last 90 Days' };
    case 'last_12_months':
    case '12m':
    case 'all':
      return { days: 365, label: 'Last 12 Months' };
    default:
      return { days: 30, label: 'Last 30 Days' };
  }
}

/**
 * Returns overall store financial summary from canonical shopi_orders & shopi_order_items
 */
export async function getRevenueSummary(period: string = 'last_30_days'): Promise<RevenueSummaryResult> {
  const { days, label } = parsePeriodClause(period);

  const query = `
    WITH period_orders AS (
      SELECT 
        o.order_id,
        o.subtotal_amount,
        o.discount_amount,
        o.total_amount,
        o.order_placed_at
      FROM shopi_orders o
      WHERE o.order_placed_at >= CURRENT_DATE - ($1 || ' days')::interval
        AND o.order_status NOT IN ('CANCELLED', 'Cancelled')
    ),
    period_items AS (
      SELECT 
        COALESCE(SUM(oi.quantity), 0)::int as units_sold
      FROM shopi_order_items oi
      JOIN period_orders po ON oi.order_id = po.order_id
    ),
    period_refunds AS (
      SELECT 
        COALESCE(SUM(r.refund_amount), 0)::numeric(14,2) as total_refunds
      FROM shopi_order_returns r
      WHERE r.created_at >= CURRENT_DATE - ($1 || ' days')::interval
    )
    SELECT 
      MIN(po.order_placed_at)::date::text as start_date,
      MAX(po.order_placed_at)::date::text as end_date,
      COALESCE(SUM(po.subtotal_amount), 0)::numeric(14,2) as gross_revenue,
      COALESCE(SUM(po.discount_amount), 0)::numeric(14,2) as total_discounts,
      (SELECT total_refunds FROM period_refunds) as total_refunds,
      COALESCE(SUM(po.total_amount), 0)::numeric(14,2) as net_revenue,
      COUNT(po.order_id)::int as total_orders,
      (SELECT units_sold FROM period_items) as units_sold,
      ROUND(COALESCE(SUM(po.total_amount) / NULLIF(COUNT(po.order_id), 0), 0), 2)::numeric(12,2) as aov
    FROM period_orders po;
  `;

  const res = await client.query(query, [days]);
  const row = res.rows[0];

  return {
    period: label,
    startDate: row.start_date || new Date(Date.now() - days * 86400000).toISOString().split('T')[0],
    endDate: row.end_date || new Date().toISOString().split('T')[0],
    grossRevenue: parseFloat(row.gross_revenue || '0'),
    totalDiscounts: parseFloat(row.total_discounts || '0'),
    totalRefunds: parseFloat(row.total_refunds || '0'),
    netRevenue: parseFloat(row.net_revenue || '0'),
    totalOrders: parseInt(row.total_orders || '0', 10),
    unitsSold: parseInt(row.units_sold || '0', 10),
    averageOrderValue: parseFloat(row.aov || '0')
  };
}

/**
 * Returns sales trend grouped by day, week, or month from canonical shopi_orders
 * Automatically fills missing continuous calendar dates to ensure seamless chronological trajectories.
 */
export async function getSalesTrend(
  period: string = 'last_30_days',
  interval: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<SalesTrendDataPoint[]> {
  const { days } = parsePeriodClause(period);

  let dateTrunc = 'day';
  if (interval === 'weekly') dateTrunc = 'week';
  if (interval === 'monthly') dateTrunc = 'month';

  const query = `
    WITH daily_orders AS (
      SELECT 
        DATE_TRUNC('${dateTrunc}', o.order_placed_at)::date::text as date_key,
        o.order_id,
        o.subtotal_amount,
        o.total_amount
      FROM shopi_orders o
      WHERE o.order_placed_at >= CURRENT_DATE - ($1 || ' days')::interval
        AND o.order_status NOT IN ('CANCELLED', 'Cancelled')
    ),
    daily_items AS (
      SELECT 
        DATE_TRUNC('${dateTrunc}', o2.order_placed_at)::date::text as date_key,
        COALESCE(SUM(oi.quantity), 0)::int as units_sold
      FROM shopi_order_items oi
      JOIN shopi_orders o2 ON oi.order_id = o2.order_id
      WHERE o2.order_placed_at >= CURRENT_DATE - ($1 || ' days')::interval
        AND o2.order_status NOT IN ('CANCELLED', 'Cancelled')
      GROUP BY DATE_TRUNC('${dateTrunc}', o2.order_placed_at)
    )
    SELECT 
      d.date_key as date,
      COUNT(d.order_id)::int as orders,
      COALESCE(i.units_sold, 0)::int as units_sold,
      COALESCE(SUM(d.subtotal_amount), 0)::numeric(14,2) as gross_revenue,
      COALESCE(SUM(d.total_amount), 0)::numeric(14,2) as net_revenue,
      ROUND(COALESCE(SUM(d.total_amount) / NULLIF(COUNT(d.order_id), 0), 0), 2)::numeric(12,2) as average_order_value
    FROM daily_orders d
    LEFT JOIN daily_items i ON d.date_key = i.date_key
    GROUP BY d.date_key, i.units_sold
    ORDER BY date ASC;
  `;

  const res = await client.query(query, [days]);
  const activeMap = new Map<string, any>();
  for (const r of res.rows) {
    activeMap.set(r.date, r);
  }

  // Generate continuous series for the timeline window
  const results: SalesTrendDataPoint[] = [];
  if (interval === 'daily') {
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const dateKey = d.toISOString().split('T')[0];
      const existing = activeMap.get(dateKey);
      if (existing) {
        results.push({
          date: existing.date,
          orders: parseInt(existing.orders, 10),
          unitsSold: parseInt(existing.units_sold, 10),
          grossRevenue: parseFloat(existing.gross_revenue),
          netRevenue: parseFloat(existing.net_revenue),
          averageOrderValue: parseFloat(existing.average_order_value)
        });
      } else {
        results.push({
          date: dateKey,
          orders: 0,
          unitsSold: 0,
          grossRevenue: 0,
          netRevenue: 0,
          averageOrderValue: 0
        });
      }
    }
    return results;
  }

  // For weekly/monthly, return aggregated records
  return res.rows.map((r: any) => ({
    date: r.date,
    orders: parseInt(r.orders, 10),
    unitsSold: parseInt(r.units_sold, 10),
    grossRevenue: parseFloat(r.gross_revenue),
    netRevenue: parseFloat(r.net_revenue),
    averageOrderValue: parseFloat(r.average_order_value)
  }));
}

/**
 * Compares current 30 days with previous 30 days (Month over Month)
 * Handles zero-revenue baseline mathematically without generating fabricated growth percentages.
 */
export async function getMonthOverMonthComparison(): Promise<PeriodComparisonResult> {
  const query = `
    WITH current_30_orders AS (
      SELECT 
        o.order_id,
        o.subtotal_amount,
        o.total_amount
      FROM shopi_orders o
      WHERE o.order_placed_at >= CURRENT_DATE - INTERVAL '30 days'
        AND o.order_status NOT IN ('CANCELLED', 'Cancelled')
    ),
    current_30_items AS (
      SELECT COALESCE(SUM(oi.quantity), 0)::int as units
      FROM shopi_order_items oi
      JOIN current_30_orders co ON oi.order_id = co.order_id
    ),
    previous_30_orders AS (
      SELECT 
        o.order_id,
        o.subtotal_amount,
        o.total_amount
      FROM shopi_orders o
      WHERE o.order_placed_at >= CURRENT_DATE - INTERVAL '60 days' 
        AND o.order_placed_at < CURRENT_DATE - INTERVAL '30 days'
        AND o.order_status NOT IN ('CANCELLED', 'Cancelled')
    ),
    previous_30_items AS (
      SELECT COALESCE(SUM(oi.quantity), 0)::int as units
      FROM shopi_order_items oi
      JOIN previous_30_orders po ON oi.order_id = po.order_id
    )
    SELECT 
      COALESCE((SELECT SUM(subtotal_amount) FROM current_30_orders), 0)::numeric(14,2) as cur_rev,
      COALESCE((SELECT COUNT(*) FROM current_30_orders), 0)::int as cur_ord,
      (SELECT units FROM current_30_items) as cur_units,
      ROUND(COALESCE((SELECT SUM(total_amount) FROM current_30_orders) / NULLIF((SELECT COUNT(*) FROM current_30_orders), 0), 0), 2)::numeric(12,2) as cur_aov,

      COALESCE((SELECT SUM(subtotal_amount) FROM previous_30_orders), 0)::numeric(14,2) as prev_rev,
      COALESCE((SELECT COUNT(*) FROM previous_30_orders), 0)::int as prev_ord,
      (SELECT units FROM previous_30_items) as prev_units,
      ROUND(COALESCE((SELECT SUM(total_amount) FROM previous_30_orders) / NULLIF((SELECT COUNT(*) FROM previous_30_orders), 0), 0), 2)::numeric(12,2) as prev_aov;
  `;

  const res = await client.query(query);
  const row = res.rows[0];

  const curRev = parseFloat(row.cur_rev || '0');
  const prevRev = parseFloat(row.prev_rev || '0');
  const curOrd = parseInt(row.cur_ord || '0', 10);
  const prevOrd = parseInt(row.prev_ord || '0', 10);
  const curUnits = parseInt(row.cur_units || '0', 10);
  const prevUnits = parseInt(row.prev_units || '0', 10);
  const curAov = parseFloat(row.cur_aov || '0');
  const prevAov = parseFloat(row.prev_aov || '0');

  const revGrowth = calculateMetricGrowth(curRev, prevRev);
  const ordGrowth = calculateMetricGrowth(curOrd, prevOrd);
  const unitsGrowth = calculateMetricGrowth(curUnits, prevUnits);
  const aovGrowth = calculateMetricGrowth(curAov, prevAov);

  return {
    currentPeriod: {
      label: 'Last 30 Days',
      revenue: curRev,
      orders: curOrd,
      unitsSold: curUnits,
      averageOrderValue: curAov
    },
    previousPeriod: {
      label: 'Preceding 30 Days (T-30 to T-60)',
      revenue: prevRev,
      orders: prevOrd,
      unitsSold: prevUnits,
      averageOrderValue: prevAov
    },
    growth: {
      revenueChangePct: revGrowth.changePct,
      ordersChangePct: ordGrowth.changePct,
      unitsChangePct: unitsGrowth.changePct,
      aovChangePct: aovGrowth.changePct,
      isComparable: revGrowth.isComparable,
      growthStatus: revGrowth.growthStatus,
      absoluteRevenueChange: revGrowth.absoluteChange,
      absoluteOrdersChange: ordGrowth.absoluteChange,
      absoluteUnitsChange: unitsGrowth.absoluteChange
    }
  };
}

/**
 * Compares current 7 days with previous 7 days (Week over Week)
 * Handles zero-revenue baseline mathematically without generating fabricated growth percentages.
 */
export async function getWeekOverWeekComparison(): Promise<PeriodComparisonResult> {
  const query = `
    WITH current_7_orders AS (
      SELECT 
        o.order_id,
        o.subtotal_amount,
        o.total_amount
      FROM shopi_orders o
      WHERE o.order_placed_at >= CURRENT_DATE - INTERVAL '7 days'
        AND o.order_status NOT IN ('CANCELLED', 'Cancelled')
    ),
    current_7_items AS (
      SELECT COALESCE(SUM(oi.quantity), 0)::int as units
      FROM shopi_order_items oi
      JOIN current_7_orders co ON oi.order_id = co.order_id
    ),
    previous_7_orders AS (
      SELECT 
        o.order_id,
        o.subtotal_amount,
        o.total_amount
      FROM shopi_orders o
      WHERE o.order_placed_at >= CURRENT_DATE - INTERVAL '14 days' 
        AND o.order_placed_at < CURRENT_DATE - INTERVAL '7 days'
        AND o.order_status NOT IN ('CANCELLED', 'Cancelled')
    ),
    previous_7_items AS (
      SELECT COALESCE(SUM(oi.quantity), 0)::int as units
      FROM shopi_order_items oi
      JOIN previous_7_orders po ON oi.order_id = po.order_id
    )
    SELECT 
      COALESCE((SELECT SUM(subtotal_amount) FROM current_7_orders), 0)::numeric(14,2) as cur_rev,
      COALESCE((SELECT COUNT(*) FROM current_7_orders), 0)::int as cur_ord,
      (SELECT units FROM current_7_items) as cur_units,
      ROUND(COALESCE((SELECT SUM(total_amount) FROM current_7_orders) / NULLIF((SELECT COUNT(*) FROM current_7_orders), 0), 0), 2)::numeric(12,2) as cur_aov,

      COALESCE((SELECT SUM(subtotal_amount) FROM previous_7_orders), 0)::numeric(14,2) as prev_rev,
      COALESCE((SELECT COUNT(*) FROM previous_7_orders), 0)::int as prev_ord,
      (SELECT units FROM previous_7_items) as prev_units,
      ROUND(COALESCE((SELECT SUM(total_amount) FROM previous_7_orders) / NULLIF((SELECT COUNT(*) FROM previous_7_orders), 0), 0), 2)::numeric(12,2) as prev_aov;
  `;

  const res = await client.query(query);
  const row = res.rows[0];

  const curRev = parseFloat(row.cur_rev || '0');
  const prevRev = parseFloat(row.prev_rev || '0');
  const curOrd = parseInt(row.cur_ord || '0', 10);
  const prevOrd = parseInt(row.prev_ord || '0', 10);
  const curUnits = parseInt(row.cur_units || '0', 10);
  const prevUnits = parseInt(row.prev_units || '0', 10);
  const curAov = parseFloat(row.cur_aov || '0');
  const prevAov = parseFloat(row.prev_aov || '0');

  const revGrowth = calculateMetricGrowth(curRev, prevRev);
  const ordGrowth = calculateMetricGrowth(curOrd, prevOrd);
  const unitsGrowth = calculateMetricGrowth(curUnits, prevUnits);
  const aovGrowth = calculateMetricGrowth(curAov, prevAov);

  return {
    currentPeriod: {
      label: 'Last 7 Days',
      revenue: curRev,
      orders: curOrd,
      unitsSold: curUnits,
      averageOrderValue: curAov
    },
    previousPeriod: {
      label: 'Preceding 7 Days (T-7 to T-14)',
      revenue: prevRev,
      orders: prevOrd,
      unitsSold: prevUnits,
      averageOrderValue: prevAov
    },
    growth: {
      revenueChangePct: revGrowth.changePct,
      ordersChangePct: ordGrowth.changePct,
      unitsChangePct: unitsGrowth.changePct,
      aovChangePct: aovGrowth.changePct,
      isComparable: revGrowth.isComparable,
      growthStatus: revGrowth.growthStatus,
      absoluteRevenueChange: revGrowth.absoluteChange,
      absoluteOrdersChange: ordGrowth.absoluteChange,
      absoluteUnitsChange: unitsGrowth.absoluteChange
    }
  };
}
