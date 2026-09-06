/**
 * Finance valuation panels reveal. Query > localStorage > env > default OFF.
 * Read failures are fail-closed; the owner-facing surface stays unchanged.
 */
const LS_KEY = 'ff.finance_value_panels';
const QUERY_KEY = 'ff_financeValuePanels';
const ENV_KEY = 'VITE_FINANCE_VALUE_PANELS';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim().toLowerCase();
  if (value === '1' || value === 'true' || value === 'on') return true;
  if (value === '0' || value === 'false' || value === 'off') return false;
  return null;
}

export function isFinanceValuePanelsEnabled(): boolean {
  try {
    const query =
      typeof window === 'undefined'
        ? null
        : parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
    const local =
      query === null && typeof window !== 'undefined'
        ? parseFlag(window.localStorage.getItem(LS_KEY))
        : null;
    return (
      query ??
      local ??
      parseFlag(
        (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
      ) ??
      false
    );
  } catch {
    return false;
  }
}

export const FINANCE_VALUE_PANELS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
