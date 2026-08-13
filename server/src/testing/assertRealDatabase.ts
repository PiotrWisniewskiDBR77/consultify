/**
 * Fail-closed proof that a test suite is running against a REAL PostgreSQL
 * connection, not the app's mock DB layer (S4, CEL B, 2026-08-13).
 *
 * WHY THIS EXISTS: env vars alone (`RUN_DB_TESTS=1`, `MOCK_DB=false`) say
 * what a suite INTENDS, not what actually happened. A suite can set those
 * vars, still get a mocked connection for unrelated reasons (module load
 * order, a stray override, a typo in the connection string that silently
 * resolves to nothing), and report every test green having asserted nothing
 * real. This program has already hit that exact failure class more than
 * once (see memory: "narzędzia pomiarowe kłamały 6 razy" / finance-v3
 * checkpoint 2026-08-13; "zielone CI nic nie dowodzi" / audyt bazy danych
 * 2026-08-06). `assertRealDatabase` closes that gap for method-core /
 * Assessment suites by ADDITIONALLY running a real round-trip query
 * (`current_database()` / `current_schema()`) and throwing — not skipping,
 * not warning — if either the env gate or the query itself fails.
 *
 * Usage (call in `beforeAll`, not inside individual `it()`s — a suite that
 * cannot prove it is real should never reach its test bodies):
 *
 *   import { assertRealDatabase, fromPgPool } from '../../testing/assertRealDatabase.js';
 *
 *   beforeAll(async () => {
 *     pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *     const proof = await assertRealDatabase(fromPgPool(pool));
 *     // proof.currentDatabase / proof.currentSchema now available for logging
 *   });
 *
 * For suites that go through the app's DB abstraction (`getDatabaseAsync()`,
 * whose `.all()` returns rows directly rather than a `{ rows }` envelope),
 * use `fromAppDb(db)` instead of `fromPgPool(pool)`.
 */

export interface RealDatabaseAssertion {
  currentDatabase: string;
  currentSchema: string;
}

/** A minimal, client-agnostic "run this SQL, get rows back" seam. */
export type SqlRunner = (sql: string) => Promise<Array<Record<string, unknown>>>;

/** Adapts a `pg.Pool` / `pg.Client` (whose `.query()` resolves `{ rows }`). */
export function fromPgPool(pool: {
  query: (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }>;
}): SqlRunner {
  return async (sql: string) => {
    const result = await pool.query(sql);
    return result.rows;
  };
}

/** Adapts this repo's app-wide DB abstraction (`getDatabaseAsync()`), whose `.all()` resolves rows directly. */
export function fromAppDb(db: { all: (sql: string) => Promise<unknown> }): SqlRunner {
  return async (sql: string) => {
    const rows = await db.all(sql);
    return (rows ?? []) as Array<Record<string, unknown>>;
  };
}

/**
 * Env-only gate: true iff both `RUN_DB_TESTS=1` and `MOCK_DB=false` are set.
 * Exported separately so callers can `describe.skipIf(!isRealDatabaseTestModeRequested())`
 * BEFORE opening any connection (skipping is fine at that stage — the point
 * of `assertRealDatabase` is that once a suite decides to run, it must not
 * silently pass without a real connection).
 */
export function isRealDatabaseTestModeRequested(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.RUN_DB_TESTS === '1' && env.MOCK_DB === 'false';
}

/**
 * Throws unless (a) the env gate is satisfied AND (b) a real round-trip
 * query against the connection succeeds and returns a non-empty
 * current_database()/current_schema(). Never returns a "skip" signal — a
 * caller that wants a skip-on-missing-DB suite must decide that BEFORE
 * calling this (see `isRealDatabaseTestModeRequested`); once called, this
 * function only throws or returns real proof.
 */
export async function assertRealDatabase(
  runner: SqlRunner,
  env: NodeJS.ProcessEnv = process.env
): Promise<RealDatabaseAssertion> {
  if (!isRealDatabaseTestModeRequested(env)) {
    throw new Error(
      '[assertRealDatabase] Refusing to proceed: this suite requires RUN_DB_TESTS=1 and MOCK_DB=false. ' +
        `Got RUN_DB_TESTS=${JSON.stringify(env.RUN_DB_TESTS ?? null)} MOCK_DB=${JSON.stringify(
          env.MOCK_DB ?? null
        )}. A database test must fail closed instead of silently running against the mock DB layer.`
    );
  }

  let rows: Array<Record<string, unknown>>;
  try {
    rows = await runner('SELECT current_database() AS current_database, current_schema() AS current_schema');
  } catch (err) {
    throw new Error(
      `[assertRealDatabase] Could not execute a real round-trip query against the configured database: ${
        (err as Error).message
      }. This suite requires a reachable PostgreSQL DATABASE_URL, not a mock or an unreachable host.`
    );
  }

  const row = rows[0];
  const currentDatabase = row?.current_database;
  const currentSchema = row?.current_schema;
  if (typeof currentDatabase !== 'string' || !currentDatabase || typeof currentSchema !== 'string' || !currentSchema) {
    throw new Error(
      '[assertRealDatabase] current_database()/current_schema() returned no usable row — this is not a real ' +
        `PostgreSQL connection. Got: ${JSON.stringify(row ?? null)}`
    );
  }

  return { currentDatabase, currentSchema };
}
