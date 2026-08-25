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
exports.buildBusinessDigest = buildBusinessDigest;
const merchant_intelligence_1 = require("../merchant-intelligence");
const copilot_tools_1 = require("../merchant-copilot/copilot-tools");
/**
 * Builds a structured executive business digest from PostgreSQL telemetry.
 */
function buildBusinessDigest() {
    return __awaiter(this, arguments, void 0, function* (digestType = 'DAILY', merchantId = 'default_merchant') {
        const periodKey = digestType === 'MONTHLY' ? 'last_30_days' : digestType === 'WEEKLY' ? 'last_7_days' : 'last_30_days';
        const [revSummary, comparison, topProducts, lowStock, returnsData, prioritiesData] = yield Promise.all([
            (0, merchant_intelligence_1.getRevenueSummary)(periodKey),
            digestType === 'MONTHLY' ? (0, merchant_intelligence_1.getMonthOverMonthComparison)() : (0, merchant_intelligence_1.getWeekOverWeekComparison)(),
            (0, merchant_intelligence_1.getTopProducts)(3, periodKey),
            (0, merchant_intelligence_1.getLowStockProducts)(200),
            (0, merchant_intelligence_1.getReturnAnalytics)(periodKey),
            (0, copilot_tools_1.getBusinessPriorities)()
        ]);
        const champion = topProducts[0];
        const criticalStock = lowStock.filter((i) => i.urgency === 'CRITICAL' || i.urgency === 'WARNING');
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
${prioritiesData.priorities.slice(0, 3).map((p) => `${p.rank}. **[${p.severity}] ${p.title}** → *${p.recommendedAction}*`).join('\n')}`;
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
    });
}
