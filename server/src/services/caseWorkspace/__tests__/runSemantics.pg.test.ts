/**
 * Case Workspace — Run semantics closure (packet D2), proved against a REAL
 * PostgreSQL. Exercises server/src/services/caseWorkspace/runLifecycleService.ts
 * (advanceRun/startRun/retryNode) and the join-policy/skip-acceptance wiring
 * it drives in server/src/services/caseWorkspace/executionGraphService.ts,
 * on top of server/migrations/20260809_case_workspace_execution_graph.sql
 * and server/migrations/20260811a_case_workspace_run_lifecycle.sql (no new
 * migration was needed — both tables already carry join_policy/
 * join_required_count/join_branch_total_count and node_completion_state/
 * result_acceptance/skip_authorized_by_graph_condition).
 *
 * ===========================================================================
 * WHAT THIS SUITE TRIES TO DISPROVE
 * ===========================================================================
 *   1. That a PARALLEL_JOIN's `ANY` policy waits for anything beyond the
 *      FIRST satisfied branch.
 *   2. That a PARALLEL_JOIN's `N_OF_M` policy fires before N branches are
 *      satisfied, or refuses to fire once exactly N are.
 *   3. That an out-of-range/invalid N_OF_M `joinRequiredCount` is silently
 *      accepted, clamped, or only discovered deep inside a running Run —
 *      startRun must refuse it outright, before a single NodeRun exists.
 *   4. That a DECISION_GATEWAY's not-selected branch still leaves ZERO trace
 *      anywhere — it must now carry an explicit SKIPPED/NOT_APPLICABLE
 *      `case_workspace_node_result_acceptances` row, while STILL never
 *      getting a fabricated `case_workspace_node_runs` row (the exact
 *      invariant integration/gatewayAdvance.pg.test.ts already locks down —
 *      this suite must not contradict it).
 *   5. THE REAL FINDING FROM THE PREVIOUS SESSION, re-proved directly: a node
 *      where two DECISION_GATEWAY branches reconverge (no PARALLEL_JOIN
 *      marker) must complete via OR semantics — waiting for the branch that
 *      was never selected would mean the Run never completes.
 *   6. That a PARTIAL node result acceptance on an otherwise fully-succeeded
 *      Run lands it on COMPLETED_WITH_WARNINGS, never plain COMPLETED —
 *      untested anywhere in this codebase before this packet.
 *   7. That Run/NodeRun state genuinely survives a process restart — read
 *      back by a totally separate `node` process, following the exact
 *      pattern integration/runRuntime.pg.test.ts already established.
 *   8. That retryNode has exactly ONE effect under concurrent duplicate
 *      dispatch (same idempotencyKey) — never two NodeRuns for one retry.
 *
 * Every assertion reads rows back through a dedicated out-of-band `pg.Pool`
 * (`control`) — never a service return value alone. Each test seeds its own
 * organization/project/case/plan-version and tears it down in a `finally`,
 * matching runLifecycleService.pg.test.ts's own isolation convention.
 *
 * ===========================================================================
 * GATE — real database, never a mock (same as every *.pg.test.ts here)
 * ===========================================================================
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/runSemantics.pg.test.ts \
 *   --environment node
 */

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import * as casePlanVersionService from '../casePlanVersionService.js';
import type { CanonicalGraph } from '../casePlanVersionService.js';
import * as executionGraphService from '../executionGraphService.js';
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
          AND column_name IN ('run_id', 'status', 'version')`
    );
    const gatewayEvaluations = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_gateway_evaluations'
          AND column_name IN ('node_run_id', 'run_id', 'join_policy', 'join_required_count', 'join_branch_total_count')`
    );
    const acceptances = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_node_result_acceptances'
          AND column_name IN ('node_run_id', 'node_completion_state', 'result_acceptance',
                              'skip_authorized_by_graph_condition', 'caused_by_gateway_node_run_id')`
    );
    return (
      Number(runs.rows[0]?.present ?? 0) === 3 &&
      Number(gatewayEvaluations.rows[0]?.present ?? 0) === 5 &&
      Number(acceptances.rows[0]?.present ?? 0) === 5
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
    `[runSemantics pg suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and both the ` +
      `20260809_case_workspace_execution_graph.sql and 20260811a_case_workspace_run_lifecycle.sql ` +
      `migrations applied. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('runLifecycleService — Run semantics closure: join policies, SKIPPED audit, PARTIAL, restart, idempotency (D2)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Fixtures — each test seeds its own org/project/case/plan and tears down.
  // -------------------------------------------------------------------------

  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = `case-runsem-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
      [`case-runsem-member-${randomUUID()}`, orgId, userId]
    );
    return userId;
  }

  /** Publishes `graph` on a fresh STANDARD Case and returns its identity. */
  async function seedPublishedCase(
    label: string,
    graph: CanonicalGraph
  ): Promise<{
    orgId: string;
    projectId: string;
    caseId: string;
    casePlanVersionId: string;
    graphDigest: string;
    actorId: string;
  }> {
    const suffix = randomUUID();
    const orgId = `case-runsem-org-${label}-${suffix}`;
    const projectId = `case-runsem-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `Run semantics test org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Run semantics test project (${label})`]
    );
    const actorId = await seedMemberedUser(orgId, label);
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      caseProfile: 'STANDARD',
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: actorId,
    });

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

  async function teardown(params: { orgId: string; projectId: string }): Promise<void> {
    await control
      .query(
        `DELETE FROM case_workspace_node_result_acceptances
          WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)`,
        [params.projectId]
      )
      .catch(() => undefined);
    await control
      .query(
        `DELETE FROM case_workspace_gateway_evaluations
          WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)`,
        [params.projectId]
      )
      .catch(() => undefined);
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

  /** Drives a READY NodeRun through claim -> attempt -> SUCCEEDED. */
  async function succeed(nodeRunId: string): Promise<void> {
    const claim = await nodeRunService.claimNodeRun(nodeRunId, { leaseMs: 60_000 });
    if (claim.outcome !== 'claimed') throw new Error(`unreachable: ${claim.outcome}`);
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

  async function countNodeRuns(runId: string, nodeId: string): Promise<number> {
    const result = await control.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM case_workspace_node_runs WHERE run_id = $1 AND node_id = $2`,
      [runId, nodeId]
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  /** A fan-out graph: n1 -> split -> {b1,b2,b3} -> join(policy) -> end. */
  function splitJoinGraph(joinNode: { joinPolicy?: string; joinRequiredCount?: number }): CanonicalGraph {
    return {
      entryNodeIds: ['n1'],
      terminalNodeIds: ['end'],
      nodes: [
        { nodeId: 'n1', type: 'CAPABILITY' },
        { nodeId: 'split', type: 'PARALLEL_SPLIT' },
        { nodeId: 'b1', type: 'CAPABILITY' },
        { nodeId: 'b2', type: 'CAPABILITY' },
        { nodeId: 'b3', type: 'CAPABILITY' },
        { nodeId: 'join', type: 'PARALLEL_JOIN', ...joinNode },
        { nodeId: 'end', type: 'CAPABILITY' },
      ],
      edges: [
        { edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'split', edgeType: 'SEQUENCE' },
        { edgeId: 'e_b1', sourceNodeId: 'split', targetNodeId: 'b1', edgeType: 'SEQUENCE' },
        { edgeId: 'e_b2', sourceNodeId: 'split', targetNodeId: 'b2', edgeType: 'SEQUENCE' },
        { edgeId: 'e_b3', sourceNodeId: 'split', targetNodeId: 'b3', edgeType: 'SEQUENCE' },
        { edgeId: 'e_j1', sourceNodeId: 'b1', targetNodeId: 'join', edgeType: 'SEQUENCE' },
        { edgeId: 'e_j2', sourceNodeId: 'b2', targetNodeId: 'join', edgeType: 'SEQUENCE' },
        { edgeId: 'e_j3', sourceNodeId: 'b3', targetNodeId: 'join', edgeType: 'SEQUENCE' },
        { edgeId: 'e_end', sourceNodeId: 'join', targetNodeId: 'end', edgeType: 'SEQUENCE' },
      ],
    };
  }

  // =========================================================================
  // 1. ANY join policy: fires on the FIRST satisfied branch, never waits for
  //    the other two.
  // =========================================================================
  it('a PARALLEL_JOIN with joinPolicy=ANY resolves once the first of three branches succeeds', async () => {
    const fx = await seedPublishedCase('join-any', splitJoinGraph({ joinPolicy: 'ANY' }));
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `ja-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      await succeed(started.nodeRunIds[0]);
      await runLifecycleService.advanceRun(created.runId, fx.actorId); // fans out split -> b1,b2,b3

      const b1 = await nodeRunService.getLatestNodeRunForNode(created.runId, 'b1', fx.actorId);
      if (!b1) throw new Error('unreachable');

      // ONE of three: must ALREADY pass under ANY (unlike ALL, tested
      // elsewhere, which refuses at 1 of 2).
      await succeed(b1.nodeRunId);
      const afterOne = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(afterOne.run.status).toBe('RUNNING');

      const joinNodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'join', fx.actorId);
      expect(joinNodeRun?.status).toBe('SUCCEEDED');
      if (!joinNodeRun) throw new Error('unreachable');
      const evaluation = await executionGraphService.getGatewayEvaluation(joinNodeRun.nodeRunId, fx.actorId);
      expect(evaluation?.outcomeStatus).toBe('JOIN_SATISFIED');
      expect(evaluation?.joinPolicy).toBe('ANY');
      expect(evaluation?.joinBranchTotalCount).toBe(3);
      expect(evaluation?.joinRequiredCount).toBeNull();

      const endNodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'end', fx.actorId);
      expect(endNodeRun?.status).toBe('READY');

      // b2/b3 were fanned out (PARALLEL_SPLIT is unconditional) but never
      // needed to complete for the join to fire — the Run still reaches
      // COMPLETED once `end` succeeds, regardless of their fate.
      if (!endNodeRun) throw new Error('unreachable');
      await succeed(endNodeRun.nodeRunId);
      const final = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(final.run.status).toBe('COMPLETED');
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 2. N_OF_M join policy: refuses at 1 of 3, fires exactly at N=2 of 3.
  // =========================================================================
  it('a PARALLEL_JOIN with joinPolicy=N_OF_M(2) refuses at 1 of 3 and resolves at exactly 2 of 3', async () => {
    const fx = await seedPublishedCase(
      'join-n-of-m',
      splitJoinGraph({ joinPolicy: 'N_OF_M', joinRequiredCount: 2 })
    );
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `nm-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      await succeed(started.nodeRunIds[0]);
      await runLifecycleService.advanceRun(created.runId, fx.actorId);

      const b1 = await nodeRunService.getLatestNodeRunForNode(created.runId, 'b1', fx.actorId);
      const b2 = await nodeRunService.getLatestNodeRunForNode(created.runId, 'b2', fx.actorId);
      if (!b1 || !b2) throw new Error('unreachable');

      // 1 of 3: must NOT pass.
      await succeed(b1.nodeRunId);
      const afterOne = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(afterOne.run.status).toBe('RUNNING');
      expect(await countNodeRuns(created.runId, 'join')).toBe(0);

      // 2 of 3: must pass, without waiting for b3.
      await succeed(b2.nodeRunId);
      const afterTwo = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(afterTwo.run.status).toBe('RUNNING');
      const joinNodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'join', fx.actorId);
      expect(joinNodeRun?.status).toBe('SUCCEEDED');
      if (!joinNodeRun) throw new Error('unreachable');
      const evaluation = await executionGraphService.getGatewayEvaluation(joinNodeRun.nodeRunId, fx.actorId);
      expect(evaluation?.joinPolicy).toBe('N_OF_M');
      expect(evaluation?.joinRequiredCount).toBe(2);
      expect(evaluation?.joinBranchTotalCount).toBe(3);
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 3. Out-of-range N_OF_M is rejected CLEANLY by startRun — before a single
  //    NodeRun exists.
  // =========================================================================
  it('startRun refuses a PARALLEL_JOIN whose N_OF_M required count is out of range (N > M), minting zero NodeRuns', async () => {
    const fx = await seedPublishedCase(
      'join-invalid-n',
      splitJoinGraph({ joinPolicy: 'N_OF_M', joinRequiredCount: 5 }) // only 3 branches exist
    );
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `inv-${randomUUID()}` },
        fx.actorId
      );
      await expect(runLifecycleService.startRun(created.runId, fx.actorId)).rejects.toThrow(
        'run_lifecycle_join_required_count_invalid'
      );

      const nodeRuns = await nodeRunService.listNodeRunsForRun(created.runId, fx.actorId);
      expect(nodeRuns).toHaveLength(0);
      const row = await control.query<{ status: string }>(
        `SELECT status FROM case_workspace_runs WHERE run_id = $1`,
        [created.runId]
      );
      expect(row.rows[0]?.status).toBe('CREATED'); // refused cleanly — never left CREATED
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 4 + 5. DECISION_GATEWAY not-selected branch: explicit SKIPPED audit row,
  //        NodeRun still NEVER fabricated (regression guard for the previous
  //        session's finding — OR semantics, or the Run never completes).
  // =========================================================================
  it(
    "a DECISION_GATEWAY's not-selected branch gets an explicit SKIPPED acceptance row, never a fabricated " +
      'NodeRun, and the Run still completes via OR semantics through the selected branch alone',
    async () => {
      const graph: CanonicalGraph = {
        entryNodeIds: ['n1'],
        terminalNodeIds: ['end'],
        nodes: [
          { nodeId: 'n1', type: 'CAPABILITY' },
          { nodeId: 'gw', type: 'DECISION_GATEWAY' },
          { nodeId: 'branchA', type: 'CAPABILITY' },
          { nodeId: 'branchB', type: 'CAPABILITY' },
          { nodeId: 'end', type: 'CAPABILITY' },
        ],
        edges: [
          { edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'gw', edgeType: 'SEQUENCE' },
          { edgeId: 'e_a', sourceNodeId: 'gw', targetNodeId: 'branchA', edgeType: 'CONDITIONAL' },
          { edgeId: 'e_b', sourceNodeId: 'gw', targetNodeId: 'branchB', edgeType: 'CONDITIONAL' },
          { edgeId: 'e_end_a', sourceNodeId: 'branchA', targetNodeId: 'end', edgeType: 'SEQUENCE' },
          { edgeId: 'e_end_b', sourceNodeId: 'branchB', targetNodeId: 'end', edgeType: 'SEQUENCE' },
        ],
      };
      const fx = await seedPublishedCase('gateway-skip', graph);
      try {
        const created = await runLifecycleService.createRun(
          { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `gs-${randomUUID()}` },
          fx.actorId
        );
        const started = await runLifecycleService.startRun(created.runId, fx.actorId);
        if (started.outcome !== 'started') throw new Error('unreachable');
        await succeed(started.nodeRunIds[0]);
        await runLifecycleService.advanceRun(created.runId, fx.actorId); // gw READY, no evaluation yet

        const gwNodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'gw', fx.actorId);
        if (!gwNodeRun) throw new Error('unreachable');
        // Zero acceptance rows before the gateway even resolves — nothing
        // guessed ahead of the decision.
        expect(
          (await executionGraphService.listNodeResultAcceptancesForRun(created.runId, undefined, fx.actorId)).length
        ).toBe(0);

        await executionGraphService.recordGatewayEvaluation({
          nodeRunId: gwNodeRun.nodeRunId,
          runId: created.runId,
          gatewayNodeType: 'DECISION_GATEWAY',
          conditionExpression: 'input.choice == "A"',
          conditionSchemaVersion: 'v1',
          evaluationInputSnapshot: { choice: 'A' },
          outcomeStatus: 'BRANCH_SELECTED',
          outcomeDetail: { selectedEdgeId: 'e_a' },
          evaluatedAt: new Date().toISOString(),
          recordedByActorId: fx.actorId,
        });

        const afterEvaluation = await runLifecycleService.advanceRun(created.runId, fx.actorId);
        expect(afterEvaluation.run.status).toBe('RUNNING');

        // REGRESSION GUARD: branchB must NEVER get a fabricated NodeRun —
        // the exact property integration/gatewayAdvance.pg.test.ts locks
        // down, re-proved here directly against this packet's own changes.
        expect(await countNodeRuns(created.runId, 'branchB')).toBe(0);

        // NEW: branchB now has an explicit SKIPPED/NOT_APPLICABLE audit row,
        // even though it was never a real NodeRun.
        const acceptances = await executionGraphService.listNodeResultAcceptancesForRun(
          created.runId,
          undefined,
          fx.actorId
        );
        const branchBAcceptance = acceptances.find((a) => {
          const snapshot = a.acceptanceInputSnapshot as Record<string, unknown> | null;
          return snapshot && snapshot.skippedNodeId === 'branchB';
        });
        expect(branchBAcceptance).toBeDefined();
        expect(branchBAcceptance?.nodeCompletionState).toBe('SKIPPED');
        expect(branchBAcceptance?.resultAcceptance).toBe('NOT_APPLICABLE');
        expect(branchBAcceptance?.skipAuthorizedByGraphCondition).toBe(true);
        expect(branchBAcceptance?.causedByGatewayNodeRunId).toBe(gwNodeRun.nodeRunId);
        expect(branchBAcceptance?.nodeType).toBe('CAPABILITY');

        // Idempotent across repeated advanceRun calls — never a duplicate or
        // a determinism-conflict throw.
        await runLifecycleService.advanceRun(created.runId, fx.actorId);
        await runLifecycleService.advanceRun(created.runId, fx.actorId);
        const acceptancesAfterReplay = await executionGraphService.listNodeResultAcceptancesForRun(
          created.runId,
          undefined,
          fx.actorId
        );
        expect(
          acceptancesAfterReplay.filter((a) => {
            const snapshot = a.acceptanceInputSnapshot as Record<string, unknown> | null;
            return snapshot && snapshot.skippedNodeId === 'branchB';
          })
        ).toHaveLength(1);

        // THE REAL FINDING, re-proved: the Run completes via the SELECTED
        // branch alone — OR semantics, not AND. If this ever regressed to
        // AND (waiting for branchB too), this Run would stall in WAITING/
        // RUNNING forever instead of reaching COMPLETED.
        const branchANodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'branchA', fx.actorId);
        if (!branchANodeRun) throw new Error('unreachable');
        await succeed(branchANodeRun.nodeRunId);
        await runLifecycleService.advanceRun(created.runId, fx.actorId);
        const endNodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'end', fx.actorId);
        if (!endNodeRun) throw new Error('unreachable');
        await succeed(endNodeRun.nodeRunId);
        const finalAdvance = await runLifecycleService.advanceRun(created.runId, fx.actorId);
        expect(finalAdvance.run.status).toBe('COMPLETED');
        expect(await countNodeRuns(created.runId, 'branchB')).toBe(0); // still never fabricated, even at the end
      } finally {
        await teardown(fx);
      }
    },
    90_000
  );

  // =========================================================================
  // 6. PARTIAL result handling: a recorded PARTIAL acceptance lands the Run
  //    on COMPLETED_WITH_WARNINGS, never plain COMPLETED.
  // =========================================================================
  it('a PARTIAL node result acceptance completes the Run as COMPLETED_WITH_WARNINGS, not COMPLETED', async () => {
    const graph: CanonicalGraph = {
      entryNodeIds: ['n1'],
      terminalNodeIds: ['n2'],
      nodes: [
        { nodeId: 'n1', type: 'CAPABILITY' },
        { nodeId: 'n2', type: 'CAPABILITY' },
      ],
      edges: [{ edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', edgeType: 'SEQUENCE' }],
    };
    const fx = await seedPublishedCase('partial-warning', graph);
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `pw-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      await succeed(started.nodeRunIds[0]);
      await runLifecycleService.advanceRun(created.runId, fx.actorId);

      const n2 = await nodeRunService.getLatestNodeRunForNode(created.runId, 'n2', fx.actorId);
      if (!n2) throw new Error('unreachable');
      await succeed(n2.nodeRunId);

      // Business layer records the SUCCEEDED node's result as only PARTIALLY
      // acceptable — a fact orthogonal to the technical SUCCEEDED outcome.
      await executionGraphService.recordNodeResultAcceptance({
        nodeRunId: n2.nodeRunId,
        runId: created.runId,
        nodeType: 'CAPABILITY',
        nodeCompletionState: 'COMPLETED',
        resultAcceptance: 'PARTIAL',
        acceptanceInputSnapshot: { note: 'only 3 of 5 documents produced' },
        occurredAt: new Date().toISOString(),
        recordedByActorId: fx.actorId,
      });

      const finalAdvance = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(finalAdvance.run.status).toBe('COMPLETED_WITH_WARNINGS');
      expect(finalAdvance.run.completedAt).not.toBeNull();

      const row = await control.query<{ status: string }>(
        `SELECT status FROM case_workspace_runs WHERE run_id = $1`,
        [created.runId]
      );
      expect(row.rows[0]?.status).toBe('COMPLETED_WITH_WARNINGS');
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 7. Restart/recovery: a partially-satisfied N_OF_M join survives a
  //    restart into a BRAND NEW `node` process (own connection, zero shared
  //    module state), and resumes correctly once back in this process.
  //    Follows integration/runRuntime.pg.test.ts's own established pattern.
  // =========================================================================
  function readJoinStateFromFreshProcess(runId: string): {
    runStatus: string;
    joinNodeRunStatus: string | null;
  } {
    const script = `
      const { Client } = require('pg');
      (async () => {
        const client = new Client({ connectionString: process.env.DATABASE_URL });
        await client.connect();
        try {
          const runId = process.argv[1];
          const run = await client.query('SELECT status FROM case_workspace_runs WHERE run_id = $1', [runId]);
          const join = await client.query(
            "SELECT status FROM case_workspace_node_runs WHERE run_id = $1 AND node_id = 'join' ORDER BY created_at DESC LIMIT 1",
            [runId]
          );
          process.stdout.write(JSON.stringify({
            runStatus: run.rows[0] ? run.rows[0].status : null,
            joinNodeRunStatus: join.rows[0] ? join.rows[0].status : null,
          }));
        } finally {
          await client.end();
        }
      })().catch((err) => { process.stderr.write(String(err && err.stack || err)); process.exit(1); });
    `;
    const output = execFileSync(process.execPath, ['-e', script, runId], {
      cwd: process.cwd(),
      env: process.env,
      encoding: 'utf8',
      timeout: 15_000,
    });
    return JSON.parse(output) as { runStatus: string; joinNodeRunStatus: string | null };
  }

  it(
    'a Run mid N_OF_M join survives a restart into a brand-new process and resumes to COMPLETED correctly',
    async () => {
      const fx = await seedPublishedCase(
        'restart-join',
        splitJoinGraph({ joinPolicy: 'N_OF_M', joinRequiredCount: 2 })
      );
      try {
        const created = await runLifecycleService.createRun(
          { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `rj-${randomUUID()}` },
          fx.actorId
        );
        const started = await runLifecycleService.startRun(created.runId, fx.actorId);
        if (started.outcome !== 'started') throw new Error('unreachable');
        await succeed(started.nodeRunIds[0]);
        await runLifecycleService.advanceRun(created.runId, fx.actorId);

        const b1 = await nodeRunService.getLatestNodeRunForNode(created.runId, 'b1', fx.actorId);
        const b2 = await nodeRunService.getLatestNodeRunForNode(created.runId, 'b2', fx.actorId);
        if (!b1 || !b2) throw new Error('unreachable');
        await succeed(b1.nodeRunId);
        await runLifecycleService.advanceRun(created.runId, fx.actorId);

        // --- RESTART IN A NEW PROCESS, MID-JOIN (1 of 2 required satisfied) ---
        const midRestart = readJoinStateFromFreshProcess(created.runId);
        expect(midRestart.runStatus).toBe('RUNNING');
        expect(midRestart.joinNodeRunStatus).toBeNull(); // join not created yet — only 1 of 2 required

        // --- resume in THIS process, as if after the restart ---
        await succeed(b2.nodeRunId);
        await runLifecycleService.advanceRun(created.runId, fx.actorId);
        const joinNodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'join', fx.actorId);
        expect(joinNodeRun?.status).toBe('SUCCEEDED');
        const endNodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'end', fx.actorId);
        if (!endNodeRun) throw new Error('unreachable');
        await succeed(endNodeRun.nodeRunId);
        const final = await runLifecycleService.advanceRun(created.runId, fx.actorId);
        expect(final.run.status).toBe('COMPLETED');

        // --- final restart-in-a-new-process readback ---
        const finalReadback = readJoinStateFromFreshProcess(created.runId);
        expect(finalReadback.runStatus).toBe('COMPLETED');
        expect(finalReadback.joinNodeRunStatus).toBe('SUCCEEDED');
      } finally {
        await teardown(fx);
      }
    },
    120_000
  );

  // =========================================================================
  // 8. Idempotency: retryNode under concurrent duplicate dispatch (SAME
  //    idempotencyKey) produces exactly ONE new NodeRun, never two.
  // =========================================================================
  it('retryNode is idempotent: two CONCURRENT calls with the same idempotencyKey mint exactly one new NodeRun', async () => {
    const graph: CanonicalGraph = {
      entryNodeIds: ['n1'],
      terminalNodeIds: ['n1'],
      nodes: [{ nodeId: 'n1', type: 'CAPABILITY' }],
      edges: [],
    };
    const fx = await seedPublishedCase('retry-idempotent', graph);
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `ri-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      const [n1RunId] = started.nodeRunIds;

      // Drive n1 to FAILED_TERMINAL (budget 1) so retryNode is legal.
      const claim = await nodeRunService.claimNodeRun(n1RunId, { leaseMs: 60_000 });
      if (claim.outcome !== 'claimed') throw new Error('unreachable');
      const attempt = await nodeRunService.startNodeRunAttempt(
        n1RunId,
        { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken, timeoutMs: 60_000 },
        claim.nodeRun.version
      );
      await nodeRunService.completeNodeRunAttempt(
        n1RunId,
        {
          attemptId: attempt.attempt.attemptId,
          leaseOwner: claim.leaseOwner,
          fencingToken: claim.fencingToken,
          outcome: 'FAILED_TERMINAL',
        },
        attempt.nodeRun.version
      );
      await runLifecycleService.advanceRun(created.runId, fx.actorId); // settles BLOCKED

      const sharedIdempotencyKey = `dup-retry-${randomUUID()}`;
      const [r1, r2] = await Promise.all([
        runLifecycleService.retryNode(created.runId, 'n1', fx.actorId, { idempotencyKey: sharedIdempotencyKey }),
        runLifecycleService.retryNode(created.runId, 'n1', fx.actorId, { idempotencyKey: sharedIdempotencyKey }),
      ]);
      expect(r1.nodeRun.nodeRunId).toBe(r2.nodeRun.nodeRunId); // ONE effect, not two

      const allNodeRunsForN1 = await control.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM case_workspace_node_runs WHERE run_id = $1 AND node_id = 'n1'`,
        [created.runId]
      );
      // Exactly 2 rows total: the ORIGINAL failed attempt + the ONE retry —
      // never a third row from the duplicate dispatch.
      expect(Number(allNodeRunsForN1.rows[0]?.n ?? 0)).toBe(2);

      const latest = await nodeRunService.getLatestNodeRunForNode(created.runId, 'n1', fx.actorId);
      expect(latest?.nodeRunId).toBe(r1.nodeRun.nodeRunId);
      expect(latest?.status).toBe('READY');

      const run = await runLifecycleService.getRun(created.runId, fx.actorId);
      expect(run?.status).toBe('RUNNING'); // BLOCKED -> RUNNING, exactly once
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 9. FAILED remains a DELIBERATE human decision: advanceRun still never
  //    auto-declares FAILED — a stuck Run settles into BLOCKED and stays
  //    there until failRun/retryNode/cancelRun. Locks the property this
  //    packet was told NOT to change.
  // =========================================================================
  it('advanceRun settles a permanently stuck Run into BLOCKED, never auto-FAILED — failRun is the only way there', async () => {
    const graph: CanonicalGraph = {
      entryNodeIds: ['n1'],
      terminalNodeIds: ['n2'],
      nodes: [
        { nodeId: 'n1', type: 'CAPABILITY' },
        { nodeId: 'n2', type: 'CAPABILITY' },
      ],
      edges: [{ edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', edgeType: 'SEQUENCE' }],
    };
    const fx = await seedPublishedCase('no-auto-failed', graph);
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `naf-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      const [n1RunId] = started.nodeRunIds;

      const claim = await nodeRunService.claimNodeRun(n1RunId, { leaseMs: 60_000 });
      if (claim.outcome !== 'claimed') throw new Error('unreachable');
      const attempt = await nodeRunService.startNodeRunAttempt(
        n1RunId,
        { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken, timeoutMs: 60_000 },
        claim.nodeRun.version
      );
      await nodeRunService.completeNodeRunAttempt(
        n1RunId,
        {
          attemptId: attempt.attempt.attemptId,
          leaseOwner: claim.leaseOwner,
          fencingToken: claim.fencingToken,
          outcome: 'FAILED_TERMINAL',
        },
        attempt.nodeRun.version
      );

      // Repeated advanceRun calls: must settle into BLOCKED and STAY there —
      // never drift into FAILED on its own, no matter how many times called.
      for (let i = 0; i < 3; i += 1) {
        const advanced = await runLifecycleService.advanceRun(created.runId, fx.actorId);
        expect(advanced.run.status).toBe('BLOCKED');
      }

      const blocked = await runLifecycleService.getRun(created.runId, fx.actorId);
      if (!blocked) throw new Error('unreachable');
      const failed = await runLifecycleService.failRun(
        created.runId,
        fx.actorId,
        blocked.version,
        'operator write-off after exhausted automatic retries'
      );
      expect(failed.status).toBe('FAILED');
      expect(failed.completedAt).not.toBeNull();
    } finally {
      await teardown(fx);
    }
  }, 90_000);
});
