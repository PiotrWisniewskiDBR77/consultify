/**
 * Case Workspace — Case Plan Version service, proved against a REAL
 * PostgreSQL (CW-P02, EPIC E2 "Case contract, plan versions and canonical
 * graph"). Exercises
 * server/src/services/caseWorkspace/casePlanVersionService.ts against the
 * schema in
 * server/migrations/20260809_case_workspace_case_plan_version.sql.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same convention as caseCoreService.pg.test.ts (CW-P01): `NODE_ENV=test`
 * ALONE is a trap — `Database.ts`'s `getDatabase()`/`createDatabase()` hand
 * back an in-memory MOCK whenever `RUN_DB_TESTS !== '1'` (or `MOCK_DB` isn't
 * explicitly `'false'`), and every write silently becomes a no-op. This file
 * follows the `*.pg.test.ts` convention: gate on
 * `RUN_DB_TESTS === '1' && MOCK_DB === 'false'`, probe reachability AND that
 * the migrated schema is actually present before deciding, and SKIP LOUDLY
 * (never silently pass) when either is missing.
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/casePlanVersionService.pg.test.ts
 *
 * ===========================================================================
 * ISOLATION — every test owns its own organization/project/case_core row
 * ===========================================================================
 * `case_plan_versions` FKs to `case_core(case_id)`, so before any test can
 * create a plan version it must first create its own org + project (exactly
 * like caseCoreService.pg.test.ts) AND its own case_core row via
 * `caseCoreService.createCase` — `seedOrgProjectCase()` below bundles that
 * combination as a single local helper. Every test seeds its own fixture
 * inside the test body (never a shared beforeEach) and tears it down itself
 * in a `finally`, so no test can observe, reset, or race another test's
 * rows.
 *
 * All assertions read the actual `case_plan_versions`/`case_plan_view_state`
 * rows back out of Postgres through a dedicated, out-of-band `pg.Pool`
 * (`control`) — never the service function's return value alone — because
 * the return value only proves what the service THINKS it wrote, not what
 * actually landed.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import * as casePlanVersionService from '../casePlanVersionService.js';
import type { CanonicalGraph } from '../casePlanVersionService.js';

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
    const result = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_plan_versions'
          AND column_name IN ('case_plan_version_id', 'case_id', 'plan_number', 'status',
                               'semantic_graph', 'graph_digest', 'review_history', 'version')`
    );
    const versionsOk = Number(result.rows[0]?.present ?? 0) === 8;

    const viewStateResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_plan_view_state'
          AND column_name IN ('case_plan_version_id', 'view_type', 'view_state')`
    );
    const viewStateOk = Number(viewStateResult.rows[0]?.present ?? 0) === 3;

    return versionsOk && viewStateOk;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[casePlanVersionService pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260809_case_workspace_case_plan_version.sql migration applied (on top of ` +
      `20260809_case_workspace_case_core.sql). requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface CasePlanVersionDbRow {
  case_plan_version_id: string;
  case_id: string;
  plan_number: number;
  status: string;
  semantic_graph: string;
  graph_digest: string;
  review_history: string;
  proposed_at: string | null;
  published_at: string | null;
  superseded_at: string | null;
  withdrawn_at: string | null;
  version: number;
}

suite('casePlanVersionService — Case Plan Version against a real PostgreSQL (CW-P02, E2)', () => {
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

  /**
   * A fresh organization + project + case_core row, all uniquely named.
   * Bundles caseCoreService.pg.test.ts's seedOrgAndProject() with
   * caseCoreService.createCase(), since case_plan_versions FKs to
   * case_core(case_id) and every test here needs a real Case to hang a plan
   * version off of.
   */
  async function seedOrgProjectCase(
    label: string
  ): Promise<{ orgId: string; projectId: string; caseId: string }> {
    const suffix = randomUUID();
    const orgId = `case-planv-org-${label}-${suffix}`;
    const projectId = `case-planv-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `Case Plan Version test org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Case Plan Version test project (${label})`]
    );
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: `actor-planv-${label}`,
    });
    return { orgId, projectId, caseId: created.caseId };
  }

  async function teardown(orgIds: string[], projectIds: string[]): Promise<void> {
    for (const projectId of projectIds) {
      // case_plan_versions/case_plan_view_state cascade off case_core via
      // ON DELETE CASCADE — deleting case_core is enough to clean both up.
      await control
        .query(`DELETE FROM case_core WHERE project_id = $1`, [projectId])
        .catch(() => undefined);
      await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    }
    for (const orgId of orgIds) {
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
  }

  async function readPlanVersionRow(planVersionId: string): Promise<CasePlanVersionDbRow | null> {
    const result = await control.query<CasePlanVersionDbRow>(
      `SELECT * FROM case_plan_versions WHERE case_plan_version_id = $1`,
      [planVersionId]
    );
    return result.rows[0] ?? null;
  }

  async function readPlanVersionRowsForCase(caseId: string): Promise<CasePlanVersionDbRow[]> {
    const result = await control.query<CasePlanVersionDbRow>(
      `SELECT * FROM case_plan_versions WHERE case_id = $1 ORDER BY plan_number ASC`,
      [caseId]
    );
    return result.rows;
  }

  // -------------------------------------------------------------------------
  // Fixture graphs.
  // -------------------------------------------------------------------------

  /** A minimal, structurally valid two-node graph (entry -> terminal). */
  function validGraph(tag: string): CanonicalGraph {
    return {
      schemaVersion: '1',
      graphId: `graph-${tag}`,
      entryNodeIds: ['n1'],
      terminalNodeIds: ['n2'],
      nodes: [
        { nodeId: 'n1', type: 'TASK', metadata: { tag } },
        { nodeId: 'n2', type: 'TASK' },
      ],
      edges: [{ edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', edgeType: 'SEQUENCE' }],
    };
  }

  // -------------------------------------------------------------------------
  // 1. createPlanDraft — plan_number ordinal, not a collision (CW-RT-016/017).
  // -------------------------------------------------------------------------
  it('createPlanDraft creates a DRAFT row with plan_number=1; a second createPlanDraft for the same case gets plan_number=2', async () => {
    const { orgId, projectId, caseId } = await seedOrgProjectCase('ordinal');
    try {
      const first = await casePlanVersionService.createPlanDraft({
        caseId,
        semanticGraph: validGraph('first'),
        createdByActorId: 'actor-ordinal',
      });
      expect(first.status).toBe('DRAFT');
      expect(first.planNumber).toBe(1);

      const second = await casePlanVersionService.createPlanDraft({
        caseId,
        semanticGraph: validGraph('second'),
        createdByActorId: 'actor-ordinal',
      });
      expect(second.status).toBe('DRAFT');
      expect(second.planNumber).toBe(2);
      expect(second.casePlanVersionId).not.toBe(first.casePlanVersionId);

      const rows = await readPlanVersionRowsForCase(caseId);
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.plan_number)).toEqual([1, 2]);
      expect(rows.find((r) => r.case_plan_version_id === first.casePlanVersionId)?.plan_number).toBe(1);
      expect(rows.find((r) => r.case_plan_version_id === second.casePlanVersionId)?.plan_number).toBe(2);
      expect(rows.every((r) => r.status === 'DRAFT')).toBe(true);
    } finally {
      await teardown([orgId], [projectId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 2. updatePlanDraft — mutable only while DRAFT (CW-01-010/CW-GR-025/044).
  // -------------------------------------------------------------------------
  it('updatePlanDraft succeeds on DRAFT (graph_digest changes) but is rejected once the row is IN_REVIEW, leaving the DB row unchanged', async () => {
    const { orgId, projectId, caseId } = await seedOrgProjectCase('draft-mutability');
    try {
      const draft = await casePlanVersionService.createPlanDraft({
        caseId,
        semanticGraph: validGraph('v1'),
        createdByActorId: 'actor-draft-mut',
      });
      const rowAfterCreate = await readPlanVersionRow(draft.casePlanVersionId);
      const digestAfterCreate = rowAfterCreate?.graph_digest;
      expect(digestAfterCreate).toBe(draft.graphDigest);

      // -- Update while DRAFT: allowed, digest changes for a semantically
      //    different graph.
      const updated = await casePlanVersionService.updatePlanDraft(
        draft.casePlanVersionId,
        { semanticGraph: validGraph('v2'), expectedVersion: draft.version },
        { actorUserId: 'actor-draft-mut' }
      );
      expect(updated.status).toBe('DRAFT');
      expect(updated.graphDigest).not.toBe(digestAfterCreate);

      const rowAfterUpdate = await readPlanVersionRow(draft.casePlanVersionId);
      expect(rowAfterUpdate?.graph_digest).toBe(updated.graphDigest);
      expect(rowAfterUpdate?.graph_digest).not.toBe(digestAfterCreate);
      const digestBeforeRejectedCall = rowAfterUpdate?.graph_digest;
      const semanticGraphBeforeRejectedCall = rowAfterUpdate?.semantic_graph;

      // -- Propose: DRAFT -> IN_REVIEW.
      const proposed = await casePlanVersionService.proposePlanVersion(
        draft.casePlanVersionId,
        { actorUserId: 'actor-draft-mut' },
        updated.version
      );
      expect(proposed.status).toBe('IN_REVIEW');

      // -- Update while IN_REVIEW: rejected.
      await expect(
        casePlanVersionService.updatePlanDraft(
          draft.casePlanVersionId,
          { semanticGraph: validGraph('v3-should-not-land'), expectedVersion: proposed.version },
          { actorUserId: 'actor-draft-mut' }
        )
      ).rejects.toThrow(/plan_version_not_editable/);

      // -- DB row is untouched by the rejected call: same semantic_graph and
      //    graph_digest as immediately before it.
      const rowAfterRejectedUpdate = await readPlanVersionRow(draft.casePlanVersionId);
      expect(rowAfterRejectedUpdate?.graph_digest).toBe(digestBeforeRejectedCall);
      expect(rowAfterRejectedUpdate?.semantic_graph).toBe(semanticGraphBeforeRejectedCall);
      expect(rowAfterRejectedUpdate?.status).toBe('IN_REVIEW');
    } finally {
      await teardown([orgId], [projectId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 3. publishPlanVersion — permanent fixation + atomic supersede
  //    (CW-00-020-INV5/INV6, CW-RT-029, CW-CANON-06, CW-DOD-B3/B4).
  // -------------------------------------------------------------------------
  it('publishPlanVersion permanently fixes semantic_graph/graph_digest and atomically supersedes the prior PUBLISHED row for the same case', async () => {
    const { orgId, projectId, caseId } = await seedOrgProjectCase('publish-supersede');
    try {
      // -- Version A: draft -> propose -> publish.
      const draftA = await casePlanVersionService.createPlanDraft({
        caseId,
        semanticGraph: validGraph('a1'),
        createdByActorId: 'actor-publish',
      });
      const proposedA = await casePlanVersionService.proposePlanVersion(
        draftA.casePlanVersionId,
        { actorUserId: 'actor-publish' },
        draftA.version
      );
      const publishedA = await casePlanVersionService.publishPlanVersion(
        draftA.casePlanVersionId,
        { actorUserId: 'actor-publish' },
        proposedA.version
      );
      expect(publishedA.status).toBe('PUBLISHED');
      const rowA_afterPublish = await readPlanVersionRow(draftA.casePlanVersionId);
      expect(rowA_afterPublish?.status).toBe('PUBLISHED');
      const digestA = rowA_afterPublish?.graph_digest;

      // -- Further semantic mutation on the now-PUBLISHED row is rejected,
      //    and the DB row's semantic content is untouched.
      await expect(
        casePlanVersionService.updatePlanDraft(
          draftA.casePlanVersionId,
          { semanticGraph: validGraph('a2-should-not-land'), expectedVersion: publishedA.version },
          { actorUserId: 'actor-publish' }
        )
      ).rejects.toThrow(/plan_version_not_editable/);
      const rowA_afterRejectedMutation = await readPlanVersionRow(draftA.casePlanVersionId);
      expect(rowA_afterRejectedMutation?.graph_digest).toBe(digestA);
      expect(rowA_afterRejectedMutation?.status).toBe('PUBLISHED');

      // -- Version B: replan against A, draft -> propose -> publish.
      const draftB = await casePlanVersionService.createPlanDraft({
        caseId,
        semanticGraph: validGraph('b1'),
        supersedesPlanVersionId: publishedA.casePlanVersionId,
        createdByActorId: 'actor-publish',
      });
      expect(draftB.planNumber).toBe(2);
      const proposedB = await casePlanVersionService.proposePlanVersion(
        draftB.casePlanVersionId,
        { actorUserId: 'actor-publish' },
        draftB.version
      );
      const publishedB = await casePlanVersionService.publishPlanVersion(
        draftB.casePlanVersionId,
        { actorUserId: 'actor-publish' },
        proposedB.version
      );
      expect(publishedB.status).toBe('PUBLISHED');

      // -- Read the DB directly: A must now be SUPERSEDED, B must be the
      //    ONLY PUBLISHED row for this case_id.
      const rowA_afterBPublished = await readPlanVersionRow(draftA.casePlanVersionId);
      expect(rowA_afterBPublished?.status).toBe('SUPERSEDED');
      expect(rowA_afterBPublished?.superseded_at).toBeTruthy();
      // A's fixed semantic content is preserved through the supersede too.
      expect(rowA_afterBPublished?.graph_digest).toBe(digestA);

      const publishedRows = await control.query<CasePlanVersionDbRow>(
        `SELECT * FROM case_plan_versions WHERE case_id = $1 AND status = 'PUBLISHED'`,
        [caseId]
      );
      expect(publishedRows.rows).toHaveLength(1);
      expect(publishedRows.rows[0].case_plan_version_id).toBe(draftB.casePlanVersionId);
    } finally {
      await teardown([orgId], [projectId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 4. putViewState/getViewState — presentation data never touches
  //    semantic_graph/graph_digest (CW-GR-005/006/025/045).
  // -------------------------------------------------------------------------
  it('putViewState/getViewState changes do not alter graph_digest of the associated plan version', async () => {
    const { orgId, projectId, caseId } = await seedOrgProjectCase('view-state-isolation');
    try {
      const draft = await casePlanVersionService.createPlanDraft({
        caseId,
        semanticGraph: validGraph('view-state'),
        createdByActorId: 'actor-view-state',
      });
      const rowBeforeViewState = await readPlanVersionRow(draft.casePlanVersionId);
      const digestBeforeViewState = rowBeforeViewState?.graph_digest;
      const semanticGraphBeforeViewState = rowBeforeViewState?.semantic_graph;
      expect(digestBeforeViewState).toBe(draft.graphDigest);

      const putResult = await casePlanVersionService.putViewState(
        draft.casePlanVersionId,
        'SIMPLE',
        { viewport: { x: 12, y: 34, zoom: 1.5 }, collapsedGroups: ['g1'], selectedStepId: 'n1' },
        { actorUserId: 'actor-view-state' }
      );
      expect(putResult.viewType).toBe('SIMPLE');

      const getResult = await casePlanVersionService.getViewState(draft.casePlanVersionId, 'SIMPLE');
      expect(getResult).not.toBeNull();
      expect(getResult?.viewState).toMatchObject({ viewport: { x: 12, y: 34, zoom: 1.5 } });

      // Re-read the plan version row: graph_digest (and the underlying
      // semantic_graph) must be byte-identical to before the view-state
      // write.
      const rowAfterViewState = await readPlanVersionRow(draft.casePlanVersionId);
      expect(rowAfterViewState?.graph_digest).toBe(digestBeforeViewState);
      expect(rowAfterViewState?.semantic_graph).toBe(semanticGraphBeforeViewState);
    } finally {
      await teardown([orgId], [projectId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 5. review_history — append-only, never overwritten (canon invariant #13).
  // -------------------------------------------------------------------------
  it('review_history is append-only: propose, requestChanges, propose again leaves 3 entries in order', async () => {
    const { orgId, projectId, caseId } = await seedOrgProjectCase('review-history');
    try {
      const draft = await casePlanVersionService.createPlanDraft({
        caseId,
        semanticGraph: validGraph('review-history'),
        createdByActorId: 'actor-review-history',
      });

      const proposed1 = await casePlanVersionService.proposePlanVersion(
        draft.casePlanVersionId,
        { actorUserId: 'actor-review-history' },
        draft.version
      );
      expect(proposed1.status).toBe('IN_REVIEW');

      const changesRequested = await casePlanVersionService.requestChangesOnPlanVersion(
        draft.casePlanVersionId,
        { actorUserId: 'actor-review-history-reviewer' },
        'needs another pass on node n2',
        proposed1.version
      );
      expect(changesRequested.status).toBe('DRAFT');

      const proposed2 = await casePlanVersionService.proposePlanVersion(
        draft.casePlanVersionId,
        { actorUserId: 'actor-review-history' },
        changesRequested.version
      );
      expect(proposed2.status).toBe('IN_REVIEW');

      const row = await readPlanVersionRow(draft.casePlanVersionId);
      const history = JSON.parse(row?.review_history ?? '[]');
      expect(history).toHaveLength(3);
      expect(history.map((entry: { event: string }) => entry.event)).toEqual([
        'PROPOSED',
        'CHANGES_REQUESTED',
        'PROPOSED',
      ]);
      // None overwritten: the CHANGES_REQUESTED entry keeps its own reason,
      // distinct from the two PROPOSED entries around it.
      expect(history[0]).toMatchObject({ event: 'PROPOSED', actorId: 'actor-review-history' });
      expect(history[1]).toMatchObject({
        event: 'CHANGES_REQUESTED',
        actorId: 'actor-review-history-reviewer',
        reason: 'needs another pass on node n2',
      });
      expect(history[2]).toMatchObject({ event: 'PROPOSED', actorId: 'actor-review-history' });
    } finally {
      await teardown([orgId], [projectId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 6. validatePlanVersion — CW-GR-036 LOCAL_STRUCTURAL checklist reports the
  //    SPECIFIC defect, not just "some" failure.
  // -------------------------------------------------------------------------
  it('validatePlanVersion reports a specific DANGLING_EDGE (and downstream NO_TERMINAL_PATH) blocker for a graph whose edge references a nonexistent node', async () => {
    const { orgId, projectId, caseId } = await seedOrgProjectCase('validation-defect');
    try {
      const brokenGraph: CanonicalGraph = {
        schemaVersion: '1',
        graphId: 'graph-broken',
        entryNodeIds: ['n1'],
        terminalNodeIds: ['n2'],
        nodes: [
          { nodeId: 'n1', type: 'TASK' },
          { nodeId: 'n2', type: 'TASK' },
        ],
        // e1 references 'n-does-not-exist' instead of 'n2' — a dangling
        // edge. Since the only edge into n2 is dangling, n2 also becomes
        // unreachable from entryNodeIds and no path exists to any declared
        // terminal node — both are real, distinct, expected consequences of
        // this specific defect, not incidental noise.
        edges: [{ edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'n-does-not-exist', edgeType: 'SEQUENCE' }],
      };

      const draft = await casePlanVersionService.createPlanDraft({
        caseId,
        semanticGraph: brokenGraph,
        createdByActorId: 'actor-validation-defect',
      });

      const result = await casePlanVersionService.validatePlanVersion(draft.casePlanVersionId);
      expect(result.valid).toBe(false);

      const codes = result.blockers.map((b) => b.code);
      expect(codes).toContain('DANGLING_EDGE');
      const danglingBlocker = result.blockers.find((b) => b.code === 'DANGLING_EDGE');
      expect(danglingBlocker?.severity).toBe('BLOCKING');
      expect(danglingBlocker?.detail).toContain('e1');

      expect(codes).toContain('NO_TERMINAL_PATH');

      // A structurally valid sibling graph on the same case must NOT report
      // DANGLING_EDGE, proving the check is specific to the broken graph and
      // not a blanket always-fail.
      const goodDraft = await casePlanVersionService.createPlanDraft({
        caseId,
        semanticGraph: validGraph('validation-control'),
        createdByActorId: 'actor-validation-defect',
      });
      const goodResult = await casePlanVersionService.validatePlanVersion(goodDraft.casePlanVersionId);
      const goodCodes = goodResult.blockers.map((b) => b.code);
      expect(goodCodes).not.toContain('DANGLING_EDGE');
      expect(goodCodes).not.toContain('NO_TERMINAL_PATH');
      expect(goodCodes).not.toContain('UNREACHABLE_NODE');
    } finally {
      await teardown([orgId], [projectId]);
    }
  }, 30_000);
});
