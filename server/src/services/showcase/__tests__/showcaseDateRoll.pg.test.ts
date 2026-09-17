/** @vitest-environment node */
/**
 * SR-1 v3 (Wpis 62) — declaration-vs-real-type matrix on a COPY of the staging
 * dump. The live staging schema is NOT produced by the migrations alone, so 7 of
 * the 47 declared columns carry a REAL type that differs from their `kind` label
 * — 3 fatally (`tasks.sla_due_at`, `initiatives.planned_start_date`,
 * `initiatives.planned_end_date`: declared `text`, really `timestamp`, where the
 * text write-path emits the regex operator `~`, which does not exist for a
 * timestamp and aborts the whole per-org transaction).
 *
 * This suite proves the generator picks the shift expression from the MEASURED
 * type for every one of the 47 columns. It is gated on a real Postgres restored
 * from the staging dump copy (RUN_DB_TESTS=1, MOCK_DB=false, localhost
 * DATABASE_URL) and skipped otherwise.
 *
 * MUTATION: breaking `kindFromRealType` (e.g. mapping `timestamp without time
 * zone` → `text`) or swapping a column's measured type makes the fatal-column
 * and matrix assertions red.
 */
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import {
  buildTableUpdateSql,
  introspectShowcaseColumns,
  kindFromRealType,
  SHOWCASE_DATE_FIELDS,
  type ShowcaseRollDb,
  type ShowcaseRollStatement,
} from '../showcaseDateRollService.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

const pool = new Pool({ connectionString: CONNECTION_STRING });

const db: ShowcaseRollDb = {
  all: async <T,>(sql: string, params?: unknown[]): Promise<T[]> =>
    (await pool.query(sql, (params ?? []) as unknown[])).rows as T[],
  transaction: async (statements: ShowcaseRollStatement[]) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const s of statements) {
        const r = await client.query(s.sql, s.params as unknown[]);
        results.push({ success: true, changes: r.rowCount ?? 0 });
      }
      await client.query('COMMIT');
      return { success: true, results };
    } catch (e) {
      await client.query('ROLLBACK');
      return { success: false, results: [], error: String(e) };
    } finally {
      client.release();
    }
  },
};

afterAll(async () => {
  await pool.end();
});

function tableDef(name: string) {
  const t = SHOWCASE_DATE_FIELDS.find((x) => x.table === name);
  if (!t) throw new Error(`expected ${name} in SHOWCASE_DATE_FIELDS`);
  return t;
}

/** Classify the SET expression a column actually got in the built UPDATE. */
function classifyExpr(sql: string, col: string): string {
  const i = sql.indexOf(`"${col}" = `);
  if (i < 0) return 'absent';
  const seg = sql.slice(i, i + 240);
  if (seg.includes(`"${col}" ~ `)) return 'text';
  if (seg.includes(`"${col}" AT TIME ZONE`)) return 'timestamptz';
  if (seg.includes(`"${col}" + make_interval`)) return 'timestamp';
  if (new RegExp(`"${col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" \\+ \\$`).test(seg)) return 'date';
  return 'unknown';
}

const FATAL = [
  ['tasks', 'sla_due_at'],
  ['initiatives', 'planned_start_date'],
  ['initiatives', 'planned_end_date'],
] as const;

describe.skipIf(!REAL_PG)('SR-1 v3 matrix — declared kind vs REAL staging type (dump copy)', () => {
  it('chooses the shift expression from the REAL type for all 47 columns', async () => {
    const intro = await introspectShowcaseColumns(db);

    // Independent measurement straight from information_schema (not via the
    // service), so the test cross-checks the generator rather than trusting it.
    const tables = Array.from(new Set(SHOWCASE_DATE_FIELDS.map((t) => t.table)));
    const { rows } = await pool.query(
      `SELECT table_name, column_name, data_type, udt_name
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [tables]
    );
    const realMap = new Map<string, { data_type: string; udt_name: string }>(
      rows.map((r: any) => [`${r.table_name}.${r.column_name}`, { data_type: r.data_type, udt_name: r.udt_name }])
    );

    const matrix: unknown[] = [];
    let checked = 0;
    for (const t of SHOWCASE_DATE_FIELDS) {
      const sql = buildTableUpdateSql(t, intro);
      for (const c of t.columns) {
        const key = `${t.table}.${c.column}`;
        const real = realMap.get(key);
        const realKind = real ? kindFromRealType(real.data_type, real.udt_name) : 'missing';
        const expr = sql ? classifyExpr(sql, c.column) : 'absent';
        matrix.push({
          table: t.table,
          column: c.column,
          declared: c.kind,
          realType: real?.data_type ?? 'ABSENT',
          realKind,
          expr,
        });

        if (realKind === 'missing' || realKind === 'unsupported') {
          // skipped: no SET clause for this column (and no crash)
          expect(expr).toBe('absent');
          continue;
        }
        checked += 1;
        // the generator resolved exactly the independently-measured real kind …
        expect(intro.resolved.get(key)).toBe(realKind);
        // … and built the SET expression for THAT kind, not the declared label.
        expect(expr).toBe(realKind);
      }
    }

    // eslint-disable-next-line no-console
    console.log('SR1V3_MATRIX ' + JSON.stringify(matrix));
    expect(checked).toBeGreaterThan(0);
    // Every declared column is accounted for in the matrix.
    expect(matrix).toHaveLength(47);
  }, 60_000);

  it('the 3 fatal text-declared columns are really timestamp and shift via make_interval, never ~', async () => {
    const intro = await introspectShowcaseColumns(db);
    for (const [tbl, col] of FATAL) {
      const key = `${tbl}.${col}`;
      // MUTANT: trusting the declared `text` kind makes these red.
      expect(intro.resolved.get(key)).toBe('timestamp');
      const sql = buildTableUpdateSql(tableDef(tbl), intro);
      expect(sql).not.toBeNull();
      expect(classifyExpr(sql as string, col)).toBe('timestamp');
      expect(sql).not.toMatch(new RegExp(`"${col}" ~ `));
    }
    const mismatchKeys = intro.kindMismatch.map((m) => `${m.table}.${m.column}`).sort();
    // eslint-disable-next-line no-console
    console.log('SR1V3_KINDMISMATCH ' + JSON.stringify(mismatchKeys));
    for (const [tbl, col] of FATAL) expect(mismatchKeys).toContain(`${tbl}.${col}`);
  }, 60_000);
});
