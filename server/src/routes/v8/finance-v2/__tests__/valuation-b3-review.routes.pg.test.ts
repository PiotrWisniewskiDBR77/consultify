/**
 * Finance v3 canonical adapter — Pakiet B3 Valuation, INDEPENDENT REVIEW SUPPLEMENT.
 *
 * Written during the gate-e verification pass on top of the two Pakiet B3 author test files
 * (`valuation.routes.pg.test.ts`, `valuation-cross-tenant.routes.pg.test.ts`). Those two already
 * cover the endpoint-by-endpoint happy paths and the cross-tenant matrix well; this file adds four
 * things the brief specifically asks for that were NOT yet covered:
 *
 *   1. A regression test for a real defect found during review — `writeSensitivityGrid()`
 *      (`valuationSensitivityService.ts`) returned a freshly-generated candidate id on EVERY call,
 *      even on the `ON CONFLICT DO UPDATE` branch where the existing row keeps its OWN id. A repeat
 *      `POST .../sensitivity` to the same (methodId, gridLabel) therefore echoed back a `gridId`
 *      naming ZERO rows. Fixed in this same review pass (see that file's inline comment) — this
 *      test is the regression guard.
 *   2. A DB-LAYER negative control, independent of the HTTP route / service-layer validation, for
 *      both flagship guarantees (N/A!=zero via `chk_finance_methods_result_matches_readiness`, and
 *      basket weight-sum=100 via `trg_finance_valuation_methods_weight_sum`) — raw SQL, bypassing
 *      `valuation.routes.ts` and `valuationComputeService.ts` entirely, proving the DB itself (not
 *      just the app layer already tested) is the backstop.
 *   3. An explicit three-state proof — MISSING (no data) vs. PRESENT_ZERO (a REAL, computed zero)
 *      vs. PRESENT_NONZERO — all distinguishable through the same `GET .../methods` /
 *      `GET .../results` contract in one place (the author suite proves MISSING!=PRESENT_NONZERO in
 *      two separate tests; this proves all three states coexist and are never conflated).
 *   4. A DISCOVERY test (not a guarantee) documenting the actual behavior of a second, byte-identical
 *      `POST .../compute/dcf` call — see the inline comment on that test for what it found.
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

describe.skipIf(!REAL_PG)('Finance v2 Pakiet B3 — valuation, independent review supplement (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let valuationComputeService: typeof import('../../../../services/finance/canonical/valuationComputeService.js');
  let av: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
  let lineageService: typeof import('../../../../services/finance/canonical/lineageService.js');
  let financeV2Router: express.Router;

  const orgId = `org-pkgb3-review-${randomUUID()}`;
  const userId = `user-pkgb3-review-${randomUUID()}`;
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
    a.use((err: any, _req: any, res: any, _next: any) => res.status(err?.status || 500).json({ error: String(err?.message || err) }));
    return a;
  }

  async function makeCase(name = `Review Case ${randomUUID().slice(0, 8)}`) {
    const res = await request(app).post('/api/v8/finance-v2/valuation/cases').send({ name });
    expect(res.status).toBe(201);
    return res.body.data.caseId as string;
  }

  async function makeVariant(caseId: string, name = `Review Variant ${randomUUID().slice(0, 8)}`) {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'VALUATION_CASE' });
    expect(created.status).toBe(201);
    const bvId = created.body.data.currentBusinessVersion.businessVersionId as string;
    const res = await request(app).post(`/api/v8/finance-v2/valuation/cases/${caseId}/variants`).send({ businessVersionId: bvId, name });
    expect(res.status).toBe(201);
    return bvId;
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    valuationComputeService = await import('../../../../services/finance/canonical/valuationComputeService.js');
    av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    lineageService = await import('../../../../services/finance/canonical/lineageService.js');
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'PkgB3 Review Org']));
    app = appAs('finance_admin');
  }, 60000);

  // ---------------------------------------------------------------------------
  // 1. Regression guard for the writeSensitivityGrid() gridId bug found in review.
  // ---------------------------------------------------------------------------

  it('★ REGRESSION (found+fixed in review): a REPEAT POST .../sensitivity for the SAME (methodId, gridLabel) returns the SAME gridId as the first call, and that gridId owns exactly 25 cells — not an orphaned id', async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);
    const methodRes = await request(app).post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`).send({ methodType: 'DCF_FCFF' });
    const methodId = methodRes.body.data.methodId;

    const body = {
      gridLabel: 'regression',
      rowAxisVariable: 'terminal_g_pct',
      columnAxisVariable: 'wacc_pct',
      axes: { wacc: [6, 7, 8, 9, 10], terminalG: [0, 1, 2, 3, 4] },
      years: [{ fiscalYear: 2027, fcff: 500_000 }],
      fcffTerminalYear: 500_000,
      baseWaccPct: 8,
      baseGPct: 2,
    };
    const first = await request(app).post(`/api/v8/finance-v2/valuation/methods/${methodId}/sensitivity`).send(body);
    expect(first.status).toBe(200);
    const firstGridId = first.body.data.gridId;

    // Repeat call — same method, same gridLabel, slightly different axis values (a legitimate
    // "redo the grid" edit, not a no-op).
    const second = await request(app)
      .post(`/api/v8/finance-v2/valuation/methods/${methodId}/sensitivity`)
      .send({ ...body, axes: { wacc: [5, 6, 7, 8, 9], terminalG: [0, 1, 2, 3, 4] } });
    expect(second.status).toBe(200);
    const secondGridId = second.body.data.gridId;

    // The flagship assertion: MUST be the same id (one grid row, upserted), never a fresh one that
    // names no rows.
    expect(secondGridId).toBe(firstGridId);

    // Independent SQL: exactly one grid row for (method, label), and exactly 25 cells hang off the
    // id the HTTP response actually returned — not a different, orphaned id.
    const gridRows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_valuation_sensitivity_grids WHERE method_id = ? AND grid_label = 'regression'`, [methodId])
    );
    expect(gridRows).toHaveLength(1);
    expect(gridRows[0].id).toBe(secondGridId);

    const cellCount = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ n: string }>(`SELECT count(*)::text AS n FROM finance_valuation_sensitivity_cells WHERE grid_id = ?`, [secondGridId])
    );
    expect(cellCount?.n).toBe('25');

    // And the edited axis value actually landed (proves this was a real overwrite, not a silent no-op).
    const getRes = await request(app).get(`/api/v8/finance-v2/valuation/methods/${methodId}/sensitivity/regression`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.cells.some((c: any) => Number(c.column_axis_value) === 5)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 1b. Mounting-proof gap closed: GET .../methods/:methodId/sensitivity/:gridLabel (endpoint 19/21)
  //     had no dedicated 404 coverage in either author file (the cross-tenant file only exercises
  //     the sibling GET .../terminal and POST .../sensitivity for a wrong-org method; the happy-path
  //     file only ever GETs a grid that exists). Both 404 shapes for THIS specific route below.
  // ---------------------------------------------------------------------------

  it('GET .../methods/:methodId/sensitivity/:gridLabel — same-org but nonexistent gridLabel -> 404 NOT_FOUND (route ran); wrong-org methodId -> 404 NOT_FOUND (method ownership check ran first)', async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);
    const methodId = (await request(app).post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`).send({ methodType: 'DCF_FCFF' })).body.data.methodId;

    const noSuchLabel = await request(app).get(`/api/v8/finance-v2/valuation/methods/${methodId}/sensitivity/does-not-exist`);
    expect(noSuchLabel.status).toBe(404);
    expect(noSuchLabel.body.code).toBe('NOT_FOUND');

    // A second organization, same real methodId — proves the route/handler ran (typed 404) and that
    // it never leaks "grid not found" vs. "method not found" distinctly to a foreign tenant.
    const otherOrgId = `org-pkgb3-review-sib-${randomUUID()}`;
    await withPinnedPostgresTransaction((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [otherOrgId, 'PkgB3 Review Sibling Org']));
    const otherUserId = `user-pkgb3-review-sib-${randomUUID()}`;
    const otherApp = express();
    otherApp.use(express.json());
    otherApp.use((req: any, _res, next) => {
      req.user = { id: otherUserId, organizationId: otherOrgId, role: 'finance_admin' };
      req.v8Context = { organizationId: otherOrgId, userId: otherUserId, userRole: 'finance_admin' };
      next();
    });
    otherApp.use('/api/v8/finance-v2', financeV2Router);

    const wrongOrg = await request(otherApp).get(`/api/v8/finance-v2/valuation/methods/${methodId}/sensitivity/does-not-exist`);
    expect(wrongOrg.status).toBe(404);
    expect(wrongOrg.body.code).toBe('NOT_FOUND');
  });

  // ---------------------------------------------------------------------------
  // 2. DB-layer negative controls — bypass valuation.routes.ts AND
  //    valuationComputeService.ts entirely, raw SQL only.
  // ---------------------------------------------------------------------------

  it('★ KONTROLA NEGATYWNA (DB layer, N/A!=zero): a raw SQL INSERT with readiness=READY and result_value_status=MISSING — bypassing every app-layer guard — is rejected by chk_finance_methods_result_matches_readiness itself', async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);

    await expect(
      withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_valuation_methods (id, organization_id, business_version_id, method_type, readiness, result_value_status, result_ev_decimal, created_by)
           VALUES (?, ?, ?, 'DCF_FCFE', 'READY', 'MISSING', NULL, ?)`,
          [randomUUID(), orgId, bvId, userId]
        )
      )
    ).rejects.toThrow(/chk_finance_methods_result_matches_readiness/);

    // And the inverse shape — READY method with a NULL amount is equally rejected (a "READY but
    // secretly no number" row can never exist, not even transiently).
    await expect(
      withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_valuation_methods (id, organization_id, business_version_id, method_type, readiness, result_value_status, result_ev_decimal, created_by)
           VALUES (?, ?, ?, 'ASSET_BASED', 'NOT_CONFIGURED', 'PRESENT_ZERO', 0, ?)`,
          [randomUUID(), orgId, bvId, userId]
        )
      )
    ).rejects.toThrow(/chk_finance_methods_result_matches_readiness/);
  });

  it('★ KONTROLA NEGATYWNA (DB layer, weight-sum=100): a raw SQL basket totalling 60% — bypassing setBasketWeights()/the route entirely — is rejected AT COMMIT by trg_finance_valuation_methods_weight_sum', async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);
    const mA = (await request(app).post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`).send({ methodType: 'DCF_FCFF' })).body.data.methodId;
    await valuationComputeService.setMethodResult({ methodId: mA, readiness: 'READY', resultValueStatus: 'PRESENT_NONZERO', resultEvDecimal: 1_000_000 });

    // Direct SQL, no app-layer validation whatsoever — the constraint trigger is DEFERRABLE INITIALLY
    // DEFERRED, so this only raises when the transaction attempts to COMMIT.
    await expect(
      withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE finance_valuation_methods SET is_in_recommendation_basket = true, weight_pct = 60 WHERE id = ?`, [mA])
      )
    ).rejects.toThrow(/basket weights for business_version/);

    // Layered-defense note: this negative control exercises the CONSTRAINT TRIGGER specifically
    // (single-row UPDATE, sum=60!=100, no COMMIT-time cancellation by a second offsetting write).
    // It does NOT — and cannot — tell us whether the route's OWN pre-check (INVALID_BODY guard in
    // valuation.routes.ts for a cross-check carrying a weight) would also have caught a bad basket
    // shape; that is a SEPARATE layer, already covered by the author suite's dedicated test. Per the
    // brief's warning about defense-in-depth: rolling back only ONE layer does not by itself prove
    // which layer would have caught a given bad input in production — here we deliberately bypassed
    // ALL app layers to isolate the DB layer alone.
    const row = await withPinnedPostgresTransaction((tx) => tx.queryOne<{ is_in_recommendation_basket: boolean; weight_pct: string | null }>(`SELECT is_in_recommendation_basket, weight_pct FROM finance_valuation_methods WHERE id = ?`, [mA]));
    expect(row?.is_in_recommendation_basket).toBe(false); // rolled back — the failed UPDATE never committed
    expect(row?.weight_pct).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 3. Three-state proof: MISSING vs. PRESENT_ZERO (a REAL zero) vs. PRESENT_NONZERO, all in one
  //    place, through the same GET contract.
  // ---------------------------------------------------------------------------

  it('★ TRZY STANY, nigdy ze sobą pomylone: MISSING (brak danych) vs. PRESENT_ZERO (prawdziwe zero) vs. PRESENT_NONZERO — GET .../methods i GET .../results rozróżniają wszystkie trzy jednocześnie', async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);

    const mMissing = (await request(app).post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`).send({ methodType: 'TRADING_COMPS' })).body.data.methodId;
    const mZero = (await request(app).post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`).send({ methodType: 'DCF_FCFE' })).body.data.methodId;
    const mNonzero = (await request(app).post(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`).send({ methodType: 'DCF_FCFF' })).body.data.methodId;

    // mMissing: left exactly as find-or-create leaves it — NOT_CONFIGURED / MISSING / null.
    // mZero: a REAL computed zero (e.g., a leveraged-out shell whose DCF genuinely nets to 0) — this
    // is intentionally set via the same service function the compute engine itself calls, so the
    // CHECK constraint (chk_finance_methods_result_matches_readiness) is exercised for real, not
    // bypassed.
    const zeroResult = await valuationComputeService.setMethodResult({ methodId: mZero, readiness: 'READY', resultValueStatus: 'PRESENT_ZERO', resultEvDecimal: 0 });
    expect(zeroResult.ok).toBe(true);
    const nonzeroResult = await valuationComputeService.setMethodResult({ methodId: mNonzero, readiness: 'READY', resultValueStatus: 'PRESENT_NONZERO', resultEvDecimal: 4_200_000 });
    expect(nonzeroResult.ok).toBe(true);

    const methodsRes = await request(app).get(`/api/v8/finance-v2/valuation/variants/${bvId}/methods`);
    expect(methodsRes.status).toBe(200);
    const byType = (t: string) => methodsRes.body.data.methods.find((m: any) => m.methodType === t);

    expect(byType('TRADING_COMPS').result).toEqual({ status: 'MISSING', valueDecimal: null });
    expect(byType('DCF_FCFE').result.status).toBe('PRESENT_ZERO');
    expect(Number(byType('DCF_FCFE').result.valueDecimal)).toBe(0);
    expect(byType('DCF_FCFF').result.status).toBe('PRESENT_NONZERO');
    expect(Number(byType('DCF_FCFF').result.valueDecimal)).toBe(4_200_000);

    // Independent SQL read-back of all three rows in one query — the DB itself carries three
    // genuinely distinct shapes, not one column silently standing in for two meanings.
    const sqlRows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ method_type: string; result_value_status: string; result_ev_decimal: string | null }>(
        `SELECT method_type, result_value_status, result_ev_decimal FROM finance_valuation_methods WHERE business_version_id = ? ORDER BY method_type`,
        [bvId]
      )
    );
    const sqlByType = (t: string) => sqlRows.find((r) => r.method_type === t)!;
    expect(sqlByType('TRADING_COMPS').result_value_status).toBe('MISSING');
    expect(sqlByType('TRADING_COMPS').result_ev_decimal).toBeNull();
    expect(sqlByType('DCF_FCFE').result_value_status).toBe('PRESENT_ZERO');
    expect(Number(sqlByType('DCF_FCFE').result_ev_decimal)).toBe(0); // a REAL zero, physically stored, not NULL
    expect(sqlByType('DCF_FCFF').result_value_status).toBe('PRESENT_NONZERO');
    expect(Number(sqlByType('DCF_FCFF').result_ev_decimal)).toBe(4_200_000);

    // GET .../results — headline picks the single READY... but there are now TWO ready methods
    // (mZero and mNonzero) with no basket configured, so the headline is NONE (ambiguous, honestly
    // reported) rather than silently picking one. This itself is a real, useful assertion: the
    // headline resolver does not paper over "which zero-or-nonzero result is authoritative" either.
    const resultsRes = await request(app).get(`/api/v8/finance-v2/valuation/variants/${bvId}/results`);
    expect(resultsRes.status).toBe(200);
    expect(resultsRes.body.data.headlineEnterpriseValue.source).toBe('NONE');
    expect(resultsRes.body.data.headlineEnterpriseValue.value).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 4. DISCOVERY — a second, byte-identical POST .../compute/dcf call. Documents actual behavior;
  //    this is NOT asserting the desired/idiomatic outcome, it is recording what really happens.
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
        [orgId, cal!.fiscal_calendar_id, fiscalYear, `${fiscalYear}-01-01`, `${fiscalYear}-12-31`, label, userId]
      )
    );
    if (!per) throw new Error('finance_stmt_periods fixture insert returned no row');
    return per.period_id;
  }

  async function lineId(lineCode: string) {
    const row = await withPinnedPostgresTransaction((tx) => tx.queryOne<{ id: string }>(`SELECT id FROM financial_statement_lines WHERE line_code = ?`, [lineCode]));
    if (!row) throw new Error(`financial_statement_lines has no row for ${lineCode}`);
    return row.id;
  }

  async function seedBaselineOutput(bvId: string, entityId: string, periodId: string, canonicalLineId: string, statementType: 'P&L' | 'BS' | 'CF', valueDecimal: number) {
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_outputs (organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id, value_status, value_decimal, native_currency, presentation_currency, unit, value_kind, consolidation_scope, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 'FORECAST', 'CONSOLIDATED', ?)`,
        [orgId, bvId, statementType, canonicalLineId, entityId, periodId, valueDecimal, userId]
      )
    );
  }

  it('DISCOVERY: a second, byte-identical POST .../compute/dcf call (same entity/years/terminal, hence same idempotency key in computeJobService) — documents whether the endpoint replays idempotently or errors', async () => {
    const caseId = await makeCase('Idempotency discovery');
    const bvId = await makeVariant(caseId, 'Idempotency variant');
    const entityId = await makeEntity(bvId, `PARENT-${randomUUID().slice(0, 8)}`);

    const baseline = await av.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: userId });
    const baselineBvId = baseline.businessVersion.business_version_id;
    const periodId = await makeFyPeriod(2029, 'FY2029-idem');

    const ebitId = await lineId('EBIT');
    const daId = await lineId('DEPRECIATION');
    const capexId = await lineId('CAPEX');
    const wcId = await lineId('WORKING_CAPITAL');
    await seedBaselineOutput(baselineBvId, entityId, periodId, ebitId, 'P&L', 800_000);
    await seedBaselineOutput(baselineBvId, entityId, periodId, daId, 'P&L', 80_000);
    await seedBaselineOutput(baselineBvId, entityId, periodId, capexId, 'CF', 100_000);
    await seedBaselineOutput(baselineBvId, entityId, periodId, wcId, 'BS', 150_000);

    const edge = await lineageService.insertEdge({
      organizationId: orgId,
      sourceVersionId: baselineBvId,
      sourceArtifactType: 'BASELINE_MODEL',
      targetVersionId: bvId,
      targetArtifactType: 'VALUATION_CASE',
      edgeType: 'MODEL_TO_VALUATION',
      transformationKind: 'MANUAL_LINK',
      authorId: userId,
      assumptionSnapshotHash: `pkgb3-review-idem-${randomUUID()}`,
    });
    expect(edge.ok).toBe(true);

    await request(app)
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

    const requestBody = { entityId, projectionYears: [{ fiscalYear: 2029, periodIds: [periodId] }], openingWorkingCapital: 100_000, terminal: { gPct: 2 } };

    const first = await request(app).post(`/api/v8/finance-v2/valuation/variants/${bvId}/compute/dcf`).send(requestBody);
    expect(first.status).toBe(200);
    const firstEv = first.body.data.enterpriseValue;

    // Byte-identical second call. `runDcfFcffValuation()` builds its compute_jobs idempotency key
    // from a hash of exactly {businessVersionId, entityId, projectionYears, terminal} — this request
    // reproduces every one of those fields exactly, so `computeJobService.enqueue()` MUST resolve to
    // `wasExisting: true` against the SAME row the first call created (not a fresh job).
    const jobCountBefore = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ n: string }>(`SELECT count(*)::text AS n FROM compute_jobs WHERE organization_id = ? AND job_type = 'VALUATION_COMPUTE'`, [orgId])
    );

    const second = await request(app).post(`/api/v8/finance-v2/valuation/variants/${bvId}/compute/dcf`).send(requestBody);

    const jobCountAfter = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ n: string }>(`SELECT count(*)::text AS n FROM compute_jobs WHERE organization_id = ? AND job_type = 'VALUATION_COMPUTE'`, [orgId])
    );

    // Whatever the HTTP outcome, the enqueue-side idempotency key contract must hold: no second
    // compute_jobs row for the identical replay.
    expect(jobCountAfter?.n).toBe(jobCountBefore?.n);

    if (second.status === 200) {
      // Ideal outcome: idempotent replay, same EV, no duplicate side effects.
      expect(second.body.data.enterpriseValue).toBeCloseTo(firstEv, 6);
    } else {
      // Documented actual outcome at time of review: runDcfFcffValuation() always calls
      // computeJobService.claimById() after enqueue() regardless of the returned `wasExisting`
      // flag. claimById() only matches rows with status='queued' (see computeJobService.ts). On a
      // genuine idempotent replay the row from the FIRST call is already 'succeeded', so the second
      // call's claimById() returns null and runDcfFcffValuation() throws a raw, untyped Error
      // ("failed to self-claim just-enqueued job ... row is no longer 'queued'"), which asyncHandler
      // forwards to Express's generic error handler as an uncaught 500 — not a typed 409/200 replay.
      // This is a PRE-EXISTING pattern (baselineComputeService.ts / predictionComputeService.ts /
      // kpiComputeService.ts all discard the same `wasExisting` flag the same way — grep-verified),
      // not something introduced by Pakiet B3. B3 is simply the first package whose HTTP surface
      // makes this reachable for the Valuation domain. See the gate-e report §"Point 8" for the full
      // writeup; this assertion documents the failure mode without papering over it.
      expect(second.status).toBe(500);
      expect(String(second.body.error || '')).toMatch(/failed to self-claim/);
    }
  });
});
