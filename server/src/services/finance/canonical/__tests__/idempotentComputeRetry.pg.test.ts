/**
 * P1 fix — idempotent compute retry (`docs/validation/finance-v3/generated/gate-e/
 * PKG_FIX_CANONICAL_report.md`, defect 1), real PostgreSQL integration test.
 *
 * DEFECT (confirmed independently by two prior audits, pinned to file:line in the fix brief):
 * `valuationComputeService.ts`, `baselineComputeService.ts`, `kpiComputeService.ts`, and
 * `predictionComputeService.ts` (two call sites) all called `computeJobService.enqueue()` then
 * UNCONDITIONALLY `computeJobService.claimById()`, ignoring `enqueue()`'s own `wasExisting` flag.
 * `claimById()` only ever matches `status='queued'` rows. A byte-identical repeated POST maps to
 * the SAME idempotency key (`compute_jobs_idempotency_uq`), so `enqueue()`'s `ON CONFLICT DO
 * NOTHING` read-back returns the FIRST call's row — already `succeeded`, never `queued` again —
 * `claimById()` returned `null`, and every one of the five call sites threw a raw, unhandled
 * `Error`: a 500, not an idempotent replay.
 *
 * FIX: `computeJobService.claimForCompute()` (see that file) is now the single decision point at
 * all five call sites — `wasExisting=true` + `status='succeeded'` + a real `compute_job_outputs`
 * row short-circuits to an idempotent success using the ORIGINAL job's identity, never re-claims,
 * never mints a second `compute_jobs`/`compute_job_outputs` row.
 *
 * METHOD, per call site: call the SAME compute function TWICE with byte-identical params
 * (sequentially — no artificial race). Assert (a) the second call does NOT throw and reports
 * `ok:true`, (b) both calls report the SAME `job.id` (proof this is a replay, not a fresh job),
 * (c) an INDEPENDENT SQL read of `compute_job_outputs` shows EXACTLY ONE row for that job id — the
 * program's own hard gate ("job kill/retry/race daje dokładnie jeden committed output version").
 *
 * NOT_RUNNING vs already-committed, per the kanon (see fix brief): a duplicate request while the
 * FIRST is still `running` (not finished) must be a hard error, never silently resumed — proven
 * separately below via a real interleaving (start call 1, do not let it finish, issue call 2
 * before call 1's own `completeJobSuccess()` — mirrors `w2FalseSuccessW9B2.pg.test.ts`'s own
 * `vi.spyOn`-based interception pattern in this same directory).
 *
 * "Cofnij naprawę" negative control (done by hand against this exact file's five call sites, not
 * scripted here — see `PKG_FIX_CANONICAL_report.md` for the raw before/after console output):
 * `git show aa4948b1d1:<service path> > <service path>` (restores the raw `claimById()` call),
 * rerun this file — every "second call is idempotent, not a 500" assertion goes RED (the original
 * unhandled `Error` is thrown instead), then `git checkout -- <service path>` restores the fix and
 * the suite goes GREEN again.
 *
 * HOW TO RUN (own throwaway ephemeral cluster only — NEVER shared/demo/staging/prod):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@127.0.0.1:<port>/<db> \
 *   npx vitest run --config vitest.config.ts \
 *     src/services/finance/canonical/__tests__/idempotentComputeRetry.pg.test.ts \
 *     --no-file-parallelism
 *   (run from `server/`)
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it, vi } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

// GoldCo Manufacturing S.A. figures — same fixture convention as
// w2FalseSuccessW9B2.pg.test.ts / perfSlo.pg.test.ts, so this is a realistic model, not a toy one.
const GOLDCO = {
  revenue: 182_000_000,
  cogs: 118_000_000,
  opex: 34_000_000,
  depreciation: 7_000_000,
  capex: 9_000_000,
  cash: 11_000_000,
  ar: 26_000_000,
  inventory: 19_500_000,
  fixedAssets: 101_500_000,
  ap: 17_500_000,
  longTermDebt: 40_500_000,
} as const;
const OPENING_ASSETS = GOLDCO.cash + GOLDCO.ar + GOLDCO.inventory + GOLDCO.fixedAssets;
const OPENING_LIABILITIES = GOLDCO.ap + GOLDCO.longTermDebt;
const OPENING_EQUITY = OPENING_ASSETS - OPENING_LIABILITIES;
const OPENING_RETAINED_EARNINGS = 40_000_000;

describe.skipIf(!REAL_PG)('P1 fix — idempotent compute retry (real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../artifactVersionService.js');
  let baselineSvc: typeof import('../baselineComputeService.js');
  let kpiSvc: typeof import('../kpiComputeService.js');
  let predictionSvc: typeof import('../predictionComputeService.js');
  let predictionPreflightSvc: typeof import('../predictionPreflightService.js');
  let valuationSvc: typeof import('../valuationComputeService.js');
  let computeJobService: typeof import('../computeJobService.js');

  const orgId = `org-idem-${randomUUID()}`;
  const userId = `user-idem-${randomUUID()}`;

  let stmtBvId: string;
  let entityId: string;
  let engineManifestId: string;
  let calendarId: string;
  let openingPeriodId: string;
  let forecastPeriodIds: string[];
  let lineIdByCode: Map<string, string>;
  /** A Baseline Model business version, computed ONCE, normally (no interception) — shared read-only source for the Prediction and Valuation fixtures below. */
  let sharedBaselineBvId: string;

  const t = <T>(fn: (tx: any) => Promise<T>): Promise<T> => withPinnedPostgresTransaction(fn as never) as Promise<T>;

  async function insertPeriod(
    opts: { type: 'MONTH' | 'FY'; fiscalYear: number; fiscalMonth: number | null; start: string; end: string; label: string }
  ): Promise<string> {
    const periodId = `per-${randomUUID()}`;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_periods (period_id, organization_id, fiscal_calendar_id, period_type, fiscal_year,
           fiscal_month, period_start, period_end, label, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [periodId, orgId, calendarId, opts.type, opts.fiscalYear, opts.fiscalMonth, opts.start, opts.end, opts.label, userId]
      )
    );
    return periodId;
  }

  async function insertStmtLine(lineCode: string, periodId: string, value: number, statementType: 'P&L' | 'BS' | 'CF'): Promise<void> {
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_lines (id, organization_id, business_version_id, statement_type, canonical_line_id,
           entity_id, period_id, value_status, value_decimal, native_currency, presentation_currency, unit,
           accounting_policy, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 'IFRS', ?)`,
        [randomUUID(), orgId, stmtBvId, statementType, lineIdByCode.get(lineCode), entityId, periodId, value, userId]
      )
    );
  }

  /** A fresh BASELINE_MODEL business version, fully configured, ready to compute. */
  async function makeBaselineVersion(): Promise<string> {
    const artifact = await av.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: userId });
    const bvId = artifact.businessVersion.business_version_id;

    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_lineage_edges (id, organization_id, source_version_id, source_artifact_type, target_version_id,
           target_artifact_type, edge_type, transformation_kind, author_id)
         VALUES (?, ?, ?, 'STATEMENT_PACK', ?, 'BASELINE_MODEL', 'STATEMENT_TO_MODEL', 'COMPUTE', ?)`,
        [randomUUID(), orgId, stmtBvId, bvId, userId]
      )
    );
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_models (id, organization_id, business_version_id, horizon_months, horizon_rationale,
           horizon_rationale_note, circularity_max_iterations, circularity_tolerance_currency,
           interest_income_on_cash_modeled, mandatory_contractual_cash_sweep_modeled, created_by)
         VALUES (?, ?, ?, 12, 'DEBT_MATURITY', ?, 50, 1, false, true, ?)`,
        [randomUUID(), orgId, bvId, 'idempotency fixture — GoldCo FY2026 monthly horizon', userId]
      )
    );

    const assumption = (scheduleType: string, driverCode: string, value: number, unit: string) =>
      t((tx) =>
        tx.queryRun(
          `INSERT INTO finance_baseline_assumptions (id, organization_id, business_version_id, schedule_type, driver_code,
             entity_id, period_id, rule, value_status, value_decimal, unit, quality, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'HISTORICAL_AVERAGE', 'PRESENT_NONZERO', ?, ?, 'ESTIMATED', ?)`,
          [randomUUID(), orgId, bvId, scheduleType, driverCode, entityId, forecastPeriodIds[0], value, unit, userId]
        )
      );
    await assumption('revenue_pvm', 'REVENUE_GROWTH_YOY', 0.05, 'PCT');
    await assumption('cogs_opex', 'COGS_PCT_OF_REVENUE', GOLDCO.cogs / GOLDCO.revenue, 'PCT');
    await assumption('cogs_opex', 'OPEX_PCT_OF_REVENUE', GOLDCO.opex / GOLDCO.revenue, 'PCT');
    await assumption('wc_dso_dio_dpo', 'DSO_DAYS', (GOLDCO.ar / GOLDCO.revenue) * 365, 'DAYS');
    await assumption('wc_dso_dio_dpo', 'DIO_DAYS', (GOLDCO.inventory / GOLDCO.cogs) * 365, 'DAYS');
    await assumption('wc_dso_dio_dpo', 'DPO_DAYS', (GOLDCO.ap / GOLDCO.cogs) * 365, 'DAYS');
    await assumption('capex_depreciation', 'CAPEX_PCT_OF_REVENUE', GOLDCO.capex / GOLDCO.revenue, 'PCT');
    await assumption('capex_depreciation', 'USEFUL_LIFE_MONTHS', (12 * GOLDCO.fixedAssets) / GOLDCO.depreciation, 'MONTHS');
    await assumption('tax_nol', 'STATUTORY_TAX_RATE_PCT', 0.19, 'PCT');

    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_schedules (id, organization_id, business_version_id, schedule_type, entity_id,
           schedule_item_code, effective_from_period_id, payload, created_by)
         VALUES (?, ?, ?, 'debt_maturity', ?, 'FACILITY-1', ?, ?, ?)`,
        [
          randomUUID(),
          orgId,
          bvId,
          entityId,
          forecastPeriodIds[0],
          JSON.stringify({
            principal_opening: GOLDCO.longTermDebt,
            contractual_rate: 0.048,
            amortization_schedule: Array.from({ length: 12 }, () => 675_000),
            mandatory_sweep_pct: 0.1,
            mandatory_sweep_threshold: 0,
          }),
          userId,
        ]
      )
    );
    return bvId;
  }

  /** A fresh HISTORICAL_ANALYSIS version, pre-seeded with one MISSING KPI value row. */
  async function makeAnalysisVersion(): Promise<string> {
    const artifact = await av.createArtifact({ organizationId: orgId, artifactType: 'HISTORICAL_ANALYSIS', createdBy: userId });
    const bvId = artifact.businessVersion.business_version_id;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_lineage_edges (id, organization_id, source_version_id, source_artifact_type, target_version_id,
           target_artifact_type, edge_type, transformation_kind, author_id)
         VALUES (?, ?, ?, 'STATEMENT_PACK', ?, 'HISTORICAL_ANALYSIS', 'STATEMENT_TO_ANALYSIS', 'COMPUTE', ?)`,
        [randomUUID(), orgId, stmtBvId, bvId, userId]
      )
    );
    const catalogRow = await t((tx) =>
      tx.queryOne<{ id: string }>(`SELECT id FROM finance_analysis_kpi_catalog WHERE kpi_code = 'GROSS_MARGIN_PCT' AND status = 'ACTIVE' LIMIT 1`)
    );
    if (!catalogRow) throw new Error('fixture: no ACTIVE GROSS_MARGIN_PCT catalog row');
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_analysis_kpi_values (id, organization_id, business_version_id, kpi_catalog_id, entity_id,
           period_id, value_status) VALUES (?, ?, ?, ?, ?, ?, 'MISSING')`,
        [randomUUID(), orgId, bvId, catalogRow.id, entityId, openingPeriodId]
      )
    );
    return bvId;
  }

  /** A fresh VALUATION_CASE version sourced from `baselineBvId`, with complete WACC inputs. */
  async function makeValuationVersion(baselineBvId: string): Promise<string> {
    const artifact = await av.createArtifact({ organizationId: orgId, artifactType: 'VALUATION_CASE', createdBy: userId });
    const bvId = artifact.businessVersion.business_version_id;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_lineage_edges (id, organization_id, source_version_id, source_artifact_type, target_version_id,
           target_artifact_type, edge_type, transformation_kind, assumption_snapshot_hash, author_id)
         VALUES (?, ?, ?, 'BASELINE_MODEL', ?, 'VALUATION_CASE', 'MODEL_TO_VALUATION', 'COMPUTE', ?, ?)`,
        [randomUUID(), orgId, baselineBvId, bvId, `snapshot-${randomUUID()}`, userId]
      )
    );
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_valuation_wacc_inputs (id, organization_id, business_version_id, risk_free_rate_pct,
           equity_risk_premium_pct, beta_unlevered, target_capital_structure_debt_pct, target_capital_structure_equity_pct,
           cost_of_debt_pretax_pct, credit_spread_pct, cash_tax_rate_pct, currency, nominal_or_real, pre_or_post_tax, created_by)
         VALUES (?, ?, ?, 5.5, 5.0, 0.9, 30, 70, 6.0, 1.5, 19, 'PLN', 'NOMINAL', 'POST_TAX', ?)`,
        [randomUUID(), orgId, bvId, userId]
      )
    );
    return bvId;
  }

  /** A fresh PREDICTION_SCENARIO, preflighted, for the given `scenarioMode` ('STANDARD_BASE' or an overlay mode). */
  async function makePredictionScenario(baselineBvId: string, scenarioMode: string): Promise<string> {
    const artifact = await av.createArtifact({ organizationId: orgId, artifactType: 'PREDICTION_SCENARIO', createdBy: userId });
    const bvId = artifact.businessVersion.business_version_id;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_prediction_scenarios (id, organization_id, business_version_id, name, scenario_mode, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), orgId, bvId, `idempotency fixture — ${scenarioMode} scenario`, scenarioMode, userId]
      )
    );
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_lineage_edges (id, organization_id, source_version_id, source_artifact_type, target_version_id,
           target_artifact_type, edge_type, transformation_kind, assumption_snapshot_hash, author_id)
         VALUES (?, ?, ?, 'BASELINE_MODEL', ?, 'PREDICTION_SCENARIO', 'MODEL_TO_SCENARIO', 'COMPUTE', ?, ?)`,
        [randomUUID(), orgId, baselineBvId, bvId, `snapshot-${randomUUID()}`, userId]
      )
    );
    await predictionPreflightSvc.runPreflight({
      organizationId: orgId,
      businessVersionId: bvId,
      runBy: userId,
      entityId,
      openingBalanceSheetPeriodId: openingPeriodId,
    });
    return bvId;
  }

  /** Independent physical read — never a service return value. */
  async function readOutputs(jobId: string) {
    return t((tx) =>
      tx.queryAll<{ id: string; content_semantic_hash: string }>(`SELECT id, content_semantic_hash FROM compute_job_outputs WHERE job_id = ?`, [jobId])
    );
  }
  async function readJob(jobId: string) {
    return t((tx) => tx.queryOne<{ id: string; status: string }>(`SELECT id, status FROM compute_jobs WHERE id = ?`, [jobId]));
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../artifactVersionService.js');
    baselineSvc = await import('../baselineComputeService.js');
    kpiSvc = await import('../kpiComputeService.js');
    predictionSvc = await import('../predictionComputeService.js');
    predictionPreflightSvc = await import('../predictionPreflightService.js');
    valuationSvc = await import('../valuationComputeService.js');
    computeJobService = await import('../computeJobService.js');

    await t((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'Idempotency Retry Org (GoldCo-scale)']));

    const lineRows = await t((tx) => tx.queryAll<{ id: string; line_code: string }>(`SELECT id, line_code FROM financial_statement_lines`));
    lineIdByCode = new Map(lineRows.map((r) => [r.line_code, r.id]));

    const stmt = await av.createArtifact({ organizationId: orgId, artifactType: 'STATEMENT_PACK', createdBy: userId });
    stmtBvId = stmt.businessVersion.business_version_id;
    engineManifestId = stmt.businessVersion.engine_manifest_id;

    calendarId = `cal-${randomUUID()}`;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_calendars (fiscal_calendar_id, organization_id, calendar_type, fiscal_year_end_month,
           fiscal_year_end_reference, effective_from, created_by) VALUES (?, ?, 'STANDARD', 12, 'LAST_DAY_OF_MONTH', ?, ?)`,
        [calendarId, orgId, '2024-01-01', userId]
      )
    );

    entityId = `ent-${randomUUID()}`;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_entities (id, organization_id, business_version_id, entity_code, legal_name, role,
           consolidation_method, ownership_pct, functional_currency, created_by)
         VALUES (?, ?, ?, 'PARENT', 'GoldCo Manufacturing S.A. (Idempotency)', 'GROUP_PARENT', 'FULL', 100, 'PLN', ?)`,
        [entityId, orgId, stmtBvId, userId]
      )
    );

    const monthEnd = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const monthlyRevenue = GOLDCO.revenue / 12;

    const fy2025Months: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const pid = await insertPeriod({
        type: 'MONTH',
        fiscalYear: 2025,
        fiscalMonth: m,
        start: `2025-${String(m).padStart(2, '0')}-01`,
        end: monthEnd(2025, m),
        label: `${m}/2025`,
      });
      fy2025Months.push(pid);
      await insertStmtLine('REVENUE', pid, monthlyRevenue, 'P&L');
    }
    openingPeriodId = fy2025Months[11];

    await insertStmtLine('CASH', openingPeriodId, GOLDCO.cash, 'BS');
    await insertStmtLine('AR', openingPeriodId, GOLDCO.ar, 'BS');
    await insertStmtLine('INVENTORY', openingPeriodId, GOLDCO.inventory, 'BS');
    await insertStmtLine('FIXED_ASSETS', openingPeriodId, GOLDCO.fixedAssets, 'BS');
    await insertStmtLine('AP', openingPeriodId, GOLDCO.ap, 'BS');
    await insertStmtLine('LONG_TERM_DEBT', openingPeriodId, GOLDCO.longTermDebt, 'BS');
    await insertStmtLine('EQUITY', openingPeriodId, OPENING_EQUITY, 'BS');
    await insertStmtLine('RETAINED_EARNINGS', openingPeriodId, OPENING_RETAINED_EARNINGS, 'BS');
    expect(OPENING_ASSETS).toBe(OPENING_LIABILITIES + OPENING_EQUITY);

    await insertStmtLine('COGS', openingPeriodId, GOLDCO.cogs / 12, 'P&L');
    await insertStmtLine('OPEX', openingPeriodId, GOLDCO.opex / 12, 'P&L');

    forecastPeriodIds = [];
    for (let m = 1; m <= 12; m++) {
      forecastPeriodIds.push(
        await insertPeriod({
          type: 'MONTH',
          fiscalYear: 2026,
          fiscalMonth: m,
          start: `2026-${String(m).padStart(2, '0')}-01`,
          end: monthEnd(2026, m),
          label: `${m}/2026`,
        })
      );
    }

    // One normally-computed (uncancelled) Baseline, shared as the read-only source for the
    // Prediction and Valuation fixtures below.
    sharedBaselineBvId = await makeBaselineVersion();
    const sharedRun = await baselineSvc.runBaselineCompute({
      organizationId: orgId,
      businessVersionId: sharedBaselineBvId,
      requestedByUserId: userId,
      engineManifestId,
      entityId,
      forecastPeriodIds,
      openingBalanceSheetPeriodId: openingPeriodId,
    });
    if (!sharedRun.ok) throw new Error(`fixture: shared baseline compute failed: ${sharedRun.code} — ${sharedRun.message}`);
  }, 300_000);

  // =========================================================================
  // 1) baselineComputeService.runBaselineCompute() — computeJobService.ts:429 call site
  // =========================================================================
  describe('baselineComputeService.runBaselineCompute()', () => {
    it('repeated call with byte-identical params: no error, same job id, exactly one compute_job_outputs row', async () => {
      const bvId = await makeBaselineVersion();
      const params = {
        organizationId: orgId,
        businessVersionId: bvId,
        requestedByUserId: userId,
        engineManifestId,
        entityId,
        forecastPeriodIds,
        openingBalanceSheetPeriodId: openingPeriodId,
      };

      const first = await baselineSvc.runBaselineCompute(params);
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(`unreachable: ${first.code} — ${first.message}`);

      // Byte-identical repeat — must NOT throw (pre-fix: raw Error -> 500).
      const second = await baselineSvc.runBaselineCompute(params);
      expect(second.ok).toBe(true);
      if (!second.ok) throw new Error(`unreachable: ${second.code} — ${second.message}`);

      expect(second.job.id).toBe(first.job.id);

      const outputs = await readOutputs(first.job.id);
      expect(outputs).toHaveLength(1);
      const job = await readJob(first.job.id);
      expect(job?.status).toBe('succeeded');
    });
  });

  // =========================================================================
  // 2) kpiComputeService.computeAnalysisKpis() — computeJobService.ts:637 call site
  // =========================================================================
  describe('kpiComputeService.computeAnalysisKpis()', () => {
    it('repeated call with byte-identical params: no error, same job id, exactly one compute_job_outputs row', async () => {
      const bvId = await makeAnalysisVersion();
      const params = { organizationId: orgId, businessVersionId: bvId, requestedByUserId: userId, engineManifestId };

      const first = await kpiSvc.computeAnalysisKpis(params);
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(`unreachable: ${first.code} — ${first.message}`);

      const second = await kpiSvc.computeAnalysisKpis(params);
      expect(second.ok).toBe(true);
      if (!second.ok) throw new Error(`unreachable: ${second.code} — ${second.message}`);

      expect(second.job.id).toBe(first.job.id);

      const outputs = await readOutputs(first.job.id);
      expect(outputs).toHaveLength(1);
      const job = await readJob(first.job.id);
      expect(job?.status).toBe('succeeded');
    });
  });

  // =========================================================================
  // 3) predictionComputeService.runPredictionCompute() — STANDARD_BASE branch
  //    (computeJobService.ts:322 call site)
  // =========================================================================
  describe('predictionComputeService.runPredictionCompute() — STANDARD_BASE branch (runStandardBase)', () => {
    it('repeated call with byte-identical params: no error, same job id, exactly one compute_job_outputs row', async () => {
      const bvId = await makePredictionScenario(sharedBaselineBvId, 'STANDARD_BASE');
      const params = {
        organizationId: orgId,
        businessVersionId: bvId,
        requestedByUserId: userId,
        engineManifestId,
        entityId,
        forecastPeriodIds,
        openingBalanceSheetPeriodId: openingPeriodId,
      };

      const first = await predictionSvc.runPredictionCompute(params);
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(`unreachable: ${first.code} — ${first.message}`);
      if (first.mode !== 'STANDARD_BASE') throw new Error(`unreachable: expected STANDARD_BASE, got ${first.mode}`);

      const second = await predictionSvc.runPredictionCompute(params);
      expect(second.ok).toBe(true);
      if (!second.ok) throw new Error(`unreachable: ${second.code} — ${second.message}`);
      if (second.mode !== 'STANDARD_BASE') throw new Error(`unreachable: expected STANDARD_BASE, got ${second.mode}`);

      expect(second.job.id).toBe(first.job.id);

      const outputs = await readOutputs(first.job.id);
      expect(outputs).toHaveLength(1);
      const job = await readJob(first.job.id);
      expect(job?.status).toBe('succeeded');
    });
  });

  // =========================================================================
  // 4) predictionComputeService.runPredictionCompute() — overlay branch
  //    (computeJobService.ts:549 call site, DRIVER_OVERRIDE scenario_mode, zero actual overrides
  //    — a minimal fixture is sufficient: this defect is about the job-claim plumbing, not the
  //    overlay math, which has its own dedicated coverage elsewhere in this directory)
  // =========================================================================
  describe('predictionComputeService.runPredictionCompute() — overlay branch (runOverlayCompute)', () => {
    it('repeated call with byte-identical params: no error, same job id, exactly one compute_job_outputs row', async () => {
      const bvId = await makePredictionScenario(sharedBaselineBvId, 'DRIVER_OVERRIDE');
      const params = {
        organizationId: orgId,
        businessVersionId: bvId,
        requestedByUserId: userId,
        engineManifestId,
        entityId,
        forecastPeriodIds,
        openingBalanceSheetPeriodId: openingPeriodId,
      };

      const first = await predictionSvc.runPredictionCompute(params);
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(`unreachable: ${first.code} — ${first.message}`);
      if (first.mode !== 'COMPUTED') throw new Error(`unreachable: expected COMPUTED (overlay), got ${first.mode}`);

      const second = await predictionSvc.runPredictionCompute(params);
      expect(second.ok).toBe(true);
      if (!second.ok) throw new Error(`unreachable: ${second.code} — ${second.message}`);
      if (second.mode !== 'COMPUTED') throw new Error(`unreachable: expected COMPUTED (overlay), got ${second.mode}`);

      expect(second.job.id).toBe(first.job.id);

      const outputs = await readOutputs(first.job.id);
      expect(outputs).toHaveLength(1);
      const job = await readJob(first.job.id);
      expect(job?.status).toBe('succeeded');
    });
  });

  // =========================================================================
  // 5) valuationComputeService.runDcfFcffValuation() — computeJobService.ts:442 call site
  // =========================================================================
  describe('valuationComputeService.runDcfFcffValuation()', () => {
    it('repeated call with byte-identical params: no error, same job id, exactly one compute_job_outputs row', async () => {
      const bvId = await makeValuationVersion(sharedBaselineBvId);
      const params = {
        organizationId: orgId,
        valuationBusinessVersionId: bvId,
        entityId,
        requestedByUserId: userId,
        engineManifestId,
        projectionYears: [{ fiscalYear: 2026, periodIds: forecastPeriodIds }],
        openingWorkingCapital: GOLDCO.ar + GOLDCO.inventory - GOLDCO.ap,
        terminal: { gPct: 2 },
      };

      const first = await valuationSvc.runDcfFcffValuation(params);
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(`unreachable: ${first.code} — ${first.message}`);

      const second = await valuationSvc.runDcfFcffValuation(params);
      expect(second.ok).toBe(true);
      if (!second.ok) throw new Error(`unreachable: ${second.code} — ${second.message}`);

      expect(second.job.id).toBe(first.job.id);
      // Deterministic re-derivation (Decimal-based, in-memory sorted, per CLAUDE.md's own golden
      // rule): the second call's independently recomputed enterpriseValue must match the first's.
      expect(second.enterpriseValue).toBeCloseTo(first.enterpriseValue, 6);

      const outputs = await readOutputs(first.job.id);
      expect(outputs).toHaveLength(1);
      const job = await readJob(first.job.id);
      expect(job?.status).toBe('succeeded');
    });
  });

  // =========================================================================
  // NOT_RUNNING while genuinely still in flight — must be a hard error, never a silent resume.
  // Distinguishes "duplicate while running" from "duplicate after success" (the five blocks above).
  // =========================================================================
  describe('a duplicate request while the FIRST attempt is still running (not yet committed) is a hard JOB_NOT_RUNNING error, never silently resumed', () => {
    it('baselineComputeService: enqueue() the same idempotency key a second time while the first job is still `running` -> JOB_NOT_RUNNING, no false success, no second compute_job_outputs row', async () => {
      const bvId = await makeBaselineVersion();
      const params = {
        organizationId: orgId,
        businessVersionId: bvId,
        requestedByUserId: userId,
        engineManifestId,
        entityId,
        forecastPeriodIds,
        openingBalanceSheetPeriodId: openingPeriodId,
      };

      // Real interleaving, same pattern w2FalseSuccessW9B2.pg.test.ts uses: intercept the FIRST
      // call's own completeJobSuccess() and, before letting it run for real, issue a SECOND call
      // under the hood — at that instant the first job's row is genuinely `running` (claimed, not
      // yet committed). The second call must refuse (JOB_NOT_RUNNING), not silently wait or resume.
      let capturedRunningJobId: string | null = null;
      let capturedSecondCallResult: Awaited<ReturnType<typeof baselineSvc.runBaselineCompute>> | null = null;
      const original = computeJobService.completeJobSuccess;
      const spy = vi.spyOn(computeJobService, 'completeJobSuccess').mockImplementationOnce(async (completeParams) => {
        capturedRunningJobId = completeParams.jobId;
        const runningJob = await readJob(completeParams.jobId);
        if (runningJob?.status !== 'running') throw new Error(`fixture: expected job ${completeParams.jobId} to be 'running' at interception time, was '${runningJob?.status}'`);
        capturedSecondCallResult = await baselineSvc.runBaselineCompute(params);
        spy.mockRestore();
        return original(completeParams);
      });

      const first = await baselineSvc.runBaselineCompute(params);
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(`unreachable: ${first.code} — ${first.message}`);
      expect(capturedRunningJobId).toBe(first.job.id);

      const second = capturedSecondCallResult!;
      expect(second).toBeTruthy();
      expect(second.ok).toBe(false);
      if (second.ok) throw new Error('unreachable — the still-running duplicate was silently resumed as a success (regression)');
      expect(second.code).toBe('JOB_NOT_RUNNING');

      // Independent read: still exactly ONE compute_job_outputs row (the first call's own commit,
      // which ran AFTER the second call's refusal, per the interception above).
      const outputs = await readOutputs(first.job.id);
      expect(outputs).toHaveLength(1);
    });
  });
});
