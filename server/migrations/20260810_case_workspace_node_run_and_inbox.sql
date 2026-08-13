-- Case Workspace — CANONICAL NodeRun (+ its attempt ledger) and the INBOUND
-- EVENT INBOX.
--
-- Ground truth:
--   docs/product/case-workspace/04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md
--     §3.4 (Run and NodeRun schema, verbatim), §4.5 (NodeRun state machine,
--     verbatim), "A retry creates an auditable attempt", "Idempotency identity
--     is stable for the intended business effect, not generated afresh on
--     transport retry".
--   docs/product/case-workspace/06_SECURITY_EVENTS_OBSERVABILITY.md §8
--     ("Event consumers deduplicate by eventId"; "Failed outbox/inbox delivery
--     has retry, dead-letter and reconciliation"; "Worker claims use
--     leases/heartbeats. Expired leases are reclaimed only after idempotency or
--     reconciliation checks"; "External effects without provider idempotency
--     require readback reconciliation before retry").
--
-- ===========================================================================
-- WHY THESE THREE TABLES EXIST
-- ===========================================================================
-- 1. `case_workspace_node_runs` — TODAY THERE IS NO NodeRun ROW ANYWHERE.
--    `node_run_id` is an UNENFORCED, FK-less TEXT column on four already-
--    shipped tables (case_workspace_action_proposals,
--    case_workspace_gateway_evaluations, case_workspace_node_result_acceptances,
--    case_workspace_waits) and on case_workspace_event_outbox. Every one of
--    them points at an identity that has never been minted, so the §10
--    correlation chain caseId -> runId -> nodeRunId -> attemptId is broken at
--    its third link and `attemptId` has no producer at all. This table is that
--    missing identity, with the full §4.5 lifecycle, an attempt counter, a
--    lease, a timeout and a compensation record.
--
-- 2. `case_workspace_node_run_attempts` — §3.4's "A retry creates an auditable
--    attempt" is not satisfiable by a counter. An attempt is a row: when it
--    started, which worker held the lease, when it timed out, which stable
--    error code ended it. This is the ONLY producer of `attempt_id` in the
--    program, and it is what the outbox's long-empty `attempt_id` column was
--    always meant to reference.
--
-- 3. `case_workspace_event_inbox` — the outbox (20260810_case_workspace_event_
--    outbox.sql) is OUTBOUND only. Nothing in this program durably receives an
--    external callback. §8 requires that an inbound event be persisted,
--    authenticated, deduplicated by eventId and validated for tenant/
--    correlation BEFORE it may influence a wait. Doing that in the request
--    handler's memory would make "duplicate delivery produces one effect"
--    unprovable across a restart; this table makes it a unique index.
--
-- ===========================================================================
-- FOREIGN KEYS — WHERE THEY ARE, AND WHERE THEY DELIBERATELY ARE NOT
-- ===========================================================================
-- Real FKs are declared to `case_workspace_*` tables (and to `case_core`,
-- which every sibling packet already references): case_id -> case_core,
-- run_id -> case_workspace_run_bindings, wait_id -> case_workspace_waits,
-- action_proposal_id -> case_workspace_action_proposals,
-- capability_registry_id -> case_workspace_capabilities, and
-- attempts.node_run_id -> case_workspace_node_runs. No FK crosses out of the
-- program (no Finance, no Results, no v8_* table) — the same collision-
-- avoidance mandate as every 20260809_case_workspace_*.sql packet. Note that
-- run_id reaches v8_execution_runs only TRANSITIVELY, through
-- case_workspace_run_bindings' own pre-existing FK; this file adds no
-- reference to v8_execution_runs itself.
--
-- WHAT THIS MIGRATION DOES **NOT** DO, ON PURPOSE: it does not ALTER the four
-- shipped tables that carry a loose `node_run_id` to add an FK to the new
-- table. Three independent reasons, all of them blocking:
--   (a) ALTER TABLE on another packet's shipped table is exactly what the
--       collision-avoidance mandate forbids, and one of those tables
--       (case_workspace_action_proposals) is under concurrent edit.
--   (b) Every existing fixture and production caller writes a synthetic
--       node_run_id (`node-run-<tag>`) that has no canonical row; an FK — even
--       `NOT VALID`, which still enforces on new rows — would break them all
--       at once, converting a data-quality gap into an outage.
--   (c) The canonical direction is the opposite one: a NodeRun should be
--       created FIRST and its id handed to the proposal/wait, which is what
--       nodeRunService now makes possible. Retrofitting the constraint is a
--       backfill-then-constrain migration of its own, once the callers are
--       switched over.
-- Until that happens the gap is REPORTED, not hidden:
-- nodeRunService.listOrphanNodeRunReferences() enumerates every row in those
-- four tables whose node_run_id has no canonical NodeRun.
--
-- ===========================================================================
-- TIMESTAMP CONVENTION
-- ===========================================================================
-- The two NodeRun tables store TEXT ISO timestamps, matching every
-- 20260809_case_workspace_*.sql sibling that the service layer reads and
-- writes with `new Date().toISOString()`. The lease/timeout/retry columns are
-- compared through an explicit `::timestamptz` cast in the service (never by
-- TEXT lexicographic ordering), the same idiom case_workspace_waits already
-- uses for claim_lease_expires_at.
-- `case_workspace_event_inbox` follows the OUTBOX's convention instead
-- (TIMESTAMPTZ) for received_at/processed_at, because those are scheduling and
-- lag values read by a dispatcher (`WHERE processed_at IS NULL ORDER BY
-- received_at`, inbox-lag per §10), where `now() - received_at` must mean
-- something.
--
-- Idempotent and safe to re-run (CREATE TABLE/INDEX IF NOT EXISTS).

-- ===========================================================================
-- 1. case_workspace_node_runs — the canonical NodeRun aggregate
-- ===========================================================================
CREATE TABLE IF NOT EXISTS case_workspace_node_runs (
  -- §3.4 nodeRunId. Minted `cwnode-${uuid}` by nodeRunService.createNodeRun.
  node_run_id TEXT PRIMARY KEY,

  -- §3 tenancy: "Every aggregate … carries organizationId". Denormalized from
  -- case_core at create and never independently mutated.
  organization_id TEXT NOT NULL,
  project_id TEXT,

  -- Owning Case. FK-only into CW-P01's table, never altered here.
  case_id TEXT NOT NULL
    REFERENCES case_core(case_id),

  -- §3.4 runId — REQUIRED here (unlike case_workspace_waits.run_id, which this
  -- program made optional): a NodeRun cannot logically exist before its Run.
  -- FK into CW-P04's binding table, which is the program's own record of a Run.
  run_id TEXT NOT NULL
    REFERENCES case_workspace_run_bindings(run_id),

  -- §3.4 nodeId / nodeVersionRef — WHICH published graph node this run
  -- executes, and at which definition version. Plain TEXT: the node lives
  -- inside case_plan_versions' canonical graph JSON, not in a node table, so
  -- there is nothing to FK to. §3.4: "Definition nodes never carry mutable
  -- execution state" — that separation is why the definition side stays a
  -- reference and all mutable state lives on this row.
  node_id TEXT NOT NULL,
  node_version_ref TEXT NOT NULL,

  -- §4.5's state machine, verbatim and complete. The service enforces the
  -- edges; this CHECK enforces the vocabulary, so no writer can invent a
  -- status even by raw SQL.
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING', 'READY', 'CLAIMED', 'RUNNING',
      'WAITING_HUMAN', 'WAITING_TIMER', 'WAITING_EVENT',
      'FAILED_RETRYABLE', 'RETRY_SCHEDULED',
      'SUCCEEDED', 'SKIPPED', 'FAILED_TERMINAL', 'CANCELLED'
    )),

  -- §3.4 `attempt`. 0 until the first attempt starts, then the number of the
  -- CURRENT/last attempt. The auditable detail of each one is a row in
  -- case_workspace_node_run_attempts; this is the fast counter the retry
  -- policy reads.
  attempt INTEGER NOT NULL DEFAULT 0,

  -- Retry budget. NOT part of §3.4's literal field list — added because
  -- "FAILED_RETRYABLE -> RETRY_SCHEDULED -> READY" has to terminate, and the
  -- decision "retryable or terminal" needs a ceiling that is per-node data,
  -- not a hard-coded constant. 1 = a single attempt, no retries.
  max_attempts INTEGER NOT NULL DEFAULT 1
    CHECK (max_attempts >= 1),

  -- The attempt currently in flight (or the last one to finish). Deliberately
  -- NO FK: the reference is circular (an attempt row references its node_run,
  -- which would reference back), and an FK here would force a deferred-
  -- constraint dance on every attempt start for no integrity gain — the
  -- attempts table is the authority and is already FK-anchored to this one.
  current_attempt_id TEXT,

  -- §3.4 inputSnapshotRef / outputSnapshotRef?. POINTERS, never payloads: the
  -- same posture as the outbox's payload_ref (§6 "full documents, prompts,
  -- credentials … are referenced rather than copied").
  input_snapshot_ref TEXT,
  output_snapshot_ref TEXT,

  -- §3.4 waitId? / proposalId? — the two things a RUNNING node can be parked
  -- on. Real FKs into this program's own tables. No ON DELETE clause
  -- (RESTRICT/NO ACTION), matching every sibling packet's posture.
  wait_id TEXT
    REFERENCES case_workspace_waits(wait_id),
  action_proposal_id TEXT
    REFERENCES case_workspace_action_proposals(action_proposal_id),

  -- §3.4 idempotencyKey, and §3.4's rule that it is "stable for the intended
  -- business effect, not generated afresh on transport retry". The UNIQUE
  -- constraint at the bottom of this table is what turns that sentence into an
  -- enforceable fact: a redelivered StartNode command for the same Run and the
  -- same business effect finds the existing NodeRun instead of forking a
  -- second execution.
  idempotency_key TEXT NOT NULL,

  -- §8 "Worker claims use leases/heartbeats". Same three-column lease idiom
  -- already proven on case_workspace_waits (claim_owner_token /
  -- claim_fencing_token / claim_lease_expires_at), reused here on this table's
  -- OWN columns — the two tables are never joined.
  lease_owner TEXT,
  lease_fencing_token INTEGER NOT NULL DEFAULT 0,
  lease_expires_at TEXT,
  -- §3.4 heartbeatAt. The last proof of life from the lease holder; distinct
  -- from lease_expires_at (an intention) because a stuck worker that stops
  -- heartbeating but whose lease has not yet lapsed is exactly what §10's
  -- "stuck nodes" metric has to be able to see.
  heartbeat_at TEXT,

  -- Deadline for the attempt currently in flight. Cleared when an attempt
  -- ends. This is the column a timeout sweeper scans, so it is indexed below.
  timeout_at TEXT,

  -- RETRY_SCHEDULED's backoff floor: the node is not eligible to go READY
  -- again before this moment. NULL whenever status <> 'RETRY_SCHEDULED'.
  retry_not_before TEXT,

  -- §3.4 startedAt? / completedAt?.
  started_at TEXT,
  completed_at TEXT,

  -- §3.4 errorCode? / errorDetailRef?. errorCode is a STABLE, enumerable token
  -- from the adapter error taxonomy (capabilityAdapterService.CapabilityErrorCode)
  -- — safe to render, alert and group on. The detail is a REFERENCE (a digest
  -- or log pointer), never the provider's raw message: §6/§9 forbid copying
  -- provider payloads into durable records, and a provider message is the most
  -- common way a credential or a client name leaks into an audit table.
  error_code TEXT,
  error_detail_ref TEXT,

  -- Compensation. NOT a §4.5 status — deliberately kept OFF the status enum so
  -- §4.5's state machine stays verbatim. §4.5 says "a cancelled Run … does not
  -- pretend that committed external effects were rolled back", which is
  -- precisely why compensation needs its OWN axis: a node can be
  -- FAILED_TERMINAL or CANCELLED while its external effect is still REQUIRED,
  -- IN_PROGRESS, COMPLETED or itself FAILED. Collapsing the two axes is how a
  -- system starts claiming a rollback it never performed.
  compensation_state TEXT NOT NULL DEFAULT 'NOT_REQUIRED'
    CHECK (compensation_state IN (
      'NOT_REQUIRED', 'REQUIRED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    )),
  compensation_ref TEXT,

  -- Optimistic-concurrency counter for every status transition. A DISTINCT
  -- concept from lease_fencing_token (lease ownership) and from `attempt`
  -- (execution ordinal) — the same three-way naming separation
  -- case_workspace_waits already documents.
  version INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- §3.4's idempotency identity, enforced. Scoped to the Run rather than
  -- globally, because the same business effect legitimately recurs across Runs
  -- of the same plan.
  CONSTRAINT case_workspace_node_runs_idempotency_unique
    UNIQUE (run_id, idempotency_key)
);

-- The Run's node list — the §4.5 board read, and GET /runs/:runId/nodes.
CREATE INDEX IF NOT EXISTS idx_case_workspace_node_runs_run
  ON case_workspace_node_runs (run_id, status);

-- Case-scoped read (My Work projection, Case timeline).
CREATE INDEX IF NOT EXISTS idx_case_workspace_node_runs_case
  ON case_workspace_node_runs (case_id, status);

-- The scheduler's claim scan: work that is READY (or whose retry backoff has
-- elapsed), oldest first. PARTIAL so it holds only claimable rows and stays
-- proportional to the live queue, not to execution history.
CREATE INDEX IF NOT EXISTS idx_case_workspace_node_runs_claimable
  ON case_workspace_node_runs (status, retry_not_before)
  WHERE status IN ('READY', 'RETRY_SCHEDULED');

-- The timeout sweeper's scan. PARTIAL: only an in-flight attempt has a
-- deadline worth scanning.
CREATE INDEX IF NOT EXISTS idx_case_workspace_node_runs_timeout
  ON case_workspace_node_runs (timeout_at)
  WHERE timeout_at IS NOT NULL AND status IN ('CLAIMED', 'RUNNING');

-- §8 expired-lease recovery scan. PARTIAL: only a held lease can expire.
CREATE INDEX IF NOT EXISTS idx_case_workspace_node_runs_lease
  ON case_workspace_node_runs (lease_expires_at)
  WHERE lease_owner IS NOT NULL;

-- Reverse lookup from a wait to the node parked on it — how a satisfied
-- EXTERNAL_CALLBACK wait finds the node it must wake.
CREATE INDEX IF NOT EXISTS idx_case_workspace_node_runs_wait
  ON case_workspace_node_runs (wait_id)
  WHERE wait_id IS NOT NULL;

-- ===========================================================================
-- 2. case_workspace_node_run_attempts — §3.4 "a retry creates an auditable
--    attempt". Append-once rows, closed exactly once by their outcome.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS case_workspace_node_run_attempts (
  -- The program's ONLY producer of `attempt_id`. Minted `cwattempt-${uuid}`.
  -- This is the value the outbox's `attempt_id` column (and §10's correlation
  -- chain) has been waiting for.
  attempt_id TEXT PRIMARY KEY,

  -- Real FK — the attempt is meaningless without its node run, and unlike the
  -- loose node_run_id on the four shipped tables, this one is enforced from
  -- day zero because it has no legacy rows to break.
  node_run_id TEXT NOT NULL
    REFERENCES case_workspace_node_runs(node_run_id),

  -- 1-based, dense per node_run. UNIQUE with node_run_id below: two workers
  -- cannot both open "attempt 3", so a lost race surfaces as a constraint
  -- violation rather than as two parallel executions of the same node.
  attempt_number INTEGER NOT NULL
    CHECK (attempt_number >= 1),

  -- §3 tenancy + §10 correlation, denormalized from the parent node run so an
  -- audit query never has to join to establish which tenant an attempt
  -- belonged to (and so it survives as a readable fact if the parent is ever
  -- archived).
  organization_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  run_id TEXT NOT NULL,

  -- The attempt's own outcome — NOT the node's status. An attempt that
  -- TIMED_OUT or ended FAILED_RETRYABLE can belong to a node that later
  -- SUCCEEDED; flattening the two would erase the retry history that §3.4
  -- calls "auditable".
  status TEXT NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN (
      'RUNNING', 'SUCCEEDED', 'FAILED_RETRYABLE', 'FAILED_TERMINAL',
      'TIMED_OUT', 'CANCELLED'
    )),

  -- Which worker ran it (the lease owner at start), for §10's "worker
  -- utilization, leases and stuck nodes".
  lease_owner TEXT,

  -- Which registered capability this attempt invoked, if any. Real FK into
  -- CW-P03's registry — this is the join that makes per-capability failure
  -- rate and timeout tuning answerable by query instead of by log grep.
  capability_registry_id TEXT
    REFERENCES case_workspace_capabilities(capability_registry_id),

  -- The deadline this attempt was given, kept even after it ends so a
  -- postmortem can tell "slow" from "starved".
  timeout_at TEXT,

  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,

  -- Stable taxonomy code + a REFERENCE to the detail. Same rule as the parent
  -- table: no raw provider message is ever stored here.
  error_code TEXT,
  error_detail_ref TEXT,

  -- Pointer to this attempt's own output, distinct from the node's final
  -- output_snapshot_ref (a superseded attempt's output is still evidence).
  output_snapshot_ref TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT case_workspace_node_run_attempts_number_unique
    UNIQUE (node_run_id, attempt_number)
);

-- The attempt history read, newest last.
CREATE INDEX IF NOT EXISTS idx_case_workspace_node_run_attempts_node_run
  ON case_workspace_node_run_attempts (node_run_id, attempt_number);

-- Per-capability reliability queries (failure rate, timeout tuning).
CREATE INDEX IF NOT EXISTS idx_case_workspace_node_run_attempts_capability
  ON case_workspace_node_run_attempts (capability_registry_id, status)
  WHERE capability_registry_id IS NOT NULL;

-- Tenant-scoped attempt audit.
CREATE INDEX IF NOT EXISTS idx_case_workspace_node_run_attempts_org
  ON case_workspace_node_run_attempts (organization_id, started_at);

-- ===========================================================================
-- 3. case_workspace_event_inbox — durable INBOUND event boundary (§8)
-- ===========================================================================
-- The mirror image of case_workspace_event_outbox, and deliberately a
-- SEPARATE table rather than a `direction` column on it: the outbox's columns
-- are facts this system asserts, while every column here is a CLAIM made by an
-- untrusted caller until it has been authenticated and validated. Mixing
-- trusted and untrusted rows in one table is how an unvalidated claim ends up
-- read as an audited fact.
CREATE TABLE IF NOT EXISTS case_workspace_event_inbox (
  -- Our own row identity, minted `cwinbox-${uuid}`. Distinct from event_id,
  -- which belongs to the sender.
  inbox_record_id TEXT PRIMARY KEY,

  -- §8 "Event consumers deduplicate by eventId" — the SENDER's id, opaque to
  -- us, and the load-bearing half of the dedup key below.
  event_id TEXT NOT NULL,

  -- The authenticated channel the event arrived on (a provider/connector key,
  -- e.g. 'docusign-webhook'). Part of the dedup key because event ids are only
  -- unique WITHIN a sender; two providers may legitimately both use '12345'.
  source TEXT NOT NULL,

  event_type TEXT NOT NULL,

  -- The tenant the caller CLAIMS. It is never trusted on its own: the service
  -- resolves the correlated wait and rejects the event as TENANT_MISMATCH when
  -- the wait's real organization_id differs. Stored either way, because a
  -- rejected cross-tenant claim is a security event that must be readable
  -- afterwards, not a silent 404.
  organization_id TEXT NOT NULL,
  project_id TEXT,

  -- §10 correlation chain, as claimed/resolved. FK-less on purpose (same
  -- reasoning as the outbox): these can name an object that does not exist —
  -- that is one of the rejection reasons, and an FK would turn a rejection
  -- into an INSERT failure with no audit row.
  case_id TEXT,
  run_id TEXT,
  node_run_id TEXT,

  -- The key the sender was told to echo back; how the event is matched to a
  -- case_workspace_waits row (its correlation_key).
  correlation_key TEXT NOT NULL,

  -- The wait this event actually resolved to, once validated. NULL while
  -- RECEIVED, and NULL forever for a rejected event. FK-less deliberately: it
  -- is filled from a lookup that may find nothing, and an event rejected for
  -- CORRELATION_UNKNOWN must still be storable.
  wait_id TEXT,

  -- RECEIVED  : stored and authenticated, not yet applied.
  -- APPLIED   : the wait effect committed in the SAME transaction as this flip.
  -- REJECTED  : failed authentication, tenancy, correlation or payload
  --             validation. Terminal. NEVER retried — a rejected event is a
  --             decision, not a transport failure.
  -- DEAD_LETTER: repeatedly failed to APPLY for transient reasons. Terminal
  --             until a human acts (§8 "retry, dead-letter and reconciliation").
  status TEXT NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN ('RECEIVED', 'APPLIED', 'REJECTED', 'DEAD_LETTER')),

  -- The stable, enumerable reason a REJECTED row was rejected. Not free text:
  -- this is what an operator dashboard groups on, and what distinguishes a
  -- misconfigured integration (SIGNATURE_INVALID) from an attack
  -- (TENANT_MISMATCH).
  rejection_code TEXT
    CHECK (rejection_code IS NULL OR rejection_code IN (
      'SIGNATURE_INVALID', 'CHANNEL_UNKNOWN', 'TENANT_MISMATCH',
      'CORRELATION_UNKNOWN', 'PAYLOAD_INVALID', 'WAIT_NOT_ACTIVE',
      'WAIT_TYPE_MISMATCH'
    )),

  -- WHO authenticated (the channel principal), and a DIGEST of the presented
  -- signature. The raw signature is a credential and is never stored — the
  -- digest is enough to prove two deliveries carried the same signature
  -- without retaining anything replayable.
  auth_principal TEXT,
  signature_digest TEXT,

  -- `sha256:<hex>` over the canonicalized raw payload. Lets a later
  -- reconciliation prove "we received exactly this" without keeping the
  -- payload.
  payload_digest TEXT NOT NULL,

  -- Facts only, PII-redacted by the service before it ever reaches this column
  -- and size-capped — same rule and same redactor as the outbox's
  -- redacted_summary. The full body stays with the sender / in the blob store,
  -- referenced by payload_digest.
  redacted_payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Scheduling values, hence TIMESTAMPTZ (see the header).
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,

  -- What the event actually caused, for the audit trail (e.g. the satisfied
  -- wait id). NULL when nothing was applied.
  applied_effect_ref TEXT,

  -- §8 retry/dead-letter bookkeeping for TRANSIENT apply failures only.
  process_attempt_count INTEGER NOT NULL DEFAULT 0,
  last_process_error TEXT,

  -- §8's dedup, as a database constraint rather than as application care.
  -- This single UNIQUE index is the whole reason "the same eventId delivered
  -- twice, even concurrently, produces one effect" is true across processes
  -- and restarts: the second INSERT ... ON CONFLICT DO NOTHING returns zero
  -- rows and the service returns without touching a wait.
  --
  -- NOTE ON SCOPE: the key is (source, event_id) and deliberately does NOT
  -- include organization_id. Adding the tenant would let a hostile caller
  -- replay another tenant's event id under its own org and get a SECOND row —
  -- and a second apply attempt. Global-per-source is the safe direction: a
  -- cross-tenant reuse of an id collapses onto the existing row and is
  -- rejected by the tenancy check rather than duplicated.
  CONSTRAINT case_workspace_event_inbox_dedup_unique
    UNIQUE (source, event_id)
);

-- The applier's hot path: unprocessed rows, oldest first. PARTIAL, so it holds
-- only the live backlog.
CREATE INDEX IF NOT EXISTS idx_case_workspace_event_inbox_pending
  ON case_workspace_event_inbox (received_at)
  WHERE status = 'RECEIVED';

-- Tenant-scoped audit read, including rejections.
CREATE INDEX IF NOT EXISTS idx_case_workspace_event_inbox_org
  ON case_workspace_event_inbox (organization_id, received_at);

-- Correlation lookup — "did anything ever arrive for this wait key?".
CREATE INDEX IF NOT EXISTS idx_case_workspace_event_inbox_correlation
  ON case_workspace_event_inbox (correlation_key);

-- The wait's inbound history.
CREATE INDEX IF NOT EXISTS idx_case_workspace_event_inbox_wait
  ON case_workspace_event_inbox (wait_id)
  WHERE wait_id IS NOT NULL;

-- §8 reconciliation surface: rejected + dead-lettered, grouped by reason.
CREATE INDEX IF NOT EXISTS idx_case_workspace_event_inbox_rejections
  ON case_workspace_event_inbox (status, rejection_code, received_at)
  WHERE status IN ('REJECTED', 'DEAD_LETTER');
