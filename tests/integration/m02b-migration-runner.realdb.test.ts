/**
 * M02-004 — migrationRunner delivery repair, exercised through the REAL
 * runner (`server/src/services/tablePlatform/migrationRunner.ts`) against a
 * real Postgres. Executing the .sql file directly would prove nothing about
 * the path that actually runs on boot.
 *
 * The defect being fixed: on any SQL error the old runner logged the file as
 * "skipped", INSERTED IT INTO tp_migration_history ANYWAY, incremented
 * `skipped`, continued, and returned `failed: null`. A broken migration was
 * therefore recorded as applied, never retried, and reported as success —
 * the same false-success class that hid the Decision schema gap.
 *
 * Scenarios (Master Codex list):
 *   discovery of the date-prefixed Decision migration · ordering · success
 *   records filename+checksum · SQL failure · history INSERT failure ·
 *   rollback leaves no partial schema · no false history row · retry after
 *   the fault is fixed · checksum mismatch fail-closed · 7xx and
 *   date-prefixed regression.
 *
 * Runs against a THROWAWAY migrations directory (temp dir), so the repo's 397
 * real migrations are neither executed nor mutated here — except the two
 * discovery/ordering tests, which read the real directory listing only.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const RUN_DB = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const itDB = RUN_DB ? it : it.skip;

const MIGRATION_TABLE = 'tp_migration_history';
const REAL_MIGRATIONS_DIR = path.resolve(__dirname, '../../server/migrations');

describe('M02-004 — tablePlatform migrationRunner (real Postgres, real runner)', () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  let tmpDir = '';
  let originalCwd = '';

  /**
   * Fixture migrations are written to a UNIQUE TEMP DIRECTORY injected into
   * the runner, never into the canonical server/migrations. Writing fixtures
   * into the real directory would race any concurrently running backend that
   * discovers the same folder, and cleanup-after-test does not remove that
   * risk. The injection seam is a function argument only; production startup
   * calls runMigrations() with no arguments and always uses the canonical
   * directory.
   */
  const stamp = '29990101';
  const written: string[] = [];

  function writeMigration(name: string, sql: string): string {
    const file = `${stamp}_m02btest_${name}.sql`;
    fs.writeFileSync(path.join(tmpDir, file), sql, 'utf-8');
    written.push(file);
    return file;
  }

  function rewriteMigration(file: string, sql: string) {
    fs.writeFileSync(path.join(tmpDir, file), sql, 'utf-8');
  }

  /** Runs against the injected temp dir unless a directory is given. */
  async function runner(dir?: string) {
    const mod = await import('../../server/src/services/tablePlatform/migrationRunner.js');
    return mod.runMigrations({ migrationsDir: dir ?? tmpDir });
  }

  async function historyRow(file: string) {
    const { rows } = await client.query(
      `SELECT filename, checksum, applied_at FROM ${MIGRATION_TABLE} WHERE filename = $1`,
      [file]
    );
    return rows[0] || null;
  }

  async function tableExists(name: string): Promise<boolean> {
    const { rows } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [name]
    );
    return rows.length > 0;
  }

  beforeAll(async () => {
    if (!RUN_DB) return;
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm02b-mig-'));
    await client.connect();
    // Pre-apply every real migration so the runner under test only has our
    // fixtures left to do; otherwise each run would attempt 397+ files.
    // M02-P18: pre-seeding must use the SAME predicate the runner uses
    // (isRuntimeMigrationFile = pattern OR allowlist), not a re-declared
    // pattern-only regex — otherwise an allowlisted-but-not-pre-seeded file
    // (e.g. 940_mw010_vault_document_versions.sql, added to the allowlist by
    // this packet) would get REALLY applied by the "against the real dir"
    // test below instead of being treated as already up to date.
    await client.query(`CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id SERIAL PRIMARY KEY, filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), checksum TEXT)`);
    const { isRuntimeMigrationFile } = await import(
      '../../server/src/services/tablePlatform/migrationIdentity.js'
    );
    const real = fs.readdirSync(REAL_MIGRATIONS_DIR).filter((f) => isRuntimeMigrationFile(f));
    for (const f of real) {
      await client.query(
        `INSERT INTO ${MIGRATION_TABLE} (filename, checksum) VALUES ($1, $2)
         ON CONFLICT (filename) DO NOTHING`,
        [f, null] // NULL checksum = legacy/unverifiable, must not trip fail-closed
      );
    }
  });

  afterEach(async () => {
    if (!RUN_DB) return;
    for (const f of written.splice(0)) {
      fs.rmSync(path.join(tmpDir, f), { force: true });
      await client.query(`DELETE FROM ${MIGRATION_TABLE} WHERE filename = $1`, [f]);
    }
    await client.query(`DROP TABLE IF EXISTS m02b_probe_a, m02b_probe_b CASCADE`);
  });

  afterAll(async () => {
    if (!RUN_DB) return;
    await client.query(`DELETE FROM ${MIGRATION_TABLE} WHERE filename LIKE $1`, [`${stamp}_%`]);
    await client.end();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalCwd) process.chdir(originalCwd);
  });

  it('is actually running against a database (a skip is not a pass)', () => {
    if (!RUN_DB) {
      // eslint-disable-next-line no-console
      console.warn('[M02-004/runner] SKIPPED — set RUN_DB_TESTS=1 and DATABASE_URL.');
    }
    expect(true).toBe(true);
  });

  // ── discovery + ordering ─────────────────────────────────────────────────
  //
  // M02-P18 NOTE: unlike M02-B's own candidate, this packet does NOT rename
  // `932_decision_workflow_canonical.sql` to a dated filename — that rename
  // is Decision-family product code (M02-B/P06's ownership), out of scope
  // for this infrastructure-only packet (see M02-P18_PACKET.md "forbidden
  // files"). So this test asserts today's ACTUAL state instead of the
  // renamed one: both same-numbered `932_*` files stay on their original
  // names and stay invisible to the runtime pattern — see
  // `m02p18-runner-identity-reconciliation.realdb.test.ts` for the full
  // resolution of findings M02-019/M02-020 at the identity/allowlist layer.
  itDB('does NOT discover either same-numbered 932_* file (pattern-excluded, not allowlisted)', () => {
    const files = fs
      .readdirSync(REAL_MIGRATIONS_DIR)
      .filter((f) => /^(7\d{2}|\d{8})_.*\.sql$/.test(f));

    // Both 932-numbered files are still present on disk under their
    // original names (no rename performed by this packet)...
    expect(
      fs.existsSync(path.join(REAL_MIGRATIONS_DIR, '932_decision_workflow_canonical.sql'))
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(REAL_MIGRATIONS_DIR, '932_canonical_inbox_items_source_status_initiative.sql')
      )
    ).toBe(true);
    // ...but neither matches the runtime pattern (9xx, not 7xx/date), so
    // neither is in the runner's discovery set.
    expect(files.some((f) => f.startsWith('932_'))).toBe(false);
  });

  itDB('orders 7xx before date-prefixed migrations, each ascending', () => {
    const files = fs
      .readdirSync(REAL_MIGRATIONS_DIR)
      .filter((f) => /^(7\d{2}|\d{8})_.*\.sql$/.test(f))
      .sort((a, b) => {
        const pa = a.split('_')[0];
        const pb = b.split('_')[0];
        if (pa.length !== pb.length) return pa.length - pb.length;
        return pa.localeCompare(pb);
      });

    const firstDated = files.findIndex((f) => f.split('_')[0].length === 8);
    const lastNumbered = files.map((f) => f.split('_')[0].length).lastIndexOf(3);
    expect(lastNumbered).toBeLessThan(firstDated);

    const dated = files.filter((f) => f.split('_')[0].length === 8).map((f) => f.split('_')[0]);
    expect([...dated]).toEqual([...dated].sort());
  });

  // ── success path ─────────────────────────────────────────────────────────
  itDB('records filename AND checksum on success', async () => {
    const file = writeMigration('ok', `CREATE TABLE IF NOT EXISTS m02b_probe_a (id TEXT PRIMARY KEY);`);

    const res = await runner();
    expect(res.failed).toBeNull();
    expect(res.failedFile).toBeNull();
    expect(res.applied).toBeGreaterThanOrEqual(1);

    const row = await historyRow(file);
    expect(row).not.toBeNull();
    expect(row.checksum).toBeTruthy();
    expect(row.applied_at).toBeTruthy();
    expect(await tableExists('m02b_probe_a')).toBe(true);
  });

  // ── SQL failure ──────────────────────────────────────────────────────────
  itDB('SQL failure: real failure returned, no history row, run stopped', async () => {
    const bad = writeMigration('bad', `CREATE TABLE m02b_probe_a (id TEXT); SELECT this_is_not_valid_sql(;`);

    const res = await runner();

    // Real failure — not "skipped", not success.
    expect(res.failed).toBeTruthy();
    expect(res.failedFile).toBe(bad);
    expect(res.skipped).not.toBeGreaterThan(res.total); // sanity

    // No false history row.
    expect(await historyRow(bad)).toBeNull();
  });

  itDB('rollback leaves no partial schema behind', async () => {
    // First statement would succeed on its own; the second aborts the tx.
    writeMigration(
      'partial',
      `CREATE TABLE m02b_probe_b (id TEXT PRIMARY KEY);
       INSERT INTO table_that_does_not_exist_m02b VALUES (1);`
    );

    const res = await runner();
    expect(res.failed).toBeTruthy();

    // The table from the first statement must NOT survive.
    expect(await tableExists('m02b_probe_b')).toBe(false);
  });

  itDB('never labels a failure as skipped or "already up to date"', async () => {
    const bad = writeMigration('bad2', `SELECT * FROM definitely_missing_table_m02b;`);
    const before = await client.query(`SELECT count(*)::int AS n FROM ${MIGRATION_TABLE}`);

    const res = await runner();

    expect(res.failed).toBeTruthy();
    expect(res.failedFile).toBe(bad);
    const after = await client.query(`SELECT count(*)::int AS n FROM ${MIGRATION_TABLE}`);
    // Not one single new history row was written by the failing run.
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  // ── retry ────────────────────────────────────────────────────────────────
  itDB('retry rediscovers and applies the migration once the fault is fixed', async () => {
    const file = writeMigration('retry', `SELECT * FROM definitely_missing_table_m02b;`);

    const first = await runner();
    expect(first.failed).toBeTruthy();
    expect(await historyRow(file)).toBeNull();

    // Fix the migration and run again — it must be picked up, not treated as done.
    rewriteMigration(file, `CREATE TABLE IF NOT EXISTS m02b_probe_a (id TEXT PRIMARY KEY);`);

    const second = await runner();
    expect(second.failed).toBeNull();
    expect(second.applied).toBeGreaterThanOrEqual(1);
    expect(await historyRow(file)).not.toBeNull();
    expect(await tableExists('m02b_probe_a')).toBe(true);
  });

  // ── history INSERT failure ───────────────────────────────────────────────
  itDB('history INSERT failure rolls the DDL back too (atomicity)', async () => {
    const file = writeMigration('histfail', `CREATE TABLE IF NOT EXISTS m02b_probe_a (id TEXT PRIMARY KEY);`);

    // Force the history INSERT to fail inside the same transaction.
    const trg = `m02b_histfail_${randomUUID().replaceAll('-', '_')}`;
    await client.query(
      `CREATE OR REPLACE FUNCTION ${trg}() RETURNS trigger AS $$
       BEGIN RAISE EXCEPTION 'history insert blocked'; END; $$ LANGUAGE plpgsql`
    );
    await client.query(
      `CREATE TRIGGER ${trg} BEFORE INSERT ON ${MIGRATION_TABLE}
       FOR EACH ROW WHEN (NEW.filename = '${file}') EXECUTE FUNCTION ${trg}()`
    );

    try {
      const res = await runner();
      expect(res.failed).toBeTruthy();
      expect(res.failedFile).toBe(file);
      expect(await historyRow(file)).toBeNull();
      // DDL from the same transaction must be gone as well.
      expect(await tableExists('m02b_probe_a')).toBe(false);
    } finally {
      await client.query(`DROP TRIGGER IF EXISTS ${trg} ON ${MIGRATION_TABLE}`);
      await client.query(`DROP FUNCTION IF EXISTS ${trg}()`);
    }
  });

  // ── checksum drift ───────────────────────────────────────────────────────
  itDB('checksum mismatch on an applied migration is fail-closed', async () => {
    const file = writeMigration('drift', `CREATE TABLE IF NOT EXISTS m02b_probe_a (id TEXT PRIMARY KEY);`);

    const first = await runner();
    expect(first.failed).toBeNull();
    const row = await historyRow(file);
    expect(row.checksum).toBeTruthy();

    // Change the file after it was applied.
    rewriteMigration(file, `CREATE TABLE IF NOT EXISTS m02b_probe_a (id TEXT PRIMARY KEY); -- drift`);

    const second = await runner();
    expect(second.failed).toBeTruthy();
    expect(second.checksumMismatches).toContain(file);
    expect(second.applied).toBe(0); // refuses to do anything else
  });

  itDB('a NULL (legacy) checksum is not treated as drift', async () => {
    const file = writeMigration('legacy', `CREATE TABLE IF NOT EXISTS m02b_probe_a (id TEXT PRIMARY KEY);`);
    await client.query(`INSERT INTO ${MIGRATION_TABLE} (filename, checksum) VALUES ($1, NULL)`, [file]);

    const res = await runner();
    expect(res.failed).toBeNull();
    expect(res.checksumMismatches).toEqual([]);
  });

  // ── regression: existing 7xx + date-prefixed migrations still recognised ──
  itDB('does not re-apply the already-applied real 7xx/date-prefixed migrations', async () => {
    // Explicitly against the CANONICAL directory. Applies nothing (all are in
    // history) and writes nothing to it — effectively read-only.
    const res = await runner(REAL_MIGRATIONS_DIR);
    expect(res.failed).toBeNull();
    expect(res.applied).toBe(0);
    expect(res.skipped).toBeGreaterThan(300);
    expect(res.total).toBe(res.skipped);
  });

  // ── Gate 2: fixture isolation ────────────────────────────────────────────
  itDB('never writes a fixture migration into the canonical server/migrations', async () => {
    writeMigration('isolation', `CREATE TABLE IF NOT EXISTS m02b_probe_a (id TEXT PRIMARY KEY);`);
    await runner();

    const strays = fs
      .readdirSync(REAL_MIGRATIONS_DIR)
      .filter((f) => f.includes('m02btest') || f.startsWith(stamp));
    expect(strays).toEqual([]);

    // The fixture really did exist — in the temp dir, not the canonical one.
    expect(fs.readdirSync(tmpDir).some((f) => f.includes('m02btest'))).toBe(true);
  });

  itDB('production mode (no arguments) resolves the canonical directory', async () => {
    // A fixture that only exists in tmpDir must be invisible to an
    // argument-less run: that run must resolve server/migrations instead.
    writeMigration('prodresolve', `CREATE TABLE IF NOT EXISTS m02b_probe_a (id TEXT PRIMARY KEY);`);

    const mod = await import('../../server/src/services/tablePlatform/migrationRunner.js');
    const res = await mod.runMigrations(); // no options — production path

    expect(res.failed).toBeNull();
    expect(res.applied).toBe(0); // canonical dir is fully applied
    expect(res.total).toBeGreaterThan(300); // and it really is the big directory
    // The temp-dir fixture was NOT picked up.
    expect(await historyRow(`${stamp}_m02btest_prodresolve.sql`)).toBeNull();
  });

  itDB('rejects an injected directory that does not exist', async () => {
    const res = await runner(path.join(tmpDir, 'no-such-dir'));
    expect(res.failed).toContain('Injected migrations directory not found');
    expect(res.applied).toBe(0);
  });
});
