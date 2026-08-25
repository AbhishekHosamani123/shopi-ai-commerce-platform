import { client } from '../../data/DB';

export interface AdLearningSummary {
  telemetryStatus: 'NOT_CONFIGURED' | 'PARTIAL' | 'AVAILABLE';
  totalSpend: number;
  totalRevenue: number;
  realizedROAS: number | null;
  sampleCampaignsCount: number;
  allocationMethod: 'OPPORTUNITY_BASED' | 'OUTCOME_ROAS_BASED';
  channelPerformance: Record<string, { spend: number; revenue: number; roas: number | null; status: string }>;
  learningNotice: string;
}

export class AdaptiveAdEngine {
  /**
   * Evaluates advertising campaign outcomes and transitions from opportunity-based to outcome-based allocation.
   */
  async evaluateAdLearning(merchantId: string = 'default_merchant'): Promise<AdLearningSummary> {
    const campRes = await client.query(`
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
  }
}

export const adaptiveAdEngine = new AdaptiveAdEngine();
