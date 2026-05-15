/**
 * Chat V10 / V10-CON-003 — feature flag for the OAuthLayer
 * (OAuth contract shape, closed flow catalogues, PKCE + CSRF invariants).
 *
 * Runtime contract lives in
 * `src/models/connectors/OAuthLayer.ts`. Default OFF —
 * Wave A seed pins the OAuth config shape, the three closed catalogues
 * (flow kinds, grant types, PKCE methods), and four runtime invariants;
 * Wave B async orchestration and callback exchange bind to this contract.
 */

const LS_KEY = 'ff.connectors_oauth_layer';
const QUERY_KEY = 'ff_connectors_oauth_layer';
const ENV_KEY = 'VITE_CONNECTORS_OAUTH_LAYER';

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

export function isConnectorsOAuthLayerEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const CONNECTORS_OAUTH_LAYER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
