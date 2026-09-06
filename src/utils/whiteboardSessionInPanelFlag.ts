/**
 * Naprawa Whiteboard 2026-07-26 (Zadanie A) — feature flag przenoszący
 * `WhiteboardSessionPanel` (Facilitator / Board mode / Voting / Follow-me /
 * WORKSHOP PHASE / Ops+Governance) z pływającego overlaya NA płótnie do
 * zakładki „Właściwości" prawego panelu narzędzia (sekcja „Inspektor
 * tablicy" w `IdeaWorkspaceTools.tsx`, `activeTool === 'whiteboard'`).
 *
 * Zgłoszenie Piotra (zrzut, żywe demo): panel wisiał na środku/lewej
 * krawędzi płótna zasłaniając karteczki — „to jest jakaś kupa na środku (…)
 * mamy menu prawe, może tam to wrzućmy".
 *
 * Mechanizm (bez prop-drillingu przez IdeaMapWorkspace): gdy flaga ON,
 * `IdeaWhiteboardTool` portaluje TEN SAM komponent `WhiteboardSessionPanel`
 * (identyczne propsy/handlery — zero okrojenia funkcji) do DOM-node
 * wystawionego przez `IdeaWorkspaceTools` wewnątrz sekcji „Inspektor
 * tablicy" zamiast renderować floating overlay nad canvasem.
 *
 * Resolution order (highest wins), identyczny wzorzec co `melsCanvasFlag.ts`:
 *   1. URL query `?ff_whiteboardSessionInPanel=0|1` — operator bypass.
 *   2. `localStorage["ff.whiteboard_session_in_panel"]` — user/org override.
 *   3. `import.meta.env.VITE_WHITEBOARD_SESSION_IN_PANEL` — build-time override.
 *   4. Default: OFF — zmiana układu wymaga akceptu Piotra na zrzutach
 *      (CLAUDE.md #7); pozostaje floating overlay dopóki nie zaakceptuje.
 */

const LS_KEY = 'ff.whiteboard_session_in_panel';
const QUERY_KEY = 'ff_whiteboardSessionInPanel';
const ENV_KEY = 'VITE_WHITEBOARD_SESSION_IN_PANEL';

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
export function isWhiteboardSessionInPanelEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const WHITEBOARD_SESSION_IN_PANEL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;

/** DOM id of the mount point rendered by `IdeaWorkspaceTools` inside the
 * whiteboard "Inspektor tablicy" Section (Właściwości tab). `IdeaWhiteboardTool`
 * portals `WhiteboardSessionPanel` into this node when the flag is ON. */
export const WHITEBOARD_SESSION_PANEL_SLOT_ID = 'whiteboard-session-panel-slot';
