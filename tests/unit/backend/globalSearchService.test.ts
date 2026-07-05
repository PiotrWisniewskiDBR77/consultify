/**
 * Unit tests for globalSearchService (HARVARD H6.12).
 *
 * Covers: query normalization, LIKE-wildcard escaping, org-scoping,
 * per-type + total caps, schema-drift gating (missing table/column),
 * and per-source failure isolation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the schema-introspection util so tests control which sources are "usable".
const mockGetTableColumns = vi.fn();
vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: (t: string) => mockGetTableColumns(t),
}));

// Silence logger.
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import {
  escapeLikePattern,
  normalizeQuery,
  PER_TYPE_LIMIT,
  runGlobalSearch,
  SEARCH_SOURCES,
  TOTAL_LIMIT,
} from '../../../server/src/services/globalSearchService.js';

// Full column set that makes every source usable.
const FULL_COLS = new Set([
  'id',
  'artifact_id',
  'organization_id',
  'name',
  'title',
  'title_snapshot',
  'updated_at',
  'created_at',
]);

describe('globalSearchService — pure helpers', () => {
  it('normalizeQuery trims, rejects <2 chars, caps at 128', () => {
    expect(normalizeQuery('  hello  ')).toBe('hello');
    expect(normalizeQuery('a')).toBe('');
    expect(normalizeQuery('')).toBe('');
    expect(normalizeQuery(42 as unknown)).toBe('');
    expect(normalizeQuery('x'.repeat(200)).length).toBe(128);
  });

  it('escapeLikePattern escapes %, _ and backslash', () => {
    expect(escapeLikePattern('50%_off')).toBe('50\\%\\_off');
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
    expect(escapeLikePattern('plain')).toBe('plain');
  });
});

describe('runGlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTableColumns.mockResolvedValue(FULL_COLS);
  });

  it('returns empty result for too-short / missing query without hitting DB', async () => {
    const db = { query: vi.fn() };
    const res = await runGlobalSearch(db as any, 'org-1', 'a');
    expect(res.total).toBe(0);
    expect(res.groups).toEqual({});
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns empty when orgId missing', async () => {
    const db = { query: vi.fn() };
    const res = await runGlobalSearch(db as any, '', 'roadmap');
    expect(res.total).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('scopes every query by organization_id and uses an escaped ILIKE pattern', async () => {
    const db = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    await runGlobalSearch(db as any, 'org-42', '50%');
    expect(db.query).toHaveBeenCalled();
    for (const call of db.query.mock.calls) {
      const [sql, params] = call as [string, unknown[]];
      expect(sql).toContain('organization_id = $1');
      expect(sql).toContain('ILIKE $2');
      expect(params[0]).toBe('org-42');
      // wildcard % escaped inside the pattern
      expect(params[1]).toBe('%50\\%%');
    }
  });

  it('groups hits by entity type and counts total', async () => {
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM initiatives')) {
          return { rows: [{ id: 'i1', title: 'Init One', updated_at: '2026-01-01' }] };
        }
        if (sql.includes('FROM tasks')) {
          return {
            rows: [
              { id: 't1', title: 'Task A', updated_at: '2026-02-01' },
              { id: 't2', title: 'Task B', updated_at: '2026-02-02' },
            ],
          };
        }
        return { rows: [] };
      }),
    };
    const res = await runGlobalSearch(db as any, 'org-1', 'roadmap');
    expect(res.total).toBe(3);
    expect(res.groups.initiative).toHaveLength(1);
    expect(res.groups.task).toHaveLength(2);
    expect(res.groups.initiative?.[0]).toMatchObject({ type: 'initiative', id: 'i1' });
  });

  it('drops rows with empty/null titles', async () => {
    const db = {
      query: vi.fn(async (sql: string) =>
        sql.includes('FROM initiatives')
          ? {
              rows: [
                { id: 'i1', title: '   ', updated_at: null },
                { id: 'i2', title: 'Good', updated_at: null },
              ],
            }
          : { rows: [] }
      ),
    };
    const res = await runGlobalSearch(db as any, 'org-1', 'thing');
    expect(res.groups.initiative).toHaveLength(1);
    expect(res.groups.initiative?.[0].id).toBe('i2');
  });

  it('skips a source whose table is missing organization_id (schema drift)', async () => {
    mockGetTableColumns.mockImplementation(async (t: string) =>
      t === 'my_ideas' ? new Set(['id', 'title']) : FULL_COLS
    );
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    await runGlobalSearch(db as any, 'org-1', 'idea');
    const tablesQueried = db.query.mock.calls.map((c) => c[0] as string).join('\n');
    expect(tablesQueried).not.toContain('FROM my_ideas');
    // other sources still queried
    expect(tablesQueried).toContain('FROM initiatives');
  });

  it('isolates a failing source without sinking the whole search', async () => {
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM tasks')) throw new Error('boom');
        if (sql.includes('FROM initiatives')) {
          return { rows: [{ id: 'i1', title: 'Ok', updated_at: null }] };
        }
        return { rows: [] };
      }),
    };
    const res = await runGlobalSearch(db as any, 'org-1', 'query');
    expect(res.groups.initiative).toHaveLength(1);
    expect(res.groups.task).toBeUndefined();
  });

  it('caps total results at TOTAL_LIMIT', async () => {
    const many = (prefix: string) =>
      Array.from({ length: PER_TYPE_LIMIT }, (_, i) => ({
        id: `${prefix}${i}`,
        title: `${prefix} ${i}`,
        updated_at: null,
      }));
    const db = {
      query: vi.fn(async () => ({ rows: many('x') })),
    };
    const res = await runGlobalSearch(db as any, 'org-1', 'many');
    // 7 sources * PER_TYPE_LIMIT would exceed TOTAL_LIMIT
    expect(SEARCH_SOURCES.length * PER_TYPE_LIMIT).toBeGreaterThan(TOTAL_LIMIT);
    expect(res.total).toBe(TOTAL_LIMIT);
    const counted = Object.values(res.groups).reduce((n, arr) => n + (arr?.length ?? 0), 0);
    expect(counted).toBe(TOTAL_LIMIT);
  });

  it('uses artifact_id as id column for v8_output_artifacts', async () => {
    // Real v8_output_artifacts has no `id` column — PK is artifact_id.
    mockGetTableColumns.mockImplementation(async (t: string) =>
      t === 'v8_output_artifacts'
        ? new Set(['artifact_id', 'organization_id', 'title_snapshot', 'created_at'])
        : FULL_COLS
    );
    const db = {
      query: vi.fn(async (sql: string) =>
        sql.includes('FROM v8_output_artifacts')
          ? { rows: [{ id: 'a1', title: 'Deck', updated_at: null }] }
          : { rows: [] }
      ),
    };
    await runGlobalSearch(db as any, 'org-1', 'deck');
    const artifactSql = db.query.mock.calls
      .map((c) => c[0] as string)
      .find((s) => s.includes('FROM v8_output_artifacts'));
    expect(artifactSql).toContain('artifact_id AS id');
    expect(artifactSql).toContain('title_snapshot AS title');
  });
});
