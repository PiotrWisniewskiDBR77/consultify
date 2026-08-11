/**
 * INTEGRATION — the canonical Run/NodeRun runtime end to end, against a REAL
 * PostgreSQL: Case -> published Plan -> CreateRun -> StartRun -> NodeRun
 * completions -> graph advancement -> Run COMPLETED -> outcome recorded.
 *
 * This suite's job is different from nodeRunService.pg.test.ts (single
 * aggregate, exhaustive) and runLifecycleService.pg.test.ts (each command in
 * isolation): it proves the WHOLE STORY holds together as one coherent run,
 * plus the three properties that only show up ACROSS the full pipeline:
 *
 *   1. RESTART IN A NEW PROCESS. Everything nodeRunService/runLifecycleService
 *      write is read back here by a genuinely separate `node` process (no
 *      shared module state, no shared connection pool) — proving doc 04 §7's
 *      "restart between NodeRuns resumes from persisted state" is actually
 *      about the DATABASE, not this test process's memory.
 *   2. CONCURRENT DOUBLE DISPATCH produces ONE business effect: two
 *      concurrent startRun calls for the same Run (both racing the
 *      `SELECT ... FOR UPDATE` row lock) mint exactly one entry NodeRun and
 *      emit exactly one `run.started` event; two concurrent claims on the
 *      same NodeRun produce exactly one winner.
 *   3. THE EXACT EVENT SEQUENCE the golden path leaves in the outbox, read
 *      directly from `case_workspace_event_outbox` ordered by
 *      `sequence_number` — never inferred from service return values alone.
 *
 * ===========================================================================
 * GATE — real database, never a mock (same as every *.pg.test.ts here)
 * ===========================================================================
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/integration/runRuntime.pg.test.ts \
 *   --environment node
 */

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../../caseCoreService.js';
import * as casePlanVersionService from '../../casePlanVersionService.js';
import type { CanonicalGraph } from '../../casePlanVersionService.js';
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
    const nodeRuns = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_node_runs'
          AND column_name IN ('node_run_id', 'run_id', 'status')`
    );
    return Number(runs.rows[0]?.present ?? 0) === 3 && Number(nodeRuns.rows[0]?.present ?? 0) === 3;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[runRuntime integration suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and both the ` +
      `20260810_case_workspace_node_run_and_inbox.sql and 20260811a_case_workspace_run_lifecycle.sql ` +
      `migrations applied. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('runRuntime — canonical Run/NodeRun end to end against a real PostgreSQL (doc 04 §3.4/§4.4/§4.5/§7)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = `case-runtime-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
      [`case-runtime-member-${randomUUID()}`, orgId, userId]
    );
    return userId;
  }

  /** Three-node linear chain n1 -> n2 -> n3, PUBLISHED, on a fresh STANDARD Case. */
  async function seedPublishedCase(label: string): Promise<{
    orgId: string;
    projectId: string;
    caseId: string;
    casePlanVersionId: string;
    actorId: string;
  }> {
    const suffix = randomUUID();
    const orgId = `case-runtime-org-${label}-${suffix}`;
    const projectId = `case-runtime-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `Runtime integration org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Runtime integration project (${label})`]
    );
    const actorId = await seedMemberedUser(orgId, label);
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      caseProfile: 'STANDARD',
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: actorId,
    });

    const graph: CanonicalGraph = {
      schemaVersion: '1',
      graphId: `graph-${label}-${suffix}`,
      entryNodeIds: ['n1'],
      terminalNodeIds: ['n3'],
      nodes: [
        { nodeId: 'n1', type: 'CAPABILITY' },
        { nodeId: 'n2', type: 'CAPABILITY' },
        { nodeId: 'n3', type: 'CAPABILITY' },
      ],
      edges: [
        { edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', edgeType: 'SEQUENCE' },
        { edgeId: 'e2', sourceNodeId: 'n2', targetNodeId: 'n3', edgeType: 'SEQUENCE' },
      ],
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

    return { orgId, projectId, caseId: created.caseId, casePlanVersionId: published.casePlanVersionId, actorId };
  }

  async function teardown(params: { orgId: string; projectId: string }): Promise<void> {
    await control
      .query(
        `DELETE FROM case_workspace_node_run_attempts
          WHERE node_run_id IN (
            SELECT node_run_id FROM case_workspace_node_runs
             WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1))`,
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
             WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1))`,
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

  async function succeedAttempt(nodeRunId: string): Promise<void> {
    const claim = await nodeRunService.claimNodeRun(nodeRunId, { leaseMs: 60_000 });
    if (claim.outcome !== 'claimed') throw new Error(`unreachable — claim outcome was ${claim.outcome}`);
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

  /**
   * Reads a Run's status DIRECTLY from Postgres in a BRAND NEW `node`
   * process — a fresh V8 isolate, its own fresh `pg` connection, zero shared
   * module state with the test process. Proves the persisted row (not this
   * test's in-memory service return values) is what actually carries the
   * truth across a restart (doc 04 §7: "restart between NodeRuns resumes
   * from persisted state").
   */
  function readRunStatusFromFreshProcess(runId: string): { status: string; version: number } {
    const script = `
      const { Client } = require('pg');
      (async () => {
        const client = new Client({ connectionString: process.env.DATABASE_URL });
        await client.connect();
        try {
          // node -e '<script>' <arg> has NO script file consuming argv[1], so
          // the first extra CLI arg lands at argv[1], not argv[2].
          const result = await client.query('SELECT status, version FROM case_workspace_runs WHERE run_id = $1', [process.argv[1]]);
          process.stdout.write(JSON.stringify(result.rows[0] ?? null));
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
    const parsed = JSON.parse(output) as { status: string; version: number } | null;
    if (!parsed) throw new Error('runRuntime restart-in-new-process readback found no row');
    return { status: parsed.status, version: Number(parsed.version) };
  }

  // =========================================================================
  // 1. Full golden path: Case -> Plan -> CreateRun -> StartRun -> n1 -> n2 ->
  //    n3 -> COMPLETED -> outcome ACCEPTED, verified via readback AND a
  //    restart into a genuinely new process midway through.
  // =========================================================================
  it(
    'runs the full canonical pipeline to COMPLETED, resuming correctly after a readback from a BRAND NEW process',
    async () => {
      const fx = await seedPublishedCase('golden-path');
      try {
        const run = await runLifecycleService.createRun(
          { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `golden-${randomUUID()}` },
          fx.actorId
        );
        expect(run.status).toBe('CREATED');

        const started = await runLifecycleService.startRun(run.runId, fx.actorId);
        if (started.outcome !== 'started') throw new Error('unreachable');
        expect(started.nodeRunIds).toHaveLength(1);

        // --- RESTART IN A NEW PROCESS -------------------------------------
        // The service call above ran in THIS process. A totally separate
        // `node` process, with its own connection, must see the SAME
        // persisted RUNNING status — not because this test process told it
        // so, but because it is really in the database.
        const freshReadback = readRunStatusFromFreshProcess(run.runId);
        expect(freshReadback.status).toBe('RUNNING');
        expect(freshReadback.version).toBe(started.run.version);

        // --- resume the pipeline in THIS process, as if after a restart --
        const n1 = await nodeRunService.getLatestNodeRunForNode(run.runId, 'n1', fx.actorId);
        if (!n1) throw new Error('unreachable');
        await succeedAttempt(n1.nodeRunId);
        const afterN1 = await runLifecycleService.advanceRun(run.runId, fx.actorId);
        expect(afterN1.run.status).toBe('RUNNING');
        expect(afterN1.createdNodeRunIds).toHaveLength(1);

        const n2 = await nodeRunService.getLatestNodeRunForNode(run.runId, 'n2', fx.actorId);
        if (!n2) throw new Error('unreachable');
        await succeedAttempt(n2.nodeRunId);
        const afterN2 = await runLifecycleService.advanceRun(run.runId, fx.actorId);
        expect(afterN2.run.status).toBe('RUNNING');

        const n3 = await nodeRunService.getLatestNodeRunForNode(run.runId, 'n3', fx.actorId);
        if (!n3) throw new Error('unreachable');
        await succeedAttempt(n3.nodeRunId);
        const afterN3 = await runLifecycleService.advanceRun(run.runId, fx.actorId);
        expect(afterN3.run.status).toBe('COMPLETED');

        // Second restart-in-a-new-process readback, confirming the FINAL
        // technical state too, again from outside this process entirely.
        const finalReadback = readRunStatusFromFreshProcess(run.runId);
        expect(finalReadback.status).toBe('COMPLETED');

        const accepted = await runLifecycleService.recordRunOutcome(
          run.runId,
          'ACCEPTED',
          fx.actorId,
          afterN3.run.version
        );
        expect(accepted.outcomeStatus).toBe('ACCEPTED');

        // --- exact event sequence, read directly from the outbox ---------
        // 'run.bound_to_plan_version' is runBindingService's own event on the
        // same RUN aggregate (createRun calls bindRunToPlanVersion). Only
        // ONE 'run.advanced': the first two advanceRun calls create a
        // successor NodeRun (its own 'node.run_created' event on the
        // NODE_RUN aggregate) but leave the Run's OWN status at RUNNING —
        // transitionRunOnClient never fires (and emits no event) when the
        // computed status equals the current one, by design (no phantom
        // RUN-level transition for a fact that already lives as a NodeRun
        // event). Only the THIRD call actually changes Run status
        // (RUNNING -> COMPLETED), which is the one call that emits.
        const events = await control.query<{ event_type: string }>(
          `SELECT event_type FROM case_workspace_event_outbox
            WHERE run_id = $1 AND aggregate_type = 'RUN'
            ORDER BY sequence_number ASC`,
          [run.runId]
        );
        expect(events.rows.map((r) => r.event_type)).toEqual([
          'run.bound_to_plan_version',
          'run.created',
          'run.started',
          'run.advanced',
          'run.outcome_recorded',
        ]);

        const nodeRunCount = await control.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM case_workspace_node_runs WHERE run_id = $1`,
          [run.runId]
        );
        expect(Number(nodeRunCount.rows[0].n)).toBe(3);
      } finally {
        await teardown(fx);
      }
    },
    120_000
  );

  // =========================================================================
  // 2. Duplicate dispatch: two CONCURRENT startRun calls for the SAME Run
  //    produce exactly one entry NodeRun and exactly one 'run.started' event
  //    — the row-lock serialization inside loadForUpdate, not a race.
  // =========================================================================
  it('two concurrent startRun calls for the same Run produce exactly one dispatch (no duplicate NodeRun, no duplicate event)', async () => {
    const fx = await seedPublishedCase('dup-dispatch');
    try {
      const run = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `dd-${randomUUID()}` },
        fx.actorId
      );

      const [a, b] = await Promise.all([
        runLifecycleService.startRun(run.runId, fx.actorId),
        runLifecycleService.startRun(run.runId, fx.actorId),
      ]);
      const outcomes = [a.outcome, b.outcome].sort();
      expect(outcomes).toEqual(['already_started', 'started']);

      const nodeRunCount = await control.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM case_workspace_node_runs WHERE run_id = $1`,
        [run.runId]
      );
      expect(Number(nodeRunCount.rows[0].n)).toBe(1);

      const eventCount = await control.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM case_workspace_event_outbox
          WHERE run_id = $1 AND event_type = 'run.started'`,
        [run.runId]
      );
      expect(Number(eventCount.rows[0].n)).toBe(1);
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 3. Concurrent claim on the SAME NodeRun: exactly one winner.
  // =========================================================================
  it('two concurrent claimNodeRun calls on the same entry NodeRun produce exactly one winner', async () => {
    const fx = await seedPublishedCase('concurrent-claim');
    try {
      const run = await runLifecycleService.createRun(
        { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `cc-${randomUUID()}` },
        fx.actorId
      );
      const started = await runLifecycleService.startRun(run.runId, fx.actorId);
      if (started.outcome !== 'started') throw new Error('unreachable');
      const [nodeRunId] = started.nodeRunIds;

      const [c1, c2] = await Promise.all([
        nodeRunService.claimNodeRun(nodeRunId, { leaseMs: 60_000 }),
        nodeRunService.claimNodeRun(nodeRunId, { leaseMs: 60_000 }),
      ]);
      const claimOutcomes = [c1.outcome, c2.outcome].sort();
      // Whichever ran second observes the winner's already-committed CLAIMED
      // row and finds no claimable match.
      expect(claimOutcomes).toEqual(['claimed', 'not_claimable']);
    } finally {
      await teardown(fx);
    }
  }, 90_000);

  // =========================================================================
  // 4. Stale plan version: once a plan is SUPERSEDED by a republish, it can
  //    never be the target of a NEW createRun.
  // =========================================================================
  it('createRun refuses a SUPERSEDED plan version — a stale target mutates nothing', async () => {
    const fx = await seedPublishedCase('stale-plan');
    try {
      const v1 = await casePlanVersionService.getPlanVersion(fx.casePlanVersionId, fx.actorId);
      if (!v1) throw new Error('unreachable');

      // Publish a v2 to supersede v1.
      const graph: CanonicalGraph = {
        entryNodeIds: ['n1'],
        terminalNodeIds: ['n1'],
        nodes: [{ nodeId: 'n1', type: 'CAPABILITY' }],
        edges: [],
      };
      const draft2 = await casePlanVersionService.createPlanDraft({
        caseId: fx.caseId,
        semanticGraph: graph,
        createdByActorId: fx.actorId,
      });
      const proposed2 = await casePlanVersionService.proposePlanVersion(
        draft2.casePlanVersionId,
        { actorUserId: fx.actorId },
        draft2.version
      );
      await casePlanVersionService.publishPlanVersion(
        draft2.casePlanVersionId,
        { actorUserId: fx.actorId },
        proposed2.version
      );

      const v1After = await casePlanVersionService.getPlanVersion(fx.casePlanVersionId, fx.actorId);
      expect(v1After?.status).toBe('SUPERSEDED');

      await expect(
        runLifecycleService.createRun(
          { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `sp-${randomUUID()}` },
          fx.actorId
        )
      ).rejects.toThrow('run_lifecycle_plan_not_published');

      const runCount = await control.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM case_workspace_runs WHERE case_id = $1`,
        [fx.caseId]
      );
      expect(Number(runCount.rows[0].n)).toBe(0);
    } finally {
      await teardown(fx);
    }
  }, 90_000);
});
