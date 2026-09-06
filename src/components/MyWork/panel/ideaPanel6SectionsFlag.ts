/**
 * Flaga `ff_ideaPanel6Sections` — przebudowa prawego panelu Idei na SZEŚĆ
 * sekcji zależnych od przedmiotu (zaakceptowany prototyp właściciela, 2026-07-28).
 *
 * PROBLEM, KTÓRY ZAMYKA: dziś na Idei żyją DWA kłócące się systemy zakładek —
 * panel Idei (Przegląd · Inspektor · Powiązania · Komentarze · Historia) i panel
 * szczegółów wiersza Tabeli (Properties · Comments · Attachments · Activity ·
 * AI Insights). „Comments" występuje dwa razy i znaczy co innego.
 *
 * ZASADA PORZĄDKUJĄCA: panel mówi zawsze o jednej z DWÓCH rzeczy — o CAŁEJ IDEI
 * albo o ZAZNACZONYM ELEMENCIE. Sześć sekcji zostaje takich samych, zmienia się
 * treść. Zaznaczasz węzeł → panel przełącza się na niego. Klikasz puste płótno →
 * wracasz na poziom Idei.
 *
 *     Przegląd · Właściwości · Powiązania · AI · Aktywność · Narzędzie
 *
 * Resolution order (highest wins) — wzorzec 1:1 z `whiteboardSessionInPanelFlag.ts`:
 *   1. URL query `?ff_ideaPanel6Sections=0|1` — operator bypass.
 *   2. `localStorage["ff.idea_panel_6_sections"]` — user/org override.
 *   3. `import.meta.env.VITE_IDEA_PANEL_6_SECTIONS` — build-time override.
 *   4. Default: OFF — zmiana układu wymaga akceptu właściciela na zrzutach
 *      (CLAUDE.md #7). Przy OFF panel działa DOKŁADNIE jak dziś (5 zakładek).
 */

const LS_KEY = 'ff.idea_panel_6_sections';
const QUERY_KEY = 'ff_ideaPanel6Sections';
const ENV_KEY = 'VITE_IDEA_PANEL_6_SECTIONS';

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
export function isIdeaPanel6SectionsEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const IDEA_PANEL_6_SECTIONS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
