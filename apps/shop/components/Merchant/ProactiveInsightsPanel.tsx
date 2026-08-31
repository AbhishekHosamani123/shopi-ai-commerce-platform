'use client';
import { merchantFetch } from '@/components/Merchant/merchantFetch';

import React, { useState, useEffect, useCallback } from 'react';

export interface AlertItem {
  alertId: string;
  merchantId: string;
  alertType: string;
  severity: 'CRITICAL' | 'WARNING' | 'OPPORTUNITY' | 'INFO';
  title: string;
  summary: string;
  evidence: Record<string, any>;
  relatedProductId?: number | null;
  relatedCategory?: string | null;
  recommendedAction?: string | null;
  actionId?: string | null;
  status: string;
  createdAt: string;
}

interface ProactiveInsightsPanelProps {
  onTriggerCopilotAction?: (promptText: string) => void;
  onOpenSettings?: () => void;
  onOpenDigest?: () => void;
}

export const ProactiveInsightsPanel: React.FC<ProactiveInsightsPanelProps> = ({
  onTriggerCopilotAction,
  onOpenSettings,
  onOpenDigest
}) => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [summary, setSummary] = useState({
    totalAlerts: 0,
    criticalCount: 0,
    warningCount: 0,
    opportunityCount: 0,
    infoCount: 0,
    newCount: 0,
    acknowledgedCount: 0
  });
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [poGenerating, setPoGenerating] = useState<boolean>(false);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await merchantFetch(`/api/merchant/ai/alerts?severity=${severityFilter}&limit=20`);
      const data = await res.json();
      if (res.ok && data.success) {
        setAlerts(data.alerts || []);
        if (data.summary) setSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to load proactive alerts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [severityFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleRunScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      const res = await merchantFetch('/api/merchant/ai/proactive/scan', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setAlerts(data.alerts || []);
        if (data.summary) setSummary(data.summary);
      }
    } catch (err) {
      console.error('Proactive scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await merchantFetch(`/api/merchant/ai/alerts/${alertId}/acknowledge`, { method: 'POST' });
      setAlerts(prev => prev.map(a => a.alertId === alertId ? { ...a, status: 'ACKNOWLEDGED' } : a));
    } catch (err) {
      console.error('Acknowledge failed:', err);
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      await merchantFetch(`/api/merchant/ai/alerts/${alertId}/dismiss`, { method: 'POST' });
      setAlerts(prev => prev.filter(a => a.alertId !== alertId));
      setSummary(prev => ({ ...prev, totalAlerts: Math.max(0, prev.totalAlerts - 1) }));
    } catch (err) {
      console.error('Dismiss failed:', err);
    }
  };

  const handleGeneratePO = async () => {
    setPoGenerating(true);
    try {
      const res = await merchantFetch('/api/merchant/ai/documents/purchase-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierName: 'Primary Wholesale Distribution Center' })
      });
      const data = await res.json();
      if (res.ok && data.success && data.document?.htmlContent) {
        // Open printable Purchase Order in new window
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(data.document.htmlContent);
          printWindow.document.close();
        }
      }
    } catch (err) {
      console.error('Failed to generate PO:', err);
    } finally {
      setPoGenerating(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'WARNING':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'OPPORTUNITY':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    }
  };

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return '🔴';
      case 'WARNING':
        return '🟠';
      case 'OPPORTUNITY':
        return '🟢';
      default:
        return '🔵';
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 text-xs font-bold">
              ✨
            </div>
            <h3 className="font-bold text-slate-900 text-base tracking-tight">
              AI Proactive Intelligence & Anomaly Radar
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[11px] font-bold">
              Autonomous Monitor
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Continuous telemetry analysis detecting revenue surges, stockouts, return anomalies, and growth opportunities.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleGeneratePO}
            disabled={poGenerating}
            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
            title="Download Restock Purchase Order"
          >
            <i className={`fas ${poGenerating ? 'fa-circle-notch animate-spin' : 'fa-file-pdf text-rose-600'} text-[11px]`}></i>
            <span>Restock PO</span>
          </button>

          {onOpenDigest && (
            <button
              onClick={onOpenDigest}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <i className="fas fa-newspaper text-emerald-600 text-[11px]"></i>
              <span>Daily Briefing</span>
            </button>
          )}

          <button
            onClick={handleRunScan}
            disabled={isScanning}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <i className={`fas fa-radar ${isScanning ? 'animate-spin' : ''} text-[11px]`}></i>
            <span>{isScanning ? 'Scanning Telemetry...' : 'Run Proactive Scan'}</span>
          </button>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="h-8 w-8 rounded-xl bg-white border border-slate-200 hover:border-slate-300 flex items-center justify-center text-slate-600 transition-all shadow-2xs cursor-pointer"
              title="AI Digest & Alert Settings"
            >
              <i className="fas fa-sliders text-xs"></i>
            </button>
          )}
        </div>
      </div>

      {/* Severity Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setSeverityFilter(severityFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            severityFilter === 'CRITICAL' ? 'border-rose-400 bg-rose-50/60 shadow-xs' : 'border-slate-200 bg-slate-50 hover:bg-white'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-rose-700">
            <span>🔴 Critical Risks</span>
            {severityFilter === 'CRITICAL' && <span className="text-[10px] font-bold">Filtered</span>}
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold text-rose-800">{summary.criticalCount}</span>
            <span className="text-[10px] text-rose-600 font-medium">urgent attention</span>
          </div>
        </div>

        <div
          onClick={() => setSeverityFilter(severityFilter === 'WARNING' ? 'ALL' : 'WARNING')}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            severityFilter === 'WARNING' ? 'border-amber-400 bg-amber-50/60 shadow-xs' : 'border-slate-200 bg-slate-50 hover:bg-white'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700">
            <span>🟠 Warnings</span>
            {severityFilter === 'WARNING' && <span className="text-[10px] font-bold">Filtered</span>}
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold text-amber-800">{summary.warningCount}</span>
            <span className="text-[10px] text-amber-600 font-medium">watch items</span>
          </div>
        </div>

        <div
          onClick={() => setSeverityFilter(severityFilter === 'OPPORTUNITY' ? 'ALL' : 'OPPORTUNITY')}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            severityFilter === 'OPPORTUNITY' ? 'border-emerald-400 bg-emerald-50/60 shadow-xs' : 'border-slate-200 bg-slate-50 hover:bg-white'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700">
            <span>🟢 Opportunities</span>
            {severityFilter === 'OPPORTUNITY' && <span className="text-[10px] font-bold">Filtered</span>}
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold text-emerald-800">{summary.opportunityCount}</span>
            <span className="text-[10px] text-emerald-600 font-medium">revenue drivers</span>
          </div>
        </div>

        <div
          onClick={() => setSeverityFilter(severityFilter === 'INFO' ? 'ALL' : 'INFO')}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            severityFilter === 'INFO' ? 'border-indigo-400 bg-indigo-50/60 shadow-xs' : 'border-slate-200 bg-slate-50 hover:bg-white'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-700">
            <span>🔵 Business Insights</span>
            {severityFilter === 'INFO' && <span className="text-[10px] font-bold">Filtered</span>}
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold text-indigo-900">{summary.infoCount}</span>
            <span className="text-[10px] text-indigo-600 font-medium">telemetry notes</span>
          </div>
        </div>
      </div>

      {/* Alerts Stream */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <i className="fas fa-circle-notch animate-spin text-emerald-600"></i>
          <span>Scanning business telemetry...</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-1.5">
          <div className="text-xl">✨</div>
          <div className="text-xs font-bold text-slate-800">No Active Anomalies Detected</div>
          <p className="text-[11px] text-slate-500">
            All telemetry metrics are currently operating within normal parameters. Click "Run Proactive Scan" to perform a live scan.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div
              key={alert.alertId}
              className={`p-4 rounded-xl border transition-all ${
                alert.severity === 'CRITICAL'
                  ? 'border-rose-200 bg-rose-50/30'
                  : alert.severity === 'WARNING'
                  ? 'border-amber-200 bg-amber-50/30'
                  : alert.severity === 'OPPORTUNITY'
                  ? 'border-emerald-200 bg-emerald-50/30'
                  : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs">{getSeverityIcon(alert.severity)}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getSeverityBadge(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <h4 className="font-bold text-slate-900 text-xs">{alert.title}</h4>
                    {alert.status === 'ACKNOWLEDGED' && (
                      <span className="text-[10px] text-slate-400 font-semibold italic">✓ Acknowledged</span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-700 leading-relaxed pt-0.5">
                    {alert.summary}
                  </p>

                  {alert.recommendedAction && (
                    <div className="text-[11px] text-slate-900 font-medium flex items-center gap-1.5 pt-1">
                      <span className="text-emerald-700 font-bold">Recommended:</span>
                      <span>{alert.recommendedAction}</span>
                    </div>
                  )}
                </div>

                {/* Quick Action Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {onTriggerCopilotAction && alert.severity === 'CRITICAL' && (
                    <button
                      onClick={() => onTriggerCopilotAction(`Prepare a restock for ${alert.title}`)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                    >
                      Review Restock
                    </button>
                  )}
                  {onTriggerCopilotAction && alert.severity === 'OPPORTUNITY' && (
                    <button
                      onClick={() => onTriggerCopilotAction(`Analyze growth opportunity for ${alert.title}`)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                    >
                      Analyze Growth
                    </button>
                  )}
                  {alert.status === 'NEW' && (
                    <button
                      onClick={() => handleAcknowledge(alert.alertId)}
                      className="p-1 text-slate-400 hover:text-slate-700 text-xs rounded transition-all cursor-pointer"
                      title="Acknowledge"
                    >
                      <i className="fas fa-check"></i>
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(alert.alertId)}
                    className="p-1 text-slate-400 hover:text-rose-600 text-xs rounded transition-all cursor-pointer"
                    title="Dismiss"
                  >
                    <i className="fas fa-xmark"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
