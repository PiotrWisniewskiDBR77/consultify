import { describe, it, expect } from 'vitest';
import { calculateAxisScoreV2, calculateOverallScoreV2, calculateAxisScore } from '@/services/drdStructure';

describe('OPUS PROBE — COORD-11 drd_scoring_v2', () => {
  it('★ 5/5 i 5/7 NIE daja tego samego wyniku znormalizowanego', () => {
    // 2A: os 2, skala 1-5 -> poziom 5 = MAKSIMUM = 1.0
    const max5 = calculateAxisScoreV2(2, { '2A': { actual: 5, target: 5 } } as never);
    // 1A: os 1, skala 1-7 -> poziom 5 = (5-1)/(7-1) = 0.667
    const mid7 = calculateAxisScoreV2(1, { '1A': { actual: 5, target: 5 } } as never);
    console.log('PROBE v2 2A(5/5) =', JSON.stringify(max5));
    console.log('PROBE v2 1A(5/7) =', JSON.stringify(mid7));
    expect(max5.scoreNorm).not.toBeNull();
    expect(mid7.scoreNorm).not.toBeNull();
    expect(max5.scoreNorm!).toBeCloseTo(1.0, 3);
    expect(mid7.scoreNorm!).toBeCloseTo(0.6667, 3);
    expect(max5.scoreNorm!).not.toBeCloseTo(mid7.scoreNorm!, 3);
  });

  it('★ legacy NADAL myli 5/5 z 5/7 (dowod, ze nie poprawiono go po cichu)', () => {
    const a = calculateAxisScore(2, { '2A': { actual: 5, target: 5 } });
    const b = calculateAxisScore(1, { '1A': { actual: 5, target: 5 } });
    console.log('PROBE legacy 2A =', a.actual, '| legacy 1A =', b.actual);
    expect(a.actual).toBe(b.actual);
  });

  it('★ unassessed NIE jest zerem i obniza coverage, nie wynik', () => {
    const dwa = calculateAxisScoreV2(2, {
      '2A': { actual: 4, target: 5 }, '2B': { actual: 4, target: 5 },
    } as never);
    const zNieocenionym = calculateAxisScoreV2(2, {
      '2A': { actual: 4, target: 5 }, '2B': { actual: 4, target: 5 },
      '2C': { actual: 0, target: 0 },
    } as never);
    console.log('PROBE v2 dwa ocenione   =', JSON.stringify(dwa));
    console.log('PROBE v2 + nieoceniony  =', JSON.stringify(zNieocenionym));
    // wynik NIE spada (kanon: nieoceniony nie wchodzi do sredniej)
    expect(zNieocenionym.scoreNorm).not.toBeNull();
    expect(dwa.scoreNorm).not.toBeNull();
    expect(zNieocenionym.scoreNorm!).toBeCloseTo(dwa.scoreNorm!, 4);
    // ale coverage spada
    expect(zNieocenionym.coverage).toBeLessThan(dwa.coverage);
  });

  it('★ agregacja 2/3 ocenionych pokazuje coverage 66,7%', () => {
    const r = calculateAxisScoreV2(2, {
      '2A': { actual: 4, target: 5 }, '2B': { actual: 3, target: 5 },
      '2C': { actual: 0, target: 0 },
    } as never);
    console.log('PROBE coverage 2/3 =', r.coverage, '| assessed =', r.assessedCount, '| unassessed =', r.unassessedCount);
    expect(r.assessedCount).toBe(2);
    expect(r.unassessedCount).toBe(1);
    expect(r.coverage).toBeCloseTo(2 / 3, 3);
  });
});
