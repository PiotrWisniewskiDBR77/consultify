/**
 * Chat V10 / V10-RSN-014 — feature flag for TrustBundle hash.
 *
 * Runtime contract lives in
 * `src/models/reasoning/TrustBundleHash.ts`. Default OFF —
 * Wave A seed pins the TrustBundleHash branded type, hashTrustBundle,
 * sealTrustBundle, and assertTrustBundleIntegrity; Wave B replaces the
 * multi-accumulator fingerprint with Web Crypto SHA-256.
 */

const LS_KEY = 'ff.reasoning_trust_bundle_hash';
const QUERY_KEY = 'ff_reasoning_trust_bundle_hash';
const ENV_KEY = 'VITE_REASONING_TRUST_BUNDLE_HASH';

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

export function isReasoningTrustBundleHashEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const REASONING_TRUST_BUNDLE_HASH_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
