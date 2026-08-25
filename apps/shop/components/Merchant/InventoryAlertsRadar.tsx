'use client';

import React, { useState } from 'react';

export interface LowStockItem {
  productId: number;
  title: string;
  categoryName: string;
  currentStock: number;
  threshold: number;
  dailyVelocity7d: number;
  estimatedDaysRemaining: number;
  restockRecommendedUnits: number;
  urgency: 'CRITICAL' | 'WARNING' | 'HEALTHY';
}

interface InventoryAlertsRadarProps {
  items: LowStockItem[];
  onAiAction?: (prompt: string) => void;
}

export const InventoryAlertsRadar: React.FC<InventoryAlertsRadarProps> = ({
  items = [],
  onAiAction
}) => {
  const [filterUrgency, setFilterUrgency] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');

  const criticalCount = items.filter(i => i.urgency === 'CRITICAL').length;
  const warningCount = items.filter(i => i.urgency === 'WARNING').length;
  const healthyCount = items.filter(i => i.urgency === 'HEALTHY').length;

  const filteredItems = items.filter(i => {
    if (filterUrgency === 'ALL') return true;
    return i.urgency === filterUrgency;
  });

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex flex-col justify-between">
      <div>
        {/* Header & Status Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Inventory Health & Restock Radar</h3>
              <span className="text-xs text-slate-400 font-medium">• Live Stockout Risk</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated replenishment targets calculated from 7-day velocity
            </p>
          </div>

          {/* Health Summary Badges */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterUrgency('CRITICAL')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filterUrgency === 'CRITICAL'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
              <span>{criticalCount} Critical</span>
            </button>

            <button
              onClick={() => setFilterUrgency('WARNING')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filterUrgency === 'WARNING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
              <span>{warningCount} Low Stock</span>
            </button>

            <button
              onClick={() => setFilterUrgency('ALL')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filterUrgency === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>View All ({items.length})</span>
            </button>
          </div>
        </div>

        {/* Restock Recommendations Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-3">Product</th>
                <th className="pb-3">Current Stock</th>
                <th className="pb-3">Velocity (7d)</th>
                <th className="pb-3">Est. Days Remaining</th>
                <th className="pb-3">Urgency</th>
                <th className="pb-3">Recommended Reorder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.slice(0, 8).map((item) => (
                <tr key={item.productId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 pr-3">
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="text-[11px] text-slate-400">{item.categoryName}</div>
                  </td>
                  <td className="py-3 font-bold text-slate-900">
                    {item.currentStock} units
                  </td>
                  <td className="py-3 font-semibold text-emerald-700">
                    {item.dailyVelocity7d}/day
                  </td>
                  <td className="py-3 font-semibold">
                    <span className={item.urgency === 'CRITICAL' ? 'text-rose-600' : item.urgency === 'WARNING' ? 'text-amber-700' : 'text-slate-700'}>
                      ~{item.estimatedDaysRemaining} days
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.urgency === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : item.urgency === 'WARNING'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {item.urgency}
                    </span>
                  </td>
                  <td className="py-3 font-bold text-emerald-800">
                    +{item.restockRecommendedUnits} units
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer AI Context Trigger */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[11px]">
          Target buffer: 45 days of safety stock
        </span>

        {onAiAction && (
          <button
            onClick={() => onAiAction('What should I restock first and why?')}
            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 group"
          >
            <span>Ask AI which products to restock first</span>
            <i className="fas fa-arrow-right text-[9px] group-hover:translate-x-0.5 transition-transform"></i>
          </button>
        )}
      </div>
    </div>
  );
};
