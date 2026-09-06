/**
 * Tabela Idei — PROWADZENIE przy budowaniu + ROZŁADOWANIE paska (2026-07-28).
 *
 * Dwa zgłoszenia właściciela, jedna zmiana układu tego samego ekranu, więc
 * jedna flaga (odbiór = jeden przełącznik, jeden zrzut PRZED/PO):
 *
 * A. „no totalnie nie wiem jak zbudować tabelę", „dodałem kolumnę cos ale nie
 *    wiem jak mam sprawić aby ta tabela powstała".
 *    DZIŚ: legacy widok „Tabela" w `IdeaTableTool` przy ZEROWEJ liczbie wierszy
 *    rysuje sam nagłówek kolumn i pustkę pod spodem — żadnej akcji, żadnego
 *    zdania o tym, co dalej. (Ścieżka platformowa ma `EmptyStateView`, legacy
 *    — ta, którą widzi właściciel — NIE MA NIC.)
 *    PO WŁĄCZENIU: pusta tabela pokazuje `TableStartEmptyState` z TRZEMA
 *    ścieżkami startu, każda realnie budująca tabelę:
 *      • „Z szablonu"  → `FrameworkGenerator` (6 gotowych ram konsultingowych:
 *        SWOT · Interesariusze · Rejestr ryzyk · Plan działań · Benchmarking ·
 *        Porter) — wstawia KOLUMNY + WIERSZE,
 *      • „Z AI"        → `AITableAssistant` (opisz po ludzku → propozycja
 *        kolumn/wierszy do zatwierdzenia),
 *      • „Pusta z sugerowanymi kolumnami" → odsłania komplet kolumn startowych
 *        (Nazwa · Status · Priorytet · Właściciel) i dokłada 3 puste wiersze,
 *        czyli tabela POWSTAJE od razu na ekranie.
 *    Czwarta, cichsza droga („Wczytaj CSV") zostaje jako link — nic nie ubywa.
 *
 * B. „to menu tylko trochę jest tu za tłoczno (…) może save koło teresa i może
 *    trochę do trzykropka czyli import eksport a resztę trzeba jakoś ładnie
 *    ułożyć. — funkcje są super."
 *    DZIŚ: legacy pasek to ~30 kontrolek w jednym `flex-wrap` (na 1600px łamie
 *    się na dwa rzędy), bez ŻADNEGO kebaba.
 *    PO WŁĄCZENIU (nic nie znika — tylko przegrupowanie):
 *      • „Zapisz" + etykieta zapisu wędrują PORTALEM do Menu 1, obok „Teresy"
 *        (slot `IDEA_MENU1_TOOL_SLOT_ID` w `ExecutiveModuleShell/TopBar`),
 *      • Import/Eksport/Kopiuj + 16 narzędzi drugorzędnych chowa się pod JEDEN
 *        kebab „⋯" (sekcje: Dane · Widok · AI · Więcej),
 *      • w pasku zostaje to, czym się pracuje: widoki, filtr, grupowanie,
 *        przełącznik układów, AI/AI Fill/Framework (czyli trzy drogi budowania
 *        tabeli), kolumny, cofnij/ponów, „+ Wiersz".
 *
 * BEZPIECZNIK (wzorzec z `ideaTopBarOneLineFlag.ts`): gdy flaga jest ON, ale
 * slotu Menu 1 nie ma w DOM (Idea otwarta poza powłoką MELS, stary harness),
 * przycisk „Zapisz" renderuje się PO STAREMU w pasku — zapis nigdy nie znika
 * przez brak celu portalu.
 *
 * Resolution order (highest wins) — 1:1 z `whiteboardSessionInPanelFlag.ts`:
 *   1. URL query `?ff_ideaTableGuidedBar=0|1` — operator bypass.
 *   2. `localStorage["ff.idea_table_guided_bar"]` — user/org override.
 *   3. `import.meta.env.VITE_IDEA_TABLE_GUIDED_BAR` — build-time override.
 *   4. Default: OFF — zmiana układu wymaga akceptu właściciela na zrzutach
 *      (CLAUDE.md #7).
 */

const LS_KEY = 'ff.idea_table_guided_bar';
const QUERY_KEY = 'ff_ideaTableGuidedBar';
const ENV_KEY = 'VITE_IDEA_TABLE_GUIDED_BAR';

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
export function isIdeaTableGuidedBarEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const IDEA_TABLE_GUIDED_BAR_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;

/**
 * DOM id slotu w rzędzie poleceń Menu 1 (`ExecutiveModuleShell/TopBar`), tuż
 * PRZED chipem „Teresa". `TopBar` renderuje go zawsze, ale jako `display:
 * contents` bez dzieci — pusty slot nie zajmuje miejsca i nie zmienia wyglądu
 * (przy fladze OFF nikt do niego nie portaluje, więc Menu 1 wygląda 1:1 jak
 * dziś). Aktywne narzędzie (tu: Tabela) portaluje w to miejsce swój przycisk
 * „Zapisz", gdy flaga jest ON.
 */
export const IDEA_MENU1_TOOL_SLOT_ID = 'idea-menu1-tool-slot';
