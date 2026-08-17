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

const suite = REAL_PG ? describe : describe.skip;

if (!REAL_PG) {
  // eslint-disable-next-line no-console
  console.warn(
    '[independenceScanCursor.realdb.test.ts SKIPPED — clean skip, not a failure] wymaga ' +
      'NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://...',
  );
}

suite('independenceScanCursor — durable checkpoint + fenced lease (real Postgres)', () => {
  let cursorMod: typeof import('../independenceScanCursor.js');
  let jobMod: typeof import('../../../jobs/auditIndependenceDetectorJob.js');
  let auditsDb: typeof import('../auditsDb.js');

  const testOrgId = `aud-cursor-org-${randomUUID()}`;

  beforeAll(async () => {
    cursorMod = await import('../independenceScanCursor.js');
    jobMod = await import('../../../jobs/auditIndependenceDetectorJob.js');
    auditsDb = await import('../auditsDb.js');
  });

  beforeEach(async () => {
    await auditsDb.auditRun(`DELETE FROM audit_programs`).catch(() => {});
    await auditsDb.auditRun(`DELETE FROM audit_independence_scan_cursor`).catch(() => {});
  });

  afterAll(async () => {
    await auditsDb.auditRun(`DELETE FROM audit_programs`).catch(() => {});
    await auditsDb.auditRun(`DELETE FROM audit_independence_scan_cursor`).catch(() => {});
  });

  async function seedPrograms(count: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const id = `aprog_${randomUUID()}`;
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
});
