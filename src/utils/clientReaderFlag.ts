/**
 * Client-reader (share-link) reveal flag — F1/F3, robota 2026-07-22.
 *
 * `/shared/doc/:token` renderuje read-only widok dokumentu Word przez
 * publiczny share-link (scope read/comment/download/edit — backend
 * share-linków już istniał, PIOTR NIGDY NIE JEST PIERWSZYM TESTEREM
 * WIZUALNYM więc trasa idzie za flagą do akceptu na zrzucie).
 *
 * Ta flaga (domyślnie OFF) montuje trasę; OFF → trasa efektywnie NIE
 * ISTNIEJE (spada na "*" catch-all, tak samo jak każdy inny nieznany
 * URL w AppRoutes.tsx), zero regresji. Wzorowana na `exceleFlag.ts`.
 *
 * Kolejność (wygrywa najwyższe):
 *   1. URL query `?ff_client_reader=0|1` — bypass operatora / dev.
 *   2. `localStorage["ff.client_reader"]` — override user / org.
 *   3. `import.meta.env.VITE_CLIENT_READER_ENABLED` — build-time.
 *   4. Default: ON (flip bez SHA, akcept Piotra; F1/F3 zweryfikowany w
 *      dev-render, trasa live).
 */

const LS_KEY = 'ff.client_reader';
const QUERY_KEY = 'ff_client_reader';
const ENV_KEY = 'VITE_CLIENT_READER_ENABLED';

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
    return parsed === null ? true : parsed;
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

export function isClientReaderEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const CLIENT_READER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
