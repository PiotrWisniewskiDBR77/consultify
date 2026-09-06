/**
 * M03 Inbox (flat mode) → StandardTable grouped-rows (kanon TRIADA §27).
 *
 * `InboxContent`'s `flat` view mode renders a bespoke HTML table with
 * dedup-group expand/collapse (see `renderRow`/`renderFlatView`, `groupItems`,
 * `expandedGroups`) — a mechanic `StandardTable`/`FilterableTable` never had
 * to support before this migration. The new render flattens each dedup group
 * into a representative row + (when expanded) its child rows, all fed as
 * plain `StandardTable` rows (`rowClassName` for state layering — kanon
 * ANEKS, `StandardTable.tsx` §"grouped-rows layouts jak Inbox").
 *
 * Wizualnie NOWY (natywny Settings2 popover, natywne lejki filtrów per
 * kolumna, StandardTable's own kebab/selection chrome) → domyślnie OFF
 * (reguła #7/#9: nic wizualnie nowego nie idzie na żywo bez zrzutu i akceptu
 * Piotra). Legacy bespoke table markup (renderFlatView) remains the default
 * render — zero change to data/grouping/keyboard-nav logic underneath;
 * flipping this flag ON only swaps the flat-mode render target. Sections
 * (card grid) view is UNTOUCHED regardless of this flag.
 *
 * Resolution order (highest wins), identical contract to
 * `m03TasksStandardTableFlag.ts`:
 *   1. URL query `?ff_m03InboxStandardTable=0|1` — bypass operatora (staging / zrzut).
 *   2. `localStorage["ff.m03_inbox_standard_table"]` — override user/org.
 *   3. `import.meta.env.VITE_M03_INBOX_STANDARD_TABLE` — override build-time.
 *   4. Default: ON (flip 2026-07-16, akcept Piotra).
 */

const LS_KEY = 'ff.m03_inbox_standard_table';
const QUERY_KEY = 'ff_m03InboxStandardTable';
const ENV_KEY = 'VITE_M03_INBOX_STANDARD_TABLE';

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
    return parsed === null ? true : parsed; // FLIP ON — akcept Piotra 07-16
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

export function isM03InboxStandardTableEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const M03_INBOX_STANDARD_TABLE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
