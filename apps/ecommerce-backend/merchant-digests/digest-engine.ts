import { client } from '../data/DB';
import { buildBusinessDigest } from './digest-builder';
import {
  DigestType,
  MerchantAiDigestRecord,
  DigestSettings
} from './digest-types';

function mapRowToDigest(r: any): MerchantAiDigestRecord {
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
export async function generateAndSaveDigest(
  digestType: DigestType = 'DAILY',
  merchantId: string = 'default_merchant'
): Promise<MerchantAiDigestRecord> {
  const digestData = await buildBusinessDigest(digestType, merchantId);
  const digestId = `dig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const insertQuery = `
    INSERT INTO merchant_ai_digests (
      digest_id, merchant_id, digest_type, period, title, summary,
      metrics, top_products, inventory_risks, ai_priorities
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `;

  const res = await client.query(insertQuery, [
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
}

/**
 * Lists historical digests for a merchant.
 */
export async function listDigests(
  merchantId: string = 'default_merchant',
  limit: number = 20
): Promise<MerchantAiDigestRecord[]> {
  const query = `
    SELECT * FROM merchant_ai_digests
    WHERE merchant_id = $1 OR $1 = 'merchant_admin'
    ORDER BY created_at DESC
    LIMIT $2;
  `;

  const res = await client.query(query, [merchantId, limit]);
  return res.rows.map(mapRowToDigest);
}

/**
 * Retrieves latest digest for a merchant.
 */
export async function getLatestDigest(
  merchantId: string = 'default_merchant'
): Promise<MerchantAiDigestRecord | null> {
  const list = await listDigests(merchantId, 1);
  return list.length > 0 ? list[0] : null;
}

/**
 * Retrieves AI settings and digest preferences for a merchant.
 */
export async function getDigestSettings(
  merchantId: string = 'default_merchant'
): Promise<DigestSettings> {
  const res = await client.query(
    `SELECT * FROM merchant_ai_settings WHERE merchant_id = $1`,
    [merchantId]
  );

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
    proactiveInsightsEnabled: r.proactive_insights_enabled ?? true,
    digestFrequency: r.digest_frequency || 'DAILY',
    digestTime: r.digest_time || '09:00',
    timezone: r.timezone || 'Asia/Kolkata',
    alertPreferences: typeof r.alert_preferences === 'string' ? JSON.parse(r.alert_preferences) : r.alert_preferences || {},
    updatedAt: r.updated_at
  };
}

/**
 * Updates AI settings and digest preferences for a merchant.
 */
export async function updateDigestSettings(
  settings: Partial<DigestSettings>,
  merchantId: string = 'default_merchant'
): Promise<DigestSettings> {
  const existing = await getDigestSettings(merchantId);

  const proactiveEnabled = settings.proactiveInsightsEnabled ?? existing.proactiveInsightsEnabled;
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

  await client.query(query, [
    merchantId,
    proactiveEnabled,
    frequency,
    time,
    tz,
    JSON.stringify(prefs)
  ]);

  return await getDigestSettings(merchantId);
}
