/**
 * list-canon-v2 (Wpis 182 + 183, KANAL.md 2026-09-18): sześć list z adnotacją
 * `§27-todo` dostaje kanoniczną tabelę (`StandardTable` → `FilterableTable`,
 * TRIADA §2 / TABLE_AND_PREVIEW_CANON §7).
 *
 * JEDNA flaga środowiskowa `VITE_LIST_CANON_V2` + mapa per-ekran — NIE sześć
 * osobnych flag (decyzja CTO, Wpis 183): przełącznik build-time jest wspólny,
 * a o tym, który ekran już ma kanoniczną tabelę i jest domyślnie ON, mówi
 * `LIST_CANON_V2_SCREENS`. Paczka (i) każdego ekranu dopisuje TYLKO swój klucz
 * do mapy (wartość `false` — stara tabela zostaje domyślna, nowa czeka na
 * akcept właściciela na karcie PRZED/PO); paczka (ii) po akcepcie stawia
 * `true` i kasuje starą tabelę.
 *
 * Kolejność rozstrzygania (najwyższa wygrywa):
 *   1. URL query `?ff_listCanonV2=0|1` — bypass operatora (staging / zrzut).
 *   2. `localStorage["ff.list_canon_v2.<screen>"]` — override jednego ekranu.
 *   3. `localStorage["ff.list_canon_v2"]` — override wszystkich ekranów.
 *   4. Domyślnie: mapa per-ekran; `VITE_LIST_CANON_V2=0` wymusza OFF dla
 *      wszystkich ekranów (jak w `m03*StandardTableFlag`, env nie przebija
 *      override'ów operatora z pozycji 1–3).
 *
 * Dostęp do env jest STATYCZNY (`import.meta.env.VITE_LIST_CANON_V2`), bo
 * `vite build` wycina flagi czytane przez indeksowanie obiektu — patrz
 * `scripts/check-static-vite-flag-access.mjs`.
 */

export type ListCanonV2Screen =
  | 'subscriberDispatch'
  | 'portfolioList'
  | 'myWorkGrid'
  | 'ideas'
  | 'myTasks'
  | 'inbox';

/**
 * Domyślna widoczność kanonicznej tabeli per ekran. `false` = stara tabela jest
 * renderem domyślnym, nowa dostępna tylko przez query/localStorage (do zrzutu
 * PRZED/PO i akceptu właściciela).
 */
export const LIST_CANON_V2_SCREENS: Readonly<Record<ListCanonV2Screen, boolean>> = {
  subscriberDispatch: false,
  portfolioList: false,
  myWorkGrid: false,
  ideas: false,
  myTasks: false,
  inbox: false,
};

const LS_KEY = 'ff.list_canon_v2';
const QUERY_KEY = 'ff_listCanonV2';
const ENV_KEY = 'VITE_LIST_CANON_V2';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorage(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function readHardDefault(screen: ListCanonV2Screen): boolean {
  if (parseFlag(import.meta.env.VITE_LIST_CANON_V2) === false) return false;
  return LIST_CANON_V2_SCREENS[screen] === true;
}

export function isListCanonV2Enabled(screen: ListCanonV2Screen): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromScreenLs = readLocalStorage(`${LS_KEY}.${screen}`);
  if (fromScreenLs !== null) return fromScreenLs;
  const fromGlobalLs = readLocalStorage(LS_KEY);
  if (fromGlobalLs !== null) return fromGlobalLs;
  return readHardDefault(screen);
}

export const LIST_CANON_V2_FLAG_KEYS = {
  localStorage: LS_KEY,
  localStorageScreen: (screen: ListCanonV2Screen) => `${LS_KEY}.${screen}`,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
