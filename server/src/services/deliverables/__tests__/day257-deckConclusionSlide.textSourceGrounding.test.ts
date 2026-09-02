import { describe, expect, it } from 'vitest';

import {
  buildDeckConclusionFacts,
  buildDeterministicDeckConclusion,
  validateDeckConclusion,
} from '../deckConclusionSlide.js';

describe('Day 257 deck conclusion text-source grounding', () => {
  it('keeps literal zero counts when the source is genuinely empty', () => {
    const facts = buildDeckConclusionFacts({
      language: 'pl',
      artifactData: {},
      contextPack: { key_points: [], data_points: [] },
    });

    const conclusion = buildDeterministicDeckConclusion(facts);

    expect(conclusion.k1Text).toContain('0 inicjatyw i 0 ryzyk');
    expect(validateDeckConclusion(conclusion, facts).allHardPass).toBe(true);
  });

  it('hedges unknown counts instead of asserting zero for a non-empty text source', () => {
    const facts = buildDeckConclusionFacts({
      language: 'pl',
      artifactData: { _initiatives: [], _risks: [] },
      contextPack: {
        key_points: [
          'Program obejmuje inicjatywy automatyzacji i standaryzacji oraz ryzyka integracji.',
        ],
        data_points: [{ label: 'Oczekiwany efekt', value: 'krótszy lead time' }],
      },
    });

    const conclusion = buildDeterministicDeckConclusion(facts);

    expect(conclusion.k1Text).not.toContain('0 inicjatyw i 0 ryzyk');
    expect(conclusion.k1Text).toContain('bez ustrukturyzowanej liczby inicjatyw i ryzyk');
    expect(conclusion.k2Text).not.toContain('0 inicjatyw');
    expect(conclusion.k3Actions.some((item) => item.action.includes('Ustrukturyzuj ryzyka'))).toBe(
      true
    );
    expect(validateDeckConclusion(conclusion, facts).allHardPass).toBe(true);
  });
});
