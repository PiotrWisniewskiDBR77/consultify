/**
 * Górny pasek Idei w JEDNEJ LINII (zgłoszenie właściciela 2026-07-28).
 *
 * DZIŚ nad płótnem Idei stoją TRZY rzędy:
 *   1. rząd kart/pilli otwartych dokumentów (MyWorkHub `renderDynamicTabs`):
 *      „Lista · Proces ofertowania · Wejście na rynek DACH" (+ kropki statusu),
 *   2. Menu 1 powłoki (`ExecutiveModuleShell/TopBar`): „← Idee › <tytuł>" po
 *      lewej + klaster „Etap · Zapisano · Teresa · ⋯ · Konwertuj" po prawej,
 *   3. Menu 3 (`IdeaCanvasSecondBar`): „Dodaj węzeł · Auto-układ · AI rozwiń ·
 *      Szablony" + po prawej „Eksport".
 *
 * Słowa właściciela: „z tego zrobimy jedną linię i odzyskamy trochę
 * przestrzeni", „nazwa nam nie jest potrzebna dwa razy i dwa razy info że to
 * jest ideas", „te 4 przyciski nie są potrzebne bo są zaraz obok w menu lewym",
 * „eksport wrzuć do menu pod 3 kropki", „zostaje tylko to co jest z prawej
 * strony i to w jednej linii".
 *
 * CO ROBI FLAGA (ON):
 *   • Menu 3 znika w całości — te same akcje żyją w lewym pasku narzędzi
 *     (`CanvasLeftToolbar`: Dodaj / Auto-układ / AI / Szablony), a „Eksport" ma
 *     już swoją pozycję w kebabie Menu 1 (`buildIdeaMenu1Chips` → `idea-export`,
 *     ten sam `setExportMenuOpen(true)`), więc nic nie ginie.
 *   • Klaster poleceń Menu 1 (Etap · Zapisano · Teresa · ⋯ · Konwertuj)
 *     przenosi się PORTALEM do rzędu pilli (slot `IDEA_TOP_BAR_SLOT_ID`
 *     renderowany przez `MyWorkHub`), a sam rząd Menu 1 znika — zostaje JEDNA
 *     linia: po lewej tożsamość (pille otwartych idei + chip „Lista"), po
 *     prawej klaster poleceń.
 *   • Breadcrumb „← Idee › <tytuł>" znika (decyzja: z dwóch rzędów tożsamości
 *     zostają PILLE — niosą więcej: które idee są otwarte, kropki statusu i chip
 *     „Lista" jako powrót do listy; breadcrumb tylko powtarzał nazwę).
 *   • Zbędny pionowy separator wewnątrz klastra znika (ramka wokół prawej grupy).
 *
 * BEZPIECZNIK: gdy flaga jest ON, ale slotu NIE MA w DOM (np. Idea otwarta poza
 * hubem albo harness `dev-render`), `TopBar` renderuje się PO STAREMU, z pełną
 * tożsamością — nawigacja w górę nigdy nie znika przez brak celu portalu.
 *
 * Resolution order (highest wins) — wzorzec 1:1 z
 * `whiteboardSessionInPanelFlag.ts` / `melsCanvasFlag.ts`:
 *   1. URL query `?ff_ideaTopBarOneLine=0|1` — operator bypass.
 *   2. `localStorage["ff.idea_top_bar_one_line"]` — user/org override.
 *   3. `import.meta.env.VITE_IDEA_TOP_BAR_ONE_LINE` — build-time override.
 *   4. Default: OFF — zmiana układu wymaga akceptu właściciela na zrzutach
 *      (CLAUDE.md #7).
 */

const LS_KEY = 'ff.idea_top_bar_one_line';
const QUERY_KEY = 'ff_ideaTopBarOneLine';
const ENV_KEY = 'VITE_IDEA_TOP_BAR_ONE_LINE';

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
export function isIdeaTopBarOneLineEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const IDEA_TOP_BAR_ONE_LINE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;

/**
 * DOM id celu portalu w rzędzie pilli (`MyWorkHub.renderDynamicTabs`). `TopBar`
 * powłoki Idei renderuje do niego swój klaster poleceń, gdy flaga jest ON.
 * Węzeł jest renderowany TYLKO przy fladze ON — przy OFF nie istnieje, więc
 * bezpiecznik z opisu wyżej sam trzyma stary układ.
 */
export const IDEA_TOP_BAR_SLOT_ID = 'idea-top-bar-one-line-slot';
