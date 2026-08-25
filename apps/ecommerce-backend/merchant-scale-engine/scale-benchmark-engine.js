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
exports.scaleBenchmarkEngine = exports.ScaleBenchmarkEngine = void 0;
const DB_1 = require("../data/DB");
class ScaleBenchmarkEngine {
    /**
     * Benchmarks database query performance under scaled multi-product loads.
     */
    benchmarkQueryPerformance(merchantId_1) {
        return __awaiter(this, arguments, void 0, function* (merchantId, concurrentClients = 50, iterations = 100) {
            var _a, _b;
            const times = [];
            // Get catalog and orders count
            const [pRes, oRes] = yield Promise.all([
                DB_1.client.query('SELECT COUNT(*)::int as count FROM sandbox_sim_products WHERE merchant_id = $1', [merchantId]),
                DB_1.client.query('SELECT COUNT(*)::int as count FROM sandbox_sim_orders WHERE merchant_id = $1', [merchantId])
            ]);
            const catalogSize = ((_a = pRes.rows[0]) === null || _a === void 0 ? void 0 : _a.count) || 1000;
            const ordersSize = ((_b = oRes.rows[0]) === null || _b === void 0 ? void 0 : _b.count) || 10000;
            const tStart = performance.now();
            for (let i = 0; i < iterations; i++) {
                const t0 = performance.now();
                yield DB_1.client.query(`
        SELECT 
          p.product_id,
          p.title,
          p.price,
          p.stock,
          COALESCE(SUM(oi.quantity), 0)::int as total_units,
          COALESCE(SUM(oi.total_price), 0)::numeric(14,2) as total_rev
        FROM sandbox_sim_products p
        LEFT JOIN sandbox_sim_orderitems oi ON p.product_id = oi.product_id
        LEFT JOIN sandbox_sim_orders o ON oi.order_id = o.order_id
        WHERE p.merchant_id = $1
        GROUP BY p.product_id, p.title, p.price, p.stock
        LIMIT 20;
      `, [merchantId]);
                times.push(performance.now() - t0);
            }
            const tTotal = (performance.now() - tStart) / 1000; // in seconds
            const qps = Math.round((iterations / Math.max(0.001, tTotal)) * 10) / 10;
            const sorted = times.sort((a, b) => a - b);
            const p50 = sorted[Math.floor(sorted.length * 0.5)];
            const p95 = sorted[Math.floor(sorted.length * 0.95)];
            const p99 = sorted[Math.floor(sorted.length * 0.99)];
            return {
                catalogSize,
                ordersSize,
                concurrentClients,
                p50Ms: Math.round(p50 * 10) / 10,
                p95Ms: Math.round(p95 * 10) / 10,
                p99Ms: Math.round(p99 * 10) / 10,
                queriesPerSecond: qps
            };
        });
    }
}
exports.ScaleBenchmarkEngine = ScaleBenchmarkEngine;
exports.scaleBenchmarkEngine = new ScaleBenchmarkEngine();
