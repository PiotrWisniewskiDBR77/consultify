/**
 * Case Workspace — Case Core service, proved against a REAL PostgreSQL
 * (CW-P01, EPIC E1). Exercises server/src/services/caseWorkspace/caseCoreService.ts
 * against the schema in server/migrations/20260809_case_workspace_case_core.sql.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * `NODE_ENV=test` ALONE is a trap: `Database.ts`'s `getDatabase()` /
 * `createDatabase()` hand back an in-memory MOCK whenever
 * `RUN_DB_TESTS !== '1'` (or `MOCK_DB` isn't explicitly `'false'`), and every
 * write silently becomes a no-op — the suite would pass while touching
 * nothing. This file follows this repo's `*.pg.test.ts` convention (see
 * server/src/services/demo/__tests__/atelierFinancePinnedTransaction.pg.test.ts):
 * gate on `RUN_DB_TESTS === '1' && MOCK_DB === 'false'`, probe reachability
 * AND that the migrated schema is actually present before deciding, and SKIP
 * LOUDLY (never silently pass) when either is missing.
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/caseCoreService.pg.test.ts
 *
 * ===========================================================================
 * ISOLATION — every test owns its own organization_id/project_id
 * ===========================================================================
 * Per the load-bearing rule in atelierFinancePinnedTransaction.pg.test.ts's own
 * header ("EVERY TEST OWNS AN ORGANIZATION ... no test can observe, reset or
 * delete another test's rows, so nothing a hook does can race a seed that is
 * still running"): each `it()` below seeds its own minimal
 * organizations/projects fixture row(s) INSIDE the test body — never a shared
 * `beforeEach` — and tears them down itself in a `finally`.
 * `case_core.project_id` is UNIQUE (OD-01), so a fixture shared across tests
 * would make test 1 (which deliberately tries to violate that uniqueness)
 * poison every test that runs after it. Fixture ids are namespaced with
 * `randomUUID()` so this file is also safe to run concurrently with itself.
 *
 * All assertions read the actual `case_core` row back out of Postgres through
 * a dedicated, out-of-band `pg.Pool` (`control`) — never the service
 * function's return value alone — because the return value only proves what
 * the service THINKS it wrote, not what actually landed.
 *
 * ===========================================================================
 * AUTHORIZATION (CW-P12 retrofit) — every actor is a real, membered user
 * ===========================================================================
 * caseCoreService.ts now gates every method through
 * caseWorkspaceAuthContext.ts's requireOrgMember/requireCaseAccess. Every
 * actor id used below is therefore a real `users` row with a matching
 * ACTIVE `organization_members` row for the org under test — seeded here via
 * direct INSERTs on the out-of-band pool (seedUser/seedMember), a
 * test-fixture-only direct insert, not a production code path. No
 * caseCoreService function itself writes to users/organization_members.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';

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
        WHERE table_schema = 'public' AND table_name = 'case_core'
          AND column_name IN ('project_id', 'governance_tier_history', 'version', 'closure_type')`
    );
    const caseCoreOk = Number(result.rows[0]?.present ?? 0) === 4;

    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    const orgMembersOk = Number(orgMembersResult.rows[0]?.present ?? 0) === 4;

    // Every mutating caseCoreService command now publishes to the outbox
    // inside its own transaction (EVENT_TAXONOMY.md §2), so this table is no
    // longer optional for this suite: without it every mutation would fail on
    // a missing relation and the failures would read as service defects. Gate
    // on it and skip loudly instead.
    const outboxResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_event_outbox'
          AND column_name IN ('event_id', 'event_type', 'organization_id', 'aggregate_type',
                               'aggregate_id', 'aggregate_version', 'actor_user_id',
                               'correlation_id', 'redacted_summary')`
    );
    const outboxOk = Number(outboxResult.rows[0]?.present ?? 0) === 9;

    return caseCoreOk && orgMembersOk && outboxOk;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[caseCoreService pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260809_case_workspace_case_core.sql + 20260810_case_workspace_event_outbox.sql migrations ` +
      `applied. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface CaseCoreDbRow {
  case_id: string;
  project_id: string;
  organization_id: string;
  case_status: string;
  governance_tier: string;
  governance_tier_history: string;
  closure_type: string | null;
  closed_at: string | null;
  delivery_status: string;
  decision_status: string;
  implementation_status: string;
  outcome_status: string;
  version: number;
}

/** One `case_workspace_event_outbox` row, as stored. */
interface OutboxDbRow {
  event_id: string;
  event_type: string;
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

suite('caseCoreService — Case Core against a real PostgreSQL (CW-P01, E1)', () => {
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

  /** A fresh organization + one project inside it, both uniquely named. */
  async function seedOrgAndProject(label: string): Promise<{ orgId: string; projectId: string }> {
    const suffix = randomUUID();
    const orgId = `case-core-org-${label}-${suffix}`;
    const projectId = `case-core-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `Case Core test org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Case Core test project (${label})`]
    );
    return { orgId, projectId };
  }

  /** A second project inside an org a test already owns (case_core.project_id is UNIQUE, so one org can back at most one case per project). */
  async function seedProjectInOrg(orgId: string, label: string): Promise<string> {
    const projectId = `case-core-project-${label}-${randomUUID()}`;
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Case Core test project (${label})`]
    );
    return projectId;
  }

  /** A fresh users row, unattached to organization_members unless seedMember() is also called for it. */
  async function seedUser(orgId: string, label: string): Promise<string> {
    const userId = `case-core-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    return userId;
  }

  /** An organization_members row for an existing user, at the given role/status — a test-fixture-only direct insert. */
  async function seedMember(
    orgId: string,
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT',
    status: 'ACTIVE' | 'REVOKED' | 'SUSPENDED' = 'ACTIVE'
  ): Promise<void> {
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, $4, $5)`,
      [`case-core-member-${randomUUID()}`, orgId, userId, role, status]
    );
  }

  /** Convenience: seed a user AND an ACTIVE membership at MEMBER role in one call. */
  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = await seedUser(orgId, label);
    await seedMember(orgId, userId, 'MEMBER');
    return userId;
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
      // The outbox has ZERO foreign keys by design (see the migration header:
      // an audit record must survive the deletion of the thing it describes),
      // so nothing cascades it away — each test deletes its own org's events
      // explicitly, before the org row itself.
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
  }

  /**
   * Every outbox row for one Case, read OUT OF BAND through the control pool
   * and ordered by the aggregate version the event carries.
   *
   * Reading through a separate connection is the whole point: the service's
   * return value only proves what it believes it published, and a row read
   * inside the service's own transaction would be visible even if that
   * transaction later rolled back. Only a committed row seen from another
   * connection proves the event actually landed.
   */
  async function readOutboxRowsForCase(caseId: string): Promise<OutboxDbRow[]> {
    const result = await control.query<OutboxDbRow>(
      `SELECT * FROM case_workspace_event_outbox
        WHERE aggregate_id = $1
        ORDER BY aggregate_version ASC NULLS LAST, created_at ASC`,
      [caseId]
    );
    return result.rows;
  }

  /** Every outbox row belonging to one test's own organization. */
  async function readOutboxRowsForOrg(orgId: string): Promise<OutboxDbRow[]> {
    const result = await control.query<OutboxDbRow>(
      `SELECT * FROM case_workspace_event_outbox
        WHERE organization_id = $1
        ORDER BY aggregate_version ASC NULLS LAST, created_at ASC`,
      [orgId]
    );
    return result.rows;
  }

  async function readCaseCoreRow(caseId: string): Promise<CaseCoreDbRow | null> {
    const result = await control.query<CaseCoreDbRow>(
      `SELECT * FROM case_core WHERE case_id = $1`,
      [caseId]
    );
    return result.rows[0] ?? null;
  }

  async function readCaseCoreRowsForProject(projectId: string): Promise<CaseCoreDbRow[]> {
    const result = await control.query<CaseCoreDbRow>(
      `SELECT * FROM case_core WHERE project_id = $1`,
      [projectId]
    );
    return result.rows;
  }

  // -------------------------------------------------------------------------
  // 1. createCase — OD-01 uniqueness (exactly one case_core row per project).
  // -------------------------------------------------------------------------
  it('createCase inserts exactly one case_core row for a project; a second createCase for the SAME project_id is rejected (OD-01)', async () => {
    const { orgId, projectId } = await seedOrgAndProject('od01');
    const actorId = await seedMemberedUser(orgId, 'od01');
    try {
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: actorId,
      });
      expect(created.projectId).toBe(projectId);
      expect(created.organizationId).toBe(orgId);
      expect(created.caseStatus).toBe('DRAFT');

      const rowsAfterFirst = await readCaseCoreRowsForProject(projectId);
      expect(rowsAfterFirst).toHaveLength(1);
      expect(rowsAfterFirst[0].case_id).toBe(created.caseId);

      await expect(
        caseCoreService.createCase({
          projectId,
          organizationId: orgId,
          contractedClosureType: 'DELIVERY_COMPLETED',
          createdByActorId: actorId,
        })
      ).rejects.toThrow(/case_already_exists_for_project/);

      // The rejected second attempt must not have landed a second row.
      const rowsAfterSecond = await readCaseCoreRowsForProject(projectId);
      expect(rowsAfterSecond).toHaveLength(1);
      expect(rowsAfterSecond[0].case_id).toBe(created.caseId);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 2. transitionStatus — CW-RT-026 state machine.
  // -------------------------------------------------------------------------
  it('transitionStatus allows DRAFT->ACTIVE and rejects DRAFT->CLOSED without a recorded closure, leaving case_status unchanged in the DB', async () => {
    const { orgId, projectId: projectIdActive } = await seedOrgAndProject('rt026-active');
    const projectIdIllegal = await seedProjectInOrg(orgId, 'rt026-illegal');
    const actorId = await seedMemberedUser(orgId, 'rt026');
    try {
      // -- Legal edge: DRAFT -> ACTIVE.
      const activeCase = await caseCoreService.createCase({
        projectId: projectIdActive,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: actorId,
      });
      const activated = await caseCoreService.transitionStatus(activeCase.caseId, 'ACTIVE', {
        actorUserId: actorId,
      });
      expect(activated.caseStatus).toBe('ACTIVE');
      const afterActivate = await readCaseCoreRow(activeCase.caseId);
      expect(afterActivate?.case_status).toBe('ACTIVE');

      // -- Illegal edge: DRAFT -> CLOSED with no closure recorded yet.
      const illegalCase = await caseCoreService.createCase({
        projectId: projectIdIllegal,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: actorId,
      });
      const beforeIllegal = await readCaseCoreRow(illegalCase.caseId);
      expect(beforeIllegal?.case_status).toBe('DRAFT');

      await expect(
        caseCoreService.transitionStatus(illegalCase.caseId, 'CLOSED', {
          actorUserId: actorId,
        })
      ).rejects.toThrow(/case_closure_not_recorded/);

      const afterIllegal = await readCaseCoreRow(illegalCase.caseId);
      expect(afterIllegal?.case_status).toBe('DRAFT');
      expect(afterIllegal?.version).toBe(beforeIllegal?.version);
    } finally {
      await teardown([orgId], [projectIdActive, projectIdIllegal], [actorId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 3. updateGovernanceTier — append-only history (canon invariant #13).
  // -------------------------------------------------------------------------
  it('updateGovernanceTier appends to governance_tier_history rather than overwriting it; two calls leave both entries, in order', async () => {
    const { orgId, projectId } = await seedOrgAndProject('govhist');
    const actorId = await seedMemberedUser(orgId, 'govhist');
    try {
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: actorId,
      });

      const initialRow = await readCaseCoreRow(created.caseId);
      const initialHistory = JSON.parse(initialRow?.governance_tier_history ?? '[]');
      expect(initialHistory).toHaveLength(1);
      expect(initialHistory[0].tier).toBe('LIGHTWEIGHT');

      await caseCoreService.updateGovernanceTier(
        created.caseId,
        'STANDARD',
        { actorUserId: actorId },
        'first escalation'
      );
      const afterFirst = await readCaseCoreRow(created.caseId);
      const historyAfterFirst = JSON.parse(afterFirst?.governance_tier_history ?? '[]');
      expect(historyAfterFirst).toHaveLength(2);
      expect(afterFirst?.governance_tier).toBe('STANDARD');

      await caseCoreService.updateGovernanceTier(
        created.caseId,
        'CONTROLLED',
        { actorUserId: actorId },
        'second escalation'
      );
      const afterSecond = await readCaseCoreRow(created.caseId);
      const historyAfterSecond = JSON.parse(afterSecond?.governance_tier_history ?? '[]');
      expect(historyAfterSecond).toHaveLength(3);
      expect(afterSecond?.governance_tier).toBe('CONTROLLED');

      // Both appended entries survive, IN ORDER, and the original entry was
      // never rewritten.
      expect(historyAfterSecond[0]).toMatchObject({ tier: 'LIGHTWEIGHT', reason: 'case_created' });
      expect(historyAfterSecond[1]).toMatchObject({ tier: 'STANDARD', reason: 'first escalation' });
      expect(historyAfterSecond[2]).toMatchObject({ tier: 'CONTROLLED', reason: 'second escalation' });
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 4. recordClosure — CW-RT-027, exactly once.
  // -------------------------------------------------------------------------
  it('recordClosure sets closure_type once; a second recordClosure call is rejected and the original closure_type/closed_at are unchanged', async () => {
    const { orgId, projectId } = await seedOrgAndProject('rt027');
    const actorId = await seedMemberedUser(orgId, 'rt027');
    try {
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'IMPLEMENTATION_COMPLETED',
        createdByActorId: actorId,
      });

      // recordClosure cross-checks the closure type against its backing axis
      // (CW-RT-027) — IMPLEMENTATION_COMPLETED requires implementation_status
      // = 'COMPLETED' first.
      await caseCoreService.updateClosureAxisStatus(created.caseId, 'implementation', 'COMPLETED', {
        actorUserId: actorId,
      });

      await caseCoreService.recordClosure(created.caseId, 'IMPLEMENTATION_COMPLETED', {
        actorUserId: actorId,
      });

      const afterFirst = await readCaseCoreRow(created.caseId);
      expect(afterFirst?.closure_type).toBe('IMPLEMENTATION_COMPLETED');
      expect(afterFirst?.closed_at).toBeTruthy();

      await expect(
        caseCoreService.recordClosure(created.caseId, 'IMPLEMENTATION_COMPLETED', {
          actorUserId: actorId,
        })
      ).rejects.toThrow(/case_closure_already_recorded/);

      const afterSecond = await readCaseCoreRow(created.caseId);
      expect(afterSecond?.closure_type).toBe(afterFirst?.closure_type);
      expect(afterSecond?.closed_at).toBe(afterFirst?.closed_at);
      expect(afterSecond?.version).toBe(afterFirst?.version);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 5. version increments by exactly 1 per mutating call — CW-RT-044.
  // -------------------------------------------------------------------------
  it('two sequential mutating calls on the same case increment version by exactly 1 each time (CW-RT-044)', async () => {
    const { orgId, projectId } = await seedOrgAndProject('rt044');
    const actorId = await seedMemberedUser(orgId, 'rt044');
    try {
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: actorId,
      });
      const afterCreate = await readCaseCoreRow(created.caseId);
      expect(afterCreate?.version).toBe(1);

      await caseCoreService.updateAutonomyPolicy(created.caseId, 'EXECUTE_APPROVED_PLAN', {
        actorUserId: actorId,
      });
      const afterFirstMutation = await readCaseCoreRow(created.caseId);
      expect(afterFirstMutation?.version).toBe((afterCreate?.version ?? 0) + 1);

      await caseCoreService.updateGovernanceTier(
        created.caseId,
        'STANDARD',
        { actorUserId: actorId },
        'version check'
      );
      const afterSecondMutation = await readCaseCoreRow(created.caseId);
      expect(afterSecondMutation?.version).toBe((afterFirstMutation?.version ?? 0) + 1);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 6. listCasesForOrganization — tenant isolation.
  // -------------------------------------------------------------------------
  it('listCasesForOrganization only returns cases for the queried organization_id, not another org', async () => {
    const fixtureA = await seedOrgAndProject('tenant-a');
    const fixtureB = await seedOrgAndProject('tenant-b');
    const actorA = await seedMemberedUser(fixtureA.orgId, 'tenant-a');
    const actorB = await seedMemberedUser(fixtureB.orgId, 'tenant-b');
    try {
      const caseA = await caseCoreService.createCase({
        projectId: fixtureA.projectId,
        organizationId: fixtureA.orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: actorA,
      });
      const caseB = await caseCoreService.createCase({
        projectId: fixtureB.projectId,
        organizationId: fixtureB.orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: actorB,
      });

      const listForA = await caseCoreService.listCasesForOrganization(fixtureA.orgId, undefined, actorA);
      expect(listForA.map((c) => c.caseId)).toContain(caseA.caseId);
      expect(listForA.map((c) => c.caseId)).not.toContain(caseB.caseId);
      expect(listForA.every((c) => c.organizationId === fixtureA.orgId)).toBe(true);

      const listForB = await caseCoreService.listCasesForOrganization(fixtureB.orgId, undefined, actorB);
      expect(listForB.map((c) => c.caseId)).toContain(caseB.caseId);
      expect(listForB.map((c) => c.caseId)).not.toContain(caseA.caseId);
      expect(listForB.every((c) => c.organizationId === fixtureB.orgId)).toBe(true);
    } finally {
      await teardown(
        [fixtureA.orgId, fixtureB.orgId],
        [fixtureA.projectId, fixtureB.projectId],
        [actorA, actorB]
      );
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 7. AUTHORIZATION (CW-P12) — createCase (create class).
  // -------------------------------------------------------------------------
  it('createCase rejects an actor with no organization_members row, and an actor with a REVOKED membership row, creating no case_core row for either attempt', async () => {
    const { orgId, projectId } = await seedOrgAndProject('auth-create');
    const noMembershipActor = await seedUser(orgId, 'no-membership');
    const revokedActor = await seedUser(orgId, 'revoked');
    await seedMember(orgId, revokedActor, 'MEMBER', 'REVOKED');
    try {
      await expect(
        caseCoreService.createCase({
          projectId,
          organizationId: orgId,
          contractedClosureType: 'DELIVERY_COMPLETED',
          createdByActorId: noMembershipActor,
        })
      ).rejects.toMatchObject({ code: 'not_org_member' });

      await expect(
        caseCoreService.createCase({
          projectId,
          organizationId: orgId,
          contractedClosureType: 'DELIVERY_COMPLETED',
          createdByActorId: revokedActor,
        })
      ).rejects.toMatchObject({ code: 'not_org_member' });

      const rows = await readCaseCoreRowsForProject(projectId);
      expect(rows).toHaveLength(0);
    } finally {
      await teardown([orgId], [projectId], [noMembershipActor, revokedActor]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 8. AUTHORIZATION (CW-P12) — transitionStatus (update class), wrong-org
  //    membership collapses into the SAME case_access_denied as a missing
  //    membership (enumeration-safety, SEC-009).
  // -------------------------------------------------------------------------
  it('transitionStatus rejects an actor who is a member of a DIFFERENT organization with case_access_denied, leaving case_status unchanged', async () => {
    const { orgId, projectId } = await seedOrgAndProject('auth-wrong-org');
    const ownerActor = await seedMemberedUser(orgId, 'owner');
    const otherOrgId = `case-core-org-other-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      otherOrgId,
      'Other org (wrong-org test)',
    ]);
    const outsiderActor = await seedMemberedUser(otherOrgId, 'outsider');
    try {
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: ownerActor,
      });

      await expect(
        caseCoreService.transitionStatus(created.caseId, 'ACTIVE', { actorUserId: outsiderActor })
      ).rejects.toMatchObject({ code: 'case_access_denied' });

      const row = await readCaseCoreRow(created.caseId);
      expect(row?.case_status).toBe('DRAFT');
    } finally {
      await teardown([orgId, otherOrgId], [projectId], [ownerActor, outsiderActor]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 9. AUTHORIZATION (CW-P12) — listCasesForOrganization (read/list class).
  // -------------------------------------------------------------------------
  it('listCasesForOrganization rejects an actor with no organization_members row for the queried org', async () => {
    const { orgId } = await seedOrgAndProject('auth-list');
    const noMembershipActor = await seedUser(orgId, 'auth-list-no-membership');
    try {
      await expect(
        caseCoreService.listCasesForOrganization(orgId, undefined, noMembershipActor)
      ).rejects.toMatchObject({ code: 'not_org_member' });
    } finally {
      await teardown([orgId], [], [noMembershipActor]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 10. AUTHORIZATION (CW-P12) — getCase (read class), caseId branch collapses
  //     "not found" and "not authorized" into the same case_access_denied.
  // -------------------------------------------------------------------------
  it('getCase(caseId) throws the identical case_access_denied error for a nonexistent caseId and for a real caseId the actor cannot access', async () => {
    const { orgId, projectId } = await seedOrgAndProject('auth-getcase');
    const ownerActor = await seedMemberedUser(orgId, 'auth-getcase-owner');
    const noMembershipActor = await seedUser(orgId, 'auth-getcase-outsider');
    try {
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: ownerActor,
      });

      let nonexistentError: Error | null = null;
      try {
        await caseCoreService.getCase({ caseId: `case-${randomUUID()}` }, noMembershipActor);
      } catch (err) {
        nonexistentError = err as Error;
      }

      let deniedError: Error | null = null;
      try {
        await caseCoreService.getCase({ caseId: created.caseId }, noMembershipActor);
      } catch (err) {
        deniedError = err as Error;
      }

      expect(nonexistentError).not.toBeNull();
      expect(deniedError).not.toBeNull();
      expect(nonexistentError?.message).toBe(deniedError?.message);
      expect((nonexistentError as { code?: string } | null)?.code).toBe('case_access_denied');

      // A properly-membered actor succeeds.
      const found = await caseCoreService.getCase({ caseId: created.caseId }, ownerActor);
      expect(found?.caseId).toBe(created.caseId);
    } finally {
      await teardown([orgId], [projectId], [ownerActor, noMembershipActor]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 11. EVENT OUTBOX (EVENT_TAXONOMY.md §2) — one committed event per mutating
  //     command, with the event_type the taxonomy names and a fully populated
  //     identity. Walks a whole Case lifecycle so the assertion is about the
  //     SEQUENCE, not one lucky call: six commands, six events, no extras.
  // -------------------------------------------------------------------------
  it('every mutating caseCore command publishes exactly one outbox row with its taxonomy event_type, populated identity and post-mutation aggregate_version', async () => {
    const { orgId, projectId } = await seedOrgAndProject('outbox-lifecycle');
    const actorId = await seedMemberedUser(orgId, 'outbox-lifecycle');
    try {
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: actorId,
      });
      await caseCoreService.transitionStatus(created.caseId, 'ACTIVE', { actorUserId: actorId });
      await caseCoreService.updateGovernanceTier(
        created.caseId,
        'STANDARD',
        { actorUserId: actorId },
        'escalated for outbox coverage'
      );
      await caseCoreService.updateAutonomyPolicy(created.caseId, 'EXECUTE_APPROVED_PLAN', {
        actorUserId: actorId,
      });
      await caseCoreService.updateClosureAxisStatus(created.caseId, 'delivery', 'COMPLETED', {
        actorUserId: actorId,
      });
      await caseCoreService.recordClosure(
        created.caseId,
        'DELIVERY_COMPLETED',
        { actorUserId: actorId },
        'artifact://closure-evidence/outbox-lifecycle'
      );
      await caseCoreService.transitionStatus(created.caseId, 'CLOSED', { actorUserId: actorId });

      const events = await readOutboxRowsForCase(created.caseId);

      // Exactly seven commands ran; exactly seven events exist. No command
      // emitted twice and none emitted nothing.
      expect(events.map((e) => e.event_type)).toEqual([
        'case.created',
        'case.activated',
        'case.governance_tier_changed',
        'case.autonomy_policy_changed',
        'case.closure_axis_updated',
        'case.closure_recorded',
        'case.closed',
      ]);

      // Identity is complete on EVERY row (§1/§6.2): the outbox is useless for
      // a tenant-scoped projection or an operator trace if any of these is
      // null, and correlation_id is NOT NULL in the schema precisely because a
      // hole there breaks the trace.
      for (const event of events) {
        expect(event.organization_id).toBe(orgId);
        expect(event.project_id).toBe(projectId);
        expect(event.aggregate_type).toBe('CASE');
        expect(event.aggregate_id).toBe(created.caseId);
        expect(event.case_id).toBe(created.caseId);
        expect(event.actor_user_id).toBe(actorId);
        expect(event.correlation_id).toBeTruthy();
        expect(event.causation_id).toBeNull();
        // Published, not yet dispatched: publishing must never pre-mark a row
        // delivered, or the dispatcher would skip it forever.
        expect(event.delivered_at).toBeNull();
      }

      // aggregate_version is the POST-mutation version, taken from the write's
      // own RETURNING row — so the seven events carry 1..7 and the final one
      // matches what case_core actually holds now.
      expect(events.map((e) => Number(e.aggregate_version))).toEqual([1, 2, 3, 4, 5, 6, 7]);
      const finalRow = await readCaseCoreRow(created.caseId);
      expect(Number(events[events.length - 1].aggregate_version)).toBe(Number(finalRow?.version));

      // Summaries carry FACTS about the transition, not commands and not the
      // whole aggregate.
      const byType = new Map(events.map((e) => [e.event_type, e]));
      expect(byType.get('case.created')?.redacted_summary).toMatchObject({
        contractedClosureType: 'DELIVERY_COMPLETED',
        governanceTier: 'LIGHTWEIGHT',
        caseStatus: 'DRAFT',
      });
      expect(byType.get('case.activated')?.redacted_summary).toMatchObject({
        from: 'DRAFT',
        to: 'ACTIVE',
      });
      expect(byType.get('case.governance_tier_changed')?.redacted_summary).toMatchObject({
        from: 'LIGHTWEIGHT',
        to: 'STANDARD',
        rationale: 'escalated for outbox coverage',
      });
      expect(byType.get('case.autonomy_policy_changed')?.redacted_summary).toMatchObject({
        from: 'ASK_MATERIAL_ACTIONS',
        to: 'EXECUTE_APPROVED_PLAN',
      });
      // `from` is the axis's real prior value read off the locked row — the
      // schema default is NOT_APPLICABLE, not PENDING, and the event reports
      // what was actually there rather than what a caller assumed.
      expect(byType.get('case.closure_axis_updated')?.redacted_summary).toMatchObject({
        axis: 'delivery',
        from: 'NOT_APPLICABLE',
        to: 'COMPLETED',
      });

      // §5.2: recordClosure is `case.closure_recorded`, NOT a second
      // `case.closed` — otherwise "how many Cases closed" double-counts and
      // the closed-projection fires while the Case is still ACTIVE. The
      // closure event above proves the Case was still ACTIVE at that point.
      expect(byType.get('case.closure_recorded')?.redacted_summary).toMatchObject({
        closureType: 'DELIVERY_COMPLETED',
        caseStatus: 'ACTIVE',
      });
      // Evidence is REFERENCED, never copied into the event (§6.5).
      expect(byType.get('case.closure_recorded')?.payload_ref).toBe(
        'artifact://closure-evidence/outbox-lifecycle'
      );
      expect(events.filter((e) => e.event_type === 'case.closed')).toHaveLength(1);

      // Nothing leaked outside this Case's own org scope.
      expect(await readOutboxRowsForOrg(orgId)).toHaveLength(7);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 12. EVENT OUTBOX §5.3 — cancelCase delegates to transitionStatus and must
  //     NOT emit an event of its own. Two events for one cancellation would
  //     have different event_ids, so §8's dedup-by-eventId cannot collapse
  //     them, and every cancellation via this route would double-count.
  //     Also covers the `case.blocked` branch of the dynamic event_type.
  // -------------------------------------------------------------------------
  it('cancelCase produces exactly ONE case.cancelled event (no duplicate from the wrapper) and carries its reason; ACTIVE->BLOCKED produces case.blocked', async () => {
    const { orgId, projectId: cancelProjectId } = await seedOrgAndProject('outbox-cancel');
    const blockProjectId = await seedProjectInOrg(orgId, 'outbox-block');
    const actorId = await seedMemberedUser(orgId, 'outbox-cancel');
    try {
      // -- cancelCase: the wrapper emits nothing, the delegate emits once.
      const cancelCase = await caseCoreService.createCase({
        projectId: cancelProjectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: actorId,
      });
      await caseCoreService.cancelCase(
        cancelCase.caseId,
        { actorUserId: actorId },
        'sponsor withdrew funding'
      );

      const cancelEvents = await readOutboxRowsForCase(cancelCase.caseId);
      expect(cancelEvents.map((e) => e.event_type)).toEqual(['case.created', 'case.cancelled']);
      expect(cancelEvents.filter((e) => e.event_type === 'case.cancelled')).toHaveLength(1);

      // §5.3: the wrapper's `reason` survives — inside the delegate's summary,
      // which is the only place a cancellation reason becomes an event fact.
      const cancelled = cancelEvents[1];
      expect(cancelled.redacted_summary).toMatchObject({
        from: 'DRAFT',
        to: 'CANCELLED',
        reason: 'sponsor withdrew funding',
      });
      expect(cancelled.actor_user_id).toBe(actorId);
      expect(cancelled.organization_id).toBe(orgId);
      expect(cancelled.correlation_id).toBeTruthy();

      // -- The BLOCKED branch of the target-status → event_type mapping.
      const blockedCase = await caseCoreService.createCase({
        projectId: blockProjectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: actorId,
      });
      await caseCoreService.transitionStatus(blockedCase.caseId, 'ACTIVE', {
        actorUserId: actorId,
      });
      await caseCoreService.transitionStatus(blockedCase.caseId, 'BLOCKED', {
        actorUserId: actorId,
      });

      const blockedEvents = await readOutboxRowsForCase(blockedCase.caseId);
      expect(blockedEvents.map((e) => e.event_type)).toEqual([
        'case.created',
        'case.activated',
        'case.blocked',
      ]);
      expect(blockedEvents[2].redacted_summary).toMatchObject({ from: 'ACTIVE', to: 'BLOCKED' });
    } finally {
      await teardown([orgId], [cancelProjectId, blockProjectId], [actorId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 12b. The `case.failed` branch of STATUS_EVENT_TYPE — the one terminal
  //      status with no wrapper command of its own (cancelCase covers
  //      CANCELLED, recordClosure+CLOSED covers CLOSED), so nothing else in
  //      this suite reaches it. A branch no test enters is a branch we have no
  //      evidence about, however obviously correct the mapping table looks.
  //
  //      Both directions are asserted from the live table, out of band: the
  //      event that IS written, and the absence of any second event when the
  //      now-terminal Case refuses a further transition.
  // -------------------------------------------------------------------------
  it('ACTIVE -> FAILED publishes exactly one case.failed row carrying the reason and the post-mutation version, and FAILED accepts no further transition', async () => {
    const { orgId, projectId } = await seedOrgAndProject('outbox-failed');
    const actorId = await seedMemberedUser(orgId, 'outbox-failed');
    try {
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: actorId,
      });
      await caseCoreService.transitionStatus(created.caseId, 'ACTIVE', { actorUserId: actorId });
      const failed = await caseCoreService.transitionStatus(
        created.caseId,
        'FAILED',
        { actorUserId: actorId },
        'external dependency never delivered'
      );
      expect(failed.caseStatus).toBe('FAILED');

      const events = await readOutboxRowsForCase(created.caseId);
      expect(events.map((e) => e.event_type)).toEqual([
        'case.created',
        'case.activated',
        'case.failed',
      ]);
      const failedEvent = events[2];
      // Identity, not just the type — an event nobody can attribute is not
      // evidence (§1/§6.2).
      expect(failedEvent.aggregate_type).toBe('CASE');
      expect(failedEvent.aggregate_id).toBe(created.caseId);
      expect(failedEvent.case_id).toBe(created.caseId);
      expect(failedEvent.organization_id).toBe(orgId);
      expect(failedEvent.project_id).toBe(projectId);
      expect(failedEvent.actor_user_id).toBe(actorId);
      expect(String(failedEvent.correlation_id ?? '').length).toBeGreaterThan(0);
      // POST-mutation version, taken from the UPDATE's own RETURNING row:
      // 1 created, 2 activated, 3 failed.
      expect(failedEvent.aggregate_version).toBe(3);
      expect(failedEvent.redacted_summary).toMatchObject({
        from: 'ACTIVE',
        to: 'FAILED',
        reason: 'external dependency never delivered',
      });

      // The status really flipped in case_core, read out of band.
      expect((await readCaseCoreRow(created.caseId))?.case_status).toBe('FAILED');

      // FAILED is terminal: the rejected transition writes no fourth event.
      await expect(
        caseCoreService.transitionStatus(created.caseId, 'ACTIVE', { actorUserId: actorId })
      ).rejects.toThrow(/case_status_transition_not_allowed:FAILED->ACTIVE/);
      expect(await readOutboxRowsForCase(created.caseId)).toHaveLength(3);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 13. EVENT OUTBOX ATOMICITY — a failure raised AFTER the aggregate write,
  //     inside the same transaction, must leave BOTH the mutation and the
  //     event unwritten.
  //
  //     The forced failure is a real, documented one rather than a stub: the
  //     summary of `transitionStatus` carries the caller's `reason`, and
  //     publishEvent REJECTS a summary over MAX_REDACTED_SUMMARY_BYTES (8 KiB)
  //     instead of truncating it, because a silently truncated document is
  //     still a copied document. So an oversized reason fails the publish at a
  //     point where the UPDATE has already been issued on the transaction —
  //     exactly the "domain committed, event lost" window the outbox exists to
  //     close. If publishEvent ever ran on its own connection, this test would
  //     find case_status flipped and no event: the dual-write hole, visible.
  // -------------------------------------------------------------------------
  it('a failure after the case_core UPDATE rolls the whole transaction back: no outbox row AND no status change', async () => {
    const { orgId, projectId } = await seedOrgAndProject('outbox-rollback');
    const actorId = await seedMemberedUser(orgId, 'outbox-rollback');
    try {
      const created = await caseCoreService.createCase({
        projectId,
        organizationId: orgId,
        contractedClosureType: 'DELIVERY_COMPLETED',
        createdByActorId: actorId,
      });
      const before = await readCaseCoreRow(created.caseId);
      expect(before?.case_status).toBe('DRAFT');
      const eventsBefore = await readOutboxRowsForCase(created.caseId);
      expect(eventsBefore.map((e) => e.event_type)).toEqual(['case.created']);

      // 9 KiB of reason — over the 8 KiB ceiling, so publishEvent throws after
      // the UPDATE has run on this transaction's client.
      const oversizedReason = 'x'.repeat(9 * 1024);
      await expect(
        caseCoreService.transitionStatus(
          created.caseId,
          'ACTIVE',
          { actorUserId: actorId },
          oversizedReason
        )
      ).rejects.toThrow(/event_outbox_redacted_summary_too_large/);

      // The event never landed...
      const eventsAfter = await readOutboxRowsForCase(created.caseId);
      expect(eventsAfter.map((e) => e.event_type)).toEqual(['case.created']);
      expect(eventsAfter.filter((e) => e.event_type === 'case.activated')).toHaveLength(0);

      // ...and neither did the mutation that would have produced it. Same
      // version, same status: not a compensating write, a rollback.
      const after = await readCaseCoreRow(created.caseId);
      expect(after?.case_status).toBe('DRAFT');
      expect(after?.version).toBe(before?.version);

      // The Case is still fully usable — the failed command left no lock,
      // no partial write and no poisoned state behind.
      const activated = await caseCoreService.transitionStatus(created.caseId, 'ACTIVE', {
        actorUserId: actorId,
      });
      expect(activated.caseStatus).toBe('ACTIVE');
      const eventsFinal = await readOutboxRowsForCase(created.caseId);
      expect(eventsFinal.map((e) => e.event_type)).toEqual(['case.created', 'case.activated']);
    } finally {
      await teardown([orgId], [projectId], [actorId]);
    }
  }, 30_000);
});
