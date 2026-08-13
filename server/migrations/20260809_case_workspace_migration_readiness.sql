-- CW-P11 (Case Workspace, EPIC E13 "Migration and legacy retirement
-- readiness") — three new tables: `case_workspace_feature_flag_definitions`,
-- `case_workspace_feature_flags` and `case_workspace_legacy_quarantine`.
--
-- Collision-avoidance (same mandate as CW-P01's
-- 20260809_case_workspace_case_core.sql through CW-P10's own migration):
-- this migration does NOT alter `case_core`, `case_plan_versions`,
-- `case_workspace_capabilities`, `case_workspace_run_bindings`,
-- `case_workspace_action_proposals`, `case_workspace_waits`,
-- `case_workspace_history_events`, `case_workspace_value_measurements`,
-- `case_workspace_execution_*`, `case_workspace_artifact_links`,
-- `case_workspace_plays` or any other pre-existing table in any way (no
-- ALTER TABLE, no new column on any of them), and does not reference
-- Finance or Results tables/routes at all. It also does NOT alter
-- `v8_feature_flags` / `v8.v8_feature_flags` or
-- server/migrations/20260324_v8_feature_flags.sql — per the coordinator's
-- explicit directive this packet EXTENDS that table's column/query
-- conventions (organization_id, module-shaped flag_key, enabled,
-- updated_at/updated_by, ON CONFLICT upsert) into a deliberately separate,
-- namespaced `case_workspace_*` pair, so `server/src/services/v8/
-- featureFlagService.ts` and its own callers are entirely unaffected. It
-- only adds three new tables, namespaced `case_workspace_*` per the
-- coordinator's mandate.
--
-- Ground truth for the columns below (docs/product/case-workspace/
-- acceptance/FUNCTIONAL_REQUIREMENT_COVERAGE.csv, epics column contains
-- "E13" AND row_id starts with "CW-"):
--   CW-DOD-J1 (14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md:358) —
--     "All new mutation flags default OFF and are server-authoritative" ->
--     case_workspace_feature_flag_definitions.default_enabled carries
--     `CHECK (default_enabled = FALSE)` (a column that can structurally
--     never read TRUE, not merely a convention) and
--     case_workspace_feature_flags.enabled defaults FALSE with no row
--     materialized until an explicit write — a missing
--     (organization_id, flag_key) row always reads as disabled, in every
--     environment, deliberately deviating from v8_feature_flags' own
--     non-production zero-rows-means-enabled fallback (see
--     server/src/services/v8/featureFlagService.ts's
--     allowImplicitOrgRowsFallback()) documented as a dev-vs-demo
--     discrepancy source in CODEBASE_CONVERGENCE_MAP.csv (area=
--     migrations-flags-outbox).
--   CW-DOD-J2 (14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md:359) —
--     "Internal cohort and comparison projections pass before broader
--     enablement" -> cohort (open TEXT rollout-wave label, e.g.
--     'internal'/'beta'/'ga') plus rollout_percentage/allow_list_json give
--     listCurrentOrgFlags()/isFlagEnabledForEntity() in
--     migrationReadinessService.ts a real, queryable narrower-than-org-wide
--     rollout surface, not just a binary org switch.
--   CW-DOD-J3 (14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md:360) —
--     "Rollback disables the smallest flag and preserves audit/effects" ->
--     parent_flag_key is a real self-referencing FK on
--     case_workspace_feature_flag_definitions, walked via WITH RECURSIVE in
--     findSmallestEnabledDescendant() (service), so "the smallest flag" is a
--     queryable hierarchy relationship, not a naming convention; rollbackFlag()
--     issues exactly one UPDATE on exactly one
--     (organization_id, flag_key) row and never touches
--     case_workspace_history_events, case_workspace_value_measurements or
--     case_core, so whatever those tables already recorded while the flag
--     was on remains untouched.
--   CW-DOD-J4 (14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md:361) —
--     "No additive schema is destructively rolled back after data exists" ->
--     this file is CREATE TABLE/INDEX IF NOT EXISTS only; no ALTER, no DROP,
--     against any pre-existing table, and rollbackFlag() is a data-level
--     UPDATE, never a schema rollback.
--   CW-DOD-J5 (14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md:362) —
--     "Unmapped legacy records remain quarantined with reason and recovery
--     path" -> case_workspace_legacy_quarantine's
--     quarantine_reason_code/quarantine_reason_detail/recovery_path_ref are
--     all NOT NULL and service-validated non-blank in
--     recordQuarantinedLegacyRecord() (migrationReadinessService.ts) — a
--     legacy record can never be quarantined without both a reason and a
--     recovery pointer.
--   CW-DOD-J6 (14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md:363) —
--     "Legacy execution retirement prerequisites are all current and
--     evidenced" -> countQuarantinedByReasonCode()/
--     listQuarantinedLegacyRecordsForRehearsalRun() (service) give a
--     retirement-readiness reviewer the queryable evidence summary this
--     table durably holds; this packet supplies the evidence store, not the
--     readiness judgment itself.
--   CW-00-020-INV14 (00_CASE_WORKSPACE_CANON.md:109) — "Legacy AgentPlan may
--     be an adapter, never a second authoritative runtime" -> this migration
--     does not create or touch any AgentPlan execution table; the flag
--     hierarchy and quarantine ledger are the durable evidence a future
--     AgentPlan-adapter packet would gate/report against, not the adapter
--     itself.
--
-- Style follows 20260809_case_workspace_history_value.sql and every prior
-- CW-P01-10 migration exactly: TEXT ids, CHECK-constrained enum columns
-- where curated (rollout_percentage's numeric range), deliberately open
-- non-CHECK TEXT columns where the design calls for an open catalog (cohort,
-- quarantine_reason_code — same rationale as case_workspace_history_events.
-- event_type), TEXT timestamps (app-level writes always pass
-- `new Date().toISOString()`; `DEFAULT CURRENT_TIMESTAMP` below is a
-- schema-level fallback only, never relied upon by the service), BOOLEAN
-- columns (matching this directory's own convention, e.g.
-- case_workspace_artifact_links.is_stale — a deliberate departure from
-- v8_feature_flags.enabled's INTEGER 0/1 shape), CREATE TABLE/INDEX IF NOT
-- EXISTS throughout so this file is idempotent and safe to re-run.

CREATE TABLE IF NOT EXISTS case_workspace_feature_flag_definitions (
  -- Namespaced, dotted flag identifier, e.g.
  -- 'case_workspace.mutation.plan_publish'. Open catalog, not a DB CHECK
  -- enum — new flags are new rows here, never a migration (unlike v8's own
  -- fixed V8_MODULES CHECK-shaped enum).
  flag_key TEXT PRIMARY KEY,

  -- Self-referencing hierarchy edge. NULL = root flag.
  -- findSmallestEnabledDescendant() (service) walks this via
  -- WITH RECURSIVE. General cycle-freedom cannot be expressed as a Postgres
  -- CHECK constraint, so it is service-enforced at registerFlagDefinition()
  -- time (ancestor walk) — the CHECK below only blocks the trivial 1-cycle
  -- (a flag naming itself as its own parent).
  parent_flag_key TEXT
    REFERENCES case_workspace_feature_flag_definitions(flag_key),
  CONSTRAINT case_workspace_feature_flag_definitions_no_self_parent
    CHECK (parent_flag_key IS NULL OR parent_flag_key <> flag_key),

  -- Human-readable purpose of the flag, for operator/runbook display.
  description TEXT NOT NULL,

  -- CW-DOD-J1, structural: this column can never carry TRUE in any row.
  -- registerFlagDefinition()'s own input type (service) does not even accept
  -- a value for it, so no caller can ask for a flag that defaults ON; this
  -- CHECK is the second, schema-level line of enforcement.
  default_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT case_workspace_feature_flag_definitions_default_off
    CHECK (default_enabled = FALSE),

  -- Registration time.
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Actor/system token that registered the definition.
  created_by TEXT NOT NULL
);

-- Direct-children lookups (listFlagChildren) and the anchor for
-- WITH RECURSIVE subtree walks (listFlagDescendants,
-- findSmallestEnabledDescendant).
CREATE INDEX IF NOT EXISTS idx_case_workspace_feature_flag_definitions_parent
  ON case_workspace_feature_flag_definitions (parent_flag_key);

CREATE TABLE IF NOT EXISTS case_workspace_feature_flags (
  -- Own row identity, minted `cwff-${uuid}`.
  flag_id TEXT PRIMARY KEY,

  -- Tenant scope, plain caller-supplied value. Deliberately NOT verified
  -- against `organizations` — same posture as
  -- case_workspace_history_events.organization_id (CW-P07).
  organization_id TEXT NOT NULL,

  -- Which flag this state row is for. Real FK (unlike v8_feature_flags'
  -- CHECK-enum module column) — a flag not yet registered in the
  -- definitions table above cannot get a state row at all. No ON DELETE
  -- clause (defaults to RESTRICT/NO ACTION), mirroring this directory's own
  -- posture toward its other FK-only reference columns.
  flag_key TEXT NOT NULL
    REFERENCES case_workspace_feature_flag_definitions(flag_key),

  -- Org-level master switch. A (organization_id, flag_key) pair with no row
  -- at all is always read as disabled by getCurrentOrgFlagState()
  -- (service) — no environment-dependent implicit-enable fallback exists
  -- here (CW-DOD-J1; deliberate deviation from
  -- featureFlagService.isV8Enabled()/isV8ShadowMode()'s non-production
  -- zero-rows-means-enabled escape hatch).
  enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Open text rollout-wave label (e.g. 'internal', 'beta', 'ga') —
  -- documented as a TS catalog in migrationReadinessService.ts, not a DB
  -- CHECK enum, so a new wave name never needs a migration. Backs
  -- CW-DOD-J2's "internal cohort passes before broader enablement" via
  -- listCurrentOrgFlags()'s optional cohort filter.
  cohort TEXT,

  -- Deterministic percentage of in-org entities (cases/actors) that get the
  -- flag once enabled=true, evaluated by the pure
  -- isFlagEnabledForEntity() helper (service) via a stable hash of
  -- entityId. Curated numeric range, hence a real CHECK (unlike cohort's
  -- open catalog).
  rollout_percentage INTEGER NOT NULL DEFAULT 0
    CHECK (rollout_percentage BETWEEN 0 AND 100),

  -- JSON array of explicit entity ids (case_id/actor_id, caller-defined)
  -- force-included regardless of rollout_percentage — the explicit
  -- allow-list mechanism this packet's task requires, e.g. for
  -- internal-cohort canary cases. App-level writes always
  -- JSON.stringify a plain array.
  allow_list_json TEXT NOT NULL DEFAULT '[]',

  -- Last state-change time, updated on every UPSERT
  -- (setOrgFlagState()/rollbackFlag() in the service).
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Actor/system token that made the last change — same thin accountability
  -- trail as v8_feature_flags.updated_by.
  updated_by TEXT,

  CONSTRAINT case_workspace_feature_flags_org_flag_unique
    UNIQUE (organization_id, flag_key)
);

-- Primary read path: every flag state row an org has (listCurrentOrgFlags).
CREATE INDEX IF NOT EXISTS idx_case_workspace_feature_flags_org
  ON case_workspace_feature_flags (organization_id);

-- Cohort-scoped rollout checks (CW-DOD-J2: "internal cohort passes before
-- broader enablement").
CREATE INDEX IF NOT EXISTS idx_case_workspace_feature_flags_org_cohort
  ON case_workspace_feature_flags (organization_id, cohort);

-- Reverse lookup: every org currently holding a state row for one flag_key
-- (used by findSmallestEnabledDescendant()'s per-node state reads).
CREATE INDEX IF NOT EXISTS idx_case_workspace_feature_flags_flag_key
  ON case_workspace_feature_flags (flag_key);

CREATE TABLE IF NOT EXISTS case_workspace_legacy_quarantine (
  -- Own row identity, minted `cwlq-${uuid}`.
  quarantine_id TEXT PRIMARY KEY,

  -- Tenant scope, caller-supplied, not verified — mirrors
  -- case_workspace_history_events.organization_id's posture (CW-P07). This
  -- table never reads or locks case_core.
  organization_id TEXT NOT NULL,

  -- Correlates every quarantine row produced by one migration-rehearsal
  -- execution, for per-run reporting
  -- (listQuarantinedLegacyRecordsForRehearsalRun,
  -- countQuarantinedByReasonCode — service).
  rehearsal_run_id TEXT NOT NULL,

  -- Which legacy system/runtime the record came from (e.g.
  -- 'legacy_agent_plan'). Open text, not a fixed enum, so a new legacy
  -- source never needs a migration.
  source_system TEXT NOT NULL,

  -- The legacy DB table the unmapped record lives in.
  source_table TEXT NOT NULL,

  -- The legacy record's own PK value, opaque string.
  source_id TEXT NOT NULL,

  -- Best-guess target case_id the rehearsal considered and rejected, if
  -- any. Deliberately NO FK into case_core — mirrors
  -- case_workspace_history_events.case_id's FK-less rationale for the
  -- identical reason: this row's whole purpose is recording a mapping that
  -- could NOT be established, so an FK would be self-contradictory (some
  -- rows will have no candidate at all).
  attempted_case_id TEXT,

  -- Short machine-readable reason (e.g. NO_CASE_MATCH, AMBIGUOUS_MATCH,
  -- MISSING_ORG_SCOPE, SCHEMA_MISMATCH, DUPLICATE_CANDIDATE) — documented
  -- TS catalog (KnownQuarantineReasonCode in
  -- migrationReadinessService.ts), not a DB CHECK list, mirroring
  -- event_type's open-catalog convention in caseHistoryService.ts. Required
  -- non-blank (CW-DOD-J5's "reason").
  quarantine_reason_code TEXT NOT NULL,

  -- Free-text explanation of the specific mismatch found for this row.
  -- Required non-blank (CW-DOD-J5's "reason").
  quarantine_reason_detail TEXT NOT NULL,

  -- Pointer to how a human can manually reconcile this record (runbook
  -- section, ticket id, doc URL). Required non-blank — CW-DOD-J5's
  -- "recovery path"; a record can never be quarantined without one.
  recovery_path_ref TEXT NOT NULL,

  -- JSON snapshot of the legacy record's key fields at quarantine time, so
  -- its content survives even if the legacy source row is later
  -- deleted/migrated away — same provenance-not-silently-removed rationale
  -- as CW-03-017 (case_workspace_history_events.source_table/source_id).
  -- App-level writes always JSON.stringify a plain object.
  source_record_snapshot TEXT NOT NULL DEFAULT '{}',

  -- Business time the rehearsal actually found this record unmappable.
  detected_at TEXT NOT NULL,

  -- Append time — immutable proof-of-append, never updated after insert. No
  -- method in migrationReadinessService.ts issues UPDATE/DELETE against
  -- this table at all — the identical structural append-only-by-omission
  -- convention case_workspace_history_events uses in caseHistoryService.ts.
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Optional idempotent-insert key so a re-run rehearsal against the same
  -- legacy row doesn't duplicate quarantine entries.
  -- recordQuarantinedLegacyRecord() (service) uses
  -- `INSERT ... ON CONFLICT (dedupe_key) DO NOTHING RETURNING *`, then
  -- re-SELECTs by dedupe_key on 0 rows — same idempotent-replay convention
  -- as caseHistoryService.insertHistoryEvent(). NULL values never collide
  -- (standard SQL UNIQUE semantics).
  dedupe_key TEXT,

  CONSTRAINT case_workspace_legacy_quarantine_dedupe_key_unique
    UNIQUE (dedupe_key)
);

-- Primary read path: the full quarantine report for one migration-rehearsal
-- execution (listQuarantinedLegacyRecordsForRehearsalRun), ordered by
-- recorded_at.
CREATE INDEX IF NOT EXISTS idx_case_workspace_legacy_quarantine_run
  ON case_workspace_legacy_quarantine (rehearsal_run_id, recorded_at);

-- Every quarantine attempt ever logged against one specific legacy row,
-- across however many rehearsal runs found it unmappable
-- (listQuarantinedLegacyRecordsForSource).
CREATE INDEX IF NOT EXISTS idx_case_workspace_legacy_quarantine_source
  ON case_workspace_legacy_quarantine (source_table, source_id);

-- Per-run reason-code evidence summary (countQuarantinedByReasonCode,
-- CW-DOD-J6).
CREATE INDEX IF NOT EXISTS idx_case_workspace_legacy_quarantine_run_reason
  ON case_workspace_legacy_quarantine (rehearsal_run_id, quarantine_reason_code);

-- Org-scoped listing.
CREATE INDEX IF NOT EXISTS idx_case_workspace_legacy_quarantine_org
  ON case_workspace_legacy_quarantine (organization_id);
