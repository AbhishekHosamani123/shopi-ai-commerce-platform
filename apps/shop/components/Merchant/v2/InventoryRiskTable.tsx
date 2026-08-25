'use client';

import React from 'react';
import { TrustBadge } from './TrustBadge';

export interface InventoryRiskItem {
  id?: string;
  name: string;
  sku?: string;
  stock: number;
  daysRemaining: number;
  riskLevel: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  recommendation: string;
}

interface InventoryRiskTableProps {
  items?: InventoryRiskItem[];
  onOpenCopilot?: () => void;
  loading?: boolean;
}

export function InventoryRiskTable({
  items = [],
  onOpenCopilot,
  loading = false,
}: InventoryRiskTableProps) {
  const displayItems: InventoryRiskItem[] = items.length > 0 ? items : [
    { name: 'Aero Glide Running Shoes', sku: 'SKU-SHOE-101', stock: 15, daysRemaining: 4.8, riskLevel: 'CRITICAL', recommendation: 'Restock +50 units' },
    { name: 'Baby Fabric Soft Shoes', sku: 'SKU-BABY-301', stock: 12, daysRemaining: 8.5, riskLevel: 'WARNING', recommendation: 'Monitor velocity' },
    { name: 'Running Breathable Socks', sku: 'SKU-SCK-104', stock: 8, daysRemaining: 3.2, riskLevel: 'CRITICAL', recommendation: 'Restock +100 units' },
    { name: 'Winter Thermal Beanie', sku: 'SKU-ACC-092', stock: 110, daysRemaining: 74.0, riskLevel: 'HEALTHY', recommendation: 'Dead stock markdown' },
  ];

  return (
    <div className="bg-surface-1 p-4.5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors text-ink">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-hairline">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
            Inventory Risk & Stockouts
          </h3>
          <TrustBadge tag="[FORECAST]" formula="stock / daily_velocity" />
        </div>
        {onOpenCopilot && (
          <button
            onClick={onOpenCopilot}
            className="text-xs text-ink-subtle hover:text-ink font-medium transition-colors"
          >
            Manage inventory →
          </button>
        )}
      </div>

      {/* Dense Table */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-hairline text-[11px] font-medium text-ink-subtle bg-surface-2/60">
              <th className="py-2.5 px-3">Product</th>
              <th className="py-2.5 px-2.5 text-right">Current Stock</th>
              <th className="py-2.5 px-2.5 text-right">Coverage</th>
              <th className="py-2.5 px-2.5 text-center">Status</th>
              <th className="py-2.5 pl-2.5 pr-3 text-right">Recommendation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-ink-muted">
            {displayItems.map((item, idx) => (
              <tr key={idx} className="hover:bg-surface-2/60 transition-colors font-body">
                <td className="py-2.5 px-3 font-medium text-ink truncate max-w-[160px]">
                  <div>{item.name}</div>
                  <div className="text-[10px] font-mono text-ink-subtle">{item.sku || `SKU-INV-${100 + idx}`}</div>
                </td>
                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-ink">
                  {item.stock}
                </td>
                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-ink">
                  {item.daysRemaining.toFixed(1)}d
                </td>
                <td className="py-2.5 px-2.5 text-center">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-semibold ${
                      item.riskLevel === 'CRITICAL'
                        ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                        : item.riskLevel === 'WARNING'
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        : 'bg-surface-2 text-ink-subtle border border-hairline'
                    }`}
                  >
                    {item.riskLevel}
                  </span>
                </td>
                <td className="py-2.5 pl-2.5 pr-3 text-right text-ink-muted font-medium truncate max-w-[140px]">
                  {item.recommendation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
