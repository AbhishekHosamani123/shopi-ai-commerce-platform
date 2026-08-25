import { client } from '../data/DB';
import { calculateChurnRisk } from './churn-model';
import { evaluateCustomerValueTrend } from './customer-value-history';
import { CustomerClvRecord, CustomerCohortSummary, IntelligenceConfidence } from './clv-types';

export class CustomerLifetimeValueEngine {
  /**
   * Computes dynamic CLV profile for a specific customer.
   */
  async getCustomerClvProfile(userId: number): Promise<CustomerClvRecord | null> {
    const userRes = await client.query('SELECT userid, username as name, email FROM users WHERE userid = $1', [userId]);
    if (userRes.rows.length === 0) return null;
    const user = userRes.rows[0];

    const ordersRes = await client.query(`
      SELECT 
        COUNT(orderid)::int as order_count,
        COALESCE(SUM(totalamount), 0)::numeric(12,2) as total_spend,
        COALESCE(AVG(totalamount), 0)::numeric(12,2) as avg_order,
        MIN(createdat) as first_order,
        MAX(createdat) as last_order,
        EXTRACT(DAY FROM (CURRENT_TIMESTAMP - MAX(createdat)))::int as days_since_last
      FROM orders
      WHERE userid = $1;
    `, [userId]);

    const row = ordersRes.rows[0];
    const orderCount = parseInt(row.order_count || '0', 10);
    const historicalSpend = parseFloat(row.total_spend || '0');
    const aov = parseFloat(row.avg_order || '0');
    const daysSinceLast = parseInt(row.days_since_last || '0', 10);

    if (orderCount === 0) {
      return {
        userId,
        name: user.name || 'Anonymous',
        email: user.email || 'unknown@domain.com',
        historicalSpend: 0,
        orderCount: 0,
        avgOrderValue: 0,
        firstOrderDate: new Date().toISOString(),
        lastOrderDate: new Date().toISOString(),
        daysSinceLastOrder: 0,
        avgRepeatIntervalDays: 0,
        currentClv: 0,
        expectedClv: 0,
        clvTrend: 'STABLE',
        churnRisk: 'LOW',
        confidence: 'LOW'
      };
    }

    const firstDate = new Date(row.first_order);
    const lastDate = new Date(row.last_order);
    const totalSpanDays = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 3600 * 24)));
    const avgRepeatIntervalDays = orderCount > 1 ? Math.round(totalSpanDays / (orderCount - 1)) : 30;

    const churnAnalysis = calculateChurnRisk({
      daysSinceLastOrder: daysSinceLast,
      orderCount,
      avgRepeatIntervalDays
    });

    const trendAnalysis = await evaluateCustomerValueTrend(userId);

    // Projected remaining orders over next 12 months based on churn risk
    const retentionFactor = churnAnalysis.risk === 'LOW' ? 0.85 : churnAnalysis.risk === 'MEDIUM' ? 0.40 : 0.10;
    const estimatedAnnualOrders = orderCount > 1 ? (365 / Math.max(15, avgRepeatIntervalDays)) : 1.5;
    const projectedAdditionalSpend = parseFloat((estimatedAnnualOrders * aov * retentionFactor).toFixed(2));
    const expectedClv = parseFloat((historicalSpend + projectedAdditionalSpend).toFixed(2));

    let confidence: IntelligenceConfidence = 'MEDIUM';
    if (orderCount >= 4 && totalSpanDays >= 60) confidence = 'HIGH';
    else if (orderCount === 1) confidence = 'LOW';

    return {
      userId,
      name: user.name || `Customer #${userId}`,
      email: user.email || `customer_${userId}@store.local`,
      historicalSpend,
      orderCount,
      avgOrderValue: aov,
      firstOrderDate: row.first_order.toISOString(),
      lastOrderDate: row.last_order.toISOString(),
      daysSinceLastOrder: daysSinceLast,
      avgRepeatIntervalDays,
      currentClv: historicalSpend,
      expectedClv,
      clvTrend: trendAnalysis.trend,
      churnRisk: churnAnalysis.risk,
      churnProbabilityPct: churnAnalysis.probabilityPct,
      confidence
    };
  }

  /**
   * Lists customer CLV profiles ordered by highest value or highest churn risk.
   */
  async listCustomerClvProfiles(limit: number = 20): Promise<CustomerClvRecord[]> {
    const usersRes = await client.query(`
      SELECT DISTINCT userid
      FROM orders
      ORDER BY userid ASC
      LIMIT $1;
    `, [limit]);

    const profiles: CustomerClvRecord[] = [];
    for (const u of usersRes.rows) {
      const p = await this.getCustomerClvProfile(u.userid);
      if (p) profiles.push(p);
    }

    return profiles.sort((a, b) => b.historicalSpend - a.historicalSpend);
  }

  /**
   * Computes store-wide customer cohort CLV summary.
   */
  async getCustomerCohortSummary(): Promise<CustomerCohortSummary> {
    const profiles = await this.listCustomerClvProfiles(100);
    const totalCustomers = profiles.length;
    const totalSpend = profiles.reduce((acc, p) => acc + p.historicalSpend, 0);
    const avgClv = totalCustomers > 0 ? parseFloat((totalSpend / totalCustomers).toFixed(2)) : 0;

    let vipCount = 0;
    let loyalCount = 0;
    let atRiskCount = 0;
    let dormantCount = 0;

    let highRisk = 0;
    let mediumRisk = 0;
    let lowRisk = 0;

    for (const p of profiles) {
      if (p.historicalSpend >= 10000 && p.orderCount >= 3) vipCount++;
      else if (p.orderCount >= 2 && p.churnRisk === 'LOW') loyalCount++;
      else if (p.churnRisk === 'HIGH') atRiskCount++;
      else if (p.daysSinceLastOrder > 90) dormantCount++;

      if (p.churnRisk === 'HIGH') highRisk++;
      else if (p.churnRisk === 'MEDIUM') mediumRisk++;
      else lowRisk++;
    }

    return {
      totalCustomers,
      totalHistoricalSpend: totalSpend,
      avgClv,
      vipCount,
      loyalCount,
      atRiskCount,
      dormantCount,
      churnRiskBreakdown: { highRisk, mediumRisk, lowRisk },
      overallConfidence: totalCustomers >= 50 ? 'HIGH' : 'MEDIUM'
    };
  }
}

export const clvEngine = new CustomerLifetimeValueEngine();
