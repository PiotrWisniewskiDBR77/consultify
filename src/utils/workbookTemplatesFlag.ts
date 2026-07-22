/**
 * Excel Workbook Template Library reveal flag (2026-07-22).
 *
 * `ExceleParametricTemplates` (rejestr parametrycznych szablonów Excela,
 * `POST /api/workbook/templates/:id/build`) jest dziś osiągalny WYŁĄCZNIE
 * wewnątrz widoku czatu pod `/excele` (ArtifactModuleHome) — brak osobnego
 * wejścia "Generator szablonów Excel" w Outputs Library, jak ma Deck
 * (zakładka `template_architect`) i Word. Ta flaga odsłania analogiczną
 * zakładkę huba (`workbook_templates`) w `ReportsAndPresentationsHub` bez
 * ruszania niczego na żywca.
 *
 * Mirrors `src/utils/deckArchitectFlag.ts`'s reveal-flag pattern so the new
 * tab can be built and reviewed WITHOUT going live for every user first
 * (canon: "Piotr nigdy nie jest pierwszym testerem wizualnym").
 *
 * OFF (default) → `ReportsAndPresentationsHub` renders byte-identical to
 * today (no "Generator szablonów Excel" tab). ON → the tab appears.
 *
 * Kolejność (wygrywa najwyższe):
 *   1. URL query `?ff_workbook_templates=0|1` — bypass operatora / dev / dev-render.
 *   2. `localStorage["ff.workbookTemplates"]` — override user / org.
 *   3. `import.meta.env.VITE_WORKBOOK_TEMPLATES_ENABLED` — build-time.
 *   4. Default: OFF.
 */

const LS_KEY = 'ff.workbookTemplates';
const QUERY_KEY = 'ff_workbook_templates';
const ENV_KEY = 'VITE_WORKBOOK_TEMPLATES_ENABLED';

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

export function isWorkbookTemplatesEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const WORKBOOK_TEMPLATES_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
