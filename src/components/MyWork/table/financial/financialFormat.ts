/** Formatting helpers shared by the Financial Case driver table / summary / charts. */

export function formatMoney(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency || 'PLN',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // Unknown/invalid ISO currency code — never silently rescale, show raw with the code.
    return `${value.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} ${currency}`;
  }
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatMonths(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} mo`;
}

export function formatPeriodLabel(period: string): string {
  const [y, m] = period.split('-');
  const idx = Number(m) - 1;
  const names = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  if (idx < 0 || idx > 11) return period;
  return `${names[idx]} ${y}`;
}
