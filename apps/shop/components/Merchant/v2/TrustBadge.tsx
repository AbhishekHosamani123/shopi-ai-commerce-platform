import React from 'react';

export type TrustTagType =
  | '[OBSERVED]'
  | '[FACT]'
  | '[CALCULATED]'
  | '[DERIVED]'
  | '[MODEL ESTIMATE]'
  | '[AI INSIGHT]'
  | '[RECOMMENDATION]'
  | '[SIMULATION]'
  | string;

interface TrustBadgeProps {
  tag?: TrustTagType;
  formula?: string;
  className?: string;
}

/**
 * 🏷️ Micro-typography trust metadata badge following Linear design architecture.
 */
export function TrustBadge({ tag = '[OBSERVED]', formula, className = '' }: TrustBadgeProps) {
  let style = 'bg-surface-1 text-ink-subtle border-hairline';
  let dotColor = 'bg-ink-tertiary';
  let label = tag.replace(/[\[\]]/g, '');

  if (tag.includes('OBSERVED') || tag.includes('FACT')) {
    style = 'bg-surface-1 text-ink-subtle border-hairline';
    dotColor = 'bg-emerald-400';
    label = 'OBSERVED';
  } else if (tag.includes('CALCULATED') || tag.includes('DERIVED')) {
    style = 'bg-surface-2 text-ink-muted border-hairline-strong';
    dotColor = 'bg-sky-400';
    label = 'CALCULATED';
  } else if (tag.includes('MODEL ESTIMATE') || tag.includes('INSIGHT')) {
    style = 'bg-surface-2 text-linear-primary-hover border-linear-primary/30';
    dotColor = 'bg-linear-primary';
    label = 'MODEL ESTIMATE';
  } else if (tag.includes('RECOMMENDATION')) {
    style = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    dotColor = 'bg-amber-400';
    label = 'RECOMMENDATION';
  } else if (tag.includes('SIMULATION') || tag.includes('FORECAST')) {
    style = 'bg-purple-500/10 text-purple-300 border-purple-500/30';
    dotColor = 'bg-purple-400';
    label = 'SIMULATION';
  }

  return (
    <span
      title={formula ? `Methodology: ${formula}` : label}
      className={`inline-flex items-center gap-1.5 font-mono text-[9px] font-medium px-1.5 py-0.5 rounded-xs border tracking-tight uppercase ${style} ${className}`}
    >
      <span className={`w-1 h-1 rounded-full ${dotColor}`} />
      <span>{label}</span>
    </span>
  );
}
