/**
 * Case Workspace — canonical NodeRun aggregate, proved against a REAL
 * PostgreSQL. Exercises server/src/services/caseWorkspace/nodeRunService.ts
 * against server/migrations/20260810_case_workspace_node_run_and_inbox.sql
 * (doc 04 §3.4/§4.5, doc 06 §8).
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * `NODE_ENV=test` ALONE is a trap: Database.ts hands back an in-memory MOCK
 * whenever `RUN_DB_TESTS !== '1'` (or `MOCK_DB` isn't explicitly `'false'`),
 * and every write silently becomes a no-op — the suite would pass while
 * touching nothing. Same gate as every other `*.pg.test.ts` here: require
 * RUN_DB_TESTS=1 && MOCK_DB=false, probe reachability AND that the migrated
 * schema is present, and SKIP LOUDLY when either is missing.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/nodeRunService.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * WHAT THESE TESTS TRY TO DISPROVE
 * ===========================================================================
 * 1. That the attempt ledger is real — a full PENDING -> ... -> retry ->
 *    SUCCEEDED path must leave TWO attempt rows with distinct attempt_ids and
 *    honest per-attempt outcomes, not one row rewritten twice.
 * 2. That OCC actually guards — a write with a stale `version` must change
 *    NOTHING, verified by reading the row back out of band.
 * 3. That the lease is not decorative — a zombie worker holding a superseded
 *    fencing token must be refused.
 * 4. That expired-lease recovery obeys doc 06 §8 — the reconciliation callback
 *    must be CONSULTED before takeover, an `alreadyApplied` verdict must NOT
 *    produce a retry, and two workers racing must produce exactly one winner.
 * 5. That the timeout sweeper closes the attempt AND flags compensation when it
 *    ends the node terminally (we cannot know whether the effect landed).
 *
 * Every assertion reads rows back through a dedicated out-of-band `pg.Pool`
 * (`control`) — never the service's return value alone, which only proves what
 * the service THINKS it wrote.
 *
 * ISOLATION: each test seeds its own organization/project/case/plan-version/
 * v8 run/binding inside the test body and tears it down in a `finally`.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import * as casePlanVersionService from '../casePlanVersionService.js';
import type { CanonicalGraph } from '../casePlanVersionService.js';
import * as nodeRunService from '../nodeRunService.js';
import * as runBindingService from '../runBindingService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const nodeRuns = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_node_runs'
          AND column_name IN ('node_run_id', 'run_id', 'status', 'attempt', 'max_attempts',
                              'current_attempt_id', 'lease_owner', 'lease_fencing_token',
                              'lease_expires_at', 'heartbeat_at', 'timeout_at',
                              'retry_not_before', 'compensation_state', 'version')`
    );
    const attempts = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_node_run_attempts'
          AND column_name IN ('attempt_id', 'node_run_id', 'attempt_number', 'status',
                              'lease_owner', 'timeout_at', 'ended_at', 'error_code')`
    );
    return (
      Number(nodeRuns.rows[0]?.present ?? 0) === 14 && Number(attempts.rows[0]?.present ?? 0) === 8
    );
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[nodeRunService pg suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260810_case_workspace_node_run_and_inbox.sql migration applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface NodeRunDbRow {
  node_run_id: string;
  status: string;
  attempt: number;
  max_attempts: number;
  current_attempt_id: string | null;
  lease_owner: string | null;
  lease_fencing_token: number;
  lease_expires_at: string | null;
  heartbeat_at: string | null;
  timeout_at: string | null;
  retry_not_before: string | null;
  output_snapshot_ref: string | null;
  error_code: string | null;
  error_detail_ref: string | null;
  compensation_state: string;
  version: number;
  completed_at: string | null;
}

interface AttemptDbRow {
  attempt_id: string;
  node_run_id: string;
  attempt_number: number;
  status: string;
  lease_owner: string | null;
  ended_at: string | null;
  error_code: string | null;
  error_detail_ref: string | null;
}

suite('nodeRunService — canonical NodeRun against a real PostgreSQL (doc 04 §3.4/§4.5, doc 06 §8)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Fixtures — each test calls these itself, never a shared hook.
  // -------------------------------------------------------------------------

  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = `case-node-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
      [`case-node-member-${randomUUID()}`, orgId, userId]
    );
    return userId;
  }

  /**
   * A NodeRun needs a real `case_workspace_run_bindings` row (FK), which needs
   * a PUBLISHED plan version and a `v8_execution_runs` row. This bundle is the
   * lightest legitimate path — every step goes through the owning production
   * service, except the v8_execution_runs INSERT, which is a TEST-FIXTURE-ONLY
   * direct write (no caseWorkspace service ever writes that table), exactly as
   * runBindingService.pg.test.ts already does.
   */
  async function seedBoundRun(label: string): Promise<{
    orgId: string;
    projectId: string;
    caseId: string;
    runId: string;
    actorId: string;
  }> {
    const suffix = randomUUID();
    const orgId = `case-node-org-${label}-${suffix}`;
    const projectId = `case-node-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `NodeRun test org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `NodeRun test project (${label})`]
    );
    const actorId = await seedMemberedUser(orgId, label);
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: actorId,
    });

    const graph: CanonicalGraph = {
      schemaVersion: '1',
      graphId: `graph-${label}-${suffix}`,
      entryNodeIds: ['n1'],
      terminalNodeIds: ['n2'],
      nodes: [
        { nodeId: 'n1', type: 'TASK', metadata: { tag: label } },
        { nodeId: 'n2', type: 'TASK' },
      ],
      edges: [{ edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', edgeType: 'SEQUENCE' }],
    };
    const draft = await casePlanVersionService.createPlanDraft({
      caseId: created.caseId,
      semanticGraph: graph,
      createdByActorId: actorId,
    });
    const proposed = await casePlanVersionService.proposePlanVersion(
      draft.casePlanVersionId,
      { actorUserId: actorId },
      draft.version
    );
    const published = await casePlanVersionService.publishPlanVersion(
      draft.casePlanVersionId,
      { actorUserId: actorId },
      proposed.version
    );

    const runId = `run-node-${label}-${suffix}`;
    await control.query(
      `INSERT INTO v8_execution_runs (run_id, organization_id, context_snapshot_id, initiator_user_id, goal)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (run_id) DO NOTHING`,
      [runId, orgId, `ctx-${runId}`, actorId, `goal ${label}`]
    );
    await runBindingService.bindRunToPlanVersion({
      runId,
      casePlanVersionId: published.casePlanVersionId,
      boundByActorId: actorId,
    });

    return { orgId, projectId, caseId: created.caseId, runId, actorId };
  }

  async function teardown(params: {
    orgId: string;
    projectId: string;
    runId: string;
    userIds?: string[];
  }): Promise<void> {
    await control
      .query(
        `DELETE FROM case_workspace_node_run_attempts
          WHERE node_run_id IN (SELECT node_run_id FROM case_workspace_node_runs WHERE run_id = $1)`,
        [params.runId]
      )
      .catch(() => undefined);
    await control
      .query(`DELETE FROM case_workspace_node_runs WHERE run_id = $1`, [params.runId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM case_workspace_run_bindings WHERE run_id = $1`, [params.runId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM v8_execution_runs WHERE run_id = $1`, [params.runId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM case_core WHERE project_id = $1`, [params.projectId])
      .catch(() => undefined);
    await control.query(`DELETE FROM projects WHERE id = $1`, [params.projectId]).catch(() => undefined);
    await control
      .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [params.orgId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM organization_members WHERE organization_id = $1`, [params.orgId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM users WHERE organization_id = $1`, [params.orgId])
      .catch(() => undefined);
    await control.query(`DELETE FROM organizations WHERE id = $1`, [params.orgId]).catch(() => undefined);
  }

  async function readNodeRun(nodeRunId: string): Promise<NodeRunDbRow | null> {
    const result = await control.query<NodeRunDbRow>(
      `SELECT * FROM case_workspace_node_runs WHERE node_run_id = $1`,
      [nodeRunId]
    );
    return result.rows[0] ?? null;
  }

  async function readAttempts(nodeRunId: string): Promise<AttemptDbRow[]> {
    const result = await control.query<AttemptDbRow>(
      `SELECT * FROM case_workspace_node_run_attempts WHERE node_run_id = $1
        ORDER BY attempt_number ASC`,
      [nodeRunId]
    );
    return result.rows;
  }

  /** Forces a lease/deadline into the past, out of band — the only honest way
   *  to observe expiry behaviour without sleeping through a real lease. */
  async function expireLease(nodeRunId: string): Promise<void> {
    await control.query(
      `UPDATE case_workspace_node_runs
          SET lease_expires_at = (NOW() - interval '1 minute')::text
        WHERE node_run_id = $1`,
      [nodeRunId]
    );
  }

  // =========================================================================
  // 1. Full attempt path: retry after a retryable failure, then success.
  // =========================================================================
  it('records a full attempt path with retry: attempt 1 fails retryable -> RETRY_SCHEDULED -> attempt 2 succeeds, leaving TWO distinct attempt rows', async () => {
    const fixture = await seedBoundRun('retry-path');
    try {
      const created = await nodeRunService.createNodeRun(
        {
          caseId: fixture.caseId,
          runId: fixture.runId,
          nodeId: 'n1',
          nodeVersionRef: 'v1',
          idempotencyKey: `idem-${randomUUID()}`,
          maxAttempts: 2,
          initialStatus: 'READY',
        },
        fixture.actorId
      );
      expect(created.status).toBe('READY');
      expect(created.attempt).toBe(0);

      // --- attempt 1 -------------------------------------------------------
      const claim1 = await nodeRunService.claimNodeRun(created.nodeRunId, { leaseMs: 60_000 });
      expect(claim1.outcome).toBe('claimed');
      if (claim1.outcome !== 'claimed') throw new Error('unreachable');

      const started1 = await nodeRunService.startNodeRunAttempt(
        created.nodeRunId,
        { leaseOwner: claim1.leaseOwner, fencingToken: claim1.fencingToken, timeoutMs: 60_000 },
        claim1.nodeRun.version
      );
      expect(started1.attempt.attemptNumber).toBe(1);
      expect(started1.nodeRun.status).toBe('RUNNING');

      const failed = await nodeRunService.completeNodeRunAttempt(
        created.nodeRunId,
        {
          attemptId: started1.attempt.attemptId,
          leaseOwner: claim1.leaseOwner,
          fencingToken: claim1.fencingToken,
          outcome: 'FAILED_RETRYABLE',
          errorCode: 'CAPABILITY_RATE_LIMITED',
          // Deliberately a raw provider-ish message: it must NOT survive verbatim.
          errorDetailRef: 'vendor said: token abc123 rejected for client Acme',
          retryDelayMs: 1,
        },
        started1.nodeRun.version
      );
      // Budget remains, so a retryable failure schedules a retry rather than
      // ending the node.
      expect(failed.nodeRun.status).toBe('RETRY_SCHEDULED');
      expect(failed.attempt.status).toBe('FAILED_RETRYABLE');

      const afterFail = await readNodeRun(created.nodeRunId);
      expect(afterFail?.status).toBe('RETRY_SCHEDULED');
      expect(afterFail?.attempt).toBe(1);
      expect(afterFail?.lease_owner).toBeNull();
      expect(afterFail?.retry_not_before).not.toBeNull();
      // The raw provider text must be gone — only a digest may be durable.
      expect(afterFail?.error_detail_ref).toMatch(/^sha256:[0-9a-f]{32}$/);
      expect(afterFail?.error_detail_ref).not.toContain('abc123');
      expect(afterFail?.error_detail_ref).not.toContain('Acme');

      // --- attempt 2 -------------------------------------------------------
      await new Promise((resolve) => setTimeout(resolve, 30)); // let the 1ms backoff elapse
      const claim2 = await nodeRunService.claimNodeRun(created.nodeRunId, { leaseMs: 60_000 });
      expect(claim2.outcome).toBe('claimed');
      if (claim2.outcome !== 'claimed') throw new Error('unreachable');
      // A new claim must bump the fencing token — this is what fences attempt 1's worker.
      expect(claim2.fencingToken).toBeGreaterThan(claim1.fencingToken);

      const started2 = await nodeRunService.startNodeRunAttempt(
        created.nodeRunId,
        { leaseOwner: claim2.leaseOwner, fencingToken: claim2.fencingToken, timeoutMs: 60_000 },
        claim2.nodeRun.version
      );
      expect(started2.attempt.attemptNumber).toBe(2);
      expect(started2.attempt.attemptId).not.toBe(started1.attempt.attemptId);

      const succeeded = await nodeRunService.completeNodeRunAttempt(
        created.nodeRunId,
        {
          attemptId: started2.attempt.attemptId,
          leaseOwner: claim2.leaseOwner,
          fencingToken: claim2.fencingToken,
          outcome: 'SUCCEEDED',
          outputSnapshotRef: 'artifact:node-output-1',
        },
        started2.nodeRun.version
      );
      expect(succeeded.nodeRun.status).toBe('SUCCEEDED');

      const finalRow = await readNodeRun(created.nodeRunId);
      expect(finalRow?.status).toBe('SUCCEEDED');
      expect(finalRow?.completed_at).not.toBeNull();
      expect(finalRow?.lease_owner).toBeNull();
      expect(finalRow?.timeout_at).toBeNull();
      expect(finalRow?.output_snapshot_ref).toBe('artifact:node-output-1');

      // §3.4 "A retry creates an auditable attempt" — two rows, not one rewritten.
      const attempts = await readAttempts(created.nodeRunId);
      expect(attempts).toHaveLength(2);
      expect(attempts[0].attempt_number).toBe(1);
      expect(attempts[0].status).toBe('FAILED_RETRYABLE');
      expect(attempts[0].ended_at).not.toBeNull();
      expect(attempts[1].attempt_number).toBe(2);
      expect(attempts[1].status).toBe('SUCCEEDED');
      expect(attempts[0].attempt_id).not.toBe(attempts[1].attempt_id);
      // Distinct workers held them.
      expect(attempts[0].lease_owner).not.toBe(attempts[1].lease_owner);
    } finally {
      await teardown(fixture);
    }
  }, 90_000);

  // =========================================================================
  // 2. Retry budget exhaustion: a retryable failure with no budget left is
  //    TERMINAL, not a node parked forever in RETRY_SCHEDULED.
  // =========================================================================
  it('promotes a retryable failure to FAILED_TERMINAL once the retry budget is exhausted', async () => {
    const fixture = await seedBoundRun('budget');
    try {
      const created = await nodeRunService.createNodeRun(
        {
          caseId: fixture.caseId,
          runId: fixture.runId,
          nodeId: 'n1',
          nodeVersionRef: 'v1',
          idempotencyKey: `idem-${randomUUID()}`,
          maxAttempts: 1,
          initialStatus: 'READY',
        },
        fixture.actorId
      );

      const claim = await nodeRunService.claimNodeRun(created.nodeRunId, { leaseMs: 60_000 });
      if (claim.outcome !== 'claimed') throw new Error('claim failed');
      const started = await nodeRunService.startNodeRunAttempt(
        created.nodeRunId,
        { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken },
        claim.nodeRun.version
      );
      const done = await nodeRunService.completeNodeRunAttempt(
        created.nodeRunId,
        {
          attemptId: started.attempt.attemptId,
          leaseOwner: claim.leaseOwner,
          fencingToken: claim.fencingToken,
          outcome: 'FAILED_RETRYABLE',
          errorCode: 'CAPABILITY_TRANSPORT_ERROR',
        },
        started.nodeRun.version
      );
      expect(done.nodeRun.status).toBe('FAILED_TERMINAL');
      // The ATTEMPT keeps its own honest outcome — only the NODE is terminal.
      expect(done.attempt.status).toBe('FAILED_RETRYABLE');

      const row = await readNodeRun(created.nodeRunId);
      expect(row?.status).toBe('FAILED_TERMINAL');
      expect(row?.completed_at).not.toBeNull();

      // A third attempt must be impossible.
      await expect(
        nodeRunService.startNodeRunAttempt(
          created.nodeRunId,
          { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken },
          done.nodeRun.version
        )
      ).rejects.toThrow(/node_run_status_transition_not_allowed/);
    } finally {
      await teardown(fixture);
    }
  }, 90_000);

  // =========================================================================
  // 3. OCC — a stale expectedVersion writes NOTHING.
  // =========================================================================
  it('rejects a write carrying a stale version and leaves the row byte-identical', async () => {
    const fixture = await seedBoundRun('occ');
    try {
      const created = await nodeRunService.createNodeRun(
        {
          caseId: fixture.caseId,
          runId: fixture.runId,
          nodeId: 'n1',
          nodeVersionRef: 'v1',
          idempotencyKey: `idem-${randomUUID()}`,
          initialStatus: 'PENDING',
        },
        fixture.actorId
      );
      const staleVersion = created.version;

      const moved = await nodeRunService.transitionNodeRun(created.nodeRunId, 'READY', staleVersion);
      expect(moved.version).toBe(staleVersion + 1);

      const before = await readNodeRun(created.nodeRunId);

      // Same call, same (now stale) version.
      await expect(
        nodeRunService.transitionNodeRun(created.nodeRunId, 'SKIPPED', staleVersion)
      ).rejects.toThrow('node_run_version_conflict');

      const after = await readNodeRun(created.nodeRunId);
      // Not merely "still READY" — nothing at all moved.
      expect(after).toEqual(before);
      expect(after?.status).toBe('READY');
      expect(after?.version).toBe(staleVersion + 1);
    } finally {
      await teardown(fixture);
    }
  }, 90_000);

  // =========================================================================
  // 4. The lease fences a zombie worker.
  // =========================================================================
  it('refuses an attempt start and an attempt completion from a worker whose lease was superseded', async () => {
    const fixture = await seedBoundRun('fencing');
    try {
      const created = await nodeRunService.createNodeRun(
        {
          caseId: fixture.caseId,
          runId: fixture.runId,
          nodeId: 'n1',
          nodeVersionRef: 'v1',
          idempotencyKey: `idem-${randomUUID()}`,
          maxAttempts: 3,
          initialStatus: 'READY',
        },
        fixture.actorId
      );

      const zombieClaim = await nodeRunService.claimNodeRun(created.nodeRunId, { leaseMs: 60_000 });
      if (zombieClaim.outcome !== 'claimed') throw new Error('claim failed');

      // The lease lapses and a second worker reclaims it (reconciliation says
      // nothing landed, so a real takeover happens).
      await expireLease(created.nodeRunId);
      const reclaim = await nodeRunService.reclaimExpiredNodeRunLease(
        created.nodeRunId,
        () => ({ alreadyApplied: false }),
        { leaseMs: 60_000 }
      );
      expect(reclaim.outcome).toBe('reclaimed');
      if (reclaim.outcome !== 'reclaimed') throw new Error('unreachable');
      expect(reclaim.fencingToken).toBeGreaterThan(zombieClaim.fencingToken);

      const rowAfterReclaim = await readNodeRun(created.nodeRunId);

      // The zombie wakes up and tries to work. It must be refused.
      await expect(
        nodeRunService.startNodeRunAttempt(
          created.nodeRunId,
          { leaseOwner: zombieClaim.leaseOwner, fencingToken: zombieClaim.fencingToken },
          reclaim.nodeRun.version
        )
      ).rejects.toThrow('node_run_lease_fenced');

      // And nothing changed as a result of the refusal.
      expect(await readNodeRun(created.nodeRunId)).toEqual(rowAfterReclaim);

      // A heartbeat from the zombie must report loss of ownership, not renew.
      const heartbeat = await nodeRunService.heartbeatNodeRunLease(
        created.nodeRunId,
        zombieClaim.leaseOwner,
        zombieClaim.fencingToken
      );
      expect(heartbeat).toBe('fenced');

      // The legitimate holder can work.
      const started = await nodeRunService.startNodeRunAttempt(
        created.nodeRunId,
        { leaseOwner: reclaim.leaseOwner, fencingToken: reclaim.fencingToken },
        reclaim.nodeRun.version
      );
      expect(started.nodeRun.status).toBe('RUNNING');

      // A completion from the zombie, even naming the real attempt, is refused.
      await expect(
        nodeRunService.completeNodeRunAttempt(
          created.nodeRunId,
          {
            attemptId: started.attempt.attemptId,
            leaseOwner: zombieClaim.leaseOwner,
            fencingToken: zombieClaim.fencingToken,
            outcome: 'SUCCEEDED',
          },
          started.nodeRun.version
        )
      ).rejects.toThrow('node_run_lease_fenced');
    } finally {
      await teardown(fixture);
    }
  }, 90_000);

  // =========================================================================
  // 5. doc 06 §8 — an expired lease is reclaimed ONLY after the idempotency /
  //    reconciliation check, and `alreadyApplied` must NOT produce a retry.
  // =========================================================================
  it('consults the reconciliation check before reclaiming an expired lease, and closes the node from the readback instead of retrying when the effect already landed', async () => {
    const fixture = await seedBoundRun('reconcile');
    try {
      const created = await nodeRunService.createNodeRun(
        {
          caseId: fixture.caseId,
          runId: fixture.runId,
          nodeId: 'n1',
          nodeVersionRef: 'v1',
          idempotencyKey: `idem-${randomUUID()}`,
          maxAttempts: 3,
          initialStatus: 'READY',
        },
        fixture.actorId
      );

      const claim = await nodeRunService.claimNodeRun(created.nodeRunId, { leaseMs: 60_000 });
      if (claim.outcome !== 'claimed') throw new Error('claim failed');
      const started = await nodeRunService.startNodeRunAttempt(
        created.nodeRunId,
        { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken },
        claim.nodeRun.version
      );

      // The worker dies mid-attempt; its lease lapses.
      await expireLease(created.nodeRunId);

      // A) The check is genuinely CONSULTED — not optional, not skipped.
      let consulted = 0;
      const outcome = await nodeRunService.reclaimExpiredNodeRunLease(
        created.nodeRunId,
        () => {
          consulted += 1;
          // The readback proves the external effect DID land.
          return { alreadyApplied: true, outputSnapshotRef: 'artifact:readback-1' };
        }
      );
      expect(consulted).toBe(1);

      // B) `alreadyApplied` must NOT hand the work to a new worker.
      expect(outcome.outcome).toBe('already_applied');

      const row = await readNodeRun(created.nodeRunId);
      expect(row?.status).toBe('SUCCEEDED');
      expect(row?.output_snapshot_ref).toBe('artifact:readback-1');
      // No new lease was granted — that is what "not retried" means concretely.
      expect(row?.lease_owner).toBeNull();
      // Still ONE attempt: no second execution was created.
      expect(row?.attempt).toBe(1);

      const attempts = await readAttempts(created.nodeRunId);
      expect(attempts).toHaveLength(1);
      expect(attempts[0].attempt_id).toBe(started.attempt.attemptId);
      // The orphaned attempt is closed rather than left RUNNING forever.
      expect(attempts[0].status).toBe('SUCCEEDED');
      expect(attempts[0].ended_at).not.toBeNull();

      // A reconciliation callback is mandatory — omitting it is a hard error,
      // not a permissive default.
      await expect(
        // @ts-expect-error deliberately calling without the mandatory check
        nodeRunService.reclaimExpiredNodeRunLease(created.nodeRunId)
      ).rejects.toThrow('node_run_reconciliation_required');
    } finally {
      await teardown(fixture);
    }
  }, 90_000);

  // =========================================================================
  // 6. Two workers race to reclaim ONE expired lease — exactly one wins.
  // =========================================================================
  it('lets exactly one of two concurrent workers reclaim an expired lease', async () => {
    const fixture = await seedBoundRun('race');
    try {
      const created = await nodeRunService.createNodeRun(
        {
          caseId: fixture.caseId,
          runId: fixture.runId,
          nodeId: 'n1',
          nodeVersionRef: 'v1',
          idempotencyKey: `idem-${randomUUID()}`,
          maxAttempts: 5,
          initialStatus: 'READY',
        },
        fixture.actorId
      );
      const claim = await nodeRunService.claimNodeRun(created.nodeRunId, { leaseMs: 60_000 });
      if (claim.outcome !== 'claimed') throw new Error('claim failed');
      await expireLease(created.nodeRunId);

      const results = await Promise.all([
        nodeRunService.reclaimExpiredNodeRunLease(
          created.nodeRunId,
          () => ({ alreadyApplied: false }),
          { leaseOwner: 'worker-A', leaseMs: 60_000 }
        ),
        nodeRunService.reclaimExpiredNodeRunLease(
          created.nodeRunId,
          () => ({ alreadyApplied: false }),
          { leaseOwner: 'worker-B', leaseMs: 60_000 }
        ),
      ]);

      const reclaimed = results.filter((r) => r.outcome === 'reclaimed');
      expect(reclaimed).toHaveLength(1);
      // The loser must NOT report success under a different name.
      const loser = results.find((r) => r.outcome !== 'reclaimed');
      expect(loser?.outcome).toBe('lease_active');

      const row = await readNodeRun(created.nodeRunId);
      expect(['worker-A', 'worker-B']).toContain(row?.lease_owner);
      // Exactly ONE fencing bump beyond the original claim.
      expect(row?.lease_fencing_token).toBe(claim.fencingToken + 1);
    } finally {
      await teardown(fixture);
    }
  }, 90_000);

  // =========================================================================
  // 7. Timeout: the sweeper closes the attempt, applies the budget rule, and
  //    flags compensation when the node ends terminally.
  // =========================================================================
  it('times out an overdue attempt, closes it as TIMED_OUT, and flags compensation REQUIRED when the node ends terminally', async () => {
    const fixture = await seedBoundRun('timeout');
    try {
      const created = await nodeRunService.createNodeRun(
        {
          caseId: fixture.caseId,
          runId: fixture.runId,
          nodeId: 'n1',
          nodeVersionRef: 'v1',
          idempotencyKey: `idem-${randomUUID()}`,
          maxAttempts: 1,
          initialStatus: 'READY',
        },
        fixture.actorId
      );
      const claim = await nodeRunService.claimNodeRun(created.nodeRunId, { leaseMs: 60_000 });
      if (claim.outcome !== 'claimed') throw new Error('claim failed');
      const started = await nodeRunService.startNodeRunAttempt(
        created.nodeRunId,
        { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken, timeoutMs: 60_000 },
        claim.nodeRun.version
      );

      // Not yet due — the sweeper must refuse to kill a healthy attempt.
      const premature = await nodeRunService.timeoutNodeRunAttempt(created.nodeRunId);
      expect((premature as { outcome?: string }).outcome).toBe('not_timed_out');

      // Force the deadline into the past, out of band.
      await control.query(
        `UPDATE case_workspace_node_runs SET timeout_at = (NOW() - interval '1 minute')::text
          WHERE node_run_id = $1`,
        [created.nodeRunId]
      );
      // The sweeper must appear in the candidate scan.
      const candidates = await nodeRunService.listTimedOutNodeRuns();
      expect(candidates.map((c) => c.nodeRunId)).toContain(created.nodeRunId);

      const timedOut = await nodeRunService.timeoutNodeRunAttempt(created.nodeRunId);
      expect((timedOut as { outcome?: string }).outcome).toBeUndefined();

      const row = await readNodeRun(created.nodeRunId);
      expect(row?.status).toBe('FAILED_TERMINAL');
      expect(row?.error_code).toBe('NODE_RUN_ATTEMPT_TIMEOUT');
      // A timeout means the external effect MAY have landed — §4.5 forbids
      // pretending otherwise, so compensation is flagged, not assumed away.
      expect(row?.compensation_state).toBe('REQUIRED');
      expect(row?.lease_owner).toBeNull();
      expect(row?.timeout_at).toBeNull();

      const attempts = await readAttempts(created.nodeRunId);
      expect(attempts).toHaveLength(1);
      expect(attempts[0].attempt_id).toBe(started.attempt.attemptId);
      // TIMED_OUT is a distinct fact from FAILED — the work may still be
      // running somewhere.
      expect(attempts[0].status).toBe('TIMED_OUT');
      expect(attempts[0].ended_at).not.toBeNull();
    } finally {
      await teardown(fixture);
    }
  }, 90_000);

  // =========================================================================
  // 8. Creation is idempotent on (run_id, idempotency_key) — doc 04 §3.4.
  // =========================================================================
  it('returns the SAME NodeRun for a replayed create and writes no second row or event', async () => {
    const fixture = await seedBoundRun('idem');
    try {
      const key = `idem-${randomUUID()}`;
      const first = await nodeRunService.createNodeRun(
        {
          caseId: fixture.caseId,
          runId: fixture.runId,
          nodeId: 'n1',
          nodeVersionRef: 'v1',
          idempotencyKey: key,
          initialStatus: 'READY',
        },
        fixture.actorId
      );
      const second = await nodeRunService.createNodeRun(
        {
          caseId: fixture.caseId,
          runId: fixture.runId,
          nodeId: 'n1',
          nodeVersionRef: 'v1',
          idempotencyKey: key,
          initialStatus: 'READY',
        },
        fixture.actorId
      );
      expect(second.nodeRunId).toBe(first.nodeRunId);

      const rows = await control.query(
        `SELECT count(*)::int AS n FROM case_workspace_node_runs WHERE run_id = $1`,
        [fixture.runId]
      );
      expect(Number(rows.rows[0].n)).toBe(1);

      // A replay is not a second creation, so it must not emit a second event.
      const events = await control.query(
        `SELECT count(*)::int AS n FROM case_workspace_event_outbox
          WHERE aggregate_id = $1 AND event_type = 'node.run_created'`,
        [first.nodeRunId]
      );
      expect(Number(events.rows[0].n)).toBe(1);
    } finally {
      await teardown(fixture);
    }
  }, 90_000);

  // =========================================================================
  // 9. The orphan report tells the truth about the loose node_run_id columns.
  // =========================================================================
  it('reports loose node_run_id references that have no canonical NodeRun, without repairing them', async () => {
    const fixture = await seedBoundRun('orphans');
    try {
      const report = await nodeRunService.listOrphanNodeRunReferences({
        organizationId: fixture.orgId,
      });
      // All four shipped tables are covered, and a fresh org has no orphans.
      expect(report.map((r) => r.tableName).sort()).toEqual([
        'case_workspace_action_proposals',
        'case_workspace_gateway_evaluations',
        'case_workspace_node_result_acceptances',
        'case_workspace_waits',
      ]);
      for (const entry of report) expect(entry.rowCount).toBe(0);
    } finally {
      await teardown(fixture);
    }
  }, 90_000);

  // =========================================================================
  // 10. getLatestNodeRunForNode — Stream A's runLifecycleService.retryNode/
  //     advanceRun primitive. A node with MULTIPLE NodeRun rows (a manual
  //     retry after FAILED_TERMINAL) must report the newest one, never the
  //     first, and a node that never ran must report null — not throw.
  // =========================================================================
  it('getLatestNodeRunForNode returns null for a node that never ran, and the NEWEST row once a node has several (retry) NodeRuns', async () => {
    const fixture = await seedBoundRun('latest-for-node');
    try {
      const neverRan = await nodeRunService.getLatestNodeRunForNode(fixture.runId, 'n1', fixture.actorId);
      expect(neverRan).toBeNull();

      const first = await nodeRunService.createNodeRun(
        {
          caseId: fixture.caseId,
          runId: fixture.runId,
          nodeId: 'n1',
          nodeVersionRef: 'v1',
          idempotencyKey: `idem-first-${randomUUID()}`,
          initialStatus: 'READY',
        },
        fixture.actorId
      );

      const latestAfterFirst = await nodeRunService.getLatestNodeRunForNode(
        fixture.runId,
        'n1',
        fixture.actorId
      );
      expect(latestAfterFirst?.nodeRunId).toBe(first.nodeRunId);

      // Drive the first NodeRun to FAILED_TERMINAL (budget of 1, one failed
      // attempt) so a second, manual-retry NodeRun for the SAME node is a
      // realistic fixture, not an artificial second row.
      const claim = await nodeRunService.claimNodeRun(first.nodeRunId, { leaseMs: 60_000 });
      expect(claim.outcome).toBe('claimed');
      if (claim.outcome !== 'claimed') throw new Error('unreachable');
      const started = await nodeRunService.startNodeRunAttempt(
        first.nodeRunId,
        { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken, timeoutMs: 60_000 },
        claim.nodeRun.version
      );
      const completed = await nodeRunService.completeNodeRunAttempt(
        first.nodeRunId,
        {
          attemptId: started.attempt.attemptId,
          leaseOwner: claim.leaseOwner,
          fencingToken: claim.fencingToken,
          outcome: 'FAILED_TERMINAL',
        },
        started.nodeRun.version
      );
      expect(completed.nodeRun.status).toBe('FAILED_TERMINAL');

      // A manual retry: a brand-new NodeRun row for the SAME node_id, minted
      // with a fresh idempotency key (this directory's own precedent for a
      // human-authorized retry, distinct from the automatic retry budget).
      const second = await nodeRunService.createNodeRun(
        {
          caseId: fixture.caseId,
          runId: fixture.runId,
          nodeId: 'n1',
          nodeVersionRef: 'v1',
          idempotencyKey: `idem-retry-${randomUUID()}`,
          initialStatus: 'READY',
        },
        fixture.actorId
      );
      expect(second.nodeRunId).not.toBe(first.nodeRunId);

      const latestAfterRetry = await nodeRunService.getLatestNodeRunForNode(
        fixture.runId,
        'n1',
        fixture.actorId
      );
      expect(latestAfterRetry?.nodeRunId).toBe(second.nodeRunId);
      expect(latestAfterRetry?.status).toBe('READY');

      // A different node_id in the same Run must not leak into the result.
      const otherNode = await nodeRunService.getLatestNodeRunForNode(fixture.runId, 'n2', fixture.actorId);
      expect(otherNode).toBeNull();
    } finally {
      await teardown(fixture);
    }
  }, 90_000);
});
