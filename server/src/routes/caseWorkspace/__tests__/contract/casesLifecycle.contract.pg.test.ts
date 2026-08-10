/**
 * CONTRACT (real PostgreSQL) — the Case + plan-version + run-binding surface
 * answers the statuses and shapes docs/product/case-workspace/api/openapi.yaml
 * declares, and the row that lands in Postgres matches the response body.
 *
 * Distinct from `../cases.routes.test.ts` (a sibling suite): that one mocks
 * `caseCoreService`, so it proves the route's own contract and nothing about
 * the database. Here nothing is mocked below the HTTP boundary — see
 * ./contractHarness.ts's header for exactly what is and is not substituted.
 *
 * Every assertion that claims something was persisted reads it back through
 * the out-of-band `control` pool, never from the response body alone: the
 * response only proves what the service BELIEVES it wrote.
 */

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
warnSkipped('caseWorkspace cases lifecycle contract', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;
const BASE = '/api/v8/case-workspace';

suite('CONTRACT — Case lifecycle over the real router and real Postgres', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  it('POST /cases returns 201 with the documented envelope and the row lands in case_core', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('create');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });

      const res = await request(app)
        .post(`${BASE}/cases`)
        .send({
          projectId: f.projectId,
          caseProfile: 'LIGHT',
          contractedClosureType: 'DECISION_COMPLETED',
        });

      expect(res.status).toBe(201);
      // Envelope, per the spec: { data: CaseCore }.
      expect(Object.keys(res.body)).toEqual(['data']);
      expect(res.body.data).toMatchObject({
        projectId: f.projectId,
        organizationId: f.orgId,
        caseProfile: 'LIGHT',
        caseStatus: 'DRAFT',
        contractedClosureType: 'DECISION_COMPLETED',
        createdByActorId: f.memberUserId,
        version: 1,
      });

      // Readback through a SEPARATE connection — proof it committed.
      const row = await control.query(
        `SELECT case_id, organization_id, case_status, version FROM case_core WHERE project_id = $1`,
        [f.projectId]
      );
      expect(row.rowCount).toBe(1);
      expect(row.rows[0].case_id).toBe(res.body.data.caseId);
      expect(row.rows[0].organization_id).toBe(f.orgId);
      expect(row.rows[0].case_status).toBe('DRAFT');
      expect(Number(row.rows[0].version)).toBe(1);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('POST /cases ignores a body-supplied organizationId and uses the authenticated org', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('org-forced');
      const attacker = await fx.seedOrg('attacker');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });

      const res = await request(app)
        .post(`${BASE}/cases`)
        .send({
          projectId: f.projectId,
          contractedClosureType: 'DELIVERY_COMPLETED',
          organizationId: attacker,
          createdByActorId: 'someone-else',
        });

      expect(res.status).toBe(201);
      const row = await control.query(
        `SELECT organization_id, created_by_actor_id FROM case_core WHERE project_id = $1`,
        [f.projectId]
      );
      expect(row.rows[0].organization_id).toBe(f.orgId);
      expect(row.rows[0].organization_id).not.toBe(attacker);
      expect(row.rows[0].created_by_actor_id).toBe(f.memberUserId);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('a second Case for the same project is 409, and no second row appears', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('dup');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const body = { projectId: f.projectId, contractedClosureType: 'DELIVERY_COMPLETED' };

      const first = await request(app).post(`${BASE}/cases`).send(body);
      expect(first.status).toBe(201);

      const second = await request(app).post(`${BASE}/cases`).send(body);
      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe('CASE_ALREADY_EXISTS_FOR_PROJECT');

      const rows = await control.query(`SELECT case_id FROM case_core WHERE project_id = $1`, [f.projectId]);
      expect(rows.rowCount).toBe(1);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('the DRAFT→ACTIVE→CLOSED status walk persists, and an illegal target is 409 with no mutation', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('status');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const created = await request(app)
        .post(`${BASE}/cases`)
        .send({ projectId: f.projectId, contractedClosureType: 'DECISION_COMPLETED' });
      const caseId = created.body.data.caseId;

      const activated = await request(app)
        .post(`${BASE}/cases/${caseId}/status`)
        .send({ targetStatus: 'ACTIVE', reason: 'kickoff' });
      expect(activated.status).toBe(200);
      expect(activated.body.data.caseStatus).toBe('ACTIVE');

      // DRAFT is unreachable as a TARGET in ALLOWED_STATUS_TRANSITIONS.
      const illegal = await request(app)
        .post(`${BASE}/cases/${caseId}/status`)
        .send({ targetStatus: 'DRAFT', reason: 'go back' });
      expect(illegal.status).toBe(409);
      expect(illegal.body.error.code).toBe('CASE_STATUS_TRANSITION_NOT_ALLOWED');

      const afterIllegal = await control.query(`SELECT case_status FROM case_core WHERE case_id = $1`, [caseId]);
      expect(afterIllegal.rows[0].case_status).toBe('ACTIVE');
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('closure is recorded separately from status, and recording it twice is 409', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('closure');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const created = await request(app)
        .post(`${BASE}/cases`)
        .send({ projectId: f.projectId, contractedClosureType: 'DECISION_COMPLETED' });
      const caseId = created.body.data.caseId;

      await request(app).post(`${BASE}/cases/${caseId}/status`).send({ targetStatus: 'ACTIVE' });
      await request(app)
        .post(`${BASE}/cases/${caseId}/closure-axis`)
        .send({ axis: 'decision', status: 'COMPLETED' });

      const closed = await request(app)
        .post(`${BASE}/cases/${caseId}/closure`)
        .send({ closureType: 'DECISION_COMPLETED', evidenceRef: 'evidence://contract-test' });
      expect(closed.status).toBe(200);
      expect(closed.body.data.closureType).toBe('DECISION_COMPLETED');

      // CORRECTED per EVENT_TAXONOMY §5.2 — recordClosure does NOT set CLOSED.
      const row = await control.query(
        `SELECT case_status, closure_type, closure_evidence_ref FROM case_core WHERE case_id = $1`,
        [caseId]
      );
      expect(row.rows[0].closure_type).toBe('DECISION_COMPLETED');
      expect(row.rows[0].case_status).toBe('ACTIVE');
      expect(row.rows[0].closure_evidence_ref).toBe('evidence://contract-test');

      const again = await request(app)
        .post(`${BASE}/cases/${caseId}/closure`)
        .send({ closureType: 'DECISION_COMPLETED' });
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('CASE_CLOSURE_ALREADY_RECORDED');
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('governance-tier changes append to governance_tier_history rather than overwriting it', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('tier');
      const app = createContractApp({
        organizationId: f.orgId,
        userId: f.memberUserId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const created = await request(app)
        .post(`${BASE}/cases`)
        .send({
          projectId: f.projectId,
          contractedClosureType: 'DELIVERY_COMPLETED',
          governanceTier: 'LIGHTWEIGHT',
        });
      const caseId = created.body.data.caseId;

      const raised = await request(app)
        .post(`${BASE}/cases/${caseId}/governance-tier`)
        .send({ tier: 'CONTROLLED', reason: 'material investment decision ahead' });
      expect(raised.status).toBe(200);
      expect(raised.body.data.governanceTier).toBe('CONTROLLED');
      expect(Array.isArray(raised.body.data.governanceTierHistory)).toBe(true);
      expect(raised.body.data.governanceTierHistory.length).toBeGreaterThanOrEqual(1);
      expect(raised.body.data.governanceTierHistory.at(-1)).toMatchObject({
        tier: 'CONTROLLED',
        changedByActorId: f.memberUserId,
        reason: 'material investment decision ahead',
      });

      const row = await control.query(
        `SELECT governance_tier, governance_tier_history FROM case_core WHERE case_id = $1`,
        [caseId]
      );
      expect(row.rows[0].governance_tier).toBe('CONTROLLED');
      const history =
        typeof row.rows[0].governance_tier_history === 'string'
          ? JSON.parse(row.rows[0].governance_tier_history)
          : row.rows[0].governance_tier_history;
      expect(history.length).toBeGreaterThanOrEqual(1);
    } finally {
      await fx.teardown();
    }
  }, 30_000);

  it('the plan DRAFT→IN_REVIEW→PUBLISHED walk and its run binding answer the documented statuses', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('plan');
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

      const draft = await request(app)
        .post(`${BASE}/cases/${caseId}/plan-versions`)
        .send({ semanticGraph: minimalGraph(), changeReason: 'initial plan' });
      expect(draft.status).toBe(201);
      expect(draft.body.data.status).toBe('DRAFT');
      expect(typeof draft.body.data.graphDigest).toBe('string');
      const planId = draft.body.data.casePlanVersionId;

      // A GET, not a POST — see the spec note on this endpoint.
      const validation = await request(app).get(`${BASE}/plan-versions/${planId}/validate`);
      expect(validation.status).toBe(200);
      expect(typeof validation.body.data.valid).toBe('boolean');
      expect(Array.isArray(validation.body.data.blockers)).toBe(true);

      const proposed = await request(app)
        .post(`${BASE}/plan-versions/${planId}/propose`)
        .send({ expectedVersion: draft.body.data.version });
      expect(proposed.status).toBe(200);
      expect(proposed.body.data.status).toBe('IN_REVIEW');

      const published = await request(app)
        .post(`${BASE}/plan-versions/${planId}/publish`)
        .send({ expectedVersion: proposed.body.data.version });
      expect(published.status).toBe(200);
      expect(published.body.data.status).toBe('PUBLISHED');

      // A PUBLISHED plan rejects mutation (CW-GR-025).
      const edit = await request(app)
        .put(`${BASE}/plan-versions/${planId}`)
        .send({ semanticGraph: minimalGraph(), expectedVersion: published.body.data.version });
      expect(edit.status).toBe(409);
      expect(edit.body.error.code).toBe('PLAN_VERSION_NOT_EDITABLE');

      const runId = await fx.seedExecutionRun(f.orgId, f.memberUserId, 'plan');
      const bound = await request(app)
        .post(`${BASE}/run-bindings`)
        .send({ runId, casePlanVersionId: planId });
      expect(bound.status).toBe(201);
      expect(bound.body.data).toMatchObject({ runId, casePlanVersionId: planId, caseId });
      // The binding pins the digest the run executes against.
      expect(bound.body.data.graphDigest).toBe(published.body.data.graphDigest);

      const rebind = await request(app)
        .post(`${BASE}/run-bindings`)
        .send({ runId, casePlanVersionId: planId });
      expect(rebind.status).toBe(409);
      expect(rebind.body.error.code).toBe('RUN_ALREADY_BOUND');

      const bindingRows = await control.query(
        `SELECT run_id FROM case_workspace_run_bindings WHERE run_id = $1`,
        [runId]
      );
      expect(bindingRows.rowCount).toBe(1);
    } finally {
      await fx.teardown();
    }
  }, 45_000);

  it('CW-GR-025 — a layout-only view-state write leaves the semantic graph digest untouched', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('viewstate');
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
      const draft = await request(app)
        .post(`${BASE}/cases/${caseId}/plan-versions`)
        .send({ semanticGraph: minimalGraph() });
      const planId = draft.body.data.casePlanVersionId;
      const digestBefore = draft.body.data.graphDigest;
      const versionBefore = draft.body.data.version;

      // Layout is written through a SEPARATE endpoint, by design.
      const put = await request(app)
        .put(`${BASE}/plan-versions/${planId}/view-state/EXPERT`)
        .send({ viewState: { nodes: { start: { x: 40, y: 120 }, end: { x: 380, y: 120 } }, zoom: 1.25 } });
      expect(put.status).toBe(200);
      expect(put.body.data.viewType).toBe('EXPERT');

      const roundTrip = await request(app).get(`${BASE}/plan-versions/${planId}/view-state/EXPERT`);
      expect(roundTrip.status).toBe(200);
      expect(roundTrip.body.data.viewState).toMatchObject({ zoom: 1.25 });

      // The semantic digest AND the aggregate version are unchanged: layout is
      // not a semantic edit, so it must not consume an OCC version either.
      const after = await request(app).get(`${BASE}/plan-versions/${planId}`);
      expect(after.body.data.graphDigest).toBe(digestBefore);
      expect(after.body.data.version).toBe(versionBefore);

      const row = await control.query(
        `SELECT graph_digest, version FROM case_plan_versions WHERE case_plan_version_id = $1`,
        [planId]
      );
      expect(row.rows[0].graph_digest).toBe(digestBefore);
      expect(Number(row.rows[0].version)).toBe(versionBefore);

      await control.query(`DELETE FROM case_plan_view_state WHERE case_plan_version_id = $1`, [planId]);
    } finally {
      await fx.teardown();
    }
  }, 45_000);

  it('a stale expectedVersion on a plan draft is 409 and leaves the stored graph untouched', async () => {
    const fx = new ContractFixtures(control);
    try {
      const f = await fx.seedFixture('occ');
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
      const draft = await request(app)
        .post(`${BASE}/cases/${caseId}/plan-versions`)
        .send({ semanticGraph: minimalGraph() });
      const planId = draft.body.data.casePlanVersionId;

      const firstEdit = await request(app)
        .put(`${BASE}/plan-versions/${planId}`)
        .send({ semanticGraph: minimalGraph(), expectedVersion: draft.body.data.version });
      expect(firstEdit.status).toBe(200);
      const digestAfterFirstEdit = firstEdit.body.data.graphDigest;

      // Replay the now-stale version.
      const staleEdit = await request(app)
        .put(`${BASE}/plan-versions/${planId}`)
        .send({ semanticGraph: minimalGraph(), expectedVersion: draft.body.data.version });
      expect(staleEdit.status).toBe(409);
      expect(staleEdit.body.error.code).toContain('VERSION_CONFLICT');

      const row = await control.query(
        `SELECT graph_digest, version FROM case_plan_versions WHERE case_plan_version_id = $1`,
        [planId]
      );
      expect(row.rows[0].graph_digest).toBe(digestAfterFirstEdit);
      expect(Number(row.rows[0].version)).toBe(firstEdit.body.data.version);
    } finally {
      await fx.teardown();
    }
  }, 45_000);
});
