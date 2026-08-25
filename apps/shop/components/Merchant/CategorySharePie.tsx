'use client';

import React from 'react';

export interface CategoryPerformanceItem {
  categoryId: number;
  categoryName: string;
  mainCategory: string;
  totalProducts: number;
  unitsSold: number;
  grossRevenue: number;
  ordersCount: number;
  revenueSharePct: number;
}

interface CategorySharePieProps {
  categories: CategoryPerformanceItem[];
  periodLabel?: string;
  onAiAction?: (prompt: string) => void;
}

export const CategorySharePie: React.FC<CategorySharePieProps> = ({
  categories = [],
  periodLabel = 'Last 30 Days',
  onAiAction
}) => {
  const sorted = [...categories].sort((a, b) => b.grossRevenue - a.grossRevenue);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Category Performance</h3>
            <p className="text-xs text-slate-500 mt-0.5">Revenue share and volume contribution across merchandise categories</p>
          </div>
          <span className="text-xs text-slate-400 font-medium">• {periodLabel}</span>
        </div>

        {/* Horizontal Bar Breakdown */}
        <div className="mt-5 space-y-4">
          {sorted.map((cat) => (
            <div key={cat.categoryId} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{cat.categoryName}</span>
                  <span className="text-[11px] text-slate-400 font-medium">({cat.mainCategory})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">{cat.unitsSold.toLocaleString('en-IN')} units</span>
                  <span className="font-bold text-slate-900">₹{cat.grossRevenue.toLocaleString('en-IN')}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                    {cat.revenueSharePct}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${Math.min(cat.revenueSharePct * 1.5, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer AI Trigger */}
      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[11px]">
          {sorted.length} categories tracked
        </span>

        {onAiAction && (
          <button
            onClick={() => onAiAction('Which category performs best and where should I expand?')}
            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 group"
          >
            <span>Analyze Category Opportunities</span>
            <i className="fas fa-arrow-right text-[9px] group-hover:translate-x-0.5 transition-transform"></i>
          </button>
        )}
      </div>
    </div>
  );
};
