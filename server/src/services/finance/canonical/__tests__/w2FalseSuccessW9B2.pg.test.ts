/**
 * W2 — FALSE SUCCESS (defect W9-B-2), negative control.
 *
 * Defect: `baselineComputeService.runBaselineCompute()`,
 * `kpiComputeService.computeAnalysisKpis()`,
 * `predictionComputeService.runStandardBase()`/`runOverlayCompute()`, and
 * `valuationComputeService.runDcfFcffValuation()` all call
 * `computeJobService.completeJobSuccess()` and either discarded its typed
 * result (`await` with no assignment) or captured it but still
 * unconditionally returned `{ ok: true, ... }` regardless
 * (`valuationComputeService.ts`, before this fix). If the job was cancelled
 * (or otherwise left non-`running`) between `claim()` and this call, the
 * caller reported SUCCESS with no `compute_job_outputs` row ever written —
 * "testy przeszły" while nothing was actually persisted.
 *
 * METHOD — a REAL cancellation, not a mocked return value. `vi.spyOn` wraps
 * the real `computeJobService.completeJobSuccess` (all four modules import it
 * as `import * as computeJobService from './computeJobService.js'`, so the
 * spy is visible to their own internal call): the FIRST invocation, made from
 * inside the service under test, first calls the REAL
 * `computeJobService.cancelJob()` against the SAME job id the service just
 * claimed (a genuine `UPDATE compute_jobs SET status='cancelled' ...`), then
 * delegates to the real, unmocked `completeJobSuccess()` implementation. That
 * implementation does its own fresh `SELECT ... FOR UPDATE` and — because the
 * row really is `cancelled` now — genuinely returns `{ ok: false, code:
 * 'NOT_RUNNING' }`. Nothing about `completeJobSuccess()`'s own logic is
 * faked; only the TIMING of a real cancellation relative to a real commit
 * attempt is engineered, which is exactly the race the defect report
 * describes ("job zostało w międzyczasie anulowane").
 *
 * Every assertion of "no false success" is followed by an INDEPENDENT
 * `compute_job_outputs` read via `withPinnedPostgresTransaction` — never
 * trusting the service's own return value alone (the program's own prior
 * lesson: "UPDATE 0 wygląda jak PASS").
 *
 * A companion test (`OUTPUT_ALREADY_COMMITTED — idempotent-safe, not a
 * failure`) proves the two `completeJobSuccess()` failure codes are NOT
 * conflated: unlike `NOT_RUNNING`, `OUTPUT_ALREADY_COMMITTED` (this job_id
 * already has a committed output — a safe idempotent-retry signal per the
 * B04 ADR's "append-only" contract) must NOT be reported as a failure to the
 * caller. That scenario is only reachable in real Postgres via a genuine
 * concurrent second committer (see `faultMatrix.pg.test.ts`'s own
 * `'NOT_RUNNING' | 'OUTPUT_ALREADY_COMMITTED'` either-acceptable comment —
 * sequential retries against this schema's row-level locking normally
 * resolve to `NOT_RUNNING`, not this code), so it is reproduced here as a
 * direct pre-insert of the competing `compute_job_outputs` row while the job
 * is still `running` — simulating a second committer's SAME job_id output
 * having already landed, not asserting a specific interleaving.
 *
 * "Cofnij naprawę" verification (surrounds this file, done by hand, not by a
 * script committed here — see the W2 report for the raw before/after
 * output): `git checkout <parent> -- <service file>`, rerun this file — every
 * `JOB_NOT_RUNNING` test goes RED (`result.ok` is `true`, the pre-fix false
 * success) — then restore.
 *
 * HOW TO RUN (own throwaway ephemeral cluster only — NEVER shared/demo/staging/prod):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config vitest.config.ts \
 *     src/services/finance/canonical/__tests__/w2FalseSuccessW9B2.pg.test.ts \
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
// perfSlo.pg.test.ts / coldReopen.pg.test.ts, so this is a realistic model,
// not a toy one.
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

describe.skipIf(!REAL_PG)('W2 — false success (W9-B-2): completeJobSuccess() NOT_RUNNING must not report success (real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../artifactVersionService.js');
  let baselineSvc: typeof import('../baselineComputeService.js');
  let kpiSvc: typeof import('../kpiComputeService.js');
  let predictionSvc: typeof import('../predictionComputeService.js');
  let predictionPreflightSvc: typeof import('../predictionPreflightService.js');
  let valuationSvc: typeof import('../valuationComputeService.js');
  let computeJobService: typeof import('../computeJobService.js');

  const orgId = `org-w2fs-${randomUUID()}`;
  const userId = `user-w2fs-${randomUUID()}`;

  let stmtBvId: string;
  let entityId: string;
  let engineManifestId: string;
  let calendarId: string;
  let openingPeriodId: string;
  let forecastPeriodIds: string[];
  let lineIdByCode: Map<string, string>;
  /** A Baseline Model business version, computed ONCE, normally (no interception) — shared read-only source for the Prediction and Valuation negative controls below. */
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

  /** A fresh BASELINE_MODEL business version, fully configured, ready to compute. Not itself timed/intercepted. */
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
        [randomUUID(), orgId, bvId, 'W2 false-success fixture — GoldCo FY2026 monthly horizon', userId]
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

  /** A fresh HISTORICAL_ANALYSIS version, pre-seeded with one MISSING KPI value row (enough to exercise one real evaluation + one real completeJobSuccess call). */
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

  /** A fresh PREDICTION_SCENARIO (STANDARD_BASE) linked to `baselineBvId`, preflighted. */
  async function makePredictionScenario(baselineBvId: string): Promise<string> {
    const artifact = await av.createArtifact({ organizationId: orgId, artifactType: 'PREDICTION_SCENARIO', createdBy: userId });
    const bvId = artifact.businessVersion.business_version_id;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_prediction_scenarios (id, organization_id, business_version_id, name, scenario_mode, created_by)
         VALUES (?, ?, ?, 'W2 false-success Base scenario', 'STANDARD_BASE', ?)`,
        [randomUUID(), orgId, bvId, userId]
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
      tx.queryAll<{ id: string; content_semantic_hash: string }>(
        `SELECT id, content_semantic_hash FROM compute_job_outputs WHERE job_id = ?`,
        [jobId]
      )
    );
  }
  async function readJob(jobId: string) {
    return t((tx) =>
      tx.queryOne<{ id: string; status: string; cancel_requested_at: string | null }>(
        `SELECT id, status, cancel_requested_at FROM compute_jobs WHERE id = ?`,
        [jobId]
      )
    );
  }
  async function readWorkingRevisionComputeIdentity(workingRevisionId: string) {
    return t((tx) =>
      tx.queryOne<{ content_semantic_hash: string | null; compute_run_id: string | null }>(
        `SELECT content_semantic_hash, compute_run_id FROM finance_working_revisions WHERE working_revision_id = ?`,
        [workingRevisionId]
      )
    );
  }

  /**
   * Installs the real-cancellation interceptor described in the file header.
   * Restores itself after the first call (services under test here each call
   * `completeJobSuccess()` exactly once per invocation).
   */
  function interceptFirstCompleteJobSuccessWithRealCancel(reason: string): { capturedJobId: () => string | null } {
    let capturedJobId: string | null = null;
    const original = computeJobService.completeJobSuccess;
    const spy = vi.spyOn(computeJobService, 'completeJobSuccess').mockImplementationOnce(async (params) => {
      capturedJobId = params.jobId;
      const cancelled = await computeJobService.cancelJob(orgId, params.jobId, reason);
      if (!cancelled) throw new Error(`fixture: cancelJob() did not affect job ${params.jobId} (already terminal?)`);
      spy.mockRestore();
      return original(params);
    });
    return { capturedJobId: () => capturedJobId };
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

    await t((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'W2 False Success Org (GoldCo-scale)']));

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
         VALUES (?, ?, ?, 'PARENT', 'GoldCo Manufacturing S.A. (W2)', 'GROUP_PARENT', 'FULL', 100, 'PLN', ?)`,
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

    // One normally-computed (uncancelled) Baseline, shared as the read-only
    // source for the Prediction and Valuation negative controls below — they
    // must intercept THEIR OWN completeJobSuccess() call, not this one's.
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
  // 1) baselineComputeService.runBaselineCompute()
  // =========================================================================
  describe('baselineComputeService.runBaselineCompute()', () => {
    it('job cancelled between claim() and commit -> JOB_NOT_RUNNING, NOT ok:true, and no compute_job_outputs row', async () => {
      const bvId = await makeBaselineVersion();
      const { capturedJobId } = interceptFirstCompleteJobSuccessWithRealCancel('W2 negative control: baseline cancelled mid-flight');

      const result = await baselineSvc.runBaselineCompute({
        organizationId: orgId,
        businessVersionId: bvId,
        requestedByUserId: userId,
        engineManifestId,
        entityId,
        forecastPeriodIds,
        openingBalanceSheetPeriodId: openingPeriodId,
      });

      const jobId = capturedJobId();
      expect(jobId).not.toBeNull();

      // THE assertion this defect is about: must NOT be a false success.
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable — false success reproduced (W9-B-2 regressed)');
      expect(result.code).toBe('JOB_NOT_RUNNING');

      // Independent DB reads — never trust the service's own return value alone.
      expect(await readOutputs(jobId!)).toHaveLength(0);
      const jobRow = await readJob(jobId!);
      expect(jobRow!.status).toBe('cancelled');
      expect(jobRow!.cancel_requested_at).toBeTruthy();
    });
  });

  // =========================================================================
  // 2) kpiComputeService.computeAnalysisKpis()
  // =========================================================================
  describe('kpiComputeService.computeAnalysisKpis()', () => {
    it('job cancelled between claim() and commit -> JOB_NOT_RUNNING, NOT ok:true, and no compute_job_outputs row', async () => {
      const bvId = await makeAnalysisVersion();
      const { capturedJobId } = interceptFirstCompleteJobSuccessWithRealCancel('W2 negative control: KPI cancelled mid-flight');

      const result = await kpiSvc.computeAnalysisKpis({
        organizationId: orgId,
        businessVersionId: bvId,
        requestedByUserId: userId,
        engineManifestId,
      });

      const jobId = capturedJobId();
      expect(jobId).not.toBeNull();

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable — false success reproduced (W9-B-2 regressed)');
      expect(result.code).toBe('JOB_NOT_RUNNING');

      expect(await readOutputs(jobId!)).toHaveLength(0);
      expect((await readJob(jobId!))!.status).toBe('cancelled');
    });
  });

  // =========================================================================
  // 3) predictionComputeService — runStandardBase() (via runPredictionCompute)
  // =========================================================================
  describe('predictionComputeService.runPredictionCompute() — STANDARD_BASE branch (runStandardBase)', () => {
    it('job cancelled between claim() and commit -> JOB_NOT_RUNNING, NOT ok:true, and no compute_job_outputs row', async () => {
      // Linked to the SHARED, already-computed Baseline: runStandardBase()'s
      // own idempotency check (`existingBaselineOutputCount > 0`) takes the
      // "already computed" branch and skips recursing into
      // runBaselineCompute(), so the ONLY completeJobSuccess() call this
      // invocation makes is the PREDICTION_COMPUTE one — exactly the call
      // site under test (predictionComputeService.ts's first call site).
      const bvId = await makePredictionScenario(sharedBaselineBvId);
      const { capturedJobId } = interceptFirstCompleteJobSuccessWithRealCancel('W2 negative control: prediction cancelled mid-flight');

      const result = await predictionSvc.runPredictionCompute({
        organizationId: orgId,
        businessVersionId: bvId,
        requestedByUserId: userId,
        engineManifestId,
        entityId,
        forecastPeriodIds,
        openingBalanceSheetPeriodId: openingPeriodId,
      });

      const jobId = capturedJobId();
      expect(jobId).not.toBeNull();

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable — false success reproduced (W9-B-2 regressed)');
      expect(result.code).toBe('JOB_NOT_RUNNING');

      expect(await readOutputs(jobId!)).toHaveLength(0);
      expect((await readJob(jobId!))!.status).toBe('cancelled');
    });
  });

  // =========================================================================
  // 4) valuationComputeService.runDcfFcffValuation()
  // =========================================================================
  describe('valuationComputeService.runDcfFcffValuation()', () => {
    it('job cancelled between claim() and commit -> JOB_NOT_RUNNING, NOT ok:true (was: canonical instance — completed.ok checked but ok:true returned anyway), no compute_job_outputs row', async () => {
      const bvId = await makeValuationVersion(sharedBaselineBvId);
      const { capturedJobId } = interceptFirstCompleteJobSuccessWithRealCancel('W2 negative control: valuation cancelled mid-flight');

      const result = await valuationSvc.runDcfFcffValuation({
        organizationId: orgId,
        valuationBusinessVersionId: bvId,
        entityId,
        requestedByUserId: userId,
        engineManifestId,
        // A single projection year (FY2026, off the shared Baseline's own
        // forecast) is sufficient to reach FCFF_FULLY_PRESENT and drive the
        // function all the way to its completeJobSuccess() call — the
        // multi-year continuation rows perfSlo.pg.test.ts builds are a
        // performance-measurement nicety, not a requirement to reach that call.
        projectionYears: [{ fiscalYear: 2026, periodIds: forecastPeriodIds }],
        openingWorkingCapital: GOLDCO.ar + GOLDCO.inventory - GOLDCO.ap,
        terminal: { gPct: 2 },
      });

      const jobId = capturedJobId();
      expect(jobId).not.toBeNull();

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable — false success reproduced (W9-B-2 regressed)');
      expect(result.code).toBe('JOB_NOT_RUNNING');

      expect(await readOutputs(jobId!)).toHaveLength(0);
      expect((await readJob(jobId!))!.status).toBe('cancelled');
    });
  });

  // =========================================================================
  // NOT_RUNNING vs OUTPUT_ALREADY_COMMITTED — proof the two are NOT conflated
  // =========================================================================
  describe('OUTPUT_ALREADY_COMMITTED is treated as idempotent-safe, NOT as a failure (unlike NOT_RUNNING)', () => {
    it('baselineComputeService: a pre-existing compute_job_outputs row for the SAME job_id (job still running) does not fail the call', async () => {
      // Simulates a second committer's output for the SAME job_id having
      // already landed while this job is still 'running' (the only way
      // completeJobSuccess() reaches its INSERT-conflict branch rather than
      // the earlier NOT_RUNNING status check — see file header). The
      // pre-insert happens INSIDE the interceptor, i.e. genuinely before the
      // real completeJobSuccess() attempts its own INSERT.
      const bvId = await makeBaselineVersion();

      const original = computeJobService.completeJobSuccess;
      const spy = vi.spyOn(computeJobService, 'completeJobSuccess').mockImplementationOnce(async (params) => {
        await t((tx) =>
          tx.queryRun(
            `INSERT INTO compute_job_outputs (
               id, job_id, organization_id, output_artifact_id, output_working_revision_id,
               committed_by_attempt_number, content_semantic_hash
             ) VALUES (?, ?, ?, ?, ?, 1, ?)`,
            [randomUUID(), params.jobId, orgId, params.outputArtifactId, params.outputWorkingRevisionId, `w2-preexisting-${randomUUID()}`]
          )
        );
        spy.mockRestore();
        return original(params);
      });

      const result = await baselineSvc.runBaselineCompute({
        organizationId: orgId,
        businessVersionId: bvId,
        requestedByUserId: userId,
        engineManifestId,
        entityId,
        forecastPeriodIds,
        openingBalanceSheetPeriodId: openingPeriodId,
      });

      // The DIFFERENTIATED behavior this fix implements: OUTPUT_ALREADY_COMMITTED
      // must NOT propagate as ok:false the way NOT_RUNNING does.
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable — OUTPUT_ALREADY_COMMITTED wrongly treated as a hard failure');

      // Independent read: still exactly ONE compute_job_outputs row (the
      // pre-inserted one) — the real attempt's own INSERT genuinely conflicted
      // and did not create a second row.
      const outputs = await readOutputs(result.job.id);
      expect(outputs).toHaveLength(1);
    });
  });
});
