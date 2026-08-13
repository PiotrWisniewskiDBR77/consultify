-- Case Workspace — the INBOX gains a rejection code for AMBIGUOUS correlation.
--
-- Ground truth:
--   docs/product/case-workspace/06_SECURITY_EVENTS_OBSERVABILITY.md §8
--     ("Failed outbox/inbox delivery has retry, dead-letter and
--     reconciliation") — the reconciliation surface is
--     `idx_case_workspace_event_inbox_rejections (status, rejection_code,
--     received_at)`, i.e. an operator groups the backlog BY rejection_code.
--   docs/product/case-workspace/04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md §9
--     ("an unestablished fact is neither yes nor no") — an ambiguous delivery
--     satisfies nothing. That part was already correct; how it was RECORDED
--     was not.
--
-- ===========================================================================
-- WHAT WAS WRONG (and why widening a CHECK is the right repair)
-- ===========================================================================
-- `waitSubscriptionService.loadWaitByCorrelationKeyOnClient()` distinguishes
-- four outcomes: RESOLVED, OUT_OF_SCOPE, UNKNOWN and AMBIGUOUS (several waits
-- in the claimed organization carry the key and the delivery named no Case).
-- `eventInboxService` mapped THREE of them onto three distinct rejection codes
-- and folded the fourth — AMBIGUOUS — onto CORRELATION_UNKNOWN, with a comment
-- saying so explicitly:
--
--     "Reported under the existing CORRELATION_UNKNOWN code (the durable
--      `rejection_code` vocabulary is a DB CHECK constraint; inventing a value
--      the constraint does not know would turn every ambiguous delivery into a
--      500 with NO audit row, which is worse than a slightly coarse code)"
--
-- The reasoning about the 500 was correct; the conclusion was a workaround.
-- The two situations are OPPOSITE operator actions:
--
--   CORRELATION_UNKNOWN    nobody registered this key — the sender is echoing
--                          a stale/wrong token. Fix the SENDER.
--   CORRELATION_AMBIGUOUS  the key is registered SEVERAL times in this org and
--                          the sender did not name a Case. Nothing is wrong
--                          with the token; the delivery is under-addressed.
--                          Fix the CALLER's payload (send caseId) or the
--                          key-minting that allowed the collision.
--
-- Collapsed into one code they are indistinguishable in exactly the query the
-- reconciliation index exists for. This migration widens the durable
-- vocabulary so the service can record what actually happened.
--
-- ===========================================================================
-- WHY A NEW CHECK CONSTRAINT AND NOT AN ENUM / LOOKUP TABLE
-- ===========================================================================
-- The column already IS a CHECK-constrained TEXT (same shape as `status`, and
-- the same shape used by every other Case Workspace table in this program).
-- Converting it to a native ENUM or an FK-ed lookup table here would be a
-- schema-style change to a shipped table for one added value — a bigger blast
-- radius than the defect. The vocabulary stays where it is; it gains a member.
--
-- ===========================================================================
-- ORDERING NOTE (server/scripts/migrate.postgres.ts)
-- ===========================================================================
-- The runner's DATED_RE is /^(\d{4})-?(\d{2})-?(\d{2})[_-]/ — the `c` suffix
-- in this filename means it does NOT match, so this file classifies as
-- phase 3 ("OTHER") and runs AFTER every numbered (phase 0) and dated
-- (phase 1) migration. That is the order this file needs anyway: it ALTERs a
-- table created by the dated 20260810_case_workspace_node_run_and_inbox.sql.
-- Stated here so a future reader does not "fix" the filename into
-- 20260810c-style dating and silently move it before its producer.
--
-- IDEMPOTENT: safe to re-run. Guarded on the table existing, on the old
-- constraint existing under EITHER its auto-generated name or an explicit one,
-- and the widened constraint is only added when absent.

DO $$
DECLARE
  v_constraint_name TEXT;
  v_reclassified    INTEGER := 0;
BEGIN
  IF to_regclass('public.case_workspace_event_inbox') IS NULL THEN
    RAISE NOTICE '[20260810c] case_workspace_event_inbox absent — nothing to widen';
    RETURN;
  END IF;

  -- ---------------------------------------------------------------------
  -- 1. Drop the existing rejection_code CHECK, whatever it is called.
  --
  --    The original migration declared the CHECK inline, so PostgreSQL named
  --    it `case_workspace_event_inbox_rejection_code_check`. Dropping by that
  --    literal name would work today and break on any database where the
  --    constraint was ever recreated by hand. Resolve it from the catalog by
  --    what it CONSTRAINS instead of by what it is called.
  -- ---------------------------------------------------------------------
  SELECT c.conname INTO v_constraint_name
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY (c.conkey)
   WHERE c.conrelid = 'public.case_workspace_event_inbox'::regclass
     AND c.contype = 'c'
     AND a.attname = 'rejection_code'
   LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.case_workspace_event_inbox DROP CONSTRAINT %I',
      v_constraint_name
    );
    RAISE NOTICE '[20260810c] dropped rejection_code CHECK %', v_constraint_name;
  END IF;

  -- ---------------------------------------------------------------------
  -- 2. Re-add it under an EXPLICIT name, with CORRELATION_AMBIGUOUS added.
  --
  --    Named on purpose: the next migration that needs to touch this list
  --    should be able to address it, and the test suite asserts on the
  --    definition rather than hoping for a generated name.
  -- ---------------------------------------------------------------------
  ALTER TABLE public.case_workspace_event_inbox
    ADD CONSTRAINT case_workspace_event_inbox_rejection_code_check
    CHECK (rejection_code IS NULL OR rejection_code IN (
      'SIGNATURE_INVALID', 'CHANNEL_UNKNOWN', 'TENANT_MISMATCH',
      'CORRELATION_UNKNOWN', 'CORRELATION_AMBIGUOUS', 'PAYLOAD_INVALID',
      'WAIT_NOT_ACTIVE', 'WAIT_TYPE_MISMATCH'
    ));

  -- ---------------------------------------------------------------------
  -- 3. RECLASSIFY the rows the workaround mislabelled.
  --
  --    Widening the vocabulary only fixes deliveries from now on. Every
  --    ambiguous delivery already received is still sitting in the backlog
  --    under CORRELATION_UNKNOWN, so the very query this migration exists to
  --    enable would still lie about the past. Those rows are identifiable
  --    WITHOUT guessing: the workaround carried the real reason into the
  --    audit event's redacted summary (`ambiguousCandidates`), emitted in the
  --    SAME transaction as the rejection, keyed by aggregate_id =
  --    inbox_record_id. Presence of that key is proof, not inference — no
  --    other code path writes it.
  --
  --    Deliberately narrow: only REJECTED rows that still carry the coarse
  --    code, only where the matching audit event exists. A row without its
  --    audit event is left alone rather than reclassified on a hunch.
  -- ---------------------------------------------------------------------
  IF to_regclass('public.case_workspace_event_outbox') IS NOT NULL THEN
    WITH reclassified AS (
      UPDATE public.case_workspace_event_inbox i
         SET rejection_code = 'CORRELATION_AMBIGUOUS'
       WHERE i.status = 'REJECTED'
         AND i.rejection_code = 'CORRELATION_UNKNOWN'
         AND EXISTS (
           SELECT 1
             FROM public.case_workspace_event_outbox o
            WHERE o.aggregate_id = i.inbox_record_id
              AND o.event_type = 'inbox.event_rejected'
              AND o.redacted_summary ? 'ambiguousCandidates'
         )
      RETURNING 1
    )
    SELECT count(*)::int INTO v_reclassified FROM reclassified;
  END IF;

  RAISE NOTICE '[20260810c] rejection_code vocabulary widened with CORRELATION_AMBIGUOUS; % historical row(s) reclassified', v_reclassified;
END $$;

-- The reconciliation index already covers (status, rejection_code,
-- received_at); no index change is needed — the new value simply becomes a
-- separate group inside it.
