import { describe, expect, it } from 'vitest';
import { buildKpiTrend } from '../kpiTrend.js';

const baseVersion: any = {
  definitionVersionId: 'v1',
  unit: null,
  rowVersion: 3,
  targetValue: 10,
  targetMin: 8,
  targetMax: 12,
  warningLow: 7,
  warningHigh: 13,
  criticalLow: 5,
  criticalHigh: 15,
  binarySuccessValue: 1,
};
const measurement = (value: number | null, day: number): any => ({
  measurementId: `m${day}`,
  periodStart: `2026-08-${day.toString().padStart(2, '0')}T00:00:00.000Z`,
  periodEnd: `2026-08-${day.toString().padStart(2, '0')}T23:00:00.000Z`,
  actualValue: value,
  dataQualityStatus: 'verified',
});

describe('Day 14 K.1 KPI trend', () => {
  for (const [geometry, values, expected] of [
    ['threshold_min', [5, 9], 'IMPROVING'],
    ['threshold_max', [15, 11], 'IMPROVING'],
    ['range', [5, 9], 'IMPROVING'],
    ['exact', [15, 11], 'IMPROVING'],
    ['binary', [0, 1], null],
    ['custom', [5, 9], null],
  ] as const) {
    it(`${geometry} returns ${expected ?? 'UNKNOWN'}`, () => {
      const result = buildKpiTrend({
        kpiId: 'k1',
        version: { ...baseVersion, targetGeometry: geometry },
        measurements: [measurement(values[0], 1), measurement(values[1], 2)],
        calculatedAt: 'now',
      });
      expect(result.direction).toBe(expected);
      expect(result.points).toHaveLength(2);
    });
  }
  it('distinguishes one real zero from missing data', () => {
    const result = buildKpiTrend({
      kpiId: 'k1',
      version: { ...baseVersion, targetGeometry: 'threshold_min' },
      measurements: [measurement(0, 1)],
      calculatedAt: 'now',
    });
    expect(result.points[0].actualValue).toBe(0);
    expect(result.direction).toBeNull();
    expect(result.directionReason).toBe('INSUFFICIENT_DATA');
  });
});
