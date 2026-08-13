/**
 * CONTRACT (real PostgreSQL) — the error and authorization surface behaves the
 * way docs/product/case-workspace/api/openapi.yaml promises, against real
 * `organization_members` rows rather than a mocked auth context.
 *
 * The load-bearing claims proved here:
 *
 *   1. SEC-009 / CW-DOD-D6 enumeration safety is REAL, not documented: a
 *      cross-tenant caseId and a caseId that never existed produce byte-for-byte
 *      the same status AND the same error code. A test that only asserts "404"
 *      would pass even if the two answers differed in code or message and still
 *      leaked existence, so both are compared to each other directly.
 *   2. A REVOKED membership fails closed. This is the check that a mocked
 *      `requireCaseAccess` can never prove.
 *   3. ADMIN-gated platform routes reject a MEMBER with 403, not 404 — the
 *      opposite direction from (1), because a role failure leaks nothing about
 *      whether a resource exists.
 *   4. `error.code` is the stable SCREAMING_SNAKE upper-casing of the service's
 *      own code, and error bodies carry no SQL text.
 *
 * See ./contractHarness.ts for the gate and what is (and is not) substituted.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  CONNECTION_STRING,
  ContractFixtures,
  createContractApp,
  isContractDbReachable,
  minimalGraph,
  warnSkipped,
} from './contractHarness.js';

const REACHABLE = await isContractDbReachable();
warnSkipped('caseWorkspace error/authz contract', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;
const BASE = '/api/v8/case-workspace';

suite('CONTRACT — error envelope and authorization over real Postgres', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  it('a body missing required fields is 400 VALIDATION_ERROR with a per-field issue list', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('validation');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });

      const res = await request(app).post(`${BASE}/cases`).send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.error.issues)).toBe(true);
      const paths = res.body.error.issues.map((i: { path: string }) => i.path);
      expect(paths).toContain('projectId');
      expect(paths).toContain('contractedClosureType');

      // Nothing was written.
      const rows = await control.query(`SELECT case_id FROM case_core WHERE project_id = $1`, [f.projectId]);
      expect(rows.rowCount).toBe(0);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('ENUMERATION SAFETY — a cross-tenant caseId is indistinguishable from a caseId that never existed', async () => {
    const fx = new ContractFixtures(control);
    try {
      const victim = await fx.seedFixture('victim');
      const attacker = await fx.seedFixture('attacker');

      // The victim's Case genuinely exists...
      const victimApp = createContractApp({
        organizationId: victim.orgId,
        userId: victim.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const created = await request(victimApp)
        .post(`${BASE}/cases`)
        .send({ projectId: victim.projectId, contractedClosureType: 'DELIVERY_COMPLETED' });
      expect(created.status).toBe(201);
      const realCaseId = created.body.data.caseId;

      // ...but to the attacker it must look exactly like one that does not.
      const attackerApp = createContractApp({
        organizationId: attacker.orgId,
        userId: attacker.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const crossTenant = await request(attackerApp).get(`${BASE}/cases/${realCaseId}`);
      const nonExistent = await request(attackerApp).get(`${BASE}/cases/case-does-not-exist-${randomUUID()}`);

      expect(crossTenant.status).toBe(404);
      expect(nonExistent.status).toBe(404);
      // The comparison that actually proves the oracle is closed:
      expect(crossTenant.status).toBe(nonExistent.status);
      expect(crossTenant.body.error.code).toBe(nonExistent.body.error.code);
      // Explicitly NOT 403 — a 403 here would confirm the id is real.
      expect(crossTenant.status).not.toBe(403);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('a cross-tenant MUTATION is refused with 404 and changes nothing in the victim tenant', async () => {
    const fx = new ContractFixtures(control);
    try {
      const victim = await fx.seedFixture('victim-mut');
      const attacker = await fx.seedFixture('attacker-mut');
      const victimApp = createContractApp({
        organizationId: victim.orgId,
        userId: victim.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const created = await request(victimApp)
        .post(`${BASE}/cases`)
        .send({ projectId: victim.projectId, contractedClosureType: 'DELIVERY_COMPLETED' });
      const caseId = created.body.data.caseId;

      const attackerApp = createContractApp({
        organizationId: attacker.orgId,
        userId: attacker.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const attempt = await request(attackerApp)
        .post(`${BASE}/cases/${caseId}/status`)
        .send({ targetStatus: 'CANCELLED', reason: 'hostile' });
      expect(attempt.status).toBe(404);

      const row = await control.query(`SELECT case_status, version FROM case_core WHERE case_id = $1`, [caseId]);
      expect(row.rows[0].case_status).toBe('DRAFT');
      expect(Number(row.rows[0].version)).toBe(1);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('a REVOKED membership fails closed on both case-scoped and org-scoped reads', async () => {
    const fx = new ContractFixtures(control);
    try {
      const orgId = await fx.seedOrg('revoked');
      const projectId = await fx.seedProject(orgId, 'revoked');
      const activeUser = await fx.seedUser(orgId, 'revoked-active');
      await fx.seedMembership(orgId, activeUser, 'MEMBER', 'ACTIVE');
      const revokedUser = await fx.seedUser(orgId, 'revoked-gone');
      await fx.seedMembership(orgId, revokedUser, 'MEMBER', 'REVOKED');

      const activeApp = createContractApp({
        organizationId: orgId,
        userId: activeUser,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const created = await request(activeApp)
        .post(`${BASE}/cases`)
        .send({ projectId, contractedClosureType: 'DELIVERY_COMPLETED' });
      expect(created.status).toBe(201);
      const caseId = created.body.data.caseId;

      const revokedApp = createContractApp({
        organizationId: orgId,
        userId: revokedUser,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });

      // Case-scoped: enumeration-safe 404.
      const caseRead = await request(revokedApp).get(`${BASE}/cases/${caseId}`);
      expect(caseRead.status).toBe(404);

      // Org-scoped: 403 — the caller's own identity is known to be unauthorized,
      // and no resource existence is implied.
      const listRead = await request(revokedApp).get(`${BASE}/cases`);
      expect(listRead.status).toBe(403);
      expect(listRead.body.error.code).toBe('NOT_ORG_MEMBER');
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('a user with no membership row at all is refused (fail-closed default, not fail-open)', async () => {
    const fx = new ContractFixtures(control);
    try {
      const orgId = await fx.seedOrg('nomember');
      const strangerId = await fx.seedUser(orgId, 'stranger'); // users row, NO organization_members row
      const app = createContractApp({
        organizationId: orgId,
        userId: strangerId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });

      const res = await request(app).get(`${BASE}/cases`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_ORG_MEMBER');
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('ADMIN-gated platform routes reject a MEMBER with 403 (never 404 — role leaks nothing)', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('rolegate');
      const memberApp = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });

      const flagWrite = await request(memberApp)
        .post(`${BASE}/flags/definitions`)
        .send({ flagKey: `cw.contract.${randomUUID()}`, description: 'contract test flag' });
      expect(flagWrite.status).toBe(403);
      expect(flagWrite.body.error.code).toBe('INSUFFICIENT_ORG_ROLE');

      const quarantineRead = await request(memberApp).get(
        `${BASE}/legacy-quarantine/rehearsal-runs/rehearsal-${randomUUID()}`
      );
      expect(quarantineRead.status).toBe(403);

      // ...and the same route with an ADMIN actor gets through the gate.
      const adminApp = createContractApp({
        organizationId: f.orgId,
        userId: f.adminUserId,
        userRole: 'ADMIN',
        isSuperAdmin: false,
      });
      const adminRead = await request(adminApp).get(
        `${BASE}/legacy-quarantine/rehearsal-runs/rehearsal-${randomUUID()}`
      );
      expect(adminRead.status).toBe(200);
      expect(adminRead.body.data).toEqual([]);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('a proposal create with no Idempotency-Key and no body key is 400 and writes nothing', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('idem-required');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const created = await request(app)
        .post(`${BASE}/cases`)
        .send({ projectId: f.projectId, contractedClosureType: 'DELIVERY_COMPLETED' });
      const caseId = created.body.data.caseId;

      const res = await request(app)
        .post(`${BASE}/cases/${caseId}/proposals`)
        .send({
          runId: `run-${randomUUID()}`,
          nodeRunId: `noderun-${randomUUID()}`,
          payloadDigest: 'sha256:deadbeef',
          policySnapshotRef: 'policy://v1',
          effectClass: 'SAFE_ADDITIVE',
          previewRef: 'preview://x',
          proposerType: 'HUMAN',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      const rows = await control.query(
        `SELECT action_proposal_id FROM case_workspace_action_proposals WHERE case_id = $1`,
        [caseId]
      );
      expect(rows.rowCount).toBe(0);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('a wait create with no correlationKey and no Idempotency-Key is 400', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('wait-key');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const created = await request(app)
        .post(`${BASE}/cases`)
        .send({ projectId: f.projectId, contractedClosureType: 'DELIVERY_COMPLETED' });
      const caseId = created.body.data.caseId;

      const res = await request(app).post(`${BASE}/cases/${caseId}/waits`).send({ waitType: 'HUMAN' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('an unknown plan version is 404 PLAN_VERSION_NOT_FOUND and never leaks SQL text', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('plan-404');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });

      const res = await request(app).get(`${BASE}/plan-versions/planv-${randomUUID()}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PLAN_VERSION_NOT_FOUND');
      // The message is the domain code, never a driver/SQL string.
      expect(res.body.error.message).not.toMatch(/SELECT|INSERT|UPDATE|relation |pg_/i);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  /**
   * ===========================================================================
   * CW-SEC-ENUM-PLAYS-01 — REGRESSION GUARD (the defect is fixed; this pins
   * the FIXED behavior so it cannot silently come back)
   * ===========================================================================
   * History: `play.routes.ts`'s by-id routes intend to 404 (enumeration-safe,
   * mirroring caseWorkspaceAuthContext's case_access_denied posture) when the
   * resource's organizationId does not match the actor's own org. They could
   * not, because the service call they make threw first:
   *
   *   playService.getProcessDefinition
   *     if (!row) return null;                       // -> route 404
   *     await requireOrgMember(actor, row.organization_id);  // -> THREW 403
   *
   *   playService.getProcessVersion — same shape.
   *
   * So an outsider got 403 for a processDefinitionId that EXISTS in another
   * tenant and 404 for one that does not: a working cross-tenant existence
   * oracle, precisely what SEC-009 exists to close.
   *
   * FIXED in playService.ts: getProcessDefinition (~line 769) and
   * getProcessVersion (~line 1117) now wrap `requireOrgMember` in
   * `try { } catch (err) { if (err instanceof CaseWorkspaceAuthError) return null; throw err; }`
   * — the same shape as the sibling that always got it right,
   * `migrationReadinessService.getQuarantinedLegacyRecord`.
   *
   * The catch is deliberately NARROW: ONLY an authorization denial collapses to
   * not-found. Every other error still propagates — a blanket catch would be a
   * worse bug than the oracle it replaced. That property has its own dedicated
   * guard in
   * services/caseWorkspace/__tests__/security/playsEnumeration.security.pg.test.ts.
   *
   * NOTE on the collapse's visible side effect: because the auth error is
   * swallowed at the service layer, callers downstream (e.g.
   * instantiateProcessVersion) now surface a plain
   * `Error('process_version_not_found')` rather than a `CaseWorkspaceAuthError`
   * carrying `code: 'not_org_member'`. That is intended, not a lost check — the
   * actor is still rejected and no plan draft is created.
   */
  it('cross-tenant Plays do NOT leak existence via 403-vs-404 (CW-SEC-ENUM-PLAYS-01, fixed)', async () => {
    const fx = new ContractFixtures(control);
    try {
      const owner = await fx.seedFixture('play-owner');
      const outsider = await fx.seedFixture('play-outsider');

      const ownerApp = createContractApp({
        organizationId: owner.orgId,
        userId: owner.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const definition = await request(ownerApp)
        .post(`${BASE}/process-definitions`)
        .send({ name: `Contract play ${randomUUID()}` });
      expect(definition.status).toBe(201);
      const definitionId = definition.body.data.processDefinitionId;

      const version = await request(ownerApp)
        .post(`${BASE}/process-definitions/${definitionId}/versions`)
        .send({ semanticGraph: minimalGraph() });
      expect(version.status).toBe(201);
      const versionId = version.body.data.processVersionId;

      const outsiderApp = createContractApp({
        organizationId: outsider.orgId,
        userId: outsider.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });

      const realDefinition = await request(outsiderApp).get(`${BASE}/process-definitions/${definitionId}`);
      const fakeDefinition = await request(outsiderApp).get(
        `${BASE}/process-definitions/procdef-does-not-exist-${randomUUID()}`
      );
      const realVersion = await request(outsiderApp).get(`${BASE}/process-versions/${versionId}`);
      const fakeVersion = await request(outsiderApp).get(
        `${BASE}/process-versions/procver-does-not-exist-${randomUUID()}`
      );

      // A non-existent id answers the enumeration-safe 404, as intended.
      expect(fakeDefinition.status).toBe(404);
      expect(fakeDefinition.body.error.code).toBe('PROCESS_DEFINITION_NOT_FOUND');
      expect(fakeVersion.status).toBe(404);

      // FIXED: a REAL id in another tenant is now indistinguishable from a
      // non-existent one — same status AND same error code, so there is no
      // residual oracle in the body either.
      expect(realDefinition.status).toBe(fakeDefinition.status);
      expect(realDefinition.body.error.code).toBe(fakeDefinition.body.error.code);
      expect(realDefinition.status).not.toBe(403);

      // FIXED: same on process versions.
      expect(realVersion.status).toBe(fakeVersion.status);
      expect(realVersion.body.error.code).toBe(fakeVersion.body.error.code);
      expect(realVersion.status).not.toBe(403);

      // The tenant-scoped LIST is correct — the leak is confined to by-id reads.
      const list = await request(outsiderApp).get(`${BASE}/process-definitions`);
      expect(list.status).toBe(200);
      expect(
        list.body.data.map((d: { processDefinitionId: string }) => d.processDefinitionId)
      ).not.toContain(definitionId);

      await control.query(`DELETE FROM process_versions WHERE process_version_id = $1`, [versionId]);
      await control.query(`DELETE FROM process_definitions WHERE process_definition_id = $1`, [definitionId]);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('the quarantine by-id read does NOT leak existence — the correct pattern, for contrast', async () => {
    const fx = new ContractFixtures(control);
    try {
      const owner = await fx.seedFixture('quarantine-owner');
      const outsider = await fx.seedFixture('quarantine-outsider');

      const ownerApp = createContractApp({
        organizationId: owner.orgId,
        userId: owner.adminUserId,
        userRole: 'ADMIN',
        isSuperAdmin: false,
      });
      const recorded = await request(ownerApp)
        .post(`${BASE}/legacy-quarantine`)
        .send({
          rehearsalRunId: `rehearsal-${randomUUID()}`,
          sourceSystem: 'legacy',
          sourceTable: 'old_cases',
          sourceId: `src-${randomUUID()}`,
          quarantineReasonCode: 'MISSING_OWNER',
          quarantineReasonDetail: 'contract test',
          recoveryPathRef: 'runbook://contract',
          detectedAt: new Date().toISOString(),
        });
      expect(recorded.status).toBe(201);
      const quarantineId = recorded.body.data.quarantineId;

      const outsiderApp = createContractApp({
        organizationId: outsider.orgId,
        userId: outsider.adminUserId,
        userRole: 'ADMIN',
        isSuperAdmin: false,
      });
      const real = await request(outsiderApp).get(`${BASE}/legacy-quarantine/${quarantineId}`);
      const fake = await request(outsiderApp).get(`${BASE}/legacy-quarantine/q-${randomUUID()}`);

      expect(real.status).toBe(404);
      expect(fake.status).toBe(404);
      expect(real.status).toBe(fake.status);
      expect(real.body.error.code).toBe(fake.body.error.code);

      await control.query(`DELETE FROM case_workspace_legacy_quarantine WHERE quarantine_id = $1`, [
        quarantineId,
      ]);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('an inbound X-Correlation-ID is echoed on the error envelope', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('correlation');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const correlationId = `corr-${randomUUID()}`;

      const res = await request(app)
        .get(`${BASE}/cases/case-missing-${randomUUID()}`)
        .set('X-Correlation-ID', correlationId);

      expect(res.status).toBe(404);
      expect(res.body.correlationId).toBe(correlationId);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('a plan draft for a Case in another tenant is refused before any row is created', async () => {
    const fx = new ContractFixtures(control);
    try {
      const owner = await fx.seedFixture('plan-owner');
      const outsider = await fx.seedFixture('plan-outsider');
      const ownerApp = createContractApp({
        organizationId: owner.orgId,
        userId: owner.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const created = await request(ownerApp)
        .post(`${BASE}/cases`)
        .send({ projectId: owner.projectId, contractedClosureType: 'DELIVERY_COMPLETED' });
      const caseId = created.body.data.caseId;

      const outsiderApp = createContractApp({
        organizationId: outsider.orgId,
        userId: outsider.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const res = await request(outsiderApp)
        .post(`${BASE}/cases/${caseId}/plan-versions`)
        .send({ semanticGraph: minimalGraph() });
      expect(res.status).toBe(404);

      const rows = await control.query(
        `SELECT case_plan_version_id FROM case_plan_versions WHERE case_id = $1`,
        [caseId]
      );
      expect(rows.rowCount).toBe(0);
    } finally {
      await fx.teardown();
    }
  }, 30_000);
});
