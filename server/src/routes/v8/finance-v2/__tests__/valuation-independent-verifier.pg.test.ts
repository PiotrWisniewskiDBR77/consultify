/**
 * INDEPENDENT VERIFIER — NOT part of Pakiet B3's own test suite.
 *
 * Written by an independent reviewer (not the package author) to directly and unambiguously
 * confirm/deny claim #8 from the author's report: that a second, byte-identical
 * POST .../compute/dcf call throws an unhandled 500 instead of replaying idempotently, because
 * `runDcfFcffValuation()` (valuationComputeService.ts) discards the `wasExisting` flag returned by
 * `computeJobService.enqueue()` and unconditionally calls `claimById()`, which only matches
 * status='queued' rows.
 *
 * Unlike the author's own `valuation-b3-review.routes.pg.test.ts` "DISCOVERY" test (which branches
 * on `second.status === 200` and therefore passes either way), this test makes a single, unbranched
 * assertion: the second call MUST be 500 with the specific "failed to self-claim" message. If the
 * bug is fixed later, this test will fail loudly instead of silently passing under a different
 * branch — that is the point of an independent, non-branching reproduction.
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

describe.skipIf(!REAL_PG)('INDEPENDENT VERIFIER — Pakiet B3 claim #8 (DCF idempotent-replay 500)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
  let lineageService: typeof import('../../../../services/finance/canonical/lineageService.js');
  let financeV2Router: express.Router;

  const orgId = `org-indepver-${randomUUID()}`;
  const userId = `user-indepver-${randomUUID()}`;
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

  async function makeCase(name = `Indep Case ${randomUUID().slice(0, 8)}`) {
    const res = await request(app).post('/api/v8/finance-v2/valuation/cases').send({ name });
    expect(res.status).toBe(201);
    return res.body.data.caseId as string;
  }

  async function makeVariant(caseId: string, name = `Indep Variant ${randomUUID().slice(0, 8)}`) {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'VALUATION_CASE' });
    expect(created.status).toBe(201);
    const bvId = created.body.data.currentBusinessVersion.businessVersionId as string;
    const res = await request(app).post(`/api/v8/finance-v2/valuation/cases/${caseId}/variants`).send({ businessVersionId: bvId, name });
    expect(res.status).toBe(201);
    return bvId;
  }

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

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    lineageService = await import('../../../../services/finance/canonical/lineageService.js');
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'Independent Verifier Org']));
    app = appAs('finance_admin');
  }, 60000);

  it('a byte-identical repeat POST .../compute/dcf UNAMBIGUOUSLY 500s with "failed to self-claim" — not a branching assertion', async () => {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);
    const entityId = await makeEntity(bvId, `PARENT-${randomUUID().slice(0, 8)}`);

    const baseline = await av.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: userId });
    const baselineBvId = baseline.businessVersion.business_version_id;
    const periodId = await makeFyPeriod(2031, 'FY2031-indepver');

    const ebitId = await lineId('EBIT');
    const daId = await lineId('DEPRECIATION');
    const capexId = await lineId('CAPEX');
    const wcId = await lineId('WORKING_CAPITAL');
    await seedBaselineOutput(baselineBvId, entityId, periodId, ebitId, 'P&L', 900_000);
    await seedBaselineOutput(baselineBvId, entityId, periodId, daId, 'P&L', 90_000);
    await seedBaselineOutput(baselineBvId, entityId, periodId, capexId, 'CF', 120_000);
    await seedBaselineOutput(baselineBvId, entityId, periodId, wcId, 'BS', 180_000);

    const edge = await lineageService.insertEdge({
      organizationId: orgId,
      sourceVersionId: baselineBvId,
      sourceArtifactType: 'BASELINE_MODEL',
      targetVersionId: bvId,
      targetArtifactType: 'VALUATION_CASE',
      edgeType: 'MODEL_TO_VALUATION',
      transformationKind: 'MANUAL_LINK',
      authorId: userId,
      assumptionSnapshotHash: `indepver-hash-${randomUUID()}`,
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

    const requestBody = { entityId, projectionYears: [{ fiscalYear: 2031, periodIds: [periodId] }], openingWorkingCapital: 120_000, terminal: { gPct: 2 } };

    const first = await request(app).post(`/api/v8/finance-v2/valuation/variants/${bvId}/compute/dcf`).send(requestBody);
    expect(first.status).toBe(200);

    // Give claimById's downstream completeJobSuccess a moment to actually commit (it's synchronous
    // in-process, but be explicit rather than racing).
    const firstJobStatus = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ status: string }>(`SELECT status FROM compute_jobs WHERE organization_id = ? AND job_type = 'VALUATION_COMPUTE' ORDER BY created_at DESC LIMIT 1`, [orgId])
    );
    expect(firstJobStatus?.status).toBe('succeeded'); // precondition: the row claimById() would need is NOT 'queued' anymore

    const second = await request(app).post(`/api/v8/finance-v2/valuation/variants/${bvId}/compute/dcf`).send(requestBody);

    // Unbranched, single-outcome assertion — the whole point of an independent probe.
    expect(second.status).toBe(500);
    expect(String(second.body.error || '')).toMatch(/failed to self-claim just-enqueued job/);
    expect(String(second.body.error || '')).toMatch(/no longer 'queued'/);
  });
});
