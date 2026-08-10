/**
 * Finance v3 canonical — Prediction Compute, Stage 2: compute (Gate D / Fala 6, WP-D08).
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 8. Schema: `WP-D07_prediction_schema_ADR.md` sections 6.2/6.3 (readiness gate /
 * `job_type='PREDICTION_COMPUTE'`), 8 (Base = Baseline, all four layers already live), live-tested
 * in `WP-D07b_prediction_migration_report.md`.
 *
 * Two branches, per the WP-D08 brief:
 *   - `STANDARD_BASE` — calls `baselineComputeService.runBaselineCompute()` DIRECTLY, zero
 *     modification. This module writes NO `finance_prediction_outputs` row for that scenario (the
 *     DB physically forbids it, `finance_prediction_forbid_standard_base_outputs()`, already live) —
 *     the result is read back exclusively through `finance_prediction_outputs_effective`
 *     (`BASELINE_PASSTHROUGH`, already live). "Compute" for STANDARD_BASE is therefore: (re-)run the
 *     Baseline compute for the LINKED Baseline Model version if its output is missing/stale, then
 *     confirm the passthrough view is populated. Guarantees Base=Baseline BIT-FOR-BIT because there
 *     is only ever one underlying `finance_baseline_outputs` row — never an independent
 *     recomputation "happening to match" (ADR section 8.4).
 *   - Every other `scenario_mode` — loads the linked Baseline Model's own context via
 *     `baselineComputeService.loadContext()` (WP-D08 additive export, reused verbatim), overlays
 *     `finance_prediction_driver_overrides` on top of the Baseline assumption grid, adds
 *     `finance_prediction_impact_chain` deltas (ramp/duration/decay expanded, same math as
 *     `predictionPreflightService.ts`'s own Layer 2), runs the SAME `baselineScheduleEngine.ts`
 *     pure functions and the SAME `baselineCircularitySolver.solvePeriod()` (never duplicated),
 *     then overlays `finance_prediction_financing` cash flows — WHICH BASELINE PHYSICALLY EXCLUDES —
 *     on top of the solved figures. Writes `finance_prediction_outputs`.
 *
 * Reuse discipline / finding (WP-D08 brief instruction: "jeśli reużycie baselineScheduleEngine.ts
 * okaże się wymagać przebudowy jego API... opisz to jako finding"): NO change to
 * `baselineScheduleEngine.ts`'s or `baselineCircularitySolver.ts`'s public API was needed — every
 * function there already takes its inputs as plain scalars, so "override a driver" is simply
 * "call the same function with a different number". `baselineComputeService.ts` needed a small,
 * ADDITIVE (export-only, zero logic change) visibility change so its ~90-line Baseline-context
 * loader could be reused instead of re-implemented — see that file's own WP-D08 header note. This
 * module's own monthly loop is NOT a call into `runBaselineCompute()` for non-STANDARD_BASE modes
 * (deliberate — Prediction's loop injects overrides/impacts/financing at points
 * `runBaselineCompute()` has no parameter for), but every NUMERIC formula inside it is a call into
 * the shared engine files, never re-derived.
 */

import { createHash, randomUUID as uuidv4 } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import {
  computeCapexDepreciation,
  computeCogsOpex,
  computeEquityRe,
  computeRevenuePvm,
  computeWcDsoDioDpo,
  lookupScheduledAmortization,
} from './baselineScheduleEngine.js';
import { solvePeriod } from './baselineCircularitySolver.js';
import {
  loadContext,
  requireAssumption,
  runBaselineCompute,
  daysInPeriod,
  CANONICAL_CODES,
  STATEMENT_TYPE_OF,
  type CanonicalCode,
  type LoadedContext,
  type RunBaselineComputeParams,
} from './baselineComputeService.js';
import { impactChainEffectiveFraction } from './predictionPreflightService.js';
import { stampWorkingRevisionComputeIdentity } from './artifactVersionService.js';
import * as computeJobService from './computeJobService.js';
import type { ComputeJobRow } from './computeJobService.js';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

interface ScenarioRow {
  business_version_id: string;
  organization_id: string;
  scenario_mode: 'STANDARD_BASE' | 'STANDARD_UPSIDE' | 'STANDARD_DOWNSIDE' | 'DRIVER_OVERRIDE' | 'FUNDAMENTAL_INITIATIVE';
}

interface DriverOverrideRow {
  schedule_type: string;
  driver_code: string;
  entity_id: string;
  period_id: string;
  value_decimal: string | null;
}

interface ImpactChainRow {
  id: string;
  initiative_id: string;
  statement_line_id: string;
  entity_id: string;
  amount_kind: 'ABSOLUTE_AMOUNT' | 'PERCENT_OF_BASE' | 'PERCENT_DELTA';
  amount_decimal: string;
  sign: 'POSITIVE' | 'NEGATIVE';
  start_period_id: string | null;
  ramp_months: number | null;
  duration_months: number | null;
  decay_pct_per_period: string | null;
}

interface InitiativeDefaultsRow {
  id: string;
  default_start_period_id: string | null;
  default_ramp_months: number | null;
  default_duration_months: number | null;
}

interface FinancingRow {
  id: string;
  financing_kind:
    | 'FACILITY_DRAWDOWN'
    | 'DISCRETIONARY_REPAYMENT'
    | 'EQUITY_INJECTION'
    | 'DIVIDEND_DECLARATION'
    | 'SHARE_BUYBACK'
    | 'SURPLUS_ALLOCATION_POLICY'
    | 'COVENANT_DEFINITION'
    | 'MIN_CASH_POLICY';
  entity_id: string;
  period_id: string | null;
  payload: { amount?: number; principal?: number; rate?: number; tenor_months?: number };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RunPredictionComputeParams {
  organizationId: string;
  /** The Prediction Scenario's own `business_version_id`. */
  businessVersionId: string;
  requestedByUserId: string;
  engineManifestId: string;
  requestId?: string | null;
  entityId: string;
  /** Chronologically ordered — same horizon the linked Baseline Model itself forecasts. */
  forecastPeriodIds: readonly string[];
  openingBalanceSheetPeriodId: string;
}

export interface PredictionPeriodResult {
  periodId: string;
  values: Partial<Record<CanonicalCode, number>>;
  varianceVsBaseline: Partial<Record<CanonicalCode, number>>;
}

export type RunPredictionComputeResult =
  | { ok: true; mode: 'STANDARD_BASE'; job: ComputeJobRow; baselineJob: ComputeJobRow | null; passthroughRowCount: number }
  | { ok: true; mode: 'COMPUTED'; job: ComputeJobRow; periodsComputed: number; periods: PredictionPeriodResult[] }
  | {
      ok: false;
      code: 'READINESS_GATE_FAILED' | 'NO_SCENARIO_ROW' | 'NO_BASELINE_LINEAGE_EDGE' | 'MISSING_DEBT_MATURITY_SCHEDULE' | 'CIRCULARITY_NOT_CONVERGED' | 'BASELINE_COMPUTE_FAILED';
      message: string;
      readiness?: Array<{ check_name: string; passed: boolean; detail: string }>;
    };

/**
 * Stage 2 (ADR sections 6.2/6.3). Guards on `finance_prediction_can_start_compute()` FIRST —
 * building assumptions is never blocked by this gate (DEC-FIN-004), but COMPUTE is.
 */
export async function runPredictionCompute(params: RunPredictionComputeParams): Promise<RunPredictionComputeResult> {
  const canStart = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ can_start: boolean }>(`SELECT finance_prediction_can_start_compute(?) AS can_start`, [params.businessVersionId])
  );
  if (!canStart?.can_start) {
    const readiness = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ check_name: string; passed: boolean; detail: string }>(`SELECT * FROM finance_prediction_readiness_check(?)`, [params.businessVersionId])
    );
    return {
      ok: false,
      code: 'READINESS_GATE_FAILED',
      message: `finance_prediction_can_start_compute(${params.businessVersionId}) = false — PREDICTION_COMPUTE job type refused`,
      readiness,
    };
  }

  const scenario = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<ScenarioRow>(`SELECT business_version_id, organization_id, scenario_mode FROM finance_prediction_scenarios WHERE business_version_id = ?`, [
      params.businessVersionId,
    ])
  );
  if (!scenario) return { ok: false, code: 'NO_SCENARIO_ROW', message: `No finance_prediction_scenarios row for ${params.businessVersionId}` };

  const baselineModelVersionId = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ source_version_id: string }>(`SELECT source_version_id FROM finance_lineage_edges WHERE edge_type = 'MODEL_TO_SCENARIO' AND target_version_id = ?`, [
      params.businessVersionId,
    ])
  );
  if (!baselineModelVersionId) {
    return { ok: false, code: 'NO_BASELINE_LINEAGE_EDGE', message: `No MODEL_TO_SCENARIO lineage edge targets business_version_id ${params.businessVersionId}` };
  }

  if (scenario.scenario_mode === 'STANDARD_BASE') {
    return runStandardBase(params, baselineModelVersionId.source_version_id);
  }
  return runOverlayCompute(params, scenario, baselineModelVersionId.source_version_id);
}

// ---------------------------------------------------------------------------
// STANDARD_BASE — zero-modification passthrough (ADR section 8, "Base = Baseline")
// ---------------------------------------------------------------------------

async function runStandardBase(params: RunPredictionComputeParams, baselineModelVersionId: string): Promise<RunPredictionComputeResult> {
  // Idempotency check: `runBaselineCompute()` (WP-D06, untouched) is idempotent at the
  // `compute_jobs` row level (same idempotencyKey => same job row returned) but NOT at the
  // `finance_baseline_solver_diagnostics`/`finance_baseline_outputs` row level — a second call with
  // identical inputs re-attempts the same per-period INSERTs and collides on
  // `uq_finance_baseline_solver_diag(compute_job_id, period_id)`. Since STANDARD_BASE Prediction
  // Compute is defined as "ensure the linked Baseline is computed, then read it back" (brief: "zero
  // modyfikacji"), re-running an ALREADY-computed Baseline is unnecessary work, not a correctness
  // requirement — this check makes repeated STANDARD_BASE compute calls (e.g. a user re-opening
  // Models/Results) safe, without needing to change `baselineComputeService.ts` itself.
  const existingBaselineOutputCount = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ n: string }>(`SELECT count(*)::text AS n FROM finance_baseline_outputs WHERE business_version_id = ?`, [baselineModelVersionId])
  );
  let baselineJob: ComputeJobRow | null = null;
  let baselineContentHashSource: unknown;
  if (existingBaselineOutputCount && Number(existingBaselineOutputCount.n) > 0) {
    const existingRows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ canonical_line_id: string; period_id: string; value_decimal: string | null }>(
        `SELECT canonical_line_id, period_id, value_decimal FROM finance_baseline_outputs WHERE business_version_id = ? ORDER BY canonical_line_id, period_id`,
        [baselineModelVersionId]
      )
    );
    baselineContentHashSource = { alreadyComputed: true, rows: existingRows };
  } else {
    const baselineParams: RunBaselineComputeParams = {
      organizationId: params.organizationId,
      businessVersionId: baselineModelVersionId, // the BASELINE MODEL's own bv — never the scenario's
      requestedByUserId: params.requestedByUserId,
      engineManifestId: params.engineManifestId,
      requestId: params.requestId ?? null,
      entityId: params.entityId,
      forecastPeriodIds: params.forecastPeriodIds,
      openingBalanceSheetPeriodId: params.openingBalanceSheetPeriodId,
    };
    const baselineResult = await runBaselineCompute(baselineParams); // <-- literal, unmodified call
    if (!baselineResult.ok) {
      return { ok: false, code: 'BASELINE_COMPUTE_FAILED', message: `${baselineResult.code}: ${baselineResult.message}` };
    }
    baselineJob = baselineResult.job;
    baselineContentHashSource = { passthroughOf: baselineResult.job.id, monthlyResults: baselineResult.monthlyResults };
  }

  const contentSemanticHash = createHash('sha256').update(JSON.stringify(baselineContentHashSource)).digest('hex');

  const baselineModelArtifact = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ artifact_id: string }>(`SELECT artifact_id FROM finance_business_versions WHERE business_version_id = ?`, [baselineModelVersionId])
  );
  if (!baselineModelArtifact) throw new Error(`predictionComputeService: no finance_business_versions row for Baseline Model ${baselineModelVersionId}`);

  const { job } = await computeJobService.enqueue({
    organizationId: params.organizationId,
    jobType: 'PREDICTION_COMPUTE',
    inputArtifactId: baselineModelArtifact.artifact_id,
    inputRevisionHash: contentSemanticHash,
    engineManifestId: params.engineManifestId,
    idempotencyKey: `prediction-compute:${params.businessVersionId}:${contentSemanticHash}`,
    requestedByUserId: params.requestedByUserId,
    requestId: params.requestId ?? null,
  });
  // NEW-3 fix: self-claim the EXACT row just enqueued (by id, org-scoped) —
  // never the globally-oldest queued PREDICTION_COMPUTE job across every
  // organization (see computeJobService.claimById doc comment).
  const claimed = await computeJobService.claimById({
    organizationId: params.organizationId,
    jobId: job.id,
    workerId: `predictionComputeService:${uuidv4()}`,
  });
  if (!claimed) {
    throw new Error(
      `predictionComputeService: failed to self-claim just-enqueued job ${job.id} (organization ${params.organizationId}) — row is no longer 'queued' (concurrent claim or already terminal)`
    );
  }
  const runningJob = claimed;

  const scenarioWorkingRevision = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ source_working_revision_id: string | null }>(`SELECT source_working_revision_id FROM finance_business_versions WHERE business_version_id = ?`, [
      params.businessVersionId,
    ])
  );
  if (!scenarioWorkingRevision?.source_working_revision_id) {
    throw new Error(`predictionComputeService: finance_business_versions.source_working_revision_id is not set for ${params.businessVersionId}`);
  }

  await computeJobService.completeJobSuccess({
    jobId: runningJob.id,
    organizationId: params.organizationId,
    outputArtifactId: runningJob.input_artifact_id,
    outputBusinessVersionId: params.businessVersionId, // the SCENARIO's own bv, for job-output audit trail — no finance_prediction_outputs row exists or ever will for this scenario_mode
    outputWorkingRevisionId: scenarioWorkingRevision.source_working_revision_id,
    contentSemanticHash, // identical derivation from the SAME baseline job's own monthlyResults — proves bit-for-bit equivalence at the job-output level, not just the DB-row level
  });
  // W10-D01 fix — see baselineComputeService.ts's identical call for the full rationale.
  await stampWorkingRevisionComputeIdentity({
    organizationId: params.organizationId,
    workingRevisionId: scenarioWorkingRevision.source_working_revision_id,
    contentSemanticHash,
    computeRunId: runningJob.id,
  });
  const finalJob = (await computeJobService.getJob(params.organizationId, job.id)) ?? runningJob;

  const passthroughRows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{ n: string }>(`SELECT count(*)::text AS n FROM finance_prediction_outputs_effective WHERE business_version_id = ?`, [params.businessVersionId])
  );

  return { ok: true, mode: 'STANDARD_BASE', job: finalJob, baselineJob, passthroughRowCount: Number(passthroughRows[0]?.n ?? '0') };
}

// ---------------------------------------------------------------------------
// Non-STANDARD_BASE — overlay compute (driver_overrides + impact_chain + financing on top of the
// linked Baseline Model's own context, reusing baselineScheduleEngine.ts / baselineCircularitySolver.ts)
// ---------------------------------------------------------------------------

async function runOverlayCompute(
  params: RunPredictionComputeParams,
  scenario: ScenarioRow,
  baselineModelVersionId: string
): Promise<RunPredictionComputeResult> {
  const loaded = await loadContext({
    organizationId: params.organizationId,
    businessVersionId: baselineModelVersionId,
    requestedByUserId: params.requestedByUserId,
    engineManifestId: params.engineManifestId,
    entityId: params.entityId,
    forecastPeriodIds: params.forecastPeriodIds,
    openingBalanceSheetPeriodId: params.openingBalanceSheetPeriodId,
  });
  if (!loaded.ok) return { ok: false, code: 'BASELINE_COMPUTE_FAILED', message: `${loaded.code}: ${loaded.message}` };
  const ctx = loaded.ctx;

  const debtSchedules = ctx.schedulesByType.get('debt_maturity') ?? [];
  const debtSchedule = debtSchedules[0];
  if (!debtSchedule) {
    return { ok: false, code: 'MISSING_DEBT_MATURITY_SCHEDULE', message: `No debt_maturity finance_baseline_schedules row for entity ${params.entityId}` };
  }
  const debtPayload = debtSchedule.payload as {
    principal_opening: number;
    contractual_rate: number;
    amortization_schedule: number[];
    mandatory_sweep_pct?: number;
    mandatory_sweep_threshold?: number;
  };

  // Baseline's OWN already-computed outputs for the linked model — used for (a) variance_vs_baseline
  // and (b) as the "base" input to driver-override math when a period's own PRIOR_YEAR_SAME_PERIOD
  // revenue actual is not itself enough (kept consistent with predictionPreflightService.ts's own
  // Layer 2, same computation path).
  const baselineOutputRows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{ canonical_line_id: string; period_id: string; value_decimal: string | null }>(
      `SELECT canonical_line_id, period_id, value_decimal FROM finance_baseline_outputs WHERE business_version_id = ? AND entity_id = ?`,
      [baselineModelVersionId, params.entityId]
    )
  );
  const lineCodeById = new Map<string, string>();
  for (const code of CANONICAL_CODES) {
    const id = ctx.lineIdByCode.get(code);
    if (id) lineCodeById.set(id, code);
  }
  const baselineValueByCellKey = new Map<string, number>(); // `${lineCode}::${periodId}` -> value
  for (const r of baselineOutputRows) {
    const code = lineCodeById.get(r.canonical_line_id);
    if (code && r.value_decimal !== null) baselineValueByCellKey.set(`${code}::${r.period_id}`, Number(r.value_decimal));
  }

  const [driverOverrideRows, impactChainRows, initiativeRows, financingRows, lineIdRows] = await Promise.all([
    withPinnedPostgresTransaction((tx) =>
      tx.queryAll<DriverOverrideRow>(
        `SELECT schedule_type, driver_code, entity_id, period_id, value_decimal FROM finance_prediction_driver_overrides WHERE business_version_id = ? AND entity_id = ?`,
        [params.businessVersionId, params.entityId]
      )
    ),
    withPinnedPostgresTransaction((tx) =>
      tx.queryAll<ImpactChainRow>(
        `SELECT id, initiative_id, statement_line_id, entity_id, amount_kind, amount_decimal, sign, start_period_id, ramp_months, duration_months, decay_pct_per_period
           FROM finance_prediction_impact_chain WHERE business_version_id = ? AND entity_id = ?`,
        [params.businessVersionId, params.entityId]
      )
    ),
    withPinnedPostgresTransaction((tx) =>
      tx.queryAll<InitiativeDefaultsRow>(
        `SELECT id, default_start_period_id, default_ramp_months, default_duration_months FROM finance_prediction_initiatives WHERE business_version_id = ?`,
        [params.businessVersionId]
      )
    ),
    withPinnedPostgresTransaction((tx) =>
      tx.queryAll<FinancingRow>(`SELECT id, financing_kind, entity_id, period_id, payload FROM finance_prediction_financing WHERE business_version_id = ? AND entity_id = ?`, [
        params.businessVersionId,
        params.entityId,
      ])
    ),
    withPinnedPostgresTransaction((tx) => tx.queryAll<{ id: string; line_code: string }>(`SELECT id, line_code FROM financial_statement_lines`)),
  ]);
  const lineIdByCode2 = new Map<string, string>();
  for (const r of lineIdRows) lineIdByCode2.set(r.line_code, r.id);
  const lineCodeById2 = new Map<string, string>();
  for (const r of lineIdRows) lineCodeById2.set(r.id, r.line_code);

  const driverOverrideMap = new Map<string, number>(); // `${scheduleType}::${driverCode}::${periodId}` -> value
  for (const r of driverOverrideRows) {
    if (r.value_decimal !== null) driverOverrideMap.set(`${r.schedule_type}::${r.driver_code}::${r.period_id}`, Number(r.value_decimal));
  }
  const resolveDriver = (scheduleType: string, driverCode: string, periodId: string): number =>
    driverOverrideMap.get(`${scheduleType}::${driverCode}::${periodId}`) ?? requireAssumption(ctx, scheduleType, driverCode);

  const initiativeById = new Map(initiativeRows.map((r) => [r.id, r]));
  const impactsByLineCode = new Map<string, ImpactChainRow[]>();
  for (const row of impactChainRows) {
    const code = lineCodeById2.get(row.statement_line_id);
    if (!code) continue;
    const list = impactsByLineCode.get(code) ?? [];
    list.push(row);
    impactsByLineCode.set(code, list);
  }

  /** Additive currency delta for `lineCode` at forecast-array index `i`, from every impact_chain row targeting it (ADR section 4.4 amount_kind/sign, ramp/duration/decay via predictionPreflightService's shared fraction function). `preImpactBase` is the value BEFORE impacts (needed for PERCENT_OF_BASE/PERCENT_DELTA). */
  const impactDeltaFor = (lineCode: string, i: number, forecastPeriodIds: readonly string[], preImpactBase: number): number => {
    const rows = impactsByLineCode.get(lineCode);
    if (!rows || rows.length === 0) return 0;
    let total = 0;
    for (const row of rows) {
      const initiative = initiativeById.get(row.initiative_id);
      const startPeriodId = row.start_period_id ?? initiative?.default_start_period_id ?? null;
      if (!startPeriodId) continue;
      const startIndex = forecastPeriodIds.indexOf(startPeriodId);
      const monthsSinceStart = startIndex >= 0 ? i - startIndex : i; // not found in this horizon => treat as already-started (pre-horizon initiative), same simplification documented in the report
      const rampMonths = row.ramp_months ?? initiative?.default_ramp_months ?? null;
      const durationMonths = row.duration_months ?? initiative?.default_duration_months ?? null;
      const decay = row.decay_pct_per_period === null || row.decay_pct_per_period === undefined ? null : Number(row.decay_pct_per_period);
      const fraction = impactChainEffectiveFraction(monthsSinceStart, rampMonths, durationMonths, decay);
      if (fraction === 0) continue;
      const signMultiplier = row.sign === 'NEGATIVE' ? -1 : 1;
      const amount = Number(row.amount_decimal);
      const raw = row.amount_kind === 'ABSOLUTE_AMOUNT' ? amount : amount * preImpactBase; // PERCENT_OF_BASE and PERCENT_DELTA both scale off the pre-impact base for this P0 (documented simplification, report section on scope)
      total += signMultiplier * raw * fraction;
    }
    return total;
  };

  const scenarioArtifactEarly = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ artifact_id: string; source_working_revision_id: string | null }>(
      `SELECT artifact_id, source_working_revision_id FROM finance_business_versions WHERE business_version_id = ?`,
      [params.businessVersionId]
    )
  );
  if (!scenarioArtifactEarly) {
    throw new Error(`predictionComputeService: no finance_business_versions row for Prediction Scenario ${params.businessVersionId}`);
  }

  // --- job bookkeeping (job_type='PREDICTION_COMPUTE', ADR section 6.3, documented precedent) ---
  const inputRevisionHash = createHash('sha256')
    .update(JSON.stringify({ businessVersionId: params.businessVersionId, entityId: params.entityId, forecastPeriodIds: params.forecastPeriodIds }))
    .digest('hex');
  const { job } = await computeJobService.enqueue({
    organizationId: params.organizationId,
    jobType: 'PREDICTION_COMPUTE',
    inputArtifactId: scenarioArtifactEarly.artifact_id,
    inputRevisionHash,
    engineManifestId: params.engineManifestId,
    idempotencyKey: `prediction-compute:${params.businessVersionId}:${inputRevisionHash}`,
    requestedByUserId: params.requestedByUserId,
    requestId: params.requestId ?? null,
  });
  // NEW-3 fix: self-claim the EXACT row just enqueued (by id, org-scoped) —
  // never the globally-oldest queued PREDICTION_COMPUTE job across every
  // organization (see computeJobService.claimById doc comment).
  const claimed = await computeJobService.claimById({
    organizationId: params.organizationId,
    jobId: job.id,
    workerId: `predictionComputeService:${uuidv4()}`,
  });
  if (!claimed) {
    throw new Error(
      `predictionComputeService: failed to self-claim just-enqueued job ${job.id} (organization ${params.organizationId}) — row is no longer 'queued' (concurrent claim or already terminal)`
    );
  }
  const runningJob = claimed;

  const other = (code: CanonicalCode) => ctx.openingCells.get(code) ?? 0;
  let priorFixedAssets = other('FIXED_ASSETS');
  let priorAr = other('AR');
  let priorInventory = other('INVENTORY');
  let priorAp = other('AP');
  let priorDebt = other('LONG_TERM_DEBT');
  let priorCash = other('CASH');
  let priorRetainedEarnings = other('RETAINED_EARNINGS');
  const otherEquityConst = other('EQUITY') - other('RETAINED_EARNINGS');

  // Financing overlay running state — separate from the Baseline debt facility (P0 simplification,
  // documented in the report: additive overlay, not a joint re-solve of two facilities'
  // circularity). All three are running totals across the WHOLE horizon, carried forward exactly
  // like priorCash/priorDebt/priorRetainedEarnings above, so a draw/injection/dividend in month N
  // keeps affecting every later month's CASH/EQUITY/RETAINED_EARNINGS, not just month N's own row.
  let facilityDebtBalance = 0;
  let cumulativeOtherEquityAdj = 0;
  let cumulativeFacilityCashOverlay = 0;
  let cumulativeFacilityRetainedEarningsAdj = 0;

  const cashInterestRateAnnual = ctx.model.interest_income_on_cash_modeled ? requireAssumption(ctx, 'debt_maturity', 'CASH_INTEREST_RATE_ANNUAL_PCT') : 0;
  const statutoryTaxRate = requireAssumption(ctx, 'tax_nol', 'STATUTORY_TAX_RATE_PCT');

  const periods: PredictionPeriodResult[] = [];

  await withPinnedPostgresTransaction(async (tx) => {
    for (let i = 0; i < params.forecastPeriodIds.length; i++) {
      const periodId = params.forecastPeriodIds[i];
      const period = ctx.periodByCode.get(periodId);
      if (!period || period.fiscal_month === null) throw new Error(`predictionComputeService: period ${periodId} not found or not a MONTH period`);

      const priorYearKey = `${period.fiscal_year - 1}-${period.fiscal_month}`;
      const priorYearRevenue = ctx.revenueHistoryByFiscalYearMonth.get(priorYearKey);
      if (priorYearRevenue === undefined) throw new Error(`predictionComputeService: no PRIOR_YEAR_SAME_PERIOD REVENUE actual for ${priorYearKey}`);

      // --- schedule engine, driver-override-aware (same functions baselineComputeService.ts uses) ---
      const revenueGrowth = resolveDriver('revenue_pvm', 'REVENUE_GROWTH_YOY', periodId);
      const baseRevenue = computeRevenuePvm({ priorYearSameMonthRevenue: priorYearRevenue, annualGrowthRate: revenueGrowth });
      const revenueImpact = impactDeltaFor('REVENUE', i, params.forecastPeriodIds, baseRevenue);
      const revenue = baseRevenue + revenueImpact;

      const cogsRatio = resolveDriver('cogs_opex', 'COGS_PCT_OF_REVENUE', periodId);
      const opexRatio = resolveDriver('cogs_opex', 'OPEX_PCT_OF_REVENUE', periodId);
      const { cogs: baseCogs, opex: baseOpex } = computeCogsOpex({ revenue, cogsRatio, opexRatio });
      const cogsImpact = impactDeltaFor('COGS', i, params.forecastPeriodIds, baseCogs);
      const opexImpact = impactDeltaFor('OPEX', i, params.forecastPeriodIds, baseOpex);
      const cogs = baseCogs + cogsImpact;
      const opex = baseOpex + opexImpact;
      const grossMargin = revenue - cogs;
      const ebitda = grossMargin - opex;

      const capexPct = resolveDriver('capex_depreciation', 'CAPEX_PCT_OF_REVENUE', periodId);
      const usefulLife = resolveDriver('capex_depreciation', 'USEFUL_LIFE_MONTHS', periodId);
      const { capex: baseCapex, depreciation, closingFixedAssets: baseClosingFixedAssets } = computeCapexDepreciation({
        revenue,
        priorFixedAssets,
        capexPctOfRevenue: capexPct,
        usefulLifeMonths: usefulLife,
      });
      const capexImpact = impactDeltaFor('CAPEX', i, params.forecastPeriodIds, baseCapex);
      const capex = baseCapex + capexImpact;
      const closingFixedAssets = baseClosingFixedAssets + capexImpact; // CAPEX flows straight through to the gross block, same relationship baselineScheduleEngine.ts itself uses
      const ebit = ebitda - depreciation;

      const days = daysInPeriod(period);
      const dso = resolveDriver('wc_dso_dio_dpo', 'DSO_DAYS', periodId);
      const dio = resolveDriver('wc_dso_dio_dpo', 'DIO_DAYS', periodId);
      const dpo = resolveDriver('wc_dso_dio_dpo', 'DPO_DAYS', periodId);
      const { ar, inventory, ap } = computeWcDsoDioDpo({ revenue, cogs, daysInPeriod: days, dsoDays: dso, dioDays: dio, dpoDays: dpo });
      const deltaWorkingCapital = ar - priorAr + (inventory - priorInventory) - (ap - priorAp);

      const scheduledAmortization = lookupScheduledAmortization({ scheduledPrincipalByMonth: debtPayload.amortization_schedule }, i);
      const solved = solvePeriod({
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
      if (!solved.converged) throw new PredictionNonConvergenceError(periodId);

      // --- financing overlay (ADR section 4.5/9's own words: "TU żyje to, co Baseline fizycznie
      //     wyklucza") — additive on top of the already-solved Baseline-facility figures, WHOLLY
      //     separate from priorDebt/priorCash above (documented P0 simplification: no joint
      //     circularity re-solve across two facilities — see report). Every transaction below
      //     contributes the SAME signed amount to both `facilityCff` (assets side, via cash) and
      //     either `facilityDebtBalance`/`cumulativeOtherEquityAdj`/dividend (liabilities+equity
      //     side) — by construction the two sides move by an identical amount every period, so the
      //     balance-sheet identity below ties EXACTLY, not just within a tolerance band. ---
      const financingThisPeriod = financingRows.filter((f) => f.period_id === periodId);
      const facilityDebtOpening = facilityDebtBalance;
      let facilityCff = 0;
      let dividendThisPeriod = 0;
      for (const f of financingThisPeriod) {
        const amount = Number(f.payload.amount ?? f.payload.principal ?? 0);
        if (f.financing_kind === 'FACILITY_DRAWDOWN') {
          facilityDebtBalance += amount;
          facilityCff += amount;
        } else if (f.financing_kind === 'DISCRETIONARY_REPAYMENT') {
          facilityDebtBalance = Math.max(0, facilityDebtBalance - amount);
          facilityCff -= amount;
        } else if (f.financing_kind === 'EQUITY_INJECTION') {
          cumulativeOtherEquityAdj += amount;
          facilityCff += amount;
        } else if (f.financing_kind === 'SHARE_BUYBACK') {
          cumulativeOtherEquityAdj -= amount;
          facilityCff -= amount;
        } else if (f.financing_kind === 'DIVIDEND_DECLARATION') {
          dividendThisPeriod += amount;
          facilityCff -= amount;
        }
        // SURPLUS_ALLOCATION_POLICY/COVENANT_DEFINITION/MIN_CASH_POLICY — horizon-wide policies,
        // no period-scoped numeric flow in P0 (ADR section 9.1, same boundary Layer 1 double-
        // counting detection already draws, WP-D07b file-03 comment).
      }

      // Facility interest — simple OPENING-balance interest (not averaged like the Baseline
      // facility's own solvePeriod() treatment), tax-shielded through NET_INCOME. Deliberately
      // non-circular: this overlay's own facilityDebtBalance never depends on this period's own
      // interest, so no iteration is needed for it (documented P0 simplification, distinct from the
      // Baseline facility's genuinely circular averaged-balance treatment inside solvePeriod()).
      const facilityRow = financingRows.find((f) => f.financing_kind === 'FACILITY_DRAWDOWN');
      const facilityRateAnnual = Number(facilityRow?.payload.rate ?? 0);
      const facilityInterestExpense = facilityDebtOpening > 0 ? (facilityRateAnnual / 12) * facilityDebtOpening : 0;
      const facilityNetIncomeAdj = -facilityInterestExpense * (1 - statutoryTaxRate); // tax-shielded, mirrors baselineComputeService.ts's own NI derivation

      const finalInterestExpense = solved.interestExpense + facilityInterestExpense;
      const finalNetIncome = solved.netIncome + facilityNetIncomeAdj;
      const finalDebt = solved.debt + facilityDebtBalance;

      const cashOverlayThisPeriod = facilityCff + facilityNetIncomeAdj;
      cumulativeFacilityCashOverlay += cashOverlayThisPeriod;
      const carriedCash = solved.cash + cumulativeFacilityCashOverlay;

      const { closingRetainedEarnings: baseClosingRE } = computeEquityRe({ priorRetainedEarnings, netIncome: solved.netIncome, dividendsDeclared: 0 });
      cumulativeFacilityRetainedEarningsAdj += facilityNetIncomeAdj - dividendThisPeriod;
      const closingRetainedEarnings = baseClosingRE + cumulativeFacilityRetainedEarningsAdj;

      const equity = otherEquityConst + cumulativeOtherEquityAdj + closingRetainedEarnings;
      const currentAssets = carriedCash + ar + inventory;
      const totalAssets = currentAssets + closingFixedAssets;
      const currentLiabilities = ap;
      const totalLiabilities = currentLiabilities + finalDebt;
      const totalLiabilitiesEquity = totalLiabilities + equity;
      const workingCapital = currentAssets - currentLiabilities;
      const fcf = solved.cfo + solved.cfi;

      const tolerance = Number(ctx.model.circularity_tolerance_currency);
      if (Math.abs(totalAssets - totalLiabilitiesEquity) > tolerance) {
        throw new Error(
          `predictionComputeService: overlay engine bug — BS does not balance for ${periodId}: assets=${totalAssets} liab+equity=${totalLiabilitiesEquity} diff=${Math.abs(totalAssets - totalLiabilitiesEquity)}`
        );
      }

      const values: Partial<Record<CanonicalCode, number>> = {
        REVENUE: revenue, COGS: cogs, GROSS_MARGIN: grossMargin, OPEX: opex, EBITDA: ebitda, DEPRECIATION: depreciation, EBIT: ebit,
        INTEREST_EXPENSE: finalInterestExpense, TAX_EXPENSE: solved.taxExpense, NET_INCOME: finalNetIncome,
        CASH: carriedCash, AR: ar, INVENTORY: inventory, CURRENT_ASSETS: currentAssets, FIXED_ASSETS: closingFixedAssets, TOTAL_ASSETS: totalAssets,
        AP: ap, CURRENT_LIABILITIES: currentLiabilities, LONG_TERM_DEBT: finalDebt, TOTAL_LIABILITIES: totalLiabilities,
        EQUITY: equity, TOTAL_LIABILITIES_EQUITY: totalLiabilitiesEquity, RETAINED_EARNINGS: closingRetainedEarnings, WORKING_CAPITAL: workingCapital,
        CFO: solved.cfo, CFI: solved.cfi, CFF: solved.cff + facilityCff, NET_CHANGE_CASH: solved.netChangeCash + cashOverlayThisPeriod, CAPEX: capex, FCF: fcf,
      };

      const variance: Partial<Record<CanonicalCode, number>> = {};
      for (const code of CANONICAL_CODES) {
        const v = values[code];
        if (v === undefined) continue;
        const b = baselineValueByCellKey.get(`${code}::${periodId}`);
        if (b !== undefined) variance[code] = v - b;
      }

      for (const code of CANONICAL_CODES) {
        const lineId = ctx.lineIdByCode.get(code) ?? lineIdByCode2.get(code);
        if (!lineId) throw new Error(`predictionComputeService: canonical line ${code} not found`);
        const isDividends = code === 'DIVIDENDS_DECLARED';
        const value = isDividends ? (dividendThisPeriod > 0 ? dividendThisPeriod : null) : values[code]!;
        const valueStatus = isDividends ? (dividendThisPeriod > 0 ? 'PRESENT_NONZERO' : 'NA') : value === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO';

        await tx.queryRun(
          `INSERT INTO finance_prediction_outputs (
             id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id, consolidation_scope,
             value_status, value_decimal, native_currency, presentation_currency, unit, multiplier, variance_vs_baseline_decimal, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CONSOLIDATED', ?, ?, ?, ?, 'UNITS', 1, ?, ?)`,
          [
            uuidv4(), params.organizationId, params.businessVersionId, isDividends ? 'BS' : STATEMENT_TYPE_OF[code], lineId, params.entityId, periodId,
            valueStatus, value, 'PLN', 'PLN', variance[code] ?? null, params.requestedByUserId,
          ]
        );
      }

      periods.push({ periodId, values, varianceVsBaseline: variance });

      priorFixedAssets = closingFixedAssets;
      priorAr = ar;
      priorInventory = inventory;
      priorAp = ap;
      priorDebt = solved.debt;
      priorCash = solved.cash; // Baseline-facility cash carry ONLY — the financing overlay's own cumulative effect is tracked separately (cumulativeFacilityCashOverlay) and re-added every period, so it never "resets"
      priorRetainedEarnings = baseClosingRE; // Baseline-side RE carry; the financing overlay's own RE/dividend effect (facilityNetIncomeAdj, dividendThisPeriod) is re-applied every period on top, same pattern as cash
    }
  });

  if (!scenarioArtifactEarly.source_working_revision_id) {
    throw new Error(`predictionComputeService: finance_business_versions.source_working_revision_id is not set for the Prediction Scenario ${params.businessVersionId}`);
  }
  const contentSemanticHash = createHash('sha256').update(JSON.stringify(periods)).digest('hex');
  await computeJobService.completeJobSuccess({
    jobId: runningJob.id,
    organizationId: params.organizationId,
    outputArtifactId: scenarioArtifactEarly.artifact_id,
    outputBusinessVersionId: params.businessVersionId,
    outputWorkingRevisionId: scenarioArtifactEarly.source_working_revision_id,
    contentSemanticHash,
  });
  // W10-D01 fix — see baselineComputeService.ts's identical call for the full rationale.
  await stampWorkingRevisionComputeIdentity({
    organizationId: params.organizationId,
    workingRevisionId: scenarioArtifactEarly.source_working_revision_id,
    contentSemanticHash,
    computeRunId: runningJob.id,
  });
  const finalJob = (await computeJobService.getJob(params.organizationId, job.id)) ?? runningJob;

  return { ok: true, mode: 'COMPUTED', job: finalJob, periodsComputed: periods.length, periods };
}

class PredictionNonConvergenceError extends Error {
  constructor(public readonly periodId: string) {
    super(`prediction overlay circularity solver did not converge for period ${periodId}`);
  }
}
