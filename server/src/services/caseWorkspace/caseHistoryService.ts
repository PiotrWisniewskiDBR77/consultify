/**
 * Case Workspace — Case History & Value Measurement service (CW-P07, EPIC
 * E11 "History, closure, value and Monitoring").
 *
 * Backs the two tables added in
 * server/migrations/20260809_case_workspace_history_value.sql:
 * `case_workspace_history_events` (a generic, append-only Case history
 * event log — one row per business-significant event, independent of and
 * in addition to case_core's own `governance_tier_history` JSON column,
 * which this packet does not touch) and `case_workspace_value_measurements`
 * (an append-only value/outcome measurement log implementing CW-02-032's
 * literal field list).
 *
 * Per the packet's collision-avoidance mandate (docs/product/case-workspace/
 * acceptance/CODEBASE_CONVERGENCE_MAP.csv, area=migrations-flags-outbox),
 * this service only ever SELECTs `case_core` (CW-P01) — it never
 * INSERT/UPDATE/DELETEs it, and never references `case_plan_versions`,
 * `case_workspace_capabilities`, `case_workspace_run_bindings`,
 * `case_workspace_action_proposals`, `case_workspace_waits`, Finance or
 * Results.
 *
 * Scope for THIS packet: (1) the generic history event log and (2) the
 * value-measurement log, plus the one wiring point between them
 * (recordValueMeasurement() always appends a matching history event in the
 * same transaction). It does NOT retrofit caseCoreService.ts,
 * casePlanVersionService.ts, runBindingService.ts,
 * proposalApprovalService.ts or waitSubscriptionService.ts to emit history
 * events themselves — those services' mutations remain invisible to the
 * unified history stream until a future packet adds those call sites (see
 * open_questions #1). It does NOT build the Monitoring-Case-split logic
 * (CW-00-017, OD-06 — linking a long-measurement Case to a successor
 * MONITORING Case); that needs a second Case-to-Case relationship concept
 * this packet does not build (open_questions #4).
 *
 * req_id coverage (docs/product/case-workspace/acceptance/
 * FUNCTIONAL_REQUIREMENT_COVERAGE.csv, filter epics contains "E11" AND
 * row_id starts with "CW-"):
 *
 *   appendCaseHistoryEvent          -> CW-00-020-INV13, CW-01-026-INV9, CW-DOD-B2
 *   getCaseHistoryEvent             -> CW-00-020-INV13
 *   listCaseHistoryEventsForCase    -> CW-00-020-INV13, CW-03-017, CW-DOD-B2
 *   classifyHistoryEventProjections -> CW-00-016, CW-DOD-B2
 *   recordValueMeasurement          -> CW-02-032, CW-00-020-INV13, CW-01-016, CW-01-026-INV12
 *   getValueMeasurement             -> CW-02-032
 *   listValueMeasurementsForCase    -> CW-02-032, CW-01-004
 *   listValueMeasurementsForMetric  -> CW-02-032, CW-01-026-INV9
 *   computeMetricValueOutcomeState  -> CW-01-016, CW-01-026-INV12, CW-00-020-INV13
 *
 * Cross-cutting invariants held by this service (see the migration file's
 * header for the exact canon citations):
 *   - case_workspace_history_events is structurally INSERT-only: no method
 *     in this file issues UPDATE or DELETE against it, enforcing
 *     CW-00-020-INV13 ("history is append-only and value is not inferred
 *     from completed steps") by omission, not merely by convention;
 *   - case_workspace_value_measurements is likewise structurally
 *     INSERT-only: recordValueMeasurement() always INSERTs a new row, never
 *     an UPDATE — "sustained" (CW-01-016, CW-01-026-INV12) is evidenced by a
 *     later row still reading CONFIRMED, never by editing an earlier row;
 *   - recordValueMeasurement() INSERTs the measurement row and calls the
 *     same-file internal history-append helper inside ONE
 *     withPgTransaction() — a measurement row can never commit without a
 *     matching VALUE_MEASUREMENT_RECORDED history-log entry landing
 *     atomically alongside it;
 *   - measurement_status is a literal 5-value CHECK enum (UNMEASURED,
 *     PARTIAL, CONFIRMED, NOT_ACHIEVED, EVIDENCE_MISSING — verbatim from
 *     02_INFORMATION_ARCHITECTURE_AND_UX.md:287), required on every row and
 *     never inferred from case_core's four independent closure-axis columns
 *     (delivery_status/decision_status/implementation_status/outcome_status)
 *     or from case_status;
 *   - computeMetricValueOutcomeState() is pure and reads only the measurement
 *     rows it is handed — it never reads case_core's closure-axis columns,
 *     keeping "Run complete" / "benefit achieved" / "sustained" as
 *     structurally distinct reads (CW-01-026-INV12);
 *   - event_type on case_workspace_history_events is deliberately an open,
 *     non-CHECK-enum TEXT column, validated non-blank only — the documented
 *     catalog below (HISTORY_EVENT_TYPES) is a TS constant, not a DB CHECK
 *     list, so a future emitter never needs a migration to log a new kind of
 *     event;
 *   - case_id on case_workspace_history_events carries no FK and no
 *     case_core existence check, by explicit design (see the migration's
 *     header) — this service never SELECTs case_core inside
 *     appendCaseHistoryEvent()/getCaseHistoryEvent()/
 *     listCaseHistoryEventsForCase();
 *   - source_table/source_id on case_workspace_history_events carry no FK,
 *     so a deleted or lost source row never deletes or orphans the history
 *     event itself (CW-03-017);
 *   - this service only ever SELECTs case_core — it never INSERT/UPDATE/
 *     DELETEs it, and never references case_plan_versions,
 *     case_workspace_capabilities, case_workspace_run_bindings,
 *     case_workspace_action_proposals, case_workspace_waits, Finance or
 *     Results.
 *
 * OPEN QUESTIONS (flagged in the approved design, carried forward here — not
 * resolved by this packet, product/API-owner confirmation needed):
 *   1. appendCaseHistoryEvent() is wired with exactly one caller in this
 *      packet (recordValueMeasurement(), internally). caseCoreService.ts,
 *      casePlanVersionService.ts, runBindingService.ts,
 *      proposalApprovalService.ts and waitSubscriptionService.ts are NOT
 *      retrofitted to call it — those files are untouched by this packet.
 *      Confirm whether that retrofit is a named future packet or should be
 *      folded into this one before merge.
 *   2. event_type is deliberately an open, non-CHECK-enum TEXT column — a
 *      deviation from this directory's usual CHECK-constrained-enum
 *      convention — chosen so future emitters never need a migration to add
 *      a new event kind. Confirm this tradeoff versus a curated CHECK list
 *      extended per packet.
 *   3. confidence is modeled as a qualitative 3-value enum (LOW/MEDIUM/
 *      HIGH). CW-02-032's source text says only "confidence" with no stated
 *      scale — confirm whether a numeric 0-100 percentage is actually
 *      wanted instead.
 *   4. The Monitoring-Case split (CW-00-017, OD-06) is explicitly out of
 *      this packet's scope. case_workspace_value_measurements has no column
 *      linking a long-running series to a successor Monitoring Case's own
 *      case_id — when that concept lands it likely needs a nullable
 *      monitoring_case_id here or a dedicated case-to-case relationship
 *      table; not decided by this design.
 *   5. The EVIDENCE_MISSING vs UNMEASURED distinction is read here as "a
 *      measurement was attempted but its evidence source is currently
 *      unavailable" vs "no measurement has been attempted yet" — confirm
 *      this reading matches product intent.
 *   6. kpi_ref is an opaque, unenforced TEXT pointer to a native KPI/ROI
 *      object presumed to live in Results. Results is out of scope for this
 *      packet, so there is no FK, no existence check, and no confirmed
 *      knowledge of that table/id's actual shape yet.
 *   7. Tenant/membership fail-closed checks (CW-RT-065, CW-DOD-D5/D6) are,
 *      per the established convention across every CW-P01-06 service, not
 *      performed at this service layer — no method here takes an
 *      orgId/membership guard parameter. Flag loudly before any of these
 *      methods are wired into a route, same posture as every prior packet's
 *      own open_questions.
 *   8. dedupe_key idempotency on both tables is designed defensively
 *      (retry-safety, ON CONFLICT DO NOTHING) but no route layer exists yet
 *      in this packet to confirm callers will actually supply a stable key
 *      consistently.
 */

import { v4 as uuidv4 } from 'uuid';

import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';
import { CaseWorkspaceAuthError, requireCaseAccess } from './caseWorkspaceAuthContext.js';

// ---------------------------------------------------------------------------
// Public types — Case History Events
// ---------------------------------------------------------------------------

/**
 * Documented catalog of event_type values this packet's own emitters use.
 * NOT a DB CHECK enum (see the column comment in the migration and
 * open_question #2) — a future emitter may append a new kind here, or log an
 * entirely undocumented one, without a migration. Exported for callers that
 * want type-safe access to the known set; appendCaseHistoryEvent() itself
 * only requires event_type to be a non-blank string.
 */
export const HISTORY_EVENT_TYPES = [
  'CASE_STATUS_CHANGED',
  'GOVERNANCE_TIER_CHANGED',
  'CLOSURE_AXIS_CHANGED',
  'CLOSURE_RECORDED',
  'VALUE_MEASUREMENT_RECORDED',
  'PLAN_VERSION_PUBLISHED',
  'RUN_BOUND',
  'RUN_STATUS_CHANGED',
  'ACTION_PROPOSAL_DECIDED',
  'WAIT_RESOLVED',
] as const;

export type KnownHistoryEventType = (typeof HISTORY_EVENT_TYPES)[number];

/** The three canon timeline projections (see classifyHistoryEventProjections). */
export type HistoryEventProjection = 'BUSINESS' | 'AUDIT' | 'VALUE';

interface CaseWorkspaceHistoryEventRow {
  event_id: string;
  organization_id: string;
  project_id: string | null;
  case_id: string;
  event_type: string;
  actor_id: string;
  occurred_at: string;
  recorded_at: string;
  summary: string;
  payload: string;
  source_table: string | null;
  source_id: string | null;
  correlation_id: string | null;
  dedupe_key: string | null;
  global_seq: number | string;
}

export interface CaseHistoryEvent {
  eventId: string;
  organizationId: string;
  projectId: string | null;
  caseId: string;
  eventType: string;
  actorId: string;
  occurredAt: string;
  recordedAt: string;
  summary: string;
  payload: Record<string, unknown>;
  sourceTable: string | null;
  sourceId: string | null;
  correlationId: string | null;
  dedupeKey: string | null;
  globalSeq: number;
}

export interface AppendCaseHistoryEventInput {
  organizationId: string;
  projectId?: string | null;
  caseId: string;
  eventType: string;
  actorId: string;
  occurredAt: string;
  summary: string;
  payload?: Record<string, unknown> | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  correlationId?: string | null;
  dedupeKey?: string | null;
}

// ---------------------------------------------------------------------------
// Public types — Value Measurements
// ---------------------------------------------------------------------------

/**
 * CW-02-032's literal 5-value state set, verbatim from
 * 02_INFORMATION_ARCHITECTURE_AND_UX.md:287.
 */
export type ValueMeasurementStatus =
  | 'UNMEASURED'
  | 'PARTIAL'
  | 'CONFIRMED'
  | 'NOT_ACHIEVED'
  | 'EVIDENCE_MISSING';

export type ValueMeasurementConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

/** CW-01-016 / CW-01-026-INV12's distinct-states read, derived by
 * computeMetricValueOutcomeState() below. */
export type MetricValueOutcomeState =
  | 'NOT_YET_MEASURED'
  | 'PARTIAL_EVIDENCE'
  | 'NOT_ACHIEVED'
  | 'BENEFIT_ACHIEVED'
  | 'SUSTAINED';

interface CaseWorkspaceValueMeasurementRow {
  measurement_id: string;
  organization_id: string;
  project_id: string | null;
  case_id: string;
  metric_key: string;
  metric_name: string;
  kpi_ref: string | null;
  baseline_value: string | null;
  baseline_unit: string | null;
  target_value: string | null;
  target_unit: string | null;
  actual_value: string | null;
  actual_unit: string | null;
  measurement_status: ValueMeasurementStatus;
  measurement_date: string;
  measurement_window_start: string | null;
  measurement_window_end: string | null;
  confidence: ValueMeasurementConfidence;
  attribution: string;
  benefit_owner_actor_id: string | null;
  next_measurement_due_at: string | null;
  evidence_ref: string | null;
  measured_by_actor_id: string;
  dedupe_key: string | null;
  created_at: string;
}

export interface ValueMeasurement {
  measurementId: string;
  organizationId: string;
  projectId: string | null;
  caseId: string;
  metricKey: string;
  metricName: string;
  kpiRef: string | null;
  baselineValue: number | null;
  baselineUnit: string | null;
  targetValue: number | null;
  targetUnit: string | null;
  actualValue: number | null;
  actualUnit: string | null;
  measurementStatus: ValueMeasurementStatus;
  measurementDate: string;
  measurementWindowStart: string | null;
  measurementWindowEnd: string | null;
  confidence: ValueMeasurementConfidence;
  attribution: string;
  benefitOwnerActorId: string | null;
  nextMeasurementDueAt: string | null;
  evidenceRef: string | null;
  measuredByActorId: string;
  dedupeKey: string | null;
  createdAt: string;
}

export interface RecordValueMeasurementInput {
  caseId: string;
  metricKey: string;
  metricName: string;
  kpiRef?: string | null;
  baselineValue?: number | null;
  baselineUnit?: string | null;
  targetValue?: number | null;
  targetUnit?: string | null;
  actualValue?: number | null;
  actualUnit?: string | null;
  measurementStatus: ValueMeasurementStatus;
  measurementDate: string;
  measurementWindowStart?: string | null;
  measurementWindowEnd?: string | null;
  confidence: ValueMeasurementConfidence;
  attribution: string;
  benefitOwnerActorId?: string | null;
  nextMeasurementDueAt?: string | null;
  evidenceRef?: string | null;
  measuredByActorId: string;
  dedupeKey?: string | null;
}

interface CaseCoreRefRow {
  case_id: string;
  organization_id: string;
  project_id: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALUE_MEASUREMENT_STATUSES: readonly ValueMeasurementStatus[] = [
  'UNMEASURED',
  'PARTIAL',
  'CONFIRMED',
  'NOT_ACHIEVED',
  'EVIDENCE_MISSING',
];

const VALUE_MEASUREMENT_CONFIDENCES: readonly ValueMeasurementConfidence[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
];

// Statuses that require actual_value to be present.
const STATUSES_REQUIRING_ACTUAL: readonly ValueMeasurementStatus[] = ['CONFIRMED', 'NOT_ACHIEVED'];

// Statuses that require actual_value to be absent.
const STATUSES_FORBIDDING_ACTUAL: readonly ValueMeasurementStatus[] = ['UNMEASURED', 'EVIDENCE_MISSING'];

// How many trailing consecutive CONFIRMED measurements are needed for
// computeMetricValueOutcomeState() to read SUSTAINED rather than
// BENEFIT_ACHIEVED (CW-01-016, CW-01-026-INV12).
const DEFAULT_MIN_CONSECUTIVE_CONFIRMED = 2;

// Best-effort classification of the documented event_type catalog into the
// canon's three timeline projections. Unrecognized event_type values fall
// back to ['AUDIT'] in classifyHistoryEventProjections() below, since every
// event is at minimum an audit fact.
const HISTORY_EVENT_PROJECTIONS: Partial<Record<KnownHistoryEventType, readonly HistoryEventProjection[]>> = {
  CASE_STATUS_CHANGED: ['BUSINESS', 'AUDIT'],
  GOVERNANCE_TIER_CHANGED: ['AUDIT'],
  CLOSURE_AXIS_CHANGED: ['BUSINESS', 'AUDIT'],
  CLOSURE_RECORDED: ['BUSINESS', 'AUDIT'],
  VALUE_MEASUREMENT_RECORDED: ['VALUE', 'AUDIT'],
  PLAN_VERSION_PUBLISHED: ['BUSINESS', 'AUDIT'],
  RUN_BOUND: ['BUSINESS', 'AUDIT'],
  RUN_STATUS_CHANGED: ['BUSINESS', 'AUDIT'],
  ACTION_PROPOSAL_DECIDED: ['BUSINESS', 'AUDIT'],
  WAIT_RESOLVED: ['BUSINESS', 'AUDIT'],
};

// ---------------------------------------------------------------------------
// Local helpers (mirrors caseCoreService.ts/casePlanVersionService.ts/
// capabilityRegistryService.ts/runBindingService.ts/proposalApprovalService.
// ts/waitSubscriptionService.ts's own local helpers — not imported from
// there, each service file in this directory keeps its own copy per that
// file's existing convention).
// ---------------------------------------------------------------------------

function requireNonBlank(value: string | null | undefined, reason: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

function requireEnum<T extends string>(
  value: T | null | undefined,
  allowed: readonly T[],
  reason: string
): T {
  if (!value || !allowed.includes(value)) throw new Error(reason);
  return value;
}

function toNullableNumber(value: string | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function mapHistoryEventRow(row: CaseWorkspaceHistoryEventRow): CaseHistoryEvent {
  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(row.payload || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      payload = parsed as Record<string, unknown>;
    }
  } catch {
    payload = {};
  }
  return {
    eventId: row.event_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    caseId: row.case_id,
    eventType: row.event_type,
    actorId: row.actor_id,
    occurredAt: row.occurred_at,
    recordedAt: row.recorded_at,
    summary: row.summary,
    payload,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    correlationId: row.correlation_id,
    dedupeKey: row.dedupe_key,
    globalSeq: Number(row.global_seq),
  };
}

function mapValueMeasurementRow(row: CaseWorkspaceValueMeasurementRow): ValueMeasurement {
  return {
    measurementId: row.measurement_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    caseId: row.case_id,
    metricKey: row.metric_key,
    metricName: row.metric_name,
    kpiRef: row.kpi_ref,
    baselineValue: toNullableNumber(row.baseline_value),
    baselineUnit: row.baseline_unit,
    targetValue: toNullableNumber(row.target_value),
    targetUnit: row.target_unit,
    actualValue: toNullableNumber(row.actual_value),
    actualUnit: row.actual_unit,
    measurementStatus: row.measurement_status,
    measurementDate: row.measurement_date,
    measurementWindowStart: row.measurement_window_start,
    measurementWindowEnd: row.measurement_window_end,
    confidence: row.confidence,
    attribution: row.attribution,
    benefitOwnerActorId: row.benefit_owner_actor_id,
    nextMeasurementDueAt: row.next_measurement_due_at,
    evidenceRef: row.evidence_ref,
    measuredByActorId: row.measured_by_actor_id,
    dedupeKey: row.dedupe_key,
    createdAt: row.created_at,
  };
}

/**
 * Shared INSERT body, used both by the public appendCaseHistoryEvent() (its
 * own transaction) and internally by recordValueMeasurement() (so the
 * history row lands inside the SAME transaction as the measurement row,
 * atomically). Never SELECTs case_core — case_id is a plain, FK-less string
 * here (see the migration's header).
 */
async function insertHistoryEvent(
  client: PgTransactionClient,
  input: AppendCaseHistoryEventInput
): Promise<CaseHistoryEvent> {
  const organizationId = requireNonBlank(input.organizationId, 'history_event_organization_id_required');
  const caseId = requireNonBlank(input.caseId, 'history_event_case_id_required');
  const eventType = requireNonBlank(input.eventType, 'history_event_type_required');
  const actorId = requireNonBlank(input.actorId, 'history_event_actor_id_required');
  const occurredAt = requireNonBlank(input.occurredAt, 'history_event_occurred_at_required');
  const summary = requireNonBlank(input.summary, 'history_event_summary_required');

  const eventId = `cwhist-${uuidv4()}`;
  const recordedAt = new Date().toISOString();
  const payloadJson = JSON.stringify(input.payload ?? {});
  const dedupeKey = input.dedupeKey ?? null;

  const inserted = await client.query<CaseWorkspaceHistoryEventRow>(
    `INSERT INTO case_workspace_history_events (
       event_id, organization_id, project_id, case_id, event_type, actor_id,
       occurred_at, recorded_at, summary, payload, source_table, source_id,
       correlation_id, dedupe_key
     ) VALUES (
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     )
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING *`,
    [
      eventId,
      organizationId,
      input.projectId ?? null,
      caseId,
      eventType,
      actorId,
      occurredAt,
      recordedAt,
      summary,
      payloadJson,
      input.sourceTable ?? null,
      input.sourceId ?? null,
      input.correlationId ?? null,
      dedupeKey,
    ]
  );

  if (inserted.rows[0]) {
    return mapHistoryEventRow(inserted.rows[0]);
  }

  // 0 rows only happens when dedupeKey is set and already claimed by a prior
  // append (NULL dedupe_key values never collide under UNIQUE). Idempotent
  // replay: return the existing row unchanged.
  if (!dedupeKey) {
    throw new Error('history_event_insert_failed');
  }
  const existingResult = await client.query<CaseWorkspaceHistoryEventRow>(
    `SELECT * FROM case_workspace_history_events WHERE dedupe_key = ?`,
    [dedupeKey]
  );
  const existing = existingResult.rows[0];
  if (!existing) throw new Error('history_event_idempotency_record_not_found');
  return mapHistoryEventRow(existing);
}

// ---------------------------------------------------------------------------
// Pure, read-only helpers (no DB access)
// ---------------------------------------------------------------------------

/**
 * CW-00-016, CW-DOD-B2. Pure, no DB access. Looks up a code-level map
 * (HISTORY_EVENT_PROJECTIONS) from the documented event_type catalog to one
 * or more of the three canon timeline projections (BUSINESS/AUDIT/VALUE);
 * defaults to ['AUDIT'] for any unrecognized event_type, since every event
 * is at minimum an audit fact.
 */
export function classifyHistoryEventProjections(eventType: string): HistoryEventProjection[] {
  const known = HISTORY_EVENT_PROJECTIONS[eventType as KnownHistoryEventType];
  return known ? [...known] : ['AUDIT'];
}

/**
 * CW-01-016, CW-01-026-INV12, CW-00-020-INV13. Pure, no DB access — mirrors
 * waitSubscriptionService.computeWaitOverdueState()'s read-time-overlay
 * pattern. Never reads case_core's closure-axis columns.
 *
 * Empty input, or the latest (last-in-array) row UNMEASURED, ->
 * NOT_YET_MEASURED. Latest PARTIAL or EVIDENCE_MISSING -> PARTIAL_EVIDENCE.
 * Latest NOT_ACHIEVED -> NOT_ACHIEVED. Latest CONFIRMED -> counts the
 * trailing run of consecutive CONFIRMED rows from the end of the array;
 * >= minConsecutiveConfirmed (default 2) -> SUSTAINED, else
 * BENEFIT_ACHIEVED — the structural distinction between "delivered"/"Run
 * complete", "benefit achieved" and "sustained" (CW-01-016,
 * CW-01-026-INV12).
 */
export function computeMetricValueOutcomeState(
  measurementsOldestFirst: Array<Pick<ValueMeasurement, 'measurementStatus' | 'measurementDate'>>,
  minConsecutiveConfirmed: number = DEFAULT_MIN_CONSECUTIVE_CONFIRMED
): MetricValueOutcomeState {
  if (measurementsOldestFirst.length === 0) return 'NOT_YET_MEASURED';

  const latest = measurementsOldestFirst[measurementsOldestFirst.length - 1];
  if (latest.measurementStatus === 'UNMEASURED') return 'NOT_YET_MEASURED';
  if (latest.measurementStatus === 'PARTIAL' || latest.measurementStatus === 'EVIDENCE_MISSING') {
    return 'PARTIAL_EVIDENCE';
  }
  if (latest.measurementStatus === 'NOT_ACHIEVED') return 'NOT_ACHIEVED';

  // latest.measurementStatus === 'CONFIRMED'
  let consecutiveConfirmed = 0;
  for (let i = measurementsOldestFirst.length - 1; i >= 0; i -= 1) {
    if (measurementsOldestFirst[i].measurementStatus !== 'CONFIRMED') break;
    consecutiveConfirmed += 1;
  }
  return consecutiveConfirmed >= minConsecutiveConfirmed ? 'SUSTAINED' : 'BENEFIT_ACHIEVED';
}

// ---------------------------------------------------------------------------
// Service methods — Case History Events
// ---------------------------------------------------------------------------

/**
 * CW-00-020-INV13 (append-only), CW-01-026-INV9 (changed upstream evidence
 * marks downstream work stale — this primitive is how a future emitter would
 * log that fact), CW-DOD-B2 (closure/autonomy/tier history persists).
 *
 * Plain INSERT via insertHistoryEvent(), wrapped in its own transaction — no
 * row lock, no case_core read (deliberately decoupled, open_questions #1 in
 * the header). If input.dedupeKey is set, uses
 * `INSERT ... ON CONFLICT (dedupe_key) DO NOTHING RETURNING *`; on 0 rows,
 * re-SELECTs by dedupe_key and returns the existing row unchanged (idempotent
 * replay, same convention as waitSubscriptionService.createWait()). Without
 * a dedupeKey, always inserts a new row. global_seq is DB-assigned.
 * Validates organizationId/caseId/eventType/actorId/occurredAt/summary
 * non-blank; payload defaults to {} and is JSON.stringify'd.
 */
export async function appendCaseHistoryEvent(
  input: AppendCaseHistoryEventInput
): Promise<CaseHistoryEvent> {
  await requireCaseAccess(
    requireNonBlank(input.actorId, 'history_event_actor_id_required'),
    requireNonBlank(input.caseId, 'history_event_case_id_required')
  );
  return withPgTransaction((client) => insertHistoryEvent(client, input));
}

/** CW-00-020-INV13. Plain read, no lock. */
export async function getCaseHistoryEvent(
  eventId: string,
  actorUserId: string
): Promise<CaseHistoryEvent | null> {
  const id = requireNonBlank(eventId, 'history_event_id_required');
  const actor = requireNonBlank(actorUserId, 'history_event_actor_id_required');
  const row = await queryOne<CaseWorkspaceHistoryEventRow>(
    `SELECT * FROM case_workspace_history_events WHERE event_id = ?`,
    [id]
  );
  if (!row) return null;
  try {
    await requireCaseAccess(actor, row.case_id);
  } catch (err) {
    if (err instanceof CaseWorkspaceAuthError) return null;
    throw err;
  }
  return mapHistoryEventRow(row);
}

/**
 * CW-00-020-INV13, CW-03-017, CW-DOD-B2. Plain read, no lock, ordered by
 * global_seq ASC (chronological reconstruction of a Case's full timeline).
 * Cursor-based pagination on afterSeq/global_seq, never OFFSET, so results
 * stay stable under concurrent appends.
 */
export async function listCaseHistoryEventsForCase(
  caseId: string,
  filters:
    | {
        eventType?: string;
        sourceTable?: string;
        occurredSince?: string;
        occurredUntil?: string;
      }
    | undefined,
  pagination: { afterSeq?: number; limit?: number } | undefined,
  actorUserId: string
): Promise<CaseHistoryEvent[]> {
  const id = requireNonBlank(caseId, 'history_event_case_id_required');
  await requireCaseAccess(requireNonBlank(actorUserId, 'history_event_actor_id_required'), id);
  const conditions = ['case_id = ?'];
  const params: unknown[] = [id];

  if (filters?.eventType) {
    conditions.push('event_type = ?');
    params.push(requireNonBlank(filters.eventType, 'history_event_type_filter_invalid'));
  }
  if (filters?.sourceTable) {
    conditions.push('source_table = ?');
    params.push(requireNonBlank(filters.sourceTable, 'history_event_source_table_filter_invalid'));
  }
  if (filters?.occurredSince) {
    conditions.push('occurred_at >= ?');
    params.push(filters.occurredSince);
  }
  if (filters?.occurredUntil) {
    conditions.push('occurred_at <= ?');
    params.push(filters.occurredUntil);
  }
  if (typeof pagination?.afterSeq === 'number') {
    conditions.push('global_seq > ?');
    params.push(pagination.afterSeq);
  }

  const limit = pagination?.limit ?? 200;
  params.push(limit);

  const rows = await queryAll<CaseWorkspaceHistoryEventRow>(
    `SELECT * FROM case_workspace_history_events
       WHERE ${conditions.join(' AND ')}
       ORDER BY global_seq ASC
       LIMIT ?`,
    params
  );
  return rows.map(mapHistoryEventRow);
}

// ---------------------------------------------------------------------------
// Service methods — Value Measurements
// ---------------------------------------------------------------------------

/**
 * CW-02-032 (literal value field list), CW-00-020-INV13 (append-only),
 * CW-01-016 / CW-01-026-INV12 (delivered/benefit-achieved/sustained are
 * distinct, never inferred from completed steps).
 *
 * Within one transaction: plain SELECT of case_core WHERE case_id=? (no
 * lock) for organization_id/project_id + existence check — throws
 * value_measurement_case_not_found if absent. Validates measurementStatus is
 * one of the 5 literal values; validates status-specific field requirements
 * (CONFIRMED/NOT_ACHIEVED require actualValue present; CONFIRMED
 * additionally requires evidenceRef non-blank; UNMEASURED/EVIDENCE_MISSING
 * require actualValue to be absent); validates
 * confidence/attribution/measurementDate/measuredByActorId non-blank.
 * Always INSERTs a new row (dedupeKey optional, same
 * `ON CONFLICT (dedupe_key) DO NOTHING` retry-safety as
 * insertHistoryEvent(), never an UPDATE). In the SAME transaction, calls the
 * shared insertHistoryEvent() helper with
 * eventType='VALUE_MEASUREMENT_RECORDED', sourceTable=
 * 'case_workspace_value_measurements', sourceId=measurementId — so a
 * measurement can never commit without a matching timeline entry landing
 * atomically alongside it.
 */
export async function recordValueMeasurement(
  input: RecordValueMeasurementInput
): Promise<ValueMeasurement> {
  const caseId = requireNonBlank(input.caseId, 'value_measurement_case_id_required');
  const metricKey = requireNonBlank(input.metricKey, 'value_measurement_metric_key_required');
  const metricName = requireNonBlank(input.metricName, 'value_measurement_metric_name_required');
  const measurementStatus = requireEnum(
    input.measurementStatus,
    VALUE_MEASUREMENT_STATUSES,
    'value_measurement_status_invalid'
  );
  const measurementDate = requireNonBlank(
    input.measurementDate,
    'value_measurement_date_required'
  );
  const confidence = requireEnum(
    input.confidence,
    VALUE_MEASUREMENT_CONFIDENCES,
    'value_measurement_confidence_invalid'
  );
  const attribution = requireNonBlank(input.attribution, 'value_measurement_attribution_required');
  const measuredByActorId = requireNonBlank(
    input.measuredByActorId,
    'value_measurement_measured_by_actor_id_required'
  );

  const hasActual = input.actualValue !== null && input.actualValue !== undefined;
  if (STATUSES_REQUIRING_ACTUAL.includes(measurementStatus) && !hasActual) {
    throw new Error('value_measurement_actual_value_required');
  }
  if (STATUSES_FORBIDDING_ACTUAL.includes(measurementStatus) && hasActual) {
    throw new Error('value_measurement_actual_value_must_be_absent');
  }
  if (measurementStatus === 'CONFIRMED') {
    requireNonBlank(input.evidenceRef, 'value_measurement_evidence_ref_required_for_confirmed');
  }
  if (measurementStatus === 'EVIDENCE_MISSING' && input.evidenceRef) {
    throw new Error('value_measurement_evidence_ref_must_be_absent');
  }

  await requireCaseAccess(measuredByActorId, caseId);

  return withPgTransaction(async (client) => {
    const caseResult = await client.query<CaseCoreRefRow>(
      `SELECT case_id, organization_id, project_id FROM case_core WHERE case_id = ?`,
      [caseId]
    );
    const caseRow = caseResult.rows[0];
    if (!caseRow) throw new Error('value_measurement_case_not_found');

    const measurementId = `cwvm-${uuidv4()}`;
    const now = new Date().toISOString();
    const dedupeKey = input.dedupeKey ?? null;

    const inserted = await client.query<CaseWorkspaceValueMeasurementRow>(
      `INSERT INTO case_workspace_value_measurements (
         measurement_id, organization_id, project_id, case_id, metric_key,
         metric_name, kpi_ref, baseline_value, baseline_unit, target_value,
         target_unit, actual_value, actual_unit, measurement_status,
         measurement_date, measurement_window_start, measurement_window_end,
         confidence, attribution, benefit_owner_actor_id,
         next_measurement_due_at, evidence_ref, measured_by_actor_id,
         dedupe_key, created_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       )
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING *`,
      [
        measurementId,
        caseRow.organization_id,
        caseRow.project_id,
        caseId,
        metricKey,
        metricName,
        input.kpiRef ?? null,
        input.baselineValue ?? null,
        input.baselineUnit ?? null,
        input.targetValue ?? null,
        input.targetUnit ?? null,
        input.actualValue ?? null,
        input.actualUnit ?? null,
        measurementStatus,
        measurementDate,
        input.measurementWindowStart ?? null,
        input.measurementWindowEnd ?? null,
        confidence,
        attribution,
        input.benefitOwnerActorId ?? null,
        input.nextMeasurementDueAt ?? null,
        input.evidenceRef ?? null,
        measuredByActorId,
        dedupeKey,
        now,
      ]
    );

    let measurementRow = inserted.rows[0];
    if (!measurementRow) {
      // 0 rows only happens when dedupeKey is set and already claimed by a
      // prior insert (NULL dedupe_key values never collide). Idempotent
      // replay: return the existing row unchanged, and do NOT append a
      // second history event for it.
      if (!dedupeKey) throw new Error('value_measurement_insert_failed');
      const existingResult = await client.query<CaseWorkspaceValueMeasurementRow>(
        `SELECT * FROM case_workspace_value_measurements WHERE dedupe_key = ?`,
        [dedupeKey]
      );
      const existing = existingResult.rows[0];
      if (!existing) throw new Error('value_measurement_idempotency_record_not_found');
      return mapValueMeasurementRow(existing);
    }

    await insertHistoryEvent(client, {
      organizationId: caseRow.organization_id,
      projectId: caseRow.project_id,
      caseId,
      eventType: 'VALUE_MEASUREMENT_RECORDED',
      actorId: measuredByActorId,
      occurredAt: now,
      summary: `Value measurement recorded for metric "${metricName}" (${metricKey}): ${measurementStatus}`,
      payload: {
        measurementId,
        metricKey,
        measurementStatus,
        actualValue: input.actualValue ?? null,
        targetValue: input.targetValue ?? null,
        baselineValue: input.baselineValue ?? null,
        confidence,
      },
      sourceTable: 'case_workspace_value_measurements',
      sourceId: measurementId,
    });

    return mapValueMeasurementRow(measurementRow);
  });
}

/** CW-02-032. Plain read, no lock. */
export async function getValueMeasurement(
  measurementId: string,
  actorUserId: string
): Promise<ValueMeasurement | null> {
  const id = requireNonBlank(measurementId, 'value_measurement_id_required');
  const actor = requireNonBlank(actorUserId, 'value_measurement_actor_required');
  const row = await queryOne<CaseWorkspaceValueMeasurementRow>(
    `SELECT * FROM case_workspace_value_measurements WHERE measurement_id = ?`,
    [id]
  );
  if (!row) return null;
  try {
    await requireCaseAccess(actor, row.case_id);
  } catch (err) {
    if (err instanceof CaseWorkspaceAuthError) return null;
    throw err;
  }
  return mapValueMeasurementRow(row);
}

/**
 * CW-02-032, CW-01-004 (Case aggregate carries results/benefits/
 * sustainability state). Plain read, no lock, newest created_at first —
 * full value timeline for a Case across all metrics.
 */
export async function listValueMeasurementsForCase(
  caseId: string,
  filters: { metricKey?: string; status?: ValueMeasurementStatus } | undefined,
  actorUserId: string
): Promise<ValueMeasurement[]> {
  const id = requireNonBlank(caseId, 'value_measurement_case_id_required');
  await requireCaseAccess(requireNonBlank(actorUserId, 'value_measurement_actor_required'), id);
  const conditions = ['case_id = ?'];
  const params: unknown[] = [id];
  if (filters?.metricKey) {
    conditions.push('metric_key = ?');
    params.push(requireNonBlank(filters.metricKey, 'value_measurement_metric_key_filter_invalid'));
  }
  if (filters?.status) {
    conditions.push('measurement_status = ?');
    params.push(requireEnum(filters.status, VALUE_MEASUREMENT_STATUSES, 'value_measurement_status_invalid'));
  }
  const rows = await queryAll<CaseWorkspaceValueMeasurementRow>(
    `SELECT * FROM case_workspace_value_measurements
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC`,
    params
  );
  return rows.map(mapValueMeasurementRow);
}

/**
 * CW-02-032, CW-01-026-INV9 (a stale-evidence-aware reader would start from
 * this exact series). Plain read, no lock, ordered measurement_date ASC —
 * the full append-only series for one value stream, direct input to
 * computeMetricValueOutcomeState().
 */
export async function listValueMeasurementsForMetric(
  caseId: string,
  metricKey: string,
  actorUserId: string
): Promise<ValueMeasurement[]> {
  const id = requireNonBlank(caseId, 'value_measurement_case_id_required');
  const key = requireNonBlank(metricKey, 'value_measurement_metric_key_required');
  await requireCaseAccess(requireNonBlank(actorUserId, 'value_measurement_actor_required'), id);
  const rows = await queryAll<CaseWorkspaceValueMeasurementRow>(
    `SELECT * FROM case_workspace_value_measurements
       WHERE case_id = ? AND metric_key = ?
       ORDER BY measurement_date ASC`,
    [id, key]
  );
  return rows.map(mapValueMeasurementRow);
}
