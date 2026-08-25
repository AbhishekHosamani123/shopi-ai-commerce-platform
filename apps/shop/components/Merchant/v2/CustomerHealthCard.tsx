'use client';

import React from 'react';
import { TrustBadge } from './TrustBadge';

interface CustomerHealthCardProps {
  activeCount?: number;
  repeatRatePct?: number;
  vipCount?: number;
  atRiskCount?: number;
  loading?: boolean;
}

export function CustomerHealthCard({
  activeCount = 1053,
  repeatRatePct = 28.4,
  vipCount = 142,
  atRiskCount = 23,
  loading = false,
}: CustomerHealthCardProps) {
  return (
    <div className="bg-surface-1 p-4.5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors text-ink">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-hairline">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
            Customer Health & Retention
          </h3>
          <TrustBadge tag="[FACT]" formula="COUNT(DISTINCT customer_id)" />
        </div>
        <span className="text-[11px] text-ink-subtle font-mono">Past 30 Days</span>
      </div>

      {/* 4-Stat Grid */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-md bg-surface-2 border border-hairline">
          <div className="text-[11px] text-ink-subtle font-medium">Active Customers</div>
          <div className="text-base font-semibold text-ink font-mono tabular-nums mt-0.5">
            {activeCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-semantic-success font-medium mt-0.5 font-mono">↑ +12.0% MoM</div>
        </div>

        <div className="p-2.5 rounded-md bg-surface-2 border border-hairline">
          <div className="text-[11px] text-ink-subtle font-medium">Repeat Rate</div>
          <div className="text-base font-semibold text-ink font-mono tabular-nums mt-0.5">
            {repeatRatePct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-ink-tertiary mt-0.5 font-mono">Bench: 24%</div>
        </div>

        <div className="p-2.5 rounded-md bg-surface-2 border border-hairline">
          <div className="text-[11px] text-ink-subtle font-medium">VIP Segment</div>
          <div className="text-base font-semibold text-ink font-mono tabular-nums mt-0.5">
            {vipCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-ink-tertiary mt-0.5 font-mono">42% Revenue</div>
        </div>

        <div className="p-2.5 rounded-md bg-surface-2 border border-hairline">
          <div className="text-[11px] text-ink-subtle font-medium">At-Risk Churn</div>
          <div className="text-base font-semibold text-rose-400 font-mono tabular-nums mt-0.5">
            {atRiskCount}
          </div>
          <div className="text-[10px] text-rose-400/80 font-medium mt-0.5 font-mono">Needs winback</div>
        </div>
      </div>
    </div>
  );
}
