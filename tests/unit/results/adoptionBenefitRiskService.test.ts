import { describe, expect, it } from 'vitest';

import {
  adoptionToBenefitRisk,
  diceScore,
  flagBenefitAtRiskByAdoption,
} from '../../../server/src/services/results/adoptionBenefitRiskService.js';

describe('adoptionBenefitRiskService', () => {
  describe('diceScore', () => {
    it('classifies a strong change as Win zone', () => {
      // short, frequent reviews + excellent team + full commitment + low effort
      const res = diceScore({
        reviewIntervalWeeks: 4, // D=1
        teamIntegrity: 1, // I=1
        seniorCommitment: 1, // C1=1
        localCommitment: 1, // C2=1
        extraEffortPct: 5, // E=1
      });
      // 1 + 2*1 + 2*1 + 1 + 1 = 7
      expect(res.score).toBe(7);
      expect(res.zone).toBe('win');
    });

    it('classifies a middling change as Worry zone', () => {
      const res = diceScore({
        reviewIntervalWeeks: 20, // D=3
        teamIntegrity: 2, // I=2
        seniorCommitment: 2, // C1=2
        localCommitment: 2, // C2=2
        extraEffortPct: 30, // E=3
      });
      // 3 + 2*2 + 2*2 + 2 + 3 = 16
      expect(res.score).toBe(16);
      expect(res.zone).toBe('worry');
    });

    it('classifies a fragile change as Woe zone', () => {
      const res = diceScore({
        durationWeeks: 40, // D=4
        teamIntegrity: 4, // I=4
        seniorCommitment: 4, // C1=4
        localCommitment: 4, // C2=4
        extraEffortPct: 60, // E=4
      });
      // 4 + 2*4 + 2*4 + 4 + 4 = 28
      expect(res.score).toBe(28);
      expect(res.zone).toBe('woe');
    });

    it('uses neutral defaults when inputs are missing', () => {
      const res = diceScore({});
      // D=2 (no duration), I=2, C1=2, C2=2, E=1 => 2+4+4+2+1 = 13
      expect(res.score).toBe(13);
      expect(res.zone).toBe('win');
    });

    it('normalises out-of-range factors to the 1..4 scale', () => {
      const res = diceScore({
        reviewIntervalWeeks: 4, // D=1
        teamIntegrity: 99, // clamps to 4
        seniorCommitment: -5, // clamps to 1
        localCommitment: 1,
        extraEffortPct: 5, // E=1
      });
      // 1 + 2*4 + 2*1 + 1 + 1 = 13
      expect(res.score).toBe(13);
    });

    it('prefers reviewIntervalWeeks over durationWeeks for D', () => {
      const res = diceScore({
        durationWeeks: 52, // would be D=4
        reviewIntervalWeeks: 4, // D=1 wins
        teamIntegrity: 1,
        seniorCommitment: 1,
        localCommitment: 1,
        extraEffortPct: 5,
      });
      expect(res.score).toBe(7);
      expect(res.zone).toBe('win');
    });
  });

  describe('adoptionToBenefitRisk', () => {
    it('returns low risk for healthy adoption', () => {
      const res = adoptionToBenefitRisk({
        adoptionScore: 0.9,
        sentimentTrend: 'improving',
        championCoveragePct: 60,
      });
      expect(res.risk).toBe('low');
      expect(res.reasons.length).toBeGreaterThan(0);
    });

    it('returns high risk for low adoption + declining + no champions', () => {
      const res = adoptionToBenefitRisk({
        adoptionScore: 0.2,
        sentimentTrend: 'declining',
        championCoveragePct: 0,
      });
      expect(res.risk).toBe('high');
      expect(res.reasons.join(' ')).toMatch(/[Ll]ow adoption/);
      expect(res.reasons.join(' ')).toMatch(/[Dd]eclining/);
      expect(res.reasons.join(' ')).toMatch(/champion/i);
    });

    it('returns medium risk for partial adoption only', () => {
      const res = adoptionToBenefitRisk({
        adoptionScore: 0.55,
        sentimentTrend: 'improving',
        championCoveragePct: 60,
      });
      expect(res.risk).toBe('medium');
    });

    it('flags missing adoption data as a reason', () => {
      const res = adoptionToBenefitRisk({ championCoveragePct: 50 });
      expect(res.reasons.join(' ')).toMatch(/[Nn]o adoption data/);
      expect(['medium', 'high']).toContain(res.risk);
    });

    it('escalates an otherwise-healthy benefit to medium on declining sentiment', () => {
      const res = adoptionToBenefitRisk({
        adoptionScore: 0.85,
        sentimentTrend: 'declining',
        championCoveragePct: 60,
      });
      // declining alone (+2) lifts an otherwise-low benefit to at least medium
      expect(res.risk).toBe('medium');
      expect(res.reasons.join(' ')).toMatch(/[Dd]eclining/);
    });

    it('declining sentiment compounding with weak coverage reaches high', () => {
      const res = adoptionToBenefitRisk({
        adoptionScore: 0.85,
        sentimentTrend: 'declining', // +2
        championCoveragePct: 10, // +1
      });
      expect(res.risk).toBe('high');
    });
  });

  describe('flagBenefitAtRiskByAdoption', () => {
    it('flags items in DICE Woe zone', () => {
      const out = flagBenefitAtRiskByAdoption([
        { id: 'b1', name: 'Throughput', adoptionScore: 0.9, diceZone: 'woe' },
      ]);
      expect(out[0].atRiskByAdoption).toBe(true);
      expect(out[0].reason).toMatch(/Woe/);
    });

    it('flags items with adoption below 0.4', () => {
      const out = flagBenefitAtRiskByAdoption([
        { id: 'b2', name: 'Cost save', adoptionScore: 0.3, diceZone: 'win' },
      ]);
      expect(out[0].atRiskByAdoption).toBe(true);
      expect(out[0].reason).toMatch(/40%/);
    });

    it('does not flag healthy items', () => {
      const out = flagBenefitAtRiskByAdoption([
        { id: 'b3', name: 'Quality', adoptionScore: 0.8, diceZone: 'win' },
      ]);
      expect(out[0].atRiskByAdoption).toBe(false);
      expect(out[0].reason).toBeUndefined();
    });

    it('combines both reasons when woe and low adoption coincide', () => {
      const out = flagBenefitAtRiskByAdoption([
        { id: 'b4', adoptionScore: 0.2, diceZone: 'woe' },
      ]);
      expect(out[0].atRiskByAdoption).toBe(true);
      expect(out[0].reason).toMatch(/Woe/);
      expect(out[0].reason).toMatch(/40%/);
    });

    it('preserves id/name and returns [] for non-array input', () => {
      const out = flagBenefitAtRiskByAdoption([{ id: 'b5', name: 'Keep' }]);
      expect(out[0].id).toBe('b5');
      expect(out[0].name).toBe('Keep');
      expect(out[0].atRiskByAdoption).toBe(false);
      // @ts-expect-error — exercising defensive guard
      expect(flagBenefitAtRiskByAdoption(null)).toEqual([]);
    });
  });
});
