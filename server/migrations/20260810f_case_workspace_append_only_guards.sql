-- Case Workspace — REAL, DATABASE-LEVEL append-only enforcement for the
-- three event/audit tables that §6/§8 require to be append-only:
-- case_workspace_event_outbox, case_workspace_event_inbox and
-- case_workspace_history_events.
--
-- WHY THIS MIGRATION EXISTS
-- --------------------------
-- Before this migration, "append-only" was enforced ONLY by application
-- discipline (no service method issues an UPDATE/DELETE that touches the
-- wrong column) and asserted in code comments. A manual `UPDATE
-- case_workspace_event_outbox SET redacted_summary = ...` or `DELETE FROM
-- case_workspace_history_events` from any other connection — a psql session,
-- a future careless migration, a compromised credential — passes silently.
-- §9's audit-survives guarantee and §8's "event consumers deduplicate by
-- eventId" both assume the durable event log cannot be rewritten; that
-- assumption had zero enforcement at the only layer that can actually
-- guarantee it. This migration closes that gap with BEFORE UPDATE/DELETE
-- triggers that RAISE EXCEPTION, so the guarantee holds regardless of which
-- connection or which future code path touches these tables.
--
-- WHAT IS BLOCKED, PER TABLE, AND WHY
-- ------------------------------------
-- 1. case_workspace_history_events — fully append-only. No method in
--    caseHistoryService.ts (or anywhere else in the codebase) ever issues an
--    UPDATE or DELETE against it (see that file's own header comment, and
--    the 20260809_case_workspace_history_value.sql migration header:
--    "recorded_at … Never updated after insert (no method in
--    caseHistoryService.ts issues UPDATE against this table at all)"). Every
--    UPDATE and every DELETE is rejected, unconditionally.
--
-- 2. case_workspace_event_outbox — append-only FACTS, mutable DELIVERY
--    BOOKKEEPING. Verified against eventOutboxService.dispatchPendingEvents(),
--    the table's only writer of UPDATE statements:
--      UPDATE case_workspace_event_outbox
--         SET delivered_at = now(), last_delivery_error = NULL
--       WHERE event_id = $1                                   -- success path
--      UPDATE case_workspace_event_outbox
--         SET delivery_attempt_count = delivery_attempt_count + 1,
--             last_delivery_error = $2
--       WHERE event_id = $1                                   -- failure path
--    So exactly THREE columns (delivered_at, delivery_attempt_count,
--    last_delivery_error) are legitimately mutable — the migration's own
--    header already names them "three delivery-bookkeeping exceptions".
--    Every other column (event_id, event_type, schema_version,
--    organization_id, project_id, aggregate_type, aggregate_id,
--    aggregate_version, case_id, run_id, node_run_id, attempt_id,
--    actor_user_id, correlation_id, causation_id, occurred_at,
--    redacted_summary, payload_ref, created_at, correlation_key,
--    sequence_number — the last two added by
--    20260810e_case_workspace_event_correlation.sql, likewise never touched
--    by any UPDATE in the codebase) is rejected the moment it changes value.
--    DELETE is rejected unconditionally — nothing in the codebase ever
--    deletes an outbox row.
--
-- 3. case_workspace_event_inbox — append-only CLAIM IDENTITY, mutable
--    PROCESSING STATE. Verified against eventInboxService.ts, the table's
--    only writer of UPDATE statements (the reject() gate, the GATE 4 apply
--    UPDATE, and recordInboxProcessingFailure()): all three only ever set
--    status, rejection_code, wait_id, case_id, run_id, node_run_id,
--    applied_effect_ref, processed_at, process_attempt_count and
--    last_process_error. case_id/run_id/node_run_id are included because the
--    apply UPDATE legitimately fills them via COALESCE(case_id, ?) when the
--    inbound delivery resolves a correlation the original claim left NULL —
--    blocking them would break dispatchPendingEvents' documented behaviour.
--    Every other column — inbox_record_id, event_id, source, event_type,
--    organization_id, project_id, correlation_key, auth_principal,
--    signature_digest, payload_digest, redacted_payload, received_at — is
--    the claim as originally received and authenticated, and is rejected the
--    moment it changes value. DELETE is rejected unconditionally.
--
-- Idempotent and safe to re-run: CREATE OR REPLACE FUNCTION, and each
-- trigger is dropped before being recreated.

-- ===========================================================================
-- 1. case_workspace_history_events — fully append-only
-- ===========================================================================
CREATE OR REPLACE FUNCTION case_workspace_history_events_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'case_workspace_history_events is append-only: % is not permitted (event_id=%)',
    TG_OP,
    COALESCE(OLD.event_id, 'unknown')
    USING ERRCODE = '0A000'; -- feature_not_supported
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_case_workspace_history_events_block_mutation
  ON case_workspace_history_events;

CREATE TRIGGER trg_case_workspace_history_events_block_mutation
  BEFORE UPDATE OR DELETE ON case_workspace_history_events
  FOR EACH ROW
  EXECUTE FUNCTION case_workspace_history_events_block_mutation();

-- ===========================================================================
-- 2. case_workspace_event_outbox — append-only facts, mutable delivery
--    bookkeeping (delivered_at, delivery_attempt_count, last_delivery_error)
-- ===========================================================================
CREATE OR REPLACE FUNCTION case_workspace_event_outbox_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'case_workspace_event_outbox is append-only: DELETE is not permitted (event_id=%)',
      OLD.event_id
      USING ERRCODE = '0A000';
  END IF;

  -- TG_OP = 'UPDATE': only the three delivery-bookkeeping columns may change.
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
      'case_workspace_event_outbox is append-only: only delivered_at, delivery_attempt_count and last_delivery_error may change (event_id=%)',
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

-- ===========================================================================
-- 3. case_workspace_event_inbox — append-only claim identity, mutable
--    processing state (status, rejection_code, wait_id, case_id, run_id,
--    node_run_id, applied_effect_ref, processed_at, process_attempt_count,
--    last_process_error)
-- ===========================================================================
CREATE OR REPLACE FUNCTION case_workspace_event_inbox_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'case_workspace_event_inbox is append-only: DELETE is not permitted (inbox_record_id=%)',
      OLD.inbox_record_id
      USING ERRCODE = '0A000';
  END IF;

  -- TG_OP = 'UPDATE': the original claim/identity columns may never change.
  -- Processing-state columns (status, rejection_code, wait_id, case_id,
  -- run_id, node_run_id, applied_effect_ref, processed_at,
  -- process_attempt_count, last_process_error) are deliberately NOT checked.
  IF OLD.inbox_record_id   IS DISTINCT FROM NEW.inbox_record_id
     OR OLD.event_id       IS DISTINCT FROM NEW.event_id
     OR OLD.source         IS DISTINCT FROM NEW.source
     OR OLD.event_type     IS DISTINCT FROM NEW.event_type
     OR OLD.organization_id IS DISTINCT FROM NEW.organization_id
     OR OLD.project_id     IS DISTINCT FROM NEW.project_id
     OR OLD.correlation_key IS DISTINCT FROM NEW.correlation_key
     OR OLD.auth_principal IS DISTINCT FROM NEW.auth_principal
     OR OLD.signature_digest IS DISTINCT FROM NEW.signature_digest
     OR OLD.payload_digest IS DISTINCT FROM NEW.payload_digest
     OR OLD.redacted_payload IS DISTINCT FROM NEW.redacted_payload
     OR OLD.received_at    IS DISTINCT FROM NEW.received_at
  THEN
    RAISE EXCEPTION
      'case_workspace_event_inbox is append-only: the received claim (inbox_record_id, event_id, source, event_type, organization_id, project_id, correlation_key, auth_principal, signature_digest, payload_digest, redacted_payload, received_at) may never change (inbox_record_id=%)',
      OLD.inbox_record_id
      USING ERRCODE = '0A000';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_case_workspace_event_inbox_guard
  ON case_workspace_event_inbox;

CREATE TRIGGER trg_case_workspace_event_inbox_guard
  BEFORE UPDATE OR DELETE ON case_workspace_event_inbox
  FOR EACH ROW
  EXECUTE FUNCTION case_workspace_event_inbox_guard();
