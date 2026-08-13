/**
 * Case Workspace — Execution Graph service, proved against a REAL PostgreSQL
 * (CW-P10, EPIC E9 "advanced execution graph"). Exercises
 * server/src/services/caseWorkspace/executionGraphService.ts against the
 * schema in
 * server/migrations/20260809_case_workspace_execution_graph.sql.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same convention as runBindingService.pg.test.ts (CW-P04),
 * caseCoreService.pg.test.ts (CW-P01) and casePlanVersionService.pg.test.ts
 * (CW-P02): `NODE_ENV=test` ALONE is a trap — `Database.ts`'s
 * `getDatabase()`/`createDatabase()` hand back an in-memory MOCK whenever
 * `RUN_DB_TESTS !== '1'` (or `MOCK_DB` isn't explicitly `'false'`), and every
 * write silently becomes a no-op. This file follows the `*.pg.test.ts`
 * convention: gate on `RUN_DB_TESTS === '1' && MOCK_DB === 'false'`, probe
 * reachability AND that the migrated schema is actually present before
 * deciding, and SKIP LOUDLY (never silently pass) when either is missing.
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/executionGraphService.pg.test.ts
 *
 * ===========================================================================
 * ISOLATION — every test owns its own organization/project/case_core/
 * v8_execution_runs/case_plan_versions/case_workspace_run_bindings fixtures
 * ===========================================================================
 * `case_workspace_gateway_evaluations` and
 * `case_workspace_node_result_acceptances` both FK to
 * `case_core(case_id)` and `case_workspace_run_bindings(run_id)`.
 * executionGraphService.ts only ever SELECTs those two tables — it has no
 * create-helper for either — so, exactly like runBindingService.pg.test.ts,
 * tests build a real bound run via the full
 * seedOrgProjectCase -> publishedPlanVersion -> seedV8Run ->
 * runBindingService.bindRunToPlanVersion chain before ever calling
 * executionGraphService.
 *
 * Every test seeds its own fixtures inside the test body (never a shared
 * beforeEach) and tears them down itself in a `finally`, so no test can
 * observe, reset, or race another test's rows. Teardown order matters:
 * `case_workspace_node_result_acceptances` rows must be deleted before
 * `case_workspace_gateway_evaluations` rows (the former's
 * `caused_by_gateway_node_run_id` FKs into the latter, no ON DELETE clause),
 * both must be deleted before `case_workspace_run_bindings`, which must be
 * deleted before `v8_execution_runs`/`case_core` — see the migration file's
 * header.
 *
 * DB-CHECK-constraint assertions (recordGatewayEvaluation's/
 * recordNodeResultAcceptance's own conflict paths aside) are proved with raw
 * SQL INSERTs issued directly against the out-of-band `pg.Pool` (`control`),
 * NOT through the service — this proves the constraints exist independently
 * of application logic, per the migration file's own CHECK definitions
 * (case_workspace_gateway_evaluations_join_policy_node_type,
 * case_workspace_gateway_evaluations_join_required_count_policy,
 * case_workspace_node_result_acceptances_skip_authorization_required). Raw
 * SQL INSERTs bypass the service entirely, so they need no actor fixture.
 *
 * All assertions read the actual rows back out of Postgres through `control`
 * — never the service function's return value alone — because the return
 * value only proves what the service THINKS it wrote, not what actually
 * landed.
 *
 * ===========================================================================
 * AUTHORIZATION (CW-P12 retrofit) — every actor is a real, membered user
 * ===========================================================================
 * executionGraphService.ts now gates recordGatewayEvaluation/
 * recordNodeResultAcceptance (create class) and
 * getGatewayEvaluation/listGatewayEvaluationsForRun/
 * listGatewayEvaluationsForCase/getNodeResultAcceptance/
 * listNodeResultAcceptancesForRun/listNodeResultAcceptancesForCase (read/list
 * class) through caseWorkspaceAuthContext.ts's requireCaseAccess. Every
 * actor id used through the SERVICE below (never the raw-SQL CHECK-
 * constraint tests, which bypass the service) is a real `users` row with a
 * matching ACTIVE `organization_members` row for the Case's org.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import * as casePlanVersionService from '../casePlanVersionService.js';
import type { CanonicalGraph, CasePlanVersion } from '../casePlanVersionService.js';
import * as executionGraphService from '../executionGraphService.js';
import * as runBindingService from '../runBindingService.js';

/**
 * ===========================================================================
 * ROLLBACK HARNESS — how "a forced failure after the mutation leaves NO
 * outbox row" is proved without touching shared schema
 * ===========================================================================
 * EVENT_TAXONOMY §6.6 requires each command's realDB suite to prove both
 * directions of the atomicity claim: one outbox row on success, and ZERO
 * after a forced failure. Proving the second direction needs a failure that
 * happens strictly AFTER the aggregate write AND after the outbox INSERT —
 * anything that fails earlier proves nothing (the outbox would be empty for
 * the trivial reason that publishEvent never ran).
 *
 * The mechanism is a pass-through module mock: `publishEvent` calls the REAL
 * implementation on the service's own transaction client (so a genuine outbox
 * row really is written inside the transaction), and only then, when armed,
 * throws. withPgTransaction's catch issues ROLLBACK, and the assertion is
 * that Postgres — read afterwards on a SEPARATE out-of-band connection —
 * holds neither the event nor the mutation.
 *
 * A Postgres trigger on `case_workspace_event_outbox` would prove the same
 * thing, but that table is shared with every other suite running against this
 * database, and CREATE TRIGGER takes an ACCESS EXCLUSIVE lock on it. The mock
 * is process-local: it can never affect another suite. The wrapper is inert
 * (`armed === false`) for every other test in this file.
 */
const outboxBoom = vi.hoisted(() => ({ armed: false }));

vi.mock('../eventOutboxService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../eventOutboxService.js')>();
  return {
    ...actual,
    publishEvent: async (
      client: Parameters<typeof actual.publishEvent>[0],
      envelope: Parameters<typeof actual.publishEvent>[1]
    ) => {
      const published = await actual.publishEvent(client, envelope);
      if (outboxBoom.armed) throw new Error('cw_test_forced_failure_after_publish');
      return published;
    },
  };
});

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

/** Reachability AND schema presence are decided once, before the suite is declared. */
const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const bindingsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_run_bindings'
          AND column_name IN ('run_id', 'case_plan_version_id', 'case_id', 'organization_id',
                               'graph_digest', 'bound_by_actor_id', 'created_at')`
    );
    const bindingsOk = Number(bindingsResult.rows[0]?.present ?? 0) === 7;

    const runsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'v8_execution_runs'
          AND column_name IN ('run_id', 'organization_id', 'context_snapshot_id',
                               'initiator_user_id', 'state', 'goal')`
    );
    const runsOk = Number(runsResult.rows[0]?.present ?? 0) === 6;

    const gatewayResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_gateway_evaluations'
          AND column_name IN ('node_run_id', 'organization_id', 'case_id', 'run_id',
                               'gateway_node_type', 'join_policy', 'join_required_count',
                               'join_branch_total_count', 'condition_expression',
                               'condition_schema_version', 'evaluation_input_snapshot',
                               'evaluation_input_digest', 'outcome_status', 'outcome_detail',
                               'evaluated_at', 'recorded_at', 'recorded_by_actor_id')`
    );
    const gatewayOk = Number(gatewayResult.rows[0]?.present ?? 0) === 17;

    const acceptancesResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_node_result_acceptances'
          AND column_name IN ('node_run_id', 'organization_id', 'case_id', 'run_id', 'node_type',
                               'node_completion_state', 'result_acceptance',
                               'skip_authorized_by_graph_condition', 'skip_condition_ref',
                               'caused_by_gateway_node_run_id', 'acceptance_input_snapshot',
                               'acceptance_input_digest', 'occurred_at', 'recorded_at',
                               'recorded_by_actor_id')`
    );
    const acceptancesOk = Number(acceptancesResult.rows[0]?.present ?? 0) === 15;

    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    const orgMembersOk = Number(orgMembersResult.rows[0]?.present ?? 0) === 4;

    return bindingsOk && runsOk && gatewayOk && acceptancesOk && orgMembersOk;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[executionGraphService pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260809_case_workspace_execution_graph.sql migration applied (on top of ` +
      `20260809_case_workspace_case_core.sql, 20260809_case_workspace_case_plan_version.sql, ` +
      `20260809_case_workspace_run_binding.sql and 20260323_v8_execution_spine_00base.sql). ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface GatewayEvaluationDbRow {
  node_run_id: string;
  organization_id: string;
  project_id: string | null;
  case_id: string;
  run_id: string;
  gateway_node_type: string;
  join_policy: string | null;
  join_required_count: number | null;
  join_branch_total_count: number | null;
  condition_expression: string | null;
  condition_schema_version: string | null;
  evaluation_input_snapshot: string;
  evaluation_input_digest: string;
  outcome_status: string;
  outcome_detail: string;
  evaluated_at: string;
  recorded_at: string;
  recorded_by_actor_id: string;
}

interface NodeResultAcceptanceDbRow {
  node_run_id: string;
  organization_id: string;
  project_id: string | null;
  case_id: string;
  run_id: string;
  node_type: string;
  node_completion_state: string;
  result_acceptance: string;
  skip_authorized_by_graph_condition: boolean | null;
  skip_condition_ref: string | null;
  caused_by_gateway_node_run_id: string | null;
  acceptance_input_snapshot: string;
  acceptance_input_digest: string;
  occurred_at: string;
  recorded_at: string;
  recorded_by_actor_id: string;
}

/** One `case_workspace_event_outbox` row, read back out-of-band. */
interface OutboxDbRow {
  event_id: string;
  event_type: string;
  schema_version: number;
  organization_id: string;
  project_id: string | null;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number | null;
  case_id: string | null;
  run_id: string | null;
  node_run_id: string | null;
  actor_user_id: string;
  correlation_id: string;
  causation_id: string | null;
  redacted_summary: Record<string, unknown>;
  payload_ref: string | null;
  delivered_at: string | null;
}

suite('executionGraphService — Execution Graph against a real PostgreSQL (CW-P10, E9)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Fixture helpers — every test calls these itself, never a shared hook.
  // -------------------------------------------------------------------------

  /** A fresh users row, unattached to organization_members unless seedMember() is also called for it. */
  async function seedUser(orgId: string, label: string): Promise<string> {
    const userId = `case-execgraph-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    return userId;
  }

  /** An organization_members row for an existing user, at the given role/status. */
  async function seedMember(
    orgId: string,
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT',
    status: 'ACTIVE' | 'REVOKED' | 'SUSPENDED' = 'ACTIVE'
  ): Promise<void> {
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, $4, $5)`,
      [`case-execgraph-member-${randomUUID()}`, orgId, userId, role, status]
    );
  }

  /** Convenience: seed a user AND an ACTIVE membership at MEMBER role in one call. */
  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = await seedUser(orgId, label);
    await seedMember(orgId, userId, 'MEMBER');
    return userId;
  }

  /**
   * A fresh organization + project + case_core row, plus a real membered
   * actor to create the Case with. Same bundle as
   * runBindingService.pg.test.ts's seedOrgProjectCase().
   */
  async function seedOrgProjectCase(
    label: string
  ): Promise<{ orgId: string; projectId: string; caseId: string; actorId: string }> {
    const suffix = randomUUID();
    const orgId = `case-execgraph-org-${label}-${suffix}`;
    const projectId = `case-execgraph-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `Execution Graph test org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Execution Graph test project (${label})`]
    );
    const actorId = await seedMemberedUser(orgId, label);
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: actorId,
    });
    return { orgId, projectId, caseId: created.caseId, actorId };
  }

  /**
   * TEST-FIXTURE-ONLY direct INSERT into v8_execution_runs via the
   * out-of-band control Pool — same helper/contract as
   * runBindingService.pg.test.ts's seedV8Run(). executionGraphService.ts
   * never touches this table itself.
   */
  async function seedV8Run(params: {
    runId: string;
    organizationId: string;
    goal?: string;
  }): Promise<void> {
    await control.query(
      `INSERT INTO v8_execution_runs (run_id, organization_id, context_snapshot_id, initiator_user_id, goal)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (run_id) DO NOTHING`,
      [
        params.runId,
        params.organizationId,
        `ctx-snapshot-${params.runId}`,
        `initiator-${params.runId}`,
        params.goal ?? `goal for ${params.runId}`,
      ]
    );
  }

  /**
   * Full draft -> propose -> publish cycle via casePlanVersionService,
   * returning the PUBLISHED CasePlanVersion — same helper as
   * runBindingService.pg.test.ts's publishedPlanVersion().
   */
  async function publishedPlanVersion(params: {
    caseId: string;
    tag: string;
    actorId: string;
  }): Promise<CasePlanVersion> {
    const graph: CanonicalGraph = {
      schemaVersion: '1',
      graphId: `graph-${params.tag}`,
      entryNodeIds: ['n1'],
      terminalNodeIds: ['n2'],
      nodes: [
        { nodeId: 'n1', type: 'TASK', metadata: { tag: params.tag } },
        { nodeId: 'n2', type: 'TASK' },
      ],
      edges: [{ edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', edgeType: 'SEQUENCE' }],
    };
    const draft = await casePlanVersionService.createPlanDraft({
      caseId: params.caseId,
      semanticGraph: graph,
      createdByActorId: params.actorId,
    });
    const proposed = await casePlanVersionService.proposePlanVersion(
      draft.casePlanVersionId,
      { actorUserId: params.actorId },
      draft.version
    );
    return casePlanVersionService.publishPlanVersion(
      draft.casePlanVersionId,
      { actorUserId: params.actorId },
      proposed.version
    );
  }

  /**
   * Full org/project/case + published plan version + bound v8_execution_run,
   * end to end — the exact fixture chain this task calls for (seedOrgProjectCase,
   * seedV8Run, publish a plan version, then runBindingService.bindRunToPlanVersion)
   * so the new CW-P10 tables have a real run_id to FK against. `actorId` is
   * a real membered user in the Case's org, reusable for
   * recordGatewayEvaluation/recordNodeResultAcceptance calls in the same
   * test (CW-P12 requireCaseAccess gate).
   */
  async function seedCaseWithBoundRun(label: string): Promise<{
    orgId: string;
    projectId: string;
    caseId: string;
    runId: string;
    actorId: string;
  }> {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase(label);
    const planVersion = await publishedPlanVersion({
      caseId,
      tag: label,
      actorId,
    });
    const runId = `run-execgraph-${label}-${randomUUID()}`;
    await seedV8Run({ runId, organizationId: orgId });
    await runBindingService.bindRunToPlanVersion({
      runId,
      casePlanVersionId: planVersion.casePlanVersionId,
      boundByActorId: actorId,
    });
    return { orgId, projectId, caseId, runId, actorId };
  }

  async function readGatewayEvaluationRows(nodeRunId: string): Promise<GatewayEvaluationDbRow[]> {
    const result = await control.query<GatewayEvaluationDbRow>(
      `SELECT * FROM case_workspace_gateway_evaluations WHERE node_run_id = $1`,
      [nodeRunId]
    );
    return result.rows;
  }

  /**
   * Outbox rows for one aggregate, read on the out-of-band `control` pool —
   * NEVER from publishEvent's return value, which only proves what the
   * service THINKS it wrote. Scoped by aggregate_id (never a global count):
   * this database is shared with other suites, some of which write to the
   * same table.
   */
  async function readOutboxRowsForAggregate(aggregateId: string): Promise<OutboxDbRow[]> {
    const result = await control.query<OutboxDbRow>(
      `SELECT event_id, event_type, schema_version, organization_id, project_id,
              aggregate_type, aggregate_id, aggregate_version, case_id, run_id,
              node_run_id, actor_user_id, correlation_id, causation_id,
              redacted_summary, payload_ref, delivered_at
         FROM case_workspace_event_outbox
        WHERE aggregate_id = $1
        ORDER BY created_at ASC, aggregate_version ASC NULLS LAST`,
      [aggregateId]
    );
    return result.rows;
  }

  async function readNodeResultAcceptanceRows(
    nodeRunId: string
  ): Promise<NodeResultAcceptanceDbRow[]> {
    const result = await control.query<NodeResultAcceptanceDbRow>(
      `SELECT * FROM case_workspace_node_result_acceptances WHERE node_run_id = $1`,
      [nodeRunId]
    );
    return result.rows;
  }

  /**
   * Teardown order matters: node_result_acceptances (its
   * caused_by_gateway_node_run_id FK has no ON DELETE clause) before
   * gateway_evaluations, both before run_bindings (no ON DELETE clause on
   * either of its FKs either — see runBindingService.pg.test.ts's own
   * teardown), then v8_execution_runs, then users, then case_core (cascades
   * to case_plan_versions/case_plan_view_state), then projects, then
   * organizations.
   */
  async function teardown(params: {
    runIds: string[];
    orgIds: string[];
    projectIds: string[];
    userIds?: string[];
  }): Promise<void> {
    if (params.runIds.length > 0) {
      await control
        .query(`DELETE FROM case_workspace_node_result_acceptances WHERE run_id = ANY($1)`, [
          params.runIds,
        ])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM case_workspace_gateway_evaluations WHERE run_id = ANY($1)`, [
          params.runIds,
        ])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM case_workspace_run_bindings WHERE run_id = ANY($1)`, [params.runIds])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM v8_execution_runs WHERE run_id = ANY($1)`, [params.runIds])
        .catch(() => undefined);
    }
    for (const projectId of params.projectIds) {
      await control.query(`DELETE FROM case_core WHERE project_id = $1`, [projectId]).catch(() => undefined);
      await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    }
    for (const userId of params.userIds ?? []) {
      await control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    }
    for (const orgId of params.orgIds) {
      // The outbox has no FK to organizations, so nothing cascades it away.
      // Every event this suite emits is org-scoped, so deleting by
      // organization_id removes exactly this test's rows and nothing else.
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
  }

  // -------------------------------------------------------------------------
  // 1. recordGatewayEvaluation — idempotent replay on identical input,
  //    determinism-conflict rejection on differing input, DB shows exactly
  //    one row throughout.
  // -------------------------------------------------------------------------
  it('recordGatewayEvaluation creates one row, idempotently replays an identical-digest resubmission, and rejects a differing-digest resubmission for the same node_run_id leaving the original row unchanged', async () => {
    const fixture = await seedCaseWithBoundRun('gw-idempotency');
    const runIds = [fixture.runId];
    const secondActor = await seedMemberedUser(fixture.orgId, 'gw-idempotency-second');
    try {
      const nodeRunId = `node-gw-idempotency-${randomUUID()}`;
      const evaluatedAt = new Date().toISOString();

      const first = await executionGraphService.recordGatewayEvaluation({
        nodeRunId,
        runId: fixture.runId,
        gatewayNodeType: 'DECISION_GATEWAY',
        conditionExpression: 'input.value > 0',
        conditionSchemaVersion: 'v1',
        evaluationInputSnapshot: { value: 42 },
        outcomeStatus: 'BRANCH_SELECTED',
        outcomeDetail: { selectedEdgeId: 'e1' },
        evaluatedAt,
        recordedByActorId: fixture.actorId,
      });
      expect(first.nodeRunId).toBe(nodeRunId);
      expect(first.runId).toBe(fixture.runId);
      expect(first.caseId).toBe(fixture.caseId);
      expect(first.organizationId).toBe(fixture.orgId);
      expect(first.outcomeStatus).toBe('BRANCH_SELECTED');
      expect(first.recordedByActorId).toBe(fixture.actorId);

      const rowsAfterFirst = await readGatewayEvaluationRows(nodeRunId);
      expect(rowsAfterFirst).toHaveLength(1);
      expect(rowsAfterFirst[0].evaluation_input_digest).toBe(first.evaluationInputDigest);

      // Second call: SAME node_run_id, SAME evaluation input -> idempotent
      // replay. Digest is unchanged; only the actor differs on this call, to
      // prove the replay returns the ORIGINAL recorded fact, not a new write.
      const replay = await executionGraphService.recordGatewayEvaluation({
        nodeRunId,
        runId: fixture.runId,
        gatewayNodeType: 'DECISION_GATEWAY',
        conditionExpression: 'input.value > 0',
        conditionSchemaVersion: 'v1',
        evaluationInputSnapshot: { value: 42 },
        outcomeStatus: 'BRANCH_SELECTED',
        outcomeDetail: { selectedEdgeId: 'e1' },
        evaluatedAt,
        recordedByActorId: secondActor,
      });
      expect(replay.nodeRunId).toBe(nodeRunId);
      expect(replay.evaluationInputDigest).toBe(first.evaluationInputDigest);
      expect(replay.recordedByActorId).toBe(fixture.actorId);
      expect(replay.recordedAt).toBe(first.recordedAt);

      const rowsAfterReplay = await readGatewayEvaluationRows(nodeRunId);
      expect(rowsAfterReplay).toHaveLength(1);
      expect(rowsAfterReplay[0].recorded_by_actor_id).toBe(fixture.actorId);

      // Third call: SAME node_run_id, DIFFERENT evaluation input (different
      // digest) -> hard rejection as a determinism conflict.
      await expect(
        executionGraphService.recordGatewayEvaluation({
          nodeRunId,
          runId: fixture.runId,
          gatewayNodeType: 'DECISION_GATEWAY',
          conditionExpression: 'input.value > 0',
          conditionSchemaVersion: 'v1',
          evaluationInputSnapshot: { value: 999 },
          outcomeStatus: 'BRANCH_SELECTED',
          outcomeDetail: { selectedEdgeId: 'e1' },
          evaluatedAt,
          recordedByActorId: secondActor,
        })
      ).rejects.toThrow(/gateway_evaluation_determinism_conflict/);

      const rowsAfterConflict = await readGatewayEvaluationRows(nodeRunId);
      expect(rowsAfterConflict).toHaveLength(1);
      expect(rowsAfterConflict[0].evaluation_input_digest).toBe(first.evaluationInputDigest);
      expect(rowsAfterConflict[0].recorded_by_actor_id).toBe(fixture.actorId);
    } finally {
      await teardown({
        runIds,
        orgIds: [fixture.orgId],
        projectIds: [fixture.projectId],
        userIds: [fixture.actorId, secondActor],
      });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 2. DB CHECK constraints on case_workspace_gateway_evaluations, proved via
  //    raw SQL INSERT against the out-of-band pool — independent of
  //    executionGraphService's own code-level validation. Raw SQL bypasses
  //    the service entirely, so no actor fixture is needed for these.
  // -------------------------------------------------------------------------
  it('DB CHECK rejects a raw INSERT with gateway_node_type=DECISION_GATEWAY and a non-null join_policy', async () => {
    const fixture = await seedCaseWithBoundRun('gw-check-join-policy-node-type');
    const runIds = [fixture.runId];
    try {
      const nodeRunId = `node-gw-check-a-${randomUUID()}`;
      let caught: (Error & { code?: string; constraint?: string }) | null = null;
      try {
        await control.query(
          `INSERT INTO case_workspace_gateway_evaluations (
             node_run_id, organization_id, project_id, case_id, run_id,
             gateway_node_type, join_policy, join_required_count,
             join_branch_total_count, condition_expression,
             condition_schema_version, evaluation_input_snapshot,
             evaluation_input_digest, outcome_status, outcome_detail,
             evaluated_at, recorded_by_actor_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            nodeRunId,
            fixture.orgId,
            null,
            fixture.caseId,
            fixture.runId,
            'DECISION_GATEWAY',
            'ALL', // non-null join_policy on a DECISION_GATEWAY row -> must be rejected
            null,
            null,
            null,
            null,
            JSON.stringify({ value: 1 }),
            'sha256:raw-insert-check-a',
            'BRANCH_SELECTED',
            '{}',
            new Date().toISOString(),
            'actor-raw-check-a',
          ]
        );
      } catch (err) {
        caught = err as Error & { code?: string; constraint?: string };
      }
      expect(caught).not.toBeNull();
      expect(caught?.code).toBe('23514'); // Postgres check_violation
      expect(caught?.constraint).toBe('case_workspace_gateway_evaluations_join_policy_node_type');

      const rows = await readGatewayEvaluationRows(nodeRunId);
      expect(rows).toHaveLength(0);
    } finally {
      await teardown({ runIds, orgIds: [fixture.orgId], projectIds: [fixture.projectId], userIds: [fixture.actorId] });
    }
  }, 30_000);

  it('DB CHECK rejects a raw INSERT with join_policy=ALL and a non-null join_required_count', async () => {
    const fixture = await seedCaseWithBoundRun('gw-check-join-required-count-policy');
    const runIds = [fixture.runId];
    try {
      const nodeRunId = `node-gw-check-b-${randomUUID()}`;
      let caught: (Error & { code?: string; constraint?: string }) | null = null;
      try {
        await control.query(
          `INSERT INTO case_workspace_gateway_evaluations (
             node_run_id, organization_id, project_id, case_id, run_id,
             gateway_node_type, join_policy, join_required_count,
             join_branch_total_count, condition_expression,
             condition_schema_version, evaluation_input_snapshot,
             evaluation_input_digest, outcome_status, outcome_detail,
             evaluated_at, recorded_by_actor_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            nodeRunId,
            fixture.orgId,
            null,
            fixture.caseId,
            fixture.runId,
            'PARALLEL_JOIN', // satisfies join_policy_node_type CHECK
            'ALL',
            2, // non-null join_required_count with join_policy != 'N_OF_M' -> must be rejected
            3,
            null,
            null,
            JSON.stringify({ value: 1 }),
            'sha256:raw-insert-check-b',
            'JOIN_SATISFIED',
            '{}',
            new Date().toISOString(),
            'actor-raw-check-b',
          ]
        );
      } catch (err) {
        caught = err as Error & { code?: string; constraint?: string };
      }
      expect(caught).not.toBeNull();
      expect(caught?.code).toBe('23514');
      expect(caught?.constraint).toBe(
        'case_workspace_gateway_evaluations_join_required_count_policy'
      );

      const rows = await readGatewayEvaluationRows(nodeRunId);
      expect(rows).toHaveLength(0);
    } finally {
      await teardown({ runIds, orgIds: [fixture.orgId], projectIds: [fixture.projectId], userIds: [fixture.actorId] });
    }
  }, 30_000);

  it('DB CHECK accepts a raw INSERT with gateway_node_type=PARALLEL_JOIN, join_policy=N_OF_M and a non-null join_required_count', async () => {
    const fixture = await seedCaseWithBoundRun('gw-check-n-of-m-succeeds');
    const runIds = [fixture.runId];
    try {
      const nodeRunId = `node-gw-check-c-${randomUUID()}`;
      const insertResult = await control.query(
        `INSERT INTO case_workspace_gateway_evaluations (
           node_run_id, organization_id, project_id, case_id, run_id,
           gateway_node_type, join_policy, join_required_count,
           join_branch_total_count, condition_expression,
           condition_schema_version, evaluation_input_snapshot,
           evaluation_input_digest, outcome_status, outcome_detail,
           evaluated_at, recorded_by_actor_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING *`,
        [
          nodeRunId,
          fixture.orgId,
          null,
          fixture.caseId,
          fixture.runId,
          'PARALLEL_JOIN',
          'N_OF_M',
          2,
          3,
          null,
          null,
          JSON.stringify({ value: 1 }),
          'sha256:raw-insert-check-c',
          'JOIN_SATISFIED',
          '{}',
          new Date().toISOString(),
          'actor-raw-check-c',
        ]
      );
      expect(insertResult.rowCount).toBe(1);

      const rows = await readGatewayEvaluationRows(nodeRunId);
      expect(rows).toHaveLength(1);
      expect(rows[0].gateway_node_type).toBe('PARALLEL_JOIN');
      expect(rows[0].join_policy).toBe('N_OF_M');
      expect(rows[0].join_required_count).toBe(2);
      expect(rows[0].join_branch_total_count).toBe(3);
    } finally {
      await teardown({ runIds, orgIds: [fixture.orgId], projectIds: [fixture.projectId], userIds: [fixture.actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 3. recordNodeResultAcceptance creates a row; the DB CHECK
  //    (case_workspace_node_result_acceptances_skip_authorization_required:
  //    "node_completion_state <> 'SKIPPED' OR skip_authorized_by_graph_condition
  //    IS NOT NULL") rejects a raw SKIPPED row with no skip-authorization
  //    field set, regardless of what result_acceptance value is requested.
  // -------------------------------------------------------------------------
  it('recordNodeResultAcceptance creates a row, and the DB CHECK rejects a raw SKIPPED row with skip_authorized_by_graph_condition left NULL', async () => {
    const fixture = await seedCaseWithBoundRun('acc-skip-authorization');
    const runIds = [fixture.runId];
    try {
      const nodeRunId = `node-acc-service-${randomUUID()}`;
      const occurredAt = new Date().toISOString();

      const created = await executionGraphService.recordNodeResultAcceptance({
        nodeRunId,
        runId: fixture.runId,
        nodeType: 'CAPABILITY',
        nodeCompletionState: 'COMPLETED',
        resultAcceptance: 'ACCEPTED',
        acceptanceInputSnapshot: { status: 'ok' },
        occurredAt,
        recordedByActorId: fixture.actorId,
      });
      expect(created.nodeRunId).toBe(nodeRunId);
      expect(created.runId).toBe(fixture.runId);
      expect(created.caseId).toBe(fixture.caseId);
      expect(created.organizationId).toBe(fixture.orgId);
      expect(created.nodeCompletionState).toBe('COMPLETED');
      expect(created.resultAcceptance).toBe('ACCEPTED');

      const createdRows = await readNodeResultAcceptanceRows(nodeRunId);
      expect(createdRows).toHaveLength(1);
      expect(createdRows[0].node_completion_state).toBe('COMPLETED');
      expect(createdRows[0].result_acceptance).toBe('ACCEPTED');

      // Raw SQL: node_completion_state='SKIPPED' with acceptance
      // status='ACCEPTED' and NO skip-authorization fields set at all — per
      // the migration's own CHECK
      // (case_workspace_node_result_acceptances_skip_authorization_required),
      // this must be rejected purely because
      // skip_authorized_by_graph_condition is NULL while
      // node_completion_state='SKIPPED'; the CHECK does not inspect
      // result_acceptance's value at all.
      const skipNodeRunId = `node-acc-check-skip-${randomUUID()}`;
      let caught: (Error & { code?: string; constraint?: string }) | null = null;
      try {
        await control.query(
          `INSERT INTO case_workspace_node_result_acceptances (
             node_run_id, organization_id, project_id, case_id, run_id,
             node_type, node_completion_state, result_acceptance,
             skip_authorized_by_graph_condition, skip_condition_ref,
             caused_by_gateway_node_run_id, acceptance_input_snapshot,
             acceptance_input_digest, occurred_at, recorded_by_actor_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            skipNodeRunId,
            fixture.orgId,
            null,
            fixture.caseId,
            fixture.runId,
            'CAPABILITY',
            'SKIPPED',
            'ACCEPTED', // as specified by the task, regardless of value the CHECK still fires
            null, // skip_authorized_by_graph_condition left unset
            null,
            null,
            JSON.stringify({ status: 'skipped' }),
            'sha256:raw-insert-check-skip',
            occurredAt,
            'actor-raw-check-skip',
          ]
        );
      } catch (err) {
        caught = err as Error & { code?: string; constraint?: string };
      }
      expect(caught).not.toBeNull();
      expect(caught?.code).toBe('23514');
      // Postgres truncates identifiers to 63 bytes (NAMEDATALEN limit), so the
      // constraint's actual name on disk is truncated from
      // "..._skip_authorization_required" to "..._skip_authorization_requi".
      expect(caught?.constraint).toBe(
        'case_workspace_node_result_acceptances_skip_authorization_requi'
      );

      const skipRows = await readNodeResultAcceptanceRows(skipNodeRunId);
      expect(skipRows).toHaveLength(0);

      // The service-created row from earlier in this test must be entirely
      // unaffected by the rejected raw insert attempt.
      const finalCreatedRows = await readNodeResultAcceptanceRows(nodeRunId);
      expect(finalCreatedRows).toHaveLength(1);
    } finally {
      await teardown({ runIds, orgIds: [fixture.orgId], projectIds: [fixture.projectId], userIds: [fixture.actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 4. listGatewayEvaluationsForRun / listGatewayEvaluationsForCase — each
  //    returns exactly the evaluations in its own scope and no others.
  // -------------------------------------------------------------------------
  it('listGatewayEvaluationsForRun and listGatewayEvaluationsForCase each return only evaluations in their own scope', async () => {
    const case1 = await seedCaseWithBoundRun('gw-list-scope-1');
    // A second run bound under the SAME case, so listGatewayEvaluationsForRun
    // must distinguish it from case1's first run while
    // listGatewayEvaluationsForCase aggregates both.
    const case1PlanVersion = await publishedPlanVersion({
      caseId: case1.caseId,
      tag: 'gw-list-scope-1-second-run',
      actorId: case1.actorId,
    });
    const case1SecondRunId = `run-execgraph-gw-list-scope-1-second-${randomUUID()}`;
    await seedV8Run({ runId: case1SecondRunId, organizationId: case1.orgId });
    await runBindingService.bindRunToPlanVersion({
      runId: case1SecondRunId,
      casePlanVersionId: case1PlanVersion.casePlanVersionId,
      boundByActorId: case1.actorId,
    });

    const case2 = await seedCaseWithBoundRun('gw-list-scope-2');

    const runIds = [case1.runId, case1SecondRunId, case2.runId];
    try {
      const nodeRunRun1 = `node-gw-list-run1-${randomUUID()}`;
      await executionGraphService.recordGatewayEvaluation({
        nodeRunId: nodeRunRun1,
        runId: case1.runId,
        gatewayNodeType: 'PARALLEL_SPLIT',
        evaluationInputSnapshot: { branch: 'run1' },
        outcomeStatus: 'SPLIT_ACTIVATED',
        evaluatedAt: new Date().toISOString(),
        recordedByActorId: case1.actorId,
      });

      const nodeRunRun1Second = `node-gw-list-run1-second-${randomUUID()}`;
      await executionGraphService.recordGatewayEvaluation({
        nodeRunId: nodeRunRun1Second,
        runId: case1SecondRunId,
        gatewayNodeType: 'PARALLEL_SPLIT',
        evaluationInputSnapshot: { branch: 'run1-second' },
        outcomeStatus: 'SPLIT_ACTIVATED',
        evaluatedAt: new Date().toISOString(),
        recordedByActorId: case1.actorId,
      });

      const nodeRunRun2 = `node-gw-list-run2-${randomUUID()}`;
      await executionGraphService.recordGatewayEvaluation({
        nodeRunId: nodeRunRun2,
        runId: case2.runId,
        gatewayNodeType: 'DECISION_GATEWAY',
        conditionExpression: 'true',
        conditionSchemaVersion: 'v1',
        evaluationInputSnapshot: { branch: 'run2' },
        outcomeStatus: 'BRANCH_SELECTED',
        evaluatedAt: new Date().toISOString(),
        recordedByActorId: case2.actorId,
      });

      // -- listGatewayEvaluationsForRun scoping: distinguishes case1's two
      //    runs from each other and from case2's run.
      const run1Evaluations = await executionGraphService.listGatewayEvaluationsForRun(
        case1.runId,
        case1.actorId
      );
      expect(run1Evaluations.map((e) => e.nodeRunId)).toEqual([nodeRunRun1]);
      expect(run1Evaluations.every((e) => e.runId === case1.runId)).toBe(true);

      const run1SecondEvaluations = await executionGraphService.listGatewayEvaluationsForRun(
        case1SecondRunId,
        case1.actorId
      );
      expect(run1SecondEvaluations.map((e) => e.nodeRunId)).toEqual([nodeRunRun1Second]);

      const run2Evaluations = await executionGraphService.listGatewayEvaluationsForRun(
        case2.runId,
        case2.actorId
      );
      expect(run2Evaluations.map((e) => e.nodeRunId)).toEqual([nodeRunRun2]);
      expect(run2Evaluations.some((e) => e.nodeRunId === nodeRunRun1)).toBe(false);
      expect(run2Evaluations.some((e) => e.nodeRunId === nodeRunRun1Second)).toBe(false);

      // -- listGatewayEvaluationsForCase scoping: aggregates ALL of case1's
      //    runs, none of case2's.
      const case1Evaluations = await executionGraphService.listGatewayEvaluationsForCase(
        case1.caseId,
        case1.actorId
      );
      expect(case1Evaluations.map((e) => e.nodeRunId).sort()).toEqual(
        [nodeRunRun1, nodeRunRun1Second].sort()
      );
      expect(case1Evaluations.every((e) => e.caseId === case1.caseId)).toBe(true);
      expect(case1Evaluations.some((e) => e.nodeRunId === nodeRunRun2)).toBe(false);

      const case2Evaluations = await executionGraphService.listGatewayEvaluationsForCase(
        case2.caseId,
        case2.actorId
      );
      expect(case2Evaluations.map((e) => e.nodeRunId)).toEqual([nodeRunRun2]);
      expect(
        case2Evaluations.some(
          (e) => e.nodeRunId === nodeRunRun1 || e.nodeRunId === nodeRunRun1Second
        )
      ).toBe(false);

      // Cross-check directly against Postgres too, not just the service's
      // own return values.
      const dbRun2Rows = await control.query<GatewayEvaluationDbRow>(
        `SELECT * FROM case_workspace_gateway_evaluations WHERE run_id = $1`,
        [case2.runId]
      );
      expect(dbRun2Rows.rows.map((r) => r.node_run_id)).toEqual([nodeRunRun2]);

      const dbCase1Rows = await control.query<GatewayEvaluationDbRow>(
        `SELECT * FROM case_workspace_gateway_evaluations WHERE case_id = $1`,
        [case1.caseId]
      );
      expect(dbCase1Rows.rows.map((r) => r.node_run_id).sort()).toEqual(
        [nodeRunRun1, nodeRunRun1Second].sort()
      );
    } finally {
      await teardown({
        runIds,
        orgIds: [case1.orgId, case2.orgId],
        projectIds: [case1.projectId, case2.projectId],
        userIds: [case1.actorId, case2.actorId],
      });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 5. AUTHORIZATION (CW-P12) — recordGatewayEvaluation/
  //    recordNodeResultAcceptance (create class): an actor with no
  //    membership is rejected, creating no row.
  // -------------------------------------------------------------------------
  it('recordGatewayEvaluation and recordNodeResultAcceptance both reject an actor with no organization_members row for the Case\'s org', async () => {
    const fixture = await seedCaseWithBoundRun('auth-create');
    const runIds = [fixture.runId];
    const noMembershipActor = await seedUser(fixture.orgId, 'auth-create-outsider');
    try {
      const gatewayNodeRunId = `node-auth-create-gw-${randomUUID()}`;
      await expect(
        executionGraphService.recordGatewayEvaluation({
          nodeRunId: gatewayNodeRunId,
          runId: fixture.runId,
          gatewayNodeType: 'PARALLEL_SPLIT',
          evaluationInputSnapshot: { branch: 'should-not-land' },
          outcomeStatus: 'SPLIT_ACTIVATED',
          evaluatedAt: new Date().toISOString(),
          recordedByActorId: noMembershipActor,
        })
      ).rejects.toMatchObject({ code: 'case_access_denied' });
      expect(await readGatewayEvaluationRows(gatewayNodeRunId)).toHaveLength(0);

      const acceptanceNodeRunId = `node-auth-create-acc-${randomUUID()}`;
      await expect(
        executionGraphService.recordNodeResultAcceptance({
          nodeRunId: acceptanceNodeRunId,
          runId: fixture.runId,
          nodeType: 'CAPABILITY',
          nodeCompletionState: 'COMPLETED',
          resultAcceptance: 'ACCEPTED',
          acceptanceInputSnapshot: { status: 'should-not-land' },
          occurredAt: new Date().toISOString(),
          recordedByActorId: noMembershipActor,
        })
      ).rejects.toMatchObject({ code: 'case_access_denied' });
      expect(await readNodeResultAcceptanceRows(acceptanceNodeRunId)).toHaveLength(0);
    } finally {
      await teardown({
        runIds,
        orgIds: [fixture.orgId],
        projectIds: [fixture.projectId],
        userIds: [fixture.actorId, noMembershipActor],
      });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 6. AUTHORIZATION (CW-P12) — getGatewayEvaluation/getNodeResultAcceptance
  //    (read class, SEC-009 hardening): a nonexistent id and a real id the
  //    actor cannot access both return null.
  // -------------------------------------------------------------------------
  it('getGatewayEvaluation and getNodeResultAcceptance both return null for an actor with no membership, identical to a nonexistent node_run_id', async () => {
    const fixture = await seedCaseWithBoundRun('auth-read-null');
    const runIds = [fixture.runId];
    const noMembershipActor = await seedUser(fixture.orgId, 'auth-read-null-outsider');
    try {
      const gatewayNodeRunId = `node-auth-read-null-gw-${randomUUID()}`;
      await executionGraphService.recordGatewayEvaluation({
        nodeRunId: gatewayNodeRunId,
        runId: fixture.runId,
        gatewayNodeType: 'PARALLEL_SPLIT',
        evaluationInputSnapshot: { branch: 'read-null' },
        outcomeStatus: 'SPLIT_ACTIVATED',
        evaluatedAt: new Date().toISOString(),
        recordedByActorId: fixture.actorId,
      });

      const acceptanceNodeRunId = `node-auth-read-null-acc-${randomUUID()}`;
      await executionGraphService.recordNodeResultAcceptance({
        nodeRunId: acceptanceNodeRunId,
        runId: fixture.runId,
        nodeType: 'CAPABILITY',
        nodeCompletionState: 'COMPLETED',
        resultAcceptance: 'ACCEPTED',
        acceptanceInputSnapshot: { status: 'ok' },
        occurredAt: new Date().toISOString(),
        recordedByActorId: fixture.actorId,
      });

      const gwMissing = await executionGraphService.getGatewayEvaluation(
        `node-nonexistent-${randomUUID()}`,
        noMembershipActor
      );
      const gwDenied = await executionGraphService.getGatewayEvaluation(gatewayNodeRunId, noMembershipActor);
      expect(gwMissing).toBeNull();
      expect(gwDenied).toBeNull();

      const accMissing = await executionGraphService.getNodeResultAcceptance(
        `node-nonexistent-${randomUUID()}`,
        noMembershipActor
      );
      const accDenied = await executionGraphService.getNodeResultAcceptance(
        acceptanceNodeRunId,
        noMembershipActor
      );
      expect(accMissing).toBeNull();
      expect(accDenied).toBeNull();

      const gwAllowed = await executionGraphService.getGatewayEvaluation(gatewayNodeRunId, fixture.actorId);
      expect(gwAllowed?.nodeRunId).toBe(gatewayNodeRunId);
    } finally {
      await teardown({
        runIds,
        orgIds: [fixture.orgId],
        projectIds: [fixture.projectId],
        userIds: [fixture.actorId, noMembershipActor],
      });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // EVENT OUTBOX (EVENT_TAXONOMY §6.6) — every mutating command in this
  // service publishes exactly one event, inside its own transaction, and
  // publishes NOTHING when that transaction rolls back.
  //
  // Both commands here write to tables WITHOUT a `version` column, so
  // aggregate_version must be NULL (EVENT_TAXONOMY §3) — asserted literally,
  // because a 0 or a 1 there would silently corrupt replay ordering.
  // -------------------------------------------------------------------------

  it('recordGatewayEvaluation publishes exactly one node.gateway_evaluated outbox row with full identity, and its idempotent replay publishes no second row', async () => {
    const fixture = await seedCaseWithBoundRun('outbox-gw');
    const runIds = [fixture.runId];
    const replayActor = await seedMemberedUser(fixture.orgId, 'outbox-gw-replay');
    try {
      const nodeRunId = `node-outbox-gw-${randomUUID()}`;
      const evaluatedAt = new Date().toISOString();
      // A distinctive marker buried in the evaluated data: the event must
      // reference the row, never copy the data (EVENT_TAXONOMY §6.5).
      const snapshotMarker = `evaluated-payload-marker-${randomUUID()}`;

      await executionGraphService.recordGatewayEvaluation({
        nodeRunId,
        runId: fixture.runId,
        gatewayNodeType: 'DECISION_GATEWAY',
        conditionExpression: 'input.value > 0',
        conditionSchemaVersion: 'v1',
        evaluationInputSnapshot: { value: 42, secret: snapshotMarker },
        outcomeStatus: 'BRANCH_SELECTED',
        outcomeDetail: { selectedEdgeId: 'e1', ruleId: 'rule-7' },
        evaluatedAt,
        recordedByActorId: fixture.actorId,
      });

      // Read the outbox on the out-of-band pool, not from a return value.
      const events = await readOutboxRowsForAggregate(nodeRunId);
      expect(events).toHaveLength(1);
      const event = events[0];

      // event_type is the literal from EVENT_TAXONOMY, never invented here.
      expect(event.event_type).toBe('node.gateway_evaluated');
      expect(event.aggregate_type).toBe('NODE_RUN');
      expect(event.aggregate_id).toBe(nodeRunId);

      // Identity: every field comes from the row that was actually written.
      expect(event.organization_id).toBe(fixture.orgId);
      expect(event.project_id).toBe(fixture.projectId);
      expect(event.case_id).toBe(fixture.caseId);
      expect(event.run_id).toBe(fixture.runId);
      expect(event.node_run_id).toBe(nodeRunId);
      expect(event.actor_user_id).toBe(fixture.actorId);
      expect(String(event.correlation_id ?? '').length).toBeGreaterThan(0);
      expect(event.causation_id).toBeNull();
      // EVENT_TAXONOMY §3: this table has no version column.
      expect(event.aggregate_version).toBeNull();
      expect(event.schema_version).toBe(1);
      // Undelivered on purpose — dispatch is a separate, later concern.
      expect(event.delivered_at).toBeNull();

      // Facts, not payload.
      const summary = event.redacted_summary;
      expect(summary.gatewayNodeType).toBe('DECISION_GATEWAY');
      expect(summary.outcomeStatus).toBe('BRANCH_SELECTED');
      expect(summary.selectedEdgeId).toBe('e1');
      expect(summary.ruleId).toBe('rule-7');
      expect(summary.hasConditionExpression).toBe(true);
      const storedRow = (await readGatewayEvaluationRows(nodeRunId))[0];
      expect(summary.evaluationInputDigest).toBe(storedRow.evaluation_input_digest);
      // The evaluated data itself is referenced, never copied.
      expect(JSON.stringify(summary)).not.toContain(snapshotMarker);
      expect(event.payload_ref).toBe(`case_workspace_gateway_evaluations:${nodeRunId}`);

      // Idempotent replay writes no aggregate row, so it must write no event
      // either: a retried command must not become a second business fact.
      await executionGraphService.recordGatewayEvaluation({
        nodeRunId,
        runId: fixture.runId,
        gatewayNodeType: 'DECISION_GATEWAY',
        conditionExpression: 'input.value > 0',
        conditionSchemaVersion: 'v1',
        evaluationInputSnapshot: { value: 42, secret: snapshotMarker },
        outcomeStatus: 'BRANCH_SELECTED',
        outcomeDetail: { selectedEdgeId: 'e1', ruleId: 'rule-7' },
        evaluatedAt,
        recordedByActorId: replayActor,
      });
      const afterReplay = await readOutboxRowsForAggregate(nodeRunId);
      expect(afterReplay).toHaveLength(1);
      expect(afterReplay[0].event_id).toBe(event.event_id);
      expect(afterReplay[0].actor_user_id).toBe(fixture.actorId);
    } finally {
      await teardown({
        runIds,
        orgIds: [fixture.orgId],
        projectIds: [fixture.projectId],
        userIds: [fixture.actorId, replayActor],
      });
    }
  }, 30_000);

  it('recordNodeResultAcceptance publishes exactly one node.result_accepted outbox row with full identity and a NULL aggregate_version', async () => {
    const fixture = await seedCaseWithBoundRun('outbox-acc');
    const runIds = [fixture.runId];
    try {
      const nodeRunId = `node-outbox-acc-${randomUUID()}`;
      const occurredAt = new Date().toISOString();
      const snapshotMarker = `acceptance-payload-marker-${randomUUID()}`;

      await executionGraphService.recordNodeResultAcceptance({
        nodeRunId,
        runId: fixture.runId,
        nodeType: 'CAPABILITY',
        nodeCompletionState: 'COMPLETED',
        resultAcceptance: 'ACCEPTED',
        acceptanceInputSnapshot: { status: 'ok', body: snapshotMarker },
        occurredAt,
        recordedByActorId: fixture.actorId,
      });

      const events = await readOutboxRowsForAggregate(nodeRunId);
      expect(events).toHaveLength(1);
      const event = events[0];

      expect(event.event_type).toBe('node.result_accepted');
      expect(event.aggregate_type).toBe('NODE_RUN');
      expect(event.aggregate_id).toBe(nodeRunId);
      expect(event.organization_id).toBe(fixture.orgId);
      expect(event.project_id).toBe(fixture.projectId);
      expect(event.case_id).toBe(fixture.caseId);
      expect(event.run_id).toBe(fixture.runId);
      expect(event.node_run_id).toBe(nodeRunId);
      expect(event.actor_user_id).toBe(fixture.actorId);
      expect(String(event.correlation_id ?? '').length).toBeGreaterThan(0);
      expect(event.causation_id).toBeNull();
      expect(event.aggregate_version).toBeNull();

      const summary = event.redacted_summary;
      expect(summary.nodeType).toBe('CAPABILITY');
      expect(summary.nodeCompletionState).toBe('COMPLETED');
      expect(summary.resultAcceptance).toBe('ACCEPTED');
      // The accepted result itself is a payloadRef, never a copy.
      expect(JSON.stringify(summary)).not.toContain(snapshotMarker);
      expect(event.payload_ref).toBe(`case_workspace_node_result_acceptances:${nodeRunId}`);
    } finally {
      await teardown({
        runIds,
        orgIds: [fixture.orgId],
        projectIds: [fixture.projectId],
        userIds: [fixture.actorId],
      });
    }
  }, 30_000);

  it('a failure raised AFTER the event is published rolls both back: neither the gateway evaluation row nor its outbox row survives', async () => {
    const fixture = await seedCaseWithBoundRun('outbox-rollback');
    const runIds = [fixture.runId];
    try {
      const nodeRunId = `node-outbox-rollback-${randomUUID()}`;

      // Armed: the real publishEvent runs on the service's own transaction
      // client (a real outbox row IS inserted inside the transaction), and
      // only then does the command blow up.
      outboxBoom.armed = true;
      try {
        await expect(
          executionGraphService.recordGatewayEvaluation({
            nodeRunId,
            runId: fixture.runId,
            gatewayNodeType: 'PARALLEL_SPLIT',
            evaluationInputSnapshot: { branch: 'rollback' },
            outcomeStatus: 'SPLIT_ACTIVATED',
            evaluatedAt: new Date().toISOString(),
            recordedByActorId: fixture.actorId,
          })
        ).rejects.toThrow(/cw_test_forced_failure_after_publish/);
      } finally {
        outboxBoom.armed = false;
      }

      // Both halves of the transaction are gone — this is the whole point of
      // an outbox rather than a post-commit log.
      expect(await readOutboxRowsForAggregate(nodeRunId)).toHaveLength(0);
      expect(await readGatewayEvaluationRows(nodeRunId)).toHaveLength(0);

      // And the harness is genuinely disarmed: the same command succeeds now
      // and DOES leave exactly one event. Without this control, a broken
      // wiring that never publishes anything would pass the assertions above.
      await executionGraphService.recordGatewayEvaluation({
        nodeRunId,
        runId: fixture.runId,
        gatewayNodeType: 'PARALLEL_SPLIT',
        evaluationInputSnapshot: { branch: 'rollback' },
        outcomeStatus: 'SPLIT_ACTIVATED',
        evaluatedAt: new Date().toISOString(),
        recordedByActorId: fixture.actorId,
      });
      const afterSuccess = await readOutboxRowsForAggregate(nodeRunId);
      expect(afterSuccess).toHaveLength(1);
      expect(afterSuccess[0].event_type).toBe('node.gateway_evaluated');
      expect(await readGatewayEvaluationRows(nodeRunId)).toHaveLength(1);
    } finally {
      await teardown({
        runIds,
        orgIds: [fixture.orgId],
        projectIds: [fixture.projectId],
        userIds: [fixture.actorId],
      });
    }
  }, 30_000);
});
