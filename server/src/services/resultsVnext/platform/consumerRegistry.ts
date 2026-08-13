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
import { dispatchFinanceProjection } from './financeProjectionConsumer.js';

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
 * RN-G6 (2026-08-10, docs/product/results-vnext/RN_G6_FINANCE_PROJECTION_
 * DESIGN.md): `finance_projection` graduated from `UNBUILT_CONSUMER_GROUPS`
 * to a real, registered consumer (`dispatchFinanceProjection`,
 * `financeProjectionConsumer.ts`) — the second consumer built against this
 * dispatcher, and proof the registry pattern needed zero dispatcher changes
 * to add it (exactly the one line below + this file's other one-line diff).
 * `mywork_projection` remains the first. Everything else that has ever
 * appeared as a routing target in `atomicWrite.ts`'s
 * `EVENT_TYPE_CONSUMER_GROUPS` is `decisions_projection`/
 * `notifications_projection` — RETIRED, not pending (2026-08-10 contract
 * correction, EXECUTION_LEDGER.md §51; see `atomicWrite.ts`'s own "RETIRED
 * VOCABULARY" comment for the full rationale). Neither ever routed a single
 * event type — they existed only as a comment reserving the names.
 * `decisions_projection` has no producer (`DecisionController.ts` emits no
 * `rvn_platform_events`) and `notifications_projection` would duplicate
 * `mywork_projection`'s own already-shipped `notifications` INSERT. Retired
 * groups get NO entry in either map below — not `CONSUMER_REGISTRY`, not
 * `UNBUILT_CONSUMER_GROUPS` — because no event ever routes to them; the
 * contract test in `tests/resultsVnext/platform/consumerGroupContract.test.ts`
 * asserts exactly that (every group `EVENT_TYPE_CONSUMER_GROUPS` actually
 * routes to is registered-or-unbuilt, so a retired name silently regaining a
 * routing entry would fail it, not fall into the void).
 */
export const CONSUMER_REGISTRY: Readonly<Record<string, ConsumerFn>> = {
  mywork_projection: dispatchMyWorkProjection,
  finance_projection: dispatchFinanceProjection,
};

/**
 * IO-C: consumer groups with LIVE producers (event types actually routing to
 * them in `atomicWrite.ts`'s `EVENT_TYPE_CONSUMER_GROUPS`) but no consumer
 * built yet. Rows for these groups PARK (a distinct terminal status, see
 * `outboxDrain.ts`'s `markParked`) instead of following the default
 * unregistered-group path (`markFailed` -> eventually `dead_letter` ->
 * CRITICAL alert). A group that is genuinely unregistered and NOT in this
 * set still hard-fails and dead-letters as designed (see
 * `platformOutboxDrainCron.ts`'s tick body).
 *
 * Empty as of RN-G6 (2026-08-10) — `finance_projection` was the only member
 * and is now registered above. Previously-parked `finance_projection` rows
 * are replayable as-is: `markParked` never touched `attempts`/
 * `next_attempt_at`, so the next drain tick claims them via the normal
 * `status IN ('pending','failed')` predicate the moment their status is
 * flipped back to `pending` (a one-time backfill, not built in this slice —
 * see this package's EXECUTION_LEDGER.md closure entry for the exact
 * UPDATE and why it is deliberately left as a manual/ops step rather than
 * code this migration runs automatically).
 */
export const UNBUILT_CONSUMER_GROUPS: ReadonlySet<string> = new Set();
