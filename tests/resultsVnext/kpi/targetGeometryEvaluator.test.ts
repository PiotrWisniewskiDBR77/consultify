import { describe, expect, it } from 'vitest';

import {
  evaluatePerformanceStatus,
  type TargetGeometryEvaluationInput,
} from '../../../server/src/services/resultsVnext/kpi/targetGeometryEvaluator.js';
import type { KpiPerformanceStatus } from '../../../server/src/services/resultsVnext/kpi/kpiTypes.js';

/**
 * KPI-E001/E002 — `evaluatePerformanceStatus()` boundary matrix.
 *
 * Design: docs/product/results-vnext/KPI_E001_E002_DESIGN.md §C, decyzje
 * #7 (Boundary Rule — "the threshold value belongs to the safer/
 * nearer-target zone, crossing requires strict inequality"), #9 (`custom`
 * always `neutral`), #10 (`exact` without critical bounds -> binary
 * on_target/critical, no warning zone). Every boundary case below is
 * chosen to prove the "belongs to the safer zone, strict inequality to
 * cross" rule at EVERY zone transition for EVERY geometry, not just the
 * happy path.
 */

interface Case {
  description: string;
  input: TargetGeometryEvaluationInput;
  expected: KpiPerformanceStatus;
}

function run(cases: Case[]) {
  it.each(cases.map((c) => [c.description, c.input, c.expected] as const))(
    '%s',
    (_description, input, expected) => {
      expect(evaluatePerformanceStatus(input)).toBe(expected);
    }
  );
}

describe('evaluatePerformanceStatus — missing input always neutral (never a fabricated status)', () => {
  run([
    {
      description: 'actualValue null -> neutral (threshold_min, otherwise-valid bounds)',
      input: { geometry: 'threshold_min', actualValue: null, targetValue: 80, warningLow: 70 },
      expected: 'neutral',
    },
    {
      description: 'actualValue undefined -> neutral (range, otherwise-valid bounds)',
      input: { geometry: 'range', actualValue: undefined, targetMin: 10, targetMax: 20 },
      expected: 'neutral',
    },
    {
      description: 'actualValue NaN -> neutral, not treated as a number',
      input: { geometry: 'exact', actualValue: NaN, targetValue: 100 },
      expected: 'neutral',
    },
    {
      description: 'threshold_min missing targetValue -> neutral, never falls back to 0',
      input: { geometry: 'threshold_min', actualValue: 50 },
      expected: 'neutral',
    },
    {
      description: 'threshold_max missing targetValue -> neutral',
      input: { geometry: 'threshold_max', actualValue: 50 },
      expected: 'neutral',
    },
    {
      description: 'range missing targetMax (only targetMin present) -> neutral, not treated as threshold',
      input: { geometry: 'range', actualValue: 15, targetMin: 10 },
      expected: 'neutral',
    },
    {
      description: 'range missing targetMin (only targetMax present) -> neutral',
      input: { geometry: 'range', actualValue: 15, targetMax: 20 },
      expected: 'neutral',
    },
    {
      description: 'exact missing targetValue -> neutral',
      input: { geometry: 'exact', actualValue: 100, warningLow: 95, warningHigh: 105 },
      expected: 'neutral',
    },
  ]);
});

describe('evaluatePerformanceStatus — custom geometry (decyzja #9): always neutral', () => {
  run([
    {
      description: 'custom with no bounds at all -> neutral',
      input: { geometry: 'custom', actualValue: 50 },
      expected: 'neutral',
    },
    {
      description: 'custom with every bound populated and actual wildly out of any plausible range -> still neutral',
      input: {
        geometry: 'custom',
        actualValue: -999999,
        targetValue: 100,
        targetMin: 0,
        targetMax: 10,
        warningLow: 1,
        warningHigh: 9,
        criticalLow: -5,
        criticalHigh: 15,
      },
      expected: 'neutral',
    },
    {
      description: 'custom with actualValue missing -> still neutral (same reason, belt and suspenders)',
      input: { geometry: 'custom', actualValue: null },
      expected: 'neutral',
    },
  ]);
});

describe('evaluatePerformanceStatus — threshold_min (higher is better), target=80, warningLow=70', () => {
  const bounds = { geometry: 'threshold_min' as const, targetValue: 80, warningLow: 70 };
  run([
    { description: 'well above target -> on_target', input: { ...bounds, actualValue: 100 }, expected: 'on_target' },
    {
      description: 'exactly at target boundary -> on_target (boundary belongs to safer zone)',
      input: { ...bounds, actualValue: 80 },
      expected: 'on_target',
    },
    {
      description: 'just below target -> warning',
      input: { ...bounds, actualValue: 79.99 },
      expected: 'warning',
    },
    {
      description: 'exactly at warningLow boundary -> warning (boundary belongs to safer zone, not critical)',
      input: { ...bounds, actualValue: 70 },
      expected: 'warning',
    },
    {
      description: 'just below warningLow -> critical (strict inequality crosses the boundary)',
      input: { ...bounds, actualValue: 69.99 },
      expected: 'critical',
    },
    { description: 'well below warningLow -> critical', input: { ...bounds, actualValue: 0 }, expected: 'critical' },
  ]);
});

describe('evaluatePerformanceStatus — threshold_min without a warningLow: binary on_target/critical (decyzja #10 pattern extended)', () => {
  const bounds = { geometry: 'threshold_min' as const, targetValue: 80 };
  run([
    { description: 'at target -> on_target', input: { ...bounds, actualValue: 80 }, expected: 'on_target' },
    {
      description: 'just below target with no warning band configured -> critical directly',
      input: { ...bounds, actualValue: 79.99 },
      expected: 'critical',
    },
  ]);
});

describe('evaluatePerformanceStatus — threshold_max (lower is better), target=80, warningHigh=90', () => {
  const bounds = { geometry: 'threshold_max' as const, targetValue: 80, warningHigh: 90 };
  run([
    { description: 'well below target -> on_target', input: { ...bounds, actualValue: 50 }, expected: 'on_target' },
    {
      description: 'exactly at target boundary -> on_target',
      input: { ...bounds, actualValue: 80 },
      expected: 'on_target',
    },
    { description: 'just above target -> warning', input: { ...bounds, actualValue: 80.01 }, expected: 'warning' },
    {
      description: 'exactly at warningHigh boundary -> warning (safer zone)',
      input: { ...bounds, actualValue: 90 },
      expected: 'warning',
    },
    {
      description: 'just above warningHigh -> critical',
      input: { ...bounds, actualValue: 90.01 },
      expected: 'critical',
    },
  ]);
});

describe('evaluatePerformanceStatus — threshold_max without warningHigh: binary', () => {
  const bounds = { geometry: 'threshold_max' as const, targetValue: 80 };
  run([
    { description: 'at target -> on_target', input: { ...bounds, actualValue: 80 }, expected: 'on_target' },
    {
      description: 'just above target, no warning band -> critical directly',
      input: { ...bounds, actualValue: 80.01 },
      expected: 'critical',
    },
  ]);
});

describe('evaluatePerformanceStatus — range [10,20], warningLow=5, warningHigh=25', () => {
  const bounds = {
    geometry: 'range' as const,
    targetMin: 10,
    targetMax: 20,
    warningLow: 5,
    warningHigh: 25,
  };
  run([
    { description: 'middle of the band -> on_target', input: { ...bounds, actualValue: 15 }, expected: 'on_target' },
    {
      description: 'exactly at targetMin -> on_target (lower boundary belongs to safer zone)',
      input: { ...bounds, actualValue: 10 },
      expected: 'on_target',
    },
    {
      description: 'exactly at targetMax -> on_target (upper boundary belongs to safer zone)',
      input: { ...bounds, actualValue: 20 },
      expected: 'on_target',
    },
    {
      description: 'just below targetMin -> warning',
      input: { ...bounds, actualValue: 9.99 },
      expected: 'warning',
    },
    {
      description: 'exactly at warningLow -> warning (boundary belongs to safer/nearer zone)',
      input: { ...bounds, actualValue: 5 },
      expected: 'warning',
    },
    {
      description: 'just below warningLow -> critical',
      input: { ...bounds, actualValue: 4.99 },
      expected: 'critical',
    },
    {
      description: 'just above targetMax -> warning',
      input: { ...bounds, actualValue: 20.01 },
      expected: 'warning',
    },
    {
      description: 'exactly at warningHigh -> warning (boundary belongs to safer zone)',
      input: { ...bounds, actualValue: 25 },
      expected: 'warning',
    },
    {
      description: 'just above warningHigh -> critical',
      input: { ...bounds, actualValue: 25.01 },
      expected: 'critical',
    },
  ]);
});

describe('evaluatePerformanceStatus — range without warning bounds: binary beyond the target band', () => {
  const bounds = { geometry: 'range' as const, targetMin: 10, targetMax: 20 };
  run([
    { description: 'inside band -> on_target', input: { ...bounds, actualValue: 15 }, expected: 'on_target' },
    { description: 'at targetMin -> on_target', input: { ...bounds, actualValue: 10 }, expected: 'on_target' },
    { description: 'at targetMax -> on_target', input: { ...bounds, actualValue: 20 }, expected: 'on_target' },
    {
      description: 'just below targetMin, no warning band -> critical directly',
      input: { ...bounds, actualValue: 9.99 },
      expected: 'critical',
    },
    {
      description: 'just above targetMax, no warning band -> critical directly',
      input: { ...bounds, actualValue: 20.01 },
      expected: 'critical',
    },
  ]);
});

describe('evaluatePerformanceStatus — exact, target=100, tolerance [95,105], critical outside [90,110] (decyzja #7/#10, full 3-zone case)', () => {
  const bounds = {
    geometry: 'exact' as const,
    targetValue: 100,
    warningLow: 95,
    warningHigh: 105,
    criticalLow: 90,
    criticalHigh: 110,
  };
  run([
    { description: 'exact target -> on_target', input: { ...bounds, actualValue: 100 }, expected: 'on_target' },
    {
      description: 'at tolerance lower boundary -> on_target (inclusive)',
      input: { ...bounds, actualValue: 95 },
      expected: 'on_target',
    },
    {
      description: 'at tolerance upper boundary -> on_target (inclusive)',
      input: { ...bounds, actualValue: 105 },
      expected: 'on_target',
    },
    {
      description: 'just below tolerance -> warning',
      input: { ...bounds, actualValue: 94.99 },
      expected: 'warning',
    },
    {
      description: 'at criticalLow boundary -> warning (boundary belongs to safer/nearer zone)',
      input: { ...bounds, actualValue: 90 },
      expected: 'warning',
    },
    {
      description: 'just below criticalLow -> critical',
      input: { ...bounds, actualValue: 89.99 },
      expected: 'critical',
    },
    {
      description: 'just above tolerance -> warning',
      input: { ...bounds, actualValue: 105.01 },
      expected: 'warning',
    },
    {
      description: 'at criticalHigh boundary -> warning (boundary belongs to safer zone)',
      input: { ...bounds, actualValue: 110 },
      expected: 'warning',
    },
    {
      description: 'just above criticalHigh -> critical',
      input: { ...bounds, actualValue: 110.01 },
      expected: 'critical',
    },
  ]);
});

describe('evaluatePerformanceStatus — exact without critical bounds: decyzja #10, "outside tolerance -> critical directly, no warning zone"', () => {
  const bounds = { geometry: 'exact' as const, targetValue: 100, warningLow: 95, warningHigh: 105 };
  run([
    { description: 'inside tolerance -> on_target', input: { ...bounds, actualValue: 100 }, expected: 'on_target' },
    {
      description: 'at tolerance boundary -> on_target',
      input: { ...bounds, actualValue: 95 },
      expected: 'on_target',
    },
    {
      description: 'just below tolerance, no critical bounds configured -> critical directly (literal decyzja #10)',
      input: { ...bounds, actualValue: 94.99 },
      expected: 'critical',
    },
    {
      description: 'just above tolerance, no critical bounds configured -> critical directly',
      input: { ...bounds, actualValue: 105.01 },
      expected: 'critical',
    },
  ]);
});

describe('evaluatePerformanceStatus — exact without ANY tolerance band: exact match only', () => {
  const bounds = { geometry: 'exact' as const, targetValue: 100 };
  run([
    { description: 'exact match -> on_target', input: { ...bounds, actualValue: 100 }, expected: 'on_target' },
    {
      description: 'any deviation at all, no tolerance and no critical bounds -> critical directly',
      input: { ...bounds, actualValue: 100.01 },
      expected: 'critical',
    },
    {
      description: 'deviation below target, no bounds at all -> critical directly',
      input: { ...bounds, actualValue: 99.99 },
      expected: 'critical',
    },
  ]);
});

describe('evaluatePerformanceStatus — exact with only ONE side of critical bounds configured', () => {
  it('criticalLow only: below-tolerance side gets a warning zone, above-tolerance side stays binary', () => {
    const bounds = {
      geometry: 'exact' as const,
      targetValue: 100,
      warningLow: 95,
      warningHigh: 105,
      criticalLow: 90,
    };
    expect(evaluatePerformanceStatus({ ...bounds, actualValue: 92 })).toBe('warning');
    expect(evaluatePerformanceStatus({ ...bounds, actualValue: 89.99 })).toBe('critical');
    // No criticalHigh configured -> the high side has no critical band of
    // its own, same binary rule as "no critical bounds at all".
    expect(evaluatePerformanceStatus({ ...bounds, actualValue: 105.01 })).toBe('critical');
  });
});
