/**
 * OKR-E004 — `computeSetRollup` pure-function unit tests (design §7.3).
 *
 * No DB, no network — every case is a direct call into the pure function.
 * Covers every `objectiveRollupModel`/`objectiveConfidenceModel`
 * combination plus the `not_calculable`/zero-Objective edge cases the
 * design's own DoD names explicitly.
 */
import { describe, expect, it } from 'vitest';

import { computeSetRollup, type ComputeSetRollupObjectiveInput } from '../../../server/src/services/resultsVnext/okr/okrSetRollupCalculator.js';

function objective(overrides: Partial<ComputeSetRollupObjectiveInput> = {}): ComputeSetRollupObjectiveInput {
  return {
    objectiveId: 'obj-1',
    progress: null,
    confidence: null,
    confidenceNumericValue: null,
    ...overrides,
  };
}

describe('OKR-E004 computeSetRollup (pure)', () => {
  // ==========================================
  // AC-011 literal requirement: zero-Objective / all-cancelled Set yields
  // null, NEVER a fabricated 0.
  // ==========================================

  it('zero Objectives: overallProgress/overallConfidence are null, never a fabricated 0', () => {
    const result = computeSetRollup({
      objectives: [],
      objectiveRollupModel: 'equal_average',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.overallProgress).toBeNull();
    expect(result.overallConfidence).toBeNull();
    expect(result.overallConfidenceNumericValue).toBeNull();
    expect(result.attentionState).toBe('none');
  });

  // ==========================================
  // objective_rollup_model coverage
  // ==========================================

  it('equal_average: averages non-null progress across objectives', () => {
    const result = computeSetRollup({
      objectives: [objective({ progress: 0.5 }), objective({ progress: 0.9, objectiveId: 'obj-2' })],
      objectiveRollupModel: 'equal_average',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.overallProgress).toBeCloseTo(0.7, 10);
  });

  it('equal_average: not_calculable objectives are skipped, not treated as 0', () => {
    const result = computeSetRollup({
      objectives: [objective({ progress: null }), objective({ progress: 0.8, objectiveId: 'obj-2' })],
      objectiveRollupModel: 'equal_average',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.overallProgress).toBeCloseTo(0.8, 10);
  });

  it('weighted_average: skipped here (no weight concept at Set level — equal weight via null) still averages correctly', () => {
    const result = computeSetRollup({
      objectives: [objective({ progress: 0.2 }), objective({ progress: 0.6, objectiveId: 'obj-2' })],
      objectiveRollupModel: 'weighted_average',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.overallProgress).toBeCloseTo(0.4, 10);
  });

  it('manual: never computed, overallProgress stays null', () => {
    const result = computeSetRollup({
      objectives: [objective({ progress: 0.5 })],
      objectiveRollupModel: 'manual',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.overallProgress).toBeNull();
  });

  it('none: deliberate non-rollup — overallProgress stays null even with calculable objectives', () => {
    const result = computeSetRollup({
      objectives: [objective({ progress: 0.5 }), objective({ progress: 0.9, objectiveId: 'obj-2' })],
      objectiveRollupModel: 'none',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.overallProgress).toBeNull();
  });

  // ==========================================
  // objective_confidence_model coverage
  // ==========================================

  it('lowest_kr categorical: worst of high/medium/low, never averaged', () => {
    const result = computeSetRollup({
      objectives: [objective({ confidence: 'high' }), objective({ confidence: 'low', objectiveId: 'obj-2' })],
      objectiveRollupModel: 'none',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.overallConfidence).toBe('low');
  });

  it('lowest_kr numeric: minimum value, never averaged', () => {
    const result = computeSetRollup({
      objectives: [
        objective({ confidence: 'numeric', confidenceNumericValue: 80 }),
        objective({ confidence: 'numeric', confidenceNumericValue: 30, objectiveId: 'obj-2' }),
      ],
      objectiveRollupModel: 'none',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.overallConfidence).toBe('numeric');
    expect(result.overallConfidenceNumericValue).toBe(30);
  });

  it('lowest_kr: mixed categorical + numeric confidence across objectives is not_calculable (§-IO item 5 — no cross-scale comparison invented)', () => {
    const result = computeSetRollup({
      objectives: [
        objective({ confidence: 'high' }),
        objective({ confidence: 'numeric', confidenceNumericValue: 50, objectiveId: 'obj-2' }),
      ],
      objectiveRollupModel: 'none',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.overallConfidence).toBeNull();
  });

  it('owner_selected: no Set-level owner-selection input exists in this epic — degrades to not_calculable, never throws', () => {
    const result = computeSetRollup({
      objectives: [objective({ confidence: 'high' })],
      objectiveRollupModel: 'none',
      objectiveConfidenceModel: 'owner_selected',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.overallConfidence).toBeNull();
  });

  // ==========================================
  // attentionState — IO-5: only 'none'/'watch', threshold-free
  // ==========================================

  it('attentionState "watch" when any objective confidence is "low"', () => {
    const result = computeSetRollup({
      objectives: [objective({ confidence: 'low' })],
      objectiveRollupModel: 'none',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.attentionState).toBe('watch');
  });

  it('attentionState "watch" when anyKeyResultStale is true, even with high confidence and full progress', () => {
    const result = computeSetRollup({
      objectives: [objective({ progress: 1, confidence: 'high' })],
      objectiveRollupModel: 'equal_average',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: true,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.attentionState).toBe('watch');
  });

  it('attentionState "none" when nothing is stale and no confidence is low', () => {
    const result = computeSetRollup({
      objectives: [objective({ progress: 0.5, confidence: 'medium' })],
      objectiveRollupModel: 'equal_average',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.attentionState).toBe('none');
  });

  it('attentionState is NEVER "action_required" or "escalated" (IO-5: no policy threshold exists to derive them)', () => {
    // Even a deliberately extreme, low-progress + low-confidence + stale
    // input never escalates past 'watch' — the function has no mechanism
    // to reach 'action_required'/'escalated' at all (verified by reading
    // every branch of the union it returns).
    const result = computeSetRollup({
      objectives: [objective({ progress: 0, confidence: 'low' })],
      objectiveRollupModel: 'equal_average',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: true,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(['none', 'watch']).toContain(result.attentionState);
    expect(result.attentionState).not.toBe('action_required');
    expect(result.attentionState).not.toBe('escalated');
  });

  // ==========================================
  // D10 passthrough
  // ==========================================

  it('lastCheckinAt/nextCheckinDueAt are passed through unchanged (caller-computed, this function does no date arithmetic)', () => {
    const result = computeSetRollup({
      objectives: [],
      objectiveRollupModel: 'none',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: '2026-08-01T00:00:00.000Z',
      nextCheckinDueAt: '2026-08-15T00:00:00.000Z',
    });
    expect(result.lastCheckinAt).toBe('2026-08-01T00:00:00.000Z');
    expect(result.nextCheckinDueAt).toBe('2026-08-15T00:00:00.000Z');
  });

  it('reason is a non-empty audit-trail string on every call (OKR-F-009-AC-02 discipline carried through)', () => {
    const result = computeSetRollup({
      objectives: [objective({ progress: 0.5 })],
      objectiveRollupModel: 'equal_average',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  // ==========================================
  // RN-G6-SRV / D08 (docs/product/results-vnext/RN_G2_OPEN_QUESTIONS_UI.md
  // §OQ-UI-C): `overallProgressReason`/`overallConfidenceReason` are the
  // split-out fields `applySetRollupUpdate` now persists onto
  // `okr_vnext_sets.overall_progress_reason`/`overall_confidence_reason`.
  // Before this fix they were computed here and thrown away — asserted
  // directly so a future regression collapsing them back into only the
  // combined `reason` string fails HERE, not silently at the DB layer.
  // ==========================================

  it('zero Objectives: overallProgressReason/overallConfidenceReason both carry an explicit not_calculable: prefix', () => {
    const result = computeSetRollup({
      objectives: [],
      objectiveRollupModel: 'equal_average',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.overallProgress).toBeNull();
    expect(result.overallConfidence).toBeNull();
    expect(result.overallProgressReason).toMatch(/^not_calculable:/);
    expect(result.overallConfidenceReason).toMatch(/^not_calculable:/);
    // The combined `reason` field must still carry both halves — kept for
    // backward compatibility, not replaced by the split fields.
    expect(result.reason).toContain(result.overallProgressReason);
    expect(result.reason).toContain(result.overallConfidenceReason);
  });

  it('non-empty, calculable Set: overallProgressReason/overallConfidenceReason are distinct, non-empty strings that do NOT start with not_calculable:', () => {
    const result = computeSetRollup({
      objectives: [objective({ progress: 0.5, confidence: 'high' })],
      objectiveRollupModel: 'equal_average',
      objectiveConfidenceModel: 'lowest_kr',
      anyKeyResultStale: false,
      lastCheckinAt: null,
      nextCheckinDueAt: null,
    });
    expect(result.overallProgress).not.toBeNull();
    expect(result.overallProgressReason.length).toBeGreaterThan(0);
    expect(result.overallProgressReason).not.toMatch(/^not_calculable:/);
    expect(result.overallConfidenceReason.length).toBeGreaterThan(0);
    expect(result.overallProgressReason).not.toBe(result.overallConfidenceReason);
  });
});
