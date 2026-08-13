/**
 * CW-PERF — throwaway-database lifecycle for the performance harness.
 *
 * The owner's instruction is explicit: build the profile on the harness's
 * OWN fresh database — create it, use it, DROP it afterwards — never on
 * `case_workspace_test` (that DB is shared with every other `*.pg.test.ts`
 * suite in this worktree and, per the parallel-agents warning on this task,
 * with five other concurrently running agents). Every database this file
 * creates carries the `cwperfprofile_` prefix so it is unmistakably this
 * harness's own and never collides with another agent's `case_workspace_*`
 * fixture.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

import { Client, Pool } from 'pg';

export interface AdminConnectionInfo {
  /** Connection string to an ADMIN-reachable database (used only to run CREATE/DROP DATABASE) — never the target DB itself. */
  adminUrl: string;
  host: string;
  port: number;
  user: string;
  password: string;
}

/** Parses a postgres:// URL into its parts, and rewrites the database name to `overrideDb` when given. */
export function withDatabase(connectionString: string, overrideDb: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${overrideDb}`;
  return url.toString();
}

export function parseAdminInfo(connectionString: string): AdminConnectionInfo {
  const url = new URL(connectionString);
  return {
    adminUrl: connectionString,
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

function isSafeDbName(name: string): boolean {
  // Defence in depth even though every caller here builds the name itself:
  // refuse to CREATE/DROP anything whose name isn't our own harness's
  // pattern, so a typo can never touch someone else's database.
  return /^cwperfprofile_[a-z0-9_]+$/.test(name);
}

/**
 * CREATE DATABASE <dbName>, connecting to `adminConnectionString`'s own
 * database (e.g. the ambient `case_workspace_test` or `postgres`) purely as
 * an administrative session — never the target DB, which does not exist yet.
 */
export async function createFreshDatabase(
  adminConnectionString: string,
  dbName: string
): Promise<void> {
  if (!isSafeDbName(dbName)) {
    throw new Error(`refusing to CREATE DATABASE outside the cwperfprofile_ namespace: ${dbName}`);
  }
  const client = new Client({ connectionString: adminConnectionString });
  await client.connect();
  try {
    // Idempotent: if a previous crashed run left this exact name behind, drop it first
    // (force-disconnects any lingering session) rather than failing the whole profile run.
    await client.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(async () => {
      await client.query(`DROP DATABASE IF EXISTS ${dbName}`).catch(() => undefined);
    });
    await client.query(`CREATE DATABASE ${dbName}`);
  } finally {
    await client.end();
  }
}

/** DROP DATABASE <dbName> WITH (FORCE) — terminates any lingering session first so cleanup never hangs. */
export async function dropDatabase(adminConnectionString: string, dbName: string): Promise<void> {
  if (!isSafeDbName(dbName)) {
    throw new Error(`refusing to DROP DATABASE outside the cwperfprofile_ namespace: ${dbName}`);
  }
  const client = new Client({ connectionString: adminConnectionString });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  } catch {
    // Older PG (<13) doesn't support WITH (FORCE) — fall back to a plain drop
    // after terminating backends by hand.
    await client
      .query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName]
      )
      .catch(() => undefined);
    await client.query(`DROP DATABASE IF EXISTS ${dbName}`).catch(() => undefined);
  } finally {
    await client.end();
  }
}

export interface MigrationRunResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/**
 * Runs `server/scripts/migrate.postgres.ts` as a CHILD PROCESS against
 * `databaseUrl` — a subprocess, not an in-process call, so the migration
 * runner's own module-level `databaseConfig` singleton (bound once per
 * process to whatever DATABASE_URL it first sees — see
 * server/src/utils/queryHelpers.ts's withPgTransaction docblock) can never
 * leak across this harness's three fresh databases. NO `--safe`: a real
 * migration failure on a fresh DB must fail this profile run loudly, not be
 * recorded as `skipped` (see MEMORY.md's `db:migrate` `--safe` warning).
 */
export function runMigrations(
  repoRoot: string,
  databaseUrl: string
): Promise<MigrationRunResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const child = spawn(
      path.join(repoRoot, 'node_modules', '.bin', 'tsx'),
      [path.join(repoRoot, 'server', 'scripts', 'migrate.postgres.ts')],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          DB_TYPE: 'postgres',
          DATABASE_URL: databaseUrl,
          LC_ALL: 'C',
          // Required so databaseTargetResolver.ts's allowLocalDatabaseForTests()
          // permits our local (127.0.0.1) throwaway database — without this the
          // migration runner hard-refuses any local host "outside tests".
          NODE_ENV: 'test',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        exitCode: code,
        stdout,
        stderr,
        durationMs: Math.round(performance.now() - start),
      });
    });
  });
}

/** Confirms the case_workspace_* schema this harness needs is actually present post-migration (never trust exit code alone). */
export async function verifySchemaPresent(databaseUrl: string): Promise<{ ok: boolean; missing: string[] }> {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  try {
    const requiredTables = [
      'organizations',
      'projects',
      'users',
      'organization_members',
      'case_core',
      'case_plan_versions',
      'case_workspace_history_events',
      'case_workspace_event_outbox',
    ];
    const r = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [requiredTables]
    );
    const present = new Set(r.rows.map((x) => x.table_name));
    const missing = requiredTables.filter((t) => !present.has(t));
    return { ok: missing.length === 0, missing };
  } finally {
    await pool.end();
  }
}
