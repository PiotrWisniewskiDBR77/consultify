import { describe, it, expect } from 'vitest';
import { drdAdapter } from '@/method-core/methods/drd/drdAdapter';
import { DRD_AGGREGATION_VERSION } from '@/method-core/methods/drd/compileDrdPack';

describe('OPUS — aggregate: byGroup natywne, byGroupNorm porownywalne', () => {
  it('★ ta sama LICZBA na osi 1 (1-7) i osi 2 (1-5) daje ROZNE wartosci znormalizowane', () => {
    const r = drdAdapter.aggregate({
      unitLevels: { '1A': 5, '2A': 5 },
      mappingVersion: DRD_AGGREGATION_VERSION,
    });
    console.log('PROBE byGroup     =', JSON.stringify(r.byGroup));
    console.log('PROBE byGroupNorm =', JSON.stringify(r.byGroupNorm));
    const axis1 = Object.keys(r.byGroup).find((k) => k.includes('1'))!;
    const axis2 = Object.keys(r.byGroup).find((k) => k.includes('2'))!;
    // natywne: obie 5 — nierozroznialne
    expect(r.byGroup[axis1]).toBe(5);
    expect(r.byGroup[axis2]).toBe(5);
    // znormalizowane: 5 na skali 1-7 = 0.6667, na 1-5 = 1.0
    expect(r.byGroupNorm![axis1]).toBeCloseTo(0.6667, 3);
    expect(r.byGroupNorm![axis2]).toBeCloseTo(1.0, 3);
  });

  it('byGroup NIE zmienil sie — zero cichej zmiany istniejacych Outputow', () => {
    const r = drdAdapter.aggregate({
      unitLevels: { '1A': 4, '1B': 6 },
      mappingVersion: DRD_AGGREGATION_VERSION,
    });
    const axis1 = Object.keys(r.byGroup).find((k) => k.includes('1'))!;
    expect(r.byGroup[axis1]).toBe(5); // (4+6)/2 — dokladnie jak wczesniej
  });

  it('brak danych -> null w obu, nie zero', () => {
    const r = drdAdapter.aggregate({
      unitLevels: { '1A': null },
      mappingVersion: DRD_AGGREGATION_VERSION,
    });
    const axis1 = Object.keys(r.byGroup).find((k) => k.includes('1'))!;
    expect(r.byGroup[axis1]).toBeNull();
    expect(r.byGroupNorm![axis1]).toBeNull();
    expect(r.excluded['1A']).toBeTruthy();
  });
});
