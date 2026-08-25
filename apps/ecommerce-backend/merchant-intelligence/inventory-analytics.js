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
exports.getLowStockProducts = getLowStockProducts;
exports.getInventoryVelocity = getInventoryVelocity;
const DB_1 = require("../data/DB");
/**
 * Returns products with low stock levels below or near threshold
 */
function getLowStockProducts() {
    return __awaiter(this, arguments, void 0, function* (threshold = 100) {
        const query = `
    WITH recent_velocity AS (
      SELECT 
        productid,
        ROUND(AVG(units_sold), 2) as daily_vel_7d
      FROM merchant_product_daily_metrics
      WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY productid
    )
    SELECT 
      p.productid as product_id,
      p.title,
      COALESCE(c.name, 'General') as category_name,
      p.stock as current_stock,
      COALESCE(v.daily_vel_7d, 0.5)::numeric(8,2) as daily_vel_7d
    FROM products p
    LEFT JOIN categories c ON p.categoryid = c.categoryid
    LEFT JOIN recent_velocity v ON p.productid = v.productid
    WHERE p.stock <= $1
    ORDER BY p.stock ASC;
  `;
        const res = yield DB_1.client.query(query, [threshold]);
        return res.rows.map((r) => {
            const stock = parseInt(r.current_stock, 10);
            const vel = parseFloat(r.daily_vel_7d) || 0.5;
            const daysRemaining = vel > 0 ? Math.max(0, Math.round(stock / vel)) : null;
            let urgency = 'HEALTHY';
            if (daysRemaining !== null && daysRemaining <= 14)
                urgency = 'CRITICAL';
            else if (daysRemaining !== null && daysRemaining <= 30)
                urgency = 'WARNING';
            const recommendedUnits = Math.max(100, Math.round(vel * 45) - stock); // 45-day target buffer
            return {
                productId: parseInt(r.product_id, 10),
                title: r.title,
                categoryName: r.category_name,
                currentStock: stock,
                threshold,
                dailyVelocity7d: vel,
                estimatedDaysRemaining: daysRemaining,
                restockRecommendedUnits: recommendedUnits > 0 ? recommendedUnits : 0,
                urgency
            };
        });
    });
}
/**
 * Calculates turnover rate, sales velocity, and stockout risks per product
 */
function getInventoryVelocity() {
    return __awaiter(this, arguments, void 0, function* (period = 'last_30_days') {
        const days = period.includes('7') ? 7 : period.includes('90') ? 90 : 30;
        const query = `
    SELECT 
      p.productid as product_id,
      p.title,
      COALESCE(c.name, 'General') as category_name,
      p.stock as current_stock,
      COALESCE(SUM(m.units_sold), 0)::int as total_sold,
      ROUND(COALESCE(SUM(m.units_sold), 0)::numeric / $1::numeric, 2)::numeric(8,2) as daily_velocity
    FROM products p
    LEFT JOIN categories c ON p.categoryid = c.categoryid
    LEFT JOIN merchant_product_daily_metrics m 
      ON p.productid = m.productid AND m.metric_date >= CURRENT_DATE - ($1 || ' days')::interval
    GROUP BY p.productid, p.title, c.name, p.stock
    ORDER BY daily_velocity DESC;
  `;
        const res = yield DB_1.client.query(query, [days]);
        return res.rows.map((r) => {
            const stock = parseInt(r.current_stock, 10);
            const sold = parseInt(r.total_sold, 10);
            const dailyVel = parseFloat(r.daily_velocity);
            const avgStock = stock + sold / 2;
            const turnover = avgStock > 0 ? parseFloat((sold / avgStock).toFixed(2)) : 0;
            let risk = 'LOW';
            if (dailyVel > 0 && (stock / dailyVel) < 15)
                risk = 'HIGH';
            else if (dailyVel > 0 && (stock / dailyVel) < 30)
                risk = 'MEDIUM';
            return {
                productId: parseInt(r.product_id, 10),
                title: r.title,
                categoryName: r.category_name,
                currentStock: stock,
                totalSoldInPeriod: sold,
                dailySalesVelocity: dailyVel,
                turnoverRate: turnover,
                stockoutRisk: risk
            };
        });
    });
}
