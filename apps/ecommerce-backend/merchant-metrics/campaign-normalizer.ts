/**
 * Server-side campaign shape normalizer.
 *
 * Mirrors the fallbacks the frontend `normalizeCampaignForModal` applies, so
 * the trimmed overview campaign list keeps the fields the CampaignDetailModal
 * needs (status, title, offer text/value/safety, audience count, product,
 * financial sim deltas). The FULL campaign record (with suppression details,
 * message preview, full explanation) is fetched from /campaigns/:id when the
 * merchant actually opens the modal.
 */

export interface CampaignBaseShape {
  campaignId: string;
  merchantId: string;
  title: string;
  campaignType: string;
  status: string;
  activeAudienceCount: number;
}

export function normalizeCampaignShape(raw: any): CampaignBaseShape {
  const str = (v: any, fallback = ''): string =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;
  const int = (v: any, fallback = 0): number => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : Number.parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
  };

  const audience = raw?.audience || {};
  const eligibleCustomers = Array.isArray(audience.eligibleCustomers)
    ? audience.eligibleCustomers
    : Array.isArray(raw?.targetAudience) ? raw.targetAudience : [];

  return {
    campaignId: str(raw?.campaignId),
    merchantId: str(raw?.merchantId, 'default_merchant'),
    title: str(raw?.title, 'Untitled campaign'),
    campaignType: str(raw?.campaignType, 'UNKNOWN'),
    status: str(raw?.status, 'READY_FOR_REVIEW'),
    activeAudienceCount: int(
      audience.eligibleCount ?? raw?.activeAudienceCount ?? eligibleCustomers.length,
      0
    )
  };
}
