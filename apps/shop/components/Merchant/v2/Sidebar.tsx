'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  onOpenCopilot: () => void;
  onNavigate?: () => void;
  collapsed?: boolean;
}

/**
 * Pending-decision count from the canonical Decision Center sources:
 * campaigns awaiting review + operational actions awaiting approval.
 * Mirrors the "PENDING DECISIONS" headline on the Actions page.
 * Renders no badge when the count is unavailable — never a fabricated number.
 */
function usePendingDecisionCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [actionsRes, campaignsRes] = await Promise.all([
          fetch('/api/merchant/actions', { headers: { 'x-merchant-id': 'default_merchant' } }),
          // count=1 returns only aggregate numbers (~50B) instead of ~185
          // full campaign objects (~492KB) — this badge only needs a number.
          fetch('/api/merchant/campaigns/recommendations?count=1', { headers: { 'x-merchant-id': 'default_merchant' } })
        ]);

        let pendingActions = 0;
        if (actionsRes.ok) {
          const data = await actionsRes.json();
          const kpiCount = data?.kpis?.pendingCount;
          if (typeof kpiCount === 'number' && Number.isFinite(kpiCount)) {
            pendingActions = Math.max(0, Math.round(kpiCount));
          } else if (Array.isArray(data?.actions)) {
            pendingActions = data.actions.filter(
              (a: any) =>
                a?.status === 'PENDING_APPROVAL' ||
                a?.status === 'READY_FOR_REVIEW' ||
                a?.status === 'DRAFT'
            ).length;
          }
        }

        let pendingCampaigns = 0;
        if (campaignsRes.ok) {
          const data = await campaignsRes.json();
          if (typeof data?.count === 'number') {
            // Count mode: derive pending from per-status aggregates.
            const byStatus = data.byStatus || {};
            pendingCampaigns = (byStatus.READY_FOR_REVIEW || 0) + (byStatus.DRAFT || 0);
          } else if (Array.isArray(data?.campaigns)) {
            pendingCampaigns = data.campaigns.filter(
              (c: any) => c?.status === 'READY_FOR_REVIEW' || c?.status === 'DRAFT'
            ).length;
          }
        }

        if (cancelled) return;
        if (actionsRes.ok || campaignsRes.ok) {
          setCount(pendingActions + pendingCampaigns);
        }
      } catch {
        // Unavailable → badge stays hidden. Never display a made-up count.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}

export const Sidebar = React.memo(function Sidebar({
  onOpenCopilot,
  onNavigate,
  collapsed = false,
}: SidebarProps) {
  const pathname = usePathname();
  const pendingCount = usePendingDecisionCount();

  const handleLinkClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <aside className="w-60 bg-surface-1 border-r border-hairline flex flex-col shrink-0 h-screen sticky top-0 text-ink select-none z-30 font-sans">
      {/* 1. Header: Store Switcher / Merchant Identity */}
      <div className="h-14 px-3 border-b border-hairline flex items-center bg-surface-1">
        <Link
          href="/merchant"
          prefetch={true}
          onClick={handleLinkClick}
          className="flex items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-surface-2 transition-colors group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-md bg-linear-primary text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs font-display">
              M
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-ink truncate leading-tight">
                Alpha Retail
              </div>
              <div className="text-[10px] text-ink-subtle font-mono truncate leading-tight mt-0.5">
                Store ID: rzp_alpha
              </div>
            </div>
          </div>
          <svg
            className="w-3.5 h-3.5 text-ink-subtle group-hover:text-ink shrink-0 ml-2 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Link>
      </div>

      {/* 2. Navigation Tree */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 text-xs font-medium">
        {/* Overview Item */}
        <div>
          <Link
            href="/merchant"
            prefetch={true}
            onClick={handleLinkClick}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors ${
              pathname === '/merchant'
                ? 'bg-surface-3 text-ink font-medium border border-hairline-strong'
                : 'text-ink-subtle hover:text-ink hover:bg-surface-2'
            }`}
          >
            <svg className={`w-4 h-4 shrink-0 ${pathname === '/merchant' ? 'text-linear-primary' : 'text-ink-subtle'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Overview</span>
          </Link>
        </div>

        {/* Business Group */}
        <div className="space-y-0.5">
          <div className="px-2.5 py-1 text-[11px] font-medium text-ink-tertiary uppercase tracking-[0.4px]">
            Business
          </div>
          <Link
            href="/merchant/sales"
            prefetch={true}
            onClick={handleLinkClick}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors ${
              pathname === '/merchant/sales'
                ? 'bg-surface-3 text-ink font-medium border border-hairline-strong'
                : 'text-ink-subtle hover:text-ink hover:bg-surface-2'
            }`}
          >
            <svg className={`w-4 h-4 shrink-0 ${pathname === '/merchant/sales' ? 'text-linear-primary' : 'text-ink-subtle'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span>Sales Analytics</span>
          </Link>
          <Link
            href="/merchant/profitability"
            prefetch={true}
            onClick={handleLinkClick}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors ${
              pathname === '/merchant/profitability'
                ? 'bg-surface-3 text-ink font-medium border border-hairline-strong'
                : 'text-ink-subtle hover:text-ink hover:bg-surface-2'
            }`}
          >
            <svg className={`w-4 h-4 shrink-0 ${pathname === '/merchant/profitability' ? 'text-linear-primary' : 'text-ink-subtle'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Profitability & Margin</span>
          </Link>
          <Link
            href="/merchant/customers"
            prefetch={true}
            onClick={handleLinkClick}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors ${
              pathname === '/merchant/customers'
                ? 'bg-surface-3 text-ink font-medium border border-hairline-strong'
                : 'text-ink-subtle hover:text-ink hover:bg-surface-2'
            }`}
          >
            <svg className={`w-4 h-4 shrink-0 ${pathname === '/merchant/customers' ? 'text-linear-primary' : 'text-ink-subtle'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Customers & Cohorts</span>
          </Link>
        </div>

        {/* Commerce Group */}
        <div className="space-y-0.5">
          <div className="px-2.5 py-1 text-[11px] font-medium text-ink-tertiary uppercase tracking-[0.4px]">
            Commerce
          </div>
          <Link
            href="/merchant/products"
            prefetch={true}
            onClick={handleLinkClick}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors ${
              pathname === '/merchant/products'
                ? 'bg-surface-3 text-ink font-medium border border-hairline-strong'
                : 'text-ink-subtle hover:text-ink hover:bg-surface-2'
            }`}
          >
            <svg className={`w-4 h-4 shrink-0 ${pathname === '/merchant/products' ? 'text-linear-primary' : 'text-ink-subtle'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span>Products</span>
          </Link>
          <Link
            href="/merchant/inventory"
            prefetch={true}
            onClick={handleLinkClick}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors ${
              pathname === '/merchant/inventory'
                ? 'bg-surface-3 text-ink font-medium border border-hairline-strong'
                : 'text-ink-subtle hover:text-ink hover:bg-surface-2'
            }`}
          >
            <svg className={`w-4 h-4 shrink-0 ${pathname === '/merchant/inventory' ? 'text-linear-primary' : 'text-ink-subtle'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span>Inventory</span>
          </Link>
          
          {/* Orders - Blocked Notice */}
          <div
            title="Orders ledger integration blocked pending canonical ledger sync"
            className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-ink-tertiary/60 cursor-not-allowed select-none"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-ink-tertiary/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span>Orders & Ledger</span>
            </div>
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-surface-2 border border-hairline text-ink-tertiary">
              BLOCKED
            </span>
          </div>

          <Link
            href="/merchant/returns"
            prefetch={true}
            onClick={handleLinkClick}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors ${
              pathname === '/merchant/returns'
                ? 'bg-surface-3 text-ink font-medium border border-hairline-strong'
                : 'text-ink-subtle hover:text-ink hover:bg-surface-2'
            }`}
          >
            <svg className={`w-4 h-4 shrink-0 ${pathname === '/merchant/returns' ? 'text-linear-primary' : 'text-ink-subtle'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Returns & Refunds</span>
          </Link>
        </div>

        {/* Intelligence Group */}
        <div className="space-y-0.5">
          <div className="px-2.5 py-1 text-[11px] font-medium text-ink-tertiary uppercase tracking-[0.4px]">
            Intelligence
          </div>
          <button
            onClick={onOpenCopilot}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-2 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-linear-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span>AI Copilot</span>
            </div>
            <kbd className="text-[9px] font-mono bg-surface-2 text-ink-subtle px-1 py-0.2 rounded border border-hairline">
              ⌘J
            </kbd>
          </button>
        </div>

        {/* Operations Group */}
        <div className="space-y-0.5">
          <div className="px-2.5 py-1 text-[11px] font-medium text-ink-tertiary uppercase tracking-[0.4px]">
            Operations
          </div>
          <Link
            href="/merchant/actions"
            prefetch={true}
            onClick={handleLinkClick}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors ${
              pathname === '/merchant/actions'
                ? 'bg-surface-3 text-ink font-medium border border-hairline-strong'
                : 'text-ink-subtle hover:text-ink hover:bg-surface-2'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className={`w-4 h-4 shrink-0 ${pathname === '/merchant/actions' ? 'text-linear-primary' : 'text-ink-subtle'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Actions & Outcomes</span>
            </div>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {pendingCount !== null ? pendingCount : ''}
            </span>
          </Link>
        </div>
      </div>

      {/* 3. Footer Branding */}
      <div className="p-3 border-t border-hairline bg-surface-1 flex items-center justify-between text-[11px] text-ink-subtle">
        <Link href="/" target="_blank" className="hover:text-ink flex items-center gap-1 transition-colors">
          <span>Storefront</span>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>
        <span className="font-mono text-[10px] text-ink-tertiary">v2.1 Linear</span>
      </div>
    </aside>
  );
});
