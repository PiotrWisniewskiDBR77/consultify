import { describe, it, expect } from 'vitest';
import { compileSiriPack } from '@/method-core/methods/siri/compileSiriPack';
import { siriAdapter } from '@/method-core/methods/siri/siriAdapter';
import { canStartSession } from '@/method-core/contracts';
import { calculateImpactValue } from '@/services/siriPrioritisation';

describe('OPUS PROBE — SIRI', () => {
  it('16 wymiarow jako jednostki oceny, Bands 0-5, mapowanie na 8 filarow i 3 bloki', () => {
    const { pack } = compileSiriPack();
    expect(pack.units).toHaveLength(16);
    for (const u of pack.units) {
      expect(u.levelScale).toEqual([0, 1, 2, 3, 4, 5]);
      expect(u.parentId).toBeTruthy();          // zaden unit nie jest osierocony
    }
    const pillars = new Set(pack.units.map(u => u.parentId));
    expect(pillars.size).toBe(8);
    console.log('PROBE pillars =', [...pillars].sort().join(','));
  });

  it('readiness uczciwy — pack NIE startuje sesji', () => {
    const { pack } = compileSiriPack();
    console.log('PROBE readiness =', pack.manifest.readiness);
    expect(canStartSession(pack.manifest.readiness)).toBe(false);
  });

  it('no-leapfrog: Band 4 bez Bandu 2 jest zablokowany', () => {
    const r = siriAdapter.resolveOpenLevels({
      unitId: 'vertical_integration',
      confirmedLevels: [0, 1, 4],
      evidenceByLevel: { 0: 'E3', 1: 'E3', 4: 'E3' },
    });
    console.log('PROBE no-leapfrog =', JSON.stringify(r));
    expect(r.currentLevel).toBe(1);
    expect(r.blockedAtLevel).toBe(2);
    expect(r.aboveGapLevels).toContain(4);
  });

  it('★ DEFEKT ISTNIEJACEGO SILNIKA: brak normalizacji (Step 6 whitepaper)', () => {
    // Whitepaper str.36 Step 6: kazdy czynnik dzieli sie przez Total ZANIM
    // przylozy sie wagi (Step 7). Silnik mnozy wagi przez SUROWE termy.
    // Dowod: dwa wymiary o identycznym profilu, ale rozna skala costProfile,
    // dostaja Impact Value proporcjonalne do surowej skali.
    const base = { areaId: 'vertical_integration', costRelevance: 1, kpiRelevance: 1, kpiImportance: 1, bic: 4, ams: 1 };
    const small = calculateImpactValue({ ...base, costProfile: 1 });
    const big = calculateImpactValue({ ...base, costProfile: 100 });
    console.log('PROBE IV(costProfile=1) =', small, '| IV(costProfile=100) =', big);
    // Gdyby normalizacja byla wykonana, skala surowa nie przenosilaby sie 1:1.
    expect(big).toBeGreaterThan(small * 2); // surowa skala dominuje wynik
  });

  it('★ DEFEKT ISTNIEJACEGO SILNIKA: ujemny proximity NIE jest obcinany do 0 (Step 4)', () => {
    // Whitepaper str.36 Step 4: "If the difference has a negative value,
    // indicate 0 into the Proximity Factor row."
    const iv = calculateImpactValue({
      areaId: 'vertical_integration', costRelevance: 0, costProfile: 0,
      kpiRelevance: 0, kpiImportance: 0, bic: 1, ams: 5,   // firma LEPSZA niz BIC
    });
    console.log('PROBE IV przy BIC-AMS = -4 :', iv);
    expect(iv).toBeLessThan(0);   // dowod defektu: wynik ujemny zamiast 0
  });
});
