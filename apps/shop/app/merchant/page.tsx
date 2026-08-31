'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../components/Merchant/v2/PageHeader';
import { AnalyticalChartCard } from '../../components/Merchant/v2/AnalyticalChartCard';
import { AudienceIntelligencePanel } from '../../components/Merchant/v2/AudienceIntelligencePanel';
import { TrustBadge } from '../../components/Merchant/v2/TrustBadge';
import { ActionDetailDrawer, ActionDetailItem } from '../../components/Merchant/v2/ActionDetailDrawer';
import { CampaignDetailModal, CampaignModalData } from '../../components/Merchant/v2/CampaignDetailModal';
import { normalizeCampaignForModal } from '../../components/Merchant/v2/normalizeCampaign';
import { CopilotDrawer } from '../../components/Merchant/v2/CopilotDrawer';
import { formatSignPercentage, getGrowthColorClass } from '../../components/Merchant/v2/formatters';
import { SkeletonBlock, SkeletonCard } from '../../components/Merchant/v2/SkeletonBlock';

interface ActionRecord extends ActionDetailItem {}

export default function MerchantOverviewPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('last_30_days');
  const [comparisonMode, setComparisonMode] = useState<string>('previous_period');
  const [salesInterval, setSalesInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false); // true after first successful fetch
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [selectedActionForDrawer, setSelectedActionForDrawer] = useState<ActionRecord | null>(null);
  const [selectedCampaignForModal, setSelectedCampaignForModal] = useState<CampaignModalData | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Executive Business Health Metrics (Grounding from live database)
  const [overviewMetrics, setOverviewMetrics] = useState<{
    grossRevenue: number;
    netRevenue: number;
    totalOrders: number;
    aov: number;
    netMarginPct: number;
    revenueDeltaPct: number | null;
    ordersDeltaPct: number | null;
    aovDeltaPct: number | null;
    marginDeltaPct: number | null;
    trappedCapital: number;
    previousPeriodGrossRevenue: number;
  }>({
    grossRevenue: 0,
    netRevenue: 0,
    totalOrders: 0,
    aov: 0,
    netMarginPct: 0,
    revenueDeltaPct: null,
    ordersDeltaPct: null,
    aovDeltaPct: null,
    marginDeltaPct: null,
    trappedCapital: 0,
    previousPeriodGrossRevenue: 0
  });

  // Business Health Score from BusinessHealthScoreEngine
  const [healthScore, setHealthScore] = useState<{
    overallScore: number;
    overallStatus: string;
    dimensions: Array<{
      dimension: string;
      name: string;
      score: number;
      status: string;
      positiveDrivers?: string[];
      negativeDrivers?: string[];
    }>;
    highestImpactIssue?: {
      description: string;
      recommendedAction: string;
    };
  }>({
    overallScore: 0,
    overallStatus: 'EVALUATING',
    dimensions: []
  });

  // Discovered Opportunities from Opportunity Engine
  const [opportunities, setOpportunities] = useState<any[]>([]);
  // Staged Marketing Campaigns from CampaignBuilderService
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [pendingActions, setPendingActions] = useState<ActionRecord[]>([]);
  // null = loading/not yet fetched, string = live brief from backend, false = fetch failed
  const [aiExecutiveBrief, setAiExecutiveBrief] = useState<string | null | false>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [comparisonLabel, setComparisonLabel] = useState<string>('vs Preceding 30 Days (T-30 to T-60)');

  const fetchOverviewData = useCallback(async (opts?: { silent?: boolean }) => {
    // Silent refreshes keep the previous numbers on screen (stale-while-
    // revalidate) instead of flashing skeletons, so merchants never see the
    // dashboard "reset" while a background sync runs.
    if (!opts?.silent) {
      setIsFetching(true);
      setFetchError(null);
      setAiExecutiveBrief(null); // reset to loading state on every fetch
    }
    try {
      const res = await fetch(`/api/merchant/overview?period=${selectedPeriod}&compare=${comparisonMode}`, {
        headers: { 'x-merchant-id': 'default_merchant' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHasLoaded(true);
        if (data.kpis) {
          setOverviewMetrics({
            grossRevenue: data.kpis.grossRevenue ?? 0,
            netRevenue: data.kpis.netRevenue ?? 0,
            totalOrders: data.kpis.totalOrders ?? data.kpis.ordersCount ?? 0,
            aov: data.kpis.averageOrderValue ?? 0,
            netMarginPct: data.kpis.netMarginPct ?? 0,
            revenueDeltaPct: data.kpis.revenueGrowthPct ?? data.comparison?.growth?.revenueChangePct ?? null,
            ordersDeltaPct: data.kpis.ordersGrowthPct ?? data.comparison?.growth?.ordersChangePct ?? null,
            aovDeltaPct: data.kpis.aovGrowthPct ?? data.comparison?.growth?.aovChangePct ?? null,
            marginDeltaPct: data.comparison?.growth?.marginDeltaPct ?? null,
            trappedCapital: data.kpis.trappedCapital ?? 0,
            previousPeriodGrossRevenue: data.kpis.previousPeriodGrossRevenue ?? 0
          });
        }

        if (data.salesTrend && Array.isArray(data.salesTrend)) {
          setChartData(data.salesTrend);
        }

        if (data.comparisonLabel) {
          setComparisonLabel(data.comparisonLabel);
        }

        if (data.businessHealthScore) {
          setHealthScore(data.businessHealthScore);
        }

        if (data.dailyBriefing && data.dailyBriefing.executiveBrief) {
          setAiExecutiveBrief(data.dailyBriefing.executiveBrief);
        } else {
          // Briefing API succeeded but returned no executiveBrief — signal error state
          setAiExecutiveBrief(false);
        }

        if (data.opportunities && Array.isArray(data.opportunities)) {
          setOpportunities(data.opportunities);
        }

        if (data.campaigns && Array.isArray(data.campaigns)) {
          setCampaigns(data.campaigns.map(normalizeCampaignForModal).filter(Boolean));
        }

        if (data.recommendations && Array.isArray(data.recommendations)) {
          const mappedActions: ActionRecord[] = data.recommendations.slice(0, 6).map((rec: any) => {
            const isCust = rec.target?.entityType === 'CUSTOMER' || rec.target?.entityType === 'CUSTOMER_SEGMENT';
            const custName = rec.target?.customerName || (isCust ? rec.target?.name : undefined);
            const pTitle = rec.target?.productTitle || (!isCust ? rec.target?.name : undefined);
            const pId = typeof rec.target?.productId === 'number' ? rec.target.productId : (typeof rec.target?.entityId === 'number' ? rec.target.entityId : null);

            return {
              actionId: rec.recommendationId,
              merchantId: 'default_merchant',
              actionType: rec.proposedAction?.actionType || rec.type || 'RECOMMENDATION',
              status: rec.status === 'READY_FOR_REVIEW' ? 'PENDING_APPROVAL' : rec.status,
              targetType: rec.target?.entityType || (pId ? 'PRODUCT' : 'CUSTOMER'),
              targetCustomer: custName,
              productTitle: pTitle,
              productSku: rec.target?.sku,
              productId: pId,
              productName: isCust && custName
                ? `Customer: ${custName}${pTitle ? ` (re: ${pTitle})` : ''}`
                : (pTitle || rec.target?.name || rec.title),
              quantity: rec.proposedAction?.suggestedRestockUnits || null,
              reason: rec.proposedAction?.summary || rec.explanation?.observation || rec.title,
              createdAt: rec.createdAt || new Date().toISOString(),
              expiresAt: rec.expiresAt || new Date(Date.now() + 7 * 86400000).toISOString(),
              requiresApproval: true,
              canRollback: false,
              payload: rec.proposedAction || {},
              outcome: {
                outcomeStatus: 'PENDING',
                confidenceAtRecommendation: rec.confidence === 'HIGH' ? 0.95 : rec.confidence === 'MEDIUM' ? 0.8 : 0.65,
                expectedImpact: {
                  expectedRevenueDelta: rec.expectedImpact?.simulatedGrossRevenueDelta || 0,
                  expectedUnitsDelta: rec.expectedImpact?.simulatedIncrementalOrders || 0,
                  expectedProfitDelta: rec.expectedImpact?.simulatedNetContributionProfitDelta || 0
                },
                baselineMetrics: {
                  stockOnHand: rec.staleCheck?.snapshotStock || 0,
                  velocity7d: 1.0,
                  dailyRevenue: 0,
                  contributionMarginPct: rec.financialAnalysis?.currentMarginPct || 0
                }
              }
            };
          });
          setPendingActions(mappedActions);
        }
      } else {
        setFetchError(data.error || 'Failed to load merchant overview');
        setAiExecutiveBrief(false);
      }
    } catch (err: any) {
      console.warn('Live overview fetch warning:', err.message);
      setFetchError(err.message);
      setAiExecutiveBrief(false); // fetch failed — surface honest error state
    } finally {
      setIsFetching(false);
    }
  }, [selectedPeriod, comparisonMode]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  // Background data synchronization: keep the dashboard current without the
  // merchant manually refreshing. Fires only while the tab is VISIBLE, so a
  // backgrounded tab never burns Render free-tier CPU or request quota.
  useEffect(() => {
    // 45s cadence matches the AppShell "Data synced" indicator and keeps the
    // backend's 60s TTL cache continuously warm for instant loads.
    const SYNC_INTERVAL_MS = 45_000;
    let timer: ReturnType<typeof setInterval>;

    const startSync = () => {
      if (!timer) {
        timer = setInterval(() => {
          if (document.visibilityState === 'visible') {
            void fetchOverviewData({ silent: true });
          }
        }, SYNC_INTERVAL_MS);
      }
    };
    const stopSync = () => {
      if (timer) { clearInterval(timer); timer = undefined as unknown as ReturnType<typeof setInterval>; }
    };

    startSync();
    // Refresh immediately when the merchant returns to the tab so data is
    // current after they were away (covers the idle/hidden period).
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchOverviewData({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopSync();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // fetchOverviewData identity changes with period/comparison selection;
    // the sync loop must always use the latest one.
  }, [fetchOverviewData]);

  const handleActionUpdated = (actionId: string, newStatus: string, message: string) => {
    setFeedbackToast({ message, type: 'success' });
    setTimeout(() => setFeedbackToast(null), 4000);
    setPendingActions(prev => prev.filter(a => a.actionId !== actionId));
    fetchOverviewData();
  };

  const handleCampaignUpdated = (campaignId: string, newStatus: string, message: string) => {
    setFeedbackToast({ message, type: 'success' });
    setTimeout(() => setFeedbackToast(null), 4000);
    setCampaigns(prev => prev.map(c => c.campaignId === campaignId ? { ...c, status: newStatus } : c));
    fetchOverviewData();
  };

  // Group Opportunities by Strategic Categories
  const categorizedOpportunities = useMemo(() => {    const highIntent = opportunities.filter(o => o.type === 'HIGH_INTENT_CUSTOMERS');
    const cart = opportunities.filter(o => o.type === 'CART_ABANDONMENT');
    const checkout = opportunities.filter(o => o.type === 'CHECKOUT_ABANDONMENT');
    const repeat = opportunities.filter(o => o.type === 'REPEAT_CUSTOMER_RETENTION');
    const dormant = opportunities.filter(o => o.type === 'DORMANT_REACTIVATION');
    const stockout = opportunities.filter(o => o.type === 'STOCKOUT_RISK' || o.type === 'HIGH_DEMAND_LOW_STOCK');
    return { highIntent, cart, checkout, repeat, dormant, stockout };
  }, [opportunities]);

  // First meaningful paint guard: until the first fetch completes we show
  // skeleton placeholders — NEVER a misleading ₹0.00 / 0 value.
  const firstLoad = isFetching && !hasLoaded;

  return (
    <div className="space-y-6 font-sans text-ink">
      {/* 1. Header with Period Controls & Copilot Shortcut */}
      <PageHeader
        title="Commerce Intelligence Operating System"
        subtitle="Executive business posture, multidimensional health diagnostics, commercial opportunities, and staged campaign authorization."
      >
        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="h-8 text-xs bg-surface-2 border border-hairline text-ink rounded-md px-2.5 focus:outline-none focus:border-linear-primary font-mono cursor-pointer"
          >
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
          </select>

          {/* Comparison Mode */}
          <select
            value={comparisonMode}
            onChange={(e) => setComparisonMode(e.target.value)}
            className="h-8 text-xs bg-surface-2 border border-hairline text-ink rounded-md px-2.5 focus:outline-none focus:border-linear-primary font-mono hidden sm:block cursor-pointer"
          >
            <option value="previous_period">vs Preceding Period</option>
            <option value="same_period_last_year">vs Same Period Last Year</option>
          </select>

          {/* Global Copilot Button */}
          <button
            onClick={() => setIsCopilotOpen(true)}
            className="h-8 px-3 text-xs font-medium rounded-md bg-linear-primary hover:bg-linear-primary-hover text-white flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Ask Copilot (⌘J)</span>
          </button>
        </div>
      </PageHeader>

      {/* Toast Feedback */}
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

      {/* Error Fallback Notice */}
      {fetchError && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-amber-300 text-xs flex items-center justify-between font-mono">
          <span>⚠️ Telemetry Notice: Live feed refresh reported partial data ({fetchError}). Operating on grounded local ledger.</span>
          <button onClick={() => fetchOverviewData()} className="underline text-xs font-sans">Retry</button>
        </div>
      )}

      {/* 2. Top Executive KPI Area with Micro-Typography Provenance */}
      <div className="bg-surface-1 border border-hairline hover:border-hairline-strong rounded-lg p-5 transition-colors space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-hairline">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-ink-subtle uppercase tracking-[0.4px] font-display">
                Executive Revenue Performance (Last 30 Days)
              </span>
              <TrustBadge tag="[OBSERVED]" formula="SUM(delivered_orders.totalamount)" />
            </div>
            <div className="flex items-baseline gap-3">
              {firstLoad ? (
                <SkeletonBlock className="w-56" lines={2} />
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl font-semibold font-mono text-ink tracking-tight">
                    ₹{overviewMetrics.grossRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-mono font-medium ${getGrowthColorClass(overviewMetrics.revenueDeltaPct)}`}>
                    <span>{formatSignPercentage(overviewMetrics.revenueDeltaPct, { includeArrow: true })}</span>
                    <span className="text-ink-tertiary font-normal">{comparisonLabel}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Strategic Pillar KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {firstLoad ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
                  <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                    <span>Net Margin</span>
                    <TrustBadge tag="[CALCULATED]" />
                  </div>
                  <div className="text-sm font-bold font-mono text-ink mt-0.5">
                    {overviewMetrics.netMarginPct.toFixed(1)}%
                  </div>
                  <div className={`text-[10px] font-mono mt-0.5 ${getGrowthColorClass(overviewMetrics.marginDeltaPct)}`}>
                    {formatSignPercentage(overviewMetrics.marginDeltaPct, { includeArrow: true })} pts
                  </div>
                </div>

                <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
                  <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                    <span>Total Orders</span>
                    <TrustBadge tag="[OBSERVED]" />
                  </div>
                  <div className="text-sm font-bold font-mono text-ink mt-0.5">
                    {overviewMetrics.totalOrders.toLocaleString()}
                  </div>
                  <div className={`text-[10px] font-mono mt-0.5 ${getGrowthColorClass(overviewMetrics.ordersDeltaPct)}`}>
                    {formatSignPercentage(overviewMetrics.ordersDeltaPct, { includeArrow: true })} volume
                  </div>
                </div>

                <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
                  <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                    <span>Average Order</span>
                    <TrustBadge tag="[CALCULATED]" />
                  </div>
                  <div className="text-sm font-bold font-mono text-ink mt-0.5">
                    ₹{overviewMetrics.aov.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <div className={`text-[10px] font-mono mt-0.5 ${getGrowthColorClass(overviewMetrics.aovDeltaPct)}`}>
                    {formatSignPercentage(overviewMetrics.aovDeltaPct, { includeArrow: true })} basket
                  </div>
                </div>

                <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
                  <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                    <span>Trapped Capital</span>
                    <TrustBadge tag="[CALCULATED]" />
                  </div>
                  <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                    ₹{(overviewMetrics.trappedCapital / 1000).toFixed(0)}k
                  </div>
                  <div className="text-[10px] text-amber-400/80 font-mono mt-0.5">Stagnant Inventory</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* AI Operating Guidance Summary Banner */}
        <div className="flex items-start gap-3 bg-surface-2 p-3.5 rounded-md border border-hairline text-xs">
          <div className="p-1 bg-linear-primary/10 border border-linear-primary/20 text-linear-primary rounded shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink uppercase tracking-[0.4px] text-[11px] font-display">
                AI Business Strategist Synthesis
              </span>
              <TrustBadge tag="[MODEL ESTIMATE]" />
            </div>
            {/* LOADING — brief not yet received */}
            {aiExecutiveBrief === null && (
              <div className="space-y-1.5 pt-0.5">
                <div className="h-2.5 bg-surface-3 rounded animate-pulse w-full" />
                <div className="h-2.5 bg-surface-3 rounded animate-pulse w-4/5" />
              </div>
            )}
            {/* ERROR — fetch failed or briefing absent */}
            {aiExecutiveBrief === false && (
              <p className="text-ink-subtle leading-relaxed font-body">
                Operational brief unavailable.{' '}
                <button
                  onClick={() => fetchOverviewData()}
                  className="underline text-linear-primary-hover hover:text-linear-primary transition-colors"
                >
                  Retry
                </button>
              </p>
            )}
            {/* SUCCESS — live brief from backend */}
            {typeof aiExecutiveBrief === 'string' && (
              <p className="text-ink-muted leading-relaxed font-body">
                {aiExecutiveBrief}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 3. AI Business Health Score Strip (BusinessHealthScoreEngine) */}
      <div className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hairline pb-3">
          <div className="flex items-center gap-2.5">
            {firstLoad ? (
              <SkeletonBlock className="w-64" lines={2} />
            ) : (
              <>
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-base">
                  {healthScore.overallScore}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-ink uppercase tracking-wider font-display">
                      AI Business Health Index: {healthScore.overallStatus} ({healthScore.overallScore}/100)
                    </h3>
                    <TrustBadge tag="[CALCULATED]" formula="Weighted Sum across 8 operational domains (Revenue, Margin, Inventory, Customer, Operations, Marketing, Capital, Forecast)" />
                  </div>
                  <p className="text-[11px] text-ink-subtle">
                    Multidimensional health diagnostic evaluated across real store ledger data.
                  </p>
                </div>
              </>
            )}
          </div>
          {!firstLoad && healthScore.highestImpactIssue && (
            <div className="text-xs font-mono text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-md border border-amber-500/20 max-w-md">
              ⚡ Top Focus: {healthScore.highestImpactIssue.description}
            </div>
          )}
        </div>

        {/* 8 Health Dimensions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {firstLoad ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            healthScore.dimensions?.map((dim) => (
            <div key={dim.dimension} className="p-2.5 bg-surface-2 rounded-md border border-hairline space-y-1">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle">
                <span>{dim.name}</span>
                <span className={`font-mono font-bold ${
                  dim.status === 'EXCELLENT' ? 'text-emerald-400' :
                  dim.status === 'GOOD' ? 'text-sky-400' :
                  'text-amber-400'
                }`}>{dim.score}</span>
              </div>
              <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    dim.score >= 85 ? 'bg-emerald-400' :
                    dim.score >= 70 ? 'bg-sky-400' :
                    'bg-amber-400'
                  }`}
                  style={{ width: `${dim.score}%` }}
                />
              </div>
              <div className="text-[9px] font-mono text-ink-tertiary uppercase">{dim.status}</div>
            </div>
            ))
          )}
        </div>

        {/* Diagnostic Negative Drivers & Explainability */}
        {healthScore.dimensions && healthScore.dimensions.some(d => d.negativeDrivers && d.negativeDrivers.length > 0) && (
          <div className="pt-2.5 border-t border-hairline/60 space-y-1.5">
            <div className="text-[10px] font-mono uppercase text-ink-subtle font-medium flex items-center gap-1.5">
              <span>Diagnostic Risk Drivers</span>
              <span className="text-amber-400">• Grounded DB Telemetry</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
              {healthScore.dimensions
                .filter(d => d.negativeDrivers && d.negativeDrivers.length > 0)
                .flatMap(d => d.negativeDrivers!.map(nd => ({ dim: d.name, text: nd })))
                .slice(0, 4)
                .map((driver, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 p-2 bg-surface-2/80 rounded border border-hairline text-ink-muted">
                    <span className="text-amber-400 shrink-0">⚠️</span>
                    <span><strong className="text-ink font-semibold">{driver.dim}:</strong> {driver.text}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Priority Decision Inbox & Sales Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Sales Velocity Chart & Customer Opportunities */}
        <div className="lg:col-span-2 space-y-6">
          {/* Audience Intelligence: cart abandoners, checkout abandoners, repeat viewers */}
          <AudienceIntelligencePanel />

          <AnalyticalChartCard
            data={chartData}
            interval={salesInterval}
            onIntervalChange={(val) => setSalesInterval(val)}
            loading={isFetching}
            currentTotal={overviewMetrics.grossRevenue}
            prevTotal={overviewMetrics.previousPeriodGrossRevenue}
            growthPct={overviewMetrics.revenueDeltaPct ?? undefined}
            periodLabel={comparisonLabel}
          />

          {/* Customer Opportunity Matrix */}
          <div className="bg-surface-1 p-5 rounded-lg border border-hairline space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-linear-primary" />
                <h3 className="text-xs font-semibold text-ink uppercase tracking-wider font-display">
                  Commercial Opportunities Matrix ({firstLoad ? '…' : `${opportunities.length} Algorithmic Signals`})
                </h3>
                <TrustBadge tag="[OBSERVED]" />
              </div>
              <Link href="/merchant/customers" className="text-[11px] text-linear-primary-hover hover:underline font-mono">
                View All Customers →
              </Link>
            </div>

            {firstLoad ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : opportunities.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-subtle bg-surface-2 rounded-md border border-hairline">
                Zero active opportunities in current period. Telemetry continuously monitors customer behavior.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {opportunities.slice(0, 4).map((opp, idx) => (
                  <div
                    key={opp.opportunityId || idx}
                    className="p-3.5 bg-surface-2 rounded-lg border border-hairline hover:border-hairline-strong transition-colors space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-xs bg-linear-primary/10 text-linear-primary-hover border border-linear-primary/30">
                        {opp.type}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">
                        {opp.priority} PRIORITY
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-ink">{opp.title}</h4>
                      <p className="text-[11px] text-ink-subtle mt-0.5 line-clamp-2 leading-relaxed">
                        {opp.summary}
                      </p>
                    </div>

                    <div className="p-2 bg-surface-1 rounded border border-hairline text-[10px] font-mono space-y-1">
                      <div className="flex justify-between text-ink-subtle">
                        <span>Target:</span>
                        <span className="text-ink font-semibold">{opp.target?.name || 'Customer Segment'}</span>
                      </div>
                      <div className="flex justify-between text-ink-subtle">
                        <span>Estimated Value:</span>
                        <span className="text-emerald-400 font-semibold">
                          ₹{(opp.metrics?.potentialRevenue || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <Link
                      href="/merchant/actions"
                      className="block text-center py-1.5 px-3 rounded-md bg-surface-1 hover:bg-surface-3 border border-hairline text-xs font-medium text-ink transition-colors"
                    >
                      Prepare Campaign →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: AI Priority Inbox & Staged Campaigns */}
        <div className="space-y-6">
          {/* Priority Action Inbox */}
          <div className="bg-surface-1 p-5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
                  Top Priority Actions ({firstLoad ? '…' : `${pendingActions.length} for Review`})
                </h3>
                <TrustBadge tag="[RECOMMENDATION]" />
              </div>
              <Link href="/merchant/actions" className="text-[11px] text-linear-primary-hover hover:underline font-mono">
                Ledger →
              </Link>
            </div>

            {firstLoad ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : pendingActions.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink-subtle bg-surface-2 rounded-md border border-hairline">
                Zero pending actions. All recommendations authorized or resolved.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingActions.slice(0, 3).map((action) => (
                  <div
                    key={action.actionId}
                    onClick={() => setSelectedActionForDrawer(action)}
                    className="p-3.5 rounded-md bg-surface-2 border border-hairline hover:border-hairline-strong cursor-pointer transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex px-2 py-0.5 text-[10px] font-mono font-bold rounded-xs bg-linear-primary/10 text-linear-primary-hover border border-linear-primary/30">
                        {action.actionType}
                      </span>
                      <span className="text-[10px] font-mono text-ink-subtle">
                        {action.targetType === 'CUSTOMER'
                          ? (action.productId ? `CUSTOMER • SKU-${action.productId}` : 'CUSTOMER')
                          : (action.productId ? `SKU-${action.productId}` : 'CATALOG')}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-ink line-clamp-1">
                        {action.targetType === 'CUSTOMER' && action.targetCustomer ? (
                          <span className="flex items-center gap-1.5">
                            <span className="px-1 py-0.2 rounded-xs text-[9px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                              CUSTOMER
                            </span>
                            <span>{action.targetCustomer}</span>
                            {action.productTitle && <span className="text-ink-subtle font-normal text-[11px]">({action.productTitle})</span>}
                          </span>
                        ) : (
                          action.productName
                        )}
                      </h4>
                      <p className="text-[11px] text-ink-subtle line-clamp-2 mt-0.5 leading-relaxed">{action.reason}</p>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs font-mono">
                      <span className="text-[10px] text-ink-subtle">Expected Impact:</span>
                      <span className="font-semibold text-semantic-success">
                        +₹{action.outcome?.expectedImpact?.expectedRevenueDelta?.toLocaleString('en-IN') || '0'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Staged Marketing Campaigns (Canonical Phase 15+ Integration) */}
          <div className="bg-surface-1 p-5 rounded-lg border border-hairline space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <h3 className="text-xs font-semibold text-ink uppercase tracking-wider font-display">
                  Staged Campaigns ({firstLoad ? '…' : `${campaigns.length} Proposals`})
                </h3>
                <TrustBadge tag="[RECOMMENDATION]" />
              </div>
              <span className="text-[10px] font-mono text-ink-subtle">15% Margin Guarded</span>
            </div>

            {firstLoad ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink-subtle bg-surface-2 rounded-md border border-hairline">
                Zero staged campaigns. Generate from opportunities above.
              </div>
            ) : (
              <div className="space-y-3">
                {campaigns.slice(0, 3).map((camp) => {
                  const targetCount = camp.targetAudience?.length ?? camp.activeAudienceCount ?? camp.audience?.eligibleCount ?? camp.audience?.totalAudienceSize ?? (Array.isArray(camp.audience?.customers) ? camp.audience.customers.length : (Array.isArray(camp.audience) ? camp.audience.length : 1));
                  
                  const offerText = camp.offer 
                    ? (camp.offer.offerText || camp.offer.description || (camp.offer.offerValue !== undefined ? (camp.offer.category === 'SAFE_PERCENT_DISCOUNT' ? `${camp.offer.offerValue}% Discount` : `₹${camp.offer.offerValue} Off`) : (camp.offer.offerType === 'NO_INCENTIVE' ? 'No Discount' : (camp.offer.offerType === 'PERCENTAGE_DISCOUNT' ? `${camp.offer.discountValue}% Discount` : `₹${camp.offer.discountValue} Discount`))))
                    : 'DATA UNAVAILABLE';
                  
                  const simProfit = camp.financialSimulation?.expectedNetProfitGain ?? camp.financialSimulation?.contributionAfterDiscount ?? camp.expectedImpact?.simulatedNetContributionProfitDelta;

                  return (
                    <div
                      key={camp.campaignId}
                      onClick={() => setSelectedCampaignForModal(camp)}
                      className="p-3 bg-surface-2 rounded-md border border-hairline hover:border-hairline-strong cursor-pointer transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-xs font-semibold border ${
                          camp.status === 'APPROVED' ? 'bg-semantic-success/10 text-semantic-success border-semantic-success/30' :
                          camp.status === 'READY_FOR_REVIEW' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                          'bg-surface-3 text-ink-subtle border-hairline'
                        }`}>
                          {camp.status}
                        </span>
                        <span className="text-[10px] font-mono text-ink-subtle">
                          {targetCount} {targetCount === 1 ? 'Target' : 'Targets'}
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-ink line-clamp-1">{camp.title}</h4>
                      <p className="text-[11px] text-emerald-400 font-mono">
                        Offer: {offerText}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-hairline text-[10px] font-mono">
                        <span className="text-ink-subtle">Simulated Profit:</span>
                        <span className="text-purple-300 font-bold">
                          {simProfit !== undefined && simProfit !== null ? `+₹${Math.round(simProfit).toLocaleString('en-IN')}` : 'DATA UNAVAILABLE'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Campaign Detail Review Modal */}
      <CampaignDetailModal
        campaign={selectedCampaignForModal}
        isOpen={!!selectedCampaignForModal}
        onClose={() => setSelectedCampaignForModal(null)}
        onCampaignUpdated={handleCampaignUpdated}
      />

      {/* 6. Action Detail Drawer */}
      <ActionDetailDrawer
        action={selectedActionForDrawer}
        isOpen={!!selectedActionForDrawer}
        onClose={() => setSelectedActionForDrawer(null)}
        onActionUpdated={handleActionUpdated}
      />

      {/* 7. Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />
    </div>
  );
}
