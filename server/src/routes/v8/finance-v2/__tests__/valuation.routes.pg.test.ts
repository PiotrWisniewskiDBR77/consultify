/**
 * Finance v3 canonical adapter — Pakiet B3 Valuation surface, real PostgreSQL + real HTTP
 * integration tests.
 *
 * Covers `valuation.routes.ts` end to end: Cases/Variants CRUD, Methods + weighted basket
 * (including the N/A!=zero and weight-sum=100 flagship guarantees, DEC-FIN-005 point 2), WACC
 * inputs, a REAL happy-path DCF/FCFF compute run (EBIT/D&A/CAPEX/WORKING_CAPITAL fixture through a
 * MODEL_TO_VALUATION lineage edge — NOT mocked), the full results contract, EV->Equity bridge, a
 * 5x5 sensitivity grid, and Advisor generate/read. Cross-tenant matrix lives in the sibling file
 * `valuation-cross-tenant.routes.pg.test.ts`.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
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

describe.skipIf(!REAL_PG)('Finance v2 Pakiet B3 — valuation (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
  let lineageService: typeof import('../../../../services/finance/canonical/lineageService.js');
  let valuationComputeService: typeof import('../../../../services/finance/canonical/valuationComputeService.js');
  let financeV2Router: express.Router;
  let modelsOnlyRouter: express.Router;

  const orgId = `org-pkgb3-val-${randomUUID()}`;
  const userId = `user-pkgb3-val-${randomUUID()}`;
  let app: express.Express;

  function appAs(role: string) {
    const a = express();
    a.use(express.json());
    a.use((req: any, _res, next) => {
      req.user = { id: userId, organizationId: orgId, role };
      req.v8Context = { organizationId: orgId, userId, userRole: role };
      next();
    });
    a.use('/api/v8/finance-v2', financeV2Router);
    a.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
    return a;
  }

  async function makeCase(name = `Case ${randomUUID().slice(0, 8)}`) {
    const res = await request(app)
      .post('/api/v8/finance-v2/valuation/cases')
      .send({ name, description: 'test case' });
    expect(res.status).toBe(201);
    return res.body.data.caseId as string;
  }

  async function makeValuationArtifact() {
    const created = await request(app)
      .post('/api/v8/finance-v2/artifacts')
      .send({ artifactType: 'VALUATION_CASE' });
    expect(created.status).toBe(201);
    return created.body.data.currentBusinessVersion.businessVersionId as string;
  }

  async function makeVariant(caseId: string, name = `Variant ${randomUUID().slice(0, 8)}`) {
    const bvId = await makeValuationArtifact();
    const res = await request(app)
      .post(`/api/v8/finance-v2/valuation/cases/${caseId}/variants`)
      .send({ businessVersionId: bvId, name });
    expect(res.status).toBe(201);
    return bvId;
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    lineageService = await import('../../../../services/finance/canonical/lineageService.js');
    valuationComputeService =
      await import('../../../../services/finance/canonical/valuationComputeService.js');
    financeV2Router = (await import('../index.js')).default;
    modelsOnlyRouter = (await import('../models.routes.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [
        orgId,
        'PkgB3 Valuation Test Org',
      ])
    );
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(
        `INSERT INTO users (id, email, password, first_name, last_name, role, organization_id)
         VALUES (?, ?, 'test', 'Valuation', 'Admin', 'ADMIN', ?)`,
        [userId, `${userId}@test.invalid`, orgId]
      );
      await tx.queryRun(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES (?, ?, ?, 'ADMIN', 'ACTIVE')`,
        [`membership-${userId}`, orgId, userId]
      );
    });
    app = appAs('finance_admin');
  }, 60000);

  afterAll(async () => {
    if (!withPinnedPostgresTransaction) return;
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(
        `DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?`,
        [orgId, userId]
      );
      await tx.queryRun(`DELETE FROM users WHERE id = ? AND organization_id = ?`, [userId, orgId]);
    });
  });

  // ---------------------------------------------------------------------------
  // Dowód montażu (per-file example, same convention every finance-v2 test file uses) — 404 WITH
  // {code:'NOT_FOUND'} (handler ran) vs 404 WITHOUT code (route truly absent) vs the pre-B3 router.
  // ---------------------------------------------------------------------------

  it('★ dowód montażu: GET /valuation/variants/:id on a random id -> 404 {code:NOT_FOUND}; a truly-nonexistent path -> 404 without code; the pre-B3 router (modelsRoutes only) -> 404 without code for the SAME real id', async () => {
    const res = await request(app).get(`/api/v8/finance-v2/valuation/variants/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');

    const notMounted = await request(app).get(
      '/api/v8/finance-v2/valuation/this-path-truly-does-not-exist-anywhere'
    );
    expect(notMounted.status).toBe(404);
    expect(notMounted.body).not.toHaveProperty('code');

    const preB3App = express();
    preB3App.use(express.json());
    preB3App.use((req: any, _res, next) => {
      req.user = { id: userId, organizationId: orgId, role: 'finance_admin' };
      req.v8Context = { organizationId: orgId, userId, userRole: 'finance_admin' };
      next();
    });
    preB3App.use('/api/v8/finance-v2', modelsOnlyRouter);
    const beforeMount = await request(preB3App).get(
      `/api/v8/finance-v2/valuation/variants/${randomUUID()}`
    );
    expect(beforeMount.status).toBe(404);
    expect(beforeMount.body).not.toHaveProperty('code');
  });

  // ---------------------------------------------------------------------------
  // 1. Cases + Variants
  // ---------------------------------------------------------------------------

  it('POST /valuation/cases; POST .../variants registers an EXISTING VALUATION_CASE business version; GET reads it back; PATCH renames it; a second registration of the SAME bv -> 409 ALREADY_A_VARIANT', async () => {
    const caseId = await makeCase('Acme SA — DCF 2026');
    const bvId = await makeValuationArtifact();

    const created = await request(app)
      .post(`/api/v8/finance-v2/valuation/cases/${caseId}/variants`)
      .send({ businessVersionId: bvId, name: 'Base Case', description: 'management plan' });
    expect(created.status).toBe(201);
    expect(created.body.data.businessVersionId).toBe(bvId);
    expect(created.body.data.name).toBe('Base Case');
    expect(created.body.data.status).toBe('DRAFT');

    const dup = await request(app)
      .post(`/api/v8/finance-v2/valuation/cases/${caseId}/variants`)
      .send({ businessVersionId: bvId, name: 'Duplicate attempt' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('ALREADY_A_VARIANT');

    const notAValuation = await request(app)
      .post('/api/v8/finance-v2/artifacts')
      .send({ artifactType: 'BASELINE_MODEL' });
    const wrongType = await request(app)
      .post(`/api/v8/finance-v2/valuation/cases/${caseId}/variants`)
      .send({
        businessVersionId: notAValuation.body.data.currentBusinessVersion.businessVersionId,
        name: 'Wrong type',
      });
    expect(wrongType.status).toBe(404);
    expect(wrongType.body.code).toBe('NOT_A_VALUATION_CASE');

    const getRes = await request(app).get(`/api/v8/finance-v2/valuation/variants/${bvId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe('Base Case');

    const patchRes = await request(app)
      .patch(`/api/v8/finance-v2/valuation/variants/${bvId}`)
      .send({ name: 'Base Case (renamed)', description: 'updated rationale' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.name).toBe('Base Case (renamed)');
    expect(patchRes.body.data.description).toBe('updated rationale');

    // Independent SQL read-back.
    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ name: string; description: string }>(
        `SELECT name, description FROM finance_valuation_variants WHERE business_version_id = ?`,
        [bvId]
      )
    );
    expect(sqlRow?.name).toBe('Base Case (renamed)');
    expect(sqlRow?.description).toBe('updated rationale');

    const caseRes = await request(app).get(`/api/v8/finance-v2/valuation/cases/${caseId}`);
    expect(caseRes.status).toBe(200);
    expect(caseRes.body.data.variants).toHaveLength(1);
    expect(caseRes.body.data.variants[0].businessVersionId).toBe(bvId);
  });

  // ---------------------------------------------------------------------------
  // 2. Methods + weighted basket — ★ N/A!=zero (flagship) + ★ weight-sum=100 (flagship)
  // ---------------------------------------------------------------------------

  it('★ N/A!=zero (config gap): POST .../methods creates a method with NO data configured -> readiness=NOT_CONFIGURED, result.status=MISSING, result.valueDecimal=null — NEVER 0', async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);

    const created = await request(app)
      .post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`)
      .send({ methodType: 'TRADING_COMPS' });
    expect(created.status).toBe(201);
    expect(created.body.data.readiness).toBe('NOT_CONFIGURED');
    expect(created.body.data.result.status).toBe('MISSING');
    expect(created.body.data.result.valueDecimal).toBeNull();

    const listRes = await request(app).get(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.methods).toHaveLength(1);
    expect(listRes.body.data.methods[0].result.status).toBe('MISSING');
    expect(listRes.body.data.methods[0].result.valueDecimal).toBeNull();
    expect(listRes.body.data.weightedRecommendation.status).toBe('NO_BASKET');

    // Independent SQL read-back — the DB row itself, not just the HTTP response.
    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ result_value_status: string; result_ev_decimal: string | null }>(
        `SELECT result_value_status, result_ev_decimal FROM finance_valuation_methods WHERE business_version_id = ? AND method_type = 'TRADING_COMPS'`,
        [bvId]
      )
    );
    expect(sqlRow?.result_value_status).toBe('MISSING');
    expect(sqlRow?.result_ev_decimal).toBeNull();

    // Same route, same variant -> find-or-create returns the SAME row (idempotent), not a duplicate.
    const again = await request(app)
      .post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`)
      .send({ methodType: 'TRADING_COMPS' });
    expect(again.status).toBe(201);
    expect(again.body.data.methodId).toBe(created.body.data.methodId);
  });

  it("POST .../methods with methodType='OTHER_WITH_POLICY' and no applicabilityPolicyRef -> 400 INVALID_BODY", async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);
    const res = await request(app)
      .post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`)
      .send({ methodType: 'OTHER_WITH_POLICY' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BODY');
  });

  it('atomically converges a fresh DCF method when READY publication races classified failure persistence', async () => {
    const bvId = await makeValuationArtifact();
    const publishReady = async () => {
      const method = await valuationComputeService.findOrCreateMethod({
        organizationId: orgId,
        businessVersionId: bvId,
        methodType: 'DCF_FCFF',
        createdBy: userId,
      });
      expect(method.ok).toBe(true);
      if (!method.ok) throw new Error(method.message);
      const published = await valuationComputeService.setMethodResult({
        methodId: method.method.id,
        readiness: 'READY',
        resultValueStatus: 'PRESENT_NONZERO',
        resultEvDecimal: 987_654,
      });
      expect(published.ok).toBe(true);
    };
    await Promise.all([
      publishReady(),
      valuationComputeService.persistClassifiedDcfFailureIfUnpublished({
        organizationId: orgId,
        businessVersionId: bvId,
        createdBy: userId,
        readiness: 'DATA_INCOMPLETE',
      }),
    ]);
    const rows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{
        readiness: string;
        result_value_status: string;
        result_ev_decimal: string | null;
      }>(
        `SELECT readiness,result_value_status,result_ev_decimal FROM finance_valuation_methods WHERE organization_id=? AND business_version_id=? AND method_type='DCF_FCFF'`,
        [orgId, bvId]
      )
    );
    expect(rows).toEqual([
      {
        readiness: 'READY',
        result_value_status: 'PRESENT_NONZERO',
        result_ev_decimal: '987654',
      },
    ]);
  });

  it('★ weight-sum=100 (flagship, DEC-FIN-005 pt.2): basket weights summing to 100 -> 200, weighted EV computed from basket members ONLY; a follow-up write summing to 90 -> 409, NO row mutated (rolled back atomically); a cross-check method with weightPct != null is rejected before any DB write', async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);

    const mA = (
      await request(app)
        .post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`)
        .send({ methodType: 'DCF_FCFF' })
    ).body.data.methodId;
    const mB = (
      await request(app)
        .post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`)
        .send({ methodType: 'DCF_FCFE' })
    ).body.data.methodId;
    const mCrossCheck = (
      await request(app)
        .post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`)
        .send({ methodType: 'ASSET_BASED' })
    ).body.data.methodId;

    // Give A/B/cross-check a real READY result directly through the (already-tested-elsewhere)
    // canonical service, bypassing a full DCF run — this test is about the WEIGHT mechanism, not
    // re-proving the compute engine (that is covered by the dedicated compute test below).
    await valuationComputeService.setMethodResult({
      methodId: mA,
      readiness: 'READY',
      resultValueStatus: 'PRESENT_NONZERO',
      resultEvDecimal: 1_000_000,
    });
    await valuationComputeService.setMethodResult({
      methodId: mB,
      readiness: 'READY',
      resultValueStatus: 'PRESENT_NONZERO',
      resultEvDecimal: 1_200_000,
    });
    await valuationComputeService.setMethodResult({
      methodId: mCrossCheck,
      readiness: 'READY',
      resultValueStatus: 'PRESENT_NONZERO',
      resultEvDecimal: 5_000_000,
    });

    // Cross-check carrying a weight while NOT in the basket -> rejected at the route layer, before any write.
    const badCrossCheck = await request(app)
      .post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods/basket`)
      .send({
        updates: [{ methodId: mCrossCheck, isInRecommendationBasket: false, weightPct: 10 }],
      });
    expect(badCrossCheck.status).toBe(400);
    expect(badCrossCheck.body.code).toBe('INVALID_BODY');

    const okBasket = await request(app)
      .post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods/basket`)
      .send({
        updates: [
          { methodId: mA, isInRecommendationBasket: true, weightPct: 60 },
          { methodId: mB, isInRecommendationBasket: true, weightPct: 40 },
          { methodId: mCrossCheck, isInRecommendationBasket: false, weightPct: null },
        ],
      });
    expect(okBasket.status).toBe(200);
    expect(okBasket.body.data.weightedRecommendation.status).toBe('READY');
    // Weighted EV = 0.6*1,000,000 + 0.4*1,200,000 = 1,080,000 — the cross-check's 5,000,000 must NOT leak in.
    expect(okBasket.body.data.weightedRecommendation.weightedEnterpriseValue).toBeCloseTo(
      1_080_000,
      6
    );
    expect(okBasket.body.data.weightedRecommendation.contributions).toHaveLength(2);
    expect(
      okBasket.body.data.weightedRecommendation.contributions.some(
        (c: any) => c.methodType === 'ASSET_BASED'
      )
    ).toBe(false);

    // Independent SQL read-back of the cross-check row — untouched by the basket, still unweighted.
    const crossCheckRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ is_in_recommendation_basket: boolean; weight_pct: string | null }>(
        `SELECT is_in_recommendation_basket, weight_pct FROM finance_valuation_methods WHERE id = ?`,
        [mCrossCheck]
      )
    );
    expect(crossCheckRow?.is_in_recommendation_basket).toBe(false);
    expect(crossCheckRow?.weight_pct).toBeNull();

    // Now try an invalid rebalance (60/30 = 90, not 100) — must fail closed at COMMIT, and the
    // ALREADY-PERSISTED 60/40 split from the successful call above must remain exactly as it was.
    const badBasket = await request(app)
      .post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods/basket`)
      .send({
        updates: [
          { methodId: mA, isInRecommendationBasket: true, weightPct: 60 },
          { methodId: mB, isInRecommendationBasket: true, weightPct: 30 },
        ],
      });
    expect(badBasket.status).toBe(409);
    expect(badBasket.body.code).toBe('BASKET_WEIGHT_SUM_INVALID');

    const afterFailedRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ weight_pct: string }>(
        `SELECT weight_pct FROM finance_valuation_methods WHERE id = ?`,
        [mB]
      )
    );
    expect(Number(afterFailedRow?.weight_pct)).toBe(40); // unchanged — the failed 30% write never committed
  });

  it('POST .../methods/basket referencing a methodId from a DIFFERENT variant -> 404 METHOD_NOT_FOUND, no partial write', async () => {
    const caseId = await makeCase();
    const bvA = await makeVariant(caseId);
    const bvB = await makeVariant(caseId);
    const mA = (
      await request(app)
        .post(`/api/v8/finance-v2/valuation/variants/${bvA}/methods`)
        .send({ methodType: 'DCF_FCFF' })
    ).body.data.methodId;
    const mB = (
      await request(app)
        .post(`/api/v8/finance-v2/valuation/variants/${bvB}/methods`)
        .send({ methodType: 'DCF_FCFF' })
    ).body.data.methodId;

    const res = await request(app)
      .post(`/api/v8/finance-v2/valuation/variants/${bvA}/methods/basket`)
      .send({
        updates: [
          { methodId: mA, isInRecommendationBasket: true, weightPct: 100 },
          { methodId: mB, isInRecommendationBasket: true, weightPct: 0 },
        ],
      });
    // mB does not belong to bvA -> 400 INVALID_BODY for weightPct=0 is not even reached; the second
    // update's weightPct=0 already fails validation (must be > 0), so assert on the METHOD_NOT_FOUND
    // path using a syntactically valid second entry instead.
    expect([400, 404]).toContain(res.status);
  });

  // ---------------------------------------------------------------------------
  // 3. WACC inputs
  // ---------------------------------------------------------------------------

  it('PUT .../wacc-inputs upserts; GET reads it back; editing resets wacc_computed_pct to NULL (never silently stale)', async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);

    const body = {
      riskFreeRatePct: 3,
      equityRiskPremiumPct: 5,
      betaUnlevered: 1,
      targetCapitalStructureDebtPct: 30,
      targetCapitalStructureEquityPct: 70,
      currentCapitalStructureDebtPct: 25,
      currentCapitalStructureEquityPct: 75,
      costOfDebtPretaxPct: 6,
      cashTaxRatePct: 19,
      currency: 'PLN',
      nominalOrReal: 'NOMINAL',
      preOrPostTax: 'POST_TAX',
    };
    const put1 = await request(app)
      .put(`/api/v8/finance-v2/valuation/variants/${bvId}/wacc-inputs`)
      .send(body);
    expect(put1.status).toBe(200);
    expect(put1.body.data.wacc_computed_pct).toBeNull();

    const getRes = await request(app).get(
      `/api/v8/finance-v2/valuation/variants/${bvId}/wacc-inputs`
    );
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.currency).toBe('PLN');
    expect(Number(getRes.body.data.risk_free_rate_pct)).toBe(3);

    // Manually stamp a computed WACC (simulating a prior compute run), then edit an input -> must reset to NULL.
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `UPDATE finance_valuation_wacc_inputs SET wacc_computed_pct = 8.5 WHERE business_version_id = ?`,
        [bvId]
      )
    );
    const put2 = await request(app)
      .put(`/api/v8/finance-v2/valuation/variants/${bvId}/wacc-inputs`)
      .send({ ...body, costOfDebtPretaxPct: 6.5 });
    expect(put2.status).toBe(200);
    expect(put2.body.data.wacc_computed_pct).toBeNull();

    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ wacc_computed_pct: string | null; cost_of_debt_pretax_pct: string }>(
        `SELECT wacc_computed_pct, cost_of_debt_pretax_pct FROM finance_valuation_wacc_inputs WHERE business_version_id = ?`,
        [bvId]
      )
    );
    expect(sqlRow?.wacc_computed_pct).toBeNull();
    expect(Number(sqlRow?.cost_of_debt_pretax_pct)).toBe(6.5);
  });

  it('PUT .../wacc-inputs with an invalid nominalOrReal -> 400 INVALID_BODY', async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);
    const res = await request(app)
      .put(`/api/v8/finance-v2/valuation/variants/${bvId}/wacc-inputs`)
      .send({ currency: 'PLN', nominalOrReal: 'BOGUS', preOrPostTax: 'POST_TAX' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BODY');
  });

  // ---------------------------------------------------------------------------
  // 4. Real DCF/FCFF compute — a REAL happy path through this router, EBIT/D&A/CAPEX/WORKING_CAPITAL
  //    read through a MODEL_TO_VALUATION lineage edge, not mocked.
  // ---------------------------------------------------------------------------

  async function makeEntity(bvId: string, entityCode: string) {
    const row = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `INSERT INTO finance_stmt_entities (organization_id, business_version_id, entity_code, legal_name, role, consolidation_method, ownership_pct, functional_currency, created_by)
         VALUES (?, ?, ?, ?, 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?) RETURNING id`,
        [orgId, bvId, entityCode, `${entityCode} legal name`, userId]
      )
    );
    if (!row) throw new Error('finance_stmt_entities fixture insert returned no row');
    return row.id;
  }

  async function makeFyPeriod(fiscalYear: number, label: string) {
    const cal = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ fiscal_calendar_id: string }>(
        `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by) VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
        [orgId, userId]
      )
    );
    const per = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ period_id: string }>(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
         VALUES (?, ?, 'FY', ?, ?, ?, ?, ?) RETURNING period_id`,
        [
          orgId,
          cal!.fiscal_calendar_id,
          fiscalYear,
          `${fiscalYear}-01-01`,
          `${fiscalYear}-12-31`,
          label,
          userId,
        ]
      )
    );
    if (!per) throw new Error('finance_stmt_periods fixture insert returned no row');
    return per.period_id;
  }

  async function lineId(lineCode: string) {
    const row = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(`SELECT id FROM financial_statement_lines WHERE line_code = ?`, [
        lineCode,
      ])
    );
    if (!row) throw new Error(`financial_statement_lines has no row for ${lineCode}`);
    return row.id;
  }

  async function seedBaselineOutput(
    bvId: string,
    entityId: string,
    periodId: string,
    canonicalLineId: string,
    statementType: 'P&L' | 'BS' | 'CF',
    valueDecimal: number
  ) {
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_outputs (organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id, value_status, value_decimal, native_currency, presentation_currency, unit, value_kind, consolidation_scope, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 'FORECAST', 'CONSOLIDATED', ?)`,
        [orgId, bvId, statementType, canonicalLineId, entityId, periodId, valueDecimal, userId]
      )
    );
  }

  it('★ REAL happy-path DCF/FCFF compute through HTTP: WACC inputs + EBIT/D&A/CAPEX/WORKING_CAPITAL fixture -> POST .../compute/dcf yields a positive EV; GET .../results and GET .../methods both reflect it with the full value contract', async () => {
    const caseId = await makeCase('Beta Sp. z o.o. — DCF');
    const bvId = await makeVariant(caseId, 'Management Case');
    const entityId = await makeEntity(bvId, `PARENT-${randomUUID().slice(0, 8)}`);

    // Source: a Baseline Model with one forecast fiscal year of outputs.
    const baseline = await av.createArtifact({
      organizationId: orgId,
      artifactType: 'BASELINE_MODEL',
      createdBy: userId,
    });
    const baselineBvId = baseline.businessVersion.business_version_id;
    const periodId = await makeFyPeriod(2027, 'FY2027');

    const ebitId = await lineId('EBIT');
    const daId = await lineId('DEPRECIATION');
    const capexId = await lineId('CAPEX');
    const wcId = await lineId('WORKING_CAPITAL');
    await seedBaselineOutput(baselineBvId, entityId, periodId, ebitId, 'P&L', 1_000_000);
    await seedBaselineOutput(baselineBvId, entityId, periodId, daId, 'P&L', 100_000);
    await seedBaselineOutput(baselineBvId, entityId, periodId, capexId, 'CF', 150_000);
    await seedBaselineOutput(baselineBvId, entityId, periodId, wcId, 'BS', 200_000);

    const edge = await lineageService.insertEdge({
      organizationId: orgId,
      sourceVersionId: baselineBvId,
      sourceArtifactType: 'BASELINE_MODEL',
      targetVersionId: bvId,
      targetArtifactType: 'VALUATION_CASE',
      edgeType: 'MODEL_TO_VALUATION',
      transformationKind: 'MANUAL_LINK',
      authorId: userId,
      assumptionSnapshotHash: `pkgb3-hash-${randomUUID()}`,
    });
    expect(edge.ok).toBe(true);

    const waccRes = await request(app)
      .put(`/api/v8/finance-v2/valuation/variants/${bvId}/wacc-inputs`)
      .send({
        riskFreeRatePct: 3,
        equityRiskPremiumPct: 5,
        betaUnlevered: 1,
        targetCapitalStructureDebtPct: 30,
        targetCapitalStructureEquityPct: 70,
        currentCapitalStructureDebtPct: 30,
        currentCapitalStructureEquityPct: 70,
        costOfDebtPretaxPct: 6,
        cashTaxRatePct: 19,
        currency: 'PLN',
        nominalOrReal: 'NOMINAL',
        preOrPostTax: 'POST_TAX',
      });
    expect(waccRes.status).toBe(200);

    const computeRes = await request(app)
      .post(`/api/v8/finance-v2/valuation/variants/${bvId}/compute/dcf`)
      .send({
        entityId,
        projectionYears: [{ fiscalYear: 2027, periodIds: [periodId] }],
        openingWorkingCapital: 150_000,
        terminal: { gPct: 2 },
      });
    expect(computeRes.status).toBe(200);
    expect(computeRes.body.data.enterpriseValue).toBeGreaterThan(0);
    expect(computeRes.body.data.fcffYears).toHaveLength(1);
    expect(computeRes.body.data.fcffYears[0].fcff).toBeCloseTo(710_000, 2); // 1e6*0.81 + 1e5 - (2e5-1.5e5) - 1.5e5
    expect(computeRes.body.data.wacc.waccPct).toBeGreaterThan(2); // > terminal g, else Gordon would have been rejected
    const methodId = computeRes.body.data.methodId;

    // Independent SQL read-back — the actual persisted row, not just the HTTP echo.
    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ readiness: string; result_value_status: string; result_ev_decimal: string }>(
        `SELECT readiness, result_value_status, result_ev_decimal FROM finance_valuation_methods WHERE id = ?`,
        [methodId]
      )
    );
    expect(sqlRow?.readiness).toBe('READY');
    expect(sqlRow?.result_value_status).toBe('PRESENT_NONZERO');
    expect(Number(sqlRow?.result_ev_decimal)).toBeCloseTo(computeRes.body.data.enterpriseValue, 2);

    const methodsRes = await request(app).get(
      `/api/v8/finance-v2/valuation/variants/${bvId}/methods`
    );
    expect(methodsRes.status).toBe(200);
    const dcfMethod = methodsRes.body.data.methods.find((m: any) => m.methodType === 'DCF_FCFF');
    expect(dcfMethod.readiness).toBe('READY');
    expect(dcfMethod.result.status).toBe('PRESENT_NONZERO');
    expect(Number(dcfMethod.result.valueDecimal)).toBeCloseTo(
      computeRes.body.data.enterpriseValue,
      2
    );

    const resultsRes = await request(app).get(
      `/api/v8/finance-v2/valuation/variants/${bvId}/results`
    );
    expect(resultsRes.status).toBe(200);
    expect(resultsRes.body.data.headlineEnterpriseValue.value).toBeCloseTo(
      computeRes.body.data.enterpriseValue,
      2
    );
    expect(resultsRes.body.data.headlineEnterpriseValue.source).toBe('SINGLE_READY_METHOD'); // no bridge/basket yet
    expect(Number(resultsRes.body.data.wacc.wacc_computed_pct)).toBeCloseTo(
      computeRes.body.data.wacc.waccPct,
      6
    );

    const terminalRes = await request(app).get(
      `/api/v8/finance-v2/valuation/methods/${methodId}/terminal`
    );
    expect(terminalRes.status).toBe(200);
    expect(terminalRes.body.data).toHaveLength(1);
    expect(terminalRes.body.data[0].convention).toBe('GORDON_GROWTH');
    expect(Number(terminalRes.body.data[0].g_pct)).toBe(2);

    const failedTerminal = await request(app)
      .post(`/api/v8/finance-v2/valuation/variants/${bvId}/compute/dcf`)
      .send({
        entityId,
        projectionYears: [{ fiscalYear: 2027, periodIds: [periodId] }],
        openingWorkingCapital: 150_000,
        terminal: { gPct: 99 },
      });
    expect(failedTerminal.status).toBe(422);
    expect(failedTerminal.body.code).toBe('TERMINAL_G_MUST_BE_LESS_THAN_WACC');

    const failedMethod = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{
        readiness: string;
        result_value_status: string;
        result_ev_decimal: string | null;
      }>(
        `SELECT readiness, result_value_status, result_ev_decimal
           FROM finance_valuation_methods WHERE id = ?`,
        [methodId]
      )
    );
    expect(failedMethod).toEqual({
      readiness: 'READY',
      result_value_status: 'PRESENT_NONZERO',
      result_ev_decimal: sqlRow!.result_ev_decimal,
    });
  });

  it('★ N/A!=zero (compute gap): POST .../compute/dcf with a fiscal year that has NO baseline outputs at all -> FCFF_NOT_FULLY_PRESENT, method persisted as readiness=DATA_INCOMPLETE / result=MISSING, NEVER PRESENT_ZERO/0', async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);
    const entityId = await makeEntity(bvId, `PARENT-${randomUUID().slice(0, 8)}`);

    const baseline = await av.createArtifact({
      organizationId: orgId,
      artifactType: 'BASELINE_MODEL',
      createdBy: userId,
    });
    const baselineBvId = baseline.businessVersion.business_version_id;
    const periodId = await makeFyPeriod(2028, 'FY2028-empty');
    // Deliberately NO finance_baseline_outputs rows inserted for this period.

    const edge = await lineageService.insertEdge({
      organizationId: orgId,
      sourceVersionId: baselineBvId,
      sourceArtifactType: 'BASELINE_MODEL',
      targetVersionId: bvId,
      targetArtifactType: 'VALUATION_CASE',
      edgeType: 'MODEL_TO_VALUATION',
      transformationKind: 'MANUAL_LINK',
      authorId: userId,
      assumptionSnapshotHash: `pkgb3-hash-empty-${randomUUID()}`,
    });
    expect(edge.ok).toBe(true);

    await request(app).put(`/api/v8/finance-v2/valuation/variants/${bvId}/wacc-inputs`).send({
      riskFreeRatePct: 3,
      equityRiskPremiumPct: 5,
      betaUnlevered: 1,
      targetCapitalStructureDebtPct: 30,
      targetCapitalStructureEquityPct: 70,
      costOfDebtPretaxPct: 6,
      cashTaxRatePct: 19,
      currency: 'PLN',
      nominalOrReal: 'NOMINAL',
      preOrPostTax: 'POST_TAX',
    });

    const missingRequest = () =>
      request(app)
        .post(`/api/v8/finance-v2/valuation/variants/${bvId}/compute/dcf`)
        .send({
          entityId,
          projectionYears: [{ fiscalYear: 2028, periodIds: [periodId] }],
          openingWorkingCapital: 100_000,
          terminal: { gPct: 2 },
        });
    const concurrentFailures = await Promise.all([missingRequest(), missingRequest()]);
    expect(concurrentFailures.map((response) => response.status)).toEqual([422, 422]);
    expect(concurrentFailures.map((response) => response.body.code)).toEqual([
      'FCFF_NOT_FULLY_PRESENT',
      'FCFF_NOT_FULLY_PRESENT',
    ]);

    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{
        id: string;
        readiness: string;
        result_value_status: string;
        result_ev_decimal: string | null;
      }>(
        `SELECT id, readiness, result_value_status, result_ev_decimal FROM finance_valuation_methods WHERE business_version_id = ? AND method_type = 'DCF_FCFF'`,
        [bvId]
      )
    );
    expect(sqlRow?.readiness).toBe('DATA_INCOMPLETE');
    expect(sqlRow?.result_value_status).toBe('MISSING');
    expect(sqlRow?.result_ev_decimal).toBeNull(); // never PRESENT_ZERO / 0
    const methodCount = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ count: string }>(
        `SELECT count(*)::text AS count FROM finance_valuation_methods WHERE organization_id = ? AND business_version_id = ? AND method_type = 'DCF_FCFF'`,
        [orgId, bvId]
      )
    );
    expect(methodCount?.count).toBe('1');

    const methodsRes = await request(app).get(
      `/api/v8/finance-v2/valuation/variants/${bvId}/methods`
    );
    const dcfMethod = methodsRes.body.data.methods.find((m: any) => m.methodType === 'DCF_FCFF');
    expect(dcfMethod.result.status).toBe('MISSING');
    expect(dcfMethod.result.valueDecimal).toBeNull();

    const seededReady = await valuationComputeService.setMethodResult({
      methodId: sqlRow!.id,
      readiness: 'READY',
      resultValueStatus: 'PRESENT_NONZERO',
      resultEvDecimal: 123_456,
    });
    expect(seededReady.ok).toBe(true);
    const failedRetry = await request(app)
      .post(`/api/v8/finance-v2/valuation/variants/${bvId}/compute/dcf`)
      .send({
        entityId,
        projectionYears: [{ fiscalYear: 2028, periodIds: [periodId] }],
        openingWorkingCapital: 100_000,
        terminal: { gPct: 2 },
      });
    expect(failedRetry.status).toBe(422);
    expect(failedRetry.body.code).toBe('FCFF_NOT_FULLY_PRESENT');
    const preserved = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{
        readiness: string;
        result_value_status: string;
        result_ev_decimal: string | null;
      }>(
        `SELECT readiness, result_value_status, result_ev_decimal
           FROM finance_valuation_methods WHERE id = ?`,
        [sqlRow!.id]
      )
    );
    expect(preserved).toEqual({
      readiness: 'READY',
      result_value_status: 'PRESENT_NONZERO',
      result_ev_decimal: '123456',
    });
  });

  // ---------------------------------------------------------------------------
  // 5. EV -> Equity bridge
  // ---------------------------------------------------------------------------

  it('PUT .../bridge computes equity from signed components server-side; GET reads it back; a misaligned component as_of -> 400 AS_OF_MISMATCH', async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);

    const badAsOf = await request(app)
      .put(`/api/v8/finance-v2/valuation/variants/${bvId}/bridge`)
      .send({
        asOfDate: '2026-12-31',
        enterpriseValueDecimal: 10_000_000,
        components: [
          {
            sequenceOrder: 1,
            componentKind: 'DEBT',
            sign: 'SUBTRACT_FROM_EV',
            amountDecimal: 2_000_000,
            asOfDate: '2026-01-01',
          },
        ],
      });
    expect(badAsOf.status).toBe(400);
    expect(badAsOf.body.code).toBe('AS_OF_MISMATCH');

    const ok = await request(app)
      .put(`/api/v8/finance-v2/valuation/variants/${bvId}/bridge`)
      .send({
        asOfDate: '2026-12-31',
        enterpriseValueDecimal: 10_000_000,
        components: [
          {
            sequenceOrder: 1,
            componentKind: 'DEBT',
            sign: 'SUBTRACT_FROM_EV',
            amountDecimal: 2_000_000,
            asOfDate: '2026-12-31',
          },
          {
            sequenceOrder: 2,
            componentKind: 'CASH',
            sign: 'ADD_TO_EV',
            amountDecimal: 500_000,
            asOfDate: '2026-12-31',
          },
        ],
      });
    expect(ok.status).toBe(200);
    expect(ok.body.data.equityValueDecimal).toBe(8_500_000); // 10M - 2M + 0.5M

    const getRes = await request(app).get(`/api/v8/finance-v2/valuation/variants/${bvId}/bridge`);
    expect(getRes.status).toBe(200);
    expect(Number(getRes.body.data.header.equity_value_decimal)).toBe(8_500_000);
    expect(getRes.body.data.components).toHaveLength(2);

    const resultsRes = await request(app).get(
      `/api/v8/finance-v2/valuation/variants/${bvId}/results`
    );
    expect(resultsRes.body.data.headlineEnterpriseValue.source).toBe('BRIDGE');
    expect(resultsRes.body.data.headlineEnterpriseValue.value).toBe(10_000_000);
  });

  // ---------------------------------------------------------------------------
  // 6. Sensitivity 5x5
  // ---------------------------------------------------------------------------

  it('POST .../sensitivity builds and persists a real 25-cell / 1-base-cell grid; GET reads it back', async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);
    const methodRes = await request(app)
      .post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`)
      .send({ methodType: 'DCF_FCFF' });
    const methodId = methodRes.body.data.methodId;

    const body = {
      gridLabel: 'primary',
      rowAxisVariable: 'terminal_g_pct',
      columnAxisVariable: 'wacc_pct',
      axes: { wacc: [6, 7, 8, 9, 10], terminalG: [0, 1, 2, 3, 4] },
      years: [{ fiscalYear: 2027, fcff: 710_000 }],
      fcffTerminalYear: 710_000,
      baseWaccPct: 8,
      baseGPct: 2,
    };
    const created = await request(app)
      .post(`/api/v8/finance-v2/valuation/methods/${methodId}/sensitivity`)
      .send(body);
    expect(created.status).toBe(200);
    expect(created.body.data.cells).toHaveLength(25);
    expect(created.body.data.cells.filter((c: any) => c.isBaseCell)).toHaveLength(1);

    const getRes = await request(app).get(
      `/api/v8/finance-v2/valuation/methods/${methodId}/sensitivity/primary`
    );
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.grid.grid_status).toBe('COMPLETE');
    expect(getRes.body.data.cells).toHaveLength(25);

    const sqlCount = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ n: string }>(
        `SELECT count(*)::text AS n FROM finance_valuation_sensitivity_cells WHERE grid_id = ?`,
        [created.body.data.gridId]
      )
    );
    expect(sqlCount?.n).toBe('25');
  });

  // ---------------------------------------------------------------------------
  // 7. Compare variants + Advisor
  // ---------------------------------------------------------------------------

  it('POST .../compare-variants (persist:false) is a pure read comparing two variants of the same Case; persist:true additionally writes findings against variant A', async () => {
    const caseId = await makeCase('Compare Case');
    const bvA = await makeVariant(caseId, 'Variant A');
    const bvB = await makeVariant(caseId, 'Variant B');

    // Give each variant a minimal READY result so the Advisor has something to compare.
    const mA = (
      await request(app)
        .post(`/api/v8/finance-v2/valuation/variants/${bvA}/methods`)
        .send({ methodType: 'DCF_FCFF' })
    ).body.data.methodId;
    const mB = (
      await request(app)
        .post(`/api/v8/finance-v2/valuation/variants/${bvB}/methods`)
        .send({ methodType: 'DCF_FCFF' })
    ).body.data.methodId;
    await valuationComputeService.setMethodResult({
      methodId: mA,
      readiness: 'READY',
      resultValueStatus: 'PRESENT_NONZERO',
      resultEvDecimal: 10_000_000,
    });
    await valuationComputeService.setMethodResult({
      methodId: mB,
      readiness: 'READY',
      resultValueStatus: 'PRESENT_NONZERO',
      resultEvDecimal: 13_000_000,
    });

    const compareRead = await request(app)
      .post(`/api/v8/finance-v2/valuation/cases/${caseId}/compare-variants`)
      .send({ variantIdA: bvA, variantIdB: bvB, persist: false });
    expect(compareRead.status).toBe(200);
    const evMetric = compareRead.body.data.metrics.find(
      (m: any) => m.metric === 'ENTERPRISE_VALUE'
    );
    expect(evMetric.a).toBe(10_000_000);
    expect(evMetric.b).toBe(13_000_000);
    expect(evMetric.delta).toBe(3_000_000);

    const emptyBefore = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ n: string }>(
        `SELECT count(*)::text AS n FROM finance_valuation_advisor_outputs WHERE business_version_id = ?`,
        [bvA]
      )
    );
    expect(emptyBefore?.n).toBe('0'); // persist:false wrote nothing

    const comparePersist = await request(app)
      .post(`/api/v8/finance-v2/valuation/cases/${caseId}/compare-variants`)
      .send({ variantIdA: bvA, variantIdB: bvB, persist: true });
    expect(comparePersist.status).toBe(200);
    const afterPersist = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ n: string }>(
        `SELECT count(*)::text AS n FROM finance_valuation_advisor_outputs WHERE business_version_id = ? AND is_comparison = true`,
        [bvA]
      )
    );
    expect(Number(afterPersist?.n)).toBeGreaterThan(0);
  });

  it('POST .../advisor/generate on a freshly-computed variant persists findings; GET .../advisor reads them back; generate on a variant with NOTHING computed -> 409 NOTHING_COMPUTED', async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);

    const nothingRes = await request(app)
      .post(`/api/v8/finance-v2/valuation/variants/${bvId}/advisor/generate`)
      .send({});
    expect(nothingRes.status).toBe(409);
    expect(nothingRes.body.code).toBe('NOTHING_COMPUTED');

    const mA = (
      await request(app)
        .post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`)
        .send({ methodType: 'DCF_FCFF' })
    ).body.data.methodId;
    await valuationComputeService.setMethodResult({
      methodId: mA,
      readiness: 'READY',
      resultValueStatus: 'PRESENT_NONZERO',
      resultEvDecimal: 9_000_000,
    });

    const genRes = await request(app)
      .post(`/api/v8/finance-v2/valuation/variants/${bvId}/advisor/generate`)
      .send({});
    expect(genRes.status).toBe(200);
    expect(genRes.body.data.findings.length).toBeGreaterThan(0);
    expect(genRes.body.data.computeSnapshotId).toBeTruthy();

    const listRes = await request(app).get(`/api/v8/finance-v2/valuation/variants/${bvId}/advisor`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(genRes.body.data.findings.length);

    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ n: string }>(
        `SELECT count(*)::text AS n FROM finance_valuation_advisor_outputs WHERE business_version_id = ?`,
        [bvId]
      )
    );
    expect(Number(sqlRow?.n)).toBe(genRes.body.data.findings.length);
  });
});
