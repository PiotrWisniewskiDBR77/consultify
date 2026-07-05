/**
 * HARVARD H3 — Tools → Conclusions (Wnioski) sync contract.
 *
 * The Outputs/Wnioski surface lists conclusions synced from approved tool
 * sessions by ConclusionService.syncToolOutputs. Real chain break fixed here:
 * the sync SELECTed the `output_json` column, which is NOT part of the base
 * tool_sessions schema (it is added lazily / by demo seeds). On any database
 * without that column the whole query threw and the `.catch(() => [])`
 * swallowed it — every tool conclusion for the org silently disappeared
 * ("optional column = silent empty list" failure mode).
 *
 * This test runs the REAL service SQL against in-memory SQLite with a
 * tool_sessions table deliberately created WITHOUT output_json and proves an
 * approved session still materializes as a conclusion — with the consultant
 * summary (answers.summary.executiveSummary) as the statement, not a raw
 * JSON dump.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

// ---- Real in-memory SQLite behind the queryHelpers seam --------------------
const sqliteCtx = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('sqlite3') as typeof import('sqlite3');
  return { db: new sqlite3.Database(':memory:') };
});

const sqlAll = <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> =>
  new Promise((resolve, reject) => {
    sqliteCtx.db.all(sql, params, (err: Error | null, rows: unknown[]) =>
      err ? reject(err) : resolve((rows || []) as T[])
    );
  });
const sqlGet = <T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> =>
  new Promise((resolve, reject) => {
    sqliteCtx.db.get(sql, params, (err: Error | null, row: unknown) =>
      err ? reject(err) : resolve((row || null) as T | null)
    );
  });
const sqlRun = (sql: string, params: unknown[] = []): Promise<{ changes: number }> =>
  new Promise((resolve, reject) => {
    sqliteCtx.db.run(sql, params, function (this: { changes: number }, err: Error | null) {
      if (err) return reject(err);
      resolve({ changes: this.changes });
    });
  });

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (sql: string, params: unknown[] = []) => sqlAll(sql, params),
  queryOne: (sql: string, params: unknown[] = []) => sqlGet(sql, params),
  queryRun: (sql: string, params: unknown[] = []) => sqlRun(sql, params),
  getTableColumns: async (tableName: string) => {
    const safe = String(tableName).replace(/[^a-zA-Z0-9_]/g, '');
    return sqlAll<{ name: string }>(`PRAGMA table_info(${safe})`);
  },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ORG = 'org-wnioski-1';
const USER = 'user-wnioski-1';

describe('H3 tools → conclusions sync (output_json column absent)', () => {
  beforeAll(async () => {
    // Base tool_sessions schema WITHOUT output_json — the shape of any
    // database that never ran a seed or the lazy ALTER.
    await sqlRun(
      `CREATE TABLE tool_sessions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        tool_type TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'DRAFT',
        completion_percent INTEGER DEFAULT 0,
        confidence_avg REAL DEFAULT 0,
        answers_json TEXT DEFAULT '{}',
        context_snapshot TEXT DEFAULT '{}',
        created_by TEXT,
        updated_at TEXT
      )`
    );
    await sqlRun(
      `INSERT INTO tool_sessions (
        id, organization_id, project_id, tool_type, name, status,
        completion_percent, confidence_avg, answers_json, context_snapshot, created_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'ts-approved-1',
        ORG,
        null,
        'dynamic-swot',
        'SWOT — Acme growth review',
        'APPROVED',
        100,
        4,
        JSON.stringify({
          signals: [{ id: 's1', text: 'Strong EU brand', quadrant: 'strength' }],
          summary: {
            executiveSummary: 'Prioritize EU expansion while modernizing order-to-cash.',
          },
        }),
        JSON.stringify({ org: { name: 'Acme' } }),
        USER,
        new Date().toISOString(),
      ]
    );
  });

  it('an approved tool session materializes as a conclusion despite the missing column', async () => {
    const { conclusionService } = await import(
      '../../../server/src/services/conclusions/ConclusionService.js'
    );

    const synced = await conclusionService.syncToolOutputs(ORG, USER);
    // Pre-fix: SELECT threw on the missing output_json column and the sync
    // silently returned 0 — the Wnioski list stayed empty.
    expect(synced).toBe(1);

    const conclusion = await sqlGet<{
      title: string;
      statement: string;
      status: string;
      source_module: string;
      source_artifact_refs_json: string;
    }>(`SELECT * FROM conclusions WHERE organization_id = ? AND source_module = 'tools'`, [ORG]);

    expect(conclusion).toBeTruthy();
    expect(conclusion?.title).toBe('SWOT — Acme growth review');
    // Consultant-facing summary, not a raw JSON snapshot dump.
    expect(conclusion?.statement).toBe(
      'Prioritize EU expansion while modernizing order-to-cash.'
    );
    // APPROVED source → published conclusion, traceable back to the session.
    expect(conclusion?.status).toBe('published');
    expect(conclusion?.source_artifact_refs_json).toContain('"ts-approved-1"');
  });

  it('re-sync is idempotent (upsert, no duplicate conclusions)', async () => {
    const { conclusionService } = await import(
      '../../../server/src/services/conclusions/ConclusionService.js'
    );
    await conclusionService.syncToolOutputs(ORG, USER);
    const rows = await sqlAll(
      `SELECT id FROM conclusions WHERE organization_id = ? AND source_module = 'tools'`,
      [ORG]
    );
    expect(rows).toHaveLength(1);
  });
});
