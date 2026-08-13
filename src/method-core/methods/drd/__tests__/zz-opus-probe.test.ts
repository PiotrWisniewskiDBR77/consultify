import { describe, it, expect, vi } from 'vitest';
import { drdAdapter } from '@/method-core/methods/drd/drdAdapter';
import { compileDrdPack } from '@/method-core/methods/drd/compileDrdPack';
import { canStartSession } from '@/method-core/contracts';

describe('OPUS PROBE — DRD', () => {
  it('aboveGap NIE podnosi currentLevel', () => {
    const r = drdAdapter.resolveOpenLevels({
      unitId: '1A', confirmedLevels: [1, 2, 4, 5],
      evidenceByLevel: { 1: 'E3', 2: 'E3', 4: 'E3', 5: 'E3' },
    });
    expect(r.currentLevel).toBe(2);
    expect(r.blockedAtLevel).toBe(3);
    expect(r.aboveGapLevels).toEqual(expect.arrayContaining([4, 5]));
  });

  it('skala jest PER OS', () => {
    const { pack } = compileDrdPack();
    expect(pack.units).toHaveLength(39);
    const s = (id: string) => pack.units.find(u => u.unitId === id)!.levelScale;
    expect(s('1A')).toEqual([1,2,3,4,5,6,7]);
    expect(s('4A')).toEqual([1,2,3,4,5,6,7]);
    expect(s('5A')).toEqual([1,2,3,4,5,6]);
    expect(s('7A')).toEqual([1,2,3,4,5]);
    expect(s('2A')).toEqual([1,2,3,4,5]);
  });

  it('readiness jest uczciwy — pack NIE startuje sesji', () => {
    const { pack } = compileDrdPack();
    console.log('PROBE readiness =', pack.manifest.readiness);
    expect(canStartSession(pack.manifest.readiness)).toBe(false);
  });

  it('DETERMINIZM z pominieciem cache modulu (prawdziwy test)', async () => {
    vi.resetModules();
    const m1 = await import('@/method-core/methods/drd/compileDrdPack');
    const a = JSON.stringify(m1.compileDrdPack().pack);
    vi.resetModules();
    const m2 = await import('@/method-core/methods/drd/compileDrdPack');
    const b = JSON.stringify(m2.compileDrdPack().pack);
    console.log('PROBE dlugosci:', a.length, b.length, '| rowne:', a === b);
    expect(b).toBe(a);
  });
});
