import { describe, expect, it } from 'vitest';

import {
  computeAxisT,
  computeImpactGap,
  computeScheduleHealth,
} from '../threeAxisReportService';

describe('threeAxisReportService — W193 schedule/value split', () => {
  it('mierzy oś terminu z harmonogramu i postępu nawet bez kosztowego EVM', () => {
    const asOf = Date.parse('2026-07-01T00:00:00.000Z');
    const T = computeAxisT('2026-01-01', '2027-01-01', asOf);
    const schedule = computeScheduleHealth(T, 35, null);

    expect(T.pct).toBeGreaterThan(49);
    expect(schedule.ratio).toBeGreaterThan(0);
    expect(schedule.rag).not.toBe('NA');
  });

  it('zostawia oś wartości jako niezmierzoną z powodem, gdy brakuje baseline wartości', () => {
    const impact = computeImpactGap(
      { pct: null, dataQuality: 'missing', flags: ['no-value-baseline'] },
      { pct: 40, dataQuality: 'ok', flags: [] }
    );

    expect(impact).toEqual({ ratio: null, rag: 'NA', reason: 'no-value-baseline' });
  });
});
