import { describe, expect, it } from 'vitest';

import {
  buildForceLadderPromptBlock,
  getNextPorterQuestion,
  getPorterEntryQuestion,
  getPorterQuestionById,
  PORTER_FORCE_IDS,
  PORTER_QUESTION_BANK,
  validatePorterQuestionBank,
} from '@/config/porter/porterQuestionBank';

describe('porterQuestionBank — structural integrity', () => {
  it('has no structural problems (branches resolve, levels present, no cycles)', () => {
    expect(validatePorterQuestionBank()).toEqual([]);
  });

  it('covers all five forces with a 4-level ladder each', () => {
    PORTER_FORCE_IDS.forEach((force) => {
      const questions = PORTER_QUESTION_BANK[force];
      const levels = questions.map((q) => q.level).sort();
      expect(levels).toEqual([1, 2, 3, 4]);
    });
  });

  it('every question is bilingual and every option carries an intensityDelta', () => {
    PORTER_FORCE_IDS.forEach((force) => {
      PORTER_QUESTION_BANK[force].forEach((q) => {
        expect(q.textEn.length).toBeGreaterThan(0);
        expect(q.textPl.length).toBeGreaterThan(0);
        q.answerOptions.forEach((opt) => {
          expect([-1, 0, 1]).toContain(opt.intensityDelta);
          expect(opt.labelPl.length).toBeGreaterThan(0);
        });
      });
    });
  });
});

describe('porterQuestionBank — branching resolver', () => {
  it('walks the rivalry ladder from surface to a terminal via branch keys', () => {
    const entry = getPorterEntryQuestion('rivalry');
    expect(entry.id).toBe('riv1-surface');

    const l2 = getNextPorterQuestion('riv1-surface', 'price-war');
    expect(l2?.id).toBe('riv2-concentration');

    const l3 = getNextPorterQuestion('riv2-concentration', 'fragmented-overcapacity');
    expect(l3?.id).toBe('riv3-quantify');

    const l4 = getNextPorterQuestion('riv3-quantify', 'quantified-tight');
    expect(l4?.id).toBe('riv4-trend');

    // L4 branches terminate the ladder.
    expect(getNextPorterQuestion('riv4-trend', 'intensifying')).toBeNull();
  });

  it('falls back to defaultNextId on an unknown answer key (never dead-ends)', () => {
    const next = getNextPorterQuestion('riv1-surface', 'nonsense-key');
    expect(next?.id).toBe('riv2-concentration');
  });

  it('returns null for an unknown question id', () => {
    expect(getNextPorterQuestion('ghost', 'any')).toBeNull();
    expect(getPorterQuestionById('ghost')).toBeUndefined();
  });
});

describe('porterQuestionBank — prompt serialization (single source of truth)', () => {
  it('renders the ladder with branch keys and intensity deltas for the AI mentor', () => {
    const block = buildForceLadderPromptBlock('buyerPower', 'en');
    expect(block).toContain('[buy1-surface]');
    expect(block).toContain('concentrated-buyers');
    expect(block).toContain('Δintensity');
    // Polish variant is distinct.
    const pl = buildForceLadderPromptBlock('buyerPower', 'pl');
    expect(pl).not.toEqual(block);
  });
});
