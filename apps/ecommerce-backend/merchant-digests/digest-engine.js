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
exports.generateAndSaveDigest = generateAndSaveDigest;
exports.listDigests = listDigests;
exports.getLatestDigest = getLatestDigest;
exports.getDigestSettings = getDigestSettings;
exports.updateDigestSettings = updateDigestSettings;
const DB_1 = require("../data/DB");
const digest_builder_1 = require("./digest-builder");
function mapRowToDigest(r) {
    return {
        digestId: r.digest_id,
        merchantId: r.merchant_id,
        digestType: r.digest_type,
        period: r.period,
        title: r.title,
        summary: r.summary,
        metrics: typeof r.metrics === 'string' ? JSON.parse(r.metrics) : r.metrics || {},
        topProducts: typeof r.top_products === 'string' ? JSON.parse(r.top_products) : r.top_products || [],
        inventoryRisks: typeof r.inventory_risks === 'string' ? JSON.parse(r.inventory_risks) : r.inventory_risks || [],
        aiPriorities: typeof r.ai_priorities === 'string' ? JSON.parse(r.ai_priorities) : r.ai_priorities || [],
        createdAt: r.created_at
    };
}
/**
 * Builds, persists, and returns a scheduled business digest.
 */
function generateAndSaveDigest() {
    return __awaiter(this, arguments, void 0, function* (digestType = 'DAILY', merchantId = 'default_merchant') {
        const digestData = yield (0, digest_builder_1.buildBusinessDigest)(digestType, merchantId);
        const digestId = `dig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const insertQuery = `
    INSERT INTO merchant_ai_digests (
      digest_id, merchant_id, digest_type, period, title, summary,
      metrics, top_products, inventory_risks, ai_priorities
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `;
        const res = yield DB_1.client.query(insertQuery, [
            digestId,
            merchantId,
            digestData.digestType,
            digestData.period,
            digestData.title,
            digestData.summary,
            JSON.stringify(digestData.metrics),
            JSON.stringify(digestData.topProducts),
            JSON.stringify(digestData.inventoryRisks),
            JSON.stringify(digestData.aiPriorities)
        ]);
        return mapRowToDigest(res.rows[0]);
    });
}
/**
 * Lists historical digests for a merchant.
 */
function listDigests() {
    return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant', limit = 20) {
        const query = `
    SELECT * FROM merchant_ai_digests
    WHERE merchant_id = $1 OR $1 = 'merchant_admin'
    ORDER BY created_at DESC
    LIMIT $2;
  `;
        const res = yield DB_1.client.query(query, [merchantId, limit]);
        return res.rows.map(mapRowToDigest);
    });
}
/**
 * Retrieves latest digest for a merchant.
 */
function getLatestDigest() {
    return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
        const list = yield listDigests(merchantId, 1);
        return list.length > 0 ? list[0] : null;
    });
}
/**
 * Retrieves AI settings and digest preferences for a merchant.
 */
function getDigestSettings() {
    return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
        var _a;
        const res = yield DB_1.client.query(`SELECT * FROM merchant_ai_settings WHERE merchant_id = $1`, [merchantId]);
        if (res.rows.length === 0) {
            return {
                merchantId,
                proactiveInsightsEnabled: true,
                digestFrequency: 'DAILY',
                digestTime: '09:00',
                timezone: 'Asia/Kolkata',
                alertPreferences: { critical: true, warning: true, opportunity: true, info: true },
                updatedAt: new Date().toISOString()
            };
        }
        const r = res.rows[0];
        return {
            merchantId: r.merchant_id,
            proactiveInsightsEnabled: (_a = r.proactive_insights_enabled) !== null && _a !== void 0 ? _a : true,
            digestFrequency: r.digest_frequency || 'DAILY',
            digestTime: r.digest_time || '09:00',
            timezone: r.timezone || 'Asia/Kolkata',
            alertPreferences: typeof r.alert_preferences === 'string' ? JSON.parse(r.alert_preferences) : r.alert_preferences || {},
            updatedAt: r.updated_at
        };
    });
}
/**
 * Updates AI settings and digest preferences for a merchant.
 */
function updateDigestSettings(settings_1) {
    return __awaiter(this, arguments, void 0, function* (settings, merchantId = 'default_merchant') {
        var _a;
        const existing = yield getDigestSettings(merchantId);
        const proactiveEnabled = (_a = settings.proactiveInsightsEnabled) !== null && _a !== void 0 ? _a : existing.proactiveInsightsEnabled;
        const frequency = settings.digestFrequency || existing.digestFrequency;
        const time = settings.digestTime || existing.digestTime;
        const tz = settings.timezone || existing.timezone;
        const prefs = settings.alertPreferences || existing.alertPreferences;
        const query = `
    INSERT INTO merchant_ai_settings (
      merchant_id, proactive_insights_enabled, digest_frequency, digest_time, timezone, alert_preferences, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    ON CONFLICT (merchant_id) DO UPDATE 
    SET proactive_insights_enabled = EXCLUDED.proactive_insights_enabled,
        digest_frequency = EXCLUDED.digest_frequency,
        digest_time = EXCLUDED.digest_time,
        timezone = EXCLUDED.timezone,
        alert_preferences = EXCLUDED.alert_preferences,
        updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
        yield DB_1.client.query(query, [
            merchantId,
            proactiveEnabled,
            frequency,
            time,
            tz,
            JSON.stringify(prefs)
        ]);
        return yield getDigestSettings(merchantId);
    });
}
