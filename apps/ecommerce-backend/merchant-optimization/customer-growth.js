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
exports.getCustomerGrowthAnalysis = getCustomerGrowthAnalysis;
const DB_1 = require("../data/DB");
/**
 * Calculates customer RFM segmentation and identifies high-value retention opportunities.
 */
function getCustomerGrowthAnalysis() {
    return __awaiter(this, void 0, void 0, function* () {
        const query = `
    SELECT 
      u.userid,
      u.username,
      u.email,
      COUNT(o.orderid)::int as total_orders,
      COALESCE(SUM(o.totalamount), 0)::numeric(12,2) as total_spend,
      ROUND(COALESCE(AVG(o.totalamount), 0), 2)::numeric(12,2) as avg_order_value,
      MAX(o.createdat) as last_order_date,
      EXTRACT(DAY FROM (NOW() - MAX(o.createdat)))::int as days_since_last_order
    FROM users u
    JOIN orders o ON u.userid = o.userid
    WHERE u.role = 'customer'
    GROUP BY u.userid, u.username, u.email
    HAVING COUNT(o.orderid) > 0
    ORDER BY total_spend DESC;
  `;
        const res = yield DB_1.client.query(query);
        const rows = res.rows;
        const segments = [];
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
            let segment = 'ONE_TIME';
            if (orders >= 3 && spend >= 10000) {
                segment = 'VIP';
                vipCount++;
            }
            else if (orders >= 3) {
                segment = 'LOYAL';
                loyalCount++;
            }
            else if (orders === 2 && daysSince <= 60) {
                segment = 'REPEAT';
                repeatCount++;
            }
            else if (orders === 1 && daysSince <= 30) {
                segment = 'NEW';
                newCount++;
            }
            else if (orders >= 2 && daysSince > 60) {
                segment = 'AT_RISK';
                atRiskCount++;
            }
            else if (daysSince > 120) {
                segment = 'DORMANT';
                dormantCount++;
            }
            else {
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
        const growthOpportunities = [];
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
    });
}
