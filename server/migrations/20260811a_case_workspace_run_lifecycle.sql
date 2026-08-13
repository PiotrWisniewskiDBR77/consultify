-- Case Workspace — CANONICAL Run lifecycle aggregate (Stream A, "KANONICZNY
-- RUNTIME RUN/NODERUN").
--
-- Ground truth:
--   docs/product/case-workspace/04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md
--     §3.4 (Run schema, verbatim: "Run { runId, organizationId, projectId?,
--     caseId, casePlanVersionId, graphDigest, status, initiatedBy,
--     correlationId, version, createdAt, startedAt?, completedAt? }"),
--     §4.4 (Run state machine, verbatim), §5 (durable Run command set:
--     CreateRun/StartRun/PauseRun/ResumeRun/CancelRun/RetryNode/
--     CompensateAction), §6 invariant 3 ("One execution has one authoritative
--     V8 Run") and invariant 4 ("A Run always points to one immutable plan
--     version and graph digest").
--
-- ===========================================================================
-- WHY THIS TABLE EXISTS — THE GAP THIS PACKET CLOSES
-- ===========================================================================
-- `case_workspace_run_bindings` (20260809_case_workspace_run_binding.sql)
-- proves an exact (run_id, casePlanVersionId) pairing, but is STRUCTURALLY
-- IMMUTABLE — its own header says so explicitly: "no UPDATE path exists
-- anywhere against this table once a row is INSERTed" — and it carries no
-- `status`, no `outcomeStatus`, no OCC `version`. §4.4's Run state machine
-- (CREATED -> VALIDATING -> QUEUED -> RUNNING, RUNNING <-> PAUSED, RUNNING ->
-- WAITING | BLOCKED | RETRY_SCHEDULED -> RUNNING, RUNNING ->
-- COMPLETED | COMPLETED_WITH_WARNINGS | FAILED | CANCELLED, RUNNING |
-- CANCELLED -> COMPENSATING -> COMPENSATED | FAILED) has nowhere to live.
-- `v8_execution_runs` (KEEP, not owned by this program — see
-- 20260809_case_workspace_run_binding.sql's own header) uses a DIFFERENT,
-- older state vocabulary (`drafting`, `approved_for_apply`, `applying`, …)
-- for the legacy AgentPlan-style engine and is never alterable here (same
-- collision-avoidance mandate every case_workspace_*.sql migration in this
-- program already follows). This table is the case-workspace domain's OWN
-- Run aggregate — the "one authoritative V8 Run" (§6 invariant 3) remains
-- exactly one `v8_execution_runs` row per Run; this table is the domain
-- status/lifecycle projection runLifecycleService.ts owns and mutates, bound
-- 1:1 to that same v8_execution_runs row via the existing
-- case_workspace_run_bindings FK chain (this table's own `run_id` IS that
-- binding's `run_id`, not a new identity).
--
-- ===========================================================================
-- FOREIGN KEYS — WHERE THEY ARE, AND WHERE THEY DELIBERATELY ARE NOT
-- ===========================================================================
-- `run_id` REFERENCES `case_workspace_run_bindings(run_id)` — a row here can
-- only exist for a Run that is ALREADY bound to an exact PUBLISHED plan
-- version (CW-00-020-INV6, §6 invariant 4), which
-- runLifecycleService.createRun enforces by calling
-- runBindingService.bindRunToPlanVersion BEFORE inserting here, never after.
-- `case_id` / `case_plan_version_id` are real FKs into CW-P01's/CW-P02's own
-- tables (read-only referenced, never altered here). No FK into
-- `v8_execution_runs` directly — it is reached transitively through
-- `case_workspace_run_bindings`, matching that table's own documented
-- posture, and no FK into `case_workspace_node_runs` (this migration
-- predates no node run for a Run that has not yet StartRun'd, and NodeRun
-- rows reference `case_workspace_run_bindings(run_id)` themselves already).
--
-- ===========================================================================
-- WHY `graph_digest` / `case_plan_version_id` ARE DENORMALIZED HERE TOO
-- ===========================================================================
-- `case_workspace_run_bindings` already carries both, verbatim, immutable.
-- Copying them here (rather than requiring every Run-status reader to join
-- that table) is the same "copy at bind time, never re-derive" posture that
-- table's own header already established for graph_digest — a status read is
-- the hottest path this table serves (My Work, Case timeline, scheduler), and
-- §3.4 lists both fields directly on the `Run` aggregate itself, not as a
-- join.
--
-- Idempotent and safe to re-run (CREATE TABLE/INDEX IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS case_workspace_runs (
  -- Same identity as the v8_execution_runs row this Run is bound to — see the
  -- header. FK-only into case_workspace_run_bindings, which itself already
  -- FKs into v8_execution_runs; a row here cannot exist before that bind.
  run_id TEXT PRIMARY KEY
    REFERENCES case_workspace_run_bindings(run_id),

  -- §3 tenancy. Denormalized from case_core at create, never independently
  -- mutated (mirrors case_workspace_node_runs.organization_id/.project_id).
  organization_id TEXT NOT NULL,
  project_id TEXT,

  -- One Case may contain many Runs; one Run belongs to exactly one Case
  -- (§3.4, CW-RT-013). FK-only into case_core, never altered here.
  case_id TEXT NOT NULL
    REFERENCES case_core(case_id),

  -- §6 invariant 4: "A Run always points to one immutable plan version and
  -- graph digest." Copied verbatim from case_workspace_run_bindings at
  -- INSERT time (see header) — never a live join, never recomputed.
  case_plan_version_id TEXT NOT NULL
    REFERENCES case_plan_versions(case_plan_version_id),
  graph_digest TEXT NOT NULL,

  -- §4.4's state machine, verbatim plus the explicitly-documented CANCELLED
  -- extensions runLifecycleService.ts's own ALLOWED_TRANSITIONS comment
  -- explains (CancelRun must reach a Run that has not yet started RUNNING
  -- too — §4.4's literal arrow list only shows CANCELLED as a RUNNING-family
  -- exit, which would otherwise make a CREATED/VALIDATING/QUEUED/PAUSED/
  -- WAITING/BLOCKED/RETRY_SCHEDULED Run uncancellable).
  status TEXT NOT NULL DEFAULT 'CREATED'
    CHECK (status IN (
      'CREATED', 'VALIDATING', 'QUEUED', 'RUNNING', 'PAUSED',
      'WAITING', 'BLOCKED', 'RETRY_SCHEDULED',
      'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'CANCELLED',
      'COMPENSATING', 'COMPENSATED'
    )),

  -- §4.4: "Technical completion is separate from outcomeStatus" — the
  -- business-acceptance projection, verbatim enum.
  outcome_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (outcome_status IN (
      'PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'PARTIALLY_ACCEPTED', 'NOT_APPLICABLE'
    )),

  -- §3.4 initiatedBy — actor or system/Teresa identity string that issued
  -- CreateRun. Plain TEXT, same posture as every other *_by_actor_id column
  -- in this program (no FK into users — actor identity is not guaranteed
  -- UUID-shaped, see lightOneClickService.ts's own header for why).
  initiated_by TEXT NOT NULL,

  -- §3.4 correlationId. Nullable — not every caller has one (mirrors
  -- case_workspace_event_outbox.correlation_id being the source of truth for
  -- event-level correlation; this column is the Run-level anchor a caller may
  -- supply at CreateRun time).
  correlation_id TEXT,

  -- CreateRun idempotent-replay identity, scoped to the Case (a Run's
  -- idempotency key only needs to be unique within the Case that spawned it —
  -- the same business intent legitimately recurs across different Cases).
  -- Mirrors case_workspace_node_runs' own (run_id, idempotency_key) UNIQUE
  -- posture and comment.
  idempotency_key TEXT NOT NULL,

  -- OCC guard for every status transition, same convention as
  -- case_workspace_node_runs.version / case_core.version.
  version INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT case_workspace_runs_idempotency_unique
    UNIQUE (case_id, idempotency_key)
);

-- A Case's Runs, newest first — the default Run view (CW-02-011/CW-02-024
-- precedent already established by case_workspace_run_bindings).
CREATE INDEX IF NOT EXISTS idx_case_workspace_runs_case
  ON case_workspace_runs (case_id, created_at DESC);

-- Tenant-scoped queries without joining case_workspace_run_bindings.
CREATE INDEX IF NOT EXISTS idx_case_workspace_runs_org
  ON case_workspace_runs (organization_id);

-- Plan-version audit/diff tooling — "which Runs actually executed against
-- exactly this published version", Run-status-aware complement to
-- case_workspace_run_bindings' own reverse-lookup index.
CREATE INDEX IF NOT EXISTS idx_case_workspace_runs_plan_version
  ON case_workspace_runs (case_plan_version_id);

-- The scheduler/My-Work hot path: active Runs by status. PARTIAL so it holds
-- only the live set, not terminal history.
CREATE INDEX IF NOT EXISTS idx_case_workspace_runs_active
  ON case_workspace_runs (status, updated_at)
  WHERE status NOT IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'CANCELLED', 'COMPENSATED');
