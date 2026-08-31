'use client';
import { merchantFetch } from '@/components/Merchant/merchantFetch';

import React, { useState, useEffect } from 'react';

interface DigestBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerCopilotAction?: (promptText: string) => void;
}

export const DigestBriefingModal: React.FC<DigestBriefingModalProps> = ({
  isOpen,
  onClose,
  onTriggerCopilotAction
}) => {
  const [digest, setDigest] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      fetchLatestDigest();
    }
  }, [isOpen]);

  const fetchLatestDigest = async () => {
    setLoading(true);
    try {
      const res = await merchantFetch('/api/merchant/ai/digests/latest');
      const data = await res.json();
      if (res.ok && data.success && data.digest) {
        setDigest(data.digest);
      }
    } catch (err) {
      console.error('Failed to load digest:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFresh = async (digestType: 'DAILY' | 'WEEKLY' | 'MONTHLY') => {
    setGenerating(true);
    try {
      const res = await merchantFetch('/api/merchant/ai/digest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digestType })
      });
      const data = await res.json();
      if (res.ok && data.success && data.digest) {
        setDigest(data.digest);
      }
    } catch (err) {
      console.error('Failed to generate fresh digest:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-bold">
              📰
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Executive Business Briefing
              </h3>
              <p className="text-[11px] text-slate-500">
                Scheduled digest powered by PostgreSQL Merchant Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGenerateFresh('DAILY')}
              disabled={generating}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
            >
              {generating ? 'Refreshing...' : 'Refresh Briefing'}
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 flex items-center justify-center transition-all cursor-pointer"
            >
              <i className="fas fa-xmark text-sm"></i>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <i className="fas fa-circle-notch animate-spin text-emerald-600"></i>
              <span>Compiling business briefing telemetry...</span>
            </div>
          ) : !digest ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No digest available. Click "Refresh Briefing" to compile a fresh summary.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Financial Metrics Strip */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Gross Revenue</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    ₹{(digest.metrics?.grossRevenue || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                    {digest.metrics?.revenueGrowthPct !== undefined && digest.metrics.revenueGrowthPct >= 0 ? '+' : ''}
                    {digest.metrics?.revenueGrowthPct || 0}% vs prior
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-200">
                  <div className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Total Orders</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {(digest.metrics?.totalOrders || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] font-semibold text-indigo-700 mt-0.5">
                    {(digest.metrics?.unitsSold || 0).toLocaleString('en-IN')} units sold
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Return Rate</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {digest.metrics?.returnRatePct || 0}%
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                    AOV: ₹{(digest.metrics?.averageOrderValue || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Briefing Summary Prose */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed font-mono whitespace-pre-wrap">
                {digest.summary}
              </div>

              {/* AI Operational Priorities with Direct Triggers */}
              {digest.aiPriorities && digest.aiPriorities.length > 0 && (
                <div className="space-y-2 pt-1">
                  <h4 className="text-xs font-bold text-slate-900">Recommended Executive Next Steps</h4>
                  <div className="space-y-2">
                    {digest.aiPriorities.map((p: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              Priority #{p.rank}
                            </span>
                            <span className="text-xs font-bold text-slate-900">{p.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-600">{p.recommendedAction}</p>
                        </div>

                        {onTriggerCopilotAction && (
                          <button
                            onClick={() => {
                              onClose();
                              onTriggerCopilotAction(`Prepare action for ${p.title}`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold shrink-0 transition-all cursor-pointer"
                          >
                            Draft Action
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Generated: {digest?.createdAt ? new Date(digest.createdAt).toLocaleTimeString() : 'Just now'}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-800 text-xs transition-all cursor-pointer"
          >
            Close Briefing
          </button>
        </div>
      </div>
    </div>
  );
};
