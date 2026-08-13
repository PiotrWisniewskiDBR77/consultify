/**
 * Case Workspace — Deliverable Open/Return, CW-P09 packet B5, over the REAL
 * HTTP routes, the REAL domain services and a REAL PostgreSQL.
 *
 * ===========================================================================
 * WHAT GAP THIS CLOSES
 * ===========================================================================
 * SCOPE_ADJUDICATION.md, Golden Case list item 12 ("Deliverable opened in
 * source module, back to Case"), reported literally PARTIAL:
 *
 *   "'opening it in the module' and 'returning to the Case' are client-side
 *   routing actions with no corresponding case-workspace API call in this
 *   packet's surface — no backend test can observe a page navigation."
 *
 * This suite proves the backend half that packet was missing:
 * `GET /artifact-links/:linkId/open` (artifactLinkService.resolveArtifactLinkOpen)
 * now gives the client (a) a canonical, stable deep-link target
 * (artifactType/artifactId/artifactRevision — CW-RT-024's own stated
 * minimum) and (b) a return context (caseId/casePhase/resultsGroup/linkId/
 * relation — doc 03 §5's "same Case phase and selected step") in ONE real
 * HTTP round trip, for every explicit state a link can be in.
 *
 * What this suite does NOT and cannot prove — stated here rather than
 * glossed over, exactly like goldenCaseDirectModuleLateBinding.pg.test.ts's
 * own header — is the actual client-side page navigation into the owning
 * module's UI and back. That remains a UI-layer concern for whoever owns
 * B3's client surface; this packet gives it something real to call.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test \
 *   npx vitest run \
 *   src/services/caseWorkspace/__tests__/integration/deliverableOpenReturn.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * ISOLATION
 * ===========================================================================
 * Every test seeds its own organization/project/case/actor(s) via
 * `ContractFixtures` and tears them down in a `finally`.
 * `case_workspace_artifact_links` FKs into `case_core` with no cascade, so
 * every test deletes its own artifact-link rows BEFORE calling
 * `fx.teardown()` — the same pattern
 * `goldenCaseDirectModuleLateBinding.pg.test.ts` uses, required because
 * `ContractFixtures.teardown()` does not know about this table.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BASE,
  CONNECTION_STRING,
  createGoldenCaseApp,
  GoldenCaseFixtures as ContractFixtures,
  isGoldenCaseDbReachable,
  warnSkipped,
} from '../goldenCases/goldenCaseHarness.js';

const REACHABLE = await isGoldenCaseDbReachable();
warnSkipped('Deliverable Open/Return (CW-P09 packet B5)', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('Deliverable Open/Return — GET /artifact-links/:linkId/open, real HTTP + real Postgres', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  /** Deletes this test's own artifact-link rows, then the rest of the fixture. */
  async function teardown(fx: ContractFixtures, caseId: string): Promise<void> {
    await control.query(`DELETE FROM case_workspace_artifact_links WHERE case_id = $1`, [caseId]).catch(() => undefined);
    await fx.teardown();
  }

  it('a live ACTIVE, non-stale deliverable resolves to a stable AVAILABLE deep link, and the return context restores Case/phase/step', async () => {
    const fx = new ContractFixtures(control);
    const correlationId = `open-return-available-${randomUUID()}`;
    let caseId = '';
    try {
      const orgId = await fx.seedOrg('open-return-available');
      const projectId = await fx.seedProject(orgId, 'open-return-available');
      const consultantId = await fx.seedUser(orgId, 'open-return-available-consultant');
      await fx.seedMembership(orgId, consultantId, 'MEMBER');

      const app = createGoldenCaseApp({
        organizationId: orgId,
        userId: consultantId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const as = (m: 'post' | 'get' | 'delete', url: string) =>
        request(app)[m](url).set('X-Correlation-ID', correlationId);

      const created = await as('post', `${BASE}/cases`).send({
        projectId,
        caseProfile: 'STANDARD',
        contractedClosureType: 'DELIVERY_COMPLETED',
      });
      expect(created.status).toBe(201);
      caseId = created.body.data.caseId;
      // Move the Case out of DRAFT so casePhase in the return context proves
      // it is read live from case_core, not hardcoded to the creation default.
      const activated = await as('post', `${BASE}/cases/${caseId}/status`).send({ targetStatus: 'ACTIVE' });
      expect(activated.status).toBe(200);
      expect(activated.body.data.caseStatus).toBe('ACTIVE');

      const moduleArtifactId = `presentation-${randomUUID()}`;
      const linked = await as('post', `${BASE}/cases/${caseId}/artifact-links`).send({
        artifactType: 'presentation',
        artifactId: moduleArtifactId,
        artifactRevision: 'rev-1',
        relation: 'DELIVERABLE',
      });
      expect(linked.status).toBe(201);
      const linkId: string = linked.body.data.linkId;

      const opened = await as('get', `${BASE}/artifact-links/${linkId}/open`);
      expect(opened.status).toBe(200);
      expect(opened.body.data).toMatchObject({
        linkId,
        caseId,
        relation: 'DELIVERABLE',
        state: 'AVAILABLE',
        isStale: false,
        deepLink: {
          artifactType: 'presentation',
          artifactId: moduleArtifactId,
          artifactRevision: 'rev-1',
        },
        returnContext: {
          caseId,
          casePhase: 'ACTIVE',
          resultsGroup: 'NATIVE_DELIVERABLES',
          linkId,
          relation: 'DELIVERABLE',
        },
      });
      expect(typeof opened.body.data.resolvedAt).toBe('string');

      // Calling it again is stable — the SAME deep-link target and return
      // context come back, proving this is a canonical read, not a
      // one-shot/consuming resolution.
      const openedAgain = await as('get', `${BASE}/artifact-links/${linkId}/open`);
      expect(openedAgain.status).toBe(200);
      expect(openedAgain.body.data.deepLink).toEqual(opened.body.data.deepLink);
      expect(openedAgain.body.data.returnContext).toEqual(opened.body.data.returnContext);
    } finally {
      await teardown(fx, caseId);
    }
  }, 60_000);

  it('a source the module confirmed gone resolves to an explicit UNAVAILABLE state (never a 500), preserving provenance', async () => {
    const fx = new ContractFixtures(control);
    const correlationId = `open-return-unavailable-${randomUUID()}`;
    let caseId = '';
    try {
      const orgId = await fx.seedOrg('open-return-unavailable');
      const projectId = await fx.seedProject(orgId, 'open-return-unavailable');
      const consultantId = await fx.seedUser(orgId, 'open-return-unavailable-consultant');
      await fx.seedMembership(orgId, consultantId, 'MEMBER');

      const app = createGoldenCaseApp({
        organizationId: orgId,
        userId: consultantId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const as = (m: 'post' | 'get' | 'delete', url: string) =>
        request(app)[m](url).set('X-Correlation-ID', correlationId);

      const created = await as('post', `${BASE}/cases`).send({
        projectId,
        caseProfile: 'STANDARD',
        contractedClosureType: 'DELIVERY_COMPLETED',
      });
      expect(created.status).toBe(201);
      caseId = created.body.data.caseId;

      const linked = await as('post', `${BASE}/cases/${caseId}/artifact-links`).send({
        artifactType: 'document',
        artifactId: `document-${randomUUID()}`,
        relation: 'EVIDENCE',
      });
      expect(linked.status).toBe(201);
      const linkId: string = linked.body.data.linkId;

      const markedUnavailable = await as('post', `${BASE}/artifact-links/${linkId}/mark-unavailable`).send({
        reason: 'source document permanently deleted in Documents module',
      });
      expect(markedUnavailable.status).toBe(200);
      expect(markedUnavailable.body.data.linkStatus).toBe('UNAVAILABLE');

      const opened = await as('get', `${BASE}/artifact-links/${linkId}/open`);
      // Explicit, honest state — never a 500 for a source that is gone.
      expect(opened.status).toBe(200);
      expect(opened.body.data.state).toBe('UNAVAILABLE');
      expect(opened.body.data.deepLink).toBeNull();
      expect(opened.body.data.unavailableReason).toBe('source document permanently deleted in Documents module');
      expect(opened.body.data.unavailableMarkedAt).not.toBeNull();
      // Provenance is preserved (CW-03-017) — the return context still
      // resolves, so the UI can still show WHERE this used to live.
      expect(opened.body.data.returnContext).toMatchObject({
        caseId,
        linkId,
        relation: 'EVIDENCE',
        resultsGroup: 'EVIDENCE_AND_LINEAGE',
      });
    } finally {
      if (caseId) {
        await control.query(`DELETE FROM case_workspace_artifact_links WHERE case_id = $1`, [caseId]).catch(() => undefined);
      }
      await fx.teardown();
    }
  }, 60_000);

  it('an unlinked (Case-side removed) reference resolves to an explicit DELETED state, never a 500 and never the raw ACTIVE data', async () => {
    const fx = new ContractFixtures(control);
    const correlationId = `open-return-deleted-${randomUUID()}`;
    let caseId = '';
    try {
      const orgId = await fx.seedOrg('open-return-deleted');
      const projectId = await fx.seedProject(orgId, 'open-return-deleted');
      const consultantId = await fx.seedUser(orgId, 'open-return-deleted-consultant');
      await fx.seedMembership(orgId, consultantId, 'MEMBER');

      const app = createGoldenCaseApp({
        organizationId: orgId,
        userId: consultantId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const as = (m: 'post' | 'get' | 'delete', url: string) =>
        request(app)[m](url).set('X-Correlation-ID', correlationId);

      const created = await as('post', `${BASE}/cases`).send({
        projectId,
        caseProfile: 'STANDARD',
        contractedClosureType: 'DELIVERY_COMPLETED',
      });
      expect(created.status).toBe(201);
      caseId = created.body.data.caseId;

      const linked = await as('post', `${BASE}/cases/${caseId}/artifact-links`).send({
        artifactType: 'initiative',
        artifactId: `initiative-${randomUUID()}`,
        relation: 'OUTPUT',
      });
      expect(linked.status).toBe(201);
      const linkId: string = linked.body.data.linkId;

      const unlinked = await as('delete', `${BASE}/artifact-links/${linkId}`).send({
        reason: 'superseded by a later initiative',
      });
      expect(unlinked.status).toBe(200);
      expect(unlinked.body.data.linkStatus).toBe('UNLINKED');

      const opened = await as('get', `${BASE}/artifact-links/${linkId}/open`);
      expect(opened.status).toBe(200);
      expect(opened.body.data.state).toBe('DELETED');
      expect(opened.body.data.deepLink).toBeNull();
      expect(opened.body.data.unlinkReason).toBe('superseded by a later initiative');
      expect(opened.body.data.unlinkedAt).not.toBeNull();
      expect(opened.body.data.returnContext.resultsGroup).toBe('KEY_FINDINGS_AND_RECOMMENDATIONS');
    } finally {
      if (caseId) {
        await control.query(`DELETE FROM case_workspace_artifact_links WHERE case_id = $1`, [caseId]).catch(() => undefined);
      }
      await fx.teardown();
    }
  }, 60_000);

  it('a link whose pinned revision fell behind resolves to an explicit STALE state, with deepLink still populated so a still-valid pointer stays openable', async () => {
    const fx = new ContractFixtures(control);
    const correlationId = `open-return-stale-${randomUUID()}`;
    let caseId = '';
    try {
      const orgId = await fx.seedOrg('open-return-stale');
      const projectId = await fx.seedProject(orgId, 'open-return-stale');
      const consultantId = await fx.seedUser(orgId, 'open-return-stale-consultant');
      await fx.seedMembership(orgId, consultantId, 'MEMBER');

      const app = createGoldenCaseApp({
        organizationId: orgId,
        userId: consultantId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const as = (m: 'post' | 'get' | 'delete', url: string) =>
        request(app)[m](url).set('X-Correlation-ID', correlationId);

      const created = await as('post', `${BASE}/cases`).send({
        projectId,
        caseProfile: 'STANDARD',
        contractedClosureType: 'DELIVERY_COMPLETED',
      });
      expect(created.status).toBe(201);
      caseId = created.body.data.caseId;

      const linked = await as('post', `${BASE}/cases/${caseId}/artifact-links`).send({
        artifactType: 'kpi',
        artifactId: `kpi-${randomUUID()}`,
        artifactRevision: 'rev-1',
        relation: 'OUTCOME_MEASUREMENT',
      });
      expect(linked.status).toBe(201);
      const linkId: string = linked.body.data.linkId;

      const staled = await as('post', `${BASE}/artifact-links/${linkId}/mark-stale`).send({
        reason: 'upstream KPI value recomputed after month close',
      });
      expect(staled.status).toBe(200);
      expect(staled.body.data.isStale).toBe(true);

      const opened = await as('get', `${BASE}/artifact-links/${linkId}/open`);
      expect(opened.status).toBe(200);
      expect(opened.body.data.state).toBe('STALE');
      expect(opened.body.data.isStale).toBe(true);
      expect(opened.body.data.staleReason).toBe('upstream KPI value recomputed after month close');
      expect(opened.body.data.staleMarkedAt).not.toBeNull();
      // Distinct from UNAVAILABLE/DELETED: the pointer is behind, not gone —
      // the deep link is still the real, still-navigable pinned target.
      expect(opened.body.data.deepLink).toEqual({
        artifactType: 'kpi',
        artifactId: linked.body.data.artifactId,
        artifactRevision: 'rev-1',
      });
      expect(opened.body.data.returnContext.resultsGroup).toBe('EFFECT_AND_VALUE');

      // Re-pinning resolves staleness (CW-01-026-INV9) — the SAME endpoint
      // now reports AVAILABLE for the identical linkId, proving `state` is
      // read live, not cached from the first resolution.
      const rePinned = await as('post', `${BASE}/artifact-links/${linkId}/pin`).send({
        revision: 'rev-2',
        reason: 'refreshed after month close',
      });
      expect(rePinned.status).toBe(200);

      const openedAfterRepin = await as('get', `${BASE}/artifact-links/${linkId}/open`);
      expect(openedAfterRepin.body.data.state).toBe('AVAILABLE');
      expect(openedAfterRepin.body.data.deepLink?.artifactRevision).toBe('rev-2');
    } finally {
      if (caseId) {
        await control.query(`DELETE FROM case_workspace_artifact_links WHERE case_id = $1`, [caseId]).catch(() => undefined);
      }
      await fx.teardown();
    }
  }, 60_000);

  it('a cross-tenant linkId is INDISTINGUISHABLE from a nonexistent one — same 404 status, same error code, no leaked existence (SEC-009)', async () => {
    const fx = new ContractFixtures(control);
    const correlationId = `open-return-tenancy-${randomUUID()}`;
    let ownerCaseId = '';
    try {
      // Tenant A: creates and owns the link.
      const ownerOrgId = await fx.seedOrg('open-return-tenancy-owner');
      const ownerProjectId = await fx.seedProject(ownerOrgId, 'open-return-tenancy-owner');
      const ownerUserId = await fx.seedUser(ownerOrgId, 'open-return-tenancy-owner');
      await fx.seedMembership(ownerOrgId, ownerUserId, 'MEMBER');

      const ownerApp = createGoldenCaseApp({
        organizationId: ownerOrgId,
        userId: ownerUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const asOwner = (m: 'post' | 'get' | 'delete', url: string) =>
        request(ownerApp)[m](url).set('X-Correlation-ID', correlationId);

      const created = await asOwner('post', `${BASE}/cases`).send({
        projectId: ownerProjectId,
        caseProfile: 'STANDARD',
        contractedClosureType: 'DELIVERY_COMPLETED',
      });
      expect(created.status).toBe(201);
      ownerCaseId = created.body.data.caseId;

      const linked = await asOwner('post', `${BASE}/cases/${ownerCaseId}/artifact-links`).send({
        artifactType: 'decision',
        artifactId: `decision-${randomUUID()}`,
        relation: 'DECISION_BASIS',
      });
      expect(linked.status).toBe(201);
      const linkId: string = linked.body.data.linkId;

      // Sanity: the owner CAN open it.
      const openedByOwner = await asOwner('get', `${BASE}/artifact-links/${linkId}/open`);
      expect(openedByOwner.status).toBe(200);
      expect(openedByOwner.body.data.state).toBe('AVAILABLE');

      // Tenant B: a completely different organization/member, no relation
      // whatsoever to the owner's Case.
      const strangerOrgId = await fx.seedOrg('open-return-tenancy-stranger');
      const strangerUserId = await fx.seedUser(strangerOrgId, 'open-return-tenancy-stranger');
      await fx.seedMembership(strangerOrgId, strangerUserId, 'MEMBER');

      const strangerApp = createGoldenCaseApp({
        organizationId: strangerOrgId,
        userId: strangerUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const asStranger = (m: 'post' | 'get' | 'delete', url: string) =>
        request(strangerApp)[m](url).set('X-Correlation-ID', correlationId);

      const crossTenantAttempt = await asStranger('get', `${BASE}/artifact-links/${linkId}/open`);
      const nonexistentAttempt = await asStranger('get', `${BASE}/artifact-links/cwlink-${randomUUID()}/open`);

      // Both fail identically — same HTTP status AND same error code — so a
      // stranger cannot learn "this link exists but I can't see it" from
      // status/body alone.
      expect(crossTenantAttempt.status).toBe(404);
      expect(nonexistentAttempt.status).toBe(404);
      expect(crossTenantAttempt.body?.error?.code ?? crossTenantAttempt.body?.code).toBe(
        nonexistentAttempt.body?.error?.code ?? nonexistentAttempt.body?.code
      );
      // Neither response body contains the real caseId, artifactId or any
      // other fact that would confirm the cross-tenant link's existence.
      const crossTenantBodyText = JSON.stringify(crossTenantAttempt.body);
      expect(crossTenantBodyText).not.toContain(ownerCaseId);
      expect(crossTenantBodyText).not.toContain(linkId);
    } finally {
      if (ownerCaseId) {
        await control
          .query(`DELETE FROM case_workspace_artifact_links WHERE case_id = $1`, [ownerCaseId])
          .catch(() => undefined);
      }
      await fx.teardown();
    }
  }, 60_000);
});
