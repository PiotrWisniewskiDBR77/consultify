/**
 * Schema migration completeness — proves `npm run db:migrate:strict`
 * (`DB_TYPE=postgres tsx server/scripts/migrate.postgres.ts`, no `--safe`)
 * reaches a schema that contains a small set of MVP-critical tables when run
 * against a genuinely EMPTY Postgres database (no app bootstrap, no
 * migrations-v2, no prior manual `psql` seeding).
 *
 * Context (release-gate finding, 2026-08-02): a fresh `db:migrate:strict` run
 * against an empty Postgres 16 fails partway through with
 * `relation "status_reports" does not exist` at
 * `server/migrations/20260623_distribution_delivery.sql` (its
 * `report_distributions` table FKs to `status_reports`). Root cause:
 * `status_reports` is declared only in `server/migrations/066_status_reports.sql`,
 * whose numeric version (66) is filtered out by
 * `isSqliteOnlyMigration()` in `server/scripts/migrate.postgres.ts` (anything
 * numbered 1-499 that isn't `000_z_core_baseline` is treated as a legacy
 * pre-baseline fragment and skipped). This is invisible on staging/demo/prod
 * because `server/src/database/PostgresDatabase.ts`'s boot-time bootstrap
 * creates a thin `status_reports` table before any of this ever runs — but
 * the CLI-only `db:migrate:strict` path never calls that bootstrap, so a
 * literal fresh replay of `server/migrations/` never creates the table.
 *
 * Fix under test: `server/migrations/20260623_distribution_delivery.sql` now
 * carries a "FRESH-DB GUARD" `CREATE TABLE IF NOT EXISTS status_reports`
 * ahead of its existing `report_distributions` guard (which already had this
 * exact treatment for its own table, dated 2026-07-14 — this migration just
 * extends the same guard to the table `report_distributions` depends on).
 *
 * This suite is intentionally narrow: it only asserts *existence* of tables
 * via `information_schema.tables`, not columns/constraints/data — it exists
 * to catch "the migration chain silently stopped partway through" regressions
 * on a from-empty run, not to be a full schema-parity check.
 *
 * HOW TO RUN LOCALLY (against a FRESH, unmigrated Postgres — this suite does
 * not migrate the DB itself, by design, so the failure mode under test is
 * visible):
 *   docker run -d --name schema-check-pg -e POSTGRES_USER=iris \
 *     -e POSTGRES_PASSWORD=iris_test -e POSTGRES_DB=iris_test \
 *     -p 5461:5432 pgvector/pgvector:pg16
 *   # wait for readiness, then create extensions:
 *   docker exec schema-check-pg psql -U iris -d iris_test -c \
 *     'CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pgcrypto;'
 *   # RED (before running migrations, or with the fix reverted):
 *   MOCK_DB=false RUN_DB_TESTS=1 DB_TYPE=postgres NODE_ENV=test \
 *     DATABASE_URL="postgres://iris:iris_test@localhost:5461/iris_test" \
 *     npx vitest run tests/integration/schema-migration-completeness.realdb.test.ts \
 *     --no-file-parallelism
 *   # apply migrations, then GREEN:
 *   NODE_ENV=test DB_TYPE=postgres \
 *     DATABASE_URL="postgres://iris:iris_test@localhost:5461/iris_test" \
 *     npx tsx server/scripts/migrate.postgres.ts
 *   MOCK_DB=false RUN_DB_TESTS=1 DB_TYPE=postgres NODE_ENV=test \
 *     DATABASE_URL="postgres://iris:iris_test@localhost:5461/iris_test" \
 *     npx vitest run tests/integration/schema-migration-completeness.realdb.test.ts \
 *     --no-file-parallelism
 *
 * Same connection-probe/skip contract as the sibling realdb suites (e.g.
 * tests/integration/mw-007-calendar-reschedule.golden-flow.realdb.test.ts,
 * tests/integration/execution-closure-evidence-gate.golden-flow.realdb.test.ts):
 * if Postgres is not reachable at all, the suite no-ops cleanly (vacuous
 * pass) rather than failing CI runs that have no database configured. If
 * Postgres IS reachable, table absence is a real, reported failure — that is
 * the whole point of this suite, so it does NOT fold "schema incomplete"
 * into the same silent skip the way harness-style suites do (those need a
 * fully-migrated DB just to set up fixtures; this suite's entire job is to
 * check migration completeness itself).
 */

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
}

const PROBE_TIMEOUT_MS = 10_000;

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 5_000,
    };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 5_000,
  };
}

async function pgReachable(): Promise<boolean> {
  const config = buildClientConfig();
  if (!config) return false;
  const probe = new Client(config);
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    try {
      await probe.end();
    } catch {
      // best-effort
    }
  }
}

// MVP-critical tables: the core baseline four (tasks/organizations/users/
// projects, same set the MW-07 realdb suites already require to even set up
// fixtures) plus status_reports and meetings — both tables this suite exists
// to guard, since both were found silently missing on a fresh
// `db:migrate:strict` replay (same bug class: declared only in a legacy
// fragment `isSqliteOnlyMigration()` filters out, or — for `meetings` — never
// declared in any migration at all, only created lazily at request time by
// `ensureMeetingTables()` in server/src/services/meetingService.ts).
const REQUIRED_TABLES = [
  'status_reports',
  'meetings',
  'tasks',
  'organizations',
  'users',
  'projects',
] as const;

async function existingTables(client: Client, names: readonly string[]): Promise<Set<string>> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  return new Set(result.rows.map((r) => r.table_name));
}

describe('Schema migration completeness — db:migrate:strict from empty Postgres', () => {
  let client: Client | null = null;
  let reachable = false;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable — schema-migration-completeness realdb test skipped. ' +
        'Set DATABASE_URL / PGHOST to point at a Postgres instance (migrated or not — that is ' +
        'exactly what this suite checks) to exercise this suite.'
    );
  }

  beforeAll(async () => {
    reachable = await pgReachable();
    if (!reachable) {
      emitSkipOnce();
      return;
    }
    const config = buildClientConfig();
    client = new Client(config as ClientConfig);
    await client.connect();
  }, 30_000);

  afterAll(async () => {
    if (client) {
      await client.end().catch(() => {});
      client = null;
    }
  });

  it(
    'every MVP-critical table exists in information_schema.tables (status_reports, meetings, tasks, organizations, users, projects)',
    async () => {
      if (!reachable || !client) {
        // Vacuous pass — no database configured for this run at all. This is
        // a materially different condition from "database reachable but
        // schema incomplete", which is asserted as a real failure below.
        expect(true).toBe(true);
        return;
      }

      const found = await existingTables(client, REQUIRED_TABLES);
      const missing = REQUIRED_TABLES.filter((t) => !found.has(t));

      expect(
        missing,
        `Expected all of [${REQUIRED_TABLES.join(', ')}] to exist after running ` +
          '`db:migrate:strict` against this database. Missing: ' +
          `[${missing.join(', ')}]. If this is status_reports, see ` +
          'server/migrations/20260623_distribution_delivery.sql (FRESH-DB GUARD). ' +
          'If this is meetings, see server/migrations/20260623_meetings_baseline.sql ' +
          '(FRESH-DB GUARD) — the fixes this test guards.'
      ).toEqual([]);
    },
    20_000
  );
});
