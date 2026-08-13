-- RN-G3 Outbox Dispatcher — consumer-side idempotency ledger.
--
-- Design: docs/product/results-vnext/RN_G3_OUTBOX_DISPATCHER_DESIGN.md §5.
--
-- Why a NEW table rather than reusing an existing dedup mechanism (design §5,
-- verbatim rationale): `rvn_platform_obligations.deduplication_key` guards
-- against a duplicate DOMAIN COMMAND, not against the DISPATCHER redelivering
-- the same outbox row under at-least-once semantics — a different axis at a
-- different layer, and most mywork-routed event types never touch
-- obligations at all. The `notifications` INSERT this consumer performs has
-- no natural key whatsoever; a second delivery would insert a second row
-- with nothing to conflict on. This table is the layer that makes
-- "(consumer_group, event_id) already applied its side effects" a single,
-- checkable fact, using the exact `ON CONFLICT ... DO NOTHING` pattern
-- already used twice in this codebase (`rvn_platform_events.idempotency_key`,
-- `rvn_platform_obligations.deduplication_key`) — a new layer, not a new
-- pattern.
CREATE TABLE IF NOT EXISTS rvn_platform_consumer_processed (
  consumer_group  TEXT NOT NULL,
  event_id        UUID NOT NULL REFERENCES rvn_platform_events(event_id),
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_group, event_id)
);
