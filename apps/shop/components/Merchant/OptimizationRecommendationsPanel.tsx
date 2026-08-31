'use client';
import { merchantFetch } from '@/components/Merchant/merchantFetch';

import React, { useState, useEffect } from 'react';

interface Recommendation {
  recommendationId: string;
  category: string;
  goal: string;
  title: string;
  summary: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  urgency: 'CRITICAL' | 'WARNING' | 'INFO';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  actionType?: string;
  actionId?: string;
  evidence: Record<string, any>;
}

interface DataHealth {
  orderHistoryDays: number;
  orderCoverageStatus: string;
  productCount: number;
  overallHealthScore: number;
  notes: string[];
}

interface SimulationResult {
  scenarioType: string;
  productTitle: string;
  currentState: { price: number; stock: number; dailyVelocity: number; monthlyRevenue: number };
  projectedState: {
    projectedPrice: number;
    projectedDailyVelocity: number;
    projectedMonthlyRevenueMid: number;
    projectedMonthlyRevenueMin: number;
    projectedMonthlyRevenueMax: number;
    revenueDeltaPct: number;
  };
  confidence: string;
  riskAssessment: string;
  recommendationText: string;
  simulatedLabel: string;
}

interface Props {
  merchantId?: string;
  onSelectAction?: (actionId: string) => void;
}

export default function OptimizationRecommendationsPanel({
  merchantId = 'default_merchant',
  onSelectAction
}: Props) {
  const [goal, setGoal] = useState<string>('MAXIMIZE_REVENUE');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [dataHealth, setDataHealth] = useState<DataHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulationModalOpen, setSimulationModalOpen] = useState<boolean>(false);
  const [simulationLoading, setSimulationLoading] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [simDiscountPct, setSimDiscountPct] = useState<number>(10);
  const [simPriceChangePct, setSimPriceChangePct] = useState<number>(0);

  const fetchOptimizationData = async () => {
    setLoading(true);
    try {
      const [recsRes, healthRes] = await Promise.all([
        merchantFetch(`/api/merchant/ai/optimization/recommendations?goal=${goal}`, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-secret': 'sec_merch_live_89012345678901234567890123456789',
            'x-merchant-id': merchantId
          }
        }),
        merchantFetch('/api/merchant/ai/optimization/data-health', {
          headers: {
            'Content-Type': 'application/json',
            'x-api-secret': 'sec_merch_live_89012345678901234567890123456789',
            'x-merchant-id': merchantId
          }
        })
      ]);

      const recsData = await recsRes.json();
      const healthData = await healthRes.json();

      if (recsData.success) setRecommendations(recsData.recommendations || []);
      if (healthData.success) setDataHealth(healthData.health);
    } catch (err) {
      console.error('Failed to load optimization data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptimizationData();
  }, [goal, merchantId]);

  const handleRunSimulation = async (scenarioType: string = 'DISCOUNT_CLEARANCE') => {
    setSimulationLoading(true);
    try {
      const res = await merchantFetch('/api/merchant/ai/optimization/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': 'sec_merch_live_89012345678901234567890123456789',
          'x-merchant-id': merchantId
        },
        body: JSON.stringify({
          scenarioType,
          productId: 1,
          parameters: {
            discountPct: simDiscountPct,
            priceChangePct: simPriceChangePct
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setSimulationResult(data.simulation);
        setSimulationModalOpen(true);
      }
    } catch (err) {
      console.error('Simulation run failed:', err);
    } finally {
      setSimulationLoading(false);
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'HIGH':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-950/80 text-rose-300 border border-rose-800/60">HIGH IMPACT</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-950/80 text-amber-300 border border-amber-800/60">MED IMPACT</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-300 border border-slate-700">LOW IMPACT</span>;
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'HIGH':
        return <span className="text-emerald-400 text-xs font-medium">● High Confidence</span>;
      case 'MEDIUM':
        return <span className="text-amber-400 text-xs font-medium">● Med Confidence</span>;
      default:
        return <span className="text-slate-400 text-xs font-medium">● Low Data Depth</span>;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-5 shadow-2xl space-y-5">
      {/* Header & Goal Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-lg font-bold text-white tracking-wide">✨ AI Optimization & Growth Center</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Goal-driven commercial predictions, pricing elasticity simulations, and RFM retention radars.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-300">Strategic Goal:</label>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="MAXIMIZE_REVENUE">🚀 Maximize Revenue</option>
            <option value="MAXIMIZE_UNITS">📦 Maximize Unit Velocity</option>
            <option value="CLEAR_INVENTORY">🏷️ Clear Stagnant Inventory</option>
            <option value="PROTECT_MARGIN">🛡️ Protect Gross Margin</option>
            <option value="GROW_CUSTOMERS">👥 Grow Customer Retention</option>
            <option value="INCREASE_REPEAT_PURCHASES">🔁 Increase Repeat Purchases</option>
          </select>
        </div>
      </div>

      {/* AI Data Health Indicator Bar */}
      {dataHealth && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-cyan-950/80 border border-cyan-700/50 flex items-center justify-center text-cyan-300 font-bold text-sm">
              {dataHealth.overallHealthScore}%
            </div>
            <div>
              <span className="font-semibold text-white">AI Historical Telemetry Health</span>
              <p className="text-slate-400 text-[11px]">
                {dataHealth.orderHistoryDays} Days Order Ledger ({dataHealth.orderCoverageStatus}) • {dataHealth.productCount} Active SKUs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunSimulation('PRICE_CHANGE')}
              disabled={simulationLoading}
              className="px-3 py-1.5 rounded-lg bg-cyan-600/90 hover:bg-cyan-500 text-white font-medium transition text-xs shadow-lg shadow-cyan-950/40"
            >
              🔮 What-If Price Simulator
            </button>
            <button
              onClick={fetchOptimizationData}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition text-xs"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      )}

      {/* Recommendations Cards Grid */}
      {loading ? (
        <div className="py-8 text-center text-slate-400 text-sm animate-pulse">
          Evaluating catalog velocity and ranking strategic optimizations...
        </div>
      ) : recommendations.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-sm bg-slate-950/40 rounded-lg border border-slate-800">
          No urgent optimization actions required for goal: <strong className="text-slate-200">{goal}</strong>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.slice(0, 4).map((rec) => (
            <div
              key={rec.recommendationId}
              className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  {getImpactBadge(rec.impact)}
                  {getConfidenceBadge(rec.confidence)}
                </div>
                <h4 className="text-sm font-bold text-white leading-snug">{rec.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{rec.summary}</p>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  {rec.category} • {rec.risk} RISK
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRunSimulation('DISCOUNT_CLEARANCE')}
                    className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 transition font-medium"
                  >
                    Simulate
                  </button>
                  {rec.actionId && (
                    <button
                      onClick={() => onSelectAction?.(rec.actionId!)}
                      className="px-2.5 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white transition font-medium shadow-sm"
                    >
                      Review Action →
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* What-If Simulation Modal */}
      {simulationModalOpen && simulationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-950/80 text-amber-300 border border-amber-800">
                  {simulationResult.simulatedLabel}
                </span>
                <h3 className="text-base font-bold text-white mt-1">What-If Commercial Simulation</h3>
              </div>
              <button
                onClick={() => setSimulationModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block">Current Benchmark</span>
                  <p className="font-bold text-white text-sm mt-0.5">₹{simulationResult.currentState.price}</p>
                  <p className="text-slate-400 text-[11px]">{simulationResult.currentState.dailyVelocity} units/day</p>
                </div>
                <div>
                  <span className="text-cyan-400 font-semibold block">Projected Trajectory</span>
                  <p className="font-bold text-cyan-300 text-sm mt-0.5">₹{simulationResult.projectedState.projectedPrice}</p>
                  <p className="text-slate-400 text-[11px]">
                    {simulationResult.projectedState.projectedDailyVelocity} units/day (
                    {simulationResult.projectedState.revenueDeltaPct >= 0 ? '+' : ''}
                    {simulationResult.projectedState.revenueDeltaPct}% rev)
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-semibold text-slate-300">Projected Revenue Range:</span>
                <p className="text-white font-mono text-xs">
                  ₹{simulationResult.projectedState.projectedMonthlyRevenueMin.toLocaleString('en-IN')} – ₹
                  {simulationResult.projectedState.projectedMonthlyRevenueMax.toLocaleString('en-IN')} / mo
                </p>
              </div>

              <div className="p-3 bg-rose-950/30 border border-rose-900/40 rounded-lg">
                <span className="font-semibold text-rose-300">⚠️ Risk Assessment:</span>
                <p className="text-rose-200 mt-0.5">{simulationResult.riskAssessment}</p>
              </div>

              <div className="p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-lg">
                <span className="font-semibold text-indigo-300">💡 AI Recommendation:</span>
                <p className="text-indigo-200 mt-0.5">{simulationResult.recommendationText}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSimulationModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
