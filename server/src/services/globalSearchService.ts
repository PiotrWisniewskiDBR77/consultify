/**
 * Global (cross-module) search service — HARVARD H6.12.
 *
 * Pragmatic v1: name/title search across the org's key entities
 * (initiatives, tasks, decisions, ideas, notes, M17 artifacts, assessments)
 * in a single org-scoped query fan-out. Feeds the Cmd+K CommandPalette.
 *
 * Design notes:
 *  - Org-scoped: every source filters `organization_id = $orgId`. No cross-org leak.
 *  - Schema-drift safe: each source is gated by getTableColumns() at runtime so a
 *    missing table/column (staging vs prod drift) degrades to "skip this type"
 *    instead of a 500. See MEMORY: subquery-optional-table + settings-500-lazy-DDL.
 *  - ILIKE on the title column with a per-type limit; results merged + capped.
 */

import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';

export type GlobalSearchEntityType =
  | 'initiative'
  | 'task'
  | 'decision'
  | 'idea'
  | 'note'
  | 'artifact'
  | 'assessment';

export interface GlobalSearchHit {
  type: GlobalSearchEntityType;
  id: string;
  title: string;
  /** ISO-ish timestamp string used for recency ordering; may be null. */
  updatedAt: string | null;
}

export interface GlobalSearchResult {
  query: string;
  total: number;
  groups: Partial<Record<GlobalSearchEntityType, GlobalSearchHit[]>>;
}

interface SearchSource {
  type: GlobalSearchEntityType;
  table: string;
  /** column that holds the human-readable name/title */
  titleCol: string;
  /** column used for recency ordering (falls back to created_at) */
  orderCol: string;
}

/**
 * Static entity→table map. Kept in one place so the route + tests share it.
 * Each entry is validated against the live schema before use.
 */
export const SEARCH_SOURCES: SearchSource[] = [
  { type: 'initiative', table: 'initiatives', titleCol: 'name', orderCol: 'updated_at' },
  { type: 'task', table: 'tasks', titleCol: 'title', orderCol: 'updated_at' },
  { type: 'decision', table: 'decisions', titleCol: 'title', orderCol: 'updated_at' },
  { type: 'idea', table: 'my_ideas', titleCol: 'title', orderCol: 'updated_at' },
  { type: 'note', table: 'notebook_pages', titleCol: 'title', orderCol: 'updated_at' },
  {
    type: 'artifact',
    table: 'v8_output_artifacts',
    titleCol: 'title_snapshot',
    orderCol: 'created_at',
  },
  { type: 'assessment', table: 'assessments', titleCol: 'name', orderCol: 'updated_at' },
];

/** Max hits returned per entity type. */
export const PER_TYPE_LIMIT = 5;
/** Max total hits across all types. */
export const TOTAL_LIMIT = 30;

/**
 * Escape LIKE/ILIKE wildcards so a user typing `%` or `_` searches literally.
 * Pairs with `ESCAPE '\'` in the SQL.
 */
export function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Normalize + bound the raw query string. Returns '' when unusable. */
export function normalizeQuery(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (trimmed.length < 2) return ''; // avoid unbounded 1-char scans
  return trimmed.slice(0, 128);
}

type DbLike = {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows?: T[] } | undefined>;
};

/**
 * Resolve which sources are actually usable against the live schema.
 * A source is usable when its table exposes organization_id + the title column.
 */
async function resolveUsableSources(): Promise<
  Array<SearchSource & { hasOrderCol: boolean; idCol: string }>
> {
  const usable: Array<SearchSource & { hasOrderCol: boolean; idCol: string }> = [];
  for (const src of SEARCH_SOURCES) {
    let cols: Set<string>;
    try {
      cols = await getTableColumns(src.table);
    } catch (err) {
      logger.warn?.('[globalSearch] getTableColumns failed; skipping source', {
        table: src.table,
        error: (err as Error)?.message,
      });
      continue;
    }
    if (!cols || cols.size === 0) continue;
    if (!cols.has('organization_id')) continue;
    if (!cols.has(src.titleCol)) continue;
    // v8_output_artifacts uses artifact_id as PK; everything else uses id.
    const idCol = cols.has('id') ? 'id' : cols.has('artifact_id') ? 'artifact_id' : '';
    if (!idCol) continue;
    usable.push({ ...src, hasOrderCol: cols.has(src.orderCol), idCol });
  }
  return usable;
}

/**
 * Run the org-scoped cross-entity search.
 *
 * @param db     an object exposing `query(sql, params) -> { rows }` (Postgres, $-placeholders)
 * @param orgId  organization id from the authenticated session
 * @param rawQuery the user's search string
 */
export async function runGlobalSearch(
  db: DbLike,
  orgId: string,
  rawQuery: unknown
): Promise<GlobalSearchResult> {
  const query = normalizeQuery(rawQuery);
  if (!query || !orgId) {
    return { query: typeof rawQuery === 'string' ? rawQuery.trim() : '', total: 0, groups: {} };
  }

  const pattern = `%${escapeLikePattern(query)}%`;
  const sources = await resolveUsableSources();

  const groups: Partial<Record<GlobalSearchEntityType, GlobalSearchHit[]>> = {};
  let total = 0;

  await Promise.all(
    sources.map(async (src) => {
      const orderExpr = src.hasOrderCol ? src.orderCol : src.titleCol;
      // Postgres ILIKE is case-insensitive; ESCAPE keeps user wildcards literal.
      const sql = `
        SELECT ${src.idCol} AS id,
               ${src.titleCol} AS title,
               ${src.hasOrderCol ? src.orderCol : 'NULL'} AS updated_at
          FROM ${src.table}
         WHERE organization_id = $1
           AND ${src.titleCol} ILIKE $2 ESCAPE '\\'
      ORDER BY ${orderExpr} DESC NULLS LAST
         LIMIT ${PER_TYPE_LIMIT}
      `;
      try {
        const res = await db.query<{ id: unknown; title: unknown; updated_at: unknown }>(sql, [
          orgId,
          pattern,
        ]);
        const rows = res?.rows ?? [];
        const hits: GlobalSearchHit[] = rows
          .filter((r) => r && r.id != null && r.title != null && String(r.title).trim() !== '')
          .map((r) => ({
            type: src.type,
            id: String(r.id),
            title: String(r.title),
            updatedAt: r.updated_at == null ? null : String(r.updated_at),
          }));
        if (hits.length > 0) {
          groups[src.type] = hits;
          total += hits.length;
        }
      } catch (err) {
        // One bad source must not sink the whole search.
        logger.warn?.('[globalSearch] source query failed; skipping', {
          type: src.type,
          table: src.table,
          error: (err as Error)?.message,
        });
      }
    })
  );

  // Enforce a hard total cap while preserving per-type grouping.
  if (total > TOTAL_LIMIT) {
    let remaining = TOTAL_LIMIT;
    const capped: Partial<Record<GlobalSearchEntityType, GlobalSearchHit[]>> = {};
    for (const src of SEARCH_SOURCES) {
      const hits = groups[src.type];
      if (!hits || remaining <= 0) continue;
      const take = hits.slice(0, remaining);
      capped[src.type] = take;
      remaining -= take.length;
    }
    return { query, total: TOTAL_LIMIT, groups: capped };
  }

  return { query, total, groups };
}

export default { runGlobalSearch, normalizeQuery, escapeLikePattern, SEARCH_SOURCES };
