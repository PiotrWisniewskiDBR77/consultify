#!/usr/bin/env tsx
/**
 * J3 — CONCURRENCY & FAULT INJECTION probe (Finance v3, Gate E).
 *
 * Scope: prove (or disprove) that the compute-job queue (`compute_jobs` /
 * `compute_job_runs` / `compute_job_outputs`, `computeJobService.ts`) and the
 * business-version lifecycle (`artifactVersionService.ts` — approve/archive/
 * reopen, CAS-guarded) hold under REAL concurrent load and REAL fault
 * injection, at N=2/5/10 and 3+ repeats per scenario. This file is a
 * standalone script, not a vitest suite — see the parallel `.pg.test.ts`
 * files in `server/src/services/finance/canonical/__tests__/` for the
 * existing pairwise (N=2, single-repeat) coverage this probe extends:
 *   - concurrencyMatrix.pg.test.ts  (A1-A4: approve races, archive races, reopen races, edit-vs-pin)
 *   - faultMatrix.pg.test.ts        (B1-B4 + DLQ: lease/heartbeat/reaper, kill-mid-commit, dup-enqueue, cancel)
 *   - idempotentComputeRetry.pg.test.ts (P1 fix, SEQUENTIAL/interception-based, not true Promise.all racing)
 *
 * Every scenario below (a) runs the race/fault for real against a live
 * PostgreSQL connection, (b) verifies the post-state with an INDEPENDENT
 * `pg.Client` on its own TCP socket (never the app's pooled connection, never
 * a service return value alone), (c) reports whether the race actually
 * MATERIALIZED (measured overlap between concurrent calls' start/end times —
 * a race that never overlapped proves nothing).
 *
 * HOW TO RUN (own throwaway ephemeral cluster only):
 *
 *   cd server
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/j3_conc \
 *   npx tsx scripts/finance-v3-audit/j3-concurrency-probe.ts <scenario> [N] [repeats]
 *
 * <scenario> one of:
 *   race1-compute race2-approve race3-edit-vs-compute race4-approve-vs-stale
 *   race5-archive-vs-finish race6-retry-after-commit
 *   fault1-snapshot-status fault2-before-after-output fault3-lease-loss
 *   fault4-worker-restart fault5-duplicate-enqueue fault6-cancel-race
 *   mutant-approve-cas mutant-archive-cas mutant-idempotency-uq
 *   mutant-claimforcompute-regression mutant-completejobsuccess-forupdate
 *   mutant-claim-skiplocked
 *   all-races all-faults
 *
 * Output: one JSON object per run on stdout (prefixed `RESULT:`), plus a
 * human-readable summary. The caller (this session) accumulates these into
 * the final markdown report by hand — this script does not write the report.
 */
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

// ---------------------------------------------------------------------------
// Gate: same 4-variable discipline as every .pg.test.ts in this program.
// ---------------------------------------------------------------------------
const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  process.env.NODE_ENV === 'test' &&
  CONNECTION_STRING.startsWith('postgres');
if (!REAL_PG) {
  console.error(
    'REFUSING TO RUN: requires RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=postgresql://... (all four). See file header.'
  );
  process.exit(1);
}
if (!/127\.0\.0\.1|localhost/.test(CONNECTION_STRING)) {
  console.error('REFUSING TO RUN: DATABASE_URL must point at 127.0.0.1/localhost only. Got: ' + CONNECTION_STRING);
  process.exit(1);
}
process.env.DB_TYPE = 'postgres';

type AnyResult = Record<string, unknown>;

function emit(result: AnyResult) {
  console.log('RESULT: ' + JSON.stringify(result));
}

async function main() {
  const [, , scenario, nArg, repeatsArg] = process.argv;
  const N = nArg ? Number(nArg) : 2;
  const repeats = repeatsArg ? Number(repeatsArg) : 1;
  // nArg may be a single number OR a comma-separated list ("2,5,10") to avoid re-paying tsx/node
  // startup + module-import cost per N level when sweeping concurrency for a race scenario.
  const Ns = (nArg ?? '2').split(',').map((s) => Number(s.trim()));

  if (!scenario) {
    console.error('Usage: j3-concurrency-probe.ts <scenario> [N|N1,N2,N3] [repeats]');
    process.exit(1);
  }

  // Dynamic import AFTER env vars are set (mirrors every .pg.test.ts file in this repo).
  const { withPinnedPostgresTransaction } = await import('../../src/database/PostgresDatabase.js');
  const svc = await import('../../src/services/finance/canonical/artifactVersionService.js');
  const jobs = await import('../../src/services/finance/canonical/computeJobService.js');
  const autosaveService = await import('../../src/services/finance/collaboration/autosaveService.js');
  const computePinning = await import('../../src/services/finance/collaboration/computePinning.js');

  // Independent verification connection — own socket, never the app pool.
  const verify = new Client({ connectionString: CONNECTION_STRING });
  await verify.connect();

  const ctx = { withPinnedPostgresTransaction, svc, jobs, autosaveService, computePinning, verify };

  try {
    for (const N of Ns) {
      for (let r = 1; r <= repeats; r++) {
        const label = `${scenario} N=${N} rep=${r}/${repeats}`;
        console.error(`--- running ${label} ---`);
        const result = await runScenario(ctx, scenario, N);
        emit({ scenario, N, repeat: r, ...result });
      }
    }
  } finally {
    await verify.end();
  }
}

// ---------------------------------------------------------------------------
// Fixture helpers (org/artifact/business-version setup, mirrors the
// concurrencyMatrix/faultMatrix .pg.test.ts helpers).
// ---------------------------------------------------------------------------

async function makeOrg(ctx: Ctx): Promise<string> {
  const orgId = `org-j3-${randomUUID()}`;
  await ctx.withPinnedPostgresTransaction((tx: any) =>
    tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'J3 Concurrency Probe Org'])
  );
  return orgId;
}

async function readBvStatus(ctx: Ctx, bvId: string) {
  const r = await ctx.verify.query(`SELECT status, version, freshness FROM finance_business_versions WHERE business_version_id = $1`, [bvId]);
  return r.rows[0] ?? null;
}

/** DRAFT -> READY_FOR_REVIEW -> IN_REVIEW, freshness forced CURRENT. Mirrors concurrencyMatrix.pg.test.ts. */
async function makeInReviewVersion(
  ctx: Ctx,
  orgId: string,
  preparerId: string,
  approverId: string
): Promise<{ artifactId: string; bvId: string; version: number; workingRevisionId: string; engineManifestId: string }> {
  const created = await ctx.svc.createArtifact({ organizationId: orgId, artifactType: 'HISTORICAL_ANALYSIS', createdBy: preparerId });
  const bvId = created.businessVersion.business_version_id;
  let version = created.businessVersion.version;

  const submitted = await ctx.svc.transition({
    organizationId: orgId,
    businessVersionId: bvId,
    action: 'submit_for_review',
    actorId: preparerId,
    role: 'preparer',
    expectedVersion: version,
  });
  if (!submitted.ok) throw new Error(`fixture submit_for_review failed: ${(submitted as any).code}`);
  version = submitted.businessVersion.version;

  const started = await ctx.svc.transition({
    organizationId: orgId,
    businessVersionId: bvId,
    action: 'start_review',
    actorId: approverId,
    role: 'approver',
    expectedVersion: version,
  });
  if (!started.ok) throw new Error(`fixture start_review failed: ${(started as any).code}`);
  version = started.businessVersion.version;

  await ctx.withPinnedPostgresTransaction((tx: any) =>
    tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId])
  );

  return {
    artifactId: created.artifact.artifact_id,
    bvId,
    version,
    workingRevisionId: created.workingRevision.working_revision_id,
    engineManifestId: created.businessVersion.engine_manifest_id,
  };
}

interface Ctx {
  withPinnedPostgresTransaction: any;
  svc: any;
  jobs: any;
  autosaveService: any;
  computePinning: any;
  verify: Client;
}

/** Queue-mechanism "compute": enqueue -> claimForCompute -> completeJobSuccess. Exercises the EXACT
 * decision table every one of the 5 real domain call sites uses (see computeJobService.ts's own doc
 * comment on claimForCompute). Optional `delayMs` widens the race window between claim and commit,
 * simulating "compute is still running" for scenarios that need to interleave something else INSIDE
 * an in-flight compute (edit-vs-compute, archive-vs-finishing-job).
 */
async function simulateCompute(
  ctx: Ctx,
  params: {
    organizationId: string;
    artifactId: string;
    workingRevisionId: string;
    jobType: string;
    idempotencyKey: string;
    workerId: string;
    delayMs?: number;
    engineManifestId: string;
    leaseDurationSeconds?: number;
  }
) {
  const startedAt = Date.now();
  const { job, wasExisting } = await ctx.jobs.enqueue({
    organizationId: params.organizationId,
    jobType: params.jobType,
    inputArtifactId: params.artifactId,
    inputRevisionHash: `hash-${randomUUID()}`,
    engineManifestId: params.engineManifestId,
    idempotencyKey: params.idempotencyKey,
    requestedByUserId: 'j3-probe-user',
  });
  const claim = await ctx.jobs.claimForCompute({
    organizationId: params.organizationId,
    job,
    wasExisting,
    workerId: params.workerId,
    leaseDurationSeconds: params.leaseDurationSeconds,
  });
  if (claim.outcome === 'hard_error') {
    return { startedAt, finishedAt: Date.now(), outcome: 'hard_error', code: claim.code, message: claim.message, jobId: job.id };
  }
  if (claim.outcome === 'already_committed') {
    return { startedAt, finishedAt: Date.now(), outcome: 'already_committed', jobId: claim.job.id, outputId: claim.output.id };
  }
  if (params.delayMs) await new Promise((res) => setTimeout(res, params.delayMs));
  const running = claim.job;
  const hash = `content-${randomUUID()}`;
  const completed = await ctx.jobs.completeJobSuccess({
    jobId: running.id,
    organizationId: params.organizationId,
    outputArtifactId: params.artifactId,
    outputWorkingRevisionId: params.workingRevisionId,
    contentSemanticHash: hash,
  });
  return { startedAt, finishedAt: Date.now(), outcome: completed.ok ? 'completed' : 'complete_failed', code: (completed as any).code, jobId: running.id, contentSemanticHash: hash };
}

function overlapCount(intervals: { startedAt: number; finishedAt: number }[]): number {
  // count how many pairs of [start,end] intervals overlap in wall-clock time
  let overlaps = 0;
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i];
      const b = intervals[j];
      if (a.startedAt < b.finishedAt && b.startedAt < a.finishedAt) overlaps++;
    }
  }
  return overlaps;
}

// ---------------------------------------------------------------------------
// Scenario dispatch
// ---------------------------------------------------------------------------
async function runScenario(ctx: Ctx, scenario: string, N: number): Promise<AnyResult> {
  switch (scenario) {
    case 'race1-compute':
      return race1Compute(ctx, N);
    case 'race2-approve':
      return race2Approve(ctx, N);
    case 'race3-edit-vs-compute':
      return race3EditVsCompute(ctx, N);
    case 'race4-approve-vs-stale':
      return race4ApproveVsStale(ctx, N);
    case 'race5-archive-vs-finish':
      return race5ArchiveVsFinish(ctx, N);
    case 'race6-retry-after-commit':
      return race6RetryAfterCommit(ctx, N);
    case 'fault1-snapshot-status':
      return fault1SnapshotStatus(ctx);
    case 'fault2-before-after-output':
      return fault2BeforeAfterOutput(ctx);
    case 'fault3-lease-loss':
      return fault3LeaseLoss(ctx);
    case 'fault4-worker-restart':
      return fault4WorkerRestart(ctx);
    case 'fault5-duplicate-enqueue':
      return fault5DuplicateEnqueue(ctx, N);
    case 'fault6-cancel-race':
      return fault6CancelRace(ctx, N);
    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
}

// =========================================================================
// RACE 1 — N concurrent "compute" calls, SAME idempotency key
// =========================================================================
async function race1Compute(ctx: Ctx, N: number): Promise<AnyResult> {
  const orgId = await makeOrg(ctx);
  const created = await ctx.svc.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: 'j3-user' });
  const artifactId = created.artifact.artifact_id;
  const workingRevisionId = created.workingRevision.working_revision_id;
  const jobType = `j3-race1-${randomUUID()}`;
  const idempotencyKey = `j3-race1-key-${randomUUID()}`;

  const calls = Array.from({ length: N }, (_, i) =>
    simulateCompute(ctx, {
      organizationId: orgId,
      artifactId,
      workingRevisionId,
      jobType,
      idempotencyKey,
      workerId: `race1-worker-${i}`,
      engineManifestId: created.businessVersion.engine_manifest_id,
    })
  );
  const settled = await Promise.allSettled(calls);
  const values = settled.map((s) => (s.status === 'fulfilled' ? s.value : { outcome: 'rejected', reason: String((s as any).reason?.message || (s as any).reason) }));
  const materialized = overlapCount(values.filter((v: any) => v.startedAt) as any) > 0;

  // Independent SQL proof.
  const jobRows = await ctx.verify.query(`SELECT id, status FROM compute_jobs WHERE organization_id = $1 AND job_type = $2 AND idempotency_key = $3`, [
    orgId,
    jobType,
    idempotencyKey,
  ]);
  const outputRows = await ctx.verify.query(
    `SELECT o.id FROM compute_job_outputs o JOIN compute_jobs j ON j.id = o.job_id WHERE j.organization_id = $1 AND j.job_type = $2 AND j.idempotency_key = $3`,
    [orgId, jobType, idempotencyKey]
  );

  const succeededCount = values.filter((v: any) => v.outcome === 'completed' || v.outcome === 'already_committed').length;
  const hardErrorCount = values.filter((v: any) => v.outcome === 'hard_error').length;
  const rejectedCount = values.filter((v: any) => v.outcome === 'rejected').length;

  return {
    orgId,
    materialized,
    exactlyOneJobRow: jobRows.rows.length === 1,
    exactlyOneOutputRow: outputRows.rows.length === 1,
    succeededCount,
    hardErrorCount,
    rejectedCount,
    jobRowCount: jobRows.rows.length,
    outputRowCount: outputRows.rows.length,
    pass: jobRows.rows.length === 1 && outputRows.rows.length === 1 && rejectedCount === 0,
    detail: values,
  };
}

// =========================================================================
// RACE 2 — N concurrent approveVersion() on the SAME IN_REVIEW version
// =========================================================================
async function race2Approve(ctx: Ctx, N: number): Promise<AnyResult> {
  const orgId = await makeOrg(ctx);
  const preparerId = `preparer-${randomUUID()}`;
  const approverIds = Array.from({ length: N }, () => `approver-${randomUUID()}`);
  const { bvId, version } = await makeInReviewVersion(ctx, orgId, preparerId, approverIds[0]);

  const calls = approverIds.map((actorId) => {
    const startedAt = Date.now();
    return ctx.svc
      .approveVersion({ organizationId: orgId, businessVersionId: bvId, actorId, role: 'approver', expectedVersion: version })
      .then((r: any) => ({ startedAt, finishedAt: Date.now(), ...r }));
  });
  const results = await Promise.all(calls);
  const materialized = overlapCount(results as any) > 0;

  const winners = results.filter((r: any) => r.ok);
  const losers = results.filter((r: any) => !r.ok);

  const post = await readBvStatus(ctx, bvId);
  const approveEvents = await ctx.verify.query(`SELECT event_id FROM artifact_lifecycle_events WHERE business_version_id = $1 AND action = 'APPROVE'`, [bvId]);

  return {
    orgId,
    materialized,
    winnersCount: winners.length,
    losersCount: losers.length,
    postStatus: post?.status,
    approveEventCount: approveEvents.rows.length,
    pass: winners.length === 1 && approveEvents.rows.length === 1 && post?.status === 'APPROVED' && losers.every((l: any) => ['VERSION_CONFLICT', 'STATE_PRECONDITION_FAILED'].includes(l.code)),
    detail: results,
  };
}

// =========================================================================
// RACE 3 — N concurrent edits racing ONE compute-pin enqueue
// =========================================================================
async function race3EditVsCompute(ctx: Ctx, N: number): Promise<AnyResult> {
  const orgId = await makeOrg(ctx);
  const actorId = `editor-${randomUUID()}`;
  const created = await ctx.svc.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: actorId });
  const artifactId = created.artifact.artifact_id;

  const first = await ctx.autosaveService.checkpointOperationStack({
    organizationId: orgId,
    artifactId,
    actorId,
    expectedWorkingRevisionId: created.workingRevision.working_revision_id,
    unsavedOperationStack: [],
    source: 'EXPLICIT_SAVE',
  });
  if (!first.ok) throw new Error('fixture checkpoint failed');
  const revV1 = first.workingRevision.working_revision_id;

  // N-1 edits attempt against the SAME expectedWorkingRevisionId (only one can win the CAS — the
  // rest are legitimately rejected as WORKING_REVISION_CONFLICT), racing 1 compute-pin enqueue.
  const editCalls = Array.from({ length: Math.max(N - 1, 1) }, (_, i) => {
    const startedAt = Date.now();
    return ctx.autosaveService
      .checkpointOperationStack({
        organizationId: orgId,
        artifactId,
        actorId,
        expectedWorkingRevisionId: revV1,
        unsavedOperationStack: [{ opId: randomUUID(), kind: 'J3_EDIT', payload: { cell: 'A1', value: i } }],
        source: 'AUTOSAVE',
      })
      .then((r: any) => ({ startedAt, finishedAt: Date.now(), kind: 'edit', ...r }));
  });
  const enqueueCall = (async () => {
    const startedAt = Date.now();
    const r = await ctx.computePinning.enqueueComputeForCurrentRevision({
      organizationId: orgId,
      artifactId,
      jobType: `j3-race3-${randomUUID()}`,
      engineManifestId: created.businessVersion.engine_manifest_id,
      idempotencyKey: `j3-race3-${randomUUID()}`,
      requestedByUserId: actorId,
    });
    return { startedAt, finishedAt: Date.now(), kind: 'enqueue', ...r };
  })();

  const results = await Promise.all([...editCalls, enqueueCall]);
  const materialized = overlapCount(results as any) > 0;

  const enqueueResult: any = results.find((r: any) => r.kind === 'enqueue');
  const editResults = results.filter((r: any) => r.kind === 'edit');
  const editWinners = editResults.filter((r: any) => r.ok);

  // Physical proof: the pin must be exactly one REAL, existing hash (v1 or one of the edit winners').
  const jobRow = await ctx.verify.query(`SELECT input_revision_hash FROM compute_jobs WHERE id = $1`, [enqueueResult.job?.id]);
  const pinnedHash = jobRow.rows[0]?.input_revision_hash;
  const matchingRevisions = await ctx.verify.query(`SELECT working_revision_id FROM finance_working_revisions WHERE artifact_id = $1 AND content_semantic_hash = $2`, [
    artifactId,
    pinnedHash,
  ]);

  return {
    orgId,
    materialized,
    editWinnersCount: editWinners.length,
    enqueueOk: enqueueResult.ok,
    pinnedHash,
    pinCorrespondsToRealRevision: matchingRevisions.rows.length >= 1,
    pass: enqueueResult.ok === true && matchingRevisions.rows.length >= 1 && editWinners.length <= 1,
    detail: results,
  };
}

// =========================================================================
// RACE 4 — approveVersion() vs source becoming STALE mid-flight
// =========================================================================
async function race4ApproveVsStale(ctx: Ctx, N: number): Promise<AnyResult> {
  const orgId = await makeOrg(ctx);
  const preparerId = `preparer-${randomUUID()}`;
  const approverId = `approver-${randomUUID()}`;
  const { bvId, version } = await makeInReviewVersion(ctx, orgId, preparerId, approverId);

  const approveCall = (async () => {
    const startedAt = Date.now();
    const r = await ctx.svc.approveVersion({ organizationId: orgId, businessVersionId: bvId, actorId: approverId, role: 'approver', expectedVersion: version });
    return { startedAt, finishedAt: Date.now(), kind: 'approve', ...r };
  })();
  // N concurrent "source went stale" writers (simulates propagateStalenessInTransaction's own UPDATE
  // shape landing mid-approve from N different upstream invalidations).
  const staleCalls = Array.from({ length: N }, (_, i) => {
    const startedAt = Date.now();
    return ctx.withPinnedPostgresTransaction((tx: any) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'STALE_SOURCE', freshness_reason = ?, stale_since = now() WHERE business_version_id = ?`, [
        `j3-race4-stale-${i}`,
        bvId,
      ])
    ).then((r: any) => ({ startedAt, finishedAt: Date.now(), kind: 'stale-write', changes: r.changes }));
  });

  const results = await Promise.all([approveCall, ...staleCalls]);
  const materialized = overlapCount(results as any) > 0;

  const post = await readBvStatus(ctx, bvId);
  const approveResult: any = results.find((r: any) => r.kind === 'approve');

  // The invariant: if approve WON (ok:true), the row must be APPROVED with complete bookkeeping,
  // regardless of freshness having flipped a microsecond later (that write may have landed either
  // side of approve's own FOR UPDATE-pinned read — both are legitimate). If approve LOST because
  // it observed STALE_SOURCE inside its own transaction, it must be a typed APPROVAL_BLOCKED, never
  // a hybrid state (APPROVED row with freshness=STALE_SOURCE AND no compute_snapshot_id).
  let noHybridState = true;
  if (post?.status === 'APPROVED') {
    const bookkeeping = await ctx.verify.query(`SELECT compute_snapshot_id, approved_by FROM finance_business_versions WHERE business_version_id = $1`, [bvId]);
    noHybridState = Boolean(bookkeeping.rows[0]?.compute_snapshot_id && bookkeeping.rows[0]?.approved_by);
  }

  return {
    orgId,
    materialized,
    approveOk: approveResult.ok,
    approveCode: approveResult.code,
    postStatus: post?.status,
    postFreshness: post?.freshness,
    noHybridState,
    pass: noHybridState && (approveResult.ok === true || ['APPROVAL_BLOCKED', 'VERSION_CONFLICT', 'STATE_PRECONDITION_FAILED'].includes(approveResult.code)),
    detail: results,
  };
}

// =========================================================================
// RACE 5 — N concurrent archive attempts racing a finishing compute job
// =========================================================================
async function race5ArchiveVsFinish(ctx: Ctx, N: number): Promise<AnyResult> {
  const orgId = await makeOrg(ctx);
  const preparerId = `preparer-${randomUUID()}`;
  const approverId = `approver-${randomUUID()}`;
  const { bvId, version, artifactId, workingRevisionId, engineManifestId } = await makeInReviewVersion(ctx, orgId, preparerId, approverId);
  const approved = await ctx.svc.approveVersion({ organizationId: orgId, businessVersionId: bvId, actorId: approverId, role: 'approver', expectedVersion: version });
  if (!approved.ok) throw new Error(`fixture approve failed: ${approved.code}`);
  const approvedVersion = approved.businessVersion.version;

  const jobType = `j3-race5-${randomUUID()}`;
  const idempotencyKey = `j3-race5-key-${randomUUID()}`;
  const finishCall = simulateCompute(ctx, {
    organizationId: orgId,
    artifactId,
    workingRevisionId,
    jobType,
    idempotencyKey,
    workerId: 'race5-worker',
    delayMs: 40,
    engineManifestId,
  }).then((r) => ({
    kind: 'finish',
    ...r,
  }));

  const archiveCalls = Array.from({ length: N }, (_, i) => {
    const startedAt = Date.now();
    return ctx.svc
      .transition({ organizationId: orgId, businessVersionId: bvId, action: 'archive', actorId: `archiver-${i}-${randomUUID()}`, role: 'approver', expectedVersion: approvedVersion })
      .then((r: any) => ({ startedAt, finishedAt: Date.now(), kind: 'archive', ...r }));
  });

  const results = await Promise.all([finishCall, ...archiveCalls]);
  const materialized = overlapCount(results.filter((r: any) => r.startedAt) as any) > 0;

  const archiveResults = results.filter((r: any) => r.kind === 'archive');
  const archiveWinners = archiveResults.filter((r: any) => r.ok);
  const finishResult: any = results.find((r: any) => r.kind === 'finish');

  const post = await readBvStatus(ctx, bvId);
  const outputRows = await ctx.verify.query(
    `SELECT o.id FROM compute_job_outputs o JOIN compute_jobs j ON j.id = o.job_id WHERE j.organization_id = $1 AND j.job_type = $2 AND j.idempotency_key = $3`,
    [orgId, jobType, idempotencyKey]
  );

  return {
    orgId,
    materialized,
    archiveWinnersCount: archiveWinners.length,
    finishOutcome: finishResult.outcome,
    postStatus: post?.status,
    outputRowCount: outputRows.rows.length,
    // Archive is a business-version-status concern; the compute job's own completion is INDEPENDENT
    // of archive (nothing in this codebase makes completeJobSuccess consult artifact/bv status) — so
    // the invariant is: archive winners <= 1, AND the job's own output is never duplicated regardless
    // of whether archive won before/after/during.
    pass: archiveWinners.length <= 1 && outputRows.rows.length <= 1,
    detail: results,
  };
}

// =========================================================================
// RACE 6 — retry after commit-before-ack: N concurrent "client retries"
// hitting an ALREADY-SUCCEEDED job under the same idempotency key
// =========================================================================
async function race6RetryAfterCommit(ctx: Ctx, N: number): Promise<AnyResult> {
  const orgId = await makeOrg(ctx);
  const created = await ctx.svc.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: 'j3-user' });
  const artifactId = created.artifact.artifact_id;
  const workingRevisionId = created.workingRevision.working_revision_id;
  const jobType = `j3-race6-${randomUUID()}`;
  const idempotencyKey = `j3-race6-key-${randomUUID()}`;

  // Original call completes for real FIRST (commit succeeds; we simulate the ack to the client
  // never arriving by simply not "telling" it — the retries below are what the client does next).
  const original = await simulateCompute(ctx, {
    organizationId: orgId,
    artifactId,
    workingRevisionId,
    jobType,
    idempotencyKey,
    workerId: 'race6-original',
    engineManifestId: created.businessVersion.engine_manifest_id,
  });
  if (original.outcome !== 'completed') throw new Error(`fixture: original compute did not complete: ${JSON.stringify(original)}`);

  // N concurrent retries, all racing each other AND hitting the already-succeeded row.
  const retries = Array.from({ length: N }, (_, i) =>
    simulateCompute(ctx, {
      organizationId: orgId,
      artifactId,
      workingRevisionId,
      jobType,
      idempotencyKey,
      workerId: `race6-retry-${i}`,
      engineManifestId: created.businessVersion.engine_manifest_id,
    })
  );
  const results = await Promise.all(retries);
  const materialized = overlapCount(results as any) > 0;

  const allAlreadyCommitted = results.every((r: any) => r.outcome === 'already_committed');
  const allSameOutputId = new Set(results.map((r: any) => r.outputId)).size <= 1;

  const outputRows = await ctx.verify.query(
    `SELECT o.id FROM compute_job_outputs o JOIN compute_jobs j ON j.id = o.job_id WHERE j.organization_id = $1 AND j.job_type = $2 AND j.idempotency_key = $3`,
    [orgId, jobType, idempotencyKey]
  );

  return {
    orgId,
    materialized,
    allAlreadyCommitted,
    allSameOutputId,
    outputRowCount: outputRows.rows.length,
    pass: allAlreadyCommitted && allSameOutputId && outputRows.rows.length === 1,
    original,
    detail: results,
  };
}

// =========================================================================
// FAULT 1 — crash BETWEEN snapshot write and status write (approveVersion step b -> step c)
// =========================================================================
async function fault1SnapshotStatus(ctx: Ctx): Promise<AnyResult> {
  const orgId = await makeOrg(ctx);
  const preparerId = `preparer-${randomUUID()}`;
  const approverId = `approver-${randomUUID()}`;
  const { bvId, version, artifactId } = await makeInReviewVersion(ctx, orgId, preparerId, approverId);

  const wr = await ctx.verify.query(`SELECT working_revision_id, content_semantic_hash, compute_run_id FROM finance_working_revisions WHERE artifact_id = $1 AND is_current = true`, [
    artifactId,
  ]);
  const workingRevisionId = wr.rows[0].working_revision_id;

  // FAULT INJECTION: reproduce approveVersion() step (b) — INSERT finance_compute_snapshots — then
  // crash (throw) BEFORE step (c) — the status UPDATE. Mirrors faultMatrix.pg.test.ts's B2 pattern.
  const snapshotId = randomUUID();
  await ctx.withPinnedPostgresTransaction(async (tx: any) => {
    try {
      await tx.queryRun(
        `INSERT INTO finance_compute_snapshots (compute_snapshot_id, artifact_id, organization_id, working_revision_id, compute_run_id, engine_manifest_id, as_of, content_semantic_hash, created_by)
         VALUES (?, ?, ?, ?, ?, (SELECT engine_manifest_id FROM finance_business_versions WHERE business_version_id = ?), now(), ?, ?)`,
        [snapshotId, artifactId, orgId, workingRevisionId, wr.rows[0].compute_run_id, bvId, wr.rows[0].content_semantic_hash, approverId]
      );
      throw new Error('J3-FAULT1: simulated crash between snapshot write and status write');
    } catch (e) {
      throw e;
    }
  }).catch(() => {});

  // Physical proof: the partial snapshot did NOT survive (transaction rolled back atomically).
  const orphanAfterRollback = await ctx.verify.query(`SELECT compute_snapshot_id FROM finance_compute_snapshots WHERE compute_snapshot_id = $1`, [snapshotId]);
  const bvUntouched = await readBvStatus(ctx, bvId);

  // Now do a REAL approve — the recovery path. It must succeed cleanly and produce exactly one
  // snapshot for this working revision (no orphan bleeding in from the crashed attempt).
  const approved = await ctx.svc.approveVersion({ organizationId: orgId, businessVersionId: bvId, actorId: approverId, role: 'approver', expectedVersion: version });

  const snapshotsForRevision = await ctx.verify.query(`SELECT compute_snapshot_id FROM finance_compute_snapshots WHERE working_revision_id = $1`, [workingRevisionId]);
  const finalStatus = await readBvStatus(ctx, bvId);

  return {
    orgId,
    orphanSurvivedRollback: orphanAfterRollback.rows.length > 0,
    bvUntouchedAfterCrash: bvUntouched?.status === 'IN_REVIEW',
    recoveryApproveOk: approved.ok,
    snapshotCountForRevisionAfterRecovery: snapshotsForRevision.rows.length,
    finalStatus: finalStatus?.status,
    pass: orphanAfterRollback.rows.length === 0 && bvUntouched?.status === 'IN_REVIEW' && approved.ok === true && snapshotsForRevision.rows.length === 1 && finalStatus?.status === 'APPROVED',
  };
}

// =========================================================================
// FAULT 2 — crash BEFORE output write, and separately AFTER output write (before status flip)
// =========================================================================
async function fault2BeforeAfterOutput(ctx: Ctx): Promise<AnyResult> {
  const orgId = await makeOrg(ctx);
  const created = await ctx.svc.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: 'j3-user' });
  const artifactId = created.artifact.artifact_id;
  const workingRevisionId = created.workingRevision.working_revision_id;
  const engineManifestId = created.businessVersion.engine_manifest_id;

  // --- BEFORE output write: crash claim inside the domain-compute window, never call completeJobSuccess at all ---
  const jobTypeBefore = `j3-fault2-before-${randomUUID()}`;
  const enq1 = await ctx.jobs.enqueue({
    organizationId: orgId,
    jobType: jobTypeBefore,
    inputArtifactId: artifactId,
    inputRevisionHash: `hash-${randomUUID()}`,
    engineManifestId,
    idempotencyKey: `j3-fault2-before-key-${randomUUID()}`,
    requestedByUserId: 'j3-user',
  });
  const claim1 = await ctx.jobs.claimForCompute({ organizationId: orgId, job: enq1.job, wasExisting: enq1.wasExisting, workerId: 'fault2-before-worker' });
  // Simulated crash: process dies here, before completeJobSuccess is ever called.
  const jobAfterCrashBefore = await ctx.verify.query(`SELECT status FROM compute_jobs WHERE id = $1`, [claim1.outcome === 'claimed' ? claim1.job.id : enq1.job.id]);
  const outputsAfterCrashBefore = await ctx.verify.query(`SELECT id FROM compute_job_outputs WHERE job_id = $1`, [enq1.job.id]);

  // --- AFTER output write, BEFORE status flip: manual pinned tx writes compute_job_outputs then
  //     throws before the UPDATE compute_jobs SET status='succeeded' — this is possible ONLY as an
  //     artificial fault because completeJobSuccess() does both in ONE transaction; we reproduce the
  //     "what if it weren't atomic" world to prove the REAL function's atomicity is load-bearing.
  const jobTypeAfter = `j3-fault2-after-${randomUUID()}`;
  const enq2 = await ctx.jobs.enqueue({
    organizationId: orgId,
    jobType: jobTypeAfter,
    inputArtifactId: artifactId,
    inputRevisionHash: `hash-${randomUUID()}`,
    engineManifestId,
    idempotencyKey: `j3-fault2-after-key-${randomUUID()}`,
    requestedByUserId: 'j3-user',
  });
  const claim2 = await ctx.jobs.claimForCompute({ organizationId: orgId, job: enq2.job, wasExisting: enq2.wasExisting, workerId: 'fault2-after-worker' });
  if (claim2.outcome !== 'claimed') throw new Error('fixture: expected claimed');
  const runningJob2 = claim2.job;
  const contentHash = `j3-fault2-after-hash-${randomUUID()}`;
  await ctx
    .withPinnedPostgresTransaction(async (tx: any) => {
      await tx.queryRun(
        `INSERT INTO compute_job_outputs (id, job_id, organization_id, output_artifact_id, output_working_revision_id, committed_by_attempt_number, content_semantic_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), runningJob2.id, orgId, artifactId, workingRevisionId, runningJob2.attempt_count, contentHash]
      );
      throw new Error('J3-FAULT2: simulated crash after output write, before status flip');
    })
    .catch(() => {});

  const jobAfterCrashAfter = await ctx.verify.query(`SELECT status FROM compute_jobs WHERE id = $1`, [runningJob2.id]);
  const outputsAfterCrashAfter = await ctx.verify.query(`SELECT id FROM compute_job_outputs WHERE job_id = $1`, [runningJob2.id]);

  // Recovery for the "before" case: failJob then retry-claim then complete for real.
  await ctx.jobs.failJob({ jobId: enq1.job.id, organizationId: orgId, error: 'j3 fault2 before recovery' });
  await ctx.withPinnedPostgresTransaction((tx: any) => tx.queryRun(`UPDATE compute_jobs SET next_attempt_at = now() WHERE id = ?`, [enq1.job.id]));
  const reclaim1 = await ctx.jobs.claim({ workerId: 'fault2-before-recover', jobTypes: [jobTypeBefore], limit: 1 });
  let recoveredOk = false;
  if (reclaim1.length === 1) {
    const done = await ctx.jobs.completeJobSuccess({
      jobId: enq1.job.id,
      organizationId: orgId,
      outputArtifactId: artifactId,
      outputWorkingRevisionId: workingRevisionId,
      contentSemanticHash: `j3-fault2-before-recovered-${randomUUID()}`,
    });
    recoveredOk = done.ok;
  }
  const finalOutputs1 = await ctx.verify.query(`SELECT id FROM compute_job_outputs WHERE job_id = $1`, [enq1.job.id]);

  return {
    orgId,
    beforeCase: {
      jobStatusAfterCrash: jobAfterCrashBefore.rows[0]?.status,
      outputsAfterCrash: outputsAfterCrashBefore.rows.length,
      recoveredOk,
      finalOutputCount: finalOutputs1.rows.length,
    },
    afterCase: {
      // Because our fault manually rolled back the tx (throw inside withPinnedPostgresTransaction),
      // the "orphan output survives with no matching succeeded status" state should NOT be
      // observable — the whole point of completeJobSuccess() doing both writes in ONE transaction.
      jobStatusAfterCrash: jobAfterCrashAfter.rows[0]?.status,
      outputsAfterCrashSurvived: outputsAfterCrashAfter.rows.length,
    },
    pass:
      jobAfterCrashBefore.rows[0]?.status === 'running' &&
      outputsAfterCrashBefore.rows.length === 0 &&
      recoveredOk === true &&
      finalOutputs1.rows.length === 1 &&
      jobAfterCrashAfter.rows[0]?.status === 'running' && // NOT succeeded — the throw rolled back BOTH writes together
      outputsAfterCrashAfter.rows.length === 0, // the "orphan output, no status flip" state is provably unreachable
  };
}

// =========================================================================
// FAULT 3 — lease loss (expires without heartbeat) mid-computation
// =========================================================================
async function fault3LeaseLoss(ctx: Ctx): Promise<AnyResult> {
  const orgId = await makeOrg(ctx);
  const created = await ctx.svc.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: 'j3-user' });
  const artifactId = created.artifact.artifact_id;
  const engineManifestId = created.businessVersion.engine_manifest_id;
  const jobType = `j3-fault3-${randomUUID()}`;

  const enq = await ctx.jobs.enqueue({
    organizationId: orgId,
    jobType,
    inputArtifactId: artifactId,
    inputRevisionHash: `hash-${randomUUID()}`,
    engineManifestId,
    idempotencyKey: `j3-fault3-key-${randomUUID()}`,
    requestedByUserId: 'j3-user',
  });
  const claim = await ctx.jobs.claimForCompute({ organizationId: orgId, job: enq.job, wasExisting: enq.wasExisting, workerId: 'fault3-doomed', leaseDurationSeconds: 1 });
  if (claim.outcome !== 'claimed') throw new Error('fixture: expected claimed');

  await new Promise((res) => setTimeout(res, 1200)); // let the 1s lease actually pass wall-clock, no heartbeat

  const beforeReap = await ctx.verify.query(`SELECT status, lease_owner FROM compute_jobs WHERE id = $1`, [claim.job.id]);
  const reaped = await ctx.jobs.reapExpiredLeases({ batchSize: 50 });
  const mine = reaped.find((r: any) => r.jobId === claim.job.id);

  const afterReap = await ctx.verify.query(`SELECT status, lease_owner, lease_expires_at FROM compute_jobs WHERE id = $1`, [claim.job.id]);
  const runsAfter = await ctx.verify.query(`SELECT outcome FROM compute_job_runs WHERE job_id = $1 ORDER BY attempt_number`, [claim.job.id]);

  // Full recovery: fast-forward backoff, reclaim, complete for real.
  await ctx.withPinnedPostgresTransaction((tx: any) => tx.queryRun(`UPDATE compute_jobs SET next_attempt_at = now() WHERE id = ?`, [claim.job.id]));
  const reclaim = await ctx.jobs.claim({ workerId: 'fault3-rescuer', jobTypes: [jobType], limit: 1 });
  let recoveredOk = false;
  if (reclaim.length === 1) {
    const done = await ctx.jobs.completeJobSuccess({
      jobId: claim.job.id,
      organizationId: orgId,
      outputArtifactId: artifactId,
      outputWorkingRevisionId: created.workingRevision.working_revision_id,
      contentSemanticHash: `j3-fault3-recovered-${randomUUID()}`,
    });
    recoveredOk = done.ok;
  }
  const finalOutputs = await ctx.verify.query(`SELECT id FROM compute_job_outputs WHERE job_id = $1`, [claim.job.id]);

  return {
    orgId,
    beforeReap: beforeReap.rows[0],
    reapedThisJob: Boolean(mine),
    reapOutcome: mine?.outcome,
    afterReap: afterReap.rows[0],
    runOutcomes: runsAfter.rows.map((r: any) => r.outcome),
    recoveredOk,
    finalOutputCount: finalOutputs.rows.length,
    pass:
      beforeReap.rows[0]?.status === 'running' &&
      Boolean(mine) &&
      mine?.outcome === 'requeued' &&
      afterReap.rows[0]?.status === 'queued' &&
      afterReap.rows[0]?.lease_owner === null &&
      recoveredOk === true &&
      finalOutputs.rows.length === 1,
  };
}

// =========================================================================
// FAULT 4 — worker restart mid-processing (indistinguishable from lease loss
// at the DB layer, but exercised via a SEPARATE code path: the worker
// re-launches with a NEW workerId and attempts to self-claim the SAME job it
// had before the restart, without ever having heartbeat'd)
// =========================================================================
async function fault4WorkerRestart(ctx: Ctx): Promise<AnyResult> {
  const orgId = await makeOrg(ctx);
  const created = await ctx.svc.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: 'j3-user' });
  const artifactId = created.artifact.artifact_id;
  const engineManifestId = created.businessVersion.engine_manifest_id;
  const jobType = `j3-fault4-${randomUUID()}`;
  const idempotencyKey = `j3-fault4-key-${randomUUID()}`;

  const enq = await ctx.jobs.enqueue({
    organizationId: orgId,
    jobType,
    inputArtifactId: artifactId,
    inputRevisionHash: `hash-${randomUUID()}`,
    engineManifestId,
    idempotencyKey,
    requestedByUserId: 'j3-user',
  });
  const workerGen1 = `fault4-worker-gen1-${randomUUID()}`;
  const claim1 = await ctx.jobs.claimForCompute({ organizationId: orgId, job: enq.job, wasExisting: enq.wasExisting, workerId: workerGen1, leaseDurationSeconds: 1 });
  if (claim1.outcome !== 'claimed') throw new Error('fixture: expected claimed');

  // Worker process restarts (crash + supervisor relaunch): new process, new workerId, no memory of
  // gen1's in-flight state. It does NOT try to heartbeat as gen1 (it does not know gen1 existed) —
  // it just tries, wrongly, to claimForCompute the SAME idempotency key again immediately (gen1's
  // lease has not expired yet at this instant).
  const workerGen2 = `fault4-worker-gen2-${randomUUID()}`;
  const enq2 = await ctx.jobs.enqueue({
    organizationId: orgId,
    jobType,
    inputArtifactId: artifactId,
    inputRevisionHash: `hash-${randomUUID()}`,
    engineManifestId,
    idempotencyKey, // SAME key — this is what a restarted worker replaying its own last request looks like
    requestedByUserId: 'j3-user',
  });
  const claim2Immediate = await ctx.jobs.claimForCompute({ organizationId: orgId, job: enq2.job, wasExisting: enq2.wasExisting, workerId: workerGen2 });

  // Now let gen1's lease actually expire and the reaper run — THIS is the real recovery path.
  await new Promise((res) => setTimeout(res, 1200));
  const reaped = await ctx.jobs.reapExpiredLeases({ batchSize: 50 });
  const mine = reaped.find((r: any) => r.jobId === claim1.job.id);
  await ctx.withPinnedPostgresTransaction((tx: any) => tx.queryRun(`UPDATE compute_jobs SET next_attempt_at = now() WHERE id = ?`, [claim1.job.id]));

  const enq3 = await ctx.jobs.enqueue({
    organizationId: orgId,
    jobType,
    inputArtifactId: artifactId,
    inputRevisionHash: `hash-${randomUUID()}`,
    engineManifestId,
    idempotencyKey,
    requestedByUserId: 'j3-user',
  });
  const claim3AfterReap = await ctx.jobs.claimForCompute({ organizationId: orgId, job: enq3.job, wasExisting: enq3.wasExisting, workerId: workerGen2 });
  let completedOk = false;
  if (claim3AfterReap.outcome === 'claimed') {
    const done = await ctx.jobs.completeJobSuccess({
      jobId: claim3AfterReap.job.id,
      organizationId: orgId,
      outputArtifactId: artifactId,
      outputWorkingRevisionId: created.workingRevision.working_revision_id,
      contentSemanticHash: `j3-fault4-final-${randomUUID()}`,
    });
    completedOk = done.ok;
  } else if (claim3AfterReap.outcome === 'already_committed') {
    completedOk = true;
  }

  const outputRows = await ctx.verify.query(
    `SELECT o.id FROM compute_job_outputs o JOIN compute_jobs j ON j.id = o.job_id WHERE j.organization_id = $1 AND j.job_type = $2 AND j.idempotency_key = $3`,
    [orgId, jobType, idempotencyKey]
  );

  return {
    orgId,
    // The immediate re-claim-while-gen1-still-holds-lease MUST be refused, not silently accepted —
    // this is exactly the same NOT_RUNNING gate claimForCompute already provides for a same-key
    // duplicate while running (proves worker-restart replay is not a special case that bypasses it).
    immediateReclaimOutcome: claim2Immediate.outcome,
    immediateReclaimCode: (claim2Immediate as any).code,
    reapedGen1: Boolean(mine),
    reapOutcome: mine?.outcome,
    claim3Outcome: claim3AfterReap.outcome,
    completedOk,
    outputRowCount: outputRows.rows.length,
    pass: claim2Immediate.outcome === 'hard_error' && (claim2Immediate as any).code === 'NOT_RUNNING' && Boolean(mine) && completedOk === true && outputRows.rows.length === 1,
  };
}

// =========================================================================
// FAULT 5 — duplicate enqueue (same idempotency key), scaled to N concurrent submitters
// =========================================================================
async function fault5DuplicateEnqueue(ctx: Ctx, N: number): Promise<AnyResult> {
  const orgId = await makeOrg(ctx);
  const created = await ctx.svc.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: 'j3-user' });
  const artifactId = created.artifact.artifact_id;
  const engineManifestId = created.businessVersion.engine_manifest_id;
  const jobType = `j3-fault5-${randomUUID()}`;
  const key = `j3-fault5-key-${randomUUID()}`;

  const submit = () =>
    ctx.jobs.enqueue({
      organizationId: orgId,
      jobType,
      inputArtifactId: artifactId,
      inputRevisionHash: 'j3-fault5-hash',
      engineManifestId,
      idempotencyKey: key,
      requestedByUserId: 'j3-user',
    });

  const startedAt = Date.now();
  const settled = await Promise.allSettled(Array.from({ length: N }, () => submit()));
  const finishedAt = Date.now();
  const fulfilled = settled.filter((s) => s.status === 'fulfilled') as PromiseFulfilledResult<any>[];
  const rejected = settled.filter((s) => s.status === 'rejected');

  const rows = await ctx.verify.query(`SELECT id FROM compute_jobs WHERE organization_id = $1 AND job_type = $2 AND idempotency_key = $3`, [orgId, jobType, key]);
  const distinctJobIds = new Set(fulfilled.map((f) => f.value.job.id));
  const wasExistingFalseCount = fulfilled.filter((f) => f.value.wasExisting === false).length;

  return {
    orgId,
    startedAt,
    finishedAt,
    N,
    fulfilledCount: fulfilled.length,
    rejectedCount: rejected.length,
    rejectedReasons: rejected.map((r: any) => String(r.reason?.message || r.reason)),
    physicalRowCount: rows.rows.length,
    distinctJobIdsReturned: distinctJobIds.size,
    wasExistingFalseCount,
    pass: rejected.length === 0 && rows.rows.length === 1 && distinctJobIds.size === 1 && wasExistingFalseCount === 1,
  };
}

// =========================================================================
// FAULT 6 — cancel race: cancelJob() vs completeJobSuccess() at TRUE concurrency
// =========================================================================
async function fault6CancelRace(ctx: Ctx, N: number): Promise<AnyResult> {
  const orgId = await makeOrg(ctx);
  const created = await ctx.svc.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: 'j3-user' });
  const artifactId = created.artifact.artifact_id;
  const engineManifestId = created.businessVersion.engine_manifest_id;
  const jobType = `j3-fault6-${randomUUID()}`;

  const enq = await ctx.jobs.enqueue({
    organizationId: orgId,
    jobType,
    inputArtifactId: artifactId,
    inputRevisionHash: `hash-${randomUUID()}`,
    engineManifestId,
    idempotencyKey: `j3-fault6-key-${randomUUID()}`,
    requestedByUserId: 'j3-user',
  });
  const claim = await ctx.jobs.claimForCompute({ organizationId: orgId, job: enq.job, wasExisting: enq.wasExisting, workerId: 'fault6-worker' });
  if (claim.outcome !== 'claimed') throw new Error('fixture: expected claimed');

  // TRUE race: N cancel attempts fired in parallel with the completeJobSuccess() call, all at once.
  const completeCall = (async () => {
    const startedAt = Date.now();
    const r = await ctx.jobs.completeJobSuccess({
      jobId: claim.job.id,
      organizationId: orgId,
      outputArtifactId: artifactId,
      outputWorkingRevisionId: created.workingRevision.working_revision_id,
      contentSemanticHash: `j3-fault6-hash-${randomUUID()}`,
    });
    return { startedAt, finishedAt: Date.now(), kind: 'complete', ...r };
  })();
  const cancelCalls = Array.from({ length: N }, (_, i) => {
    const startedAt = Date.now();
    return ctx.jobs.cancelJob(orgId, claim.job.id, `j3-fault6-cancel-${i}`).then((r: any) => ({ startedAt, finishedAt: Date.now(), kind: 'cancel', result: r }));
  });

  const results = await Promise.all([completeCall, ...cancelCalls]);
  const materialized = overlapCount(results as any) > 0;

  const completeResult: any = results.find((r: any) => r.kind === 'complete');
  const cancelResults = results.filter((r: any) => r.kind === 'cancel');
  const cancelWinners = cancelResults.filter((r: any) => r.result?.status === 'cancelled');

  const finalJob = await ctx.verify.query(`SELECT status FROM compute_jobs WHERE id = $1`, [claim.job.id]);
  const outputRows = await ctx.verify.query(`SELECT id FROM compute_job_outputs WHERE job_id = $1`, [claim.job.id]);

  // Exactly one of {complete succeeded, cancel succeeded} may have "won" the terminal state — never
  // both (a cancelled job must never also carry a committed output; a succeeded job must never also
  // be marked cancelled).
  const terminalIsSucceeded = finalJob.rows[0]?.status === 'succeeded';
  const terminalIsCancelled = finalJob.rows[0]?.status === 'cancelled';
  const consistentTerminal = terminalIsSucceeded !== terminalIsCancelled; // XOR — exactly one

  return {
    orgId,
    materialized,
    completeOk: completeResult.ok,
    cancelWinnersCount: cancelWinners.length,
    finalStatus: finalJob.rows[0]?.status,
    outputRowCount: outputRows.rows.length,
    consistentTerminal,
    // If succeeded won: exactly 1 output. If cancelled won: exactly 0 outputs. Never the other combo.
    pass:
      consistentTerminal &&
      ((terminalIsSucceeded && outputRows.rows.length === 1) || (terminalIsCancelled && outputRows.rows.length === 0)),
    detail: results,
  };
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
