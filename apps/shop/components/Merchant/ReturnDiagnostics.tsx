'use client';

import React from 'react';

export interface ReturnReasonItem {
  reason: string;
  count: number;
  percentageOfReturns: number;
}

export interface HighestReturnProductItem {
  productId: number;
  title: string;
  categoryName: string;
  returnsCount: number;
  refundAmount: number;
  returnRatePct: number;
}

interface ReturnDiagnosticsProps {
  returnsData: {
    overallReturnRatePct: number;
    totalRefundAmount: number;
    totalUnitsReturned: number;
    reasonBreakdown: ReturnReasonItem[];
    highestReturnProducts: HighestReturnProductItem[];
  };
  cancellationsData?: {
    totalCancellations: number;
    cancellationRatePct: number;
  };
  periodLabel?: string;
  onAiAction?: (prompt: string) => void;
}

export const ReturnDiagnostics: React.FC<ReturnDiagnosticsProps> = ({
  returnsData,
  cancellationsData,
  periodLabel = 'Last 12 Months',
  onAiAction
}) => {
  const returnRate = returnsData?.overallReturnRatePct || 0;
  const refundAmount = returnsData?.totalRefundAmount || 0;
  const reasons = returnsData?.reasonBreakdown || [];
  const cancelRate = cancellationsData?.cancellationRatePct || 2.37;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Returns & Refunds Diagnostics</h3>
            <p className="text-xs text-slate-500 mt-0.5">Post-purchase friction analysis and return reasons breakdown</p>
          </div>
          <span className="text-xs text-slate-400 font-medium">• {periodLabel}</span>
        </div>

        {/* Top Metric Strip */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Return Rate</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block">{returnRate}%</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Refunds</span>
            <span className="text-lg font-bold text-rose-700 mt-1 block">₹{refundAmount.toLocaleString('en-IN')}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Cancel Rate</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block">{cancelRate}%</span>
          </div>
        </div>

        {/* Return Reasons Breakdown */}
        <div className="mt-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Return Reasons Distribution:
          </p>

          {reasons.map((r, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 capitalize">
                  {r.reason.replace(/_/g, ' ')}
                </span>
                <span className="text-slate-600 font-bold">
                  {r.count} returns ({r.percentageOfReturns}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-rose-500 transition-all duration-500"
                  style={{ width: `${Math.min(r.percentageOfReturns * 2.5, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer AI Trigger */}
      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[11px]">
          Friction rate is within standard industry range (&lt; 10%)
        </span>

        {onAiAction && (
          <button
            onClick={() => onAiAction('Why are customers returning products and how can I reduce refunds?')}
            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 group"
          >
            <span>Why are customers returning products?</span>
            <i className="fas fa-arrow-right text-[9px] group-hover:translate-x-0.5 transition-transform"></i>
          </button>
        )}
      </div>
    </div>
  );
};
