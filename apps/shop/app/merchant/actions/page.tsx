'use client';
import { merchantFetch } from '@/components/Merchant/merchantFetch';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '../../../components/Merchant/v2/PageHeader';
import { TrustBadge } from '../../../components/Merchant/v2/TrustBadge';
import { ActionDetailDrawer, ActionDetailItem } from '../../../components/Merchant/v2/ActionDetailDrawer';
import { CampaignDetailModal, CampaignModalData } from '../../../components/Merchant/v2/CampaignDetailModal';
import { normalizeCampaignForModal } from '../../../components/Merchant/v2/normalizeCampaign';
import { CopilotDrawer } from '../../../components/Merchant/v2/CopilotDrawer';
import { DeliveryChannelSelector, DeliveryChannel } from '../../../components/Merchant/v2/DeliveryChannelSelector';

interface ActionRecord extends ActionDetailItem {}

interface KpisData {
  totalActions: number;
  pendingCount: number;
  approvedCount: number;
  completedTodayCount: number;
  rejectedCount: number;
  expiredCount: number;
  rolledBackCount: number;
  totalVerifiedValueCreated: number;
  positiveOutcomeRatePct: number;
  verifiedActionCount?: number;
  pendingObservationCount?: number;
  verifiedRevenueDelta?: number;
  outcomeAlignmentPct?: number;
}

function getEntityLabel(productName?: string | null, productId?: number | string | null, targetType?: string, targetCustomer?: string): string {
  if (targetType === 'CUSTOMER' && targetCustomer) {
    return `Customer: ${targetCustomer}`;
  }
  if (productName && productName !== 'null' && productName !== 'undefined') {
    return productName;
  }
  if (productId !== null && productId !== undefined && String(productId) !== 'null' && String(productId) !== 'undefined' && Number(productId) > 0) {
    return `SKU-${productId}`;
  }
  return 'Catalog Scope';
}

export default function MerchantActionsPage() {
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignModalData[]>([]);
  const [activeDecisionTab, setActiveDecisionTab] = useState<'ALL' | 'MARKETING' | 'OPERATIONS' | 'LEDGER'>('ALL');
  const [kpis, setKpis] = useState<KpisData>({
    totalActions: 0,
    pendingCount: 0,
    approvedCount: 0,
    completedTodayCount: 0,
    rejectedCount: 0,
    expiredCount: 0,
    rolledBackCount: 0,
    totalVerifiedValueCreated: 0,
    positiveOutcomeRatePct: 0
  });
  const [selectedStatusTab, setSelectedStatusTab] = useState<'ALL' | 'NEEDS_APPROVAL' | 'OBSERVING' | 'COMPLETED' | 'ROLLED_BACK'>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedActionForDrawer, setSelectedActionForDrawer] = useState<ActionRecord | null>(null);
  const [selectedCampaignForModal, setSelectedCampaignForModal] = useState<CampaignModalData | null>(null);
  const [campaignSubFilter, setCampaignSubFilter] = useState<string>('ALL');
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  // Data-load failure state: surfaced INSTEAD of letting a failed backend call
  // render as a healthy-but-empty workspace ("0 pending decisions"). The
  // merchant must be able to tell "pipeline empty" from "pipeline broken".
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  // Merchant-selected delivery channels (Email ON by default preserves the
  // existing email workflow; WhatsApp is an independent toggle).
  const [selectedChannels, setSelectedChannels] = useState<DeliveryChannel[]>(['EMAIL']);
  const [whatsAppStatus, setWhatsAppStatus] = useState<any>(null);

  const handleToggleChannel = useCallback((channel: DeliveryChannel) => {
    setSelectedChannels(prev =>
      prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
    );
  }, []);

  const fetchDecisionData = useCallback(async () => {
    setIsFetching(true);
    setDataLoadError(null);
    try {
      const [actionsRes, campaignsRes] = await Promise.all([
        merchantFetch('/api/merchant/actions', { headers: { 'x-merchant-id': 'default_merchant' } }),
        // limit caps the payload of full campaign objects; the review ledger
        // renders a scrollable list so 100 is far beyond what is ever visible.
        merchantFetch('/api/merchant/campaigns/recommendations?limit=100', { headers: { 'x-merchant-id': 'default_merchant' } })
      ]);

      // Backend data-load failures must NEVER render as a healthy empty
      // workspace. 503 {recovering:true} means the Render DB is mid-recovery
      // (free-tier reset) — show an explicit retry banner; other non-OKs show
      // the error with a retry button.
      const loadErrors: string[] = [];
      if (!actionsRes.ok) {
        const aErr = await actionsRes.json().catch(() => ({ error: `Actions API returned ${actionsRes.status}` }));
        loadErrors.push(aErr.error || `Actions API returned ${actionsRes.status}`);
      }
      if (!campaignsRes.ok) {
        const cErr = await campaignsRes.json().catch(() => ({ error: `Campaigns API returned ${campaignsRes.status}` }));
        loadErrors.push(cErr.error || `Campaigns API returned ${campaignsRes.status}`);
      }
      if (loadErrors.length > 0) {
        setDataLoadError(loadErrors.join(' · '));
      }

      if (actionsRes.ok) {
        const aData = await actionsRes.json();
        if (aData.success && aData.actions) {
          setActions(aData.actions);
          if (aData.kpis) {
            setKpis({
              totalActions: aData.kpis.totalActions || aData.actions.length,
              pendingCount: aData.kpis.pendingCount ?? 0,
              approvedCount: aData.kpis.approvedCount ?? 0,
              completedTodayCount: aData.kpis.completedTodayCount ?? 0,
              rejectedCount: aData.kpis.rejectedCount ?? 0,
              expiredCount: aData.kpis.expiredCount ?? 0,
              rolledBackCount: aData.kpis.rolledBackCount ?? 0,
              totalVerifiedValueCreated: aData.kpis.totalVerifiedValueCreated ?? 0,
              positiveOutcomeRatePct: aData.kpis.positiveOutcomeRatePct ?? 0,
              verifiedActionCount: aData.kpis.verifiedActionCount,
              pendingObservationCount: aData.kpis.pendingObservationCount,
              verifiedRevenueDelta: aData.kpis.verifiedRevenueDelta,
              outcomeAlignmentPct: aData.kpis.outcomeAlignmentPct
            });
          }
        }
      }

      if (campaignsRes.ok) {
        const cData = await campaignsRes.json();
        if (cData.success && Array.isArray(cData.campaigns)) {
          setCampaigns(cData.campaigns.map(normalizeCampaignForModal).filter(Boolean) as CampaignModalData[]);
        }
      }
    } catch (err: any) {
      console.warn('Failed to fetch decision data:', err.message);
      setDataLoadError(err.message || 'Failed to load decision data — the backend may be unreachable.');
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchDecisionData();
  }, [fetchDecisionData]);

  // Open action or campaign modal automatically if specified in query params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const actionIdParam = params.get('actionId') || params.get('open');
      const campIdParam = params.get('campaignId');

      if (actionIdParam && actions.length > 0) {
        const target = actions.find(a => a.actionId === actionIdParam) || (actionIdParam === 'first' ? actions[0] : null);
        if (target) setSelectedActionForDrawer(target);
      }
      if (campIdParam && campaigns.length > 0) {
        const targetCamp = campaigns.find(c => c.campaignId === campIdParam);
        if (targetCamp) setSelectedCampaignForModal(targetCamp);
      }
    }
  }, [actions, campaigns]);

  const handleActionUpdated = (actionId: string, newStatus: string, message: string) => {
    setFeedbackToast({ message, type: 'success' });
    setTimeout(() => setFeedbackToast(null), 4000);
    fetchDecisionData();
    if (selectedActionForDrawer && selectedActionForDrawer.actionId === actionId) {
      setSelectedActionForDrawer(prev => prev ? { ...prev, status: newStatus as any } : null);
    }
  };

  const handleCampaignUpdated = (campaignId: string, newStatus: string, message: string) => {
    setFeedbackToast({ message, type: 'success' });
    setTimeout(() => setFeedbackToast(null), 4000);
    fetchDecisionData();
    if (selectedCampaignForModal && selectedCampaignForModal.campaignId === campaignId) {
      setSelectedCampaignForModal(prev => prev ? { ...prev, status: newStatus as any } : null);
    }
  };

  const handleQuickApproveAction = async (actionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await merchantFetch(`/api/merchant/actions/${actionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-merchant-id': 'default_merchant' },
        body: JSON.stringify({ approvedBy: 'merchant_admin' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        handleActionUpdated(actionId, 'COMPLETED', data.message || 'Action executed successfully.');
      } else {
        setFeedbackToast({ message: data.error || 'Approval failed.', type: 'error' });
      }
    } catch (err: any) {
      setFeedbackToast({ message: `Error: ${err.message}`, type: 'error' });
    }
  };

  const handleQuickApproveCampaign = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Frontend guard: zero channels blocks the launch. The backend re-validates.
    if (selectedChannels.length === 0) {
      setFeedbackToast({ message: 'Select at least one delivery channel.', type: 'error' });
      return;
    }
    try {
      const res = await merchantFetch(`/api/merchant/campaigns/${campaignId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-merchant-id': 'default_merchant' },
        body: JSON.stringify({ approvedBy: 'merchant_admin', deliveryChannels: selectedChannels })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        handleCampaignUpdated(campaignId, 'APPROVED', data.message || 'Campaign approved successfully.');
        // The backend now executes the campaign IN REAL TIME on approval
        // (PRODUCTION mode) — the dispatch results are already in this
        // response, so no follow-up dry-run call is made.
        const exec = data.execution || null;
        if (exec) {
          const parts: string[] = [];
          if (selectedChannels.includes('EMAIL')) parts.push(`Email: ${exec.sentCount ?? 0} sent${exec.failedCount ? `, ${exec.failedCount} failed` : ''}`);
          if (selectedChannels.includes('WHATSAPP')) parts.push(`WhatsApp: ${exec.sentCount ?? 0} dispatched${exec.failedCount ? `, ${exec.failedCount} failed` : ''}`);
          if (exec.isDryRun) parts.push('(simulated — providers not LIVE-configured)');
          if (parts.length) {
            setFeedbackToast({ message: `Campaign dispatched — ${parts.join(' · ')}`, type: 'success' });
            handleCampaignUpdated(campaignId, 'COMPLETED' as any, `Campaign executed — ${parts.join(' · ')}`);
          }
        } else {
          setFeedbackToast({ message: 'Approved. Dispatch result unavailable — check the campaign status.', type: 'success' });
        }
      } else {
        setFeedbackToast({ message: data.error || 'Campaign approval failed.', type: 'error' });
      }
    } catch (err: any) {
      setFeedbackToast({ message: `Error: ${err.message}`, type: 'error' });
    }
  };

  // Pending Actions & Campaigns
  const pendingActions = useMemo(() => {
    return actions.filter(a => a.status === 'PENDING_APPROVAL');
  }, [actions]);

  const pendingCampaigns = useMemo(() => {
    return campaigns.filter(c => c.status === 'READY_FOR_REVIEW' || c.status === 'DRAFT');
  }, [campaigns]);

  const filteredPendingCampaigns = useMemo(() => {
    if (campaignSubFilter === 'ALL') return pendingCampaigns;
    return pendingCampaigns.filter(c => c.campaignType === campaignSubFilter);
  }, [pendingCampaigns, campaignSubFilter]);

  const totalPendingDecisions = pendingActions.length + pendingCampaigns.length;

  // Active Observation Actions
  const observingActions = useMemo(() => {
    return actions.filter(a => a.status === 'COMPLETED' && a.outcome?.outcomeStatus === 'PENDING');
  }, [actions]);

  // Filtered Actions for History Ledger
  const filteredLedgerActions = useMemo(() => {
    return actions.filter(a => {
      if (selectedStatusTab === 'NEEDS_APPROVAL' && a.status !== 'PENDING_APPROVAL') return false;
      if (selectedStatusTab === 'OBSERVING' && !(a.status === 'COMPLETED' && a.outcome?.outcomeStatus === 'PENDING')) return false;
      if (selectedStatusTab === 'COMPLETED' && a.status !== 'COMPLETED') return false;
      if (selectedStatusTab === 'ROLLED_BACK' && a.status !== 'ROLLED_BACK') return false;

      if (selectedTypeFilter !== 'ALL' && a.actionType !== selectedTypeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = a.productName?.toLowerCase().includes(q);
        const matchId = a.actionId.toLowerCase().includes(q);
        const matchReason = a.reason.toLowerCase().includes(q);
        return matchName || matchId || matchReason;
      }
      return true;
    });
  }, [actions, selectedStatusTab, selectedTypeFilter, searchQuery]);

  const handleExport = () => {
    const csvHeader = 'Decision ID,Type,Target Entity,Status,Expected Revenue Delta (INR),Observed Revenue Delta (INR),Variance %,Created At\n';
    const rows = filteredLedgerActions
      .map((a) => {
        const exp = a.outcome?.expectedImpact?.expectedRevenueDelta ?? 'N/A';
        const obs = a.outcome?.actualImpact?.observedRevenueDelta ?? 'N/A';
        const varPct = a.outcome?.impactDeltaPct ?? 'N/A';
        return `${a.actionId},${a.actionType},"${getEntityLabel(a.productName, a.productId)}",${a.status},${exp},${obs},${varPct},${a.createdAt}`;
      })
      .join('\n');
    const blob = new Blob([csvHeader + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'merchant_decision_center_ledger.csv';
    link.click();
  };

  return (
    <div className="space-y-6 font-sans text-ink">
      {/* 1. Page Header */}
      <PageHeader
        title="AI Decision & Outcome Control Center"
        subtitle="Unified merchant decision hub: profit-safe marketing campaigns, operational inventory replenishment, and human-in-the-loop authorization."
        onExport={handleExport}
      />

      {/* Toast Notification */}
      {feedbackToast && (
        <div
          className={`p-3 rounded-md text-xs font-medium flex items-center justify-between shadow-2xs border ${
            feedbackToast.type === 'success'
              ? 'bg-semantic-success/10 text-semantic-success border-semantic-success/30'
              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
          }`}
        >
          <span>{feedbackToast.message}</span>
          <button onClick={() => setFeedbackToast(null)} className="underline text-xs ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Data-load failure banner: an unreachable/errored backend must not
          masquerade as an empty workspace. Shown only while the error
          persists; dismissed automatically on a successful refetch. */}
      {dataLoadError && (
        <div className="p-3 rounded-md text-xs font-medium flex items-center justify-between shadow-2xs border bg-amber-500/10 text-amber-300 border-amber-500/30">
          <span>
            Decision data could not be fully loaded from the commerce backend: {dataLoadError}
            {dataLoadError.includes('restored') || dataLoadError.includes('recover')
              ? ' — the database is being restored automatically; retry in a few seconds.'
              : ''}
          </span>
          <button
            onClick={() => fetchDecisionData()}
            className="underline text-xs ml-2 whitespace-nowrap"
          >
            Retry now
          </button>
        </div>
      )}

      {/* 2. Executive Decision Posture Banner */}
      <div className="bg-surface-1 border border-hairline hover:border-hairline-strong rounded-lg p-5 transition-colors space-y-4">
        {isFetching ? (
          <div className="flex items-center gap-3 py-8">
            <span className="w-5 h-5 rounded-full border-2 border-ink-subtle border-t-transparent animate-spin" />
            <span className="text-sm text-ink-subtle font-medium">
              Synchronizing live campaign intelligence from the commerce ledger…
            </span>
          </div>
        ) : (
        <>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-hairline">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[11px] font-medium text-ink-subtle uppercase tracking-[0.4px] font-display">
                Decision Governance Posture
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {totalPendingDecisions} PENDING DECISIONS ({pendingCampaigns.length} Campaigns, {pendingActions.length} Actions)
              </span>
              <TrustBadge tag="[FACT]" />
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-2xl sm:text-3xl font-semibold font-mono text-ink tracking-tight">
                {kpis.approvedCount} Executed Decisions
              </div>
              <div className="text-xs font-mono font-medium text-ink-subtle">
                Approved + completed historical actions ({kpis.rejectedCount} rejected, {kpis.expiredCount} expired). {pendingCampaigns.length} campaigns staged and awaiting first approval.
              </div>
            </div>
          </div>

          {/* Secondary Pillars */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Pending Approvals</span>
                <TrustBadge tag="[OBSERVED]" />
              </div>
              <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                {totalPendingDecisions}
              </div>
              <div className="text-[10px] text-ink-tertiary font-mono mt-0.5">Human sign-off req.</div>
            </div>

            <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Campaign Proposals</span>
                <TrustBadge tag="[CALCULATED]" />
              </div>
              <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                {campaigns.length}
              </div>
              <div className="text-[10px] text-emerald-400/80 font-mono mt-0.5">Profit-safe recovery</div>
            </div>

            <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Positive Outcomes</span>
                <TrustBadge tag="[CALCULATED]" />
              </div>
              <div className="text-sm font-bold font-mono text-linear-primary-hover mt-0.5">
                {kpis.positiveOutcomeRatePct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-ink-tertiary font-mono mt-0.5">
                of {kpis.verifiedActionCount ?? 0} evaluated 14d outcomes
              </div>
            </div>

            <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Rolled Back</span>
                <TrustBadge tag="[OBSERVED]" />
              </div>
              <div className="text-sm font-bold font-mono text-ink mt-0.5">
                {kpis.rolledBackCount}
              </div>
              <div className="text-[10px] text-ink-tertiary font-mono mt-0.5">Reversible actions</div>
            </div>
          </div>
        </div>

        {/* AI Decision Governance Guidance Banner */}
        <div className="flex items-start gap-3 bg-surface-2 p-3.5 rounded-md border border-hairline text-xs">
          <div className="p-1 bg-linear-primary/10 border border-linear-primary/20 text-linear-primary rounded shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink uppercase tracking-[0.4px] text-[11px] font-display">
                AI Decision Governance Status
              </span>
              <TrustBadge tag="[AI INSIGHT]" />
            </div>
            <p className="text-ink-muted leading-relaxed font-body">
              {totalPendingDecisions} decisions require explicit merchant authorization.
              <span className="font-semibold text-ink"> Marketing Campaigns: {campaigns.length} Staged</span> &bull;
              <span className="font-semibold text-amber-300"> Pending Review: {pendingCampaigns.length}</span> &bull;
              <span className="font-semibold text-emerald-400"> 15% Minimum Margin Floor Enforced Across All Offers</span>.
            </p>
          </div>
        </div>
        </>
        )}
      </div>

      {/* 3. Decision Workstream Tabs */}
      <div className="flex items-center justify-between border-b border-hairline pb-2">
        <div className="inline-flex rounded-md border border-hairline bg-surface-2 p-0.5">
          <button
            onClick={() => setActiveDecisionTab('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
              activeDecisionTab === 'ALL'
                ? 'bg-surface-3 text-ink font-semibold border border-hairline-strong shadow-2xs'
                : 'text-ink-subtle hover:text-ink'
            }`}
          >
            All Decision Streams ({totalPendingDecisions})
          </button>
          <button
            onClick={() => setActiveDecisionTab('MARKETING')}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
              activeDecisionTab === 'MARKETING'
                ? 'bg-surface-3 text-ink font-semibold border border-hairline-strong shadow-2xs'
                : 'text-ink-subtle hover:text-ink'
            }`}
          >
            Marketing Campaigns ({campaigns.length})
          </button>
          <button
            onClick={() => setActiveDecisionTab('OPERATIONS')}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
              activeDecisionTab === 'OPERATIONS'
                ? 'bg-surface-3 text-ink font-semibold border border-hairline-strong shadow-2xs'
                : 'text-ink-subtle hover:text-ink'
            }`}
          >
            Operational Actions ({actions.length})
          </button>
          <button
            onClick={() => setActiveDecisionTab('LEDGER')}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
              activeDecisionTab === 'LEDGER'
                ? 'bg-surface-3 text-ink font-semibold border border-hairline-strong shadow-2xs'
                : 'text-ink-subtle hover:text-ink'
            }`}
          >
            Historical Ledger
          </button>
        </div>

        <button
          onClick={() => setIsCopilotOpen(true)}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-linear-primary/10 border border-linear-primary/30 text-linear-primary-hover hover:bg-linear-primary/20 transition-colors flex items-center gap-1.5 font-mono"
        >
          <span>⚡</span> Ask Copilot
        </button>
      </div>

      {/* 4. Marketing Campaign Proposals Queue */}
      {(activeDecisionTab === 'ALL' || activeDecisionTab === 'MARKETING') && pendingCampaigns.length > 0 && (
        <div className="bg-surface-1 p-5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors space-y-4">
          {/* Delivery channel selection + WhatsApp connection status (above the campaign list) */}
          <DeliveryChannelSelector
            selectedChannels={selectedChannels}
            onToggleChannel={handleToggleChannel}
            whatsAppStatus={whatsAppStatus}
            onWhatsAppStatusChange={setWhatsAppStatus}
          />

          <div className="flex items-center justify-between pb-3 border-b border-hairline">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
                Profit-Safe Marketing Campaigns Ready for Review ({filteredPendingCampaigns.length})
              </h3>
              <TrustBadge tag="[RECOMMENDATION]" />
            </div>
            <span className="text-[11px] text-emerald-400 font-mono font-medium">
              15% Contribution Margin Floor Protected
            </span>
          </div>

          {/* Sub-Filter Stream Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap pb-1">
            {[
              { id: 'ALL', label: 'All Campaigns', count: pendingCampaigns.length },
              { id: 'HIGH_INTENT_PRODUCT', label: 'High Intent', count: pendingCampaigns.filter(c => c.campaignType === 'HIGH_INTENT_PRODUCT').length },
              { id: 'CART_RECOVERY', label: 'Cart Drops', count: pendingCampaigns.filter(c => c.campaignType === 'CART_RECOVERY').length },
              { id: 'CHECKOUT_RECOVERY', label: 'Checkout Drops', count: pendingCampaigns.filter(c => c.campaignType === 'CHECKOUT_RECOVERY').length },
              { id: 'REPEAT_RETENTION', label: 'Repeat Retention', count: pendingCampaigns.filter(c => c.campaignType === 'REPEAT_RETENTION').length },
              { id: 'VIP_CONCIERGE', label: 'VIP Concierge', count: pendingCampaigns.filter(c => c.campaignType === 'VIP_CONCIERGE').length },
              { id: 'DORMANT_REACTIVATION', label: 'Dormant Win-Back', count: pendingCampaigns.filter(c => c.campaignType === 'DORMANT_REACTIVATION').length },
            ].map((subTab) => (
              <button
                key={subTab.id}
                onClick={() => setCampaignSubFilter(subTab.id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  campaignSubFilter === subTab.id
                    ? 'bg-surface-3 text-ink font-semibold border border-hairline-strong shadow-2xs'
                    : 'bg-surface-2 text-ink-subtle hover:text-ink border border-hairline'
                }`}
              >
                {subTab.label} ({subTab.count})
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPendingCampaigns.slice(0, 12).map((camp) => {
              const targetProd = (camp as any).product || camp.targetProducts?.[0];
              const sellingPrice = targetProd?.sellingPrice ?? targetProd?.price ?? 0;
              const cogs = targetProd?.cogsUnitCost ?? targetProd?.cogs ?? null;
              const offerValueText = (camp.offer as any)?.offerText || ((camp.offer as any)?.offerValue ? `${(camp.offer as any).offerValue}% OFF` : (camp.offer?.offerType === 'NO_INCENTIVE' ? 'No Discount' : `₹${camp.offer?.discountValue} OFF`));
              const isSafe = (camp.offer as any)?.safetyStatus === 'SAFE' || (camp as any).financialSimulation?.isMarginFloorPreserved || (camp.offer?.isFinanciallySafe ?? true);
              const eligibleCount = (camp as any).audience?.eligibleCount ?? camp.activeAudienceCount ?? 1;
              const sourcedCount = (camp as any).audience?.targetIdentified ?? (camp as any).targetAudience?.length ?? eligibleCount;
              const suppressedCount = (camp as any).audience?.suppressedCount ?? Math.max(0, sourcedCount - eligibleCount);
              const explanationText = (camp as any).explanation?.observed || (camp as any).explanation?.recommendation || camp.explanation?.observation || (camp.offer as any)?.offerText || 'Profit-safe customer incentive recommendation.';

              return (
                <div
                  key={camp.campaignId}
                  className="bg-surface-2 border border-hairline hover:border-hairline-strong rounded-lg p-4 space-y-3 flex flex-col justify-between transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex px-2 py-0.5 text-[10px] font-mono font-bold rounded-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {camp.campaignType}
                      </span>
                      <span className="text-[10px] font-mono text-ink-subtle">
                        {targetProd?.sku || (targetProd?.productId ? `SKU-${targetProd.productId}` : 'CATALOG')}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-ink line-clamp-1">
                        {camp.title}
                      </h4>
                      <p className="text-[11px] text-ink-subtle leading-relaxed mt-1 line-clamp-2 font-body">
                        {explanationText}
                      </p>
                    </div>

                    {/* Financial Economics & Margin Floor Badge */}
                    <div className="p-2.5 bg-surface-1 rounded border border-hairline space-y-1.5 font-mono text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-ink-subtle">Selling Price:</span>
                        <span className="font-bold text-ink">₹{sellingPrice}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-ink-subtle">Unit COGS:</span>
                        <span className="font-bold text-ink">{cogs !== null && cogs !== undefined ? `₹${cogs}` : 'Unavailable'}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-hairline pt-1">
                        <span className="text-ink-subtle">Offer Value:</span>
                        <span className="font-bold text-emerald-400">
                          {offerValueText}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-ink-tertiary">Margin Floor (15%):</span>
                        <span className="text-emerald-400 font-bold">
                          {isSafe ? '✓ PRESERVED' : '⚠️ VIOLATED'}
                        </span>
                      </div>
                    </div>

                    {/* Audience Breakdown */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-ink-subtle pt-1">
                      <span>Eligible: <strong className="text-emerald-400">{eligibleCount}</strong></span>
                      <span>Sourced: <strong>{sourcedCount}</strong></span>
                      <span>Suppressed: <strong className="text-amber-400">{suppressedCount}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-hairline">
                    <button
                      onClick={() => setSelectedCampaignForModal(camp)}
                      className="flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-hairline hover:border-hairline-strong bg-surface-1 text-ink transition-colors text-center"
                    >
                      Review Campaign
                    </button>
                    <button
                      onClick={(e) => handleQuickApproveCampaign(camp.campaignId, e)}
                      disabled={selectedChannels.length === 0}
                      title={selectedChannels.length === 0 ? 'Select at least one delivery channel above' : `Will send via: ${selectedChannels.join(' + ')}`}
                      className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-2xs text-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                    >
                      Approve &amp; Launch
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Operational Pending Decisions Queue */}
      {(activeDecisionTab === 'ALL' || activeDecisionTab === 'OPERATIONS') && pendingActions.length > 0 && (
        <div className="bg-surface-1 p-5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-hairline">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
                Operational & Restock Actions ({pendingActions.length})
              </h3>
              <TrustBadge tag="[OBSERVED]" />
            </div>
            <span className="text-[11px] text-amber-300 font-mono font-medium">
              Human Sign-Off Required
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingActions.map((action) => (
              <div
                key={action.actionId}
                className="bg-surface-2 border border-hairline hover:border-hairline-strong rounded-lg p-4 space-y-3 flex flex-col justify-between transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex px-2 py-0.5 text-[10px] font-mono font-bold rounded-xs bg-linear-primary/10 text-linear-primary-hover border border-linear-primary/30">
                      {action.actionType}
                    </span>
                    <span className="text-[10px] font-mono text-ink-subtle">
                      {action.productId ? `SKU-${action.productId}` : 'CATALOG'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-ink line-clamp-1">
                      {getEntityLabel(action.productName, action.productId)}
                    </h4>
                    <p className="text-[11px] text-ink-subtle leading-relaxed mt-1 line-clamp-2 font-body">
                      {action.reason}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-hairline text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-ink-subtle">Expected Delta:</span>
                      <div className="font-semibold text-semantic-success">
                        {action.outcome?.expectedImpact?.expectedRevenueDelta !== undefined
                          ? `+₹${action.outcome.expectedImpact.expectedRevenueDelta.toLocaleString('en-IN')}`
                          : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-subtle">Confidence:</span>
                      <div className="font-semibold text-ink">
                        {action.outcome?.confidenceAtRecommendation !== undefined
                          ? `${Math.round(action.outcome.confidenceAtRecommendation * 100)}%`
                          : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-hairline">
                  <button
                    onClick={() => setSelectedActionForDrawer(action)}
                    className="flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-hairline hover:border-hairline-strong bg-surface-1 text-ink transition-colors text-center"
                  >
                    Review Audit
                  </button>
                  <button
                    onClick={(e) => handleQuickApproveAction(action.actionId, e)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md bg-linear-primary hover:bg-linear-primary-hover text-white transition-colors shadow-2xs text-center"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Historical Decision & Outcome Ledger */}
      {(activeDecisionTab === 'ALL' || activeDecisionTab === 'LEDGER') && (
        <div className="bg-surface-1 p-5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-hairline">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-subtle" />
              <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
                Historical Decision & Outcome Ledger
              </h3>
              <TrustBadge tag="[FACT]" />
            </div>
            <p className="text-[10px] text-ink-tertiary font-mono">
              Immutable audit record of every executed, rejected, expired and rolled-back decision. &ldquo;—&rdquo; means no impact was recorded for that field; &ldquo;historical&rdquo; marks records whose SKU predates the current catalog.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-md border border-hairline bg-surface-2 p-0.5">
                {(['ALL', 'NEEDS_APPROVAL', 'OBSERVING', 'COMPLETED', 'ROLLED_BACK'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSelectedStatusTab(tab)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors ${
                      selectedStatusTab === tab
                        ? 'bg-surface-3 text-ink font-semibold border border-hairline-strong shadow-2xs'
                        : 'text-ink-subtle hover:text-ink'
                    }`}
                  >
                    {tab === 'ALL'
                      ? 'All'
                      : tab === 'NEEDS_APPROVAL'
                      ? 'Needs Approval'
                      : tab === 'OBSERVING'
                      ? 'Observing'
                      : tab === 'COMPLETED'
                      ? 'Completed'
                      : 'Rolled Back'}
                  </button>
                ))}
              </div>

              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="text-xs bg-surface-2 border border-hairline text-ink rounded-md px-2.5 py-1 focus:outline-none focus:border-linear-primary font-mono"
              >
                <option value="ALL">All Types</option>
                <option value="RESTOCK">Restock</option>
                <option value="DISCOUNT">Discount</option>
                <option value="PROMOTION">Promotion</option>
              </select>

              <input
                type="text"
                placeholder="Search decision or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs bg-surface-2 border border-hairline text-ink placeholder-ink-tertiary rounded-md px-3 py-1 w-36 sm:w-44 focus:outline-none focus:border-linear-primary font-mono"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-hairline text-[11px] font-medium text-ink-subtle bg-surface-2/60">
                  <th className="py-2.5 px-3 min-w-[180px]">Decision & Target Entity</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Expected Impact</th>
                  <th className="py-2.5 px-3 text-right">Observed Outcome</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                  <th className="py-2.5 px-3 text-center">Outcome Status</th>
                  <th className="py-2.5 pl-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline text-ink-muted font-mono">
                {filteredLedgerActions.map((action) => {
                  const isItemPending = action.status === 'PENDING_APPROVAL';
                  const isItemCompleted = action.status === 'COMPLETED';
                  const outcomeStatus = action.outcome?.outcomeStatus || (isItemPending ? 'AWAITING_APPROVAL' : 'COMPLETED');
                  const isWindowActive = isItemCompleted && outcomeStatus === 'PENDING';

                  return (
                    <tr
                      key={action.actionId}
                      onClick={() => setSelectedActionForDrawer(action)}
                      className="hover:bg-surface-2/60 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-semibold text-ink line-clamp-1">
                          {getEntityLabel(action.productName, action.productId)}
                          {action.productId !== null && action.productId !== undefined && Number(action.productId) > 1000 && (
                            <span
                              className="ml-1.5 text-[9px] font-mono uppercase tracking-wide text-ink-tertiary border border-hairline rounded-xs px-1 py-0.5"
                              title="This record predates the current 77-SKU catalog and is preserved for audit completeness."
                            >
                              historical
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-ink-tertiary font-mono">
                          {action.productId ? `SKU-${action.productId}` : 'CATALOG'} &bull; <span className="opacity-60">{action.actionId.slice(0, 16)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <span className="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-xs bg-surface-2 text-ink-subtle border border-hairline">
                          {action.actionType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ink">
                        {action.outcome?.expectedImpact?.expectedRevenueDelta !== undefined
                          ? `+₹${action.outcome.expectedImpact.expectedRevenueDelta.toLocaleString('en-IN')}`
                          : <span className="text-ink-tertiary font-normal">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-linear-primary-hover">
                        {action.outcome?.actualImpact?.observedRevenueDelta !== undefined
                          ? `+₹${action.outcome.actualImpact.observedRevenueDelta.toLocaleString('en-IN')}`
                          : isWindowActive
                          ? <span className="text-amber-400/90 font-normal">Outcome pending</span>
                          : <span className="text-ink-tertiary font-normal">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold">
                        {action.outcome?.impactDeltaPct !== undefined ? (
                          <span className={action.outcome.impactDeltaPct >= 0 ? 'text-semantic-success' : 'text-rose-400'}>
                            {action.outcome.impactDeltaPct > 0 ? '+' : ''}
                            {action.outcome.impactDeltaPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-ink-tertiary font-normal">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 text-[10px] font-sans font-medium rounded-xs border ${
                            outcomeStatus === 'POSITIVE'
                              ? 'bg-semantic-success/10 text-semantic-success border-semantic-success/30'
                              : outcomeStatus === 'NEGATIVE'
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                              : outcomeStatus === 'ROLLED_BACK'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {outcomeStatus === 'PENDING' ? 'OBSERVING' : outcomeStatus}
                        </span>
                      </td>
                      <td className="py-2.5 pl-3 pr-4 text-right">
                        {isItemPending ? (
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleQuickApproveAction(action.actionId, e)}
                              className="px-2.5 py-1 text-xs font-medium rounded-md bg-linear-primary hover:bg-linear-primary-hover text-white transition-colors shadow-2xs"
                            >
                              Approve
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedActionForDrawer(action)}
                            className="px-2.5 py-1 text-xs font-medium text-ink border border-hairline rounded-md bg-surface-2 hover:bg-surface-3 transition-colors"
                          >
                            Audit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Action Detail Drawer */}
      <ActionDetailDrawer
        action={selectedActionForDrawer}
        isOpen={!!selectedActionForDrawer}
        onClose={() => setSelectedActionForDrawer(null)}
        onActionUpdated={handleActionUpdated}
      />

      {/* 8. Campaign Detail Modal */}
      <CampaignDetailModal
        campaign={selectedCampaignForModal}
        isOpen={!!selectedCampaignForModal}
        onClose={() => setSelectedCampaignForModal(null)}
        onCampaignUpdated={handleCampaignUpdated}
      />

      {/* 9. AI Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />
    </div>
  );
}
