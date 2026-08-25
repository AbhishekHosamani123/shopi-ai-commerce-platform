/**
 * ⚡ Phase 10: AI Cost, Quota & Token Rate Limiter
 */

export interface AiMerchantQuota {
  merchantId: string;
  dailyRequestLimit: number;
  requestsToday: number;
  tokensUsedToday: number;
  estimatedCostTodayInr: number;
  isThrottled: boolean;
  resetAt: string;
}

class AiRateLimiterService {
  private dailyLimits: Map<string, { count: number; tokens: number; resetTime: number }> = new Map();
  private defaultDailyLimit: number = 1000; // 1,000 queries / day per merchant
  private tokenCostPerThousandInr: number = 0.05; // Estimated ₹0.05 per 1k tokens

  private getTodayKey(merchantId: string): string {
    const today = new Date().toISOString().split('T')[0];
    return `${merchantId}_${today}`;
  }

  /**
   * Evaluates whether a merchant has remaining quota to make an AI query
   */
  checkQuota(merchantId: string = 'default_merchant'): { allowed: boolean; remaining: number; quota: AiMerchantQuota } {
    const key = this.getTodayKey(merchantId);
    const entry = this.dailyLimits.get(key) || { count: 0, tokens: 0, resetTime: this.getNextMidnight() };

    const allowed = entry.count < this.defaultDailyLimit;
    const remaining = Math.max(0, this.defaultDailyLimit - entry.count);

    const quota: AiMerchantQuota = {
      merchantId,
      dailyRequestLimit: this.defaultDailyLimit,
      requestsToday: entry.count,
      tokensUsedToday: entry.tokens,
      estimatedCostTodayInr: Number(((entry.tokens / 1000) * this.tokenCostPerThousandInr).toFixed(2)),
      isThrottled: !allowed,
      resetAt: new Date(entry.resetTime).toISOString()
    };

    return { allowed, remaining, quota };
  }

  /**
   * Records an AI query and token consumption
   */
  recordUsage(merchantId: string = 'default_merchant', estimatedTokens: number = 350): AiMerchantQuota {
    const key = this.getTodayKey(merchantId);
    const entry = this.dailyLimits.get(key) || { count: 0, tokens: 0, resetTime: this.getNextMidnight() };

    entry.count += 1;
    entry.tokens += estimatedTokens;
    this.dailyLimits.set(key, entry);

    return {
      merchantId,
      dailyRequestLimit: this.defaultDailyLimit,
      requestsToday: entry.count,
      tokensUsedToday: entry.tokens,
      estimatedCostTodayInr: Number(((entry.tokens / 1000) * this.tokenCostPerThousandInr).toFixed(2)),
      isThrottled: entry.count >= this.defaultDailyLimit,
      resetAt: new Date(entry.resetTime).toISOString()
    };
  }

  /**
   * Resets usage for a merchant (admin reset)
   */
  resetUsage(merchantId: string = 'default_merchant'): void {
    const key = this.getTodayKey(merchantId);
    this.dailyLimits.delete(key);
  }

  private getNextMidnight(): number {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  }
}

export const aiRateLimiterService = new AiRateLimiterService();
