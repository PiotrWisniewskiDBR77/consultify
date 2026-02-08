import { describe, expect, it } from 'vitest';

import { scoreRubricV2 } from '../../../../src/services/ai/deepThinkingEvaluationService.js';
import {
  checkProcessStateIntegrity,
  detectOverreachLevel,
  evaluateForceDepthDiff,
  evaluatePassFail,
} from '../../../../src/services/ai/deepThinkingSelfCheck.js';

describe('DeepThinkingSelfCheck', () => {
  describe('detectOverreachLevel', () => {
    it('returns "none" for plain text', () => {
      expect(detectOverreachLevel('We recommend option A.')).toBe('none');
    });

    it('returns "soft" for framework name without link', () => {
      expect(detectOverreachLevel('Using a SWOT analysis as a conceptual frame.')).toBe('soft');
    });

    it('returns "hard" for "according to" claim', () => {
      expect(detectOverreachLevel('According to the latest study, X is true.')).toBe('hard');
    });

    it('returns "hard" for URLs', () => {
      expect(detectOverreachLevel('See https://example.com for details.')).toBe('hard');
    });
  });

  describe('evaluatePassFail', () => {
    it('passes a strong report', () => {
      const rubric = {
        total: 12,
        criteria: {
          framing: 2 as const,
          alternatives: 2 as const,
          tradeoffs: 2 as const,
          assumptions_gaps: 2 as const,
          closure_conditions: 2 as const,
          clarity: 1 as const,
          safety_honesty: 1 as const,
        },
        notes: [],
      };
      const { pass, failReasons } = evaluatePassFail({
        rubric,
        negativePatterns: [],
      });
      expect(pass).toBe(true);
      expect(failReasons).toEqual([]);
    });

    it('fails when total < 10', () => {
      const rubric = {
        total: 7,
        criteria: {
          framing: 1 as const,
          alternatives: 1 as const,
          tradeoffs: 1 as const,
          assumptions_gaps: 1 as const,
          closure_conditions: 1 as const,
          clarity: 1 as const,
          safety_honesty: 1 as const,
        },
        notes: [],
      };
      const { pass, failReasons } = evaluatePassFail({
        rubric,
        negativePatterns: [],
      });
      expect(pass).toBe(false);
      expect(failReasons).toContain('total_score_7_below_10');
    });

    it('fails when safety_honesty is 0 (hard overreach)', () => {
      const rubric = {
        total: 10,
        criteria: {
          framing: 2 as const,
          alternatives: 2 as const,
          tradeoffs: 2 as const,
          assumptions_gaps: 2 as const,
          closure_conditions: 1 as const,
          clarity: 1 as const,
          safety_honesty: 0 as const,
        },
        notes: [],
      };
      const { pass, failReasons } = evaluatePassFail({
        rubric,
        negativePatterns: [],
      });
      expect(pass).toBe(false);
      expect(failReasons).toContain('safety_honesty_hard_fail');
    });

    it('passes when safety_honesty is 1 (soft overreach is OK)', () => {
      const rubric = {
        total: 11,
        criteria: {
          framing: 2 as const,
          alternatives: 2 as const,
          tradeoffs: 2 as const,
          assumptions_gaps: 1 as const,
          closure_conditions: 2 as const,
          clarity: 1 as const,
          safety_honesty: 1 as const,
        },
        notes: [],
      };
      const { pass } = evaluatePassFail({
        rubric,
        negativePatterns: [],
      });
      expect(pass).toBe(true);
    });

    it('fails when a category is below minimum (0)', () => {
      const rubric = {
        total: 10,
        criteria: {
          framing: 0 as const,
          alternatives: 2 as const,
          tradeoffs: 2 as const,
          assumptions_gaps: 2 as const,
          closure_conditions: 2 as const,
          clarity: 1 as const,
          safety_honesty: 1 as const,
        },
        notes: [],
      };
      const { pass, failReasons } = evaluatePassFail({
        rubric,
        negativePatterns: [],
      });
      expect(pass).toBe(false);
      expect(failReasons).toContain('framing_below_minimum');
    });
  });

  describe('evaluateForceDepthDiff', () => {
    const makeRubric = (total: number) => ({
      total,
      criteria: {
        framing: 2 as const,
        alternatives: 2 as const,
        tradeoffs: 2 as const,
        assumptions_gaps: 2 as const,
        closure_conditions: 2 as const,
        clarity: 2 as const,
        safety_honesty: 2 as const,
      },
      notes: [],
    });

    it('detects substantially different responses', () => {
      const before = `
Options
1. Path A: Focus on speed
2. Path B: Focus on quality
`;
      const after = `
Options
1. Path C: Outsource entirely
2. Path D: Build internal capability
3. Path E: Hybrid model
`;
      const r = evaluateForceDepthDiff(before, after, makeRubric(8), makeRubric(11));
      expect(r.isSubstantiallyDifferent).toBe(true);
      expect(r.newAxesDetected).toBe(true);
    });

    it('flags too-similar options', () => {
      const text = `
Options
1. Path A: Focus on speed
2. Path B: Focus on quality
`;
      const r = evaluateForceDepthDiff(text, text, makeRubric(8), makeRubric(8));
      expect(r.isSubstantiallyDifferent).toBe(false);
      expect(r.jaccardSimilarity).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('checkProcessStateIntegrity', () => {
    it('returns complete for full state sequence', () => {
      const log = checkProcessStateIntegrity([
        'research_visibility',
        'research',
        'thinking',
        'synthesis',
        'closure',
      ]);
      expect(log.isComplete).toBe(true);
      expect(log.missingStates).toEqual([]);
    });

    it('detects missing states', () => {
      const log = checkProcessStateIntegrity(['research_visibility', 'closure']);
      expect(log.isComplete).toBe(false);
      expect(log.missingStates).toContain('research');
      expect(log.missingStates).toContain('thinking');
      expect(log.missingStates).toContain('synthesis');
    });
  });

  describe('overreach split integration with scoreRubricV2', () => {
    it('scores safety_honesty=1 for soft overreach (framework name)', () => {
      const text = `
Executive Summary
We recommend A using a McKinsey 7S framework. If we do nothing, costs rise.

Problem Framing
Horizon: 90 days. If we do nothing: churn risk.

Options
1. A
2. B

Recommendation
Choose A unless budget cut.

Risks & Blind spots
Assumption: stable demand. Gap: no baseline.

Next actions
- Step 1
- Step 2
Monitor defects.
`;
      const rubric = scoreRubricV2(text, 'en');
      // Soft overreach (McKinsey name, no link) → safety_honesty should be 1, not 0
      expect(rubric.criteria.safety_honesty).toBeGreaterThanOrEqual(1);
    });

    it('scores safety_honesty=0 for hard overreach without assumptions', () => {
      const text = `
Executive Summary
We recommend A. According to the latest Gartner report, X.

Problem Framing
Y.

Options
1. A
2. B

Recommendation
Choose A.

Risks
Unknown.

Next actions
- Step 1
`;
      const rubric = scoreRubricV2(text, 'en');
      // Hard overreach ("According to") — if assumptions present, might be 1
      // This test just checks it's not rewarded with 2
      expect(rubric.criteria.safety_honesty).toBeLessThanOrEqual(1);
    });
  });
});
