import { client } from '../../data/DB';

export interface MerchantPreferenceRecord {
  memoryId: string;
  merchantId: string;
  preferenceKey: string;
  preferenceValue: Record<string, any>;
  evidenceCount: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  lastReinforcedAt: string;
}

export class MerchantPreferencesEngine {
  /**
   * Records or updates a learned merchant preference.
   * NOTE: Merchant preferences are guidance and never override hard safety guardrails.
   */
  async updatePreference(params: {
    merchantId: string;
    preferenceKey: string;
    preferenceValue: Record<string, any>;
    confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  }): Promise<MerchantPreferenceRecord> {
    const memoryId = `mem_${params.merchantId}_${params.preferenceKey}`;
    const res = await client.query(`
      INSERT INTO merchant_ai_memory (
        memory_id, merchant_id, preference_key, preference_value, evidence_count, confidence, last_reinforced_at, created_at
      ) VALUES ($1, $2, $3, $4, 1, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (merchant_id, preference_key) DO UPDATE SET
        preference_value = EXCLUDED.preference_value,
        evidence_count = merchant_ai_memory.evidence_count + 1,
        confidence = EXCLUDED.confidence,
        last_reinforced_at = CURRENT_TIMESTAMP
      RETURNING *;
    `, [
      memoryId,
      params.merchantId,
      params.preferenceKey,
      JSON.stringify(params.preferenceValue),
      params.confidence || 'MEDIUM'
    ]);

    const r = res.rows[0];
    return {
      memoryId: r.memory_id,
      merchantId: r.merchant_id,
      preferenceKey: r.preference_key,
      preferenceValue: typeof r.preference_value === 'object' ? r.preference_value : {},
      evidenceCount: r.evidence_count,
      confidence: r.confidence,
      lastReinforcedAt: new Date(r.last_reinforced_at).toISOString()
    };
  }

  /**
   * Retrieves all learned preferences for a merchant.
   */
  async getPreferences(merchantId: string = 'default_merchant'): Promise<MerchantPreferenceRecord[]> {
    const res = await client.query(`
      SELECT * FROM merchant_ai_memory
      WHERE (merchant_id = $1 OR $1 = 'merchant_admin');
    `, [merchantId]);

    return res.rows.map(r => ({
      memoryId: r.memory_id,
      merchantId: r.merchant_id,
      preferenceKey: r.preference_key,
      preferenceValue: typeof r.preference_value === 'object' ? r.preference_value : {},
      evidenceCount: r.evidence_count,
      confidence: r.confidence,
      lastReinforcedAt: new Date(r.last_reinforced_at).toISOString()
    }));
  }
}

export const merchantPreferencesEngine = new MerchantPreferencesEngine();
