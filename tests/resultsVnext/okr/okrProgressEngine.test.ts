/**
 * OKR-E003 — `okrProgressEngine.ts` known-answer suite.
 *
 * Design: docs/product/results-vnext/OKR_E003_DESIGN.md §9, DoD item 3
 * ("known-answer test suite covers all 5 geometries' happy path AND every
 * degenerate case ... proving not_calculable is returned, never a
 * fabricated 0").
 *
 * Every expected numeric value below is HAND-VERIFIED in the comment next
 * to the assertion — this suite does not assert the engine agrees with
 * itself. Pure unit test, no DB, no `*.realdb.test.ts` suffix.
 */
import { describe, expect, it } from 'vitest';

import {
  calculateKeyResultProgress,
  calculateObjectiveConfidenceRollup,
  calculateObjectiveProgressRollup,
  type KeyResultProgressInput,
} from '../../../server/src/services/resultsVnext/okr/okrProgressEngine.js';

function baseInput(overrides: Partial<KeyResultProgressInput>): KeyResultProgressInput {
  return {
    direction: 'increase',
    baselineValue: null,
    targetValue: null,
    currentValue: null,
    rangeMin: null,
    rangeMax: null,
    ...overrides,
  };
}

describe('OKR-E003 okrProgressEngine — calculateKeyResultProgress (5 geometries)', () => {
  // ==========================================
  // increase
  // ==========================================
  describe('increase', () => {
    it('happy path: baseline=10, target=20, current=15 -> (15-10)/(20-10) = 5/10 = 0.5', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'increase', baselineValue: 10, targetValue: 20, currentValue: 15 })
      );
      expect(result.progress).toBe(0.5);
      expect(result.reason).toContain('increase:');
      expect(result.outOfRangeDistance).toBeNull();
    });

    it('overachievement is NOT clamped (§-IO item 2): baseline=0, target=10, current=15 -> 15/10 = 1.5', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'increase', baselineValue: 0, targetValue: 10, currentValue: 15 })
      );
      expect(result.progress).toBe(1.5);
    });

    it('degenerate: target == baseline -> not_calculable, never a fabricated 0', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'increase', baselineValue: 5, targetValue: 5, currentValue: 5 })
      );
      expect(result.progress).toBeNull();
      expect(result.reason).toMatch(/^not_calculable:/);
    });

    it('degenerate: missing current_value -> not_calculable', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'increase', baselineValue: 0, targetValue: 10, currentValue: null })
      );
      expect(result.progress).toBeNull();
      expect(result.reason).toMatch(/^not_calculable:/);
    });

    it('degenerate: missing baseline_value -> not_calculable', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'increase', baselineValue: null, targetValue: 10, currentValue: 5 })
      );
      expect(result.progress).toBeNull();
    });

    it('degenerate: missing target_value -> not_calculable', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'increase', baselineValue: 0, targetValue: null, currentValue: 5 })
      );
      expect(result.progress).toBeNull();
    });
  });

  // ==========================================
  // decrease
  // ==========================================
  describe('decrease', () => {
    it('happy path: baseline=100, target=50, current=75 -> (100-75)/(100-50) = 25/50 = 0.5', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'decrease', baselineValue: 100, targetValue: 50, currentValue: 75 })
      );
      expect(result.progress).toBe(0.5);
      expect(result.reason).toContain('decrease:');
    });

    it('overachievement not clamped: baseline=100, target=80, current=60 -> (100-60)/(100-80) = 40/20 = 2', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'decrease', baselineValue: 100, targetValue: 80, currentValue: 60 })
      );
      expect(result.progress).toBe(2);
    });

    it('degenerate: baseline == target -> not_calculable', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'decrease', baselineValue: 40, targetValue: 40, currentValue: 30 })
      );
      expect(result.progress).toBeNull();
      expect(result.reason).toMatch(/^not_calculable:/);
    });

    it('degenerate: missing current_value -> not_calculable', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'decrease', baselineValue: 100, targetValue: 50, currentValue: null })
      );
      expect(result.progress).toBeNull();
    });
  });

  // ==========================================
  // reach ("percentage direct")
  // ==========================================
  describe('reach', () => {
    it('happy path: current=30, target=40 -> 30/40 = 0.75', () => {
      const result = calculateKeyResultProgress(baseInput({ direction: 'reach', targetValue: 40, currentValue: 30 }));
      expect(result.progress).toBe(0.75);
      expect(result.reason).toContain('reach:');
    });

    it('no baseline required: baseline is null, current=8, target=4 -> 8/4 = 2 (still calculable)', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'reach', baselineValue: null, targetValue: 4, currentValue: 8 })
      );
      expect(result.progress).toBe(2);
    });

    it('degenerate: target == 0 -> not_calculable (division by zero)', () => {
      const result = calculateKeyResultProgress(baseInput({ direction: 'reach', targetValue: 0, currentValue: 5 }));
      expect(result.progress).toBeNull();
      expect(result.reason).toMatch(/^not_calculable:/);
    });

    it('degenerate: missing target_value -> not_calculable', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'reach', targetValue: null, currentValue: 5 })
      );
      expect(result.progress).toBeNull();
    });

    it('degenerate: missing current_value -> not_calculable', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'reach', targetValue: 5, currentValue: null })
      );
      expect(result.progress).toBeNull();
    });
  });

  // ==========================================
  // maintain_range — §-IO ruling: in-range=1.0, out-of-range=0.0,
  // magnitude in outOfRangeDistance (never folded into progress).
  // ==========================================
  describe('maintain_range', () => {
    it('in range: min=10, max=20, current=15 -> progress=1.0, outOfRangeDistance=0', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'maintain_range', rangeMin: 10, rangeMax: 20, currentValue: 15 })
      );
      expect(result.progress).toBe(1);
      expect(result.outOfRangeDistance).toBe(0);
    });

    it('in range, on the lower boundary: min=10, max=20, current=10 -> progress=1.0 (boundary is in-range)', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'maintain_range', rangeMin: 10, rangeMax: 20, currentValue: 10 })
      );
      expect(result.progress).toBe(1);
    });

    it('in range, on the upper boundary: min=10, max=20, current=20 -> progress=1.0 (boundary is in-range)', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'maintain_range', rangeMin: 10, rangeMax: 20, currentValue: 20 })
      );
      expect(result.progress).toBe(1);
    });

    it('below range: min=10, max=20, current=5 -> progress=0.0, outOfRangeDistance = 10-5 = 5', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'maintain_range', rangeMin: 10, rangeMax: 20, currentValue: 5 })
      );
      expect(result.progress).toBe(0);
      expect(result.outOfRangeDistance).toBe(5);
    });

    it('above range: min=10, max=20, current=25 -> progress=0.0, outOfRangeDistance = 25-20 = 5', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'maintain_range', rangeMin: 10, rangeMax: 20, currentValue: 25 })
      );
      expect(result.progress).toBe(0);
      expect(result.outOfRangeDistance).toBe(5);
    });

    it('degenerate: missing range_min -> not_calculable, outOfRangeDistance null', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'maintain_range', rangeMin: null, rangeMax: 20, currentValue: 15 })
      );
      expect(result.progress).toBeNull();
      expect(result.outOfRangeDistance).toBeNull();
      expect(result.reason).toMatch(/^not_calculable:/);
    });

    it('degenerate: missing current_value -> not_calculable', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'maintain_range', rangeMin: 10, rangeMax: 20, currentValue: null })
      );
      expect(result.progress).toBeNull();
    });

    it('degenerate: range_min > range_max (invalid range) -> not_calculable, never a fabricated 0', () => {
      const result = calculateKeyResultProgress(
        baseInput({ direction: 'maintain_range', rangeMin: 20, rangeMax: 10, currentValue: 15 })
      );
      expect(result.progress).toBeNull();
      expect(result.reason).toMatch(/^not_calculable:/);
    });
  });

  // ==========================================
  // binary — §-IO ruling: achieved=1.0, not achieved=0.0
  // ==========================================
  describe('binary', () => {
    it('achieved: current_value=1 -> progress=1.0', () => {
      const result = calculateKeyResultProgress(baseInput({ direction: 'binary', currentValue: 1 }));
      expect(result.progress).toBe(1);
      expect(result.reason).toContain('achieved');
    });

    it('not achieved: current_value=0 -> progress=0.0', () => {
      const result = calculateKeyResultProgress(baseInput({ direction: 'binary', currentValue: 0 }));
      expect(result.progress).toBe(0);
      expect(result.reason).toContain('not achieved');
    });

    it('degenerate: missing current_value -> not_calculable, never a fabricated 0', () => {
      const result = calculateKeyResultProgress(baseInput({ direction: 'binary', currentValue: null }));
      expect(result.progress).toBeNull();
      expect(result.reason).toMatch(/^not_calculable:/);
    });

    it('degenerate: current_value=0.5 (no defined sentinel) -> not_calculable, not silently rounded', () => {
      const result = calculateKeyResultProgress(baseInput({ direction: 'binary', currentValue: 0.5 }));
      expect(result.progress).toBeNull();
      expect(result.reason).toMatch(/^not_calculable:/);
    });
  });
});

describe('OKR-E003 okrProgressEngine — calculateObjectiveProgressRollup', () => {
  it('rollup_model="none": progress=null, reason states the policy choice (not "not_calculable" — it is deliberate)', () => {
    const result = calculateObjectiveProgressRollup({
      keyResultProgresses: [{ progress: 0.5, weight: null }],
      rollupModel: 'none',
    });
    expect(result.progress).toBeNull();
    expect(result.reason).toContain('rollup_model_none');
  });

  it('rollup_model="manual": progress=null, reason states owner sets directly', () => {
    const result = calculateObjectiveProgressRollup({
      keyResultProgresses: [{ progress: 0.5, weight: null }],
      rollupModel: 'manual',
    });
    expect(result.progress).toBeNull();
    expect(result.reason).toContain('rollup_model_manual');
  });

  it('equal_average: [0.4, 0.8] -> (0.4+0.8)/2 = 0.6', () => {
    const result = calculateObjectiveProgressRollup({
      keyResultProgresses: [
        { progress: 0.4, weight: null },
        { progress: 0.8, weight: null },
      ],
      rollupModel: 'equal_average',
    });
    expect(result.progress).toBeCloseTo(0.6, 10);
  });

  it('equal_average skips not_calculable KRs: [0.4, null, 0.8] -> (0.4+0.8)/2 = 0.6, not /3', () => {
    const result = calculateObjectiveProgressRollup({
      keyResultProgresses: [
        { progress: 0.4, weight: null },
        { progress: null, weight: null },
        { progress: 0.8, weight: null },
      ],
      rollupModel: 'equal_average',
    });
    expect(result.progress).toBeCloseTo(0.6, 10);
    expect(result.reason).toContain('2 calculable');
  });

  it('equal_average: every KR not_calculable -> rollup itself not_calculable, never treated as 0', () => {
    const result = calculateObjectiveProgressRollup({
      keyResultProgresses: [
        { progress: null, weight: null },
        { progress: null, weight: null },
      ],
      rollupModel: 'equal_average',
    });
    expect(result.progress).toBeNull();
    expect(result.reason).toMatch(/^not_calculable:/);
  });

  it('equal_average: zero key results -> not_calculable', () => {
    const result = calculateObjectiveProgressRollup({ keyResultProgresses: [], rollupModel: 'equal_average' });
    expect(result.progress).toBeNull();
    expect(result.reason).toMatch(/^not_calculable:/);
  });

  it('weighted_average: [{0.5,w=2},{0.9,w=1}] -> (0.5*2 + 0.9*1)/(2+1) = (1.0+0.9)/3 = 1.9/3 = 0.6333...', () => {
    const result = calculateObjectiveProgressRollup({
      keyResultProgresses: [
        { progress: 0.5, weight: 2 },
        { progress: 0.9, weight: 1 },
      ],
      rollupModel: 'weighted_average',
    });
    expect(result.progress).toBeCloseTo(1.9 / 3, 10);
  });

  it('weighted_average: null weight treated as 1 -> [{1,w=null},{0,w=3}] -> (1*1 + 0*3)/(1+3) = 1/4 = 0.25', () => {
    const result = calculateObjectiveProgressRollup({
      keyResultProgresses: [
        { progress: 1, weight: null },
        { progress: 0, weight: 3 },
      ],
      rollupModel: 'weighted_average',
    });
    expect(result.progress).toBeCloseTo(0.25, 10);
  });
});

describe('OKR-E003 okrProgressEngine — calculateObjectiveConfidenceRollup (never averaged)', () => {
  it('lowest_kr categorical: [high, low, medium] -> low (worst)', () => {
    const result = calculateObjectiveConfidenceRollup({
      keyResultConfidences: [
        { confidence: 'high', confidenceNumericValue: null },
        { confidence: 'low', confidenceNumericValue: null },
        { confidence: 'medium', confidenceNumericValue: null },
      ],
      confidenceModel: 'lowest_kr',
    });
    expect(result.confidence).toBe('low');
  });

  it('lowest_kr categorical: all high -> high', () => {
    const result = calculateObjectiveConfidenceRollup({
      keyResultConfidences: [
        { confidence: 'high', confidenceNumericValue: null },
        { confidence: 'high', confidenceNumericValue: null },
      ],
      confidenceModel: 'lowest_kr',
    });
    expect(result.confidence).toBe('high');
  });

  it('lowest_kr numeric: [0.9, 0.3] -> 0.3 (minimum, never averaged)', () => {
    const result = calculateObjectiveConfidenceRollup({
      keyResultConfidences: [
        { confidence: 'numeric', confidenceNumericValue: 0.9 },
        { confidence: 'numeric', confidenceNumericValue: 0.3 },
      ],
      confidenceModel: 'lowest_kr',
    });
    expect(result.confidence).toBe('numeric');
    expect(result.confidenceNumericValue).toBe(0.3);
  });

  it('§-IO item 5: mixed categorical + numeric within one objective -> not_calculable, no cross-scale comparison', () => {
    const result = calculateObjectiveConfidenceRollup({
      keyResultConfidences: [
        { confidence: 'high', confidenceNumericValue: null },
        { confidence: 'numeric', confidenceNumericValue: 0.3 },
      ],
      confidenceModel: 'lowest_kr',
    });
    expect(result.confidence).toBeNull();
    expect(result.reason).toMatch(/^not_calculable:/);
  });

  it('lowest_kr: no key result has a confidence value -> not_calculable', () => {
    const result = calculateObjectiveConfidenceRollup({
      keyResultConfidences: [
        { confidence: null, confidenceNumericValue: null },
        { confidence: null, confidenceNumericValue: null },
      ],
      confidenceModel: 'lowest_kr',
    });
    expect(result.confidence).toBeNull();
    expect(result.reason).toMatch(/^not_calculable:/);
  });

  it('owner_selected with a value: passthrough, KR confidence not consulted', () => {
    const result = calculateObjectiveConfidenceRollup({
      keyResultConfidences: [{ confidence: 'low', confidenceNumericValue: null }],
      confidenceModel: 'owner_selected',
      ownerSelectedValue: { confidence: 'high', confidenceNumericValue: null },
    });
    expect(result.confidence).toBe('high');
  });

  it('owner_selected without a value yet -> not_calculable', () => {
    const result = calculateObjectiveConfidenceRollup({
      keyResultConfidences: [],
      confidenceModel: 'owner_selected',
      ownerSelectedValue: null,
    });
    expect(result.confidence).toBeNull();
    expect(result.reason).toMatch(/^not_calculable:/);
  });

  it('custom: not implemented in E003 -> not_calculable (real enforcement is the command-layer reject, D-E3-10)', () => {
    const result = calculateObjectiveConfidenceRollup({
      keyResultConfidences: [{ confidence: 'high', confidenceNumericValue: null }],
      confidenceModel: 'custom',
    });
    expect(result.confidence).toBeNull();
    expect(result.reason).toMatch(/^not_calculable:/);
  });
});
