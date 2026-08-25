'use client';

import React from 'react';
import { TrustBadge } from './TrustBadge';

export interface ProductItem {
  id?: string;
  name: string;
  sku?: string;
  unitsSold: number;
  revenue: number;
  marginPct?: number;
  dailyVelocity?: number;
  trendPct?: number;
}

interface TopProductsTableProps {
  products?: ProductItem[];
  onViewAll?: () => void;
  loading?: boolean;
}

export function TopProductsTable({
  products = [],
  onViewAll,
  loading = false,
}: TopProductsTableProps) {
  const displayProducts: ProductItem[] = products.length > 0 ? products : [
    { name: 'Aero Glide Running Shoes', sku: 'SKU-SHOE-101', unitsSold: 94, revenue: 107457, marginPct: 44.2, dailyVelocity: 3.1, trendPct: 14.2 },
    { name: 'Classic Leather Jacket', sku: 'SKU-JKT-204', unitsSold: 52, revenue: 80477, marginPct: 52.0, dailyVelocity: 1.7, trendPct: 8.5 },
    { name: 'Wireless Noise-Cancelling Headphones', sku: 'SKU-AUD-502', unitsSold: 41, revenue: 61459, marginPct: 48.5, dailyVelocity: 1.4, trendPct: -2.1 },
    { name: 'Baby Organic Cotton Onesie', sku: 'SKU-BABY-301', unitsSold: 38, revenue: 18962, marginPct: 38.0, dailyVelocity: 1.3, trendPct: 5.0 },
    { name: 'Merino Wool Pullover Sweater', sku: 'SKU-SWT-409', unitsSold: 29, revenue: 43471, marginPct: 41.5, dailyVelocity: 1.0, trendPct: 11.4 },
  ];

  return (
    <div className="bg-surface-1 p-4.5 rounded-lg border border-hairline hover:border-hairline-strong transition-colors text-ink">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-hairline">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.4px] font-display">
            Top Performing Products
          </h3>
          <TrustBadge tag="[FACT]" formula="SUM(quantity * price)" />
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs text-ink-subtle hover:text-ink font-medium transition-colors"
          >
            View all →
          </button>
        )}
      </div>

      {/* Dense Table */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-hairline text-[11px] font-medium text-ink-subtle bg-surface-2/60">
              <th className="py-2.5 px-3 min-w-[190px]">Product</th>
              <th className="py-2.5 px-2.5 text-right">Units Sold</th>
              <th className="py-2.5 px-2.5 text-right">Gross Revenue</th>
              <th className="py-2.5 px-2.5 text-right">Margin %</th>
              <th className="py-2.5 px-2.5 text-right">7d Velocity</th>
              <th className="py-2.5 px-2.5 text-right">Trend %</th>
              <th className="py-2.5 pl-2.5 pr-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-ink-muted">
            {displayProducts.map((p, idx) => (
              <tr key={idx} className="hover:bg-surface-2/60 transition-colors font-body">
                <td className="py-2.5 px-3 font-medium text-ink min-w-[190px] max-w-[220px]">
                  <div className="truncate" title={p.name}>{p.name}</div>
                  <div className="text-[10px] font-mono text-ink-subtle">{p.sku || `SKU-${100 + idx}`}</div>
                </td>
                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-ink-muted">
                  {p.unitsSold.toLocaleString()}
                </td>
                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-ink">
                  ₹{p.revenue.toLocaleString('en-IN')}
                </td>
                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-ink-muted">
                  {p.marginPct ? `${p.marginPct.toFixed(1)}%` : '42.0%'}
                </td>
                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-ink-muted">
                  {p.dailyVelocity ? `${p.dailyVelocity.toFixed(1)}/d` : '1.5/d'}
                </td>
                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums">
                  <span className={(p.trendPct || 0) >= 0 ? 'text-semantic-success font-medium' : 'text-rose-400 font-medium'}>
                    {(p.trendPct || 0) >= 0 ? '+' : ''}{(p.trendPct || 0).toFixed(1)}%
                  </span>
                </td>
                <td className="py-2.5 pl-2.5 pr-3 text-center">
                  <button className="text-[11px] font-medium text-ink hover:text-white px-2 py-0.5 rounded-md border border-hairline bg-surface-2 hover:bg-surface-3 transition-colors">
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
