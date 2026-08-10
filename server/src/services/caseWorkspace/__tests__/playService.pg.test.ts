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
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import type { CanonicalGraph } from '../casePlanVersionService.js';
import * as playService from '../playService.js';

/**
 * ===========================================================================
 * ROLLBACK HARNESS — how "a forced failure after the mutation leaves NO
 * outbox row" is proved without touching shared schema
 * ===========================================================================
 * EVENT_TAXONOMY §6.6 requires each command's realDB suite to prove both
 * directions of the atomicity claim: one outbox row on success, and ZERO
 * after a forced failure. Proving the second direction needs a failure that
 * lands strictly AFTER the aggregate write AND after the outbox INSERT —
 * anything failing earlier proves nothing, because the outbox would then be
 * empty for the trivial reason that publishEvent never ran.
 *
 * The mechanism is a pass-through module mock: `publishEvent` calls the REAL
 * implementation on the service's own transaction client (a genuine outbox
 * row really is inserted inside the transaction), and only then, when armed,
 * throws. withPgTransaction's catch issues ROLLBACK, and the assertions —
 * made afterwards on a SEPARATE out-of-band connection — are that Postgres
 * holds neither the event nor the mutation.
 *
 * A Postgres trigger on `case_workspace_event_outbox` would prove the same
 * thing, but that table is shared with every other suite running against this
 * database and CREATE TRIGGER takes an ACCESS EXCLUSIVE lock on it. The mock
 * is process-local and can never affect another suite; the wrapper is inert
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
  actor_user_id: string;
  correlation_id: string;
  causation_id: string | null;
  redacted_summary: Record<string, unknown>;
  payload_ref: string | null;
  delivered_at: string | null;
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
  ): Promise<{ orgId: string; projectId: string; caseId: string; actorId: string }> {
    const orgId = await seedOrg(label);
    const projectId = await seedProject(orgId, label);
    const actorId = await seedMemberedUser(orgId, `case-${label}`);
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: actorId,
    });
    return { orgId, projectId, caseId: created.caseId, actorId };
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
   * Convenience: seed a user AND an ACTIVE membership at MEMBER role in one
   * call — the CW-P12 retrofit gates createProcessDefinition/
   * createProcessVersionDraft/proposeProcessVersion/reviewProcessVersion/
   * publishProcessVersion/instantiateProcessVersion at plain requireOrgMember,
   * so every actor exercising the normal (non-authorization-focused) flows
   * below needs at least MEMBER-level standing to avoid an unrelated
   * not_org_member/case_access_denied failure.
   */
  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = await seedUser(orgId, label);
    await seedMember(orgId, userId, 'MEMBER');
    return userId;
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
      // The outbox has no FK to organizations, so nothing cascades it away.
      // Every event this suite emits is org-scoped, so deleting by
      // organization_id removes exactly this test's rows and nothing else.
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
  }

  /**
   * Outbox rows for one aggregate, read on the out-of-band `control` pool —
   * NEVER from publishEvent's return value, which only proves what the
   * service THINKS it wrote. Scoped by aggregate_id (never a global count):
   * this database is shared with other suites that write the same table.
   */
  async function readOutboxRowsForAggregate(aggregateId: string): Promise<OutboxDbRow[]> {
    const result = await control.query<OutboxDbRow>(
      `SELECT event_id, event_type, schema_version, organization_id, project_id,
              aggregate_type, aggregate_id, aggregate_version, case_id,
              actor_user_id, correlation_id, causation_id, redacted_summary,
              payload_ref, delivered_at
         FROM case_workspace_event_outbox
        WHERE aggregate_id = $1
        ORDER BY aggregate_version ASC NULLS LAST, created_at ASC`,
      [aggregateId]
    );
    return result.rows;
  }

  /** Every outbox row an organization has accumulated, oldest first. */
  async function readOutboxRowsForOrg(organizationId: string): Promise<OutboxDbRow[]> {
    const result = await control.query<OutboxDbRow>(
      `SELECT event_id, event_type, schema_version, organization_id, project_id,
              aggregate_type, aggregate_id, aggregate_version, case_id,
              actor_user_id, correlation_id, causation_id, redacted_summary,
              payload_ref, delivered_at
         FROM case_workspace_event_outbox
        WHERE organization_id = $1
        ORDER BY created_at ASC, aggregate_version ASC NULLS LAST`,
      [organizationId]
    );
    return result.rows;
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
    const userId = await seedMemberedUser(orgId, 'force-private');
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
      // createProcessDefinition now requires the creator to be an active org
      // member (CW-P12 retrofit) — seed ownerUserId as a member first so
      // creation itself succeeds, then REVOKE that membership before the
      // share-gate assertions below, so (a) still proves "having been the
      // definition's own owner/creator is not sufficient without CURRENT
      // membership" — the same point the test originally made via a
      // never-membered actor, now via a since-revoked one, since the create
      // path itself is no longer reachable without membership at all.
      await seedMember(orgId, ownerUserId, 'MEMBER');
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

      // Revoke ownerUserId's membership now that creation is done — (a)
      // below must still reject, proving ownership alone never suffices.
      await control.query(`DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`, [
        orgId,
        ownerUserId,
      ]);

      // (a) ownerUserId (the definition's own owner/creator) has NO
      // organization_members row for this org anymore (revoked above).
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
    const userId = await seedMemberedUser(orgId, 'publish-needs-review');
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
    const authorId = await seedMemberedUser(orgId, 'author');
    const reviewerId = await seedMemberedUser(orgId, 'reviewer');
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
    const { orgId, projectId, caseId, actorId: caseActorId } = await seedOrgProjectCase('instantiate-not-published');
    const userId = await seedMemberedUser(orgId, 'instantiate-not-published');
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
      await teardown({ orgIds: [orgId], projectIds: [projectId], userIds: [userId, caseActorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 7. instantiateProcessVersion — cross-tenant rejection.
  // -------------------------------------------------------------------------
  it('instantiateProcessVersion rejects with process_version_case_organization_mismatch when the target case belongs to a different organization than the Play, creating no case_plan_versions row', async () => {
    const playOrgId = await seedOrg('instantiate-cross-tenant-play');
    const playUserId = await seedMemberedUser(playOrgId, 'instantiate-cross-tenant-play');
    const {
      orgId: caseOrgId,
      projectId: caseProjectId,
      caseId,
      actorId: caseActorId,
    } = await seedOrgProjectCase('instantiate-cross-tenant-case');
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
      await teardown({ orgIds: [caseOrgId], projectIds: [caseProjectId], userIds: [caseActorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 8. instantiateProcessVersion — success creates a real case_plan_versions
  //    row, verified directly against Postgres.
  // -------------------------------------------------------------------------
  it('a successful instantiateProcessVersion (matching orgs, PUBLISHED version) creates a DRAFT case_plan_versions row whose source_process_version_id and semantic_graph match the ProcessVersion, verified by reading Postgres directly', async () => {
    const { orgId, projectId, caseId, actorId: caseActorId } = await seedOrgProjectCase('instantiate-success');
    const userId = await seedMemberedUser(orgId, 'instantiate-success');
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
      await teardown({ orgIds: [orgId], projectIds: [projectId], userIds: [userId, caseActorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 9. AUTHORIZATION (CW-P12) — createProcessDefinition/
  //    createProcessVersionDraft (create class): a plain not_org_member
  //    rejection for an actor with no membership at all.
  // -------------------------------------------------------------------------
  it('createProcessDefinition and createProcessVersionDraft both reject an actor with no organization_members row', async () => {
    const orgId = await seedOrg('auth-create-no-membership');
    const noMembershipActor = await seedUser(orgId, 'auth-create-no-membership');
    const ownerActor = await seedMemberedUser(orgId, 'auth-create-no-membership-owner');
    const createdDefinitionIds: string[] = [];
    try {
      await expect(
        playService.createProcessDefinition({
          organizationId: orgId,
          name: 'Should not be created',
          ownerActorId: noMembershipActor,
          createdByActorId: noMembershipActor,
        })
      ).rejects.toMatchObject({ code: 'not_org_member' });

      const definition = await playService.createProcessDefinition({
        organizationId: orgId,
        name: 'Owned by a real member',
        ownerActorId: ownerActor,
        createdByActorId: ownerActor,
      });
      createdDefinitionIds.push(definition.processDefinitionId);

      await expect(
        playService.createProcessVersionDraft({
          processDefinitionId: definition.processDefinitionId,
          semanticGraph: validGraph('auth-create-no-membership'),
          createdByActorId: noMembershipActor,
        })
      ).rejects.toMatchObject({ code: 'not_org_member' });

      const versions = await playService.listProcessVersionsForDefinition(
        definition.processDefinitionId,
        ownerActor
      );
      expect(versions).toHaveLength(0);
    } finally {
      await teardown({
        orgIds: [orgId],
        userIds: [noMembershipActor, ownerActor],
        processDefinitionIds: createdDefinitionIds,
      });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // EVENT OUTBOX (EVENT_TAXONOMY §6.6) — every mutating command publishes
  // exactly one event, inside its own transaction, and publishes nothing when
  // that transaction rolls back.
  //
  // Both `process_definitions` and `process_versions` HAVE a version column,
  // so every event must carry the POST-mutation version (§3). Asserting the
  // exact 1..7 ladder across one process_version is what proves the events
  // were taken from each command's own RETURNING row and not from a re-read
  // or from the pre-image.
  //
  // The three `process.definition.submitted|published|deprecated` types on a
  // PROCESS_VERSION aggregate are the documented §5.4 naming asymmetry: §7's
  // literal text wins for now, so the test asserts it literally rather than
  // "fixing" it at a call site.
  // -------------------------------------------------------------------------

  it('the full Play lifecycle publishes exactly one outbox row per command, with the taxonomy event_type ladder and the post-mutation version on each', async () => {
    const orgId = await seedOrg('outbox-lifecycle');
    const adminActor = await seedUser(orgId, 'outbox-lifecycle-admin');
    await seedMember(orgId, adminActor, 'ADMIN');
    const createdDefinitionIds: string[] = [];
    try {
      const definition = await playService.createProcessDefinition({
        organizationId: orgId,
        name: 'Outbox lifecycle Play',
        ownerActorId: adminActor,
        createdByActorId: adminActor,
      });
      createdDefinitionIds.push(definition.processDefinitionId);

      const afterCreate = await readOutboxRowsForAggregate(definition.processDefinitionId);
      expect(afterCreate).toHaveLength(1);
      const createdEvent = afterCreate[0];
      expect(createdEvent.event_type).toBe('process.definition.created');
      expect(createdEvent.aggregate_type).toBe('PROCESS_DEFINITION');
      expect(createdEvent.aggregate_id).toBe(definition.processDefinitionId);
      expect(createdEvent.aggregate_version).toBe(1);
      expect(createdEvent.organization_id).toBe(orgId);
      // A Play is org-scoped and reusable: it belongs to no project and no Case.
      expect(createdEvent.project_id).toBeNull();
      expect(createdEvent.case_id).toBeNull();
      expect(createdEvent.actor_user_id).toBe(adminActor);
      expect(String(createdEvent.correlation_id ?? '').length).toBeGreaterThan(0);
      expect(createdEvent.causation_id).toBeNull();
      expect(createdEvent.schema_version).toBe(1);
      expect(createdEvent.delivered_at).toBeNull();
      // visibility is forced server-side; the event reports what was STORED.
      expect(createdEvent.redacted_summary.visibility).toBe('PRIVATE');
      expect(createdEvent.payload_ref).toBe(`process_definitions:${definition.processDefinitionId}`);

      const draft = await playService.createProcessVersionDraft({
        processDefinitionId: definition.processDefinitionId,
        semanticGraph: validGraph('outbox-lifecycle-v1'),
        createdByActorId: adminActor,
      });
      const versionId = draft.processVersionId;

      const afterDraft = await readOutboxRowsForAggregate(versionId);
      expect(afterDraft).toHaveLength(1);
      expect(afterDraft[0].event_type).toBe('process.version.draft_created');
      expect(afterDraft[0].aggregate_type).toBe('PROCESS_VERSION');
      expect(afterDraft[0].aggregate_version).toBe(1);
      expect(afterDraft[0].organization_id).toBe(orgId);
      expect(afterDraft[0].actor_user_id).toBe(adminActor);
      // `version` is the OCC lock counter; `version_number` is the semantic
      // version and belongs in the summary (EVENT_TAXONOMY §3).
      expect(afterDraft[0].redacted_summary.versionNumber).toBe(draft.versionNumber);
      expect(afterDraft[0].redacted_summary.graphDigest).toBe(draft.graphDigest);

      const updated = await playService.updateProcessVersionDraft(
        versionId,
        { semanticGraph: validGraph('outbox-lifecycle-v1-edited'), expectedVersion: draft.version },
        { actorUserId: adminActor }
      );
      const proposed = await playService.proposeProcessVersion(
        versionId,
        { actorUserId: adminActor },
        updated.version
      );
      const reviewed = await playService.reviewProcessVersion(
        versionId,
        { actorUserId: adminActor },
        'APPROVED',
        undefined,
        proposed.version
      );
      const published = await playService.publishProcessVersion(
        versionId,
        { actorUserId: adminActor },
        reviewed.version
      );

      // Sharing widens the DEFINITION, and only once a PUBLISHED version
      // exists — so it runs here, and lands on the definition aggregate.
      const shared = await playService.shareProcessDefinition(
        definition.processDefinitionId,
        'ORGANIZATION',
        { actorUserId: adminActor },
        definition.version
      );
      expect(shared.version).toBe(2);

      const deprecated = await playService.deprecateProcessVersion(
        versionId,
        { actorUserId: adminActor },
        'superseded by the next Play revision',
        published.version
      );
      const archived = await playService.archiveProcessVersion(
        versionId,
        { actorUserId: adminActor },
        deprecated.version
      );
      expect(archived.status).toBe('ARCHIVED');

      // The version aggregate's complete, ordered event ladder.
      const versionEvents = await readOutboxRowsForAggregate(versionId);
      expect(versionEvents.map((row) => row.event_type)).toEqual([
        'process.version.draft_created',
        'process.version.draft_updated',
        'process.definition.submitted',
        'process.version.reviewed',
        'process.definition.published',
        'process.definition.deprecated',
        'process.version.archived',
      ]);
      // One row per command — never two, never zero.
      expect(versionEvents).toHaveLength(7);
      // Post-mutation OCC version on every single one.
      expect(versionEvents.map((row) => row.aggregate_version)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      // Distinct ids: seven facts, not one fact repeated.
      expect(new Set(versionEvents.map((row) => row.event_id)).size).toBe(7);
      for (const row of versionEvents) {
        expect(row.aggregate_type).toBe('PROCESS_VERSION');
        expect(row.aggregate_id).toBe(versionId);
        expect(row.organization_id).toBe(orgId);
        expect(row.actor_user_id).toBe(adminActor);
        expect(String(row.correlation_id ?? '').length).toBeGreaterThan(0);
        expect(row.payload_ref).toBe(`process_versions:${versionId}`);
      }
      expect(versionEvents[3].redacted_summary.decision).toBe('APPROVED');
      expect(versionEvents[5].redacted_summary.reason).toBe('superseded by the next Play revision');

      // The definition aggregate's own ladder, unaffected by the version's.
      const definitionEvents = await readOutboxRowsForAggregate(definition.processDefinitionId);
      expect(definitionEvents.map((row) => row.event_type)).toEqual([
        'process.definition.created',
        'process.definition.shared',
      ]);
      expect(definitionEvents.map((row) => row.aggregate_version)).toEqual([1, 2]);
      expect(definitionEvents[1].redacted_summary.from).toBe('PRIVATE');
      expect(definitionEvents[1].redacted_summary.to).toBe('ORGANIZATION');

      // Nine commands, nine events for this org — nothing extra leaked in.
      expect(await readOutboxRowsForOrg(orgId)).toHaveLength(9);
    } finally {
      await teardown({
        orgIds: [orgId],
        userIds: [adminActor],
        processDefinitionIds: createdDefinitionIds,
      });
    }
  }, 60_000);

  it('reviewProcessVersion with CHANGES_REQUESTED publishes exactly one process.version.reviewed row carrying the decision as a fact, not as a second event_type', async () => {
    const orgId = await seedOrg('outbox-changes');
    const actorId = await seedMemberedUser(orgId, 'outbox-changes');
    const createdDefinitionIds: string[] = [];
    try {
      const definition = await playService.createProcessDefinition({
        organizationId: orgId,
        name: 'Outbox changes-requested Play',
        ownerActorId: actorId,
        createdByActorId: actorId,
      });
      createdDefinitionIds.push(definition.processDefinitionId);

      const draft = await playService.createProcessVersionDraft({
        processDefinitionId: definition.processDefinitionId,
        semanticGraph: validGraph('outbox-changes-v1'),
        createdByActorId: actorId,
      });
      const proposed = await playService.proposeProcessVersion(
        draft.processVersionId,
        { actorUserId: actorId },
        draft.version
      );
      const changed = await playService.reviewProcessVersion(
        draft.processVersionId,
        { actorUserId: actorId },
        'CHANGES_REQUESTED',
        'graph is missing an approval node',
        proposed.version
      );
      expect(changed.status).toBe('DRAFT');

      const events = await readOutboxRowsForAggregate(draft.processVersionId);
      expect(events.map((row) => row.event_type)).toEqual([
        'process.version.draft_created',
        'process.definition.submitted',
        // Same literal event_type as the APPROVED branch: the decision is a
        // fact in the summary, not a second name (only recordApprovalDecision
        // and transitionStatus are per-decision/per-state in the taxonomy).
        'process.version.reviewed',
      ]);
      const reviewedEvent = events[2];
      expect(reviewedEvent.aggregate_version).toBe(3);
      expect(reviewedEvent.organization_id).toBe(orgId);
      expect(reviewedEvent.actor_user_id).toBe(actorId);
      expect(String(reviewedEvent.correlation_id ?? '').length).toBeGreaterThan(0);
      expect(reviewedEvent.redacted_summary.decision).toBe('CHANGES_REQUESTED');
      expect(reviewedEvent.redacted_summary.from).toBe('IN_REVIEW');
      expect(reviewedEvent.redacted_summary.to).toBe('DRAFT');
      // The reset of a prior approval is the fact that stops a stale approval
      // authorizing a later publish.
      expect(reviewedEvent.redacted_summary.reviewDecisionCleared).toBe(true);
    } finally {
      await teardown({
        orgIds: [orgId],
        userIds: [actorId],
        processDefinitionIds: createdDefinitionIds,
      });
    }
  }, 30_000);

  it('a failure raised AFTER the event is published rolls both back: createProcessDefinition leaves neither a definition row nor an outbox row', async () => {
    const orgId = await seedOrg('outbox-rollback');
    const actorId = await seedMemberedUser(orgId, 'outbox-rollback');
    const createdDefinitionIds: string[] = [];
    try {
      outboxBoom.armed = true;
      try {
        await expect(
          playService.createProcessDefinition({
            organizationId: orgId,
            name: 'Doomed Play',
            ownerActorId: actorId,
            createdByActorId: actorId,
          })
        ).rejects.toThrow(/cw_test_forced_failure_after_publish/);
      } finally {
        outboxBoom.armed = false;
      }

      // No event...
      expect(await readOutboxRowsForOrg(orgId)).toHaveLength(0);
      // ...and no aggregate row either. This is what "atomic", rather than
      // "logged after the fact", means.
      const definitionRows = await control.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM process_definitions WHERE organization_id = $1`,
        [orgId]
      );
      expect(definitionRows.rows[0].n).toBe(0);

      // Negative control: disarmed, the same call succeeds and DOES leave
      // exactly one event. Without this, a wiring that never publishes
      // anything would pass the assertions above.
      const definition = await playService.createProcessDefinition({
        organizationId: orgId,
        name: 'Retried Play',
        ownerActorId: actorId,
        createdByActorId: actorId,
      });
      createdDefinitionIds.push(definition.processDefinitionId);

      const events = await readOutboxRowsForOrg(orgId);
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('process.definition.created');
      expect(events[0].aggregate_id).toBe(definition.processDefinitionId);
      expect(events[0].aggregate_version).toBe(1);
      expect(events[0].actor_user_id).toBe(actorId);
    } finally {
      await teardown({
        orgIds: [orgId],
        userIds: [actorId],
        processDefinitionIds: createdDefinitionIds,
      });
    }
  }, 30_000);
});
