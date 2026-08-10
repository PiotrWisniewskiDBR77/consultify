/**
 * CW-T-F1 — guard against the `initDb()` concurrent-DDL race.
 *
 * ===========================================================================
 * THE DEFECT (root cause of the historical cold-start flakiness — see
 * docs/product/case-workspace/TEST_DETERMINISM_REPORT.md §1.3 for the full,
 * measured trace)
 * ===========================================================================
 * `server/src/database/PostgresDatabase.ts`'s `getPool()` calls `initDb()`
 * the FIRST time ANY code in a process asks for the pool, unless
 * `POSTGRES_SKIP_INIT_IN_TEST=1` is set (see that file, ~line 481-509).
 * `initDb()` runs a long sequence of legacy, Postgres-only, runtime schema
 * patches — including `CREATE INDEX IF NOT EXISTS idx_tasks_assignee ...`
 * and `idx_tasks_assignee_status` (PostgresDatabase.ts:3663-3665) — whose
 * ONLY producer in `server/migrations/` is `000_initdb_core_tables.sql`,
 * which `server/scripts/migrate.postgres.ts`'s `isSqliteOnlyMigration()`
 * blanket-excludes from `db:migrate`/`db:migrate:strict` (it is not in that
 * file's `PROMOTED_LEGACY_SET`). So on a freshly `db:migrate:strict`'d
 * database, `tasks` exists (created by `000_z_core_baseline.sql`) but
 * `idx_tasks_assignee`/`idx_tasks_assignee_status` do NOT — verified
 * directly against a throwaway DB, not assumed.
 *
 * Vitest's default `pool: 'forks'` + `fileParallelism: true` means EVERY
 * test FILE runs in its own OS process. Every one of those processes
 * imports server code that eventually calls `getPool()` — so, on a fresh
 * database, N test-file processes ALL race to run `CREATE INDEX IF NOT
 * EXISTS idx_tasks_assignee ...` for the first time, simultaneously. This is
 * a well-known PostgreSQL footgun: `CREATE INDEX IF NOT EXISTS` is NOT safe
 * against a true concurrent race between sessions that all observe
 * "does not exist" before any of them commits — the loser gets
 * `duplicate key value violates unique constraint "pg_class_relname_nsp_index"`.
 * REPRODUCED directly during this investigation: 29-31 files run in
 * parallel against a freshly migrated DB threw this exact error from
 * `initDb()` inside multiple, unrelated test files (capabilityRegistryService,
 * migrationReadinessService, playService, …) — see
 * TEST_DETERMINISM_REPORT.md §1.3 for the captured log excerpt.
 *
 * This matches the checkpoint's own historical record almost exactly: "180
 * awarii na zimnym starcie przy pierwszym przebiegu na swiezej bazie, 251/252
 * przy powtorce" — cold start = indexes don't exist yet = every forked
 * process's `initDb()` races to create them = mass, semi-random collisions;
 * warm repeat = the indexes already exist from the first run = `CREATE INDEX
 * IF NOT EXISTS` is a true no-op everywhere = the race window disappears.
 *
 * ===========================================================================
 * THE FIX (recommended to the coordinator, NOT applied by this packet —
 * changing test-run env vars/CI config is outside this packet's allowlist)
 * ===========================================================================
 * Run the real-DB suite with `POSTGRES_SKIP_INIT_IN_TEST=1` ALWAYS. The
 * schema is already fully produced by `db:migrate:strict` for everything
 * that matters to the caseWorkspace suite; the two `idx_tasks_assignee*`
 * indexes are a `tasks`-table read-path optimization unrelated to
 * `case_workspace_*` correctness, and every OTHER `initDb()` statement is
 * `IF NOT EXISTS`/`querySafe`-guarded legacy schema-patching that a properly
 * migrated fresh DB doesn't need. See TEST_DETERMINISM_REPORT.md §4 for the
 * exact list of places to add this env var (the documented `RUN_DB_TESTS=1
 * MOCK_DB=false ...` recipe used across every `*.pg.test.ts` file's own
 * header comment does not currently include it).
 *
 * ===========================================================================
 * WHAT THIS FILE PROVIDES IN THE MEANTIME
 * ===========================================================================
 * `warnIfSchemaBootstrapRaceLikely()` — call once in a suite's `beforeAll`.
 * Cheap (two `pg_indexes` lookups), non-fatal (never fails a suite by
 * itself): if it finds one of the two racy indexes missing on a database
 * that's otherwise reachable-with-schema, it logs a loud, actionable warning
 * so a future "column/relation does not exist" or
 * "pg_class_relname_nsp_index" failure is immediately traceable to this
 * known cause instead of re-diagnosed from scratch.
 */

import type { Pool } from 'pg';

const RACE_PRONE_INDEXES = ['idx_tasks_assignee', 'idx_tasks_assignee_status'] as const;

export async function warnIfSchemaBootstrapRaceLikely(pool: Pool): Promise<void> {
  if (process.env.POSTGRES_SKIP_INIT_IN_TEST === '1') return; // race window is closed

  try {
    const result = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE indexname = ANY($1::text[])`,
      [RACE_PRONE_INDEXES as unknown as string[]]
    );
    const present = new Set(result.rows.map((r) => r.indexname));
    const missing = RACE_PRONE_INDEXES.filter((idx) => !present.has(idx));
    if (missing.length === 0) return;

    // eslint-disable-next-line no-console
    console.warn(
      `[CW-T-F1 schemaBootstrapGuard] Missing ${missing.join(', ')} — this database has not yet ` +
        `had initDb()'s runtime bootstrap complete. Under a parallel (fileParallelism) run, every ` +
        `forked test-file process races to create these via CREATE INDEX IF NOT EXISTS, which can ` +
        `throw "duplicate key value violates unique constraint pg_class_relname_nsp_index" (a known ` +
        `Postgres concurrent-DDL race). Set POSTGRES_SKIP_INIT_IN_TEST=1 in the test run env, or run ` +
        `once with a single file first to let initDb() complete before going parallel. See ` +
        `docs/product/case-workspace/TEST_DETERMINISM_REPORT.md §1.3/§4.`
    );
  } catch {
    // Non-fatal by design — this is a diagnostic aid, not a test gate.
  }
}
