'use client';

import React from 'react';

interface AiBusinessSummaryCardProps {
  overviewData: any;
  comparisonData: any;
  topProducts: any[];
  onAiAction?: (prompt: string) => void;
}

export const AiBusinessSummaryCard: React.FC<AiBusinessSummaryCardProps> = ({
  overviewData,
  comparisonData,
  topProducts = [],
  onAiAction
}) => {
  const mom = comparisonData?.monthOverMonth;
  const growth = mom?.growth;
  const cur = mom?.currentPeriod;
  const prev = mom?.previousPeriod;

  const revGrowth = growth?.revenueChangePct ?? overviewData?.kpis?.revenueGrowthPct ?? 0;
  const ordGrowth = growth?.ordersChangePct ?? overviewData?.kpis?.ordersGrowthPct ?? 0;
  const aovGrowth = growth?.aovChangePct ?? overviewData?.kpis?.aovGrowthPct ?? 0;

  const isPositive = revGrowth >= 0;
  const topProduct = topProducts[0];

  return (
    <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30 p-6 shadow-sm flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-emerald-100/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-sm">
              🤖
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">AI Business Insights</h3>
              <p className="text-[11px] text-slate-500 font-medium">Autonomous summary from PostgreSQL telemetry</p>
            </div>
          </div>

          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
            Live Analysis
          </span>
        </div>

        {/* Dynamic Executive Takeaway */}
        <div className="mt-4 p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-baseline gap-2">
            <span className={`text-base font-extrabold ${isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
              Revenue is {isPositive ? 'up' : 'down'} {Math.abs(revGrowth)}%
            </span>
            <span className="text-xs text-slate-500 font-medium">vs prior period</span>
          </div>

          <div className="mt-2.5 space-y-1.5 text-xs text-slate-700">
            <div className="flex items-start gap-1.5">
              <span className="text-emerald-600 font-bold">•</span>
              <span>
                <strong className="text-slate-900">Primary driver:</strong> Order volume {ordGrowth >= 0 ? 'increased' : 'decreased'} {Math.abs(ordGrowth)}% ({cur?.orders || overviewData?.kpis?.totalOrders || 0} orders vs {prev?.orders || 0}).
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-emerald-600 font-bold">•</span>
              <span>
                <strong className="text-slate-900">Secondary driver:</strong> Average order value {aovGrowth >= 0 ? 'increased' : 'decreased'} {Math.abs(aovGrowth)}% (₹{(cur?.averageOrderValue || overviewData?.kpis?.averageOrderValue || 0).toLocaleString('en-IN')}).
              </span>
            </div>
            {topProduct && (
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">•</span>
                <span>
                  <strong className="text-slate-900">Top contributor:</strong> {topProduct.title} (₹{topProduct.revenue.toLocaleString('en-IN')}, {topProduct.salesVelocity7d}/day velocity).
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actionable Recommendations */}
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Recommended Operational Actions:
          </p>
          <ul className="space-y-1.5 text-xs text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold mt-0.5">→</span>
              <span>Monitor velocity on top revenue champions to prevent unexpected stockouts.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold mt-0.5">→</span>
              <span>Maintain active marketing allocation on top-performing categories.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold mt-0.5">→</span>
              <span>Review low-turnover items for potential bundle discount opportunities.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Footer Ask AI Button */}
      <div className="mt-5 pt-3 border-t border-emerald-100/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">Need deeper reasoning?</span>
        {onAiAction && (
          <button
            onClick={() => onAiAction('Why did sales change and what should I focus on?')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white border border-emerald-200 px-3 py-1.5 rounded-lg shadow-2xs flex items-center gap-1.5 hover:border-emerald-300 transition-all"
          >
            <span>Ask Copilot to Elaborate</span>
            <i className="fas fa-arrow-right text-[10px]"></i>
          </button>
        )}
      </div>
    </div>
  );
};
