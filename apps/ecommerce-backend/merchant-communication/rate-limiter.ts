import { client } from '../data/DB';
import { RateLimitConfig } from './communication-types';

export class RateLimiterService {
  private config: RateLimitConfig;
  private inMemoryRecentRequests: Map<string, number[]> = new Map();

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxCampaignRecipients: config?.maxCampaignRecipients || 500,
      maxMessagesPerCustomerPerWeek: config?.maxMessagesPerCustomerPerWeek || 2,
      maxMessagesPerMerchantPerDay: config?.maxMessagesPerMerchantPerDay || 1000,
      maxProviderRequestsPerMinute: config?.maxProviderRequestsPerMinute || 60
    };
  }

  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  setConfig(newConfig: Partial<RateLimitConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Evaluates merchant-level daily message cap.
   */
  async checkMerchantDailyLimit(merchantId: string): Promise<{ isAllowed: boolean; currentCount: number; limit: number }> {
    const res = await client.query(`
      SELECT COUNT(*)::int as today_count
      FROM merchant_campaign_messages
      WHERE merchant_id = $1
        AND status IN ('SENT', 'DELIVERED', 'SIMULATED')
        AND created_at >= CURRENT_DATE;
    `, [merchantId]);

    const count = res.rows[0]?.today_count || 0;
    return {
      isAllowed: count < this.config.maxMessagesPerMerchantPerDay,
      currentCount: count,
      limit: this.config.maxMessagesPerMerchantPerDay
    };
  }

  /**
   * Evaluates customer-level weekly frequency cap.
   */
  async checkCustomerWeeklyLimit(customerId: number, merchantId: string): Promise<{ isAllowed: boolean; count: number; limit: number }> {
    const res = await client.query(`
      SELECT COUNT(*)::int as week_count
      FROM merchant_campaign_messages
      WHERE customer_id = $1
        AND merchant_id = $2
        AND status IN ('SENT', 'DELIVERED', 'SIMULATED')
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days';
    `, [customerId, merchantId]);

    const count = res.rows[0]?.week_count || 0;
    return {
      isAllowed: count < this.config.maxMessagesPerCustomerPerWeek,
      count,
      limit: this.config.maxMessagesPerCustomerPerWeek
    };
  }

  /**
   * Evaluates transient in-memory per-minute provider request rate.
   */
  checkProviderRateLimit(providerName: string): boolean {
    const now = Date.now();
    const windowStart = now - 60000;
    const timestamps = (this.inMemoryRecentRequests.get(providerName) || []).filter(t => t > windowStart);

    if (timestamps.length >= this.config.maxProviderRequestsPerMinute) {
      return false;
    }

    timestamps.push(now);
    this.inMemoryRecentRequests.set(providerName, timestamps);
    return true;
  }
}

export const rateLimiterService = new RateLimiterService();
