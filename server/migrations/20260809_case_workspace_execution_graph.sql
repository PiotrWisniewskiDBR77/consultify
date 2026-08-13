-- CW-P10 (Case Workspace, EPIC E9 "advanced execution graph") — two new
-- append-only tables: `case_workspace_gateway_evaluations` and
-- `case_workspace_node_result_acceptances`.
--
-- Collision-avoidance (same mandate as CW-P01's
-- 20260809_case_workspace_case_core.sql, CW-P02's
-- 20260809_case_workspace_case_plan_version.sql, CW-P03's
-- 20260809_case_workspace_capability_registry.sql, CW-P04's
-- 20260809_case_workspace_run_binding.sql, CW-P05's
-- 20260809_case_workspace_proposals_approvals.sql and CW-P06's
-- 20260809_case_workspace_wait_subscription.sql): docs/product/
-- case-workspace/acceptance/CODEBASE_CONVERGENCE_MAP.csv (area=v8-runtime)
-- records that `v8_agent_work_graphs`/`v8_agent_branch_tasks` (server/
-- migrations/20260807_v8_multi_agent_work_manager.sql) already implement the
-- NodeRun concept and are KEEP, not CREATE. This migration does NOT alter
-- `v8_execution_runs`, `v8_agent_work_graphs`, `v8_agent_branch_tasks`,
-- `case_core`, `case_workspace_run_bindings`, `case_workspace_action_
-- proposals` or `case_workspace_waits` in any way (no ALTER TABLE, no new
-- column on any of them — they are read-only referenced via FK-only, never
-- altered), and does not reference Finance or Results tables/routes at all.
-- It only adds two new tables, namespaced `case_workspace_*` per the
-- coordinator's mandate, plus one internal cross-reference between the two.
--
-- This packet does not build an execution engine and does not decide what a
-- node does or whether independent branches continue after a failure — it
-- only durably records the deterministic gateway/acceptance FACTS that a
-- future orchestrator (out of scope) will read and act on.
--
-- Ground truth for the columns below (docs/product/case-workspace/
-- acceptance/FUNCTIONAL_REQUIREMENT_COVERAGE.csv, filter epics contains "E9"
-- AND row_id starts with "CW-"):
--   CW-GR-037 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md:269) — "Gateway
--     semantics are deterministic. Parallel join explicitly states ALL | ANY
--     | N_OF_M. A condition is evaluated against a versioned expression
--     schema and cannot access data outside the effective ACL." ->
--     `case_workspace_gateway_evaluations` below: `join_policy` CHECK-
--     restricted to the literal ALL|ANY|N_OF_M enum; `condition_expression`/
--     `condition_schema_version` are DB-CHECK co-required so a condition can
--     never be recorded without its versioned schema pin;
--     `evaluation_input_snapshot`/`evaluation_input_digest` record the exact
--     "versioned/known input" the condition/join was evaluated against. This
--     packet does not itself enforce the effective-ACL restriction on that
--     input (that is an upstream evaluator concern, out of scope) — it only
--     durably records what was evaluated and the deterministic outcome.
--   CW-GR-009 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md:47) — "Supported
--     node types: START, END, CAPABILITY, HUMAN_TASK, APPROVAL, TIMER_WAIT,
--     EVENT_WAIT, DECISION_GATEWAY, PARALLEL_SPLIT, PARALLEL_JOIN, SUBFLOW,
--     ANNOTATION." -> `gateway_node_type` on the gateway-evaluations table is
--     CHECK-restricted to the gateway-shaped subset of this catalog
--     (DECISION_GATEWAY, PARALLEL_SPLIT, PARALLEL_JOIN); `node_type` on the
--     acceptances table reuses the FULL 12-value catalog verbatim, since any
--     node type can complete or be skipped.
--   CW-RT-037 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:260) — "Every
--     completed or skipped node also has a result acceptance projection:
--     ACCEPTED | PARTIAL | REJECTED | NOT_APPLICABLE. SKIPPED maps to
--     NOT_APPLICABLE only when the published graph condition authorizes
--     it." -> `case_workspace_node_result_acceptances` below:
--     `node_completion_state` CHECK-restricted to COMPLETED|SKIPPED (the
--     literal "every completed or skipped node"); `result_acceptance`
--     CHECK-restricted to the literal ACCEPTED|PARTIAL|REJECTED|
--     NOT_APPLICABLE enum; `skip_authorized_by_graph_condition` is DB-CHECK
--     required non-NULL whenever node_completion_state='SKIPPED', so the
--     authorization fact can never be silently omitted for a skip (the
--     service layer additionally hard-rejects an attempt to record
--     NOT_APPLICABLE with this flag explicitly false — see
--     executionGraphService.ts).
--   CW-RT-035 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:256) — "Independent
--     branches may continue only when graph policy says so. Global
--     continue-on-error is not the default." -> satisfied by STRUCTURAL
--     ABSENCE: neither table below has any continue_on_error / global-policy
--     column of any kind, and no column anywhere defaults to a value that
--     implies "keep going". Branch-continuation is left entirely to a future
--     orchestrator reading CasePlanVersion's own per-node executionPolicy
--     (out of this packet's scope) together with these tables' recorded
--     facts — this packet never computes or stores a continuation decision,
--     since it is explicitly not an execution engine.
--
-- Both tables key `run_id` as a read-only FK into
-- `case_workspace_run_bindings(run_id)` (per this packet's explicit keying
-- instruction, matching CW-P06 waits' convention rather than CW-P05
-- proposals' direct-to-v8_execution_runs convention), and carry
-- `node_run_id` as opaque, UNENFORCED TEXT with deliberately no FK — same
-- posture as `case_workspace_action_proposals.node_run_id` /
-- `case_workspace_waits.node_run_id`, since no confirmed canonical NodeRun
-- table exists in this codebase to FK against. `node_run_id` is each table's
-- PRIMARY KEY (not a synthetic id), mirroring
-- `case_workspace_run_bindings.run_id`-as-PK: "one row per node's evaluation/
-- acceptance" is mechanically enforced by the PK — a racing second recording
-- attempt for the same node_run_id fails on this PK, surfaced by the service
-- as either an idempotent replay (identical input digest) or a
-- *_determinism_conflict domain error, never a silent overwrite.
--
-- Neither table has an updated_at or version/OCC column — both are
-- structurally append-only/immutable, matching
-- `case_workspace_run_bindings`'s and `case_workspace_history_events`'s own
-- "no UPDATE path exists" precedent. No method in executionGraphService.ts
-- issues UPDATE or DELETE against either table.
--
-- Style follows 20260809_case_workspace_case_core.sql,
-- 20260809_case_workspace_case_plan_version.sql,
-- 20260809_case_workspace_capability_registry.sql,
-- 20260809_case_workspace_run_binding.sql,
-- 20260809_case_workspace_proposals_approvals.sql and
-- 20260809_case_workspace_wait_subscription.sql exactly: TEXT ids,
-- CHECK-constrained enum columns, TEXT timestamps (app-level writes always
-- pass `new Date().toISOString()`; `DEFAULT CURRENT_TIMESTAMP` below is a
-- schema-level fallback only, never relied upon by the service), CREATE
-- TABLE/INDEX IF NOT EXISTS throughout so this file is idempotent and safe
-- to re-run.

CREATE TABLE IF NOT EXISTS case_workspace_gateway_evaluations (
  -- Opaque node identifier being evaluated. No FK (no confirmed canonical
  -- NodeRun table) — same posture as case_workspace_action_proposals.
  -- node_run_id / case_workspace_waits.node_run_id. Used AS the primary key
  -- so "one row per evaluation" is structurally enforced (INSERT ... ON
  -- CONFLICT (node_run_id) DO NOTHING RETURNING *, digest-compared on
  -- conflict in the service), mirroring
  -- case_workspace_run_bindings.run_id-as-PK.
  node_run_id TEXT PRIMARY KEY,

  -- Denormalized from the resolved case_workspace_run_bindings row at record
  -- time; never independently supplied by the caller.
  organization_id TEXT NOT NULL,

  -- Denormalized optional project scope from the resolved run binding.
  project_id TEXT,

  -- Denormalized from the resolved run binding's own case_id, cross-checked
  -- equal by the service before INSERT — same posture as run_bindings' own
  -- case_id denormalization from case_plan_versions. No ON DELETE clause
  -- (defaults to RESTRICT/NO ACTION) — case_core is read-only referenced,
  -- never altered.
  case_id TEXT NOT NULL
    REFERENCES case_core(case_id),

  -- The exact bound Run this evaluation occurred under. FK-only, read-only
  -- referenced, never altered — per the packet's explicit keying
  -- instruction. No ON DELETE clause.
  run_id TEXT NOT NULL
    REFERENCES case_workspace_run_bindings(run_id),

  -- CW-GR-009's gateway-shaped subset of the full 12-value node type
  -- catalog: only the three node types this table concerns itself with.
  gateway_node_type TEXT NOT NULL
    CHECK (gateway_node_type IN ('DECISION_GATEWAY', 'PARALLEL_SPLIT', 'PARALLEL_JOIN')),

  -- CW-GR-037's literal join-policy enum, verbatim. Service-required iff
  -- gateway_node_type='PARALLEL_JOIN'; the CHECK below structurally forbids
  -- setting it for any other node type.
  join_policy TEXT
    CHECK (join_policy IS NULL OR join_policy IN ('ALL', 'ANY', 'N_OF_M')),
  CONSTRAINT case_workspace_gateway_evaluations_join_policy_node_type
    CHECK (join_policy IS NULL OR gateway_node_type = 'PARALLEL_JOIN'),

  -- The N in N_OF_M (this design's own invented field, not a canon-confirmed
  -- schema — see executionGraphService.ts open_questions). Service-required
  -- iff join_policy='N_OF_M'; the CHECK below forbids setting it otherwise.
  join_required_count INTEGER,
  CONSTRAINT case_workspace_gateway_evaluations_join_required_count_policy
    CHECK (join_required_count IS NULL OR join_policy = 'N_OF_M'),

  -- Total branches feeding this join, recorded for audit/consistency
  -- context (the M against N) — this design's own invented field, same
  -- caveat as join_required_count above.
  join_branch_total_count INTEGER,
  CONSTRAINT case_workspace_gateway_evaluations_join_count_bounds
    CHECK (
      join_required_count IS NULL
      OR join_branch_total_count IS NULL
      OR join_required_count <= join_branch_total_count
    ),

  -- DECISION_GATEWAY's exact evaluated condition expression, opaque/verbatim
  -- (CW-GR-037). Co-required with condition_schema_version by the CHECK
  -- below — never recorded without its version pin.
  condition_expression TEXT,

  -- The versioned expression schema id/version the condition was evaluated
  -- against (CW-GR-037's "versioned expression schema").
  condition_schema_version TEXT,
  CONSTRAINT case_workspace_gateway_evaluations_condition_pair
    CHECK ((condition_expression IS NULL) = (condition_schema_version IS NULL)),

  -- JSON-serialized (JSON.stringify, TEXT column per this directory's own
  -- convention) exact input values the condition/join was evaluated against
  -- — CW-GR-037's "versioned/known input".
  evaluation_input_snapshot TEXT NOT NULL,

  -- `sha256:<hex>` digest of the canonicalized snapshot (same convention as
  -- capabilityRegistryService.computeRequestDigest / casePlanVersionService.
  -- computeGraphDigest) — the determinism/idempotency comparison key on
  -- ON CONFLICT in the service.
  evaluation_input_digest TEXT NOT NULL,

  -- Deterministic outcome category, generic across all three gateway node
  -- types.
  outcome_status TEXT NOT NULL
    CHECK (outcome_status IN (
      'BRANCH_SELECTED', 'SPLIT_ACTIVATED', 'JOIN_SATISFIED',
      'JOIN_PENDING', 'JOIN_UNSATISFIED'
    )),

  -- JSON-serialized outcome specifics (selected edge/branch ids, satisfied/
  -- total branch counts). Opaque shape, not enforced — same posture as
  -- case_workspace_history_events.payload.
  outcome_detail TEXT NOT NULL DEFAULT '{}',

  -- Business time the evaluation actually occurred, caller-supplied
  -- (distinct from recorded_at, mirrors case_workspace_history_events'
  -- occurred_at/recorded_at split for future backfill/replay).
  evaluated_at TEXT NOT NULL,

  -- Immutable proof-of-append time. Never updated after insert — no method
  -- in executionGraphService.ts issues UPDATE against this table at all.
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Who/what invoked this recording (e.g. system:orchestrator or a
  -- human-in-the-loop actor id).
  recorded_by_actor_id TEXT NOT NULL
);

-- Enumerates all gateway evaluations recorded under one bound Run
-- (listGatewayEvaluationsForRun).
CREATE INDEX IF NOT EXISTS idx_case_workspace_gateway_evaluations_run_id
  ON case_workspace_gateway_evaluations (run_id);

-- Enumerates a Case's gateway evaluations across all its Runs
-- (listGatewayEvaluationsForCase).
CREATE INDEX IF NOT EXISTS idx_case_workspace_gateway_evaluations_case_id
  ON case_workspace_gateway_evaluations (case_id);

CREATE TABLE IF NOT EXISTS case_workspace_node_result_acceptances (
  -- Opaque node identifier this acceptance projection is about. No FK, same
  -- posture as case_workspace_action_proposals.node_run_id. PK enforces
  -- "one row per node's acceptance projection" structurally.
  node_run_id TEXT PRIMARY KEY,

  -- Denormalized from the resolved case_workspace_run_bindings row, never
  -- independently supplied.
  organization_id TEXT NOT NULL,

  -- Denormalized optional project scope from the resolved run binding.
  project_id TEXT,

  -- Denormalized from the resolved run binding's own case_id, cross-checked
  -- equal by the service before INSERT. No ON DELETE clause.
  case_id TEXT NOT NULL
    REFERENCES case_core(case_id),

  -- The exact bound Run this node ran under. FK-only, read-only referenced,
  -- never altered. No ON DELETE clause.
  run_id TEXT NOT NULL
    REFERENCES case_workspace_run_bindings(run_id),

  -- Reuses CW-GR-009's full 12-value node type catalog BY REFERENCE,
  -- verbatim — not a duplicated/invented vocabulary, since any node type can
  -- complete or be skipped.
  node_type TEXT NOT NULL
    CHECK (node_type IN (
      'START', 'END', 'CAPABILITY', 'HUMAN_TASK', 'APPROVAL', 'TIMER_WAIT',
      'EVENT_WAIT', 'DECISION_GATEWAY', 'PARALLEL_SPLIT', 'PARALLEL_JOIN',
      'SUBFLOW', 'ANNOTATION'
    )),

  -- CW-RT-037's literal "every completed or skipped node" — which NodeRun
  -- terminal state produced this projection.
  node_completion_state TEXT NOT NULL
    CHECK (node_completion_state IN ('COMPLETED', 'SKIPPED')),

  -- CW-RT-037's literal result-acceptance enum, verbatim.
  result_acceptance TEXT NOT NULL
    CHECK (result_acceptance IN ('ACCEPTED', 'PARTIAL', 'REJECTED', 'NOT_APPLICABLE')),

  -- Records whether the published graph condition actually authorized this
  -- SKIPPED node's NOT_APPLICABLE mapping (CW-RT-037: "SKIPPED maps to
  -- NOT_APPLICABLE only when the published graph condition authorizes it").
  -- The CHECK below forbids leaving this NULL for any skipped node; the
  -- service additionally hard-rejects (throws) an attempt to record
  -- result_acceptance='NOT_APPLICABLE' with this flag explicitly false.
  skip_authorized_by_graph_condition BOOLEAN,
  CONSTRAINT case_workspace_node_result_acceptances_skip_authorization_required
    CHECK (node_completion_state <> 'SKIPPED' OR skip_authorized_by_graph_condition IS NOT NULL),

  -- Opaque pointer into the plan version's published graph condition that
  -- authorized (or would have authorized) the skip — audit-only, not
  -- rendered/interpreted by this packet.
  skip_condition_ref TEXT,

  -- Packet-added, beyond CW-RT-037's literal schema (same "packet-added FK"
  -- pattern as case_workspace_waits.action_proposal_id): optional
  -- traceability link from a skipped downstream node back to the upstream
  -- gateway evaluation whose deterministic outcome routed around it. No ON
  -- DELETE clause.
  caused_by_gateway_node_run_id TEXT
    REFERENCES case_workspace_gateway_evaluations(node_run_id),

  -- JSON-serialized exact evidence/inputs the acceptance value was derived
  -- from — the durable "this deterministic fact was recorded" payload.
  acceptance_input_snapshot TEXT NOT NULL,

  -- `sha256:<hex>` digest of the canonicalized snapshot — determinism/
  -- idempotency comparison key on ON CONFLICT in the service, same
  -- convention as evaluation_input_digest above.
  acceptance_input_digest TEXT NOT NULL,

  -- Business time the node actually completed or was skipped,
  -- caller-supplied.
  occurred_at TEXT NOT NULL,

  -- Immutable proof-of-append time. Never updated after insert.
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Who/what invoked this recording.
  recorded_by_actor_id TEXT NOT NULL
);

-- Enumerates one Run's per-node acceptance facts
-- (listNodeResultAcceptancesForRun).
CREATE INDEX IF NOT EXISTS idx_case_workspace_node_result_acceptances_run_id
  ON case_workspace_node_result_acceptances (run_id);

-- Enumerates a Case's node acceptance facts across all its Runs
-- (listNodeResultAcceptancesForCase).
CREATE INDEX IF NOT EXISTS idx_case_workspace_node_result_acceptances_case_id
  ON case_workspace_node_result_acceptances (case_id);

-- Traceability lookups from an upstream gateway evaluation to the downstream
-- node(s) it routed around.
CREATE INDEX IF NOT EXISTS idx_case_workspace_node_result_acceptances_caused_by_gateway
  ON case_workspace_node_result_acceptances (caused_by_gateway_node_run_id);
