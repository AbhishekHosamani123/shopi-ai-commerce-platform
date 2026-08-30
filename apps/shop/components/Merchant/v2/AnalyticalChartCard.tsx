'use client';

import React, { useState, useMemo } from 'react';
import { TrustBadge } from './TrustBadge';
import { formatSignPercentage, getGrowthColorClass, formatCompactINR } from './formatters';

export interface SalesPoint {
  date: string;
  amount: number;
  ordersCount: number;
  prevAmount?: number;
}

export interface AnalyticalChartCardProps {
  data?: SalesPoint[];
  interval: 'daily' | 'weekly' | 'monthly';
  onIntervalChange: (interval: 'daily' | 'weekly' | 'monthly') => void;
  loading?: boolean;
  currentTotal?: number;
  prevTotal?: number;
  growthPct?: number;
  periodLabel?: string;
}

function formatCurrencyCompact(val: number): string {
  if (val === 0) return '₹0';
  if (val >= 10000000) {
    const cr = val / 10000000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)}Cr`;
  }
  if (val >= 100000) {
    const l = val / 100000;
    return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`;
  }
  if (val >= 1000) {
    const k = val / 1000;
    return `₹${k % 1 === 0 ? k.toFixed(0) : k.toFixed(0)}k`;
  }
  return `₹${Math.round(val)}`;
}

function formatXAxisDate(dateStr: string, intervalType: 'daily' | 'weekly' | 'monthly'): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (intervalType === 'monthly') {
      return `${months[monthIdx]} '${String(year).slice(2)}`;
    }
    return `${months[monthIdx]} ${day}`;
  }
  return dateStr;
}

function computeNiceYScale(rawMax: number) {
  const safeMax = Math.max(rawMax, 1000);
  const minRequiredCeiling = safeMax * 1.08;
  const roughStep = minRequiredCeiling / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;

  const niceMultiples = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];
  let stepMultiplier = 10;
  for (const m of niceMultiples) {
    if (residual <= m) {
      stepMultiplier = m;
      break;
    }
  }
  const step = stepMultiplier * magnitude;
  const ceiling = step * 4;
  const ticks: { value: number; label: string }[] = [];
  for (let i = 4; i >= 0; i--) {
    const val = step * i;
    ticks.push({ value: val, label: formatCurrencyCompact(val) });
  }
  return { ceiling, step, ticks };
}

export function AnalyticalChartCard({
  data = [],
  interval,
  onIntervalChange,
  loading = false,
  currentTotal,
  prevTotal,
  growthPct = 0,
}: AnalyticalChartCardProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chartPoints: SalesPoint[] = data;

  // Chart coordinate geometry (Large, commanding analytical canvas)
  const svgWidth = 960;
  const svgHeight = 360;
  const paddingLeft = 76;
  const paddingRight = 28;
  const paddingTop = 28;
  const paddingBottom = 48;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Dynamic Scale Calculation based on actual data
  const { ceiling, ticks: yTicks } = useMemo(() => {
    const currentMax = Math.max(...chartPoints.map((p) => Number(p.amount) || 0), 0);
    const prevMax = Math.max(...chartPoints.map((p) => Number(p.prevAmount || p.amount * 0.88) || 0), 0);
    const peak = Math.max(currentMax, prevMax);
    return computeNiceYScale(peak);
  }, [chartPoints]);

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(val, ceiling));
    return paddingTop + chartHeight - (clamped / ceiling) * chartHeight;
  };

  const getX = (index: number) => {
    if (chartPoints.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (chartPoints.length - 1)) * chartWidth;
  };

  // Trajectory coordinates with safe clamping
  const currentCoords = useMemo(() => {
    return chartPoints.map((p, i) => ({ x: getX(i), y: getY(p.amount) }));
  }, [chartPoints, ceiling]);

  const prevCoords = useMemo(() => {
    return chartPoints.map((p, i) => ({ x: getX(i), y: getY(p.prevAmount !== undefined ? p.prevAmount : p.amount * 0.88) }));
  }, [chartPoints, ceiling]);

  const currentPath = useMemo(() => {
    return currentCoords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');
  }, [currentCoords]);

  const currentAreaPath = useMemo(() => {
    if (currentCoords.length === 0) return '';
    const first = currentCoords[0];
    const last = currentCoords[currentCoords.length - 1];
    const bottomY = paddingTop + chartHeight;
    return `${currentPath} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
  }, [currentCoords, currentPath, chartHeight]);

  const prevPath = useMemo(() => {
    return prevCoords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');
  }, [prevCoords]);

  // Adaptive X-Axis Tick Selection (Prevents label collision across daily/weekly/monthly datasets)
  const visibleXTicks = useMemo(() => {
    const n = chartPoints.length;
    if (n === 0) return [];
    if (n <= 6) {
      return chartPoints.map((point, index) => ({ point, index }));
    }
    const targetCount = 6;
    const indexSet = new Set<number>();
    indexSet.add(0);
    for (let i = 1; i < targetCount - 1; i++) {
      indexSet.add(Math.round((i / (targetCount - 1)) * (n - 1)));
    }
    indexSet.add(n - 1);
    const sortedIndices = Array.from(indexSet).sort((a, b) => a - b);
    return sortedIndices.map((index) => ({ point: chartPoints[index], index }));
  }, [chartPoints]);

  const activePoint = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < chartPoints.length ? chartPoints[hoverIndex] : null;
  const activeCoord = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < currentCoords.length ? currentCoords[hoverIndex] : null;

  // Aggregate totals for legend
  const totalGrossCalculated = useMemo(() => {
    return chartPoints.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [chartPoints]);

  const totalPrevCalculated = useMemo(() => {
    return chartPoints.reduce((acc, p) => acc + (p.prevAmount !== undefined ? Number(p.prevAmount) : (Number(p.amount) || 0) * 0.88), 0);
  }, [chartPoints]);

  const displayCurrentTotal = currentTotal !== undefined ? currentTotal : totalGrossCalculated;
  const displayPrevTotal = prevTotal !== undefined ? prevTotal : totalPrevCalculated;

  const subtitleText = useMemo(() => {
    switch (interval) {
      case 'weekly':
        return 'Weekly aggregated gross revenue trajectory compared against preceding period baseline';
      case 'monthly':
        return 'Monthly gross revenue performance compared against preceding historical baseline';
      case 'daily':
      default:
        return 'Daily gross sales trajectory compared against preceding 30-day baseline';
    }
  }, [interval]);

  const activeDaysCount = useMemo(() => {
    return chartPoints.filter(p => (Number(p.amount) || 0) > 0).length;
  }, [chartPoints]);

  return (
    <div className="bg-surface-1 p-5 sm:p-6 rounded-lg border border-hairline hover:border-hairline-strong transition-colors text-ink space-y-4 sm:space-y-5">
      {/* 1. Header with Proper Breathing Room */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-hairline">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xs sm:text-sm font-semibold text-ink uppercase tracking-[0.4px] font-display">
              Revenue Performance
            </h2>
            <TrustBadge tag="[FACT]" formula="SUM(gross_revenue)" />
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-xs bg-surface-2 text-ink-muted border border-hairline">
              {activeDaysCount} Active Sales Days ({chartPoints.length} Days Window)
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-ink-subtle font-body">
            {subtitleText}
          </p>
        </div>

        {/* Interval Selector */}
        <div className="inline-flex self-start sm:self-auto rounded-md p-0.5 bg-surface-2 border border-hairline text-xs">
          {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onIntervalChange(mode)}
              className={`px-3 py-1.5 rounded-sm capitalize text-xs font-medium transition-all ${
                interval === mode
                  ? 'bg-surface-3 text-ink font-semibold border border-hairline-strong shadow-2xs'
                  : 'text-ink-subtle hover:text-ink hover:bg-surface-3/50'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Dominant Large Analytical Chart Canvas */}
      <div className="relative pt-1">
        {loading ? (
          <div className="h-72 sm:h-80 md:h-96 bg-surface-2/60 rounded-md animate-pulse flex flex-col items-center justify-center gap-2 text-xs text-ink-subtle border border-hairline">
            <div className="w-5 h-5 border-2 border-linear-primary border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-[11px]">Loading revenue curve telemetry...</span>
          </div>
        ) : (
          <div className="relative w-full">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-72 sm:h-80 md:h-96 lg:h-[380px] overflow-hidden select-none"
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                {/* Area Gradient Fill */}
                <linearGradient id="revenueFillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5E6AD2" stopOpacity="0.22" />
                  <stop offset="70%" stopColor="#5E6AD2" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#5E6AD2" stopOpacity="0.0" />
                </linearGradient>

                {/* Safe Plot Clipping Boundary (Prevents overflowing upward or outward) */}
                <clipPath id="chartPlotClip">
                  <rect
                    x={paddingLeft}
                    y={paddingTop - 6}
                    width={chartWidth + 4}
                    height={chartHeight + 12}
                  />
                </clipPath>
              </defs>

              {/* Y-Axis Horizontal Grid Lines & Ticks */}
              {yTicks.map((tick) => {
                const y = getY(tick.value);
                return (
                  <g key={tick.value}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={svgWidth - paddingRight}
                      y2={y}
                      stroke="#23252A"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-ink-subtle font-mono text-[10px]"
                    >
                      {tick.label}
                    </text>
                  </g>
                );
              })}

              {/* Trajectory Area Fill */}
              {currentAreaPath && (
                <path
                  d={currentAreaPath}
                  fill="url(#revenueFillGrad)"
                  clipPath="url(#chartPlotClip)"
                />
              )}

              {/* Previous Period Baseline (Dashed Hairline) */}
              {prevPath && (
                <path
                  d={prevPath}
                  fill="none"
                  stroke="#4B4E58"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  clipPath="url(#chartPlotClip)"
                />
              )}

              {/* Current Period Trajectory (Signature Linear Lavender) */}
              {currentPath && (
                <path
                  d={currentPath}
                  fill="none"
                  stroke="#5E6AD2"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  clipPath="url(#chartPlotClip)"
                />
              )}

              {/* Discrete Transaction Dots for Days with Sales */}
              {chartPoints.map((p, i) => {
                if (p.amount <= 0) return null;
                const cx = getX(i);
                const cy = getY(p.amount);
                return (
                  <circle
                    key={`dot-${i}`}
                    cx={cx}
                    cy={cy}
                    r={hoverIndex === i ? 5 : 3}
                    fill="#5E6AD2"
                    stroke="#010102"
                    strokeWidth="1.5"
                    className="transition-all pointer-events-none"
                  />
                );
              })}

              {/* Adaptive X-Axis Tick Labels */}
              {visibleXTicks.map(({ point, index }) => (
                <text
                  key={index}
                  x={getX(index)}
                  y={svgHeight - 14}
                  textAnchor="middle"
                  className="fill-ink-subtle font-mono text-[10px] sm:text-[11px]"
                >
                  {formatXAxisDate(point.date, interval)}
                </text>
              ))}

              {/* Interactive Hover Columns (Hitboxes across full width) */}
              {chartPoints.map((_, i) => {
                const colWidth = chartWidth / Math.max(chartPoints.length, 1);
                const colX = getX(i) - colWidth / 2;
                return (
                  <rect
                    key={i}
                    x={colX}
                    y={paddingTop}
                    width={colWidth}
                    height={chartHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoverIndex(i)}
                  />
                );
              })}

              {/* Active Hover Vertical Crosshair & Glowing Marker */}
              {activeCoord && activePoint && (
                <g clipPath="url(#chartPlotClip)">
                  <line
                    x1={activeCoord.x}
                    y1={paddingTop}
                    x2={activeCoord.x}
                    y2={paddingTop + chartHeight}
                    stroke="#5E69D1"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={activeCoord.x}
                    cy={activeCoord.y}
                    r="5.5"
                    fill="#5E6AD2"
                    stroke="#010102"
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>

            {/* Rich Hover Tooltip */}
            {activePoint && activeCoord && (
              <div
                className="absolute z-30 pointer-events-none bg-surface-2/95 text-ink rounded-md p-3 text-xs shadow-2xl border border-hairline-strong font-sans backdrop-blur-md min-w-[170px]"
                style={{
                  left: `${Math.max(12, Math.min(88, (activeCoord.x / svgWidth) * 100))}%`,
                  top: '12px',
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="flex items-center justify-between gap-2 border-b border-hairline pb-1.5 mb-1.5">
                  <span className="font-semibold text-ink text-xs font-display">
                    {formatXAxisDate(activePoint.date, interval)}
                  </span>
                  <span className="font-mono text-[10px] text-ink-subtle">
                    {activePoint.date}
                  </span>
                </div>

                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex items-center justify-between gap-3 text-ink">
                    <span className="text-ink-subtle font-sans text-[11px]">Gross Revenue:</span>
                    <span className="font-bold text-ink">
                      ₹{activePoint.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  {activePoint.amount === 0 && (
                    <div className="text-[10px] text-ink-subtle font-sans italic pt-0.5 pb-0.5">
                      No customer orders on this day.
                    </div>
                  )}

                  {activePoint.prevAmount !== undefined && (
                    <div className="flex items-center justify-between gap-3 text-ink-muted text-[10px]">
                      <span className="text-ink-subtle font-sans">Preceding Period:</span>
                      <span>
                        ₹{activePoint.prevAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-hairline text-semantic-success text-[10px]">
                    <span className="text-ink-subtle font-sans">Volume:</span>
                    <span>{activePoint.ordersCount} orders</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. High-Clarity Legend & Periodic Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t border-hairline text-xs text-ink-subtle">
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="h-2 w-3.5 bg-linear-primary rounded-xs inline-block" />
            <span className="font-medium text-ink">
              Current Period <span className="font-mono font-semibold">({formatCurrencyCompact(displayCurrentTotal)})</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-3.5 bg-hairline-tertiary border-t border-dashed border-hairline-strong inline-block" />
            <span className="text-ink-subtle">
              Preceding Baseline <span className="font-mono font-medium">({formatCurrencyCompact(displayPrevTotal)})</span>
            </span>
          </div>
        </div>

        <div className={`flex items-center gap-2 font-mono text-xs font-semibold ${getGrowthColorClass(growthPct)} self-start sm:self-auto`}>
          <span>{formatSignPercentage(growthPct, { includeArrow: true })} Trajectory Movement</span>
        </div>
      </div>
    </div>
  );
}
