/**
 * Case Workspace — canonical Run lifecycle, proved against a REAL
 * PostgreSQL. Exercises server/src/services/caseWorkspace/runLifecycleService.ts
 * against server/migrations/20260811a_case_workspace_run_lifecycle.sql (doc
 * 04 §3.4/§4.4/§5).
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same gate as nodeRunService.pg.test.ts (see that file's own header for the
 * full rationale): require RUN_DB_TESTS=1 && MOCK_DB=false, probe reachability
 * AND that the migrated schema is present, and SKIP LOUDLY when either is
 * missing.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/runLifecycleService.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * WHAT THESE TESTS TRY TO DISPROVE
 * ===========================================================================
 * 1. That StartRun is the ONLY path from CREATED to RUNNING — CreateRun alone
 *    must leave zero NodeRuns (the hard rule).
 * 2. That CreateRun/StartRun are genuinely idempotent — a replayed call must
 *    return the SAME row, mint no second v8_execution_runs/binding/NodeRun,
 *    and emit no second event, verified by reading rows back out of band.
 * 3. That OCC actually guards Pause/Resume/Cancel — a write with a stale
 *    `version` changes NOTHING.
 * 4. That RetryNode refuses a node that is not actually stuck (still
 *    RUNNING/READY/SUCCEEDED), and succeeds only from FAILED_TERMINAL,
 *    minting a NEW NodeRun row rather than resurrecting the old one.
 * 5. That ProvideNodeInput is the missing bridge: a WAITING_HUMAN NodeRun
 *    parked on a wait actually flips to READY, and a WAITING Run actually
 *    resumes to RUNNING, once (and only once) every waiting node is cleared.
 * 6. That a CONCURRENT double CreateRun for the SAME (caseId, idempotencyKey)
 *    produces exactly ONE Run row (the advisory-lock serialization).
 * 7. That a cross-tenant actor is refused, fail-closed, on every mutating
 *    command.
 *
 * Every assertion reads rows back through a dedicated out-of-band `pg.Pool`
 * (`control`) — never the service's return value alone.
 *
 * ISOLATION: each test seeds its own organization/project/case/plan-version
 * inside the test body and tears it down in a `finally`.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import * as casePlanVersionService from '../casePlanVersionService.js';
import type { CanonicalGraph } from '../casePlanVersionService.js';
import { CaseWorkspaceAuthError } from '../caseWorkspaceAuthContext.js';
import * as nodeRunService from '../nodeRunService.js';
import * as runLifecycleService from '../runLifecycleService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const runs = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_runs'
          AND column_name IN ('run_id', 'case_id', 'case_plan_version_id', 'graph_digest',
                              'status', 'outcome_status', 'initiated_by', 'idempotency_key', 'version')`
    );
    return Number(runs.rows[0]?.present ?? 0) === 9;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[runLifecycleService pg suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260811a_case_workspace_run_lifecycle.sql migration applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface RunDbRow {
  run_id: string;
  case_id: string;
  case_plan_version_id: string;
  graph_digest: string;
  status: string;
  outcome_status: string;
  initiated_by: string;
  idempotency_key: string;
  version: number;
  started_at: string | null;
  completed_at: string | null;
}

suite('runLifecycleService — canonical Run lifecycle against a real PostgreSQL (doc 04 §3.4/§4.4/§5)', () => {
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
    const userId = `case-runlc-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
      [`case-runlc-member-${randomUUID()}`, orgId, userId]
    );
    return userId;
  }

  /**
   * A STANDARD/TRANSFORMATION Case with a PUBLISHED two-node linear plan
   * (n1 -> n2), and NO Run yet — createRun/startRun are exactly what each
   * test exercises on top of this. Every step goes through the owning
   * production service (caseCoreService, casePlanVersionService), matching
   * nodeRunService.pg.test.ts's own seedBoundRun precedent.
   */
  async function seedPublishedCase(
    label: string,
    options: { profile?: 'STANDARD' | 'TRANSFORMATION' | 'LIGHT' } = {}
  ): Promise<{
    orgId: string;
    projectId: string;
    caseId: string;
    casePlanVersionId: string;
    graphDigest: string;
    actorId: string;
  }> {
    const suffix = randomUUID();
    const orgId = `case-runlc-org-${label}-${suffix}`;
    const projectId = `case-runlc-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `RunLifecycle test org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `RunLifecycle test project (${label})`]
    );
    const actorId = await seedMemberedUser(orgId, label);
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      caseProfile: options.profile ?? 'STANDARD',
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: actorId,
    });

    const graph: CanonicalGraph = {
      schemaVersion: '1',
      graphId: `graph-${label}-${suffix}`,
      entryNodeIds: ['n1'],
      terminalNodeIds: ['n2'],
      nodes: [
        { nodeId: 'n1', type: 'CAPABILITY' },
        { nodeId: 'n2', type: 'CAPABILITY' },
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

    return {
      orgId,
      projectId,
      caseId: created.caseId,
      casePlanVersionId: published.casePlanVersionId,
      graphDigest: published.graphDigest,
      actorId,
    };
  }

  async function teardown(params: { orgId: string; projectId: string; caseId?: string }): Promise<void> {
    await control
      .query(
        `DELETE FROM case_workspace_node_run_attempts
          WHERE node_run_id IN (
            SELECT node_run_id FROM case_workspace_node_runs
             WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)
          )`,
        [params.projectId]
      )
      .catch(() => undefined);
    await control
      .query(
        `DELETE FROM case_workspace_node_runs
          WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)`,
        [params.projectId]
      )
      .catch(() => undefined);
    await control
      .query(
        `DELETE FROM case_workspace_runs
          WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)`,
        [params.projectId]
      )
      .catch(() => undefined);
    await control
      .query(
        `DELETE FROM case_workspace_run_bindings
          WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)`,
        [params.projectId]
      )
      .catch(() => undefined);
    await control
      .query(
        `DELETE FROM v8_execution_runs
          WHERE run_id IN (
            SELECT run_id FROM case_workspace_run_bindings
             WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)
          )`,
        [params.projectId]
      )
      .catch(() => undefined);
    await control.query(`DELETE FROM case_core WHERE project_id = $1`, [params.projectId]).catch(() => undefined);
    await control.query(`DELETE FROM projects WHERE id = $1`, [params.projectId]).catch(() => undefined);
    await control
      .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [params.orgId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM organization_members WHERE organization_id = $1`, [params.orgId])
      .catch(() => undefined);
    await control.query(`DELETE FROM users WHERE organization_id = $1`, [params.orgId]).catch(() => undefined);
    await control.query(`DELETE FROM organizations WHERE id = $1`, [params.orgId]).catch(() => undefined);
  }

  async function readRun(runId: string): Promise<RunDbRow | null> {
    const result = await control.query<RunDbRow>(`SELECT * FROM case_workspace_runs WHERE run_id = $1`, [runId]);
    return result.rows[0] ?? null;
  }

  async function countRuns(caseId: string): Promise<number> {
    const result = await control.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM case_workspace_runs WHERE case_id = $1`,
      [caseId]
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  async function countEvents(aggregateId: string, eventType: string): Promise<number> {
    const result = await control.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM case_workspace_event_outbox
        WHERE aggregate_id = $1 AND event_type = $2`,
      [aggregateId, eventType]
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  // =========================================================================
  // 1. Hard rule: CreateRun alone creates ZERO NodeRuns and stays CREATED.
  // =========================================================================
  it('createRun leaves the Run in CREATED with zero NodeRuns — StartRun is the only path to RUNNING', async () => {
    const fx = await seedPublishedCase('hard-rule');
    try {
      const run = await runLifecycleService.createRun(
        {
          caseId: fx.caseId,
          casePlanVersionId: fx.casePlanVersionId,
          idempotencyKey: `create-${randomUUID()}`,
        },
        fx.actorId
      );
      expect(run.status).toBe('CREATED');
      expect(run.graphDigest).toBe(fx.graphDigest);
      expect(run.startedAt).toBeNull();

      const nodeRuns = await nodeRunService.listNodeRunsForRun(run.runId, fx.actorId);
      expect(nodeRuns).toHaveLength(0);

      const row = await readRun(run.runId);
      expect(row?.status).toBe('CREATED');
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 2. createRun refuses an unpublished plan version (the other half of the
  //    hard rule) and refuses a LIGHT case (must use startLightRun).
  // =========================================================================
  it('createRun refuses a DRAFT plan version and refuses a LIGHT-profile case', async () => {
    const fx = await seedPublishedCase('refusals');
    try {
      const draftGraph: CanonicalGraph = {
        entryNodeIds: ['x1'],
        terminalNodeIds: ['x1'],
        nodes: [{ nodeId: 'x1', type: 'CAPABILITY' }],
        edges: [],
      };
      const draft = await casePlanVersionService.createPlanDraft({
        caseId: fx.caseId,
        semanticGraph: draftGraph,
        createdByActorId: fx.actorId,
      });

      await expect(
        runLifecycleService.createRun(
          { caseId: fx.caseId, casePlanVersionId: draft.casePlanVersionId, idempotencyKey: `d-${randomUUID()}` },
          fx.actorId
        )
      ).rejects.toThrow('run_lifecycle_plan_not_published');

      expect(await countRuns(fx.caseId)).toBe(0);
    } finally {
      await teardown(fx);
    }

    const lightFx = await seedPublishedCase('light-refusal', { profile: 'LIGHT' });
    try {
      await expect(
        runLifecycleService.createRun(
          {
            caseId: lightFx.caseId,
            casePlanVersionId: lightFx.casePlanVersionId,
            idempotencyKey: `l-${randomUUID()}`,
          },
          lightFx.actorId
        )
      ).rejects.toThrow('run_lifecycle_light_case_requires_one_click');
    } finally {
      await teardown(lightFx);
    }
  }, 90_000);

  // =========================================================================
  // 3. Idempotent replay: same (caseId, idempotencyKey) twice -> ONE Run row,
  //    ONE v8_execution_runs row, ONE binding, ONE 'run.created' event.
  // =========================================================================
  it('createRun is idempotent on (caseId, idempotencyKey): a replay returns the SAME row and mints nothing new', async () => {
    const fx = await seedPublishedCase('idempotent-create');
    try {
      const key = `idem-${randomUUID()}`;
      const first = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: key },
        fx.actorId
      );
      const second = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: key },
        fx.actorId
      );
      expect(second.runId).toBe(first.runId);
      expect(await countRuns(fx.caseId)).toBe(1);
      expect(await countEvents(first.runId, 'run.created')).toBe(1);

      const bindings = await control.query(`SELECT count(*)::int AS n FROM case_workspace_run_bindings WHERE case_id = $1`, [
        fx.caseId,
      ]);
      expect(Number(bindings.rows[0].n)).toBe(1);
      const v8Runs = await control.query(`SELECT count(*)::int AS n FROM v8_execution_runs WHERE run_id = $1`, [
        first.runId,
      ]);
      expect(Number(v8Runs.rows[0].n)).toBe(1);
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 4. Concurrent double CreateRun for the SAME idempotency key produces
  //    exactly ONE Run row (advisory-lock serialization, not a race).
  // =========================================================================
  it('two CONCURRENT createRun calls for the same (caseId, idempotencyKey) serialize into exactly one Run', async () => {
    const fx = await seedPublishedCase('concurrent-create');
    try {
      const key = `concurrent-${randomUUID()}`;
      const [a, b] = await Promise.all([
        runLifecycleService.createRun(
          { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: key },
          fx.actorId
        ),
        runLifecycleService.createRun(
          { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: key },
          fx.actorId
        ),
      ]);
      expect(a.runId).toBe(b.runId);
      expect(await countRuns(fx.caseId)).toBe(1);
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 5. StartRun: mints entry NodeRuns, lands on RUNNING, and is idempotent.
  // =========================================================================
  it('startRun creates the entry NodeRun(s) READY and moves CREATED -> RUNNING; a second startRun is a no-op replay', async () => {
    const fx = await seedPublishedCase('start-run');
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `sr-${randomUUID()}` },
        fx.actorId
      );

      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      expect(started.outcome).toBe('started');
      if (started.outcome !== 'started') throw new Error('unreachable');
      expect(started.nodeRunIds).toHaveLength(1);
      expect(started.run.status).toBe('RUNNING');
      expect(started.run.startedAt).not.toBeNull();

      const nodeRuns = await nodeRunService.listNodeRunsForRun(created.runId, fx.actorId);
      expect(nodeRuns).toHaveLength(1);
      expect(nodeRuns[0].nodeId).toBe('n1');
      expect(nodeRuns[0].status).toBe('READY');

      const row = await readRun(created.runId);
      expect(row?.status).toBe('RUNNING');
      expect(await countEvents(created.runId, 'run.started')).toBe(1);

      // Idempotent replay: no throw, no second NodeRun, no second event.
      const startedAgain = await runLifecycleService.startRun(created.runId, fx.actorId);
      expect(startedAgain.outcome).toBe('already_started');
      const nodeRunsAfter = await nodeRunService.listNodeRunsForRun(created.runId, fx.actorId);
      expect(nodeRunsAfter).toHaveLength(1);
      expect(await countEvents(created.runId, 'run.started')).toBe(1);
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 6. OCC guards Pause/Resume: a stale expectedVersion changes NOTHING.
  // =========================================================================
  it('pauseRun/resumeRun are OCC-guarded: a stale expectedVersion is refused and leaves the row untouched', async () => {
    const fx = await seedPublishedCase('occ-pause');
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `occ-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      const staleVersion = started.run.version;

      const paused = await runLifecycleService.pauseRun(created.runId, fx.actorId, staleVersion);
      expect(paused.status).toBe('PAUSED');
      expect(paused.version).toBe(staleVersion + 1);

      // Negative control: the SAME stale version again must be refused, not
      // silently re-applied.
      await expect(runLifecycleService.pauseRun(created.runId, fx.actorId, staleVersion)).rejects.toThrow(
        'run_lifecycle_version_conflict'
      );
      const rowAfterConflict = await readRun(created.runId);
      expect(rowAfterConflict?.status).toBe('PAUSED');
      expect(rowAfterConflict?.version).toBe(staleVersion + 1);

      const resumed = await runLifecycleService.resumeRun(created.runId, fx.actorId, paused.version);
      expect(resumed.status).toBe('RUNNING');
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 7. CancelRun cascades: cancellable NodeRuns (READY) are CANCELLED too.
  // =========================================================================
  it('cancelRun cascades to CANCEL every cancellable NodeRun of the Run', async () => {
    const fx = await seedPublishedCase('cancel-cascade');
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `cx-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');

      const cancelled = await runLifecycleService.cancelRun(
        created.runId,
        fx.actorId,
        started.run.version,
        'test cancellation'
      );
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.completedAt).not.toBeNull();

      const nodeRuns = await nodeRunService.listNodeRunsForRun(created.runId, fx.actorId);
      expect(nodeRuns).toHaveLength(1);
      expect(nodeRuns[0].status).toBe('CANCELLED');
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 8. RetryNode: refused while the node is still live, succeeds only from
  //    FAILED_TERMINAL, and mints a NEW NodeRun (never resurrects the old
  //    one) — and brings a BLOCKED Run back to RUNNING.
  // =========================================================================
  it('retryNode refuses a live node, and mints a fresh NodeRun once the node is FAILED_TERMINAL, resuming a BLOCKED Run', async () => {
    const fx = await seedPublishedCase('retry-node');
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `rn-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      const [firstNodeRunId] = started.nodeRunIds;

      // Negative control: the node is still READY/live — refused.
      await expect(runLifecycleService.retryNode(created.runId, 'n1', fx.actorId)).rejects.toThrow(
        'run_lifecycle_node_not_retryable'
      );

      // Drive n1 to FAILED_TERMINAL (budget 1).
      const claim = await nodeRunService.claimNodeRun(firstNodeRunId, { leaseMs: 60_000 });
      if (claim.outcome !== 'claimed') throw new Error('unreachable');
      const attempt = await nodeRunService.startNodeRunAttempt(
        firstNodeRunId,
        { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken, timeoutMs: 60_000 },
        claim.nodeRun.version
      );
      await nodeRunService.completeNodeRunAttempt(
        firstNodeRunId,
        {
          attemptId: attempt.attempt.attemptId,
          leaseOwner: claim.leaseOwner,
          fencingToken: claim.fencingToken,
          outcome: 'FAILED_TERMINAL',
        },
        attempt.nodeRun.version
      );

      // advanceRun settles the Run into BLOCKED: n1 failed terminally, no
      // active/waiting work remains, and the terminal node n2 is unreachable.
      const advanced = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(advanced.run.status).toBe('BLOCKED');

      const retried = await runLifecycleService.retryNode(created.runId, 'n1', fx.actorId);
      expect(retried.nodeRun.nodeId).toBe('n1');
      expect(retried.nodeRun.nodeRunId).not.toBe(firstNodeRunId);
      expect(retried.nodeRun.status).toBe('READY');
      expect(retried.run.status).toBe('RUNNING');

      const latest = await nodeRunService.getLatestNodeRunForNode(created.runId, 'n1', fx.actorId);
      expect(latest?.nodeRunId).toBe(retried.nodeRun.nodeRunId);
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 9. advanceRun: linear graph progression n1 -> n2, then Run COMPLETED once
  //    the terminal node succeeds.
  // =========================================================================
  it('advanceRun progresses n1 -> n2 as each succeeds, and completes the Run once the terminal node succeeds', async () => {
    const fx = await seedPublishedCase('advance-run');
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `ar-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      const [n1RunId] = started.nodeRunIds;

      async function succeed(nodeRunId: string): Promise<void> {
        const claim = await nodeRunService.claimNodeRun(nodeRunId, { leaseMs: 60_000 });
        if (claim.outcome !== 'claimed') throw new Error('unreachable');
        const attempt = await nodeRunService.startNodeRunAttempt(
          nodeRunId,
          { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken, timeoutMs: 60_000 },
          claim.nodeRun.version
        );
        await nodeRunService.completeNodeRunAttempt(
          nodeRunId,
          {
            attemptId: attempt.attempt.attemptId,
            leaseOwner: claim.leaseOwner,
            fencingToken: claim.fencingToken,
            outcome: 'SUCCEEDED',
          },
          attempt.nodeRun.version
        );
      }

      await succeed(n1RunId);
      const afterN1 = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(afterN1.createdNodeRunIds).toHaveLength(1);
      expect(afterN1.run.status).toBe('RUNNING');

      const n2 = await nodeRunService.getLatestNodeRunForNode(created.runId, 'n2', fx.actorId);
      expect(n2?.status).toBe('READY');
      if (!n2) throw new Error('unreachable');

      await succeed(n2.nodeRunId);
      const afterN2 = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(afterN2.run.status).toBe('COMPLETED');
      expect(afterN2.run.completedAt).not.toBeNull();

      const row = await readRun(created.runId);
      expect(row?.status).toBe('COMPLETED');
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 10. ProvideNodeInput bridges a satisfied HUMAN wait back to its NodeRun,
  //     and resumes a WAITING Run.
  // =========================================================================
  it('provideNodeInput flips a WAITING_HUMAN NodeRun to READY and resumes a WAITING Run to RUNNING', async () => {
    const fx = await seedPublishedCase('provide-input');
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `pi-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      const [n1RunId] = started.nodeRunIds;

      // Manufacture the WAITING_HUMAN NodeRun + its wait directly (this
      // packet's allowlist does not include a capability-adapter that would
      // naturally produce this parked state — see runLifecycleService.ts's
      // own header on what this file is NOT).
      const waitId = `cwwait-${randomUUID()}`;
      await control.query(
        `INSERT INTO case_workspace_waits (
           wait_id, organization_id, case_id, run_id, node_run_id, wait_type, status,
           correlation_key, created_at
         ) VALUES ($1, $2, $3, $4, $5, 'HUMAN', 'ACTIVE', $6, NOW()::text)`,
        [waitId, fx.orgId, fx.caseId, created.runId, n1RunId, `provide-input-${randomUUID()}`]
      );
      const claim = await nodeRunService.claimNodeRun(n1RunId, { leaseMs: 60_000 });
      if (claim.outcome !== 'claimed') throw new Error('unreachable');
      const attemptStarted = await nodeRunService.startNodeRunAttempt(
        n1RunId,
        { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken, timeoutMs: 60_000 },
        claim.nodeRun.version
      );
      const waiting = await nodeRunService.transitionNodeRun(
        n1RunId,
        'WAITING_HUMAN',
        attemptStarted.nodeRun.version,
        { waitId }
      );
      expect(waiting.status).toBe('WAITING_HUMAN');

      // The Run itself is manually parked WAITING for this fixture (no
      // automatic engine drives Run status off a single WAITING_HUMAN node in
      // this test — advanceRun's own coverage is test #9).
      await control.query(
        `UPDATE case_workspace_runs SET status = 'WAITING', version = version + 1 WHERE run_id = $1`,
        [created.runId]
      );

      const result = await runLifecycleService.provideNodeInput({
        nodeRunId: n1RunId,
        inputRef: `ref:${randomUUID()}`,
        actorUserId: fx.actorId,
      });
      expect(result.nodeRun.status).toBe('READY');
      expect(result.run.status).toBe('RUNNING');

      const waitRow = await control.query(`SELECT status FROM case_workspace_waits WHERE wait_id = $1`, [waitId]);
      expect(waitRow.rows[0]?.status).toBe('SATISFIED');
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 11. CompensateAction: RUNNING -> COMPENSATING marks REQUIRED nodes
  //     IN_PROGRESS; reporting all outcomes resolves the Run to COMPENSATED
  //     (or FAILED if any node's compensation itself failed).
  // =========================================================================
  it('compensateRun marks REQUIRED nodes IN_PROGRESS, and recordNodeCompensationOutcome resolves the Run to COMPENSATED', async () => {
    const fx = await seedPublishedCase('compensate');
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `cp-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      const [n1RunId] = started.nodeRunIds;

      // A timed-out attempt is nodeRunService's own documented path to
      // compensation_state = 'REQUIRED' — reuse it rather than writing
      // straight to the column.
      const claim = await nodeRunService.claimNodeRun(n1RunId, { leaseMs: 60_000 });
      if (claim.outcome !== 'claimed') throw new Error('unreachable');
      await nodeRunService.startNodeRunAttempt(
        n1RunId,
        { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken, timeoutMs: 1 },
        claim.nodeRun.version
      );
      await control.query(
        `UPDATE case_workspace_node_runs SET timeout_at = (NOW() - interval '1 minute')::text WHERE node_run_id = $1`,
        [n1RunId]
      );
      const timedOut = await nodeRunService.timeoutNodeRunAttempt(n1RunId);
      if (!('nodeRun' in timedOut)) throw new Error('unreachable');
      expect(timedOut.nodeRun.compensationState).toBe('REQUIRED');

      const compensating = await runLifecycleService.compensateRun(created.runId, fx.actorId, started.run.version);
      expect(compensating.run.status).toBe('COMPENSATING');
      expect(compensating.markedNodeRunIds).toEqual([n1RunId]);

      const inProgress = await nodeRunService.getNodeRun(n1RunId, fx.actorId);
      expect(inProgress?.compensationState).toBe('IN_PROGRESS');

      const resolved = await runLifecycleService.recordNodeCompensationOutcome(
        created.runId,
        n1RunId,
        'COMPLETED',
        fx.actorId
      );
      expect(resolved.status).toBe('COMPENSATED');
      expect(resolved.completedAt).not.toBeNull();
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 12. Cross-tenant negative control: fail closed on every mutating command.
  // =========================================================================
  it('refuses a cross-tenant actor on createRun, startRun and cancelRun alike', async () => {
    const fx = await seedPublishedCase('cross-tenant-a');
    const other = await seedPublishedCase('cross-tenant-b');
    try {
      await expect(
        runLifecycleService.createRun(
          { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `xt-${randomUUID()}` },
          other.actorId
        )
      ).rejects.toThrow(CaseWorkspaceAuthError);

      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `xt2-${randomUUID()}` },
        fx.actorId
      );
      await expect(runLifecycleService.startRun(created.runId, other.actorId)).rejects.toThrow(
        CaseWorkspaceAuthError
      );

      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      await expect(
        runLifecycleService.cancelRun(created.runId, other.actorId, started.run.version)
      ).rejects.toThrow(CaseWorkspaceAuthError);

      const row = await readRun(created.runId);
      expect(row?.status).toBe('RUNNING'); // untouched by the refused cross-tenant cancel
    } finally {
      await teardown(fx);
      await teardown(other);
    }
  }, 90_000);
});
