/**
 * RN-G1 Platform Foundation — generic atomic-command write helper.
 *
 * Design: docs/product/results-vnext/RN_G1_PLATFORM_DESIGN.md §A.4.
 * Schema: server/migrations/20260809_rvn_platform_events_outbox.sql.
 *
 * This is the ONE place that implements the CAS + event-log + outbox write
 * pattern (§A.4). It is intentionally generic — not hardcoded to any one
 * aggregate table — because the domains this program exists to unify
 * (KPI/ROI/OKR, none of which exist yet as of this file) will all call the
 * SAME `executeAtomicCommand` with their own `loadForUpdate`/`applyMutation`/
 * `buildEvent` rather than each hand-rolling their own
 * BEGIN/SELECT FOR UPDATE/UPDATE/INSERT/COMMIT sequence. That per-domain
 * hand-rolling is exactly the pattern that produced 5 parallel ROI systems
 * and 4 KPI tables (see EXECUTION_LEDGER.md §3.7/§3.8) — this helper exists
 * so a future domain literally cannot skip the event/outbox write without
 * also skipping the aggregate write.
 *
 * DB access pattern (pinned `PoolClient`, explicit BEGIN/COMMIT-or-ROLLBACK,
 * `finally` release) and the STALE_VERSION error shape are copied verbatim
 * from `decisionCollaborationService.ts` (`finalizeDecisionTransition`,
 * lines ~809-940 / `DecisionConflictError`) — see that file's own doc
 * comment on `acquirePgClient()` in `PostgresDatabase.ts` for why
 * `pool.query()` per call does NOT give atomicity here.
 *
 * Status: NOT_IMPLEMENTED as a wired dependency — no controller/repository
 * calls this yet (see README.md in this directory). This file implements
 * the §A.4 algorithm literally so the shape is locked in for the first real
 * caller (a future KPI/ROI/OKR domain service).
 */
import type { PoolClient } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import logger from '../../../utils/Logger.js';

import type { PlatformEventEnvelope } from './eventEnvelope.js';

// ==========================================
// ERRORS
// ==========================================

/**
 * Optimistic-concurrency conflict. Shape (message/code/details) copied
 * verbatim from `DecisionConflictError` in `decisionCollaborationService.ts`
 * so callers/controllers that already know how to map that error class to an
 * HTTP 409 can handle this one identically (design §A.4: "typed 409
 * STALE_VERSION").
 */
export class AtomicWriteConflictError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AtomicWriteConflictError';
    this.code = code;
    this.details = details;
  }
}

/**
 * `loadForUpdate` found no row for (aggregateId, organizationId). Not named
 * in design §A.4 explicitly (the design assumes the row exists), but a
 * generic reusable helper cannot assume that — this mirrors
 * `DecisionNotFoundError`'s role in the reference implementation.
 */
export class AtomicWriteAggregateNotFoundError extends Error {
  constructor(message = 'Aggregate not found') {
    super(message);
    this.name = 'AtomicWriteAggregateNotFoundError';
  }
}

// ==========================================
// CONSUMER GROUP ROUTING (design §A.4 / decyzja #4, EXECUTION_LEDGER §7)
// ==========================================

/**
 * Static `event_type -> consumer_group[]` map (decyzja #4: code, not a
 * table — "mniej ruchomych części na start"). Placeholder entries only: no
 * KPI/ROI/OKR domain service exists yet to emit these event_types (see
 * EXECUTION_LEDGER.md §8 — this file is inert scaffolding, not wired to any
 * caller). Real domains extend this map when they land; `mywork_projection`
 * is a placeholder consumer name, not an existing implemented projection.
 */
export const EVENT_TYPE_CONSUMER_GROUPS: Readonly<Record<string, readonly string[]>> = {
  // KPI-E001/E002 (docs/product/results-vnext/KPI_E001_E002_DESIGN.md §A.7,
  // decyzja #1 zastosowana: underscore form `kpi.definition_approved`, NOT
  // the dotted `kpi.definition.approved` placeholder this map used to carry
  // — fixed here per decyzja #1). Full catalog per decyzja #8 ("every
  // state-changing transaction appends an event" — plan §8 was missing
  // kpi.definition_rejected/kpi.suspended/kpi.archived despite the commands
  // existing in §7.1; filled here as a documentation-gap fix, not a new
  // event surface). All KPI event_types fan out to 'mywork_projection' only
  // — no KPI-specific projection group exists yet in this repo (mirrors the
  // other two domains' entries below, which also default to
  // 'mywork_projection' unless a domain-specific consumer is already known,
  // as ROI-E003's `roi.case_approved` below shows for 'finance_projection').
  'kpi.definition_created': ['mywork_projection'],
  'kpi.definition_edited': ['mywork_projection'],
  'kpi.definition_submitted': ['mywork_projection'],
  'kpi.definition_approved': ['mywork_projection'],
  'kpi.definition_rejected': ['mywork_projection'],
  'kpi.activated': ['mywork_projection'],
  'kpi.suspended': ['mywork_projection'],
  'kpi.archived': ['mywork_projection'],
  'kpi.measurement_recorded': ['mywork_projection'],
  'kpi.measurement_corrected': ['mywork_projection'],
  'kpi.measurement_verified': ['mywork_projection'],
  'kpi.measurement_disputed': ['mywork_projection'],
  'okr_set.published': ['mywork_projection'],

  // KPI-E003 (docs/product/results-vnext/KPI_E003_DESIGN.md §A/§B) — the
  // deviation closed-loop's full event catalog. The design doc's own task
  // spec names 9 of these explicitly (opened/escalated/acknowledged/
  // corrective_plan_submitted/corrective_plan_approved/
  // corrective_action_updated/recovery_observed/effectiveness_verified/
  // closed); `corrective_action_added`, `deescalated` and `reopened` are
  // filled in here for the same reason KPI-E001/E002's §16 fix filled in
  // `kpi.definition_rejected`/`kpi.suspended`/`kpi.archived` — every
  // state-changing command in kpiDeviationCommands.ts/
  // kpiCorrectiveActionCommands.ts appends an event, and an event type
  // missing from this map does not fail the write (resolveConsumerGroups
  // logs a warning and returns []) but DOES silently drop outbox fan-out —
  // a documentation gap, not an intentional per-event opt-out. All fan out
  // to 'mywork_projection' only, same as every other domain entry above.
  'kpi.deviation_opened': ['mywork_projection'],
  'kpi.deviation_escalated': ['mywork_projection'],
  'kpi.deviation_deescalated': ['mywork_projection'],
  'kpi.deviation_acknowledged': ['mywork_projection'],
  'kpi.deviation_root_cause_submitted': ['mywork_projection'],
  'kpi.deviation_corrective_action_added': ['mywork_projection'],
  'kpi.deviation_corrective_plan_submitted': ['mywork_projection'],
  'kpi.deviation_corrective_plan_approved': ['mywork_projection'],
  'kpi.deviation_corrective_action_updated': ['mywork_projection'],
  'kpi.deviation_recovery_observed': ['mywork_projection'],
  'kpi.deviation_effectiveness_verified': ['mywork_projection'],
  'kpi.deviation_closed': ['mywork_projection'],
  'kpi.deviation_reopened': ['mywork_projection'],

  // KPI-E004 (docs/product/results-vnext/KPI_E004_DESIGN.md §B/§D) —
  // Scorecards. The design doc's own task spec names 3 explicitly
  // (scorecard.created/scorecard.membership_changed/scorecard.review_published);
  // scorecard.review_created/activated/suspended/archived are filled in here
  // for the same "documentation gap, not an intentional opt-out" reason
  // KPI-E003's own trailing entries above were — every state-changing
  // command in kpiScorecardCommands.ts appends an event. All fan out to
  // 'mywork_projection' only, same default every other domain entry above.
  'scorecard.created': ['mywork_projection'],
  'scorecard.membership_changed': ['mywork_projection'],
  'scorecard.activated': ['mywork_projection'],
  'scorecard.suspended': ['mywork_projection'],
  'scorecard.archived': ['mywork_projection'],
  'scorecard.review_created': ['mywork_projection'],
  'scorecard.review_published': ['mywork_projection'],

  // KPI-E005 (docs/product/results-vnext/KPI_E005_DESIGN.md §C.3) —
  // InitiativeKPIImpact. Not pinned by the design doc (§A/§B are read-model
  // queries with no command layer of their own; §C.3 gives command
  // signatures but no event-type catalog) — this package's own consistent
  // naming choice, same convention as kpiDeviationCommands.ts's
  // `kpi.deviation_manager_escalated`. All fan out to 'mywork_projection'
  // only, same default every other domain entry above.
  'kpi.initiative_impact_proposed': ['mywork_projection'],
  'kpi.initiative_impact_committed': ['mywork_projection'],
  'kpi.initiative_impact_reviewed': ['mywork_projection'],
  'kpi.initiative_impact_superseded': ['mywork_projection'],

  // ROI-E001 (docs/product/results-vnext/ROI_E001_DESIGN.md §8) — Case &
  // Baseline. These are E001's own new `roi.case_*`/`roi.baseline_*` keys,
  // in the naming convention `kpi.*` already established. All fan out to
  // 'mywork_projection' only, same default every other domain entry above.
  // `roi.baseline_frozen` has no E001 caller yet (`freezeRoiBaseline` itself
  // builds no event — design §4.5's contract is that ROI-E003's future
  // `approveRoiCase` builds and inserts that event on the same transaction)
  // — registered now so ROI-E003 does not need its own atomicWrite.ts edit
  // for it, same forward-declaration precedent as the KPI domain's own
  // trailing entries. (ROI-E003 §8/Decision D15: the pre-existing
  // `roi_case.decided` scaffolding entry that used to sit above this block —
  // reserved by ROI-E001's own Decision D7 comment for "ROI-E003's decided
  // outcome" — has been REMOVED, confirmed zero call sites anywhere in the
  // shipped codebase; ROI-E003 builds its own real `roi.case_approved`/
  // `roi.case_rejected`/etc. keys below instead of ever giving that
  // wrongly-named placeholder a real caller.)
  'roi.case_created': ['mywork_projection'],
  'roi.case_details_updated': ['mywork_projection'],
  'roi.case_archived': ['mywork_projection'],
  'roi.case_modeling_started': ['mywork_projection'],
  'roi.case_ready_for_review': ['mywork_projection'],
  'roi.baseline_captured': ['mywork_projection'],
  'roi.baseline_updated': ['mywork_projection'],
  'roi.baseline_frozen': ['mywork_projection'],

  // ROI-E002 (docs/product/results-vnext/ROI_E002_DESIGN.md §8) — Economic
  // Model. `roi.economic_model_frozen` has no E002 caller yet
  // (`freezeRoiEconomicModel` itself builds no event, same contract shape as
  // `roi.baseline_frozen` above — ROI-E003's future `approveRoiCase` builds
  // and inserts that event) — registered now so ROI-E003 does not need its
  // own atomicWrite.ts edit for it, same forward-declaration precedent. All
  // fan out to 'mywork_projection' only, same default every other domain
  // entry above.
  'roi.calculation_policy_updated': ['mywork_projection'],
  'roi.assumption_added': ['mywork_projection'],
  'roi.assumption_updated': ['mywork_projection'],
  'roi.assumption_removed': ['mywork_projection'],
  'roi.cost_line_added': ['mywork_projection'],
  'roi.cost_line_updated': ['mywork_projection'],
  'roi.cost_line_removed': ['mywork_projection'],
  'roi.benefit_line_added': ['mywork_projection'],
  'roi.benefit_line_updated': ['mywork_projection'],
  'roi.benefit_line_removed': ['mywork_projection'],
  'roi.benefit_evidence_link_added': ['mywork_projection'],
  'roi.benefit_evidence_link_removed': ['mywork_projection'],
  'roi.benefit_evidence_link_disputed': ['mywork_projection'],
  'roi.scenario_added': ['mywork_projection'],
  'roi.scenario_updated': ['mywork_projection'],
  'roi.scenario_removed': ['mywork_projection'],
  'roi.calculation_run_completed': ['mywork_projection'],
  'roi.calculation_run_failed': ['mywork_projection'],
  'roi.economic_model_frozen': ['mywork_projection'],

  // ROI-E003 (docs/product/results-vnext/ROI_E003_DESIGN.md §8) — Decision &
  // Approved. `roi.case_approved` fans to BOTH 'mywork_projection' AND
  // 'finance_projection' (Decision D15 — preserving the removed
  // `roi_case.decided` placeholder's Finance-facing intent for the one event
  // that actually represents a financial decision reaching a durable
  // outcome); every other new event here fans to 'mywork_projection' only,
  // same default every other domain entry in this map uses.
  'roi.case_submitted_for_approval': ['mywork_projection'],
  'roi.case_approved': ['mywork_projection', 'finance_projection'],
  'roi.case_rejected': ['mywork_projection'],
  'roi.case_changes_requested': ['mywork_projection'],
  'roi.case_reopened_from_approved': ['mywork_projection'],
  'roi.case_reopened_from_rejected': ['mywork_projection'],
  'roi.baseline_unfrozen': ['mywork_projection'],
  'roi.economic_model_unfrozen': ['mywork_projection'],

  // ROI-E004 (docs/product/results-vnext/ROI_E004_DESIGN.md §6) — Forecast &
  // Actual. `roi.tracking_started`/`roi.forecast_published`/
  // `roi.actual_recorded`/`roi.actual_corrected`/
  // `roi.actual_snapshot_published` fan to both 'mywork_projection' AND
  // 'finance_projection' (same rationale ROI-E003's `roi.case_approved` used
  // — these represent financially-relevant facts reaching a durable
  // outcome); `roi.actual_verified`/`roi.actual_disputed` and the Variance
  // trio fan to 'mywork_projection' only, per design §6's literal table.
  'roi.tracking_started': ['mywork_projection', 'finance_projection'],
  'roi.forecast_published': ['mywork_projection', 'finance_projection'],
  'roi.actual_recorded': ['mywork_projection', 'finance_projection'],
  'roi.actual_corrected': ['mywork_projection', 'finance_projection'],
  'roi.actual_verified': ['mywork_projection'],
  'roi.actual_disputed': ['mywork_projection'],
  'roi.actual_snapshot_published': ['mywork_projection', 'finance_projection'],
  'roi.material_variance_detected': ['mywork_projection'],
  'roi.variance_status_updated': ['mywork_projection'],
  'roi.variance_cause_added': ['mywork_projection'],

  // ROI-E005 (docs/product/results-vnext/ROI_E005_DESIGN.md §4) — Benefits
  // Realization. Both new event types fan to BOTH 'mywork_projection' AND
  // 'finance_projection' — same rationale ROI-E004's own tracking/actual
  // events above used: a status transition into/out of the financially
  // -relevant tracking lifecycle is a durable financial-facing fact, not
  // just a MyWork-facing one.
  'roi.benefits_realization_started': ['mywork_projection', 'finance_projection'],
  'roi.case_cancelled': ['mywork_projection', 'finance_projection'],

  // ROI-E006 (docs/product/results-vnext/ROI_E006_DESIGN.md §9) — PIR &
  // Learning. `roi.case_closed` fans to BOTH 'mywork_projection' AND
  // 'finance_projection' — the Case's terminal act, same rationale
  // ROI-E003's `roi.case_approved`/ROI-E004's tracking-lifecycle events/
  // ROI-E005's `roi.case_cancelled` above all used (a durable financial
  // -facing fact, not just a MyWork-facing one). The other five PIR events
  // are advisory/in-flight metadata (schedule/due/started/draft-edit/Teresa
  // -disposition) — 'mywork_projection' only, per design §9's literal table.
  'roi.post_investment_review_scheduled': ['mywork_projection'],
  'roi.post_investment_review_due': ['mywork_projection'],
  'roi.post_investment_review_started': ['mywork_projection'],
  'roi.post_investment_review_draft_updated': ['mywork_projection'],
  'roi.pir_teresa_draft_disposition_recorded': ['mywork_projection'],
  'roi.case_closed': ['mywork_projection', 'finance_projection'],

  // ROI-E007 (docs/product/results-vnext/ROI_E007_DESIGN.md §4/§6) —
  // Finance/KPI Seams. Finance-link create/remove and reconciliation-opened/
  // -resolved fan to BOTH 'mywork_projection' AND 'finance_projection' —
  // same rationale every other durable financial-facing fact above uses
  // (Decision D5: 'finance_projection' stays pull-based/write-only
  // scaffolding this epic, per outboxDrain.ts's own instruction not to build
  // a consumer yet). A non-terminal reconciliation-status transition (i.e.
  // into 'investigating') and the evidence-link freshness acknowledgment are
  // both lighter, MyWork-only facts (Decision D1/D7) — 'mywork_projection'
  // only, matching `roi.variance_status_updated`'s own precedent above.
  'roi.finance_link_created': ['mywork_projection', 'finance_projection'],
  'roi.finance_link_removed': ['mywork_projection', 'finance_projection'],
  'roi.finance_reconciliation_opened': ['mywork_projection', 'finance_projection'],
  'roi.finance_reconciliation_resolved': ['mywork_projection', 'finance_projection'],
  'roi.finance_reconciliation_status_updated': ['mywork_projection'],
  'roi.evidence_link_freshness_flagged': ['mywork_projection'],

  // OKR-E001 (docs/product/results-vnext/OKR_E001_DESIGN.md §9) — Program &
  // Cycle. First real OKR domain events (`'okr_set.published'` above is a
  // pre-existing RN-G1 placeholder reserved for OKR-E002, untouched by this
  // epic). All fan out to 'mywork_projection' only, same default every
  // other domain entry in this map uses — no OKR-specific consumer group
  // exists yet.
  'okr_program.created': ['mywork_projection'],
  'okr_program.draft_edited': ['mywork_projection'],
  'okr_program.published': ['mywork_projection'],
  'okr_cycle.created': ['mywork_projection'],
  'okr_cycle.drafting_opened': ['mywork_projection'],
  'okr_cycle.activated': ['mywork_projection'],
  'okr_cycle.review_opened': ['mywork_projection'],
  'okr_cycle.closed': ['mywork_projection'],
  'okr_cycle.cancelled': ['mywork_projection'],
};

/**
 * Resolves the consumer groups for an `event_type`. Unknown event types
 * resolve to an empty list (no outbox fan-out) rather than throwing — a
 * domain forgetting to register its event_type here should not crash the
 * write, but it IS silently dropping delivery, so this logs a warning.
 *
 * Exported (KPI-E003) so a caller that manually inserts an
 * `rvn_platform_events` row OUTSIDE `executeAtomicCommand`/
 * `executeAtomicCreate` — `kpiDeviationCommands.ts`'s
 * `openOrEscalateDeviationCase`, which must write its `kpi.deviation_opened`/
 * `kpi.deviation_escalated` events on an already-open pinned client inside
 * `recordMeasurement`/`correctMeasurement`'s own transaction (design
 * decision #3) rather than nesting a second atomic-write helper — can fan
 * out to the outbox identically instead of re-deriving this lookup.
 */
export function resolveConsumerGroups(eventType: string): readonly string[] {
  const groups = EVENT_TYPE_CONSUMER_GROUPS[eventType];
  if (!groups || groups.length === 0) {
    logger.warn(
      '[resultsVnext/platform/atomicWrite] event_type has no registered consumer_group — outbox fan-out skipped',
      { eventType }
    );
    return [];
  }
  return groups;
}

// ==========================================
// PUBLIC TYPES
// ==========================================

/**
 * Fields the caller supplies to build the `rvn_platform_events` row. Omits
 * the columns the DB generates (`event_id`, `sequence`, `recorded_at`) —
 * everything else in `PlatformEventEnvelope` (see eventEnvelope.ts) must be
 * provided by the domain, since the platform layer has no idea what an
 * "approved" KPI definition looks like.
 */
export type AtomicEventInput = Omit<PlatformEventEnvelope, 'eventId' | 'sequence' | 'recordedAt'>;

export interface ExecuteAtomicCommandParams<TAggregateRow, TResult> {
  /** Tenant scope — also the second predicate on every query this helper runs. */
  organizationId: string;
  /** Aggregate row identifier, as understood by `loadForUpdate`. */
  aggregateId: string;
  /** Optimistic-concurrency precondition (design §A.4 step 3). */
  expectedVersion: number;

  /**
   * Runs `SELECT ... FOR UPDATE` (or equivalent) for the aggregate row on
   * the pinned transactional client. Return `undefined`/`null` if no row
   * exists for (aggregateId, organizationId) — this helper turns that into
   * `AtomicWriteAggregateNotFoundError`.
   */
  loadForUpdate: (
    client: PoolClient,
    aggregateId: string,
    organizationId: string
  ) => Promise<TAggregateRow | undefined | null>;

  /** Reads the current optimistic-concurrency version off the loaded row. */
  getCurrentVersion: (row: TAggregateRow) => number;

  /**
   * Applies the domain mutation (the aggregate `UPDATE ... SET ...,
   * row_version = row_version + 1`) on the SAME pinned client, and returns
   * whatever shape the caller wants back as the command result.
   * `nextVersion` is `getCurrentVersion(currentRow) + 1`, computed once by
   * this helper so the mutation and the event's `resulting_version` can
   * never drift apart.
   */
  applyMutation: (
    client: PoolClient,
    currentRow: TAggregateRow,
    nextVersion: number
  ) => Promise<TResult>;

  /**
   * Builds the `rvn_platform_events` row to insert. Called AFTER
   * `applyMutation` so it can see the mutation result (e.g. to put the new
   * state in `afterState`). Must set `idempotencyKey` — that is the column
   * the `ON CONFLICT (organization_id, idempotency_key) DO NOTHING` targets.
   */
  buildEvent: (ctx: {
    currentRow: TAggregateRow;
    result: TResult;
    nextVersion: number;
  }) => AtomicEventInput;

  /**
   * Reconstructs `TResult` from a pre-existing `rvn_platform_events` row
   * when the idempotency key was already used (a command retry). Optional —
   * if omitted, this helper falls back to casting the existing event's
   * `after_state` JSONB as `TResult` (design §A.4: "przekazana funkcja
   * loadExistingResult, albo prosty re-SELECT po idempotency_key" — the
   * fallback IS that "prosty re-SELECT" path). Domains whose `TResult`
   * cannot be reconstructed from `after_state` alone should supply this.
   */
  loadExistingResult?: (client: PoolClient, existingEvent: ExistingEventRow) => Promise<TResult>;
}

export interface ExistingEventRow {
  event_id: string;
  sequence: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  organization_id: string;
  occurred_at: string;
  recorded_at: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  resulting_version: number;
  idempotency_key: string;
}

export interface AtomicCommandOutcome<TResult> {
  /** 'applied' = this call performed the mutation. 'duplicate' = idempotency
   * key already existed; the mutation in THIS call was rolled back and the
   * previously-committed result is returned instead. */
  outcome: 'applied' | 'duplicate';
  eventId: string;
  resultingVersion: number;
  result: TResult;
}

// ==========================================
// IMPLEMENTATION
// ==========================================

/**
 * Exported (KPI-E003) for the same reason `resolveConsumerGroups` is
 * exported above — `openOrEscalateDeviationCase`'s manual
 * `rvn_platform_events` inserts must match this column list/order exactly
 * (same `ON CONFLICT (organization_id, idempotency_key) DO NOTHING`
 * idempotency guard, same columns) without restating it as a second literal
 * copy that could drift from this one.
 */
export const EVENT_INSERT_SQL = `
  INSERT INTO rvn_platform_events (
    schema_version, event_type, aggregate_type, aggregate_id, organization_id,
    actor_user_id, actor_effective_role, command_id, correlation_id, causation_id,
    occurred_at, policy_version, before_state, after_state, state_hash, reason,
    evidence_refs, source, idempotency_key, expected_version, resulting_version, payload
  ) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16,
    $17, $18, $19, $20, $21, $22
  )
  ON CONFLICT (organization_id, idempotency_key) DO NOTHING
  RETURNING event_id, resulting_version
`;

/**
 * Design §A.4, executed literally:
 *   BEGIN
 *   SELECT ... FOR UPDATE                      (loadForUpdate)
 *     expected_version != current_version -> ROLLBACK, typed STALE_VERSION
 *   UPDATE <aggregate> SET ..., row_version+1   (applyMutation)
 *   INSERT INTO rvn_platform_events ... ON CONFLICT DO NOTHING RETURNING event_id
 *     no row returned -> ROLLBACK, return existing event's result
 *   INSERT INTO rvn_platform_outbox (one row per applicable consumer_group)
 *   COMMIT
 */
export async function executeAtomicCommand<TAggregateRow, TResult>(
  params: ExecuteAtomicCommandParams<TAggregateRow, TResult>
): Promise<AtomicCommandOutcome<TResult>> {
  const {
    organizationId,
    aggregateId,
    expectedVersion,
    loadForUpdate,
    getCurrentVersion,
    applyMutation,
    buildEvent,
    loadExistingResult,
  } = params;

  const client: PoolClient = await acquirePgClient();
  try {
    await client.query('BEGIN');

    // Step 2 (design §A.4): SELECT ... FOR UPDATE.
    const currentRow = await loadForUpdate(client, aggregateId, organizationId);
    if (!currentRow) {
      await client.query('ROLLBACK');
      throw new AtomicWriteAggregateNotFoundError();
    }

    // Step 3: CAS check.
    const currentVersion = getCurrentVersion(currentRow);
    if (expectedVersion !== currentVersion) {
      await client.query('ROLLBACK');
      throw new AtomicWriteConflictError(
        'Aggregate was modified since it was last read',
        'STALE_VERSION',
        { currentVersion, expectedVersion }
      );
    }

    const nextVersion = currentVersion + 1;

    // Step 4: domain mutation, same pinned client.
    const result = await applyMutation(client, currentRow, nextVersion);

    // Step 5: event log insert, idempotency-guarded.
    const eventInput = buildEvent({ currentRow, result, nextVersion });
    const eventResult = await client.query<{ event_id: string; resulting_version: number }>(
      EVENT_INSERT_SQL,
      [
        eventInput.schemaVersion,
        eventInput.eventType,
        eventInput.aggregateType,
        eventInput.aggregateId,
        eventInput.organizationId,
        eventInput.actorUserId,
        eventInput.actorEffectiveRole,
        eventInput.commandId,
        eventInput.correlationId,
        eventInput.causationId,
        eventInput.occurredAt,
        eventInput.policyVersion,
        eventInput.beforeState === null ? null : JSON.stringify(eventInput.beforeState),
        eventInput.afterState === null ? null : JSON.stringify(eventInput.afterState),
        eventInput.stateHash,
        eventInput.reason,
        JSON.stringify(eventInput.evidenceRefs ?? []),
        eventInput.source,
        eventInput.idempotencyKey,
        eventInput.expectedVersion,
        eventInput.resultingVersion,
        JSON.stringify(eventInput.payload ?? {}),
      ]
    );

    const insertedEvent = eventResult.rows[0];
    if (!insertedEvent) {
      // Duplicate idempotency_key — this exact command already committed
      // once. Roll back THIS call's mutation (it must not double-apply) and
      // hand back the previously-committed result instead.
      const existingResult = await client.query<ExistingEventRow>(
        `SELECT event_id, sequence, event_type, aggregate_type, aggregate_id, organization_id,
                occurred_at, recorded_at, before_state, after_state, resulting_version, idempotency_key
           FROM rvn_platform_events
          WHERE organization_id = $1 AND idempotency_key = $2`,
        [organizationId, eventInput.idempotencyKey]
      );
      const existingEvent = existingResult.rows[0];
      await client.query('ROLLBACK');

      if (!existingEvent) {
        // Should not be reachable (ON CONFLICT fired against this exact
        // unique index means a row must exist) — fail loudly rather than
        // return a fabricated result.
        throw new Error(
          `[executeAtomicCommand] idempotency conflict on (${organizationId}, ${eventInput.idempotencyKey}) but existing event row not found`
        );
      }

      const duplicateResult = loadExistingResult
        ? await loadExistingResult(client, existingEvent)
        : ((existingEvent.after_state ?? {}) as unknown as TResult);

      return {
        outcome: 'duplicate',
        eventId: existingEvent.event_id,
        resultingVersion: existingEvent.resulting_version,
        result: duplicateResult,
      };
    }

    // Step 6: outbox fan-out, one row per applicable consumer_group.
    const consumerGroups = resolveConsumerGroups(eventInput.eventType);
    if (consumerGroups.length > 0) {
      await client.query(
        `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
           SELECT $1, cg, 'pending' FROM unnest($2::text[]) AS cg`,
        [insertedEvent.event_id, consumerGroups]
      );
    }

    // Step 7.
    await client.query('COMMIT');

    return {
      outcome: 'applied',
      eventId: insertedEvent.event_id,
      resultingVersion: insertedEvent.resulting_version,
      result,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Same defensive double-rollback-is-a-no-op pattern as
      // decisionCollaborationService.finalizeDecisionTransition — a prior
      // explicit ROLLBACK in the try block above may have already ended the
      // transaction, in which case this second ROLLBACK is a harmless no-op
      // that pg still may log/throw on depending on driver version.
      logger.warn('[resultsVnext/platform/atomicWrite] rollback after error failed', {
        error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
      });
    }
    throw err;
  } finally {
    client.release();
  }
}

// ==========================================
// executeAtomicCreate — sibling for NEW aggregates (KPI-E001/E002 design §A.6)
// ==========================================

/**
 * Sibling of `executeAtomicCommand` for the "create a brand-new aggregate"
 * case (docs/product/results-vnext/KPI_E001_E002_DESIGN.md §A.6, decyzja #2:
 * "platform-owned, not KPI-owned; ROI/OKR will need the same primitive").
 *
 * `executeAtomicCommand` assumes the aggregate row already exists (it
 * `SELECT ... FOR UPDATE`s it and checks a CAS `expectedVersion` against it)
 * — that assumption is wrong for a `create` command, which has no row to
 * lock yet. This helper drops `loadForUpdate`/`getCurrentVersion`/
 * `expectedVersion` entirely (no CAS is possible or needed against a row
 * that doesn't exist) and keeps everything else identical: `applyMutation`
 * performs the domain INSERT(s) on the pinned client, the resulting event is
 * written with the same `ON CONFLICT (organization_id, idempotency_key) DO
 * NOTHING` idempotency guard, a duplicate submission rolls back the just-
 * inserted aggregate row(s) and returns the previously-committed result
 * instead of double-creating, and a successful create fans the event out to
 * the outbox exactly like `executeAtomicCommand` does.
 *
 * Decyzja #12 (measurement commands route through THIS helper, not the
 * parent KPI's CAS) is why `recordMeasurement`/`correctMeasurement`/
 * `verifyMeasurement`/`disputeMeasurement` in `kpiMeasurementCommands.ts` all
 * call `executeAtomicCreate` even though they are not, strictly, "creating
 * the KPI" — each one creates a new, immutable `rvn_kpi_measurements` row
 * (the table is append-only), which is exactly the "no existing row to CAS
 * against" shape this helper is for.
 */
export interface ExecuteAtomicCreateParams<TResult> {
  /** Tenant scope — the idempotency key and the outbox row are both written
   * under this organization_id, same as `executeAtomicCommand`. */
  organizationId: string;

  /**
   * Performs the domain INSERT(s) for the new aggregate on the pinned
   * client and returns whatever shape the caller wants back as the command
   * result. Unlike `executeAtomicCommand.applyMutation`, there is no
   * `currentRow`/`nextVersion` to receive — a create has no prior state and
   * the caller decides its own initial version (typically `1`), baked into
   * whatever it inserts and into the event it builds in `buildEvent` below.
   */
  applyMutation: (client: PoolClient) => Promise<TResult>;

  /**
   * Builds the `rvn_platform_events` row to insert. Called AFTER
   * `applyMutation`, same as `executeAtomicCommand`, so it can see the
   * mutation result (e.g. the newly generated aggregate id) and put it in
   * `afterState`/`aggregateId`. Must set `idempotencyKey`.
   */
  buildEvent: (ctx: { result: TResult }) => AtomicEventInput;

  /**
   * Reconstructs `TResult` from a pre-existing `rvn_platform_events` row
   * when the idempotency key was already used (a command retry). Same
   * fallback behavior as `executeAtomicCommand.loadExistingResult` — if
   * omitted, this helper casts the existing event's `after_state` JSONB as
   * `TResult`.
   */
  loadExistingResult?: (client: PoolClient, existingEvent: ExistingEventRow) => Promise<TResult>;
}

/**
 * Design §A.6, executed literally (identical to §A.4's steps 5-7, minus the
 * CAS-specific steps 2-4 that assume an existing row):
 *   BEGIN
 *   INSERT <new aggregate>                       (applyMutation)
 *   INSERT INTO rvn_platform_events ... ON CONFLICT DO NOTHING RETURNING event_id
 *     no row returned -> ROLLBACK (undoes the aggregate insert too), return
 *     existing event's result
 *   INSERT INTO rvn_platform_outbox (one row per applicable consumer_group)
 *   COMMIT
 */
export async function executeAtomicCreate<TResult>(
  params: ExecuteAtomicCreateParams<TResult>
): Promise<AtomicCommandOutcome<TResult>> {
  const { organizationId, applyMutation, buildEvent, loadExistingResult } = params;

  const client: PoolClient = await acquirePgClient();
  try {
    await client.query('BEGIN');

    // Domain insert(s), same pinned client.
    const result = await applyMutation(client);

    // Event log insert, idempotency-guarded — identical shape to
    // executeAtomicCommand's step 5.
    const eventInput = buildEvent({ result });
    const eventResult = await client.query<{ event_id: string; resulting_version: number }>(
      EVENT_INSERT_SQL,
      [
        eventInput.schemaVersion,
        eventInput.eventType,
        eventInput.aggregateType,
        eventInput.aggregateId,
        eventInput.organizationId,
        eventInput.actorUserId,
        eventInput.actorEffectiveRole,
        eventInput.commandId,
        eventInput.correlationId,
        eventInput.causationId,
        eventInput.occurredAt,
        eventInput.policyVersion,
        eventInput.beforeState === null ? null : JSON.stringify(eventInput.beforeState),
        eventInput.afterState === null ? null : JSON.stringify(eventInput.afterState),
        eventInput.stateHash,
        eventInput.reason,
        JSON.stringify(eventInput.evidenceRefs ?? []),
        eventInput.source,
        eventInput.idempotencyKey,
        eventInput.expectedVersion,
        eventInput.resultingVersion,
        JSON.stringify(eventInput.payload ?? {}),
      ]
    );

    const insertedEvent = eventResult.rows[0];
    if (!insertedEvent) {
      // Duplicate idempotency_key — this exact create command already
      // committed once. Roll back THIS call's aggregate insert (it must not
      // double-create) and hand back the previously-committed result.
      const existingResult = await client.query<ExistingEventRow>(
        `SELECT event_id, sequence, event_type, aggregate_type, aggregate_id, organization_id,
                occurred_at, recorded_at, before_state, after_state, resulting_version, idempotency_key
           FROM rvn_platform_events
          WHERE organization_id = $1 AND idempotency_key = $2`,
        [organizationId, eventInput.idempotencyKey]
      );
      const existingEvent = existingResult.rows[0];
      await client.query('ROLLBACK');

      if (!existingEvent) {
        throw new Error(
          `[executeAtomicCreate] idempotency conflict on (${organizationId}, ${eventInput.idempotencyKey}) but existing event row not found`
        );
      }

      const duplicateResult = loadExistingResult
        ? await loadExistingResult(client, existingEvent)
        : ((existingEvent.after_state ?? {}) as unknown as TResult);

      return {
        outcome: 'duplicate',
        eventId: existingEvent.event_id,
        resultingVersion: existingEvent.resulting_version,
        result: duplicateResult,
      };
    }

    // Outbox fan-out, one row per applicable consumer_group.
    const consumerGroups = resolveConsumerGroups(eventInput.eventType);
    if (consumerGroups.length > 0) {
      await client.query(
        `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
           SELECT $1, cg, 'pending' FROM unnest($2::text[]) AS cg`,
        [insertedEvent.event_id, consumerGroups]
      );
    }

    await client.query('COMMIT');

    return {
      outcome: 'applied',
      eventId: insertedEvent.event_id,
      resultingVersion: insertedEvent.resulting_version,
      result,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.warn('[resultsVnext/platform/atomicWrite] rollback after error failed (executeAtomicCreate)', {
        error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
      });
    }
    throw err;
  } finally {
    client.release();
  }
}
