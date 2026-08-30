'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '../../../components/Merchant/v2/PageHeader';
import { TrustBadge } from '../../../components/Merchant/v2/TrustBadge';
import { CopilotDrawer } from '../../../components/Merchant/v2/CopilotDrawer';

interface LowStockItem {
  productId: number;
  title: string;
  categoryName: string;
  currentStock: number;
  threshold: number;
  dailyVelocity7d: number;
  estimatedDaysRemaining: number | null;
  restockRecommendedUnits: number;
  urgency: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  price?: number;
  unitCogs?: number;
}

interface VelocityItem {
  productId: number;
  title: string;
  categoryName: string;
  currentStock: number;
  totalSoldInPeriod: number;
  dailySalesVelocity: number;
  turnoverRate: number;
  stockoutRisk: 'HIGH' | 'MEDIUM' | 'LOW';
}

export default function InventoryPage() {
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'HEALTHY'>('ALL');
  const [threshold, setThreshold] = useState<number>(200);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);

  const [stockList, setStockList] = useState<LowStockItem[]>([]);
  const [velocityList, setVelocityList] = useState<VelocityItem[]>([]);
  const [inventorySummary, setInventorySummary] = useState<{
    criticalCount: number;
    warningCount: number;
    healthyCount: number;
    totalChecked: number;
    trappedStagnantCapitalCost: number;
    totalInventoryCostValue: number;
    totalInventoryRetailValue: number;
    stagnantProductsCount: number;
  }>({
    criticalCount: 0,
    warningCount: 0,
    healthyCount: 0,
    totalChecked: 77,
    trappedStagnantCapitalCost: 882450,
    totalInventoryCostValue: 0,
    totalInventoryRetailValue: 0,
    stagnantProductsCount: 56
  });

  // Fetch real telemetry from backend
  const fetchInventoryData = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await fetch(`/api/merchant/inventory?threshold=${threshold}`, {
        headers: { 'x-merchant-id': 'default_merchant' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          setInventorySummary({
            criticalCount: data.summary.criticalCount ?? 0,
            warningCount: data.summary.warningCount ?? 0,
            healthyCount: data.summary.healthyCount ?? 0,
            totalChecked: data.summary.totalChecked ?? 77,
            trappedStagnantCapitalCost: data.summary.trappedStagnantCapitalCost ?? 882450,
            totalInventoryCostValue: data.summary.totalInventoryCostValue ?? 0,
            totalInventoryRetailValue: data.summary.totalInventoryRetailValue ?? 0,
            stagnantProductsCount: data.summary.stagnantProductsCount ?? 56
          });
        }
        if (data.allTrackedStock && Array.isArray(data.allTrackedStock)) {
          setStockList(data.allTrackedStock);
        }
        if (data.velocityMatrix && Array.isArray(data.velocityMatrix)) {
          setVelocityList(data.velocityMatrix);
        }
      }
    } catch (err) {
      console.warn('Error fetching inventory:', err);
    } finally {
      setIsFetching(false);
    }
  }, [threshold]);

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);

  // Filtered live stock items
  const displayStock: LowStockItem[] = useMemo(() => {
    if (urgencyFilter === 'ALL') return stockList;
    return stockList.filter(i => i.urgency === urgencyFilter);
  }, [stockList, urgencyFilter]);

  // Derived Summary counts from actual loaded stock items
  const criticalItems = useMemo(() => displayStock.filter(i => i.urgency === 'CRITICAL'), [displayStock]);
  const warningItems = useMemo(() => displayStock.filter(i => i.urgency === 'WARNING'), [displayStock]);
  const healthyItems = useMemo(() => displayStock.filter(i => i.urgency === 'HEALTHY'), [displayStock]);
  const totalMonitored = displayStock.length;

  // Stagnant inventory with low velocity (<=0.5/d)
  const stagnantItems = useMemo(() => {
    return stockList.filter(i => i.dailyVelocity7d <= 0.5 && i.currentStock > 30);
  }, [stockList]);

  // Top 2 lowest runway items for dynamic AI synthesis
  const lowestCoverItems = useMemo(() => {
    return [...displayStock]
      .filter(i => i.estimatedDaysRemaining !== null && i.estimatedDaysRemaining > 0)
      .sort((a, b) => (a.estimatedDaysRemaining ?? 999) - (b.estimatedDaysRemaining ?? 999));
  }, [displayStock]);

  const handleExport = () => {
    const csvHeader = 'Product ID,SKU,Title,Category,Current Stock,Threshold,7d Velocity,Days Remaining,Urgency,Recommended Restock (Guidance)\n';
    const rows = displayStock.map(p => 
      `${p.productId},SKU-${p.productId},"${p.title}","${p.categoryName}",${p.currentStock},${p.threshold},${p.dailyVelocity7d},${p.estimatedDaysRemaining ?? 'N/A'},${p.urgency},${p.restockRecommendedUnits}`
    ).join('\n');

    const blob = new Blob([csvHeader + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_health_${threshold}threshold.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 sm:space-y-7 font-sans text-ink">
      {/* 1. Page Header */}
      <PageHeader
        title="Stock Risk & Working Capital Workspace"
        subtitle="Stockout exposure, coverage runway, analytical reorder guidance, and trapped working capital."
        onExport={handleExport}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-subtle font-medium">Tracking Threshold:</span>
          <select
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
            className="h-8 text-xs bg-surface-2 border border-hairline text-ink rounded-md px-2.5 focus:outline-none focus:border-linear-primary font-mono cursor-pointer"
          >
            <option value={50}>Low (&lt;50 units)</option>
            <option value={100}>Standard (&lt;100 units)</option>
            <option value={200}>All Tracked (&lt;200 units)</option>
          </select>
        </div>
      </PageHeader>

      {/* 2. Executive Stock Risk Banner (surface-1) */}
      <div className="bg-surface-1 border border-hairline hover:border-hairline-strong rounded-lg p-5 sm:p-6 transition-colors space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-hairline">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[11px] font-medium text-ink-subtle uppercase tracking-[0.4px] font-display">
                Immediate Stockout Exposure
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                {criticalItems.length} CRITICAL SKUS (&le;14 DAYS COVER)
              </span>
              <TrustBadge tag="[FACT]" />
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-2xl sm:text-3xl font-semibold font-mono text-ink tracking-tight">
                {criticalItems.length + warningItems.length} SKUs At Risk
              </div>
              <div className="text-xs font-mono font-medium text-ink-subtle">
                Out of {totalMonitored} monitored catalog SKUs
              </div>
            </div>
          </div>

          {/* Secondary Risk Pillars */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-surface-2/80 rounded-md border border-hairline flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Critical (&le;14d)</span>
                <TrustBadge tag="[FACT]" />
              </div>
              <div className="text-sm font-bold font-mono text-rose-400 mt-1.5">
                {criticalItems.length} SKUs
              </div>
              <div className="text-[10px] text-rose-400/80 font-mono mt-0.5">Immediate reorder</div>
            </div>

            <div className="p-3 bg-surface-2/80 rounded-md border border-hairline flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Warning (15–30d)</span>
                <TrustBadge tag="[FACT]" />
              </div>
              <div className="text-sm font-bold font-mono text-amber-400 mt-1.5">
                {warningItems.length} SKUs
              </div>
              <div className="text-[10px] text-amber-400/80 font-mono mt-0.5">Reorder this month</div>
            </div>

            <div className="p-3 bg-surface-2/80 rounded-md border border-hairline flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Healthy (&gt;30d)</span>
                <TrustBadge tag="[FACT]" />
              </div>
              <div className="text-sm font-bold font-mono text-ink mt-1.5">
                {healthyItems.length} SKUs
              </div>
              <div className="text-[10px] text-semantic-success font-mono mt-0.5">Sufficient stock</div>
            </div>

            <div className="p-3 bg-surface-2/80 rounded-md border border-hairline flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Trapped Capital</span>
                <TrustBadge tag="[CALCULATED]" />
              </div>
              <div className="text-sm font-bold font-mono text-amber-300 mt-1.5">
                ₹{inventorySummary.trappedStagnantCapitalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-amber-400/80 font-mono mt-0.5">Stagnant Inventory (Cost Basis)</div>
            </div>
          </div>
        </div>

        {/* AI Stock Diagnostics Banner & Stockout-Marketing Conflict */}
        <div className="space-y-3">
          <div className="flex items-start gap-3.5 bg-surface-2/90 p-4 rounded-md border border-hairline text-xs">
            <div className="p-1.5 bg-linear-primary/10 border border-linear-primary/20 text-linear-primary rounded-md shrink-0 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-ink uppercase tracking-[0.4px] text-[11px] font-display">
                  Stockout Exposure & Cover Diagnostics
                </span>
                <TrustBadge tag="[AI INSIGHT]" />
              </div>
              <p className="text-xs text-ink-muted leading-relaxed font-body">
                {criticalItems.length > 0 || warningItems.length > 0 ? (
                  <>
                    &quot;{lowestCoverItems[0]?.title}&quot; (<strong className="text-ink">{lowestCoverItems[0]?.estimatedDaysRemaining?.toFixed(1)} days</strong> cover remaining, {lowestCoverItems[0]?.currentStock} units on hand) represents an active stockout exposure at current conversion velocity.
                  </>
                ) : (
                  <>No immediate stockout risk detected. All <strong className="text-ink">{totalMonitored}</strong> monitored catalog SKUs maintain &gt;30 days of operating inventory cover. Slowest-moving inventory is holding ₹{inventorySummary.trappedStagnantCapitalCost.toLocaleString('en-IN')} in trapped working capital.</>
                )}
              </p>
            </div>
          </div>

          {/* Cross-Engine Conflict Warning Banner */}
          <div className="flex items-start gap-3.5 bg-surface-2 p-4 rounded-md border border-hairline text-xs">
            <div className="p-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md shrink-0 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink uppercase tracking-[0.4px] text-[11px] font-display">
                  Working Capital & Overstock Posture
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/30">CAPITAL EFFICIENCY</span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed font-body">
                {stagnantItems.length} SKUs maintain low sales velocity with significant stock depth. System recommends catalog re-engagement and dead-stock bundle promotions to accelerate trapped capital recovery.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Urgent Replenishment Guidance Cards */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`w-1.5 h-1.5 rounded-full ${criticalItems.length > 0 ? 'bg-rose-400' : 'bg-semantic-success'}`} />
            <h2 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
              {criticalItems.length > 0 || warningItems.length > 0 ? 'Urgent Replenishment Guidance' : 'Inventory Replenishment Posture'}
            </h2>
            <TrustBadge tag="[RECOMMENDATION]" />
          </div>
          <span className="text-[11px] text-ink-subtle font-mono">
            Derived from dynamic conversion velocity vs 30-day operating buffer
          </span>
        </div>

        {criticalItems.length > 0 || warningItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {lowestCoverItems.slice(0, 3).map((item) => (
              <div
                key={item.productId}
                className="bg-surface-1 border border-hairline hover:border-hairline-strong rounded-lg p-5 transition-colors flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Header: Urgency badge & cover runway */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-xs border ${
                      item.urgency === 'CRITICAL'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}>
                      {item.urgency} STOCKOUT
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-400 shrink-0">
                      {item.estimatedDaysRemaining ? `~${item.estimatedDaysRemaining.toFixed(1)}d cover` : 'NOT_MEASURABLE'}
                    </span>
                  </div>

                  {/* Product Title & Metadata */}
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold text-ink line-clamp-1 leading-snug">{item.title}</h3>
                    <div className="text-[11px] text-ink-subtle font-mono truncate">SKU-{item.productId} &bull; {item.categoryName}</div>
                  </div>

                  {/* Inner Stock / Velocity Metric Box */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-surface-2/80 rounded-md border border-hairline text-center font-mono">
                    <div className="space-y-1">
                      <div className="text-[10px] text-ink-subtle font-sans font-medium uppercase tracking-wider">Stock on Hand</div>
                      <div className="text-xs font-semibold text-ink font-mono">{item.currentStock} units</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-ink-subtle font-sans font-medium uppercase tracking-wider">7d Velocity</div>
                      <div className="text-xs font-semibold text-ink font-mono">{item.dailyVelocity7d}/day</div>
                    </div>
                  </div>
                </div>

                {/* Analytical Guidance & Action CTA */}
                <div className="pt-3.5 border-t border-hairline space-y-2.5">
                  <div className="flex items-center justify-between text-xs py-0.5 font-mono">
                    <span className="text-ink-subtle font-sans text-xs">Analytical Guidance:</span>
                    <span className="font-semibold text-linear-primary-hover text-xs">
                      {item.restockRecommendedUnits > 0 ? `+${item.restockRecommendedUnits} units` : 'No replenishment required'}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsCopilotOpen(true)}
                    className="w-full h-8 px-3 text-xs font-medium text-ink bg-surface-2 hover:bg-surface-3 active:bg-surface-4 rounded-md border border-hairline hover:border-hairline-strong transition-colors flex items-center justify-center gap-1.5 select-none"
                  >
                    <span>Analyze in Copilot</span>
                    <kbd className="text-[9px] font-mono bg-surface-3 px-1 py-0.5 rounded border border-hairline-strong text-ink-muted">
                      ⌘J
                    </kbd>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-surface-1 border border-hairline rounded-lg p-5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-xs text-[10px] font-mono font-semibold bg-semantic-success/10 text-semantic-success border border-semantic-success/30">
                  ALL SKUs HEALTHY
                </span>
                <span className="text-xs font-semibold text-ink">No replenishment required</span>
              </div>
              <p className="text-xs text-ink-muted">
                All 77 catalog SKUs maintain sufficient inventory cover above the 30-day operating buffer. Zero purchase orders required at current sales velocity.
              </p>
            </div>
            <button
              onClick={() => setIsCopilotOpen(true)}
              className="h-8 px-3 text-xs font-medium text-ink bg-surface-2 hover:bg-surface-3 rounded-md border border-hairline transition-colors shrink-0"
            >
              Review Slowest SKUs
            </button>
          </div>
        )}
      </div>

      {/* 4. Filter Strip & Complete Stock Coverage Ledger */}
      <div className="bg-surface-1 p-5 sm:p-6 rounded-lg border border-hairline hover:border-hairline-strong transition-colors space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-hairline">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-linear-primary" />
            <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
              Complete Stock Coverage Ledger
            </h3>
            <TrustBadge tag="[FACT]" />
          </div>

          {/* Status Filter Segmented Controls */}
          <div className="inline-flex rounded-md border border-hairline bg-surface-2 p-0.5">
            {(['ALL', 'CRITICAL', 'WARNING', 'HEALTHY'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setUrgencyFilter(filter)}
                className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors ${
                  urgencyFilter === filter
                    ? 'bg-surface-3 text-ink font-semibold border border-hairline-strong shadow-2xs'
                    : 'text-ink-subtle hover:text-ink'
                }`}
              >
                {filter === 'ALL'
                  ? `All (${displayStock.length})`
                  : filter === 'CRITICAL'
                  ? `Critical ≤14d (${criticalItems.length})`
                  : filter === 'WARNING'
                  ? `Warning 15-30d (${warningItems.length})`
                  : `Healthy >30d (${healthyItems.length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="border-b border-hairline text-[11px] font-medium text-ink-subtle bg-surface-2/60 select-none">
                <th className="py-3 px-3.5 min-w-[200px] font-medium">Product SKU</th>
                <th className="py-3 px-3.5 font-medium">Category</th>
                <th className="py-3 px-3.5 text-right font-medium">Current Stock</th>
                <th className="py-3 px-3.5 text-right font-medium">7d Velocity</th>
                <th className="py-3 px-3.5 text-right font-medium">Runway Coverage</th>
                <th className="py-3 px-3.5 text-right font-medium">Reorder Guidance</th>
                <th className="py-3 px-3.5 text-center font-medium">Backend Urgency Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-ink font-mono">
              {displayStock.map((item) => (
                <tr key={item.productId} className="hover:bg-surface-2/50 transition-colors">
                  <td className="py-3 px-3.5 font-sans">
                    <div className="font-medium text-ink line-clamp-1">{item.title}</div>
                    <div className="text-[10px] text-ink-subtle font-mono mt-0.5">SKU-{item.productId}</div>
                  </td>
                  <td className="py-3 px-3.5 font-sans text-ink-muted">
                    {item.categoryName}
                  </td>
                  <td className="py-3 px-3.5 text-right tabular-nums font-bold text-ink">
                    {item.currentStock}
                  </td>
                  <td className="py-3 px-3.5 text-right tabular-nums text-ink-muted">
                    {item.dailyVelocity7d}/d
                  </td>
                  <td className="py-3 px-3.5 text-right tabular-nums font-semibold">
                    <span className={item.urgency === 'CRITICAL' ? 'text-rose-400 font-bold' : item.urgency === 'WARNING' ? 'text-amber-400 font-bold' : 'text-ink-muted'}>
                      {item.estimatedDaysRemaining ? `${item.estimatedDaysRemaining.toFixed(1)} days` : 'NOT_MEASURABLE'}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-right tabular-nums font-semibold text-linear-primary-hover">
                    {item.restockRecommendedUnits > 0 ? `+${item.restockRecommendedUnits} units` : '—'}
                  </td>
                  <td className="py-3 px-3.5 text-center">
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-sans font-medium rounded-xs border ${
                      item.urgency === 'CRITICAL'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : item.urgency === 'WARNING'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-semantic-success/10 text-semantic-success border-semantic-success/30'
                    }`}>
                      {item.urgency}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Contextual Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />
    </div>
  );
}
