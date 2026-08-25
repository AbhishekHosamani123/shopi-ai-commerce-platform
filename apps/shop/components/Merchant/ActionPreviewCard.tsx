'use client';

import React, { useState } from 'react';

export interface ActionPreviewItem {
  actionId: string;
  type: string;
  status: string;
  productId?: number | null;
  productName?: string | null;
  quantity?: number | null;
  currentStock?: number;
  recommendedChange?: string;
  estimatedCoverage?: string;
  reason: string;
  impact: string;
  expiresAt: string;
  requiresApproval: boolean;
  payload?: Record<string, any>;
}

interface ActionPreviewCardProps {
  action: ActionPreviewItem;
  onActionComplete?: (actionId: string, status: string, message: string) => void;
  compact?: boolean;
}

export const ActionPreviewCard: React.FC<ActionPreviewCardProps> = ({
  action,
  onActionComplete,
  compact = false
}) => {
  const [currentStatus, setCurrentStatus] = useState<string>(action.status);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleApprove = async () => {
    if (isProcessing || currentStatus !== 'PENDING_APPROVAL') return;
    setIsProcessing(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch(`/api/merchant/ai/actions/${action.actionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'merchant_admin' })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentStatus('COMPLETED');
        setFeedbackMessage(data.message || 'Action approved and executed successfully.');
        if (onActionComplete) onActionComplete(action.actionId, 'COMPLETED', data.message);
      } else {
        setFeedbackMessage(`⚠️ ${data.error || 'Approval failed'}`);
      }
    } catch (err: any) {
      setFeedbackMessage(`⚠️ Error connecting to server: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (isProcessing || currentStatus !== 'PENDING_APPROVAL') return;
    setIsProcessing(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch(`/api/merchant/ai/actions/${action.actionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rejected by merchant via Action Card' })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentStatus('REJECTED');
        setFeedbackMessage('Action recommendation dismissed.');
        if (onActionComplete) onActionComplete(action.actionId, 'REJECTED', 'Action rejected.');
      } else {
        setFeedbackMessage(`⚠️ ${data.error || 'Rejection failed'}`);
      }
    } catch (err: any) {
      setFeedbackMessage(`⚠️ Error connecting to server: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getBadgeColor = () => {
    switch (action.type) {
      case 'RESTOCK':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'DISCOUNT':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'PROMOTION':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
  };

  const getTypeIcon = () => {
    switch (action.type) {
      case 'RESTOCK':
        return 'fa-boxes-stacked text-rose-600';
      case 'DISCOUNT':
        return 'fa-tag text-amber-600';
      case 'PROMOTION':
        return 'fa-bullhorn text-emerald-600';
      default:
        return 'fa-clipboard-check text-indigo-600';
    }
  };

  return (
    <div className={`rounded-xl border ${currentStatus === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50/40' : currentStatus === 'REJECTED' ? 'border-slate-200 bg-slate-50 opacity-75' : 'border-slate-200 bg-white'} p-3.5 shadow-2xs transition-all`}>
      {/* Header Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <i className={`fas ${getTypeIcon()} text-xs`}></i>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getBadgeColor()}`}>
            {action.type}
          </span>
          <span className="text-[10px] font-mono text-slate-400">#{action.actionId.slice(-6)}</span>
        </div>

        <div>
          {currentStatus === 'PENDING_APPROVAL' && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold animate-pulse">
              ⏳ Pending Approval
            </span>
          )}
          {currentStatus === 'COMPLETED' && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
              <i className="fas fa-check text-[9px]"></i> Executed
            </span>
          )}
          {currentStatus === 'REJECTED' && (
            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
              ✕ Rejected
            </span>
          )}
          {currentStatus === 'EXPIRED' && (
            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
              Expired
            </span>
          )}
        </div>
      </div>

      {/* Product & Recommendation Body */}
      <div className="space-y-1.5 text-xs">
        <div className="font-bold text-slate-900 leading-snug">
          {action.productName || 'Catalog Product'}
        </div>

        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-1">
          {action.currentStock !== undefined && (
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Current Stock:</span>
              <span className="font-bold text-slate-800">{action.currentStock} units {action.estimatedCoverage ? `(${action.estimatedCoverage})` : ''}</span>
            </div>
          )}
          {action.recommendedChange && (
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Recommended Action:</span>
              <span className="font-bold text-emerald-700">{action.recommendedChange}</span>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-600 leading-relaxed pt-0.5">
          <span className="font-semibold text-slate-700">Reason:</span> {action.reason}
        </p>

        {action.impact && (
          <p className="text-[11px] text-teal-800 font-medium bg-teal-50/80 p-1.5 rounded-md border border-teal-100">
            🎯 <span className="font-bold">Expected Impact:</span> {action.impact}
          </p>
        )}
      </div>

      {/* Feedback Alert */}
      {feedbackMessage && (
        <div className={`mt-2.5 p-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
          currentStatus === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
        }`}>
          <i className={`fas ${currentStatus === 'COMPLETED' ? 'fa-circle-check text-emerald-600' : 'fa-circle-info text-slate-500'}`}></i>
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Action Buttons */}
      {currentStatus === 'PENDING_APPROVAL' && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            ✕ Dismiss
          </button>
          <button
            onClick={handleApprove}
            disabled={isProcessing}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <i className="fas fa-circle-notch animate-spin text-[10px]"></i>
                <span>Verifying & Executing...</span>
              </>
            ) : (
              <>
                <i className="fas fa-check text-[10px]"></i>
                <span>Approve & Execute</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
