/**
 * M08 L-02 — filterEval: the shared table filter evaluator.
 *
 * Pins that the full FilterBuilder operator vocabulary actually filters, instead
 * of silently passing through (the pre-fix bug: only 6 operators handled, the
 * rest fell to `return true`).
 */
import { describe, expect, it } from 'vitest';

import { type EvaluableRow, evaluateFilterRule } from '../filterEval';

const row = (data: Record<string, unknown>): EvaluableRow => ({ data });

describe('evaluateFilterRule — text operators', () => {
  const r = row({ name: 'Hello World' });
  it('contains / doesNotContain', () => {
    expect(evaluateFilterRule({ column: 'name', operator: 'contains', value: 'world' }, r)).toBe(
      true
    );
    expect(
      evaluateFilterRule({ column: 'name', operator: 'doesNotContain', value: 'xyz' }, r)
    ).toBe(true);
    expect(
      evaluateFilterRule({ column: 'name', operator: 'doesNotContain', value: 'hello' }, r)
    ).toBe(false);
  });
  it('startsWith / endsWith', () => {
    expect(evaluateFilterRule({ column: 'name', operator: 'startsWith', value: 'hello' }, r)).toBe(
      true
    );
    expect(evaluateFilterRule({ column: 'name', operator: 'endsWith', value: 'world' }, r)).toBe(
      true
    );
    expect(evaluateFilterRule({ column: 'name', operator: 'startsWith', value: 'world' }, r)).toBe(
      false
    );
  });
  it('equals / notEquals (and is/isNot aliases)', () => {
    expect(
      evaluateFilterRule({ column: 'name', operator: 'equals', value: 'hello world' }, r)
    ).toBe(true);
    expect(evaluateFilterRule({ column: 'name', operator: 'notEquals', value: 'nope' }, r)).toBe(
      true
    );
    expect(evaluateFilterRule({ column: 'name', operator: 'isNot', value: 'hello world' }, r)).toBe(
      false
    );
  });
});

describe('evaluateFilterRule — emptiness (both naming conventions)', () => {
  it('isEmpty and is_empty agree', () => {
    const empty = row({ name: '' });
    expect(evaluateFilterRule({ column: 'name', operator: 'isEmpty', value: '' }, empty)).toBe(
      true
    );
    expect(evaluateFilterRule({ column: 'name', operator: 'is_empty', value: '' }, empty)).toBe(
      true
    );
  });
  it('isNotEmpty and not_empty agree', () => {
    const filled = row({ name: 'x' });
    expect(evaluateFilterRule({ column: 'name', operator: 'isNotEmpty', value: '' }, filled)).toBe(
      true
    );
    expect(evaluateFilterRule({ column: 'name', operator: 'not_empty', value: '' }, filled)).toBe(
      true
    );
  });
});

describe('evaluateFilterRule — numeric', () => {
  const r = row({ score: 50 });
  it('gt / gte / lt / lte', () => {
    expect(evaluateFilterRule({ column: 'score', operator: 'gt', value: 40 }, r)).toBe(true);
    expect(evaluateFilterRule({ column: 'score', operator: 'gte', value: 50 }, r)).toBe(true);
    expect(evaluateFilterRule({ column: 'score', operator: 'lt', value: 50 }, r)).toBe(false);
    expect(evaluateFilterRule({ column: 'score', operator: 'lte', value: 50 }, r)).toBe(true);
  });
  it('between (array and "a,b" string)', () => {
    expect(
      evaluateFilterRule({ column: 'score', operator: 'between', value: ['10', '60'] }, r)
    ).toBe(true);
    expect(evaluateFilterRule({ column: 'score', operator: 'between', value: '10,40' }, r)).toBe(
      false
    );
  });
});

describe('evaluateFilterRule — set membership', () => {
  const r = row({ status: 'active' });
  it('in / isAnyOf / isNoneOf', () => {
    expect(
      evaluateFilterRule({ column: 'status', operator: 'in', value: 'active,paused' }, r)
    ).toBe(true);
    expect(
      evaluateFilterRule({ column: 'status', operator: 'isAnyOf', value: ['done', 'active'] }, r)
    ).toBe(true);
    expect(
      evaluateFilterRule({ column: 'status', operator: 'isNoneOf', value: 'done,paused' }, r)
    ).toBe(true);
    expect(evaluateFilterRule({ column: 'status', operator: 'isNoneOf', value: 'active' }, r)).toBe(
      false
    );
  });
});

describe('evaluateFilterRule — dates', () => {
  const r = row({ due: '2026-06-15' });
  const NOW = new Date('2026-06-17T12:00:00Z');
  it('isBefore / isAfter / isOnOrBefore / isOnOrAfter', () => {
    expect(
      evaluateFilterRule({ column: 'due', operator: 'isBefore', value: '2026-06-16' }, r)
    ).toBe(true);
    expect(evaluateFilterRule({ column: 'due', operator: 'isAfter', value: '2026-06-16' }, r)).toBe(
      false
    );
    expect(
      evaluateFilterRule({ column: 'due', operator: 'isOnOrBefore', value: '2026-06-15' }, r)
    ).toBe(true);
    expect(
      evaluateFilterRule({ column: 'due', operator: 'isOnOrAfter', value: '2026-06-15' }, r)
    ).toBe(true);
  });
  it('isWithin pastWeek (relative to injected now)', () => {
    expect(
      evaluateFilterRule({ column: 'due', operator: 'isWithin', value: 'pastWeek' }, r, NOW)
    ).toBe(true);
    const old = row({ due: '2025-01-01' });
    expect(
      evaluateFilterRule({ column: 'due', operator: 'isWithin', value: 'pastWeek' }, old, NOW)
    ).toBe(false);
  });
});

describe('evaluateFilterRule — unknown operator', () => {
  it('does not silently drop rows (returns true)', () => {
    expect(
      evaluateFilterRule({ column: 'x', operator: 'totally_unknown', value: 'y' }, row({ x: 'z' }))
    ).toBe(true);
  });
});
