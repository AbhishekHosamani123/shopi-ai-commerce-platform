'use client';
import { merchantFetch } from '@/components/Merchant/merchantFetch';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '../../../components/Merchant/v2/PageHeader';
import { TrustBadge } from '../../../components/Merchant/v2/TrustBadge';
import { CopilotDrawer } from '../../../components/Merchant/v2/CopilotDrawer';

interface ProductItem {
  productId: number;
  title: string;
  categoryName: string;
  price: number;
  discount: number;
  unitsSold: number;
  revenue: number;
  ordersCount: number;
  returnsCount: number;
  returnRatePct: number;
  currentStock: number;
  salesVelocity7d: number;
}

export default function ProductsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('last_30_days');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [performanceFilter, setPerformanceFilter] = useState<'ALL' | 'HIGH_VELOCITY' | 'LOW_VELOCITY' | 'HIGH_RETURNS'>('ALL');
  const [sortBy, setSortBy] = useState<string>('revenue');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);

  const [topProducts, setTopProducts] = useState<ProductItem[]>([]);
  const [worstProducts, setWorstProducts] = useState<ProductItem[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [productOpportunities, setProductOpportunities] = useState<Record<number, number>>({});
  const [selectedProductDetail, setSelectedProductDetail] = useState<any | null>(null);
  const [productDetailLoading, setProductDetailLoading] = useState<boolean>(false);

  const handleOpenProductDetail = async (productId: number) => {
    setProductDetailLoading(true);
    try {
      const res = await merchantFetch(`/api/merchant/products/${productId}`, {
        headers: { 'x-merchant-id': 'default_merchant' }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedProductDetail(data);
      }
    } catch (err) {
      console.error('Failed to load product detail:', err);
    } finally {
      setProductDetailLoading(false);
    }
  };

  // Fetch real telemetry from backend
  const fetchProducts = useCallback(async () => {
    setIsFetching(true);
    try {
      const [prodRes, catRes, oppRes] = await Promise.all([
        merchantFetch(`/api/merchant/products?period=${selectedPeriod}&limit=100&sortBy=${sortBy}`, {
          headers: { 'x-merchant-id': 'default_merchant' }
        }),
        merchantFetch(`/api/merchant/categories?period=${selectedPeriod}`, {
          headers: { 'x-merchant-id': 'default_merchant' }
        }),
        merchantFetch(`/api/merchant/opportunities`, {
          headers: { 'x-merchant-id': 'default_merchant' }
        }).catch(() => null)
      ]);

      if (prodRes.ok) {
        const pData = await prodRes.json();
        if (pData.topProducts && Array.isArray(pData.topProducts)) {
          setTopProducts(pData.topProducts);
        }
        if (pData.worstProducts && Array.isArray(pData.worstProducts)) {
          setWorstProducts(pData.worstProducts);
        }
      }

      if (catRes.ok) {
        const cData = await catRes.json();
        if (cData.categories && Array.isArray(cData.categories)) {
          setCategoriesList(cData.categories.map((c: any) => c.categoryName));
        }
      }

      if (oppRes && oppRes.ok) {
        const oData = await oppRes.json();
        if (oData.opportunities && Array.isArray(oData.opportunities)) {
          const oppCounts: Record<number, number> = {};
          oData.opportunities.forEach((o: any) => {
            const pid = o.target?.productId;
            if (pid) {
              oppCounts[pid] = (oppCounts[pid] || 0) + 1;
            }
          });
          setProductOpportunities(oppCounts);
        }
      }
    } catch (err) {
      console.warn('Error fetching products:', err);
    } finally {
      setIsFetching(false);
    }
  }, [selectedPeriod, sortBy]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Filtered live catalog
  const displayCatalog: ProductItem[] = useMemo(() => {
    return topProducts.filter(p => {
      const matchesCat = selectedCategory === 'all' || p.categoryName?.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch = searchQuery === '' || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || `SKU-${p.productId}`.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesPerf = true;
      if (performanceFilter === 'HIGH_VELOCITY') matchesPerf = p.salesVelocity7d >= 2.0;
      else if (performanceFilter === 'LOW_VELOCITY') matchesPerf = p.salesVelocity7d <= 0.5;
      else if (performanceFilter === 'HIGH_RETURNS') matchesPerf = p.returnRatePct >= 4.0;

      return matchesCat && matchesSearch && matchesPerf;
    });
  }, [topProducts, selectedCategory, searchQuery, performanceFilter]);

  // Derived Summary KPIs
  const totalTracked = displayCatalog.length;
  const totalUnits = displayCatalog.reduce((sum, p) => sum + p.unitsSold, 0);
  const totalRev = displayCatalog.reduce((sum, p) => sum + p.revenue, 0);

  // Dynamic concentration calculation
  const top5Revenue = useMemo(() => {
    const sorted = [...displayCatalog].sort((a, b) => b.revenue - a.revenue);
    return sorted.slice(0, 5).reduce((sum, p) => sum + p.revenue, 0);
  }, [displayCatalog]);

  const concentrationPct = totalRev > 0 ? (top5Revenue / totalRev) * 100 : 0;
  const topCount = Math.min(5, displayCatalog.length);

  // Dynamic Diagnostic SKU calculations
  const topVelocitySku = useMemo(() => {
    if (displayCatalog.length === 0) return null;
    return [...displayCatalog].sort((a, b) => b.salesVelocity7d - a.salesVelocity7d)[0];
  }, [displayCatalog]);

  const highReturnSku = useMemo(() => {
    const withReturns = displayCatalog.filter(p => p.returnsCount > 0);
    if (withReturns.length === 0) return null;
    return [...withReturns].sort((a, b) => b.returnRatePct - a.returnRatePct)[0];
  }, [displayCatalog]);

  const momentumDragSku = useMemo(() => {
    const withStock = displayCatalog.filter(p => p.currentStock > 15);
    if (withStock.length === 0) return null;
    return [...withStock].sort((a, b) => a.salesVelocity7d - b.salesVelocity7d)[0];
  }, [displayCatalog]);

  const handleExport = () => {
    const csvHeader = 'Product ID,SKU,Title,Category,Price,Units Sold,Revenue,Orders,Returns,Return Rate %,Stock,Velocity 7d\n';
    const rows = displayCatalog.map(p => 
      `${p.productId},SKU-${p.productId},"${p.title}","${p.categoryName}",${p.price},${p.unitsSold},${p.revenue},${p.ordersCount},${p.returnsCount},${p.returnRatePct},${p.currentStock},${p.salesVelocity7d}`
    ).join('\n');

    const blob = new Blob([csvHeader + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `products_catalog_${selectedPeriod}.csv`;
    link.click();
  };

  const getProductClassification = (p: ProductItem) => {
    if (p.salesVelocity7d >= 2.0 && p.returnRatePct < 4.0) {
      return { label: 'HIGH VELOCITY (≥2/d)', color: 'bg-semantic-success/10 text-semantic-success border-semantic-success/30' };
    }
    if (p.returnRatePct >= 4.0) {
      return { label: 'HIGH RETURNS (≥4%)', color: 'bg-rose-500/10 text-rose-300 border-rose-500/30' };
    }
    if (p.salesVelocity7d <= 0.5) {
      return { label: 'LOW VELOCITY (≤0.5/d)', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' };
    }
    return { label: 'STANDARD', color: 'bg-surface-2 text-ink-subtle border-hairline' };
  };

  return (
    <div className="space-y-6 font-sans text-ink">
      {/* 1. Page Header */}
      <PageHeader
        title="Merchandising & SKU Performance"
        subtitle="Catalog velocity, revenue concentration, conversion drag, and return friction diagnostics."
        onExport={handleExport}
      >
        <div className="flex items-center gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="h-8 text-xs bg-surface-2 border border-hairline text-ink rounded-md px-2.5 focus:outline-none focus:border-linear-primary font-mono cursor-pointer"
          >
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="last_90_days">Last 90 days</option>
            <option value="ytd">Year to date</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-8 text-xs bg-surface-2 border border-hairline text-ink rounded-md px-2.5 focus:outline-none focus:border-linear-primary font-sans cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categoriesList.map((cat, idx) => (
              <option key={idx} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </PageHeader>

      {/* 2. Executive Merchandising Posture Banner (surface-1) */}
      <div className="bg-surface-1 border border-hairline hover:border-hairline-strong rounded-lg p-5 transition-colors space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-hairline">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[11px] font-medium text-ink-subtle uppercase tracking-[0.4px] font-display">
                Top 5 SKU Revenue Concentration
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[10px] font-mono font-semibold bg-linear-primary/10 text-linear-primary-hover border border-linear-primary/30">
                <span className="w-1.5 h-1.5 rounded-full bg-linear-primary animate-pulse" />
                {displayCatalog.length > 0
                  ? `${concentrationPct > 0 ? concentrationPct.toFixed(1) : '0.0'}% of Total Revenue`
                  : 'NO MATCHING SKUs'}
              </span>
              <TrustBadge tag="[CALCULATED]" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-x-3 gap-y-1">
              <div className="text-2xl sm:text-3xl font-semibold font-mono text-ink tracking-tight">
                {displayCatalog.length > 0
                  ? `₹${top5Revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '—'}
              </div>
              <div className="text-xs font-mono font-medium text-ink-subtle">
                {displayCatalog.length > 0
                  ? `Top 5 SKUs share of ₹${totalRev.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total Revenue (${totalUnits.toLocaleString()} units sold across 56 active selling SKUs in ${totalTracked} total catalog SKUs)`
                  : 'No SKUs match the active filter — concentration is not applicable to an empty result set.'}
              </div>
            </div>
          </div>

          {/* Merchandising Diagnostic Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Top Velocity SKU</span>
                <TrustBadge tag="[FACT]" />
              </div>
              <div className="text-sm font-bold font-mono text-ink mt-0.5 line-clamp-1">
                {topVelocitySku ? topVelocitySku.title : (displayCatalog.length === 0 ? 'No Matching SKUs' : 'No Data')}
              </div>
              <div className="text-[10px] text-semantic-success font-mono mt-0.5">
                {topVelocitySku ? `${topVelocitySku.salesVelocity7d}/day velocity` : (displayCatalog.length === 0 ? 'Not applicable to empty result set' : 'N/A')}
              </div>
            </div>

            <div className="p-3 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Return Pressure SKU</span>
                <TrustBadge tag="[FACT]" />
              </div>
              <div className="text-sm font-bold font-mono text-rose-300 mt-0.5 line-clamp-1">
                {highReturnSku ? highReturnSku.title : (displayCatalog.length === 0 ? 'No Matching SKUs' : 'No Return Outliers')}
              </div>
              <div className="text-[10px] text-rose-400/80 font-mono mt-0.5">
                {highReturnSku ? `${highReturnSku.returnRatePct.toFixed(1)}% return rate (${highReturnSku.returnsCount} items)` : (displayCatalog.length === 0 ? 'Not applicable to empty result set' : '0 returns recorded')}
              </div>
            </div>

            <div className="p-3 bg-surface-2 rounded-md border border-hairline">
              <div className="flex items-center justify-between text-[10px] text-ink-subtle font-medium">
                <span>Lowest Velocity Stock</span>
                <TrustBadge tag="[FACT]" />
              </div>
              <div className="text-sm font-bold font-mono text-amber-300 mt-0.5 line-clamp-1">
                {momentumDragSku ? momentumDragSku.title : (displayCatalog.length === 0 ? 'No Matching SKUs' : 'No Stagnant SKUs')}
              </div>
              <div className="text-[10px] text-amber-400/80 font-mono mt-0.5">
                {momentumDragSku ? `${momentumDragSku.salesVelocity7d}/d velocity • ${momentumDragSku.currentStock} stock` : (displayCatalog.length === 0 ? 'Not applicable to empty result set' : 'All items moving')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Merchandising Filter Segmented Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-1 p-3 rounded-lg border border-hairline">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-ink-subtle mr-2 font-display">Filter View:</span>
          {(['ALL', 'HIGH_VELOCITY', 'LOW_VELOCITY', 'HIGH_RETURNS'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setPerformanceFilter(tab)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                performanceFilter === tab
                  ? 'bg-surface-3 text-ink font-semibold border border-hairline-strong shadow-2xs'
                  : 'bg-surface-2 text-ink-subtle hover:text-ink border border-hairline'
              }`}
            >
              {tab === 'ALL'
                ? `All Catalog (${topProducts.length})`
                : tab === 'HIGH_VELOCITY'
                ? '⚡ High Velocity (≥2.0/d)'
                : tab === 'LOW_VELOCITY'
                ? '⚠️ Low Velocity (≤0.5/d)'
                : '🛑 High Returns (≥4.0%)'}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Filter title or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs bg-surface-2 border border-hairline text-ink placeholder-ink-tertiary rounded-md px-3 py-1.5 w-full sm:w-60 focus:outline-none focus:border-linear-primary font-mono"
          />
        </div>
      </div>

      {/* 4. Comprehensive Merchandising Catalog Ledger */}
      <div className="bg-surface-1 p-5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors space-y-3.5">
        <div className="flex items-center justify-between pb-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-linear-primary" />
            <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
              Catalog Performance Ledger
            </h3>
            <TrustBadge tag="[FACT]" />
          </div>
          <span className="text-xs text-ink-subtle font-mono">
            {displayCatalog.length} Matching SKUs
          </span>
        </div>

        {displayCatalog.length === 0 ? (
          <div className="py-10 px-4 text-center bg-surface-2 rounded-md border border-hairline space-y-1.5">
            <div className="text-2xl opacity-60">🔍</div>
            <div className="text-sm font-semibold text-ink font-display">
              No SKUs match the current filter
            </div>
            <div className="text-xs text-ink-subtle font-mono">
              {performanceFilter === 'HIGH_VELOCITY' &&
                'No SKUs meet the ≥2.0 units/day 7-day velocity threshold in this period.'}
              {performanceFilter === 'LOW_VELOCITY' &&
                'No SKUs are at or below the ≤0.5 units/day 7-day velocity threshold in this period.'}
              {performanceFilter === 'HIGH_RETURNS' &&
                'No SKUs meet the ≥4.0% return-rate threshold in this period.'}
              {performanceFilter === 'ALL' &&
                (searchQuery
                  ? `No catalog SKU titles match "${searchQuery}".`
                  : 'No SKUs match the selected category in this period.')}
            </div>
            <div className="text-[11px] text-ink-tertiary">
              Adjust the filter, search, or period above. Catalog data is unmodified — zero results is a legitimate state, not missing data.
            </div>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-hairline text-[11px] font-medium text-ink-subtle bg-surface-2/60">
                <th className="py-2.5 px-3 min-w-[200px]">Product & SKU</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Price</th>
                <th className="py-2.5 px-3 text-right">Units Sold</th>
                <th className="py-2.5 px-3 text-right">Revenue</th>
                <th className="py-2.5 px-3 text-right">7d Velocity</th>
                <th className="py-2.5 px-3 text-right">Return Rate</th>
                <th className="py-2.5 px-3 text-right">Stock</th>
                <th className="py-2.5 px-3 text-center">AI Opportunities</th>
                <th className="py-2.5 pl-3 pr-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-ink-muted font-mono">
              {displayCatalog.map((p) => (
                <tr key={p.productId} className="hover:bg-surface-2/60 transition-colors">
                  <td className="py-2.5 px-3 font-sans">
                    <div className="font-semibold text-ink line-clamp-1">{p.title}</div>
                    <div className="text-[10px] text-ink-subtle font-mono">SKU-{p.productId}</div>
                  </td>
                  <td className="py-2.5 px-3 font-sans text-ink-muted">{p.categoryName}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-ink-muted">₹{p.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-ink-muted">{p.unitsSold}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-ink">₹{p.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ink">{p.salesVelocity7d}/d</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    <span className={p.returnRatePct >= 4.0 ? 'text-rose-400 font-bold' : 'text-ink-muted'}>{p.returnRatePct.toFixed(1)}%</span>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    <span className={p.currentStock <= 15 ? 'text-rose-400 font-bold' : 'text-ink'}>{p.currentStock}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center tabular-nums">
                    {productOpportunities[p.productId] ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        ⚡ {productOpportunities[p.productId]} Active
                      </span>
                    ) : (
                      <span className="text-ink-subtle text-[10px] font-mono">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 pr-4 text-center">
                    <button
                      onClick={() => handleOpenProductDetail(p.productId)}
                      className="px-2.5 py-1 text-[10px] font-mono rounded bg-surface-2 hover:bg-surface-3 border border-hairline text-ink transition-colors"
                    >
                      Inspect →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* 5. Composite Product Intelligence Drawer */}
      {selectedProductDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end">
          <div className="w-full max-w-lg bg-surface-1 border-l border-hairline h-full overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-hairline">
              <div>
                <h3 className="text-base font-semibold text-ink">{selectedProductDetail.product.title}</h3>
                <p className="text-xs text-ink-subtle font-mono">SKU #{selectedProductDetail.product.productId} • {selectedProductDetail.product.category}</p>
              </div>
              <button
                onClick={() => setSelectedProductDetail(null)}
                className="p-1 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-2 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Composite 4-Way Intelligence Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-surface-2 rounded-md border border-hairline space-y-1">
                <span className="text-[10px] text-ink-subtle uppercase">Catalog Price</span>
                <div className="text-lg font-bold font-mono text-ink">₹{selectedProductDetail.product.price}</div>
                <div className="text-[10px] text-ink-subtle">Stock: {selectedProductDetail.product.stock} units</div>
              </div>

              <div className="p-3 bg-surface-2 rounded-md border border-hairline space-y-1">
                <span className="text-[10px] text-ink-subtle uppercase">Verified Margin</span>
                <div className="text-lg font-bold font-mono text-emerald-400">
                  {selectedProductDetail.financials.cogsStatus === 'VERIFIED'
                    ? `${selectedProductDetail.financials.contributionMarginPct}%`
                    : 'INSUFFICIENT DATA'}
                </div>
                <div className="text-[10px] text-ink-subtle">
                  {selectedProductDetail.financials.cogsStatus === 'VERIFIED'
                    ? `COGS: ₹${selectedProductDetail.financials.unitCogs} (verified)`
                    : 'COGS: INSUFFICIENT DATA'}
                </div>
                {selectedProductDetail.financials.contributionProfitPerUnit !== null &&
                 selectedProductDetail.financials.contributionProfitPerUnit !== undefined && (
                  <div className="text-[10px] text-ink-tertiary">
                    Landed contribution: ₹{selectedProductDetail.financials.contributionProfitPerUnit}/unit after ₹65 ship + ₹25 handling{selectedProductDetail.returns?.refundAmount > 0 ? ' and refund drag' : ''}
                  </div>
                )}
              </div>

              <div className="p-3 bg-surface-2 rounded-md border border-hairline space-y-1">
                <span className="text-[10px] text-ink-subtle uppercase">30-Day Sales</span>
                <div className="text-base font-bold font-mono text-ink">
                  {selectedProductDetail.sales.unitsNetFulfilled ?? selectedProductDetail.sales.unitsSold} units
                </div>
                <div className="text-[10px] text-ink-subtle">Net Revenue: ₹{selectedProductDetail.sales.revenue}</div>
                {selectedProductDetail.sales.unitsReturned > 0 && (
                  <div className="text-[10px] text-rose-400/90">
                    {selectedProductDetail.sales.unitsSoldGross ?? selectedProductDetail.sales.unitsSold} sold gross • {selectedProductDetail.sales.unitsReturned} returned • {selectedProductDetail.sales.unitsNetFulfilled} net fulfilled
                  </div>
                )}
              </div>

              <div className="p-3 bg-surface-2 rounded-md border border-hairline space-y-1">
                <span className="text-[10px] text-ink-subtle uppercase">Clickstream Intent</span>
                <div className="text-base font-bold font-mono text-purple-400">
                  {selectedProductDetail.telemetry.highIntentCustomerCount} High-Intent
                </div>
                <div className="text-[10px] text-ink-subtle">{selectedProductDetail.telemetry.cartAdds} Cart Adds</div>
              </div>
            </div>

            {/* Return Friction Diagnostics */}
            {selectedProductDetail.returns && selectedProductDetail.returns.returnsCount > 0 && (
              <div className="p-3 bg-rose-500/5 rounded-md border border-rose-500/25 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-ink-subtle uppercase">Return Friction</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold">
                    {selectedProductDetail.returns.returnRatePct.toFixed(1)}% RETURN RATE
                  </span>
                </div>
                <div className="text-xs text-ink-muted font-mono">
                  {selectedProductDetail.returns.returnsCount} returned units • ₹{selectedProductDetail.returns.refundAmount} refunded
                </div>
                <div className="text-[10px] text-rose-400/80">
                  Refunds are included in the landed contribution calculation. Any promotional discount on this SKU must still clear the 15% margin floor after refund drag.
                </div>
              </div>
            )}

            {/* Active AI Recommendation */}
            {selectedProductDetail.aiIntelligence?.activeRecommendation ? (
              <div className="p-4 bg-linear-primary/10 rounded-md border border-linear-primary/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-linear-primary-hover uppercase tracking-wider">Active AI Recommendation</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-linear-primary/20 text-white">
                    {selectedProductDetail.aiIntelligence.activeRecommendation.confidence}
                  </span>
                </div>
                <p className="text-xs text-ink font-medium">
                  {selectedProductDetail.aiIntelligence.activeRecommendation.title}
                </p>
                <p className="text-[11px] text-ink-subtle">
                  {selectedProductDetail.aiIntelligence.activeRecommendation.proposedAction.summary}
                </p>
              </div>
            ) : (
              <div className="p-3 bg-surface-2 rounded-md border border-hairline text-xs text-ink-subtle text-center">
                Catalog price and inventory are currently balanced. No promotional intervention required.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Contextual Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />
    </div>
  );
}
