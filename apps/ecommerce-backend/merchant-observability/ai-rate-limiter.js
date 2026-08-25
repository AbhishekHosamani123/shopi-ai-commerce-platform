"use strict";
/**
 * ⚡ Phase 10: AI Cost, Quota & Token Rate Limiter
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRateLimiterService = void 0;
class AiRateLimiterService {
    constructor() {
        this.dailyLimits = new Map();
        this.defaultDailyLimit = 1000; // 1,000 queries / day per merchant
        this.tokenCostPerThousandInr = 0.05; // Estimated ₹0.05 per 1k tokens
    }
    getTodayKey(merchantId) {
        const today = new Date().toISOString().split('T')[0];
        return `${merchantId}_${today}`;
    }
    /**
     * Evaluates whether a merchant has remaining quota to make an AI query
     */
    checkQuota(merchantId = 'default_merchant') {
        const key = this.getTodayKey(merchantId);
        const entry = this.dailyLimits.get(key) || { count: 0, tokens: 0, resetTime: this.getNextMidnight() };
        const allowed = entry.count < this.defaultDailyLimit;
        const remaining = Math.max(0, this.defaultDailyLimit - entry.count);
        const quota = {
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
    recordUsage(merchantId = 'default_merchant', estimatedTokens = 350) {
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
    resetUsage(merchantId = 'default_merchant') {
        const key = this.getTodayKey(merchantId);
        this.dailyLimits.delete(key);
    }
    getNextMidnight() {
        const d = new Date();
        d.setHours(24, 0, 0, 0);
        return d.getTime();
    }
}
exports.aiRateLimiterService = new AiRateLimiterService();
