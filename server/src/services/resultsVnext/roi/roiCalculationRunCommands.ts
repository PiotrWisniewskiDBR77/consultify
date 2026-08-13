/**
 * ROI-E002 — the compute command (`createRoiCalculationRun`).
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §4.2, Decision D3
 * (synchronous, no job queue).
 *
 * `applyMutation` reads the calculation policy + active assumptions/cost
 * lines/benefit lines (and, if a scenario is given, its overrides) inside
 * ONE transaction for a consistent snapshot, builds the pure engine's input,
 * calls `runRoiCalculationEngine` (zero I/O, §4.3), and persists the output
 * as one immutable `rvn_roi_calculation_runs` row — always inserted, whether
 * the engine's own `status` is `'completed'` or `'failed'` (an honest record
 * of the attempt, never silently discarded).
 *
 * This file also exports `computeCurrentEconomicModelHash` — the shared
 * "what would the BASE-scenario input_hash be right now" builder that
 * `roiEconomicModelReadiness.ts`'s staleness check calls, so a Ready-for-
 * Review guard and a real calculation run can never compute this hash two
 * different ways.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { toNullableNumber } from '../kpi/kpiTypes.js';
import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCreate, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';
import {
  assertCommandCapability,
  type CommandAccessContext,
} from '../platform/commandCapabilityGuard.js';

import { ROI_CALCULATION_ENGINE_VERSION, runRoiCalculationEngine } from './engine/roiCalculationEngine.js';
import type {
  RoiCalculationEngineInput,
  RoiEngineAssumption,
  RoiEngineBenefitLine,
  RoiEngineCostLine,
  RoiEngineScenarioOverride,
} from './engine/roiCalculationEngine.types.js';
import { ROI_EVENT_SOURCE } from './roiCaseCommands.js';
import {
  type RoiAssumptionRow,
  type RoiBenefitLineRow,
  type RoiCalculationPolicyRow,
  type RoiCalculationRun,
  type RoiCalculationRunRow,
  type RoiCostLineRow,
  type RoiScenarioOverrideRow,
  type RoiScenarioRow,
  toRoiCalculationRun,
} from './roiEconomicModelTypes.js';
import type { RoiCaseRow } from './roiTypes.js';

// ==========================================
// ERRORS
// ==========================================

export class RoiCalculationRunValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_CALCULATION_RUN_REQUEST', details?: Record<string, unknown>) {
    super(message);
    this.name = 'RoiCalculationRunValidationError';
    this.code = code;
    this.details = details;
  }
}

// ==========================================
// DB ROW -> ENGINE INPUT MAPPERS
//
// Every object below is built as a FIXED-KEY-ORDER literal, never a spread
// of a raw DB row map — the engine's own §4.3 "Determinism" rule
// (computeStateHash must be byte-for-byte reproducible given the same
// logical input) depends on this file constructing the same key order every
// single time, not on however Postgres/pg happens to order a row's own
// properties.
// ==========================================

/**
 * -- DEVIATION FROM DESIGN (real Postgres behavior, caught by
 * `roiCalculationRun.realdb.test.ts`'s FIRST real run, not by `tsc` or by
 * reading the code): `node-postgres` parses `DATE` columns
 * (`rvn_roi_cases.analysis_start`/`analysis_end`,
 * `rvn_roi_cost_lines`/`rvn_roi_benefit_lines`'s `one_time_period_date`/
 * `recurrence_start_date`/`recurrence_end_date`) into JS `Date` OBJECTS by
 * default, not the `YYYY-MM-DD` strings every `*Row` interface in this
 * package declares (`RoiCaseRow.analysis_start: string | null`, etc.) —
 * this repo sets no custom `pg.types.setTypeParser` for oid 1082 anywhere
 * in `PostgresDatabase.ts`. `roiCalculationEngine.ts`'s `parseIsoDate` (a
 * strict `/^\d{4}-\d{2}-\d{2}/` regex, by design — DATE arithmetic must
 * never depend on the host process's timezone) then threw on the object's
 * `toString()` output ("Thu Jan 01 2026 00:00:00 GMT+0100 ..."). Every
 * prior ROI-E001 command/test only ever passed these DATE values straight
 * through without doing arithmetic on them, so this never surfaced before
 * ROI-E002's engine became the first real caller. Fix: convert defensively
 * here, at the DB-row boundary, using the `Date` object's LOCAL getters
 * (`getFullYear`/`getMonth`/`getDate`) — NOT `toISOString()`, which
 * converts to UTC and can shift the calendar date by one day depending on
 * the host's offset from UTC, corrupting the exact bug this conversion
 * exists to fix. A plain string input (if a future pg driver config ever
 * changes to return strings) is accepted unchanged via a `substring(0,10)`
 * fast path. NOT a migration/schema change — the DDL's `DATE` type is
 * correct; this is purely a driver-level deserialization mismatch fixed at
 * the one boundary (`roiCalculationRunCommands.ts`) that actually does date
 * arithmetic on these columns.
 */
// ROI-E004 §4 (design doc), Decision D5: exported (was module-private) so
// roiForecastVersionCommands.ts can build a RoiCalculationEngineInput from
// live case data without re-deriving the DATE-deserialization fix or
// row-mapping logic — zero behavior change, purely an export-visibility
// widening.
export function toDateOnlyString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = value.getMonth() + 1;
    const day = value.getDate();
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (typeof value === 'string') return value.slice(0, 10);
  return null;
}

// ROI-E004 §4, Decision D5: exported — see toDateOnlyString's comment above.
export function assumptionRowToEngine(row: RoiAssumptionRow): RoiEngineAssumption {
  return {
    id: row.assumption_id,
    category: row.category,
    label: row.label,
    baseValue: toNullableNumber(row.base_value),
    downsideValue: toNullableNumber(row.downside_value),
    upsideValue: toNullableNumber(row.upside_value),
  };
}

// ROI-E004 §4, Decision D5: exported — see toDateOnlyString's comment above.
export function costLineRowToEngine(row: RoiCostLineRow): RoiEngineCostLine {
  return {
    id: row.cost_line_id,
    amount: Number(row.amount),
    currency: row.currency,
    timingType: row.timing_type,
    oneTimePeriodDate: toDateOnlyString(row.one_time_period_date),
    recurrenceStartDate: toDateOnlyString(row.recurrence_start_date),
    recurrenceEndDate: toDateOnlyString(row.recurrence_end_date),
    recurrenceCadence: row.recurrence_cadence,
  };
}

// ROI-E004 §4, Decision D5: exported — see toDateOnlyString's comment above.
export function benefitLineRowToEngine(row: RoiBenefitLineRow): RoiEngineBenefitLine {
  return {
    id: row.benefit_line_id,
    isFinancial: row.is_financial,
    amount: toNullableNumber(row.amount),
    currency: row.currency,
    timingType: row.timing_type,
    oneTimePeriodDate: toDateOnlyString(row.one_time_period_date),
    recurrenceStartDate: toDateOnlyString(row.recurrence_start_date),
    recurrenceEndDate: toDateOnlyString(row.recurrence_end_date),
    recurrenceCadence: row.recurrence_cadence,
    rampPeriods: row.ramp_periods,
    doubleCountingGroup: row.double_counting_group,
    doubleCountingResolutionNote: row.double_counting_resolution_note,
  };
}

function scenarioOverrideRowToEngine(row: RoiScenarioOverrideRow): RoiEngineScenarioOverride {
  return {
    targetType: row.target_type,
    targetId: row.target_id,
    overrideValue: toNullableNumber(row.override_value),
    overrideAmount: toNullableNumber(row.override_amount),
  };
}

/** Fixed-key-order object hashed for `policy_version_stamp` — the policy
 * row's BUSINESS fields only (never `row_version`/`created_at`/`updated_at`,
 * which would make the stamp change on every no-op bookkeeping write). */
// ROI-E004 §4, Decision D5: exported — see toDateOnlyString's comment above.
export function policyStampObject(row: RoiCalculationPolicyRow): Record<string, unknown> {
  return {
    discountRatePct: toNullableNumber(row.discount_rate_pct),
    taxTreatment: row.tax_treatment,
    inflationRatePct: toNullableNumber(row.inflation_rate_pct),
    roundingPolicy: row.rounding_policy,
    requiredMetrics: row.required_metrics,
    notes: row.notes,
    confidence: row.confidence,
    ownerUserId: row.owner_user_id,
  };
}

// ==========================================
// SHARED ENGINE-INPUT BUILDER
// ==========================================

interface BuiltEngineInput {
  engineInput: RoiCalculationEngineInput;
  policyRow: RoiCalculationPolicyRow;
  scenarioRow: RoiScenarioRow | null;
}

/** Reads the case + its calculation policy + active assumptions/cost lines/
 * benefit lines (and, if `scenarioId` is given, that scenario's overrides)
 * on the SAME pinned client, and builds the pure engine's input. Every list
 * query is `ORDER BY <table>_id` for deterministic array ordering — the
 * same logical row set must always serialize into the same JSON for
 * `computeStateHash` to be meaningful across two calls. */
async function buildEngineInputFromDb(
  client: PoolClient,
  caseRow: RoiCaseRow,
  scenarioId: string | null
): Promise<BuiltEngineInput> {
  const organizationId = caseRow.organization_id;
  const caseId = caseRow.case_id;

  const policyResult = await client.query<RoiCalculationPolicyRow>(
    `SELECT * FROM rvn_roi_calculation_policy WHERE case_id = $1 AND organization_id = $2`,
    [caseId, organizationId]
  );
  const policyRow = policyResult.rows[0];
  if (!policyRow) {
    throw new Error(`[buildEngineInputFromDb] case ${caseId} has no calculation-policy shell row`);
  }

  const assumptionsResult = await client.query<RoiAssumptionRow>(
    `SELECT * FROM rvn_roi_assumptions
      WHERE case_id = $1 AND organization_id = $2 AND deleted_at IS NULL
      ORDER BY assumption_id`,
    [caseId, organizationId]
  );
  const costLinesResult = await client.query<RoiCostLineRow>(
    `SELECT * FROM rvn_roi_cost_lines
      WHERE case_id = $1 AND organization_id = $2 AND deleted_at IS NULL
      ORDER BY cost_line_id`,
    [caseId, organizationId]
  );
  const benefitLinesResult = await client.query<RoiBenefitLineRow>(
    `SELECT * FROM rvn_roi_benefit_lines
      WHERE case_id = $1 AND organization_id = $2 AND deleted_at IS NULL
      ORDER BY benefit_line_id`,
    [caseId, organizationId]
  );

  let scenarioRow: RoiScenarioRow | null = null;
  let scenarioOverrideRows: RoiScenarioOverrideRow[] = [];
  if (scenarioId) {
    const scenarioResult = await client.query<RoiScenarioRow>(
      `SELECT * FROM rvn_roi_scenarios
        WHERE scenario_id = $1 AND case_id = $2 AND organization_id = $3 AND deleted_at IS NULL`,
      [scenarioId, caseId, organizationId]
    );
    scenarioRow = scenarioResult.rows[0] ?? null;
    if (!scenarioRow) {
      throw new RoiCalculationRunValidationError(
        `Scenario ${scenarioId} not found for case ${caseId}`,
        'SCENARIO_NOT_FOUND',
        { scenarioId, caseId }
      );
    }
    if (scenarioRow.scenario_type === 'custom') {
      const overridesResult = await client.query<RoiScenarioOverrideRow>(
        `SELECT * FROM rvn_roi_scenario_overrides
          WHERE scenario_id = $1 AND organization_id = $2
          ORDER BY override_id`,
        [scenarioId, organizationId]
      );
      scenarioOverrideRows = overridesResult.rows;
    }
  }

  // -- DECISION (not stated by the frozen design doc, which assumes
  // analysisStart/analysisEnd already exist by the time a run is created):
  // rvn_roi_cases.analysis_start/analysis_end are NULLABLE (ROI-E001 §3 —
  // honest-missing, no default). A calculation run has no defensible
  // fallback window to silently fabricate (an arbitrary epoch/today-based
  // range would fail-open into a wrong number, exactly the "computes a
  // number and also warns" anti-pattern §4.3's mixed-currency hard-fail
  // rule explicitly rejects for a different validation case) — fail closed
  // with a typed error instead, mirroring RoiCaseNoActiveVisibilityPolicyError's
  // fail-closed shape.
  const analysisStart = toDateOnlyString(caseRow.analysis_start);
  const analysisEnd = toDateOnlyString(caseRow.analysis_end);
  if (!analysisStart || !analysisEnd) {
    throw new RoiCalculationRunValidationError(
      `ROI case ${caseId} has no analysisStart/analysisEnd set — cannot run a calculation without an analysis window`,
      'ANALYSIS_WINDOW_MISSING',
      { caseId, analysisStart, analysisEnd }
    );
  }

  const engineInput: RoiCalculationEngineInput = {
    currency: caseRow.currency,
    granularity: caseRow.granularity,
    analysisStart,
    analysisEnd,
    discountRatePct: toNullableNumber(policyRow.discount_rate_pct),
    roundingPolicy: policyRow.rounding_policy,
    requiredMetrics: policyRow.required_metrics,
    assumptions: assumptionsResult.rows.map(assumptionRowToEngine),
    costLines: costLinesResult.rows.map(costLineRowToEngine),
    benefitLines: benefitLinesResult.rows.map(benefitLineRowToEngine),
    scenarioType: scenarioRow ? scenarioRow.scenario_type : null,
    scenarioOverrides: scenarioOverrideRows.map(scenarioOverrideRowToEngine),
  };

  return { engineInput, policyRow, scenarioRow };
}

/** Design §5: the readiness guard's staleness check compares the latest
 * completed run's `input_hash` against THIS — always the BASE-scenario
 * (`scenarioId = null`) hash. Ready-for-Review reflects base-case
 * economics, not a downside/upside/custom scenario snapshot — a latest run
 * computed against a non-base scenario will therefore never match this
 * hash, which is intentional (Ready-for-Review requires a fresh BASE run,
 * not merely "some run, any scenario"), not an oversight. */
export async function computeCurrentEconomicModelHash(
  client: PoolClient,
  caseId: string,
  organizationId: string
): Promise<string> {
  const caseResult = await client.query<RoiCaseRow>(
    `SELECT * FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2`,
    [caseId, organizationId]
  );
  const caseRow = caseResult.rows[0];
  if (!caseRow) {
    throw new Error(`[computeCurrentEconomicModelHash] case ${caseId} not found`);
  }
  const { engineInput } = await buildEngineInputFromDb(client, caseRow, null);
  return computeStateHash(engineInput as unknown as Record<string, unknown>);
}

// ==========================================
// createRoiCalculationRun
// ==========================================

export interface CreateRoiCalculationRunInput {
  organizationId: string;
  caseId: string;
  scenarioId?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md)
export const ROI_CALCULATION_RUN_CAPABILITIES = {
  create: 'results.roi.calculation_run.create',
} as const;

const RUNNABLE_STATUSES: ReadonlySet<string> = new Set(['modeling', 'ready_for_review']);

/**
 * Design §4.2: `executeAtomicCreate` (Decision D3 — no job queue, runs
 * synchronously in-request). Locks the case row (`FOR UPDATE`) to serialize
 * concurrent run requests and to read a consistent `currency`/`granularity`/
 * `analysis_start`/`analysis_end`, but does NOT itself mutate the case row
 * or its `status` — a calculation run is an append-only side artifact of
 * the case, not a lifecycle transition.
 */
export async function createRoiCalculationRun(
  input: CreateRoiCalculationRunInput
): Promise<AtomicCommandOutcome<RoiCalculationRun>> {
  const {
    organizationId,
    caseId,
    scenarioId = null,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  return executeAtomicCreate<RoiCalculationRun>({
    organizationId,
    applyMutation: async (client) => {
      const caseResult = await client.query<RoiCaseRow>(
        `SELECT * FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
        [caseId, organizationId]
      );
      const caseRow = caseResult.rows[0];
      if (!caseRow) {
        throw new RoiCalculationRunValidationError(`ROI case ${caseId} not found`, 'CASE_NOT_FOUND', { caseId });
      }

      assertCommandCapability({
        access,
        actorUserId,
        capability: ROI_CALCULATION_RUN_CAPABILITIES.create,
        responsibleUserIds: [caseRow.owner_user_id],
      });

      if (!RUNNABLE_STATUSES.has(caseRow.status)) {
        throw new RoiCalculationRunValidationError(
          `ROI case ${caseId} is "${caseRow.status}" — a calculation run may only be created while "modeling" or "ready_for_review"`,
          'CASE_NOT_RUNNABLE',
          { caseId, status: caseRow.status }
        );
      }

      const { engineInput, policyRow, scenarioRow } = await buildEngineInputFromDb(client, caseRow, scenarioId);
      const output = runRoiCalculationEngine(engineInput);

      const inputHash = computeStateHash(engineInput as unknown as Record<string, unknown>);
      const policyVersionStamp = computeStateHash(policyStampObject(policyRow));

      const insertResult = await client.query<RoiCalculationRunRow>(
        `INSERT INTO rvn_roi_calculation_runs (
           case_id, organization_id, engine_version, policy_version_stamp, scenario_id,
           status, input_snapshot, input_hash,
           total_costs, total_financial_benefits, simple_roi, npv, irr_pct, irr_status,
           payback_periods, discounted_payback_periods, benefit_cost_ratio,
           period_series, has_unresolved_double_counting, has_mixed_currency_failure,
           validation_findings, warnings, initiated_by
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8,
           $9, $10, $11, $12, $13, $14,
           $15, $16, $17,
           $18, $19, $20,
           $21, $22, $23
         )
         RETURNING *`,
        [
          caseId,
          organizationId,
          ROI_CALCULATION_ENGINE_VERSION,
          policyVersionStamp,
          scenarioRow ? scenarioRow.scenario_id : null,
          output.status,
          JSON.stringify(engineInput),
          inputHash,
          output.totalCosts,
          output.totalFinancialBenefits,
          output.simpleRoi,
          output.npv,
          output.irrPct,
          output.irrStatus,
          output.paybackPeriods,
          output.discountedPaybackPeriods,
          output.benefitCostRatio,
          JSON.stringify(output.periodSeries),
          output.hasUnresolvedDoubleCounting,
          output.hasMixedCurrencyFailure,
          JSON.stringify(output.validationFindings),
          JSON.stringify(output.warnings),
          actorUserId,
        ]
      );
      const runRow = insertResult.rows[0];
      if (!runRow) {
        throw new Error('[createRoiCalculationRun] insert into rvn_roi_calculation_runs returned no row');
      }
      return toRoiCalculationRun(runRow);
    },
    buildEvent: ({ result }) => {
      const afterState: Record<string, unknown> = { run: result };
      const eventType = result.status === 'completed' ? 'roi.calculation_run_completed' : 'roi.calculation_run_failed';
      return {
        schemaVersion: 1,
        eventType,
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { caseId, runId: result.runId, status: result.status },
      } satisfies AtomicEventInput;
    },
  });
}
