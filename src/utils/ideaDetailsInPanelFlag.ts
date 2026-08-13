/**
 * SZCZEGÓŁY ELEMENTU W PRAWYM PANELU zamiast osobnego wielkiego okna (IDE-025).
 *
 * Słowa właściciela (odbiór na demo 2026-07-28, Tablica):
 *   „niestety tu jest jeszcze ciągle to wielkie okno. Widzisz, mieliśmy je
 *    przerzucić… domyślam się, że we wszystkich narzędziach jest ciągle ten sam
 *    problem z tym prawym oknem, które miało być w rozwijanym prawym oknie
 *    z panelu."
 *
 * CO BYŁO ŹLE: `UnifiedNodeDetailDrawer` rysuje się jako `fixed top-0 right-0
 * bottom-0 w-[420px]` — pełnowysokościowa nakładka, która ZASŁANIA prawy pasek
 * ikon i pół płótna. Powstała, zanim prawy panel dostał sekcję „Właściwości",
 * i po przebudowie powłoki (2026-07-28) żyła dalej RÓWNOLEGLE do niej: dwa
 * miejsca na to samo, jedno przykrywające drugie.
 *
 * CZEGO TU NIE MA (świadomie): nie unifikujemy czterech komponentów, bo cztery
 * nie istnieją. Inwentarz wykazał JEDEN wspólny `UnifiedNodeDetailDrawer`
 * (2101 linii), używany przez Mapę myśli i Tablicę przez obu gospodarzy
 * (`IdeaRecommendationMap` + `IdeaMapWorkspace`). Problemem była PREZENTACJA,
 * nie duplikacja. Dlatego zmiana jest mała: ten sam komponent, inne miejsce
 * renderu — „szata graficzna zostaje, zmienia się skala" (słowa właściciela).
 *
 * MECHANIZM: 1:1 z `canvasObjectEditBarFlag` — prawy panel wystawia slot DOM,
 * drawer portaluje do niego swoją treść. Zero prop-drillingu przez powłokę.
 *
 * BEZPIECZNIK: gdy flaga jest ON, ale slotu NIE MA w DOM (np. narzędzie żyje
 * poza powłoką albo prawy panel jest wyłączony flagą `ff_ideaPanel6Sections=0`),
 * drawer wraca do swojej dotychczasowej nakładki. Treść nigdy nie znika przez
 * brak celu portalu — ta sama zasada, która uratowała pasek edycji.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_ideaDetailsInPanel=0|1` — operator bypass.
 *   2. `localStorage["ff.idea_details_in_panel"]` — user/org override.
 *   3. `import.meta.env.VITE_IDEA_DETAILS_IN_PANEL` — build-time override.
 *   4. Default: OFF — właściciel NIE widział jeszcze tego układu na zrzucie
 *      (CLAUDE.md #7: Piotr nigdy nie jest pierwszym testerem wizualnym).
 */

import {
  isDemoAcceptanceProfileEnabled,
  type DemoAcceptanceProfileSource,
} from './demoAcceptanceProfile';

const LS_KEY = 'ff.idea_details_in_panel';
const QUERY_KEY = 'ff_ideaDetailsInPanel';
const ENV_KEY = 'VITE_IDEA_DETAILS_IN_PANEL';

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

let cached: boolean | null = null;

export function isIdeaDetailsInPanelEnabled(profileSource?: DemoAcceptanceProfileSource): boolean {
  if (isDemoAcceptanceProfileEnabled(profileSource)) return true;
  if (cached === null) {
    const fromQuery = readQueryOverride();
    const fromLs = fromQuery === null ? readLocalStorage() : null;
    cached = fromQuery !== null ? fromQuery : fromLs !== null ? fromLs : readEnvFlag();
  }
  return cached;
}

export function resetIdeaDetailsInPanelFlagCache(): void {
  cached = null;
}

export const IDEA_DETAILS_IN_PANEL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;

/**
 * DOM id celu portalu — renderowany w sekcji „Właściwości" prawego panelu.
 * Drawer portaluje tu swoją treść, gdy slot istnieje.
 */
export const IDEA_ELEMENT_DETAILS_SLOT_ID = 'idea-element-details-slot';
