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
exports.merchantPreferencesEngine = exports.MerchantPreferencesEngine = void 0;
const DB_1 = require("../../data/DB");
class MerchantPreferencesEngine {
    /**
     * Records or updates a learned merchant preference.
     * NOTE: Merchant preferences are guidance and never override hard safety guardrails.
     */
    updatePreference(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const memoryId = `mem_${params.merchantId}_${params.preferenceKey}`;
            const res = yield DB_1.client.query(`
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
        });
    }
    /**
     * Retrieves all learned preferences for a merchant.
     */
    getPreferences() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const res = yield DB_1.client.query(`
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
        });
    }
}
exports.MerchantPreferencesEngine = MerchantPreferencesEngine;
exports.merchantPreferencesEngine = new MerchantPreferencesEngine();
