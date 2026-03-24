/**
 * R0 Smoke: V4-ORG-01 / V4-ASMT-01 — Benchmark Service
 * Verifies: getBenchmark(), calculatePercentileSync(), getPercentileLabel()
 */

import BenchmarkingService from '../../../../server/src/services/benchmarkingService.js';

describe('V4-ORG-01: BenchmarkingService (static methods)', () => {
  it('getBenchmark() returns benchmark data for known industry', () => {
    const benchmark = BenchmarkingService.getBenchmark('manufacturing');
    expect(benchmark).toBeDefined();
    expect(typeof benchmark).toBe('object');
  });

  it('getBenchmark() returns a fallback for unknown industry', () => {
    const benchmark = BenchmarkingService.getBenchmark('nonexistent_industry_xyz');
    expect(benchmark).toBeDefined();
  });

  it('calculatePercentileSync() returns an object with percentile data', () => {
    const benchmark = BenchmarkingService.getBenchmark('manufacturing');
    if (!benchmark) return;
    const result = BenchmarkingService.calculatePercentileSync(3.5, benchmark);
    expect(result).toBeDefined();
    if (typeof result === 'number') {
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    } else if (typeof result === 'object' && result !== null) {
      expect(result).toHaveProperty('percentile');
    }
  });

  it('getPercentileLabel() returns expected labels', () => {
    expect(BenchmarkingService.getPercentileLabel(95)).toContain('Top');
    expect(BenchmarkingService.getPercentileLabel(50)).toBeDefined();
    expect(typeof BenchmarkingService.getPercentileLabel(25)).toBe('string');
  });
});
