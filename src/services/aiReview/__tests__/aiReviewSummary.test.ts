import { describe, expect, it } from 'vitest';

import {
  AI_SCORE_THRESHOLD_GOOD,
  AI_SCORE_THRESHOLD_NEEDS_ATTENTION,
  fromInterviewAiReview,
  mapRubricScoreTo100,
  verdictFromScore,
} from '../aiReviewSummary';

describe('aiReviewSummary adapter (AIR-1a, DEC-566/569)', () => {
  describe('mapRubricScoreTo100', () => {
    it('maps 1 → 0', () => expect(mapRubricScoreTo100(1)).toBe(0));
    it('maps 3 → 50', () => expect(mapRubricScoreTo100(3)).toBe(50));
    it('maps 5 → 100', () => expect(mapRubricScoreTo100(5)).toBe(100));
    it('maps 4.2 → 80', () => expect(mapRubricScoreTo100(4.2)).toBe(80));
    it('clamps below 1 → 0', () => expect(mapRubricScoreTo100(0.5)).toBe(0));
    it('clamps above 5 → 100', () => expect(mapRubricScoreTo100(6)).toBe(100));
    it('returns null for null', () => expect(mapRubricScoreTo100(null)).toBeNull());
    it('returns null for undefined', () => expect(mapRubricScoreTo100(undefined)).toBeNull());
    it('returns null for NaN', () => expect(mapRubricScoreTo100(NaN)).toBeNull());
  });

  describe('verdictFromScore (thresholds 80/50)', () => {
    it('≥80 → good', () => expect(verdictFromScore(80)).toBe('good'));
    it('100 → good', () => expect(verdictFromScore(100)).toBe('good'));
    it('79 → needs_attention', () => expect(verdictFromScore(79)).toBe('needs_attention'));
    it('50 → needs_attention', () => expect(verdictFromScore(50)).toBe('needs_attention'));
    it('49 → blocked', () => expect(verdictFromScore(49)).toBe('blocked'));
    it('0 → blocked', () => expect(verdictFromScore(0)).toBe('blocked'));
    it('null → empty', () => expect(verdictFromScore(null)).toBe('empty'));
    it('threshold constants are 80 and 50', () => {
      expect(AI_SCORE_THRESHOLD_GOOD).toBe(80);
      expect(AI_SCORE_THRESHOLD_NEEDS_ATTENTION).toBe(50);
    });
  });

  describe('fromInterviewAiReview', () => {
    it('null aiReview → score null, verdict empty', () => {
      const s = fromInterviewAiReview(null, null, 'assign-1');
      expect(s.score0to100).toBeNull();
      expect(s.verdict).toBe('empty');
      expect(s.sourceModule).toBe('interview');
      expect(s.sourceId).toBe('assign-1');
      expect(s.signals).toEqual([]);
    });

    it('maps overallScore 4.2 → 80, verdict good', () => {
      const s = fromInterviewAiReview(
        {
          overallScore: 4.2,
          overallVerdict: 'ready_for_approval',
          questionEvaluations: [],
          recommendations: [],
          weakAnswerMap: [],
        },
        '2026-09-18T10:00:00Z',
        'assign-2'
      );
      expect(s.score0to100).toBe(80);
      expect(s.verdict).toBe('good');
      expect(s.reviewedAt).toBe('2026-09-18T10:00:00Z');
    });

    it('maps overallScore 2.5 → 38, verdict blocked', () => {
      const s = fromInterviewAiReview(
        {
          overallScore: 2.5,
          overallVerdict: 'insufficient',
          questionEvaluations: [],
          recommendations: [],
          weakAnswerMap: [],
        },
        null,
        'assign-3'
      );
      expect(s.score0to100).toBe(38);
      expect(s.verdict).toBe('blocked');
    });

    it('maps weakAnswerMap to signals with severity', () => {
      const s = fromInterviewAiReview(
        {
          overallScore: 3,
          overallVerdict: 'needs_improvement',
          questionEvaluations: [],
          recommendations: ['Add more detail'],
          weakAnswerMap: [
            {
              key: 'q1',
              label: 'Revenue model',
              score: 1,
              verdict: 'insufficient',
              feedback: 'Too vague',
              fixType: 'rewrite' as any,
              isRequired: true,
            },
            {
              key: 'q2',
              label: 'Timeline',
              score: 2,
              verdict: 'needs_improvement',
              feedback: 'Missing dates',
              fixType: 'expand' as any,
              isRequired: false,
            },
          ],
        },
        '2026-09-18T12:00:00Z',
        'assign-4'
      );
      expect(s.signals).toHaveLength(2);
      expect(s.signals[0]).toEqual({
        label: 'Revenue model',
        severity: 'critical',
        message: 'Too vague',
      });
      expect(s.signals[1]).toEqual({
        label: 'Timeline',
        severity: 'warning',
        message: 'Missing dates',
      });
      expect(s.verdict).toBe('needs_attention');
    });

    it('preserves rubricVersion when present', () => {
      const s = fromInterviewAiReview(
        {
          overallScore: 4,
          overallVerdict: 'ready_for_approval',
          questionEvaluations: [],
          recommendations: [],
          weakAnswerMap: [],
          rubricVersion: 'v2.1',
        } as any,
        null,
        'assign-5'
      );
      expect(s.rubricVersion).toBe('v2.1');
    });
  });

  it('preserves interview identity for populated partial list snapshots', () => {
    const summary = fromInterviewAiReview(
      { overallScore: 3, weakAnswerMap: [{ key: 'q', verdict: 'unanswered' }] },
      null,
      'session-partial'
    );
    expect(summary.sourceModule).toBe('interview');
    expect(summary.sourceId).toBe('session-partial');
    expect(summary.score0to100).toBe(50);
    expect(summary.signals).toEqual([{ label: 'q', severity: 'critical', message: '' }]);
    expect(fromInterviewAiReview({}, null, 'session-empty').score0to100).toBeNull();
  });
});
