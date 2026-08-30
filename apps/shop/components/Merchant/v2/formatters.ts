/**
 * Canonical Global Formatting Utilities for Merchant AI
 * Enforces mathematically sound sign formatting, currency display, and provenance tags.
 */

export interface FormatSignOptions {
  includeArrow?: boolean;
  precision?: number;
  suffix?: string;
  fallbackText?: string;
}

/**
 * Canonical sign percentage formatter.
 * Formats:
 * - Positive: "+14.2%" or "↑ +14.2%"
 * - Negative: "-13.3%" or "↓ -13.3%"
 * - Zero: "0.0%" or "→ 0.0%"
 * - NaN/Null: "NO COMPARABLE BASELINE" or custom fallback / "N/A"
 */
export function formatSignPercentage(
  value: number | null | undefined,
  options: FormatSignOptions = {}
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return options.fallbackText ?? 'NO COMPARABLE BASELINE';
  }

  const precision = options.precision ?? 1;
  const suffix = options.suffix ?? '%';
  const arrow = options.includeArrow ?? false;

  const num = Number(value);
  const formattedVal = Math.abs(num).toFixed(precision);

  if (num > 0.0001) {
    return arrow ? `↑ +${formattedVal}${suffix}` : `+${formattedVal}${suffix}`;
  } else if (num < -0.0001) {
    return arrow ? `↓ -${formattedVal}${suffix}` : `-${formattedVal}${suffix}`;
  } else {
    return arrow ? `→ 0.0${suffix}` : `0.0${suffix}`;
  }
}

/**
 * Returns canonical semantic Tailwind color class based on sign.
 */
export function getGrowthColorClass(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'text-ink-subtle';
  if (value > 0.0001) return 'text-semantic-success';
  if (value < -0.0001) return 'text-rose-400';
  return 'text-ink-subtle';
}

/**
 * Currency formatter with Indian Rupee formatting.
 */
export function formatCurrencyINR(
  val: number | null | undefined,
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
): string {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  return `₹${Number(val).toLocaleString('en-IN', {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  })}`;
}

/**
 * Compact Indian Rupee currency format (e.g. ₹35.3L, ₹1.2Cr, ₹140k).
 */
export function formatCompactINR(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val) || val === 0) return '₹0';
  const num = Number(val);
  if (Math.abs(num) >= 10000000) {
    const cr = num / 10000000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)}Cr`;
  }
  if (Math.abs(num) >= 100000) {
    const l = num / 100000;
    return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`;
  }
  if (Math.abs(num) >= 1000) {
    const k = num / 1000;
    return `₹${k % 1 === 0 ? k.toFixed(0) : k.toFixed(0)}k`;
  }
  return `₹${Math.round(num)}`;
}
