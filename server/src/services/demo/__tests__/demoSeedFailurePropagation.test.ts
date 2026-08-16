/**
 * MAT-006B round 2 — a partially-seeded demo dataset must SAY it is partial.
 *
 * The failure this locks down is not a crash; it is a silence. Before this,
 * `seedAtelierToysDemoDataset` logged a deck-stage failure and then returned a
 * result object indistinguishable from a perfect run — same counts, no error
 * channel. Demo-session entry read that object, saw nothing wrong, and handed a
 * presenter a workspace whose Materials station was empty. The same shape of
 * silent failure hid the broken mail channel in this codebase for weeks.
 *
 * Anti-false-green: `presentation_decks` is backed by REAL in-memory SQLite
 * (including the live status CHECK), so the "healthy run" case is a genuine
 * write-and-read-back, not a stub answering yes. Every other table goes to a
 * capture stub — this suite is about the deck stage's error channel, not about
 * re-testing the whole spine.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ctx = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('sqlite3') as typeof import('sqlite3');
  return {
    db: new sqlite3.Database(':memory:'),
    /** When false, the schema probe answers "presentation_decks is not there". */
    presentationDecksExist: true,
    /** When true, the fake database refuses every write to presentation_decks. */
    rejectDeckWrites: false,
    writes: [] as Array<{ sql: string; params: unknown[] }>,
  };
});

vi.mock('../../../utils/DbPromise.js', () => {
  const isDeckSql = (sql: string) => /presentation_decks/i.test(sql);
  const sqliteGet = (sql: string, params: unknown[]) =>
    new Promise<unknown>((resolve, reject) => {
      ctx.db.get(sql, params, (err: Error | null, row: unknown) =>
        err ? reject(err) : resolve(row || null)
      );
    });
  const sqliteRun = (sql: string, params: unknown[] = []) =>
    new Promise<void>((resolve, reject) => {
      ctx.db.run(sql, params, (err: Error | null) => (err ? reject(err) : resolve()));
    });

  const get = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (/information_schema\.tables/i.test(sql)) {
      const probed = String((params as unknown[])[0] ?? '');
      if (probed === 'presentation_decks' && !ctx.presentationDecksExist) {
        return { exists: false };
      }
      return { exists: true };
    }
    if (/information_schema\.columns/i.test(sql)) return { exists: true };
    if (isDeckSql(sql)) return sqliteGet(sql, params);
    return null;
  });

  const all = vi.fn(async () => []);

  const run = vi.fn(
    async (sql: string, params: unknown[] = [], options?: { fallback?: boolean }) => {
      if (isDeckSql(sql)) {
        if (ctx.rejectDeckWrites) {
          if (options?.fallback === false) throw new Error('refused write to presentation_decks');
          return { success: false, error: 'refused write to presentation_decks' };
        }
        await sqliteRun(sql, params);
        return { success: true, changes: 1 };
      }
      ctx.writes.push({ sql, params });
      return { success: true, changes: 1 };
    }
  );

  const transaction = vi.fn(async (statements: Array<{ sql: string; params: unknown[] }> = []) => {
    try {
      await sqliteRun('BEGIN TRANSACTION');
      for (const stmt of statements) {
        if (isDeckSql(stmt.sql) && ctx.rejectDeckWrites) {
          throw new Error('refused write to presentation_decks');
        }
        ctx.writes.push(stmt);
        await sqliteRun(stmt.sql, stmt.params);
      }
      await sqliteRun('COMMIT');
      return { success: true, results: [] };
    } catch (error) {
      try {
        await sqliteRun('ROLLBACK');
      } catch {
        /* nothing to roll back */
      }
      return { success: false, error: (error as Error).message, results: [] };
    }
  });

  return {
    get,
    all,
    run,
    transaction,
    tableExists: vi.fn(async () => true),
    columnExists: vi.fn(async () => true),
    exec: vi.fn(async () => ({ success: true })),
    safeAll: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    DbPromise: {},
    default: {},
  };
});

vi.mock('../../organizationContext/OrganizationContextService.js', () => ({
  organizationContextService: {
    recordContextSource: vi.fn(async () => undefined),
    rebuildSnapshot: vi.fn(async () => undefined),
  },
}));

import { seedAtelierToysDemoDataset } from '../demoSeedService.js';

const ORG_ID = 'demo-atelier-failure-propagation';
const ANCHOR = '2026-06-01T00:00:00.000Z';

function exec(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ctx.db.exec(sql, (err: Error | null) => (err ? reject(err) : resolve()));
  });
}

beforeAll(() =>
  exec(
    `CREATE TABLE IF NOT EXISTS presentation_decks (
       id TEXT PRIMARY KEY,
       organization_id TEXT, title TEXT, description TEXT,
       template_id TEXT NOT NULL DEFAULT 'default',
       deck_type TEXT, audience TEXT, goal TEXT, language TEXT, confidentiality TEXT,
       theme TEXT, presentation_mode TEXT, source_type TEXT, source_id TEXT,
       source_artifacts TEXT, outline_json TEXT, unified_json TEXT, deck_json TEXT,
       source_refs_json TEXT, slide_count INTEGER DEFAULT 0, status TEXT,
       generated_by TEXT, created_by TEXT, version INTEGER NOT NULL DEFAULT 1,
       created_at TIMESTAMP, updated_at TIMESTAMP,
       CHECK (status IN ('draft', 'generating', 'ready', 'exported', 'failed'))
     );`
  )
);

beforeEach(async () => {
  ctx.presentationDecksExist = true;
  ctx.rejectDeckWrites = false;
  ctx.writes.length = 0;
  await exec('DELETE FROM presentation_decks');
});

describe('seedAtelierToysDemoDataset — failure propagation', () => {
  it('reports complete: true and a deck count on a healthy run', async () => {
    const result = await seedAtelierToysDemoDataset({
      organizationId: ORG_ID,
      anchorDate: ANCHOR,
      locale: 'en',
    });

    expect(result.failures).toEqual([]);
    expect(result.complete).toBe(true);
    expect(result.counts.decks).toBe(3);
    // Guard the premise: the other stages really did run, so `complete: true`
    // here is not the vacuous truth of a seed that did nothing.
    expect(result.counts.initiatives).toBeGreaterThan(0);
  });

  it('reports complete: false with a populated failures[] when the deck stage fails', async () => {
    ctx.presentationDecksExist = false;

    const result = await seedAtelierToysDemoDataset({
      organizationId: ORG_ID,
      anchorDate: ANCHOR,
      locale: 'en',
    });

    // ★ The whole point: the caller can SEE the partial dataset in the result.
    expect(result.complete).toBe(false);
    expect(result.failures.length).toBe(3);
    expect(result.failures.every((f) => f.stage === 'presentation_decks')).toBe(true);
    expect(result.failures.every((f) => /does not exist/i.test(f.detail))).toBe(true);
    expect(result.failures.map((f) => f.detail).join(' ')).toContain(`${ORG_ID}--deck--`);
    expect(result.counts.decks).toBe(0);
    // The rest of the spine still seeded — this is a PARTIAL failure, and the
    // counts must not be zeroed out or the report would be its own lie.
    expect(result.counts.initiatives).toBeGreaterThan(0);
  });

  it('reports complete: false, and writes nothing, when the deck transaction rolls back', async () => {
    ctx.rejectDeckWrites = true;

    const result = await seedAtelierToysDemoDataset({
      organizationId: ORG_ID,
      anchorDate: ANCHOR,
      locale: 'en',
    });

    expect(result.complete).toBe(false);
    expect(result.counts.decks).toBe(0);
    expect(result.failures.length).toBe(3);
    expect(result.failures.every((f) => /rolled back/i.test(f.detail))).toBe(true);

    const stored = await new Promise<unknown[]>((resolve, reject) => {
      ctx.db.all('SELECT id FROM presentation_decks', [], (err: Error | null, r: unknown[]) =>
        err ? reject(err) : resolve(r || [])
      );
    });
    expect(stored.length).toBe(0);
  });
});
