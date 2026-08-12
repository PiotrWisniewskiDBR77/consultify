/**
 * P0 fix regression suite — `POST /api/v8/finance-v2/models/:modelId/approve`
 * role gate (`docs/validation/finance-v3/generated/gate-e/P0_APPROVE_RBAC_FIX_report.md`).
 *
 * Before this fix, `approveVersion()` declared `params.role: FinanceRole` and
 * never read it, and `models.routes.ts` never gated the route either — ANY
 * authenticated org member (including `viewer`) could approve an `IN_REVIEW`
 * version. This file is the permanent regression guard for that defect, plus
 * the generalized "capability says X, endpoint must agree" consistency check
 * the fix report asked for (this class of bug — a real gate missing behind a
 * correct `/capabilities` hint — could exist for any other lifecycle action,
 * not just approve).
 *
 * Real HTTP (`express` + `supertest`) against the real `financeV2Router`,
 * real PostgreSQL, and independent verification via a SEPARATE `pg.Client`
 * connection (own TCP socket, never the app's `PostgresDatabase` pool) — a
 * 403 response body is not proof of anything by itself; the row must
 * actually be unchanged.
 *
 * Same four-variable env-gate contract as this repo's other `.pg.test.ts`
 * suites (`RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=...`).
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('Finance v2 P0 fix — approve role gate + capability/endpoint consistency (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
  let verifyClient: Client;

  const orgId = `org-approve-rbac-${randomUUID()}`;

  const preparerId = `user-preparer-${randomUUID()}`;
  const approverId = `user-approver-${randomUUID()}`;
  const financeAdminId = `user-fa-${randomUUID()}`;
  const viewerId = `user-viewer-${randomUUID()}`;

  let appPreparer: express.Express;
  let appApprover: express.Express;
  let appFinanceAdmin: express.Express;
  let appViewer: express.Express;
  /** A SECOND preparer identity, kept separate from `appPreparer` so the capability-sweep tests below never accidentally also exercise the self-approval SoD gate or collide with `driveToInReview`'s own submitter. */
  let appPreparer2: express.Express;

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../../../../services/finance/canonical/artifactVersionService.js');
    const financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'Approve RBAC Gate Test Org'])
    );

    function buildApp(userId: string, orgRole: string) {
      const a = express();
      a.use(express.json());
      a.use((req: any, _res, next) => {
        req.user = { id: userId, organizationId: orgId, role: orgRole };
        req.v8Context = { organizationId: orgId, userId, userRole: orgRole };
        next();
      });
      a.use('/api/v8/finance-v2', financeV2Router);
      a.use((err: any, _req: any, res: any, _next: any) => {
        res.status(500).json({ error: String(err?.message || err), stack: err?.stack });
      });
      return a;
    }

    appPreparer = buildApp(preparerId, 'editor');
    appApprover = buildApp(approverId, 'owner');
    appFinanceAdmin = buildApp(financeAdminId, 'finance_admin');
    appViewer = buildApp(viewerId, 'member');
    appPreparer2 = buildApp(`user-preparer2-${randomUUID()}`, 'editor');

    verifyClient = new Client({ connectionString: CONNECTION_STRING, statement_timeout: 15000, query_timeout: 15000 });
    await verifyClient.connect();
  });

  afterAll(async () => {
    await verifyClient.end();
    await withPinnedPostgresTransaction((tx) => tx.queryRun(`DELETE FROM compute_jobs WHERE organization_id = ?`, [orgId]));
  });

  async function verifyIndependently(businessVersionId: string): Promise<any> {
    const r = await verifyClient.query(`SELECT * FROM finance_business_versions WHERE business_version_id = $1`, [businessVersionId]);
    return r.rows[0] ?? null;
  }

  async function forceFreshnessCurrent(businessVersionId: string): Promise<void> {
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [businessVersionId])
    );
  }

  async function createArtifactViaHttp(app: express.Express, artifactType: string) {
    const res = await request(app)
      .post('/api/v8/finance-v2/artifacts')
      .send({ artifactType, naturalKey: `nk-approve-rbac-${randomUUID()}` });
    if (res.status !== 201) throw new Error(`createArtifactViaHttp failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.data as { artifactId: string; currentBusinessVersion: { businessVersionId: string; version: number; status: string } };
  }

  /** Drives a fresh artifact to IN_REVIEW with freshness=CURRENT, ready for an approve attempt. */
  async function driveToInReview(artifactType = 'HISTORICAL_ANALYSIS') {
    const created = await createArtifactViaHttp(appPreparer, artifactType);
    const artifactId = created.artifactId;
    const bvId = created.currentBusinessVersion.businessVersionId;
    let version = created.currentBusinessVersion.version;

    let r = await request(appPreparer)
      .post(`/api/v8/finance-v2/versions/${bvId}/transitions`)
      .send({ action: 'submit_for_review', expectedVersion: version });
    if (r.status !== 200) throw new Error(`submit_for_review failed: ${r.status} ${JSON.stringify(r.body)}`);
    version = r.body.data.version;

    r = await request(appApprover)
      .post(`/api/v8/finance-v2/versions/${bvId}/transitions`)
      .send({ action: 'start_review', expectedVersion: version });
    if (r.status !== 200) throw new Error(`start_review failed: ${r.status} ${JSON.stringify(r.body)}`);
    version = r.body.data.version;

    await forceFreshnessCurrent(bvId);
    return { artifactId, businessVersionId: bvId, version };
  }

  // ---------------------------------------------------------------------
  // 1. Regression matrix per role — viewer/preparer FORBIDDEN, approver/
  //    finance_admin ALLOWED. Every attempt independently confirmed by a
  //    separate pg.Client read (never trust the HTTP body alone).
  // ---------------------------------------------------------------------

  it('viewer cannot approve an IN_REVIEW version — 403 FORBIDDEN, row unchanged (independent SQL)', async () => {
    const st = await driveToInReview();
    const before = await verifyIndependently(st.businessVersionId);
    const res = await request(appViewer)
      .post(`/api/v8/finance-v2/models/${st.artifactId}/approve`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: st.version });
    const after = await verifyIndependently(st.businessVersionId);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(after.status).toBe('IN_REVIEW');
    expect(after.version).toBe(before.version);
    expect(after.approved_by).toBeNull();
    expect(after.approved_at).toBeNull();
  });

  it('preparer (not approver/finance_admin) cannot approve an IN_REVIEW version — 403 FORBIDDEN, row unchanged (independent SQL)', async () => {
    const st = await driveToInReview();
    const before = await verifyIndependently(st.businessVersionId);
    // appPreparer2 (a SECOND preparer identity, distinct from the one that
    // created/submitted this artifact via driveToInReview) so this is purely
    // a role check, not accidentally also exercising the self-approval SoD
    // gate.
    const res = await request(appPreparer2)
      .post(`/api/v8/finance-v2/models/${st.artifactId}/approve`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: st.version });
    const after = await verifyIndependently(st.businessVersionId);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(after.status).toBe('IN_REVIEW');
    expect(after.version).toBe(before.version);
  });

  it('approver CAN approve an IN_REVIEW version — 200, row APPROVED (independent SQL)', async () => {
    const st = await driveToInReview();
    const res = await request(appApprover)
      .post(`/api/v8/finance-v2/models/${st.artifactId}/approve`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: st.version });
    const after = await verifyIndependently(st.businessVersionId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(after.status).toBe('APPROVED');
    expect(after.approved_by).toBe(approverId);
  });

  it('finance_admin CAN approve an IN_REVIEW version — 200, row APPROVED (independent SQL)', async () => {
    const st = await driveToInReview();
    const res = await request(appFinanceAdmin)
      .post(`/api/v8/finance-v2/models/${st.artifactId}/approve`)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: st.version });
    const after = await verifyIndependently(st.businessVersionId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(after.status).toBe('APPROVED');
    expect(after.approved_by).toBe(financeAdminId);
  });

  // `mapOrgRoleToFinanceRole` never produces `FinanceRole` 'reviewer' for any
  // real org role today (confirmed by source read — see J4 probe's
  // RULE-REVIEWER-UNREACHABLE finding), so 'reviewer' cannot be reached via
  // HTTP. The service-level gate must still refuse it directly — a future
  // second caller of `approveVersion()` (or a future role-mapping change
  // that DOES reach 'reviewer') must not silently regain the P0.
  it('service-level gate: role "reviewer" (HTTP-unreachable today) is still rejected by approveVersion() directly', async () => {
    const st = await driveToInReview();
    const result = await artifactVersionService.approveVersion({
      organizationId: orgId,
      businessVersionId: st.businessVersionId,
      actorId: `user-reviewer-${randomUUID()}`,
      role: 'reviewer',
      expectedVersion: st.version,
    });
    const after = await verifyIndependently(st.businessVersionId);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
    expect(after.status).toBe('IN_REVIEW');
  });

  // ---------------------------------------------------------------------
  // 2. CAPABILITY <-> ENDPOINT CONSISTENCY — generalized, not approve-only.
  //    For EVERY lifecycle action, drive to the (from-)status that action
  //    requires and confirm: whatever `GET /capabilities` says about that
  //    action for a role that should NOT have it, the REAL endpoint agrees
  //    (403 FORBIDDEN), and the row is provably unchanged. This is the
  //    exact shape of the P0 bug (a correct capability hint with zero real
  //    enforcement behind it) generalized across the whole action set, so a
  //    future missing gate on any OTHER action fails this suite too.
  // ---------------------------------------------------------------------

  type ActionCase = {
    action: string;
    fromStatus: string;
    reason?: string;
    /** How to reach the real endpoint for this action. */
    call: (app: express.Express, ids: { artifactId: string; businessVersionId: string; version: number }) => Promise<request.Response>;
  };

  const transitionCall =
    (action: string, reason?: string) =>
    (app: express.Express, ids: { businessVersionId: string; version: number }) =>
      request(app)
        .post(`/api/v8/finance-v2/versions/${ids.businessVersionId}/transitions`)
        .send({ action, expectedVersion: ids.version, ...(reason ? { reason } : {}) });

  const ACTION_CASES: ActionCase[] = [
    { action: 'submit_for_review', fromStatus: 'DRAFT', call: transitionCall('submit_for_review') },
    { action: 'withdraw', fromStatus: 'READY_FOR_REVIEW', call: transitionCall('withdraw') },
    { action: 'start_review', fromStatus: 'READY_FOR_REVIEW', call: transitionCall('start_review') },
    { action: 'request_changes', fromStatus: 'IN_REVIEW', reason: 'needs fixes', call: transitionCall('request_changes', 'needs fixes') },
    { action: 'resume_editing', fromStatus: 'NEEDS_CHANGES', call: transitionCall('resume_editing') },
    {
      action: 'approve',
      fromStatus: 'IN_REVIEW',
      call: (app, ids) =>
        request(app)
          .post(`/api/v8/finance-v2/models/${ids.artifactId}/approve`)
          .set('Idempotency-Key', randomUUID())
          .send({ expectedVersion: ids.version }),
    },
    { action: 'archive', fromStatus: 'APPROVED', call: transitionCall('archive') },
    { action: 'invalidate', fromStatus: 'APPROVED', reason: 'bad data', call: transitionCall('invalidate', 'bad data') },
    {
      action: 'reopen',
      fromStatus: 'APPROVED',
      call: (app, ids) =>
        request(app)
          .post(`/api/v8/finance-v2/models/${ids.artifactId}/reopen`)
          .set('Idempotency-Key', randomUUID())
          .send({ expectedVersion: ids.version, reason: 'capability-consistency probe' }),
    },
  ];

  /** Drives a fresh BASELINE_MODEL (MATERIAL risk tier) artifact to `targetStatus` using legitimate preparer/approver calls, exactly like the J4 probe's own fixture setup — never the attack under test. */
  async function driveToStatus(targetStatus: string): Promise<{ artifactId: string; businessVersionId: string; version: number }> {
    const created = await createArtifactViaHttp(appPreparer, 'HISTORICAL_ANALYSIS');
    const artifactId = created.artifactId;
    const bvId = created.currentBusinessVersion.businessVersionId;
    let version = created.currentBusinessVersion.version;
    const step = async (action: string, byApp: express.Express, reason?: string) => {
      const res = await request(byApp)
        .post(`/api/v8/finance-v2/versions/${bvId}/transitions`)
        .send({ action, expectedVersion: version, ...(reason ? { reason } : {}) });
      if (res.status !== 200) throw new Error(`driveToStatus step ${action} failed: ${res.status} ${JSON.stringify(res.body)}`);
      version = res.body.data.version;
    };
    if (targetStatus === 'DRAFT') return { artifactId, businessVersionId: bvId, version };
    await step('submit_for_review', appPreparer);
    if (targetStatus === 'READY_FOR_REVIEW') return { artifactId, businessVersionId: bvId, version };
    await step('start_review', appApprover);
    if (targetStatus === 'IN_REVIEW') return { artifactId, businessVersionId: bvId, version };
    if (targetStatus === 'NEEDS_CHANGES') {
      await step('request_changes', appApprover, 'needs more detail');
      return { artifactId, businessVersionId: bvId, version };
    }
    if (targetStatus === 'APPROVED') {
      await forceFreshnessCurrent(bvId);
      const approveRes = await request(appApprover)
        .post(`/api/v8/finance-v2/models/${artifactId}/approve`)
        .set('Idempotency-Key', randomUUID())
        .send({ expectedVersion: version });
      if (approveRes.status !== 200) throw new Error(`driveToStatus approve failed: ${approveRes.status} ${JSON.stringify(approveRes.body)}`);
      const bv = await verifyIndependently(bvId);
      return { artifactId, businessVersionId: bvId, version: bv.version };
    }
    throw new Error(`driveToStatus: unsupported targetStatus ${targetStatus}`);
  }

  for (const testRole of ['viewer', 'preparer'] as const) {
    // preparer is legitimately allowed to perform submit_for_review/withdraw/
    // resume_editing — only sweep the actions preparer should NOT have, so
    // this loop only ever exercises (role, action) pairs where capabilities
    // must say "not allowed" and the endpoint must agree. appPreparer2 (not
    // appPreparer) is used here so this sweep never collides with
    // driveToStatus's own submitter identity.
    const casesForRole = testRole === 'viewer' ? ACTION_CASES : ACTION_CASES.filter((c) => !['submit_for_review', 'withdraw', 'resume_editing'].includes(c.action));

    for (const c of casesForRole) {
      it(`capability<->endpoint agree for role=${testRole} action=${c.action} (from ${c.fromStatus}): capabilities correctly excludes it AND the real endpoint rejects it (403 FORBIDDEN), row unchanged`, async () => {
        const st = await driveToStatus(c.fromStatus);
        const before = await verifyIndependently(st.businessVersionId);

        const testApp = testRole === 'viewer' ? appViewer : appPreparer2;
        const capRes = await request(testApp).get(`/api/v8/finance-v2/artifacts/${st.artifactId}/capabilities`);
        const capSaysAllowed = Array.isArray(capRes.body?.data?.allowedActions) && capRes.body.data.allowedActions.includes(c.action);

        const res = await c.call(testApp, st);
        const after = await verifyIndependently(st.businessVersionId);

        // The invariant under test: capabilities correctly excludes this
        // action for this role (sanity check on the fixture itself), AND the
        // real endpoint independently agrees — never a 200/201 when
        // capabilities said no.
        expect(capSaysAllowed).toBe(false);
        expect([200, 201]).not.toContain(res.status);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN');
        expect(after.status).toBe(before.status);
        expect(after.version).toBe(before.version);
      });
    }
  }
});
