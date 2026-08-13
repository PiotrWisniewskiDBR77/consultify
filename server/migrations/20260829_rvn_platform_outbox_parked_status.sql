-- RN-G3 Outbox Dispatcher — add the 'parked' terminal status (IO-C).
--
-- Design: docs/product/results-vnext/RN_G3_OUTBOX_DISPATCHER_DESIGN.md §2
-- Integration Owner ruling IO-C.
--
-- `finance_projection` has 11 LIVE event types (roi.case_approved and
-- friends, atomicWrite.ts's EVENT_TYPE_CONSUMER_GROUPS) routing to it with
-- no consumer built yet. Treating an unbuilt-but-known-backlog consumer
-- group the SAME as a genuinely broken one (dispatcher §3's default:
-- markFailed -> eventually dead_letter -> CRITICAL alert) would fire a
-- CRITICAL Slack alert on every single ROI case approval — the classic
-- alert-fatigue failure, and on the single most important ROI event in the
-- system. `parked` is a distinct terminal status: the row is visible and
-- replayable once the consumer lands, but never dead-letters and never
-- pages CRITICAL (see consumerRegistry.ts's UNBUILT_CONSUMER_GROUPS and
-- platformOutboxDrainCron.ts's dispatch loop).
--
-- Additive only — widens the existing CHECK constraint
-- (server/migrations/20260809_rvn_platform_events_outbox.sql), does not
-- touch any existing 'pending'/'claimed'/'dispatched'/'failed'/'dead_letter'
-- row or the columns/functions in outboxDrain.ts (markDispatched/markFailed/
-- claimOutboxBatch/reclaimExpiredClaims are untouched; markParked is a new,
-- additional function).
DO $$
BEGIN
  ALTER TABLE public.rvn_platform_outbox
    DROP CONSTRAINT IF EXISTS rvn_platform_outbox_status_check;

  ALTER TABLE public.rvn_platform_outbox
    ADD CONSTRAINT rvn_platform_outbox_status_check
    CHECK (status = ANY (ARRAY[
      'pending', 'claimed', 'dispatched', 'failed', 'dead_letter', 'parked'
    ]::text[]));
EXCEPTION WHEN undefined_table THEN
  -- Fresh/partial environments where rvn_platform_outbox has not been
  -- created yet — nothing to extend, skip rather than fail the whole
  -- --safe chain (same defensive posture as
  -- 20260809_rvn_platform_canonical_object_type_extend.sql).
  NULL;
END $$;
