/**
 * Case Workspace routes — shared cursor-pagination helpers.
 *
 * Only one domain function in the 11 services natively paginates
 * (playService.listProcessDefinitions), using an opaque
 * `${createdAt}::${id}` keyset cursor over `ORDER BY created_at DESC, id
 * DESC`. Every other list-shaped function in this codebase's caseWorkspace
 * services returns a plain, already-sorted array with no cursor concept at
 * all (pre-retrofit). `paginateSortedArray` applies the SAME cursor shape at
 * the route layer for those, so every case-workspace list endpoint has a
 * consistent `?cursor=&limit=` contract regardless of which layer actually
 * performs the pagination.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function parseLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

export function parseCursor(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Applies a `${sortValue}::${id}` keyset cursor to an array that is ALREADY
 * sorted descending by `sortField` (every list* function in this codebase's
 * caseWorkspace services orders this way). Items strictly after the cursor
 * position (in the same descending order) are kept, then sliced to `limit`.
 */
export function paginateSortedArray<T extends Record<string, unknown>>(
  items: T[],
  opts: { sortField: keyof T; idField: keyof T; cursor?: string; limit: number }
): PaginatedResult<T> {
  let working = items;
  if (opts.cursor) {
    const separatorIndex = opts.cursor.lastIndexOf('::');
    const cursorSortValue = separatorIndex >= 0 ? opts.cursor.slice(0, separatorIndex) : '';
    const cursorId = separatorIndex >= 0 ? opts.cursor.slice(separatorIndex + 2) : '';
    working = items.filter((item) => {
      const sortValue = String(item[opts.sortField]);
      const id = String(item[opts.idField]);
      if (sortValue !== cursorSortValue) return sortValue < cursorSortValue;
      return id < cursorId;
    });
  }

  const hasMore = working.length > opts.limit;
  const page = hasMore ? working.slice(0, opts.limit) : working;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? `${String(last[opts.sortField])}::${String(last[opts.idField])}` : null;
  return { items: page, nextCursor };
}
