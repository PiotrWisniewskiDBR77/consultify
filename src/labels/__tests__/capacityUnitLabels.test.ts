import { describe, expect, it } from 'vitest';
import { capacityUnitLabel, capacityUnitLabelEntries } from '../capacityUnitLabels';

describe('capacityUnitLabel', () => {
  it('maps every supported unit in Polish and English', () => {
    expect(capacityUnitLabelEntries).toEqual({
      MONTH: { pl: 'miesiąc', en: 'month' },
      WEEK: { pl: 'tydzień', en: 'week' },
      'FTE-MONTH': { pl: 'miesiąc FTE', en: 'FTE-month' },
    });
    expect(capacityUnitLabel('MONTH', true)).toBe('miesiąc');
    expect(capacityUnitLabel('WEEK', true)).toBe('tydzień');
    expect(capacityUnitLabel('FTE-month', true)).toBe('miesiąc FTE');
    expect(capacityUnitLabel('MONTH', false)).toBe('month');
  });

  it('never exposes an unknown raw unit', () => {
    expect(capacityUnitLabel('FUTURE_UNIT', true)).toBe('nieznana jednostka');
    expect(capacityUnitLabel('FUTURE_UNIT', false)).toBe('unknown unit');
  });
});
