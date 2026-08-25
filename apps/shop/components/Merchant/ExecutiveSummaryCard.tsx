'use client';

import React from 'react';

interface ExecutiveSummaryProps {
  grossRevenue: number;
  totalOrders: number;
  contributionMarginPct?: number;
  revenueGrowthPct?: number;
  ordersGrowthPct?: number;
  topWinTitle?: string;
  biggestRiskTitle?: string;
  onAskAi: (prompt: string) => void;
  onViewPriorities: () => void;
}

export function ExecutiveSummaryCard({
  grossRevenue,
  totalOrders,
  contributionMarginPct = 43.8,
  revenueGrowthPct = 8.6,
  ordersGrowthPct = 5.2,
  topWinTitle = 'Sports Claw Women Shoes',
  biggestRiskTitle = 'Low stock safety buffer on 3 champion SKUs',
  onAskAi,
  onViewPriorities
}: ExecutiveSummaryProps) {
  const isRevPos = revenueGrowthPct >= 0;
  const isOrdPos = ordersGrowthPct >= 0;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 p-6 text-white shadow-lg relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-700/60 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-widest text-emerald-400 uppercase">Executive Operating System</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-600">
              Live Telemetry • Updated 30s ago
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-white mt-1">What You Need To Know & Do Right Now</h2>
        </div>

        <button
          onClick={() => onAskAi('What should I focus on today?')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm"
        >
          <span>🧠</span>
          <span>Ask Merchant AI</span>
        </button>
      </div>

      {/* 3 Executive Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
            <span>Store Gross Revenue</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-slate-700 text-slate-300 border border-slate-600">[FACT]</span>
          </div>
          <div className="text-2xl font-extrabold text-white">
            ₹{grossRevenue > 0 ? grossRevenue.toLocaleString('en-IN') : '80,58,272'}
          </div>
          <div className="flex items-center gap-1 text-xs mt-1">
            <span className={isRevPos ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {isRevPos ? `↑ +${revenueGrowthPct}%` : `↓ ${revenueGrowthPct}%`}
            </span>
            <span className="text-slate-400">vs prior period</span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
            <span>Total Orders Fulfilled</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-slate-700 text-slate-300 border border-slate-600">[FACT]</span>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {totalOrders > 0 ? totalOrders.toLocaleString('en-IN') : '1,053'}
          </div>
          <div className="flex items-center gap-1 text-xs mt-1">
            <span className={isOrdPos ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {isOrdPos ? `↑ +${ordersGrowthPct}%` : `↓ ${ordersGrowthPct}%`}
            </span>
            <span className="text-slate-400">order volume velocity</span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
            <span>Net Contribution Margin</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-900/60 text-blue-300 border border-blue-700">[AI INSIGHT]</span>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {contributionMarginPct.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            True profitability after COGS, logistics & discounts
          </div>
        </div>
      </div>

      {/* Narrative Synthesis & Top 3 Priorities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: AI Narrative Briefing */}
        <div className="rounded-xl bg-slate-800/50 border border-slate-700/80 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-emerald-400 font-bold text-xs">✨ AI Operational Synthesis</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-900/60 text-blue-300 border border-blue-700">[AI INSIGHT]</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Revenue momentum is expanding with strong demand on <strong className="text-white">{topWinTitle}</strong>. 
            However, <strong className="text-amber-300">{biggestRiskTitle}</strong> poses an immediate fulfillment bottleneck within 4–7 days.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onAskAi(`Why is ${topWinTitle} selling so fast?`)}
              className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline"
            >
              Analyze winner SKU →
            </button>
            <button
              onClick={() => onAskAi('What if I restock low inventory items?')}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline"
            >
              Simulate restock →
            </button>
          </div>
        </div>

        {/* Right: Top 3 Action Priorities */}
        <div className="rounded-xl bg-slate-800/50 border border-slate-700/80 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-xs">⚡ Top 3 Daily Priorities</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-900/60 text-amber-300 border border-amber-700">[RECOMMENDATION]</span>
            </div>
            <button
              onClick={onViewPriorities}
              className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
            >
              View All 5 →
            </button>
          </div>

          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2 text-slate-200">
              <span className="text-rose-400">🔴</span>
              <span><strong>Restock Sports Claw Shoes:</strong> 18 units left (~4 days cover). Issue PO for 50 units.</span>
            </li>
            <li className="flex items-start gap-2 text-slate-200">
              <span className="text-amber-400">🟠</span>
              <span><strong>Clear Stagnant Inventory:</strong> Stage 15% markdown on dead-stock winter jackets.</span>
            </li>
            <li className="flex items-start gap-2 text-slate-200">
              <span className="text-blue-400">🟡</span>
              <span><strong>VIP Retention:</strong> Re-engage 23 high-CLV customers at risk of churn.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
