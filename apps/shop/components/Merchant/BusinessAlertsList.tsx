'use client';

import React from 'react';

export interface BusinessAlert {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'OPPORTUNITY' | 'INFO';
  title: string;
  description: string;
  metricType: 'inventory' | 'sales' | 'returns' | 'growth' | 'system';
  recommendedAction: string;
  actionType: 'reorder' | 'discount' | 'investigate_returns' | 'promote' | 'sync';
  metadata?: Record<string, any>;
  createdAt: string;
}

interface BusinessAlertsListProps {
  alerts: BusinessAlert[];
  onAiAction?: (prompt: string) => void;
}

export const BusinessAlertsList: React.FC<BusinessAlertsListProps> = ({
  alerts = [],
  onAiAction
}) => {
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          badge: 'bg-rose-50 text-rose-700 border-rose-200',
          dot: 'bg-rose-500',
          icon: 'fa-triangle-exclamation'
        };
      case 'WARNING':
        return {
          badge: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-500',
          icon: 'fa-circle-exclamation'
        };
      case 'OPPORTUNITY':
        return {
          badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500',
          icon: 'fa-arrow-trend-up'
        };
      case 'INFO':
      default:
        return {
          badge: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500',
          icon: 'fa-circle-info'
        };
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-sm">
              <i className="fas fa-bell text-xs"></i>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Today's Operational Priorities</h3>
              <p className="text-xs text-slate-500 mt-0.5">Real-time alerts evaluating inventory risk, growth surge, and return spikes</p>
            </div>
          </div>

          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {alerts.length} Active Items
          </span>
        </div>

        {/* Priority Cards Feed */}
        <div className="mt-4 space-y-3">
          {alerts.map((item) => {
            const style = getSeverityBadge(item.severity);
            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex items-start gap-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 mt-0.5 ${style.badge}`}>
                    <i className={`fas ${style.icon} mr-1 text-[9px]`}></i>
                    {item.severity}
                  </span>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
                      <span>Action:</span>
                      <span>{item.recommendedAction}</span>
                    </div>
                  </div>
                </div>

                {onAiAction && (
                  <button
                    onClick={() => onAiAction(`Explain priority "${item.title}" and what action I should take`)}
                    className="shrink-0 text-xs font-bold text-slate-700 hover:text-emerald-800 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs hover:border-emerald-300 transition-all flex items-center gap-1 self-start sm:self-center"
                  >
                    <span>Investigate</span>
                    <i className="fas fa-arrow-right text-[9px]"></i>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer AI Trigger */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[11px]">
          Synchronized continuously with PostgreSQL metrics
        </span>

        {onAiAction && (
          <button
            onClick={() => onAiAction('What should I focus on today?')}
            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 group"
          >
            <span>Ask AI for Today's Priority Agenda</span>
            <i className="fas fa-arrow-right text-[9px] group-hover:translate-x-0.5 transition-transform"></i>
          </button>
        )}
      </div>
    </div>
  );
};
