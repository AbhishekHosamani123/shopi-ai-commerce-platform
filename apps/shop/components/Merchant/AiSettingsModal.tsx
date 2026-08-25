'use client';

import React, { useState, useEffect } from 'react';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState({
    proactiveInsightsEnabled: true,
    digestFrequency: 'DAILY',
    digestTime: '09:00',
    timezone: 'Asia/Kolkata',
    alertPreferences: {
      critical: true,
      warning: true,
      opportunity: true,
      info: true
    }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/merchant/ai/settings');
      const data = await res.json();
      if (res.ok && data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      const res = await fetch('/api/merchant/ai/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Failed to save AI settings:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center text-sm font-bold">
              ⚙️
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Merchant AI Intelligence Settings
              </h3>
              <p className="text-[11px] text-slate-500">
                Configure autonomous proactive scans & scheduled briefings
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 flex items-center justify-center transition-all cursor-pointer"
          >
            <i className="fas fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <i className="fas fa-circle-notch animate-spin text-indigo-600"></i>
              <span>Loading AI preferences...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Proactive Insights Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-900">Proactive Telemetry Scans</div>
                  <div className="text-[11px] text-slate-500">
                    Continuously detect revenue anomalies & stockout risks
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.proactiveInsightsEnabled}
                  onChange={e => setSettings({ ...settings, proactiveInsightsEnabled: e.target.checked })}
                  className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              {/* Digest Frequency */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">Digest Cadence</label>
                <select
                  value={settings.digestFrequency}
                  onChange={e => setSettings({ ...settings, digestFrequency: e.target.value })}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="DAILY">Daily Executive Briefing</option>
                  <option value="WEEKLY">Weekly Performance Digest</option>
                  <option value="MONTHLY">Monthly Operations Review</option>
                </select>
              </div>

              {/* Preferred Time & Timezone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">Delivery Time</label>
                  <input
                    type="time"
                    value={settings.digestTime}
                    onChange={e => setSettings({ ...settings, digestTime: e.target.value })}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">Timezone</label>
                  <select
                    value={settings.timezone}
                    onChange={e => setSettings({ ...settings, timezone: e.target.value })}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  </select>
                </div>
              </div>

              {/* Alert Severity Preferences */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-800">Enabled Anomaly Severity Radar</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.alertPreferences?.critical ?? true}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          alertPreferences: { ...settings.alertPreferences, critical: e.target.checked }
                        })
                      }
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>🔴 Critical Risks</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.alertPreferences?.warning ?? true}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          alertPreferences: { ...settings.alertPreferences, warning: e.target.checked }
                        })
                      }
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>🟠 Warnings</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.alertPreferences?.opportunity ?? true}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          alertPreferences: { ...settings.alertPreferences, opportunity: e.target.checked }
                        })
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>🟢 Opportunities</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.alertPreferences?.info ?? true}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          alertPreferences: { ...settings.alertPreferences, info: e.target.checked }
                        })
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>🔵 Business Insights</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-emerald-700 font-bold">
            {savedSuccess && '✓ Settings saved successfully'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-800 text-xs font-medium transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
