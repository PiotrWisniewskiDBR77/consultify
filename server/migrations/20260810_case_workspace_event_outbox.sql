-- Case Workspace — transactional DOMAIN EVENT OUTBOX
-- (docs/product/case-workspace/06_SECURITY_EVENTS_OBSERVABILITY.md §6-§8).
--
-- WHY THIS TABLE EXISTS
-- ---------------------
-- §6: "Domain changes and outbox records commit atomically." Today the 11
-- caseWorkspace services (caseCoreService, casePlanVersionService,
-- playService, proposalApprovalService, waitSubscriptionService,
-- artifactLinkService, executionGraphService, capabilityRegistryService,
-- runBindingService, caseHistoryService, migrationReadinessService) mutate
-- their aggregates inside withPgTransaction()/withRawPgTransaction() and
-- emit NOTHING durable. This table is the missing primitive: the row that
-- carries the DomainEvent envelope from §6 and commits in the SAME
-- transaction as the aggregate mutation that produced it.
--
-- This migration adds ONE new table and touches nothing else — no ALTER
-- TABLE against case_core, case_plan_versions, case_workspace_capabilities,
-- case_workspace_run_bindings, case_workspace_action_proposals,
-- case_workspace_waits, case_workspace_artifact_links,
-- case_workspace_history_events or any other table, and no reference to
-- Finance or Results. Same collision-avoidance mandate as every
-- 20260809_case_workspace_*.sql packet.
--
-- ZERO FOREIGN KEYS — DELIBERATE
-- ------------------------------
-- Precedent: case_workspace_history_events (20260809_case_workspace_history_value.sql,
-- see its header) also carries an FK-less case_id, for exactly the reason
-- that applies here in a stronger form: aggregate_type varies PER ROW
-- ('CASE', 'CASE_PLAN_VERSION', 'PROCESS_DEFINITION', 'ACTION_PROPOSAL',
-- 'WAIT', 'ARTIFACT_LINK', 'CAPABILITY', 'RUN_BINDING', 'FEATURE_FLAG', …),
-- so aggregate_id cannot possibly FK to one parent table. organization_id,
-- project_id, case_id, run_id, node_run_id and attempt_id are likewise
-- plain caller-supplied scope values with no FK: an audit/event record must
-- survive the deletion of the thing it describes (§9 "published definitions
-- and audit survive ordinary definition deletion"), and an FK would make the
-- outbox the reason a legitimate delete fails.
--
-- TIMESTAMPTZ, NOT TEXT — DELIBERATE DEVIATION FROM THE SIBLING TABLES
-- --------------------------------------------------------------------
-- Every 20260809_case_workspace_*.sql table stores timestamps as TEXT ISO
-- strings. This table uses timestamptz for occurred_at/delivered_at/
-- created_at because those three columns are not display values — they are
-- SCHEDULING values read by the dispatcher (`WHERE delivered_at IS NULL
-- ORDER BY created_at`, outbox-lag metrics per §10) and by reconciliation.
-- Lexicographic TEXT ordering silently breaks the moment one writer emits a
-- non-UTC or non-zero-padded ISO string, and `now() - created_at` lag has no
-- meaning over TEXT. Business time (occurred_at) stays distinct from append
-- time (created_at) so a backfill/replay can carry a true historical time,
-- same split as case_workspace_history_events' occurred_at/recorded_at.
--
-- APPEND-ONLY, WITH THREE DELIVERY-BOOKKEEPING EXCEPTIONS
-- -------------------------------------------------------
-- The event FACTS (everything from event_id through payload_ref) are never
-- updated after insert. Only delivered_at, delivery_attempt_count and
-- last_delivery_error are mutable, and only by the dispatcher — they are
-- transport bookkeeping, not domain facts. §8's "failed outbox delivery has
-- retry, dead-letter and reconciliation" is implemented on exactly these
-- three columns: delivered_at IS NULL means "still owed", the counter drives
-- the dead-letter threshold, and last_delivery_error is what a human reads
-- during reconciliation.
--
-- Idempotent and safe to re-run (CREATE TABLE/INDEX IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS case_workspace_event_outbox (
  -- §6 `eventId`. Minted `cwevt-${uuid}` by eventOutboxService.publishEvent.
  -- PRIMARY KEY is the load-bearing idempotency mechanism: publishEvent
  -- issues `INSERT ... ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
  -- so a caller that retries a command with a deterministic event_id can
  -- never double-emit. §8: "Event consumers deduplicate by eventId" — the
  -- producer side deduplicates here, on the same key.
  event_id TEXT PRIMARY KEY,

  -- §6 `eventType`, §7's canonical families ('case.created',
  -- 'case.plan.published', 'proposal.approved', 'wait.satisfied', …).
  -- Deliberately NOT a CHECK enum — same choice as
  -- case_workspace_history_events.event_type: the catalog lives in
  -- docs/product/case-workspace/acceptance/EVENT_TAXONOMY.md and as a TS
  -- constant, so adding an event family never requires a migration.
  -- Validated non-blank by the service only.
  event_type TEXT NOT NULL,

  -- §6 `schemaVersion` — the version of the redacted_summary shape for this
  -- event_type. Consumers branch on (event_type, schema_version); bumping it
  -- is how a summary shape changes without rewriting history.
  schema_version INTEGER NOT NULL DEFAULT 1,

  -- §3: "Every aggregate, outbox/inbox event, wait, artifact link and
  -- projection row carries organizationId". Never nullable, never inferred
  -- by the dispatcher — the producing service passes the tenant it already
  -- authorized against.
  organization_id TEXT NOT NULL,

  -- §3: "project-scoped rows also carry projectId". NULL for genuinely
  -- org-scoped facts (e.g. capability.registered, flag.definition_registered).
  project_id TEXT,

  -- §6 `aggregateType`/`aggregateId` — WHICH object this fact is about.
  -- aggregate_type is the per-row discriminator that makes an FK on
  -- aggregate_id impossible (see header).
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,

  -- §8: "Aggregate events carry a monotonic aggregate version or sequence."
  -- Nullable because not every aggregate in this codebase carries a version
  -- column today (case_core has `version`; case_workspace_waits and the
  -- gateway/acceptance ledgers do not) — a NULL here means "this aggregate
  -- has no version concept", not "unknown". Consumers order such events by
  -- occurred_at/created_at instead.
  aggregate_version INTEGER,

  -- §10's correlation chain: caseId -> runId -> nodeRunId -> attemptId.
  -- Denormalized onto the event so the operator trace can be reconstructed
  -- by query, without joining every aggregate table. All nullable: a
  -- case-level fact has no run, a capability-level fact has no case.
  case_id TEXT,
  run_id TEXT,
  node_run_id TEXT,
  attempt_id TEXT,

  -- §6 `actor`. Stored as the acting user id (or a `system:<worker>` token
  -- for automated emitters, same convention as
  -- case_workspace_history_events.actor_id). NOT NULL: an event with no
  -- accountable actor is not auditable.
  actor_user_id TEXT NOT NULL,

  -- §6 `correlationId` — ties every event produced by one triggering
  -- command/request together. NOT NULL: the service defaults it from
  -- RequestStore.getCorrelationId() and, failing that, mints one, so this
  -- column is never a hole in the §10 chain.
  correlation_id TEXT NOT NULL,

  -- §6 `causationId` — the event_id (or command id) that CAUSED this event.
  -- New concept in this codebase; nullable because a chain's first event has
  -- no cause. This is what turns a flat log into a causal graph.
  causation_id TEXT,

  -- §6 `occurredAt` — BUSINESS time of the fact, supplied by the producer.
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- §6 `redactedSummary`. jsonb, NOT NULL. §6: "Events carry facts, not
  -- commands. Full documents, prompts, credentials and sensitive payloads
  -- are referenced rather than copied to the bus." The service runs every
  -- summary through server/src/utils/piiRedactor.ts before it ever reaches
  -- this column and rejects oversized summaries, so "no secrets in events"
  -- (§13's redaction-inspection gate) is enforced at write time, not by
  -- reviewer discipline. `'{}'::jsonb` is a legitimate value for a fact that
  -- needs no detail beyond its type and aggregate.
  redacted_summary JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- §6 `payloadRef?` — opaque pointer (artifact id, revision digest, blob
  -- key) to the FULL payload that deliberately does not live in this row.
  payload_ref TEXT,

  -- Transport bookkeeping, mutable by the dispatcher only. NULL = still
  -- owed. This single column is the entire "did this event reach its
  -- consumers" state, and it lives in Postgres so a process restart mid-
  -- dispatch loses nothing (§8 recovery, §13 "restart tests").
  delivered_at TIMESTAMPTZ,

  -- §8 retry: incremented on every FAILED delivery attempt. Crossing the
  -- service's dead-letter threshold takes the row out of the dispatch
  -- SELECT while leaving it fully readable for reconciliation.
  delivery_attempt_count INTEGER NOT NULL DEFAULT 0,

  -- §8 dead-letter/reconciliation: the last failure, for the human who has
  -- to decide whether to fix the consumer or discard the event.
  last_delivery_error TEXT,

  -- Append time — proof-of-write, and the dispatch ORDER BY key. Distinct
  -- from occurred_at (see header).
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenant-scoped chronological read: "everything that happened in this
-- organization", the §10 observability/audit read path. organization_id
-- leads so a tenant scan never touches another tenant's rows.
CREATE INDEX IF NOT EXISTS idx_case_workspace_event_outbox_org_occurred
  ON case_workspace_event_outbox (organization_id, occurred_at);

-- §8 aggregate replay in version order — the exact access path of
-- eventOutboxService.replayEventsForAggregate().
CREATE INDEX IF NOT EXISTS idx_case_workspace_event_outbox_aggregate
  ON case_workspace_event_outbox (aggregate_type, aggregate_id, aggregate_version);

-- The dispatcher's hot path: pending rows, oldest first. PARTIAL index —
-- it holds only undelivered rows, so it stays tiny (bounded by real backlog,
-- not by total event volume) and rows leave it automatically once delivered.
CREATE INDEX IF NOT EXISTS idx_case_workspace_event_outbox_pending
  ON case_workspace_event_outbox (created_at)
  WHERE delivered_at IS NULL;

-- §10 operator trace for one Case. Partial, because case_id is NULL on
-- org-scoped events and there is no reason to index those NULLs.
CREATE INDEX IF NOT EXISTS idx_case_workspace_event_outbox_case
  ON case_workspace_event_outbox (case_id)
  WHERE case_id IS NOT NULL;
