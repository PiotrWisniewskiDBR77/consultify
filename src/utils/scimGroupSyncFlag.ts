/**
 * SCIM group-sync self-service (HP-25 B4, Harvey-Parity) — feature flag for the
 * new "Group mappings (Entra / Okta → role)" card in `AdminSecurityPolicyPanel`,
 * where an org-admin manages their OWN organization's group→role mappings
 * (optionally scoped to a project) without a superadmin.
 *
 * Backend `/api/admin/identity/scim/group-mappings` is already org-scoped
 * (organization_id from the token, and a supplied projectId is validated to
 * belong to that org — see adminP32.routes.ts + scimGroupMappingService.ts), so
 * this flag gates ONLY the UI surface (card visibility), not the data path.
 *
 * ★ DEFAULT OFF (rule #7/#9): a visually-new admin surface does not ship live
 *   until Piotr sees a screenshot and accepts it. This is deliberately stricter
 *   than the SSO self-service flag (which Piotr already accepted, gallery fala7).
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_scimGroupSync=0|1` — operator bypass (staging / screenshot).
 *   2. `localStorage["ff.scim_group_sync"]` — user/org override.
 *   3. `import.meta.env.VITE_SCIM_GROUP_SYNC` — build-time override.
 *   4. Default: ON (flip 2026-07-16, akcept Piotra).
 *
 * Pattern: src/utils/ssoSelfServiceFlag.ts (HP-24), src/utils/clientVaultFlag.ts (HP-22).
 */

const LS_KEY = 'ff.scim_group_sync';
const QUERY_KEY = 'ff_scimGroupSync';
const ENV_KEY = 'VITE_SCIM_GROUP_SYNC';

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
    return parsed === null ? true : parsed; // FLIP ON — akcept Piotra 07-16
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

export function isScimGroupSyncEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const SCIM_GROUP_SYNC_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
