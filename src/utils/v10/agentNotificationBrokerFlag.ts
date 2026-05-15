/**
 * Chat V10 / V10-AGT-027 — feature flag for the NotificationBroker
 * contract (4 event kinds, 3 delivery channels, per-user preference
 * routing, budget_exceeded admin-safety override).
 *
 * Runtime contract lives in
 * `src/models/agent/NotificationBroker.ts`. Default OFF — Wave A
 * seed pins the event-kind and channel catalogues, the per-user
 * preference shape, the routing reducer, and the two dispatch
 * invariants; the Wave B delivery driver binds channel dispatch to
 * this shape.
 */

const LS_KEY = 'ff.agent_notification_broker';
const QUERY_KEY = 'ff_agent_notification_broker';
const ENV_KEY = 'VITE_AGENT_NOTIFICATION_BROKER';

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

export function isAgentNotificationBrokerEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AGENT_NOTIFICATION_BROKER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
