'use client';

import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  onExport?: () => void;
  exportLabel?: string;
}

export function PageHeader({
  title,
  subtitle,
  badge,
  children,
  onExport,
  exportLabel = 'Export',
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-hairline">
      {/* Title & Subtitle */}
      <div className="space-y-0.5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold text-ink tracking-tight font-display">{title}</h1>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {subtitle && (
          <p className="text-xs text-ink-subtle leading-relaxed max-w-3xl font-sans">
            {subtitle}
          </p>
        )}
      </div>

      {/* Page-Specific Toolbar Controls (Compact right-aligned group) */}
      {(children || onExport) && (
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 sm:self-center">
          {/* Custom page-level filters/selectors slot */}
          {children}

          {/* Standardized Export Button (button-secondary) */}
          {onExport && (
            <button
              type="button"
              onClick={onExport}
              className="h-8 px-2.5 bg-surface-2 hover:bg-surface-3 border border-hairline hover:border-hairline-strong text-ink rounded-md text-xs font-medium transition-colors shrink-0 flex items-center gap-1.5 font-sans"
            >
              <svg className="w-3.5 h-3.5 text-ink-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{exportLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
