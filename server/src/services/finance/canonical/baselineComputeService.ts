/**
 * Finance v3 canonical — Baseline Model compute orchestration (Gate D / Fala 5, WP-D06).
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 7. Schema: `WP-D05_baseline_models_schema_ADR.md` (sections 4-8) /
 * `WP-D05b_baseline_migration_report.md` (the real, live-tested migrations this module writes
 * into: `finance_baseline_models`/`finance_baseline_schedules`/`finance_baseline_assumptions`/
 * `finance_baseline_outputs`/`finance_baseline_solver_diagnostics`). Pattern: `kpiComputeService.ts`
 * in this same directory (resolve source lineage -> load once -> loop -> write -> wrap in a
 * `compute_jobs` row), adapted for a CHRONOLOGICAL monthly loop instead of a flat per-row pass,
 * because month N's opening balance sheet is month N-1's closing balance sheet (there is no
 * equivalent dependency between `finance_analysis_kpi_values` rows).
 *
 * For each forecast month, in order: run the seven non-circular `baselineScheduleEngine.ts`
 * schedule functions (revenue -> cogs/opex -> capex/depreciation -> working capital), then
 * `baselineCircularitySolver.solvePeriod()` for the one genuinely circular relationship
 * (interest on average debt / cash, ADR section 6.1), then assemble P&L -> CF -> BS and persist to
 * `finance_baseline_outputs` — CASH and every other balance-sheet stock line are OUTPUTS of this
 * assembly, never an input or a plug (DEC-FIN-002).
 *
 * SCOPE — documented, not silent (WP-D06 report, "scope decisions"):
 *  - Single `entity_id` per compute run (no multi-entity consolidation / translation / NCI in this
 *    P0 — Baseline schedules/outputs are entity-scoped by schema design already, ADR section 4.2/4.4;
 *    a consolidated Baseline is out of scope for this work package, same boundary
 *    `statementReconciliationService.ts`'s Fala-3 gold slice drew for its own P0).
 *  - `finance_baseline_assumptions` rows are read FLAT across the whole horizon (this module reads
 *    whichever row exists for a given `(entity_id, schedule_type, driver_code)` regardless of which
 *    forecast `period_id` it was inserted against — a documented USAGE convention on top of a
 *    schema that technically allows period-varying assumptions; a period-varying Kreator UI can
 *    populate one row per period later without any schema change).
 *  - Forecast `finance_stmt_periods` rows and the `finance_baseline_schedules`/
 *    `finance_baseline_assumptions` rows themselves are the CALLER's responsibility to have already
 *    created (ADR section 2.1: period-row creation "jest zakresem serwisu wykonawczego" — this
 *    module IS that service for the compute step, but period/schedule/assumption AUTHORING is a
 *    Kreator-surface concern, not this compute engine's).
 *  - `headcount`/`leases` schedule types are intentionally not wired into the P&L/BS assembly below
 *    (no P0 canonical line for their output yet — see `baselineScheduleEngine.ts` header).
 */

import { createHash, randomUUID as uuidv4 } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import {
  computeCapexDepreciation,
  computeCogsOpex,
  computeEquityRe,
  computeRevenuePvm,
  computeTaxNol,
  computeWcDsoDioDpo,
  lookupScheduledAmortization,
} from './baselineScheduleEngine.js';
import { solvePeriod, type CircularityPeriodResult } from './baselineCircularitySolver.js';
import { stampWorkingRevisionComputeIdentity } from './artifactVersionService.js';
import * as computeJobService from './computeJobService.js';
import type { ComputeJobRow } from './computeJobService.js';
import * as exceptionLedgerService from './exceptionLedgerService.js';

// ---------------------------------------------------------------------------
// Row shapes (only the columns this module actually reads/writes).
// ---------------------------------------------------------------------------

// NOTE (WP-D08): the row shapes, CANONICAL_CODES/STATEMENT_TYPE_OF/DRIVING_SCHEDULE_TYPE tables,
// loadContext()/requireAssumption()/daysInPeriod() below carry an `export` keyword they did not
// have in WP-D06 — a purely ADDITIVE, zero-behavior-change visibility change (no signature, no
// logic touched) so `predictionComputeService.ts`/`predictionPreflightService.ts` can load the
// SAME Baseline Model context (schedules/assumptions/history/opening BS) that this module already
// knows how to load, instead of duplicating that ~90-line loader. See WP-D08 report section
// "baselineScheduleEngine.ts / baselineComputeService.ts reuse" for the full rationale — this is
// the "minimal necessary change, backward compatible" the WP-D08 brief asked for if reuse required
// touching this file's API; `runBaselineCompute()` itself is completely unchanged, so every WP-D06
// test still exercises the exact same code path.
export interface BaselineModelRow {
  business_version_id: string;
  organization_id: string;
  horizon_months: number;
  circularity_max_iterations: number;
  circularity_tolerance_currency: string;
  interest_income_on_cash_modeled: boolean;
  mandatory_contractual_cash_sweep_modeled: boolean;
}

export interface BaselineScheduleRow {
  schedule_type: string;
  entity_id: string;
  schedule_item_code: string;
  payload: Record<string, unknown>;
}

export interface BaselineAssumptionRow {
  schedule_type: string;
  driver_code: string;
  entity_id: string;
  value_decimal: string | null;
  value_status: string;
}

export interface PeriodMetaRow {
  period_id: string;
  fiscal_year: number;
  fiscal_month: number | null;
  period_start: string | Date;
  period_end: string | Date;
}

export interface StmtLineCellRow {
  canonical_line_id: string;
  value_decimal: string | null;
  value_status: string;
}

export const CANONICAL_CODES = [
  'REVENUE', 'COGS', 'GROSS_MARGIN', 'OPEX', 'EBITDA', 'DEPRECIATION', 'EBIT',
  'INTEREST_EXPENSE', 'TAX_EXPENSE', 'NET_INCOME',
  'CASH', 'AR', 'INVENTORY', 'CURRENT_ASSETS', 'FIXED_ASSETS', 'TOTAL_ASSETS',
  'AP', 'CURRENT_LIABILITIES', 'LONG_TERM_DEBT', 'TOTAL_LIABILITIES',
  'EQUITY', 'TOTAL_LIABILITIES_EQUITY', 'RETAINED_EARNINGS', 'DIVIDENDS_DECLARED', 'WORKING_CAPITAL',
  'CFO', 'CFI', 'CFF', 'NET_CHANGE_CASH', 'CAPEX', 'FCF',
] as const;
export type CanonicalCode = (typeof CANONICAL_CODES)[number];

export const STATEMENT_TYPE_OF: Record<CanonicalCode, 'P&L' | 'BS' | 'CF'> = {
  REVENUE: 'P&L', COGS: 'P&L', GROSS_MARGIN: 'P&L', OPEX: 'P&L', EBITDA: 'P&L', DEPRECIATION: 'P&L',
  EBIT: 'P&L', INTEREST_EXPENSE: 'P&L', TAX_EXPENSE: 'P&L', NET_INCOME: 'P&L',
  CASH: 'BS', AR: 'BS', INVENTORY: 'BS', CURRENT_ASSETS: 'BS', FIXED_ASSETS: 'BS', TOTAL_ASSETS: 'BS',
  AP: 'BS', CURRENT_LIABILITIES: 'BS', LONG_TERM_DEBT: 'BS', TOTAL_LIABILITIES: 'BS',
  EQUITY: 'BS', TOTAL_LIABILITIES_EQUITY: 'BS', RETAINED_EARNINGS: 'BS', DIVIDENDS_DECLARED: 'BS', WORKING_CAPITAL: 'BS',
  CFO: 'CF', CFI: 'CF', CFF: 'CF', NET_CHANGE_CASH: 'CF', CAPEX: 'CF', FCF: 'CF',
};

/** `driving_schedule_type` per canonical line — NULL for roll-up/solver lines not directly produced by one `schedule_type` (ADR section 4.4). */
export const DRIVING_SCHEDULE_TYPE: Partial<Record<CanonicalCode, string>> = {
  REVENUE: 'revenue_pvm',
  COGS: 'cogs_opex', OPEX: 'cogs_opex',
  AR: 'wc_dso_dio_dpo', INVENTORY: 'wc_dso_dio_dpo', AP: 'wc_dso_dio_dpo',
  CAPEX: 'capex_depreciation', DEPRECIATION: 'capex_depreciation', FIXED_ASSETS: 'capex_depreciation',
  LONG_TERM_DEBT: 'debt_maturity', INTEREST_EXPENSE: 'debt_maturity',
  TAX_EXPENSE: 'tax_nol',
  RETAINED_EARNINGS: 'equity_re',
};

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

async function resolveSourceStatementPackVersion(businessVersionId: string): Promise<string | null> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ source_version_id: string }>(
      `SELECT source_version_id FROM finance_lineage_edges
        WHERE edge_type = 'STATEMENT_TO_MODEL' AND target_version_id = ?`,
      [businessVersionId]
    )
  );
  return row?.source_version_id ?? null;
}

function toIsoDate(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

export function daysInPeriod(p: PeriodMetaRow): number {
  const start = Date.parse(`${toIsoDate(p.period_start)}T00:00:00Z`);
  const end = Date.parse(`${toIsoDate(p.period_end)}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

export interface LoadedContext {
  model: BaselineModelRow;
  artifactId: string;
  sourceWorkingRevisionId: string | null;
  sourceStatementPackVersionId: string;
  lineIdByCode: Map<CanonicalCode, string>;
  periodByCode: Map<string, PeriodMetaRow>; // period_id -> meta
  revenueHistoryByFiscalYearMonth: Map<string, number>; // "YYYY-M" -> REVENUE actual
  openingCells: Map<CanonicalCode, number>; // opening BS actuals at openingBalanceSheetPeriodId
  schedulesByType: Map<string, BaselineScheduleRow[]>; // schedule_type -> rows for this entity
  assumptions: Map<string, number>; // `${scheduleType}::${driverCode}` -> value_decimal
}

/**
 * WP-D08 reuse note: `params.businessVersionId` must be the BASELINE MODEL's own
 * `business_version_id` (the one with a `finance_baseline_models` row and an inbound
 * `STATEMENT_TO_MODEL` edge) — NOT a Prediction Scenario's `business_version_id`. A caller in
 * `predictionComputeService.ts`/`predictionPreflightService.ts` resolves that baseline model
 * version first (via the scenario's own `MODEL_TO_SCENARIO` lineage edge, ADR WP-D07 section 2)
 * and passes it here — this function itself is completely unaware Prediction exists.
 */
export async function loadContext(params: RunBaselineComputeParams): Promise<
  | { ok: true; ctx: LoadedContext }
  | { ok: false; code: 'NO_SOURCE_STATEMENT_PACK_EDGE' | 'NO_BASELINE_MODEL_ROW'; message: string }
> {
  const sourceStatementPackVersionId = await resolveSourceStatementPackVersion(params.businessVersionId);
  if (!sourceStatementPackVersionId) {
    return {
      ok: false,
      code: 'NO_SOURCE_STATEMENT_PACK_EDGE',
      message: `No STATEMENT_TO_MODEL lineage edge targets business_version_id ${params.businessVersionId}`,
    };
  }

  // W9-C-1 fix: every read below is now scoped to params.organizationId. A
  // cross-tenant businessVersionId must refuse HERE, at the first row fetched
  // (finance_baseline_models), exactly the same NOT_FOUND-shaped typed refusal
  // this function already returns for a genuinely nonexistent id — never a
  // raw Postgres error, and never another org's data.
  const model = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<BaselineModelRow>(`SELECT * FROM finance_baseline_models WHERE business_version_id = ? AND organization_id = ?`, [
      params.businessVersionId,
      params.organizationId,
    ])
  );
  if (!model) {
    return { ok: false, code: 'NO_BASELINE_MODEL_ROW', message: `No finance_baseline_models row for ${params.businessVersionId}` };
  }
  const bv = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ artifact_id: string; source_working_revision_id: string | null }>(
      `SELECT artifact_id, source_working_revision_id FROM finance_business_versions WHERE business_version_id = ? AND organization_id = ?`,
      [params.businessVersionId, params.organizationId]
    )
  );
  if (!bv) {
    return { ok: false, code: 'NO_BASELINE_MODEL_ROW', message: `No finance_business_versions row for ${params.businessVersionId}` };
  }

  const [lineRows, periodRows, historyLineRows, openingLineRows, scheduleRows, assumptionRows] = await Promise.all([
    withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string; line_code: string }>(`SELECT id, line_code FROM financial_statement_lines WHERE line_code = ANY(?)`, [
        [...CANONICAL_CODES],
      ])
    ),
    withPinnedPostgresTransaction((tx) =>
      tx.queryAll<PeriodMetaRow>(`SELECT period_id, fiscal_year, fiscal_month, period_start, period_end FROM finance_stmt_periods WHERE organization_id = ?`, [
        params.organizationId,
      ])
    ),
    // Revenue history — ALL REVENUE actuals for this entity from the source Statement Pack
    // (needed for PRIOR_YEAR_SAME_PERIOD lookups across the whole forecast horizon).
    withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ period_id: string; value_decimal: string | null; value_status: string }>(
        `SELECT sl.period_id, sl.value_decimal, sl.value_status
           FROM finance_stmt_lines sl
           JOIN financial_statement_lines fsl ON fsl.id = sl.canonical_line_id
          WHERE sl.business_version_id = ? AND sl.organization_id = ? AND sl.entity_id = ? AND fsl.line_code = 'REVENUE'
            AND sl.consolidation_scope = 'CONSOLIDATED'`,
        [sourceStatementPackVersionId, params.organizationId, params.entityId]
      )
    ),
    withPinnedPostgresTransaction((tx) =>
      tx.queryAll<StmtLineCellRow>(
        `SELECT fsl.line_code AS canonical_line_id, sl.value_decimal, sl.value_status
           FROM finance_stmt_lines sl
           JOIN financial_statement_lines fsl ON fsl.id = sl.canonical_line_id
          WHERE sl.business_version_id = ? AND sl.organization_id = ? AND sl.entity_id = ? AND sl.period_id = ?
            AND sl.consolidation_scope = 'CONSOLIDATED'`,
        [sourceStatementPackVersionId, params.organizationId, params.entityId, params.openingBalanceSheetPeriodId]
      )
    ),
    withPinnedPostgresTransaction((tx) =>
      tx.queryAll<BaselineScheduleRow>(
        `SELECT schedule_type, entity_id, schedule_item_code, payload FROM finance_baseline_schedules
          WHERE business_version_id = ? AND organization_id = ? AND entity_id = ?`,
        [params.businessVersionId, params.organizationId, params.entityId]
      )
    ),
    withPinnedPostgresTransaction((tx) =>
      tx.queryAll<BaselineAssumptionRow>(
        `SELECT schedule_type, driver_code, entity_id, value_decimal, value_status FROM finance_baseline_assumptions
          WHERE business_version_id = ? AND organization_id = ? AND entity_id = ?`,
        [params.businessVersionId, params.organizationId, params.entityId]
      )
    ),
  ]);

  const lineIdByCode = new Map<CanonicalCode, string>();
  for (const r of lineRows) lineIdByCode.set(r.line_code as CanonicalCode, r.id);

  const periodByCode = new Map<string, PeriodMetaRow>();
  for (const r of periodRows) periodByCode.set(r.period_id, r);

  const revenueLineId = lineIdByCode.get('REVENUE');
  const revenueHistoryByFiscalYearMonth = new Map<string, number>();
  for (const r of historyLineRows) {
    const p = periodByCode.get(r.period_id);
    if (!p || p.fiscal_month === null) continue;
    if (r.value_status === 'MISSING' || r.value_decimal === null) continue;
    revenueHistoryByFiscalYearMonth.set(`${p.fiscal_year}-${p.fiscal_month}`, Number(r.value_decimal));
  }
  void revenueLineId;

  const openingCells = new Map<CanonicalCode, number>();
  for (const r of openingLineRows) {
    if (r.value_status === 'MISSING' || r.value_decimal === null) continue;
    openingCells.set(r.canonical_line_id as CanonicalCode, Number(r.value_decimal));
  }

  const schedulesByType = new Map<string, BaselineScheduleRow[]>();
  for (const r of scheduleRows) {
    const list = schedulesByType.get(r.schedule_type) ?? [];
    list.push(r);
    schedulesByType.set(r.schedule_type, list);
  }

  const assumptions = new Map<string, number>();
  for (const r of assumptionRows) {
    if (r.value_status === 'MISSING' || r.value_decimal === null) continue;
    assumptions.set(`${r.schedule_type}::${r.driver_code}`, Number(r.value_decimal));
  }

  return {
    ok: true,
    ctx: {
      model,
      artifactId: bv.artifact_id,
      sourceWorkingRevisionId: bv.source_working_revision_id,
      sourceStatementPackVersionId,
      lineIdByCode,
      periodByCode,
      revenueHistoryByFiscalYearMonth,
      openingCells,
      schedulesByType,
      assumptions,
    },
  };
}

export function requireAssumption(ctx: LoadedContext, scheduleType: string, driverCode: string): number {
  const v = ctx.assumptions.get(`${scheduleType}::${driverCode}`);
  if (v === undefined) throw new Error(`baselineComputeService: missing assumption ${scheduleType}::${driverCode}`);
  return v;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RunBaselineComputeParams {
  organizationId: string;
  businessVersionId: string;
  requestedByUserId: string;
  engineManifestId: string;
  requestId?: string | null;
  entityId: string;
  /** Chronologically ordered, length must equal `finance_baseline_models.horizon_months`. */
  forecastPeriodIds: readonly string[];
  /** The last ACTUAL period (source Statement Pack) whose closing balance sheet seeds forecast period 0's opening state. */
  openingBalanceSheetPeriodId: string;
}

export interface PeriodComputeSummary {
  periodId: string;
  converged: boolean;
  iterationsUsed: number;
  cash: number;
  netIncome: number;
  qualityFlag: 'FUNDING_GAP' | null;
}

export type RunBaselineComputeResult =
  | { ok: true; job: ComputeJobRow; periodsComputed: number; monthlyResults: PeriodComputeSummary[] }
  | {
      ok: false;
      code:
        | 'NO_SOURCE_STATEMENT_PACK_EDGE'
        | 'NO_BASELINE_MODEL_ROW'
        | 'FORECAST_PERIOD_COUNT_MISMATCH'
        | 'MISSING_DEBT_MATURITY_SCHEDULE'
        | 'CIRCULARITY_NOT_CONVERGED'
        | 'TIE_OUT_FAILED'
        // W9-B-2 fix: `completeJobSuccess()` reported `NOT_RUNNING` — the job was
        // cancelled (or otherwise left 'running') between claim() and this call, so
        // NO `compute_job_outputs` row and NO 'succeeded' transition happened for it.
        // Per-period `finance_baseline_outputs` rows above may already be persisted
        // (written in their own transaction, before this point), but the job-level
        // commit that makes this run the authoritative/linked one did NOT happen —
        // this must NOT be reported as success. See W2_FALSE_SUCCESS_W9B2_report.md.
        | 'JOB_NOT_RUNNING';
      message: string;
      failedAtPeriodId?: string;
      partialResults?: PeriodComputeSummary[];
    };

export async function runBaselineCompute(params: RunBaselineComputeParams): Promise<RunBaselineComputeResult> {
  const loaded = await loadContext(params);
  if (!loaded.ok) return loaded;
  const ctx = loaded.ctx;

  if (params.forecastPeriodIds.length !== ctx.model.horizon_months) {
    return {
      ok: false,
      code: 'FORECAST_PERIOD_COUNT_MISMATCH',
      message: `forecastPeriodIds has ${params.forecastPeriodIds.length} entries but horizon_months=${ctx.model.horizon_months}`,
    };
  }

  const debtSchedules = ctx.schedulesByType.get('debt_maturity') ?? [];
  const debtSchedule = debtSchedules[0]; // P0: single facility per entity (documented scope boundary)
  if (!debtSchedule) {
    return { ok: false, code: 'MISSING_DEBT_MATURITY_SCHEDULE', message: `No debt_maturity finance_baseline_schedules row for entity ${params.entityId}` };
  }
  const debtPayload = debtSchedule.payload as {
    principal_opening: number;
    contractual_rate: number; // ANNUAL
    amortization_schedule: number[]; // chronological, one entry per forecast month
    mandatory_sweep_pct?: number;
    mandatory_sweep_threshold?: number;
  };

  const cashInterestRateAnnual = ctx.model.interest_income_on_cash_modeled
    ? requireAssumption(ctx, 'debt_maturity', 'CASH_INTEREST_RATE_ANNUAL_PCT')
    : 0;

  // --- job bookkeeping (ADR section 3 pt 5 / WP-B04 §12 pt 3: job_type reserved as 'model_compute';
  //     this module uses the more literal 'BASELINE_COMPUTE' per the WP-D06 brief's own instruction,
  //     documented divergence — see WP-D06 report). ---
  const inputRevisionHash = createHash('sha256')
    .update(JSON.stringify({ businessVersionId: params.businessVersionId, entityId: params.entityId, forecastPeriodIds: params.forecastPeriodIds }))
    .digest('hex');
  const { job } = await computeJobService.enqueue({
    organizationId: params.organizationId,
    jobType: 'BASELINE_COMPUTE',
    inputArtifactId: ctx.artifactId,
    inputRevisionHash,
    engineManifestId: params.engineManifestId,
    idempotencyKey: `baseline-compute:${params.businessVersionId}:${inputRevisionHash}`,
    requestedByUserId: params.requestedByUserId,
    requestId: params.requestId ?? null,
  });
  const [claimed] = await computeJobService.claim({ workerId: `baselineComputeService:${uuidv4()}`, jobTypes: ['BASELINE_COMPUTE'], limit: 1 });
  const runningJob = claimed && claimed.id === job.id ? claimed : job;

  // --- prior-period state, seeded from the opening (actual) balance sheet ---
  const other = (code: CanonicalCode) => ctx.openingCells.get(code) ?? 0;
  let priorFixedAssets = other('FIXED_ASSETS');
  let priorAr = other('AR');
  let priorInventory = other('INVENTORY');
  let priorAp = other('AP');
  let priorDebt = other('LONG_TERM_DEBT');
  let priorCash = other('CASH');
  let priorRetainedEarnings = other('RETAINED_EARNINGS');
  const otherEquityConst = other('EQUITY') - other('RETAINED_EARNINGS');

  const monthlyResults: PeriodComputeSummary[] = [];

  try {
    await withPinnedPostgresTransaction(async (tx) => {
      for (let i = 0; i < params.forecastPeriodIds.length; i++) {
        const periodId = params.forecastPeriodIds[i];
        const period = ctx.periodByCode.get(periodId);
        if (!period || period.fiscal_month === null) throw new Error(`baselineComputeService: period ${periodId} not found or not a MONTH period`);

        const priorYearKey = `${period.fiscal_year - 1}-${period.fiscal_month}`;
        const priorYearRevenue = ctx.revenueHistoryByFiscalYearMonth.get(priorYearKey);
        if (priorYearRevenue === undefined) {
          throw new Error(`baselineComputeService: no PRIOR_YEAR_SAME_PERIOD REVENUE actual for ${priorYearKey} (period ${periodId})`);
        }

        const revenue = computeRevenuePvm({
          priorYearSameMonthRevenue: priorYearRevenue,
          annualGrowthRate: requireAssumption(ctx, 'revenue_pvm', 'REVENUE_GROWTH_YOY'),
        });
        const { cogs, opex, grossMargin, ebitda } = computeCogsOpex({
          revenue,
          cogsRatio: requireAssumption(ctx, 'cogs_opex', 'COGS_PCT_OF_REVENUE'),
          opexRatio: requireAssumption(ctx, 'cogs_opex', 'OPEX_PCT_OF_REVENUE'),
        });
        const { capex, depreciation, closingFixedAssets } = computeCapexDepreciation({
          revenue,
          priorFixedAssets,
          capexPctOfRevenue: requireAssumption(ctx, 'capex_depreciation', 'CAPEX_PCT_OF_REVENUE'),
          usefulLifeMonths: requireAssumption(ctx, 'capex_depreciation', 'USEFUL_LIFE_MONTHS'),
        });
        const ebit = ebitda - depreciation;

        const days = daysInPeriod(period);
        const { ar, inventory, ap } = computeWcDsoDioDpo({
          revenue,
          cogs,
          daysInPeriod: days,
          dsoDays: requireAssumption(ctx, 'wc_dso_dio_dpo', 'DSO_DAYS'),
          dioDays: requireAssumption(ctx, 'wc_dso_dio_dpo', 'DIO_DAYS'),
          dpoDays: requireAssumption(ctx, 'wc_dso_dio_dpo', 'DPO_DAYS'),
        });
        const deltaWorkingCapital = (ar - priorAr) + (inventory - priorInventory) - (ap - priorAp);

        const statutoryTaxRate = requireAssumption(ctx, 'tax_nol', 'STATUTORY_TAX_RATE_PCT');
        const scheduledAmortization = lookupScheduledAmortization({ scheduledPrincipalByMonth: debtPayload.amortization_schedule }, i);

        const solved: CircularityPeriodResult = solvePeriod({
          priorCash,
          priorDebt,
          toleranceCurrency: Number(ctx.model.circularity_tolerance_currency),
          maxIterations: ctx.model.circularity_max_iterations,
          interestIncomeOnCashModeled: ctx.model.interest_income_on_cash_modeled,
          mandatoryContractualCashSweepModeled: ctx.model.mandatory_contractual_cash_sweep_modeled,
          contractualRateMonthly: debtPayload.contractual_rate / 12,
          cashInterestRateMonthly: cashInterestRateAnnual / 12,
          scheduledAmortization,
          sweepPct: debtPayload.mandatory_sweep_pct ?? 0,
          sweepThreshold: debtPayload.mandatory_sweep_threshold ?? 0,
          ebit,
          depreciation,
          deltaWorkingCapital,
          capex,
          statutoryTaxRate,
        });

        if (!solved.converged) {
          // Fail-closed (ADR section 6.2): a non-converged period aborts the WHOLE run (the
          // outer transaction below is rolled back — no finance_baseline_outputs commit for this
          // job, WP-B04 "commit only on success"). But the diagnostics row and the
          // finance_exceptions(SECURITY/UNDEFINED_MATH) row MUST survive that rollback (ADR
          // section 4.5: "diagnostyka non-convergence musi żyć gdzie indziej niż output") — both
          // are written via their own, independently-committed `withPinnedPostgresTransaction`
          // calls (a fresh pooled connection each, per `PostgresDatabase.ts`), never inside `tx`.
          await withPinnedPostgresTransaction((diagTx) =>
            diagTx.queryRun(
              `INSERT INTO finance_baseline_solver_diagnostics
                 (id, organization_id, business_version_id, compute_job_id, period_id, iterations_used, converged, final_residual_currency, tolerance_applied)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                uuidv4(), params.organizationId, params.businessVersionId, runningJob.id, periodId,
                solved.iterationsUsed, solved.converged, solved.finalResidual, Number(ctx.model.circularity_tolerance_currency),
              ]
            )
          );
          const raised = await exceptionLedgerService.raise({
            organizationId: params.organizationId,
            artifactId: runningJob.input_artifact_id,
            businessVersionId: params.businessVersionId,
            severity: 'SECURITY',
            blockingCategory: 'UNDEFINED_MATH',
            sourceRef: { periodId, iterationsUsed: solved.iterationsUsed, residual: solved.finalResidual, entityId: params.entityId },
            raisedBy: params.requestedByUserId,
            reasonCode: 'BASELINE_CIRCULARITY_NOT_CONVERGED',
          });
          void raised;
          throw new BaselineNonConvergenceError(periodId, monthlyResults);
        }

        await tx.queryRun(
          `INSERT INTO finance_baseline_solver_diagnostics
             (id, organization_id, business_version_id, compute_job_id, period_id, iterations_used, converged, final_residual_currency, tolerance_applied)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(), params.organizationId, params.businessVersionId, runningJob.id, periodId,
            solved.iterationsUsed, solved.converged, solved.finalResidual, Number(ctx.model.circularity_tolerance_currency),
          ]
        );

        // --- Tax/NI cross-check: solvePeriod() already computes NI internally (it owns the
        //     interest<->NI loop) — computeTaxNol here is used only as an independent sanity
        //     re-derivation from the solver's own pretaxIncome, not a second source of truth. ---
        const taxCheck = computeTaxNol({ pretaxIncome: solved.pretaxIncome, statutoryTaxRate });
        if (Math.abs(taxCheck.netIncome - solved.netIncome) > 1e-6) {
          throw new Error(`baselineComputeService: internal inconsistency, solver NI ${solved.netIncome} != recomputed NI ${taxCheck.netIncome} for ${periodId}`);
        }

        const { closingRetainedEarnings } = computeEquityRe({ priorRetainedEarnings, netIncome: solved.netIncome, dividendsDeclared: 0 });
        const equity = otherEquityConst + closingRetainedEarnings;
        const currentAssets = solved.cash + ar + inventory;
        const totalAssets = currentAssets + closingFixedAssets;
        const currentLiabilities = ap;
        const totalLiabilities = currentLiabilities + solved.debt;
        const totalLiabilitiesEquity = totalLiabilities + equity;
        const workingCapital = currentAssets - currentLiabilities;
        const fcf = solved.cfo + solved.cfi;

        const tolerance = Number(ctx.model.circularity_tolerance_currency);
        if (Math.abs(totalAssets - totalLiabilitiesEquity) > tolerance) {
          // Per the brief: a math-inconsistent result here is a BUG IN THIS ENGINE, not in the DB
          // triggers (which are already tested, WP-D05b section 6) — fail loudly before even
          // attempting the INSERT the DB's own deferred balance trigger would also reject.
          throw new Error(
            `baselineComputeService: engine bug — BS does not balance for ${periodId}: assets=${totalAssets} liab+equity=${totalLiabilitiesEquity} diff=${Math.abs(totalAssets - totalLiabilitiesEquity)}`
          );
        }

        const values: Partial<Record<CanonicalCode, number>> = {
          REVENUE: revenue, COGS: cogs, GROSS_MARGIN: grossMargin, OPEX: opex, EBITDA: ebitda, DEPRECIATION: depreciation, EBIT: ebit,
          INTEREST_EXPENSE: solved.interestExpense, TAX_EXPENSE: solved.taxExpense, NET_INCOME: solved.netIncome,
          CASH: solved.cash, AR: ar, INVENTORY: inventory, CURRENT_ASSETS: currentAssets, FIXED_ASSETS: closingFixedAssets, TOTAL_ASSETS: totalAssets,
          AP: ap, CURRENT_LIABILITIES: currentLiabilities, LONG_TERM_DEBT: solved.debt, TOTAL_LIABILITIES: totalLiabilities,
          EQUITY: equity, TOTAL_LIABILITIES_EQUITY: totalLiabilitiesEquity, RETAINED_EARNINGS: closingRetainedEarnings, WORKING_CAPITAL: workingCapital,
          CFO: solved.cfo, CFI: solved.cfi, CFF: solved.cff, NET_CHANGE_CASH: solved.netChangeCash, CAPEX: capex, FCF: fcf,
        };

        for (const code of CANONICAL_CODES) {
          const lineId = ctx.lineIdByCode.get(code);
          if (!lineId) throw new Error(`baselineComputeService: canonical line ${code} not found in financial_statement_lines`);

          const isDividends = code === 'DIVIDENDS_DECLARED';
          const value = isDividends ? null : values[code]!;
          const valueStatus = isDividends ? 'NA' : value === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO';

          await tx.queryRun(
            `INSERT INTO finance_baseline_outputs (
               id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id, consolidation_scope,
               value_status, value_decimal, native_currency, presentation_currency, unit, multiplier,
               value_kind, driving_schedule_type, created_by
             ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CONSOLIDATED', ?, ?, ?, ?, 'UNITS', 1, 'FORECAST', ?, ?)`,
            [
              uuidv4(), params.organizationId, params.businessVersionId, STATEMENT_TYPE_OF[code], lineId, params.entityId, periodId,
              valueStatus, value, 'PLN', 'PLN', DRIVING_SCHEDULE_TYPE[code] ?? null, params.requestedByUserId,
            ]
          );
        }

        monthlyResults.push({
          periodId,
          converged: solved.converged,
          iterationsUsed: solved.iterationsUsed,
          cash: solved.cash,
          netIncome: solved.netIncome,
          qualityFlag: solved.cash < 0 ? 'FUNDING_GAP' : null,
        });

        priorFixedAssets = closingFixedAssets;
        priorAr = ar;
        priorInventory = inventory;
        priorAp = ap;
        priorDebt = solved.debt;
        priorCash = solved.cash;
        priorRetainedEarnings = closingRetainedEarnings;
      }
    });
  } catch (error: any) {
    await computeJobService.failJob({ jobId: runningJob.id, organizationId: params.organizationId, error: String(error?.message || error) });
    if (error instanceof BaselineNonConvergenceError) {
      return {
        ok: false,
        code: 'CIRCULARITY_NOT_CONVERGED',
        message: `Circularity solver did not converge for period ${error.periodId} within finance_baseline_models.circularity_max_iterations`,
        failedAtPeriodId: error.periodId,
        partialResults: error.partialResults,
      };
    }
    if (/does not balance/.test(String(error?.message))) {
      return { ok: false, code: 'TIE_OUT_FAILED', message: String(error?.message || error) };
    }
    throw error;
  }

  if (!ctx.sourceWorkingRevisionId) {
    throw new Error(
      `baselineComputeService: finance_business_versions.source_working_revision_id is not set for ${params.businessVersionId} — compute_job_outputs requires a real finance_working_revisions row (WP-B04 schema), same requirement kpiComputeService.ts already documents`
    );
  }
  const contentSemanticHash = createHash('sha256').update(JSON.stringify(monthlyResults)).digest('hex');
  const completed = await computeJobService.completeJobSuccess({
    jobId: runningJob.id,
    organizationId: params.organizationId,
    outputArtifactId: runningJob.input_artifact_id,
    outputBusinessVersionId: params.businessVersionId,
    outputWorkingRevisionId: ctx.sourceWorkingRevisionId,
    contentSemanticHash,
  });
  // W9-B-2 fix: NOT_RUNNING means the job was cancelled/lease-expired/already
  // terminal by the time we tried to commit — never report success for a run
  // whose compute_job_outputs commit did not happen. OUTPUT_ALREADY_COMMITTED
  // is treated as an idempotent-safe outcome (see report §"NOT_RUNNING vs
  // OUTPUT_ALREADY_COMMITTED"): another attempt for this SAME job_id already
  // committed an output, so we fall through and reuse the authoritative row.
  if (!completed.ok && completed.code === 'NOT_RUNNING') {
    return {
      ok: false,
      code: 'JOB_NOT_RUNNING',
      message: `baselineComputeService: completeJobSuccess reported NOT_RUNNING for job ${runningJob.id}: ${completed.message}`,
    };
  }
  // W10-D01 fix: stamp the SAME hash + the compute job that produced it onto
  // the working revision itself — before this, `content_semantic_hash` only
  // ever reached `compute_job_outputs`, never `finance_working_revisions`, so
  // compute pinning (`computePinning.ts`) and the approve-time snapshot
  // freeze (`approveVersion()` step (b)) always saw NULL.
  await stampWorkingRevisionComputeIdentity({
    organizationId: params.organizationId,
    workingRevisionId: ctx.sourceWorkingRevisionId,
    contentSemanticHash,
    computeRunId: runningJob.id,
  });

  const finalJob = completed.ok ? completed.job : ((await computeJobService.getJob(params.organizationId, job.id)) ?? runningJob);
  return { ok: true, job: finalJob, periodsComputed: monthlyResults.length, monthlyResults };
}

class BaselineNonConvergenceError extends Error {
  constructor(public readonly periodId: string, public readonly partialResults: PeriodComputeSummary[]) {
    super(`baseline circularity solver did not converge for period ${periodId}`);
  }
}
