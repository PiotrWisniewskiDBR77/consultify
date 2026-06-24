import { describe, expect, it } from 'vitest';

import {
  recommendReallocation,
  reallocationSummary,
} from '../../../server/src/services/results/valueReallocationService.js';

describe('valueReallocationService', () => {
  describe('recommendReallocation', () => {
    it('classifies low-realization/low-confidence items as from-candidates', () => {
      const rec = recommendReallocation([
        {
          id: 'a',
          name: 'Stalling project',
          realizationPct: 20,
          confidence: 0.3,
          capacityFte: 2,
        },
      ]);

      expect(rec.fromCandidates).toHaveLength(1);
      expect(rec.fromCandidates[0]).toMatchObject({
        id: 'a',
        name: 'Stalling project',
        capacityFte: 2,
      });
      expect(rec.fromCandidates[0].reason).toContain('Low realization');
      expect(rec.toCandidates).toHaveLength(0);
    });

    it('classifies high-realization/high-confidence items as to-candidates', () => {
      const rec = recommendReallocation([
        {
          id: 'b',
          name: 'Winning project',
          realizationPct: 90,
          confidence: 0.9,
          valueAtStake: 1000,
        },
      ]);

      expect(rec.toCandidates).toHaveLength(1);
      expect(rec.toCandidates[0]).toMatchObject({
        id: 'b',
        name: 'Winning project',
      });
      expect(rec.toCandidates[0].reason).toContain('High realization');
      expect(rec.fromCandidates).toHaveLength(0);
    });

    it('does not classify mixed items (good realization but low confidence)', () => {
      const rec = recommendReallocation([
        { id: 'mid', realizationPct: 80, confidence: 0.2, capacityFte: 1 },
      ]);

      expect(rec.fromCandidates).toHaveLength(0);
      expect(rec.toCandidates).toHaveLength(0);
      expect(rec.moves).toHaveLength(0);
    });

    it('pairs largest from (by capacity) with largest to (by value)', () => {
      const rec = recommendReallocation([
        // from-candidates (low realization + low confidence)
        { id: 'f-small', realizationPct: 10, confidence: 0.2, capacityFte: 1 },
        { id: 'f-big', realizationPct: 15, confidence: 0.3, capacityFte: 5 },
        // to-candidates (high realization + high confidence)
        { id: 't-low', realizationPct: 80, confidence: 0.8, valueAtStake: 100 },
        { id: 't-high', realizationPct: 95, confidence: 0.9, valueAtStake: 900 },
      ]);

      expect(rec.fromCandidates).toHaveLength(2);
      expect(rec.toCandidates).toHaveLength(2);
      expect(rec.moves).toHaveLength(2);

      // Biggest freed capacity (f-big) → biggest value at stake (t-high)
      expect(rec.moves[0]).toMatchObject({ fromId: 'f-big', toId: 't-high' });
      expect(rec.moves[0].rationale).toContain('5 FTE');
      // Remaining pair
      expect(rec.moves[1]).toMatchObject({ fromId: 'f-small', toId: 't-low' });
    });

    it('limits moves to the smaller side when counts are unequal', () => {
      const rec = recommendReallocation([
        { id: 'f1', realizationPct: 10, confidence: 0.2, capacityFte: 3 },
        { id: 'f2', realizationPct: 20, confidence: 0.1, capacityFte: 2 },
        { id: 't1', realizationPct: 90, confidence: 0.9, valueAtStake: 500 },
      ]);

      expect(rec.fromCandidates).toHaveLength(2);
      expect(rec.toCandidates).toHaveLength(1);
      expect(rec.moves).toHaveLength(1);
      expect(rec.moves[0]).toMatchObject({ fromId: 'f1', toId: 't1' });
    });

    it('handles empty / invalid input safely', () => {
      const rec = recommendReallocation([]);
      expect(rec.fromCandidates).toEqual([]);
      expect(rec.toCandidates).toEqual([]);
      expect(rec.moves).toEqual([]);

      // @ts-expect-error — guarding non-array input
      const rec2 = recommendReallocation(undefined);
      expect(rec2.moves).toEqual([]);
    });
  });

  describe('reallocationSummary', () => {
    it('sums freed FTE across moved from-items and counts moves', () => {
      const rec = recommendReallocation([
        { id: 'f-big', realizationPct: 15, confidence: 0.3, capacityFte: 5 },
        { id: 'f-small', realizationPct: 10, confidence: 0.2, capacityFte: 1 },
        { id: 't-high', realizationPct: 95, confidence: 0.9, valueAtStake: 900 },
        { id: 't-low', realizationPct: 80, confidence: 0.8, valueAtStake: 100 },
      ]);

      const summary = reallocationSummary(rec);
      expect(summary.moveCount).toBe(2);
      expect(summary.freedFte).toBe(6); // 5 + 1
    });

    it('counts only freed capacity for items actually moved', () => {
      const rec = recommendReallocation([
        { id: 'f1', realizationPct: 10, confidence: 0.2, capacityFte: 4 },
        { id: 'f2', realizationPct: 20, confidence: 0.1, capacityFte: 2 },
        { id: 't1', realizationPct: 90, confidence: 0.9, valueAtStake: 500 },
      ]);

      // 2 from-candidates but only 1 to-candidate → 1 move (the larger, f1=4 FTE)
      const summary = reallocationSummary(rec);
      expect(summary.moveCount).toBe(1);
      expect(summary.freedFte).toBe(4);
    });

    it('returns zeros for an empty recommendation', () => {
      const summary = reallocationSummary({
        fromCandidates: [],
        toCandidates: [],
        moves: [],
      });
      expect(summary).toEqual({ freedFte: 0, moveCount: 0 });
    });
  });
});
