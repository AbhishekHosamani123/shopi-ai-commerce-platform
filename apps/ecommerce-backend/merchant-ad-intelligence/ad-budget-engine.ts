import { adEligibilityEngine } from './ad-eligibility-engine';
import { AdBudgetAllocationPlan, AdProductBudgetAllocation } from './ad-types';

export class AdBudgetEngine {
  /**
   * Distributes an advertising budget across eligible catalog SKUs based on inventory health and demand opportunity.
   */
  async allocateAdBudget(totalBudget: number = 25000, merchantId: string = 'default_merchant'): Promise<AdBudgetAllocationPlan> {
    const budget = Math.max(5000, totalBudget);
    const eligibleList = await adEligibilityEngine.listEligibleProducts(merchantId);
    const eligibleOnly = eligibleList.filter(p => p.isEligible);

    // Sort by eligibility score descending
    eligibleOnly.sort((a, b) => b.eligibilityScore - a.eligibilityScore);
    const topTargets = eligibleOnly.slice(0, 3);

    const productAllocations: AdProductBudgetAllocation[] = [];
    let allocatedSpend = 0;

    const weights = [0.45, 0.30, 0.15]; // Allocate up to 90% of budget, keeping 10% reserve

    topTargets.forEach((target, index) => {
      const weight = weights[index] || 0.10;
      const amount = Math.round(budget * weight);
      allocatedSpend += amount;

      productAllocations.push({
        productId: target.productId,
        productTitle: target.productTitle,
        channel: target.recommendedAdChannel,
        allocatedBudget: amount,
        allocationPercentage: Math.round(weight * 100),
        opportunityScore: target.eligibilityScore,
        expectedImpressionBand: `~${Math.round(amount * 18).toLocaleString('en-IN')} - ${Math.round(amount * 26).toLocaleString('en-IN')} impressions`,
        expectedDemandLiftPct: Math.round(15 + (weight * 30)),
        rationale: `Strong inventory buffer (${target.daysOfCover}d) and low return rate (${target.returnRatePct}%). Suitable for ${target.recommendedAdChannel} campaigns.`
      });
    });

    const unallocatedReserve = budget - allocatedSpend;

    return {
      totalBudget: budget,
      allocatedSpend,
      unallocatedReserve,
      providerStatus: {
        DIRECT_STORE: 'ACTIVE',
        GOOGLE: 'NOT_CONFIGURED',
        META: 'NOT_CONFIGURED',
        AMAZON: 'NOT_CONFIGURED',
        OTHER: 'NOT_CONFIGURED'
      },
      productAllocations,
      dataHealthNotice: 'Historical advertising performance (ROAS/CPA) is unavailable. Budget allocation is opportunity-based on inventory health and demand velocity rather than fabricated ROAS.',
      createdAt: new Date().toISOString()
    };
  }
}

export const adBudgetEngine = new AdBudgetEngine();
