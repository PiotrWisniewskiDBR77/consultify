import { describe, expect, it } from 'vitest';

import {
  buildHighlightSegments,
  escapeRegExp,
} from '../highlightTextMatch';

describe('highlightTextMatch - escapeRegExp', () => {
  it('escapes regex metacharacters but leaves alphanumerics alone', () => {
    expect(escapeRegExp('plain')).toBe('plain');
    expect(escapeRegExp('a.b*c+d?e^f${g}h(i)j|k[l]m\\n')).toBe(
      'a\\.b\\*c\\+d\\?e\\^f\\$\\{g\\}h\\(i\\)j\\|k\\[l\\]m\\\\n'
    );
  });

  it('returns empty string for non-string input without throwing', () => {
    expect(escapeRegExp(undefined as unknown as string)).toBe('');
    expect(escapeRegExp(null as unknown as string)).toBe('');
  });
});

describe('highlightTextMatch - buildHighlightSegments', () => {
  it('returns a single unmatched segment when the needle is empty or whitespace-only', () => {
    expect(buildHighlightSegments('Hello world', '')).toEqual([
      { text: 'Hello world', matched: false },
    ]);
    // Non-string needle (defensive) collapses to empty.
    expect(buildHighlightSegments('Hello world', undefined as unknown as string)).toEqual([
      { text: 'Hello world', matched: false },
    ]);
  });

  it('returns the haystack unchanged when no match is found', () => {
    expect(buildHighlightSegments('Project Phoenix', 'banana')).toEqual([
      { text: 'Project Phoenix', matched: false },
    ]);
  });

  it('extracts a single matched segment with the original casing preserved', () => {
    const segments = buildHighlightSegments('Project Phoenix Q4', 'phoenix');
    expect(segments).toEqual([
      { text: 'Project ', matched: false },
      { text: 'Phoenix', matched: true },
      { text: ' Q4', matched: false },
    ]);
  });

  it('emits alternating segments for multiple non-overlapping matches', () => {
    const segments = buildHighlightSegments('aXbXcXd', 'x');
    expect(segments).toEqual([
      { text: 'a', matched: false },
      { text: 'X', matched: true },
      { text: 'b', matched: false },
      { text: 'X', matched: true },
      { text: 'c', matched: false },
      { text: 'X', matched: true },
      { text: 'd', matched: false },
    ]);
  });

  it('treats regex metacharacters in the needle as literals (no regex escape required)', () => {
    // Without literal handling, `.` would match any char and `*`/`(` would
    // throw — we operate on indexOf so the needle is taken verbatim.
    expect(buildHighlightSegments('cost is $5.00 (USD)', '$5.00')).toEqual([
      { text: 'cost is ', matched: false },
      { text: '$5.00', matched: true },
      { text: ' (USD)', matched: false },
    ]);
    expect(buildHighlightSegments('foo.bar.baz', '.')).toEqual([
      { text: 'foo', matched: false },
      { text: '.', matched: true },
      { text: 'bar', matched: false },
      { text: '.', matched: true },
      { text: 'baz', matched: false },
    ]);
    expect(buildHighlightSegments('regex (.*) hello', '(.*)')).toEqual([
      { text: 'regex ', matched: false },
      { text: '(.*)', matched: true },
      { text: ' hello', matched: false },
    ]);
  });

  it('matches case-insensitively while keeping original casing in segments', () => {
    expect(buildHighlightSegments('PHOENIX phoenix Phoenix', 'PHOENIX')).toEqual([
      { text: 'PHOENIX', matched: true },
      { text: ' ', matched: false },
      { text: 'phoenix', matched: true },
      { text: ' ', matched: false },
      { text: 'Phoenix', matched: true },
    ]);
  });

  it('caps matches at 50 and emits the remainder as a single unmatched segment', () => {
    const haystack = 'a'.repeat(200);
    const segments = buildHighlightSegments(haystack, 'a');
    const matchedCount = segments.filter((s) => s.matched).length;
    expect(matchedCount).toBeLessThanOrEqual(50);
    expect(matchedCount).toBe(50);
    // The trailing 150 unmatched chars must be exposed as a single segment so
    // the rendered DOM stays bounded even on adversarial inputs.
    const trailing = segments[segments.length - 1];
    expect(trailing.matched).toBe(false);
    expect(trailing.text.length).toBe(150);
  });
});
