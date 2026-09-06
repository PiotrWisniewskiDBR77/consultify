/**
 * Materiały ▸ Biblioteka wzorców — Galeria reveal flag (N4, noc 2026-07-27/28).
 *
 * Źródło: prototyp `proto/galeria-szablonow`
 * (`dev-render/screens/proto-galeria-szablonow.tsx`), obejrzany przez
 * nadzorcę sesji w obu motywach i pokazany właścicielowi (Piotr) — NIE
 * zaakceptowany jeszcze na żywym ekranie produkcyjnym. Ta flaga odsłania
 * galerię kafli (z miniaturami niosącymi strukturę wzorca) jako alternatywny
 * widok wewnątrz istniejącej zakładki "Szablony"
 * (`TemplatesTabContent`), obok przełącznika Galeria ↔ Tabela.
 *
 * Mirrors `src/utils/workbookTemplatesFlag.ts` / `src/utils/deckArchitectFlag.ts`'s
 * reveal-flag pattern so the gallery can be built and reviewed WITHOUT going
 * live for every user first (canon: "Piotr nigdy nie jest pierwszym
 * testerem wizualnym").
 *
 * ★ Default = OFF. OFF → `TemplatesTabContent` renders byte-identical to
 * today (StandardTable only, no Galeria/Tabela toggle, no chip toolbar). ON
 * → the toggle + gallery grid appear; the existing table/preview stays
 * reachable via the toggle's "Tabela" option (nothing is removed).
 *
 * Kolejność (wygrywa najwyższe):
 *   1. URL query `?ff_galeria_szablonow=0|1` — bypass operatora / dev / dev-render.
 *   2. `localStorage["ff.galeriaSzablonow"]` — override user / org.
 *   3. `import.meta.env.VITE_GALERIA_SZABLONOW_ENABLED` — build-time.
 *   4. Default: OFF.
 */

const LS_KEY = 'ff.galeriaSzablonow';
const QUERY_KEY = 'ff_galeria_szablonow';
const ENV_KEY = 'VITE_GALERIA_SZABLONOW_ENABLED';

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

export function isTemplatesGalleryEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TEMPLATES_GALLERY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
