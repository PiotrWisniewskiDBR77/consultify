/**
 * INDEPENDENT VERIFIER — NOT part of Pakiet B3's own test suite.
 *
 * Written by an independent reviewer (not the package author) to directly and unambiguously
 * confirm/deny claim #8 from the author's report: that a second, byte-identical
 * POST .../compute/dcf call throws an unhandled 500 instead of replaying idempotently, because
 * `runDcfFcffValuation()` (valuationComputeService.ts) discarded the `wasExisting` flag returned by
 * `computeJobService.enqueue()` and unconditionally called `claimById()`, which only matches
 * status='queued' rows.
 *
 * ★ 2026-08-12 — ASSERTION REVERSED, NOT WEAKENED (read this before assuming the flip is a
 * softening). The P1 defect this file originally proved has since been FIXED
 * (`docs/validation/finance-v3/generated/gate-e/PKG_FIX_CANONICAL_report.md`,
 * `computeJobService.claimForCompute()` is now the single decision point at all five
 * enqueue()->claim() call sites, including this one — see that function's own doc comment for the
 * full outcome table). A byte-identical repeat POST now replays idempotently (HTTP 200, SAME
 * jobId, no second `compute_job_outputs` row) instead of crashing. The ORIGINAL first test below
 * used to assert the bug (second call MUST be 500 "failed to self-claim"); that assertion would now
 * fail forever against correctly-fixed code, so it has been flipped to assert the FIX's contract
 * instead — same non-branching, single-outcome style the original author insisted on ("unlike the
 * author's own DISCOVERY test, which branches on `second.status === 200` and therefore passes either
 * way"). This file keeps doing its job as an independent regression guard: if `claimForCompute()`'s
 * wiring ever regresses (e.g. someone reintroduces an unconditional `claimById()` call), this test
 * goes red again — now by failing the SUCCESS assertion instead of the OLD crash assertion.
 * A second, brand-new test below fills in the case this file never covered before: a duplicate
 * request that arrives while the FIRST attempt is still genuinely `running` (not yet committed).
 * That is NOT the same situation as "first attempt already succeeded" — the kanon and
 * `claimForCompute()` both draw a hard line between them (`already_committed` vs `hard_error`
 * NOT_RUNNING), and conflating the two into one lenient "any duplicate is fine" assertion would
 * silently hide a real regression (a duplicate silently resumed mid-flight). So this file now proves
 * BOTH outcomes separately, at the HTTP layer, each with its own unbranched assertion.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('INDEPENDENT VERIFIER — Pakiet B3 claim #8 (DCF idempotent replay, post-fix)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
  let lineageService: typeof import('../../../../services/finance/canonical/lineageService.js');
  let computeJobService: typeof import('../../../../services/finance/canonical/computeJobService.js');
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

  /** Independent physical read — never a value handed back by the HTTP response or a service call. */
  async function countComputeJobOutputs(jobId: string): Promise<number> {
    const rows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM compute_job_outputs WHERE job_id = ?`, [jobId])
    );
    return rows.length;
  }

  async function readJobStatus(jobId: string): Promise<string | undefined> {
    const row = await withPinnedPostgresTransaction((tx) => tx.queryOne<{ status: string }>(`SELECT status FROM compute_jobs WHERE id = ?`, [jobId]));
    return row?.status;
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    lineageService = await import('../../../../services/finance/canonical/lineageService.js');
    computeJobService = await import('../../../../services/finance/canonical/computeJobService.js');
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'Independent Verifier Org']));
    app = appAs('finance_admin');
  }, 60000);

  /** Shared fixture builder — one fresh case/variant/baseline/period/entity per test, so the two
   *  scenarios below (idempotent success vs still-running hard error) never share mutable state. */
  async function buildFixture() {
    const caseId = await makeCase();
    const bvId = await makeVariant(caseId);
    const entityId = await makeEntity(bvId, `PARENT-${randomUUID().slice(0, 8)}`);

    const baseline = await av.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: userId });
    const baselineBvId = baseline.businessVersion.business_version_id;
    const periodId = await makeFyPeriod(2031, `FY2031-indepver-${randomUUID().slice(0, 8)}`);

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
    return { bvId, requestBody };
  }

  function postDcf(bvId: string, requestBody: Record<string, unknown>) {
    return request(app).post(`/api/v8/finance-v2/valuation/variants/${bvId}/compute/dcf`).send(requestBody);
  }

  it('a byte-identical repeat POST .../compute/dcf replays IDEMPOTENTLY — same jobId, HTTP 200, exactly ONE compute_job_outputs row (independent SQL read), never a re-run', async () => {
    const { bvId, requestBody } = await buildFixture();

    const first = await request(app).post(`/api/v8/finance-v2/valuation/variants/${bvId}/compute/dcf`).send(requestBody);
    expect(first.status).toBe(200);
    const firstJobId = first.body.data.jobId as string;
    expect(typeof firstJobId).toBe('string');
    expect(firstJobId.length).toBeGreaterThan(0);

    // Precondition: the row claimById() would need (status='queued') is genuinely gone — the first
    // call's job has actually reached 'succeeded'. This is what makes the second call exercise the
    // `claimForCompute()` already_committed branch, not a lucky race on a still-queued row.
    const firstJobStatus = await readJobStatus(firstJobId);
    expect(firstJobStatus).toBe('succeeded');

    const second = await request(app).post(`/api/v8/finance-v2/valuation/variants/${bvId}/compute/dcf`).send(requestBody);

    // Unbranched, single-outcome assertion — the whole point of an independent probe. The fix's
    // contract is: idempotent HTTP success, SAME job identity, no new work performed.
    expect(second.status).toBe(200);
    expect(second.body.data.jobId).toBe(firstJobId);

    // Independent read: NOT the HTTP response, NOT a service return value — a fresh SQL SELECT
    // against compute_job_outputs. Exactly one row must exist for this job id, proving the second
    // call did not mint a second output row (the program's own hard gate: "job kill/retry/race daje
    // dokładnie jeden committed output version").
    const outputCount = await countComputeJobOutputs(firstJobId);
    expect(outputCount).toBe(1);
  });

  it('a repeat POST while the FIRST attempt is still `running` (not yet committed) is a HARD 409 JOB_NOT_RUNNING error — never silently resumed, and never conflated with the succeeded-replay case above', async () => {
    const { bvId, requestBody } = await buildFixture();

    // Real interleaving (not a mock of the whole DB): intercept the FIRST call's own
    // completeJobSuccess() and, before letting it actually commit, issue a SECOND byte-identical
    // HTTP POST from inside the interception. At that instant the first job's row is genuinely
    // 'running' (claimed via claimForCompute(), not yet committed) — same technique
    // idempotentComputeRetry.pg.test.ts uses for baselineComputeService, applied here at the HTTP
    // layer for the DCF endpoint specifically (which that suite does not cover for this branch).
    let capturedRunningJobId: string | null = null;
    let capturedSecondResponse: Awaited<ReturnType<typeof postDcf>> | null = null;
    const original = computeJobService.completeJobSuccess;
    const spy = vi.spyOn(computeJobService, 'completeJobSuccess').mockImplementationOnce(async (completeParams) => {
      capturedRunningJobId = completeParams.jobId;
      const runningStatus = await readJobStatus(completeParams.jobId);
      if (runningStatus !== 'running') {
        throw new Error(`fixture: expected job ${completeParams.jobId} to be 'running' at interception time, was '${runningStatus}'`);
      }
      capturedSecondResponse = await postDcf(bvId, requestBody);
      spy.mockRestore();
      return original(completeParams);
    });

    const first = await request(app).post(`/api/v8/finance-v2/valuation/variants/${bvId}/compute/dcf`).send(requestBody);
    expect(first.status).toBe(200);
    const firstJobId = first.body.data.jobId as string;
    expect(capturedRunningJobId).toBe(firstJobId);

    const second = capturedSecondResponse;
    expect(second).toBeTruthy();
    // Unbranched, single-outcome assertion, distinct from (and NOT the same code path as) the
    // succeeded-replay test above: a duplicate that arrives mid-flight must hard-fail, never be
    // silently resumed as if it were a completed replay.
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('JOB_NOT_RUNNING');
    expect(String(second.body.error || '')).toMatch(/not 'queued' or 'succeeded'/);

    // Independent read: still exactly ONE compute_job_outputs row — the FIRST call's own commit,
    // which ran AFTER the second call's refusal (the interception above delays it on purpose).
    const outputCount = await countComputeJobOutputs(firstJobId);
    expect(outputCount).toBe(1);
    expect(await readJobStatus(firstJobId)).toBe('succeeded');
  });
});
