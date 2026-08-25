'use client';

import React, { useState } from 'react';

export interface TimeSeriesPoint {
  date: string;
  revenue: number;
  orders: number;
  units: number;
  aov?: number;
}

interface SalesTrendChartProps {
  data: TimeSeriesPoint[];
  periodLabel?: string;
  interval?: 'daily' | 'weekly' | 'monthly';
  onIntervalChange?: (interval: 'daily' | 'weekly' | 'monthly') => void;
  onAiAction?: (prompt: string) => void;
}

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({
  data = [],
  periodLabel = 'Last 30 Days',
  interval = 'daily',
  onIntervalChange,
  onAiAction
}) => {
  const [activeMetric, setActiveMetric] = useState<'revenue' | 'orders' | 'units' | 'aov'>('revenue');
  const [hoveredPoint, setHoveredPoint] = useState<{ point: TimeSeriesPoint; x: number; y: number } | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-500">No time-series data available for the selected period.</p>
      </div>
    );
  }

  // Calculate values based on active metric
  const pointsWithAov = data.map(d => ({
    ...d,
    aov: d.orders > 0 ? Math.round(d.revenue / d.orders) : 0
  }));

  const values = pointsWithAov.map(d => {
    switch (activeMetric) {
      case 'revenue': return d.revenue;
      case 'orders': return d.orders;
      case 'units': return d.units;
      case 'aov': return d.aov;
    }
  });

  const maxValue = Math.max(...values, 1);
  const minValue = 0;
  const totalMetricSum = values.reduce((sum, v) => sum + v, 0);

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 260;
  const paddingX = 45;
  const paddingY = 30;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingY * 2;

  // Build SVG Path
  const coordinates = pointsWithAov.map((d, i) => {
    const x = paddingX + (i / Math.max(pointsWithAov.length - 1, 1)) * chartWidth;
    const val = activeMetric === 'revenue' ? d.revenue : activeMetric === 'orders' ? d.orders : activeMetric === 'units' ? d.units : d.aov;
    const y = paddingY + chartHeight - ((val - minValue) / (maxValue - minValue)) * chartHeight;
    return { x, y, point: d };
  });

  const pathD = coordinates.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  const areaD = coordinates.length > 0
    ? `${pathD} L ${coordinates[coordinates.length - 1].x} ${paddingY + chartHeight} L ${coordinates[0].x} ${paddingY + chartHeight} Z`
    : '';

  const formatMetric = (num: number) => {
    if (activeMetric === 'revenue' || activeMetric === 'aov') {
      return `₹${num.toLocaleString('en-IN')}`;
    }
    return num.toLocaleString('en-IN');
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex flex-col justify-between">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Sales Performance</h3>
            <span className="text-xs text-slate-400 font-medium">• {periodLabel}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {activeMetric.toUpperCase()}: <span className="font-bold text-slate-900">{formatMetric(totalMetricSum)}</span>
          </p>
        </div>

        {/* Metric Selector Pills & Interval Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metrics */}
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200">
            {(['revenue', 'orders', 'units', 'aov'] as const).map(m => (
              <button
                key={m}
                onClick={() => setActiveMetric(m)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-all ${
                  activeMetric === m
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Interval */}
          {onIntervalChange && (
            <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200">
              {(['daily', 'weekly', 'monthly'] as const).map(int => (
                <button
                  key={int}
                  onClick={() => onIntervalChange(int)}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold capitalize transition-all ${
                    interval === int
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {int.slice(0, 1).toUpperCase() + int.slice(1, 3)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div className="relative mt-4 w-full h-[260px] select-none">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = paddingY + chartHeight * (1 - ratio);
            const val = Math.round(minValue + (maxValue - minValue) * ratio);
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={svgWidth - paddingX}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94a3b8"
                  fontWeight="500"
                >
                  {activeMetric === 'revenue' || activeMetric === 'aov' ? `₹${(val / 1000).toFixed(0)}k` : val}
                </text>
              </g>
            );
          })}

          {/* Fill Area */}
          <path d={areaD} fill="url(#metricGradient)" />

          {/* Trend Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#059669"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Points */}
          {coordinates.map((coord, idx) => (
            <circle
              key={idx}
              cx={coord.x}
              cy={coord.y}
              r={hoveredPoint?.point.date === coord.point.date ? "6" : "3.5"}
              fill={hoveredPoint?.point.date === coord.point.date ? "#059669" : "#ffffff"}
              stroke="#059669"
              strokeWidth="2"
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() => setHoveredPoint(coord)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-xl -translate-x-1/2 -translate-y-12"
            style={{
              left: `${(hoveredPoint.x / svgWidth) * 100}%`,
              top: `${(hoveredPoint.y / svgHeight) * 100}%`
            }}
          >
            <p className="text-[10px] text-slate-400 font-medium">{hoveredPoint.point.date}</p>
            <p className="font-bold text-white text-xs mt-0.5">
              {activeMetric.toUpperCase()}: {formatMetric(
                activeMetric === 'revenue'
                  ? hoveredPoint.point.revenue
                  : activeMetric === 'orders'
                  ? hoveredPoint.point.orders
                  : activeMetric === 'units'
                  ? hoveredPoint.point.units
                  : (hoveredPoint.point.aov || 0)
              )}
            </p>
          </div>
        )}
      </div>

      {/* Footer AI Context Trigger */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[11px]">
          Hover over data points to inspect daily transaction telemetry
        </span>

        {onAiAction && (
          <button
            onClick={() => onAiAction(`Why did sales change during ${periodLabel}?`)}
            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 group"
          >
            <span>Why did sales change?</span>
            <i className="fas fa-arrow-right text-[9px] group-hover:translate-x-0.5 transition-transform"></i>
          </button>
        )}
      </div>
    </div>
  );
};
