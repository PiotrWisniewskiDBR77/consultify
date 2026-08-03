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
  // M16 advanced suite (wire-c) — efficient frontier, scenario compute,
  // driver tree, rolling forecast, headcount planner. Independent of
  // m16ValuationSuite / m16PlanningSuite (fala 1) — does not touch those flags.
  m16AdvancedSuite: {
    query: 'ff_m16AdvancedSuite',
    localStorage: 'ff.fin_m16_advanced_suite',
    env: 'VITE_FIN_M16_ADVANCED_SUITE_ENABLED',
  },
  // M16 value suite (wire-d) — value ledger, attribution rollup, capture
  // pipeline (G0-G5), banking-the-value, extended ratios. Independent of
  // m16ValuationSuite / m16PlanningSuite / m16AdvancedSuite — does not touch
  // those flags.
  m16ValueSuite: {
    query: 'ff_m16ValueSuite',
    localStorage: 'ff.fin_m16_value_suite',
    env: 'VITE_FIN_M16_VALUE_SUITE_ENABLED',
  },
  // FIN-007 — post-investment actuals round trip (record a baseline-bound
  // actual + create/read the durable review receipt in ROIDetailDrawer).
  // Its OWN flag, not m16ValueSuite: that suite is already DEFAULT_ON, and
  // this feature has not been pixel-verified by Piotr yet — bundling it
  // under an already-on flag would ship it live by accident (CLAUDE.md §7).
  fin007PostInvestmentReview: {
    query: 'ff_fin007PostInvestmentReview',
    localStorage: 'ff.fin007_post_investment_review',
    env: 'VITE_FIN007_POST_INVESTMENT_REVIEW_ENABLED',
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

function readEnv(key: string): boolean | null {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    return parseFlag(env?.[key]);
  } catch {
    return null;
  }
}

/**
 * Suity M16 zweryfikowane wizualnie (dev-render harness, light+dark, 15 paneli —
 * 2026-07-16) → default ON. Valuation po naprawie crimson CTA/tabów/odznaki.
 * Query/localStorage/env nadal nadpisują (np. `?ff_m16ValueSuite=0`).
 */
const DEFAULT_ON: ReadonlySet<FinanceFlag> = new Set([
  'm16ValuationSuite',
  'm16PlanningSuite',
  'm16AdvancedSuite',
  'm16ValueSuite',
  // Zweryfikowane dev-render 2026-07-16 (light+dark, po naprawie dark-mode/i18n):
  'investmentAppraisal',
  'valuationVisuals',
  'modelVersioning',
  // Wired realnymi danymi org + pusty stan zamiast sample (zweryf. dev-render
  // populated+empty light+dark 2026-07-16); realny fetch inicjatyw / drzewo z modelu:
  'valueOffice',
  'driverPlanner',
]);

/** True when the given finance cockpit feature is enabled. */
export function isFinanceFlagEnabled(flag: FinanceFlag): boolean {
  const keys = FLAGS[flag];
  const fromQuery = readQuery(keys.query);
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage(keys.localStorage);
  if (fromLs !== null) return fromLs;
  const fromEnv = readEnv(keys.env);
  if (fromEnv !== null) return fromEnv;
  return DEFAULT_ON.has(flag);
}

export const FINANCE_FLAG_KEYS = FLAGS;
