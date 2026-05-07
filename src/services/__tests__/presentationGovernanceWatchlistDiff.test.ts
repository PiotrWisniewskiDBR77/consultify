import { describe, expect, it } from 'vitest';

import type { WatchlistEntry } from '../presentationGovernanceWatchlist';
import { diffWatchlistForNewBlockers } from '../presentationGovernanceWatchlistDiff';

function makeEntry(
  deckId: string,
  overallVerdict: WatchlistEntry['overallVerdict'],
  overrides: Partial<WatchlistEntry> = {}
): WatchlistEntry {
  return {
    deckId,
    title: `Deck ${deckId}`,
    confidentialityLevel: 'internal',
    updatedAt: '2026-05-07T00:00:00.000Z',
    overallVerdict,
    p0: 0,
    p1: 0,
    p2: 0,
    gateCount: 0,
    exportsBlocked: 0,
    lastActivityAt: null,
    severityScore: 0,
    ...overrides,
  };
}

describe('diffWatchlistForNewBlockers', () => {
  it('reports a transition when a brand-new deck appears already at BLOCKED_P0', () => {
    const previous: WatchlistEntry[] = [];
    const current = [makeEntry('deck-new', 'BLOCKED_P0')];

    const transitions = diffWatchlistForNewBlockers(previous, current);

    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toEqual({
      deckId: 'deck-new',
      title: 'Deck deck-new',
      fromVerdict: null,
      toVerdict: 'BLOCKED_P0',
    });
  });

  it('reports a transition when a PASS deck becomes BLOCKED_P1', () => {
    const previous = [makeEntry('deck-1', 'PASS')];
    const current = [makeEntry('deck-1', 'BLOCKED_P1')];

    const transitions = diffWatchlistForNewBlockers(previous, current);

    expect(transitions).toEqual([
      {
        deckId: 'deck-1',
        title: 'Deck deck-1',
        fromVerdict: 'PASS',
        toVerdict: 'BLOCKED_P1',
      },
    ]);
  });

  it('reports an escalation when a deck moves from BLOCKED_P1 to BLOCKED_P0', () => {
    const previous = [makeEntry('deck-1', 'BLOCKED_P1')];
    const current = [makeEntry('deck-1', 'BLOCKED_P0')];

    const transitions = diffWatchlistForNewBlockers(previous, current);

    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({
      deckId: 'deck-1',
      fromVerdict: 'BLOCKED_P1',
      toVerdict: 'BLOCKED_P0',
    });
  });

  it('does not report a transition when a deck stays at BLOCKED_P0', () => {
    const previous = [makeEntry('deck-1', 'BLOCKED_P0')];
    const current = [makeEntry('deck-1', 'BLOCKED_P0')];

    expect(diffWatchlistForNewBlockers(previous, current)).toEqual([]);
  });

  it('does not report a transition when a deck de-escalates from BLOCKED_P0 to PASS', () => {
    const previous = [makeEntry('deck-1', 'BLOCKED_P0')];
    const current = [makeEntry('deck-1', 'PASS')];

    expect(diffWatchlistForNewBlockers(previous, current)).toEqual([]);
  });

  it('returns no transitions when current is empty even if previous has blocked decks', () => {
    const previous = [makeEntry('deck-1', 'BLOCKED_P0'), makeEntry('deck-2', 'BLOCKED_P1')];
    const current: WatchlistEntry[] = [];

    expect(diffWatchlistForNewBlockers(previous, current)).toEqual([]);
  });

  it('does not report a transition when a BLOCKED_P0 deck de-escalates to BLOCKED_P1', () => {
    const previous = [makeEntry('deck-1', 'BLOCKED_P0')];
    const current = [makeEntry('deck-1', 'BLOCKED_P1')];

    expect(diffWatchlistForNewBlockers(previous, current)).toEqual([]);
  });
});
