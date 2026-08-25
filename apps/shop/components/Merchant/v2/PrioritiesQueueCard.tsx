'use client';

import React, { useState } from 'react';
import { TrustBadge } from './TrustBadge';

export interface PriorityAction {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'OPPORTUNITY';
  title: string;
  detail: string;
  impact: string;
  status: 'PENDING' | 'APPROVED' | 'DISMISSED';
}

interface PrioritiesQueueCardProps {
  onOpenCopilot?: (prompt?: string) => void;
  loading?: boolean;
}

export function PrioritiesQueueCard({
  onOpenCopilot,
  loading = false,
}: PrioritiesQueueCardProps) {
  const [priorities, setPriorities] = useState<PriorityAction[]>([
    {
      id: 'act_101',
      severity: 'CRITICAL',
      title: 'Restock Aero Glide Running Shoes',
      detail: '15 units remaining · ~4.8 days coverage · Daily velocity 3.1/day',
      impact: '+₹45,000 buffer',
      status: 'PENDING',
    },
    {
      id: 'act_102',
      severity: 'WARNING',
      title: 'Clear stagnant inventory on Winter Beanies',
      detail: '110 units · 74 days inventory age without meaningful sales velocity',
      impact: '+₹18,500 capital',
      status: 'PENDING',
    },
    {
      id: 'act_103',
      severity: 'OPPORTUNITY',
      title: 'Re-engage 23 VIP churn-risk customers',
      detail: 'Average spend ₹12,400 · Inactive for >45 days',
      impact: '+₹28,000 winback',
      status: 'PENDING',
    },
  ]);

  const handleApprove = async (id: string) => {
    try {
      await fetch(`/api/merchant/actions/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-merchant-id': 'default_pilot_merchant' },
        body: JSON.stringify({ note: 'Approved from Priorities Queue' }),
      });
      setPriorities((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'APPROVED' } : item))
      );
    } catch (err) {
      console.error('Failed to approve action:', err);
    }
  };

  const handleDismiss = (id: string) => {
    setPriorities((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'DISMISSED' } : item))
    );
  };

  return (
    <div className="bg-surface-1 p-4.5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors text-ink">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-hairline">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
            Operational Priorities
          </h3>
          <TrustBadge tag="[RECOMMENDATION]" />
        </div>
        <span className="text-[11px] font-mono text-ink-tertiary">Human Gate Active</span>
      </div>

      {/* List */}
      <div className="mt-2 divide-y divide-hairline text-xs">
        {priorities.map((item) => (
          <div key={item.id} className="py-3 flex items-center justify-between gap-3">
            {/* Severity Tag + Title & Detail */}
            <div className="flex items-start gap-2.5 min-w-0">
              <span
                className={`inline-block px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-bold shrink-0 mt-0.5 ${
                  item.severity === 'CRITICAL'
                    ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                    : item.severity === 'WARNING'
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                    : 'bg-linear-primary/10 text-linear-primary-hover border border-linear-primary/30'
                }`}
              >
                {item.severity}
              </span>
              <div className="min-w-0">
                <div className="font-medium text-ink truncate">{item.title}</div>
                <div className="text-[11px] text-ink-subtle mt-0.5 truncate">{item.detail}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {item.status === 'APPROVED' ? (
                <span className="text-[11px] font-semibold text-semantic-success">✓ Approved</span>
              ) : item.status === 'DISMISSED' ? (
                <span className="text-[11px] text-ink-tertiary">Dismissed</span>
              ) : (
                <>
                  <button
                    onClick={() => handleApprove(item.id)}
                    className="px-3 py-1 bg-linear-primary hover:bg-linear-primary-hover text-white rounded-md text-xs font-medium transition-colors shadow-2xs"
                  >
                    Review
                  </button>
                  <button
                    onClick={() => handleDismiss(item.id)}
                    className="px-2 py-1 text-ink-subtle hover:text-ink text-xs transition-colors"
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
