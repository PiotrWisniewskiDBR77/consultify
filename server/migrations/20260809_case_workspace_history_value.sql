-- CW-P07 (Case Workspace, EPIC E11 "History, closure, value and
-- Monitoring") — two new tables: `case_workspace_history_events` and
-- `case_workspace_value_measurements`.
--
-- Collision-avoidance (same mandate as CW-P01's
-- 20260809_case_workspace_case_core.sql, CW-P02's
-- 20260809_case_workspace_case_plan_version.sql, CW-P03's
-- 20260809_case_workspace_capability_registry.sql, CW-P04's
-- 20260809_case_workspace_run_binding.sql, CW-P05's
-- 20260809_case_workspace_proposals_approvals.sql and CW-P06's
-- 20260809_case_workspace_wait_subscription.sql): this migration does NOT
-- alter `case_core`, `case_plan_versions`, `case_workspace_capabilities`,
-- `case_workspace_run_bindings`, `case_workspace_action_proposals` or
-- `case_workspace_waits` in any way (no ALTER TABLE, no new column on any of
-- them), and does not reference Finance or Results tables/routes at all. It
-- only adds two new tables, namespaced `case_workspace_*` per the
-- coordinator's mandate.
--
-- `case_workspace_history_events.case_id` deliberately carries NO FK into
-- `case_core` or any other table (see the column comment below) — this is
-- the one column in this migration that intentionally deviates from every
-- prior CW-P01-06 table's "FK-only, read-only referenced" posture, because
-- this table's whole purpose is to log events about ANY current or future
-- source table (case_core, case_plan_versions, case_workspace_capabilities,
-- case_workspace_run_bindings, case_workspace_action_proposals,
-- case_workspace_waits, or something not yet built) without a new FK/
-- migration per source. `case_workspace_value_measurements.case_id` IS
-- FK'd read-only to `case_core(case_id)`, permitted per this packet's own
-- task scope.
--
-- Scope note: this packet does NOT build the Monitoring-Case-split logic
-- (CW-00-017, OD-06 — linking a long-measurement Case to a successor
-- MONITORING Case). That needs a second Case-to-Case relationship concept
-- this packet does not build; flagged as future work, same carve-out
-- pattern as CW-P06's own DOMAIN_EVENT/EXTERNAL_CALLBACK deferral
-- (CW-CANON-12).
--
-- Ground truth for the columns below (docs/product/case-workspace/
-- acceptance/FUNCTIONAL_REQUIREMENT_COVERAGE.csv, epics column contains
-- "E11" AND row_id starts with "CW-"):
--   CW-00-020-INV13 (00_CASE_WORKSPACE_CANON.md:108) — "History is
--     append-only and value is not inferred from completed steps" ->
--     case_workspace_history_events has no updated_at/version column and no
--     method in caseHistoryService.ts issues UPDATE/DELETE against it;
--     case_workspace_value_measurements likewise has no updated_at/version
--     column, and a metric's "sustained" state is derived by
--     computeMetricValueOutcomeState() reading a run of rows, never by
--     rewriting an earlier row.
--   CW-01-016 (01_PRODUCT_CANON_AND_MODES.md:93) / CW-01-026-INV12
--     (01_PRODUCT_CANON_AND_MODES.md:165) — 'delivered', 'benefit achieved'
--     and 'sustained' are distinct states; 'Run complete' does not mean
--     'benefit achieved'; 'benefit achieved' does not mean 'sustained' ->
--     measurement_status's CONFIRMED value plus
--     computeMetricValueOutcomeState()'s trailing-consecutive-CONFIRMED-run
--     read (in the service) derive BENEFIT_ACHIEVED vs SUSTAINED purely from
--     stored measurement rows, never from case_core's four closure-axis
--     columns or from case_status.
--   CW-02-032 (02_INFORMATION_ARCHITECTURE_AND_UX.md:279) — "Value
--     distinguishes baseline, target, actual, measurement date/window,
--     confidence and attribution, next measurement, and 'unmeasured',
--     'partial', 'confirmed', 'not achieved' and 'evidence missing' states"
--     -> baseline_value/baseline_unit, target_value/target_unit,
--     actual_value/actual_unit, measurement_date,
--     measurement_window_start/measurement_window_end, confidence,
--     attribution, next_measurement_due_at, and measurement_status's literal
--     5-value CHECK enum below, verbatim from
--     02_INFORMATION_ARCHITECTURE_AND_UX.md:287.
--   CW-01-026-INV9 (01_PRODUCT_CANON_AND_MODES.md:162) — "Changed upstream
--     evidence marks downstream work stale" -> case_workspace_history_events'
--     open, non-CHECK-enum event_type plus source_table/source_id/
--     correlation_id/payload give any future emitter room to log an
--     UPSTREAM_EVIDENCE_CHANGED-shaped event and let a downstream reader
--     correlate it, without this packet needing to build the staleness
--     propagation itself.
--   CW-DOD-B2 (14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md:232) —
--     "Contracted closure, acceptance criteria, autonomy and tier history
--     persist" -> case_workspace_history_events lets closure/tier/status
--     changes (CLOSURE_RECORDED, GOVERNANCE_TIER_CHANGED,
--     CLOSURE_AXIS_CHANGED, CASE_STATUS_CHANGED — documented event_type
--     catalog in caseHistoryService.ts, not a DB CHECK list) be appended to
--     a durable, queryable timeline in addition to case_core's own
--     governance_tier_history JSON column, which this migration does not
--     touch.
--   CW-03-017 (03_INTERACTION_RESPONSIVE_ACCESSIBILITY.md:120) — "An
--     unavailable/deleted deliverable source is rendered as unavailable with
--     provenance and recovery guidance; it is not silently removed from
--     lineage" -> source_table/source_id carry no FK, so deleting or losing
--     the referenced source row never deletes or orphans the history event
--     itself.
--
-- Style follows 20260809_case_workspace_case_core.sql,
-- 20260809_case_workspace_case_plan_version.sql,
-- 20260809_case_workspace_capability_registry.sql,
-- 20260809_case_workspace_run_binding.sql,
-- 20260809_case_workspace_proposals_approvals.sql and
-- 20260809_case_workspace_wait_subscription.sql exactly: TEXT ids,
-- CHECK-constrained enum columns (except event_type, deliberately open — see
-- the column comment below), TEXT timestamps (app-level writes always pass
-- `new Date().toISOString()`; `DEFAULT CURRENT_TIMESTAMP` below is a
-- schema-level fallback only, never relied upon by the service), CREATE
-- TABLE/INDEX IF NOT EXISTS throughout so this file is idempotent and safe
-- to re-run.

CREATE TABLE IF NOT EXISTS case_workspace_history_events (
  -- Own row identity, minted `cwhist-${uuid}`.
  event_id TEXT PRIMARY KEY,

  -- Tenant scope, plain caller-supplied value. Deliberately NOT verified
  -- against `organizations` and NOT read from `case_core` — this table never
  -- reads or locks case_core (see case_id below), so it cannot denormalize
  -- from it the way every other CW-P01-06 table does.
  organization_id TEXT NOT NULL,

  -- Caller-supplied denormalized display convenience only. No FK.
  project_id TEXT,

  -- The owning Case, as a plain string. Deliberately NO FK and NO existence
  -- check against `case_core` — this is the structural choice that lets any
  -- current or future source table (case_core, case_plan_versions,
  -- case_workspace_capabilities, case_workspace_run_bindings,
  -- case_workspace_action_proposals, case_workspace_waits, or a table not
  -- yet built) log an event about a Case through this one primitive without
  -- a new FK/migration per source. Unlike every other CW-P01-06 table's
  -- case_id, this one is never `REFERENCES case_core(case_id)`.
  case_id TEXT NOT NULL,

  -- Open, non-CHECK-enum event kind — deliberately NOT a CHECK-constrained
  -- enum, a deviation from this directory's usual convention, so a future
  -- emitter never needs a migration to add a new event kind. The documented
  -- catalog (CASE_STATUS_CHANGED, GOVERNANCE_TIER_CHANGED,
  -- CLOSURE_AXIS_CHANGED, CLOSURE_RECORDED, VALUE_MEASUREMENT_RECORDED,
  -- PLAN_VERSION_PUBLISHED, RUN_BOUND, RUN_STATUS_CHANGED,
  -- ACTION_PROPOSAL_DECIDED, WAIT_RESOLVED) lives as a TS constant in
  -- caseHistoryService.ts, not here. Validated non-blank only.
  event_type TEXT NOT NULL,

  -- Human actor id, or a `system:<worker-name>` token for automated
  -- emitters (e.g. `system:scheduler`).
  actor_id TEXT NOT NULL,

  -- Business time of the event — distinct from recorded_at so a future
  -- backfill/replay can log a true historical time.
  occurred_at TEXT NOT NULL,

  -- When this row was actually appended — immutable proof-of-append time.
  -- Never updated after insert (no method in caseHistoryService.ts issues
  -- UPDATE against this table at all).
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Short human-readable line for the business-timeline projection (see
  -- classifyHistoryEventProjections() in the service).
  summary TEXT NOT NULL,

  -- JSON-serialized structured detail feeding the audit projection
  -- (before/after, policy, approval, correlation ID, error, retry,
  -- compensation) and the value projection, without a second table per
  -- projection. App-level writes always JSON.stringify a plain object.
  payload TEXT NOT NULL DEFAULT '{}',

  -- Informational-only pointer to the causing table, e.g. `case_core`. No
  -- FK — deleting the source row never deletes this history row
  -- (CW-03-017).
  source_table TEXT,

  -- Informational-only pointer to the source row's PK value. No FK.
  source_id TEXT,

  -- Ties events from one causal chain / triggering command together.
  correlation_id TEXT,

  -- Optional idempotent-append key. appendCaseHistoryEvent() uses
  -- `INSERT ... ON CONFLICT (dedupe_key) DO NOTHING RETURNING *`, then
  -- re-SELECTs by dedupe_key on 0 rows — same idempotent-replay convention
  -- as waitSubscriptionService.createWait(). NULL values never collide
  -- (standard SQL UNIQUE semantics), so events without a dedupe_key are
  -- always freely insertable.
  dedupe_key TEXT,

  -- DB-assigned globally monotonic tie-breaker for total ordering, without
  -- ever locking case_core or any other row. Drives
  -- listCaseHistoryEventsForCase()'s ORDER BY and cursor pagination.
  global_seq BIGINT GENERATED ALWAYS AS IDENTITY,

  CONSTRAINT case_workspace_history_events_dedupe_key_unique
    UNIQUE (dedupe_key)
);

-- Primary read path: reconstruct a Case's full timeline, chronologically,
-- via global_seq (listCaseHistoryEventsForCase).
CREATE INDEX IF NOT EXISTS idx_case_workspace_history_events_case_seq
  ON case_workspace_history_events (case_id, global_seq);

-- Filtering a Case's timeline by event kind (e.g. only
-- VALUE_MEASUREMENT_RECORDED events).
CREATE INDEX IF NOT EXISTS idx_case_workspace_history_events_case_event_type
  ON case_workspace_history_events (case_id, event_type);

-- Correlating events from one causal chain / triggering command across
-- Cases.
CREATE INDEX IF NOT EXISTS idx_case_workspace_history_events_correlation_id
  ON case_workspace_history_events (correlation_id);

CREATE TABLE IF NOT EXISTS case_workspace_value_measurements (
  -- Own row identity, minted `cwvm-${uuid}`.
  measurement_id TEXT PRIMARY KEY,

  -- Denormalized from case_core.organization_id, service-verified at
  -- insert (plain SELECT, never altered).
  organization_id TEXT NOT NULL,

  -- Denormalized from case_core.project_id at insert.
  project_id TEXT,

  -- The owning Case. FK-only into CW-P01's own table, read-only referenced,
  -- never altered — permitted per this packet's task scope, unlike the
  -- generic history log's FK-less case_id above. No ON DELETE clause
  -- (defaults to RESTRICT/NO ACTION) — mirrors run_bindings'/proposals'/
  -- waits' own posture toward case_core.
  case_id TEXT NOT NULL
    REFERENCES case_core(case_id),

  -- Caller-chosen stable identifier grouping successive measurements of the
  -- same value stream within one Case — the series
  -- listValueMeasurementsForMetric()/computeMetricValueOutcomeState() walk.
  metric_key TEXT NOT NULL,

  -- Human-readable label for the value timeline UI, always populated so
  -- display never requires a join into Results.
  metric_name TEXT NOT NULL,

  -- Opaque, unenforced pointer to a native KPI/ROI object presumed to live
  -- in Results. No FK — Results is out of scope for this packet.
  kpi_ref TEXT,

  -- CW-02-032 literal field. Nullable — baseline may be genuinely
  -- not-yet-known.
  baseline_value NUMERIC,
  baseline_unit TEXT,

  -- CW-02-032 literal field.
  target_value NUMERIC,
  target_unit TEXT,

  -- CW-02-032 literal field. Required (service-enforced) when
  -- measurement_status is CONFIRMED or NOT_ACHIEVED; must be NULL
  -- (service-enforced) when UNMEASURED or EVIDENCE_MISSING.
  actual_value NUMERIC,
  actual_unit TEXT,

  -- CW-02-032's literal state set, verbatim from
  -- 02_INFORMATION_ARCHITECTURE_AND_UX.md:287. Never null/blank — an
  -- unmeasured value item is an explicit UNMEASURED row, not the absence of
  -- a row (CW-00-020-INV13).
  measurement_status TEXT NOT NULL
    CHECK (measurement_status IN (
      'UNMEASURED', 'PARTIAL', 'CONFIRMED', 'NOT_ACHIEVED', 'EVIDENCE_MISSING'
    )),

  -- CW-02-032 literal "measurement date" field.
  measurement_date TEXT NOT NULL,

  -- CW-02-032 literal "measurement window" field — the period actual_value
  -- covers.
  measurement_window_start TEXT,
  measurement_window_end TEXT,

  -- CW-02-032 literal "confidence" field, modeled as a 3-value qualitative
  -- enum (open_questions #3 in the service flags the numeric-scale
  -- alternative).
  confidence TEXT NOT NULL
    CHECK (confidence IN ('LOW', 'MEDIUM', 'HIGH')),

  -- CW-02-032 literal "attribution" field — free-text causal claim linking
  -- the change to this observed value.
  attribution TEXT NOT NULL,

  -- The accountable benefit owner for this value stream.
  benefit_owner_actor_id TEXT,

  -- CW-02-032 literal "next measurement" field.
  next_measurement_due_at TEXT,

  -- Pointer to the source evidence backing actual_value. Required
  -- (service-enforced) when CONFIRMED; must be NULL (service-enforced) when
  -- EVIDENCE_MISSING.
  evidence_ref TEXT,

  -- Who/what recorded this measurement.
  measured_by_actor_id TEXT NOT NULL,

  -- Optional idempotent-insert key, retry-safety only — not a business
  -- uniqueness rule (multiple genuinely distinct measurements of the same
  -- metric on the same date are legitimate).
  dedupe_key TEXT,

  -- Append time. No updated_at and no version column exist on this table —
  -- their absence is itself the enforcement that a measurement is never
  -- edited (CW-00-020-INV13, CW-01-016, CW-01-026-INV12): "sustained" is
  -- proven by a later row still reading CONFIRMED, never by editing an
  -- earlier one.
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT case_workspace_value_measurements_dedupe_key_unique
    UNIQUE (dedupe_key)
);

-- Primary read path: a Case's full value timeline across all metrics
-- (listValueMeasurementsForCase).
CREATE INDEX IF NOT EXISTS idx_case_workspace_value_measurements_case_id
  ON case_workspace_value_measurements (case_id);

-- One metric's own append-only series, oldest-first
-- (listValueMeasurementsForMetric), the direct input to
-- computeMetricValueOutcomeState().
CREATE INDEX IF NOT EXISTS idx_case_workspace_value_measurements_case_metric
  ON case_workspace_value_measurements (case_id, metric_key, measurement_date);

-- Status-filtered scans (e.g. "all CONFIRMED measurements needing a
-- sustained-check across Cases").
CREATE INDEX IF NOT EXISTS idx_case_workspace_value_measurements_status
  ON case_workspace_value_measurements (measurement_status);
