import { describe, it, expect } from 'vitest';
import { calculateOverallScore, calculateAxisScore } from '@/services/drdStructure';

describe('OPUS PROBE — agregacja DRD vs kanon §6', () => {
  it('DEFEKT 1: brak normalizacji min-max — poziom 5/5 traktowany jak 5/7', () => {
    // 2A: oś 2, skala 1-5 → poziom 5 = MAKSIMUM = 1.0 znormalizowane
    // 1A: oś 1, skala 1-7 → poziom 5 = (5-1)/(7-1) = 0.667 znormalizowane
    const a = calculateOverallScore({ '2A': { actual: 5, target: 5 } });
    const b = calculateOverallScore({ '1A': { actual: 5, target: 5 } });
    console.log('PROBE 2A(5/5, maksimum osi) =', JSON.stringify(a));
    console.log('PROBE 1A(5/7, 66,7% osi)   =', JSON.stringify(b));
    // Kanon: te dwa MUSZA sie roznic (1.0 vs 0.667). Kod: identyczne.
    expect(a.actual).toBe(b.actual); // dowod defektu
  });

  it('DEFEKT 2: nieocenione obszary (0) WCHODZA do sredniej — kanon tego ZAKAZUJE', () => {
    // Kanon §6.2: "Obszary nieocenione (score_raw = 0) nie wchodza do sredniej
    //              ... Zakaz liczenia zera jako poziomu."
    const ocenione = calculateAxisScore(2, {
      '2A': { actual: 4, target: 5 },
      '2B': { actual: 4, target: 5 },
    });
    const zJednymNieocenionym = calculateAxisScore(2, {
      '2A': { actual: 4, target: 5 },
      '2B': { actual: 4, target: 5 },
      '2C': { actual: 0, target: 0 },   // NIEOCENIONY
    });
    console.log('PROBE dwa ocenione        =', JSON.stringify(ocenione));
    console.log('PROBE + jeden nieoceniony =', JSON.stringify(zJednymNieocenionym));
    // Kanon: wynik ma zostac 4.0 (nieoceniony obniza completeness, nie wynik).
    // Kod: 8/3 = 2.7 — nieoceniony obszar OBNIZA wynik jak realna ocena zero.
    expect(zJednymNieocenionym.actual).toBeLessThan(ocenione.actual);
    expect(zJednymNieocenionym.actual).toBeCloseTo(2.7, 1);
  });
});
