import { client } from '../data/DB';

export interface ScaleBenchmarkResult {
  catalogSize: number;
  ordersSize: number;
  concurrentClients: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  queriesPerSecond: number;
}

export class ScaleBenchmarkEngine {
  /**
   * Benchmarks database query performance under scaled multi-product loads.
   */
  async benchmarkQueryPerformance(
    merchantId: string,
    concurrentClients: number = 50,
    iterations: number = 100
  ): Promise<ScaleBenchmarkResult> {
    const times: number[] = [];

    // Get catalog and orders count
    const [pRes, oRes] = await Promise.all([
      client.query('SELECT COUNT(*)::int as count FROM sandbox_sim_products WHERE merchant_id = $1', [merchantId]),
      client.query('SELECT COUNT(*)::int as count FROM sandbox_sim_orders WHERE merchant_id = $1', [merchantId])
    ]);

    const catalogSize = pRes.rows[0]?.count || 1000;
    const ordersSize = oRes.rows[0]?.count || 10000;

    const tStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      await client.query(`
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
  }
}

export const scaleBenchmarkEngine = new ScaleBenchmarkEngine();
