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
exports.getReturnAnalytics = getReturnAnalytics;
exports.getCancellationAnalytics = getCancellationAnalytics;
const DB_1 = require("../data/DB");
function parseDays(period = 'last_12_months') {
    if (period.includes('7'))
        return 7;
    if (period.includes('30'))
        return 30;
    if (period.includes('90'))
        return 90;
    return 365;
}
/**
 * Returns complete return analytics, reason distribution, and high-return items
 */
function getReturnAnalytics() {
    return __awaiter(this, arguments, void 0, function* (period = 'last_12_months') {
        const days = parseDays(period);
        const summaryQuery = `
    SELECT 
      (SELECT COUNT(*)::int FROM orderitems oi JOIN orders o ON oi.orderid = o.orderid WHERE o.createdat >= CURRENT_DATE - ($1 || ' days')::interval) as total_items,
      COUNT(r.return_id)::int as total_returns,
      COALESCE(SUM(r.refund_amount), 0)::numeric(14,2) as total_refunds
    FROM order_returns r
    WHERE r.createdat >= CURRENT_DATE - ($1 || ' days')::interval;
  `;
        const reasonsQuery = `
    WITH total_ret AS (
      SELECT COUNT(*)::numeric as grand_total 
      FROM order_returns 
      WHERE createdat >= CURRENT_DATE - ($1 || ' days')::interval
    )
    SELECT 
      return_reason as reason,
      COUNT(*)::int as count,
      SUM(refund_amount)::numeric(12,2) as total_refund_amount,
      ROUND((COUNT(*)::numeric / NULLIF((SELECT grand_total FROM total_ret), 0)) * 100, 2) as percentage
    FROM order_returns
    WHERE createdat >= CURRENT_DATE - ($1 || ' days')::interval
    GROUP BY return_reason
    ORDER BY count DESC;
  `;
        const topReturnedQuery = `
    SELECT 
      p.productid as product_id,
      p.title,
      COALESCE(SUM(m.units_sold), 0)::int as units_sold,
      COALESCE(SUM(m.returns_count), 0)::int as returns_count,
      ROUND(
        (COALESCE(SUM(m.returns_count), 0)::numeric / NULLIF(SUM(m.units_sold), 0)::numeric) * 100, 
        2
      ) as return_rate_pct,
      COALESCE(SUM(m.refund_amount), 0)::numeric(12,2) as refund_amount
    FROM products p
    JOIN merchant_product_daily_metrics m ON p.productid = m.productid
    WHERE m.metric_date >= CURRENT_DATE - ($1 || ' days')::interval
    GROUP BY p.productid, p.title
    HAVING SUM(m.returns_count) > 0
    ORDER BY return_rate_pct DESC, returns_count DESC
    LIMIT 5;
  `;
        const [sumRes, reasonsRes, topRetRes] = yield Promise.all([
            DB_1.client.query(summaryQuery, [days]),
            DB_1.client.query(reasonsQuery, [days]),
            DB_1.client.query(topReturnedQuery, [days])
        ]);
        const summary = sumRes.rows[0];
        const totalItems = parseInt(summary.total_items || '1', 10);
        const totalReturns = parseInt(summary.total_returns || '0', 10);
        const returnRate = parseFloat(((totalReturns / totalItems) * 100).toFixed(2));
        return {
            totalDeliveredItems: totalItems,
            totalReturnedItems: totalReturns,
            overallReturnRatePct: returnRate,
            totalRefundAmount: parseFloat(summary.total_refunds),
            reasonBreakdown: reasonsRes.rows.map((r) => ({
                reason: r.reason,
                count: parseInt(r.count, 10),
                totalRefundAmount: parseFloat(r.total_refund_amount),
                percentageOfReturns: parseFloat(r.percentage || '0')
            })),
            highestReturnProducts: topRetRes.rows.map((r) => ({
                productId: parseInt(r.product_id, 10),
                title: r.title,
                unitsSold: parseInt(r.units_sold, 10),
                returnsCount: parseInt(r.returns_count, 10),
                returnRatePct: parseFloat(r.return_rate_pct),
                refundAmount: parseFloat(r.refund_amount)
            }))
        };
    });
}
/**
 * Returns cancellation analytics and reason breakdown
 */
function getCancellationAnalytics() {
    return __awaiter(this, arguments, void 0, function* (period = 'last_12_months') {
        const days = parseDays(period);
        const summaryQuery = `
    SELECT 
      (SELECT COUNT(*)::int FROM orders WHERE createdat >= CURRENT_DATE - ($1 || ' days')::interval) as total_orders,
      COUNT(c.cancellation_id)::int as total_cancels
    FROM order_cancellations c
    WHERE c.cancelled_at >= CURRENT_DATE - ($1 || ' days')::interval;
  `;
        const reasonsQuery = `
    WITH total_c AS (
      SELECT COUNT(*)::numeric as grand_total 
      FROM order_cancellations 
      WHERE cancelled_at >= CURRENT_DATE - ($1 || ' days')::interval
    )
    SELECT 
      reason,
      COUNT(*)::int as count,
      ROUND((COUNT(*)::numeric / NULLIF((SELECT grand_total FROM total_c), 0)) * 100, 2) as percentage
    FROM order_cancellations
    WHERE cancelled_at >= CURRENT_DATE - ($1 || ' days')::interval
    GROUP BY reason
    ORDER BY count DESC;
  `;
        const [sumRes, reasonsRes] = yield Promise.all([
            DB_1.client.query(summaryQuery, [days]),
            DB_1.client.query(reasonsQuery, [days])
        ]);
        const summary = sumRes.rows[0];
        const totalOrders = parseInt(summary.total_orders || '1', 10);
        const totalCancels = parseInt(summary.total_cancels || '0', 10);
        const cancelRate = parseFloat(((totalCancels / totalOrders) * 100).toFixed(2));
        return {
            totalOrders,
            totalCancellations: totalCancels,
            cancellationRatePct: cancelRate,
            reasonBreakdown: reasonsRes.rows.map((r) => ({
                reason: r.reason,
                count: parseInt(r.count, 10),
                percentageOfCancels: parseFloat(r.percentage || '0')
            }))
        };
    });
}
