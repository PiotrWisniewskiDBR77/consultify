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
import { canonicalPayloadHash } from './contentHash.js';
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
  created_at: string;
}

interface InitiativeDefaultsRow {
  id: string;
  default_start_period_id: string | null;
  default_ramp_months: number | null;
  default_duration_months: number | null;
}

export type FinancingKind =
  | 'FACILITY_DRAWDOWN'
  | 'DISCRETIONARY_REPAYMENT'
  | 'EQUITY_INJECTION'
  | 'DIVIDEND_DECLARATION'
  | 'SHARE_BUYBACK'
  | 'SURPLUS_ALLOCATION_POLICY'
  | 'COVENANT_DEFINITION'
  | 'MIN_CASH_POLICY';

interface FinancingRow {
  id: string;
  financing_kind: FinancingKind;
  entity_id: string;
  period_id: string | null;
  payload: { amount?: number; principal?: number; rate?: number; tenor_months?: number };
  created_at: string;
}

/**
 * PKG-A determinism fix (`docs/validation/finance-v3/generated/gate-e/PKG_A_DETERMINISM_report.md`):
 * both `finance_prediction_impact_chain` and `finance_prediction_financing` are read with
 * `SELECT ... WHERE business_version_id = ? AND entity_id = ?` — no `ORDER BY` — so Postgres's
 * returned row order is not guaranteed stable across runs on byte-identical data (same defect class
 * empirically proven in `W3_COMPUTE_DETERMINISM_report.md` for `kpiComputeService.ts`/
 * `valuationFcffService.ts`: plain `UPDATE` churn on the shared table was enough to reorder the
 * physical scan within a handful of runs, no VACUUM or forced index scan needed). Sorted here in
 * memory by (`created_at`, `id`) — deliberately NOT via SQL `ORDER BY` — because that mirrors this
 * codebase's own established fix pattern (`kpiComputeService.hashPayloadFor()`,
 * `valuationFcffService.sumFlow()`'s period-order sort): a small, independently unit-testable pure
 * function, rather than a query-string change that can only be proven against a live database.
 * `id` is the tiebreaker for the (rare, same-millisecond) case of two rows sharing `created_at`.
 */
export function sortByCreatedAtThenId<T extends { id: string; created_at: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * PKG-A determinism fix — canonical within-period processing order for `finance_prediction_financing`
 * events (see the `runOverlayCompute` financing-overlay loop comment for the full rationale).
 * `DISCRETIONARY_REPAYMENT` ranks ahead of `FACILITY_DRAWDOWN` because they interact through a
 * `Math.max(0, facilityDebtBalance - amount)` floor clamp — the only pair in this discriminated
 * union where processing order changes the BUSINESS RESULT, not just float summation order. Every
 * other kind is commutative (pure addition against a running total, no clamp) and is ranked after
 * purely to give the whole array a single fixed total order (ties broken by `sortByCreatedAtThenId`,
 * applied to `financingRows` before this rank sort runs — see `runOverlayCompute`).
 */
export const FINANCING_KIND_PROCESSING_RANK: Record<FinancingKind, number> = {
  DISCRETIONARY_REPAYMENT: 0,
  FACILITY_DRAWDOWN: 1,
  EQUITY_INJECTION: 2,
  SHARE_BUYBACK: 3,
  DIVIDEND_DECLARATION: 4,
  SURPLUS_ALLOCATION_POLICY: 5,
  COVENANT_DEFINITION: 6,
  MIN_CASH_POLICY: 7,
};

/**
 * PKG-A determinism fix — pure, exported for direct unit testing (see
 * `__tests__/predictionOverlayOrderDeterminism.test.ts`). `rows` is expected to already be in
 * `sortByCreatedAtThenId` order (the stable JS sort below then preserves that as the tiebreaker for
 * same-rank events, so the WHOLE array — not just the priority groups — ends up in one fixed total
 * order).
 */
export function orderFinancingEventsForPeriod<T extends { financing_kind: FinancingKind }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => FINANCING_KIND_PROCESSING_RANK[a.financing_kind] - FINANCING_KIND_PROCESSING_RANK[b.financing_kind]);
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
      code:
        | 'READINESS_GATE_FAILED'
        | 'NO_SCENARIO_ROW'
        | 'NO_BASELINE_LINEAGE_EDGE'
        | 'MISSING_DEBT_MATURITY_SCHEDULE'
        | 'CIRCULARITY_NOT_CONVERGED'
        | 'BASELINE_COMPUTE_FAILED'
        // W9-B-2 fix: `completeJobSuccess()` reported `NOT_RUNNING` (job
        // cancelled/lease-expired/already terminal before we could commit its
        // output) — never report success for a run whose compute_job_outputs
        // commit did not happen. Raised from both runStandardBase() and
        // runOverlayCompute(). See W2_FALSE_SUCCESS_W9B2_report.md.
        | 'JOB_NOT_RUNNING';
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

  const contentSemanticHash = canonicalPayloadHash(baselineContentHashSource);

  const baselineModelArtifact = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ artifact_id: string }>(`SELECT artifact_id FROM finance_business_versions WHERE business_version_id = ?`, [baselineModelVersionId])
  );
  if (!baselineModelArtifact) throw new Error(`predictionComputeService: no finance_business_versions row for Baseline Model ${baselineModelVersionId}`);

  const { job, wasExisting } = await computeJobService.enqueue({
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
  // P1 fix (idempotent compute retry): see valuationComputeService.ts's
  // identical call for the full rationale.
  const claimResult = await computeJobService.claimForCompute({
    organizationId: params.organizationId,
    job,
    wasExisting,
    workerId: `predictionComputeService:${uuidv4()}`,
  });
  if (claimResult.outcome === 'hard_error') {
    return {
      ok: false,
      code: 'JOB_NOT_RUNNING',
      message: `runStandardBase: ${claimResult.message}`,
    };
  }
  if (claimResult.outcome === 'already_committed') {
    // Idempotent replay: an earlier byte-identical call already computed and committed this
    // exact result (same contentSemanticHash, derived above from either a fresh Baseline compute
    // or the already-computed one — deterministic either way). Never mint a second
    // compute_jobs/compute_job_outputs row for the same idempotency key.
    const passthroughRows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ n: string }>(`SELECT count(*)::text AS n FROM finance_prediction_outputs_effective WHERE business_version_id = ?`, [
        params.businessVersionId,
      ])
    );
    return {
      ok: true,
      mode: 'STANDARD_BASE',
      job: claimResult.job,
      baselineJob,
      passthroughRowCount: Number(passthroughRows[0]?.n ?? '0'),
    };
  }
  const runningJob = claimResult.job;

  const scenarioWorkingRevision = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ artifact_id: string; source_working_revision_id: string | null }>(`SELECT artifact_id,source_working_revision_id FROM finance_business_versions WHERE business_version_id = ?`, [
      params.businessVersionId,
    ])
  );
  if (!scenarioWorkingRevision?.source_working_revision_id) {
    throw new Error(`predictionComputeService: finance_business_versions.source_working_revision_id is not set for ${params.businessVersionId}`);
  }

  const completed = await computeJobService.completeJobSuccess({
    jobId: runningJob.id,
    organizationId: params.organizationId,
    inputArtifactId: runningJob.input_artifact_id,
    outputArtifactId: scenarioWorkingRevision.artifact_id,
    outputBusinessVersionId: params.businessVersionId, // the SCENARIO's own bv, for job-output audit trail — no finance_prediction_outputs row exists or ever will for this scenario_mode
    outputWorkingRevisionId: scenarioWorkingRevision.source_working_revision_id,
    contentSemanticHash, // identical derivation from the SAME baseline job's own monthlyResults — proves bit-for-bit equivalence at the job-output level, not just the DB-row level
  });
  // W9-B-2 fix: NOT_RUNNING means the job was cancelled/lease-expired/already
  // terminal by the time we tried to commit — never report success for a run
  // whose compute_job_outputs commit did not happen. OUTPUT_ALREADY_COMMITTED
  // is treated as an idempotent-safe outcome — see report §"NOT_RUNNING vs
  // OUTPUT_ALREADY_COMMITTED".
  if (!completed.ok) {
    return {
      ok: false,
      code: 'JOB_NOT_RUNNING',
      message: `runStandardBase: completeJobSuccess reported NOT_RUNNING for job ${runningJob.id}: ${completed.message}`,
    };
  }
  const finalJob = completed.ok ? completed.job : ((await computeJobService.getJob(params.organizationId, job.id)) ?? runningJob);

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

  const [driverOverrideRows, impactChainRowsRaw, initiativeRows, financingRowsRaw, lineIdRows] = await Promise.all([
    withPinnedPostgresTransaction((tx) =>
      tx.queryAll<DriverOverrideRow>(
        `SELECT schedule_type, driver_code, entity_id, period_id, value_decimal FROM finance_prediction_driver_overrides WHERE business_version_id = ? AND entity_id = ?`,
        [params.businessVersionId, params.entityId]
      )
    ),
    withPinnedPostgresTransaction((tx) =>
      // PKG-A determinism fix (`docs/validation/finance-v3/generated/gate-e/PKG_A_DETERMINISM_report.md`):
      // no `ORDER BY` — see `sortByCreatedAtThenId`'s doc comment above for why. This array feeds
      // `impactDeltaFor()`'s `total +=` accumulation below (float addition is not associative), so it
      // is re-sorted right after `Promise.all` resolves, before any consumer sees it.
      tx.queryAll<ImpactChainRow>(
        `SELECT id, initiative_id, statement_line_id, entity_id, amount_kind, amount_decimal, sign, start_period_id, ramp_months, duration_months, decay_pct_per_period, created_at::text AS created_at
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
      // PKG-A determinism fix: no `ORDER BY` — re-sorted right after `Promise.all` resolves (see
      // `sortByCreatedAtThenId`). Establishes a canonical base order for `financingRows`, making the
      // `financingRows.find(kind === 'FACILITY_DRAWDOWN')` rate lookup below deterministic (picks the
      // canonically EARLIEST facility row instead of "whatever Postgres returns first"). The
      // period-scoped drawdown/repayment PROCESSING order (which needs a business policy, not just
      // chronology) is applied separately below via `orderFinancingEventsForPeriod`.
      tx.queryAll<FinancingRow>(
        `SELECT id, financing_kind, entity_id, period_id, payload, created_at::text AS created_at
           FROM finance_prediction_financing WHERE business_version_id = ? AND entity_id = ?`,
        [params.businessVersionId, params.entityId]
      )
    ),
    withPinnedPostgresTransaction((tx) => tx.queryAll<{ id: string; line_code: string }>(`SELECT id, line_code FROM financial_statement_lines`)),
  ]);
  const impactChainRows = sortByCreatedAtThenId(impactChainRowsRaw);
  const financingRows = sortByCreatedAtThenId(financingRowsRaw);
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
  const { job, wasExisting } = await computeJobService.enqueue({
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
  // P1 fix (idempotent compute retry): see valuationComputeService.ts's
  // identical call for the full rationale.
  const claimResult = await computeJobService.claimForCompute({
    organizationId: params.organizationId,
    job,
    wasExisting,
    workerId: `predictionComputeService:${uuidv4()}`,
  });
  if (claimResult.outcome === 'hard_error') {
    return {
      ok: false,
      code: 'JOB_NOT_RUNNING',
      message: `runOverlayCompute: ${claimResult.message}`,
    };
  }
  if (claimResult.outcome === 'already_committed') {
    // Idempotent replay: an earlier byte-identical call already computed and committed this
    // overlay result. Never mint a second compute_jobs/compute_job_outputs row for the same
    // idempotency key, and never re-run the (expensive) circularity solver loop below. Per-period
    // figures for a duplicate call are read back from `finance_prediction_outputs`, exactly as
    // `runStandardBase()` above documents for its own idempotent-replay branch.
    const priorPeriods = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ n: string }>(`SELECT count(DISTINCT period_id)::text AS n FROM finance_prediction_outputs WHERE business_version_id = ?`, [
        params.businessVersionId,
      ])
    );
    return {
      ok: true,
      mode: 'COMPUTED',
      job: claimResult.job,
      periodsComputed: Number(priorPeriods?.n ?? '0'),
      periods: [],
    };
  }
  const runningJob = claimResult.job;

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
      // PKG-A determinism fix (`docs/validation/finance-v3/generated/gate-e/PKG_A_DETERMINISM_report.md`):
      // apply this period's financing events in a fixed CANONICAL order, not raw query order.
      // Unlike `impactDeltaFor`'s pure summation, this is not merely a bit-level rounding concern —
      // `DISCRETIONARY_REPAYMENT` and `FACILITY_DRAWDOWN` share `facilityDebtBalance` through
      // `Math.max(0, ...)` (line below), so swapping their order changes the BUSINESS RESULT (a
      // repayment applied before vs. after a same-period drawdown can floor-clamp to a different
      // ending balance — e.g. balance=0, drawdown=100, repayment=50 gives 50 if drawdown-first, 100
      // if repayment-first-then-drawdown, since a repayment can never floor below 0). Policy decided
      // per DEC-FIN-012 (routine matters, highest market-standard practice, documented if diverging):
      // industry-standard debt-schedule convention applies contractual/scheduled obligations before
      // discretionary shortfall-covering draws. This table has no separate "mandatory" repayment
      // kind — `DISCRETIONARY_REPAYMENT` is the only debt-reducing event type — so it is ranked
      // ahead of `FACILITY_DRAWDOWN`, mirroring "repayments before draws". Every other kind is
      // commutative (pure addition, no floor) and ranked after for a stable TOTAL order only, so the
      // per-period sum is bit-reproducible; ties broken by `financingRows`'s own `sortByCreatedAtThenId`
      // order (a stable sort preserves that ordering within each rank — never re-derived here).
      const financingThisPeriod = orderFinancingEventsForPeriod(financingRows.filter((f) => f.period_id === periodId));
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
  const contentSemanticHash = canonicalPayloadHash(periods);
  const completed = await computeJobService.completeJobSuccess({
    jobId: runningJob.id,
    organizationId: params.organizationId,
    inputArtifactId: runningJob.input_artifact_id,
    outputArtifactId: scenarioArtifactEarly.artifact_id,
    outputBusinessVersionId: params.businessVersionId,
    outputWorkingRevisionId: scenarioArtifactEarly.source_working_revision_id,
    contentSemanticHash,
  });
  // W9-B-2 fix: NOT_RUNNING means the job was cancelled/lease-expired/already
  // terminal by the time we tried to commit — never report success for a run
  // whose compute_job_outputs commit did not happen. OUTPUT_ALREADY_COMMITTED
  // is treated as an idempotent-safe outcome — see report §"NOT_RUNNING vs
  // OUTPUT_ALREADY_COMMITTED".
  if (!completed.ok) {
    return {
      ok: false,
      code: 'JOB_NOT_RUNNING',
      message: `runOverlayCompute: completeJobSuccess reported NOT_RUNNING for job ${runningJob.id}: ${completed.message}`,
    };
  }
  const finalJob = completed.ok ? completed.job : ((await computeJobService.getJob(params.organizationId, job.id)) ?? runningJob);

  return { ok: true, mode: 'COMPUTED', job: finalJob, periodsComputed: periods.length, periods };
}

class PredictionNonConvergenceError extends Error {
  constructor(public readonly periodId: string) {
    super(`prediction overlay circularity solver did not converge for period ${periodId}`);
  }
}
