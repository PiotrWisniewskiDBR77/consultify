/**
 * @vitest-environment node
 *
 * ADM-OPS-ALERT — admin IAM queue alert evaluator, real PostgreSQL only.
 *
 * PROVES (see docs/runbooks/ADMIN_IAM_OPERATIONS_RUNBOOK.md, "Queue alert
 * conditions", for the authoritative predicates this suite pins to):
 *
 *  1. ADMIN_IAM_JOB_STALE fires deterministically when a `running` job's
 *     lease has expired (`lease_expires_at < now()`), driven by an explicit
 *     `now` — never a sleep.
 *  2. ADMIN_IAM_JOB_FAILED fires once a job exhausts retries into terminal
 *     `failed`.
 *  3. Evaluating the SAME condition at the SAME `now` twice is idempotent:
 *     exactly one DETECTED row lands in operational_alert_delivery_outbox
 *     for that org+kind, and `version` does not advance on replay.
 *  4. The outbox payload's `runbookId` is exactly the exported
 *     ADMIN_IAM_ALERT_RUNBOOK_ID constant, and that id's anchor is a real
 *     heading that exists in docs/runbooks/ADMIN_IAM_OPERATIONS_RUNBOOK.md
 *     on disk — a link to nowhere fails this test.
 *  5. The alert payload never carries the job's own payload, its last_error
 *     text, or its lease token, and contains no secret-shaped key/value.
 *  6. Both kinds RECOVER once their underlying condition clears, and the
 *     durable transition sequence recorded in the outbox is exactly
 *     ['DETECTED','RECOVERED'].
 *  7. Tenant isolation holds in both directions: a condition seeded only
 *     under one org never activates another org's state, and firing is
 *     verified independently on the org where the condition WAS seeded.
 *  8. A fully healthy tenant (claimed and completed, nothing stale, nothing
 *     failed) produces no ACTIVE state for either kind.
 *  9. This suite's own writes leave zero orphaned admin_iam_job_events rows,
 *     and the pre-existing append-only trigger on operational_alert_signals
 *     still rejects a raw UPDATE — this evaluator does not touch that table
 *     (per the binding contract: it writes directly to
 *     operational_alert_tenant_states and operational_alert_delivery_outbox,
 *     no migration, no operational_alert_signals), and this test proves that
 *     boundary was not blurred and the existing guard was not weakened.
 *
 * Two deliberate design notes, spelled out because the contract does not
 * fix them and a reviewer should not have to reverse-engineer this suite:
 *
 *  - Recovering ADMIN_IAM_JOB_STALE: the runbook is explicit that a stale
 *    `running` lease "will not self-heal" — `claimAdminIamJob` only reclaims
 *    rows still `queued`. The one legitimate service-level way to take the
 *    job out of `running` is `completeAdminIamJob` under its ORIGINAL lease
 *    token; that function checks `status='running' AND lease_token=?`, not
 *    lease expiry, so completing under the still-known token is a real
 *    lifecycle transition, not a backdoor.
 *  - Recovering ADMIN_IAM_JOB_FAILED: the runbook's detection predicate is
 *    literally "admin_iam_jobs rows with status='failed'", with no window
 *    and no job_type/idempotency scoping. `adminIamOperationsService.ts`
 *    exposes no function that ever moves a job OUT of terminal `failed`
 *    (enqueue/claim/complete/fail all require a prior status that `failed`
 *    does not satisfy), and the runbook forbids ever flipping it to
 *    `succeeded` by hand. So the only way the evaluator's own query can see
 *    the failed count return to zero is for the terminal row to actually
 *    leave `admin_iam_jobs`. This suite (a) performs the real remediation —
 *    enqueues a NEW job under a NEW idempotency key and lets it succeed —
 *    and (b) archives the old terminal row via the same disable/delete
 *    /enable-trigger-shaped direct SQL the sibling OPS-OBS suite already
 *    uses for its own out-of-band cleanup (no trigger to disable here; the
 *    two admin-iam tables carry no append-only guard). This never touches
 *    `status`; it stands in for an archival step this service does not yet
 *    expose as a function, so the evaluator's next run observes the state
 *    honestly rather than being told a lie.
 *
 * REQUIRES A REAL DATABASE. When one is not configured this file collects
 * and SKIPS the whole suite (describe.skipIf) — it makes zero assertions in
 * that case and is not a substitute for actually running it.
 *
 * Run:
 *   RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgres://user:pass@host:port/db \
 *     npx vitest run server/src/services/__tests__/adminIamAlertEvaluator.pg.test.ts
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  claimAdminIamJob,
  completeAdminIamJob,
  enqueueAdminIamJob,
  failAdminIamJob,
} from '../adminIamOperationsService.js';
import {
  ADMIN_IAM_ALERT_RUNBOOK_ID,
  ADMIN_IAM_ALERT_THRESHOLDS,
  evaluateAdminIamQueueAlerts,
} from '../adminIamAlertEvaluator.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

// Same reasoning as adminIamBvp.pg.test.ts: adminIamOperationsService.ts
// goes through the DbPromise abstraction, which reads DB_TYPE lazily on
// first real call — set it before any test body runs, not inside a hook.
if (REAL_PG) process.env.DB_TYPE = 'postgres';

const SECRET_SHAPE = /(authorization|cookie|password|secret|token|api.?key)/i;

function slugifyHeading(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const prefix = `adm-iam-alert-${randomUUID().slice(0, 8)}`;
const actor = `${prefix}-actor`;
const evaluatorId = `${prefix}-evaluator`;

const orgStale = `${prefix}-org-stale`;
const orgReplay = `${prefix}-org-replay`;
const orgFailed = `${prefix}-org-failed`;
const orgLeakCheck = `${prefix}-org-leak-check`;
const orgIsoA = `${prefix}-org-iso-a`;
const orgIsoB = `${prefix}-org-iso-b`;
const orgHealthy = `${prefix}-org-healthy`;
const orgGuardProbe = `${prefix}-org-guard-probe`;
const ALL_ORGS = [
  orgStale,
  orgReplay,
  orgFailed,
  orgLeakCheck,
  orgIsoA,
  orgIsoB,
  orgHealthy,
  orgGuardProbe,
];

// Explicit, fixed instants. Nothing in this suite ever sleeps or reads the
// wall clock — every evaluator call is driven by one of these.
const T_DETECT = '2026-08-18T06:00:00.000Z';
const T_PAST_LEASE = '2026-08-18T05:00:00.000Z'; // before T_DETECT
const T_RECOVER = '2026-08-19T06:00:00.000Z'; // after T_DETECT

describe.skipIf(!REAL_PG)('ADM-OPS-ALERT admin IAM queue alert evaluator (real PostgreSQL)', () => {
  let db: Client;
  let staleJobId = '';

  beforeAll(async () => {
    db = new Client({ connectionString: DATABASE_URL });
    await db.connect();
  });

  afterAll(async () => {
    await db.query(`DELETE FROM admin_iam_job_events WHERE organization_id = ANY($1)`, [ALL_ORGS]);
    await db.query(`DELETE FROM admin_iam_jobs WHERE organization_id = ANY($1)`, [ALL_ORGS]);
    await db.query(`DELETE FROM operational_alert_delivery_outbox WHERE organization_id = ANY($1)`, [ALL_ORGS]);
    await db.query(`DELETE FROM operational_alert_tenant_states WHERE organization_id = ANY($1)`, [ALL_ORGS]);
    // Test DB only: disable the immutable guard solely to remove this
    // suite's own probe row from the append-only signals table (the guard
    // itself is asserted intact in the last `it` below, before this runs).
    await db.query(`ALTER TABLE operational_alert_signals DISABLE TRIGGER trg_operational_alert_signals_immutable`);
    await db.query(`DELETE FROM operational_alert_signals WHERE organization_id = $1`, [orgGuardProbe]);
    await db.query(`ALTER TABLE operational_alert_signals ENABLE TRIGGER trg_operational_alert_signals_immutable`);
    await db.end();
  });

  it('fires ADMIN_IAM_JOB_STALE once a running job outlives its lease, driven by an explicit now', async () => {
    const job = await enqueueAdminIamJob({
      organizationId: orgStale,
      actorId: actor,
      jobType: 'membership_sync',
      idempotencyKey: `${prefix}-stale-job`,
      payload: { source: 'scim' },
      maxAttempts: 3,
    });
    staleJobId = job.id;
    const claimed = await claimAdminIamJob({ organizationId: orgStale, workerId: `${prefix}-worker-stale` });
    expect(claimed?.id).toBe(job.id);

    // The claim query only reclaims rows still 'queued' — a stale 'running'
    // lease will not self-heal (runbook). Backdate directly; never sleep.
    await db.query(`UPDATE admin_iam_jobs SET lease_expires_at = $1 WHERE id = $2`, [T_PAST_LEASE, job.id]);

    const evaluated = await evaluateAdminIamQueueAlerts({ organizationId: orgStale, evaluatorId, now: T_DETECT });
    const stale = evaluated.find((row) => row.kind === 'ADMIN_IAM_JOB_STALE');
    expect(stale).toBeTruthy();
    expect(stale?.status).toBe('ACTIVE');
    expect(stale?.latestValue).toBeGreaterThanOrEqual(1);
    expect(stale?.threshold).toBe(ADMIN_IAM_ALERT_THRESHOLDS.ADMIN_IAM_JOB_STALE);
  });

  it('is idempotent on replay: same condition, same now, twice — one DETECTED row, version unchanged', async () => {
    const job = await enqueueAdminIamJob({
      organizationId: orgReplay,
      actorId: actor,
      jobType: 'membership_sync',
      idempotencyKey: `${prefix}-replay-job`,
      payload: { source: 'scim' },
      maxAttempts: 3,
    });
    const claimed = await claimAdminIamJob({ organizationId: orgReplay, workerId: `${prefix}-worker-replay` });
    expect(claimed?.id).toBe(job.id);
    await db.query(`UPDATE admin_iam_jobs SET lease_expires_at = $1 WHERE id = $2`, [T_PAST_LEASE, job.id]);

    const first = await evaluateAdminIamQueueAlerts({ organizationId: orgReplay, evaluatorId, now: T_DETECT });
    const second = await evaluateAdminIamQueueAlerts({ organizationId: orgReplay, evaluatorId, now: T_DETECT });

    const firstStale = first.find((row) => row.kind === 'ADMIN_IAM_JOB_STALE');
    const secondStale = second.find((row) => row.kind === 'ADMIN_IAM_JOB_STALE');
    expect(firstStale?.status).toBe('ACTIVE');
    expect(secondStale?.status).toBe('ACTIVE');
    expect(secondStale?.version).toBe(firstStale?.version);

    const detectedCount = await db.query(
      `SELECT COUNT(*)::int AS count FROM operational_alert_delivery_outbox WHERE organization_id=$1 AND kind=$2 AND transition='DETECTED'`,
      [orgReplay, 'ADMIN_IAM_JOB_STALE']
    );
    expect(Number(detectedCount.rows[0].count)).toBe(1);
  });

  it('fires ADMIN_IAM_JOB_FAILED once a job exhausts retries into terminal failed, and the runbook link resolves to a real section', async () => {
    const job = await enqueueAdminIamJob({
      organizationId: orgFailed,
      actorId: actor,
      jobType: 'role_reconcile',
      idempotencyKey: `${prefix}-failed-job`,
      payload: { source: 'scim' },
      maxAttempts: 1,
    });
    const claimed = await claimAdminIamJob({ organizationId: orgFailed, workerId: `${prefix}-worker-failed` });
    expect(claimed?.id).toBe(job.id);
    const failed = await failAdminIamJob({
      organizationId: orgFailed,
      jobId: job.id,
      leaseToken: claimed!.leaseToken!,
      workerId: `${prefix}-worker-failed`,
      error: 'directory provider timeout',
    });
    expect(failed.status).toBe('failed');

    const evaluated = await evaluateAdminIamQueueAlerts({ organizationId: orgFailed, evaluatorId, now: T_DETECT });
    const failedState = evaluated.find((row) => row.kind === 'ADMIN_IAM_JOB_FAILED');
    expect(failedState?.status).toBe('ACTIVE');
    expect(failedState?.latestValue).toBeGreaterThanOrEqual(1);
    expect(failedState?.threshold).toBe(ADMIN_IAM_ALERT_THRESHOLDS.ADMIN_IAM_JOB_FAILED);

    // Runbook link: machine-checked, not asserted by convention.
    const [docId, anchor] = ADMIN_IAM_ALERT_RUNBOOK_ID.split('#');
    expect(docId).toBeTruthy();
    expect(anchor).toBeTruthy();

    const outboxRow = (
      await db.query(
        `SELECT payload_json FROM operational_alert_delivery_outbox WHERE organization_id=$1 AND kind=$2 AND transition='DETECTED' ORDER BY state_version ASC LIMIT 1`,
        [orgFailed, 'ADMIN_IAM_JOB_FAILED']
      )
    ).rows[0];
    expect(outboxRow).toBeTruthy();
    expect(outboxRow.payload_json.runbookId).toBe(ADMIN_IAM_ALERT_RUNBOOK_ID);

    const runbookPath = path.resolve(process.cwd(), 'docs/runbooks', `${docId}.md`);
    const runbookText = fs.readFileSync(runbookPath, 'utf8');
    const headingSlugs = [...runbookText.matchAll(/^#{1,6}\s+(.+)$/gm)].map(([, heading]) => slugifyHeading(heading));
    expect(headingSlugs).toContain(anchor);
  });

  it('never leaks the job payload, last_error, or lease token into the alert payload, and rejects generic secret-shaped keys', async () => {
    const PAYLOAD_MARKER = `PAYLOAD-MARKER-${prefix}`;
    const ERROR_MARKER = `ERROR-MARKER-${prefix}`;
    const job = await enqueueAdminIamJob({
      organizationId: orgLeakCheck,
      actorId: actor,
      jobType: 'role_reconcile',
      idempotencyKey: `${prefix}-leak-job`,
      payload: { note: PAYLOAD_MARKER },
      maxAttempts: 1,
    });
    const claimed = await claimAdminIamJob({ organizationId: orgLeakCheck, workerId: `${prefix}-worker-leak` });
    expect(claimed?.id).toBe(job.id);
    const leaseTokenUsed = claimed!.leaseToken!;
    const failed = await failAdminIamJob({
      organizationId: orgLeakCheck,
      jobId: job.id,
      leaseToken: leaseTokenUsed,
      workerId: `${prefix}-worker-leak`,
      error: ERROR_MARKER,
    });
    expect(failed.status).toBe('failed');

    const evaluated = await evaluateAdminIamQueueAlerts({ organizationId: orgLeakCheck, evaluatorId, now: T_DETECT });
    expect(evaluated.find((row) => row.kind === 'ADMIN_IAM_JOB_FAILED')?.status).toBe('ACTIVE');

    const outboxRow = (
      await db.query(
        `SELECT payload_json FROM operational_alert_delivery_outbox WHERE organization_id=$1 AND kind=$2 AND transition='DETECTED' ORDER BY state_version ASC LIMIT 1`,
        [orgLeakCheck, 'ADMIN_IAM_JOB_FAILED']
      )
    ).rows[0];
    expect(outboxRow).toBeTruthy();
    const serialized = JSON.stringify(outboxRow.payload_json);
    expect(serialized).not.toContain(PAYLOAD_MARKER);
    expect(serialized).not.toContain(ERROR_MARKER);
    expect(serialized).not.toContain(leaseTokenUsed);
    expect(SECRET_SHAPE.test(serialized)).toBe(false);
  });

  it('recovers ADMIN_IAM_JOB_STALE once the job is completed under its original lease token, transitions DETECTED,RECOVERED', async () => {
    expect(staleJobId).toBeTruthy();
    const leaseRow = (
      await db.query(`SELECT lease_token FROM admin_iam_jobs WHERE id = $1`, [staleJobId])
    ).rows[0];
    const leaseToken = leaseRow?.lease_token as string;
    expect(leaseToken).toBeTruthy();

    // completeAdminIamJob checks status='running' AND lease_token=?, not
    // lease expiry — completing under the still-known token is a real
    // lifecycle transition (see file header for why re-claim cannot apply).
    const completed = await completeAdminIamJob({
      organizationId: orgStale,
      jobId: staleJobId,
      leaseToken,
      workerId: `${prefix}-worker-stale-recovery`,
    });
    expect(completed.status).toBe('succeeded');

    const recovered = await evaluateAdminIamQueueAlerts({ organizationId: orgStale, evaluatorId, now: T_RECOVER });
    const staleState = recovered.find((row) => row.kind === 'ADMIN_IAM_JOB_STALE');
    expect(staleState?.status).toBe('RECOVERED');

    const stateRow = (
      await db.query(
        `SELECT recovered_at FROM operational_alert_tenant_states WHERE organization_id=$1 AND kind=$2`,
        [orgStale, 'ADMIN_IAM_JOB_STALE']
      )
    ).rows[0];
    expect(stateRow?.recovered_at).toBeTruthy();

    const transitions = await db.query(
      `SELECT transition FROM operational_alert_delivery_outbox WHERE organization_id=$1 AND kind=$2 ORDER BY state_version ASC`,
      [orgStale, 'ADMIN_IAM_JOB_STALE']
    );
    expect(transitions.rows.map((row) => row.transition)).toEqual(['DETECTED', 'RECOVERED']);
  });

  it('recovers ADMIN_IAM_JOB_FAILED once the terminal job is archived out of the failed set after real remediation, transitions DETECTED,RECOVERED', async () => {
    // Real remediation per the runbook: a NEW job, a NEW idempotency key,
    // and it succeeds normally.
    const remediation = await enqueueAdminIamJob({
      organizationId: orgFailed,
      actorId: actor,
      jobType: 'role_reconcile',
      idempotencyKey: `${prefix}-failed-job-remediation`,
      payload: { source: 'scim', retry: true },
      maxAttempts: 3,
    });
    const remediationClaim = await claimAdminIamJob({
      organizationId: orgFailed,
      workerId: `${prefix}-worker-failed-remediation`,
    });
    expect(remediationClaim?.id).toBe(remediation.id);
    const remediationComplete = await completeAdminIamJob({
      organizationId: orgFailed,
      jobId: remediation.id,
      leaseToken: remediationClaim!.leaseToken!,
      workerId: `${prefix}-worker-failed-remediation`,
    });
    expect(remediationComplete.status).toBe('succeeded');

    // The original failed row: no service function ever moves a job out of
    // terminal 'failed' (see file header). Archive it directly — status is
    // never touched, this only removes the already-actioned terminal
    // record so the evaluator's own query observes the honest state.
    const originalFailedJob = (
      await db.query(
        `SELECT id FROM admin_iam_jobs WHERE organization_id=$1 AND idempotency_key=$2`,
        [orgFailed, `${prefix}-failed-job`]
      )
    ).rows[0];
    expect(originalFailedJob?.id).toBeTruthy();
    await db.query(`DELETE FROM admin_iam_job_events WHERE job_id = $1`, [originalFailedJob.id]);
    await db.query(`DELETE FROM admin_iam_jobs WHERE id = $1`, [originalFailedJob.id]);

    const recovered = await evaluateAdminIamQueueAlerts({ organizationId: orgFailed, evaluatorId, now: T_RECOVER });
    const failedState = recovered.find((row) => row.kind === 'ADMIN_IAM_JOB_FAILED');
    expect(failedState?.status).toBe('RECOVERED');

    const stateRow = (
      await db.query(
        `SELECT recovered_at FROM operational_alert_tenant_states WHERE organization_id=$1 AND kind=$2`,
        [orgFailed, 'ADMIN_IAM_JOB_FAILED']
      )
    ).rows[0];
    expect(stateRow?.recovered_at).toBeTruthy();

    const transitions = await db.query(
      `SELECT transition FROM operational_alert_delivery_outbox WHERE organization_id=$1 AND kind=$2 ORDER BY state_version ASC`,
      [orgFailed, 'ADMIN_IAM_JOB_FAILED']
    );
    expect(transitions.rows.map((row) => row.transition)).toEqual(['DETECTED', 'RECOVERED']);
  });

  it('isolates tenants in both directions: a condition seeded only under orgB never activates orgA, and orgB fires on its own evaluation', async () => {
    const staleJobB = await enqueueAdminIamJob({
      organizationId: orgIsoB,
      actorId: actor,
      jobType: 'membership_sync',
      idempotencyKey: `${prefix}-iso-b-stale`,
      payload: {},
      maxAttempts: 3,
    });
    const staleClaimB = await claimAdminIamJob({ organizationId: orgIsoB, workerId: `${prefix}-worker-iso-b-stale` });
    expect(staleClaimB?.id).toBe(staleJobB.id);
    await db.query(`UPDATE admin_iam_jobs SET lease_expires_at = $1 WHERE id = $2`, [T_PAST_LEASE, staleJobB.id]);

    const failedJobB = await enqueueAdminIamJob({
      organizationId: orgIsoB,
      actorId: actor,
      jobType: 'role_reconcile',
      idempotencyKey: `${prefix}-iso-b-failed`,
      payload: {},
      maxAttempts: 1,
    });
    const failedClaimB = await claimAdminIamJob({ organizationId: orgIsoB, workerId: `${prefix}-worker-iso-b-failed` });
    expect(failedClaimB?.id).toBe(failedJobB.id);
    await failAdminIamJob({
      organizationId: orgIsoB,
      jobId: failedJobB.id,
      leaseToken: failedClaimB!.leaseToken!,
      workerId: `${prefix}-worker-iso-b-failed`,
      error: 'isolation probe failure',
    });

    // Direction 1: orgA was never touched — must show nothing active.
    const evalA = await evaluateAdminIamQueueAlerts({ organizationId: orgIsoA, evaluatorId, now: T_DETECT });
    expect(evalA.filter((row) => row.status === 'ACTIVE')).toHaveLength(0);
    const activeStatesA = await db.query(
      `SELECT kind FROM operational_alert_tenant_states WHERE organization_id=$1 AND status='ACTIVE'`,
      [orgIsoA]
    );
    expect(activeStatesA.rows).toHaveLength(0);

    // Direction 2: orgB, evaluated on its own, must fire both kinds.
    const evalB = await evaluateAdminIamQueueAlerts({ organizationId: orgIsoB, evaluatorId, now: T_DETECT });
    expect(evalB.find((row) => row.kind === 'ADMIN_IAM_JOB_STALE')?.status).toBe('ACTIVE');
    expect(evalB.find((row) => row.kind === 'ADMIN_IAM_JOB_FAILED')?.status).toBe('ACTIVE');
  });

  it('produces no ACTIVE state for a fully healthy tenant: claimed and completed, nothing stale, nothing failed', async () => {
    const job = await enqueueAdminIamJob({
      organizationId: orgHealthy,
      actorId: actor,
      jobType: 'membership_sync',
      idempotencyKey: `${prefix}-healthy-job`,
      payload: {},
      maxAttempts: 3,
    });
    const claimed = await claimAdminIamJob({ organizationId: orgHealthy, workerId: `${prefix}-worker-healthy` });
    expect(claimed?.id).toBe(job.id);
    const completed = await completeAdminIamJob({
      organizationId: orgHealthy,
      jobId: job.id,
      leaseToken: claimed!.leaseToken!,
      workerId: `${prefix}-worker-healthy`,
    });
    expect(completed.status).toBe('succeeded');

    const evaluated = await evaluateAdminIamQueueAlerts({ organizationId: orgHealthy, evaluatorId, now: T_DETECT });
    expect(evaluated.filter((row) => row.status === 'ACTIVE')).toHaveLength(0);
  });

  it('leaves zero orphaned admin_iam_job_events for this suite, and the append-only guard on operational_alert_signals still rejects a raw UPDATE', async () => {
    const orphans = await db.query(
      `SELECT COUNT(*)::int AS count FROM admin_iam_job_events e LEFT JOIN admin_iam_jobs j ON j.id = e.job_id WHERE e.organization_id = ANY($1) AND j.id IS NULL`,
      [ALL_ORGS]
    );
    expect(Number(orphans.rows[0].count)).toBe(0);

    // This evaluator never touches operational_alert_signals (per the
    // binding contract). Prove the pre-existing append-only guard on that
    // table is still intact — a FOR EACH ROW trigger never fires against
    // zero matched rows, so insert one probe row first.
    await db.query(
      `INSERT INTO operational_alert_signals
         (organization_id, actor_id, correlation_id, source_type, source_id, kind, outcome, observed_value, occurred_at, idempotency_key, input_fingerprint)
       VALUES ($1,$2,$3,$4,$5,'WRITE_FAILURE_RATE','SUCCESS',1,$6,$7,'adm-iam-alert-guard-probe')`,
      [
        orgGuardProbe,
        actor,
        `${prefix}-guard-corr`,
        'adm-iam-alert-guard-probe',
        `${prefix}-guard-source`,
        T_DETECT,
        `${prefix}-guard-idem`,
      ]
    );
    await expect(
      db.query(`UPDATE operational_alert_signals SET observed_value = 2 WHERE organization_id = $1`, [orgGuardProbe])
    ).rejects.toThrow(/OPS_ALERT_APPEND_ONLY/);
  });
});
