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
exports.workingCapitalEngine = exports.WorkingCapitalEngine = void 0;
const DB_1 = require("../data/DB");
class WorkingCapitalEngine {
    /**
     * Evaluates capital locked in inventory, turnover velocity, and liquidity requirements.
     */
    evaluateWorkingCapital() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            var _a, _b, _c, _d, _e, _f;
            // 1. Total inventory value and units
            const invRes = yield DB_1.client.query(`
      SELECT 
        COALESCE(SUM(p.stock), 0)::int as total_units,
        COALESCE(SUM(p.stock * COALESCE(p.discount, p.price)), 0)::numeric(14,2) as total_value
      FROM products p;
    `);
            const totalCatalogUnits = ((_a = invRes.rows[0]) === null || _a === void 0 ? void 0 : _a.total_units) || 0;
            const totalInventoryCapitalValue = parseFloat((_b = invRes.rows[0]) === null || _b === void 0 ? void 0 : _b.total_value) || 0;
            // 2. Slow-moving stock (0 sales in last 60 days with stock > 10)
            const slowRes = yield DB_1.client.query(`
      SELECT 
        COALESCE(SUM(p.stock), 0)::int as slow_units,
        COALESCE(SUM(p.stock * COALESCE(p.discount, p.price)), 0)::numeric(14,2) as slow_value
      FROM products p
      WHERE p.stock > 10 AND p.productid NOT IN (
        SELECT DISTINCT oi.productid 
        FROM orderitems oi
        JOIN orders o ON oi.orderid = o.orderid
        WHERE o.createdat >= CURRENT_TIMESTAMP - INTERVAL '60 days'
      );
    `);
            const slowStockUnitsCount = ((_c = slowRes.rows[0]) === null || _c === void 0 ? void 0 : _c.slow_units) || 0;
            const capitalLockedInSlowStock = parseFloat((_d = slowRes.rows[0]) === null || _d === void 0 ? void 0 : _d.slow_value) || 0;
            // 3. 30-day sales volume for turnover & DIO calculation
            const salesRes = yield DB_1.client.query(`
      SELECT 
        COALESCE(SUM(oi.quantity * COALESCE(p.discount, p.price)), 0)::numeric(14,2) as revenue_30d
      FROM orderitems oi
      JOIN products p ON oi.productid = p.productid
      JOIN orders o ON oi.orderid = o.orderid
      WHERE o.createdat >= CURRENT_TIMESTAMP - INTERVAL '30 days';
    `);
            const monthlySales = parseFloat((_e = salesRes.rows[0]) === null || _e === void 0 ? void 0 : _e.revenue_30d) || 10000;
            const annualRunRate = monthlySales * 12;
            // DIO = (Inventory Value / Annual Run Rate) * 365
            const estimatedDaysInventoryOutstanding = annualRunRate > 0
                ? Math.round((totalInventoryCapitalValue / annualRunRate) * 365)
                : 45;
            // Turnover = Annual Run Rate / Inventory Value
            const estimatedInventoryTurnoverRatio = totalInventoryCapitalValue > 0
                ? parseFloat((annualRunRate / totalInventoryCapitalValue).toFixed(2))
                : 6.5;
            // 4. Low stock replenishment capital needed
            const restockRes = yield DB_1.client.query(`
      SELECT COALESCE(SUM((25 - p.stock) * COALESCE(p.discount, p.price)), 0)::numeric(14,2) as restock_needed
      FROM products p
      WHERE p.stock <= 10;
    `);
            const capitalRequiredImmediateRestock = parseFloat((_f = restockRes.rows[0]) === null || _f === void 0 ? void 0 : _f.restock_needed) || 0;
            const recommendations = [];
            if (capitalLockedInSlowStock > 0) {
                recommendations.push(`Clear ₹${capitalLockedInSlowStock.toLocaleString('en-IN')} locked in ${slowStockUnitsCount} slow-moving units using targeted markdown schedule.`);
            }
            if (capitalRequiredImmediateRestock > 0) {
                recommendations.push(`Allocate ₹${capitalRequiredImmediateRestock.toLocaleString('en-IN')} for critical replenishment of low-inventory lines.`);
            }
            return {
                totalInventoryCapitalValue,
                totalCatalogUnits,
                capitalLockedInSlowStock,
                slowStockUnitsCount,
                estimatedDaysInventoryOutstanding,
                estimatedInventoryTurnoverRatio,
                capitalRequiredImmediateRestock,
                cashConversionCycleNotice: 'Full cash conversion cycle unavailable because accounts payable/receivable ledgers are unconfigured.',
                recommendations
            };
        });
    }
}
exports.WorkingCapitalEngine = WorkingCapitalEngine;
exports.workingCapitalEngine = new WorkingCapitalEngine();
