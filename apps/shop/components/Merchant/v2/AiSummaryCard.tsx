'use client';

import React from 'react';
import { TrustBadge } from './TrustBadge';

interface AiSummaryCardProps {
  onOpenCopilot: () => void;
  summaryText?: string;
  drivers?: string[];
  riskNote?: string;
}

export function AiSummaryCard({
  onOpenCopilot,
  summaryText = 'Revenue increased +14.2% vs previous period.',
  drivers = ['Footwear volume +24.0%', 'Average Order Value +5.6%', 'Aero Glide Running Shoes +18%'],
  riskNote = '3 high velocity SKUs have <5 days inventory coverage.',
}: AiSummaryCardProps) {
  return (
    <div className="bg-surface-1 p-4.5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors flex flex-col justify-between h-full text-xs text-ink">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
              AI Analysis
            </span>
            <TrustBadge tag="[AI INSIGHT]" />
          </div>
          <button
            onClick={onOpenCopilot}
            className="text-[11px] text-ink-subtle hover:text-ink font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <span>Ask AI</span>
            <kbd className="font-mono text-[9px] bg-surface-2 text-ink-subtle px-1 py-0.2 rounded border border-hairline">
              ⌘J
            </kbd>
          </button>
        </div>

        {/* Narrative */}
        <div className="mt-3 text-ink-muted leading-relaxed font-body">
          {summaryText}
        </div>

        {/* Drivers */}
        <div className="mt-3 pt-3 border-t border-hairline">
          <div className="text-[11px] font-medium text-ink-subtle uppercase tracking-[0.4px]">
            Drivers
          </div>
          <ul className="mt-2 space-y-1.5 text-ink-muted">
            {drivers.map((driver, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-linear-primary shrink-0"></span>
                <span>{driver}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Risk Callout */}
        {riskNote && (
          <div className="mt-3 p-2.5 rounded-md bg-surface-2 border border-amber-500/30 text-amber-300">
            <div className="font-semibold text-[11px] font-mono">RISK</div>
            <p className="mt-0.5 text-[11px] text-amber-200/90 leading-normal">{riskNote}</p>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between">
        <span className="text-ink-tertiary text-[10px] font-mono">Updated continuously</span>
        <button
          onClick={onOpenCopilot}
          className="px-2.5 py-1 rounded-md border border-hairline bg-surface-2 hover:bg-surface-3 text-ink text-[11px] font-medium transition-colors"
        >
          Ask AI →
        </button>
      </div>
    </div>
  );
}
