/**
 * Chat V10 / V10-ONB-024 — feature flag for the activation KPI
 * dashboard (4 metrics × 6 personas, admin-only route
 * `/admin/onboarding-kpis`, green/amber/red colour thresholds).
 *
 * Runtime contract lives in
 * `src/models/onboarding/ActivationKpiDashboard.ts`. Default OFF —
 * Wave A seed pins the catalogues, target matrix, and five
 * invariants; Wave B wires the dashboard route and Postgres
 * materialized-view refresh.
 */

const LS_KEY = 'ff.onboard_activation_kpi_dashboard';
const QUERY_KEY = 'ff_onboard_activation_kpi_dashboard';
const ENV_KEY = 'VITE_ONBOARD_ACTIVATION_KPI_DASHBOARD';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const parsed = parseFlag(meta?.env?.[ENV_KEY]);
    return parsed === null ? false : parsed;
  } catch {
    return false;
  }
}

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorage(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}

export function isOnboardActivationKpiDashboardEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_ACTIVATION_KPI_DASHBOARD_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
