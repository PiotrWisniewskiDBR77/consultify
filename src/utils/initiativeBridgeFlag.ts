const LS_KEY = 'ff.initiative_bridge';
const QUERY_KEY = 'ff_initiativeBridge';
const ENV_KEY = 'VITE_INITIATIVE_BRIDGE';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'off'].includes(normalized)) return false;
  return null;
}

let cached: boolean | null = null;

export function isInitiativeBridgeEnabled(): boolean {
  if (cached !== null) return cached;
  try {
    const query =
      typeof window === 'undefined'
        ? null
        : parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
    const local =
      query === null && typeof window !== 'undefined'
        ? parseFlag(window.localStorage.getItem(LS_KEY))
        : null;
    cached =
      query ??
      local ??
      parseFlag(
        (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
      ) ??
      false;
  } catch {
    cached = false;
  }
  return cached;
}

export function resetInitiativeBridgeFlagCache(): void {
  cached = null;
}

export const INITIATIVE_BRIDGE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
