import { merchantPreferencesEngine, MerchantPreferenceRecord } from './merchant-preferences';
import { decisionHistoryService, DecisionHistoryItem } from './decision-history';

export interface LearningMemorySnapshot {
  preferences: MerchantPreferenceRecord[];
  recentDecisions: DecisionHistoryItem[];
  rejectionRatePct: number;
  dominantOptimizationGoal: string;
  preferredRiskTolerance: string;
  safetyOverrideNotice: string;
}

export class LearningMemoryEngine {
  /**
   * Aggregates the full merchant memory state.
   */
  async getMemorySnapshot(merchantId: string = 'default_merchant'): Promise<LearningMemorySnapshot> {
    const [preferences, recentDecisions] = await Promise.all([
      merchantPreferencesEngine.getPreferences(merchantId),
      decisionHistoryService.getDecisionHistory(merchantId, 20)
    ]);

    const totalDecisions = recentDecisions.length;
    const rejectedDecisions = recentDecisions.filter(d => d.status === 'REJECTED').length;
    const rejectionRatePct = totalDecisions > 0 ? Math.round((rejectedDecisions / totalDecisions) * 100) : 10;

    return {
      preferences,
      recentDecisions,
      rejectionRatePct,
      dominantOptimizationGoal: 'MAXIMIZE_REVENUE',
      preferredRiskTolerance: 'BALANCED',
      safetyOverrideNotice: 'Merchant preference memory is active for recommendation prioritization. Hard safety boundaries (minimum stock, negative margin guards) always remain enforced.'
    };
  }
}

export const learningMemoryEngine = new LearningMemoryEngine();
