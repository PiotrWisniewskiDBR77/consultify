/**
 * Case Workspace — Run Binding service, proved against a REAL PostgreSQL
 * (CW-P04, EPIC E4 "V8 Run, NodeRun and recovery"). Exercises
 * server/src/services/caseWorkspace/runBindingService.ts against the schema
 * in server/migrations/20260809_case_workspace_run_binding.sql.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same convention as caseCoreService.pg.test.ts (CW-P01) and
 * casePlanVersionService.pg.test.ts (CW-P02): `NODE_ENV=test` ALONE is a
 * trap — `Database.ts`'s `getDatabase()`/`createDatabase()` hand back an
 * in-memory MOCK whenever `RUN_DB_TESTS !== '1'` (or `MOCK_DB` isn't
 * explicitly `'false'`), and every write silently becomes a no-op. This file
 * follows the `*.pg.test.ts` convention: gate on
 * `RUN_DB_TESTS === '1' && MOCK_DB === 'false'`, probe reachability AND that
 * the migrated schema is actually present before deciding, and SKIP LOUDLY
 * (never silently pass) when either is missing.
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/runBindingService.pg.test.ts
 *
 * ===========================================================================
 * ISOLATION — every test owns its own organization/project/case_core/
 * v8_execution_runs fixtures
 * ===========================================================================
 * `case_workspace_run_bindings` FKs to `v8_execution_runs(run_id)`,
 * `case_plan_versions(case_plan_version_id)` and `case_core(case_id)`. This
 * packet's own service (runBindingService.ts) only ever SELECTs
 * `v8_execution_runs` — it has no create-helper for it, and the packet
 * mandate forbids ALTERing or otherwise touching that table from production
 * code. `seedV8Run()` below is therefore a TEST-FIXTURE-ONLY direct INSERT
 * against `v8_execution_runs` via the out-of-band `pg.Pool` (`control`), not
 * a production code path — it must never be added to runBindingService.ts
 * itself. Its column list matches the NOT NULL columns of
 * server/migrations/20260323_v8_execution_spine_00base.sql exactly: run_id,
 * organization_id, context_snapshot_id, initiator_user_id, goal (state,
 * plan_version, created_at, updated_at, metadata all carry DEFAULTs).
 *
 * Every test seeds its own fixture inside the test body (never a shared
 * beforeEach) and tears it down itself in a `finally`, so no test can
 * observe, reset, or race another test's rows. Teardown order matters:
 * `case_workspace_run_bindings` rows must be deleted BEFORE their referenced
 * `v8_execution_runs`/`case_core` rows, since both FKs on this table have no
 * ON DELETE clause (RESTRICT/NO ACTION) — see the migration file's header.
 *
 * All assertions read the actual `case_workspace_run_bindings` rows back out
 * of Postgres through a dedicated, out-of-band `pg.Pool` (`control`) — never
 * the service function's return value alone — because the return value only
 * proves what the service THINKS it wrote, not what actually landed.
 *
 * ===========================================================================
 * AUTHORIZATION (CW-P12 retrofit) — every actor is a real, membered user
 * ===========================================================================
 * runBindingService.ts now gates every method through
 * caseWorkspaceAuthContext.ts's requireCaseAccess. Every actor id used below
 * is a real `users` row with a matching ACTIVE `organization_members` row
 * for the Case's org — seeded here via direct INSERTs on the out-of-band
 * pool (seedUser/seedMember), a test-fixture-only direct insert.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import * as casePlanVersionService from '../casePlanVersionService.js';
import type { CanonicalGraph, CasePlanVersion } from '../casePlanVersionService.js';
import * as runBindingService from '../runBindingService.js';

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

    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    const orgMembersOk = Number(orgMembersResult.rows[0]?.present ?? 0) === 4;

    return bindingsOk && runsOk && orgMembersOk;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[runBindingService pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260809_case_workspace_run_binding.sql migration applied (on top of ` +
      `20260809_case_workspace_case_core.sql, 20260809_case_workspace_case_plan_version.sql and ` +
      `20260323_v8_execution_spine_00base.sql). requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface CaseWorkspaceRunBindingDbRow {
  run_id: string;
  case_plan_version_id: string;
  case_id: string;
  organization_id: string;
  graph_digest: string;
  bound_by_actor_id: string;
  created_at: string;
}

suite('runBindingService — Run Binding against a real PostgreSQL (CW-P04, E4)', () => {
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
    const userId = `case-runbind-user-${label}-${randomUUID()}`;
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
      [`case-runbind-member-${randomUUID()}`, orgId, userId, role, status]
    );
  }

  /** Convenience: seed a user AND an ACTIVE membership at MEMBER role in one call. */
  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = await seedUser(orgId, label);
    await seedMember(orgId, userId, 'MEMBER');
    return userId;
  }

  /**
   * A fresh organization + project + case_core row, all uniquely named, plus
   * a real membered actor to create the Case with. Same bundle as
   * casePlanVersionService.pg.test.ts's seedOrgProjectCase().
   */
  async function seedOrgProjectCase(
    label: string
  ): Promise<{ orgId: string; projectId: string; caseId: string; actorId: string }> {
    const suffix = randomUUID();
    const orgId = `case-runbind-org-${label}-${suffix}`;
    const projectId = `case-runbind-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `Run Binding test org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Run Binding test project (${label})`]
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
   * out-of-band control Pool. runBindingService.ts never does this itself —
   * it only ever SELECTs this table (see its own file header) — so tests
   * need their own minimal-valid-row helper. Column list matches exactly the
   * NOT NULL columns in
   * server/migrations/20260323_v8_execution_spine_00base.sql: run_id,
   * organization_id, context_snapshot_id, initiator_user_id, goal (state
   * defaults to 'drafting', plan_version/created_at/updated_at/metadata all
   * carry their own DEFAULTs).
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
   * returning the PUBLISHED CasePlanVersion. Optionally supersedes a prior
   * published version of the same case (replan), matching
   * casePlanVersionService.pg.test.ts's own publish-supersede flow.
   */
  async function publishedPlanVersion(params: {
    caseId: string;
    tag: string;
    actorId: string;
    supersedesPlanVersionId?: string;
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
      supersedesPlanVersionId: params.supersedesPlanVersionId,
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

  /** Draft-only plan version (never proposed/published) — stays status='DRAFT'. */
  async function draftOnlyPlanVersion(params: {
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
        { nodeId: 'n1', type: 'TASK' },
        { nodeId: 'n2', type: 'TASK' },
      ],
      edges: [{ edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', edgeType: 'SEQUENCE' }],
    };
    return casePlanVersionService.createPlanDraft({
      caseId: params.caseId,
      semanticGraph: graph,
      createdByActorId: params.actorId,
    });
  }

  async function readBindingRow(runId: string): Promise<CaseWorkspaceRunBindingDbRow | null> {
    const result = await control.query<CaseWorkspaceRunBindingDbRow>(
      `SELECT * FROM case_workspace_run_bindings WHERE run_id = $1`,
      [runId]
    );
    return result.rows[0] ?? null;
  }

  async function readBindingRowsForCase(caseId: string): Promise<CaseWorkspaceRunBindingDbRow[]> {
    const result = await control.query<CaseWorkspaceRunBindingDbRow>(
      `SELECT * FROM case_workspace_run_bindings WHERE case_id = $1 ORDER BY created_at ASC`,
      [caseId]
    );
    return result.rows;
  }

  async function readBindingRowsForPlanVersion(
    casePlanVersionId: string
  ): Promise<CaseWorkspaceRunBindingDbRow[]> {
    const result = await control.query<CaseWorkspaceRunBindingDbRow>(
      `SELECT * FROM case_workspace_run_bindings WHERE case_plan_version_id = $1 ORDER BY created_at ASC`,
      [casePlanVersionId]
    );
    return result.rows;
  }

  /**
   * Teardown order matters: case_workspace_run_bindings rows have no ON
   * DELETE clause on either their v8_execution_runs FK or their
   * case_core/case_plan_versions FKs (RESTRICT/NO ACTION — see the migration
   * file's header), so bindings must be deleted first, then the
   * v8_execution_runs rows they referenced, then users, then case_core
   * (which cascades to case_plan_versions/case_plan_view_state), then
   * projects, then organizations.
   */
  async function teardown(params: {
    runIds: string[];
    orgIds: string[];
    projectIds: string[];
    userIds?: string[];
  }): Promise<void> {
    if (params.runIds.length > 0) {
      await control
        .query(`DELETE FROM case_workspace_run_bindings WHERE run_id = ANY($1)`, [params.runIds])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM v8_execution_runs WHERE run_id = ANY($1)`, [params.runIds])
        .catch(() => undefined);
    }
    for (const projectId of params.projectIds) {
      await control
        .query(`DELETE FROM case_core WHERE project_id = $1`, [projectId])
        .catch(() => undefined);
      await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    }
    for (const userId of params.userIds ?? []) {
      await control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    }
    for (const orgId of params.orgIds) {
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
  }

  // -------------------------------------------------------------------------
  // 1. bindRunToPlanVersion — only a PUBLISHED plan version may be bound
  //    (CW-01-011); a DRAFT target is rejected and leaves no DB row.
  // -------------------------------------------------------------------------
  it('bindRunToPlanVersion succeeds against a PUBLISHED plan version and is rejected (no DB row) against a DRAFT plan version', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('published-vs-draft');
    const runIds: string[] = [];
    try {
      const published = await publishedPlanVersion({
        caseId,
        tag: 'published-target',
        actorId,
      });
      const draftOnly = await draftOnlyPlanVersion({
        caseId,
        tag: 'draft-target',
        actorId,
      });

      const runForPublished = `run-t1-published-${randomUUID()}`;
      runIds.push(runForPublished);
      await seedV8Run({ runId: runForPublished, organizationId: orgId });

      const binding = await runBindingService.bindRunToPlanVersion({
        runId: runForPublished,
        casePlanVersionId: published.casePlanVersionId,
        boundByActorId: actorId,
      });
      expect(binding.casePlanVersionId).toBe(published.casePlanVersionId);

      const publishedRow = await readBindingRow(runForPublished);
      expect(publishedRow).not.toBeNull();
      expect(publishedRow?.case_plan_version_id).toBe(published.casePlanVersionId);
      expect(publishedRow?.graph_digest).toBe(published.graphDigest);

      const runForDraft = `run-t1-draft-${randomUUID()}`;
      runIds.push(runForDraft);
      await seedV8Run({ runId: runForDraft, organizationId: orgId });

      await expect(
        runBindingService.bindRunToPlanVersion({
          runId: runForDraft,
          casePlanVersionId: draftOnly.casePlanVersionId,
          boundByActorId: actorId,
        })
      ).rejects.toThrow(/plan_version_not_publishable_for_run/);

      const draftAttemptRow = await readBindingRow(runForDraft);
      expect(draftAttemptRow).toBeNull();
    } finally {
      await teardown({ runIds, orgIds: [orgId], projectIds: [projectId], userIds: [actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 2. A second bind for the SAME run_id is rejected with run_already_bound,
  //    even against a different, also-PUBLISHED plan version of the same
  //    case; the DB still shows only the original binding, unchanged
  //    (CW-00-020-INV6).
  // -------------------------------------------------------------------------
  it('a second bindRunToPlanVersion for the same run_id is rejected with run_already_bound and leaves the original binding unchanged', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('already-bound');
    const runIds: string[] = [];
    try {
      const versionA = await publishedPlanVersion({
        caseId,
        tag: 'already-bound-a',
        actorId,
      });

      const runId = `run-t2-${randomUUID()}`;
      runIds.push(runId);
      await seedV8Run({ runId, organizationId: orgId });

      const firstBinding = await runBindingService.bindRunToPlanVersion({
        runId,
        casePlanVersionId: versionA.casePlanVersionId,
        boundByActorId: actorId,
      });
      expect(firstBinding.casePlanVersionId).toBe(versionA.casePlanVersionId);

      // Replan: publishing B atomically supersedes A for the same case, so B
      // is now the case's only PUBLISHED plan version — a genuinely
      // different, also-PUBLISHED target for the second bind attempt.
      const versionB = await publishedPlanVersion({
        caseId,
        tag: 'already-bound-b',
        actorId,
        supersedesPlanVersionId: versionA.casePlanVersionId,
      });
      expect(versionB.casePlanVersionId).not.toBe(versionA.casePlanVersionId);

      await expect(
        runBindingService.bindRunToPlanVersion({
          runId,
          casePlanVersionId: versionB.casePlanVersionId,
          boundByActorId: actorId,
        })
      ).rejects.toThrow(/run_already_bound/);

      const row = await readBindingRow(runId);
      expect(row).not.toBeNull();
      expect(row?.case_plan_version_id).toBe(versionA.casePlanVersionId);
      expect(row?.graph_digest).toBe(versionA.graphDigest);
      expect(row?.bound_by_actor_id).toBe(actorId);
    } finally {
      await teardown({ runIds, orgIds: [orgId], projectIds: [projectId], userIds: [actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 3. graph_digest is copied verbatim at bind time and stays fixed even
  //    after a later, unrelated plan version is created+published for the
  //    same case (CW-01-012).
  // -------------------------------------------------------------------------
  it('graph_digest on the binding row stays fixed after a later plan version is published for the same case, and is not retroactively changed by binding a second run to that later version', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('digest-fixed');
    const runIds: string[] = [];
    try {
      const versionA = await publishedPlanVersion({
        caseId,
        tag: 'digest-fixed-a',
        actorId,
      });

      const runFirst = `run-t3-first-${randomUUID()}`;
      runIds.push(runFirst);
      await seedV8Run({ runId: runFirst, organizationId: orgId });

      const firstBinding = await runBindingService.bindRunToPlanVersion({
        runId: runFirst,
        casePlanVersionId: versionA.casePlanVersionId,
        boundByActorId: actorId,
      });
      expect(firstBinding.graphDigest).toBe(versionA.graphDigest);

      const rowBeforeReplan = await readBindingRow(runFirst);
      const digestBeforeReplan = rowBeforeReplan?.graph_digest;
      expect(digestBeforeReplan).toBe(versionA.graphDigest);

      // A later, unrelated plan version for the same case (different
      // semantic content -> different digest).
      const versionB = await publishedPlanVersion({
        caseId,
        tag: 'digest-fixed-b',
        actorId,
        supersedesPlanVersionId: versionA.casePlanVersionId,
      });
      expect(versionB.graphDigest).not.toBe(versionA.graphDigest);

      // Bind a SECOND, different run_id to the later version.
      const runSecond = `run-t3-second-${randomUUID()}`;
      runIds.push(runSecond);
      await seedV8Run({ runId: runSecond, organizationId: orgId });

      const secondBinding = await runBindingService.bindRunToPlanVersion({
        runId: runSecond,
        casePlanVersionId: versionB.casePlanVersionId,
        boundByActorId: actorId,
      });
      expect(secondBinding.graphDigest).toBe(versionB.graphDigest);

      // The FIRST binding's stored graph_digest and target version must be
      // completely unaffected by the second bind.
      const rowAfterSecondBind = await readBindingRow(runFirst);
      expect(rowAfterSecondBind?.graph_digest).toBe(digestBeforeReplan);
      expect(rowAfterSecondBind?.graph_digest).toBe(versionA.graphDigest);
      expect(rowAfterSecondBind?.case_plan_version_id).toBe(versionA.casePlanVersionId);

      const rowForSecond = await readBindingRow(runSecond);
      expect(rowForSecond?.graph_digest).toBe(versionB.graphDigest);
      expect(rowForSecond?.case_plan_version_id).toBe(versionB.casePlanVersionId);
    } finally {
      await teardown({ runIds, orgIds: [orgId], projectIds: [projectId], userIds: [actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 4. run_case_organization_mismatch — the v8_execution_runs row's
  //    organization_id must match the resolved Case's organization_id.
  // -------------------------------------------------------------------------
  it('bindRunToPlanVersion is rejected with run_case_organization_mismatch when the run and the Case belong to different organizations', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('org-mismatch');
    const runIds: string[] = [];
    try {
      const published = await publishedPlanVersion({
        caseId,
        tag: 'org-mismatch',
        actorId,
      });

      // Deliberately different organization_id on the seeded run than the
      // Case's own organization_id. v8_execution_runs.organization_id has no
      // FK constraint of its own (see 20260323_v8_execution_spine_00base.sql),
      // so no separate organizations row is required for this fake org id.
      const mismatchedOrgId = `case-runbind-other-org-${randomUUID()}`;
      const runId = `run-t4-${randomUUID()}`;
      runIds.push(runId);
      await seedV8Run({ runId, organizationId: mismatchedOrgId });

      await expect(
        runBindingService.bindRunToPlanVersion({
          runId,
          casePlanVersionId: published.casePlanVersionId,
          boundByActorId: actorId,
        })
      ).rejects.toThrow(/run_case_organization_mismatch/);

      const row = await readBindingRow(runId);
      expect(row).toBeNull();
    } finally {
      await teardown({ runIds, orgIds: [orgId], projectIds: [projectId], userIds: [actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 5. listRunBindingsForCase / listRunBindingsForPlanVersion — each returns
  //    exactly the bindings in its own scope and no others (CW-RT-013,
  //    CW-00-020-INV6, CW-RT-017).
  // -------------------------------------------------------------------------
  it('listRunBindingsForCase and listRunBindingsForPlanVersion each return exactly the bindings in their own scope', async () => {
    const case1 = await seedOrgProjectCase('list-scope-1');
    const case2 = await seedOrgProjectCase('list-scope-2');
    const runIds: string[] = [];
    try {
      // Case 1: two plan versions (A1 published then superseded by A2), one
      // run bound to each.
      const versionA1 = await publishedPlanVersion({
        caseId: case1.caseId,
        tag: 'list-scope-1-a1',
        actorId: case1.actorId,
      });
      const runX = `run-t5-x-${randomUUID()}`;
      runIds.push(runX);
      await seedV8Run({ runId: runX, organizationId: case1.orgId });
      await runBindingService.bindRunToPlanVersion({
        runId: runX,
        casePlanVersionId: versionA1.casePlanVersionId,
        boundByActorId: case1.actorId,
      });

      const versionA2 = await publishedPlanVersion({
        caseId: case1.caseId,
        tag: 'list-scope-1-a2',
        actorId: case1.actorId,
        supersedesPlanVersionId: versionA1.casePlanVersionId,
      });
      const runY = `run-t5-y-${randomUUID()}`;
      runIds.push(runY);
      await seedV8Run({ runId: runY, organizationId: case1.orgId });
      await runBindingService.bindRunToPlanVersion({
        runId: runY,
        casePlanVersionId: versionA2.casePlanVersionId,
        boundByActorId: case1.actorId,
      });

      // Case 2: one plan version, one run bound.
      const versionB1 = await publishedPlanVersion({
        caseId: case2.caseId,
        tag: 'list-scope-2-b1',
        actorId: case2.actorId,
      });
      const runZ = `run-t5-z-${randomUUID()}`;
      runIds.push(runZ);
      await seedV8Run({ runId: runZ, organizationId: case2.orgId });
      await runBindingService.bindRunToPlanVersion({
        runId: runZ,
        casePlanVersionId: versionB1.casePlanVersionId,
        boundByActorId: case2.actorId,
      });

      // -- listRunBindingsForCase scoping.
      const case1Bindings = await runBindingService.listRunBindingsForCase(case1.caseId, case1.actorId);
      expect(case1Bindings.map((b) => b.runId).sort()).toEqual([runX, runY].sort());
      expect(case1Bindings.every((b) => b.caseId === case1.caseId)).toBe(true);
      expect(case1Bindings.some((b) => b.runId === runZ)).toBe(false);

      const case2Bindings = await runBindingService.listRunBindingsForCase(case2.caseId, case2.actorId);
      expect(case2Bindings.map((b) => b.runId)).toEqual([runZ]);
      expect(case2Bindings.some((b) => b.runId === runX || b.runId === runY)).toBe(false);

      // -- listRunBindingsForPlanVersion scoping: distinguishes A1 from A2
      //    even though both belong to the same case.
      const a1Bindings = await runBindingService.listRunBindingsForPlanVersion(
        versionA1.casePlanVersionId,
        case1.actorId
      );
      expect(a1Bindings.map((b) => b.runId)).toEqual([runX]);
      expect(a1Bindings.some((b) => b.runId === runY || b.runId === runZ)).toBe(false);

      const a2Bindings = await runBindingService.listRunBindingsForPlanVersion(
        versionA2.casePlanVersionId,
        case1.actorId
      );
      expect(a2Bindings.map((b) => b.runId)).toEqual([runY]);
      expect(a2Bindings.some((b) => b.runId === runX || b.runId === runZ)).toBe(false);

      const b1Bindings = await runBindingService.listRunBindingsForPlanVersion(
        versionB1.casePlanVersionId,
        case2.actorId
      );
      expect(b1Bindings.map((b) => b.runId)).toEqual([runZ]);
      expect(b1Bindings.some((b) => b.runId === runX || b.runId === runY)).toBe(false);

      // Cross-check directly against Postgres too, not just the service's
      // own return values.
      const dbCase1Rows = await readBindingRowsForCase(case1.caseId);
      expect(dbCase1Rows.map((r) => r.run_id).sort()).toEqual([runX, runY].sort());
      const dbA1Rows = await readBindingRowsForPlanVersion(versionA1.casePlanVersionId);
      expect(dbA1Rows.map((r) => r.run_id)).toEqual([runX]);
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
  // 6. AUTHORIZATION (CW-P12) — bindRunToPlanVersion (execute class): an
  //    actor with no membership in the Case's org is rejected, no row lands.
  // -------------------------------------------------------------------------
  it('bindRunToPlanVersion rejects an actor with no organization_members row for the Case\'s org, creating no binding row', async () => {
    const { orgId, projectId, caseId } = await seedOrgProjectCase('auth-bind');
    const noMembershipActor = await seedUser(orgId, 'auth-bind-outsider');
    const ownerActor = await seedMemberedUser(orgId, 'auth-bind-owner');
    const runIds: string[] = [];
    try {
      const published = await publishedPlanVersion({ caseId, tag: 'auth-bind', actorId: ownerActor });
      const runId = `run-t6-${randomUUID()}`;
      runIds.push(runId);
      await seedV8Run({ runId, organizationId: orgId });

      await expect(
        runBindingService.bindRunToPlanVersion({
          runId,
          casePlanVersionId: published.casePlanVersionId,
          boundByActorId: noMembershipActor,
        })
      ).rejects.toThrow(/case_access_denied/);

      const row = await readBindingRow(runId);
      expect(row).toBeNull();
    } finally {
      await teardown({
        runIds,
        orgIds: [orgId],
        projectIds: [projectId],
        userIds: [noMembershipActor, ownerActor],
      });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 7. AUTHORIZATION (CW-P12) — getRunBinding (read class, SEC-009
  //    hardening): a nonexistent run_id and a real run_id the actor cannot
  //    access both return null, never distinguishable via control flow.
  // -------------------------------------------------------------------------
  it('getRunBinding returns null for both a nonexistent run_id and a real binding the actor cannot access, and returns the real row for a properly-membered actor', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('auth-get');
    const noMembershipActor = await seedUser(orgId, 'auth-get-outsider');
    const runIds: string[] = [];
    try {
      const published = await publishedPlanVersion({ caseId, tag: 'auth-get', actorId });
      const runId = `run-t7-${randomUUID()}`;
      runIds.push(runId);
      await seedV8Run({ runId, organizationId: orgId });
      await runBindingService.bindRunToPlanVersion({
        runId,
        casePlanVersionId: published.casePlanVersionId,
        boundByActorId: actorId,
      });

      const missing = await runBindingService.getRunBinding(`run-nonexistent-${randomUUID()}`, noMembershipActor);
      const denied = await runBindingService.getRunBinding(runId, noMembershipActor);
      expect(missing).toBeNull();
      expect(denied).toBeNull();

      const allowed = await runBindingService.getRunBinding(runId, actorId);
      expect(allowed?.runId).toBe(runId);
    } finally {
      await teardown({
        runIds,
        orgIds: [orgId],
        projectIds: [projectId],
        userIds: [actorId, noMembershipActor],
      });
    }
  }, 30_000);
});
