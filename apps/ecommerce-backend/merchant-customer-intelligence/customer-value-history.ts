import { client } from '../data/DB';
import { ClvTrendDirection } from './clv-types';

/**
 * Tracks historical customer spend trajectory across rolling 30d/60d/90d intervals to detect value decay.
 */
export async function evaluateCustomerValueTrend(userId: number): Promise<{
  trend: ClvTrendDirection;
  spend30d: number;
  spend60d: number;
  spend90d: number;
  explanation: string;
}> {
  const query = `
    SELECT
      COALESCE(SUM(CASE WHEN createdat >= CURRENT_DATE - INTERVAL '30 days' THEN totalamount ELSE 0 END), 0)::numeric(12,2) as spend_30d,
      COALESCE(SUM(CASE WHEN createdat >= CURRENT_DATE - INTERVAL '60 days' AND createdat < CURRENT_DATE - INTERVAL '30 days' THEN totalamount ELSE 0 END), 0)::numeric(12,2) as spend_60d,
      COALESCE(SUM(CASE WHEN createdat >= CURRENT_DATE - INTERVAL '90 days' AND createdat < CURRENT_DATE - INTERVAL '60 days' THEN totalamount ELSE 0 END), 0)::numeric(12,2) as spend_90d
    FROM orders
    WHERE userid = $1;
  `;

  const res = await client.query(query, [userId]);
  const row = res.rows[0];

  const spend30d = parseFloat(row?.spend_30d || '0');
  const spend60d = parseFloat(row?.spend_60d || '0');
  const spend90d = parseFloat(row?.spend_90d || '0');

  if (spend30d > spend60d && spend60d >= spend90d) {
    return {
      trend: 'EXPANDING',
      spend30d,
      spend60d,
      spend90d,
      explanation: `Customer value is expanding: 30d spend (₹${spend30d}) grew relative to previous periods.`
    };
  }

  if (spend30d === 0 && (spend60d > 0 || spend90d > 0)) {
    return {
      trend: 'DECLINING',
      spend30d,
      spend60d,
      spend90d,
      explanation: `Customer value is declining: zero spend in the last 30 days following ₹${spend60d + spend90d} in previous 60 days.`
    };
  }

  return {
    trend: 'STABLE',
    spend30d,
    spend60d,
    spend90d,
    explanation: `Customer spend is stable over 90-day trajectory.`
  };
}
