/**
 * Chat V10 / V10-CON-002 — feature flag for the ConnectorRegistry
 * (tenant-scoped registry, capability declarations, pure resolvers,
 * no-duplicate-id + typed-capability invariants).
 *
 * Runtime contract lives in
 * `src/models/connectors/ConnectorRegistry.ts`. Default OFF —
 * Wave A seed pins the registry shape and three registry-level
 * invariants; Wave B governance UI and telemetry bind to this contract.
 */

const LS_KEY = 'ff.connectors_registry';
const QUERY_KEY = 'ff_connectors_registry';
const ENV_KEY = 'VITE_CONNECTORS_REGISTRY';

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

export function isConnectorsRegistryEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const CONNECTORS_REGISTRY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
