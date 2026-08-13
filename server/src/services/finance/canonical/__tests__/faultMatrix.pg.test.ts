/**
 * W9 FAULT/CONCURRENCY/TENANT MATRIX — part B: FAULT INJECTION on the compute
 * job queue (`compute_jobs` / `compute_job_runs` / `compute_job_outputs`).
 *
 * Contract under test: `docs/validation/finance-v3/generated/gate-b/WP-B04_jobs_runs_outputs_ADR.md`
 * (leases §5.1, heartbeat §5.2, reaper §5.3, at-least-once + idempotent commit
 * §6, cancel/kill switch §7, retry/DLQ §10). Gate FC-11.
 *
 * ============================================================================
 * UPDATED for the W2 queue contract closeout
 * (`docs/validation/finance-v3/generated/gate-d/W2_QUEUE_CONTRACT_report.md`).
 * This file originally documented six ADR elements as EVIDENCE_MISSING plus
 * one defect (W9-B-1/W9-B4-a). All seven are now closed; the tests below
 * were rewritten from "prove the absence" to "prove the fix", per the golden
 * rule that a test which cannot go red proves nothing — see the negative
 * control section of the W2 report for the revert-and-confirm-red evidence.
 * ============================================================================
 *
 * IMPLEMENTED in `computeJobService.ts` (and therefore tested below):
 *   - `enqueue()`   — idempotent on (organization_id, job_type, idempotency_key)
 *   - `claim()`     — `FOR UPDATE SKIP LOCKED`, sets `lease_owner`/`lease_expires_at`,
 *                     bumps `attempt_count`, inserts the `compute_job_runs` attempt row,
 *                     now also consults `is_org_compute_killed()` (EM-3) and
 *                     `org_concurrency_limit()` (EM-4)
 *   - `heartbeat()` — EM-2: extends the lease + `compute_job_runs.last_heartbeat_at`
 *   - `reapExpiredLeases()` — EM-1: ADR §5.3 recovery, requeues (backoff) or
 *                     dead-letters an abandoned job, closes its run row as
 *                     `outcome = 'lease_expired'`. Wired into
 *                     `server/src/cron/Scheduler.ts` (job 42, every minute) —
 *                     NOT auto-invoked by anything inside a bare test process,
 *                     so it must be called explicitly below (mirrors how a
 *                     real deployment's cron tick calls it out-of-band).
 *   - `completeJobSuccess()` — append-only output, `UNIQUE(job_id)` makes a second
 *                     commit a typed `OUTPUT_ALREADY_COMMITTED`, not a raw 23505
 *   - `failJob()`   — linear backoff requeue while attempts remain, terminal
 *                     `failed` after — which now also raises an EM-6 dead-letter
 *                     exception (`finance_exceptions`, `reasonCode = 'COMPUTE_JOB_DEAD_LETTER'`)
 *   - `cancelJob()` — flips `queued`/`running` to `cancelled`; W9-B-1 fix: now
 *                     also sets `finished_at`, releases the lease, and closes
 *                     the open `compute_job_runs` row as `outcome = 'cancelled'`
 *   - `setKillSwitch()`/`clearKillSwitch()` — EM-3 admin surface over
 *                     `compute_kill_switches` (org/job_type wildcards via NULL)
 *   - `setOrgConcurrencyLimit()` — EM-4 admin surface over
 *                     `compute_org_concurrency_limits`, generous global
 *                     default (50) seeded by the migration so existing callers
 *                     are unaffected unless a tighter cap is explicitly set
 *
 * STILL NOT IMPLEMENTED (honest EVIDENCE_MISSING, not silently dropped):
 *   - WORKER POOL that drains `queued` jobs a process did NOT itself enqueue
 *     and actually executes the corresponding domain compute (EM-5, partial).
 *     `claim()` is still only ever called INLINE by the compute service that
 *     just enqueued the job in the same function call
 *     (`baselineComputeService.ts:420`, `predictionComputeService.ts:262/452`,
 *     `valuationComputeService.ts:373`) — a self-claim, not a worker pool.
 *     `compute_jobs` has no payload column to reconstruct the domain-specific
 *     call parameters those services need (businessVersionId, entityId,
 *     forecastPeriodIds, ...), so a real drain-and-execute loop needs a
 *     schema/contract decision beyond this work package's scope. See the W2
 *     report §EM-5 for the full reasoning.
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
    it('FIXED EM-1: reapExpiredLeases() requeues an abandoned job and closes the run as lease_expired (was: EVIDENCE_MISSING, stranded forever)', async () => {
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

      // Nothing recovers it on its own — reapExpiredLeases() is cron-driven
      // (server/src/cron/Scheduler.ts, job 42), not auto-invoked inside a
      // bare test process. This mirrors production: the row sits `running`
      // until the next scheduler tick calls the function below.
      const untouched = await readJob(job.id);
      expect(untouched!.status).toBe('running');

      // THE FIX: call the real reaper entry point directly.
      const reaped = await jobs.reapExpiredLeases({ batchSize: 10 });
      const mine = reaped.find((r) => r.jobId === job.id);
      expect(mine).toBeDefined();
      expect(mine!.outcome).toBe('requeued');
      expect(mine!.deadWorkerId).toBe('w9b1-doomed-worker');

      // Independent physical read — never the function's return value.
      const afterReap = await readJob(job.id);
      expect(afterReap!.status).toBe('queued');
      expect(afterReap!.lease_owner).toBeNull();
      expect(afterReap!.lease_expires_at).toBeNull();
      // Same linear backoff as failJob() (30s * attempt_count) — the reaper
      // does not dump the job back to the front of the queue immediately.
      expect(new Date(afterReap!.next_attempt_at).getTime()).toBeGreaterThan(Date.now() + 20_000);

      // The abandoned attempt's run row is now closed, not left NULL forever.
      const runsAfterReap = await readRuns(job.id);
      expect(runsAfterReap).toHaveLength(1);
      expect(runsAfterReap[0].outcome).toBe('lease_expired');
      expect(runsAfterReap[0].finished_at).toBeTruthy();

      // claim() does NOT see it yet — its backoff window has not passed.
      const tooEarly = await jobs.claim({ workerId: 'w9b1-too-early', jobTypes: [jobType], limit: 5 });
      expect(tooEarly).toHaveLength(0);

      // Fast-forward the backoff clock (test-side only, same pattern used
      // elsewhere in this file for failJob()'s backoff) so the retry is
      // claimable now — proving `claim()` DOES see it once its window opens.
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE compute_jobs SET next_attempt_at = now() WHERE id = ?`, [job.id])
      );
      const reclaimed = await jobs.claim({ workerId: 'w9b1-rescuer', jobTypes: [jobType], limit: 5 });
      expect(reclaimed).toHaveLength(1);
      expect(reclaimed[0].id).toBe(job.id);
      expect(reclaimed[0].attempt_count).toBe(2); // bumped by the ORIGINAL claim, not reset by the reaper

      expect(await readOutputs(job.id)).toHaveLength(0);
    });

    it('reaper safety: a FRESH heartbeat prevents the reaper from stealing the lease; a STALE one lets it reclaim', async () => {
      // This is the mandatory safety proof for EM-1: without it, a slow-but-
      // alive worker could have its job stolen mid-computation.
      const jobType = `w9b1hb_${randomUUID()}`;

      // --- case 1: fresh heartbeat -> untouched ---
      const { job: freshJob } = await enqueueOne(jobType);
      const [freshClaimed] = await jobs.claim({ workerId: 'w9b1hb-alive', jobTypes: [jobType], limit: 1, leaseDurationSeconds: 2 });
      expect(freshClaimed.id).toBe(freshJob.id);

      // Worker heartbeats BEFORE its short lease would expire, extending it
      // well past "now".
      const hb = await jobs.heartbeat({ jobId: freshJob.id, workerId: 'w9b1hb-alive', leaseDurationSeconds: 300 });
      expect(hb.ok).toBe(true);
      if (!hb.ok) throw new Error('unreachable');
      expect(new Date(hb.leaseExpiresAt).getTime()).toBeGreaterThan(Date.now() + 60_000);

      const runsBeforeReap = await readRuns(freshJob.id);
      expect(runsBeforeReap[0].last_heartbeat_at).toBeTruthy();

      const reapedFresh = await jobs.reapExpiredLeases({ batchSize: 50 });
      expect(reapedFresh.find((r) => r.jobId === freshJob.id)).toBeUndefined();

      const stillRunning = await readJob(freshJob.id);
      expect(stillRunning!.status).toBe('running'); // NOT stolen
      expect(stillRunning!.lease_owner).toBe('w9b1hb-alive');

      // --- case 2: stale (no heartbeat, past its short lease) -> reclaimed ---
      const { job: staleJob } = await enqueueOne(jobType);
      const [staleClaimed] = await jobs.claim({ workerId: 'w9b1hb-dead', jobTypes: [jobType], limit: 1, leaseDurationSeconds: 1 });
      expect(staleClaimed.id).toBe(staleJob.id);

      await new Promise((resolve) => setTimeout(resolve, 1200)); // let the 1s lease actually pass wall-clock

      const reapedStale = await jobs.reapExpiredLeases({ batchSize: 50 });
      const staleResult = reapedStale.find((r) => r.jobId === staleJob.id);
      expect(staleResult).toBeDefined();
      expect(staleResult!.outcome).toBe('requeued');

      const staleAfter = await readJob(staleJob.id);
      expect(staleAfter!.status).toBe('queued'); // reclaimed
    });

    it('heartbeat on a lease already reaped/lost returns LEASE_LOST (ADR §5.2: worker must stop computing)', async () => {
      const jobType = `w9b1hbl_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);
      await jobs.claim({ workerId: 'w9b1hbl-worker', jobTypes: [jobType], limit: 1, leaseDurationSeconds: 1 });

      await new Promise((resolve) => setTimeout(resolve, 1200));
      const reaped = await jobs.reapExpiredLeases({ batchSize: 50 });
      expect(reaped.find((r) => r.jobId === job.id)).toBeDefined();

      // The original worker, unaware it was reaped, tries to heartbeat.
      const hb = await jobs.heartbeat({ jobId: job.id, workerId: 'w9b1hbl-worker' });
      expect(hb.ok).toBe(false);
      if (hb.ok) throw new Error('unreachable');
      expect(hb.code).toBe('LEASE_LOST');
    });

    it('the RECOVERY the reaper performs is sound — no double output after requeue', async () => {
      // This proves the mechanism end-to-end using the REAL reapExpiredLeases()
      // entry point (previously this test applied the ADR §5.3 UPDATE by hand,
      // because the function did not exist).
      const jobType = `w9b1r_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);

      const [claimed] = await jobs.claim({ workerId: 'w9b1r-dead', jobTypes: [jobType], limit: 1 });
      expect(claimed.attempt_count).toBe(1);

      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE compute_jobs SET lease_expires_at = now() - interval '1 minute' WHERE id = ?`, [job.id])
      );

      const reaped = await jobs.reapExpiredLeases({ batchSize: 10 });
      expect(reaped.find((r) => r.jobId === job.id)?.outcome).toBe('requeued');

      // Fast-forward the reaper's backoff clock (test-side only) so the retry is claimable now.
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE compute_jobs SET next_attempt_at = now() WHERE id = ?`, [job.id])
      );

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
      expect(runs[0].outcome).toBe('lease_expired');
      expect(runs[1].outcome).toBe('succeeded');
    });

    it('reaper dead-letters (does not requeue forever) once attempts are exhausted, and raises an EM-6 exception', async () => {
      const jobType = `w9b1dlq_${randomUUID()}`;
      const enqueued = await jobs.enqueue({
        organizationId: orgId,
        jobType,
        inputArtifactId: artifactId,
        inputRevisionHash: `hash-${randomUUID()}`,
        engineManifestId,
        idempotencyKey: `w9b1dlq-${randomUUID()}`,
        requestedByUserId: userId,
        maxAttempts: 1,
      });
      const jobId = enqueued.job.id;

      await jobs.claim({ workerId: 'w9b1dlq-dead', jobTypes: [jobType], limit: 1, leaseDurationSeconds: 1 });
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const reaped = await jobs.reapExpiredLeases({ batchSize: 10 });
      const mine = reaped.find((r) => r.jobId === jobId);
      expect(mine).toBeDefined();
      expect(mine!.outcome).toBe('dead_lettered'); // attempt_count(1) >= max_attempts(1)

      const terminal = await readJob(jobId);
      expect(terminal!.status).toBe('failed');
      expect(terminal!.finished_at).toBeTruthy();
      expect(terminal!.lease_owner).toBeNull();

      const runs = await readRuns(jobId);
      expect(runs[0].outcome).toBe('lease_expired');

      const raised = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string; severity: string; reason_code: string }>(
          `SELECT id, severity, reason_code FROM finance_exceptions WHERE organization_id = ? AND source_ref::text LIKE ?`,
          [orgId, `%${jobId}%`]
        )
      );
      expect(raised).toHaveLength(1);
      expect(raised[0].reason_code).toBe('COMPUTE_JOB_DEAD_LETTER');
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
      const failed = await jobs.failJob({ jobId: job.id, organizationId: orgId, error: 'worker killed mid-commit' });
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

      const cancelled = await jobs.cancelJob(orgId, job.id, 'user pressed Cancel');
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

    it('FIXED W9-B-1: cancelling a RUNNING job now closes finished_at, releases the lease, and closes the run row (was: DEFECT W9-B4-a)', async () => {
      // Was: `cancelJob()` wrote neither `finished_at` on the job nor
      // `outcome`/`finished_at` on the in-flight `compute_job_runs` row, even
      // though the schema has a `'cancelled'` outcome value for exactly this.
      // Any "how long did jobs take" / "how many attempts ended how" query
      // over compute_job_runs silently under-counted. Fixed in
      // computeJobService.cancelJob().
      const jobType = `w9b4b_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);
      await jobs.claim({ workerId: 'w9b4b-worker', jobTypes: [jobType], limit: 1 });
      await jobs.cancelJob(orgId, job.id, 'cancel bookkeeping probe');

      const physical = await readJob(job.id);
      expect(physical!.status).toBe('cancelled');
      expect(physical!.finished_at).toBeTruthy(); // FIXED — was NULL
      expect(physical!.lease_owner).toBeNull(); // FIXED — lease released, was still 'w9b4b-worker'

      const runs = await readRuns(job.id);
      expect(runs).toHaveLength(1);
      expect(runs[0].outcome).toBe('cancelled'); // FIXED — was NULL forever
      expect(runs[0].finished_at).toBeTruthy();
    });

    it('cancelling a QUEUED (never claimed) job does not touch compute_job_runs — there is no run row to close', async () => {
      // Edge case for the W9-B-1 fix: a job cancelled before claim() never
      // had a compute_job_runs row inserted (only claim() inserts one). The
      // fix must not try to close a row that never existed.
      const jobType = `w9b4q_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);
      const cancelled = await jobs.cancelJob(orgId, job.id, 'cancelled while still queued, bookkeeping probe');
      expect(cancelled!.status).toBe('cancelled');
      expect(cancelled!.finished_at).toBeTruthy();

      const runs = await readRuns(job.id);
      expect(runs).toHaveLength(0);
    });

    it('a cancelled job is NOT resurrected by a later claim()', async () => {
      const jobType = `w9b4c_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);
      const cancelled = await jobs.cancelJob(orgId, job.id, 'cancelled while still queued');
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
      const after1 = await jobs.failJob({ jobId, organizationId: orgId, error: 'boom 1' });
      expect(after1!.status).toBe('queued');
      expect((await readJob(jobId))!.attempt_count).toBe(1);

      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE compute_jobs SET next_attempt_at = now() WHERE id = ?`, [jobId])
      );

      // Attempt 2 fails -> terminal failed (attempt_count == max_attempts).
      await jobs.claim({ workerId: 'dlq-w2', jobTypes: [jobType], limit: 1 });
      const after2 = await jobs.failJob({ jobId, organizationId: orgId, error: 'boom 2' });
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

    it('FIXED EM-6: failJob() raises a finance_exceptions dead-letter entry once attempts are exhausted', async () => {
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
      const dead = await jobs.failJob({ jobId, organizationId: orgId, error: 'terminal failure' });
      expect(dead!.status).toBe('failed');

      // Independent read straight from the table — never the service's return value.
      const raised = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string; severity: string; reason_code: string; artifact_id: string; organization_id: string }>(
          `SELECT id, severity, reason_code, artifact_id, organization_id FROM finance_exceptions
            WHERE organization_id = ? AND source_ref::text LIKE ?`,
          [orgId, `%${jobId}%`]
        )
      );
      expect(raised).toHaveLength(1);
      expect(raised[0].reason_code).toBe('COMPUTE_JOB_DEAD_LETTER');
      expect(raised[0].severity).toBe('WARNING'); // non-VALUATION job_type -> WARNING (MATERIAL reserved for VALUATION_*)
      expect(raised[0].artifact_id).toBe(artifactId);
      expect(raised[0].organization_id).toBe(orgId);
    });

    it('FIXED EM-6: a VALUATION_* job_type dead-lettering is raised at MATERIAL, not WARNING', async () => {
      const jobType = `VALUATION_COMPUTE_dlqsev_${randomUUID()}`;
      const enqueued = await jobs.enqueue({
        organizationId: orgId,
        jobType,
        inputArtifactId: artifactId,
        inputRevisionHash: 'hash-dlq-sev',
        engineManifestId,
        idempotencyKey: `w9bdlqsev-${randomUUID()}`,
        requestedByUserId: userId,
        maxAttempts: 1,
      });
      const jobId = enqueued.job.id;
      await jobs.claim({ workerId: 'dlqsev-w1', jobTypes: [jobType], limit: 1 });
      await jobs.failJob({ jobId, organizationId: orgId, error: 'terminal failure' });

      const raised = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ severity: string }>(
          `SELECT severity FROM finance_exceptions WHERE organization_id = ? AND source_ref::text LIKE ?`,
          [orgId, `%${jobId}%`]
        )
      );
      expect(raised).toHaveLength(1);
      expect(raised[0].severity).toBe('MATERIAL');
    });

    it('a job that RETRIES (not yet exhausted) does NOT raise a dead-letter exception', async () => {
      // Negative case for EM-6: only the TERMINAL failure is a dead-letter.
      const jobType = `w9bdlqno_${randomUUID()}`;
      const enqueued = await jobs.enqueue({
        organizationId: orgId,
        jobType,
        inputArtifactId: artifactId,
        inputRevisionHash: 'hash-dlq-no',
        engineManifestId,
        idempotencyKey: `w9bdlqno-${randomUUID()}`,
        requestedByUserId: userId,
        maxAttempts: 3,
      });
      const jobId = enqueued.job.id;
      await jobs.claim({ workerId: 'dlqno-w1', jobTypes: [jobType], limit: 1 });
      const retried = await jobs.failJob({ jobId, organizationId: orgId, error: 'transient' });
      expect(retried!.status).toBe('queued'); // attempts remain

      const raised = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM finance_exceptions WHERE organization_id = ? AND source_ref::text LIKE ?`,
          [orgId, `%${jobId}%`]
        )
      );
      expect(raised).toHaveLength(0);
    });
  });

  // =========================================================================
  // EM-2 heartbeat, EM-3 kill switch, EM-4 per-org concurrency — FIXED,
  // rewritten from "prove the absence" to "prove the fix". EM-5 (worker pool
  // draining jobs it did not itself enqueue) remains genuinely unbuilt — see
  // the module doc comment and the W2 report for why.
  // =========================================================================
  describe('B — fixed contract elements (EM-2/EM-3/EM-4) and the one still missing (EM-5)', () => {
    it('FIXED EM-2: heartbeat() advances last_heartbeat_at and extends lease_expires_at', async () => {
      const jobType = `w9bhb_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);
      await jobs.claim({ workerId: 'hb-worker', jobTypes: [jobType], limit: 1, leaseDurationSeconds: 2 });

      const before = (await readRuns(job.id))[0];
      const leaseBefore = (await readJob(job.id))!.lease_expires_at;

      await new Promise((resolve) => setTimeout(resolve, 1200));

      const hb = await jobs.heartbeat({ jobId: job.id, workerId: 'hb-worker', leaseDurationSeconds: 300 });
      expect(hb.ok).toBe(true);

      // Independent physical read — never the heartbeat() return value.
      const after = (await readRuns(job.id))[0];
      const leaseAfter = (await readJob(job.id))!.lease_expires_at;

      expect(new Date(after.last_heartbeat_at).getTime()).toBeGreaterThan(new Date(before.last_heartbeat_at).getTime());
      expect(new Date(leaseAfter!).getTime()).toBeGreaterThan(new Date(leaseBefore!).getTime());
      expect(new Date(leaseAfter!).getTime()).toBeGreaterThan(Date.now() + 60_000); // extended ~300s out
    });

    it('heartbeat() from the WRONG worker_id (lease held by someone else) is refused, not silently accepted', async () => {
      const jobType = `w9bhbw_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);
      await jobs.claim({ workerId: 'hb-real-owner', jobTypes: [jobType], limit: 1 });

      const hb = await jobs.heartbeat({ jobId: job.id, workerId: 'hb-impostor' });
      expect(hb.ok).toBe(false);
      if (hb.ok) throw new Error('unreachable');
      expect(hb.code).toBe('LEASE_LOST');

      // Physical proof: the real owner's lease was not disturbed by the impostor's call.
      expect((await readJob(job.id))!.lease_owner).toBe('hb-real-owner');
    });

    it('FIXED EM-3: is_org_compute_killed()/org_concurrency_limit() now exist as SQL functions (were: absent from pg_proc)', async () => {
      const present = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ proname: string }>(
          `SELECT proname FROM pg_proc WHERE proname IN ('org_concurrency_limit', 'is_org_compute_killed')`
        )
      );
      expect(present.map((r) => r.proname).sort()).toEqual(['is_org_compute_killed', 'org_concurrency_limit']);
    });

    it('FIXED EM-3: an active kill switch for (org, job_type) makes claim() see zero eligible jobs; clearing it un-blocks', async () => {
      const jobType = `w9bkill_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);

      await jobs.setKillSwitch({ organizationId: orgId, jobType, reason: 'w9b kill switch probe', actorId: userId });
      expect(await jobs.isOrgComputeKilled(orgId, jobType)).toBe(true);

      const blockedClaim = await jobs.claim({ workerId: 'kill-worker', jobTypes: [jobType], limit: 5 });
      expect(blockedClaim).toHaveLength(0);
      expect((await readJob(job.id))!.status).toBe('queued'); // untouched, not silently dropped

      await jobs.clearKillSwitch({ organizationId: orgId, jobType });
      expect(await jobs.isOrgComputeKilled(orgId, jobType)).toBe(false);

      const unblockedClaim = await jobs.claim({ workerId: 'kill-worker', jobTypes: [jobType], limit: 5 });
      expect(unblockedClaim).toHaveLength(1);
      expect(unblockedClaim[0].id).toBe(job.id);
    });

    it('FIXED EM-3: a GLOBAL kill switch (organization_id NULL) blocks every organization for that job_type', async () => {
      const jobType = `w9bkillg_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);

      await jobs.setKillSwitch({ organizationId: null, jobType, reason: 'global kill probe', actorId: userId });
      try {
        expect(await jobs.isOrgComputeKilled(orgId, jobType)).toBe(true);
        expect(await jobs.isOrgComputeKilled(`some-other-org-${randomUUID()}`, jobType)).toBe(true);
        const claimed = await jobs.claim({ workerId: 'global-kill-worker', jobTypes: [jobType], limit: 5 });
        expect(claimed).toHaveLength(0);
      } finally {
        await jobs.clearKillSwitch({ organizationId: null, jobType });
      }
      expect((await readJob(job.id))!.status).toBe('queued');
    });

    it('FIXED EM-4: an explicit LOW concurrency limit for (org, job_type) caps claim() even when more jobs are queued and limit param requests more', async () => {
      const jobType = `w9bconclow_${randomUUID()}`;
      await jobs.setOrgConcurrencyLimit({ organizationId: orgId, jobType, maxConcurrent: 2, actorId: userId });

      await Promise.all(Array.from({ length: 6 }, () => enqueueOne(jobType)));
      const claimed = await jobs.claim({ workerId: 'conc-low-worker', jobTypes: [jobType], limit: 6 });
      expect(claimed).toHaveLength(2); // capped, not 6

      // The remaining 4 are still queued, not lost.
      const stillQueued = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string }>(`SELECT id FROM compute_jobs WHERE job_type = ? AND status = 'queued'`, [jobType])
      );
      expect(stillQueued).toHaveLength(4);

      // A SECOND claim call, while the first 2 are still `running`, claims nothing more — the cap holds across calls.
      const secondAttempt = await jobs.claim({ workerId: 'conc-low-worker-2', jobTypes: [jobType], limit: 6 });
      expect(secondAttempt).toHaveLength(0);
    });

    it('FIXED EM-4: without an explicit override, the seeded generous global default (50) does not block a normal batch — backward compatible', async () => {
      // This is the direct replacement for the old "no per-org concurrency
      // limit applied" EVIDENCE_MISSING assertion: the mechanism now exists
      // and IS consulted (proven above), but the DEFAULT is deliberately
      // generous so this unconfigured job_type still claims all 6 — exactly
      // the old observable behaviour, now for a documented reason instead of
      // an absent function. See the migration file for why a low default was
      // rejected (canonicalServices.pg.test.ts's SKIP LOCKED test).
      const jobType = `w9bconcdefault_${randomUUID()}`;
      await Promise.all(Array.from({ length: 6 }, () => enqueueOne(jobType)));
      const claimed = await jobs.claim({ workerId: 'conc-default-worker', jobTypes: [jobType], limit: 6 });
      expect(claimed).toHaveLength(6);
      expect(await jobs.getOrgConcurrencyLimit(orgId, jobType)).toBe(50);
    });

    it('EVIDENCE_MISSING (EM-5, still open): a queued job this process did not itself enqueue-and-immediately-claim is drained by NOTHING', async () => {
      // Unchanged from before the W2 closeout — this is the one gap that
      // remains genuinely open. reapExpiredLeases() (proven above) recovers
      // ABANDONED (previously-claimed) jobs; it does not claim jobs that were
      // never claimed in the first place. No process in this codebase does
      // that inline self-claim aside (see module doc comment).
      const jobType = `w9bloop_${randomUUID()}`;
      const { job } = await enqueueOne(jobType);

      // Nobody claims it. Wait a window in which any poller would have fired.
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const stillQueued = await readJob(job.id);
      expect(stillQueued!.status).toBe('queued');
      expect(stillQueued!.attempt_count).toBe(0);
      expect(await readRuns(job.id)).toHaveLength(0);

      // The reaper does not help here either — there is no expired lease to reap.
      const reaped = await jobs.reapExpiredLeases({ batchSize: 50 });
      expect(reaped.find((r) => r.jobId === job.id)).toBeUndefined();
    });
  });
});
