/**
 * Deck Template Architect reveal flag (Epic C2/C4, 2026-07-22).
 *
 * `PresentationTemplateArchitectView` is a NEW frontend surface for the
 * already-working backend (`POST /api/presentations/templates/plan`,
 * `PUT /api/presentations/templates/:id`) — see
 * `Harvard/wdrozenie-100/_HANDOFF_FALA_B_GENERATORY_TEMPLATE_2026-07-22.md`.
 * Mirrors `src/utils/exceleFlag.ts`'s reveal-flag pattern so the new tab in
 * `PresentationsHub` can be built and reviewed WITHOUT going live for every
 * user first (canon: "Piotr nigdy nie jest pierwszym testerem wizualnym").
 *
 * OFF (default) → `PresentationsHub` renders byte-identical to today (no
 * "Architekt szablonów" tab/button). ON → the tab appears.
 *
 * Kolejność (wygrywa najwyższe):
 *   1. URL query `?ff_deck_architect=0|1` — bypass operatora / dev / dev-render.
 *   2. `localStorage["ff.deckArchitect"]` — override user / org.
 *   3. `import.meta.env.VITE_DECK_ARCHITECT_ENABLED` — build-time.
 *   4. Default: OFF.
 */

const LS_KEY = 'ff.deckArchitect';
const QUERY_KEY = 'ff_deck_architect';
const ENV_KEY = 'VITE_DECK_ARCHITECT_ENABLED';

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

export function isDeckArchitectEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const DECK_ARCHITECT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
