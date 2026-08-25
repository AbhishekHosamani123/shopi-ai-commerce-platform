'use client';

import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  changePct?: number;
  icon: string;
  trendLabel?: string;
  isCurrency?: boolean;
  aiPrompt?: string;
  onAiAction?: (prompt: string) => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  changePct,
  icon,
  trendLabel = 'vs previous period',
  isCurrency = false,
  aiPrompt,
  onAiAction
}) => {
  const isPositive = changePct !== undefined && changePct >= 0;

  const formattedValue = typeof value === 'number'
    ? isCurrency
      ? `₹${value.toLocaleString('en-IN')}`
      : value.toLocaleString('en-IN')
    : value;

  // Generate a mini sparkline path
  const sparklinePath = isPositive
    ? "M0,24 C10,22 20,26 30,18 C40,12 50,16 60,8 C70,10 80,4 90,2"
    : "M0,4 C10,6 20,2 30,12 C40,16 50,10 60,20 C70,18 80,24 90,26";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
      <div>
        {/* Card Header: Label & Icon */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
            <i className={`fas ${icon} text-xs`}></i>
          </div>
        </div>

        {/* Large Main Metric */}
        <div className="mt-3 flex items-baseline justify-between">
          <h3 className="text-2xl font-bold tracking-tight text-slate-900">{formattedValue}</h3>
          
          {/* Mini SVG Sparkline */}
          <div className="h-6 w-16 opacity-70 group-hover:opacity-100 transition-opacity">
            <svg viewBox="0 0 90 28" className="h-full w-full overflow-visible">
              <path
                d={sparklinePath}
                fill="none"
                stroke={isPositive ? "#059669" : "#dc2626"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Footer: Trend Delta Badge & AI Trigger Link */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        {changePct !== undefined ? (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[11px] ${
                isPositive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <i className={`fas fa-arrow-${isPositive ? 'up' : 'down'} text-[9px]`}></i>
              {isPositive ? '+' : ''}{changePct}%
            </span>
            <span className="text-[11px] text-slate-500">{trendLabel}</span>
          </div>
        ) : subtitle ? (
          <span className="text-[11px] text-slate-500">{subtitle}</span>
        ) : (
          <span className="text-[11px] text-slate-400">PostgreSQL Ledger</span>
        )}

        {aiPrompt && onAiAction && (
          <button
            onClick={() => onAiAction(aiPrompt)}
            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 group/btn ml-auto"
            title="Ask Merchant Copilot to explain this metric"
          >
            <span>Ask AI</span>
            <i className="fas fa-arrow-right text-[9px] group-hover/btn:translate-x-0.5 transition-transform"></i>
          </button>
        )}
      </div>
    </div>
  );
};
