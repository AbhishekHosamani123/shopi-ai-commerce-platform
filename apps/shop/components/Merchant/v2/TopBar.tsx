'use client';

import React from 'react';

interface TopBarProps {
  title?: string;
  breadcrumbs?: string[];
  syncAgeSeconds?: number;
  onOpenCopilot: () => void;
  onToggleMobileMenu?: () => void;
}

export function TopBar({
  title = 'Overview',
  breadcrumbs = ['Merchant AI', 'Overview'],
  syncAgeSeconds = 45,
  onOpenCopilot,
  onToggleMobileMenu,
}: TopBarProps) {
  const formatSyncTime = (seconds: number) => {
    if (seconds < 60) return 'Just now';
    const mins = Math.floor(seconds / 60);
    return `${mins} min ago`;
  };

  return (
    <header className="h-14 bg-surface-1 border-b border-hairline px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 font-sans select-none">
      {/* 1. Left: Mobile Toggle & Context Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-1.5 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-2 transition-colors shrink-0"
            aria-label="Toggle navigation menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-xs text-ink-subtle truncate">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-ink-tertiary">/</span>}
              <span className={`truncate ${idx === breadcrumbs.length - 1 ? 'text-ink font-medium' : ''}`}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* 2. Right: Status + Search + Ask AI (Single Global Entry Point) */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Sync Status Badge (Tertiary metadata) */}
        <div
          title="Data continuously synchronized with store catalog & ledger"
          className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 text-[11px] font-mono text-ink-subtle bg-surface-2/60 border border-hairline rounded-md"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-semantic-success animate-pulse"></span>
          <span>Data synced {formatSyncTime(syncAgeSeconds)}</span>
        </div>

        {/* Compact Search Trigger (Secondary control) */}
        <button
          onClick={onOpenCopilot}
          className="hidden sm:inline-flex items-center justify-between h-8 px-2.5 text-xs text-ink-subtle bg-surface-2 hover:bg-surface-3 hover:text-ink border border-hairline hover:border-hairline-strong rounded-md transition-colors w-36 lg:w-44"
        >
          <span className="truncate">Search (Cmd+K)...</span>
          <kbd className="text-[10px] font-mono bg-surface-3 px-1.5 py-0.5 rounded border border-hairline-strong text-ink-muted">
            ⌘K
          </kbd>
        </button>

        {/* Ask AI Button (Primary Global Action from DESIGN.md) */}
        <button
          onClick={onOpenCopilot}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-linear-primary hover:bg-linear-primary-hover active:bg-linear-primary-focus text-white text-xs font-medium shadow-2xs transition-colors shrink-0"
        >
          <span>Ask AI</span>
          <kbd className="hidden sm:inline text-[9px] font-mono bg-black/20 text-white/90 px-1 py-0.5 rounded border border-white/20">
            ⌘J
          </kbd>
        </button>
      </div>
    </header>
  );
}
