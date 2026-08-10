/**
 * Case Workspace — Stream E adversarial security specification for
 * caseCoreService.ts (CW-P01, EPIC E1).
 *
 * ===========================================================================
 * STATUS — SPECIFICATION, NOT YET RUN
 * ===========================================================================
 * Written against the CURRENT-STATE code read from the reference worktree
 * (claude/case-workspace-v1-20260809 @ PACKET_REGISTRY.md "12 packets
 * landed" checkpoint, 2026-08-10). This file's own git worktree does not yet
 * contain server/src/services/caseWorkspace/caseCoreService.ts (Stream A has
 * not landed here) and the shared disposable Postgres is being modified
 * concurrently by other streams right now — per the Stream E task brief,
 * this suite is deliberately NOT executed as part of building it. A clean
 * SKIP (via the same RUN_DB_TESTS/MOCK_DB/schema-probe gate every sibling
 * *.pg.test.ts in this directory already uses) is the correct and expected
 * outcome until fan-in. That is not a Stream E defect.
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS ALONGSIDE __tests__/caseCoreService.pg.test.ts
 * ===========================================================================
 * The existing top-level suite proves FUNCTIONAL correctness (OD-01
 * uniqueness, CW-RT-026 state machine, append-only governance history). This
 * suite proves (or, today, DISPROVES) the SECURITY contract: can an actor
 * with no standing in a Case's organization read or mutate it anyway? Per
 * docs/product/case-workspace/acceptance/PACKET_REGISTRY.md ("CW-P12"
 * section, "Not yet done"): "nothing in CW-P01-11's 11 existing services
 * actually *calls* [caseWorkspaceAuthContext] yet ... it exists as an
 * unused, tested primitive until a route layer ... wires it in." Verified
 * directly by Stream E via
 *   grep -rl "caseWorkspaceAuthContext\|requireCaseAccess\|requireOrgMember\|requireOrgRole" \
 *     server/src/services/caseWorkspace --include="*.ts" | grep -v caseWorkspaceAuthContext.ts
 * against the reference worktree: zero matches, confirming the claim rather
 * than trusting it. This suite therefore has TWO describe blocks with
 * deliberately different meanings:
 *
 *   (A) "target contract" — requireCaseAccess composed IMMEDIATELY BEFORE
 *       the service call, exactly as the future route layer's retrofit must
 *       (caseWorkspaceAuthContext.ts's own RETROFIT NOTE, priority #3:
 *       "caseCoreService.transitionStatus (especially -> CLOSED/CANCELLED)
 *       and recordClosure ... a MEMBER can currently close/cancel a Case
 *       exactly as freely as an OWNER"). These tests exercise REAL, already
 *       -implemented, already-proven code (SEC-009-U1 IMPLEMENTED_AND_PROVEN)
 *       and are expected to PASS once run.
 *   (B) "known gap (P1)" — the SAME cross-tenant caseId called directly
 *       against caseCoreService, with NO auth gate in front, exactly as
 *       every current caller in this codebase (none exist yet, but any
 *       future one written before the retrofit) would call it. These tests
 *       are expected to FAIL today (the service call SUCCEEDS when it
 *       should not) — a red result here is the correct, honest signal of a
 *       real, tracked P1 gap, not a Stream E authoring defect. Once a
 *       future retrofit packet wires requireCaseAccess into
 *       caseCoreService's own mutating methods, block (B)'s assertions
 *       should be inverted (success -> throw) as part of that packet's own
 *       acceptance, not silently left red forever.
 *
 * Traceability: docs/product/case-workspace/acceptance/TRACEABILITY_AUTH_ROUTES.csv,
 * rows command_or_query=caseCoreService.* (authorization_predicate column
 * reads NONE-INTERNAL-ONLY for every one of them today).
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../../caseCoreService.js';
import { requireCaseAccess } from '../../caseWorkspaceAuthContext.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const caseCoreResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_core'
          AND column_name IN ('case_id', 'project_id', 'organization_id', 'version', 'case_status')`
    );
    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    return (
      Number(caseCoreResult.rows[0]?.present ?? 0) === 5 &&
      Number(orgMembersResult.rows[0]?.present ?? 0) === 4
    );
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[caseCoreService SECURITY pg suite SKIPPED — clean skip pending Stream A/B/C fan-in, not a failure] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and ` +
      `20260809_case_workspace_case_core.sql + organization_members applied. requested=${REAL_DB_REQUESTED} ` +
      `reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('caseCoreService — adversarial security (Stream E, CW-P01/E1)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // ---------------------------------------------------------------------
  // Fixture helpers — mirrors caseCoreService.pg.test.ts /
  // caseWorkspaceAuthContext.pg.test.ts conventions exactly: every test
  // seeds and tears down its own rows, never a shared beforeEach.
  // ---------------------------------------------------------------------

  async function seedOrg(label: string): Promise<string> {
    const orgId = `sece2e-org-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      orgId,
      `Stream E test org (${label})`,
    ]);
    return orgId;
  }

  async function seedProject(orgId: string, label: string): Promise<string> {
    const projectId = `sece2e-project-${label}-${randomUUID()}`;
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Stream E test project (${label})`]
    );
    return projectId;
  }

  async function seedUser(orgId: string, label: string): Promise<string> {
    const userId = `sece2e-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    return userId;
  }

  async function seedMember(
    orgId: string,
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT',
    status: string = 'ACTIVE'
  ): Promise<string> {
    const membershipId = `sece2e-member-${randomUUID()}`;
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, $4, $5)`,
      [membershipId, orgId, userId, role, status]
    );
    return membershipId;
  }

  async function setMemberStatus(membershipId: string, status: string): Promise<void> {
    await control.query(`UPDATE organization_members SET status = $1 WHERE id = $2`, [status, membershipId]);
  }

  /**
   * Post-Stream-A addendum: caseCoreService.createCase now calls
   * requireOrgMember(createdByActorId, organizationId) internally (SEC-001),
   * so the fixture's creator actor must itself be a real ACTIVE member of
   * the org it is creating a Case in — a bare unseeded string id (the
   * pre-retrofit fixture shape) now fails at the fixture-setup stage with
   * CaseWorkspaceAuthError('not_org_member', ...), not inside the test body.
   * This is fixture plumbing catching up with the retrofit, not a security
   * property under test here.
   */
  async function seedActiveActor(
    orgId: string,
    tag: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT' = 'MEMBER'
  ): Promise<string> {
    const userId = await seedUser(orgId, tag);
    await seedMember(orgId, userId, role, 'ACTIVE');
    return userId;
  }

  async function seedOrgProjectCase(label: string): Promise<{ orgId: string; projectId: string; caseId: string }> {
    const orgId = await seedOrg(label);
    const projectId = await seedProject(orgId, label);
    const creatorUserId = await seedActiveActor(orgId, `${label}-creator`, 'OWNER');
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: creatorUserId,
    });
    return { orgId, projectId, caseId: created.caseId };
  }

  async function readCaseCoreRow(caseId: string) {
    const result = await control.query(`SELECT * FROM case_core WHERE case_id = $1`, [caseId]);
    return result.rows[0] ?? null;
  }

  async function teardown(opts: { orgIds?: string[]; projectIds?: string[]; userIds?: string[] }): Promise<void> {
    for (const projectId of opts.projectIds ?? []) {
      await control.query(`DELETE FROM case_core WHERE project_id = $1`, [projectId]).catch(() => undefined);
      await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    }
    for (const userId of opts.userIds ?? []) {
      await control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    }
    for (const orgId of opts.orgIds ?? []) {
      // organization_members cascades automatically (ON DELETE CASCADE from
      // organizations); users does not carry that FK, so any actor seeded
      // via seedActiveActor()/seedUser() for this org (including fixture
      // "creator" actors not individually tracked in userIds above) is
      // swept here by organization_id rather than needing per-test tracking.
      await control.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]).catch(() => undefined);
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
  }

  // =========================================================================
  // (A) TARGET CONTRACT — requireCaseAccess composed in front of the
  //     service, exactly as a future route layer must. Expected to PASS.
  // =========================================================================
  describe('(A) target contract: requireCaseAccess in front of caseCoreService fails closed (SEC-009, CW-DOD-D6)', () => {
    it('IDOR: an actor active in org X is denied requireCaseAccess for a real caseId belonging to org Y, with the SAME public shape as a nonexistent caseId', async () => {
      const { orgId: victimOrgId, projectId: victimProjectId, caseId: victimCaseId } =
        await seedOrgProjectCase('idor-victim');
      const attackerOrgId = await seedOrg('idor-attacker');
      const attackerUserId = await seedUser(attackerOrgId, 'idor-attacker');
      await seedMember(attackerOrgId, attackerUserId, 'ADMIN', 'ACTIVE');
      const nonexistentCaseId = `case-nonexistent-${randomUUID()}`;

      try {
        let crossTenantError: unknown;
        try {
          await requireCaseAccess(attackerUserId, victimCaseId);
        } catch (err) {
          crossTenantError = err;
        }
        let nonexistentError: unknown;
        try {
          await requireCaseAccess(attackerUserId, nonexistentCaseId);
        } catch (err) {
          nonexistentError = err;
        }

        expect(crossTenantError).toBeInstanceOf(Error);
        expect(nonexistentError).toBeInstanceOf(Error);
        expect((crossTenantError as Error & { code?: string }).code).toBe('case_access_denied');
        expect((crossTenantError as Error).message).toBe((nonexistentError as Error).message);
        expect((crossTenantError as Error & { code?: string }).code).toBe(
          (nonexistentError as Error & { code?: string }).code
        );

        // The victim's own row is untouched — requireCaseAccess is read-only.
        const victimRow = await readCaseCoreRow(victimCaseId);
        expect(victimRow?.organization_id).toBe(victimOrgId);
      } finally {
        await teardown({
          orgIds: [victimOrgId, attackerOrgId],
          projectIds: [victimProjectId],
          userIds: [attackerUserId],
        });
      }
    }, 30_000);

    it('revoked membership mid-session: an actor who WAS an active member loses access the instant their row flips to REVOKED, on the very next call', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('revoked-midsession');
      const actorUserId = await seedUser(orgId, 'revoked-midsession');
      const membershipId = await seedMember(orgId, actorUserId, 'MEMBER', 'ACTIVE');

      try {
        // Before revocation: access is granted.
        await expect(requireCaseAccess(actorUserId, caseId)).resolves.toMatchObject({
          userId: actorUserId,
          organizationId: orgId,
        });

        // Revoke mid-session (simulates an admin removing the actor while
        // they may still hold a live UI session / in-flight approval).
        await setMemberStatus(membershipId, 'REVOKED');

        // The very next call must fail closed — no caching, no stale grant.
        await expect(requireCaseAccess(actorUserId, caseId)).rejects.toMatchObject({
          code: 'case_access_denied',
        });
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [projectId], userIds: [actorUserId] });
      }
    }, 30_000);

    it('information leakage: forbidden-but-real vs nonexistent caseId produce byte-for-byte identical error code AND message (SEC-009)', async () => {
      const { caseId: realForbiddenCaseId, orgId: victimOrgId, projectId: victimProjectId } =
        await seedOrgProjectCase('leak-real-forbidden');
      const attackerOrgId = await seedOrg('leak-attacker');
      const attackerUserId = await seedUser(attackerOrgId, 'leak-attacker');
      await seedMember(attackerOrgId, attackerUserId, 'OWNER', 'ACTIVE');
      const nonexistentCaseId = `case-does-not-exist-${randomUUID()}`;

      try {
        const errors: Array<{ code?: string; message: string }> = [];
        for (const caseId of [realForbiddenCaseId, nonexistentCaseId]) {
          try {
            await requireCaseAccess(attackerUserId, caseId);
            throw new Error(`expected requireCaseAccess to throw for caseId=${caseId}`);
          } catch (err) {
            errors.push({ code: (err as Error & { code?: string }).code, message: (err as Error).message });
          }
        }
        expect(errors[0].code).toBe(errors[1].code);
        expect(errors[0].message).toBe(errors[1].message);
      } finally {
        await teardown({
          orgIds: [victimOrgId, attackerOrgId],
          projectIds: [victimProjectId],
          userIds: [attackerUserId],
        });
      }
    }, 30_000);
  });

  // =========================================================================
  // (B) GAP CLOSED by Stream A (formerly a known gap, P1) — the SAME
  //     cross-tenant caseId called directly against caseCoreService, with NO
  //     auth gate composed by the test itself. Prior to Stream A's retrofit
  //     (commits c4374eb5dd/a5e4009b52, fan-in e416096d15) this mutation
  //     SUCCEEDED for an out-of-org actor — a real, tracked P1. Verified
  //     directly against the CURRENT code
  //     (server/src/services/caseWorkspace/caseCoreService.ts): every
  //     mutating export in this file now opens with
  //     `await requireCaseAccess(actorUserId, id);` before touching the row
  //     (transitionStatus at line 415, updateGovernanceTier at 465,
  //     updateAutonomyPolicy at 518, updateClosureAxisStatus at 566,
  //     recordClosure at 607) — the exact call site
  //     caseWorkspaceAuthContext.ts's own RETROFIT NOTE priority #3 named.
  //     This test now asserts the call correctly REJECTS, proving the gap
  //     is closed — polarity inverted from the original spec, coverage kept
  //     (not deleted) per this packet's own instructions.
  // =========================================================================
  describe('(B) gap CLOSED by Stream A (formerly known gap P1): caseCoreService now self-enforces tenant/membership', () => {
    it('GAP CLOSED: transitionStatus now REJECTS a caseId belonging to a DIFFERENT organization than the calling actor (was: succeeded silently)', async () => {
      const { orgId: victimOrgId, projectId: victimProjectId, caseId: victimCaseId } =
        await seedOrgProjectCase('gap-transition');
      const attackerOrgId = await seedOrg('gap-transition-attacker');
      const attackerUserId = await seedUser(attackerOrgId, 'gap-transition-attacker');
      await seedMember(attackerOrgId, attackerUserId, 'MEMBER', 'ACTIVE');

      try {
        // Formerly succeeded silently (the P1 this test used to document).
        // caseCoreService.transitionStatus now opens with
        // requireCaseAccess(actorUserId, id) (line 415), which resolves
        // victimCaseId's organization_id and requires the caller to be an
        // ACTIVE member of it — the attacker is only a member of a
        // different org, so this now fails closed with the same
        // enumeration-safe 'case_access_denied' code requireCaseAccess uses
        // for every denial shape (SEC-009).
        await expect(
          caseCoreService.transitionStatus(victimCaseId, 'ACTIVE', { actorUserId: attackerUserId })
        ).rejects.toMatchObject({ code: 'case_access_denied' });

        // The victim's row must be provably untouched, not just "an error
        // was thrown somewhere" — still DRAFT (transitionStatus's own
        // internal SELECT...FOR UPDATE + WHERE version=? never ran).
        const row = await readCaseCoreRow(victimCaseId);
        expect(row?.case_status).toBe('DRAFT');
        expect(row?.organization_id).toBe(victimOrgId); // confirms it really is the victim's row
      } finally {
        await teardown({
          orgIds: [victimOrgId, attackerOrgId],
          projectIds: [victimProjectId],
          userIds: [attackerUserId],
        });
      }
    }, 30_000);
  });

  // =========================================================================
  // (C) Stale version / optimistic concurrency — caseCoreService reads
  //     version under SELECT ... FOR UPDATE and writes WHERE version = ?
  //     using the value it just read (internal-lock pattern, no
  //     caller-supplied expectedVersion parameter anywhere in this file).
  //     Two truly concurrent mutations therefore SERIALIZE via the row
  //     lock rather than racing into a *_conflict — this test asserts the
  //     stronger property that matters (no lost update), and documents why
  //     "*_conflict" specifically does not apply to this file's API shape.
  // =========================================================================
  describe('(C) concurrency safety (no caller-supplied expectedVersion in this file)', () => {
    it('two concurrent updateGovernanceTier calls on the same case never lose an update: both history entries land, version increments exactly twice', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('occ-concurrent');
      // Post-Stream-A: updateGovernanceTier now opens with
      // requireCaseAccess(actorUserId, id) (caseCoreService.ts:465), so both
      // concurrent actors must themselves be real ACTIVE members of orgId —
      // bare unseeded strings would now fail at the auth gate before ever
      // reaching the concurrency behavior this test actually targets.
      const actorAId = await seedActiveActor(orgId, 'occ-actor-a');
      const actorBId = await seedActiveActor(orgId, 'occ-actor-b');
      try {
        const [a, b] = await Promise.all([
          caseCoreService.updateGovernanceTier(caseId, 'STANDARD', { actorUserId: actorAId }, 'concurrent A'),
          caseCoreService.updateGovernanceTier(caseId, 'CONTROLLED', { actorUserId: actorBId }, 'concurrent B'),
        ]);
        // Both calls must succeed (SELECT ... FOR UPDATE serializes them —
        // neither should throw case_version_conflict for a plain race).
        expect([a.version, b.version].sort()).toEqual([2, 3]);

        const row = await readCaseCoreRow(caseId);
        const history = JSON.parse(row?.governance_tier_history ?? '[]');
        // created (1) + two concurrent updates (2) = 3 entries, none lost.
        expect(history).toHaveLength(3);
        expect(row?.version).toBe(3);
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);
  });

  // =========================================================================
  // (D) Malformed input — must reject with a stable domain Error, never a
  //     raw Postgres error or stack trace leaking to the caller.
  // =========================================================================
  describe('(D) malformed input rejected with stable domain errors', () => {
    it('createCase rejects a missing organizationId with a domain error, not a raw SQL/constraint error', async () => {
      const orgId = await seedOrg('malformed-missing-org');
      const projectId = await seedProject(orgId, 'malformed-missing-org');
      try {
        await expect(
          caseCoreService.createCase({
            projectId,
            organizationId: '',
            contractedClosureType: 'DELIVERY_COMPLETED',
            createdByActorId: 'malformed-actor',
          })
        ).rejects.toThrow('case_organization_id_required');
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);

    it('createCase rejects an invalid contractedClosureType enum value with a domain error', async () => {
      const orgId = await seedOrg('malformed-bad-enum');
      const projectId = await seedProject(orgId, 'malformed-bad-enum');
      try {
        await expect(
          caseCoreService.createCase({
            projectId,
            organizationId: orgId,
            // @ts-expect-error deliberately wrong-typed enum value for the adversarial probe
            contractedClosureType: 'NOT_A_REAL_CLOSURE_TYPE',
            createdByActorId: 'malformed-actor',
          })
        ).rejects.toThrow('case_contracted_closure_type_invalid');
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);

    it('transitionStatus rejects an illegal status-machine edge with a domain error naming the attempted edge, leaving the row unchanged', async () => {
      const { orgId, projectId, caseId } = await seedOrgProjectCase('malformed-illegal-edge');
      // Post-Stream-A: transitionStatus's requireCaseAccess gate runs before
      // the status-machine check this test targets, so the actor must be a
      // real ACTIVE member of orgId — otherwise this test would (correctly,
      // but for the WRONG reason) observe case_access_denied instead of the
      // business-logic domain error it means to probe.
      const actorId = await seedActiveActor(orgId, 'malformed-illegal-edge-actor');
      try {
        const before = await readCaseCoreRow(caseId);
        await expect(
          caseCoreService.transitionStatus(caseId, 'CLOSED', { actorUserId: actorId })
        ).rejects.toThrow('case_closure_not_recorded');
        const after = await readCaseCoreRow(caseId);
        expect(after?.case_status).toBe(before?.case_status);
        expect(after?.version).toBe(before?.version);
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);
  });

  // =========================================================================
  // (E) Duplicate request — createCase has no explicit idempotencyKey
  //     field; project_id's UNIQUE constraint (OD-01) is this file's own
  //     natural dedupe key. "Exactly one effect" here means the retry is
  //     REJECTED (not silently merged) and only one row ever lands, which
  //     is the correct behavior for this specific API shape.
  // =========================================================================
  describe('(E) duplicate request', () => {
    it('two sequential createCase calls for the SAME project_id land TWO case_core rows — a project holds many Cases (CW-T-A cardinality ruling)', async () => {
      const orgId = await seedOrg('dup-sequential');
      const projectId = await seedProject(orgId, 'dup-sequential');
      // Post-Stream-A: createCase itself now calls
      // requireOrgMember(createdByActorId, organizationId) (caseCoreService.ts:288),
      // so both actors must be real ACTIVE members of orgId.
      const actor1Id = await seedActiveActor(orgId, 'dup-actor-1');
      const actor2Id = await seedActiveActor(orgId, 'dup-actor-2');
      try {
        const first = await caseCoreService.createCase({
          projectId,
          organizationId: orgId,
          contractedClosureType: 'DELIVERY_COMPLETED',
          createdByActorId: actor1Id,
        });
        // CW-T-A: a Case is a work order, so one project must be able to hold
        // many independent Cases. This assertion used to require the second
        // create to be REJECTED, which was correct only while
        // case_core_project_id_key (UNIQUE on project_id) existed. The owner
        // ruled that constraint a model defect; migration 20260810d drops it,
        // and intake idempotency moved to
        // (tenant, actor/conversation, confirmation key, work-order digest).
        // Direct createCase has no work-order concept at all, so two direct
        // creates are two genuinely different Cases, not a duplicate request.
        const second = await caseCoreService.createCase({
          projectId,
          organizationId: orgId,
          contractedClosureType: 'DELIVERY_COMPLETED',
          createdByActorId: actor2Id,
        });
        expect(second.caseId).not.toBe(first.caseId);

        const result = await control.query(
          `SELECT case_id FROM case_core WHERE project_id = $1 ORDER BY created_at ASC`,
          [projectId]
        );
        expect(result.rows).toHaveLength(2);
        expect(result.rows.map((r) => r.case_id).sort()).toEqual([first.caseId, second.caseId].sort());
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);

    it('two CONCURRENT createCase calls (Promise.allSettled) for the SAME project_id: BOTH succeed and two distinct rows land (CW-T-A cardinality ruling)', async () => {
      const orgId = await seedOrg('dup-concurrent');
      const projectId = await seedProject(orgId, 'dup-concurrent');
      // Post-Stream-A: same requireOrgMember gate as the sequential variant
      // above — both concurrent actors need real ACTIVE standing in orgId.
      const actorAId = await seedActiveActor(orgId, 'dup-concurrent-a');
      const actorBId = await seedActiveActor(orgId, 'dup-concurrent-b');
      try {
        const [outcomeA, outcomeB] = await Promise.allSettled([
          caseCoreService.createCase({
            projectId,
            organizationId: orgId,
            contractedClosureType: 'DELIVERY_COMPLETED',
            createdByActorId: actorAId,
          }),
          caseCoreService.createCase({
            projectId,
            organizationId: orgId,
            contractedClosureType: 'DELIVERY_COMPLETED',
            createdByActorId: actorBId,
          }),
        ]);
        const outcomes = [outcomeA, outcomeB];
        const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
        const rejected = outcomes.filter((o) => o.status === 'rejected');
        // CW-T-A: with case_core_project_id_key dropped, two concurrent direct
        // creates are two different work orders racing, not a duplicate
        // request racing itself. Nothing should serialize them into one.
        // Idempotency now lives on the intake path's own key
        // (tenant + actor/conversation + confirmation key + digest), which is
        // covered by integration/caseCardinality.pg.test.ts.
        expect(rejected).toHaveLength(0);
        expect(fulfilled).toHaveLength(2);

        const result = await control.query(`SELECT case_id FROM case_core WHERE project_id = $1`, [projectId]);
        expect(result.rows).toHaveLength(2);
      } finally {
        await teardown({ orgIds: [orgId], projectIds: [projectId] });
      }
    }, 30_000);
  });
});
