/**
 * Case Workspace — Play (reusable Process) service, proved against a REAL
 * PostgreSQL (CW-P08, EPIC E12 "Reusable Plays"). Exercises
 * server/src/services/caseWorkspace/playService.ts against the schema in
 * server/migrations/20260809_case_workspace_plays.sql (process_definitions,
 * process_versions) plus the pre-existing organization_members table
 * (20260412_organization_switch_log.sql / 727_beta_missing_tables.sql) that
 * isAuthorizedPublisher() reads, and the pre-existing case_core/
 * case_plan_versions tables that instantiateProcessVersion() cross-checks
 * and writes through (casePlanVersionService.createPlanDraft).
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same convention as casePlanVersionService.pg.test.ts (CW-P02) /
 * caseCoreService.pg.test.ts (CW-P01): `NODE_ENV=test` ALONE is a trap —
 * `Database.ts`'s `getDatabase()`/`createDatabase()` hand back an in-memory
 * MOCK whenever `RUN_DB_TESTS !== '1'` (or `MOCK_DB` isn't explicitly
 * `'false'`), and every write silently becomes a no-op. This file follows the
 * `*.pg.test.ts` convention: gate on `RUN_DB_TESTS === '1' && MOCK_DB ===
 * 'false'`, probe reachability AND that the migrated schema is actually
 * present before deciding, and SKIP LOUDLY (never silently pass) when either
 * is missing.
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/playService.pg.test.ts
 *
 * ===========================================================================
 * ISOLATION — every test owns its own fixture (org/users/definition/case)
 * ===========================================================================
 * Every test seeds its own organization, its own users (+ organization_members
 * rows where an authorization test needs them), and — when instantiation is
 * exercised — its own project/case_core row via caseCoreService.createCase,
 * all inside the test body (never a shared beforeEach), and tears everything
 * down itself in a `finally`. organization_members rows are seeded here via
 * direct INSERTs on the out-of-band pool — this is a test-fixture-only direct
 * insert, not a production code path; nothing in playService.ts itself writes
 * to organization_members.
 *
 * All assertions read the actual `process_definitions` / `process_versions` /
 * `case_plan_versions` rows back out of Postgres through a dedicated,
 * out-of-band `pg.Pool` (`control`) — never the service function's return
 * value alone — because the return value only proves what the service THINKS
 * it wrote, not what actually landed.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import type { CanonicalGraph } from '../casePlanVersionService.js';
import * as playService from '../playService.js';

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
    const definitionsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'process_definitions'
          AND column_name IN ('process_definition_id', 'organization_id', 'visibility',
                               'owner_actor_id', 'created_by_actor_id', 'shared_at',
                               'shared_by_actor_id', 'version')`
    );
    const definitionsOk = Number(definitionsResult.rows[0]?.present ?? 0) === 8;

    const versionsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'process_versions'
          AND column_name IN ('process_version_id', 'process_definition_id', 'version_number',
                               'status', 'semantic_graph', 'graph_digest', 'review_history',
                               'reviewed_at', 'reviewed_by_actor_id', 'review_decision',
                               'published_at', 'version')`
    );
    const versionsOk = Number(versionsResult.rows[0]?.present ?? 0) === 12;

    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role')`
    );
    const orgMembersOk = Number(orgMembersResult.rows[0]?.present ?? 0) === 3;

    const planVersionsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_plan_versions'
          AND column_name IN ('case_plan_version_id', 'case_id', 'status',
                               'source_process_version_id', 'semantic_graph')`
    );
    const planVersionsOk = Number(planVersionsResult.rows[0]?.present ?? 0) === 5;

    return definitionsOk && versionsOk && orgMembersOk && planVersionsOk;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[playService pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260809_case_workspace_plays.sql migration applied (on top of 20260809_case_workspace_case_core.sql, ` +
      `20260809_case_workspace_case_plan_version.sql and organization_members). requested=${REAL_DB_REQUESTED} ` +
      `reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface ProcessDefinitionDbRow {
  process_definition_id: string;
  organization_id: string;
  visibility: string;
  owner_actor_id: string;
  created_by_actor_id: string;
  shared_at: string | null;
  shared_by_actor_id: string | null;
  version: number;
}

interface ProcessVersionDbRow {
  process_version_id: string;
  process_definition_id: string;
  status: string;
  reviewed_at: string | null;
  reviewed_by_actor_id: string | null;
  review_decision: string | null;
  published_at: string | null;
  semantic_graph: string;
  version: number;
}

interface CasePlanVersionDbRow {
  case_plan_version_id: string;
  case_id: string;
  status: string;
  source_process_version_id: string | null;
  semantic_graph: string;
}

suite('playService — Play (reusable Process) against a real PostgreSQL (CW-P08, E12)', () => {
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

  /** A fresh, uniquely-named organization row. */
  async function seedOrg(label: string): Promise<string> {
    const orgId = `play-org-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      orgId,
      `Play test org (${label})`,
    ]);
    return orgId;
  }

  /** A fresh, uniquely-named project row for an existing organization. */
  async function seedProject(orgId: string, label: string): Promise<string> {
    const projectId = `play-project-${label}-${randomUUID()}`;
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Play test project (${label})`]
    );
    return projectId;
  }

  /** A fresh organization + project + case_core row (mirrors casePlanVersionService.pg.test.ts's seedOrgProjectCase). */
  async function seedOrgProjectCase(
    label: string
  ): Promise<{ orgId: string; projectId: string; caseId: string }> {
    const orgId = await seedOrg(label);
    const projectId = await seedProject(orgId, label);
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: `actor-play-case-${label}`,
    });
    return { orgId, projectId, caseId: created.caseId };
  }

  /** A fresh users row, unattached to organization_members unless seedMember() is also called for it. */
  async function seedUser(orgId: string, label: string): Promise<string> {
    const userId = `play-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    return userId;
  }

  /** An organization_members row for an existing user, at the given role — a test-fixture-only direct insert. */
  async function seedMember(orgId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT'): Promise<void> {
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [`play-member-${randomUUID()}`, orgId, userId, role]
    );
  }

  /**
   * Full teardown for a fixture created via the helpers above. Order matters:
   * process_definitions has no ON DELETE CASCADE from organizations, so it
   * must go first (it cascades process_versions itself); case_core cascades
   * case_plan_versions/case_plan_view_state; users must be deleted before
   * organizations (users.organization_id has no ON DELETE CASCADE) and that
   * delete cascades organization_members (which does have ON DELETE CASCADE
   * from both organizations and users).
   */
  async function teardown(opts: {
    orgIds?: string[];
    projectIds?: string[];
    userIds?: string[];
    processDefinitionIds?: string[];
  }): Promise<void> {
    for (const processDefinitionId of opts.processDefinitionIds ?? []) {
      await control
        .query(`DELETE FROM process_definitions WHERE process_definition_id = $1`, [processDefinitionId])
        .catch(() => undefined);
    }
    for (const projectId of opts.projectIds ?? []) {
      await control.query(`DELETE FROM case_core WHERE project_id = $1`, [projectId]).catch(() => undefined);
      await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    }
    for (const userId of opts.userIds ?? []) {
      await control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    }
    for (const orgId of opts.orgIds ?? []) {
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
  }

  async function readDefinitionRow(processDefinitionId: string): Promise<ProcessDefinitionDbRow | null> {
    const result = await control.query<ProcessDefinitionDbRow>(
      `SELECT * FROM process_definitions WHERE process_definition_id = $1`,
      [processDefinitionId]
    );
    return result.rows[0] ?? null;
  }

  async function readVersionRow(processVersionId: string): Promise<ProcessVersionDbRow | null> {
    const result = await control.query<ProcessVersionDbRow>(
      `SELECT * FROM process_versions WHERE process_version_id = $1`,
      [processVersionId]
    );
    return result.rows[0] ?? null;
  }

  async function readCasePlanVersionRowsForCase(caseId: string): Promise<CasePlanVersionDbRow[]> {
    const result = await control.query<CasePlanVersionDbRow>(
      `SELECT * FROM case_plan_versions WHERE case_id = $1`,
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

  /**
   * Draft -> propose -> review(APPROVED) -> publish, all against a fresh
   * process_version on an existing definition. Returns the PUBLISHED
   * ProcessVersion.
   */
  async function createPublishedVersion(processDefinitionId: string, actorId: string, tag: string) {
    const draft = await playService.createProcessVersionDraft({
      processDefinitionId,
      semanticGraph: validGraph(tag),
      createdByActorId: actorId,
    });
    const proposed = await playService.proposeProcessVersion(
      draft.processVersionId,
      { actorUserId: actorId },
      draft.version
    );
    const reviewed = await playService.reviewProcessVersion(
      draft.processVersionId,
      { actorUserId: actorId },
      'APPROVED',
      undefined,
      proposed.version
    );
    return playService.publishProcessVersion(draft.processVersionId, { actorUserId: actorId }, reviewed.version);
  }

  // -------------------------------------------------------------------------
  // 1. createProcessDefinition — always PRIVATE, no caller-supplied override.
  // -------------------------------------------------------------------------
  it('createProcessDefinition always creates a PRIVATE row regardless of any visibility-like input', async () => {
    const orgId = await seedOrg('force-private');
    const userId = await seedUser(orgId, 'force-private');
    try {
      // Attempt to smuggle a widened visibility / already-shared-looking
      // input past the public type via a cast — the service must ignore it
      // and force visibility='PRIVATE' server-side regardless.
      const attemptedOverride = {
        organizationId: orgId,
        name: 'Attempted visibility override',
        ownerActorId: userId,
        createdByActorId: userId,
        visibility: 'ORGANIZATION',
        sharedAt: new Date().toISOString(),
        sharedByActorId: userId,
      } as unknown as Parameters<typeof playService.createProcessDefinition>[0];

      const created = await playService.createProcessDefinition(attemptedOverride);
      expect(created.visibility).toBe('PRIVATE');

      const row = await readDefinitionRow(created.processDefinitionId);
      expect(row?.visibility).toBe('PRIVATE');
      expect(row?.shared_at).toBeNull();
      expect(row?.shared_by_actor_id).toBeNull();
    } finally {
      await teardown({ orgIds: [orgId], userIds: [userId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 2. shareProcessDefinition — authorization gate + published-version gate,
  //    then a real success once both are satisfied.
  // -------------------------------------------------------------------------
  it('shareProcessDefinition rejects an actor with no organization_members row and an actor with a MEMBER row (even as the definition owner), then succeeds for an ADMIN actor once a PUBLISHED version exists', async () => {
    const orgId = await seedOrg('share-gate');
    const ownerUserId = await seedUser(orgId, 'owner-no-membership');
    const memberUserId = await seedUser(orgId, 'member-role');
    const adminUserId = await seedUser(orgId, 'admin-role');
    try {
      // The definition's own owner_actor_id/created_by_actor_id is
      // ownerUserId, but ownerUserId has NO organization_members row at all.
      const definition = await playService.createProcessDefinition({
        organizationId: orgId,
        name: 'Share gate play',
        ownerActorId: ownerUserId,
        createdByActorId: ownerUserId,
      });
      expect(definition.visibility).toBe('PRIVATE');

      // At least one PUBLISHED version exists from the start, so the ONLY
      // thing under test in (a)/(b) below is the authorization gate, not the
      // published-version gate.
      await createPublishedVersion(definition.processDefinitionId, ownerUserId, 'share-gate-v1');

      // (a) ownerUserId (the definition's own owner/creator) has NO
      // organization_members row for this org at all.
      await expect(
        playService.shareProcessDefinition(definition.processDefinitionId, 'ORGANIZATION', { actorUserId: ownerUserId }, definition.version)
      ).rejects.toThrow(/process_definition_share_not_authorized/);

      const rowAfterA = await readDefinitionRow(definition.processDefinitionId);
      expect(rowAfterA?.visibility).toBe('PRIVATE');
      expect(rowAfterA?.version).toBe(definition.version);

      // (b) memberUserId has an organization_members row, but role=MEMBER
      // (not OWNER/ADMIN).
      await seedMember(orgId, memberUserId, 'MEMBER');
      await expect(
        playService.shareProcessDefinition(definition.processDefinitionId, 'ORGANIZATION', { actorUserId: memberUserId }, definition.version)
      ).rejects.toThrow(/process_definition_share_not_authorized/);

      const rowAfterB = await readDefinitionRow(definition.processDefinitionId);
      expect(rowAfterB?.visibility).toBe('PRIVATE');
      expect(rowAfterB?.version).toBe(definition.version);

      // Success: adminUserId has an ADMIN organization_members row, and the
      // definition already has >=1 PUBLISHED version from above.
      await seedMember(orgId, adminUserId, 'ADMIN');
      const shared = await playService.shareProcessDefinition(
        definition.processDefinitionId,
        'ORGANIZATION',
        { actorUserId: adminUserId },
        definition.version
      );
      expect(shared.visibility).toBe('ORGANIZATION');
      expect(shared.sharedByActorId).toBe(adminUserId);

      const rowAfterSuccess = await readDefinitionRow(definition.processDefinitionId);
      expect(rowAfterSuccess?.visibility).toBe('ORGANIZATION');
      expect(rowAfterSuccess?.shared_by_actor_id).toBe(adminUserId);
      expect(rowAfterSuccess?.shared_at).toBeTruthy();
      expect(rowAfterSuccess?.version).toBe(definition.version + 1);
    } finally {
      await teardown({ orgIds: [orgId], userIds: [ownerUserId, memberUserId, adminUserId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 3. shareProcessDefinition — rejected with zero PUBLISHED versions, even
  //    for an ADMIN actor.
  // -------------------------------------------------------------------------
  it('shareProcessDefinition is rejected when the definition has ZERO published versions, even for an ADMIN actor', async () => {
    const orgId = await seedOrg('share-no-published');
    const adminUserId = await seedUser(orgId, 'admin-no-published');
    await seedMember(orgId, adminUserId, 'ADMIN');
    try {
      const definition = await playService.createProcessDefinition({
        organizationId: orgId,
        name: 'Never published play',
        ownerActorId: adminUserId,
        createdByActorId: adminUserId,
      });

      // A DRAFT version exists, but none is PUBLISHED.
      await playService.createProcessVersionDraft({
        processDefinitionId: definition.processDefinitionId,
        semanticGraph: validGraph('unpublished'),
        createdByActorId: adminUserId,
      });

      await expect(
        playService.shareProcessDefinition(
          definition.processDefinitionId,
          'ORGANIZATION',
          { actorUserId: adminUserId },
          definition.version
        )
      ).rejects.toThrow(/process_definition_share_requires_published_version/);

      const row = await readDefinitionRow(definition.processDefinitionId);
      expect(row?.visibility).toBe('PRIVATE');
      expect(row?.shared_at).toBeNull();
      expect(row?.version).toBe(definition.version);
    } finally {
      await teardown({ orgIds: [orgId], userIds: [adminUserId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 4. publishProcessVersion — rejected without a prior APPROVED review.
  // -------------------------------------------------------------------------
  it('publishProcessVersion is rejected for an IN_REVIEW version with no reviewProcessVersion call recorded, leaving the DB row unchanged', async () => {
    const orgId = await seedOrg('publish-needs-review');
    const userId = await seedUser(orgId, 'publish-needs-review');
    try {
      const definition = await playService.createProcessDefinition({
        organizationId: orgId,
        name: 'Publish without review play',
        ownerActorId: userId,
        createdByActorId: userId,
      });
      const draft = await playService.createProcessVersionDraft({
        processDefinitionId: definition.processDefinitionId,
        semanticGraph: validGraph('publish-needs-review'),
        createdByActorId: userId,
      });
      const proposed = await playService.proposeProcessVersion(
        draft.processVersionId,
        { actorUserId: userId },
        draft.version
      );
      expect(proposed.status).toBe('IN_REVIEW');
      expect(proposed.reviewDecision).toBeNull();

      await expect(
        playService.publishProcessVersion(draft.processVersionId, { actorUserId: userId }, proposed.version)
      ).rejects.toThrow(/process_version_publish_requires_review/);

      const row = await readVersionRow(draft.processVersionId);
      expect(row?.status).toBe('IN_REVIEW');
      expect(row?.published_at).toBeNull();
      expect(row?.review_decision).toBeNull();
      expect(row?.version).toBe(proposed.version);
    } finally {
      await teardown({ orgIds: [orgId], userIds: [userId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 5. reviewProcessVersion(CHANGES_REQUESTED) — back to DRAFT, review fields
  //    reset to NULL even after an earlier APPROVED had set them; then the
  //    end-to-end propose -> review(APPROVED) -> publish flow succeeds.
  // -------------------------------------------------------------------------
  it('a CHANGES_REQUESTED review sends the version back to DRAFT and resets review_decision/reviewed_by_actor_id/reviewed_at to NULL, then a redo propose/review/publish cycle succeeds', async () => {
    const orgId = await seedOrg('changes-requested-reset');
    const authorId = await seedUser(orgId, 'author');
    const reviewerId = await seedUser(orgId, 'reviewer');
    try {
      const definition = await playService.createProcessDefinition({
        organizationId: orgId,
        name: 'Changes requested reset play',
        ownerActorId: authorId,
        createdByActorId: authorId,
      });
      const draft = await playService.createProcessVersionDraft({
        processDefinitionId: definition.processDefinitionId,
        semanticGraph: validGraph('changes-requested-v1'),
        createdByActorId: authorId,
      });
      const proposed1 = await playService.proposeProcessVersion(
        draft.processVersionId,
        { actorUserId: authorId },
        draft.version
      );

      // First review cycle: APPROVED — sets reviewed_at/reviewed_by_actor_id/
      // review_decision on the row.
      const approved = await playService.reviewProcessVersion(
        draft.processVersionId,
        { actorUserId: reviewerId },
        'APPROVED',
        undefined,
        proposed1.version
      );
      expect(approved.status).toBe('IN_REVIEW');
      expect(approved.reviewDecision).toBe('APPROVED');

      const rowAfterApproved = await readVersionRow(draft.processVersionId);
      expect(rowAfterApproved?.review_decision).toBe('APPROVED');
      expect(rowAfterApproved?.reviewed_by_actor_id).toBe(reviewerId);
      expect(rowAfterApproved?.reviewed_at).toBeTruthy();

      // Second review cycle on the SAME still-IN_REVIEW row: CHANGES_REQUESTED
      // — must reset all three review fields to NULL, not just flip status.
      const changesRequested = await playService.reviewProcessVersion(
        draft.processVersionId,
        { actorUserId: reviewerId },
        'CHANGES_REQUESTED',
        'graph needs another pass',
        approved.version
      );
      expect(changesRequested.status).toBe('DRAFT');
      expect(changesRequested.reviewDecision).toBeNull();
      expect(changesRequested.reviewedByActorId).toBeNull();
      expect(changesRequested.reviewedAt).toBeNull();

      const rowAfterChangesRequested = await readVersionRow(draft.processVersionId);
      expect(rowAfterChangesRequested?.status).toBe('DRAFT');
      expect(rowAfterChangesRequested?.review_decision).toBeNull();
      expect(rowAfterChangesRequested?.reviewed_by_actor_id).toBeNull();
      expect(rowAfterChangesRequested?.reviewed_at).toBeNull();
      expect(rowAfterChangesRequested?.published_at).toBeNull();

      // Redo the flow for real: propose again, review APPROVED, publish.
      const proposed2 = await playService.proposeProcessVersion(
        draft.processVersionId,
        { actorUserId: authorId },
        changesRequested.version
      );
      expect(proposed2.status).toBe('IN_REVIEW');

      const approvedAgain = await playService.reviewProcessVersion(
        draft.processVersionId,
        { actorUserId: reviewerId },
        'APPROVED',
        undefined,
        proposed2.version
      );
      expect(approvedAgain.reviewDecision).toBe('APPROVED');

      const published = await playService.publishProcessVersion(
        draft.processVersionId,
        { actorUserId: authorId },
        approvedAgain.version
      );
      expect(published.status).toBe('PUBLISHED');

      const rowAfterPublish = await readVersionRow(draft.processVersionId);
      expect(rowAfterPublish?.status).toBe('PUBLISHED');
      expect(rowAfterPublish?.published_at).toBeTruthy();
      expect(rowAfterPublish?.review_decision).toBe('APPROVED');

      // review_history stayed append-only through the whole redo cycle.
      expect(published.reviewHistory.map((entry) => entry.event)).toEqual([
        'PROPOSED',
        'APPROVED',
        'CHANGES_REQUESTED',
        'PROPOSED',
        'APPROVED',
        'PUBLISHED',
      ]);
    } finally {
      await teardown({ orgIds: [orgId], userIds: [authorId, reviewerId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 6. instantiateProcessVersion — rejects DRAFT and IN_REVIEW versions.
  // -------------------------------------------------------------------------
  it('instantiateProcessVersion rejects a DRAFT process_version and an IN_REVIEW process_version, creating no case_plan_versions row for either attempt', async () => {
    const { orgId, projectId, caseId } = await seedOrgProjectCase('instantiate-not-published');
    const userId = await seedUser(orgId, 'instantiate-not-published');
    try {
      const definition = await playService.createProcessDefinition({
        organizationId: orgId,
        name: 'Not-yet-published play',
        ownerActorId: userId,
        createdByActorId: userId,
      });
      const draft = await playService.createProcessVersionDraft({
        processDefinitionId: definition.processDefinitionId,
        semanticGraph: validGraph('not-published'),
        createdByActorId: userId,
      });
      expect(draft.status).toBe('DRAFT');

      await expect(
        playService.instantiateProcessVersion(draft.processVersionId, caseId, { actorUserId: userId })
      ).rejects.toThrow(/process_version_not_publishable/);

      const rowsAfterDraftAttempt = await readCasePlanVersionRowsForCase(caseId);
      expect(rowsAfterDraftAttempt).toHaveLength(0);

      const proposed = await playService.proposeProcessVersion(
        draft.processVersionId,
        { actorUserId: userId },
        draft.version
      );
      expect(proposed.status).toBe('IN_REVIEW');

      await expect(
        playService.instantiateProcessVersion(draft.processVersionId, caseId, { actorUserId: userId })
      ).rejects.toThrow(/process_version_not_publishable/);

      const rowsAfterInReviewAttempt = await readCasePlanVersionRowsForCase(caseId);
      expect(rowsAfterInReviewAttempt).toHaveLength(0);
    } finally {
      await teardown({ orgIds: [orgId], projectIds: [projectId], userIds: [userId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 7. instantiateProcessVersion — cross-tenant rejection.
  // -------------------------------------------------------------------------
  it('instantiateProcessVersion rejects with process_version_case_organization_mismatch when the target case belongs to a different organization than the Play, creating no case_plan_versions row', async () => {
    const playOrgId = await seedOrg('instantiate-cross-tenant-play');
    const playUserId = await seedUser(playOrgId, 'instantiate-cross-tenant-play');
    const { orgId: caseOrgId, projectId: caseProjectId, caseId } = await seedOrgProjectCase(
      'instantiate-cross-tenant-case'
    );
    try {
      expect(caseOrgId).not.toBe(playOrgId);

      const definition = await playService.createProcessDefinition({
        organizationId: playOrgId,
        name: 'Cross-tenant play',
        ownerActorId: playUserId,
        createdByActorId: playUserId,
      });
      const published = await createPublishedVersion(definition.processDefinitionId, playUserId, 'cross-tenant');
      expect(published.status).toBe('PUBLISHED');

      await expect(
        playService.instantiateProcessVersion(published.processVersionId, caseId, { actorUserId: playUserId })
      ).rejects.toThrow(/process_version_case_organization_mismatch/);

      const rows = await readCasePlanVersionRowsForCase(caseId);
      expect(rows).toHaveLength(0);
    } finally {
      await teardown({ orgIds: [playOrgId], userIds: [playUserId] });
      await teardown({ orgIds: [caseOrgId], projectIds: [caseProjectId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 8. instantiateProcessVersion — success creates a real case_plan_versions
  //    row, verified directly against Postgres.
  // -------------------------------------------------------------------------
  it('a successful instantiateProcessVersion (matching orgs, PUBLISHED version) creates a DRAFT case_plan_versions row whose source_process_version_id and semantic_graph match the ProcessVersion, verified by reading Postgres directly', async () => {
    const { orgId, projectId, caseId } = await seedOrgProjectCase('instantiate-success');
    const userId = await seedUser(orgId, 'instantiate-success');
    try {
      const definition = await playService.createProcessDefinition({
        organizationId: orgId,
        name: 'Instantiate success play',
        ownerActorId: userId,
        createdByActorId: userId,
      });
      const published = await createPublishedVersion(definition.processDefinitionId, userId, 'instantiate-success');
      expect(published.status).toBe('PUBLISHED');

      const result = await playService.instantiateProcessVersion(published.processVersionId, caseId, {
        actorUserId: userId,
      });
      expect(result.status).toBe('DRAFT');
      expect(result.sourceProcessVersionId).toBe(published.processVersionId);

      // Read straight from Postgres — not just the return value.
      const rows = await readCasePlanVersionRowsForCase(caseId);
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row.case_plan_version_id).toBe(result.casePlanVersionId);
      expect(row.status).toBe('DRAFT');
      expect(row.source_process_version_id).toBe(published.processVersionId);

      const versionRow = await readVersionRow(published.processVersionId);
      expect(versionRow).not.toBeNull();
      expect(JSON.parse(row.semantic_graph)).toEqual(JSON.parse(versionRow!.semantic_graph));
    } finally {
      await teardown({ orgIds: [orgId], projectIds: [projectId], userIds: [userId] });
    }
  }, 30_000);
});
