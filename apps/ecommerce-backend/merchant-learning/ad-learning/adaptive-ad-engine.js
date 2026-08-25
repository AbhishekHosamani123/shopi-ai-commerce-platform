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
exports.adaptiveAdEngine = exports.AdaptiveAdEngine = void 0;
const DB_1 = require("../../data/DB");
class AdaptiveAdEngine {
    /**
     * Evaluates advertising campaign outcomes and transitions from opportunity-based to outcome-based allocation.
     */
    evaluateAdLearning() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const campRes = yield DB_1.client.query(`
      SELECT * FROM merchant_ad_campaigns
      WHERE (merchant_id = $1 OR $1 = 'merchant_admin')
        AND status IN ('ACTIVE', 'COMPLETED');
    `, [merchantId]);
            const campaigns = campRes.rows;
            if (campaigns.length === 0) {
                return {
                    telemetryStatus: 'PARTIAL',
                    totalSpend: 0,
                    totalRevenue: 0,
                    realizedROAS: null,
                    sampleCampaignsCount: 0,
                    allocationMethod: 'OPPORTUNITY_BASED',
                    channelPerformance: {
                        DIRECT_STORE: { spend: 0, revenue: 0, roas: null, status: 'ACTIVE' },
                        GOOGLE_ADS: { spend: 0, revenue: 0, roas: null, status: 'NOT_CONFIGURED' },
                        META_ADS: { spend: 0, revenue: 0, roas: null, status: 'NOT_CONFIGURED' }
                    },
                    learningNotice: 'Historical advertising performance unavailable. Budget allocation is opportunity-based on inventory health and demand velocity rather than fabricated ROAS.'
                };
            }
            let totalSpend = 0;
            let totalRevenue = 0;
            campaigns.forEach(c => {
                const spend = parseFloat(c.allocated_budget || '0');
                const metrics = typeof c.metrics === 'object' && c.metrics !== null ? c.metrics : {};
                const rev = parseFloat(metrics.attributedRevenue || '0');
                totalSpend += spend;
                totalRevenue += rev;
            });
            const realizedROAS = totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : null;
            return {
                telemetryStatus: 'AVAILABLE',
                totalSpend,
                totalRevenue,
                realizedROAS,
                sampleCampaignsCount: campaigns.length,
                allocationMethod: 'OUTCOME_ROAS_BASED',
                channelPerformance: {
                    DIRECT_STORE: { spend: totalSpend, revenue: totalRevenue, roas: realizedROAS, status: 'ACTIVE' },
                    GOOGLE_ADS: { spend: 0, revenue: 0, roas: null, status: 'NOT_CONFIGURED' },
                    META_ADS: { spend: 0, revenue: 0, roas: null, status: 'NOT_CONFIGURED' }
                },
                learningNotice: `Evaluated ${campaigns.length} completed ad campaigns. Outcome-based ROAS allocation active (${realizedROAS}x average ROAS).`
            };
        });
    }
}
exports.AdaptiveAdEngine = AdaptiveAdEngine;
exports.adaptiveAdEngine = new AdaptiveAdEngine();
