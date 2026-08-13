/**
 * Case Workspace — Authorization Context service (CW-P12), proved against a
 * REAL PostgreSQL. Exercises
 * server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts against the
 * pre-existing `organization_members` table
 * (server/migrations/727_beta_missing_tables.sql) and `case_core`
 * (server/migrations/20260809_case_workspace_case_core.sql, CW-P01's table),
 * both strictly read-only from this module's point of view.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same convention as playService.pg.test.ts / caseCoreService.pg.test.ts:
 * `NODE_ENV=test` ALONE is a trap — `Database.ts`'s `getDatabase()`/
 * `createDatabase()` hand back an in-memory MOCK whenever
 * `RUN_DB_TESTS !== '1'` (or `MOCK_DB` isn't explicitly `'false'`), and every
 * read/write silently goes through a fake in-memory store instead. This file
 * follows the `*.pg.test.ts` convention: gate on `RUN_DB_TESTS === '1' &&
 * MOCK_DB === 'false'`, probe reachability AND that the migrated schema is
 * actually present before deciding, and SKIP LOUDLY (never silently pass)
 * when either is missing.
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/caseWorkspaceAuthContext.pg.test.ts
 *
 * ===========================================================================
 * ISOLATION — every test owns its own fixture (org/users/case)
 * ===========================================================================
 * Every test seeds its own organization, its own users, and — when case
 * access is exercised — its own project/case_core row via
 * caseCoreService.createCase, all inside the test body (never a shared
 * beforeEach), and tears everything down itself in a `finally`.
 * organization_members rows are seeded here via direct INSERTs on the
 * out-of-band pool (mirrors playService.pg.test.ts's seedMember()) — this is
 * a test-fixture-only direct insert, not a production code path; nothing in
 * caseWorkspaceAuthContext.ts itself writes to organization_members.
 *
 * This is security-critical code: every assertion below is adversarial by
 * design — the point of most of these tests is to prove the module fails
 * CLOSED (throws / returns null) rather than to prove a happy path works.
 * The enumeration-oracle test (§6) is the centerpiece: it does not just
 * assert each of the three denial scenarios individually matches the
 * documented shape, it string-compares all three CAUGHT errors directly
 * against EACH OTHER, so a future edit that accidentally makes any one of
 * them distinguishable from the other two fails this test loudly, without
 * needing the hardcoded expectation to also happen to be updated in lockstep.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import {
  CaseWorkspaceAuthError,
  requireCaseAccess,
  requireOrgMember,
  requireOrgRole,
  resolveActorMembership,
} from '../caseWorkspaceAuthContext.js';

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
    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('id', 'organization_id', 'user_id', 'role', 'status',
                               'invited_by_user_id', 'created_at')`
    );
    const orgMembersOk = Number(orgMembersResult.rows[0]?.present ?? 0) === 7;

    const caseCoreResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_core'
          AND column_name IN ('case_id', 'project_id', 'organization_id', 'version')`
    );
    const caseCoreOk = Number(caseCoreResult.rows[0]?.present ?? 0) === 4;

    return orgMembersOk && caseCoreOk;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[caseWorkspaceAuthContext pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260809_case_workspace_case_core.sql migration plus organization_members applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('caseWorkspaceAuthContext — Authorization Context against a real PostgreSQL (CW-P12)', () => {
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
    const orgId = `authctx-org-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      orgId,
      `Auth context test org (${label})`,
    ]);
    return orgId;
  }

  /** A fresh, uniquely-named project row for an existing organization. */
  async function seedProject(orgId: string, label: string): Promise<string> {
    const projectId = `authctx-project-${label}-${randomUUID()}`;
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Auth context test project (${label})`]
    );
    return projectId;
  }

  /** A fresh organization + project + case_core row (mirrors playService.pg.test.ts's seedOrgProjectCase). */
  async function seedOrgProjectCase(
    label: string
  ): Promise<{ orgId: string; projectId: string; caseId: string }> {
    const orgId = await seedOrg(label);
    const projectId = await seedProject(orgId, label);
    // caseCoreService.createCase now requires the creator to be an active org
    // member (CW-P12 retrofit) — seed one instead of using a bare, unmembered
    // actor id, which createCase would now reject with not_org_member.
    const creatorUserId = await seedUser(orgId, `case-creator-${label}`);
    await seedMember(orgId, creatorUserId, 'MEMBER');
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: creatorUserId,
    });
    return { orgId, projectId, caseId: created.caseId };
  }

  /** A fresh users row, unattached to organization_members unless seedMember() is also called for it. */
  async function seedUser(orgId: string, label: string): Promise<string> {
    const userId = `authctx-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    return userId;
  }

  /**
   * An organization_members row for an existing user, at the given role and
   * status — a test-fixture-only direct insert. Status defaults to 'ACTIVE'
   * but can be overridden to a non-active value (e.g. 'REVOKED',
   * 'SUSPENDED') to prove the fail-closed behavior of resolveActorMembership.
   */
  async function seedMember(
    orgId: string,
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT',
    status: string = 'ACTIVE'
  ): Promise<void> {
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, $4, $5)`,
      [`authctx-member-${randomUUID()}`, orgId, userId, role, status]
    );
  }

  async function teardown(opts: {
    orgIds?: string[];
    projectIds?: string[];
    userIds?: string[];
  }): Promise<void> {
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

  // -------------------------------------------------------------------------
  // 1. resolveActorMembership — no organization_members row at all -> null.
  // -------------------------------------------------------------------------
  it('resolveActorMembership returns null for an actor with NO organization_members row at all', async () => {
    const orgId = await seedOrg('no-row');
    const userId = await seedUser(orgId, 'no-row');
    try {
      const membership = await resolveActorMembership(userId, orgId);
      expect(membership).toBeNull();
    } finally {
      await teardown({ orgIds: [orgId], userIds: [userId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 2. resolveActorMembership — a non-ACTIVE row (REVOKED / SUSPENDED) fails
  //    closed exactly like a missing row, never fails open because a row
  //    technically exists.
  // -------------------------------------------------------------------------
  it('resolveActorMembership returns null for an actor whose organization_members row has status REVOKED or SUSPENDED (fails closed, not open)', async () => {
    const orgId = await seedOrg('non-active');
    const revokedUserId = await seedUser(orgId, 'revoked');
    const suspendedUserId = await seedUser(orgId, 'suspended');
    try {
      await seedMember(orgId, revokedUserId, 'ADMIN', 'REVOKED');
      await seedMember(orgId, suspendedUserId, 'OWNER', 'SUSPENDED');

      const revokedMembership = await resolveActorMembership(revokedUserId, orgId);
      expect(revokedMembership).toBeNull();

      const suspendedMembership = await resolveActorMembership(suspendedUserId, orgId);
      expect(suspendedMembership).toBeNull();
    } finally {
      await teardown({ orgIds: [orgId], userIds: [revokedUserId, suspendedUserId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 3. resolveActorMembership — an ACTIVE row is returned, correctly mapped.
  // -------------------------------------------------------------------------
  it('resolveActorMembership returns the membership, correctly mapped, for an actor with an ACTIVE row', async () => {
    const orgId = await seedOrg('active-mapped');
    const userId = await seedUser(orgId, 'active-mapped');
    try {
      await seedMember(orgId, userId, 'MEMBER', 'ACTIVE');

      const membership = await resolveActorMembership(userId, orgId);
      expect(membership).not.toBeNull();
      expect(membership?.organizationId).toBe(orgId);
      expect(membership?.userId).toBe(userId);
      expect(membership?.role).toBe('MEMBER');
      expect(membership?.status).toBe('ACTIVE');
      expect(typeof membership?.membershipId).toBe('string');
      expect(membership?.membershipId.length).toBeGreaterThan(0);
      expect(membership?.invitedByUserId).toBeNull();
      expect(typeof membership?.createdAt).toBe('string');
    } finally {
      await teardown({ orgIds: [orgId], userIds: [userId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 4. requireOrgMember — throws for a non-member and a revoked member;
  //    returns the membership for an active member.
  // -------------------------------------------------------------------------
  it('requireOrgMember throws not_org_member for a non-member and a revoked member, and returns the membership for an active member', async () => {
    const orgId = await seedOrg('require-member');
    const noRowUserId = await seedUser(orgId, 'no-row');
    const revokedUserId = await seedUser(orgId, 'revoked');
    const activeUserId = await seedUser(orgId, 'active');
    try {
      await seedMember(orgId, revokedUserId, 'MEMBER', 'REVOKED');
      await seedMember(orgId, activeUserId, 'MEMBER', 'ACTIVE');

      await expect(requireOrgMember(noRowUserId, orgId)).rejects.toThrow(CaseWorkspaceAuthError);
      await expect(requireOrgMember(noRowUserId, orgId)).rejects.toMatchObject({ code: 'not_org_member' });

      await expect(requireOrgMember(revokedUserId, orgId)).rejects.toThrow(CaseWorkspaceAuthError);
      await expect(requireOrgMember(revokedUserId, orgId)).rejects.toMatchObject({ code: 'not_org_member' });

      const membership = await requireOrgMember(activeUserId, orgId);
      expect(membership.userId).toBe(activeUserId);
      expect(membership.organizationId).toBe(orgId);
      expect(membership.role).toBe('MEMBER');
    } finally {
      await teardown({ orgIds: [orgId], userIds: [noRowUserId, revokedUserId, activeUserId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 5. requireOrgRole — ADMIN outranks MEMBER (succeeds); MEMBER does not
  //    outrank ADMIN (throws); CONSULTANT does not outrank MEMBER (throws).
  // -------------------------------------------------------------------------
  it('requireOrgRole: ADMIN outranks MEMBER floor (succeeds), MEMBER does not outrank ADMIN floor (throws), CONSULTANT does not outrank MEMBER floor (throws)', async () => {
    const orgId = await seedOrg('role-rank');
    const adminUserId = await seedUser(orgId, 'admin');
    const memberUserId = await seedUser(orgId, 'member');
    const consultantUserId = await seedUser(orgId, 'consultant');
    try {
      await seedMember(orgId, adminUserId, 'ADMIN');
      await seedMember(orgId, memberUserId, 'MEMBER');
      await seedMember(orgId, consultantUserId, 'CONSULTANT');

      // ADMIN outranks MEMBER -> succeeds, returns the ADMIN's own membership.
      const adminMembership = await requireOrgRole(adminUserId, orgId, 'MEMBER');
      expect(adminMembership.role).toBe('ADMIN');
      expect(adminMembership.userId).toBe(adminUserId);

      // MEMBER does not outrank ADMIN -> throws insufficient_org_role.
      await expect(requireOrgRole(memberUserId, orgId, 'ADMIN')).rejects.toThrow(CaseWorkspaceAuthError);
      await expect(requireOrgRole(memberUserId, orgId, 'ADMIN')).rejects.toMatchObject({
        code: 'insufficient_org_role',
      });

      // CONSULTANT does not outrank MEMBER -> throws insufficient_org_role.
      await expect(requireOrgRole(consultantUserId, orgId, 'MEMBER')).rejects.toThrow(CaseWorkspaceAuthError);
      await expect(requireOrgRole(consultantUserId, orgId, 'MEMBER')).rejects.toMatchObject({
        code: 'insufficient_org_role',
      });
    } finally {
      await teardown({ orgIds: [orgId], userIds: [adminUserId, memberUserId, consultantUserId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 6. THE ENUMERATION-ORACLE PROOF — requireCaseAccess must be
  //    indistinguishable across (a) nonexistent caseId, (b) caseId in a
  //    DIFFERENT org, (c) caseId in the actor's OWN org with no membership
  //    row at all. All three caught errors are string-compared directly
  //    against EACH OTHER, not just against a hardcoded expectation.
  // -------------------------------------------------------------------------
  it('requireCaseAccess throws byte-for-byte identical code+message for nonexistent caseId, cross-tenant caseId, and own-org caseId with no membership — then succeeds for a real active member', async () => {
    // (a) A caseId that does not exist in case_core at all.
    const nonexistentCaseId = `authctx-nonexistent-case-${randomUUID()}`;
    const actorForNonexistent = `authctx-actor-nonexistent-${randomUUID()}`;

    // (b) A caseId that exists but belongs to a DIFFERENT organization than
    // the actor is a member of.
    const { orgId: otherOrgId, projectId: otherProjectId, caseId: otherOrgCaseId } =
      await seedOrgProjectCase('oracle-other-org');
    const actorOrgId = await seedOrg('oracle-actor-org');
    const actorForCrossTenant = await seedUser(actorOrgId, 'oracle-cross-tenant');
    await seedMember(actorOrgId, actorForCrossTenant, 'ADMIN', 'ACTIVE');

    // (c) A caseId that exists in the actor's OWN organization, but the
    // actor has NO organization_members row at all for that org.
    const { orgId: ownOrgId, projectId: ownProjectId, caseId: ownOrgCaseId } = await seedOrgProjectCase(
      'oracle-own-org-no-membership'
    );
    const actorForOwnOrgNoMembership = await seedUser(ownOrgId, 'oracle-own-org-no-membership');

    // Success case: a real case in the actor's own org, actor IS an active
    // member of that org.
    const { orgId: successOrgId, projectId: successProjectId, caseId: successCaseId } =
      await seedOrgProjectCase('oracle-success');
    const successActorId = await seedUser(successOrgId, 'oracle-success');
    await seedMember(successOrgId, successActorId, 'MEMBER', 'ACTIVE');

    try {
      let errorA: CaseWorkspaceAuthError | undefined;
      try {
        await requireCaseAccess(actorForNonexistent, nonexistentCaseId);
      } catch (err) {
        errorA = err as CaseWorkspaceAuthError;
      }

      let errorB: CaseWorkspaceAuthError | undefined;
      try {
        await requireCaseAccess(actorForCrossTenant, otherOrgCaseId);
      } catch (err) {
        errorB = err as CaseWorkspaceAuthError;
      }

      let errorC: CaseWorkspaceAuthError | undefined;
      try {
        await requireCaseAccess(actorForOwnOrgNoMembership, ownOrgCaseId);
      } catch (err) {
        errorC = err as CaseWorkspaceAuthError;
      }

      // All three must actually have thrown.
      expect(errorA).toBeInstanceOf(CaseWorkspaceAuthError);
      expect(errorB).toBeInstanceOf(CaseWorkspaceAuthError);
      expect(errorC).toBeInstanceOf(CaseWorkspaceAuthError);

      // Each individually matches the documented public shape.
      expect(errorA!.code).toBe('case_access_denied');
      expect(errorB!.code).toBe('case_access_denied');
      expect(errorC!.code).toBe('case_access_denied');

      // The whole point: string-compare the three CAUGHT errors directly
      // against EACH OTHER, so this test fails loudly if a future edit
      // accidentally makes any one of them distinguishable, even if nobody
      // updates a hardcoded expectation string in lockstep.
      expect(errorA!.code).toBe(errorB!.code);
      expect(errorB!.code).toBe(errorC!.code);
      expect(errorA!.message).toBe(errorB!.message);
      expect(errorB!.message).toBe(errorC!.message);

      // internalReason is documented as log-only and MAY legitimately differ
      // (it is exactly how the three scenarios stay debuggable without being
      // an externally-observable oracle) — assert it is NOT part of the
      // public equality by confirming the three internalReasons are in fact
      // distinguishable from each other, proving the identical code/message
      // above isn't merely an artifact of internalReason also happening to
      // collapse.
      const internalReasons = new Set([errorA!.internalReason, errorB!.internalReason, errorC!.internalReason]);
      expect(internalReasons.size).toBeGreaterThan(1);

      // Success: a real case in the actor's own org, actor IS an active
      // member -> requireCaseAccess resolves without throwing.
      const membership = await requireCaseAccess(successActorId, successCaseId);
      expect(membership.userId).toBe(successActorId);
      expect(membership.organizationId).toBe(successOrgId);
      expect(membership.role).toBe('MEMBER');
    } finally {
      await teardown({ userIds: [actorForNonexistent] });
      await teardown({ orgIds: [otherOrgId], projectIds: [otherProjectId] });
      await teardown({ orgIds: [actorOrgId], userIds: [actorForCrossTenant] });
      await teardown({ orgIds: [ownOrgId], projectIds: [ownProjectId], userIds: [actorForOwnOrgNoMembership] });
      await teardown({ orgIds: [successOrgId], projectIds: [successProjectId], userIds: [successActorId] });
    }
  }, 30_000);
});
