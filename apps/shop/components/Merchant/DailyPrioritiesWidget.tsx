'use client';

import React, { useState, useEffect } from 'react';

interface DailyPrioritiesWidgetProps {
  onApproveAction?: (priority: any) => void;
  onReviewAction?: (priority: any) => void;
}

export const DailyPrioritiesWidget: React.FC<DailyPrioritiesWidgetProps> = ({
  onApproveAction,
  onReviewAction
}) => {
  const [priorities, setPriorities] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [approvedRanks, setApprovedRanks] = useState<number[]>([]);

  useEffect(() => {
    fetch('/api/merchant/ai/daily-priorities', {
      headers: {
        'x-merchant-role': 'merchant_admin',
        'x-merchant-id': 'default_merchant'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.topPriorities) {
          setPriorities(data.topPriorities);
        }
      })
      .catch(err => console.error('Failed to load priorities:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = (p: any) => {
    setApprovedRanks([...approvedRanks, p.priorityRank]);
    if (onApproveAction) {
      onApproveAction(p);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-1/3"></div>
        <div className="h-20 bg-slate-800 rounded"></div>
        <div className="h-20 bg-slate-800 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400 text-lg">
            🎯
          </div>
          <div>
            <h3 className="text-base font-bold text-white">What Should I Do Today?</h3>
            <p className="text-xs text-slate-400">Top 5 highest-leverage actions evaluated from real database telemetry</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          Ranked Top 5
        </span>
      </div>

      <div className="space-y-3">
        {priorities.map((p) => {
          const isApproved = approvedRanks.includes(p.priorityRank);

          return (
            <div
              key={p.priorityRank}
              className={`p-4 rounded-xl border transition-all ${
                isApproved
                  ? 'bg-emerald-950/20 border-emerald-500/30 opacity-75'
                  : p.severity === 'CRITICAL'
                  ? 'bg-slate-950/70 border-rose-500/30 hover:border-rose-500/50'
                  : p.severity === 'WARNING'
                  ? 'bg-slate-950/70 border-amber-500/30 hover:border-amber-500/50'
                  : 'bg-slate-950/70 border-slate-800 hover:border-blue-500/40'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Priority Header */}
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                    p.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                    p.severity === 'WARNING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}>
                    #{p.priorityRank}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{p.title}</h4>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        p.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        p.severity === 'WARNING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {p.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{p.problem}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {isApproved ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                      ✓ Approved
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => onReviewAction && onReviewAction(p)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
                      >
                        Review
                      </button>
                      <button
                        onClick={() => handleApprove(p)}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-1"
                      >
                        Approve →
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Evidence & Impact Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/60 text-[11px]">
                <div className="text-slate-400">
                  <span className="font-semibold text-slate-300">Evidence:</span> {p.evidence}
                </div>
                <div className="text-emerald-400 font-medium">
                  <span className="font-semibold text-emerald-300">Expected Impact:</span> {p.expectedImpact}
                </div>
                <div className="flex items-center gap-3 text-slate-400 justify-start sm:justify-end">
                  <span>Effort: <strong className="text-white">{p.estimatedEffort}</strong></span>
                  <span>Confidence: <strong className="text-white">{p.confidence}</strong></span>
                  <span>Risk: <strong className="text-white">{p.risk}</strong></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
