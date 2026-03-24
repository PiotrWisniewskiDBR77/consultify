/**
 * Behavior-based tests for tableTypes utilities.
 * Tests: formula evaluation, aggregation computation, status options.
 */
import { describe, expect, it } from 'vitest';

import {
  computeAggregation,
  evaluateFormula,
  STATUS_OPTIONS,
} from '@/components/MyWork/table/tableTypes';

describe('evaluateFormula', () => {
  it('evaluates simple arithmetic', () => {
    expect(evaluateFormula('{a} + {b}', { a: 10, b: 20 })).toBe(30);
  });

  it('handles missing fields as 0', () => {
    expect(evaluateFormula('{a} + {missing}', { a: 5 })).toBe(5);
  });

  it('returns "—" on error', () => {
    expect(evaluateFormula('invalid(', {})).toBe('—');
  });

  it('rounds to 2 decimal places', () => {
    const result = evaluateFormula('{a} / {b}', { a: 10, b: 3 });
    expect(result).toBe(3.33);
  });
});

describe('computeAggregation', () => {
  it('computes sum', () => {
    expect(computeAggregation('sum', [10, 20, 30])).toBe('60');
  });

  it('computes avg', () => {
    expect(computeAggregation('avg', [10, 20, 30])).toBe('20');
  });

  it('computes count', () => {
    expect(computeAggregation('count', [10, 20, 30])).toBe('3');
  });

  it('computes min', () => {
    expect(computeAggregation('min', [10, 5, 30])).toBe('5');
  });

  it('computes max', () => {
    expect(computeAggregation('max', [10, 5, 30])).toBe('30');
  });

  it('returns empty for "none"', () => {
    expect(computeAggregation('none', [10])).toBe('');
  });

  it('handles non-numeric values (null coerces to 0)', () => {
    expect(computeAggregation('sum', ['abc', undefined, null])).toBe('0');
    expect(computeAggregation('min', ['abc', undefined])).toBe('—');
  });

  it('returns "0" for count with no valid numbers', () => {
    expect(computeAggregation('count', ['abc', undefined])).toBe('0');
  });
});

describe('STATUS_OPTIONS', () => {
  it('has 4 semantic states', () => {
    expect(STATUS_OPTIONS.length).toBe(4);
    expect(STATUS_OPTIONS.map((s) => s.value)).toEqual([
      'todo', 'in_progress', 'done', 'blocked',
    ]);
  });

  it('each option has en, pl labels and color', () => {
    for (const opt of STATUS_OPTIONS) {
      expect(opt.en).toBeTruthy();
      expect(opt.pl).toBeTruthy();
      expect(opt.color).toMatch(/^#/);
    }
  });
});
