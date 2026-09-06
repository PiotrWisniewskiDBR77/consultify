/**
 * SSO self-service (HP-24, Harvey-Parity) — feature flag dla nowej karty
 * "SSO configuration" w `AdminSecurityIdentityPanel` (zakładka `policy` →
 * `AdminSecurityPolicyPanel`), gdzie org-admin sam podpina metadane
 * SAML/OIDC swojej organizacji (bez superadmina).
 *
 * Backend `/api/admin/sso-self` jest już org-scoped (organization_id z
 * tokenu, hard-pinned w SQL — zob. adminP32.routes.ts getAdminActor()),
 * więc flaga gejtuje TYLKO powierzchnię UI (widoczność karty), nie ścieżkę
 * danych. Wizualnie nowy ekran → domyślnie OFF (reguła #7/#9: nic
 * wizualnie nowego nie idzie na żywo bez zrzutu i akceptu Piotra).
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_ssoSelfService=0|1` — bypass operatora (staging / zrzut).
 *   2. `localStorage["ff.sso_self_service"]` — override user/org.
 *   3. `import.meta.env.VITE_SSO_SELF_SERVICE` — override build-time.
 *   4. Default: ON (flip 2026-07-15, akcept Piotra; galeria fala7).
 *
 * Wzorzec: src/utils/clientVaultFlag.ts (HP-22).
 */

const LS_KEY = 'ff.sso_self_service';
const QUERY_KEY = 'ff_ssoSelfService';
const ENV_KEY = 'VITE_SSO_SELF_SERVICE';

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
    return parsed === null ? true : parsed; // AKCEPT Piotra 2026-07-15 (galeria fala7)
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

export function isSsoSelfServiceEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const SSO_SELF_SERVICE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
