'use client';
import { merchantFetch } from '@/components/Merchant/merchantFetch';

import React, { useState, useEffect } from 'react';

interface ProductionReadinessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProductionReadinessModal: React.FC<ProductionReadinessModalProps> = ({
  isOpen,
  onClose
}) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchReport = () => {
    setLoading(true);
    merchantFetch('/api/merchant/ai/production-readiness', {
      headers: {
        'x-merchant-role': 'merchant_admin',
        'x-merchant-id': 'default_merchant'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.report) {
          setReport(data.report);
        }
      })
      .catch(err => console.error('Failed to load readiness:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      fetchReport();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="bg-slate-950/80 border-b border-slate-800 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg">
              🛡️
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Production Readiness Checklist</h3>
              <p className="text-xs text-slate-400">Live operational & security boundary evaluation across 10 categories</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchReport}
              title="Re-run audit"
              className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 text-xs font-semibold"
            >
              {loading ? 'Auditing...' : '↻ Re-audit'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh]">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs">Running multi-domain production audit...</div>
          ) : report ? (
            <>
              {/* Score Hero */}
              <div className="bg-gradient-to-r from-emerald-950/30 via-slate-950 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex flex-col items-center justify-center text-emerald-400 font-black">
                    <span className="text-2xl">{report.overallScore}</span>
                    <span className="text-[10px] uppercase text-slate-400">Score</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white">Production Status:</span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {report.readinessStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {report.passedCount} Categories Passed • {report.warningCount} Warnings • {report.failedCount} Blockers
                    </p>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-400">
                  <span>Audited against PostgreSQL Telemetry</span>
                  <div className="text-[11px] text-slate-500 mt-0.5">{new Date(report.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>

              {/* Category Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">10 Operational Domains Audit</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {report.categories.map((c: any) => (
                    <div
                      key={c.category}
                      className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{c.name}</span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          c.status === 'PASS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          c.status === 'WARNING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {c.status} ({c.score}/100)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{c.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="bg-slate-950/80 border-t border-slate-800 p-4 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
