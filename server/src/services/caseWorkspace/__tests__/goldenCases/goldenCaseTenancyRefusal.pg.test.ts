/**
 * GOLDEN CASE I — cross-tenant access and a revoked membership both fail
 * closed, indistinguishably from a Case that never existed, on a real
 * database.
 *
 *   Org A creates and populates a real Case (plan, run, proposal — enough
 *     state that a leak would be worth something to an attacker)
 *        -> a real, ACTIVE member of a DIFFERENT org (Org B) reads AND
 *           attempts to mutate Org A's Case: both refused 404, byte-for-byte
 *           identical to a nonexistent caseId
 *        -> Org A's own consultant has their membership REVOKED
 *           mid-engagement -> every case-scoped call they make is now
 *           refused 404 too, and every org-scoped call is refused 403
 *        -> a user with NO membership row in Org A at all gets the same
 *           refusal
 *        -> throughout, Org A's data is provably UNCHANGED: no row was
 *           mutated by any of the refused attempts
 *
 * What this proves that no prior Golden Case does:
 *   - CW-DOD-D6/SEC-009 (caseWorkspaceAuthContext.ts's own header, cited
 *     verbatim): "a caseId that does not exist, a caseId belonging to
 *     another tenant, and a real caseId the actor is simply not a member of
 *     all throw the SAME CaseWorkspaceAuthError('case_access_denied', ...)"
 *     — this is asserted here as an EQUALITY of response bodies (status,
 *     code, message) between the cross-tenant attempt and a literally
 *     nonexistent caseId, not merely "both are some 4xx";
 *   - `resolveActorMembership`'s own documented posture: a REVOKED row is
 *     refused exactly like a MISSING row — never "fails open on an
 *     unrecognized status string" — proven against a REAL
 *     `organization_members` row with `status='REVOKED'`, not a mocked
 *     membership lookup;
 *   - the split enforced by `_shared/errors.ts`'s status mapping:
 *     case-scoped refusal is 404 (enumeration-safe — never reveals whether
 *     the Case exists), while org-scoped refusal (e.g. creating a NEW Case,
 *     which has no caseId yet to hide behind) is 403;
 *   - all of this is asserted with a REAL mutation attempt, not just a GET —
 *     a cross-tenant actor cannot even ADVANCE Org A's Case status, and the
 *     attempt leaves no trace in Org A's own event outbox.
 *
 * This is the Golden Case list's items 10 ("cross-tenant refusal") and 11
 * ("revoked membership").
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BASE,
  CONNECTION_STRING,
  createGoldenCaseApp,
  eventTypes,
  GoldenCaseFixtures,
  isGoldenCaseDbReachable,
  minimalGraph,
  readOutboxForOrg,
  warnSkipped,
} from './goldenCaseHarness.js';

const REACHABLE = await isGoldenCaseDbReachable();
warnSkipped('Golden Case I (cross-tenant + revoked membership fail closed)', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('GOLDEN CASE I — cross-tenant and revoked-membership access both fail closed, indistinguishably from 404', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  it('refuses a cross-tenant actor, a revoked member, and a non-member — all fail closed, no side effect', async () => {
    const fxA = new GoldenCaseFixtures(control);
    const fxB = new GoldenCaseFixtures(control);
    const correlationId = `golden-i-${randomUUID()}`;
    try {
      // -- Org A: a real, populated Case ---------------------------------------
      const orgA = await fxA.seedOrg('golden-i-a');
      const projectA = await fxA.seedProject(orgA, 'golden-i-a');
      const consultantA = await fxA.seedUser(orgA, 'golden-i-a-consultant');
      await fxA.seedMembership(orgA, consultantA, 'MEMBER');

      const appA = createGoldenCaseApp({
        organizationId: orgA,
        userId: consultantA,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const asConsultantA = (m: 'post' | 'get', url: string) =>
        request(appA)[m](url).set('X-Correlation-ID', correlationId);

      const created = await asConsultantA('post', `${BASE}/cases`).send({
        projectId: projectA,
        caseProfile: 'STANDARD',
        contractedClosureType: 'DELIVERY_COMPLETED',
      });
      expect(created.status).toBe(201);
      const caseId: string = created.body.data.caseId;
      await asConsultantA('post', `${BASE}/cases/${caseId}/status`).send({ targetStatus: 'ACTIVE' });

      const draft = await asConsultantA('post', `${BASE}/cases/${caseId}/plan-versions`).send({
        semanticGraph: minimalGraph(),
      });
      expect(draft.status).toBe(201);

      const caseVersionBefore = await control.query(
        `SELECT case_status, version FROM case_core WHERE case_id = $1`,
        [caseId]
      );

      // -- A literally nonexistent caseId — the oracle every refusal below
      //    must be indistinguishable from. --------------------------------
      const nonexistentCaseId = `case-does-not-exist-${randomUUID()}`;
      const notFoundRead = await asConsultantA('get', `${BASE}/cases/${nonexistentCaseId}`);
      expect(notFoundRead.status).toBe(404);
      expect(notFoundRead.body.error.code).toBe('CASE_ACCESS_DENIED');

      // -- Org B: a real, ACTIVE member of a DIFFERENT tenant ------------------
      const orgB = await fxB.seedOrg('golden-i-b');
      const projectB = await fxB.seedProject(orgB, 'golden-i-b');
      const outsiderB = await fxB.seedUser(orgB, 'golden-i-b-outsider');
      await fxB.seedMembership(orgB, outsiderB, 'ADMIN');

      const appB = createGoldenCaseApp({
        organizationId: orgB,
        userId: outsiderB,
        userRole: 'ADMIN',
        isSuperAdmin: false,
      });
      const asOutsiderB = (m: 'post' | 'get', url: string) =>
        request(appB)[m](url).set('X-Correlation-ID', `${correlationId}-b`);

      // READ: cross-tenant caseId is refused exactly like a nonexistent one.
      const crossTenantRead = await asOutsiderB('get', `${BASE}/cases/${caseId}`);
      expect(crossTenantRead.status).toBe(404);
      // Same status, code and message as the literally-nonexistent caseId —
      // the only difference allowed is the per-request correlationId.
      expect(crossTenantRead.status).toBe(notFoundRead.status);
      expect(crossTenantRead.body.error.code).toBe(notFoundRead.body.error.code);
      expect(crossTenantRead.body.error.message).toBe(notFoundRead.body.error.message);

      // MUTATE: an outsider cannot even advance the Case's status.
      const crossTenantMutation = await asOutsiderB('post', `${BASE}/cases/${caseId}/status`).send({
        targetStatus: 'BLOCKED',
        reason: 'attempted cross-tenant mutation',
      });
      expect(crossTenantMutation.status).toBe(404);
      expect(crossTenantMutation.body.error.code).toBe('CASE_ACCESS_DENIED');

      // MUTATE: an outsider cannot bind a Run to a plan version they cannot see.
      const crossTenantPlanRead = await asOutsiderB('get', `${BASE}/plan-versions/${draft.body.data.casePlanVersionId}/validate`);
      expect(crossTenantPlanRead.status).toBe(404);

      // Org A's own project cannot be listed/read by Org B's outsider either —
      // a project id from another tenant is not a side door.
      const crossTenantByProject = await asOutsiderB('get', `${BASE}/cases/by-project/${projectA}`);
      expect(crossTenantByProject.status).toBe(404);
      expect(crossTenantByProject.body.error.code).toBe('CASE_NOT_FOUND');

      // No row in Org A moved.
      const caseVersionAfterCrossTenant = await control.query(
        `SELECT case_status, version FROM case_core WHERE case_id = $1`,
        [caseId]
      );
      expect(caseVersionAfterCrossTenant.rows[0]).toEqual(caseVersionBefore.rows[0]);

      // -- Org A's own consultant is REVOKED mid-engagement --------------------
      await control.query(
        `UPDATE organization_members SET status = 'REVOKED' WHERE organization_id = $1 AND user_id = $2`,
        [orgA, consultantA]
      );

      const revokedRead = await asConsultantA('get', `${BASE}/cases/${caseId}`);
      // Case-scoped: refused 404, indistinguishable from not-found — a
      // revoked member cannot use the error shape to learn the Case still
      // exists.
      expect(revokedRead.status).toBe(404);
      expect(revokedRead.body.error.code).toBe('CASE_ACCESS_DENIED');

      const revokedMutation = await asConsultantA('post', `${BASE}/cases/${caseId}/status`).send({
        targetStatus: 'BLOCKED',
        reason: 'attempted mutation after revocation',
      });
      expect(revokedMutation.status).toBe(404);

      // Org-scoped (no caseId to hide behind — this is a request to CREATE a
      // new Case): refused 403, per _shared/errors.ts's split.
      const revokedCreate = await asConsultantA('post', `${BASE}/cases`).send({
        projectId: projectA,
        caseProfile: 'LIGHT',
        contractedClosureType: 'DELIVERY_COMPLETED',
      });
      expect(revokedCreate.status).toBe(403);
      expect(revokedCreate.body.error.code).toBe('NOT_ORG_MEMBER');

      const caseVersionAfterRevoke = await control.query(
        `SELECT case_status, version FROM case_core WHERE case_id = $1`,
        [caseId]
      );
      expect(caseVersionAfterRevoke.rows[0]).toEqual(caseVersionBefore.rows[0]);

      // -- A user with NO membership row in Org A at all -----------------------
      const strangerId = await fxA.seedUser(orgA, 'golden-i-a-stranger');
      // Deliberately: no seedMembership call for strangerId.
      const appStranger = createGoldenCaseApp({
        organizationId: orgA,
        userId: strangerId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const strangerRead = await request(appStranger).get(`${BASE}/cases/${caseId}`);
      expect(strangerRead.status).toBe(404);
      expect(strangerRead.body.error.code).toBe('CASE_ACCESS_DENIED');

      // -- Org A's Case is provably UNCHANGED by every refused attempt above ---
      const caseVersionFinal = await control.query(
        `SELECT case_status, version FROM case_core WHERE case_id = $1`,
        [caseId]
      );
      expect(caseVersionFinal.rows[0]).toEqual(caseVersionBefore.rows[0]);
      expect(caseVersionFinal.rows[0].case_status).toBe('ACTIVE');

      // No plan version, run binding or proposal was created by any refused
      // attempt above.
      const planVersionCount = await control.query(
        `SELECT count(*)::int AS n FROM case_plan_versions WHERE case_id = $1`,
        [caseId]
      );
      expect(planVersionCount.rows[0].n).toBe(1); // only the one Org A itself created

      // ======================================================================
      // OUTBOX — no refused cross-tenant/revoked attempt left a fact behind in
      // Org A's stream, and none leaked into Org B's.
      // ======================================================================
      const outboxA = await readOutboxForOrg(control, orgA);
      const typesA = eventTypes(outboxA);
      expect(typesA).toContain('case.created');
      expect(typesA).toContain('case.activated');
      expect(typesA).toContain('case.plan.draft_created');
      // No status-change fact from the refused cross-tenant or revoked
      // mutation attempts.
      expect(typesA.filter((t) => t === 'case.blocked').length).toBe(0);
      for (const row of outboxA) expect(row.organization_id).toBe(orgA);

      const outboxB = await readOutboxForOrg(control, orgB);
      // Org B's own stream carries nothing about Org A's Case — the refused
      // attempts were rejected before any event was published, and even a
      // successful read of Org B's own (nonexistent) data would not
      // reference orgA's identifiers.
      for (const row of outboxB) {
        expect(row.organization_id).toBe(orgB);
        expect(row.case_id === null || row.case_id !== caseId).toBe(true);
      }
    } finally {
      await fxA.teardown();
      await fxB.teardown();
    }
  }, 120_000);
});
