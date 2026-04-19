/**
 * Chat V9 / TRUST T-TR1.3 — tests for the citations clipboard
 * formatter.
 *
 * Coverage:
 *   - Header rendering with / without a model label.
 *   - Empty / null / non-array citations → graceful "No cited sources"
 *     stub (never an empty clipboard).
 *   - Numbered list rendering with `[title](link)` when a link is
 *     present and plain title when it isn't.
 *   - Reference suffix rendered only when non-empty.
 *   - Pipe escaping in titles so paste-into-Notion-table round-trips.
 *   - Entries with empty-after-trim titles are skipped; all-empty
 *     lists fall back to the "No cited sources" stub.
 *   - Model label sanitisation: whitespace-only / non-string is
 *     dropped silently.
 */

import { describe, expect, it } from 'vitest';

import type { ChatCitation } from '@/types';

import { buildTrustBadgeCitationsText } from '../buildTrustBadgeCitationsText';

const citation = (overrides: Partial<ChatCitation> = {}): ChatCitation => ({
  id: 'c-1',
  title: 'Example source',
  type: 'external',
  reference: 'doc-1',
  ...overrides,
});

describe('buildTrustBadgeCitationsText', () => {
  it('renders a header without model when no label is provided', () => {
    const out = buildTrustBadgeCitationsText([citation()]);
    expect(out.split('\n')[0]).toBe('Sources for this reply:');
  });

  it('renders a header with the model label when provided', () => {
    const out = buildTrustBadgeCitationsText([citation()], {
      modelLabel: 'Claude 3.5 Sonnet',
    });
    expect(out.split('\n')[0]).toBe(
      'Sources for this reply (answered by Claude 3.5 Sonnet):'
    );
  });

  it('falls back to no-model header when modelLabel is empty / whitespace / non-string', () => {
    const expected = 'Sources for this reply:';
    expect(buildTrustBadgeCitationsText([citation()], { modelLabel: '' }).startsWith(expected)).toBe(
      true
    );
    expect(buildTrustBadgeCitationsText([citation()], { modelLabel: '   ' }).startsWith(expected)).toBe(
      true
    );
    expect(
      buildTrustBadgeCitationsText([citation()], {
        modelLabel: null as unknown as string,
      }).startsWith(expected)
    ).toBe(true);
  });

  it('renders the "No cited sources" stub for an empty list', () => {
    expect(buildTrustBadgeCitationsText([])).toBe(
      'Sources for this reply:\n\nNo cited sources.'
    );
  });

  it('renders the "No cited sources" stub for non-array input', () => {
    expect(buildTrustBadgeCitationsText(null)).toContain('No cited sources.');
    expect(buildTrustBadgeCitationsText(undefined)).toContain('No cited sources.');
  });

  it('numbers entries starting at 1', () => {
    const out = buildTrustBadgeCitationsText([
      citation({ id: 'c-1', title: 'Alpha' }),
      citation({ id: 'c-2', title: 'Beta' }),
      citation({ id: 'c-3', title: 'Gamma' }),
    ]);
    const lines = out.split('\n');
    expect(lines).toContain('1. Alpha — ref:doc-1');
    expect(lines).toContain('2. Beta — ref:doc-1');
    expect(lines).toContain('3. Gamma — ref:doc-1');
  });

  it('renders `[title](link)` when link is a non-empty string', () => {
    const out = buildTrustBadgeCitationsText([
      citation({
        title: 'Retention deck Q3',
        link: 'https://example.com/deck',
        reference: 'doc-12',
      }),
    ]);
    expect(out).toContain('1. [Retention deck Q3](https://example.com/deck) — ref:doc-12');
  });

  it('renders plain title when link is missing or empty', () => {
    expect(
      buildTrustBadgeCitationsText([citation({ title: 'No link', reference: '' })])
    ).toContain('1. No link');
    expect(
      buildTrustBadgeCitationsText([
        citation({ title: 'Empty link', link: '', reference: 'r' }),
      ])
    ).toContain('1. Empty link — ref:r');
  });

  it('omits the reference suffix when reference is missing / empty', () => {
    const out = buildTrustBadgeCitationsText([
      citation({ title: 'No ref', reference: '' }),
    ]);
    expect(out).toContain('1. No ref');
    expect(out).not.toContain('ref:');
  });

  it('escapes pipes in titles for Notion-table round-trip safety', () => {
    const out = buildTrustBadgeCitationsText([
      citation({ title: 'OKRs | 2026', reference: '' }),
    ]);
    expect(out).toContain('1. OKRs \\| 2026');
  });

  it('skips entries whose title is empty after trim', () => {
    const out = buildTrustBadgeCitationsText([
      citation({ title: '   ' }),
      citation({ title: 'Real one' }),
    ]);
    expect(out).toContain('1. Real one');
    expect(out.split('\n').filter((l) => /^\d+\./.test(l))).toHaveLength(1);
  });

  it('falls back to "No cited sources" when every entry has an empty title', () => {
    const out = buildTrustBadgeCitationsText([
      citation({ title: '' }),
      citation({ title: '   ' }),
    ]);
    expect(out).toContain('No cited sources.');
  });

  it('emits header + blank line + list in that exact order', () => {
    const out = buildTrustBadgeCitationsText(
      [citation({ title: 'A', reference: 'r' })],
      { modelLabel: 'GPT-4o' }
    );
    expect(out).toBe(
      'Sources for this reply (answered by GPT-4o):\n\n1. A — ref:r'
    );
  });
});
