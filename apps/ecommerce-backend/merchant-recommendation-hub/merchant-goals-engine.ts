import { client } from '../data/DB';
import { MerchantGoalConfig, MerchantGoalType, UnifiedRecommendation } from './recommendation-hub-types';

export class MerchantGoalsEngine {
  /**
   * Retrieves the active merchant business goal.
   */
  async getActiveGoal(merchantId: string = 'default_merchant'): Promise<MerchantGoalConfig> {
    const res = await client.query(`
      SELECT preference_value, last_reinforced_at
      FROM merchant_ai_memory
      WHERE (merchant_id = $1 OR $1 = 'merchant_admin')
        AND preference_key = 'active_business_goal';
    `, [merchantId]);

    if (res.rows.length > 0 && res.rows[0].preference_value) {
      const val = res.rows[0].preference_value;
      return {
        merchantId,
        activeGoal: val.goal || 'INCREASE_REVENUE',
        targetDescription: val.targetDescription || 'Maximize top-line store revenue and catalog order velocity.',
        deadlineDays: val.deadlineDays || 30,
        updatedAt: res.rows[0].last_reinforced_at || new Date().toISOString()
      };
    }

    return {
      merchantId,
      activeGoal: 'INCREASE_REVENUE',
      targetDescription: 'Maximize top-line store revenue and catalog order velocity.',
      deadlineDays: 30,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Sets the active merchant business goal.
   */
  async setActiveGoal(
    goal: MerchantGoalType,
    targetDescription?: string,
    deadlineDays: number = 30,
    merchantId: string = 'default_merchant'
  ): Promise<MerchantGoalConfig> {
    const defaultDesc: Record<MerchantGoalType, string> = {
      INCREASE_REVENUE: 'Maximize top-line store revenue and catalog order velocity.',
      INCREASE_MARGIN: 'Optimize unit contribution margin and reduce dilutive discounting.',
      REDUCE_DEAD_STOCK: 'Clear stagnant inventory (60+ days without sales) to release working capital.',
      REDUCE_STOCKOUTS: 'Ensure 99%+ on-shelf availability for champion and high-velocity SKUs.',
      IMPROVE_RETENTION: 'Re-engage dormant high-CLV customers with targeted personalized incentives.',
      REDUCE_RETURNS: 'Identify and resolve apparel sizing and quality defects causing high returns.',
      IMPROVE_CASH_EFFICIENCY: 'Minimize working capital days locked in inventory while sustaining fulfillment.',
      INCREASE_ROAS: 'Prioritize promotion and advertising on high-margin, high-stock-cover SKUs.'
    };

    const desc = targetDescription || defaultDesc[goal];

    await client.query(`
      INSERT INTO merchant_ai_memory (
        memory_id, merchant_id, preference_key, preference_value, evidence_count, confidence, last_reinforced_at, created_at
      ) VALUES ($1, $2, 'active_business_goal', $3, 1, 'HIGH', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (merchant_id, preference_key) DO UPDATE SET
        preference_value = $3,
        evidence_count = merchant_ai_memory.evidence_count + 1,
        last_reinforced_at = CURRENT_TIMESTAMP;
    `, [
      `mem_goal_${Date.now()}`,
      merchantId,
      JSON.stringify({ goal, targetDescription: desc, deadlineDays })
    ]);

    return {
      merchantId,
      activeGoal: goal,
      targetDescription: desc,
      deadlineDays,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Re-ranks recommendations according to the active merchant goal.
   */
  rankRecommendationsByGoal(
    recommendations: UnifiedRecommendation[],
    goal: MerchantGoalType
  ): UnifiedRecommendation[] {
    const categoryWeights: Record<MerchantGoalType, Record<string, number>> = {
      INCREASE_REVENUE: { PROMOTIONS: 1.5, MARKETING: 1.4, INVENTORY: 1.3, PRICING: 1.1, RETENTION: 1.2, SUPPLIER: 1.0, CAPITAL: 1.0, OPERATIONS: 0.9 },
      INCREASE_MARGIN: { PRICING: 1.6, PROMOTIONS: 1.3, INVENTORY: 1.0, CAPITAL: 1.2, RETENTION: 1.1, MARKETING: 0.9, SUPPLIER: 1.1, OPERATIONS: 1.0 },
      REDUCE_DEAD_STOCK: { PRICING: 1.7, PROMOTIONS: 1.6, INVENTORY: 1.4, MARKETING: 1.3, CAPITAL: 1.2, RETENTION: 0.8, SUPPLIER: 0.6, OPERATIONS: 0.8 },
      REDUCE_STOCKOUTS: { INVENTORY: 1.8, SUPPLIER: 1.6, CAPITAL: 1.3, PRICING: 0.8, PROMOTIONS: 0.6, MARKETING: 0.6, RETENTION: 0.9, OPERATIONS: 1.1 },
      IMPROVE_RETENTION: { RETENTION: 1.9, PROMOTIONS: 1.3, PRICING: 1.0, MARKETING: 1.1, INVENTORY: 0.9, SUPPLIER: 0.7, CAPITAL: 0.8, OPERATIONS: 1.0 },
      REDUCE_RETURNS: { OPERATIONS: 1.9, INVENTORY: 1.2, PRICING: 1.0, RETENTION: 1.1, PROMOTIONS: 0.7, MARKETING: 0.6, SUPPLIER: 1.1, CAPITAL: 0.8 },
      IMPROVE_CASH_EFFICIENCY: { CAPITAL: 1.8, INVENTORY: 1.5, SUPPLIER: 1.3, PRICING: 1.2, PROMOTIONS: 1.0, MARKETING: 0.7, RETENTION: 0.8, OPERATIONS: 0.9 },
      INCREASE_ROAS: { MARKETING: 1.8, PROMOTIONS: 1.4, PRICING: 1.3, INVENTORY: 1.1, CAPITAL: 1.0, RETENTION: 1.1, SUPPLIER: 0.8, OPERATIONS: 0.7 }
    };

    const weights = categoryWeights[goal] || categoryWeights.INCREASE_REVENUE;

    return [...recommendations].map(rec => {
      const catMultiplier = weights[rec.category] || 1.0;
      const confMultiplier = rec.confidence === 'HIGH' ? 1.2 : rec.confidence === 'MEDIUM' ? 1.0 : 0.8;
      const adjustedScore = Math.min(100, Math.round(rec.priorityScore * catMultiplier * confMultiplier * 10) / 10);
      return {
        ...rec,
        priorityScore: adjustedScore
      };
    }).sort((a, b) => b.priorityScore - a.priorityScore);
  }
}

export const merchantGoalsEngine = new MerchantGoalsEngine();
