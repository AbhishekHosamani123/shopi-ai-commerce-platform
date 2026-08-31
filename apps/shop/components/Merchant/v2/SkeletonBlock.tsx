'use client';

import React from 'react';

/**
 * Lightweight skeleton placeholder for merchant dashboard sections.
 * Used on first load so the dashboard never paints misleading "0" values
 * while the backend is still computing/returning data.
 */
export function SkeletonBlock({
  className = '',
  lines = 1,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div className={`space-y-1.5 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-2.5 bg-surface-3 rounded animate-pulse"
          style={{ width: i === lines - 1 ? '65%' : '100%' }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="p-2.5 bg-surface-2 rounded-md border border-hairline space-y-1.5" aria-hidden="true">
      <div className="h-2 bg-surface-3 rounded animate-pulse w-3/4" />
      <div className="h-3.5 bg-surface-3 rounded animate-pulse w-1/2" />
      <div className="h-2 bg-surface-3 rounded animate-pulse w-2/3" />
    </div>
  );
}
