import { client } from '../data/DB';
import { CustomerRfmSegment, CustomerGrowthSummary } from './optimization-types';

/**
 * Calculates customer RFM segmentation and identifies high-value retention opportunities.
 */
export async function getCustomerGrowthAnalysis(): Promise<CustomerGrowthSummary> {
  const query = `
    SELECT 
      c.customer_id as userid,
      COALESCE(c.first_name || ' ' || c.last_name, 'Valued Customer') as username,
      c.email,
      COUNT(o.order_id)::int as total_orders,
      COALESCE(SUM(o.total_amount), 0)::numeric(12,2) as total_spend,
      ROUND(COALESCE(AVG(o.total_amount), 0), 2)::numeric(12,2) as avg_order_value,
      MAX(o.order_placed_at) as last_order_date,
      EXTRACT(DAY FROM (NOW() - MAX(o.order_placed_at)))::int as days_since_last_order
    FROM shopi_customers c
    JOIN shopi_orders o ON c.customer_id = o.customer_id
    WHERE o.order_status NOT IN ('CANCELLED', 'Cancelled')
    GROUP BY c.customer_id, c.first_name, c.last_name, c.email
    HAVING COUNT(o.order_id) > 0
    ORDER BY total_spend DESC;
  `;

  const res = await client.query(query);
  const rows = res.rows;

  const segments: CustomerRfmSegment[] = [];
  let vipCount = 0;
  let loyalCount = 0;
  let repeatCount = 0;
  let newCount = 0;
  let atRiskCount = 0;
  let dormantCount = 0;
  let oneTimeCount = 0;

  for (const r of rows) {
    const orders = parseInt(r.total_orders, 10);
    const spend = parseFloat(r.total_spend);
    const aov = parseFloat(r.avg_order_value);
    const daysSince = parseInt(r.days_since_last_order || '0', 10);

    // RFM Scoring (1 to 5)
    let rScore = daysSince <= 14 ? 5 : daysSince <= 30 ? 4 : daysSince <= 60 ? 3 : daysSince <= 120 ? 2 : 1;
    let fScore = orders >= 5 ? 5 : orders >= 3 ? 4 : orders === 2 ? 3 : 2;
    let mScore = spend >= 15000 ? 5 : spend >= 8000 ? 4 : spend >= 3000 ? 3 : 2;

    let segment: CustomerRfmSegment['segment'] = 'ONE_TIME';

    if (orders >= 3 && spend >= 10000) {
      segment = 'VIP';
      vipCount++;
    } else if (orders >= 3) {
      segment = 'LOYAL';
      loyalCount++;
    } else if (orders === 2 && daysSince <= 60) {
      segment = 'REPEAT';
      repeatCount++;
    } else if (orders === 1 && daysSince <= 30) {
      segment = 'NEW';
      newCount++;
    } else if (orders >= 2 && daysSince > 60) {
      segment = 'AT_RISK';
      atRiskCount++;
    } else if (daysSince > 120) {
      segment = 'DORMANT';
      dormantCount++;
    } else {
      segment = 'ONE_TIME';
      oneTimeCount++;
    }

    segments.push({
      userId: r.userid,
      username: r.username,
      email: r.email,
      totalOrders: orders,
      totalSpend: spend,
      averageOrderValue: aov,
      lastOrderDate: r.last_order_date,
      daysSinceLastOrder: daysSince,
      recencyScore: rScore,
      frequencyScore: fScore,
      monetaryScore: mScore,
      segment
    });
  }

  const topAtRisk = segments
    .filter(s => s.segment === 'AT_RISK' || (s.segment === 'VIP' && s.daysSinceLastOrder > 45))
    .slice(0, 5);

  const growthOpportunities: string[] = [];
  if (atRiskCount > 0) {
    growthOpportunities.push(`${atRiskCount} previously active customer(s) haven't purchased in over 60 days. Staging a re-engagement incentive can win back high-CLV accounts.`);
  }
  if (repeatCount > 0) {
    growthOpportunities.push(`${repeatCount} customers have made their second purchase. Automated post-purchase rewards can transition them into VIP brand advocates.`);
  }
  if (vipCount > 0) {
    growthOpportunities.push(`${vipCount} VIP customers represent high monetary concentration. Recommend priority access to new catalog arrivals.`);
  }

  return {
    totalCustomers: rows.length,
    vipCount,
    loyalCount,
    repeatCount,
    newCount,
    atRiskCount,
    dormantCount,
    oneTimeCount,
    topAtRiskCustomers: topAtRisk,
    growthOpportunities
  };
}
