/**
 * Case Workspace — ADVERSARIAL security suite closing the plan-version
 * cross-tenant EXISTENCE ORACLE (SEC-009 / CW-DOD-D6) in
 * server/src/services/caseWorkspace/casePlanVersionService.ts (CW-P02).
 *
 * ===========================================================================
 * THE HOLE
 * ===========================================================================
 * Every by-id method in casePlanVersionService.ts loads the
 * `case_plan_versions` row FIRST (to learn its owning case_id) and only
 * THEN calls caseWorkspaceAuthContext.requireCaseAccess(actor, caseId) to
 * check the caller's standing. That ordering means a planVersionId
 * belonging to a real Case in ANOTHER organization reaches requireCaseAccess
 * and throws `CaseWorkspaceAuthError('case_access_denied', ...)`, while a
 * planVersionId that does not exist at all short-circuits earlier and
 * either resolves `null` (getPlanVersion) or throws a plain
 * `Error('plan_version_not_found')` — two DIFFERENT, distinguishable
 * outcomes for what must be the same "no" answer. An attacker who can tell
 * these apart learns "this planVersionId exists, just not in your org",
 * which is exactly the cross-tenant existence disclosure SEC-009
 * ("Cross-tenant/project... references fail closed without disclosing
 * existence") and CW-DOD-D6 ("Swapped IDs... fail closed") forbid.
 *
 * requireCaseAccess ITSELF already collapses this correctly for a caseId
 * argument (see its own header's "ENUMERATION-ORACLE DECISION") — the gap
 * is specifically in casePlanVersionService.ts's by-id methods reopening it
 * by resolving the row before the check. The fix (see
 * casePlanVersionService.ts's requireCaseAccessOrPlanVersionNotFound helper
 * and getPlanVersion's own inline catch) makes every one of these methods
 * collapse a caught CaseWorkspaceAuthError into the identical
 * "not found" outcome the row-missing branch already produces.
 *
 * ===========================================================================
 * WHAT THIS SUITE PROVES
 * ===========================================================================
 * For every route that resolves a caller-supplied planVersionId (11 methods,
 * 12 comparisons — diffPlanVersions is checked on both its `planVersionId`
 * target and its `against` baseline id, the two independent lookups inside
 * one method):
 *
 *   getPlanVersion, getGraph, updatePlanDraft, validatePlanVersion,
 *   proposePlanVersion, requestChangesOnPlanVersion, publishPlanVersion,
 *   withdrawPlanVersion, getViewState, putViewState,
 *   diffPlanVersions (target lookup), diffPlanVersions (baseline lookup)
 *
 * each test calls the SAME operation twice — once with a planVersionId that
 * does not exist anywhere, once with a real planVersionId belonging to a
 * different organization's Case — and asserts the two outcomes are
 * `toEqual`-identical (same resolved value, or same thrown message with no
 * `code` distinguishing them). A positive control proves the fix did not
 * also break legitimate same-tenant access.
 *
 * Written in ATTACK mode: a RED test here is a real hole, not an authoring
 * defect.
 *
 * Runs only against a real Postgres:
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 DATABASE_URL=postgresql://... \
 *   npx vitest run <this file> --environment node
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../../caseCoreService.js';
import * as casePlanVersionService from '../../casePlanVersionService.js';
import type { CanonicalGraph } from '../../casePlanVersionService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const versionsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_plan_versions'
          AND column_name IN ('case_plan_version_id', 'case_id', 'plan_number', 'status',
                               'semantic_graph', 'graph_digest', 'review_history', 'version')`
    );
    const versionsOk = Number(versionsResult.rows[0]?.present ?? 0) === 8;

    const viewStateResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_plan_view_state'
          AND column_name IN ('case_plan_version_id', 'view_type', 'view_state')`
    );
    const viewStateOk = Number(viewStateResult.rows[0]?.present ?? 0) === 3;

    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    const orgMembersOk = Number(orgMembersResult.rows[0]?.present ?? 0) === 4;

    const outboxResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_event_outbox'
          AND column_name IN ('event_id', 'event_type', 'organization_id', 'aggregate_type',
                               'aggregate_id', 'aggregate_version', 'actor_user_id',
                               'correlation_id', 'causation_id', 'redacted_summary')`
    );
    const outboxOk = Number(outboxResult.rows[0]?.present ?? 0) === 10;

    return versionsOk && viewStateOk && orgMembersOk && outboxOk;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[planVersionEnumeration SECURITY suite SKIPPED — clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `case-workspace plan-version + event-outbox migrations applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('casePlanVersionService — plan-version cross-tenant existence oracle (SEC-009 / CW-DOD-D6)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Fixture helpers — copied from casePlanVersionService.pg.test.ts's own
  // conventions (each *.pg.test.ts in this directory keeps its own copy).
  // Every test seeds its own fixture and tears it down itself in a
  // `finally`, never a shared beforeEach.
  // -------------------------------------------------------------------------

  async function seedOrg(label: string): Promise<string> {
    const orgId = `planv-enum-org-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      orgId,
      `Plan version enumeration test org (${label})`,
    ]);
    return orgId;
  }

  async function seedUser(orgId: string, label: string): Promise<string> {
    const userId = `planv-enum-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    return userId;
  }

  async function seedMember(orgId: string, userId: string): Promise<void> {
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
      [`planv-enum-member-${randomUUID()}`, orgId, userId]
    );
  }

  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = await seedUser(orgId, label);
    await seedMember(orgId, userId);
    return userId;
  }

  /** A fresh org + project + case_core row + a real membered actor to own it. */
  async function seedOrgProjectCase(
    label: string
  ): Promise<{ orgId: string; projectId: string; caseId: string; actorId: string }> {
    const orgId = await seedOrg(label);
    const projectId = `planv-enum-project-${label}-${randomUUID()}`;
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Plan version enumeration test project (${label})`]
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

  async function teardown(orgIds: string[], projectIds: string[], userIds: string[] = []): Promise<void> {
    for (const projectId of projectIds) {
      await control
        .query(`DELETE FROM case_core WHERE project_id = $1`, [projectId])
        .catch(() => undefined);
      await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    }
    for (const userId of userIds) {
      await control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    }
    for (const orgId of orgIds) {
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
  }

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

  /**
   * Two-tenant scenario: a HOME org/case/actor (the attacker's own,
   * legitimate standing) and a FOREIGN org/case/actor with one real,
   * existing plan-version draft the home actor has NO standing on. Every
   * test below probes casePlanVersionService with (a) a planVersionId that
   * does not exist anywhere and (b) `foreignDraftId` — a REAL id, just in
   * the wrong tenant — and asserts the two calls are indistinguishable.
   */
  async function seedTwoTenantScenario(label: string): Promise<{
    homeOrgId: string;
    homeProjectId: string;
    homeCaseId: string;
    homeActorId: string;
    foreignOrgId: string;
    foreignProjectId: string;
    foreignCaseId: string;
    foreignActorId: string;
    foreignDraftId: string;
    nonexistentId: string;
  }> {
    const home = await seedOrgProjectCase(`${label}-home`);
    const foreign = await seedOrgProjectCase(`${label}-foreign`);
    const foreignDraft = await casePlanVersionService.createPlanDraft({
      caseId: foreign.caseId,
      semanticGraph: validGraph(`${label}-foreign`),
      createdByActorId: foreign.actorId,
    });
    return {
      homeOrgId: home.orgId,
      homeProjectId: home.projectId,
      homeCaseId: home.caseId,
      homeActorId: home.actorId,
      foreignOrgId: foreign.orgId,
      foreignProjectId: foreign.projectId,
      foreignCaseId: foreign.caseId,
      foreignActorId: foreign.actorId,
      foreignDraftId: foreignDraft.casePlanVersionId,
      nonexistentId: `planv-${randomUUID()}`,
    };
  }

  async function teardownScenario(s: {
    homeOrgId: string;
    homeProjectId: string;
    homeActorId: string;
    foreignOrgId: string;
    foreignProjectId: string;
    foreignActorId: string;
  }): Promise<void> {
    await teardown(
      [s.homeOrgId, s.foreignOrgId],
      [s.homeProjectId, s.foreignProjectId],
      [s.homeActorId, s.foreignActorId]
    );
  }

  // -------------------------------------------------------------------------
  // Outcome capture — the actual assertion primitive. Every route-level
  // comparison below reduces to `expect(outcomeForForeign).toEqual(outcomeForNonexistent)`.
  // -------------------------------------------------------------------------

  interface Outcome {
    kind: 'resolved' | 'rejected';
    value?: unknown;
    message?: string;
    code?: unknown;
  }

  async function capture(fn: () => Promise<unknown>): Promise<Outcome> {
    try {
      const value = await fn();
      return { kind: 'resolved', value };
    } catch (err) {
      return {
        kind: 'rejected',
        message: err instanceof Error ? err.message : String(err),
        code: err instanceof Error ? (err as { code?: unknown }).code : undefined,
      };
    }
  }

  /**
   * The core assertion: calls `forNonexistent` and `forForeign`, asserts
   * their captured outcomes are byte-for-byte `toEqual`, AND — since a
   * silently-identical "both happen to throw the SAME wrong thing" would
   * pass `toEqual` without proving anything — asserts neither outcome
   * carries the `case_access_denied` code that this exact bug used to leak
   * only for the foreign-tenant case. Also asserts both outcomes are
   * actually a denial (rejected with `plan_version_not_found`-family
   * message, or resolved `null`), never a silent success, so a mistake that
   * disabled authorization entirely would still be caught.
   */
  async function expectIndistinguishableDenial(
    forNonexistent: () => Promise<unknown>,
    forForeign: () => Promise<unknown>
  ): Promise<void> {
    const nonexistentOutcome = await capture(forNonexistent);
    const foreignOutcome = await capture(forForeign);

    expect(foreignOutcome).toEqual(nonexistentOutcome);
    expect(nonexistentOutcome.code).not.toBe('case_access_denied');
    expect(foreignOutcome.code).not.toBe('case_access_denied');

    if (nonexistentOutcome.kind === 'resolved') {
      expect(nonexistentOutcome.value).toBeNull();
    } else {
      expect(nonexistentOutcome.message).toMatch(/not_found/);
    }
  }

  // =========================================================================
  // 1. getPlanVersion — GET /plan-versions/:planVersionId
  // =========================================================================
  it('getPlanVersion: nonexistent id and cross-tenant id both resolve null, indistinguishably', async () => {
    const s = await seedTwoTenantScenario('getPlanVersion');
    try {
      await expectIndistinguishableDenial(
        () => casePlanVersionService.getPlanVersion(s.nonexistentId, s.homeActorId),
        () => casePlanVersionService.getPlanVersion(s.foreignDraftId, s.homeActorId)
      );
    } finally {
      await teardownScenario(s);
    }
  }, 30_000);

  // =========================================================================
  // 2. getGraph — GET /plan-versions/:planVersionId/graph
  // =========================================================================
  it('getGraph: nonexistent id and cross-tenant id both resolve null, indistinguishably', async () => {
    const s = await seedTwoTenantScenario('getGraph');
    try {
      await expectIndistinguishableDenial(
        () => casePlanVersionService.getGraph(s.nonexistentId, s.homeActorId),
        () => casePlanVersionService.getGraph(s.foreignDraftId, s.homeActorId)
      );
    } finally {
      await teardownScenario(s);
    }
  }, 30_000);

  // =========================================================================
  // 3. updatePlanDraft — PUT /plan-versions/:planVersionId
  // =========================================================================
  it('updatePlanDraft: nonexistent id and cross-tenant id throw the identical plan_version_not_found, indistinguishably', async () => {
    const s = await seedTwoTenantScenario('updatePlanDraft');
    try {
      await expectIndistinguishableDenial(
        () =>
          casePlanVersionService.updatePlanDraft(
            s.nonexistentId,
            { semanticGraph: validGraph('u1'), expectedVersion: 1 },
            { actorUserId: s.homeActorId }
          ),
        () =>
          casePlanVersionService.updatePlanDraft(
            s.foreignDraftId,
            { semanticGraph: validGraph('u2'), expectedVersion: 1 },
            { actorUserId: s.homeActorId }
          )
      );
    } finally {
      await teardownScenario(s);
    }
  }, 30_000);

  // =========================================================================
  // 4. validatePlanVersion — GET /plan-versions/:planVersionId/validate
  // =========================================================================
  it('validatePlanVersion: nonexistent id and cross-tenant id throw the identical plan_version_not_found, indistinguishably', async () => {
    const s = await seedTwoTenantScenario('validatePlanVersion');
    try {
      await expectIndistinguishableDenial(
        () => casePlanVersionService.validatePlanVersion(s.nonexistentId, s.homeActorId),
        () => casePlanVersionService.validatePlanVersion(s.foreignDraftId, s.homeActorId)
      );
    } finally {
      await teardownScenario(s);
    }
  }, 30_000);

  // =========================================================================
  // 5. proposePlanVersion — POST /plan-versions/:planVersionId/propose
  // =========================================================================
  it('proposePlanVersion: nonexistent id and cross-tenant id throw the identical plan_version_not_found, indistinguishably', async () => {
    const s = await seedTwoTenantScenario('proposePlanVersion');
    try {
      await expectIndistinguishableDenial(
        () => casePlanVersionService.proposePlanVersion(s.nonexistentId, { actorUserId: s.homeActorId }, 1),
        () => casePlanVersionService.proposePlanVersion(s.foreignDraftId, { actorUserId: s.homeActorId }, 1)
      );
    } finally {
      await teardownScenario(s);
    }
  }, 30_000);

  // =========================================================================
  // 6. requestChangesOnPlanVersion — POST /plan-versions/:planVersionId/request-changes
  // =========================================================================
  it('requestChangesOnPlanVersion: nonexistent id and cross-tenant id throw the identical plan_version_not_found, indistinguishably', async () => {
    const s = await seedTwoTenantScenario('requestChanges');
    try {
      await expectIndistinguishableDenial(
        () =>
          casePlanVersionService.requestChangesOnPlanVersion(
            s.nonexistentId,
            { actorUserId: s.homeActorId },
            'attack probe',
            1
          ),
        () =>
          casePlanVersionService.requestChangesOnPlanVersion(
            s.foreignDraftId,
            { actorUserId: s.homeActorId },
            'attack probe',
            1
          )
      );
    } finally {
      await teardownScenario(s);
    }
  }, 30_000);

  // =========================================================================
  // 7. publishPlanVersion — POST /plan-versions/:planVersionId/publish
  // =========================================================================
  it('publishPlanVersion: nonexistent id and cross-tenant id throw the identical plan_version_not_found, indistinguishably', async () => {
    const s = await seedTwoTenantScenario('publishPlanVersion');
    try {
      await expectIndistinguishableDenial(
        () => casePlanVersionService.publishPlanVersion(s.nonexistentId, { actorUserId: s.homeActorId }, 1),
        () => casePlanVersionService.publishPlanVersion(s.foreignDraftId, { actorUserId: s.homeActorId }, 1)
      );
    } finally {
      await teardownScenario(s);
    }
  }, 30_000);

  // =========================================================================
  // 8. withdrawPlanVersion — POST /plan-versions/:planVersionId/withdraw
  // =========================================================================
  it('withdrawPlanVersion: nonexistent id and cross-tenant id throw the identical plan_version_not_found, indistinguishably', async () => {
    const s = await seedTwoTenantScenario('withdrawPlanVersion');
    try {
      await expectIndistinguishableDenial(
        () =>
          casePlanVersionService.withdrawPlanVersion(
            s.nonexistentId,
            { actorUserId: s.homeActorId },
            'attack probe',
            1
          ),
        () =>
          casePlanVersionService.withdrawPlanVersion(
            s.foreignDraftId,
            { actorUserId: s.homeActorId },
            'attack probe',
            1
          )
      );
    } finally {
      await teardownScenario(s);
    }
  }, 30_000);

  // =========================================================================
  // 9. getViewState — GET /plan-versions/:planVersionId/view-state/:viewType
  // =========================================================================
  it('getViewState: nonexistent id and cross-tenant id throw the identical plan_version_not_found, indistinguishably', async () => {
    const s = await seedTwoTenantScenario('getViewState');
    try {
      await expectIndistinguishableDenial(
        () => casePlanVersionService.getViewState(s.nonexistentId, 'SIMPLE', s.homeActorId),
        () => casePlanVersionService.getViewState(s.foreignDraftId, 'SIMPLE', s.homeActorId)
      );
    } finally {
      await teardownScenario(s);
    }
  }, 30_000);

  // =========================================================================
  // 10. putViewState — PUT /plan-versions/:planVersionId/view-state/:viewType
  // =========================================================================
  it('putViewState: nonexistent id and cross-tenant id throw the identical plan_version_not_found, indistinguishably', async () => {
    const s = await seedTwoTenantScenario('putViewState');
    try {
      await expectIndistinguishableDenial(
        () =>
          casePlanVersionService.putViewState(s.nonexistentId, 'SIMPLE', { zoom: 1 }, { actorUserId: s.homeActorId }),
        () =>
          casePlanVersionService.putViewState(s.foreignDraftId, 'SIMPLE', { zoom: 1 }, { actorUserId: s.homeActorId })
      );
    } finally {
      await teardownScenario(s);
    }
  }, 30_000);

  // =========================================================================
  // 11. diffPlanVersions (target lookup) — GET /cases/:caseId/plan-versions/:planVersionId/diff
  // =========================================================================
  it('diffPlanVersions target: nonexistent id and cross-tenant id throw the identical plan_version_not_found, indistinguishably', async () => {
    const s = await seedTwoTenantScenario('diffTarget');
    try {
      await expectIndistinguishableDenial(
        () => casePlanVersionService.diffPlanVersions(s.homeCaseId, s.nonexistentId, undefined, s.homeActorId),
        () => casePlanVersionService.diffPlanVersions(s.homeCaseId, s.foreignDraftId, undefined, s.homeActorId)
      );
    } finally {
      await teardownScenario(s);
    }
  }, 30_000);

  // =========================================================================
  // 12. diffPlanVersions (baseline `against` lookup) — same route, second id
  // =========================================================================
  it('diffPlanVersions baseline (`against`): nonexistent id and cross-tenant id throw the identical plan_diff_baseline_not_found, indistinguishably', async () => {
    const s = await seedTwoTenantScenario('diffBaseline');
    try {
      // A real, home-owned target the actor legitimately has standing on —
      // isolates the assertion to the SECOND lookup (`against`), not the
      // first (already covered by test 11 above).
      const homeTarget = await casePlanVersionService.createPlanDraft({
        caseId: s.homeCaseId,
        semanticGraph: validGraph('diffBaseline-target'),
        createdByActorId: s.homeActorId,
      });

      await expectIndistinguishableDenial(
        () =>
          casePlanVersionService.diffPlanVersions(
            s.homeCaseId,
            homeTarget.casePlanVersionId,
            { against: s.nonexistentId },
            s.homeActorId
          ),
        () =>
          casePlanVersionService.diffPlanVersions(
            s.homeCaseId,
            homeTarget.casePlanVersionId,
            { against: s.foreignDraftId },
            s.homeActorId
          )
      );
    } finally {
      await teardownScenario(s);
    }
  }, 30_000);

  // =========================================================================
  // POSITIVE CONTROL — the fix must not have also broken legitimate,
  // same-tenant access. A gate that refuses everything (including its own
  // owner) proves nothing about the specific oracle it claims to close.
  // =========================================================================
  it('POSITIVE CONTROL: the home actor still fully reads/mutates their own, real plan version after the fix', async () => {
    const s = await seedTwoTenantScenario('positiveControl');
    try {
      const homeDraft = await casePlanVersionService.createPlanDraft({
        caseId: s.homeCaseId,
        semanticGraph: validGraph('positive-control'),
        createdByActorId: s.homeActorId,
      });

      const found = await casePlanVersionService.getPlanVersion(homeDraft.casePlanVersionId, s.homeActorId);
      expect(found?.casePlanVersionId).toBe(homeDraft.casePlanVersionId);

      const graph = await casePlanVersionService.getGraph(homeDraft.casePlanVersionId, s.homeActorId);
      expect(graph?.graphDigest).toBe(homeDraft.graphDigest);

      const validation = await casePlanVersionService.validatePlanVersion(
        homeDraft.casePlanVersionId,
        s.homeActorId
      );
      expect(validation.valid).toBe(true);

      const viewState = await casePlanVersionService.putViewState(
        homeDraft.casePlanVersionId,
        'SIMPLE',
        { zoom: 1.5 },
        { actorUserId: s.homeActorId }
      );
      expect(viewState.casePlanVersionId).toBe(homeDraft.casePlanVersionId);

      const proposed = await casePlanVersionService.proposePlanVersion(
        homeDraft.casePlanVersionId,
        { actorUserId: s.homeActorId },
        homeDraft.version
      );
      expect(proposed.status).toBe('IN_REVIEW');

      const published = await casePlanVersionService.publishPlanVersion(
        homeDraft.casePlanVersionId,
        { actorUserId: s.homeActorId },
        proposed.version
      );
      expect(published.status).toBe('PUBLISHED');

      const withdrawn = await casePlanVersionService.withdrawPlanVersion(
        homeDraft.casePlanVersionId,
        { actorUserId: s.homeActorId },
        'positive control cleanup',
        published.version
      );
      expect(withdrawn.status).toBe('WITHDRAWN');
    } finally {
      await teardownScenario(s);
    }
  }, 30_000);
});
