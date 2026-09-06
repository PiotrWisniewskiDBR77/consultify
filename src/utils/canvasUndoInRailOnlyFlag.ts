/**
 * Sprzątanie 2026-07-28 (Zadanie C) — feature flag zdejmujący Cofnij/Ponów z
 * POZIOMEGO paska narzędzia (Menu 3) w Tablicy i w Przepływie.
 *
 * Zgłoszenie właściciela (o parze przycisków Cofnij/Ponów w poziomym pasku
 * Whiteboardu): „to nie jest potrzebne bo mamy to samo w panelu lewym".
 *
 * DLACZEGO DOPIERO TERAZ: warunek właściciela („mamy to samo w panelu lewym")
 * jest spełniony od 2026-07-27. Wcześniej Cofnij/Ponów w LEWYM pasku były na
 * Tablicy i w Przepływie TRWALE WYGASZONE — pasek dostawał stan tylko z Mapy i
 * Tabeli. Naprawa (`ideaUndoStateBus` + `emitIdeaUndoState` w
 * `IdeaWhiteboardTool` / `IdeaProcessFlowTool`) domknęła autobus stanu.
 *
 * ZERO UTRATY FUNKCJI — to samo działanie zostaje w trzech miejscach:
 *   1. LEWY PASEK (`CanvasLeftToolbar`, sloty `wb_undo`/`wb_redo`,
 *      `pf_undo`/`pf_redo`) — zmierzone na żywym ekranie: dodanie karteczki
 *      6→7 węzłów włącza „Cofnij", klik cofa 7→6 i włącza „Ponów".
 *   2. Skróty klawiszowe Ctrl/Cmd+Z i Ctrl/Cmd+Shift+Z — nietknięte.
 *   3. Sekcja „Historia" prawego panelu — dziennik zmian.
 *
 * Resolution order (highest wins), identyczny wzorzec co
 * `whiteboardSessionInPanelFlag.ts`:
 *   1. URL query `?ff_canvasUndoInRailOnly=0|1` — operator bypass.
 *   2. `localStorage["ff.canvas_undo_in_rail_only"]` — user/org override.
 *   3. `import.meta.env.VITE_CANVAS_UNDO_IN_RAIL_ONLY` — build-time override.
 *   4. Default: OFF — zmiana wyglądu wymaga akceptu właściciela na zrzutach
 *      (CLAUDE.md #7). OFF = pasek co do piksela jak dziś.
 */

const LS_KEY = 'ff.canvas_undo_in_rail_only';
const QUERY_KEY = 'ff_canvasUndoInRailOnly';
const ENV_KEY = 'VITE_CANVAS_UNDO_IN_RAIL_ONLY';

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
export function isCanvasUndoInRailOnlyEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const CANVAS_UNDO_IN_RAIL_ONLY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
