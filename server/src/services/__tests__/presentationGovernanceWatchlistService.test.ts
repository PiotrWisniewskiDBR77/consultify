import { describe, expect, it } from 'vitest';

import {
  buildPresentationGovernanceWatchlist,
  type WatchlistEntryInput,
  type WatchlistVerdict,
} from '../presentationGovernanceWatchlistService.js';

interface RowOverrides {
  deckId?: string;
  title?: string;
  confidentialityLevel?: 'public' | 'internal' | 'confidential';
  updatedAt?: string | null;
  overallVerdict?: WatchlistVerdict;
  p0?: number;
  p1?: number;
  p2?: number;
  gateCount?: number;
  exportsBlocked?: number;
  lastActivityAt?: string | null;
}

function row(overrides: RowOverrides = {}): WatchlistEntryInput {
  const {
    deckId = `deck_${Math.random().toString(36).slice(2, 8)}`,
    title = 'Untitled Deck',
    confidentialityLevel = 'internal',
    updatedAt = '2026-05-01T00:00:00.000Z',
    overallVerdict = 'PASS',
    p0 = 0,
    p1 = 0,
    p2 = 0,
    gateCount = 0,
    exportsBlocked = 0,
    lastActivityAt = null,
  } = overrides;
  return {
    deckId,
    title,
    confidentialityLevel,
    updatedAt,
    card: {
      overallVerdict,
      quality: { p0, p1, p2, gateCount },
      telemetry: { exportsBlocked, lastActivityAt },
    },
  };
}

describe('presentationGovernanceWatchlistService', () => {
  it('sorts blocked decks first, then by severityScore desc', () => {
    const inputs: WatchlistEntryInput[] = [
      row({ deckId: 'pass1', overallVerdict: 'PASS' }),
      row({ deckId: 'p1_low', overallVerdict: 'BLOCKED_P1', p1: 1 }),
      row({ deckId: 'p0_high', overallVerdict: 'BLOCKED_P0', p0: 2, p1: 3, exportsBlocked: 1 }),
      row({ deckId: 'p1_high', overallVerdict: 'BLOCKED_P1', p1: 4, exportsBlocked: 2 }),
    ];

    const { entries } = buildPresentationGovernanceWatchlist(inputs);

    expect(entries.map((e) => e.deckId)).toEqual(['p0_high', 'p1_high', 'p1_low', 'pass1']);
    expect(entries[0]?.severityScore).toBe(2 * 100 + 3 * 10 + 0 + 1 * 5);
    expect(entries[1]?.severityScore).toBe(0 + 4 * 10 + 0 + 2 * 5);
    expect(entries[0]?.isBlocked).toBe(true);
    expect(entries[3]?.isBlocked).toBe(false);
  });

  it('breaks severity ties by updatedAt desc within blocked group', () => {
    const inputs: WatchlistEntryInput[] = [
      row({
        deckId: 'older',
        overallVerdict: 'BLOCKED_P1',
        p1: 1,
        updatedAt: '2026-04-01T00:00:00.000Z',
      }),
      row({
        deckId: 'newer',
        overallVerdict: 'BLOCKED_P1',
        p1: 1,
        updatedAt: '2026-05-01T00:00:00.000Z',
      }),
    ];

    const { entries } = buildPresentationGovernanceWatchlist(inputs);

    expect(entries.map((e) => e.deckId)).toEqual(['newer', 'older']);
  });

  it('filters to blocked-only when opts.onlyBlocked is true', () => {
    const inputs: WatchlistEntryInput[] = [
      row({ deckId: 'pass1', overallVerdict: 'PASS' }),
      row({ deckId: 'p2', overallVerdict: 'PASS_WITH_P2', p2: 2 }),
      row({ deckId: 'p1', overallVerdict: 'BLOCKED_P1', p1: 1 }),
      row({ deckId: 'p0', overallVerdict: 'BLOCKED_P0', p0: 1 }),
      row({ deckId: 'inc', overallVerdict: 'INCONCLUSIVE' }),
    ];

    const { entries } = buildPresentationGovernanceWatchlist(inputs, { onlyBlocked: true });

    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.isBlocked)).toBe(true);
    expect(entries.map((e) => e.deckId)).toEqual(['p0', 'p1']);
  });

  it('totals always reflect unfiltered input even when onlyBlocked filters entries', () => {
    const inputs: WatchlistEntryInput[] = [
      row({ overallVerdict: 'PASS' }),
      row({ overallVerdict: 'PASS' }),
      row({ overallVerdict: 'PASS_WITH_P2', p2: 1 }),
      row({ overallVerdict: 'BLOCKED_P1', p1: 1 }),
      row({ overallVerdict: 'BLOCKED_P0', p0: 1 }),
      row({ overallVerdict: 'BLOCKED_P0', p0: 2 }),
      row({ overallVerdict: 'INCONCLUSIVE' }),
    ];

    const { totals, entries } = buildPresentationGovernanceWatchlist(inputs, {
      onlyBlocked: true,
    });

    expect(totals).toEqual({
      decks: 7,
      blockedP0: 2,
      blockedP1: 1,
      passWithP2: 1,
      pass: 2,
      inconclusive: 1,
    });
    expect(entries).toHaveLength(3);
  });

  it('clamps limit between 1 and 200 with a default of 50', () => {
    const inputs: WatchlistEntryInput[] = Array.from({ length: 60 }, (_, i) =>
      row({ deckId: `d_${i}`, overallVerdict: 'PASS' })
    );

    const def = buildPresentationGovernanceWatchlist(inputs);
    expect(def.entries).toHaveLength(50);

    const huge = buildPresentationGovernanceWatchlist(inputs, { limit: 9999 });
    expect(huge.entries.length).toBeLessThanOrEqual(60);

    const tiny = buildPresentationGovernanceWatchlist(inputs, { limit: 0 });
    expect(tiny.entries).toHaveLength(1);

    const exact = buildPresentationGovernanceWatchlist(inputs, { limit: 5 });
    expect(exact.entries).toHaveLength(5);
  });

  it('handles empty input without throwing', () => {
    const result = buildPresentationGovernanceWatchlist([]);
    expect(result.entries).toEqual([]);
    expect(result.totals).toEqual({
      decks: 0,
      blockedP0: 0,
      blockedP1: 0,
      passWithP2: 0,
      pass: 0,
      inconclusive: 0,
    });
  });
});
