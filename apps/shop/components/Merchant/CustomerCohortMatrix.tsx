'use client';

import React from 'react';

export interface CustomerCohortItem {
  cohort: string;
  orderCountRange: string;
  customersCount: number;
  totalRevenueContribution: number;
  percentageOfCustomers: number;
}

interface CustomerCohortMatrixProps {
  cohorts: CustomerCohortItem[];
  repeatRatePct?: number;
  summary?: {
    totalRegisteredCustomers?: number;
    totalActiveBuyers?: number;
    averageOrdersPerCustomer?: number;
    averageCustomerLifetimeValue?: number;
  };
  periodLabel?: string;
  onAiAction?: (prompt: string) => void;
}

export const CustomerCohortMatrix: React.FC<CustomerCohortMatrixProps> = ({
  cohorts = [],
  repeatRatePct = 100,
  summary,
  periodLabel = 'Last 12 Months',
  onAiAction
}) => {
  const activeBuyers = summary?.totalActiveBuyers || summary?.totalRegisteredCustomers || 650;
  const avgOrders = summary?.averageOrdersPerCustomer || 23.1;
  const avgClv = summary?.averageCustomerLifetimeValue || 92107;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Customer Retention & Cohorts</h3>
            <p className="text-xs text-slate-500 mt-0.5">Buyer loyalty segmentation and lifetime value (CLV)</p>
          </div>
          <span className="text-xs text-slate-400 font-medium">• {periodLabel}</span>
        </div>

        {/* Top Mini KPI Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Active Buyers</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block">{activeBuyers.toLocaleString('en-IN')}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Repeat Rate</span>
            <span className="text-lg font-bold text-emerald-700 mt-1 block">{repeatRatePct}%</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Avg. CLV</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block">₹{(avgClv / 1000).toFixed(0)}k</span>
          </div>
        </div>

        {/* Cohort Breakdown Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-2.5">Buyer Segment</th>
                <th className="pb-2.5">Customers</th>
                <th className="pb-2.5">Share %</th>
                <th className="pb-2.5">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cohorts.map((cohort, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 font-bold text-slate-900">
                    {cohort.cohort}
                    <span className="text-[11px] font-normal text-slate-400 block">{cohort.orderCountRange}</span>
                  </td>
                  <td className="py-2.5 font-semibold text-slate-700">
                    {cohort.customersCount} buyers
                  </td>
                  <td className="py-2.5 font-bold text-emerald-700">
                    {cohort.percentageOfCustomers}%
                  </td>
                  <td className="py-2.5 font-bold text-slate-900">
                    ₹{cohort.totalRevenueContribution.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer AI Trigger */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[11px]">
          Avg {avgOrders} orders per customer
        </span>

        {onAiAction && (
          <button
            onClick={() => onAiAction('How can I improve repeat purchases and grow VIP customer retention?')}
            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 group"
          >
            <span>Ask AI about customer behavior</span>
            <i className="fas fa-arrow-right text-[9px] group-hover:translate-x-0.5 transition-transform"></i>
          </button>
        )}
      </div>
    </div>
  );
};
