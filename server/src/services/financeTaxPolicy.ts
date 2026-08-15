/** Canonical Finance tax policy. Rates are fractions: 0.19 means 19%. */
export function normalizeTaxRate(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return null;
  return parsed;
}

export function deriveEffectiveTaxRate(input: {
  revenue: unknown;
  cogs: unknown;
  opex: unknown;
  depreciation: unknown;
  interest: unknown;
  tax: unknown;
}): number | null {
  const n = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const ebt =
    n(input.revenue) - n(input.cogs) - n(input.opex) - n(input.depreciation) - n(input.interest);
  if (ebt <= 0) return null;
  return normalizeTaxRate(n(input.tax) / ebt);
}

export function taxExpenseFromEbt(ebt: number, taxRate: number | null): number {
  if (taxRate === null || !Number.isFinite(ebt) || ebt <= 0) return 0;
  return ebt * taxRate;
}
