import {
  getRevenueSummary,
  getWeekOverWeekComparison,
  getMonthOverMonthComparison,
  getTopProducts,
  getLowStockProducts,
  getReturnAnalytics
} from '../merchant-intelligence';
import { getBusinessPriorities } from '../merchant-copilot/copilot-tools';
import { DigestType, MerchantAiDigestRecord } from './digest-types';

/**
 * Builds a structured executive business digest from PostgreSQL telemetry.
 */
export async function buildBusinessDigest(
  digestType: DigestType = 'DAILY',
  merchantId: string = 'default_merchant'
): Promise<Omit<MerchantAiDigestRecord, 'digestId' | 'createdAt'>> {
  const periodKey = digestType === 'MONTHLY' ? 'last_30_days' : digestType === 'WEEKLY' ? 'last_7_days' : 'last_30_days';

  const [revSummary, comparison, topProducts, lowStock, returnsData, prioritiesData] = await Promise.all([
    getRevenueSummary(periodKey),
    digestType === 'MONTHLY' ? getMonthOverMonthComparison() : getWeekOverWeekComparison(),
    getTopProducts(3, periodKey),
    getLowStockProducts(200),
    getReturnAnalytics(periodKey),
    getBusinessPriorities()
  ]);

  const champion = topProducts[0];
  const criticalStock = lowStock.filter((i: any) => i.urgency === 'CRITICAL' || i.urgency === 'WARNING');
  const growth = comparison.growth;

  const title = digestType === 'DAILY'
    ? `Daily Merchant AI Executive Briefing`
    : digestType === 'WEEKLY'
    ? `Weekly Business Performance Digest`
    : `Monthly Commerce Operations Review`;

  const greeting = digestType === 'DAILY'
    ? 'Good morning. Here is your daily business briefing.'
    : digestType === 'WEEKLY'
    ? 'Here is your weekly commercial operations recap.'
    : 'Here is your monthly executive performance summary.';

  const summary = `${greeting}

**Financial Performance:**
• **Gross Revenue:** ₹${revSummary.grossRevenue.toLocaleString('en-IN')} (${growth.revenueChangePct >= 0 ? '+' : ''}${growth.revenueChangePct}%)
• **Net Revenue:** ₹${revSummary.netRevenue.toLocaleString('en-IN')}
• **Total Orders:** ${revSummary.totalOrders.toLocaleString('en-IN')} (${growth.ordersChangePct >= 0 ? '+' : ''}${growth.ordersChangePct}%)
• **Units Sold:** ${revSummary.unitsSold.toLocaleString('en-IN')} units
• **Average Order Value (AOV):** ₹${revSummary.averageOrderValue.toLocaleString('en-IN')}

**Product & Inventory Highlights:**
• **Top Champion:** ${champion ? `${champion.title} (₹${champion.revenue.toLocaleString('en-IN')}, ${champion.unitsSold} units)` : 'N/A'}
• **Inventory Risks:** ${criticalStock.length > 0 ? `${criticalStock.length} product(s) require reorder attention` : 'All catalog inventory levels healthy (> 30 days coverage)'}
• **Store Return Rate:** ${returnsData.overallReturnRatePct}% (₹${(returnsData.totalRefundAmount || 0).toLocaleString('en-IN')} refunds)

**Top AI Operational Priorities:**
${prioritiesData.priorities.slice(0, 3).map((p: any) => `${p.rank}. **[${p.severity}] ${p.title}** → *${p.recommendedAction}*`).join('\n')}`;

  return {
    merchantId,
    digestType,
    period: revSummary.period,
    title,
    summary,
    metrics: {
      grossRevenue: revSummary.grossRevenue,
      netRevenue: revSummary.netRevenue,
      totalOrders: revSummary.totalOrders,
      unitsSold: revSummary.unitsSold,
      averageOrderValue: revSummary.averageOrderValue,
      revenueGrowthPct: growth.revenueChangePct,
      ordersGrowthPct: growth.ordersChangePct,
      returnRatePct: returnsData.overallReturnRatePct
    },
    topProducts,
    inventoryRisks: criticalStock,
    aiPriorities: prioritiesData.priorities.slice(0, 3)
  };
}
