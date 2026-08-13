-- CW-P06 (Case Workspace, EPIC E5 "Durable waits and events") — one new
-- table: `case_workspace_waits`.
--
-- Collision-avoidance (same mandate as CW-P01's
-- 20260809_case_workspace_case_core.sql, CW-P02's
-- 20260809_case_workspace_case_plan_version.sql, CW-P03's
-- 20260809_case_workspace_capability_registry.sql, CW-P04's
-- 20260809_case_workspace_run_binding.sql and CW-P05's
-- 20260809_case_workspace_proposals_approvals.sql): this migration does NOT
-- alter `case_core`, `case_workspace_run_bindings` or
-- `case_workspace_action_proposals` in any way (no ALTER TABLE, no new
-- column on any of them — they are read-only referenced via FK-only, never
-- altered), and does not reference Finance or Results tables/routes at all.
-- It only adds one new table, namespaced `case_workspace_*` per the
-- coordinator's mandate.
--
-- `artifact_lineage_operation_claims` (MAT-010's own table, backing
-- server/src/services/lineage/operationClaimService.ts — see
-- server/migrations/20260802c_mat010_operation_claims_table.sql) is NEVER
-- read or written by this migration or by waitSubscriptionService.ts. It is
-- a READ-ONLY PATTERN REFERENCE ONLY: operationClaimService.ts's exact
-- atomic claiming SQL idiom (owner_token + monotonic fencing_token +
-- Postgres-clock lease_expires_at, single conditional UPDATE guarded by
-- `state='active' AND lease_expires_at < NOW()`, CAS finalize guarded by
-- `owner_token=$x AND fencing_token=$y AND state='active'`) is reused
-- verbatim as SQL shape on this packet's OWN three lease columns
-- (claim_owner_token/claim_fencing_token/claim_lease_expires_at) below — the
-- two tables share nothing else, not a foreign key, not a view, not a
-- runtime import beyond the doc-comment citation.
--
-- Scope note: this packet persists the WaitSubscription aggregate and its
-- own create/claim/resolve/cancel state machine for HUMAN and TIMER wait
-- types only. DOMAIN_EVENT and EXTERNAL_CALLBACK are valid `wait_type`
-- CHECK values (CW-RT-020's literal enum, verbatim) with a resolve() path
-- only — their real subscription/authentication/dedupe mechanics need a
-- future event-bus/inbox packet (CW-CANON-12) this packet does not build.
--
-- Ground truth for the columns below (docs/product/case-workspace/
-- acceptance/FUNCTIONAL_REQUIREMENT_COVERAGE.csv, epics column contains
-- "E5"; ignore the AEV8-* rows also tagged E5, those describe the
-- pre-existing V8 authority contract, not new work for this packet):
--   CW-RT-020 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md) — WaitSubscription
--     schema (waitId, organizationId, projectId?, caseId, runId, nodeRunId,
--     waitType HUMAN|TIMER|DOMAIN_EVENT|EXTERNAL_CALLBACK, status
--     ACTIVE|SATISFIED|EXPIRED|CANCELLED, correlationKey,
--     expectedEventType?, predicateRef?, dueAt?, timeoutAt?,
--     resumeTokenHash?, satisfiedAt?, satisfiedByEventId?, createdAt) -> the
--     table below, field for field, plus three packet-added lease columns
--     (see below) and one packet-added FK (action_proposal_id, not part of
--     CW-RT-020's literal schema — added per this packet's own task scope
--     to let a wait gate a specific ActionProposal).
--   CW-RT-021 — timer waits use indexed columns, leases and atomic
--     claiming; they do NOT reuse approval state and do NOT write
--     approved_by=system:scheduler -> `claim_owner_token`/
--     `claim_fencing_token`/`claim_lease_expires_at` plus the
--     (wait_type, status, due_at) index below satisfy "leases and atomic
--     claiming"; NO approved_by/decided_by-shaped column exists anywhere on
--     this table, so "do not reuse approval state" is structurally
--     impossible, not merely policed by the service layer.
--   CW-RT-052 / CW-CANON-11 — waits survive browser/process/worker restart;
--     timer state is not approval state -> every field needed to resume a
--     wait (status, due_at, timeout_at, the lease columns) lives in this
--     durable table, never in process memory; no column here is named or
--     shaped like an approval-decision field.
--   CW-DOD-E6 — human/external waits never look like infinite AI
--     computation (i.e. the schema must make it possible to distinguish
--     "waiting on X" from "actively computing") -> `status='ACTIVE'` plus
--     `wait_type`/`due_at`/`timeout_at` give a caller everything needed to
--     render "waiting on <type> until <deadline>" instead of a spinner; see
--     computeWaitOverdueState() in the service, a pure read-time overlay.
--   CW-02-029 — a step card must show wait start, expected signal,
--     deadline/SLA and a permitted "cancel" action -> created_at (start),
--     wait_type/expected_event_type (expected signal), due_at/timeout_at
--     (deadline/SLA), cancelWait() in the service (the "cancel" action).
--   CW-GR-026 — GET /api/runs/:runId/waits -> idx_case_workspace_waits_run_id
--     below, listWaitsForRun() in the service.
--
-- Style follows 20260809_case_workspace_case_core.sql,
-- 20260809_case_workspace_case_plan_version.sql,
-- 20260809_case_workspace_capability_registry.sql,
-- 20260809_case_workspace_run_binding.sql and
-- 20260809_case_workspace_proposals_approvals.sql exactly: TEXT ids,
-- CHECK-constrained enum columns, TEXT timestamps (app-level writes always
-- pass `new Date().toISOString()`; `DEFAULT CURRENT_TIMESTAMP` below is a
-- schema-level fallback only, never relied upon by the service), CREATE
-- TABLE/INDEX IF NOT EXISTS throughout so this file is idempotent and safe
-- to re-run.

CREATE TABLE IF NOT EXISTS case_workspace_waits (
  -- Own row identity, minted `cwwait-${uuid}`.
  wait_id TEXT PRIMARY KEY,

  -- CW-RT-020 organizationId. Denormalized from case_core.organization_id
  -- at create, service-verified, never independently mutated (no UPDATE
  -- method against this table touches it).
  organization_id TEXT NOT NULL,

  -- CW-RT-020's optional projectId? — denormalized from case_core.project_id
  -- at create.
  project_id TEXT,

  -- The owning Case. FK-only into CW-P01's own table, read-only referenced,
  -- never altered. No ON DELETE clause (defaults to RESTRICT/NO ACTION) —
  -- mirrors run_bindings'/proposals' own posture toward case_core.
  case_id TEXT NOT NULL
    REFERENCES case_core(case_id),

  -- CW-RT-020 lists runId as required, but this packet's own scope makes it
  -- OPTIONAL: a wait can exist before a Run is bound (e.g. a Case-level
  -- HUMAN wait gating a decision that itself precedes execution). FK-only
  -- into CW-P04's own binding table (which already carries case_id/
  -- organization_id), never altered here. No ON DELETE clause.
  run_id TEXT
    REFERENCES case_workspace_run_bindings(run_id),

  -- CW-RT-020's nodeRunId. Opaque, UNENFORCED TEXT — deliberately no FK,
  -- same posture as case_workspace_action_proposals.node_run_id (CW-P05).
  -- Nullable here to stay consistent with run_id's own optionality above
  -- (see waitSubscriptionService.ts open_questions — a NodeRun cannot
  -- logically exist before its owning Run, so this deviates from CW-RT-020's
  -- literal "required" reading pending product confirmation).
  node_run_id TEXT,

  -- Packet-added FK, NOT part of CW-RT-020's literal WaitSubscription schema
  -- — added per this packet's explicit task scope to let a wait gate a
  -- specific ActionProposal (e.g. waiting on an external system before
  -- EXECUTING). FK-only into CW-P05's own table, read-only referenced,
  -- never altered. No ON DELETE clause.
  action_proposal_id TEXT
    REFERENCES case_workspace_action_proposals(action_proposal_id),

  -- CW-RT-020's waitType enum, verbatim. Only HUMAN and TIMER get full
  -- create/claim/resolve/cancel semantics from waitSubscriptionService.ts;
  -- DOMAIN_EVENT/EXTERNAL_CALLBACK are valid values with a resolve() path
  -- only (CW-CANON-12 explicitly deferred — see the service's
  -- open_questions).
  wait_type TEXT NOT NULL
    CHECK (wait_type IN ('HUMAN', 'TIMER', 'DOMAIN_EVENT', 'EXTERNAL_CALLBACK')),

  -- CW-RT-020's status enum, verbatim. ALLOWED_TRANSITIONS (service-level):
  -- ACTIVE -> {SATISFIED, EXPIRED, CANCELLED}; all three are terminal, no
  -- method in waitSubscriptionService.ts transitions out of them.
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SATISFIED', 'EXPIRED', 'CANCELLED')),

  -- CW-RT-020's correlationKey (required, no '?'). Doubles as this packet's
  -- idempotent-create key via the UNIQUE constraint below — WaitSubscription
  -- has no separate idempotencyKey field in canon, unlike ActionProposal
  -- (open_question — same naming/overload pattern CW-P02/P03/P05 already
  -- flagged for other fields).
  correlation_key TEXT NOT NULL,

  -- CW-RT-020's optional expectedEventType? — used by a future DOMAIN_EVENT/
  -- EXTERNAL_CALLBACK matcher, not built by this packet.
  expected_event_type TEXT,

  -- CW-RT-020's optional predicateRef? — opaque pointer to an event-matching
  -- predicate, not rendered/interpreted by this packet.
  predicate_ref TEXT,

  -- CW-RT-020's optional dueAt? — for TIMER, the scheduled fire moment;
  -- drives listDueTimerWaitsForClaim()'s scan and the
  -- (wait_type, status, due_at) index below. Also feeds CW-02-029's "wait
  -- start and expected signal" display.
  due_at TEXT,

  -- CW-RT-020's optional timeoutAt? — the hard deadline after which
  -- expireWait() should fire; feeds computeWaitOverdueState()'s overlay and
  -- CW-02-029's "deadline/SLA" display.
  timeout_at TEXT,

  -- CW-RT-020's optional resumeTokenHash? — caller pre-hashes; this service
  -- never receives or stores a raw resume token (CW-DOD-C3 secrets-never-
  -- in-plain posture, same as payload_digest on case_workspace_action_
  -- proposals).
  resume_token_hash TEXT,

  -- CW-RT-020's optional satisfiedAt?, set only by resolveWait()'s SATISFIED
  -- transition.
  satisfied_at TEXT,

  -- CW-RT-020's optional satisfiedByEventId? — opaque reference to whatever
  -- satisfied the wait (a timer-firing id, an inbound event id, an
  -- input-payload pointer). Never a decided_by/approved_by-shaped actor
  -- field — structurally enforces CW-RT-021's "do not write
  -- approved_by=system:scheduler" by omission (no such column exists on
  -- this table at all).
  satisfied_by_event_id TEXT,

  -- Packet-added, beyond CW-RT-020's literal schema. TIMER-only lease
  -- owner, reusing operationClaimService.ts's owner_token idiom (SQL shape
  -- only — see the header note above; the two tables are never joined).
  -- NULL means never claimed (or the last claim's lease has since expired,
  -- still shown until the next claim attempt overwrites it).
  claim_owner_token TEXT,

  -- Packet-added monotonic fencing counter, incremented
  -- (`claim_fencing_token = claim_fencing_token + 1`) on every successful
  -- claim — reused verbatim from operationClaimService.tryReclaimExpiredClaim's
  -- idiom, adapted to a single-statement claim/reclaim (this row always
  -- pre-exists from createWait(), so there is no separate fresh-INSERT-vs-
  -- reclaim split, unlike operationClaimService's own two-phase acquire).
  claim_fencing_token INTEGER NOT NULL DEFAULT 0,

  -- Packet-added, TIMER-only lease expiry stamped via Postgres
  -- `NOW() + interval`, never the application clock — same idiom as
  -- operationClaimService.ts. Stored as TEXT per this table's own
  -- timestamp convention; comparisons in the service always go through an
  -- explicit `::timestamptz` cast rather than relying on TEXT lexicographic
  -- ordering, since Postgres's own `::text` rendering of a timestamptz is
  -- not the same literal shape as the ISO 8601 strings this service writes
  -- elsewhere via `new Date().toISOString()`.
  claim_lease_expires_at TEXT,

  -- Optimistic-concurrency counter for status transitions — a DISTINCT
  -- concept from claim_fencing_token (lease ownership) and from any future
  -- domain ordinal, mirroring the multi-"version"-concept naming-collision
  -- pattern CW-P02/CW-P03/CW-P05 already flagged.
  version INTEGER NOT NULL DEFAULT 1,

  -- CW-RT-020's createdAt.
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Bumped on every mutating method (create/claim/renew/resolve/expire/
  -- cancel), matching case_workspace_action_proposals' own convention.
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- createWait()'s own idempotency scope: a duplicate RegisterWait dispatch
  -- for the same Case with the same correlation key produces one row,
  -- enforced via `INSERT ... ON CONFLICT (case_id, correlation_key) DO
  -- NOTHING RETURNING *` + a wait_type compare-fallback in the service, same
  -- convention as capabilityRegistryService.ts's recordIdempotencyKeyCheck.
  CONSTRAINT case_workspace_waits_correlation_unique
    UNIQUE (case_id, correlation_key)
);

-- Primary read path: enumerate a Case's waits (listWaitsForCase).
CREATE INDEX IF NOT EXISTS idx_case_workspace_waits_case_id
  ON case_workspace_waits (case_id);

-- GET /api/runs/:runId/waits (CW-GR-026) — listWaitsForRun.
CREATE INDEX IF NOT EXISTS idx_case_workspace_waits_run_id
  ON case_workspace_waits (run_id);

-- ActionProposal-scoped lookups (a wait gating a specific proposal).
CREATE INDEX IF NOT EXISTS idx_case_workspace_waits_action_proposal_id
  ON case_workspace_waits (action_proposal_id);

-- CW-RT-021's "timer waits use indexed columns" — the exact scan shape
-- listDueTimerWaitsForClaim() issues (wait_type='TIMER' AND status='ACTIVE'
-- AND due_at <= now, ordered by due_at).
CREATE INDEX IF NOT EXISTS idx_case_workspace_waits_timer_due
  ON case_workspace_waits (wait_type, status, due_at);
