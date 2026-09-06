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
 * OFF → `PresentationsHub` renders byte-identical to pre-flag state (no
 * "Architekt szablonów" tab/button). ON (default) → the tab appears.
 *
 * Kolejność (wygrywa najwyższe):
 *   1. URL query `?ff_deck_architect=0|1` — bypass operatora / dev / dev-render.
 *   2. `localStorage["ff.deckArchitect"]` — override user / org.
 *   3. `import.meta.env.VITE_DECK_ARCHITECT_ENABLED` — build-time.
 *   4. Default: ON (flip fb119cefe8, akcept Piotra 2026-07-22; UWAGA: decyzja
 *      architekta D6 z 2026-07-24 postuluje OFF — konflikt do rozstrzygnięcia
 *      przez Piotra, nie zmieniaj defaultu bez jego słowa).
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
    const parsed = parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
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
