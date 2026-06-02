import { describe, expect, it } from 'vitest';

import { EMPTY_VALUE, safeDate, safeMoney, safeNumber, safePercent } from '@/utils/safeFormat';

describe('safeFormat utils', () => {
  it('coerces finite numeric values and falls back for invalid values', () => {
    expect(safeNumber(12)).toBe(12);
    expect(safeNumber('12.5')).toBe(12.5);
    expect(safeNumber(Number.POSITIVE_INFINITY, 7)).toBe(7);
    expect(safeNumber('not-a-number', 7)).toBe(7);
  });

  it('formats percentages from raw values or numerator and denominator pairs', () => {
    expect(safePercent(12.345, undefined, { decimals: 1 })).toBe('12.3%');
    expect(safePercent(1, 4)).toBe('25%');
    expect(safePercent(1, 0)).toBe(EMPTY_VALUE);
    expect(safePercent('bad', 4, { fallback: 'n/a' })).toBe('n/a');
  });

  it('formats valid dates and hides empty or invalid dates', () => {
    const date = new Date('2026-04-25T10:30:00.000Z');

    expect(safeDate(date)).toBe(date.toLocaleString());
    expect(safeDate('not-a-date')).toBe(EMPTY_VALUE);
    expect(safeDate(null, 'n/a')).toBe('n/a');
  });

  it('formats money and keeps invalid currency codes readable', () => {
    expect(safeMoney('12.5', 'USD', { locale: 'en-US' })).toBe('$12.50');
    expect(safeMoney('bad', 'USD')).toBe(EMPTY_VALUE);
    expect(safeMoney(12.5, 'INVALID')).toBe('12.50 INVALID');
  });
});
