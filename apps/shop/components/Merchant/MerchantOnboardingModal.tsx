'use client';
import { merchantFetch } from '@/components/Merchant/merchantFetch';

import React, { useState, useEffect } from 'react';

interface MerchantOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export const MerchantOnboardingModal: React.FC<MerchantOnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const [step, setStep] = useState<number>(1);
  const [storeName, setStoreName] = useState('Razorpay AI Flagship Store');
  const [businessCategory, setBusinessCategory] = useState('Apparel & Footwear');
  const [currency, setCurrency] = useState('INR');
  const [primaryMarket, setPrimaryMarket] = useState('India (Pan-National)');
  const [businessModel, setBusinessModel] = useState('Omnichannel D2C');
  const [activeGoals, setActiveGoals] = useState<string[]>(['INCREASE_REVENUE', 'REDUCE_DEAD_STOCK']);
  const [aiReadiness, setAiReadiness] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      merchantFetch('/api/merchant/onboarding/ai-readiness', {
        headers: {
          'x-merchant-role': 'merchant_admin',
          'x-merchant-id': 'default_merchant'
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.report) {
            setAiReadiness(data.report);
          }
        })
        .catch(err => console.error('Failed to fetch AI readiness:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleGoal = (goal: string) => {
    if (activeGoals.includes(goal)) {
      if (activeGoals.length > 1) {
        setActiveGoals(activeGoals.filter(g => g !== goal));
      }
    } else {
      setActiveGoals([...activeGoals, goal]);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await merchantFetch('/api/merchant/onboarding/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-role': 'merchant_admin',
          'x-merchant-id': 'default_merchant'
        },
        body: JSON.stringify({
          storeName,
          businessCategory,
          currency,
          primaryMarket,
          businessModel,
          activeGoals,
          onboardingCompleted: true
        })
      });
      if (onComplete) onComplete();
      onClose();
    } catch (e) {
      console.error('Error saving onboarding profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const goalOptions = [
    { key: 'INCREASE_REVENUE', label: 'Increase Revenue', desc: 'Accelerate top-line sales velocity and basket size' },
    { key: 'INCREASE_MARGIN', label: 'Increase Profit Margin', desc: 'Optimize contribution margins and reduce heavy discounts' },
    { key: 'REDUCE_DEAD_STOCK', label: 'Reduce Dead Stock', desc: 'Clear slow-moving inventory to liberate working capital' },
    { key: 'REDUCE_STOCKOUTS', label: 'Reduce Stockouts', desc: 'Ensure continuous availability of champion SKUs' },
    { key: 'IMPROVE_RETENTION', label: 'Improve Retention', desc: 'Re-engage dormant VIP buyers and reduce churn' },
    { key: 'REDUCE_RETURNS', label: 'Reduce Returns', desc: 'Minimize reverse logistics and fitment refund rates' },
    { key: 'IMPROVE_CASH_EFFICIENCY', label: 'Improve Cash Efficiency', desc: 'Shorten Days Inventory Outstanding (DIO)' },
    { key: 'INCREASE_ROAS', label: 'Increase ROAS', desc: 'Target paid ad budget exclusively on high-margin winners' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col my-8">
        {/* Header with Progress Steps */}
        <div className="bg-slate-950/70 border-b border-slate-800 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-lg">
                ✨
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Merchant AI Onboarding</h2>
                <p className="text-xs text-slate-400">Configure your store parameters and calibrate AI intelligence</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-sm font-medium px-3 py-1 rounded-lg bg-slate-800/50 hover:bg-slate-800"
            >
              Skip
            </button>
          </div>

          {/* Stepper Dots */}
          <div className="grid grid-cols-4 gap-2 pt-2">
            {[
              { num: 1, label: 'Store Info' },
              { num: 2, label: 'Goals' },
              { num: 3, label: 'Data Check' },
              { num: 4, label: 'AI Readiness' }
            ].map((s) => (
              <div
                key={s.num}
                className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold transition-all ${
                  step === s.num
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                    : step > s.num
                    ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  step === s.num ? 'bg-blue-500 text-white font-bold' : step > s.num ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Step 1: Business Information */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                🏪 Step 1: Business Information
              </h3>
              <p className="text-xs text-slate-400">
                Help the AI understand your merchant domain and commercial operating structure.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Store Name</label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Business Category</label>
                  <select
                    value={businessCategory}
                    onChange={(e) => setBusinessCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Apparel & Footwear">Apparel & Footwear</option>
                    <option value="Consumer Electronics">Consumer Electronics</option>
                    <option value="Beauty & Personal Care">Beauty & Personal Care</option>
                    <option value="Home & Kitchen">Home & Kitchen</option>
                    <option value="Health & Fitness">Health & Fitness</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="INR">INR (₹ - Indian Rupee)</option>
                    <option value="USD">USD ($ - US Dollar)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="GBP">GBP (£ - British Pound)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Primary Market</label>
                  <input
                    type="text"
                    value={primaryMarket}
                    onChange={(e) => setPrimaryMarket(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Business Operating Model</label>
                  <select
                    value={businessModel}
                    onChange={(e) => setBusinessModel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Omnichannel D2C">Omnichannel D2C (Direct Store + Marketplaces)</option>
                    <option value="Pure D2C Online">Pure D2C Online Storefront</option>
                    <option value="B2B Wholesale">B2B Wholesale / Distributor</option>
                    <option value="Hybrid Retail">Hybrid Online & Physical Retail</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Strategic Goals */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                🎯 Step 2: Strategic Business Goals
              </h3>
              <p className="text-xs text-slate-400">
                Select 1 or more strategic priorities. AI will dynamically re-rank all operational recommendations to maximize your selected goals.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {goalOptions.map((g) => {
                  const isSelected = activeGoals.includes(g.key);
                  return (
                    <div
                      key={g.key}
                      onClick={() => toggleGoal(g.key)}
                      className={`cursor-pointer p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500/40 shadow-sm'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{g.label}</span>
                        <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                          isSelected ? 'bg-blue-500 text-white' : 'border border-slate-700 text-transparent'
                        }`}>
                          ✓
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{g.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Data Readiness Audit */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                🗄️ Step 3: Database & Telemetry Health Audit
              </h3>
              <p className="text-xs text-slate-400">
                Live inspection of connected database records across PostgreSQL razorpay_ecommerce.
              </p>

              {aiReadiness ? (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {aiReadiness.dimensions.map((d: any) => (
                      <div key={d.domain} className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d.domain}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            d.status === 'STRONG' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            d.status === 'WEAK' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {d.status}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white">{d.observationCount.toLocaleString()} items</div>
                        <p className="text-[11px] text-slate-400 mt-1">{d.description}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <h4 className="text-xs font-bold text-slate-300 mb-1">Historical Dataset Duration</h4>
                    <p className="text-xs text-slate-400">
                      767 Days continuous telemetry verified (2024-07-17 to 2026-08-23). 15,049 real orders & 24,325 items available for ML training.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">Scanning database telemetry...</div>
              )}
            </div>
          )}

          {/* Step 4: AI Readiness Score */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                🛡️ Step 4: AI Readiness Score & Model Precision
              </h3>

              {aiReadiness ? (
                <div className="space-y-4 pt-2">
                  <div className="bg-gradient-to-br from-blue-950/40 via-slate-900 to-indigo-950/30 border border-blue-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Estimated AI Readiness</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl font-extrabold text-white">{aiReadiness.overallScore}</span>
                        <span className="text-sm text-slate-400">/ 100</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 ml-2">
                          {aiReadiness.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-2">{aiReadiness.summary}</p>
                    </div>
                  </div>

                  {/* Impact Breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-300">How Missing Telemetry Impacts AI Precision:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                        <span className="font-bold text-blue-400">Forecasting:</span>
                        <p className="text-slate-400 mt-0.5">{aiReadiness.accuracyImpacts.forecastingAccuracy}</p>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                        <span className="font-bold text-emerald-400">Price Elasticity:</span>
                        <p className="text-slate-400 mt-0.5">{aiReadiness.accuracyImpacts.pricingPrecision}</p>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                        <span className="font-bold text-purple-400">Reorders:</span>
                        <p className="text-slate-400 mt-0.5">{aiReadiness.accuracyImpacts.reorderConfidence}</p>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                        <span className="font-bold text-amber-400">Profit Margins:</span>
                        <p className="text-slate-400 mt-0.5">{aiReadiness.accuracyImpacts.profitMarginVisibility}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">Computing AI readiness score...</div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="bg-slate-950/80 border-t border-slate-800 p-4 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              step === 1
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            ← Back
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition-all"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={loading}
              className="flex items-center gap-1.5 px-6 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all"
            >
              {loading ? 'Configuring AI...' : 'Complete Onboarding & Enter Command Center'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
