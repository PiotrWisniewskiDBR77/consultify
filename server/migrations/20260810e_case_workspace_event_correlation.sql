-- Case Workspace — EVENT CORRELATION KEY on the outbox (CW-T-E, Problem 1).
--
-- ===========================================================================
-- WHY THIS MIGRATION EXISTS
-- ===========================================================================
-- waitSubscriptionService.ts's assertSatisfyingEventIsReal() has always
-- documented this exact gap in its own header (see that function's "TWO WAIT
-- TYPES, TWO EVIDENCE LEDGERS" comment, added by GAP-E-04):
--
--   "The outbox has no correlation key, so the binding available there is
--    tenant + declared event type + Case scope. That is weaker than the
--    inbox case, and deliberately recorded as such... Narrowing it further
--    needs a correlation column on the outbox, which is a schema change,
--    not a check."
--
-- CW-T-E's Problem 1 is that exact schema change. Before this migration, a
-- DOMAIN_EVENT wait was proven satisfied by ANY outbox row that matched
-- (organization_id, case_id, event_type) — so two DOMAIN_EVENT waits in the
-- SAME Case, waiting on the SAME event_type but for two DIFFERENT steps
-- (two different Runs, or two different NodeRuns of the same Run), could
-- cross-satisfy: an event meant to close step A's wait would also pass the
-- old check for step B's wait of the same type.
--
-- This migration adds ONE nullable column and one partial index. It does not
-- touch case_workspace_event_inbox (which already carries correlation_key —
-- see 20260810_case_workspace_node_run_and_inbox.sql), does not touch
-- case_workspace_waits, and does not add any FK — same collision-avoidance
-- mandate as every case_workspace_*.sql packet, and the outbox's own
-- migration already establishes "zero foreign keys — deliberate" for exactly
-- the reason that still applies here: correlation_key may legitimately name
-- a WaitSubscription that does not (yet, or ever) exist, and a rejection is
-- a check the SERVICE makes, not a constraint the INSERT should fail on.
--
-- ===========================================================================
-- HOW IT IS USED (server/src/services/caseWorkspace/eventOutboxService.ts +
-- waitSubscriptionService.ts, both updated in this same packet)
-- ===========================================================================
-- correlation_key is OPTIONAL on every publishEvent() call — most domain
-- events (case.created, proposal.approved, run.completed, ...) describe a
-- fact with no wait attached and leave it NULL, exactly like the outbox's
-- pre-existing case_id/run_id/node_run_id columns are NULL for org-scoped
-- facts. A producer that DOES know it is emitting the fact a specific
-- WaitSubscription is waiting for should stamp
-- correlation_key = <that wait's own case_workspace_waits.correlation_key>
-- (the same value CreateWaitInput.correlationKey / CaseWait.correlationKey
-- carries — see waitSubscriptionService.ts's open_question #5 on that
-- field's already-established double duty as both the idempotent-create key
-- and "the literal domain-correlation field for matching inbound
-- events/callbacks").
--
-- waitSubscriptionService.assertSatisfyingEventIsReal()'s DOMAIN_EVENT
-- branch now checks, in order:
--   1. correlation_key IS SET on the outbox row -> STRICT path: it must
--      equal the wait's own correlationKey exactly (mirrors the inbox
--      ledger's own correlation_key check), plus a defense-in-depth case_id
--      check when the row carries one. This is the precise, per-step
--      binding CW-T-E asks for.
--   2. correlation_key IS NULL on the outbox row (a producer that has not
--      adopted the new column yet) -> FALLBACK path, but STRICTER than
--      before: case_id must equal the wait's case_id EXACTLY (no longer
--      "only checked when present" — an org-scoped event with no case_id
--      can no longer satisfy a Case-scoped wait), and if the wait itself
--      carries run_id/node_run_id (i.e. it targets one specific step), the
--      outbox row's own run_id/node_run_id must match too. This is what
--      closes the "different step, same Case, same event_type" hole for
--      every producer even before it adopts correlation_key.
--
-- Idempotent and safe to re-run (ADD COLUMN/CREATE INDEX IF NOT EXISTS).

ALTER TABLE case_workspace_event_outbox
  ADD COLUMN IF NOT EXISTS correlation_key TEXT;

-- The lookup assertSatisfyingEventIsReal's STRICT path performs:
-- "does any event in this org carry this exact correlation key". Partial —
-- holds only the rows a producer actually opted a wait-binding into, so it
-- stays proportional to that (small) subset rather than the whole table.
CREATE INDEX IF NOT EXISTS idx_case_workspace_event_outbox_wait_correlation
  ON case_workspace_event_outbox (organization_id, correlation_key)
  WHERE correlation_key IS NOT NULL;

-- ===========================================================================
-- sequence_number — CW-T-E Problem 1/2's "kolejnosc deterministyczna"
-- ===========================================================================
-- Every ORDER BY this table has ever offered (dispatchPendingEvents'
-- `created_at`, replayEventsForAggregate's `occurred_at`/`created_at`) is a
-- TIMESTAMPTZ default of `now()` — Postgres transaction time, whose real
-- resolution on a loaded/virtualized host can coincide for two genuinely
-- sequential INSERTs (two back-to-back commands a few hundred microseconds
-- apart landing in the same clock tick). Ties were then broken by nothing at
-- all (dispatchPendingEvents) or by an opaque `cwevt-<uuid>` id
-- (replayEventsForAggregate, and every `*.pg.test.ts` fixture's own
-- `readOutboxRowsForAggregate`-shaped helper) — a value with NO relationship
-- to insertion order, so a clock tie could silently reorder two causally
-- sequential events (e.g. `wait.claim_lease_renewed` sorting after
-- `wait.satisfied` even though it was written first).
--
-- `GENERATED BY DEFAULT AS IDENTITY` backs this column with a real Postgres
-- sequence: monotonic, gap-tolerant (a rolled-back INSERT burns a value and
-- moves on, which is fine — this is an ordering key, not a display count),
-- and assigned at INSERT time regardless of wall-clock resolution. `BY
-- DEFAULT` (not `ALWAYS`) leaves room for a future backfill/replay tool to
-- supply an explicit value if one is ever needed; nothing in this program
-- does that today. Existing rows are backfilled by Postgres itself as part
-- of the ALTER TABLE, in physical storage order — an approximation for
-- history that predates this column; every row written from here on gets a
-- value in true insertion order.
ALTER TABLE case_workspace_event_outbox
  ADD COLUMN IF NOT EXISTS sequence_number BIGINT GENERATED BY DEFAULT AS IDENTITY;

-- The dispatcher's claim order and any aggregate replay's tie-break both read
-- this column ascending; a plain btree is the whole index this needs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_workspace_event_outbox_sequence
  ON case_workspace_event_outbox (sequence_number);
