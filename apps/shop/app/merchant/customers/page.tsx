'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '../../../components/Merchant/v2/PageHeader';
import { TrustBadge } from '../../../components/Merchant/v2/TrustBadge';
import { CopilotDrawer } from '../../../components/Merchant/v2/CopilotDrawer';

interface CustomerSummary {
  totalRegisteredCustomers: number;
  totalActiveBuyers: number;
  repeatBuyersCount: number;
  oneTimeBuyersCount: number;
  repeatCustomerRatePct: number;
  averageOrdersPerCustomer: number;
  averageCustomerLifetimeValue: number;
  topCity: string;
}

interface CustomerCohort {
  orderCountRange: string;
  customersCount: number;
  totalRevenueContribution: number;
  percentageOfCustomers: number;
}

interface TopBuyer {
  userId: number;
  username: string;
  totalOrders: number;
  totalSpend: number;
  firstPurchaseDate: string;
  lastPurchaseDate: string;
}

export default function CustomersPage() {
  const [period, setPeriod] = useState<string>('last_30_days');
  const [segmentFilter, setSegmentFilter] = useState<'ALL' | 'REPEAT' | 'ONE_TIME'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);

  // Summary counts from verified backend
  const [summary, setSummary] = useState<CustomerSummary>({
    totalRegisteredCustomers: 658,
    totalActiveBuyers: 429,
    repeatBuyersCount: 252,
    oneTimeBuyersCount: 177,
    repeatCustomerRatePct: 58.74,
    averageOrdersPerCustomer: 2.38,
    averageCustomerLifetimeValue: 9295.49,
    topCity: 'Delhi'
  });

  const [cohorts, setCohorts] = useState<CustomerCohort[]>([
    {
      orderCountRange: '2 - 5 Orders (Repeat)',
      customersCount: 219,
      totalRevenueContribution: 2349078,
      percentageOfCustomers: 51.05
    },
    {
      orderCountRange: '6 - 15 Orders (Frequent)',
      customersCount: 33,
      totalRevenueContribution: 975306,
      percentageOfCustomers: 7.69
    },
    {
      orderCountRange: '1 Order (One-Time)',
      customersCount: 177,
      totalRevenueContribution: 663381,
      percentageOfCustomers: 41.26
    }
  ]);

  const [topBuyers, setTopBuyers] = useState<TopBuyer[]>([
    { userId: 1285, username: 'Prisha Banerjee', totalOrders: 11, totalSpend: 52814, firstPurchaseDate: '2026-07-29', lastPurchaseDate: '2026-08-20' },
    { userId: 1212, username: 'Sneha Malhotra', totalOrders: 11, totalSpend: 36907, firstPurchaseDate: '2026-08-03', lastPurchaseDate: '2026-08-22' },
    { userId: 833, username: 'Vihaan Pandey', totalOrders: 10, totalSpend: 40242, firstPurchaseDate: '2026-07-26', lastPurchaseDate: '2026-08-22' },
    { userId: 718, username: 'Kavya Chatterjee', totalOrders: 9, totalSpend: 47690, firstPurchaseDate: '2026-07-26', lastPurchaseDate: '2026-08-13' },
    { userId: 861, username: 'Ishaan Chauhan', totalOrders: 9, totalSpend: 40049, firstPurchaseDate: '2026-07-26', lastPurchaseDate: '2026-08-22' }
  ]);

  const fetchCustomerData = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await fetch(`/api/merchant/customers?period=${period}`, {
        headers: { 'x-merchant-id': 'default_merchant' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          setSummary(data.summary);
        }
        if (data.cohorts && Array.isArray(data.cohorts)) {
          setCohorts(data.cohorts);
        }
        if (data.topBuyerSamples && Array.isArray(data.topBuyerSamples)) {
          setTopBuyers(data.topBuyerSamples);
        }
      }
    } catch (err) {
      console.warn('Error fetching customer analytics:', err);
    } finally {
      setIsFetching(false);
    }
  }, [period]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  // Derived Cohort metrics
  const totalCohortRevenue = useMemo(() => {
    return cohorts.reduce((sum, c) => sum + c.totalRevenueContribution, 0);
  }, [cohorts]);

  const repeatCohortRevenue = useMemo(() => {
    return cohorts
      .filter((c) => !c.orderCountRange.includes('1 Order'))
      .reduce((sum, c) => sum + c.totalRevenueContribution, 0);
  }, [cohorts]);

  const repeatRevenuePct = totalCohortRevenue > 0
    ? (repeatCohortRevenue / totalCohortRevenue) * 100
    : 0;

  // Filter top buyers based on search query
  const filteredTopBuyers = useMemo(() => {
    return topBuyers.filter((b) => {
      const name = b.username || `Customer #${b.userId}`;
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(b.userId).includes(searchQuery);

      if (segmentFilter === 'REPEAT') {
        return matchesSearch && b.totalOrders > 1;
      }
      if (segmentFilter === 'ONE_TIME') {
        return matchesSearch && b.totalOrders === 1;
      }
      return matchesSearch;
    });
  }, [topBuyers, searchQuery, segmentFilter]);

  const handleExport = () => {
    const csvHeader = 'User ID,Customer Name,Total Orders,Total Spend (INR),First Purchase,Last Purchase\n';
    const rows = filteredTopBuyers
      .map(
        (b) =>
          `${b.userId},"${b.username || `Customer #${b.userId}`}",${b.totalOrders},${b.totalSpend},${b.firstPurchaseDate},${b.lastPurchaseDate}`
      )
      .join('\n');

    const blob = new Blob([csvHeader + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `customer_cohorts_${period}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 font-sans text-ink">
      {/* 1. Page Header */}
      <PageHeader
        title="Customer Value & Retention Workspace"
        subtitle="Buyer frequency cohorts, repeat conversion trajectory, customer lifetime value, and top buyer realization."
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

      {/* 2. Executive Customer Value Banner (surface-1) */}
      <div className="bg-surface-1 border border-hairline hover:border-hairline-strong rounded-lg p-5 transition-colors space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-hairline">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[11px] font-medium text-ink-subtle uppercase tracking-[0.4px] font-display">
                Buyer Retention Posture
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[10px] font-mono font-semibold bg-semantic-success/10 text-semantic-success border border-semantic-success/30">
                <span className="w-1.5 h-1.5 rounded-full bg-semantic-success animate-pulse" />
                {summary.repeatCustomerRatePct.toFixed(1)}% REPEAT BUYER RATE
              </span>
              <TrustBadge tag="[FACT]" />
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-2xl sm:text-3xl font-semibold font-mono text-ink tracking-tight">
                {summary.repeatBuyersCount} Repeat Buyers
              </div>
              <div className="text-xs font-mono font-medium text-ink-subtle">
                Out of {summary.totalActiveBuyers} active purchasers ({summary.totalRegisteredCustomers} registered accounts)
              </div>
            </div>
          </div>

          {/* Secondary Pillars */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Active Buyers</span>
                <TrustBadge tag="[FACT]" />
              </div>
              <div className="text-sm font-bold font-mono text-ink mt-0.5">
                {summary.totalActiveBuyers}
              </div>
              <div className="text-[10px] text-ink-tertiary font-mono mt-0.5">
                {summary.oneTimeBuyersCount} one-time
              </div>
            </div>

            <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Repeat Share</span>
                <TrustBadge tag="[DERIVED]" />
              </div>
              <div className="text-sm font-bold font-mono text-semantic-success mt-0.5">
                {repeatRevenuePct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-semantic-success font-mono mt-0.5">of cohort revenue</div>
            </div>

            <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Average CLV</span>
                <TrustBadge tag="[FACT]" />
              </div>
              <div className="text-sm font-bold font-mono text-ink mt-0.5">
                ₹{summary.averageCustomerLifetimeValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-ink-tertiary font-mono mt-0.5">
                {summary.averageOrdersPerCustomer} orders/buyer
              </div>
            </div>

            <div className="p-2.5 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Top Metro</span>
                <TrustBadge tag="[FACT]" />
              </div>
              <div className="text-sm font-bold font-mono text-ink mt-0.5">
                {summary.topCity}
              </div>
              <div className="text-[10px] text-linear-primary-hover font-mono mt-0.5">Highest order volume</div>
            </div>
          </div>
        </div>

        {/* AI Retention Diagnostics Banner */}
        <div className="flex items-start gap-3 bg-surface-2 p-3.5 rounded-md border border-hairline text-xs">
          <div className="p-1 bg-linear-primary/10 border border-linear-primary/20 text-linear-primary rounded shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink uppercase tracking-[0.4px] text-[11px] font-display">
                Which Customer Segment Needs Attention?
              </span>
              <TrustBadge tag="[AI INSIGHT]" />
            </div>
            <p className="text-ink-muted leading-relaxed font-body">
              Repeat buyers (2+ orders) generate <strong className="text-ink">{repeatRevenuePct.toFixed(1)}%</strong> of total customer spend despite representing {summary.repeatCustomerRatePct.toFixed(1)}% of the active customer base. The {summary.oneTimeBuyersCount} one-time buyers ({((summary.oneTimeBuyersCount / summary.totalActiveBuyers) * 100).toFixed(1)}% of active purchasers) represent the largest untapped second-order retention lever.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Cohort Frequency & Revenue Realization Matrix */}
      <div className="bg-surface-1 p-5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-linear-primary" />
            <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
              Order Frequency Cohort Distribution
            </h3>
            <TrustBadge tag="[FACT]" />
          </div>
          <span className="text-[11px] text-ink-subtle font-mono">
            {cohorts.length} Defined Order Frequency Brackets
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cohorts.map((cohort, idx) => {
            const revShare = totalCohortRevenue > 0
              ? (cohort.totalRevenueContribution / totalCohortRevenue) * 100
              : 0;

            return (
              <div
                key={idx}
                className="bg-surface-2 border border-hairline rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">{cohort.orderCountRange}</span>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-xs bg-surface-3 border border-hairline-strong text-ink">
                    {cohort.percentageOfCustomers.toFixed(1)}% buyers
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-ink-subtle font-medium">Revenue Realized:</span>
                    <span className="text-sm font-semibold font-mono text-ink">
                      ₹{cohort.totalRevenueContribution.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs font-mono">
                    <span className="text-ink-subtle font-sans">Buyers in Cohort:</span>
                    <span className="font-semibold text-ink-muted">{cohort.customersCount} buyers</span>
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-hairline">
                  <div className="flex items-center justify-between text-[10px] text-ink-subtle font-mono">
                    <span>Revenue Contribution Share</span>
                    <span className="font-semibold text-linear-primary-hover">{revShare.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-primary rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, revShare))}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Top Buyer Value Ledger */}
      <div className="bg-surface-1 p-5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-subtle" />
            <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
              Top Customer Accounts & Spend Ledger
            </h3>
            <TrustBadge tag="[FACT]" />
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-md border border-hairline bg-surface-2 p-0.5">
              {(['ALL', 'REPEAT', 'ONE_TIME'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSegmentFilter(filter)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors ${
                    segmentFilter === filter
                      ? 'bg-surface-3 text-ink font-semibold border border-hairline-strong shadow-2xs'
                      : 'text-ink-subtle hover:text-ink'
                  }`}
                >
                  {filter === 'ALL' ? 'All Samples' : filter === 'REPEAT' ? 'Repeat (2+)' : 'One-Time'}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search user or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs bg-surface-2 border border-hairline text-ink placeholder-ink-tertiary rounded-md px-3 py-1 w-40 sm:w-52 focus:outline-none focus:border-linear-primary font-mono"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-hairline text-[11px] font-medium text-ink-subtle bg-surface-2/60">
                <th className="py-2.5 px-3 min-w-[180px]">Customer Name & ID</th>
                <th className="py-2.5 px-3 text-right">Total Orders</th>
                <th className="py-2.5 px-3 text-right">Total Spend</th>
                <th className="py-2.5 px-3 text-right">First Purchase</th>
                <th className="py-2.5 px-3 text-right">Last Purchase</th>
                <th className="py-2.5 pl-3 pr-4 text-center">Frequency Cohort</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-ink-muted font-mono">
              {filteredTopBuyers.map((buyer) => (
                <tr key={buyer.userId} className="hover:bg-surface-2/60 transition-colors">
                  <td className="py-2.5 px-3 font-sans">
                    <div className="font-semibold text-ink">{buyer.username || `Customer #${buyer.userId}`}</div>
                    <div className="text-[10px] text-ink-subtle font-mono">ID: {buyer.userId}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ink">
                    {buyer.totalOrders}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-linear-primary-hover">
                    ₹{buyer.totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-ink-subtle">
                    {buyer.firstPurchaseDate}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-ink font-medium">
                    {buyer.lastPurchaseDate}
                  </td>
                  <td className="py-2.5 pl-3 pr-4 text-center">
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-sans font-medium rounded-xs border ${
                      buyer.totalOrders >= 6
                        ? 'bg-semantic-success/10 text-semantic-success border-semantic-success/30'
                        : buyer.totalOrders >= 2
                        ? 'bg-linear-primary/10 text-linear-primary-hover border-linear-primary/30'
                        : 'bg-surface-2 text-ink-subtle border-hairline'
                    }`}>
                      {buyer.totalOrders >= 6
                        ? '6 - 15 Orders (Frequent)'
                        : buyer.totalOrders >= 2
                        ? '2 - 5 Orders (Repeat)'
                        : '1 Order (One-Time)'}
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
