/**
 * EE / Deliverables unification — feature flag for the DeckBuilder MELS
 * shell migration (WS-A4).
 *
 * Where this flag gates
 * ---------------------
 *   * `<DeckBuilder>` branches between the legacy custom 3-panel layout
 *     and the new `<DeckBuilderMelsView>` (`ExecutiveModuleShell`
 *     adapter) when this flag is ON.
 *   * The adapter is presentational only — it consumes the same deck
 *     state + handlers, so flipping the flag is a pure UI swap with no
 *     data-path change (mirrors `melsTabeleFlag`).
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_melsDeckBuilder=0|1` — operator bypass for staging /
 *      visual-review smoke runs.
 *   2. `localStorage["ff.mels_deck_builder"]` — user / org override.
 *   3. `import.meta.env.VITE_MELS_DECK_BUILDER` — build-time override.
 *   4. Default: ON (Module 12 audit gap #4). The EE ExecutiveModuleShell
 *      adapter passed visual review, so it is now the default DeckBuilder
 *      surface for shell consistency. Set any override to `0` to fall back
 *      to the legacy 3-panel layout.
 */

const LS_KEY = 'ff.mels_deck_builder';
const QUERY_KEY = 'ff_melsDeckBuilder';
const ENV_KEY = 'VITE_MELS_DECK_BUILDER';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  // Default ON: when no build-time override is set, the MELS shell is the
  // default DeckBuilder surface. An explicit `0`/`false` env value opts out.
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

export function isMelsDeckBuilderEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const MELS_DECK_BUILDER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
