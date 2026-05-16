/**
 * Chat V10 / V10-CON-001 — feature flag for the Connector interface
 * contract (universal connector shape, closed catalogues, structural
 * validator, capability + auth-kind invariants).
 *
 * Runtime contract lives in
 * `src/models/connectors/ConnectorInterface.ts`. Default OFF —
 * Wave A seed pins the catalogues and three connector-level
 * invariants; Wave B connector implementations bind to this contract.
 */

const LS_KEY = 'ff.connectors_connector_interface';
const QUERY_KEY = 'ff_connectors_connector_interface';
const ENV_KEY = 'VITE_CONNECTORS_CONNECTOR_INTERFACE';

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

export function isConnectorsConnectorInterfaceEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const CONNECTORS_CONNECTOR_INTERFACE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
