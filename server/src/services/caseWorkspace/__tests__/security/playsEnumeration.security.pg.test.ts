/**
 * Case Workspace — ADVERSARIAL security suite closing the Play (reusable
 * Process) cross-tenant EXISTENCE ORACLE — CW-SEC-ENUM-PLAYS-01 (SEC-009 /
 * CW-DOD-D6) — in server/src/services/caseWorkspace/playService.ts
 * (getProcessDefinition/getProcessVersion) as reached through every by-id
 * route in server/src/routes/caseWorkspace/play.routes.ts (CW-P08, EPIC E12
 * "Reusable Plays").
 *
 * ===========================================================================
 * THE HOLE (pinned, pre-fix, by
 * routes/caseWorkspace/__tests__/contract/errorAndAuthz.contract.pg.test.ts's
 * "KNOWN DEFECT CW-SEC-ENUM-PLAYS-01" test — NOT owned by this packet, left
 * untouched here; see this file's own trailer comment for the exact line to
 * flip once this fix lands)
 * ===========================================================================
 * play.routes.ts's `requireOwnOrgDefinition`/`requireOwnOrgVersion` are
 * written to 404 (enumeration-safe) whenever a resolved definition/version's
 * organizationId does not match the actor's own — but they never reached
 * that comparison for a REAL cross-tenant id, because the service call they
 * make throws first:
 *
 *   playService.getProcessDefinition
 *     if (!row) return null;                              // -> route 404
 *     await requireOrgMember(actor, row.organization_id);  // -> THREW 403
 *
 *   playService.getProcessVersion — same shape, one join hop further
 *   (via the version's owning process_definitions row).
 *
 * A nonexistent processDefinitionId/processVersionId therefore answered 404,
 * while a REAL id belonging to another tenant answered 403 NOT_ORG_MEMBER —
 * a working cross-tenant existence oracle across every one of the 12 by-id
 * routes mounted on those two gates (createProcessDefinition and
 * listProcessDefinitions take no target-resource id and were never affected).
 *
 * THE FIX (this packet, in playService.ts — NOT play.routes.ts, which needed
 * no change: every route already gates through these two functions first):
 * give getProcessDefinition/getProcessVersion the same try/catch -> `return
 * null` treatment migrationReadinessService.getQuarantinedLegacyRecord
 * already uses for the identical shape (row exists, actor has no standing on
 * its org -> collapse to the same "not found" a missing row already
 * produces). Only a caught `CaseWorkspaceAuthError` is swallowed; any other
 * error (a genuinely broken read) still propagates and must never be
 * reported as "not found" — proved below by the `!definitionRow` orphan
 * branch staying a real throw, untouched by this fix.
 *
 * ===========================================================================
 * WHAT THIS SUITE PROVES
 * ===========================================================================
 * Mounts the REAL `play.routes.ts` router (via
 * routes/caseWorkspace/__tests__/contract/contractHarness.ts — no service
 * mocked, real Postgres underneath), then for every one of the 13 by-id
 * routes calls it twice as an OUTSIDER actor (real ACTIVE membership in
 * their OWN org, zero standing in the resource's owning org): once against
 * an id that does not exist anywhere, once against a REAL id owned by a
 * different tenant. Both calls must be `toBe`/`toEqual`-identical in status,
 * `error.code` AND `error.message` — comparing only the HTTP status would
 * pass even if the two answers leaked existence through a different code or
 * message. A POSITIVE CONTROL walks one actor's own Play through every
 * route end to end, proving the fix did not also close off legitimate
 * same-tenant access.
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
import request, { type Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  CONNECTION_STRING,
  ContractFixtures,
  REAL_DB_REQUESTED,
  createContractApp,
  minimalGraph,
} from '../../../../routes/caseWorkspace/__tests__/contract/contractHarness.js';

const BASE = '/api/v8/case-workspace';

/**
 * The base contract harness's own reachability probe
 * (`isContractDbReachable`) does not know about process_definitions/
 * process_versions — this suite needs those too, so it runs its own probe
 * rather than importing that one.
 */
const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 4000 });
  try {
    const playsResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name IN ('process_definitions', 'process_versions')
          AND column_name IN ('process_definition_id', 'process_version_id', 'organization_id',
                               'process_definition_id', 'status', 'version')`
    );
    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    const caseCoreResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_core'
          AND column_name IN ('case_id', 'organization_id', 'project_id')`
    );
    return (
      Number(playsResult.rows[0]?.present ?? 0) >= 5 &&
      Number(orgMembersResult.rows[0]?.present ?? 0) === 4 &&
      Number(caseCoreResult.rows[0]?.present ?? 0) === 3
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
    `[playsEnumeration SECURITY suite SKIPPED — clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `case-workspace Plays + case_core + organization_members migrations applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('play.routes.ts — cross-tenant Play existence oracle (CW-SEC-ENUM-PLAYS-01 / SEC-009)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  /**
   * process_definitions has no ON DELETE CASCADE from organizations (it
   * FK-references organizations(id) plainly — see
   * server/migrations/20260809_case_workspace_plays.sql), so
   * ContractFixtures.teardown()'s own `DELETE FROM organizations` would
   * violate that FK unless every process_definitions row for the org is
   * deleted first. process_versions DOES cascade from process_definitions,
   * so deleting the definition is enough for both tables.
   */
  async function deleteDefinitions(definitionIds: string[]): Promise<void> {
    for (const id of definitionIds) {
      await control.query(`DELETE FROM process_definitions WHERE process_definition_id = $1`, [id]).catch(() => undefined);
    }
  }

  interface RouteProbe {
    name: string;
    method: 'get' | 'post' | 'put';
    path: (id: string) => string;
    body?: Record<string, unknown>;
  }

  const definitionRouteProbes: RouteProbe[] = [
    { name: 'GET /process-definitions/:id', method: 'get', path: (id) => `${BASE}/process-definitions/${id}` },
    {
      name: 'GET /process-definitions/:id/publisher-check',
      method: 'get',
      path: (id) => `${BASE}/process-definitions/${id}/publisher-check`,
    },
    {
      name: 'POST /process-definitions/:id/share',
      method: 'post',
      path: (id) => `${BASE}/process-definitions/${id}/share`,
      body: { targetVisibility: 'TEAM', expectedVersion: 1 },
    },
    {
      name: 'POST /process-definitions/:id/versions',
      method: 'post',
      path: (id) => `${BASE}/process-definitions/${id}/versions`,
      body: { semanticGraph: minimalGraph() },
    },
    {
      name: 'GET /process-definitions/:id/versions',
      method: 'get',
      path: (id) => `${BASE}/process-definitions/${id}/versions`,
    },
  ];

  const versionRouteProbes: RouteProbe[] = [
    { name: 'GET /process-versions/:id', method: 'get', path: (id) => `${BASE}/process-versions/${id}` },
    {
      name: 'PUT /process-versions/:id',
      method: 'put',
      path: (id) => `${BASE}/process-versions/${id}`,
      body: { semanticGraph: minimalGraph(), expectedVersion: 1 },
    },
    {
      name: 'POST /process-versions/:id/propose',
      method: 'post',
      path: (id) => `${BASE}/process-versions/${id}/propose`,
      body: { expectedVersion: 1 },
    },
    {
      name: 'POST /process-versions/:id/review',
      method: 'post',
      path: (id) => `${BASE}/process-versions/${id}/review`,
      body: { decision: 'APPROVED', expectedVersion: 1 },
    },
    {
      name: 'POST /process-versions/:id/publish',
      method: 'post',
      path: (id) => `${BASE}/process-versions/${id}/publish`,
      body: { expectedVersion: 1 },
    },
    {
      name: 'POST /process-versions/:id/deprecate',
      method: 'post',
      path: (id) => `${BASE}/process-versions/${id}/deprecate`,
      body: { reason: 'attack probe', expectedVersion: 1 },
    },
    {
      name: 'POST /process-versions/:id/archive',
      method: 'post',
      path: (id) => `${BASE}/process-versions/${id}/archive`,
      body: { expectedVersion: 1 },
    },
  ];

  async function send(app: ReturnType<typeof createContractApp>, probe: RouteProbe, id: string): Promise<Response> {
    const req = request(app)[probe.method](probe.path(id));
    return probe.body ? req.send(probe.body) : req.send();
  }

  /**
   * The core assertion: an id that does not exist anywhere, and a REAL id
   * owned by a different tenant, must be indistinguishable at the HTTP
   * layer — same status, same `error.code`, same `error.message`. Also
   * asserts the shared outcome actually IS the enumeration-safe 404 (never
   * silently 200, never the leaking 403) so a mistake that disabled the
   * route's authorization entirely would still be caught.
   */
  async function expectIndistinguishable404(
    app: ReturnType<typeof createContractApp>,
    probe: RouteProbe,
    realForeignId: string,
    nonexistentId: string
  ): Promise<void> {
    const foreign = await send(app, probe, realForeignId);
    const nonexistent = await send(app, probe, nonexistentId);

    expect(nonexistent.status).toBe(404);
    expect(foreign.status).toBe(nonexistent.status);
    expect(foreign.body.error.code).toBe(nonexistent.body.error.code);
    expect(foreign.body.error.message).toBe(nonexistent.body.error.message);
    // The exact regression this suite exists to catch: a REAL cross-tenant
    // id must never answer 403 (that would confirm the id exists).
    expect(foreign.status).not.toBe(403);
    expect(foreign.body.error.code).not.toBe('NOT_ORG_MEMBER');
  }

  // ===========================================================================
  // 1–12. Every by-id route, outsider vs owner-tenant, real vs nonexistent id
  // ===========================================================================
  it('every process-definitions/process-versions by-id route: a real cross-tenant id and a nonexistent id answer identically', async () => {
    const fx = new ContractFixtures(control);
    const definitionIds: string[] = [];
    try {
      const owner = await fx.seedFixture('plays-enum-owner');
      const outsider = await fx.seedFixture('plays-enum-outsider');

      const ownerApp = createContractApp({
        organizationId: owner.orgId,
        userId: owner.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const outsiderApp = createContractApp({
        organizationId: outsider.orgId,
        userId: outsider.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });

      // A real Play, entirely owned by `owner` — DRAFT status throughout is
      // fine: an outsider must be denied at the org-membership gate, before
      // any state-machine logic ever runs, regardless of the object's state.
      const definitionRes = await request(ownerApp)
        .post(`${BASE}/process-definitions`)
        .send({ name: `Enum probe play ${randomUUID()}` });
      expect(definitionRes.status).toBe(201);
      const definitionId = definitionRes.body.data.processDefinitionId as string;
      definitionIds.push(definitionId);

      const versionRes = await request(ownerApp)
        .post(`${BASE}/process-definitions/${definitionId}/versions`)
        .send({ semanticGraph: minimalGraph() });
      expect(versionRes.status).toBe(201);
      const versionId = versionRes.body.data.processVersionId as string;

      for (const probe of definitionRouteProbes) {
        await expectIndistinguishable404(
          outsiderApp,
          probe,
          definitionId,
          `procdef-does-not-exist-${randomUUID()}`
        );
      }

      for (const probe of versionRouteProbes) {
        await expectIndistinguishable404(outsiderApp, probe, versionId, `procver-does-not-exist-${randomUUID()}`);
      }

      // instantiate needs a body.caseId — supplied from the OUTSIDER's own
      // org so the comparison isolates the processVersionId dimension:
      // requireOwnOrgVersion must deny before requireCaseAccessForActor(caseId)
      // is ever reached, so which caseId is supplied cannot affect the result.
      const outsiderCase = await request(outsiderApp)
        .post(`${BASE}/cases`)
        .send({ projectId: outsider.projectId, contractedClosureType: 'DELIVERY_COMPLETED' });
      expect(outsiderCase.status).toBe(201);
      const outsiderCaseId = outsiderCase.body.data.caseId as string;

      const instantiateProbe: RouteProbe = {
        name: 'POST /process-versions/:id/instantiate',
        method: 'post',
        path: (id) => `${BASE}/process-versions/${id}/instantiate`,
        body: { caseId: outsiderCaseId },
      };
      await expectIndistinguishable404(
        outsiderApp,
        instantiateProbe,
        versionId,
        `procver-does-not-exist-${randomUUID()}`
      );

      // The tenant-scoped LIST is unaffected — confirms the leak (and the
      // fix) are confined to by-id reads, not the list surface.
      const list = await request(outsiderApp).get(`${BASE}/process-definitions`);
      expect(list.status).toBe(200);
      expect(
        list.body.data.map((d: { processDefinitionId: string }) => d.processDefinitionId)
      ).not.toContain(definitionId);
    } finally {
      await deleteDefinitions(definitionIds);
      await fx.teardown();
    }
  }, 60_000);

  // ===========================================================================
  // POSITIVE CONTROL — every route still fully works for its own tenant.
  // A gate that denies everyone (including its rightful owner) would pass
  // the enumeration-safety test above for the wrong reason.
  // ===========================================================================
  it('POSITIVE CONTROL: an actor still fully creates/reads/reviews/publishes/shares/instantiates/deprecates/archives their own real Play after the fix', async () => {
    const fx = new ContractFixtures(control);
    const definitionIds: string[] = [];
    try {
      const f = await fx.seedFixture('plays-enum-positive');
      const memberApp = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const adminApp = createContractApp({
        organizationId: f.orgId,
        userId: f.adminUserId,
        userRole: 'ADMIN',
        isSuperAdmin: false,
      });

      const definitionRes = await request(memberApp)
        .post(`${BASE}/process-definitions`)
        .send({ name: `Positive control play ${randomUUID()}` });
      expect(definitionRes.status).toBe(201);
      const definitionId = definitionRes.body.data.processDefinitionId as string;
      definitionIds.push(definitionId);

      const getDefinition = await request(memberApp).get(`${BASE}/process-definitions/${definitionId}`);
      expect(getDefinition.status).toBe(200);

      const publisherCheck = await request(memberApp).get(
        `${BASE}/process-definitions/${definitionId}/publisher-check`
      );
      expect(publisherCheck.status).toBe(200);
      expect(publisherCheck.body.data.authorized).toBe(false); // MEMBER, not OWNER/ADMIN

      const versionRes = await request(memberApp)
        .post(`${BASE}/process-definitions/${definitionId}/versions`)
        .send({ semanticGraph: minimalGraph() });
      expect(versionRes.status).toBe(201);
      const versionId = versionRes.body.data.processVersionId as string;

      const listVersions = await request(memberApp).get(`${BASE}/process-definitions/${definitionId}/versions`);
      expect(listVersions.status).toBe(200);
      expect(listVersions.body.data.map((v: { processVersionId: string }) => v.processVersionId)).toContain(
        versionId
      );

      const getVersion = await request(memberApp).get(`${BASE}/process-versions/${versionId}`);
      expect(getVersion.status).toBe(200);
      expect(getVersion.body.data.version).toBe(1);

      const updated = await request(memberApp)
        .put(`${BASE}/process-versions/${versionId}`)
        .send({ semanticGraph: minimalGraph(), expectedVersion: 1 });
      expect(updated.status).toBe(200);
      expect(updated.body.data.version).toBe(2);

      const proposed = await request(memberApp)
        .post(`${BASE}/process-versions/${versionId}/propose`)
        .send({ expectedVersion: 2 });
      expect(proposed.status).toBe(200);
      expect(proposed.body.data.status).toBe('IN_REVIEW');
      expect(proposed.body.data.version).toBe(3);

      const reviewed = await request(adminApp)
        .post(`${BASE}/process-versions/${versionId}/review`)
        .send({ decision: 'APPROVED', expectedVersion: 3 });
      expect(reviewed.status).toBe(200);
      expect(reviewed.body.data.reviewDecision).toBe('APPROVED');
      expect(reviewed.body.data.version).toBe(4);

      const published = await request(memberApp)
        .post(`${BASE}/process-versions/${versionId}/publish`)
        .send({ expectedVersion: 4 });
      expect(published.status).toBe(200);
      expect(published.body.data.status).toBe('PUBLISHED');
      expect(published.body.data.version).toBe(5);

      const shared = await request(adminApp)
        .post(`${BASE}/process-definitions/${definitionId}/share`)
        .send({ targetVisibility: 'TEAM', expectedVersion: 1 });
      expect(shared.status).toBe(200);
      expect(shared.body.data.visibility).toBe('TEAM');

      const ownCase = await request(memberApp)
        .post(`${BASE}/cases`)
        .send({ projectId: f.projectId, contractedClosureType: 'DELIVERY_COMPLETED' });
      expect(ownCase.status).toBe(201);
      const caseId = ownCase.body.data.caseId as string;

      const instantiated = await request(memberApp)
        .post(`${BASE}/process-versions/${versionId}/instantiate`)
        .send({ caseId });
      expect(instantiated.status).toBe(201);
      expect(instantiated.body.data.status).toBe('DRAFT');
      expect(instantiated.body.data.sourceProcessVersionId).toBe(versionId);

      const deprecated = await request(memberApp)
        .post(`${BASE}/process-versions/${versionId}/deprecate`)
        .send({ reason: 'positive control cleanup', expectedVersion: 5 });
      expect(deprecated.status).toBe(200);
      expect(deprecated.body.data.status).toBe('DEPRECATED');
      expect(deprecated.body.data.version).toBe(6);

      const archived = await request(memberApp)
        .post(`${BASE}/process-versions/${versionId}/archive`)
        .send({ expectedVersion: 6 });
      expect(archived.status).toBe(200);
      expect(archived.body.data.status).toBe('ARCHIVED');
    } finally {
      await deleteDefinitions(definitionIds);
      await fx.teardown();
    }
  }, 60_000);
});

/**
 * ===========================================================================
 * FOR OPUS — the ONE existing assertion this fix requires flipping
 * ===========================================================================
 * routes/caseWorkspace/__tests__/contract/errorAndAuthz.contract.pg.test.ts
 * pins the pre-fix behaviour as a *characterization* test named
 * `'KNOWN DEFECT CW-SEC-ENUM-PLAYS-01 — cross-tenant Plays leak existence
 * via 403-vs-404'`. That file is owned by a different stream and is NOT
 * touched by this packet. Once this fix (playService.ts's
 * getProcessDefinition/getProcessVersion) is merged, that test's own header
 * comment already names the exact target — flip these four lines in that
 * file (it says so itself, "Target once fixed: ..."):
 *
 *   // DEFECT: a REAL id in another tenant answers 403, which confirms it exists.
 *   // Target once fixed: expect(realDefinition.status).toBe(fakeDefinition.status);
 *   expect(realDefinition.status).toBe(403);
 *   expect(realDefinition.body.error.code).toBe('NOT_ORG_MEMBER');
 *   expect(realDefinition.status).not.toBe(fakeDefinition.status);
 *
 *   // DEFECT: same leak on process versions.
 *   // Target once fixed: expect(realVersion.status).toBe(fakeVersion.status);
 *   expect(realVersion.status).toBe(403);
 *   expect(realVersion.status).not.toBe(fakeVersion.status);
 *
 * become:
 *
 *   expect(realDefinition.status).toBe(fakeDefinition.status);
 *   expect(realDefinition.body.error.code).toBe(fakeDefinition.body.error.code);
 *   expect(realDefinition.status).not.toBe(403);
 *
 *   expect(realVersion.status).toBe(fakeVersion.status);
 *   expect(realVersion.status).not.toBe(403);
 *
 * and the test's own name should drop its "KNOWN DEFECT" prefix.
 *
 * A SECOND, pre-existing assertion elsewhere is affected the same way and
 * also needs flipping — it is NOT in this packet's allowlist either:
 * services/caseWorkspace/__tests__/security/playService.security.pg.test.ts,
 * describe block "(B) gap CLOSED by Stream A", test "GAP CLOSED:
 * instantiateProcessVersion now REJECTS an actor with ZERO standing in the
 * (matching) organization" (around line 324). It currently asserts:
 *
 *   await expect(
 *     playService.instantiateProcessVersion(versionId, caseId, { actorUserId: attackerUserId })
 *   ).rejects.toMatchObject({ code: 'not_org_member' });
 *
 * After this fix, instantiateProcessVersion's first checkpoint
 * (`getProcessVersion(id, actorUserId)`) returns `null` instead of throwing
 * `CaseWorkspaceAuthError`, so `instantiateProcessVersion` now throws a
 * plain `Error('process_version_not_found')` — correct per SEC-009 (an
 * attacker with zero standing anywhere must see the same "not found" a
 * nonexistent versionId produces, not a distinguishable 'not_org_member'
 * code). That assertion should become:
 *
 *   await expect(
 *     playService.instantiateProcessVersion(versionId, caseId, { actorUserId: attackerUserId })
 *   ).rejects.toThrow('process_version_not_found');
 *
 * (and its surrounding comment, which currently narrates the pre-fix
 * 'not_org_member' code, updated to match). No other assertion in that file
 * references playService.getProcessDefinition/getProcessVersion's thrown
 * shape.
 */
