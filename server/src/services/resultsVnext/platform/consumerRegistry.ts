/**
 * RN-G3 Outbox Dispatcher — consumer registry.
 *
 * Design: docs/product/results-vnext/RN_G3_OUTBOX_DISPATCHER_DESIGN.md §4.
 *
 * A static `consumer_group -> ConsumerFn` map, the dispatch-side mirror of
 * `atomicWrite.ts`'s `EVENT_TYPE_CONSUMER_GROUPS` write-side map (same
 * precedent this repo already committed to — EXECUTION_LEDGER.md §7 decyzja
 * #4: "statyczna mapa w kodzie… mniej ruchomych części na start"). A new
 * consumer group is added by writing its function and adding one line here —
 * `platformOutboxDrainCron.ts`'s tick loop never changes.
 */
import type { PoolClient } from 'pg';

import type { RvnOutboxRow } from './outboxDrain.js';

import { dispatchMyWorkProjection } from './myworkProjectionConsumer.js';

/**
 * Minimal shape of an `rvn_platform_events` row the way the dispatcher's
 * tick loop reads it back (JOIN of `rvn_platform_outbox.event_id` against
 * `rvn_platform_events`) — every column a consumer plausibly needs
 * (`payload` is deliberately thin per design §4, so a consumer generally
 * re-queries its own domain table using `aggregate_id`/`organization_id`
 * rather than trusting payload alone).
 */
export interface RvnPlatformEventRow {
  event_id: string;
  /** bigint identity column — node-pg returns bigint as a string. */
  sequence: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  organization_id: string;
  actor_user_id: string | null;
  actor_effective_role: string;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export type ConsumerFn = (
  client: PoolClient,
  event: RvnPlatformEventRow,
  outboxRow: RvnOutboxRow
) => Promise<void>;

/**
 * The ONE built consumer this slice ships. Everything else that has ever
 * appeared in `EVENT_TYPE_CONSUMER_GROUPS` either has zero producers (§9,
 * IO-B — `decisions_projection`/`notifications_projection`, left as dead
 * placeholders, no registry entry added for either) or is known-unbuilt
 * backlog (`finance_projection`, IO-C — see `UNBUILT_CONSUMER_GROUPS` below,
 * NOT registered here).
 */
export const CONSUMER_REGISTRY: Readonly<Record<string, ConsumerFn>> = {
  mywork_projection: dispatchMyWorkProjection,
};

/**
 * IO-C: consumer groups with LIVE producers (event types actually routing to
 * them in `atomicWrite.ts`'s `EVENT_TYPE_CONSUMER_GROUPS`) but no consumer
 * built yet. Rows for these groups PARK (a distinct terminal status, see
 * `outboxDrain.ts`'s `markParked`) instead of following the default
 * unregistered-group path (`markFailed` -> eventually `dead_letter` ->
 * CRITICAL alert) — the design's original uniform treatment would fire a
 * CRITICAL Slack alert on every single ROI case approval (`roi.case_approved`
 * is one of `finance_projection`'s 11 live event types), which is an
 * incident-shaped response to what is actually known backlog. A group that
 * is genuinely unregistered and NOT in this set still hard-fails and
 * dead-letters as designed (see `platformOutboxDrainCron.ts`'s tick body).
 *
 * `finance_projection` needs (§9, not built in this slice): the target
 * Finance read-model identified, a consumer function written and registered
 * above, then removed from this set. Until then its rows remain visible and
 * replayable, never silently dropped.
 */
export const UNBUILT_CONSUMER_GROUPS: ReadonlySet<string> = new Set(['finance_projection']);
