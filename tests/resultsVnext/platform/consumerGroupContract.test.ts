import { describe, expect, it } from 'vitest';

import { EVENT_TYPE_CONSUMER_GROUPS } from '../../../server/src/services/resultsVnext/platform/atomicWrite.js';
import { CONSUMER_REGISTRY, UNBUILT_CONSUMER_GROUPS } from '../../../server/src/services/resultsVnext/platform/consumerRegistry.js';

/**
 * RN-G3 Outbox Dispatcher — consumer-group contract test.
 *
 * Design: EXECUTION_LEDGER.md §50 (2026-08-10 contract correction).
 *
 * The bug class this guards against: `atomicWrite.ts`'s
 * `EVENT_TYPE_CONSUMER_GROUPS` (the write-side routing map) and
 * `consumerRegistry.ts`'s `CONSUMER_REGISTRY`/`UNBUILT_CONSUMER_GROUPS` (the
 * dispatch-side registry) are two independently-maintained static maps with
 * no compiler-enforced link between them. Before this correction,
 * `atomicWrite.ts` carried a comment reserving 'decisions_projection' and
 * 'notifications_projection' as future consumer-group names — reserved
 * vocabulary that was never wired to an actual routing entry, but nothing
 * would have stopped a future edit from adding
 * `'some.event': ['decisions_projection']` to the map without also adding a
 * consumer or an UNBUILT_CONSUMER_GROUPS entry. Had that happened, every
 * event of that type would route into the void: `resolveConsumerGroups`
 * would happily return the group, `executeAtomicCommand` would insert an
 * outbox row for it, and `platformOutboxDrainCron.ts`'s tick loop would find
 * no registered consumer AND no UNBUILT_CONSUMER_GROUPS entry for it — the
 * "genuinely unregistered" path, which hard-fails and dead-letters (see
 * `consumerRegistry.ts`'s own doc comment on `UNBUILT_CONSUMER_GROUPS`).
 * That is a silent-drop-shaped production incident, not a compile error.
 *
 * This test makes that class of bug structurally impossible to reintroduce:
 * every consumer-group string that ANY event type in
 * `EVENT_TYPE_CONSUMER_GROUPS` actually routes to must be either a live key
 * in `CONSUMER_REGISTRY` or a member of `UNBUILT_CONSUMER_GROUPS`. A group
 * that is neither fails this test immediately, at the map level, instead of
 * waiting to be discovered by a real event flowing through the dispatcher.
 */
describe('resultsVnext/platform consumer-group contract', () => {
  it('every routed consumer group is registered or explicitly unbuilt', () => {
    const routedGroups = new Set<string>();
    for (const groups of Object.values(EVENT_TYPE_CONSUMER_GROUPS)) {
      for (const group of groups) {
        routedGroups.add(group);
      }
    }

    const registeredGroups = new Set(Object.keys(CONSUMER_REGISTRY));
    const orphaned = [...routedGroups].filter(
      (group) => !registeredGroups.has(group) && !UNBUILT_CONSUMER_GROUPS.has(group)
    );

    expect(orphaned).toEqual([]);
  });

  it('sanity: the routing map is non-trivial and actually exercises the assertion above', () => {
    // Guards against the contract test above passing vacuously (e.g. an
    // accidentally-emptied EVENT_TYPE_CONSUMER_GROUPS would make the first
    // assertion trivially true for the wrong reason).
    expect(Object.keys(EVENT_TYPE_CONSUMER_GROUPS).length).toBeGreaterThan(50);

    const routedGroups = new Set<string>();
    for (const groups of Object.values(EVENT_TYPE_CONSUMER_GROUPS)) {
      for (const group of groups) {
        routedGroups.add(group);
      }
    }
    expect(routedGroups.has('mywork_projection')).toBe(true);
    expect(routedGroups.has('finance_projection')).toBe(true);
  });

  it('the retired vocabulary never regains a routing entry', () => {
    // Directly pins the specific regression this correction closes: these
    // two names must never appear as a routing target. If a future change
    // reintroduces either as a live group, this fails BEFORE the general
    // orphan-check above would even need to — cheaper to diagnose.
    const routedGroups = new Set<string>();
    for (const groups of Object.values(EVENT_TYPE_CONSUMER_GROUPS)) {
      for (const group of groups) {
        routedGroups.add(group);
      }
    }

    expect(routedGroups.has('decisions_projection')).toBe(false);
    expect(routedGroups.has('notifications_projection')).toBe(false);
  });

  it('finance_projection is pending (unbuilt), not retired', () => {
    expect(UNBUILT_CONSUMER_GROUPS.has('finance_projection')).toBe(true);
    expect(CONSUMER_REGISTRY.finance_projection).toBeUndefined();
  });

  it('mywork_projection is the one live, registered consumer', () => {
    expect(typeof CONSUMER_REGISTRY.mywork_projection).toBe('function');
    expect(UNBUILT_CONSUMER_GROUPS.has('mywork_projection')).toBe(false);
  });
});
