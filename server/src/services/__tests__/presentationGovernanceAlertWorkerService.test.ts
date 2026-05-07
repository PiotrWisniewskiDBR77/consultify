import { describe, expect, it } from 'vitest';

import {
  parseStoredSnapshot,
  runAlertWorkerCycle,
} from '../presentationGovernanceAlertWorkerService.js';
import type { WatchlistEntry } from '../presentationGovernanceWatchlistService.js';

function makeEntry(
  deckId: string,
  verdict: WatchlistEntry['card']['overallVerdict'],
  overrides: Partial<WatchlistEntry> = {}
): WatchlistEntry {
  return {
    deckId,
    title: `Deck ${deckId}`,
    confidentialityLevel: 'internal',
    updatedAt: '2026-05-07T07:00:00.000Z',
    card: {
      overallVerdict: verdict,
      quality: { p0: 0, p1: 0, p2: 0, gateCount: 0 },
      telemetry: { exportsBlocked: 0, lastActivityAt: null },
    },
    severityScore: 0,
    isBlocked: verdict === 'BLOCKED_P0' || verdict === 'BLOCKED_P1',
    ...overrides,
  };
}

describe('runAlertWorkerCycle', () => {
  const NOW = '2026-05-07T07:00:00.000Z';

  it('empty current + null state → no transitions, persists empty snapshot', () => {
    const out = runAlertWorkerCycle({
      state: { organizationId: 'org_acme', lastSnapshot: null },
      current: [],
      nowIso: NOW,
    });

    expect(out.transitions).toEqual([]);
    expect(out.nextSnapshotJson).toBe('[]');
    // Both prev and current are absent → nothing to persist.
    expect(out.shouldPersist).toBe(false);
  });

  it('bootstrap (state.lastSnapshot === null, current has BLOCKED_P0) → no alert, persists snapshot', () => {
    const out = runAlertWorkerCycle({
      state: { organizationId: 'org_acme', lastSnapshot: null },
      current: [makeEntry('deck_1', 'BLOCKED_P0')],
      nowIso: NOW,
    });

    expect(out.transitions).toEqual([]);
    expect(out.shouldPersist).toBe(true);
    const snapshot = JSON.parse(out.nextSnapshotJson);
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].deckId).toBe('deck_1');
    expect(snapshot[0].verdict).toBe('BLOCKED_P0');
  });

  it('stable (state has same blocked decks as current) → no transitions', () => {
    const blocked = [makeEntry('deck_1', 'BLOCKED_P0'), makeEntry('deck_2', 'BLOCKED_P1')];
    const out = runAlertWorkerCycle({
      state: { organizationId: 'org_acme', lastSnapshot: blocked },
      current: blocked,
      nowIso: NOW,
    });

    expect(out.transitions).toEqual([]);
    expect(out.shouldPersist).toBe(true);
  });

  it('new BLOCKED_P0 entry → 1 transition with fromVerdict = null', () => {
    const out = runAlertWorkerCycle({
      state: {
        organizationId: 'org_acme',
        lastSnapshot: [makeEntry('deck_existing', 'PASS')],
      },
      current: [makeEntry('deck_existing', 'PASS'), makeEntry('deck_new', 'BLOCKED_P0')],
      nowIso: NOW,
    });

    expect(out.transitions).toHaveLength(1);
    expect(out.transitions[0]).toEqual({
      deckId: 'deck_new',
      deckTitle: 'Deck deck_new',
      fromVerdict: null,
      toVerdict: 'BLOCKED_P0',
    });
  });

  it('P1 → P0 escalation → 1 transition', () => {
    const out = runAlertWorkerCycle({
      state: {
        organizationId: 'org_acme',
        lastSnapshot: [makeEntry('deck_1', 'BLOCKED_P1')],
      },
      current: [makeEntry('deck_1', 'BLOCKED_P0')],
      nowIso: NOW,
    });

    expect(out.transitions).toHaveLength(1);
    expect(out.transitions[0]).toEqual({
      deckId: 'deck_1',
      deckTitle: 'Deck deck_1',
      fromVerdict: 'BLOCKED_P1',
      toVerdict: 'BLOCKED_P0',
    });
  });

  it('P0 → PASS de-escalation → 0 transitions (rank decreased, not blocked)', () => {
    const out = runAlertWorkerCycle({
      state: {
        organizationId: 'org_acme',
        lastSnapshot: [makeEntry('deck_1', 'BLOCKED_P0')],
      },
      current: [makeEntry('deck_1', 'PASS')],
      nowIso: NOW,
    });

    expect(out.transitions).toEqual([]);
  });

  it('PASS → BLOCKED_P1 → 1 transition (escalation INTO a blocked verdict)', () => {
    const out = runAlertWorkerCycle({
      state: {
        organizationId: 'org_acme',
        lastSnapshot: [makeEntry('deck_1', 'PASS')],
      },
      current: [makeEntry('deck_1', 'BLOCKED_P1')],
      nowIso: NOW,
    });

    expect(out.transitions).toHaveLength(1);
    expect(out.transitions[0].fromVerdict).toBe('PASS');
    expect(out.transitions[0].toVerdict).toBe('BLOCKED_P1');
  });

  it('P0 stays at P0 → 0 transitions (rank did not strictly increase)', () => {
    const out = runAlertWorkerCycle({
      state: {
        organizationId: 'org_acme',
        lastSnapshot: [makeEntry('deck_1', 'BLOCKED_P0')],
      },
      current: [makeEntry('deck_1', 'BLOCKED_P0')],
      nowIso: NOW,
    });

    expect(out.transitions).toEqual([]);
  });
});

describe('parseStoredSnapshot', () => {
  it('returns null for invalid JSON', () => {
    expect(parseStoredSnapshot('not json')).toBeNull();
    expect(parseStoredSnapshot('')).toBeNull();
    expect(parseStoredSnapshot(null)).toBeNull();
    expect(parseStoredSnapshot(undefined)).toBeNull();
  });

  it('round-trips via runAlertWorkerCycle.nextSnapshotJson → diff baseline', () => {
    const baseline = runAlertWorkerCycle({
      state: { organizationId: 'org_acme', lastSnapshot: null },
      current: [makeEntry('deck_1', 'BLOCKED_P1')],
      nowIso: '2026-05-07T07:00:00.000Z',
    });

    const restored = parseStoredSnapshot(baseline.nextSnapshotJson);
    expect(restored).toHaveLength(1);
    expect(restored?.[0].deckId).toBe('deck_1');
    expect(restored?.[0].card.overallVerdict).toBe('BLOCKED_P1');

    const next = runAlertWorkerCycle({
      state: { organizationId: 'org_acme', lastSnapshot: restored },
      current: [makeEntry('deck_1', 'BLOCKED_P0')],
      nowIso: '2026-05-07T07:05:00.000Z',
    });

    expect(next.transitions).toHaveLength(1);
    expect(next.transitions[0].fromVerdict).toBe('BLOCKED_P1');
    expect(next.transitions[0].toVerdict).toBe('BLOCKED_P0');
  });
});
