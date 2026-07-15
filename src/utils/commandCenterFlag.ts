/**
 * Command Center (F-CC1, blok Harvey-Parity HP-10…13) — feature flag dla
 * sekcji `command` ("Trust & Control") w hubie org-admina
 * (`AdminSettingsModule` → `AdminSettingsSidebar`).
 *
 * Sekcja spina posture (SSO/IAM, retencja, data-residency, DLP, audyt) i
 * podpina 16 dotąd martwych endpointów `/api/admin/enterprise-compliance/*`.
 * Wizualnie nowy ekran → domyślnie OFF (reguła #7/#9: nic wizualnie nowego
 * nie idzie na żywo bez zrzutu i akceptu Piotra). Backend jest już
 * org-scoped (organization_id z tokenu), więc flaga gejtuje TYLKO
 * powierzchnię UI (widoczność nav-item + routing), nie ścieżkę danych.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_commandCenter=0|1` — bypass operatora (staging / zrzut).
 *   2. `localStorage["ff.command_center"]` — override user/org.
 *   3. `import.meta.env.VITE_COMMAND_CENTER` — override build-time.
 *   4. Default: OFF.
 *
 * Wzorzec: src/utils/clientVaultFlag.ts (HP-22, Blok F).
 */

const LS_KEY = 'ff.command_center';
const QUERY_KEY = 'ff_commandCenter';
const ENV_KEY = 'VITE_COMMAND_CENTER';

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

export function isCommandCenterEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const COMMAND_CENTER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
