/**
 * Dowód na defekt #5/#8 audytu FIN 2026-09-06: analiza istniejąca WYŁĄCZNIE
 * jako artefakt kanoniczny pojawia się na liście, a wiersze legacy nie znikają.
 */
import { describe, expect, it } from 'vitest';

import { mergeCanonicalArtifactsIntoFinanceRows } from '../financeCanonicalMerge';

describe('mergeCanonicalArtifactsIntoFinanceRows', () => {
  it('analiza tylko kanoniczna trafia na listę (stan zmierzony na DBR77: 0 legacy, 1 kanoniczna)', () => {
    const merged = mergeCanonicalArtifactsIntoFinanceRows(
      [],
      [{ id: 'fbc655e9', canonicalArtifactId: 'fbc655e9', title: 'Analiza wskaźnikowa 2024–2025 — CD PROJEKT' }]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('Analiza wskaźnikowa 2024–2025 — CD PROJEKT');
  });

  it('wiersze legacy zostają i idą pierwsze', () => {
    const legacy = [{ id: 'leg-1', title: 'Analiza klasyczna' }];
    const merged = mergeCanonicalArtifactsIntoFinanceRows(legacy, [
      { id: 'art-9', canonicalArtifactId: 'art-9', title: 'Sierota kanoniczna' },
    ]);
    expect(merged.map((r) => r.title)).toEqual(['Analiza klasyczna', 'Sierota kanoniczna']);
  });

  it('nie duplikuje: wiersz legacy wskazujący na ten artefakt wygrywa kolizję', () => {
    const legacy = [{ id: 'leg-1', canonicalArtifactId: 'art-9', title: 'Analiza klasyczna (bogatsza)' }];
    const merged = mergeCanonicalArtifactsIntoFinanceRows(legacy, [
      { id: 'art-9', canonicalArtifactId: 'art-9', title: 'Rejestr kanoniczny (uboższy)' },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('Analiza klasyczna (bogatsza)');
  });

  it('bez sierot zwraca DOKŁADNIE tę samą tablicę (memoizacja wołającego nie jest psuta)', () => {
    const legacy = [{ id: 'leg-1', canonicalArtifactId: 'art-9' }];
    expect(mergeCanonicalArtifactsIntoFinanceRows(legacy, [])).toBe(legacy);
    expect(
      mergeCanonicalArtifactsIntoFinanceRows(legacy, [{ id: 'art-9', canonicalArtifactId: 'art-9' }])
    ).toBe(legacy);
  });
});
