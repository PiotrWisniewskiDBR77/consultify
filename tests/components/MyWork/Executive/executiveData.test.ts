/**
 * Unit tests for the Manager (Executive) dashboard data-credibility helpers.
 *
 * These guard the two regressions the owner flagged on the Manager tab:
 *   1. "TEAM CAPACITY 512% utilized" — an impossible reading caused by the
 *      backend dividing a lifetime task backlog by a single weekly budget.
 *   2. "Submit Compliance Documentation" appearing 3× in Action Required.
 */
import { describe, it, expect } from 'vitest';

import {
  interpretCapacity,
  dedupeActionItems,
  CAPACITY_ABSURD_THRESHOLD,
  type DedupableActionItem,
} from '../../../../src/components/MyWork/Executive/executiveData';

describe('interpretCapacity — capacity guard', () => {
  it('returns no-data for null input', () => {
    const r = interpretCapacity(null);
    expect(r.state).toBe('no-data');
    expect(r.displayValue).toBe('—');
  });

  it('renders a normal utilization as a real percent', () => {
    const r = interpretCapacity({ avgCapacity: 87, overloaded: 1, available: 2, memberCount: 5 });
    expect(r.state).toBe('ok');
    expect(r.displayValue).toBe('87%');
    expect(r.rawPercent).toBe(87);
    expect(r.hint).toBeNull();
  });

  it('does NOT render an absurd 512% as if it were real', () => {
    const r = interpretCapacity({
      avgCapacity: 512,
      overloaded: 4,
      available: 0,
      memberCount: 3,
    });
    expect(r.state).toBe('needs-config');
    expect(r.displayValue).toBe('—');
    // The raw value is preserved for debugging but never shown as the headline.
    expect(r.rawPercent).toBe(512);
    expect(r.hint).toBe('unbounded-estimates');
  });

  it('treats a zero-member team as needs-config, never "0% utilized"', () => {
    const r = interpretCapacity({ avgCapacity: 0, overloaded: 0, available: 0, memberCount: 0 });
    expect(r.state).toBe('needs-config');
    expect(r.displayValue).toBe('—');
    expect(r.hint).toBe('no-members');
  });

  it('treats NaN / non-finite utilization as no-data (no NaN%)', () => {
    const r = interpretCapacity({
      avgCapacity: Number.NaN,
      overloaded: 0,
      available: 0,
      memberCount: 4,
    });
    expect(r.state).toBe('no-data');
    expect(r.displayValue).toBe('—');
  });

  it('keeps a genuine short-term overload (just above 100%) visible', () => {
    const r = interpretCapacity({ avgCapacity: 118, overloaded: 2, available: 0, memberCount: 6 });
    expect(r.state).toBe('ok');
    expect(r.displayValue).toBe('118%');
  });

  it('flips to needs-config exactly past the absurd threshold', () => {
    const justOk = interpretCapacity({
      avgCapacity: CAPACITY_ABSURD_THRESHOLD,
      overloaded: 0,
      available: 0,
      memberCount: 3,
    });
    const absurd = interpretCapacity({
      avgCapacity: CAPACITY_ABSURD_THRESHOLD + 1,
      overloaded: 0,
      available: 0,
      memberCount: 3,
    });
    expect(justOk.state).toBe('ok');
    expect(absurd.state).toBe('needs-config');
  });

  it('rounds fractional utilization', () => {
    const r = interpretCapacity({ avgCapacity: 66.6, overloaded: 0, available: 1, memberCount: 4 });
    expect(r.displayValue).toBe('67%');
  });
});

describe('dedupeActionItems — Action Required de-duplication', () => {
  const mk = (over: Partial<DedupableActionItem>): DedupableActionItem => ({
    id: Math.random().toString(36).slice(2),
    type: 'task',
    title: 'Submit Compliance Documentation',
    ...over,
  });

  it('collapses the same title+initiative shown three times to one card', () => {
    const items = [
      mk({ id: 'a', initiativeName: 'AI Diagnosis' }),
      mk({ id: 'b', initiativeName: 'AI Diagnosis' }),
      mk({ id: 'c', initiativeName: 'AI Diagnosis' }),
    ];
    const out = dedupeActionItems(items);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a'); // keeps first occurrence
  });

  it('keeps the same title across DIFFERENT initiatives as distinct actions', () => {
    const items = [
      mk({ id: 'a', initiativeName: 'AI Diagnosis' }),
      mk({ id: 'b', initiativeName: 'ICT Transform' }),
    ];
    expect(dedupeActionItems(items)).toHaveLength(2);
  });

  it('is case- and whitespace-insensitive on the title', () => {
    const items = [
      mk({ id: 'a', title: 'Submit Compliance Documentation', initiativeName: 'X' }),
      mk({ id: 'b', title: '  submit   compliance  documentation ', initiativeName: 'X' }),
    ];
    expect(dedupeActionItems(items)).toHaveLength(1);
  });

  it('falls back to projectName when initiativeName is absent', () => {
    const items = [
      mk({ id: 'a', projectName: 'Proj A' }),
      mk({ id: 'b', projectName: 'Proj A' }),
    ];
    expect(dedupeActionItems(items)).toHaveLength(1);
  });

  it('does not merge a decision and a task that happen to share a title', () => {
    const items = [
      mk({ id: 'a', type: 'decision', initiativeName: 'X' }),
      mk({ id: 'b', type: 'task', initiativeName: 'X' }),
    ];
    expect(dedupeActionItems(items)).toHaveLength(2);
  });

  it('preserves order of first occurrences', () => {
    const items = [
      mk({ id: 'a', title: 'First', initiativeName: 'X' }),
      mk({ id: 'b', title: 'Second', initiativeName: 'X' }),
      mk({ id: 'c', title: 'First', initiativeName: 'X' }),
    ];
    const out = dedupeActionItems(items);
    expect(out.map((i) => i.title)).toEqual(['First', 'Second']);
  });

  it('handles null / empty input safely', () => {
    expect(dedupeActionItems(null)).toEqual([]);
    expect(dedupeActionItems(undefined)).toEqual([]);
    expect(dedupeActionItems([])).toEqual([]);
  });
});
