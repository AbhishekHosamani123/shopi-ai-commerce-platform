"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRevenueSummary = getRevenueSummary;
exports.getSalesTrend = getSalesTrend;
exports.getMonthOverMonthComparison = getMonthOverMonthComparison;
exports.getWeekOverWeekComparison = getWeekOverWeekComparison;
const DB_1 = require("../data/DB");
function parsePeriodClause(period = 'last_30_days') {
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
 * Returns overall store financial summary from PostgreSQL
 */
function getRevenueSummary() {
    return __awaiter(this, arguments, void 0, function* (period = 'last_30_days') {
        const { days, label } = parsePeriodClause(period);
        const query = `
    SELECT 
      MIN(metric_date)::text as start_date,
      MAX(metric_date)::text as end_date,
      COALESCE(SUM(gross_revenue), 0)::numeric(14,2) as gross_revenue,
      COALESCE(SUM(total_discounts), 0)::numeric(14,2) as total_discounts,
      COALESCE(SUM(total_refunds), 0)::numeric(14,2) as total_refunds,
      COALESCE(SUM(net_revenue), 0)::numeric(14,2) as net_revenue,
      COALESCE(SUM(total_orders), 0)::int as total_orders,
      COALESCE(SUM(total_units_sold), 0)::int as units_sold,
      ROUND(COALESCE(SUM(gross_revenue) / NULLIF(SUM(total_orders), 0), 0), 2)::numeric(12,2) as aov
    FROM merchant_daily_metrics
    WHERE metric_date >= CURRENT_DATE - ($1 || ' days')::interval;
  `;
        const res = yield DB_1.client.query(query, [days]);
        const row = res.rows[0];
        return {
            period: label,
            startDate: row.start_date || new Date(Date.now() - days * 86400000).toISOString().split('T')[0],
            endDate: row.end_date || new Date().toISOString().split('T')[0],
            grossRevenue: parseFloat(row.gross_revenue),
            totalDiscounts: parseFloat(row.total_discounts),
            totalRefunds: parseFloat(row.total_refunds),
            netRevenue: parseFloat(row.net_revenue),
            totalOrders: parseInt(row.total_orders, 10),
            unitsSold: parseInt(row.units_sold, 10),
            averageOrderValue: parseFloat(row.aov)
        };
    });
}
/**
 * Returns sales trend grouped by day, week, or month
 */
function getSalesTrend() {
    return __awaiter(this, arguments, void 0, function* (period = 'last_30_days', interval = 'daily') {
        const { days } = parsePeriodClause(period);
        let dateTrunc = 'day';
        if (interval === 'weekly')
            dateTrunc = 'week';
        if (interval === 'monthly')
            dateTrunc = 'month';
        const query = `
    SELECT 
      DATE_TRUNC('${dateTrunc}', metric_date)::date::text as date,
      SUM(total_orders)::int as orders,
      SUM(total_units_sold)::int as units_sold,
      SUM(gross_revenue)::numeric(14,2) as gross_revenue,
      SUM(net_revenue)::numeric(14,2) as net_revenue,
      ROUND(SUM(gross_revenue) / NULLIF(SUM(total_orders), 0), 2)::numeric(12,2) as average_order_value
    FROM merchant_daily_metrics
    WHERE metric_date >= CURRENT_DATE - ($1 || ' days')::interval
    GROUP BY DATE_TRUNC('${dateTrunc}', metric_date)
    ORDER BY date ASC;
  `;
        const res = yield DB_1.client.query(query, [days]);
        return res.rows.map((r) => ({
            date: r.date,
            orders: parseInt(r.orders, 10),
            unitsSold: parseInt(r.units_sold, 10),
            grossRevenue: parseFloat(r.gross_revenue),
            netRevenue: parseFloat(r.net_revenue),
            averageOrderValue: parseFloat(r.average_order_value)
        }));
    });
}
/**
 * Compares current 30 days with previous 30 days (Month over Month)
 */
function getMonthOverMonthComparison() {
    return __awaiter(this, void 0, void 0, function* () {
        const query = `
    WITH current_30 AS (
      SELECT 
        COALESCE(SUM(gross_revenue), 0) as rev,
        COALESCE(SUM(total_orders), 0) as ord,
        COALESCE(SUM(total_units_sold), 0) as units,
        ROUND(COALESCE(SUM(gross_revenue) / NULLIF(SUM(total_orders), 0), 0), 2) as aov
      FROM merchant_daily_metrics
      WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days' AND metric_date <= CURRENT_DATE
    ),
    previous_30 AS (
      SELECT 
        COALESCE(SUM(gross_revenue), 0) as rev,
        COALESCE(SUM(total_orders), 0) as ord,
        COALESCE(SUM(total_units_sold), 0) as units,
        ROUND(COALESCE(SUM(gross_revenue) / NULLIF(SUM(total_orders), 0), 0), 2) as aov
      FROM merchant_daily_metrics
      WHERE metric_date >= CURRENT_DATE - INTERVAL '60 days' AND metric_date < CURRENT_DATE - INTERVAL '30 days'
    )
    SELECT 
      c.rev as cur_rev, c.ord as cur_ord, c.units as cur_units, c.aov as cur_aov,
      p.rev as prev_rev, p.ord as prev_ord, p.units as prev_units, p.aov as prev_aov
    FROM current_30 c, previous_30 p;
  `;
        const res = yield DB_1.client.query(query);
        const row = res.rows[0];
        const curRev = parseFloat(row.cur_rev);
        const prevRev = parseFloat(row.prev_rev);
        const curOrd = parseInt(row.cur_ord, 10);
        const prevOrd = parseInt(row.prev_ord, 10);
        const curUnits = parseInt(row.cur_units, 10);
        const prevUnits = parseInt(row.prev_units, 10);
        const curAov = parseFloat(row.cur_aov);
        const prevAov = parseFloat(row.prev_aov);
        const revChange = prevRev > 0 ? parseFloat((((curRev - prevRev) / prevRev) * 100).toFixed(2)) : 0;
        const ordChange = prevOrd > 0 ? parseFloat((((curOrd - prevOrd) / prevOrd) * 100).toFixed(2)) : 0;
        const unitsChange = prevUnits > 0 ? parseFloat((((curUnits - prevUnits) / prevUnits) * 100).toFixed(2)) : 0;
        const aovChange = prevAov > 0 ? parseFloat((((curAov - prevAov) / prevAov) * 100).toFixed(2)) : 0;
        return {
            currentPeriod: {
                label: 'Last 30 Days',
                revenue: curRev,
                orders: curOrd,
                unitsSold: curUnits,
                averageOrderValue: curAov
            },
            previousPeriod: {
                label: 'Previous 30 Days (Prior Period)',
                revenue: prevRev,
                orders: prevOrd,
                unitsSold: prevUnits,
                averageOrderValue: prevAov
            },
            growth: {
                revenueChangePct: revChange,
                ordersChangePct: ordChange,
                unitsChangePct: unitsChange,
                aovChangePct: aovChange
            }
        };
    });
}
/**
 * Compares current 7 days with previous 7 days (Week over Week)
 */
function getWeekOverWeekComparison() {
    return __awaiter(this, void 0, void 0, function* () {
        const query = `
    WITH current_7 AS (
      SELECT 
        COALESCE(SUM(gross_revenue), 0) as rev,
        COALESCE(SUM(total_orders), 0) as ord,
        COALESCE(SUM(total_units_sold), 0) as units,
        ROUND(COALESCE(SUM(gross_revenue) / NULLIF(SUM(total_orders), 0), 0), 2) as aov
      FROM merchant_daily_metrics
      WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days' AND metric_date <= CURRENT_DATE
    ),
    previous_7 AS (
      SELECT 
        COALESCE(SUM(gross_revenue), 0) as rev,
        COALESCE(SUM(total_orders), 0) as ord,
        COALESCE(SUM(total_units_sold), 0) as units,
        ROUND(COALESCE(SUM(gross_revenue) / NULLIF(SUM(total_orders), 0), 0), 2) as aov
      FROM merchant_daily_metrics
      WHERE metric_date >= CURRENT_DATE - INTERVAL '14 days' AND metric_date < CURRENT_DATE - INTERVAL '7 days'
    )
    SELECT 
      c.rev as cur_rev, c.ord as cur_ord, c.units as cur_units, c.aov as cur_aov,
      p.rev as prev_rev, p.ord as prev_ord, p.units as prev_units, p.aov as prev_aov
    FROM current_7 c, previous_7 p;
  `;
        const res = yield DB_1.client.query(query);
        const row = res.rows[0];
        const curRev = parseFloat(row.cur_rev);
        const prevRev = parseFloat(row.prev_rev);
        const curOrd = parseInt(row.cur_ord, 10);
        const prevOrd = parseInt(row.prev_ord, 10);
        const curUnits = parseInt(row.cur_units, 10);
        const prevUnits = parseInt(row.prev_units, 10);
        const curAov = parseFloat(row.cur_aov);
        const prevAov = parseFloat(row.prev_aov);
        const revChange = prevRev > 0 ? parseFloat((((curRev - prevRev) / prevRev) * 100).toFixed(2)) : 0;
        const ordChange = prevOrd > 0 ? parseFloat((((curOrd - prevOrd) / prevOrd) * 100).toFixed(2)) : 0;
        const unitsChange = prevUnits > 0 ? parseFloat((((curUnits - prevUnits) / prevUnits) * 100).toFixed(2)) : 0;
        const aovChange = prevAov > 0 ? parseFloat((((curAov - prevAov) / prevAov) * 100).toFixed(2)) : 0;
        return {
            currentPeriod: {
                label: 'Last 7 Days',
                revenue: curRev,
                orders: curOrd,
                unitsSold: curUnits,
                averageOrderValue: curAov
            },
            previousPeriod: {
                label: 'Previous 7 Days (Prior Period)',
                revenue: prevRev,
                orders: prevOrd,
                unitsSold: prevUnits,
                averageOrderValue: prevAov
            },
            growth: {
                revenueChangePct: revChange,
                ordersChangePct: ordChange,
                unitsChangePct: unitsChange,
                aovChangePct: aovChange
            }
        };
    });
}
