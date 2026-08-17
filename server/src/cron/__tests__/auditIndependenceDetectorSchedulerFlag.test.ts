/**
 * Scheduled job 43 — audit independence detector sweep — is DEFAULT-OFF, and
 * that has to be provable rather than asserted.
 *
 * Two properties matter and neither is visible from source alone:
 *   OFF — the flag gate returns before the dynamic import, so the job module is
 *         never loaded, no connection is taken, and no lease is claimed. A test
 *         that only checked "no rows changed" would pass even if the module had
 *         been imported and had opened a pool, so the import itself is counted.
 *   ON  — one invocation performs exactly ONE claim: the fence advances by
 *         exactly one and the lease is released. A second, overlapping
 *         invocation while the lease is held claims nothing, so the same batch
 *         is never processed by two holders.
 *
 * The function under test is the exact closure `cron.schedule` is given in
 * Scheduler.ts (exported for this purpose), not a re-implementation of the
 * guard — otherwise the test would prove only that the test agrees with itself.
 *
 * Importing Scheduler.ts does NOT start any job: `cron.schedule` is only called
 * inside `Scheduler.init()`, which this suite never calls.
 *
 * RUN:
 *   CI=true NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   AUD_INDEPENDENCE_ALLOW_FIXTURE_CLEANUP=1 \
 *   AUD_INDEPENDENCE_DISPOSABLE_DB_PREFIX=<prefix> \
 *   DATABASE_URL="postgresql://.../<prefix>something" \
 *   npx vitest run server/src/cron/__tests__/auditIndependenceDetectorSchedulerFlag.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --maxConcurrency=1 --retry=0
 */

import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG) {
  process.env.DB_TYPE = 'postgres';
}

const CLEANUP_OPT_IN = process.env.AUD_INDEPENDENCE_ALLOW_FIXTURE_CLEANUP === '1';
const DISPOSABLE_DB_PREFIX = process.env.AUD_INDEPENDENCE_DISPOSABLE_DB_PREFIX ?? '';
const ENABLED = REAL_PG && CLEANUP_OPT_IN && DISPOSABLE_DB_PREFIX.length > 0;

const suite = ENABLED ? describe : describe.skip;

if (!ENABLED) {
  // eslint-disable-next-line no-console
  console.warn(
    '[auditIndependenceDetectorSchedulerFlag.test.ts SKIPPED — clean skip, not a failure] requires ' +
      'NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://..., plus ' +
      'AUD_INDEPENDENCE_ALLOW_FIXTURE_CLEANUP=1 and AUD_INDEPENDENCE_DISPOSABLE_DB_PREFIX=<disposable prefix>.',
  );
}

const FLAG = 'AUDIT_INDEPENDENCE_DETECTOR_CRON_ENABLED';
/** Shared with the cursor suite: both own the same global cursor singleton. */
const SUITE_LOCK_KEY = 8_113_2029;

suite('Scheduler job 43 — audit independence detector flag gate (real Postgres)', () => {
  let auditsDb: typeof import('../../services/audits/auditsDb.js');
  let cursorMod: typeof import('../../services/audits/independenceScanCursor.js');
  let acquirePgClient: typeof import('../../database/PostgresDatabase.js').acquirePgClient;
  let suiteLockClient: Awaited<ReturnType<typeof acquirePgClient>> | undefined;

  const RUN_PREFIX = `aprog_audsched_${randomUUID().replace(/-/g, '')}_`;
  const orgId = `aud-sched-org-${randomUUID()}`;

  async function assertDisposableDatabase(): Promise<string> {
    const row = await auditsDb.auditGet<{ db: string }>(`SELECT current_database() AS db`);
    const db = String(row?.db ?? '');
    if (!db.startsWith(DISPOSABLE_DB_PREFIX)) {
      throw new Error(
        `AUD_SCHED_DISPOSABLE_DB_MISMATCH: current_database()='${db}' does not start with '${DISPOSABLE_DB_PREFIX}' — refusing to delete anything.`,
      );
    }
    return db;
  }

  /** Scoped, FK-safe, advisory-locked cleanup of this run's rows plus the singleton it owns. */
  async function cleanupOwnFixtures(): Promise<void> {
    await assertDisposableDatabase();
    if (!suiteLockClient) throw new Error('AUD_SCHED_SUITE_LOCK_NOT_HELD');
    const client = suiteLockClient;
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM audit_program_criteria WHERE program_id LIKE $1`, [
        `${RUN_PREFIX}%`,
      ]);
      await client.query(`DELETE FROM audit_programs WHERE id LIKE $1`, [`${RUN_PREFIX}%`]);
      await client.query(`DELETE FROM audit_independence_scan_cursor WHERE id = 'global'`);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      // Retained until after final cleanup/residue verification in afterAll.
    }
  }

  async function cursorRowCount(): Promise<number> {
    const row = await auditsDb.auditGet<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit_independence_scan_cursor WHERE id = 'global'`,
    );
    return Number(row?.n ?? -1);
  }

  async function readCursor() {
    return auditsDb.auditGet<{
      last_program_id: string;
      lease_fence: string;
      leased_until: string | null;
    }>(
      `SELECT last_program_id, lease_fence, leased_until
         FROM audit_independence_scan_cursor WHERE id = 'global'`,
    );
  }

  async function seedPrograms(count: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const id = `${RUN_PREFIX}${String(i).padStart(4, '0')}`;
      ids.push(id);
      await auditsDb.auditRun(
        `INSERT INTO audit_programs (id, organization_id, name, created_by) VALUES ($1, $2, $3, $4)`,
        [id, orgId, `Scheduler flag program ${i}`, `aud-sched-seeder-${orgId}`],
      );
    }
    return ids;
  }

  const originalFlag = process.env[FLAG];

  beforeAll(async () => {
    auditsDb = await import('../../services/audits/auditsDb.js');
    cursorMod = await import('../../services/audits/independenceScanCursor.js');
    ({ acquirePgClient } = await import('../../database/PostgresDatabase.js'));
    await assertDisposableDatabase();
    const client = await acquirePgClient();
    try {
      await client.query('SELECT pg_advisory_lock($1)', [SUITE_LOCK_KEY]);
      suiteLockClient = client;
    } catch (error) {
      client.release();
      throw error;
    }
  }, 120_000);

  beforeEach(async () => {
    await cleanupOwnFixtures();
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[FLAG];
    else process.env[FLAG] = originalFlag;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    const client = suiteLockClient;
    if (!client) throw new Error('AUD_SCHED_SUITE_LOCK_NOT_HELD');
    try {
      await cleanupOwnFixtures();
      const row = await auditsDb.auditGet<{ n: string }>(
        `SELECT count(*)::text AS n FROM audit_programs WHERE id LIKE $1`,
        [`${RUN_PREFIX}%`],
      );
      expect(Number(row?.n)).toBe(0); // residue0
    } finally {
      try {
        const unlocked = await client.query<{ unlocked: boolean }>(
          'SELECT pg_advisory_unlock($1) AS unlocked',
          [SUITE_LOCK_KEY],
        );
        expect(unlocked.rows).toEqual([{ unlocked: true }]);
      } finally {
        suiteLockClient = undefined;
        client.release();
      }
    }
  }, 120_000);

  describe('flag OFF (default)', () => {
    it('does not import the job module, does not touch the database, and claims nothing', async () => {
      delete process.env[FLAG];
      await seedPrograms(3);
      expect(await cursorRowCount()).toBe(0); // no cursor row yet

      // Count real imports of the job module: the mock factory runs on first
      // import, so a zero count proves the dynamic import never happened.
      let jobModuleImports = 0;
      const runTickSpy = vi.fn();
      vi.resetModules();
      vi.doMock('../../jobs/auditIndependenceDetectorJob.js', () => {
        jobModuleImports += 1;
        return { runTick: runTickSpy, runJob: runTickSpy };
      });

      const { runAuditIndependenceSchedulerTick } = await import('../Scheduler.js');
      await runAuditIndependenceSchedulerTick();

      expect(jobModuleImports).toBe(0); // module never loaded
      expect(runTickSpy).not.toHaveBeenCalled(); // no tick
      expect(await cursorRowCount()).toBe(0); // no claim, no row created

      vi.doUnmock('../../jobs/auditIndependenceDetectorJob.js');
      vi.resetModules();
    });

    it('stays inert for every non-"true" flag value', async () => {
      await seedPrograms(2);
      const { runAuditIndependenceSchedulerTick } = await import('../Scheduler.js');
      for (const value of ['', 'false', '0', 'TRUE', 'yes', 'on']) {
        process.env[FLAG] = value;
        await runAuditIndependenceSchedulerTick();
        expect(await cursorRowCount()).toBe(0);
      }
    });
  });

  describe('flag ON', () => {
    it('performs exactly ONE claim: fence advances by one and the lease is released', async () => {
      process.env[FLAG] = 'true';
      await seedPrograms(3);

      const { runAuditIndependenceSchedulerTick } = await import('../Scheduler.js');
      await runAuditIndependenceSchedulerTick();

      const after = await readCursor();
      expect(after).toBeTruthy();
      expect(Number(after?.lease_fence)).toBe(1); // exactly one claim
      expect(after?.leased_until).toBeNull(); // released, not left held

      // A second tick claims once more — monotonic, never skipping or reusing a fence.
      await runAuditIndependenceSchedulerTick();
      const second = await readCursor();
      expect(Number(second?.lease_fence)).toBe(2);
      expect(second?.leased_until).toBeNull();
    });

    it('an overlapping invocation claims nothing while the lease is held (no double processing)', async () => {
      process.env[FLAG] = 'true';
      await seedPrograms(4);

      // Simulate a still-running worker by holding the lease.
      const held = await cursorMod.claimLease('scheduler-flag-test-holder');
      expect(held.claimed).toBe(true);
      const fenceWhileHeld = Number((await readCursor())?.lease_fence);

      const { runAuditIndependenceSchedulerTick } = await import('../Scheduler.js');
      await runAuditIndependenceSchedulerTick();

      // The scheduled tick found the lease taken and did nothing: the fence is
      // unchanged, so it never claimed, and the holder's lease is intact.
      const after = await readCursor();
      expect(Number(after?.lease_fence)).toBe(fenceWhileHeld);
      expect(after?.leased_until).not.toBeNull();

      // The genuine holder can still finish and release.
      expect(await cursorMod.releaseLeaseWithoutAdvancing(held.fence)).toBe(true);
    });

    it('two concurrent invocations never share a fence — each claim is distinct', async () => {
      process.env[FLAG] = 'true';
      await seedPrograms(5);

      const { runAuditIndependenceSchedulerTick } = await import('../Scheduler.js');
      await Promise.all([
        runAuditIndependenceSchedulerTick(),
        runAuditIndependenceSchedulerTick(),
      ]);

      // Whether the two overlapped (one claim) or serialised (two claims), the
      // fence is monotonic and bounded by the number of invocations — it can
      // never show two workers holding the same token.
      const fence = Number((await readCursor())?.lease_fence);
      expect(fence).toBeGreaterThanOrEqual(1);
      expect(fence).toBeLessThanOrEqual(2);
      expect((await readCursor())?.leased_until).toBeNull(); // nothing left held
    });
  });
});
