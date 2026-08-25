'use client';

import React from 'react';

interface ComparisonData {
  monthOverMonth: {
    currentPeriod: {
      label: string;
      revenue: number;
      orders: number;
      unitsSold: number;
      averageOrderValue: number;
    };
    previousPeriod: {
      label: string;
      revenue: number;
      orders: number;
      unitsSold: number;
      averageOrderValue: number;
    };
    growth: {
      revenueChangePct: number;
      ordersChangePct: number;
      unitsChangePct: number;
      aovChangePct: number;
    };
  };
  weekOverWeek: {
    currentPeriod: {
      label: string;
      revenue: number;
      orders: number;
      unitsSold: number;
      averageOrderValue: number;
    };
    previousPeriod: {
      label: string;
      revenue: number;
      orders: number;
      unitsSold: number;
      averageOrderValue: number;
    };
    growth: {
      revenueChangePct: number;
      ordersChangePct: number;
      unitsChangePct: number;
      aovChangePct: number;
    };
  };
}

interface ComparisonSystemProps {
  comparisonData: ComparisonData | null;
  onAiAction?: (prompt: string) => void;
}

export const ComparisonSystem: React.FC<ComparisonSystemProps> = ({
  comparisonData,
  onAiAction
}) => {
  if (!comparisonData) return null;

  const mom = comparisonData.monthOverMonth;
  const wow = comparisonData.weekOverWeek;

  const renderMetric = (label: string, cur: number, prev: number, pct: number, isCurrency = false) => {
    const isPositive = pct >= 0;
    return (
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-base font-bold text-slate-900">
            {isCurrency ? `₹${cur.toLocaleString('en-IN')}` : cur.toLocaleString('en-IN')}
          </span>
          <span
            className={`inline-flex items-center gap-1 font-bold text-[10px] px-1.5 py-0.5 rounded-full ${
              isPositive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            <i className={`fas fa-arrow-${isPositive ? 'up' : 'down'} text-[8px]`}></i>
            {isPositive ? '+' : ''}{pct}%
          </span>
        </div>
        <span className="text-[11px] text-slate-400 mt-1 block">
          Prior: {isCurrency ? `₹${prev.toLocaleString('en-IN')}` : prev.toLocaleString('en-IN')}
        </span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Month over Month Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Month-over-Month (MoM) Growth</h3>
              <p className="text-xs text-slate-500 mt-0.5">{mom.currentPeriod.label} vs {mom.previousPeriod.label}</p>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              30-Day Window
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            {renderMetric('Revenue', mom.currentPeriod.revenue, mom.previousPeriod.revenue, mom.growth.revenueChangePct, true)}
            {renderMetric('Orders', mom.currentPeriod.orders, mom.previousPeriod.orders, mom.growth.ordersChangePct)}
            {renderMetric('Units', mom.currentPeriod.unitsSold, mom.previousPeriod.unitsSold, mom.growth.unitsChangePct)}
            {renderMetric('AOV', mom.currentPeriod.averageOrderValue, mom.previousPeriod.averageOrderValue, mom.growth.aovChangePct, true)}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500">Historical performance ledger</span>
          {onAiAction && (
            <button
              onClick={() => onAiAction('Compare this month with last month')}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 group"
            >
              <span>Explain MoM Deltas</span>
              <i className="fas fa-arrow-right text-[9px] group-hover:translate-x-0.5 transition-transform"></i>
            </button>
          )}
        </div>
      </div>

      {/* Week over Week Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Week-over-Week (WoW) Velocity</h3>
              <p className="text-xs text-slate-500 mt-0.5">{wow.currentPeriod.label} vs {wow.previousPeriod.label}</p>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
              7-Day Window
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            {renderMetric('Revenue', wow.currentPeriod.revenue, wow.previousPeriod.revenue, wow.growth.revenueChangePct, true)}
            {renderMetric('Orders', wow.currentPeriod.orders, wow.previousPeriod.orders, wow.growth.ordersChangePct)}
            {renderMetric('Units', wow.currentPeriod.unitsSold, wow.previousPeriod.unitsSold, wow.growth.unitsChangePct)}
            {renderMetric('AOV', wow.currentPeriod.averageOrderValue, wow.previousPeriod.averageOrderValue, wow.growth.aovChangePct, true)}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500">Short-term velocity telemetry</span>
          {onAiAction && (
            <button
              onClick={() => onAiAction('How did we perform this week compared with last week?')}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 group"
            >
              <span>Explain WoW Velocity</span>
              <i className="fas fa-arrow-right text-[9px] group-hover:translate-x-0.5 transition-transform"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
