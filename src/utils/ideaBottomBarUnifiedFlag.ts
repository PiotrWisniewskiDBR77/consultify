/**
 * Dolny pasek Idei — JEDEN wspólny zestaw dla wszystkich 4 narzędzi
 * (Mapa myśli · Tablica · Przepływ · Tabela).
 *
 * Zgłoszenie Piotra (żywe demo, 2026-07-28), prawy dolny róg płótna:
 *   • „to powinno być koło siebie" — przełącznik reprezentacji i kontrolki
 *     zoomu stoją dziś w DWÓCH osobnych pigułkach, które na węższym oknie
 *     układają się jedna NAD drugą (heurystyka pomiaru w `IdeaViewSwitcher`
 *     ma gałąź „piętro nad klastrem", gdy w rzędzie brakuje miejsca).
 *   • „ten zoom co był w mapie myśli powinien być we wszystkich ideach".
 *   • „to menu zrób analogicznie jak w innych narzędziach idea".
 *
 * Mechanizm (bez prop-drillingu przez trzy ciężkie komponenty narzędzi —
 * ten sam wzorzec „gniazdo + portal" co `whiteboardSessionInPanelFlag.ts`):
 * `CanvasZoomControls` wystawia w SWOJEJ pigułce puste gniazdo DOM o id
 * `IDEA_BOTTOM_BAR_SWITCHER_SLOT_ID`, a `IdeaViewSwitcher` — zamiast
 * kotwiczyć się heurystycznie do `document.body` — portaluje się DO TEGO
 * GNIAZDA. Efekt: jedna pigułka, jeden rząd, ta sama kolejność w każdym
 * narzędziu, zero zmian w `IdeaRecommendationMap` / `IdeaWhiteboardTool` /
 * `IdeaProcessFlowTool` poza uniesieniem minimapy nad pasek.
 *
 * Tabela nie ma płótna React Flow, więc nie ma też gniazda — przełącznik
 * spada tam na dzisiejszą ścieżkę (własna pigułka w rogu). To ŚWIADOMY
 * wyjątek, opisany w raporcie odbioru, nie przeoczenie.
 *
 * Kolejność rozstrzygania (wygrywa najwyższa), 1:1 jak
 * `whiteboardSessionInPanelFlag.ts`:
 *   1. URL query `?ff_ideaBottomBarUnified=0|1` — obejście operatora.
 *   2. `localStorage["ff.idea_bottom_bar_unified"]` — override użytkownika.
 *   3. `import.meta.env.VITE_IDEA_BOTTOM_BAR_UNIFIED` — override build-time.
 *   4. Domyślnie: OFF — zmiana układu wymaga akceptu Piotra na zrzutach
 *      (CLAUDE.md #7). OFF = dokładnie dzisiejszy widok.
 */

const LS_KEY = 'ff.idea_bottom_bar_unified';
const QUERY_KEY = 'ff_ideaBottomBarUnified';
const ENV_KEY = 'VITE_IDEA_BOTTOM_BAR_UNIFIED';

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
    return true;
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

// ★ 2026-07-28: DOMYŚLNIE WŁĄCZONE. Właściciel zaakceptował układ na prototypie,
// obejrzał realne ekrany i świadomie zdecydował o włączeniu wszystkich flag
// powłoki naraz (zgłosiłem ryzyko łamania reguły „nie włączaj wielu naraz",
// podtrzymał). Droga odwrotu bez wdrożenia: dopisz `?<QUERY_KEY>=0` do adresu —
// wyłącza TĘ JEDNĄ część, reszta działa dalej.
export function isIdeaBottomBarUnifiedEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const IDEA_BOTTOM_BAR_UNIFIED_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;

/**
 * Gniazdo DOM wystawiane przez `CanvasZoomControls` na LEWYM krańcu pigułki
 * dolnego paska. `IdeaViewSwitcher` portaluje do niego przełącznik czterech
 * reprezentacji, gdy flaga jest ON.
 */
export const IDEA_BOTTOM_BAR_SWITCHER_SLOT_ID = 'idea-bottom-bar-switcher-slot';

/**
 * Uniesienie minimapy nad pasek (px). Mapa myśli ma to dziś na sztywno
 * (`marginBottom: 62`); przy fladze ON dostają to także Tablica i Przepływ,
 * gdzie minimapa wjeżdżała POD pasek (pasek `z-dropdown`, minimapa `z-index:5`).
 */
export const IDEA_BOTTOM_BAR_MINIMAP_LIFT = 62;
