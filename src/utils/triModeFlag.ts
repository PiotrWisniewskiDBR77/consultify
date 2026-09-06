/**
 * Tri-mode entry flag (roboty D1/D2/D3, doktryna 3 trybów, 2026-07-22).
 *
 * Ekrany-dokumenty (Word · Deck · Excel) zlewały wejście w „AI generuje": każda
 * ścieżka („Start new", szablon) i tak szła przez pipeline AI. Ta flaga odsłania
 * JAWNY, równorzędny wybór 3 trybów na wejściu każdego narzędzia:
 *   ① CZYSTO   — pusty artefakt (dokument/deck/arkusz) otwarty do ręcznej pracy,
 *                BEZ pipeline'u AI;
 *   ② Z AI     — dotychczasowa generacja (intake/czat → pipeline);
 *   ③ Z SZABLONU — szablony (dotychczasowa ścieżka template).
 *
 * Bramkuje WYŁĄCZNIE nowy komponent wyboru (`TriModeChooser`) w trzech widokach:
 *   - `DocumentStudioView` (faza intake, /document-studio),
 *   - `PrezentacjeView` (wejście `?view=new`, /prezentacje),
 *   - `ExceleView` (wejście `?view=new`, /excele).
 * OFF → każdy z trzech widoków renderuje się BAJT-IDENTYCZNIE jak przed flagą
 * (żadnego choosera, zero regresji). ON (domyślnie) → chooser jako brama wejścia.
 *
 * Kolejność (wygrywa najwyższe):
 *   1. URL query `?ff_tri_tryby=0|1` — bypass operatora / dev / dev-render.
 *   2. `localStorage["ff.tri_tryby"]` — override user / org.
 *   3. `import.meta.env.VITE_TRI_TRYBY` — build-time.
 *   4. Default: ON (flip fb119cefe8, akcept Piotra 2026-07-22), env jawnie
 *      nieustawione = ON.
 */

const LS_KEY = 'ff.tri_tryby';
const QUERY_KEY = 'ff_tri_tryby';
const ENV_KEY = 'VITE_TRI_TRYBY';

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

export function isTriModeEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TRI_MODE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
