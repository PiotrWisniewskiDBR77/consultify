import { describe, expect, it, vi } from 'vitest';

import {
  AI_SCORE_THRESHOLD_GOOD,
  AI_SCORE_THRESHOLD_NEEDS_ATTENTION,
  fromInterviewAiReview,
  mapRubricScoreTo100,
  verdictFromScore,
} from '@/services/aiReview/aiReviewSummary';
import type { V8InterviewSessionEvaluation } from '@/services/api/v8/interview';

/**
 * AIR-1a wiring test: verifies the column/preview read from the REAL API
 * contract shape (V8InterviewSessionEvaluation) through the adapter, and
 * that the DEC-566/569 thresholds (80/50) drive the verdict.
 *
 * Mutations (each must RED):
 *  M1: score source = constant (replace row.aiReview?.overallScore with 4.0)
 *  M2: threshold 80→60 in verdictFromScore
 *  M3: no score renders 0 instead of null/"—"
 */

function makeRealApiEvaluation(overallScore: number): V8InterviewSessionEvaluation {
  return {
    overallScore,
    overallVerdict: overallScore >= 3.5 ? 'ready_for_approval' : overallScore >= 2.5 ? 'needs_improvement' : 'insufficient',
    questionEvaluations: [
      { questionId: 'q1', score: overallScore, verdict: 'sufficient', feedback: 'OK' },
    ],
    recommendations: overallScore < 3.5 ? ['Provide more detail'] : [],
    weakAnswerMap: overallScore < 3.5
      ? [{ key: 'q2', label: 'Budget', score: 2, verdict: 'needs_improvement', feedback: 'Vague', fixType: 'expand' as any, isRequired: true }]
      : [],
  };
}

describe('AIR-1a column wiring — real V8InterviewSessionEvaluation contract', () => {
  it('M3 guard: null aiReview → score0to100 is null (column shows "—", NEVER 0)', () => {
    const summary = fromInterviewAiReview(null, null, 'assign-x');
    expect(summary.score0to100).toBeNull();
    expect(summary.score0to100).not.toBe(0);
    expect(summary.verdict).toBe('empty');
  });

  it('M1 guard: score comes from the aiReview argument, not a constant', () => {
    const low = fromInterviewAiReview(makeRealApiEvaluation(1.5), null, 'a1');
    const high = fromInterviewAiReview(makeRealApiEvaluation(4.8), null, 'a2');
    expect(low.score0to100).not.toBe(high.score0to100);
    expect(low.score0to100).toBe(13);
    expect(high.score0to100).toBe(95);
  });

  it('M2 guard: verdict uses threshold 80 (DEC-566/569), not 75 or 60', () => {
    expect(AI_SCORE_THRESHOLD_GOOD).toBe(80);
    expect(AI_SCORE_THRESHOLD_NEEDS_ATTENTION).toBe(50);
    // score 4.2 → 80 → good (exactly at threshold)
    const atThreshold = fromInterviewAiReview(makeRealApiEvaluation(4.2), null, 'a3');
    expect(atThreshold.score0to100).toBe(80);
    expect(atThreshold.verdict).toBe('good');
    // score 4.1 → 77 (floating point: (4.1-1)/4*100 = 77.4999… → 77) → needs_attention
    const justBelow = fromInterviewAiReview(makeRealApiEvaluation(4.1), null, 'a4');
    expect(justBelow.score0to100).toBe(77);
    expect(justBelow.verdict).toBe('needs_attention');
  });

  it('maps real API evaluation with weakAnswerMap to signals', () => {
    const summary = fromInterviewAiReview(makeRealApiEvaluation(2.8), '2026-09-15T10:00:00Z', 'a5');
    expect(summary.score0to100).toBe(45);
    expect(summary.verdict).toBe('blocked');
    expect(summary.reviewedAt).toBe('2026-09-15T10:00:00Z');
    expect(summary.signals.length).toBeGreaterThan(0);
    expect(summary.signals[0].label).toBe('Budget');
    expect(summary.signals[0].severity).toBe('warning');
  });

  it('sortability: score0to100 is a plain number (not string) for table sorting', () => {
    const summary = fromInterviewAiReview(makeRealApiEvaluation(3.0), null, 'a6');
    expect(typeof summary.score0to100).toBe('number');
    expect(summary.score0to100).toBe(50);
  });

  it('verdictFromScore boundary: 49 → blocked, 50 → needs_attention', () => {
    expect(verdictFromScore(49)).toBe('blocked');
    expect(verdictFromScore(50)).toBe('needs_attention');
  });

  it('mapRubricScoreTo100 boundary: 1 → 0, 5 → 100', () => {
    expect(mapRubricScoreTo100(1)).toBe(0);
    expect(mapRubricScoreTo100(5)).toBe(100);
  });
});
