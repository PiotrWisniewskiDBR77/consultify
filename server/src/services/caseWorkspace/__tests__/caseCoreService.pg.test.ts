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

    return caseCoreOk && orgMembersOk;
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
      `20260809_case_workspace_case_core.sql migration applied. requested=${REAL_DB_REQUESTED} ` +
      `reachable=${REACHABLE}`
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
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
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
      ).rejects.toThrow(/not_org_member/);

      await expect(
        caseCoreService.createCase({
          projectId,
          organizationId: orgId,
          contractedClosureType: 'DELIVERY_COMPLETED',
          createdByActorId: revokedActor,
        })
      ).rejects.toThrow(/not_org_member/);

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
      ).rejects.toThrow(/case_access_denied/);

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
      ).rejects.toThrow(/not_org_member/);
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
      expect(nonexistentError?.message).toMatch(/case_access_denied/);

      // A properly-membered actor succeeds.
      const found = await caseCoreService.getCase({ caseId: created.caseId }, ownerActor);
      expect(found?.caseId).toBe(created.caseId);
    } finally {
      await teardown([orgId], [projectId], [ownerActor, noMembershipActor]);
    }
  }, 30_000);
});
