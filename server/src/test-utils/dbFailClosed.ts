/**
 * dbFailClosed — fail-CLOSED assertion that a test suite is actually running
 * against a REAL PostgreSQL database, never a mock/stub/sqlite shim
 * (CEL 10, 2026-08-13).
 *
 * WHY THIS EXISTS: this repo has a documented history of "green tests
 * measuring a dummy" (CLAUDE.md's own złota reguła #1 — "testy przeszły" ≠
 * "działa"). `describe.skipIf(!REAL_DB)` in the `*.integration.test.ts`
 * suites already prevents a MISSING env var from reporting false passes
 * (every `it()` reports "skipped", not "passed", when the guard is false) —
 * but nothing previously stopped a suite from running its assertions
 * against `DbPromise`'s in-memory/mock fallback if the env vars were set
 * but the app's own DB layer silently decided to mock itself anyway (e.g. a
 * connection failure that `DbPromise` swallows with `{ fallback: true }` —
 * see the MEMORY note "M01 Chat — faza 1: cichą pustka = fallback:true w
 * DbPromise"). This module closes that gap by proving, with a real SQL
 * round-trip, that the suite is talking to PostgreSQL specifically:
 * `version()` cannot be faked by a mock without the mock literally being
 * Postgres, and `current_database()`/`current_schema()` let a human (or a
 * later test) verify it is talking to the RIGHT database, not just "a"
 * database.
 *
 * USAGE — call once, right after the pool is constructed, in `beforeAll`:
 *
 *   const pool = new Pool({ connectionString: CONNECTION_STRING });
 *   await assertRealPostgresTestDb(pool);
 *
 * Every one of the four checks below throws `DbFailClosedError` (never
 * returns a falsy/undefined "well, kind of" result) the moment it is not
 * satisfied — a suite that imports this and does not handle the throw simply
 * fails loudly, which is the point: a silently-passing mock is impossible
 * once this call is wired into `beforeAll`.
 */
import type { Pool } from 'pg';

export interface RealPostgresProof {
  readonly database: string;
  readonly schema: string;
  /** Full `version()` string, e.g. "PostgreSQL 15.x on x86_64-pc-linux-gnu, ...". */
  readonly version: string;
}

export class DbFailClosedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DbFailClosedError';
  }
}

interface QueryablePool {
  query: Pool['query'];
}

/**
 * Throws `DbFailClosedError` unless ALL of the following hold:
 *  1. `process.env.RUN_DB_TESTS === '1'` (exact string match — not truthy,
 *     not "true", not "yes").
 *  2. `process.env.MOCK_DB === 'false'` (exact string match).
 *  3. The pool can actually execute a query (a suite that "has" a Pool
 *     object but cannot reach the database is not running against a real
 *     database either).
 *  4. `version()` reports PostgreSQL — the one fact a non-Postgres stand-in
 *     (sqlite, an in-memory `DbPromise` fallback, a hand-rolled test double)
 *     cannot produce without literally being a PostgreSQL server.
 *  5. `current_database()`/`current_schema()` are non-empty, so the caller
 *     has something concrete to log/assert against (which DB, which schema).
 *
 * On success, logs the proof (`[dbFailClosed] REAL PostgreSQL confirmed —
 * database=... schema=... version=...`) and returns it so a test can go
 * further and assert on the specific database name if it wants to.
 */
export async function assertRealPostgresTestDb(pool: QueryablePool): Promise<RealPostgresProof> {
  if (process.env.RUN_DB_TESTS !== '1') {
    throw new DbFailClosedError(
      `dbFailClosed: RUN_DB_TESTS must be exactly "1" (got ${JSON.stringify(process.env.RUN_DB_TESTS)}) — ` +
        'refusing to run a "real database" suite without the explicit opt-in that gates it.'
    );
  }
  if (process.env.MOCK_DB !== 'false') {
    throw new DbFailClosedError(
      `dbFailClosed: MOCK_DB must be exactly "false" (got ${JSON.stringify(process.env.MOCK_DB)}) — ` +
        "refusing to run a \"real database\" suite while the app's own DB layer is configured to mock itself."
    );
  }

  let row: { current_database: unknown; current_schema: unknown; version: unknown } | undefined;
  try {
    const res = await pool.query(
      `SELECT current_database() AS current_database, current_schema() AS current_schema, version() AS version`
    );
    row = res.rows?.[0];
  } catch (err) {
    throw new DbFailClosedError(
      `dbFailClosed: the pool could not execute a query at all (${
        err instanceof Error ? err.message : String(err)
      }) — a suite that cannot reach a database is not "running against a real database", it is silently no-op-ing.`
    );
  }

  const version = typeof row?.version === 'string' ? row.version : '';
  if (!version.toLowerCase().includes('postgresql')) {
    throw new DbFailClosedError(
      `dbFailClosed: version() did not report PostgreSQL (got ${JSON.stringify(
        row?.version
      )}) — this is the one signal a mock/sqlite/in-memory fallback cannot fake without actually being a real PostgreSQL server.`
    );
  }

  const database = typeof row?.current_database === 'string' ? row.current_database : '';
  const schema = typeof row?.current_schema === 'string' ? row.current_schema : '';
  if (!database || !schema) {
    throw new DbFailClosedError(
      'dbFailClosed: current_database()/current_schema() returned empty — cannot prove which database this ' +
        'suite is actually running against, even though version() looked like Postgres.'
    );
  }

  const proof: RealPostgresProof = { database, schema, version };

  // eslint-disable-next-line no-console
  console.log(
    `[dbFailClosed] REAL PostgreSQL confirmed — database=${proof.database} schema=${proof.schema} version=${
      proof.version.split(',')[0]
    }`
  );

  return proof;
}
