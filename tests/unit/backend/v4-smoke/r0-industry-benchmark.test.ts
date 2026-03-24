/**
 * R0 Smoke: V4-ASMT-01 — Industry Benchmark Service
 * Verifies: compareToBenchmarks() returns comparison data
 */

import industryBenchmarkService from '../../../../server/src/services/ai/industryBenchmarkService.js';

describe('V4-ASMT-01: Industry Benchmark Service', () => {
  it('compareToBenchmarks() returns an array', () => {
    const result = industryBenchmarkService.compareToBenchmarks('manufacturing', [
      { axis: 'digital_strategy', score: 3.5 },
      { axis: 'automation', score: 2.8 },
    ]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('compareToBenchmarks() items have axis, orgScore, industryAverage, gap', () => {
    const result = industryBenchmarkService.compareToBenchmarks('manufacturing', [
      { axis: 'digital_strategy', score: 3.5 },
    ]);
    if (result.length > 0) {
      const item = result[0];
      expect(item).toHaveProperty('axis');
      expect(item).toHaveProperty('orgScore');
      expect(item).toHaveProperty('industryAverage');
      expect(item).toHaveProperty('gap');
      expect(typeof item.gap).toBe('number');
    }
  });

  it('compareToBenchmarks() handles unknown industry gracefully', () => {
    const result = industryBenchmarkService.compareToBenchmarks('unknown_xyz', [
      { axis: 'digital_strategy', score: 3.0 },
    ]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('compareToBenchmarks() handles empty orgScores', () => {
    const result = industryBenchmarkService.compareToBenchmarks('manufacturing', []);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});
