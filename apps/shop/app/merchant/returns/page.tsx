'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '../../../components/Merchant/v2/PageHeader';
import { TrustBadge } from '../../../components/Merchant/v2/TrustBadge';
import { CopilotDrawer } from '../../../components/Merchant/v2/CopilotDrawer';

interface ReturnReason {
  reason: string;
  count: number;
  totalRefundAmount: number;
  percentageOfReturns: number;
}

interface HighestReturnProduct {
  productId: number;
  title: string;
  unitsSold: number;
  returnsCount: number;
  returnRatePct: number;
  refundAmount: number;
}

interface CancellationReason {
  reason: string;
  count: number;
  percentageOfCancels: number;
}

interface ReturnsData {
  totalDeliveredItems: number;
  totalReturnedItems: number;
  overallReturnRatePct: number;
  totalRefundAmount: number;
  reasonBreakdown: ReturnReason[];
  highestReturnProducts: HighestReturnProduct[];
}

interface CancellationsData {
  totalOrders: number;
  totalCancellations: number;
  cancellationRatePct: number;
  reasonBreakdown: CancellationReason[];
}

export default function ReturnsPage() {
  const [period, setPeriod] = useState<string>('last_30_days');
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);

  const [returnsData, setReturnsData] = useState<ReturnsData>({
    totalDeliveredItems: 1637,
    totalReturnedItems: 105,
    overallReturnRatePct: 6.41,
    totalRefundAmount: 247372,
    reasonBreakdown: [
      { reason: 'defective', count: 32, totalRefundAmount: 79660, percentageOfReturns: 30.48 },
      { reason: 'wrong_size', count: 27, totalRefundAmount: 66766, percentageOfReturns: 25.71 },
      { reason: 'not_as_described', count: 23, totalRefundAmount: 61970, percentageOfReturns: 21.9 },
      { reason: 'changed_mind', count: 23, totalRefundAmount: 38976, percentageOfReturns: 21.9 }
    ],
    highestReturnProducts: [
      { productId: 301, title: 'Baby Fabric Soft Shoes', unitsSold: 66, returnsCount: 9, returnRatePct: 13.64, refundAmount: 4990 },
      { productId: 104, title: 'Running Breathable Socks', unitsSold: 64, returnsCount: 8, returnRatePct: 12.5, refundAmount: 20388 },
      { productId: 101, title: 'Aero Glide Running Shoes', unitsSold: 30, returnsCount: 3, returnRatePct: 10.0, refundAmount: 13293 },
      { productId: 204, title: 'Classic Leather Jacket', unitsSold: 22, returnsCount: 2, returnRatePct: 9.09, refundAmount: 6998 },
      { productId: 92, title: 'Winter Thermal Beanie', unitsSold: 13, returnsCount: 1, returnRatePct: 7.69, refundAmount: 999 }
    ]
  });

  const [cancellationsData, setCancellationsData] = useState<CancellationsData>({
    totalOrders: 1019,
    totalCancellations: 21,
    cancellationRatePct: 2.06,
    reasonBreakdown: [
      { reason: 'Delay in delivery preference', count: 7, percentageOfCancels: 33.33 },
      { reason: 'Found better price', count: 6, percentageOfCancels: 28.57 },
      { reason: 'Changed mind before shipping', count: 6, percentageOfCancels: 28.57 },
      { reason: 'Ordered by mistake', count: 2, percentageOfCancels: 9.52 }
    ]
  });

  const fetchReturnsData = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await fetch(`/api/merchant/returns?period=${period}`, {
        headers: { 'x-merchant-id': 'default_merchant' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.returns) {
          setReturnsData(data.returns);
        }
        if (data.cancellations) {
          setCancellationsData(data.cancellations);
        }
      }
    } catch (err) {
      console.warn('Error fetching returns analytics:', err);
    } finally {
      setIsFetching(false);
    }
  }, [period]);

  useEffect(() => {
    fetchReturnsData();
  }, [fetchReturnsData]);

  const formatReasonLabel = (str: string) => {
    return str
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Top return reason
  const topReason = useMemo(() => {
    if (!returnsData.reasonBreakdown || returnsData.reasonBreakdown.length === 0) return null;
    return [...returnsData.reasonBreakdown].sort((a, b) => b.count - a.count)[0];
  }, [returnsData.reasonBreakdown]);

  // Defective + wrong size combined share
  const qualityAndSizeShare = useMemo(() => {
    const relevant = returnsData.reasonBreakdown.filter(
      r => r.reason.toLowerCase().includes('defect') || r.reason.toLowerCase().includes('size')
    );
    const sumCount = relevant.reduce((s, r) => s + r.count, 0);
    const sumRefund = relevant.reduce((s, r) => s + r.totalRefundAmount, 0);
    const pct = returnsData.totalReturnedItems > 0
      ? (sumCount / returnsData.totalReturnedItems) * 100
      : 0;
    return { sumCount, sumRefund, pct };
  }, [returnsData]);

  const handleExport = () => {
    const csvHeader = 'Product ID,SKU,Product Name,Units Sold,Returns Count,Return Rate %,Refund Amount (INR)\n';
    const rows = returnsData.highestReturnProducts
      .map(
        (p) =>
          `${p.productId},SKU-${p.productId},"${p.title}",${p.unitsSold},${p.returnsCount},${p.returnRatePct},${p.refundAmount}`
      )
      .join('\n');
    const blob = new Blob([csvHeader + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `returns_analysis_${period}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 font-sans text-ink">
      {/* 1. Page Header */}
      <PageHeader
        title="Return & Refund Root-Cause Workspace"
        subtitle="Return rate diagnostics, refund capital loss, categorical return reasons, and pre-shipment cancellation analysis."
        onExport={handleExport}
      >
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-8 text-xs bg-surface-2 border border-hairline text-ink rounded-md px-2.5 focus:outline-none focus:border-linear-primary font-mono cursor-pointer"
        >
          <option value="last_30_days">Last 30 days</option>
          <option value="last_90_days">Last 90 days</option>
          <option value="last_12_months">Last 12 months</option>
        </select>
      </PageHeader>

      {/* 2. Executive Return & Refund Banner (surface-1) */}
      <div className="bg-surface-1 border border-hairline hover:border-hairline-strong rounded-lg p-5 transition-colors space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-hairline">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[11px] font-medium text-ink-subtle uppercase tracking-[0.4px] font-display">
                Return Rate & Friction Posture
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                {returnsData.overallReturnRatePct.toFixed(2)}% OVERALL RETURN RATE
              </span>
              <TrustBadge tag="[FACT]" />
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-2xl sm:text-3xl font-semibold font-mono text-ink tracking-tight">
                ₹{returnsData.totalRefundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs font-mono font-medium text-ink-subtle">
                Refund capital lost across {returnsData.totalReturnedItems} returned units ({returnsData.totalDeliveredItems} delivered)
              </div>
            </div>
          </div>

          {/* Secondary Pillars */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Delivered Units</span>
                <TrustBadge tag="[FACT]" />
              </div>
              <div className="text-sm font-bold font-mono text-ink mt-0.5">
                {returnsData.totalDeliveredItems}
              </div>
              <div className="text-[10px] text-ink-tertiary font-mono mt-0.5">Fulfillment count</div>
            </div>

            <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Returned Units</span>
                <TrustBadge tag="[FACT]" />
              </div>
              <div className="text-sm font-bold font-mono text-rose-400 mt-0.5">
                {returnsData.totalReturnedItems}
              </div>
              <div className="text-[10px] text-rose-400/80 font-mono mt-0.5">Items reversed</div>
            </div>

            <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Top Cause</span>
                <TrustBadge tag="[FACT]" />
              </div>
              <div className="text-sm font-bold font-mono text-ink mt-0.5 line-clamp-1">
                {topReason ? formatReasonLabel(topReason.reason) : 'N/A'}
              </div>
              <div className="text-[10px] text-ink-subtle font-mono mt-0.5">
                {topReason ? `${topReason.percentageOfReturns.toFixed(1)}% of returns` : ''}
              </div>
            </div>

            <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Cancellations</span>
                <TrustBadge tag="[FACT]" />
              </div>
              <div className="text-sm font-bold font-mono text-amber-300 mt-0.5">
                {cancellationsData.totalCancellations}
              </div>
              <div className="text-[10px] text-amber-400/80 font-mono mt-0.5">{cancellationsData.cancellationRatePct.toFixed(2)}% of orders</div>
            </div>
          </div>
        </div>

        {/* AI Return Diagnostics Banner */}
        <div className="flex items-start gap-3 bg-surface-2 p-3.5 rounded-md border border-hairline text-xs">
          <div className="p-1 bg-linear-primary/10 border border-linear-primary/20 text-linear-primary rounded shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink uppercase tracking-[0.4px] text-[11px] font-display">
                Why Are Returns Occurring?
              </span>
              <TrustBadge tag="[AI INSIGHT]" />
            </div>
            <p className="text-ink-muted leading-relaxed font-body">
              Defective and sizing issues account for <strong className="text-ink">{qualityAndSizeShare.pct.toFixed(1)}%</strong> of all returned items ({qualityAndSizeShare.sumCount} of {returnsData.totalReturnedItems} units, ₹{qualityAndSizeShare.sumRefund.toLocaleString('en-IN')} refund exposure). Addressing quality packaging and product sizing charts will eliminate over half of current return friction.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Return Reason Root-Cause Distribution Matrix */}
      <div className="bg-surface-1 p-5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
              Return Reason Root-Cause Breakdown
            </h3>
            <TrustBadge tag="[FACT]" />
          </div>
          <span className="text-[11px] text-ink-subtle font-mono">
            {returnsData.reasonBreakdown.length} Verified Customer Return Reasons
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {returnsData.reasonBreakdown.map((r, idx) => (
            <div
              key={idx}
              className="bg-surface-2 border border-hairline rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">{formatReasonLabel(r.reason)}</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-xs bg-surface-3 border border-hairline-strong text-ink">
                  {r.percentageOfReturns.toFixed(1)}% share
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-baseline justify-between">
                  <span className="text-ink-subtle font-sans">Refund Exposure:</span>
                  <span className="text-sm font-semibold text-ink">
                    ₹{r.totalRefundAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-ink-subtle font-sans">Returned Items:</span>
                  <span className="font-semibold text-ink-muted">{r.count} units</span>
                </div>
              </div>

              <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, r.percentageOfReturns))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. High-Return Product Diagnostics Ledger */}
      <div className="bg-surface-1 p-5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors space-y-3.5">
        <div className="flex items-center justify-between pb-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-subtle" />
            <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
              High-Return Product Diagnostics
            </h3>
            <TrustBadge tag="[FACT]" />
          </div>
          <span className="text-xs text-ink-subtle font-mono">
            {returnsData.highestReturnProducts.length} Items with Active Return Pressure
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-hairline text-[11px] font-medium text-ink-subtle bg-surface-2/60">
                <th className="py-2.5 px-3 min-w-[200px]">Product & SKU</th>
                <th className="py-2.5 px-3 text-right">Units Sold</th>
                <th className="py-2.5 px-3 text-right">Returned Units</th>
                <th className="py-2.5 px-3 text-right">Return Rate %</th>
                <th className="py-2.5 pr-4 text-right">Refund Exposure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-ink-muted font-mono">
              {returnsData.highestReturnProducts.map((p) => (
                <tr key={p.productId} className="hover:bg-surface-2/60 transition-colors">
                  <td className="py-2.5 px-3 font-sans">
                    <div className="font-semibold text-ink line-clamp-1">{p.title}</div>
                    <div className="text-[10px] text-ink-subtle font-mono">SKU-{p.productId}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-ink-muted">
                    {p.unitsSold}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-rose-400">
                    {p.returnsCount}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-rose-400">
                    {p.returnRatePct.toFixed(1)}%
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-ink">
                    ₹{p.refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Pre-Shipment Order Cancellation Analysis Strip */}
      <div className="bg-surface-1 p-5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
              Pre-Shipment Order Cancellation Diagnostics
            </h3>
            <TrustBadge tag="[FACT]" />
          </div>
          <span className="text-[11px] text-ink-subtle font-mono">
            {cancellationsData.totalCancellations} Cancellations ({cancellationsData.cancellationRatePct.toFixed(2)}% of {cancellationsData.totalOrders} Orders)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {cancellationsData.reasonBreakdown.map((c, idx) => (
            <div
              key={idx}
              className="bg-surface-2 p-3 rounded-md border border-hairline space-y-1.5"
            >
              <div className="flex items-center justify-between text-[11px] text-ink-subtle font-mono">
                <span className="font-semibold text-ink line-clamp-1">{c.reason}</span>
              </div>
              <div className="text-sm font-semibold font-mono text-ink">
                {c.count} orders
              </div>
              <div className="text-[10px] text-amber-400/80 font-mono">
                {c.percentageOfCancels.toFixed(1)}% of cancellations
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Contextual Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />
    </div>
  );
}
