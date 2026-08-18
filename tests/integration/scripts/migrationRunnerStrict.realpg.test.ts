/**
 * Strict migration-runner contract, executed against a REAL, DISPOSABLE
 * Postgres by spawning `server/scripts/migrate.postgres.ts` exactly the way
 * production does. Nothing here re-implements runner logic: every assertion
 * reads the runner's real stdout/exit code and the real `schema_migrations`
 * rows it wrote.
 *
 * SAFETY (all four required before a single statement runs):
 *   1. explicit opt-in           MIGRATION_STRICT_REALPG=1
 *   2. local host only           DATABASE_URL must point at loopback
 *   3. database-name prefix      current_database() must start with c_fresh_
 *   4. suite advisory lock       serializes this file against itself
 *
 * When not opted in, this suite SKIPS VISIBLY (describe.skipIf) so the run
 * reports a skipped count. It deliberately does not use the
 * `it(){ if (!reachable) return; }` idiom, which reports PASSED for a test
 * that asserted nothing.
 *
 * Scope note: these cases run the real runner over controlled FIXTURE
 * directories (`--dir`), not the 972-file production tree. A full-tree fresh
 * apply is not reachable on the stock postgres image used here —
 * `init-pgvector.sql` needs `CREATE EXTENSION vector`. (The full 770-migration
 * apply IS run separately against a pgvector image.) A fixture dir exercises
 * the same code path with a measurable denominator instead of an inferred one.
 */
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const REQUIRED_DB_PREFIX = 'c_fresh_';
const SUITE_LOCK_KEY = 'consultify:test:migrationRunnerStrict.realpg';

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

const DATABASE_URL = readDatabaseUrl();
const OPTED_IN = process.env.MIGRATION_STRICT_REALPG === '1' && DATABASE_URL !== null;

if (!OPTED_IN) {
  // Loud, visible reason. The suite reports SKIPPED, never a green pass.
  // eslint-disable-next-line no-console
  console.error(
    '[SKIPPED] migrationRunnerStrict.realpg — requires MIGRATION_STRICT_REALPG=1 and a DATABASE_URL ' +
      `pointing at a disposable local database named ${REQUIRED_DB_PREFIX}*. NOT EVIDENCE.`
  );
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

describe.skipIf(!OPTED_IN)('migrate.postgres.ts — strict contract on real Postgres', () => {
  const url = DATABASE_URL as string;
  const tempDirs: string[] = [];
  let lockClient: Client;

  async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  function fixtureDir(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'c-fresh-strict-'));
    tempDirs.push(dir);
    return dir;
  }

  function write(dir: string, filename: string, sql: string): string {
    writeFileSync(path.join(dir, filename), sql);
    return sha256(sql);
  }

  /** Postgres rejects unquoted identifiers starting with a digit. */
  const tableFor = (filename: string) => filename.replace(/^\d+_/, '').replace(/\.sql$/, '');

  function runMigrate(args: string[]) {
    return spawnSync('npx', ['tsx', 'server/scripts/migrate.postgres.ts', ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      env: {
        ...process.env,
        DB_TYPE: 'postgres',
        NODE_ENV: 'test',
        RUN_DB_TESTS: '1',
        DATABASE_URL: url,
      },
    });
  }

  async function ledgerRows(filenames: string[]) {
    return withClient(async (c) => {
      const res = await c.query(
        `SELECT filename, status, checksum FROM schema_migrations
          WHERE filename = ANY($1::text[]) ORDER BY filename`,
        [filenames]
      );
      return res.rows as Array<{ filename: string; status: string; checksum: string | null }>;
    });
  }

  async function clearLedger(filenames: string[]) {
    await withClient((c) =>
      c.query(`DELETE FROM schema_migrations WHERE filename = ANY($1::text[])`, [filenames])
    );
  }

  beforeAll(async () => {
    const host = new URL(url).hostname;
    const local = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
    if (!local) throw new Error(`Refusing to run against non-local host "${host}".`);

    // Guard 3: ask the SERVER what database it is, never trust the URL string.
    const dbName = await withClient(async (c) => {
      const res = await c.query('SELECT current_database() AS db');
      return String(res.rows[0].db);
    });
    if (!dbName.startsWith(REQUIRED_DB_PREFIX)) {
      throw new Error(
        `Refusing to run: current_database() is "${dbName}", which does not carry the disposable ` +
          `"${REQUIRED_DB_PREFIX}" prefix. This suite mutates schema and must never touch a shared database.`
      );
    }

    // Guard 4: serialize this suite against itself.
    // Let the RUNNER create schema_migrations (rather than this test
    // re-declaring its shape) so the ledger helpers below have a table to
    // read on a virgin database. This must be a REAL run over an empty
    // fixture directory: `--dry-run` is now genuinely mutation-free and
    // deliberately does NOT create the ledger.
    const bootstrapDir = fixtureDir();
    const boot = runMigrate(['--dir', bootstrapDir]);
    if (boot.status !== 0) {
      throw new Error(`Failed to bootstrap schema_migrations: ${boot.stderr || boot.stdout}`);
    }

    lockClient = new Client({ connectionString: url });
    await lockClient.connect();
    const got = await lockClient.query('SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS locked', [
      SUITE_LOCK_KEY,
    ]);
    if (got.rows[0]?.locked !== true) {
      throw new Error('Another instance of this suite already holds the suite advisory lock.');
    }
  }, 60_000);

  afterAll(async () => {
    for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
    if (lockClient) {
      await lockClient.query('SELECT pg_advisory_unlock(hashtext($1)::bigint)', [SUITE_LOCK_KEY]);
      await lockClient.end();
    }
  });

  it('fresh apply records every migration with the sha256 of its actual bytes', async () => {
    const dir = fixtureDir();
    const files = ['700_cf_fresh_a.sql', '800_cf_fresh_b.sql', '900_cf_fresh_c.sql'];
    const expected = new Map<string, string>();
    for (const f of files) {
      const sql = `CREATE TABLE IF NOT EXISTS ${tableFor(f)} (id INT);`;
      expected.set(f, write(dir, f, sql));
    }
    await clearLedger(files);

    const run = runMigrate(['--dir', dir]);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(`Applying migrations: ${files.length}`);
    expect(run.stdout).toContain('✅ Postgres migrations complete');

    const rows = await ledgerRows(files);
    expect(rows.map((r) => r.filename)).toEqual(files);
    for (const r of rows) {
      expect(r.status).toBe('success');
      // Measured, not inferred: the ledger holds the digest of the real bytes.
      expect(r.checksum).toBe(expected.get(r.filename));
    }

    // repeat0
    const again = runMigrate(['--dir', dir]);
    expect(again.status).toBe(0);
    expect(again.stdout).toContain('Applying migrations: 0');

    // dry0
    const dry = runMigrate(['--dir', dir, '--dry-run']);
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain('Pending migrations: 0');

    await clearLedger(files);
    await withClient((c) =>
      c.query(`DROP TABLE IF EXISTS ${files.map(tableFor).join(', ')}`)
    );
  }, 120_000);

  it('applies a newly introduced migration whose name sorts EARLIER than applied ones', async () => {
    const dir = fixtureDir();
    const first = ['700_cf_late_a.sql', '800_cf_late_b.sql'];
    for (const f of first) write(dir, f, `CREATE TABLE IF NOT EXISTS ${tableFor(f)} (id INT);`);
    await clearLedger([...first, '600_cf_late_earlier.sql']);

    expect(runMigrate(['--dir', dir]).status).toBe(0);

    // Introduced AFTER the others were applied, but sorts before both.
    const late = '600_cf_late_earlier.sql';
    write(dir, late, `CREATE TABLE IF NOT EXISTS cf_late_earlier (id INT);`);

    const run = runMigrate(['--dir', dir]);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('Applying migrations: 1');
    expect(run.stdout).toContain(`→ ${late}`);

    const rows = await ledgerRows([late]);
    expect(rows[0]?.status).toBe('success');

    await clearLedger([...first, late]);
    await withClient((c) =>
      c.query(`DROP TABLE IF EXISTS ${[...first.map(tableFor), 'cf_late_earlier'].join(', ')}`)
    );
  }, 120_000);

  it('refuses to run when an already-applied migration was edited on disk', async () => {
    const dir = fixtureDir();
    const applied = '700_cf_mutate_me.sql';
    write(dir, applied, 'CREATE TABLE IF NOT EXISTS cf_mutate_me (id INT);');
    await clearLedger([applied, '800_cf_mutate_pending.sql']);
    expect(runMigrate(['--dir', dir]).status).toBe(0);

    // Mutate the applied file, and add a pending one to prove nothing runs.
    write(dir, applied, 'CREATE TABLE IF NOT EXISTS cf_mutate_me (id INT); -- edited after the fact');
    const pending = '800_cf_mutate_pending.sql';
    write(dir, pending, 'CREATE TABLE IF NOT EXISTS cf_mutate_pending (id INT);');

    const run = runMigrate(['--dir', dir]);
    expect(run.status).not.toBe(0);
    expect(run.stdout + run.stderr).toContain('HISTORICAL MUTATION');
    expect(run.stdout).not.toContain('✅ Postgres migrations complete');

    // Fails BEFORE mutation: the pending migration never ran.
    expect(await ledgerRows([pending])).toEqual([]);
    const exists = await withClient((c) =>
      c.query(`SELECT to_regclass('public.cf_mutate_pending') AS t`)
    );
    expect(exists.rows[0].t).toBeNull();

    await clearLedger([applied, pending]);
    await withClient((c) => c.query('DROP TABLE IF EXISTS cf_mutate_me'));
  }, 120_000);

  it('refuses to trust an out-of-band success row and does not skip the migration on its word', async () => {
    const dir = fixtureDir();
    const f = '700_cf_out_of_band.sql';
    write(dir, f, 'CREATE TABLE IF NOT EXISTS cf_out_of_band (id INT);');
    await clearLedger([f]);

    // A row this runner never wrote: 'success' with a non-sha256 checksum.
    await withClient((c) =>
      c.query(
        `INSERT INTO schema_migrations (version, filename, checksum, status)
         VALUES ($1, $2, $3, 'success')`,
        ['700', f, 'not-a-real-checksum']
      )
    );

    const run = runMigrate(['--dir', dir]);
    expect(run.status).not.toBe(0);
    expect(run.stdout + run.stderr).toContain('UNTRUSTED LEDGER ROW');
    const exists = await withClient((c) =>
      c.query(`SELECT to_regclass('public.cf_out_of_band') AS t`)
    );
    expect(exists.rows[0].t).toBeNull();

    await clearLedger([f]);
  }, 120_000);

  it('rejects a malformed existing ledger before recreating its missing status index', async () => {
    const dir = fixtureDir();
    const f = '700_cf_malformed_no_index.sql';
    write(dir, f, 'CREATE TABLE IF NOT EXISTS cf_malformed_no_index (id INT);');
    await clearLedger([f]);

    await withClient(async (c) => {
      await c.query('DROP INDEX IF EXISTS idx_schema_migrations_status');
      await c.query(
        `INSERT INTO schema_migrations (version, filename, checksum, status)
         VALUES ($1, $2, $3, 'success')`,
        ['700', f, 'malformed-checksum']
      );
    });

    try {
      const before = await withClient(async (c) => ({
        row: (
          await c.query(
            `SELECT version, filename, checksum, status FROM schema_migrations WHERE filename = $1`,
            [f]
          )
        ).rows,
        index: (
          await c.query(`SELECT to_regclass('idx_schema_migrations_status') AS name`)
        ).rows[0]?.name,
      }));
      expect(before.index).toBeNull();

      const run = runMigrate(['--dir', dir]);
      expect(run.status).not.toBe(0);
      expect(run.stdout + run.stderr).toContain('UNTRUSTED LEDGER ROW');

      const after = await withClient(async (c) => ({
        row: (
          await c.query(
            `SELECT version, filename, checksum, status FROM schema_migrations WHERE filename = $1`,
            [f]
          )
        ).rows,
        index: (
          await c.query(`SELECT to_regclass('idx_schema_migrations_status') AS name`)
        ).rows[0]?.name,
        relation: (
          await c.query(`SELECT to_regclass('public.cf_malformed_no_index') AS name`)
        ).rows[0]?.name,
      }));
      expect(after.row).toEqual(before.row);
      expect(after.index).toBeNull();
      expect(after.relation).toBeNull();
    } finally {
      await clearLedger([f]);
      await withClient((c) =>
        c.query(
          'CREATE INDEX IF NOT EXISTS idx_schema_migrations_status ON schema_migrations(status)'
        )
      );
    }
  }, 120_000);

  it('rolls back a partially-failing migration: no relations, no ledger row', async () => {
    const dir = fixtureDir();
    const f = '700_cf_rollback.sql';
    // First statement is valid, second is a syntax error.
    write(
      dir,
      f,
      'CREATE TABLE cf_rollback_probe (id INT);\nTHIS IS NOT VALID SQL;'
    );
    await clearLedger([f]);
    await withClient((c) => c.query('DROP TABLE IF EXISTS cf_rollback_probe'));

    const run = runMigrate(['--dir', dir]);
    expect(run.status).not.toBe(0);

    // The valid statement must not survive the failure.
    const exists = await withClient((c) =>
      c.query(`SELECT to_regclass('public.cf_rollback_probe') AS t`)
    );
    expect(exists.rows[0].t).toBeNull();

    // The failure IS recorded, and as 'failed' — never 'success'/'skipped'.
    const rows = await ledgerRows([f]);
    expect(rows[0]?.status).toBe('failed');

    await clearLedger([f]);
  }, 120_000);

  it('serializes concurrent runners instead of letting both compute the same pending set', async () => {
    const dir = fixtureDir();
    const f = '700_cf_concurrent.sql';
    write(dir, f, 'CREATE TABLE IF NOT EXISTS cf_concurrent (id INT);');
    await clearLedger([f]);

    // Hold the runner's own advisory lock from an independent session.
    const holder = new Client({ connectionString: url });
    await holder.connect();
    try {
      await holder.query('SELECT pg_advisory_lock(hashtext($1)::bigint)', [
        'consultify:migrate.postgres:schema_migrations',
      ]);

      const run = runMigrate(['--dir', dir]);
      expect(run.status).not.toBe(0);
      expect(run.stdout + run.stderr).toContain('advisory lock');
      expect(await ledgerRows([f])).toEqual([]);
    } finally {
      await holder.query('SELECT pg_advisory_unlock(hashtext($1)::bigint)', [
        'consultify:migrate.postgres:schema_migrations',
      ]);
      await holder.end();
    }

    // A dry run mutates nothing, so it is never blocked by the lock.
    const dry = runMigrate(['--dir', dir, '--dry-run']);
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain('Pending migrations: 1');

    await clearLedger([f]);
  }, 120_000);

  it('fails closed on an unclassifiable filename instead of running it last', async () => {
    const dir = fixtureDir();
    write(dir, 'totally_unclassifiable.sql', 'SELECT 1;');
    const run = runMigrate(['--dir', dir]);
    expect(run.status).not.toBe(0);
    expect(run.stdout + run.stderr).toContain('UNCLASSIFIED MIGRATION FILENAME');
  }, 120_000);

  it('fails closed on an unexpected subdirectory instead of silently ignoring it', async () => {
    const dir = fixtureDir();
    write(dir, '700_cf_subdir_ok.sql', 'SELECT 1;');
    mkdirSync(path.join(dir, 'surprise-dir'));
    const run = runMigrate(['--dir', dir, '--dry-run']);
    expect(run.status).not.toBe(0);
    expect(run.stdout + run.stderr).toContain('UNEXPECTED ENTRY');
  }, 120_000);

  // -------------------------------------------------------------------
  // TS/JS migrations must receive a database pinned to the SAME
  // transaction. The canonical tree carries four dated `.ts` migrations
  // whose contract is `export async function up(db: IDatabase)`, so a
  // SQL-only runner is not sufficient.
  // -------------------------------------------------------------------
  it('hands a TS migration a working db and commits its DDL with the ledger row', async () => {
    const dir = fixtureDir();
    const f = '20260101_cf_ts_commit.ts';
    writeFileSync(
      path.join(dir, f),
      [
        'export async function up(db) {',
        '  if (!db || typeof db.run !== "function") {',
        '    throw new Error("up() received no usable database argument");',
        '  }',
        '  await db.run(`CREATE TABLE IF NOT EXISTS cf_ts_commit (id INT)`);',
        '  await db.run(`INSERT INTO cf_ts_commit (id) VALUES (1)`);',
        '}',
      ].join('\n')
    );
    await clearLedger([f]);
    await withClient((c) => c.query('DROP TABLE IF EXISTS cf_ts_commit'));

    const run = runMigrate(['--dir', dir]);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(`→ ${f}`);

    // The DDL AND the data the migration wrote are both committed.
    const rows = await withClient((c) => c.query('SELECT id FROM cf_ts_commit'));
    expect(rows.rows.map((r: any) => r.id)).toEqual([1]);

    const ledger = await ledgerRows([f]);
    expect(ledger[0]?.status).toBe('success');

    await clearLedger([f]);
    await withClient((c) => c.query('DROP TABLE IF EXISTS cf_ts_commit'));
  }, 180_000);

  it('rolls back a TS migration that fails midway — its earlier DDL does not survive', async () => {
    const dir = fixtureDir();
    const f = '20260102_cf_ts_rollback.ts';
    writeFileSync(
      path.join(dir, f),
      [
        'export async function up(db) {',
        '  await db.run(`CREATE TABLE cf_ts_rollback (id INT)`);',
        '  throw new Error("deliberate failure after DDL");',
        '}',
      ].join('\n')
    );
    await clearLedger([f]);
    await withClient((c) => c.query('DROP TABLE IF EXISTS cf_ts_rollback'));

    const run = runMigrate(['--dir', dir]);
    expect(run.status).not.toBe(0);

    // If up(db) had run on its own connection, this table would exist.
    const exists = await withClient((c) =>
      c.query(`SELECT to_regclass('public.cf_ts_rollback') AS t`)
    );
    expect(exists.rows[0].t).toBeNull();

    const ledger = await ledgerRows([f]);
    expect(ledger[0]?.status).toBe('failed');

    await clearLedger([f]);
  }, 180_000);

  it('refuses a TS migration whose up() takes no database argument', async () => {
    const dir = fixtureDir();
    const f = '20260103_cf_ts_noarg.ts';
    writeFileSync(path.join(dir, f), 'export async function up() { /* no db */ }');
    await clearLedger([f]);

    const run = runMigrate(['--dir', dir]);
    expect(run.status).not.toBe(0);
    expect(run.stdout + run.stderr).toContain('no database argument');

    await clearLedger([f]);
  }, 180_000);

  it('--dry-run mutates nothing on a genuinely fresh database (no ledger table created)', async () => {
    // A brand-new database, so "did the runner create schema_migrations?" is
    // an unambiguous question.
    const probeDb = 'c_fresh_dryrun_probe';
    const adminUrl = new URL(url);
    adminUrl.pathname = '/postgres';
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    try {
      await admin.query(`DROP DATABASE IF EXISTS ${probeDb}`);
      await admin.query(`CREATE DATABASE ${probeDb}`);

      const probeUrl = new URL(url);
      probeUrl.pathname = `/${probeDb}`;

      const dir = fixtureDir();
      write(dir, '700_cf_dryrun_probe.sql', 'CREATE TABLE cf_dryrun_probe (id INT);');

      const run = spawnSync('npx', ['tsx', 'server/scripts/migrate.postgres.ts', '--dir', dir, '--dry-run'], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        env: {
          ...process.env,
          DB_TYPE: 'postgres',
          NODE_ENV: 'test',
          RUN_DB_TESTS: '1',
          DATABASE_URL: probeUrl.toString(),
        },
      });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('Pending migrations: 1');

      const probe = new Client({ connectionString: probeUrl.toString() });
      await probe.connect();
      try {
        const ledger = await probe.query(`SELECT to_regclass('schema_migrations') AS t`);
        // The old runner called ensureSchemaMigrationsTable() before checking
        // --dry-run, so a "read-only" run created a table and an index.
        expect(ledger.rows[0].t).toBeNull();
        const anyTable = await probe.query(
          `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`
        );
        expect(anyTable.rows[0].n).toBe(0);
      } finally {
        await probe.end();
      }
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS ${probeDb}`).catch(() => {});
      await admin.end();
    }
  }, 180_000);

  it('leaves no residue: no fixture ledger rows and no advisory locks held', async () => {
    const residue = await withClient(async (c) => {
      const rows = await c.query(
        `SELECT filename FROM schema_migrations WHERE filename LIKE '%_cf_%'`
      );
      const locks = await c.query(
        `SELECT count(*)::int AS n FROM pg_locks
          WHERE locktype = 'advisory'
            AND objid = (SELECT hashtext('consultify:migrate.postgres:schema_migrations')::bigint & 4294967295)`
      );
      return { rows: rows.rowCount, locks: locks.rows[0].n as number };
    });
    expect(residue.rows).toBe(0);
    expect(residue.locks).toBe(0);
  }, 60_000);
});
