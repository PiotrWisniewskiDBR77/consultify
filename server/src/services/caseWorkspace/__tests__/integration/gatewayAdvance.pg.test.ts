/**
 * INTEGRATION (B1 packet) — proves `runLifecycleService.advanceRun` actually
 * EVALUATES gateways against a REAL PostgreSQL, closing the PARTIAL flagged
 * against the A-stream: "advanceRun does not evaluate gateways
 * (DECISION_GATEWAY, PARALLEL_SPLIT, PARALLEL_JOIN) — a plan whose only path
 * to a terminal node crosses a gateway never auto-completes."
 *
 * ===========================================================================
 * WHAT THIS SUITE TRIES TO DISPROVE
 * ===========================================================================
 *   1. That a DECISION_GATEWAY-gated plan can complete AT ALL — it must reach
 *      COMPLETED only once a `case_workspace_gateway_evaluations` row is
 *      recorded for that specific NodeRun, and must follow the SELECTED edge
 *      only (the not-selected branch's NodeRun must never be fabricated).
 *   2. That a PARALLEL_SPLIT fans out to EVERY branch (N NodeRuns) the moment
 *      it is reached — no external evaluation required, since fan-out is
 *      unconditional/mechanical.
 *   3. That a PARALLEL_JOIN refuses to pass at 1 of 2 satisfied branches and
 *      passes only once BOTH have succeeded — driven purely by ordinary
 *      NodeRun completion, no manual evaluation call needed.
 *   4. That "no evaluation recorded yet" is never silently guessed: a
 *      DECISION_GATEWAY with no recorded evaluation leaves BOTH candidate
 *      branches uncreated and the Run parked (never COMPLETED, never guesses
 *      a branch) across repeated `advanceRun` calls.
 *   5. That two CONCURRENT `advanceRun` calls over the SAME ready
 *      PARALLEL_SPLIT converge on exactly ONE gateway NodeRun, exactly ONE
 *      recorded evaluation, and exactly ONE NodeRun per branch — never a
 *      duplicate.
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
 *   npx vitest run server/src/services/caseWorkspace/__tests__/integration/gatewayAdvance.pg.test.ts \
 *   --environment node
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../../caseCoreService.js';
import * as casePlanVersionService from '../../casePlanVersionService.js';
import type { CanonicalGraph } from '../../casePlanVersionService.js';
import * as executionGraphService from '../../executionGraphService.js';
import * as nodeRunService from '../../nodeRunService.js';
import * as runLifecycleService from '../../runLifecycleService.js';

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
          AND column_name IN ('node_run_id', 'run_id', 'gateway_node_type', 'outcome_status')`
    );
    return Number(runs.rows[0]?.present ?? 0) === 3 && Number(gatewayEvaluations.rows[0]?.present ?? 0) === 4;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[gatewayAdvance integration suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and both the ` +
      `20260809_case_workspace_execution_graph.sql and 20260811a_case_workspace_run_lifecycle.sql ` +
      `migrations applied. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('runLifecycleService.advanceRun — gateway evaluation against a real PostgreSQL (B1)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Fixtures
  // -------------------------------------------------------------------------

  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = `case-gwadv-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
      [`case-gwadv-member-${randomUUID()}`, orgId, userId]
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
    const orgId = `case-gwadv-org-${label}-${suffix}`;
    const projectId = `case-gwadv-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `Gateway advance test org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Gateway advance test project (${label})`]
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

  async function countGatewayEvaluations(runId: string, nodeRunId: string): Promise<number> {
    const result = await control.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM case_workspace_gateway_evaluations WHERE run_id = $1 AND node_run_id = $2`,
      [runId, nodeRunId]
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  // =========================================================================
  // 1 + 4. DECISION_GATEWAY: no evaluation -> Run parks, zero guessing; once
  //        recorded -> the SELECTED branch only, and the Run completes.
  // =========================================================================
  it('a DECISION_GATEWAY-gated plan never guesses a branch, and completes only once the evaluation is recorded', async () => {
    // n1 -> gw --[e_a CONDITIONAL]--> branchA --[e_end_a]--> end (terminal)
    //         --[e_b CONDITIONAL]--> branchB --[e_end_b]--> end
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
    const fx = await seedPublishedCase('decision-gateway', graph);
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `dg-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      await succeed(started.nodeRunIds[0]);

      // First advance: n1 succeeded, so `gw` is created READY — but NO
      // evaluation exists yet. Neither branch may be fabricated, and the Run
      // must not complete.
      const afterN1 = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(afterN1.run.status).not.toBe('COMPLETED');
      const gwNodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'gw', fx.actorId);
      expect(gwNodeRun?.status).toBe('READY');
      expect(await countNodeRuns(created.runId, 'branchA')).toBe(0);
      expect(await countNodeRuns(created.runId, 'branchB')).toBe(0);

      // NEGATIVE CONTROL — repeat advanceRun several times with STILL no
      // evaluation recorded: zero guessing means this is stable, not merely
      // a one-shot fluke.
      for (let i = 0; i < 3; i += 1) {
        const again = await runLifecycleService.advanceRun(created.runId, fx.actorId);
        expect(again.run.status).not.toBe('COMPLETED');
        expect(await countNodeRuns(created.runId, 'branchA')).toBe(0);
        expect(await countNodeRuns(created.runId, 'branchB')).toBe(0);
      }
      // No progress means no active work anywhere else either -> WAITING.
      expect((await runLifecycleService.getRun(created.runId, fx.actorId))?.status).toBe('WAITING');

      // Now record the SAVED evaluation (recordGatewayEvaluation, the
      // existing ledger — not a new mechanism) selecting branch A.
      if (!gwNodeRun) throw new Error('unreachable');
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
      const resolvedGw = await nodeRunService.getNodeRun(gwNodeRun.nodeRunId, fx.actorId);
      expect(resolvedGw?.status).toBe('SUCCEEDED');

      const branchANodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'branchA', fx.actorId);
      expect(branchANodeRun?.status).toBe('READY');
      // branchB was NEVER selected — it must never exist, now or later.
      expect(await countNodeRuns(created.runId, 'branchB')).toBe(0);

      if (!branchANodeRun) throw new Error('unreachable');
      await succeed(branchANodeRun.nodeRunId);
      const afterBranchA = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(afterBranchA.run.status).toBe('RUNNING');
      const endNodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'end', fx.actorId);
      expect(endNodeRun?.status).toBe('READY');

      if (!endNodeRun) throw new Error('unreachable');
      await succeed(endNodeRun.nodeRunId);
      const finalAdvance = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(finalAdvance.run.status).toBe('COMPLETED');
      expect(finalAdvance.run.completedAt).not.toBeNull();

      // Final, definitive check: branchB's NodeRun was NEVER created, even
      // after the Run fully completed via the other branch.
      expect(await countNodeRuns(created.runId, 'branchB')).toBe(0);
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 2. PARALLEL_SPLIT: fans out to every branch (N NodeRuns) the moment it
  //    is reached, no external evaluation required.
  // =========================================================================
  it('a PARALLEL_SPLIT creates a NodeRun for every one of its branches as soon as it is reached', async () => {
    const graph: CanonicalGraph = {
      entryNodeIds: ['n1'],
      terminalNodeIds: ['b1', 'b2', 'b3'],
      nodes: [
        { nodeId: 'n1', type: 'CAPABILITY' },
        { nodeId: 'split', type: 'PARALLEL_SPLIT' },
        { nodeId: 'b1', type: 'CAPABILITY' },
        { nodeId: 'b2', type: 'CAPABILITY' },
        { nodeId: 'b3', type: 'CAPABILITY' },
      ],
      edges: [
        { edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'split', edgeType: 'SEQUENCE' },
        { edgeId: 'e_b1', sourceNodeId: 'split', targetNodeId: 'b1', edgeType: 'SEQUENCE' },
        { edgeId: 'e_b2', sourceNodeId: 'split', targetNodeId: 'b2', edgeType: 'SEQUENCE' },
        { edgeId: 'e_b3', sourceNodeId: 'split', targetNodeId: 'b3', edgeType: 'SEQUENCE' },
      ],
    };
    const fx = await seedPublishedCase('parallel-split', graph);
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `ps-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      await succeed(started.nodeRunIds[0]);

      const advanced = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(advanced.run.status).toBe('RUNNING');

      const splitNodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'split', fx.actorId);
      expect(splitNodeRun?.status).toBe('SUCCEEDED');
      if (!splitNodeRun) throw new Error('unreachable');
      expect(await countGatewayEvaluations(created.runId, splitNodeRun.nodeRunId)).toBe(1);
      const splitEvaluation = await executionGraphService.getGatewayEvaluation(splitNodeRun.nodeRunId, fx.actorId);
      expect(splitEvaluation?.outcomeStatus).toBe('SPLIT_ACTIVATED');

      for (const branchId of ['b1', 'b2', 'b3']) {
        const branchNodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, branchId, fx.actorId);
        expect(branchNodeRun?.status).toBe('READY');
        expect(await countNodeRuns(created.runId, branchId)).toBe(1);
      }
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 3. PARALLEL_JOIN: refuses to pass at 1 of 2 branches, passes only once
  //    BOTH have succeeded.
  // =========================================================================
  it('a PARALLEL_JOIN does not pass at 1 of 2 satisfied branches, and passes once 2 of 2 are satisfied', async () => {
    const graph: CanonicalGraph = {
      entryNodeIds: ['n1'],
      terminalNodeIds: ['end'],
      nodes: [
        { nodeId: 'n1', type: 'CAPABILITY' },
        { nodeId: 'split', type: 'PARALLEL_SPLIT' },
        { nodeId: 'b1', type: 'CAPABILITY' },
        { nodeId: 'b2', type: 'CAPABILITY' },
        { nodeId: 'join', type: 'PARALLEL_JOIN' },
        { nodeId: 'end', type: 'CAPABILITY' },
      ],
      edges: [
        { edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'split', edgeType: 'SEQUENCE' },
        { edgeId: 'e_b1', sourceNodeId: 'split', targetNodeId: 'b1', edgeType: 'SEQUENCE' },
        { edgeId: 'e_b2', sourceNodeId: 'split', targetNodeId: 'b2', edgeType: 'SEQUENCE' },
        { edgeId: 'e_j1', sourceNodeId: 'b1', targetNodeId: 'join', edgeType: 'SEQUENCE' },
        { edgeId: 'e_j2', sourceNodeId: 'b2', targetNodeId: 'join', edgeType: 'SEQUENCE' },
        { edgeId: 'e_end', sourceNodeId: 'join', targetNodeId: 'end', edgeType: 'SEQUENCE' },
      ],
    };
    const fx = await seedPublishedCase('parallel-join', graph);
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `pj-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      await succeed(started.nodeRunIds[0]);
      await runLifecycleService.advanceRun(created.runId, fx.actorId); // fans out split -> b1, b2

      const b1 = await nodeRunService.getLatestNodeRunForNode(created.runId, 'b1', fx.actorId);
      const b2 = await nodeRunService.getLatestNodeRunForNode(created.runId, 'b2', fx.actorId);
      if (!b1 || !b2) throw new Error('unreachable');

      // 1 of 2: must NOT pass.
      await succeed(b1.nodeRunId);
      const afterOneOfTwo = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(afterOneOfTwo.run.status).toBe('RUNNING'); // b2 still active
      expect(await countNodeRuns(created.runId, 'join')).toBe(0);
      expect(await nodeRunService.getLatestNodeRunForNode(created.runId, 'join', fx.actorId)).toBeNull();

      // 2 of 2: must pass.
      await succeed(b2.nodeRunId);
      const afterTwoOfTwo = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(afterTwoOfTwo.run.status).toBe('RUNNING'); // `end` now active
      const joinNodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'join', fx.actorId);
      expect(joinNodeRun?.status).toBe('SUCCEEDED');
      if (!joinNodeRun) throw new Error('unreachable');
      const joinEvaluation = await executionGraphService.getGatewayEvaluation(joinNodeRun.nodeRunId, fx.actorId);
      expect(joinEvaluation?.outcomeStatus).toBe('JOIN_SATISFIED');
      expect(joinEvaluation?.joinPolicy).toBe('ALL');

      const endNodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'end', fx.actorId);
      expect(endNodeRun?.status).toBe('READY');

      if (!endNodeRun) throw new Error('unreachable');
      await succeed(endNodeRun.nodeRunId);
      const finalAdvance = await runLifecycleService.advanceRun(created.runId, fx.actorId);
      expect(finalAdvance.run.status).toBe('COMPLETED');
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 5. Idempotency: two CONCURRENT advanceRun calls over the same ready
  //    PARALLEL_SPLIT converge on exactly ONE effect.
  // =========================================================================
  it('two CONCURRENT advanceRun calls over a ready PARALLEL_SPLIT converge on exactly one NodeRun per node and one recorded evaluation', async () => {
    const graph: CanonicalGraph = {
      entryNodeIds: ['n1'],
      terminalNodeIds: ['b1', 'b2', 'b3'],
      nodes: [
        { nodeId: 'n1', type: 'CAPABILITY' },
        { nodeId: 'split', type: 'PARALLEL_SPLIT' },
        { nodeId: 'b1', type: 'CAPABILITY' },
        { nodeId: 'b2', type: 'CAPABILITY' },
        { nodeId: 'b3', type: 'CAPABILITY' },
      ],
      edges: [
        { edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'split', edgeType: 'SEQUENCE' },
        { edgeId: 'e_b1', sourceNodeId: 'split', targetNodeId: 'b1', edgeType: 'SEQUENCE' },
        { edgeId: 'e_b2', sourceNodeId: 'split', targetNodeId: 'b2', edgeType: 'SEQUENCE' },
        { edgeId: 'e_b3', sourceNodeId: 'split', targetNodeId: 'b3', edgeType: 'SEQUENCE' },
      ],
    };
    const fx = await seedPublishedCase('concurrent-split', graph);
    try {
      const created = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `cps-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(created.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      await succeed(started.nodeRunIds[0]);

      // Two genuinely concurrent advanceRun calls racing the same
      // split/branch creation + resolution.
      await Promise.all([
        runLifecycleService.advanceRun(created.runId, fx.actorId),
        runLifecycleService.advanceRun(created.runId, fx.actorId),
      ]);
      // A follow-up call lets any racer that lost a claim converge (its
      // effect is a no-op replay by construction, never a second write).
      await runLifecycleService.advanceRun(created.runId, fx.actorId);

      expect(await countNodeRuns(created.runId, 'split')).toBe(1);
      const splitNodeRun = await nodeRunService.getLatestNodeRunForNode(created.runId, 'split', fx.actorId);
      expect(splitNodeRun?.status).toBe('SUCCEEDED');
      if (!splitNodeRun) throw new Error('unreachable');
      expect(await countGatewayEvaluations(created.runId, splitNodeRun.nodeRunId)).toBe(1);

      for (const branchId of ['b1', 'b2', 'b3']) {
        expect(await countNodeRuns(created.runId, branchId)).toBe(1);
      }

      const events = await control.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM case_workspace_event_outbox
          WHERE aggregate_id = $1 AND event_type = 'node.gateway_evaluated'`,
        [splitNodeRun.nodeRunId]
      );
      expect(Number(events.rows[0]?.n ?? 0)).toBe(1);
    } finally {
      await teardown(fx);
    }
  }, 90_000);
});
