/**
 * Client Vault (HP-22, Blok F Harvey-Parity) — feature flag dla org-scoped
 * widoku dokumentów KLIENTA (`<ClientDocumentsVault>` = `DocumentsRAGTab`
 * w wariancie 'client').
 *
 * Widok jest wizualnie nowy → domyślnie OFF (reguła #7/#9: nic wizualnie
 * nowego nie idzie na żywo bez zrzutu i akceptu Piotra). Backend
 * `/knowledge/documents` jest już org-scoped (organization_id z tokenu),
 * więc flaga gejtuje TYLKO powierzchnię UI, nie ścieżkę danych.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_clientVault=0|1` — bypass operatora (staging / zrzut).
 *   2. `localStorage["ff.client_vault"]` — override user/org.
 *   3. `import.meta.env.VITE_CLIENT_VAULT` — override build-time.
 *   4. Default: ON (flip 2026-07-15, akcept Piotra; styl legacy do Vegas).
 */

const LS_KEY = 'ff.client_vault';
const QUERY_KEY = 'ff_clientVault';
const ENV_KEY = 'VITE_CLIENT_VAULT';

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
    return parsed === null ? true : parsed; // AKCEPT Piotra 2026-07-15 — default ON (styl legacy do Vegas)
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

export function isClientVaultEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const CLIENT_VAULT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
