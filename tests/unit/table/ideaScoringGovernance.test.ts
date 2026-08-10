/**
 * ideaScoringGovernance — Program D / E08 §6.3 (Scoring and prioritisation).
 *
 * Guards the governance properties the master program requires that the
 * PRE-EXISTING `IdeaScoringModel.tsx` engine does not provide: visible +
 * versioned weights, mandatory-reason overrides recorded in history, and a
 * portfolio comparison that carries both absolute inputs and the normalized
 * score.
 */
import { describe, expect, it } from 'vitest';

import {
  appendComputedEvent,
  appendOverrideEvent,
  buildPortfolioComparison,
  computeCompositeScore,
  createInitialWeightVersion,
  createScoreOverride,
  currentScore,
  currentWeightVersion,
  defaultWeightSet,
  InvalidWeightRevisionError,
  MissingOverrideReasonError,
  reviseWeights,
  SCORING_DIMENSIONS,
  type ScoreHistory,
} from '@/components/MyWork/table/ideaScoringGovernance';

describe('SCORING_DIMENSIONS defaults', () => {
  it('sums to exactly 100', () => {
    const total = SCORING_DIMENSIONS.reduce((s, d) => s + d.defaultWeight, 0);
    expect(total).toBe(100);
  });

  it('covers all nine canon dimensions from §6.3', () => {
    const keys = SCORING_DIMENSIONS.map((d) => d.key).sort();
    expect(keys).toEqual(
      [
        'complianceSecurity',
        'confidenceEvidence',
        'customerBusinessValue',
        'dependencyComplexity',
        'deliveryEffort',
        'financialImpact',
        'implementationRisk',
        'strategicFit',
        'urgency',
      ].sort()
    );
  });

  it('marks effort/risk/dependency complexity as lowerIsBetter, nothing else', () => {
    const lowerIsBetter = SCORING_DIMENSIONS.filter((d) => d.lowerIsBetter).map((d) => d.key);
    expect(new Set(lowerIsBetter)).toEqual(
      new Set(['deliveryEffort', 'implementationRisk', 'dependencyComplexity'])
    );
  });
});

describe('weight versioning', () => {
  it('starts at version 1 with the defaults', () => {
    const history = createInitialWeightVersion();
    expect(history).toHaveLength(1);
    expect(history[0].version).toBe(1);
    expect(history[0].weights).toEqual(defaultWeightSet());
  });

  it('reviseWeights always APPENDS — never mutates a prior version', () => {
    const v1 = createInitialWeightVersion();
    const v2 = reviseWeights(v1, { strategicFit: 30, financialImpact: 70 }, { note: 'lean into revenue' });
    expect(v2).toHaveLength(2);
    expect(v1).toHaveLength(1); // original array untouched
    expect(v2[1].version).toBe(2);
    expect(v2[1].note).toBe('lean into revenue');
    expect(currentWeightVersion(v2)).toBe(v2[1]);
    // v1's own version object is a different reference, still weights=defaults
    expect(v1[0].weights).toEqual(defaultWeightSet());
  });

  it('rejects an empty or negative weight set instead of silently accepting it', () => {
    const v1 = createInitialWeightVersion();
    expect(() => reviseWeights(v1, {})).toThrow(InvalidWeightRevisionError);
    expect(() => reviseWeights(v1, { strategicFit: -5 })).toThrow(InvalidWeightRevisionError);
  });
});

describe('computeCompositeScore', () => {
  const weightVersion = createInitialWeightVersion()[0];

  it('scores a fully-provided idea deterministically from raw 0-10 inputs', () => {
    const result = computeCompositeScore(
      {
        strategicFit: 10,
        customerBusinessValue: 10,
        financialImpact: 10,
        urgency: 10,
        confidenceEvidence: 10,
        deliveryEffort: 0, // lowerIsBetter — 0 effort is the BEST case
        implementationRisk: 0,
        dependencyComplexity: 0,
        complianceSecurity: 10,
      },
      weightVersion
    );
    // Every provided dimension normalizes to 1.0 (max-good) once inverted —
    // the composite must land at the top of the scale.
    expect(result.score).toBe(100);
    expect(result.missingDimensions).toEqual([]);
    expect(result.modelVersion).toBe(1);
  });

  it('never silently treats a missing dimension as zero — it renormalizes and reports it', () => {
    const partial = computeCompositeScore({ strategicFit: 10 }, weightVersion);
    const full = computeCompositeScore(
      { strategicFit: 10, customerBusinessValue: 10, financialImpact: 10 },
      weightVersion
    );
    // Renormalized among only the provided dimensions: a single maxed
    // dimension scores the same top-of-scale as three maxed dimensions.
    expect(partial.score).toBe(100);
    expect(full.score).toBe(100);
    expect(partial.missingDimensions).toContain('customerBusinessValue');
    expect(partial.missingDimensions).toContain('deliveryEffort');
    expect(partial.breakdown.find((b) => b.dimension === 'urgency')?.provided).toBe(false);
  });

  it('inverts lowerIsBetter dimensions so high effort scores lower', () => {
    const lowEffort = computeCompositeScore({ deliveryEffort: 0 }, weightVersion);
    const highEffort = computeCompositeScore({ deliveryEffort: 10 }, weightVersion);
    expect(lowEffort.score).toBeGreaterThan(highEffort.score);
  });

  it('clamps out-of-range raw inputs into the 0-10 scale rather than corrupting the sum', () => {
    const result = computeCompositeScore({ strategicFit: 999 }, weightVersion);
    expect(result.breakdown[0].rawValue).toBeLessThanOrEqual(10);
  });
});

describe('manual override — mandatory reason', () => {
  it('throws MissingOverrideReasonError on a blank reason', () => {
    expect(() =>
      createScoreOverride({ value: 80, reason: '   ', previousComputedValue: 60, modelVersion: 1 })
    ).toThrow(MissingOverrideReasonError);
  });

  it('rejects an out-of-range override value even with a valid reason', () => {
    expect(() =>
      createScoreOverride({
        value: 140,
        reason: 'client escalation',
        previousComputedValue: 60,
        modelVersion: 1,
      })
    ).toThrow(MissingOverrideReasonError);
  });

  it('records the override, the reason, and the superseded computed value in history', () => {
    let history: ScoreHistory = [];
    const computed = computeCompositeScore({ strategicFit: 6 }, createInitialWeightVersion()[0]);
    history = appendComputedEvent(history, computed, '2026-08-01T00:00:00.000Z');

    const override = createScoreOverride({
      value: 95,
      reason: 'Sponsor confirmed board mandate outweighs the model.',
      previousComputedValue: computed.score,
      modelVersion: computed.modelVersion,
      byUser: 'piotr',
      now: '2026-08-02T00:00:00.000Z',
    });
    history = appendOverrideEvent(history, override);

    expect(history).toHaveLength(2);
    expect(history[1]).toEqual({ type: 'override', at: override.at, override });
    expect(currentScore(history)).toEqual({ value: 95, source: 'override', modelVersion: 1 });
    // The reason and the pre-override computed value are BOTH still readable
    // from history — nothing about the override is a silent replacement.
    expect((history[1] as any).override.reason).toMatch(/board mandate/);
    expect((history[1] as any).override.previousComputedValue).toBe(computed.score);
  });

  it('a later re-run of the model appends rather than erasing the override', () => {
    let history: ScoreHistory = [];
    const weightVersion = createInitialWeightVersion()[0];
    const computed1 = computeCompositeScore({ strategicFit: 4 }, weightVersion);
    history = appendComputedEvent(history, computed1);
    const override = createScoreOverride({
      value: 90,
      reason: 'manual review',
      previousComputedValue: computed1.score,
      modelVersion: 1,
    });
    history = appendOverrideEvent(history, override);
    const computed2 = computeCompositeScore({ strategicFit: 9 }, weightVersion);
    history = appendComputedEvent(history, computed2);

    expect(history).toHaveLength(3);
    expect(currentScore(history)?.source).toBe('computed');
    // The override entry is still in the array, untouched.
    expect(history[1].type).toBe('override');
  });
});

describe('buildPortfolioComparison', () => {
  it('shows absolute inputs AND the normalized score for every idea, best first', () => {
    const weightVersion = createInitialWeightVersion()[0];
    const rows = buildPortfolioComparison(
      [
        { ideaId: 'a', label: 'Idea A', inputs: { strategicFit: 2 } },
        { ideaId: 'b', label: 'Idea B', inputs: { strategicFit: 9 } },
      ],
      weightVersion
    );
    expect(rows.map((r) => r.ideaId)).toEqual(['b', 'a']);
    expect(rows[0].inputs).toEqual({ strategicFit: 9 });
    expect(typeof rows[0].normalizedScore).toBe('number');
    expect(rows[0].scoreSource).toBe('computed');
  });

  it('uses the recorded override (with its reason) instead of recomputing when history has one', () => {
    const weightVersion = createInitialWeightVersion()[0];
    const computed = computeCompositeScore({ strategicFit: 1 }, weightVersion);
    let history: ScoreHistory = appendComputedEvent([], computed);
    const override = createScoreOverride({
      value: 88,
      reason: 'strategic bet',
      previousComputedValue: computed.score,
      modelVersion: 1,
    });
    history = appendOverrideEvent(history, override);

    const rows = buildPortfolioComparison(
      [{ ideaId: 'a', label: 'Idea A', inputs: { strategicFit: 1 }, history }],
      weightVersion
    );
    expect(rows[0].normalizedScore).toBe(88);
    expect(rows[0].scoreSource).toBe('override');
    expect(rows[0].overrideReason).toBe('strategic bet');
  });
});
