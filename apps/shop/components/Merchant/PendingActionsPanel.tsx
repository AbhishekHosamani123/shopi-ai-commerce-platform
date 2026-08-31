'use client';
import { merchantFetch } from '@/components/Merchant/merchantFetch';

import React, { useState, useEffect, useCallback } from 'react';
import { ActionPreviewCard, ActionPreviewItem } from './ActionPreviewCard';

interface PendingActionsPanelProps {
  onTriggerCopilotAction?: (promptText: string) => void;
}

export const PendingActionsPanel: React.FC<PendingActionsPanelProps> = ({
  onTriggerCopilotAction
}) => {
  const [actions, setActions] = useState<ActionPreviewItem[]>([]);
  const [kpis, setKpis] = useState({
    pendingCount: 0,
    completedTodayCount: 0,
    rejectedCount: 0,
    expiredCount: 0,
    totalActions: 0
  });
  const [filter, setFilter] = useState<string>('PENDING_APPROVAL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchActions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await merchantFetch(`/api/merchant/ai/actions?status=${filter}&limit=20`);
      const data = await res.json();
      if (res.ok && data.success) {
        setActions(
          (data.actions || []).map((a: any) => ({
            actionId: a.actionId,
            type: a.actionType,
            status: a.status,
            productId: a.productId,
            productName: a.productName,
            quantity: a.quantity,
            currentStock: a.payload?.stockAtRecommendation,
            recommendedChange: a.actionType === 'RESTOCK'
              ? `+${a.quantity || a.payload?.reorderTargetUnits || 50} units`
              : a.actionType === 'DISCOUNT'
              ? `${a.payload?.recommendedDiscountPct || 10}% Off (₹${a.payload?.suggestedDiscountPrice})`
              : a.actionType === 'PROMOTION'
              ? 'Hero Spotlight Spotlight'
              : 'Audit Review',
            estimatedCoverage: a.payload?.estimatedCoverageDays ? `~${a.payload.estimatedCoverageDays} days remaining` : undefined,
            reason: a.reason,
            impact: a.actionType === 'RESTOCK' ? 'Restores safety inventory buffer' : 'Revives sell-through momentum',
            expiresAt: a.expiresAt,
            requiresApproval: true,
            payload: a.payload
          }))
        );
        if (data.kpis) {
          setKpis(data.kpis);
        }
      }
    } catch (err) {
      console.error('Failed to load actions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const handleActionComplete = () => {
    fetchActions();
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm space-y-5">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700 text-xs font-bold">
              ⚡
            </div>
            <h3 className="font-bold text-slate-900 text-base tracking-tight">
              AI Action & Approval Center
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
              Human-in-the-Loop
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Autonomous merchant recommendations staged for your explicit review and verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onTriggerCopilotAction && (
            <button
              onClick={() => onTriggerCopilotAction('Prepare a restock for low inventory products')}
              className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <i className="fas fa-boxes-stacked text-emerald-600 text-[11px]"></i>
              <span>Auto-Draft Restock</span>
            </button>
          )}
          <button
            onClick={fetchActions}
            disabled={isLoading}
            className="h-8 w-8 rounded-xl bg-white border border-slate-200 hover:border-slate-300 flex items-center justify-center text-slate-600 transition-all shadow-2xs cursor-pointer"
            title="Refresh Actions"
          >
            <i className={`fas fa-rotate text-xs ${isLoading ? 'animate-spin text-emerald-600' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* Action KPI Stat Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setFilter('PENDING_APPROVAL')}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            filter === 'PENDING_APPROVAL' ? 'border-amber-400 bg-amber-50/50 shadow-xs' : 'border-slate-200 bg-slate-50 hover:bg-white'
          }`}
        >
          <span className="text-[11px] font-semibold text-slate-500 block">Pending Approval</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold text-amber-700">{kpis.pendingCount}</span>
            <span className="text-[10px] text-amber-600 font-medium">actions waiting</span>
          </div>
        </div>

        <div
          onClick={() => setFilter('COMPLETED')}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            filter === 'COMPLETED' ? 'border-emerald-400 bg-emerald-50/50 shadow-xs' : 'border-slate-200 bg-slate-50 hover:bg-white'
          }`}
        >
          <span className="text-[11px] font-semibold text-slate-500 block">Completed Today</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold text-emerald-700">{kpis.completedTodayCount}</span>
            <span className="text-[10px] text-emerald-600 font-medium">executed</span>
          </div>
        </div>

        <div
          onClick={() => setFilter('REJECTED')}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            filter === 'REJECTED' ? 'border-slate-400 bg-slate-100 shadow-xs' : 'border-slate-200 bg-slate-50 hover:bg-white'
          }`}
        >
          <span className="text-[11px] font-semibold text-slate-500 block">Rejected / Dismissed</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold text-slate-700">{kpis.rejectedCount}</span>
            <span className="text-[10px] text-slate-500 font-medium">dismissed</span>
          </div>
        </div>

        <div
          onClick={() => setFilter('ALL')}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            filter === 'ALL' ? 'border-indigo-400 bg-indigo-50/50 shadow-xs' : 'border-slate-200 bg-slate-50 hover:bg-white'
          }`}
        >
          <span className="text-[11px] font-semibold text-slate-500 block">Total Actions Log</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold text-slate-900">{kpis.totalActions}</span>
            <span className="text-[10px] text-slate-500 font-medium">all-time audit</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2 overflow-x-auto scrollbar-none">
        {[
          { id: 'PENDING_APPROVAL', label: 'Pending Approval' },
          { id: 'COMPLETED', label: 'Completed' },
          { id: 'REJECTED', label: 'Rejected' },
          { id: 'EXPIRED', label: 'Expired' },
          { id: 'ALL', label: 'All History' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Action Cards Grid */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <i className="fas fa-circle-notch animate-spin text-emerald-600"></i>
          <span>Loading action ledger...</span>
        </div>
      ) : actions.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
          <div className="text-2xl">🎉</div>
          <div className="text-xs font-bold text-slate-800">
            {filter === 'PENDING_APPROVAL' ? 'No Pending Actions Waiting' : 'No Actions Found'}
          </div>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            {filter === 'PENDING_APPROVAL'
              ? 'All AI recommendations have been approved, rejected, or resolved. You can ask Merchant Copilot to draft a restock or discount recommendation at any time.'
              : 'No action history records match the selected filter criteria.'}
          </p>
          {onTriggerCopilotAction && filter === 'PENDING_APPROVAL' && (
            <button
              onClick={() => onTriggerCopilotAction('Suggest actions I should take today')}
              className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Draft Today\'s Priorities</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {actions.map(action => (
            <ActionPreviewCard
              key={action.actionId}
              action={action}
              onActionComplete={handleActionComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
};
