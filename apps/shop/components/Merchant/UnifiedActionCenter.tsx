'use client';

import React, { useState, useEffect } from 'react';

export type ActionFilterStatus = 'NEEDS_APPROVAL' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'REJECTED';

export interface UnifiedActionItem {
  actionId: string;
  actionType: 'RESTOCK' | 'DISCOUNT' | 'PROMOTION' | 'RETENTION' | 'TRANSFER';
  title: string;
  productName?: string;
  productId?: number;
  status: ActionFilterStatus;
  reason: string;
  evidence: string;
  confidenceScore: number;
  expectedImpact: string;
  risks: string;
  whatHappensIfApproved: string;
  isReversible: boolean;
  rollbackDescription?: string;
  createdAt: string;
  expiresAt?: string;
  approvedBy?: string;
}

interface UnifiedActionCenterProps {
  onActionExecuted?: () => void;
}

export function UnifiedActionCenter({ onActionExecuted }: UnifiedActionCenterProps) {
  const [selectedStatus, setSelectedStatus] = useState<ActionFilterStatus>('NEEDS_APPROVAL');
  const [actions, setActions] = useState<UnifiedActionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedActionForModal, setSelectedActionForModal] = useState<UnifiedActionItem | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Initialize realistic staged actions
  useEffect(() => {
    setActions([
      {
        actionId: 'act_restock_sports_claw',
        actionType: 'RESTOCK',
        title: 'Restock Sports Claw Women Shoes',
        productName: 'Sports Claw Women Shoes',
        productId: 20000001,
        status: 'NEEDS_APPROVAL',
        reason: '7-day velocity is 4.2 units/day with only 18 units left on shelf (~4.2 days of stock cover).',
        evidence: '15,049 historical orders show consistent replenishment turnaround of 7 days from supplier Apex Apparel.',
        confidenceScore: 0.91,
        expectedImpact: 'Prevents estimated ₹85,000 lost revenue across 45 units over the next 14-day window.',
        risks: 'Demand may normalize slightly following recent seasonal spike.',
        whatHappensIfApproved: 'Drafts a formal Purchase Order for 50 units @ ₹1,100/unit and awaits warehouse goods receipt.',
        isReversible: true,
        rollbackDescription: 'Can be cancelled at any time before supplier receipt.',
        createdAt: new Date().toISOString()
      },
      {
        actionId: 'act_discount_dead_stock',
        actionType: 'DISCOUNT',
        title: 'Clearance Markdown on Stagnant Winter Jackets',
        productName: 'Winter Leather Jacket XL',
        productId: 20000008,
        status: 'NEEDS_APPROVAL',
        reason: 'Zero units sold in the last 45 days. Committed working capital is ₹1,40,000.',
        evidence: 'Markdown simulation predicts 15% discount will accelerate sell-through velocity to 2.1 units/day.',
        confidenceScore: 0.84,
        expectedImpact: 'Releases ₹95,000 in liquid working capital within 21 days while maintaining 34% margin.',
        risks: 'Minor gross margin compression from 48% to 34%.',
        whatHappensIfApproved: 'Updates catalog promotional price from ₹3,999 to ₹3,399 immediately across storefront.',
        isReversible: true,
        rollbackDescription: 'Can immediately restore previous price of ₹3,999 with 1 click.',
        createdAt: new Date().toISOString()
      },
      {
        actionId: 'act_retention_vip_dormant',
        actionType: 'RETENTION',
        title: 'Re-engage High-CLV Dormant VIP Cohort',
        status: 'NEEDS_APPROVAL',
        reason: '23 high-value repeat customers have not ordered in 60+ days (historical churn threshold).',
        evidence: 'Customer cohort CLV analysis indicates ₹12,400 average lifetime value per account.',
        confidenceScore: 0.88,
        expectedImpact: 'Staged personalized 10% reactivation incentive with estimated 28% conversion lift.',
        risks: 'Incentive margin dilution on subsequent organic orders.',
        whatHappensIfApproved: 'Stages target customer cohort for promotional email campaign.',
        isReversible: false,
        rollbackDescription: 'This action stages message queue; cannot un-send once dispatched.',
        createdAt: new Date().toISOString()
      }
    ]);
  }, []);

  const handleApprove = (action: UnifiedActionItem) => {
    setActions(prev => prev.map(a => a.actionId === action.actionId ? { ...a, status: 'COMPLETED', approvedBy: 'merchant_admin' } : a));
    setFeedbackMessage({ text: `Approved "${action.title}". Action executed successfully.` });
    setSelectedActionForModal(null);
    if (onActionExecuted) onActionExecuted();
  };

  const handleReject = (action: UnifiedActionItem) => {
    setActions(prev => prev.map(a => a.actionId === action.actionId ? { ...a, status: 'REJECTED' } : a));
    setFeedbackMessage({ text: `Rejected "${action.title}". Action dismissed.` });
    setSelectedActionForModal(null);
    if (onActionExecuted) onActionExecuted();
  };

  const handleUndo = (action: UnifiedActionItem) => {
    if (!action.isReversible) {
      setFeedbackMessage({ text: 'This action cannot be automatically reversed.', isError: true });
      return;
    }
    setActions(prev => prev.map(a => a.actionId === action.actionId ? { ...a, status: 'NEEDS_APPROVAL' } : a));
    setFeedbackMessage({ text: `Rolled back "${action.title}". State restored.` });
  };

  const filtered = actions.filter(a => {
    if (selectedStatus === 'NEEDS_APPROVAL') return a.status === 'NEEDS_APPROVAL';
    return a.status === selectedStatus;
  });

  return (
    <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900">Unified Action & Approval Center</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
              [RECOMMENDATION]
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict human-in-the-loop governance. No financial, pricing, or supplier actions execute without explicit merchant approval.
          </p>
        </div>

        {feedbackMessage && (
          <div className={`text-xs px-3 py-1.5 rounded-lg border font-bold ${
            feedbackMessage.isError ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {feedbackMessage.text}
          </div>
        )}
      </div>

      {/* 6 Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6 border-b border-slate-100 pb-3">
        {(['NEEDS_APPROVAL', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED', 'REJECTED'] as ActionFilterStatus[]).map(st => (
          <button
            key={st}
            onClick={() => setSelectedStatus(st)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedStatus === st
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Actions List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-xs">
          No actions currently in <strong className="text-slate-600">{selectedStatus}</strong> status.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(action => (
            <div
              key={action.actionId}
              className="rounded-xl border border-slate-200/90 p-4 hover:border-slate-300 transition-all bg-slate-50/50"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-800 text-slate-200 uppercase">
                      {action.actionType}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{action.title}</h3>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Confidence: {Math.round(action.confidenceScore * 100)}%
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {action.reason}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                    <span>⚡ Impact: <strong className="text-slate-800">{action.expectedImpact}</strong></span>
                    <span>•</span>
                    <span>⚠️ Risk: <strong className="text-amber-800">{action.risks}</strong></span>
                  </div>
                </div>

                {/* Button Controls */}
                <div className="flex items-center gap-2 self-end lg:self-center">
                  <button
                    onClick={() => setSelectedActionForModal(action)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 text-xs font-bold transition-all"
                  >
                    View Explainability
                  </button>

                  {action.status === 'NEEDS_APPROVAL' && (
                    <>
                      <button
                        onClick={() => handleReject(action)}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-bold transition-all"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(action)}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all"
                      >
                        Approve & Execute
                      </button>
                    </>
                  )}

                  {action.status === 'COMPLETED' && action.isReversible && (
                    <button
                      onClick={() => handleUndo(action)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
                      title={action.rollbackDescription}
                    >
                      ↩️ Undo / Rollback
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 6-Point Explainability Modal */}
      {selectedActionForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Explainability & Safety Brief</span>
                <h3 className="text-base font-bold text-slate-900">{selectedActionForModal.title}</h3>
              </div>
              <button
                onClick={() => setSelectedActionForModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">1. WHY THIS RECOMMENDATION?</span>
                <p className="text-slate-600">{selectedActionForModal.reason}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">2. MATHEMATICAL EVIDENCE</span>
                <p className="text-slate-600">{selectedActionForModal.evidence}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">3. CONFIDENCE</span>
                  <p className="text-emerald-700 font-extrabold text-sm">{Math.round(selectedActionForModal.confidenceScore * 100)}% Confidence</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">4. REVERSIBILITY</span>
                  <p className="text-slate-700 font-bold">{selectedActionForModal.isReversible ? 'Reversible (Can undo)' : 'Irreversible once sent'}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                <span className="font-bold text-amber-900 block mb-1">5. RISK & UNCERTAINTY</span>
                <p className="text-amber-800">{selectedActionForModal.risks}</p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <span className="font-bold text-emerald-900 block mb-1">6. WHAT HAPPENS IF I APPROVE?</span>
                <p className="text-emerald-800">{selectedActionForModal.whatHappensIfApproved}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedActionForModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
              {selectedActionForModal.status === 'NEEDS_APPROVAL' && (
                <button
                  onClick={() => handleApprove(selectedActionForModal)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs"
                >
                  Approve & Execute
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
