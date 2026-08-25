'use client';

import React, { useState } from 'react';

export interface ProductPerformanceItem {
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

interface ProductPerformanceTableProps {
  topProducts: ProductPerformanceItem[];
  worstProducts?: ProductPerformanceItem[];
  periodLabel?: string;
  onAiAction?: (prompt: string) => void;
  onSelectProduct?: (product: ProductPerformanceItem) => void;
}

export const ProductPerformanceTable: React.FC<ProductPerformanceTableProps> = ({
  topProducts = [],
  worstProducts = [],
  periodLabel = 'Last 30 Days',
  onAiAction,
  onSelectProduct
}) => {
  const [activeTab, setActiveTab] = useState<'top' | 'slow'>('top');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'revenue' | 'units' | 'velocity' | 'stock'>('revenue');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  const currentList = activeTab === 'top' ? topProducts : worstProducts;

  const filteredList = currentList
    .filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.categoryName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'revenue': return b.revenue - a.revenue;
        case 'units': return b.unitsSold - a.unitsSold;
        case 'velocity': return b.salesVelocity7d - a.salesVelocity7d;
        case 'stock': return a.currentStock - b.currentStock;
        default: return 0;
      }
    });

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedList = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex flex-col justify-between">
      <div>
        {/* Table Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Top Products & Catalog Performance</h3>
              <span className="text-xs text-slate-400 font-medium">• {periodLabel}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Ranked merchandise performance from PostgreSQL product metrics
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switchers */}
            <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200">
              <button
                onClick={() => setActiveTab('top')}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                  activeTab === 'top'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Top Champions
              </button>
              <button
                onClick={() => setActiveTab('slow')}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                  activeTab === 'slow'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Slow-Moving
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search catalog..."
                className="w-36 sm:w-44 rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Product Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-3">Product</th>
                <th className="pb-3 cursor-pointer hover:text-slate-700" onClick={() => setSortBy('units')}>Units Sold</th>
                <th className="pb-3 cursor-pointer hover:text-slate-700" onClick={() => setSortBy('revenue')}>Revenue</th>
                <th className="pb-3 cursor-pointer hover:text-slate-700" onClick={() => setSortBy('velocity')}>Velocity (7d)</th>
                <th className="pb-3 cursor-pointer hover:text-slate-700" onClick={() => setSortBy('stock')}>Stock Runway</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedList.map((product) => {
                const daysRemaining = product.salesVelocity7d > 0
                  ? Math.round(product.currentStock / product.salesVelocity7d)
                  : 999;

                const isCritical = daysRemaining <= 14;
                const isWarning = daysRemaining > 14 && daysRemaining <= 30;

                return (
                  <tr
                    key={product.productId}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => onSelectProduct && onSelectProduct(product)}
                  >
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {product.title}
                      </div>
                      <div className="text-[11px] text-slate-400">{product.categoryName} • ₹{product.price}</div>
                    </td>
                    <td className="py-3 font-medium text-slate-700">
                      {product.unitsSold.toLocaleString('en-IN')} units
                    </td>
                    <td className="py-3 font-bold text-slate-900">
                      ₹{product.revenue.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 font-semibold text-emerald-700">
                      {product.salesVelocity7d}/day
                    </td>
                    <td className="py-3 font-medium text-slate-600">
                      <span>{product.currentStock} in stock</span>
                      <span className="text-[11px] text-slate-400 block">
                        ~{daysRemaining > 365 ? '>1 yr' : `${daysRemaining} days`}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isCritical
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : isWarning
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isCritical ? 'Critical Stock' : isWarning ? 'Low Runway' : 'Healthy'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Controls & Pagination */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-[11px]">
            Page {currentPage} of {totalPages} ({filteredList.length} total SKUs)
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-2 py-0.5 rounded border border-slate-200 text-slate-600 text-[11px] font-bold disabled:opacity-40 hover:bg-slate-50"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-2 py-0.5 rounded border border-slate-200 text-slate-600 text-[11px] font-bold disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {onAiAction && (
          <button
            onClick={() => onAiAction(activeTab === 'top' ? 'Why are these products performing well?' : 'Why are these products not selling and how to revive them?')}
            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 group"
          >
            <span>{activeTab === 'top' ? 'Why are these products performing well?' : 'How to revive slow products?'}</span>
            <i className="fas fa-arrow-right text-[9px] group-hover:translate-x-0.5 transition-transform"></i>
          </button>
        )}
      </div>
    </div>
  );
};
