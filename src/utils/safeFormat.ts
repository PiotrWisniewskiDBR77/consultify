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
