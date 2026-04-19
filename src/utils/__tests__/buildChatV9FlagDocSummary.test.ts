/**
 * Chat V9 / AG1 v1.7 — unit tests for the spec-doc summary helper
 * used by `ChatV9FlagsPanel` per-row breadcrumb.
 *
 * Contract we pin:
 *   - Missing / non-array `specDocs` → safe empty summary.
 *   - Blank / non-string entries are skipped, counts reflect only
 *     the cleaned list.
 *   - The first non-empty entry becomes `primary`.
 *   - `extraCount` is `totalCount - 1`.
 *   - `tooltip` joins the cleaned entries with `\n`, and is `''`
 *     when there are none.
 */

import { describe, expect, it } from 'vitest';

import type { ChatV9FlagDescriptor } from '../chatV9FeatureFlags';
import { buildChatV9FlagDocSummary } from '../buildChatV9FlagDocSummary';

function mk(specDocs: unknown): Pick<ChatV9FlagDescriptor, 'specDocs'> {
  return { specDocs: specDocs as ChatV9FlagDescriptor['specDocs'] };
}

describe('buildChatV9FlagDocSummary — empty / degraded inputs', () => {
  it('returns the empty summary for null / undefined input', () => {
    expect(buildChatV9FlagDocSummary(null)).toEqual({
      primary: null,
      extraCount: 0,
      tooltip: '',
      totalCount: 0,
    });
    expect(buildChatV9FlagDocSummary(undefined)).toEqual({
      primary: null,
      extraCount: 0,
      tooltip: '',
      totalCount: 0,
    });
  });

  it('returns the empty summary when specDocs is missing', () => {
    const result = buildChatV9FlagDocSummary({} as never);
    expect(result.primary).toBeNull();
    expect(result.totalCount).toBe(0);
  });

  it('returns the empty summary when specDocs is not an array', () => {
    const result = buildChatV9FlagDocSummary(mk('docs/foo.md'));
    expect(result.primary).toBeNull();
    expect(result.extraCount).toBe(0);
    expect(result.tooltip).toBe('');
  });

  it('returns the empty summary when specDocs is an empty array', () => {
    expect(buildChatV9FlagDocSummary(mk([]))).toEqual({
      primary: null,
      extraCount: 0,
      tooltip: '',
      totalCount: 0,
    });
  });

  it('returns the empty summary when every entry is blank or non-string', () => {
    const result = buildChatV9FlagDocSummary(mk(['   ', '', '\t\n', 42, null, undefined]));
    expect(result.primary).toBeNull();
    expect(result.totalCount).toBe(0);
  });
});

describe('buildChatV9FlagDocSummary — happy path', () => {
  it('returns a single-entry summary with extraCount=0', () => {
    const result = buildChatV9FlagDocSummary(mk(['docs/foo.md#a']));
    expect(result).toEqual({
      primary: 'docs/foo.md#a',
      extraCount: 0,
      tooltip: 'docs/foo.md#a',
      totalCount: 1,
    });
  });

  it('promotes the first entry to primary and counts the rest', () => {
    const result = buildChatV9FlagDocSummary(
      mk(['docs/plan.md#x', 'docs/telemetry.md#y', 'docs/runbook.md#z'])
    );
    expect(result.primary).toBe('docs/plan.md#x');
    expect(result.extraCount).toBe(2);
    expect(result.totalCount).toBe(3);
  });

  it('newline-joins the cleaned list into the tooltip', () => {
    const result = buildChatV9FlagDocSummary(mk(['docs/a.md', 'docs/b.md']));
    expect(result.tooltip).toBe('docs/a.md\ndocs/b.md');
  });

  it('trims surrounding whitespace from each entry', () => {
    const result = buildChatV9FlagDocSummary(
      mk(['  docs/a.md  ', '\tdocs/b.md\n'])
    );
    expect(result.primary).toBe('docs/a.md');
    expect(result.tooltip).toBe('docs/a.md\ndocs/b.md');
  });

  it('skips blanks but keeps real entries, renumbering extraCount', () => {
    const result = buildChatV9FlagDocSummary(
      mk(['   ', 'docs/a.md', '', 'docs/b.md', null])
    );
    expect(result.primary).toBe('docs/a.md');
    expect(result.extraCount).toBe(1);
    expect(result.totalCount).toBe(2);
    expect(result.tooltip).toBe('docs/a.md\ndocs/b.md');
  });
});
