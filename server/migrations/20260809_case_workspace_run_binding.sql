-- CW-P04 (Case Workspace, EPIC E4 "V8 Run, NodeRun and recovery") — one new
-- link table: `case_workspace_run_bindings`.
--
-- Collision-avoidance (same mandate as CW-P01's
-- 20260809_case_workspace_case_core.sql, CW-P02's
-- 20260809_case_workspace_case_plan_version.sql and CW-P03's
-- 20260809_case_workspace_capability_registry.sql): docs/product/
-- case-workspace/acceptance/CODEBASE_CONVERGENCE_MAP.csv (area=v8-runtime)
-- records that the V8 execution runtime substrate ALREADY EXISTS and is KEEP,
-- not CREATE:
--   - `v8_execution_runs` (server/migrations/
--     20260323_v8_execution_spine_00base.sql) is the existing Run entity.
--     Its own `plan_version` INTEGER column is a NAMING TRAP from the
--     OLD/legacy AgentPlan-style system and has NOTHING to do with CW-P02's
--     `case_plan_versions` table — this migration never touches that column.
--   - `v8_agent_work_graphs`/`v8_agent_branch_tasks` (server/migrations/
--     20260807_v8_multi_agent_work_manager.sql) already implement the
--     NodeRun concept.
-- This migration does NOT alter `v8_execution_runs`,
-- `v8_agent_work_graphs`/`v8_agent_branch_tasks`, `case_plan_versions`, or
-- `case_core` in any way (no ALTER TABLE, no new column on any of them —
-- they are read-only referenced, never altered). It only adds one new table,
-- namespaced `case_workspace_*` per the coordinator's mandate, FK-only
-- against `v8_execution_runs(run_id)`, `case_plan_versions
-- (case_plan_version_id)` and `case_core(case_id)`.
--
-- Ground truth for the columns below (docs/product/case-workspace/
-- acceptance/FUNCTIONAL_REQUIREMENT_COVERAGE.csv, epics column contains
-- "E4"):
--   CW-00-020-INV6 (00_CASE_WORKSPACE_CANON.md:101) — Invariant 6: every Run
--     is bound to an exact plan version and semantic digest -> `run_id` is
--     this table's PRIMARY KEY (not a synthetic binding id), mirroring the
--     existing `v8_agent_run_identities.canonical_run_id TEXT PRIMARY KEY
--     REFERENCES v8_execution_runs(run_id)` precedent (server/migrations/
--     20260807_v8_agent_run_identity.sql). This is what mechanically
--     enforces "one run_id binds to at most one case_plan_version_id, ever"
--     — a second bind attempt for the same run_id fails on a PK violation,
--     not a service-level check, and there is no UPDATE path in
--     runBindingService.ts that could ever loosen it.
--   CW-01-011 / CW-01-011-U1 (01_PRODUCT_CANON_AND_MODES.md:88) — Plan
--     Version is an immutable approved definition; every Run names the exact
--     version -> `case_plan_version_id` is FK-only into `case_plan_versions`
--     (CW-P02's own table, read-only referenced here, never altered); the
--     service layer requires that row's status to be PUBLISHED at bind time.
--   CW-01-012 (01_PRODUCT_CANON_AND_MODES.md:89) — Run is one execution of
--     one version; runtime state never overwrites the definition ->
--     `graph_digest` is copied in verbatim at bind time, never a live join
--     back to case_plan_versions.graph_digest, so a later replan of the same
--     case can never retroactively change what an already-bound Run is
--     proven to have run against.
--   CW-RT-013 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:71) — One Case may
--     contain many Runs; one Run belongs to exactly one Case -> `case_id`
--     NOT NULL, FK-only into `case_core` (CW-P01's own table), denormalized
--     from the resolved plan version's own case_id (verified equal by the
--     service before INSERT, not by a DB constraint — see
--     runBindingService.ts) so listRunBindingsForCase can query this table
--     directly without joining through case_plan_versions.
--   CW-RT-017 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:98) — starting a Run
--     freezes the exact CasePlanVersion; replanning creates a new version
--     and never mutates a running version -> no UPDATE path exists anywhere
--     against this table once a row is INSERTed.
--   CW-RT-018 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:104) — Run schema
--     lists runId/organizationId/caseId/casePlanVersionId/graphDigest among
--     its fields; this table is the binding half of that schema this packet
--     is scoped to build (organization_id/case_id/case_plan_version_id/
--     graph_digest), not a duplicate of v8_execution_runs itself. Run
--     schema's own `correlationId` belongs on v8_execution_runs (out of
--     scope, no ALTER permitted) — not duplicated here.
--   CW-02-011 / CW-02-024 (02_INFORMATION_ARCHITECTURE_AND_UX.md:82,199) —
--     Definition records and individual Runs must never be silently mixed;
--     default Run view enumerates a Case's Runs -> listRunBindingsForCase
--     feeds that enumeration without joining v8_execution_runs itself
--     (callers combine this list with v8_execution_runs reads themselves).
--
-- `organization_id` is a defensive denormalized copy of case_core's own
-- organization_id, cross-checked equal to the resolved v8_execution_runs
-- row's own organization_id by the service before INSERT (not a DB
-- constraint — v8_execution_runs is read-only referenced, never altered, so
-- no composite FK against it is added). Supports tenant-scoped queries
-- without joining v8_execution_runs.
--
-- Style follows 20260809_case_workspace_case_core.sql,
-- 20260809_case_workspace_case_plan_version.sql and
-- 20260809_case_workspace_capability_registry.sql exactly: TEXT ids,
-- CHECK-constrained enum columns (none needed here), TEXT timestamps via
-- CURRENT_TIMESTAMP, CREATE TABLE/INDEX IF NOT EXISTS throughout so this
-- file is idempotent and safe to re-run.

CREATE TABLE IF NOT EXISTS case_workspace_run_bindings (
  -- The exact Run this binding proves. Using the natural v8 run id directly
  -- as PRIMARY KEY (not a synthetic binding_id) is what mechanically
  -- enforces CW-00-020-INV6's "one run_id binds to at most one
  -- case_plan_version_id, ever" — a racing second bindRunToPlanVersion call
  -- for the same run_id fails on this PK, surfaced by the service as the
  -- domain error 'run_already_bound', never a silent overwrite. No ON DELETE
  -- clause (defaults to RESTRICT/NO ACTION) — v8_execution_runs is read-only
  -- referenced, never altered, per this packet's mandate.
  run_id TEXT PRIMARY KEY
    REFERENCES v8_execution_runs(run_id),

  -- The exact, immutable, PUBLISHED plan version this Run was started
  -- against (CW-01-011). No ON DELETE clause (defaults to RESTRICT/NO
  -- ACTION) — a plan version once bound to a Run cannot be deleted out from
  -- under it, and since case_plan_versions.case_id itself cascades from
  -- case_core, this also transitively blocks hard-deleting a Case with real
  -- Run history. Set once at INSERT, never UPDATEd — no update method exists
  -- in runBindingService.ts.
  case_plan_version_id TEXT NOT NULL
    REFERENCES case_plan_versions(case_plan_version_id),

  -- Denormalized copy of the resolved case_plan_versions row's own case_id,
  -- verified equal by the service (not a DB constraint — no composite
  -- unique/FK is added to case_plan_versions to avoid altering CW-P02's
  -- table) before INSERT. CW-RT-013.
  case_id TEXT NOT NULL
    REFERENCES case_core(case_id),

  -- Denormalized copy of case_core.organization_id, cross-checked equal to
  -- the resolved v8_execution_runs.organization_id by the service before
  -- INSERT (defensive tenant-isolation guard). Supports tenant-scoped
  -- queries without joining v8_execution_runs.
  organization_id TEXT NOT NULL,

  -- `sha256:<hex>` digest, COPIED VERBATIM from case_plan_versions.
  -- graph_digest at the exact instant of binding — never a live join, never
  -- recomputed, never re-read from case_plan_versions afterward. This is the
  -- column that makes CW-00-020-INV6 / CW-01-012 a permanent fact about the
  -- Run rather than a mutable pointer: even though case_plan_versions rows
  -- are already immutable once PUBLISHED (CW-P02), this copy means the
  -- binding's proof does not even depend on that upstream immutability
  -- holding forever.
  graph_digest TEXT NOT NULL,

  -- Actor who performed the bind. This packet does not touch
  -- v8_execution_runs.state itself — the future orchestration packet that
  -- actually drives the Run's state machine decides when to call
  -- bindRunToPlanVersion; this column only records who/what invoked this
  -- service's own INSERT.
  bound_by_actor_id TEXT NOT NULL,

  -- The only timestamp on this table — no updated_at column exists because
  -- the row is never updated after creation (immutability is structural, not
  -- just documented convention).
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CW-02-011/CW-02-024: enumerate a Case's Runs without joining
-- v8_execution_runs itself.
CREATE INDEX IF NOT EXISTS idx_case_workspace_run_bindings_case_id
  ON case_workspace_run_bindings (case_id);

-- Reverse direction of CW-00-020-INV6: "which Runs actually executed against
-- exactly this published version" — plan-version audit/diff tooling.
CREATE INDEX IF NOT EXISTS idx_case_workspace_run_bindings_case_plan_version_id
  ON case_workspace_run_bindings (case_plan_version_id);

-- Tenant-scoped queries without joining v8_execution_runs.
CREATE INDEX IF NOT EXISTS idx_case_workspace_run_bindings_organization_id
  ON case_workspace_run_bindings (organization_id);
