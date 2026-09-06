/**
 * M03 Tasks → StandardTable (kanon TRIADA §27, decyzja Piotra #5).
 *
 * `MyTasksListContent`'s bespoke `<table>` (custom `TaskTableRow`, hand-rolled
 * resize/filter/sort/column-visibility) is migrated to the canonical
 * `StandardTable` facade — the same component `DecisionsPanelContent` already
 * uses in this module. The new StandardTable render is wizualnie NOWY
 * (natywny Settings2 popover, natywne lejki filtrów, StandardTable's own
 * selected/hover row treatment layered with `rowClassName` for
 * bulk-select/preview/focus/completed states) → domyślnie OFF (reguła #7/#9:
 * nic wizualnie nowego nie idzie na żywo bez zrzutu i akceptu Piotra). The
 * legacy `<table>` remains the default render; flipping this flag ON swaps
 * to StandardTable with ZERO change to data/filtering/sort logic underneath.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_m03TasksStandardTable=0|1` — bypass operatora (staging / zrzut).
 *   2. `localStorage["ff.m03_tasks_standard_table"]` — override user/org.
 *   3. `import.meta.env.VITE_M03_TASKS_STANDARD_TABLE` — override build-time.
 *   4. Default: ON (flip 2026-07-15, akcept Piotra).
 */

const LS_KEY = 'ff.m03_tasks_standard_table';
const QUERY_KEY = 'ff_m03TasksStandardTable';
const ENV_KEY = 'VITE_M03_TASKS_STANDARD_TABLE';

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
    return parsed === null ? true : parsed; // AKCEPT Piotra 2026-07-15 — default ON
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

export function isM03TasksStandardTableEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const M03_TASKS_STANDARD_TABLE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
