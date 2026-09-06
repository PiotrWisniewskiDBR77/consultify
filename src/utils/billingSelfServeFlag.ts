/**
 * Module 08 (Finanse — Billing) — kill-switch for self-serve card-add &
 * subscription-analytics surfaces.
 *
 * Decision D8: live Stripe self-serve payments are DEFERRED. Billing starts
 * with MANUAL invoices + admin plan/limit assignment (shipped in module 17).
 * Until real Stripe keys are provisioned, the customer-facing "add a card"
 * flow and the MRR/churn/cohort analytics dashboard must NOT be reachable —
 * the previous code submitted a fake `pm_<timestamp>_mock` payment method and
 * the analytics tab fired requests against endpoints that 503/404.
 *
 * Where this flag gates
 * ---------------------
 *   * `<AddCardModal>` / `<PaymentMethodsPanel>` — when OFF (default), the
 *     card form is replaced with an honest "billing is handled manually"
 *     panel. NO fake payment method is ever submitted. When ON, the modal
 *     fetches a real Stripe SetupIntent (`/billing/setup-intent`, which only
 *     succeeds when `STRIPE_SECRET_KEY` is set server-side) — there is still
 *     no fake-success path.
 *   * `<SubscriptionAnalytics>` (BillingCenterView "Analytics" tab) — when
 *     OFF, an honest "not available yet" empty state is shown instead of
 *     firing requests at the unbuilt revenue-analytics endpoints.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_billingSelfServe=0|1` — operator bypass for staging.
 *   2. `localStorage["ff.billing_self_serve"]` — user / org override.
 *   3. `import.meta.env.VITE_BILLING_SELF_SERVE` — build-time default.
 *   4. Default: OFF. Flip this ON only once real Stripe publishable/secret
 *      keys are configured and the self-serve checkout is verified.
 */

const LS_KEY = 'ff.billing_self_serve';
const QUERY_KEY = 'ff_billingSelfServe';
const ENV_KEY = 'VITE_BILLING_SELF_SERVE';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const parsed = parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
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

export function isBillingSelfServeEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const BILLING_SELF_SERVE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
