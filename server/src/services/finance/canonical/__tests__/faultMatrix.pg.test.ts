/**
 * W9 FAULT/CONCURRENCY/TENANT MATRIX — part B: FAULT INJECTION on the compute
 * job queue (`compute_jobs` / `compute_job_runs` / `compute_job_outputs`).
 *
 * Contract under test: `docs/validation/finance-v3/generated/gate-b/WP-B04_jobs_runs_outputs_ADR.md`
 * (leases §5.1, heartbeat §5.2, reaper §5.3, at-least-once + idempotent commit
 * §6, cancel/kill switch §7, retry/DLQ §10). Gate FC-11.
 *
 * ============================================================================
 * WHAT ACTUALLY EXISTS — established by reading the code BEFORE writing tests,
 * per the brief's instruction not to build anything that is missing.
 * ============================================================================
 *
 * IMPLEMENTED in `computeJobService.ts` (and therefore tested below):
 *   - `enqueue()`   — idempotent on (organization_id, job_type, idempotency_key)
 *   - `claim()`     — `FOR UPDATE SKIP LOCKED`, sets `lease_owner`/`lease_expires_at`,
 *                     bumps `attempt_count`, inserts the `compute_job_runs` attempt row
 *   - `completeJobSuccess()` — append-only output, `UNIQUE(job_id)` makes a second
 *                     commit a typed `OUTPUT_ALREADY_COMMITTED`, not a raw 23505
 *   - `failJob()`   — linear backoff requeue while attempts remain, terminal `failed` after
 *   - `cancelJob()` — flips `queued`/`running` to `cancelled`
 *
 * NOT IMPLEMENTED ANYWHERE IN `server/src` (verified by grep over the whole
 * server tree, not inferred from docs) — reported as EVIDENCE_MISSING and
 * PROVEN missing by the `describe('B — EVIDENCE_MISSING …')` block below, which
 * asserts the ABSENCE as a fact rather than skipping:
 *   - REAPER (ADR §5.3). Nothing reads `compute_jobs.lease_expires_at`. No code
 *     ever writes `compute_job_runs.outcome = 'lease_expired'`. An expired lease
 *     therefore strands the job in `running` forever.
 *   - HEARTBEAT (ADR §5.2). Nothing ever UPDATEs `compute_job_runs.last_heartbeat_at`
 *     or extends `lease_expires_at`. The column exists and is never written after
 *     its DEFAULT.
 *   - KILL SWITCH / PER-ORG CONCURRENCY (ADR §5.1, §7.2, §8). `org_concurrency_limit()`
 *     and `is_org_compute_killed()` have no DDL (the WP-C01 migration says so in its
 *     own header) and no application-side equivalent.
 *   - WORKER LOOP. There is no daemon, no poller, no scheduler that drains the queue.
 *     `claim()` is only ever called INLINE, by the compute service that just
 *     enqueued the job in the same function call (`baselineComputeService.ts:411`,
 *     `predictionComputeService.ts:261/444`, `valuationComputeService.ts:340`) —
 *     a self-claim, not a worker pool. Consequence: any job left `queued` (by a
 *     requeue-on-failure, or by a crash before the inline claim) is never picked
 *     up by anything, ever.
 *
 * These are findings about the SYSTEM, not gaps in this test file. This work
 * package measures; it does not implement.
 *
 * HOW TO RUN (own throwaway ephemeral cluster only — NEVER shared/demo/staging/prod):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config vitest.config.ts \
 *     src/services/finance/canonical/__tests__/faultMatrix.pg.test.ts \
 *     --no-file-parallelism
 *   (run from `server/`)
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('W9-B — compute queue fault injection (real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let svc: typeof import('../artifactVersionService.js');
  let jobs: typeof import('../computeJobService.js');

  const orgId = `org-w9b-${randomUUID()}`;
  const userId = `user-w9b-${randomUUID()}`;

  let artifactId: string;
  let workingRevisionId: string;
  let engineManifestId: string;

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    svc = await import('../artifactVersionService.js');
    jobs = await import('../computeJobService.js');

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'W9 Fault Matrix Org'])
    );

    const created = await svc.createArtifact({
      organizationId: orgId,
      artifactType: 'BASELINE_MODEL',
      createdBy: userId,
    });
    artifactId = created.artifact.artifact_id;
    workingRevisionId = created.workingRevision.working_revision_id;
    engineManifestId = created.businessVersion.engine_manifest_id;
  });

  /** Independent physical read of the job row — never a service return value. */
  async function readJob(jobId: string) {
    return withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{
        id: string;
        status: string;
        attempt_count: number;
        max_attempts: number;
        lease_owner: string | null;
        lease_expires_at: string | null;
        next_attempt_at: string;
        finished_at: string | null;
        cancel_requested_at: string | null;
      }>(
        `SELECT id, status, attempt_count, max_attempts, lease_owner, lease_expires_at,
                next_attempt_at, finished_at, cancel_requested_at
           FROM compute_jobs WHERE id = ?`,
        [jobId]
      )
    );
  }

  async function readOutputs(jobId: string) {
    return withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string; committed_by_attempt_number: number; content_semantic_hash: string }>(
        `SELECT id, committed_by_attempt_number, content_semantic_hash FROM compute_job_outputs WHERE job_id = ?`,
        [jobId]
      )
    );
  }

  async function readRuns(jobId: string) {
    return withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ attempt_number: number; worker_id: string; outcome: string | null; last_heartbeat_at: string; finished_at: string | null }>(
        `SELECT attempt_number, worker_id, outcome, last_heartbeat_at, finished_at
           FROM compute_job_runs WHERE job_id = ? ORDER BY attempt_number`,
        [jobId]
      )
    );
  }

  async function enqueueOne(jobType: string, idempotencyKey = `w9b-${randomUUID()}`) {
    const result = await jobs.enqueue({
      organizationId: orgId,
      jobType,
      inputArtifactId: artifactId,
      inputRevisionHash: `hash-${randomUUID()}`,
      engineManifestId,
      idempotencyKey,
      requestedByUserId: userId,
    });
    // Physical pre-state proof: the row exists, exactly one of it, and is queued.
    const row = await readJob(result.job.id);
    expect(row).not.toBeNull();
    expect(row!.status).toBe('queued');
    return result;
  }

  // =========================================================================
  // B1 — job abandoned by a worker (lease expires)
  // =========================================================================
  describe('B1 — abandoned job / expired lease', () => {
    it('EVIDENCE_MISSING: no reaper exists — an expired lease strands the job in `running` forever', async () => {
      const jobType = `w9b1_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);

      const [claimed] = await jobs.claim({ workerId: 'w9b1-doomed-worker', jobTypes: [jobType], limit: 1, leaseDurationSeconds: 300 });
      expect(claimed.id).toBe(job.id);

      const running = await readJob(job.id);
      expect(running!.status).toBe('running');
      expect(running!.lease_owner).toBe('w9b1-doomed-worker');
      expect(running!.lease_expires_at).toBeTruthy();
      expect(running!.attempt_count).toBe(1);

      // FAULT INJECTION: the worker dies. We do not call failJob/complete —
      // a dead process cannot. We only fast-forward the lease past expiry,
      // which is exactly what wall-clock would do 5 minutes later.
      const expired = await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE compute_jobs SET lease_expires_at = now() - interval '1 minute' WHERE id = ?`, [job.id])
      );
      expect(expired.changes).toBe(1);

      // A healthy system would have a reaper (ADR §5.3) requeue this row.
      // Give any hypothetical background process a real window to act.
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const afterExpiry = await readJob(job.id);
      // THE FINDING: still `running`, still leased to a worker that no longer exists.
      expect(afterExpiry!.status).toBe('running');
      expect(afterExpiry!.lease_owner).toBe('w9b1-doomed-worker');

      // ...and `claim()` will never see it again, because the claim query only
      // looks at `status = 'queued'`. The job is unreachable, permanently.
      const reclaimed = await jobs.claim({ workerId: 'w9b1-rescuer', jobTypes: [jobType], limit: 5 });
      expect(reclaimed).toHaveLength(0);

      // No `lease_expired` run outcome was ever written (nothing in the codebase writes it).
      const runs = await readRuns(job.id);
      expect(runs).toHaveLength(1);
      expect(runs[0].outcome).toBeNull();

      // No double result — trivially true, because there is no first result either.
      expect(await readOutputs(job.id)).toHaveLength(0);
    });

    it('the RECOVERY the reaper would perform is sound if someone performs it — no double output after requeue', async () => {
      // This proves the *rest* of the mechanism is fine and the reaper is the
      // only missing piece: we apply the ADR §5.3 UPDATE by hand and show the
      // job then completes exactly once.
      const jobType = `w9b1r_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);

      const [claimed] = await jobs.claim({ workerId: 'w9b1r-dead', jobTypes: [jobType], limit: 1 });
      expect(claimed.attempt_count).toBe(1);

      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE compute_jobs SET lease_expires_at = now() - interval '1 minute' WHERE id = ?`, [job.id])
      );

      // ADR §5.3 reaper statement, applied manually (this statement lives in NO
      // production file — that is the finding; here it only proves recoverability).
      const reaped = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string }>(
          `UPDATE compute_jobs
              SET status = 'queued', lease_owner = NULL, lease_expires_at = NULL, next_attempt_at = now()
            WHERE status = 'running' AND lease_expires_at < now() AND id = ?
            RETURNING id`,
          [job.id]
        )
      );
      expect(reaped).toHaveLength(1);

      const [reclaimed] = await jobs.claim({ workerId: 'w9b1r-live', jobTypes: [jobType], limit: 1 });
      expect(reclaimed.id).toBe(job.id);
      expect(reclaimed.attempt_count).toBe(2); // attempt bumped, not reset

      const done = await jobs.completeJobSuccess({
        jobId: job.id,
        organizationId: orgId,
        outputArtifactId: artifactId,
        outputWorkingRevisionId: workingRevisionId,
        contentSemanticHash: `w9b1r-${randomUUID()}`,
      });
      expect(done.ok).toBe(true);

      // Exactly one output, attributed to attempt 2. No double result.
      const outputs = await readOutputs(job.id);
      expect(outputs).toHaveLength(1);
      expect(outputs[0].committed_by_attempt_number).toBe(2);

      // Two attempt rows exist (the dead one and the live one) — the audit
      // trail of at-least-once execution.
      const runs = await readRuns(job.id);
      expect(runs.map((r) => r.attempt_number)).toEqual([1, 2]);
    });
  });

  // =========================================================================
  // B2 — kill mid-flight: interrupted between compute and commit
  // =========================================================================
  describe('B2 — killed between computing and committing', () => {
    it('leaves NO partial result, and after a retry there is EXACTLY ONE compute_job_outputs row', async () => {
      const jobType = `w9b2_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);

      const [claimed] = await jobs.claim({ workerId: 'w9b2-worker-1', jobTypes: [jobType], limit: 1 });
      expect(claimed.attempt_count).toBe(1);

      // FAULT INJECTION: the worker has computed its domain rows and is inside
      // the commit transaction when the process is killed. We reproduce that
      // as a pinned transaction that writes real domain rows AND the output
      // row, then throws before COMMIT.
      const partialMarker = `w9b2-partial-${randomUUID()}`;
      await expect(
        withPinnedPostgresTransaction(async (tx) => {
          await tx.queryRun(
            `INSERT INTO compute_job_outputs (
               id, job_id, organization_id, output_artifact_id, output_working_revision_id,
               committed_by_attempt_number, content_semantic_hash
             ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [randomUUID(), job.id, orgId, artifactId, workingRevisionId, 1, partialMarker]
          );
          throw new Error('SIGKILL simulation: worker died after INSERT, before COMMIT');
        })
      ).rejects.toThrow(/SIGKILL simulation/);

      // Physical proof the partial write did not survive.
      expect(await readOutputs(job.id)).toHaveLength(0);
      const orphan = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string }>(`SELECT id FROM compute_job_outputs WHERE content_semantic_hash = ?`, [partialMarker])
      );
      expect(orphan).toHaveLength(0);

      // The dead worker's job is still `running` (nothing reaps it — see B1),
      // so the retry has to be driven by an explicit failJob, which IS
      // implemented and IS what a supervising caller would do.
      const failed = await jobs.failJob({ jobId: job.id, error: 'worker killed mid-commit' });
      expect(failed).not.toBeNull();
      expect(failed!.status).toBe('queued'); // attempts remain -> requeued

      // Measured backoff: failJob sets next_attempt_at = now() + 30s * attempt_count.
      const requeued = await readJob(job.id);
      expect(new Date(requeued!.next_attempt_at).getTime()).toBeGreaterThan(Date.now());

      // Fast-forward the backoff clock (test-side only) so the retry is claimable now.
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE compute_jobs SET next_attempt_at = now() WHERE id = ?`, [job.id])
      );

      const [retry] = await jobs.claim({ workerId: 'w9b2-worker-2', jobTypes: [jobType], limit: 1 });
      expect(retry.id).toBe(job.id);
      expect(retry.attempt_count).toBe(2);

      const finalHash = `w9b2-final-${randomUUID()}`;
      const done = await jobs.completeJobSuccess({
        jobId: job.id,
        organizationId: orgId,
        outputArtifactId: artifactId,
        outputWorkingRevisionId: workingRevisionId,
        contentSemanticHash: finalHash,
      });
      expect(done.ok).toBe(true);

      const outputs = await readOutputs(job.id);
      expect(outputs).toHaveLength(1);
      expect(outputs[0].content_semantic_hash).toBe(finalHash);
      expect(outputs[0].committed_by_attempt_number).toBe(2);

      const finalJob = await readJob(job.id);
      expect(finalJob!.status).toBe('succeeded');
      expect(finalJob!.finished_at).toBeTruthy();
    });

    it('at-least-once: a resurrected first worker that also commits is rejected TYPED, not with a raw 23505', async () => {
      // ADR §6 — the whole point of UNIQUE(job_id): two real executions of the
      // same job must still yield exactly one output.
      const jobType = `w9b2b_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);
      await jobs.claim({ workerId: 'w9b2b-worker', jobTypes: [jobType], limit: 1 });

      const first = await jobs.completeJobSuccess({
        jobId: job.id,
        organizationId: orgId,
        outputArtifactId: artifactId,
        outputWorkingRevisionId: workingRevisionId,
        contentSemanticHash: `w9b2b-${randomUUID()}`,
      });
      expect(first.ok).toBe(true);

      const zombie = await jobs.completeJobSuccess({
        jobId: job.id,
        organizationId: orgId,
        outputArtifactId: artifactId,
        outputWorkingRevisionId: workingRevisionId,
        contentSemanticHash: `w9b2b-zombie-${randomUUID()}`,
      });
      expect(zombie.ok).toBe(false);
      if (zombie.ok) throw new Error('unreachable');
      // NOT_RUNNING because the job already went `succeeded`; either typed code
      // is acceptable, a raw Postgres error is not.
      expect(['NOT_RUNNING', 'OUTPUT_ALREADY_COMMITTED']).toContain(zombie.code);
      expect(zombie.message).not.toMatch(/duplicate key|23505/i);

      expect(await readOutputs(job.id)).toHaveLength(1);
    });
  });

  // =========================================================================
  // B3 — duplicate submission of the same job (same idempotency key)
  // =========================================================================
  describe('B3 — duplicate enqueue with the same idempotency key', () => {
    it('sequential double-submit yields ONE row', async () => {
      const jobType = `w9b3_${randomUUID()}`;
      const key = `w9b3-key-${randomUUID()}`;

      const first = await jobs.enqueue({
        organizationId: orgId,
        jobType,
        inputArtifactId: artifactId,
        inputRevisionHash: 'hash-b3',
        engineManifestId,
        idempotencyKey: key,
        requestedByUserId: userId,
      });
      expect(first.wasExisting).toBe(false);

      const second = await jobs.enqueue({
        organizationId: orgId,
        jobType,
        inputArtifactId: artifactId,
        inputRevisionHash: 'hash-b3',
        engineManifestId,
        idempotencyKey: key,
        requestedByUserId: userId,
      });
      expect(second.wasExisting).toBe(true);
      expect(second.job.id).toBe(first.job.id);

      const rows = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM compute_jobs WHERE organization_id = ? AND job_type = ? AND idempotency_key = ?`,
          [orgId, jobType, key]
        )
      );
      expect(rows).toHaveLength(1);
    });

    it('CONCURRENT double-submit (the real double-click) yields ONE row and no raw unique-violation', async () => {
      const jobType = `w9b3c_${randomUUID()}`;
      const key = `w9b3c-key-${randomUUID()}`;

      const submit = () =>
        jobs.enqueue({
          organizationId: orgId,
          jobType,
          inputArtifactId: artifactId,
          inputRevisionHash: 'hash-b3c',
          engineManifestId,
          idempotencyKey: key,
          requestedByUserId: userId,
        });

      // Promise.allSettled, not all — a rejection here is itself the finding
      // (the `ON CONFLICT DO NOTHING but no existing row found on read-back`
      // throw inside enqueue() is reachable under READ COMMITTED if the
      // read-back does not see the concurrently committed row).
      const [a, b] = await Promise.allSettled([submit(), submit()]);

      const rows = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM compute_jobs WHERE organization_id = ? AND job_type = ? AND idempotency_key = ?`,
          [orgId, jobType, key]
        )
      );
      expect(rows).toHaveLength(1);

      expect(a.status).toBe('fulfilled');
      expect(b.status).toBe('fulfilled');
      if (a.status !== 'fulfilled' || b.status !== 'fulfilled') throw new Error('unreachable');
      expect(a.value.job.id).toBe(b.value.job.id);
      // Exactly one of the two callers created it.
      expect([a.value.wasExisting, b.value.wasExisting].filter((x) => x === false)).toHaveLength(1);
    });
  });

  // =========================================================================
  // B4 — cancellation mid-flight
  // =========================================================================
  describe('B4 — cancel while running', () => {
    it('marks the job `cancelled` and NO result is ever stored', async () => {
      const jobType = `w9b4_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);

      const [claimed] = await jobs.claim({ workerId: 'w9b4-worker', jobTypes: [jobType], limit: 1 });
      expect(claimed.id).toBe(job.id);
      expect((await readJob(job.id))!.status).toBe('running');

      const cancelled = await jobs.cancelJob(job.id, 'user pressed Cancel');
      expect(cancelled).not.toBeNull();
      expect(cancelled!.status).toBe('cancelled');

      const physical = await readJob(job.id);
      expect(physical!.status).toBe('cancelled');
      expect(physical!.cancel_requested_at).toBeTruthy();

      // The worker, unaware, finishes computing and tries to commit. It must
      // NOT be able to write a result for a cancelled job.
      const late = await jobs.completeJobSuccess({
        jobId: job.id,
        organizationId: orgId,
        outputArtifactId: artifactId,
        outputWorkingRevisionId: workingRevisionId,
        contentSemanticHash: `w9b4-late-${randomUUID()}`,
      });
      expect(late.ok).toBe(false);
      if (late.ok) throw new Error('unreachable');
      expect(late.code).toBe('NOT_RUNNING');

      expect(await readOutputs(job.id)).toHaveLength(0);
      expect((await readJob(job.id))!.status).toBe('cancelled');
    });

    it('DEFECT W9-B4-a: cancelling a RUNNING job leaves finished_at NULL and the attempt row open forever', async () => {
      // Documented as a finding, asserted so it cannot regress silently in
      // either direction. `cancelJob()` writes neither `finished_at` on the
      // job nor `outcome`/`finished_at` on the in-flight `compute_job_runs`
      // row, even though the schema has a `'cancelled'` outcome value for
      // exactly this. Any "how long did jobs take" / "how many attempts ended
      // how" query over compute_job_runs silently under-counts.
      const jobType = `w9b4b_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);
      await jobs.claim({ workerId: 'w9b4b-worker', jobTypes: [jobType], limit: 1 });
      await jobs.cancelJob(job.id, 'cancel bookkeeping probe');

      const physical = await readJob(job.id);
      expect(physical!.status).toBe('cancelled');
      expect(physical!.finished_at).toBeNull(); // <-- the defect
      expect(physical!.lease_owner).toBe('w9b4b-worker'); // <-- lease never released

      const runs = await readRuns(job.id);
      expect(runs).toHaveLength(1);
      expect(runs[0].outcome).toBeNull(); // <-- never closed as 'cancelled'
      expect(runs[0].finished_at).toBeNull();
    });

    it('a cancelled job is NOT resurrected by a later claim()', async () => {
      const jobType = `w9b4c_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);
      const cancelled = await jobs.cancelJob(job.id, 'cancelled while still queued');
      expect(cancelled!.status).toBe('cancelled');

      const claimed = await jobs.claim({ workerId: 'w9b4c-worker', jobTypes: [jobType], limit: 5 });
      expect(claimed).toHaveLength(0);
      expect((await readJob(job.id))!.status).toBe('cancelled');
    });
  });

  // =========================================================================
  // Retry exhaustion / DLQ (ADR §10) — implemented, so measured
  // =========================================================================
  describe('B-extra — retry exhaustion (DLQ = status failed AND attempt_count >= max_attempts)', () => {
    it('requeues while attempts remain and goes terminal `failed` once exhausted', async () => {
      const jobType = `w9bdlq_${randomUUID()}`;
      const enqueued = await jobs.enqueue({
        organizationId: orgId,
        jobType,
        inputArtifactId: artifactId,
        inputRevisionHash: 'hash-dlq',
        engineManifestId,
        idempotencyKey: `w9bdlq-${randomUUID()}`,
        requestedByUserId: userId,
        maxAttempts: 2,
      });
      const jobId = enqueued.job.id;
      expect((await readJob(jobId))!.max_attempts).toBe(2);

      // Attempt 1 fails -> requeued.
      await jobs.claim({ workerId: 'dlq-w1', jobTypes: [jobType], limit: 1 });
      const after1 = await jobs.failJob({ jobId, error: 'boom 1' });
      expect(after1!.status).toBe('queued');
      expect((await readJob(jobId))!.attempt_count).toBe(1);

      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE compute_jobs SET next_attempt_at = now() WHERE id = ?`, [jobId])
      );

      // Attempt 2 fails -> terminal failed (attempt_count == max_attempts).
      await jobs.claim({ workerId: 'dlq-w2', jobTypes: [jobType], limit: 1 });
      const after2 = await jobs.failJob({ jobId, error: 'boom 2' });
      expect(after2!.status).toBe('failed');

      const terminal = await readJob(jobId);
      expect(terminal!.status).toBe('failed');
      expect(terminal!.attempt_count).toBeGreaterThanOrEqual(terminal!.max_attempts);
      expect(terminal!.finished_at).toBeTruthy();
      expect(terminal!.lease_owner).toBeNull();

      // DLQ is a computed predicate, not a column (ADR §10).
      const isDeadLetter = terminal!.status === 'failed' && terminal!.attempt_count >= terminal!.max_attempts;
      expect(isDeadLetter).toBe(true);

      // Both attempts are recorded, both closed as failed.
      const runs = await readRuns(jobId);
      expect(runs.map((r) => r.attempt_number)).toEqual([1, 2]);
      expect(runs.every((r) => r.outcome === 'failed')).toBe(true);

      // No output was ever written for a job that never succeeded.
      expect(await readOutputs(jobId)).toHaveLength(0);
    });

    it('EVIDENCE_MISSING: nothing raises an exception-ledger entry when a job dead-letters (ADR §10 names WP-B05 as the consumer)', async () => {
      const jobType = `w9bdlq2_${randomUUID()}`;
      const enqueued = await jobs.enqueue({
        organizationId: orgId,
        jobType,
        inputArtifactId: artifactId,
        inputRevisionHash: 'hash-dlq2',
        engineManifestId,
        idempotencyKey: `w9bdlq2-${randomUUID()}`,
        requestedByUserId: userId,
        maxAttempts: 1,
      });
      const jobId = enqueued.job.id;

      await jobs.claim({ workerId: 'dlq2-w1', jobTypes: [jobType], limit: 1 });
      const dead = await jobs.failJob({ jobId, error: 'terminal failure' });
      expect(dead!.status).toBe('failed');

      // `failJob()` does not touch the exception ledger. Proven, not assumed:
      // no finance_exceptions row references this job/artifact as a result of
      // the dead-lettering.
      const raised = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM finance_exceptions
            WHERE organization_id = ? AND source_ref::text LIKE ?`,
          [orgId, `%${jobId}%`]
        )
      );
      expect(raised).toHaveLength(0);
    });
  });

  // =========================================================================
  // EVIDENCE_MISSING block — absences asserted as facts
  // =========================================================================
  describe('B — EVIDENCE_MISSING: contract elements with no implementation', () => {
    it('heartbeat (ADR §5.2): `last_heartbeat_at` is never advanced by any code path', async () => {
      const jobType = `w9bhb_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);
      await jobs.claim({ workerId: 'hb-worker', jobTypes: [jobType], limit: 1 });

      const before = (await readRuns(job.id))[0];
      const leaseBefore = (await readJob(job.id))!.lease_expires_at;

      // A worker "computing" for a while. In a system with heartbeats, both
      // `last_heartbeat_at` and `lease_expires_at` would have moved.
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const after = (await readRuns(job.id))[0];
      const leaseAfter = (await readJob(job.id))!.lease_expires_at;

      // `pg` hands back Date objects for timestamptz — compare the instants.
      expect(new Date(after.last_heartbeat_at).getTime()).toBe(new Date(before.last_heartbeat_at).getTime()); // never advanced
      expect(new Date(leaseAfter!).getTime()).toBe(new Date(leaseBefore!).getTime()); // lease never extended
    });

    it('kill switch / per-org concurrency (ADR §5.1, §7.2, §8): the SQL functions do not exist', async () => {
      const present = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ proname: string }>(
          `SELECT proname FROM pg_proc WHERE proname IN ('org_concurrency_limit', 'is_org_compute_killed')`
        )
      );
      expect(present).toHaveLength(0);

      // And there is no application-side cap either: N jobs for one org are
      // all claimable at once, with no limit consulted.
      const jobType = `w9bconc_${randomUUID()}`;
      await Promise.all(Array.from({ length: 6 }, () => enqueueOne(jobType)));
      const claimed = await jobs.claim({ workerId: 'conc-worker', jobTypes: [jobType], limit: 6 });
      expect(claimed).toHaveLength(6); // no per-org concurrency limit applied
    });

    it('worker loop: a queued job is drained by NOTHING — only an inline self-claim ever runs', async () => {
      const jobType = `w9bloop_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);

      // Nobody claims it. Wait a window in which any poller would have fired.
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const stillQueued = await readJob(job.id);
      expect(stillQueued!.status).toBe('queued');
      expect(stillQueued!.attempt_count).toBe(0);
      expect(await readRuns(job.id)).toHaveLength(0);
    });
  });
});
