'use client';
import { merchantFetch } from '@/components/Merchant/merchantFetch';

import React, { useState, useEffect, useCallback } from 'react';
import { TrustBadge } from './TrustBadge';

interface AudienceSummary {
  success: boolean;
  cartAbandoners: { count: number; productCount: number };
  checkoutAbandoners: { count: number; productCount: number };
  repeatViewers: { count: number; productCount: number };
  totalTrackedCustomers: number;
}

interface SegmentCustomer {
  customerId: string;
  customerName: string;
  eventCount: number;
  topProductTitle: string | null;
  topProductPrice: number | null;
  lastActivityAt: string;
}

/**
 * Audience Intelligence panel: observed counts of the classic opportunity
 * segments — cart abandoners (added to cart, never purchased), checkout
 * abandoners, and repeat viewers (viewed 2+ times, never carted/purchased).
 * Counts come directly from the event ledger; clicking a segment expands the
 * per-customer detail. Shown on the merchant overview for demo storytelling.
 */
export function AudienceIntelligencePanel() {
  const [summary, setSummary] = useState<AudienceSummary | null>(null);
  const [expanded, setExpanded] = useState<'cart-abandoners' | 'checkout-abandoners' | 'repeat-viewers' | null>(null);
  const [detail, setDetail] = useState<SegmentCustomer[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await merchantFetch('/api/merchant/audience-intelligence/summary', {
        headers: { 'x-merchant-id': 'default_merchant' }
      });
      const data = await res.json();
      if (data.success) setSummary(data);
    } catch {
      // Non-critical panel; keep prior state.
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 60000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  const toggleSegment = async (segment: 'cart-abandoners' | 'checkout-abandoners' | 'repeat-viewers') => {
    if (expanded === segment) {
      setExpanded(null);
      setDetail([]);
      return;
    }
    setExpanded(segment);
    setIsLoadingDetail(true);
    try {
      const res = await merchantFetch(`/api/merchant/audience-intelligence/${segment}?limit=8`, {
        headers: { 'x-merchant-id': 'default_merchant' }
      });
      const data = await res.json();
      if (data.success) setDetail(data.customers || []);
    } catch {
      setDetail([]);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const segments: {
    key: 'cart-abandoners' | 'checkout-abandoners' | 'repeat-viewers';
    label: string;
    desc: string;
    count: number;
    products: number;
    accent: string;
  }[] = summary
    ? [
        {
          key: 'cart-abandoners',
          label: 'Cart Abandoners',
          desc: 'Added to cart, never purchased',
          count: summary.cartAbandoners.count,
          products: summary.cartAbandoners.productCount,
          accent: 'amber'
        },
        {
          key: 'checkout-abandoners',
          label: 'Checkout Abandoners',
          desc: 'Started checkout, never purchased',
          count: summary.checkoutAbandoners.count,
          products: summary.checkoutAbandoners.productCount,
          accent: 'rose'
        },
        {
          key: 'repeat-viewers',
          label: 'Repeat Viewers',
          desc: 'Viewed 2+ times, no cart, no purchase',
          count: summary.repeatViewers.count,
          products: summary.repeatViewers.productCount,
          accent: 'linear'
        }
      ]
    : [];

  return (
    <div className="bg-surface-1 p-5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-linear-primary-hover animate-pulse" />
          <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
            Audience Intelligence
          </h3>
          <TrustBadge tag="[OBSERVED]" />
        </div>
        {summary && (
          <span className="text-[10px] text-ink-tertiary font-mono">
            {summary.totalTrackedCustomers} tracked customers
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {segments.map(s => (
          <button
            key={s.key}
            onClick={() => toggleSegment(s.key)}
            className={`text-left p-3 bg-surface-2 rounded-md border transition-colors ${
              expanded === s.key ? 'border-hairline-strong' : 'border-hairline hover:border-hairline-strong'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink-subtle">{s.label}</span>
              <span
                className={`text-lg font-bold font-mono ${
                  s.accent === 'amber' ? 'text-amber-400' : s.accent === 'rose' ? 'text-rose-400' : 'text-linear-primary-hover'
                }`}
              >
                {s.count}
              </span>
            </div>
            <p className="text-[10px] text-ink-tertiary font-mono mt-1">{s.desc}</p>
            <p className="text-[10px] text-ink-tertiary font-mono">
              {s.products} product{s.products === 1 ? '' : 's'} · click for customers
            </p>
          </button>
        ))}
      </div>

      {expanded && (
        <div className="bg-surface-2 rounded-md border border-hairline p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink uppercase tracking-wide">
              {segments.find(s => s.key === expanded)?.label} — customers
            </span>
            <button onClick={() => setExpanded(null)} className="text-[10px] text-ink-subtle hover:text-ink underline font-mono">
              close
            </button>
          </div>
          {isLoadingDetail ? (
            <div className="text-[11px] text-ink-subtle font-mono py-2">Loading customers…</div>
          ) : detail.length === 0 ? (
            <div className="text-[11px] text-ink-subtle font-mono py-2">No customers in this segment.</div>
          ) : (
            <div className="space-y-1">
              {detail.map(c => (
                <div key={c.customerId} className="flex items-center justify-between gap-2 py-1 border-b border-hairline last:border-0">
                  <div className="min-w-0">
                    <span className="text-[11px] font-medium text-ink">{c.customerName}</span>
                    <p className="text-[10px] text-ink-tertiary font-mono truncate">
                      {c.topProductTitle ? `${c.topProductTitle} · ₹${c.topProductPrice}` : '—'} · {c.eventCount} event{c.eventCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="text-[10px] text-ink-tertiary font-mono shrink-0">
                    {new Date(c.lastActivityAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-ink-tertiary font-mono">
        Counts observed directly from shopi_customer_events — ask the AI Copilot
        &ldquo;how many people added to cart but didn&rsquo;t purchase&rdquo; for the same numbers.
      </p>
    </div>
  );
}
