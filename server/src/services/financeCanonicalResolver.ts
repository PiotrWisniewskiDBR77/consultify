const CANONICAL_CODE_ALIAS_GROUPS: Record<string, string[]> = {
  REVENUE: ['SALES', 'SALES_REVENUE'],
  GROSS_PROFIT: ['GROSS_MARGIN'],
  TAX_EXPENSE: ['TAX'],
  TOTAL_EQUITY: ['EQUITY', 'EQUITY_CAPITAL'],
  PROPERTY_PLANT_EQUIPMENT: ['PPE_GROSS', 'PPE_NET'],
  CAPEX: ['CAPEX_CF', 'CFI'],
  OPERATING_CF: ['OPERATING_CASH_FLOW', 'NET_CASH_FROM_OPERATIONS'],
  INVESTING_CF: ['INVESTING_CASH_FLOW'],
  FINANCING_CF: ['FINANCING_CASH_FLOW'],
  CHANGE_WORKING_CAPITAL: ['WC_CHANGES'],
  DEBT_DRAWDOWN: ['DEBT_DRAWDOWN_CF'],
  DEBT_REPAYMENT: ['DEBT_REPAYMENT_CF'],
  DIVIDENDS_PAID: ['DIVIDEND_CF'],
  NET_INCOME: ['NET_INCOME_CF'],
  DEPRECIATION: ['DEPRECIATION_ADDBACK'],
  OTHER_INVESTING_CF: ['OTHER_INVESTING', 'OTHER_INVESTING_CASH_FLOW'],
  SHARE_CAPITAL: ['EQUITY_INJECTION', 'EQUITY_CF'],
};

const ALIAS_TO_CANONICAL = new Map<string, string>();

for (const [canonical, aliases] of Object.entries(CANONICAL_CODE_ALIAS_GROUPS)) {
  ALIAS_TO_CANONICAL.set(canonical, canonical);
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL.set(alias, canonical);
  }
}

function normalizeCode(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toUpperCase();
}

export function normalizeCanonicalLineCode(code: string | null | undefined): string {
  const normalized = normalizeCode(code);
  if (!normalized) return '';
  return ALIAS_TO_CANONICAL.get(normalized) || normalized;
}

export function getCanonicalCodeAliases(code: string | null | undefined): string[] {
  const canonical = normalizeCanonicalLineCode(code);
  if (!canonical) return [];
  return [canonical, ...(CANONICAL_CODE_ALIAS_GROUPS[canonical] || [])];
}

export function withCanonicalAliases(values: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [code, value] of Object.entries(values || {})) {
    const canonical = normalizeCanonicalLineCode(code);
    if (!canonical) continue;
    next[canonical] = value;
    for (const alias of getCanonicalCodeAliases(canonical)) {
      next[alias] = value;
    }
  }
  return next;
}

export function accumulateCanonicalValue(target: Map<string, number>, code: string | null | undefined, value: number): void {
  const canonical = normalizeCanonicalLineCode(code);
  if (!canonical) return;
  target.set(canonical, Number(target.get(canonical) || 0) + Number(value || 0));
}
