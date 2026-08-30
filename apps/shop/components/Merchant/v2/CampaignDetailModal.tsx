'use client';

import React, { useState } from 'react';
import { TrustBadge } from './TrustBadge';

export interface CampaignModalData {
  campaignId: string;
  merchantId: string;
  title: string;
  campaignType: string;
  status: 'DRAFT' | 'READY_FOR_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXECUTING' | 'COMPLETED' | string;
  channel: 'EMAIL' | 'WHATSAPP' | 'MULTI_CHANNEL' | string;
  activeAudienceCount: number;
  targetProducts: Array<{
    productId: number;
    title: string;
    price: number;
    stock: number;
  }>;
  offer: {
    offerType: string;
    discountValue: number;
    description: string;
    isFinanciallySafe: boolean;
    couponSpec?: any;
  };
  message: {
    email?: {
      subject: string;
      previewText?: string;
      body: string;
    };
    whatsApp?: {
      message: string;
    };
  };
  financialAnalysis?: {
    sellingPrice: number;
    cogs: number | null;
    cogsStatus: string;
    unitShipping: number;
    unitHandling: number;
    totalVariableCost: number;
    currentContribution: number | null;
    maxSafeDiscount: number;
    isDiscountSafe: boolean;
  };
  expectedImpact?: {
    targetAudienceCount: number;
    observedBaselineMetric?: string;
    modelEstimatedConversionLiftPct?: number;
    simulatedIncrementalOrders?: number;
    simulatedGrossRevenueDelta?: number;
    simulatedDiscountCost?: number;
    simulatedNetContributionProfitDelta?: number;
  };
  explanation?: {
    observation: string;
    proposedActionRationale: string;
    financialTradeoff: string;
    risks?: string[];
    assumptions?: string[];
  };
  createdAt?: string;
  expiresAt?: string;
  approvalAudit?: {
    approvedBy: string;
    approvedAt: string;
  };
}

interface CampaignDetailModalProps {
  campaign: CampaignModalData | null;
  isOpen: boolean;
  onClose: () => void;
  onCampaignUpdated?: (campaignId: string, newStatus: string, message: string) => void;
}

export function CampaignDetailModal({
  campaign,
  isOpen,
  onClose,
  onCampaignUpdated
}: CampaignDetailModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emailPreviewTab, setEmailPreviewTab] = useState<'html' | 'text'>('html');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  if (!isOpen || !campaign) return null;

  const isPending = campaign.status === 'READY_FOR_REVIEW' || campaign.status === 'DRAFT';
  const isApproved = campaign.status === 'APPROVED';

  const handleApprove = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/merchant/campaigns/${campaign.campaignId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-id': campaign.merchantId || 'default_merchant'
        },
        body: JSON.stringify({ approvedBy: 'executive_merchant_lead' })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to approve campaign');
      }
      setSuccessMessage('Campaign approved successfully with immutable audit stamp.');
      onCampaignUpdated?.(campaign.campaignId, 'APPROVED', 'Campaign approved successfully.');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDryRun = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/merchant/campaigns/${campaign.campaignId}/dry-run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-id': campaign.merchantId || 'default_merchant'
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to execute dry run');
      }
      setSuccessMessage(`Dry-run simulation completed for ${data.result?.simulatedAudienceCount || 0} recipients.`);
      onCampaignUpdated?.(campaign.campaignId, 'COMPLETED', 'Dry run executed successfully.');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/merchant/campaigns/${campaign.campaignId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-id': campaign.merchantId || 'default_merchant'
        },
        body: JSON.stringify({
          reason: 'TOO_RISKY',
          notes: 'Merchant rejected offer during executive review.'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reject campaign');
      }
      onCampaignUpdated?.(campaign.campaignId, 'REJECTED', 'Campaign rejected.');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const prod = campaign.targetProducts?.[0] || (campaign as any).product;
  const fin = campaign.financialAnalysis || ((campaign as any).financialSimulation ? {
    sellingPrice: (campaign as any).product?.sellingPrice ?? (campaign as any).financialSimulation?.grossRevenueAtList ?? (prod?.price || 0),
    cogs: (campaign as any).product?.cogs ?? null,
    cogsStatus: (campaign as any).product?.cogs ? 'VERIFIED' : 'ESTIMATED',
    unitShipping: 65,
    unitHandling: 25,
    totalVariableCost: ((campaign as any).product?.cogs ?? 0) + 90,
    currentContribution: (campaign as any).financialSimulation?.contributionBeforeDiscount ?? null,
    maxSafeDiscount: (campaign as any).offer?.maxSafeDiscount ?? 0,
    isDiscountSafe: (campaign as any).financialSimulation?.isMarginFloorPreserved ?? true
  } : undefined);
  const impact = campaign.expectedImpact || ((campaign as any).financialSimulation ? {
    targetAudienceCount: (campaign as any).targetAudience?.length ?? campaign.activeAudienceCount ?? (campaign as any).audience?.eligibleCount ?? 1,
    simulatedGrossRevenueDelta: (campaign as any).financialSimulation?.expectedRevenueLift ?? (campaign as any).financialSimulation?.grossRevenueAtDiscount ?? 0,
    simulatedDiscountCost: (campaign as any).financialSimulation?.simulatedDiscountCost ?? (campaign as any).financialSimulation?.totalContributionSacrificed ?? 0,
    simulatedNetContributionProfitDelta: (campaign as any).financialSimulation?.expectedNetProfitGain ?? (campaign as any).financialSimulation?.contributionAfterDiscount ?? 0
  } : undefined);
  const audience = (campaign as any).targetAudience || (campaign as any).audience?.customers || (campaign as any).audience || [];

  // Canonical offer headline: prefer the deterministic offerText from Profit-Safe Offer Service
  const offerHeadline =
    (campaign.offer as any)?.offerText ||
    (campaign.offer as any)?.description ||
    ((campaign.offer as any)?.offerValue
      ? (campaign.offer as any).offerType === 'SAFE_PERCENT_DISCOUNT'
        ? `${(campaign.offer as any).offerValue}% Off`
        : `₹${(campaign.offer as any).offerValue} Off`
      : campaign.offer?.offerType === 'NO_INCENTIVE'
        ? 'No Discount (Benefit Message)'
        : `₹${campaign.offer?.discountValue ?? 0} Off`);
  const offerDesc = (campaign.offer as any)?.description || (campaign.offer as any)?.offerText || 'Exclusive profit-safe offer';

  // ---- Defensive display helpers: never render NaN / undefined / blank money fields ----
  const safeCount = (v: any): number | string => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (v === null || v === undefined) return 0;
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const safeMoney = (v: any, signed = false): string => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      return `${signed && v >= 0 ? '+' : ''}₹${Math.round(v).toLocaleString('en-IN')}`;
    }
    return 'INSUFFICIENT DATA';
  };

  // Audience counts — canonical source: audience breakdown from campaign intelligence
  const targetIdentified = safeCount((campaign as any).__targetIdentified ?? (campaign as any).audience?.targetIdentified);
  const activeCount = safeCount(campaign.activeAudienceCount ?? (campaign as any).audience?.eligibleCount);
  const suppressedCount = safeCount((campaign as any).__suppressedCount ?? (campaign as any).audience?.suppressedCount ?? Math.max(0, Number(targetIdentified) - Number(activeCount)));

  const rationale = (campaign as any).explanation;
  const hasRationale = !!(rationale && (rationale.observation || rationale.proposedActionRationale || rationale.financialTradeoff));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-sans text-ink">
      <div className="bg-surface-1 border border-hairline-strong rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-hairline flex items-center justify-between bg-surface-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-xs bg-linear-primary/10 text-linear-primary-hover border border-linear-primary/30 font-bold">
                {campaign.campaignType}
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-xs border font-semibold ${
                campaign.status === 'APPROVED' ? 'bg-semantic-success/10 text-semantic-success border-semantic-success/30' :
                campaign.status === 'READY_FOR_REVIEW' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                'bg-surface-3 text-ink-subtle border-hairline'
              }`}>
                {campaign.status}
              </span>
              <TrustBadge tag="[RECOMMENDATION]" />
            </div>
            <h2 className="text-base font-semibold text-ink leading-snug">
              {campaign.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-3 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border-b border-rose-500/30 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-semantic-success/10 border-b border-semantic-success/30 text-semantic-success text-xs">
            {successMessage}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Target Product & Offer Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-surface-2 rounded-lg border border-hairline space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-ink-subtle">
                <span>Target Product</span>
                <TrustBadge tag="[OBSERVED]" />
              </div>
              <div className="text-sm font-semibold text-ink">{prod?.title || 'Catalog Target'}</div>
              <div className="flex items-center gap-3 text-ink-subtle font-mono text-[11px]">
                <span>Price: {safeMoney(prod?.price ?? (prod as any)?.sellingPrice)}</span>
                <span>Stock: {safeCount(prod?.stock ?? (prod as any)?.stockQuantity)} units</span>
              </div>
            </div>

            <div className="p-3.5 bg-surface-2 rounded-lg border border-hairline space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-ink-subtle">
                <span>Recommended Offer</span>
                <TrustBadge tag="[RECOMMENDATION]" />
              </div>
              <div className="text-sm font-semibold text-emerald-400">
                {offerHeadline}
              </div>
              <p className="text-[11px] text-ink-muted leading-tight">{offerDesc}</p>
            </div>
          </div>

          {/* Canonical Profit Protection Analysis */}
          {fin && (
            <div className="p-4 bg-surface-2 rounded-lg border border-hairline space-y-3">
              <div className="flex items-center justify-between border-b border-hairline pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">Profit Protection & Margin Floor Analysis</span>
                  <TrustBadge tag="[CALCULATED]" formula="Selling Price - COGS - Discount - Fulfillment" />
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  {fin.isDiscountSafe ? 'MARGIN FLOOR PRESERVED' : 'UNSAFE DISCOUNT'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                <div className="p-2 bg-surface-1 rounded border border-hairline">
                  <div className="text-[10px] text-ink-subtle">Selling Price</div>
                  <div className="text-xs font-bold text-ink mt-0.5">{safeMoney(fin.sellingPrice)}</div>
                </div>
                <div className="p-2 bg-surface-1 rounded border border-hairline">
                  <div className="text-[10px] text-ink-subtle">Unit COGS</div>
                  <div className="text-xs font-bold text-ink mt-0.5">
                    {fin.cogs !== null && fin.cogs !== undefined ? safeMoney(fin.cogs) : 'INSUFFICIENT DATA'}
                  </div>
                </div>
                <div className="p-2 bg-surface-1 rounded border border-hairline">
                  <div className="text-[10px] text-ink-subtle">Max Safe Discount</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">{safeMoney(fin.maxSafeDiscount)}</div>
                </div>
                <div className="p-2 bg-surface-1 rounded border border-hairline">
                  <div className="text-[10px] text-ink-subtle">Contribution Margin</div>
                  <div className="text-xs font-bold text-ink mt-0.5">
                    {fin.currentContribution !== null && fin.currentContribution !== undefined ? safeMoney(fin.currentContribution) : 'INSUFFICIENT DATA'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Financial Impact Simulation */}
          {impact && (
            <div className="p-4 bg-purple-500/5 rounded-lg border border-purple-500/20 space-y-3">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-purple-200">Financial Impact Simulation</span>
                  <TrustBadge tag="[SIMULATION]" />
                </div>
                <span className="text-[10px] font-mono text-purple-300">
                  Target Audience: {safeCount(impact.targetAudienceCount || campaign.activeAudienceCount)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2 bg-surface-1 rounded border border-hairline">
                  <div className="text-[10px] text-ink-subtle">Simulated Revenue Lift</div>
                  <div className="text-xs font-bold text-semantic-success mt-0.5">
                    {safeMoney(impact.simulatedGrossRevenueDelta, true)}
                  </div>
                </div>
                <div className="p-2 bg-surface-1 rounded border border-hairline">
                  <div className="text-[10px] text-ink-subtle">Worst-Case Discount Cost</div>
                  <div className="text-xs font-bold text-amber-400 mt-0.5">
                    {safeMoney(impact.simulatedDiscountCost)}
                  </div>
                </div>
                <div className="p-2 bg-surface-1 rounded border border-hairline">
                  <div className="text-[10px] text-ink-subtle">Net Contribution Delta</div>
                  <div className="text-xs font-bold text-purple-300 mt-0.5">
                    {safeMoney(impact.simulatedNetContributionProfitDelta, true)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Target Audience & Communication Eligibility Breakdown */}
          <div className="p-4 bg-surface-2 rounded-lg border border-hairline space-y-3">
            <div className="flex items-center justify-between border-b border-hairline pb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">Target Audience & Policy Eligibility</span>
                <TrustBadge tag="[OBSERVED]" formula="customer_event_stream + cooldown + purchase suppression" />
              </div>
              <span className="text-[10px] font-mono text-ink-subtle">
                {activeCount} of {targetIdentified} Eligible
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center font-mono">
              <div className="p-2 bg-surface-1 rounded border border-hairline">
                <div className="text-[10px] text-ink-subtle">Sourced Prospects</div>
                <div className="text-xs font-bold text-ink mt-0.5">{targetIdentified}</div>
              </div>
              <div className="p-2 bg-surface-1 rounded border border-hairline">
                <div className="text-[10px] text-ink-subtle">Eligible for Dispatch</div>
                <div className="text-xs font-bold text-emerald-400 mt-0.5">{activeCount}</div>
              </div>
              <div className="p-2 bg-surface-1 rounded border border-hairline">
                <div className="text-[10px] text-ink-subtle">Suppressed / Cooldown</div>
                <div className="text-xs font-bold text-amber-400 mt-0.5">{suppressedCount}</div>
              </div>
            </div>

            {audience && audience.length > 0 && (
              <div className="space-y-1.5 mt-2">
                <div className="text-[10px] font-medium text-ink-subtle uppercase tracking-wider">Audience Member Registry:</div>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                  {campaign.targetAudience.slice(0, 10).map((m: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-1.5 bg-surface-1 rounded border border-hairline text-[10px]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{m.customerName || `Customer #${m.customerId}`}</span>
                        <span className="text-ink-tertiary">({m.segment || 'PROSPECT'})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {m.isEligible ? (
                          <span className="text-emerald-400 font-bold">✓ ELIGIBLE</span>
                        ) : (
                          <span className="text-amber-400 font-medium" title={m.ineligibilityReason}>
                            ⚠️ {m.ineligibilityReason?.split(':')[0] || 'SUPPRESSED'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Explainability Block */}
          {rationale ? (
            <div className="p-3.5 bg-surface-2 rounded-lg border border-hairline space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">AI Decision Rationale</span>
                <TrustBadge tag="[MODEL ESTIMATE]" />
              </div>
              {hasRationale ? (
                <>
                  {rationale.observation ? (
                    <p className="text-ink-muted leading-relaxed">{rationale.observation}</p>
                  ) : null}
                  {rationale.proposedActionRationale ? (
                    <p className="text-ink-muted leading-relaxed">{rationale.proposedActionRationale}</p>
                  ) : null}
                  {rationale.financialTradeoff ? (
                    <p className="text-ink-muted leading-relaxed font-mono text-[11px] bg-surface-1 p-2 rounded border border-hairline">
                      Tradeoff: {rationale.financialTradeoff}
                    </p>
                  ) : null}
                  {rationale.risks && rationale.risks.length > 0 ? (
                    <p className="text-amber-300/80 leading-relaxed text-[11px]">
                      Risk: {rationale.risks.join(' ')}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-ink-subtle leading-relaxed font-mono text-[11px] bg-surface-1 p-2 rounded border border-hairline">
                  INSUFFICIENT DATA — no rationale recorded for this campaign. No AI explanation will be shown without canonical telemetry.
                </p>
              )}
            </div>
          ) : null}

          {/* Message Draft Preview */}
          {campaign.message?.email && (
            <div className="p-3.5 bg-surface-2 rounded-lg border border-hairline space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">Customer Email Presentation</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-xs bg-linear-primary/10 text-linear-primary-hover border border-linear-primary/30 font-bold">
                    multipart/alternative
                  </span>
                </div>
                
                {/* View Switcher Tabs */}
                <div className="flex items-center gap-1 bg-surface-1 p-0.5 rounded-md border border-hairline text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setEmailPreviewTab('html')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      emailPreviewTab === 'html'
                        ? 'bg-linear-primary text-white font-bold shadow-2xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    ✨ Rich HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailPreviewTab('text')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      emailPreviewTab === 'text'
                        ? 'bg-linear-primary text-white font-bold shadow-2xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    📄 Plain Text
                  </button>
                </div>
              </div>

              {emailPreviewTab === 'html' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-ink-subtle">
                    <span className="truncate">
                      <strong>Subject:</strong> {campaign.message.email.subject}
                    </span>
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('desktop')}
                        className={`px-1.5 py-0.5 rounded ${previewDevice === 'desktop' ? 'bg-surface-3 text-ink font-bold' : 'text-ink-subtle hover:text-ink'}`}
                      >
                        Desktop
                      </button>
                      <span>|</span>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('mobile')}
                        className={`px-1.5 py-0.5 rounded ${previewDevice === 'mobile' ? 'bg-surface-3 text-ink font-bold' : 'text-ink-subtle hover:text-ink'}`}
                      >
                        Mobile
                      </button>
                    </div>
                  </div>

                  <div className={`mx-auto transition-all duration-200 ${previewDevice === 'mobile' ? 'max-w-[360px]' : 'w-full'}`}>
                    <iframe
                      title="HTML Email Preview"
                      sandbox="allow-same-origin"
                      className="w-full h-80 rounded-md border border-hairline bg-slate-100 shadow-inner"
                      srcDoc={`
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <meta charset="utf-8">
                          <meta name="viewport" content="width=device-width, initial-scale=1.0">
                          <style>
                            body { margin: 0; padding: 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; }
                            .card { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                            .header { padding: 14px 20px; border-bottom: 1px solid #e2e8f0; text-align: center; background: #ffffff; }
                            .logo-box { display: inline-flex; align-items: center; gap: 6px; }
                            .bolt { background: #0066cc; color: #ffffff; width: 22px; height: 22px; border-radius: 4px; display: inline-block; text-align: center; line-height: 22px; font-size: 12px; font-weight: bold; }
                            .content { padding: 20px 24px; }
                            .headline { font-size: 18px; font-weight: 800; color: #0c2340; margin-bottom: 8px; line-height: 1.3; }
                            .greeting { font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
                            .body-text { font-size: 13px; color: #334155; line-height: 1.5; margin-bottom: 16px; white-space: pre-line; }
                            .product-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin: 14px 0; }
                            .prod-title { font-size: 13px; font-weight: 700; color: #0c2340; margin-bottom: 4px; }
                            .price-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
                            .final-price { font-size: 15px; font-weight: 800; color: #0f172a; }
                            .badge { background: #e0f2fe; color: #0066cc; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
                            .coupon { font-size: 11px; color: #475569; margin-top: 6px; }
                            .coupon code { background: #f1f5f9; color: #0066cc; padding: 2px 5px; border-radius: 3px; font-weight: bold; border: 1px dashed #93c5fd; }
                            .cta-wrap { text-align: center; margin: 20px 0 12px 0; }
                            .cta-btn { background: #0066cc; color: #ffffff !important; text-decoration: none; padding: 11px 24px; border-radius: 5px; font-weight: 700; font-size: 13px; display: inline-block; }
                            .footer { border-top: 1px solid #e2e8f0; background: #f8fafc; padding: 14px 20px; text-align: center; font-size: 10px; color: #64748b; line-height: 1.5; }
                          </style>
                        </head>
                        <body>
                          <div class="card">
                            <div class="header">
                              <div class="logo-box">
                                <span class="bolt">⚡</span>
                                <span style="font-weight: 800; font-size: 14px; color: #0c2340; letter-spacing: 0.5px;">SHOPI</span>
                                <span style="font-size: 8px; font-weight: 600; color: #64748b; letter-spacing: 1px;">• COMMERCE INTELLIGENCE</span>
                              </div>
                            </div>
                            <div class="content">
                              <div class="headline">${campaign.campaignType === 'CART_RECOVERY' ? 'Your cart is waiting for you' : 'Special Offer Reserved for You'}</div>
                              <div class="greeting">Hi ${((campaign as any).targetAudience?.[0]?.customerName || 'Valued Customer').split(' ')[0]},</div>
                              <div class="body-text">${(campaign.message.email.body || '').replace(/^(Hi|Hello|Hey)\s+[^,\n]+,?\s*\n*/i, '')}</div>
                              <div class="product-box">
                                <div class="prod-title">${(prod?.title === 'FORMAL-SHOE-006' || (prod as any)?.sku === 'FORMAL-SHOE-006') ? 'Classic Formal Oxford Shoe' : (prod?.title || 'Selected Product')}</div>

                                <div class="price-row">
                                  ${prod?.price ? `<span class="final-price">₹${Math.round(prod.price).toLocaleString('en-IN')}</span>` : ''}
                                  <span class="badge">${offerHeadline}</span>
                                </div>
                                ${campaign.offer?.couponSpec?.code || (campaign.offer as any)?.couponCode ? `
                                  <div class="coupon">Use code: <code>${campaign.offer?.couponSpec?.code || (campaign.offer as any)?.couponCode}</code> at checkout</div>
                                ` : ''}
                              </div>
                              <div class="cta-wrap">
                                <span class="cta-btn">${campaign.campaignType === 'CART_RECOVERY' ? 'Complete Your Purchase' : 'Claim Your Offer'} &rarr;</span>
                              </div>
                            </div>

                            <div class="footer">
                              <strong style="color: #0c2340;">Shopi • Powered by Razorpay AI Commerce</strong><br/>
                              This communication was sent regarding your recent activity on our store.<br/>
                              <span style="color: #94a3b8;">Manage communication preferences &bull; Unsubscribe</span>
                            </div>
                          </div>
                        </body>
                        </html>
                      `}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-surface-1 rounded border border-hairline space-y-2 font-mono text-[11px]">
                  <div className="text-ink font-semibold">Subject: {campaign.message.email.subject}</div>
                  <div className="text-ink-subtle whitespace-pre-line leading-relaxed border-t border-hairline pt-2">
                    {campaign.message.email.body}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Authorization Controls */}
        <div className="p-4 border-t border-hairline bg-surface-2 flex items-center justify-between">
          <div className="text-[11px] text-ink-subtle font-mono">
            {campaign.approvalAudit ? (
              <span>Approved by {campaign.approvalAudit.approvedBy} on {new Date(campaign.approvalAudit.approvedAt).toLocaleDateString()}</span>
            ) : (
              <span>Requires explicit human merchant authorization</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReject}
              disabled={isProcessing || campaign.status === 'REJECTED'}
              className="px-3 py-1.5 rounded-md border border-hairline hover:border-hairline-strong text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
            >
              Reject
            </button>
            {isApproved ? (
              <button
                onClick={handleDryRun}
                disabled={isProcessing}
                className="px-4 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors disabled:opacity-50 shadow-2xs"
              >
                {isProcessing ? 'Simulating...' : 'Execute Dry Run'}
              </button>
            ) : isPending ? (
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="px-4 py-1.5 rounded-md bg-linear-primary hover:bg-linear-primary-hover text-white font-medium transition-colors disabled:opacity-50 shadow-2xs"
              >
                {isProcessing ? 'Approving...' : 'Approve Campaign'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
