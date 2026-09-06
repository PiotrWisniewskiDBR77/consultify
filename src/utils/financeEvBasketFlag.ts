/**
 * Finance EV Basket — feature flag for the Enterprise Value KOSZYK (football-field)
 * panel in the FinanceHub valuation surface (`<EvBasketFootballField>`).
 *
 * Gates the new valuation-triangulation panel that renders the deterministic
 * `valuationBasketService` output (4 method ranges on a shared axis, shaded
 * intersection zone = recommendation, amber consistency-flag with TOP-driver).
 * The panel is purely additive: it fetches `GET /economics/valuations/:id/basket`
 * (read-only, zero LLM, no recompute/persist) and renders on top of already-computed
 * valuation results. Flipping the flag never touches persistence or the existing
 * results/advisory surfaces — OFF = current valuation screen byte-for-byte.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_evBasket=0|1` — operator bypass for staging / visual review.
 *   2. `localStorage["ff.finance_ev_basket"]` — user / org override.
 *   3. `import.meta.env.VITE_FINANCE_EV_BASKET` — build-time override.
 *   4. Default: ON (flip 2026-07-16, akcept Piotra; EV Basket football-field
 *      zweryfikowany dev-render light+dark).
 */

const LS_KEY = 'ff.finance_ev_basket';
const QUERY_KEY = 'ff_evBasket';
const ENV_KEY = 'VITE_FINANCE_EV_BASKET';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  // Default OFF: with no build-time override the current valuation surface stays
  // the default. An explicit `1`/`true` env value opts in.
  try {
    const parsed = parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
    // EV Basket football-field zweryfikowany dev-render (light+dark, 2026-07-16 —
    // triangulacja 4 metod, read-only, zero crimson) → default ON. Opt-out ?ff_evBasket=0.
    return parsed === null ? true : parsed;
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

export function isFinanceEvBasketEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const FINANCE_EV_BASKET_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
