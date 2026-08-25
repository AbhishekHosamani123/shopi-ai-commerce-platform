'use client';

import React, { useState, useEffect } from 'react';

interface DailyBriefingBannerProps {
  onActionClick?: (actionId?: string) => void;
  onRefresh?: () => void;
}

export const DailyBriefingBanner: React.FC<DailyBriefingBannerProps> = ({
  onActionClick,
  onRefresh
}) => {
  const [briefing, setBriefing] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/merchant/ai/daily-briefing', {
      headers: {
        'x-merchant-role': 'merchant_admin',
        'x-merchant-id': 'default_merchant'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.briefing) {
          setBriefing(data.briefing);
        }
      })
      .catch(err => console.error('Failed to load daily briefing:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-1/4 mb-3"></div>
        <div className="h-8 bg-slate-800 rounded w-1/2"></div>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
        {/* Left Side: Greeting & Business Health */}
        <div className="space-y-2 max-w-md">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-sm">
              ☀️
            </div>
            <div>
              <span className="text-xs font-bold text-amber-400 tracking-wide uppercase">{briefing.greeting}</span>
              <span className="text-xs text-slate-400 ml-2">({briefing.date})</span>
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-extrabold text-white">Health Score:</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-emerald-400">{briefing.businessHealthScore}/100</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                {briefing.healthStatus}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Yesterday generated <span className="font-bold text-white">₹{briefing.yesterdayMetrics.revenue.toLocaleString('en-IN')}</span> across <span className="font-bold text-white">{briefing.yesterdayMetrics.orderCount} orders</span> (AOV: ₹{briefing.yesterdayMetrics.aov.toLocaleString('en-IN')}) with <span className="font-bold text-emerald-400">{briefing.yesterdayMetrics.contributionMarginPct}%</span> net contribution margin.
          </p>
        </div>

        {/* Middle: Performance Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-400">Revenue (Yesterday)</span>
            <div className="text-sm font-bold text-white mt-0.5">₹{briefing.yesterdayMetrics.revenue.toLocaleString('en-IN')}</div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 mt-1">
              ↑ +{briefing.periodComparison.revenueChangePct}% DoD
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-400">Total Orders</span>
            <div className="text-sm font-bold text-white mt-0.5">{briefing.yesterdayMetrics.orderCount}</div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 mt-1">
              ↑ +{briefing.periodComparison.ordersChangePct}%
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-400">Pending Approvals</span>
            <div className="text-sm font-bold text-amber-400 mt-0.5">{briefing.pendingApprovalCount} Actions</div>
            <span className="text-[10px] text-slate-500">Requires Review</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-400">Today's Forecast</span>
            <div className="text-sm font-bold text-blue-400 mt-0.5">₹{Math.round(briefing.todayForecast.midRevenue / 1000)}k</div>
            <span className="text-[10px] text-slate-400">₹{Math.round(briefing.todayForecast.minRevenue / 1000)}k - ₹{Math.round(briefing.todayForecast.maxRevenue / 1000)}k</span>
          </div>
        </div>
      </div>

      {/* Bottom Insights Bar: Top Win, Risk & Recommended Action */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-800/80 text-xs">
        {/* Top Win */}
        <div className="flex items-start gap-2.5 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
          <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 text-xs">
            🏆
          </div>
          <div>
            <span className="font-bold text-emerald-400">Top Win:</span>
            <p className="text-slate-300 mt-0.5">{briefing.topWin.description}</p>
          </div>
        </div>

        {/* Biggest Risk */}
        <div className="flex items-start gap-2.5 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
          <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 text-xs">
            ⚠️
          </div>
          <div>
            <span className="font-bold text-amber-400">Biggest Risk:</span>
            <p className="text-slate-300 mt-0.5">{briefing.biggestRisk.description}</p>
          </div>
        </div>

        {/* Top AI Action */}
        <div className="flex items-start justify-between gap-2.5 bg-blue-950/20 p-3 rounded-xl border border-blue-500/20">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5 text-xs">
              ✨
            </div>
            <div>
              <span className="font-bold text-blue-400">Top AI Action:</span>
              <p className="text-slate-300 mt-0.5">{briefing.topRecommendation.title}</p>
            </div>
          </div>
          <button
            onClick={() => onActionClick && onActionClick(briefing.topRecommendation.actionId)}
            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shrink-0 self-center"
          >
            Review
          </button>
        </div>
      </div>
    </div>
  );
};
