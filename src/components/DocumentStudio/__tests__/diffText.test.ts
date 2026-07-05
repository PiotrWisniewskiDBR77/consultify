/**
 * B3 — unit specs for the pure token-level text diff (diffText.ts).
 */

import { describe, expect, it } from 'vitest';

import { diffTextSegments, summarizeDiffSegments, tokenizeForDiff } from '../diffText';

describe('tokenizeForDiff', () => {
  it('returns [] for empty input', () => {
    expect(tokenizeForDiff('')).toEqual([]);
  });

  it('is lossless — join reproduces the input exactly', () => {
    const input = '  Ala ma\tkota, a kot — ma Alę.\nDruga linia. ';
    expect(tokenizeForDiff(input).join('')).toBe(input);
  });

  it('keeps accented (PL) words as single tokens', () => {
    expect(tokenizeForDiff('wdrożenie systemów')).toEqual(['wdrożenie', ' ', 'systemów']);
  });
});

describe('diffTextSegments', () => {
  it('returns a single equal segment when nothing changed', () => {
    const segments = diffTextSegments('Ten sam tekst.', 'Ten sam tekst.');
    expect(segments).toEqual([{ kind: 'equal', value: 'Ten sam tekst.' }]);
  });

  it('returns [] when both sides are empty', () => {
    expect(diffTextSegments('', '')).toEqual([]);
  });

  it('marks a changed word as removed + added, keeping context equal', () => {
    const segments = diffTextSegments('The quick brown fox', 'The slow brown fox');
    expect(segments.filter((s) => s.kind === 'removed').map((s) => s.value.trim())).toEqual([
      'quick',
    ]);
    expect(segments.filter((s) => s.kind === 'added').map((s) => s.value.trim())).toEqual([
      'slow',
    ]);
    // Reconstruction invariants:
    const before = segments
      .filter((s) => s.kind !== 'added')
      .map((s) => s.value)
      .join('');
    const after = segments
      .filter((s) => s.kind !== 'removed')
      .map((s) => s.value)
      .join('');
    expect(before).toBe('The quick brown fox');
    expect(after).toBe('The slow brown fox');
  });

  it('treats pure addition (empty before) as one added segment', () => {
    expect(diffTextSegments('', 'Nowy akapit.')).toEqual([
      { kind: 'added', value: 'Nowy akapit.' },
    ]);
  });

  it('treats pure removal (empty after) as one removed segment', () => {
    expect(diffTextSegments('Stary akapit.', '')).toEqual([
      { kind: 'removed', value: 'Stary akapit.' },
    ]);
  });

  it('diffs PL text word-by-word (not letter-by-letter)', () => {
    const segments = diffTextSegments('wdrożenie systemu ERP', 'wdrożenie procesu ERP');
    expect(segments.filter((s) => s.kind === 'removed').map((s) => s.value)).toEqual(['systemu']);
    expect(segments.filter((s) => s.kind === 'added').map((s) => s.value)).toEqual(['procesu']);
  });

  it('never emits two adjacent segments of the same kind', () => {
    const segments = diffTextSegments(
      'Raz dwa trzy cztery pięć',
      'Raz DWA TRZY cztery sześć siedem'
    );
    for (let i = 1; i < segments.length; i += 1) {
      expect(segments[i].kind).not.toBe(segments[i - 1].kind);
    }
  });

  it('handles appended sentences', () => {
    const segments = diffTextSegments('Pierwsze zdanie.', 'Pierwsze zdanie. Drugie zdanie.');
    expect(segments[0]).toEqual({ kind: 'equal', value: 'Pierwsze zdanie.' });
    expect(segments.at(-1)?.kind).toBe('added');
    expect(segments.at(-1)?.value).toContain('Drugie zdanie.');
  });
});

describe('summarizeDiffSegments', () => {
  it('reports no changes for an equal-only diff', () => {
    const stats = summarizeDiffSegments(diffTextSegments('abc', 'abc'));
    expect(stats).toEqual({ hasChanges: false, addedSegmentCount: 0, removedSegmentCount: 0 });
  });

  it('counts added and removed segments', () => {
    const stats = summarizeDiffSegments(diffTextSegments('a b c', 'a X c Y'));
    expect(stats.hasChanges).toBe(true);
    expect(stats.addedSegmentCount).toBeGreaterThan(0);
    expect(stats.removedSegmentCount).toBeGreaterThan(0);
  });
});
