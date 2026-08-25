import React from 'react';

export type TrustTagType = '[FACT]' | '[DERIVED]' | '[AI INSIGHT]' | '[FORECAST]' | '[RECOMMENDATION]' | '[SIMULATION]' | string;

interface TrustBadgeProps {
  tag?: TrustTagType;
  formula?: string;
  className?: string;
}

/**
 * 🏷️ Micro-typography trust metadata badge following Linear DESIGN.md.
 */
export function TrustBadge({ tag = '[FACT]', formula, className = '' }: TrustBadgeProps) {
  let style = 'bg-surface-1 text-ink-subtle border-hairline';
  let dotColor = 'bg-ink-tertiary';
  let label = tag.replace(/[\[\]]/g, '');

  if (tag.includes('FACT')) {
    style = 'bg-surface-1 text-ink-subtle border-hairline';
    dotColor = 'bg-ink-tertiary';
  } else if (tag.includes('DERIVED')) {
    style = 'bg-surface-2 text-ink-muted border-hairline-strong';
    dotColor = 'bg-ink-subtle';
  } else if (tag.includes('INSIGHT')) {
    style = 'bg-surface-2 text-linear-primary-hover border-linear-primary/30';
    dotColor = 'bg-linear-primary';
  } else if (tag.includes('RECOMMENDATION')) {
    style = 'bg-surface-2 text-linear-primary-hover border-linear-primary/30';
    dotColor = 'bg-linear-primary';
  } else if (tag.includes('FORECAST') || tag.includes('SIMULATION')) {
    style = 'bg-surface-2 text-brand-secure border-hairline-strong';
    dotColor = 'bg-brand-secure';
  }

  return (
    <span
      title={formula ? `Calculation: ${formula}` : label}
      className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-medium px-1.5 py-0.5 rounded-xs border tracking-tight ${style} ${className}`}
    >
      <span className={`w-1 h-1 rounded-full ${dotColor}`} />
      <span>{label}</span>
    </span>
  );
}
