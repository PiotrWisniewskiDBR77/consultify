-- Case Workspace — PER-ROW RETRY BACKOFF on the outbox (D3 resilience gaps,
-- docs/product/case-workspace/06_SECURITY_EVENTS_OBSERVABILITY.md §8).
--
-- ===========================================================================
-- WHY THIS MIGRATION EXISTS
-- ===========================================================================
-- Before this migration, `case_workspace_event_outbox` had no per-row retry
-- schedule at all: `eventOutboxService.dispatchPendingEvents()`'s claim query
-- was `WHERE delivered_at IS NULL AND delivery_attempt_count < threshold`,
-- with no time component. A row that just failed became claimable again on
-- the VERY NEXT tick — the only backoff that existed was
-- `outboxWorker.ts`'s own TICK-CADENCE backoff (`OutboxWorkerOptions.
-- maxIntervalMs`, see that file's own doc on `currentBackoffMultiplier`),
-- which slows down the WHOLE WORKER LOOP when ANY row is failing, not the
-- one failing row. A single permanently-broken consumer for one event type
-- would therefore re-claim (and re-fail) that SAME row on every tick at the
-- worker's base interval, burning a dispatch-transaction and a delivery
-- attempt each time, for up to DEAD_LETTER_ATTEMPT_THRESHOLD (10) attempts —
-- fine at low volume, but indistinguishable from a tight retry loop against
-- a downstream system that a real per-row exponential backoff exists
-- specifically to protect.
--
-- This migration adds the missing schedule column so retry timing can live
-- on the ROW, not on the worker's tick cadence:
--   - `next_retry_at IS NULL` (the default, including every pre-existing row
--     — an `ADD COLUMN` default is NULL for free, no backfill needed) means
--     "eligible immediately", so nothing about a fresh row's first attempt
--     changes.
--   - After a FAILED delivery, `eventOutboxService.dispatchPendingEvents()`
--     (outside this migration's own scope — see that file) sets
--     `next_retry_at = now() + <exponential backoff, capped>` in the SAME
--     UPDATE that already bumps `delivery_attempt_count`, and the claim
--     query gains `AND (next_retry_at IS NULL OR next_retry_at <= now())`.
--
-- ===========================================================================
-- WHY THE APPEND-ONLY GUARD TRIGGER ALSO NEEDS TO CHANGE, IN THIS SAME FILE
-- ===========================================================================
-- server/migrations/20260810f_case_workspace_append_only_guards.sql installed
-- a real, DB-level `BEFORE UPDATE` trigger on this table
-- (`case_workspace_event_outbox_guard()`) that RAISE EXCEPTIONs the moment
-- any column OTHER than `delivered_at`, `delivery_attempt_count` or
-- `last_delivery_error` changes value. Adding `next_retry_at` as a fourth
-- mutable delivery-bookkeeping column WITHOUT also widening that trigger
-- would mean the very first UPDATE that tries to set it fails closed with a
-- Postgres exception (ERRCODE 0A000) — a silent-looking regression that only
-- shows up the moment the failure-retry path actually runs. This migration
-- therefore `CREATE OR REPLACE FUNCTION`s that SAME guard function (its own
-- header already documents this as the intended, idempotent way to evolve
-- it: "Idempotent and safe to re-run: CREATE OR REPLACE FUNCTION, and each
-- trigger is dropped before being recreated") with `next_retry_at` added to
-- the allowed-mutable list, and nothing else about that function's behavior
-- changes: DELETE is still rejected unconditionally, and every other column
-- is still guarded exactly as before.
--
-- ===========================================================================
-- INDEX
-- ===========================================================================
-- A second partial index, alongside the pre-existing
-- `idx_case_workspace_event_outbox_pending (created_at) WHERE delivered_at
-- IS NULL` — this one on `next_retry_at`, same `WHERE delivered_at IS NULL`
-- scope, so it stays bounded by the real backlog size (not total event
-- volume) exactly like its sibling, and lets the claim query's
-- `next_retry_at <= now()` condition stay cheap at the 10,000-row DoD-I
-- volume this packet's own perf harness
-- (`__tests__/perf/outboxThroughput.perf.pg.test.ts`) exercises.
--
-- Idempotent and safe to re-run (ADD COLUMN/CREATE INDEX IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS + CREATE TRIGGER).

ALTER TABLE case_workspace_event_outbox
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_case_workspace_event_outbox_pending_retry
  ON case_workspace_event_outbox (next_retry_at)
  WHERE delivered_at IS NULL;

-- ---------------------------------------------------------------------------
-- Widen the append-only guard trigger function to also allow next_retry_at.
-- Byte-for-byte the same function as 20260810f, plus next_retry_at in the
-- immutable-columns check (i.e. removed from the "must never change" list)
-- and in the exception message.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION case_workspace_event_outbox_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'case_workspace_event_outbox is append-only: DELETE is not permitted (event_id=%)',
      OLD.event_id
      USING ERRCODE = '0A000';
  END IF;

  -- TG_OP = 'UPDATE': only the FOUR delivery-bookkeeping columns may change
  -- (delivered_at, delivery_attempt_count, last_delivery_error, and now
  -- next_retry_at — the per-row backoff schedule added by this migration).
  IF OLD.event_id           IS DISTINCT FROM NEW.event_id
     OR OLD.event_type      IS DISTINCT FROM NEW.event_type
     OR OLD.schema_version  IS DISTINCT FROM NEW.schema_version
     OR OLD.organization_id IS DISTINCT FROM NEW.organization_id
     OR OLD.project_id      IS DISTINCT FROM NEW.project_id
     OR OLD.aggregate_type  IS DISTINCT FROM NEW.aggregate_type
     OR OLD.aggregate_id    IS DISTINCT FROM NEW.aggregate_id
     OR OLD.aggregate_version IS DISTINCT FROM NEW.aggregate_version
     OR OLD.case_id         IS DISTINCT FROM NEW.case_id
     OR OLD.run_id          IS DISTINCT FROM NEW.run_id
     OR OLD.node_run_id     IS DISTINCT FROM NEW.node_run_id
     OR OLD.attempt_id      IS DISTINCT FROM NEW.attempt_id
     OR OLD.actor_user_id   IS DISTINCT FROM NEW.actor_user_id
     OR OLD.correlation_id  IS DISTINCT FROM NEW.correlation_id
     OR OLD.causation_id    IS DISTINCT FROM NEW.causation_id
     OR OLD.occurred_at     IS DISTINCT FROM NEW.occurred_at
     OR OLD.redacted_summary IS DISTINCT FROM NEW.redacted_summary
     OR OLD.payload_ref     IS DISTINCT FROM NEW.payload_ref
     OR OLD.created_at      IS DISTINCT FROM NEW.created_at
     OR OLD.correlation_key IS DISTINCT FROM NEW.correlation_key
     OR OLD.sequence_number IS DISTINCT FROM NEW.sequence_number
  THEN
    RAISE EXCEPTION
      'case_workspace_event_outbox is append-only: only delivered_at, delivery_attempt_count, last_delivery_error and next_retry_at may change (event_id=%)',
      OLD.event_id
      USING ERRCODE = '0A000';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_case_workspace_event_outbox_guard
  ON case_workspace_event_outbox;

CREATE TRIGGER trg_case_workspace_event_outbox_guard
  BEFORE UPDATE OR DELETE ON case_workspace_event_outbox
  FOR EACH ROW
  EXECUTE FUNCTION case_workspace_event_outbox_guard();
