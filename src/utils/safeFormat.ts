export const EMPTY_VALUE = '—';

export function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function safePercent(
  numerator: unknown,
  denominator?: unknown,
  options: { fallback?: string; decimals?: number } = {}
): string {
  const decimals = options.decimals ?? 0;
  if (denominator === undefined) {
    const value = safeNumber(numerator, Number.NaN);
    return Number.isFinite(value) ? `${value.toFixed(decimals)}%` : options.fallback || EMPTY_VALUE;
  }

  const num = safeNumber(numerator, Number.NaN);
  const den = safeNumber(denominator, Number.NaN);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) {
    return options.fallback || EMPTY_VALUE;
  }
  return `${((num / den) * 100).toFixed(decimals)}%`;
}

/**
 * Formats an initiative ROI value for display.
 *
 * `initiatives.expected_roi` is a TEXT column (migration 903): the AI writes
 * QUALITATIVE strings ("ROI 200%", "44% (zysk netto ÷ nakład), payback 14 mies",
 * "rentowność Q3 2027") — never a bare number. Calling `.toFixed()` on that
 * string threw `TypeError` and crashed the whole page (Z64). This helper:
 *   - number            → `${n.toFixed(1)}x` (preserves the old visual for real numbers)
 *   - pure numeric text  → same `${n.toFixed(1)}x`
 *   - qualitative text   → shown verbatim
 *   - null/undefined/''  → fallback
 */
export function formatRoiDisplay(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `${value.toFixed(1)}x` : fallback;
  }
  const str = String(value).trim();
  if (!str) return fallback;
  if (/^-?\d*\.?\d+$/.test(str)) {
    const num = Number(str);
    if (Number.isFinite(num)) return `${num.toFixed(1)}x`;
  }
  return str;
}

export function safeDate(value: unknown, fallback = EMPTY_VALUE): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString();
}

export function safeMoney(
  value: unknown,
  currency = 'USD',
  options: { fallback?: string; locale?: string } = {}
): string {
  const amount = safeNumber(value, Number.NaN);
  if (!Number.isFinite(amount)) return options.fallback || EMPTY_VALUE;
  try {
    return new Intl.NumberFormat(options.locale || undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
