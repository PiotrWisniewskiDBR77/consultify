/**
 * Finance v3 canonical adapter — Pakiet B3 Valuation cross-tenant matrix, real PostgreSQL + real
 * HTTP.
 *
 * ★ KONTROLA NEGATYWNA — obowiązkowa (brief §"Kontrola negatywna", same pattern
 * `pkg-b2-cross-tenant.routes.pg.test.ts` established for Pakiet B2). For every endpoint family this
 * package (B3) added — Cases, Variants, Methods/basket, WACC inputs, Compute/results, Bridge,
 * Terminal/Sensitivity, Advisor — organization B requests/mutates a resource created by
 * organization A and must be refused, independently confirmed by a direct SQL read (never trusting
 * only the HTTP response body).
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('Finance v2 Pakiet B3 — valuation cross-tenant matrix (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let valuationComputeService: typeof import('../../../../services/finance/canonical/valuationComputeService.js');
  let financeV2Router: express.Router;

  const orgA = `org-pkgb3-xt-a-${randomUUID()}`;
  const orgB = `org-pkgb3-xt-b-${randomUUID()}`;
  const userA = `user-pkgb3-xt-a-${randomUUID()}`;
  const userB = `user-pkgb3-xt-b-${randomUUID()}`;

  function appAsOrg(orgId: string, userId: string) {
    const a = express();
    a.use(express.json());
    a.use((req: any, _res, next) => {
      req.user = { id: userId, organizationId: orgId, role: 'finance_admin' };
      req.v8Context = { organizationId: orgId, userId, userRole: 'finance_admin' };
      next();
    });
    a.use('/api/v8/finance-v2', financeV2Router);
    a.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: String(err?.message || err) }));
    return a;
  }
  let appA: express.Express;
  let appB: express.Express;

  async function makeCaseAsA(name = `XT Case ${randomUUID().slice(0, 8)}`) {
    const res = await request(appA).post('/api/v8/finance-v2/valuation/cases').send({ name });
    return res.body.data.caseId as string;
  }
  async function makeVariantAsA(caseId: string, name = `XT Variant ${randomUUID().slice(0, 8)}`) {
    const created = await request(appA).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'VALUATION_CASE' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId as string;
    await request(appA).post(`/api/v8/finance-v2/valuation/cases/${caseId}/variants`).send({ businessVersionId: bvId, name });
    return bvId;
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    valuationComputeService = await import('../../../../services/finance/canonical/valuationComputeService.js');
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?)`, [orgA, 'PkgB3 XT Tenant A', orgB, 'PkgB3 XT Tenant B'])
    );
    appA = appAsOrg(orgA, userA);
    appB = appAsOrg(orgB, userB);
  }, 60000);

  it('GET /valuation/cases/:caseId — org B on org A case -> 404; GET /valuation/cases (list) for org B never includes org A case', async () => {
    const caseId = await makeCaseAsA();
    const res = await request(appB).get(`/api/v8/finance-v2/valuation/cases/${caseId}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');

    const listRes = await request(appB).get('/api/v8/finance-v2/valuation/cases');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.find((c: any) => c.caseId === caseId)).toBeUndefined();
  });

  it('POST /valuation/cases/:caseId/variants — org B posting a variant against org A caseId -> 404 CASE_NOT_FOUND, no row written', async () => {
    const caseId = await makeCaseAsA();
    const artifact = await request(appB).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'VALUATION_CASE' });
    const bvId = artifact.body.data.currentBusinessVersion.businessVersionId;

    const res = await request(appB).post(`/api/v8/finance-v2/valuation/cases/${caseId}/variants`).send({ businessVersionId: bvId, name: 'Hijack attempt' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CASE_NOT_FOUND');

    const sqlRow = await withPinnedPostgresTransaction((tx) => tx.queryOne<{ id: string }>(`SELECT id FROM finance_valuation_variants WHERE business_version_id = ?`, [bvId]));
    expect(sqlRow).toBeNull();
  });

  it('GET/PATCH /valuation/variants/:id — org B on org A variant -> 404 both ways, SQL confirms name unchanged', async () => {
    const caseId = await makeCaseAsA();
    const bvId = await makeVariantAsA(caseId, 'Original Variant Name');

    const getRes = await request(appB).get(`/api/v8/finance-v2/valuation/variants/${bvId}`);
    expect(getRes.status).toBe(404);

    const patchRes = await request(appB).patch(`/api/v8/finance-v2/valuation/variants/${bvId}`).send({ name: 'Hijacked Name' });
    expect(patchRes.status).toBe(404);

    const sqlRow = await withPinnedPostgresTransaction((tx) => tx.queryOne<{ name: string; organization_id: string }>(`SELECT name, organization_id FROM finance_valuation_variants WHERE business_version_id = ?`, [bvId]));
    expect(sqlRow?.name).toBe('Original Variant Name');
    expect(sqlRow?.organization_id).toBe(orgA);
  });

  it('GET/POST /valuation/variants/:id/methods and POST .../basket — org B on org A variant -> 404 all three, zero rows for org B', async () => {
    const caseId = await makeCaseAsA();
    const bvId = await makeVariantAsA(caseId);

    const listRes = await request(appB).get(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`);
    expect(listRes.status).toBe(404);

    const createRes = await request(appB).post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`).send({ methodType: 'DCF_FCFF' });
    expect(createRes.status).toBe(404);

    const basketRes = await request(appB).post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods/basket`).send({ updates: [{ methodId: randomUUID(), isInRecommendationBasket: true, weightPct: 100 }] });
    expect(basketRes.status).toBe(404);

    const sqlRows = await withPinnedPostgresTransaction((tx) => tx.queryAll<{ id: string }>(`SELECT id FROM finance_valuation_methods WHERE business_version_id = ? AND organization_id = ?`, [bvId, orgB]));
    expect(sqlRows.length).toBe(0);
  });

  it('GET method (terminal/sensitivity) with a methodId belonging to org A, requested by org B -> 404, zero leakage', async () => {
    const caseId = await makeCaseAsA();
    const bvId = await makeVariantAsA(caseId);
    const methodRes = await request(appA).post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`).send({ methodType: 'DCF_FCFF' });
    const methodId = methodRes.body.data.methodId;
    await valuationComputeService.setMethodResult({ methodId, readiness: 'READY', resultValueStatus: 'PRESENT_NONZERO', resultEvDecimal: 7_000_000 });

    const terminalRes = await request(appB).get(`/api/v8/finance-v2/valuation/methods/${methodId}/terminal`);
    expect(terminalRes.status).toBe(404);

    const sensPostRes = await request(appB)
      .post(`/api/v8/finance-v2/valuation/methods/${methodId}/sensitivity`)
      .send({
        gridLabel: 'hijack',
        rowAxisVariable: 'terminal_g_pct',
        columnAxisVariable: 'wacc_pct',
        axes: { wacc: [6, 7, 8, 9, 10], terminalG: [0, 1, 2, 3, 4] },
        years: [{ fiscalYear: 2027, fcff: 500_000 }],
        fcffTerminalYear: 500_000,
        baseWaccPct: 8,
        baseGPct: 2,
      });
    expect(sensPostRes.status).toBe(404);

    const sqlGrids = await withPinnedPostgresTransaction((tx) => tx.queryAll<{ id: string }>(`SELECT id FROM finance_valuation_sensitivity_grids WHERE method_id = ? AND organization_id = ?`, [methodId, orgB]));
    expect(sqlGrids.length).toBe(0);
  });

  it('GET/PUT /valuation/variants/:id/wacc-inputs — org B on org A variant -> 404 both ways, no row for org B', async () => {
    const caseId = await makeCaseAsA();
    const bvId = await makeVariantAsA(caseId);

    const getRes = await request(appB).get(`/api/v8/finance-v2/valuation/variants/${bvId}/wacc-inputs`);
    expect(getRes.status).toBe(404);

    const putRes = await request(appB)
      .put(`/api/v8/finance-v2/valuation/variants/${bvId}/wacc-inputs`)
      .send({ currency: 'PLN', nominalOrReal: 'NOMINAL', preOrPostTax: 'POST_TAX' });
    expect(putRes.status).toBe(404);

    const sqlRow = await withPinnedPostgresTransaction((tx) => tx.queryOne<{ id: string }>(`SELECT id FROM finance_valuation_wacc_inputs WHERE business_version_id = ?`, [bvId]));
    expect(sqlRow).toBeNull();
  });

  it('POST /valuation/variants/:id/compute/dcf — org B attempting to compute org A variant -> 404, no compute_jobs row for org B', async () => {
    const caseId = await makeCaseAsA();
    const bvId = await makeVariantAsA(caseId);

    const res = await request(appB)
      .post(`/api/v8/finance-v2/valuation/variants/${bvId}/compute/dcf`)
      .send({ entityId: randomUUID(), projectionYears: [{ fiscalYear: 2027, periodIds: [randomUUID()] }], openingWorkingCapital: 0, terminal: { gPct: 2 } });
    expect(res.status).toBe(404);

    const rows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(
        `SELECT id FROM compute_jobs WHERE input_artifact_id = (SELECT artifact_id FROM finance_business_versions WHERE business_version_id = ?) AND organization_id = ?`,
        [bvId, orgB]
      )
    );
    expect(rows.length).toBe(0);
  });

  it('GET /valuation/variants/:id/results — org B on org A variant -> 404 (ORGANIZATION_MISMATCH mapped fail-closed), zero data leaked in the body', async () => {
    const caseId = await makeCaseAsA();
    const bvId = await makeVariantAsA(caseId);
    const methodRes = await request(appA).post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`).send({ methodType: 'DCF_FCFF' });
    await valuationComputeService.setMethodResult({ methodId: methodRes.body.data.methodId, readiness: 'READY', resultValueStatus: 'PRESENT_NONZERO', resultEvDecimal: 42_000_000 });

    const res = await request(appB).get(`/api/v8/finance-v2/valuation/variants/${bvId}/results`);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('42000000');

    // Legitimate same-org read still works.
    const legit = await request(appA).get(`/api/v8/finance-v2/valuation/variants/${bvId}/results`);
    expect(legit.status).toBe(200);
    expect(legit.body.data.headlineEnterpriseValue.value).toBe(42_000_000);
  });

  it('GET/PUT /valuation/variants/:id/bridge — org B on org A variant -> 404 both ways, SQL confirms no bridge row for org B', async () => {
    const caseId = await makeCaseAsA();
    const bvId = await makeVariantAsA(caseId);

    const getRes = await request(appB).get(`/api/v8/finance-v2/valuation/variants/${bvId}/bridge`);
    expect(getRes.status).toBe(404);

    const putRes = await request(appB)
      .put(`/api/v8/finance-v2/valuation/variants/${bvId}/bridge`)
      .send({ asOfDate: '2026-12-31', enterpriseValueDecimal: 999, components: [] });
    expect(putRes.status).toBe(404);

    const sqlRow = await withPinnedPostgresTransaction((tx) => tx.queryOne<{ id: string }>(`SELECT id FROM finance_valuation_ev_equity_bridge WHERE business_version_id = ?`, [bvId]));
    expect(sqlRow).toBeNull();
  });

  it('POST /valuation/variants/:id/advisor/generate and GET .../advisor — org B on org A variant -> 404 both, zero advisor rows for org B', async () => {
    const caseId = await makeCaseAsA();
    const bvId = await makeVariantAsA(caseId);
    const methodRes = await request(appA).post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`).send({ methodType: 'DCF_FCFF' });
    await valuationComputeService.setMethodResult({ methodId: methodRes.body.data.methodId, readiness: 'READY', resultValueStatus: 'PRESENT_NONZERO', resultEvDecimal: 15_000_000 });

    const genRes = await request(appB).post(`/api/v8/finance-v2/valuation/variants/${bvId}/advisor/generate`).send({});
    expect(genRes.status).toBe(404);

    const listRes = await request(appB).get(`/api/v8/finance-v2/valuation/variants/${bvId}/advisor`);
    expect(listRes.status).toBe(404);

    const sqlRows = await withPinnedPostgresTransaction((tx) => tx.queryAll<{ id: string }>(`SELECT id FROM finance_valuation_advisor_outputs WHERE business_version_id = ? AND organization_id = ?`, [bvId, orgB]));
    expect(sqlRows.length).toBe(0);
  });

  it('POST /valuation/cases/:caseId/compare-variants — org B supplying org A caseId + org A variant ids -> 404 (ORGANIZATION_MISMATCH), no advisor rows written for either side', async () => {
    const caseId = await makeCaseAsA();
    const bvA = await makeVariantAsA(caseId, 'XT compare A');
    const bvB = await makeVariantAsA(caseId, 'XT compare B');
    const mA = (await request(appA).post(`/api/v8/finance-v2/valuation/variants/${bvA}/methods`).send({ methodType: 'DCF_FCFF' })).body.data.methodId;
    const mB = (await request(appA).post(`/api/v8/finance-v2/valuation/variants/${bvB}/methods`).send({ methodType: 'DCF_FCFF' })).body.data.methodId;
    await valuationComputeService.setMethodResult({ methodId: mA, readiness: 'READY', resultValueStatus: 'PRESENT_NONZERO', resultEvDecimal: 1_000_000 });
    await valuationComputeService.setMethodResult({ methodId: mB, readiness: 'READY', resultValueStatus: 'PRESENT_NONZERO', resultEvDecimal: 1_500_000 });

    const res = await request(appB).post(`/api/v8/finance-v2/valuation/cases/${caseId}/compare-variants`).send({ variantIdA: bvA, variantIdB: bvB, persist: true });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ORGANIZATION_MISMATCH');

    const sqlRows = await withPinnedPostgresTransaction((tx) => tx.queryAll<{ id: string }>(`SELECT id FROM finance_valuation_advisor_outputs WHERE business_version_id = ? AND is_comparison = true`, [bvA]));
    expect(sqlRows.length).toBe(0); // org B's attempted persist:true never committed anything
  });
});
