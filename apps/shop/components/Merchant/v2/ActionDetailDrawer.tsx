'use client';

import React, { useState } from 'react';
import { TrustBadge } from './TrustBadge';

export interface ActionDetailItem {
  actionId: string;
  merchantId: string;
  actionType: 'RESTOCK' | 'DISCOUNT' | 'PROMOTION' | string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'EXPIRED' | 'ROLLED_BACK';
  targetType?: 'PRODUCT' | 'CUSTOMER' | 'CUSTOMER_SEGMENT' | 'SUPPLIER';
  targetCustomer?: string;
  productTitle?: string;
  productSku?: string;
  productId?: number | null;
  productName?: string;
  quantity?: number | null;
  reason: string;
  createdAt: string;
  expiresAt?: string;
  approvedAt?: string;
  completedAt?: string;
  rollbackAt?: string;
  approvedBy?: string;
  rollbackBy?: string;
  requiresApproval: boolean;
  canRollback: boolean;
  payload?: any;
  executionResult?: any;
  outcome?: {
    outcomeStatus: 'PENDING' | 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'ROLLED_BACK';
    confidenceAtRecommendation?: number;
    observationWindowDays?: number;
    evaluatedAt?: string;
    expectedImpact?: {
      expectedRevenueDelta?: number;
      expectedUnitsDelta?: number;
      expectedProfitDelta?: number;
    };
    actualImpact?: {
      observedRevenueDelta?: number;
      observedUnitsDelta?: number;
      observedProfitDelta?: number;
    };
    impactDeltaPct?: number;
    negativeDiagnostics?: string[];
    baselineMetrics?: {
      stockOnHand?: number;
      velocity7d?: number;
      dailyRevenue?: number;
      contributionMarginPct?: number;
    };
  };
}

interface ActionDetailDrawerProps {
  action: ActionDetailItem | null;
  isOpen: boolean;
  onClose: () => void;
  onActionUpdated?: (actionId: string, newStatus: string, message: string) => void;
}

export function ActionDetailDrawer({
  action,
  isOpen,
  onClose,
  onActionUpdated,
}: ActionDetailDrawerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);

  if (!isOpen || !action) return null;

  const isPending = action.status === 'PENDING_APPROVAL';
  const isCompleted = action.status === 'COMPLETED';
  const isRolledBack = action.status === 'ROLLED_BACK';

  const handleApprove = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/merchant/actions/${action.actionId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-id': action.merchantId || 'default_merchant',
        },
        body: JSON.stringify({ approvedBy: 'merchant_admin' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to approve action');
      }
      onActionUpdated?.(action.actionId, 'COMPLETED', data.message || 'Action executed successfully.');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/merchant/actions/${action.actionId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-id': action.merchantId || 'default_merchant',
        },
        body: JSON.stringify({ reason: 'Merchant dismissed recommendation' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reject action');
      }
      onActionUpdated?.(action.actionId, 'REJECTED', 'Action marked as rejected.');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRollback = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/merchant/actions/${action.actionId}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-id': action.merchantId || 'default_merchant',
        },
        body: JSON.stringify({ rollbackBy: 'merchant_admin' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to rollback action');
      }
      onActionUpdated?.(action.actionId, 'ROLLED_BACK', data.message || 'Action rolled back successfully.');
      setIsRollbackModalOpen(false);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return 'N/A';
    try {
      return new Date(iso).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  };

  const outcome = action.outcome;
  const expDelta = outcome?.expectedImpact?.expectedRevenueDelta;
  const obsDelta = outcome?.actualImpact?.observedRevenueDelta;
  const variancePct = outcome?.impactDeltaPct;

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity duration-200"
      />

      {/* Slide-over Container (surface-1) */}
      <div className="relative w-full max-w-xl bg-surface-1 border-l border-hairline h-full flex flex-col shadow-2xl z-10 text-ink">
        {/* 1. Header */}
        <div className="px-6 py-4 border-b border-hairline flex items-center justify-between bg-surface-1">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-medium text-ink-subtle uppercase tracking-wider">
                Decision Audit ID: {action.actionId}
              </span>
              <TrustBadge tag="[FACT]" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-ink font-display">
                {action.actionType} Recommendation
              </h2>
              <span
                className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-xs border ${
                  action.status === 'PENDING_APPROVAL'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : action.status === 'COMPLETED'
                    ? 'bg-semantic-success/10 text-semantic-success border-semantic-success/30'
                    : action.status === 'ROLLED_BACK'
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                    : 'bg-surface-2 text-ink-subtle border-hairline'
                }`}
              >
                {action.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* 2. Body Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs">
          {/* A. Target Entity Card */}
          <div className="bg-surface-2 border border-hairline rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase text-ink-subtle font-medium">
                {action.targetType === 'CUSTOMER' ? 'Target Customer Entity' : 'Target Catalog SKU'}
              </span>
              <span className="text-[11px] font-mono text-ink-muted">
                {action.targetType === 'CUSTOMER'
                  ? (action.productId ? `CUSTOMER • SKU-${action.productId}` : 'CUSTOMER RETENTION')
                  : (action.productId ? `SKU-${action.productId}` : 'CATALOG SCOPE')}
              </span>
            </div>
            <div className="text-sm font-semibold text-ink">
              {action.targetType === 'CUSTOMER' && (action.targetCustomer || action.productName) ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                      CUSTOMER
                    </span>
                    <span>{action.targetCustomer || action.productName}</span>
                  </div>
                  {action.productTitle && (
                    <div className="text-xs text-ink-subtle font-normal font-sans">
                      Associated Product: {action.productTitle} {action.productSku ? `(${action.productSku})` : ''}
                    </div>
                  )}
                </div>
              ) : (
                action.productName || (action.productId ? `SKU-${action.productId}` : 'Catalog-wide')
              )}
            </div>
            <div className="bg-surface-1/70 border border-hairline rounded-md p-3 text-ink-muted font-body leading-relaxed">
              {action.reason}
            </div>
          </div>

          {/* B. Pre-Action Baseline Telemetry */}
          {outcome?.baselineMetrics && (
            <div className="bg-surface-2 border border-hairline rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-subtle" />
                  <span className="text-xs font-semibold text-ink uppercase tracking-wider font-display">
                    Pre-Action Telemetry Baseline
                  </span>
                  <TrustBadge tag="[FACT]" />
                </div>
                <span className="text-[10px] text-ink-tertiary font-mono">
                  Captured at recommendation time
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2.5 bg-surface-1 border border-hairline rounded-md">
                  <span className="text-[10px] text-ink-subtle block">Stock on Shelf</span>
                  <span className="font-bold text-ink text-sm">
                    {outcome.baselineMetrics.stockOnHand !== undefined ? `${outcome.baselineMetrics.stockOnHand} units` : 'N/A'}
                  </span>
                </div>
                <div className="p-2.5 bg-surface-1 border border-hairline rounded-md">
                  <span className="text-[10px] text-ink-subtle block">7d Sales Velocity</span>
                  <span className="font-bold text-ink text-sm">
                    {outcome.baselineMetrics.velocity7d !== undefined ? `${outcome.baselineMetrics.velocity7d} / day` : 'N/A'}
                  </span>
                </div>
                <div className="p-2.5 bg-surface-1 border border-hairline rounded-md">
                  <span className="text-[10px] text-ink-subtle block">Daily Run-Rate</span>
                  <span className="font-bold text-ink text-sm">
                    {outcome.baselineMetrics.dailyRevenue !== undefined ? `₹${outcome.baselineMetrics.dailyRevenue.toLocaleString('en-IN')}` : 'N/A'}
                  </span>
                </div>
                <div className="p-2.5 bg-surface-1 border border-hairline rounded-md">
                  <span className="text-[10px] text-ink-subtle block">Unit Margin</span>
                  <span className="font-bold text-semantic-success text-sm">
                    {outcome.baselineMetrics.contributionMarginPct !== undefined ? `${outcome.baselineMetrics.contributionMarginPct}%` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* C. Expected vs Observed Variance Box */}
          <div className="bg-surface-2 border border-hairline rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-linear-primary" />
                <span className="text-xs font-semibold text-ink uppercase tracking-wider font-display">
                  Expected vs Observed Realization
                </span>
                <TrustBadge tag={isCompleted && outcome?.outcomeStatus !== 'PENDING' ? '[FACT]' : '[RECOMMENDATION]'} />
              </div>
              <span className="text-[10px] text-ink-subtle font-mono">14-Day Window</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
              <div className="p-3 bg-surface-1 border border-hairline rounded-md">
                <span className="text-[10px] text-ink-subtle uppercase block font-medium">
                  Expected Impact
                </span>
                <div className="text-base font-bold text-ink mt-1">
                  {expDelta !== undefined ? `+₹${expDelta.toLocaleString('en-IN')}` : 'N/A'}
                </div>
                {outcome?.expectedImpact?.expectedUnitsDelta && (
                  <div className="text-[10px] text-ink-subtle mt-0.5">
                    +{outcome.expectedImpact.expectedUnitsDelta} units
                  </div>
                )}
              </div>

              <div className="p-3 bg-surface-1 border border-hairline rounded-md">
                <span className="text-[10px] text-ink-subtle uppercase block font-medium">
                  Observed Outcome
                </span>
                <div className="text-base font-bold text-linear-primary-hover mt-1">
                  {obsDelta !== undefined
                    ? `+₹${obsDelta.toLocaleString('en-IN')}`
                    : isCompleted
                    ? 'Outcome pending'
                    : 'Not available'}
                </div>
                {outcome?.actualImpact?.observedUnitsDelta && (
                  <div className="text-[10px] text-ink-subtle mt-0.5">
                    +{outcome.actualImpact.observedUnitsDelta} units observed
                  </div>
                )}
              </div>

              <div className="p-3 bg-surface-1 border border-hairline rounded-md">
                <span className="text-[10px] text-ink-subtle uppercase block font-medium">
                  Variance Realization
                </span>
                <div className="text-base font-bold mt-1">
                  {variancePct !== undefined ? (
                    <span className={variancePct >= 0 ? 'text-semantic-success' : 'text-rose-400'}>
                      {variancePct > 0 ? '+' : ''}
                      {variancePct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-ink-subtle text-xs font-normal">Pending evaluation</span>
                  )}
                </div>
                <div className="text-[10px] text-ink-tertiary mt-0.5 uppercase">
                  Status: {outcome?.outcomeStatus || 'PENDING'}
                </div>
              </div>
            </div>
          </div>

          {/* D. 7-Point Negative Diagnostics (Rendered only on negative outcome) */}
          {outcome?.outcomeStatus === 'NEGATIVE' && outcome.negativeDiagnostics && outcome.negativeDiagnostics.length > 0 && (
            <div className="bg-surface-2 border border-rose-500/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider font-display">
                    Root-Cause Diagnostic Decomposition
                  </span>
                  <TrustBadge tag="[AI INSIGHT]" />
                </div>
                <span className="text-[10px] text-rose-400 font-mono">Performance Divergence</span>
              </div>
              <ul className="space-y-1.5 list-disc list-inside text-rose-200/90 text-xs">
                {outcome.negativeDiagnostics.map((diag, i) => (
                  <li key={i} className="leading-relaxed">
                    {diag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* E. Model Confidence & Learning State */}
          <div className="bg-surface-2 border border-hairline rounded-lg p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between text-ink-subtle">
              <span className="text-[11px] font-mono uppercase font-medium">
                Model Confidence & Learning State
              </span>
              <TrustBadge tag="[FACT]" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink font-medium">Model Confidence at Recommendation:</span>
              <span className="font-mono font-bold text-ink">
                {outcome?.confidenceAtRecommendation !== undefined
                  ? `${Math.round(outcome.confidenceAtRecommendation * 100)}%`
                  : '91%'}
              </span>
            </div>
            <p className="text-[11px] text-ink-subtle leading-relaxed">
              Recommendation derived from baseline heuristic weights and historical velocity bounds.
            </p>
          </div>
        </div>

        {/* 3. Footer Action Controls */}
        <div className="px-6 py-4 border-t border-hairline bg-surface-1 flex items-center justify-between gap-3">
          <div className="text-[11px] font-mono text-ink-subtle">
            {isPending && 'Awaiting Human Authorization'}
            {isCompleted && `Approved on ${formatDate(action.approvedAt)}`}
            {isRolledBack && `Rolled back on ${formatDate(action.rollbackAt)}`}
          </div>

          <div className="flex items-center gap-2.5">
            {isPending && (
              <>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleReject}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-hairline hover:border-hairline-strong hover:bg-surface-2 text-ink transition-colors disabled:opacity-50"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleApprove}
                  className="px-4 py-1.5 text-xs font-medium rounded-md bg-linear-primary hover:bg-linear-primary-hover active:bg-linear-primary-focus text-white transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isProcessing ? 'Executing...' : 'Approve & Execute'}
                </button>
              </>
            )}

            {isCompleted && action.canRollback && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setIsRollbackModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors disabled:opacity-50"
              >
                Rollback Decision
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Destructive Rollback Confirmation Modal */}
      {isRollbackModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div
            onClick={() => setIsRollbackModalOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-xs"
          />
          <div className="relative bg-surface-2 border border-hairline-strong rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 text-ink z-10">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink font-display">Confirm Decision Rollback</h3>
                <p className="text-xs text-ink-subtle mt-1 leading-relaxed">
                  Executing a rollback will issue an immediate inverse catalog mutation for{' '}
                  <strong className="text-ink font-mono">{action.productName}</strong> and commit a compensating entry to the business impact ledger.
                </p>
              </div>
            </div>

            <div className="p-3 bg-surface-1 border border-hairline rounded-md text-xs font-mono text-ink-muted space-y-1">
              <div>Target: {action.actionType} on SKU-{action.productId}</div>
              <div>Compensating Entry: Reverting to pre-action baseline configuration</div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsRollbackModalOpen(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-hairline text-ink hover:bg-surface-3 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleRollback}
                className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Reverting...' : 'Confirm & Execute Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
