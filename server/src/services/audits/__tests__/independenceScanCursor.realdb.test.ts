/**
 * independenceScanCursor.realdb.test — AUD-POL-001 / AMD-AUD-RIGHTS-001.
 *
 * Proves the durable-cursor sweep against a REAL Postgres. The design this
 * replaces took "newest-updated, top N" every tick, which starves any program
 * outside the freshest window once the table exceeds N — systematically, not
 * as an edge case. What is proven here:
 *
 *   1. Bounded batch — a tick never takes more than the requested size.
 *   2. Progression — >2 batches walk DISTINCT rows, no repeat, no skip.
 *   3. Cold restart — a fresh claim (as a new process would make; the cursor
 *      lives only in Postgres) resumes at the persisted position.
 *   4. Mutual exclusion — a live lease cannot be claimed twice.
 *   5. FENCING — a worker whose lease expired and was taken over CANNOT write
 *      progress: its advance is rejected and the new owner's cursor stands.
 *      This is what a bare expiry timestamp cannot give.
 *   6. Failure retry — a failed tick releases without advancing, so the same
 *      batch is retried rather than skipped.
 *   7. STARVATION NEGATIVE — every row of a set that does NOT fit in one batch
 *      is visited within ceil(N/batch) ticks; the cycle wraps; a second pass
 *      reaches every row again.
 *
 * Uses its own database so "every audit_programs row" assertions are exact.
 *
 * RUN:
 *   CI=true NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 DATABASE_URL="postgresql://.../aud_cursor" \
 *   npx vitest run server/src/services/audits/__tests__/independenceScanCursor.realdb.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --maxConcurrency=1 --retry=0
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG) {
  process.env.DB_TYPE = 'postgres';
}

/**
 * FIXTURE CLEANUP SAFETY
 * ----------------------
 * This suite owns a GLOBAL singleton (audit_independence_scan_cursor) and it
 * reasons about "every audit_programs row", so its fixtures are only sound on
 * a database nobody else is using. An earlier revision expressed that by
 * running unqualified `DELETE FROM audit_programs` / `DELETE FROM
 * audit_independence_scan_cursor` in beforeEach — which is a loaded gun: point
 * DATABASE_URL at a shared or real database and the suite deletes that
 * database's audit programs.
 *
 * Destructive cleanup now requires ALL of the following, checked before any
 * DELETE is issued:
 *   1. explicit opt-in  — AUD_INDEPENDENCE_ALLOW_FIXTURE_CLEANUP=1
 *   2. a caller-provided disposable-database prefix —
 *      AUD_INDEPENDENCE_DISPOSABLE_DB_PREFIX (no default; the runner must name
 *      the throwaway database it created)
 *   3. `current_database()` actually starting with that prefix — asked of the
 *      server, not inferred from the connection string, which can lie
 *      (pgbouncer, search_path tricks, a copy-pasted URL)
 *
 * On top of that, every delete is scoped to THIS RUN's own id prefix, runs
 * inside a transaction holding a transaction-scoped advisory lock, and is
 * followed by a residue assertion over that same prefix. Nothing global is
 * ever deleted or truncated.
 */
const CLEANUP_OPT_IN = process.env.AUD_INDEPENDENCE_ALLOW_FIXTURE_CLEANUP === '1';
const DISPOSABLE_DB_PREFIX = process.env.AUD_INDEPENDENCE_DISPOSABLE_DB_PREFIX ?? '';

const DESTRUCTIVE_FIXTURES_ENABLED = REAL_PG && CLEANUP_OPT_IN && DISPOSABLE_DB_PREFIX.length > 0;

const suite = DESTRUCTIVE_FIXTURES_ENABLED ? describe : describe.skip;

if (!REAL_PG) {
  // eslint-disable-next-line no-console
  console.warn(
    '[independenceScanCursor.realdb.test.ts SKIPPED — clean skip, not a failure] wymaga ' +
      'NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://...',
  );
} else if (!DESTRUCTIVE_FIXTURES_ENABLED) {
  // eslint-disable-next-line no-console
  console.warn(
    '[independenceScanCursor.realdb.test.ts SKIPPED — clean skip, not a failure] this suite ' +
      'mutates a GLOBAL singleton and therefore refuses to run without an explicit disposable-database ' +
      'declaration: set AUD_INDEPENDENCE_ALLOW_FIXTURE_CLEANUP=1 and ' +
      'AUD_INDEPENDENCE_DISPOSABLE_DB_PREFIX=<prefix of the throwaway database you created>.',
  );
}

/** Advisory-lock key: constant for this suite, so two concurrent runs serialise instead of interleaving. */
const CLEANUP_LOCK_KEY = 8_113_2026;

suite('independenceScanCursor — durable checkpoint + fenced lease (real Postgres)', () => {
  let cursorMod: typeof import('../independenceScanCursor.js');
  let jobMod: typeof import('../../../jobs/auditIndependenceDetectorJob.js');
  let auditsDb: typeof import('../auditsDb.js');

  const testOrgId = `aud-cursor-org-${randomUUID()}`;
  /**
   * Every row this suite creates carries this prefix in its primary key, so
   * cleanup can target exactly what the run owns. It is also why the ids sort
   * contiguously, which keeps the ORDER BY id ASC walk deterministic.
   */
  const RUN_PREFIX = `aprog_audindep_${randomUUID().replace(/-/g, '')}_`;
  let acquirePgClient: typeof import('../../../database/PostgresDatabase.js').acquirePgClient;

  /**
   * Refuses unless the server itself reports a database whose name starts with
   * the caller-declared disposable prefix. Throws BEFORE any destructive
   * statement is prepared, so a mismatch cannot execute a partial cleanup.
   */
  async function assertDisposableDatabase(prefixOverride?: string): Promise<string> {
    const prefix = prefixOverride ?? DISPOSABLE_DB_PREFIX;
    if (!CLEANUP_OPT_IN) {
      throw new Error('AUD_INDEPENDENCE_FIXTURE_CLEANUP_NOT_OPTED_IN');
    }
    if (!prefix) {
      throw new Error('AUD_INDEPENDENCE_DISPOSABLE_DB_PREFIX_MISSING');
    }
    const row = await auditsDb.auditGet<{ db: string }>(`SELECT current_database() AS db`);
    const db = String(row?.db ?? '');
    if (!db.startsWith(prefix)) {
      throw new Error(
        `AUD_INDEPENDENCE_DISPOSABLE_DB_MISMATCH: current_database()='${db}' does not start with declared disposable prefix '${prefix}' — refusing to delete anything.`,
      );
    }
    return db;
  }

  /**
   * FK-safe, exactly-scoped cleanup of this run's rows, inside one transaction
   * holding a transaction-scoped advisory lock. Children are removed before
   * parents. The global cursor singleton is reset only here — after the
   * disposable-database guard has passed — because it is the one row this
   * suite legitimately owns on a throwaway database.
   */
  async function cleanupOwnFixtures(prefixOverride?: string): Promise<void> {
    await assertDisposableDatabase(prefixOverride);
    const client = await acquirePgClient();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [CLEANUP_LOCK_KEY]);
      const like = `${RUN_PREFIX}%`;
      // Children first (FK-safe), then the parent rows — all restricted to ids
      // this run created. No unqualified DELETE, no TRUNCATE.
      await client.query(`DELETE FROM audit_program_criteria WHERE program_id LIKE $1`, [like]);
      await client.query(`DELETE FROM audit_programs WHERE id LIKE $1`, [like]);
      await client.query(`DELETE FROM audit_independence_scan_cursor WHERE id = 'global'`);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async function countOwnPrograms(): Promise<number> {
    const row = await auditsDb.auditGet<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit_programs WHERE id LIKE $1`,
      [`${RUN_PREFIX}%`],
    );
    return Number(row?.n ?? -1);
  }

  beforeAll(async () => {
    cursorMod = await import('../independenceScanCursor.js');
    jobMod = await import('../../../jobs/auditIndependenceDetectorJob.js');
    auditsDb = await import('../auditsDb.js');
    ({ acquirePgClient } = await import('../../../database/PostgresDatabase.js'));
    await assertDisposableDatabase();
  });

  beforeEach(async () => {
    await cleanupOwnFixtures();
  });

  afterAll(async () => {
    await cleanupOwnFixtures();
    // Residue assertion: this run must leave none of its own rows behind.
    expect(await countOwnPrograms()).toBe(0);
  });

  async function seedPrograms(count: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count; i += 1) {
      // Zero-padded so lexical id order matches insertion order, keeping the
      // ORDER BY id ASC walk predictable for the progression assertions.
      const id = `${RUN_PREFIX}${String(i).padStart(4, '0')}`;
      ids.push(id);
      await auditsDb.auditRun(
        `INSERT INTO audit_programs (id, organization_id, name, created_by) VALUES ($1, $2, $3, $4)`,
        [id, testOrgId, `Cursor test program ${i}`, `aud-cursor-seeder-${testOrgId}`],
      );
    }
    return ids;
  }

  async function readCursor() {
    return auditsDb.auditGet<{
      last_program_id: string;
      cycles_completed: string;
      lease_fence: string;
      leased_until: string | null;
    }>(
      `SELECT last_program_id, cycles_completed, lease_fence, leased_until
         FROM audit_independence_scan_cursor WHERE id = 'global'`,
    );
  }

  it('1. bounded batch: a fetch never returns more rows than requested', async () => {
    await seedPrograms(15);
    expect((await cursorMod.fetchNextBatch('', 5)).length).toBe(5);
  });

  it('2. progression: three batches walk DISTINCT rows with no repeat and no skip', async () => {
    // 26 > 3 * 8, so all three ticks are FULL batches and none of them is the
    // end-of-table partial — this test isolates mid-cycle progression; the
    // partial/wrap behaviour is covered by the starvation test below.
    const ids = await seedPrograms(26);
    const batchSize = 8;
    const seen = new Set<string>();
    let previousCursor = '';

    for (let tick = 0; tick < 3; tick += 1) {
      const lease = await cursorMod.claimLease(`runner-${tick}`);
      expect(lease.claimed).toBe(true);
      expect(lease.lastProgramId).toBe(previousCursor);

      const batch = await cursorMod.fetchNextBatch(lease.lastProgramId, batchSize);
      expect(batch.length).toBe(batchSize);
      batch.forEach((p) => {
        expect(seen.has(p.id)).toBe(false);
        seen.add(p.id);
      });

      expect(await cursorMod.advanceAndRelease(lease.fence, batch, batchSize)).toBe(true);
      previousCursor = batch[batch.length - 1]!.id;
    }

    expect(seen.size).toBe(3 * batchSize);
    expect(ids.filter((id) => seen.has(id)).length).toBe(seen.size);
  });

  it('3. cold restart: a brand-new claim resumes from the persisted cursor, not from scratch', async () => {
    await seedPrograms(15);
    const batchSize = 5;

    const lease1 = await cursorMod.claimLease('runner-a');
    const batch1 = await cursorMod.fetchNextBatch(lease1.lastProgramId, batchSize);
    await cursorMod.advanceAndRelease(lease1.fence, batch1, batchSize);
    const persisted = batch1[batch1.length - 1]!.id;

    // A new process holds no memory of the sweep; everything must come back
    // from Postgres.
    const afterRestart = await cursorMod.claimLease('runner-b-after-cold-restart');
    expect(afterRestart.claimed).toBe(true);
    expect(afterRestart.lastProgramId).toBe(persisted);
    expect(afterRestart.lastProgramId).not.toBe('');
  });

  it('4. mutual exclusion: a live lease cannot be claimed by a second worker', async () => {
    await seedPrograms(5);
    expect((await cursorMod.claimLease('worker-1')).claimed).toBe(true);
    expect((await cursorMod.claimLease('worker-2')).claimed).toBe(false);
  });

  it('5. FENCING: after its lease expires and worker-2 takes over, worker-1 cannot write progress', async () => {
    const ids = await seedPrograms(12);
    const batchSize = 4;

    // Worker 1 claims and starts scanning.
    const w1 = await cursorMod.claimLease('worker-1');
    expect(w1.claimed).toBe(true);
    const w1Batch = await cursorMod.fetchNextBatch(w1.lastProgramId, batchSize);

    // Worker 1 stalls long enough for its lease to lapse (simulated exactly as
    // reality does it: nothing releases the lease, it simply expires).
    await auditsDb.auditRun(
      `UPDATE audit_independence_scan_cursor SET leased_until = now() - interval '1 minute' WHERE id = 'global'`,
    );

    // Worker 2 takes over and legitimately records ITS batch.
    const w2 = await cursorMod.claimLease('worker-2');
    expect(w2.claimed).toBe(true);
    expect(w2.fence).toBeGreaterThan(w1.fence);
    const w2Batch = await cursorMod.fetchNextBatch(w2.lastProgramId, batchSize);
    expect(await cursorMod.advanceAndRelease(w2.fence, w2Batch, batchSize)).toBe(true);
    const cursorAfterW2 = (await readCursor())?.last_program_id;

    // Worker 1 finally finishes and tries to record progress: REJECTED.
    expect(await cursorMod.advanceAndRelease(w1.fence, w1Batch, batchSize)).toBe(false);
    // ...and it also cannot release the lease that now belongs to nobody/worker-2.
    expect(await cursorMod.releaseLeaseWithoutAdvancing(w1.fence)).toBe(false);

    // The cursor still reflects worker-2's work only — no rewind, no skip.
    expect((await readCursor())?.last_program_id).toBe(cursorAfterW2);
    expect(ids).toContain(cursorAfterW2);
  });

  it('5b. the job surfaces a superseded tick as progressRecorded=false rather than silently succeeding', async () => {
    await seedPrograms(6);
    // Take the lease as an "old" worker, then expire it and let someone else bump the fence.
    const stale = await cursorMod.claimLease('stale-worker');
    expect(stale.claimed).toBe(true);
    await auditsDb.auditRun(
      `UPDATE audit_independence_scan_cursor SET leased_until = now() - interval '1 minute' WHERE id = 'global'`,
    );
    const fresh = await cursorMod.claimLease('fresh-worker');
    expect(fresh.claimed).toBe(true);

    // The stale worker's own advance is rejected by the fence.
    expect(await cursorMod.advanceAndRelease(stale.fence, [], 4)).toBe(false);

    // Release the fresh lease so runTick can proceed normally afterwards.
    expect(await cursorMod.releaseLeaseWithoutAdvancing(fresh.fence)).toBe(true);
    const ok = await jobMod.runTick(4);
    expect(ok.claimed).toBe(true);
    expect(ok.progressRecorded).toBe(true);
  });

  it('6. a failed tick releases without advancing, so the same batch is retried', async () => {
    await seedPrograms(5);
    const lease = await cursorMod.claimLease('runner-fail');
    expect(lease.lastProgramId).toBe('');
    expect(await cursorMod.releaseLeaseWithoutAdvancing(lease.fence)).toBe(true);

    const retry = await cursorMod.claimLease('runner-retry');
    expect(retry.claimed).toBe(true);
    expect(retry.lastProgramId).toBe(''); // not advanced — same batch will be re-fetched
  });

  it('7. STARVATION NEGATIVE: every row is visited within ceil(N/batch) ticks, the cycle wraps, and a second pass reaches all rows again', async () => {
    const batchSize = 4;
    const total = 17; // deliberately not a multiple of batchSize
    const ids = await seedPrograms(total);
    const expectedTicks = Math.ceil(total / batchSize);

    let wrappedOnTick = -1;
    for (let tick = 1; tick <= expectedTicks; tick += 1) {
      const result = await jobMod.runTick(batchSize);
      expect(result.claimed).toBe(true);
      expect(result.progressRecorded).toBe(true);
      expect(result.scanned).toBeLessThanOrEqual(batchSize);
      if (result.cycleWrapped) wrappedOnTick = tick;
    }

    const cursor = await readCursor();
    expect(cursor?.last_program_id).toBe(''); // wrapped back to the start
    expect(Number(cursor?.cycles_completed)).toBeGreaterThanOrEqual(1);
    expect(wrappedOnTick).toBe(expectedTicks); // the LAST tick wrapped, not an earlier one

    // Independent confirmation that the ordered walk really covers every row:
    // replay the same cursor arithmetic (runTick only reads audit_programs, so
    // the set is unchanged) and check the union.
    const walk = async () => {
      const seen = new Set<string>();
      let c = '';
      for (let i = 0; i < expectedTicks; i += 1) {
        const batch = await cursorMod.fetchNextBatch(c, batchSize);
        batch.forEach((p) => seen.add(p.id));
        if (batch.length > 0) c = batch[batch.length - 1]!.id;
      }
      return seen;
    };

    const firstPass = await walk();
    expect(firstPass.size).toBe(total);
    expect(ids.every((id) => firstPass.has(id))).toBe(true);

    // A second pass from the wrapped cursor reaches every row again — no row is
    // permanently excluded going forward.
    const secondPass = await walk();
    expect(secondPass.size).toBe(total);
    expect(ids.every((id) => secondPass.has(id))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 8. Fixture-cleanup safety. These prove the guard itself, because a guard
  //    nobody tests is exactly how the previous unqualified DELETE survived.
  // -------------------------------------------------------------------------
  describe('8. fixture cleanup is guarded, scoped and reversible', () => {
    it('a disposable-DB prefix MISMATCH aborts before any destructive statement runs', async () => {
      const ids = await seedPrograms(3);
      const before = await countOwnPrograms();
      expect(before).toBe(3);

      await expect(cleanupOwnFixtures('definitely-not-this-database-')).rejects.toThrow(
        /AUD_INDEPENDENCE_DISPOSABLE_DB_MISMATCH/,
      );

      // The canary rows are untouched: the guard refused before deleting.
      expect(await countOwnPrograms()).toBe(before);
      for (const id of ids) {
        const row = await auditsDb.auditGet<{ id: string }>(
          `SELECT id FROM audit_programs WHERE id = $1`,
          [id],
        );
        expect(row?.id).toBe(id);
      }
    });

    it('the guard asks the SERVER for current_database() and accepts only the declared prefix', async () => {
      const db = await assertDisposableDatabase();
      expect(db.startsWith(DISPOSABLE_DB_PREFIX)).toBe(true);
      // A prefix that is merely a substring (not a prefix) is still rejected.
      await expect(assertDisposableDatabase(`x${db}`)).rejects.toThrow(
        /AUD_INDEPENDENCE_DISPOSABLE_DB_MISMATCH/,
      );
    });

    it('a ROLLED BACK cleanup transaction deletes nothing (transaction-scoped, not autocommit)', async () => {
      await seedPrograms(4);
      expect(await countOwnPrograms()).toBe(4);

      await assertDisposableDatabase();
      const client = await acquirePgClient();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [CLEANUP_LOCK_KEY]);
        const res = await client.query(`DELETE FROM audit_programs WHERE id LIKE $1`, [
          `${RUN_PREFIX}%`,
        ]);
        expect(res.rowCount).toBe(4); // the delete really did match inside the tx
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }

      // After rollback the rows are still there — nothing was committed.
      expect(await countOwnPrograms()).toBe(4);
    });

    it('cleanup removes exactly this run\'s rows and leaves a foreign-prefixed row untouched', async () => {
      await seedPrograms(3);
      const foreignId = `aprog_not_this_run_${randomUUID()}`;
      await auditsDb.auditRun(
        `INSERT INTO audit_programs (id, organization_id, name, created_by) VALUES ($1, $2, $3, $4)`,
        [foreignId, testOrgId, 'Row owned by nobody in this run', 'foreign-seeder'],
      );

      try {
        await cleanupOwnFixtures();

        expect(await countOwnPrograms()).toBe(0); // residue assertion for our prefix
        const survivor = await auditsDb.auditGet<{ id: string }>(
          `SELECT id FROM audit_programs WHERE id = $1`,
          [foreignId],
        );
        expect(survivor?.id).toBe(foreignId); // scoped cleanup, not a global wipe
      } finally {
        // Remove the deliberately foreign row by its exact id — still no
        // unqualified DELETE.
        await auditsDb.auditRun(`DELETE FROM audit_programs WHERE id = $1`, [foreignId]);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 9. Migration 20261013 is late-apply safe against a pre-existing, partial,
  //    NON-EMPTY table — the case a bare CREATE TABLE IF NOT EXISTS silently
  //    mishandles.
  // -------------------------------------------------------------------------
  describe('9. migration 20261013 converges or fails closed on a pre-existing partial table', () => {
    const MIGRATION_PATH = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../../migrations/20261013_audit_independence_scan_cursor.sql',
    );

    function migrationSql(): string {
      return fs.readFileSync(MIGRATION_PATH, 'utf8');
    }

    /** Runs the migration file exactly as the runner would, in its own connection. */
    async function applyMigration(): Promise<void> {
      const client = await acquirePgClient();
      try {
        await client.query(migrationSql());
      } finally {
        client.release();
      }
    }

    async function dropCursorTable(): Promise<void> {
      await assertDisposableDatabase();
      await auditsDb.auditRun(`DROP TABLE IF EXISTS audit_independence_scan_cursor`);
    }

    afterAll(async () => {
      // Leave the table in its canonical shape for anything running after us.
      await dropCursorTable();
      await applyMigration();
    });

    it('is idempotent on the already-correct table (re-running changes nothing)', async () => {
      await applyMigration();
      await applyMigration();
      const cols = await auditsDb.auditAll<{ attname: string }>(
        `SELECT attname FROM pg_attribute
          WHERE attrelid = 'audit_independence_scan_cursor'::regclass AND attnum > 0 AND NOT attisdropped
          ORDER BY attnum`,
      );
      expect(cols.map((c) => c.attname)).toEqual([
        'id',
        'last_program_id',
        'cycles_completed',
        'lease_fence',
        'leased_by',
        'leased_until',
        'last_tick_at',
        'updated_at',
      ]);
    });

    it('CONVERGES a partial, NON-EMPTY legacy table and preserves its historical cursor/fence/progress', async () => {
      await dropCursorTable();
      // A legacy shape: correct PK, but missing the fencing and bookkeeping
      // columns that were added later — and already carrying real progress.
      await auditsDb.auditRun(`
        CREATE TABLE audit_independence_scan_cursor (
          id TEXT PRIMARY KEY DEFAULT 'global',
          last_program_id TEXT NOT NULL DEFAULT '',
          cycles_completed BIGINT NOT NULL DEFAULT 0
        )`);
      await auditsDb.auditRun(
        `INSERT INTO audit_independence_scan_cursor (id, last_program_id, cycles_completed)
         VALUES ('global', $1, 7)`,
        ['aprog_historical_position'],
      );

      await applyMigration();

      const row = await auditsDb.auditGet<{
        last_program_id: string;
        cycles_completed: string;
        lease_fence: string;
      }>(
        `SELECT last_program_id, cycles_completed, lease_fence
           FROM audit_independence_scan_cursor WHERE id = 'global'`,
      );
      // Historical progress survives; the new fence arrives at its default.
      expect(row?.last_program_id).toBe('aprog_historical_position');
      expect(Number(row?.cycles_completed)).toBe(7);
      expect(Number(row?.lease_fence)).toBe(0);

      // And the converged table is immediately usable by the real code path.
      const lease = await cursorMod.claimLease('post-convergence-runner');
      expect(lease.claimed).toBe(true);
      expect(lease.lastProgramId).toBe('aprog_historical_position');
      expect(lease.fence).toBe(1);
      await cursorMod.releaseLeaseWithoutAdvancing(lease.fence);
    });

    it('FAILS CLOSED with an explicit code on a wrong primary key, mutating nothing', async () => {
      await dropCursorTable();
      // Divergent shape: PK on the wrong column. Auto-"fixing" a primary key on
      // populated data is not a decision a migration may take.
      await auditsDb.auditRun(`
        CREATE TABLE audit_independence_scan_cursor (
          id TEXT NOT NULL,
          last_program_id TEXT NOT NULL DEFAULT '',
          CONSTRAINT audit_independence_scan_cursor_pkey PRIMARY KEY (last_program_id)
        )`);
      await auditsDb.auditRun(
        `INSERT INTO audit_independence_scan_cursor (id, last_program_id) VALUES ('global', 'legacy-key')`,
      );

      await expect(applyMigration()).rejects.toThrow(/AUD13_PK_MISMATCH/);

      // Nothing was added: the refusal happened before any ALTER.
      const cols = await auditsDb.auditAll<{ attname: string }>(
        `SELECT attname FROM pg_attribute
          WHERE attrelid = 'audit_independence_scan_cursor'::regclass AND attnum > 0 AND NOT attisdropped`,
      );
      expect(cols.map((c) => c.attname).sort()).toEqual(['id', 'last_program_id']);
      // ...and the row is intact.
      const row = await auditsDb.auditGet<{ id: string }>(
        `SELECT id FROM audit_independence_scan_cursor WHERE last_program_id = 'legacy-key'`,
      );
      expect(row?.id).toBe('global');
    });

    async function columnNames(): Promise<string[]> {
      const cols = await auditsDb.auditAll<{ attname: string }>(
        `SELECT attname FROM pg_attribute
          WHERE attrelid = 'audit_independence_scan_cursor'::regclass AND attnum > 0 AND NOT attisdropped`,
      );
      return cols.map((c) => c.attname).sort();
    }

    it('preflight FAILS CLOSED on a divergent column TYPE, mutating nothing', async () => {
      await dropCursorTable();
      await auditsDb.auditRun(`
        CREATE TABLE audit_independence_scan_cursor (
          id TEXT PRIMARY KEY DEFAULT 'global',
          last_program_id TEXT NOT NULL DEFAULT '',
          lease_fence TEXT NOT NULL DEFAULT '0'
        )`);

      await expect(applyMigration()).rejects.toThrow(/AUD13_COLUMN_TYPE_MISMATCH/);
      // Preflight ran before any ALTER: the other six columns were NOT added.
      expect(await columnNames()).toEqual(['id', 'last_program_id', 'lease_fence']);
    });

    it('preflight FAILS CLOSED on divergent NULLABILITY, mutating nothing', async () => {
      await dropCursorTable();
      await auditsDb.auditRun(`
        CREATE TABLE audit_independence_scan_cursor (
          id TEXT PRIMARY KEY DEFAULT 'global',
          last_program_id TEXT NULL DEFAULT ''
        )`);

      await expect(applyMigration()).rejects.toThrow(/AUD13_COLUMN_NULLABILITY_MISMATCH/);
      expect(await columnNames()).toEqual(['id', 'last_program_id']);
    });

    it('preflight FAILS CLOSED on a divergent DEFAULT, mutating nothing', async () => {
      await dropCursorTable();
      await auditsDb.auditRun(`
        CREATE TABLE audit_independence_scan_cursor (
          id TEXT PRIMARY KEY DEFAULT 'wrong-default',
          last_program_id TEXT NOT NULL DEFAULT ''
        )`);

      await expect(applyMigration()).rejects.toThrow(/AUD13_COLUMN_DEFAULT_MISMATCH/);
      expect(await columnNames()).toEqual(['id', 'last_program_id']);
    });

    it('preflight FAILS CLOSED when a nullable column carries an unexpected default, mutating nothing', async () => {
      await dropCursorTable();
      await auditsDb.auditRun(`
        CREATE TABLE audit_independence_scan_cursor (
          id TEXT PRIMARY KEY DEFAULT 'global',
          last_program_id TEXT NOT NULL DEFAULT '',
          leased_by TEXT DEFAULT 'someone'
        )`);

      await expect(applyMigration()).rejects.toThrow(/AUD13_COLUMN_DEFAULT_MISMATCH/);
      expect(await columnNames()).toEqual(['id', 'last_program_id', 'leased_by']);
    });

    it('the preflight verifies ALL EIGHT columns — the shipped table matches type, nullability and default exactly', async () => {
      await dropCursorTable();
      await applyMigration();
      const shape = await auditsDb.auditAll<{
        attname: string;
        typ: string;
        notnull: boolean;
        def: string | null;
      }>(
        `SELECT a.attname,
                a.atttypid::regtype::text AS typ,
                a.attnotnull AS notnull,
                pg_get_expr(d.adbin, d.adrelid) AS def
           FROM pg_attribute a
           LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE a.attrelid = 'audit_independence_scan_cursor'::regclass
            AND a.attnum > 0 AND NOT a.attisdropped
          ORDER BY a.attnum`,
      );
      expect(
        shape.map((c) => `${c.attname}|${c.typ}|${c.notnull}|${c.def ?? '-'}`),
      ).toEqual([
        "id|text|true|'global'::text",
        "last_program_id|text|true|''::text",
        'cycles_completed|bigint|true|0',
        'lease_fence|bigint|true|0',
        'leased_by|text|false|-',
        'leased_until|timestamp with time zone|false|-',
        'last_tick_at|timestamp with time zone|false|-',
        'updated_at|timestamp with time zone|true|now()',
      ]);
    });

    it('resolves the primary key by conrelid, not by constraint name — a same-named constraint on another table proves nothing', async () => {
      await dropCursorTable();
      // A decoy: another table carrying a constraint with the exact name the
      // cursor table's PK would have. A name-only check would be satisfied by
      // this and skip the real verification.
      await auditsDb.auditRun(`DROP TABLE IF EXISTS aud_decoy_same_constraint_name`);
      await auditsDb.auditRun(`
        CREATE TABLE aud_decoy_same_constraint_name (
          id TEXT NOT NULL,
          CONSTRAINT audit_independence_scan_cursor_pkey PRIMARY KEY (id)
        )`);
      try {
        // With the real table absent, the migration must still create it
        // correctly rather than believing the decoy's constraint.
        await applyMigration();
        const pk = await auditsDb.auditAll<{ attname: string }>(
          `SELECT a.attname
             FROM pg_constraint c
             JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
             JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
            WHERE c.conrelid = 'audit_independence_scan_cursor'::regclass AND c.contype = 'p'
            ORDER BY k.ord`,
        );
        expect(pk.map((r) => r.attname)).toEqual(['id']);
      } finally {
        await auditsDb.auditRun(`DROP TABLE IF EXISTS aud_decoy_same_constraint_name`);
      }
    });
  });
});
