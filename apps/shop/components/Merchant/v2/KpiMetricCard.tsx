import React from 'react';
import { TrustBadge, TrustTagType } from './TrustBadge';

interface KpiMetricCardProps {
  title: string;
  value: string | number;
  changePct?: number;
  comparisonLabel?: string;
  trustTag?: TrustTagType;
  formula?: string;
  prefix?: string;
  suffix?: string;
  subText?: string;
  loading?: boolean;
}

export function KpiMetricCard({
  title,
  value,
  changePct,
  comparisonLabel = 'vs previous period',
  trustTag = '[FACT]',
  formula,
  prefix = '',
  suffix = '',
  subText,
  loading = false,
}: KpiMetricCardProps) {
  if (loading) {
    return (
      <div className="bg-surface-1 p-4.5 rounded-lg border border-hairline animate-pulse h-28 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 bg-surface-3 rounded"></div>
          <div className="h-3 w-10 bg-surface-3 rounded"></div>
        </div>
        <div className="h-7 w-28 bg-surface-2 rounded"></div>
        <div className="h-3 w-32 bg-surface-3 rounded"></div>
      </div>
    );
  }

  const isPositive = typeof changePct === 'number' && changePct >= 0;
  const isZero = changePct === 0;

  return (
    <div className="bg-surface-1 p-4.5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors flex flex-col justify-between h-28">
      {/* Header: Title + Trust Metadata */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-ink-subtle uppercase tracking-[0.4px] font-display">
          {title}
        </span>
        {trustTag && <TrustBadge tag={trustTag} formula={formula} />}
      </div>

      {/* Main Metric Value */}
      <div className="my-0.5">
        <span className="text-2xl font-semibold tracking-tight text-ink font-mono tabular-nums">
          {prefix}{value}{suffix}
        </span>
      </div>

      {/* Comparison Delta / Subtitle */}
      <div className="flex items-center gap-1.5 text-xs text-ink-subtle">
        {typeof changePct === 'number' && (
          <span
            className={`inline-flex items-center font-medium font-mono tabular-nums ${
              isZero
                ? 'text-ink-subtle'
                : isPositive
                ? 'text-semantic-success'
                : 'text-rose-400'
            }`}
          >
            {isZero ? '' : isPositive ? '↑ +' : '↓ '}
            {Math.abs(changePct).toFixed(1)}%
          </span>
        )}
        <span className="text-ink-tertiary truncate text-[11px]">{comparisonLabel}</span>
        {subText && <span className="text-ink-tertiary text-[11px]">• {subText}</span>}
      </div>
    </div>
  );
}
