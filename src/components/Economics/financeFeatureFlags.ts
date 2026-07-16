/**
 * M16 — Finance cockpit feature flags (default OFF, live-safe).
 *
 * The new value-office / FP&A surfaces ship behind flags so they land in code
 * without changing the live FinanceHub until a deliberate flip + pixel-verify.
 * Resolution order (first wins): URL query → localStorage → Vite env → false.
 */
type FlagKeys = { query: string; localStorage: string; env: string };

const FLAGS = {
  valueOffice: {
    query: 'ff_valueOffice',
    localStorage: 'ff.fin_value_office',
    env: 'VITE_FIN_VALUE_OFFICE_ENABLED',
  },
  investmentAppraisal: {
    query: 'ff_investAppraisal',
    localStorage: 'ff.fin_invest_appraisal',
    env: 'VITE_FIN_INVEST_APPRAISAL_ENABLED',
  },
  valuationVisuals: {
    query: 'ff_valuationVisuals',
    localStorage: 'ff.fin_valuation_visuals',
    env: 'VITE_FIN_VALUATION_VISUALS_ENABLED',
  },
  varianceBridge: {
    query: 'ff_varianceBridge',
    localStorage: 'ff.fin_variance_bridge',
    env: 'VITE_FIN_VARIANCE_BRIDGE_ENABLED',
  },
  driverPlanner: {
    query: 'ff_driverPlanner',
    localStorage: 'ff.fin_driver_planner',
    env: 'VITE_FIN_DRIVER_PLANNER_ENABLED',
  },
  modelVersioning: {
    query: 'ff_modelVersioning',
    localStorage: 'ff.fin_model_versioning',
    env: 'VITE_FIN_MODEL_VERSIONING_ENABLED',
  },
  // M16 valuation/risk suite — Monte Carlo NPV, real options, what-if sensitivity.
  m16ValuationSuite: {
    query: 'ff_m16ValuationSuite',
    localStorage: 'ff.fin_m16_valuation_suite',
    env: 'VITE_FIN_M16_VALUATION_SUITE_ENABLED',
  },
  // M16 planning suite — cash forecast + variance narration.
  m16PlanningSuite: {
    query: 'ff_m16PlanningSuite',
    localStorage: 'ff.fin_m16_planning_suite',
    env: 'VITE_FIN_M16_PLANNING_SUITE_ENABLED',
  },
} as const satisfies Record<string, FlagKeys>;

export type FinanceFlag = keyof typeof FLAGS;

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return null;
}

function readQuery(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(key));
  } catch {
    return null;
  }
}

function readLocalStorage(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function readEnv(key: string): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    return parseFlag(env?.[key]) === true;
  } catch {
    return false;
  }
}

/** True when the given finance cockpit feature is enabled (default OFF). */
export function isFinanceFlagEnabled(flag: FinanceFlag): boolean {
  const keys = FLAGS[flag];
  const fromQuery = readQuery(keys.query);
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage(keys.localStorage);
  if (fromLs !== null) return fromLs;
  return readEnv(keys.env);
}

export const FINANCE_FLAG_KEYS = FLAGS;
