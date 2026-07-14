import { describe, expect, it } from 'vitest';

import {
  buildFocusLadderPromptBlock,
  FOCUS_LADDER_ENTRY_ID,
  FOCUS_OPTION_LADDER,
  FOCUS_QUESTION_INDEX,
  getNextFocusQuestion,
  validateFocusQuestionBankStructure,
  validateForcedTradeoffAnswer,
} from '../../../src/config/focustradeoffs/focusQuestionBank';

describe('Focus & Trade-offs question bank — structure', () => {
  it('defines a 4-level ladder in canonical order starting at the entry question', () => {
    expect(FOCUS_OPTION_LADDER).toHaveLength(4);
    expect(FOCUS_OPTION_LADDER.map((q) => q.level)).toEqual([1, 2, 3, 4]);
    expect(FOCUS_OPTION_LADDER[0].id).toBe(FOCUS_LADDER_ENTRY_ID);
    expect(FOCUS_QUESTION_INDEX.has(FOCUS_LADDER_ENTRY_ID)).toBe(true);
  });

  it('every question has bilingual text, intent, and at least one answer option', () => {
    FOCUS_OPTION_LADDER.forEach((q) => {
      expect(q.textPl.trim().length).toBeGreaterThan(0);
      expect(q.textEn.trim().length).toBeGreaterThan(0);
      expect(q.intentPl.trim().length).toBeGreaterThan(0);
      expect(q.intentEn.trim().length).toBeGreaterThan(0);
      expect(q.answerOptions.length).toBeGreaterThan(0);
      q.answerOptions.forEach((opt) => {
        expect(opt.labelPl).not.toEqual(opt.labelEn);
        expect([-1, 0, 1]).toContain(opt.focusDelta);
      });
    });
  });

  it('the ladder is well-formed: no dangling branches, no cycles, no missing text', () => {
    const problems = validateFocusQuestionBankStructure();
    expect(problems).toEqual([]);
  });

  it('the level-3 forced-tradeoff question names the trade-off explicitly and can loop back on itself', () => {
    const node = FOCUS_QUESTION_INDEX.get('opt3-forced-tradeoff')!;
    expect(node.level).toBe(3);
    expect(node.branches['no-alternative-named']).toBe('opt3-forced-tradeoff');
    expect(node.branches['named-alternative']).toBe('opt4-rejection-justification');
  });

  it('the level-4 rejection-justification question terminates the ladder on every branch', () => {
    const node = FOCUS_QUESTION_INDEX.get('opt4-rejection-justification')!;
    expect(node.level).toBe(4);
    expect(node.defaultNextId).toBeNull();
    Object.values(node.branches).forEach((target) => expect(target).toBeNull());
  });
});

describe('Focus & Trade-offs question bank — branching', () => {
  it('getNextFocusQuestion follows the branch for a known answer key', () => {
    expect(getNextFocusQuestion('opt1-surface', 'external-mandate')).toBe('opt2-evidence');
    expect(getNextFocusQuestion('opt2-evidence', 'no-evidence')).toBe('opt3-forced-tradeoff');
    expect(getNextFocusQuestion('opt3-forced-tradeoff', 'named-alternative')).toBe(
      'opt4-rejection-justification'
    );
  });

  it('getNextFocusQuestion falls back to defaultNextId for an unknown answer key', () => {
    expect(getNextFocusQuestion('opt1-surface', 'never-heard-of-this-key')).toBe('opt2-evidence');
  });

  it('getNextFocusQuestion returns null for an unknown question id', () => {
    expect(getNextFocusQuestion('not-a-real-question', 'anything')).toBeNull();
  });

  it('walking the ladder end-to-end from the entry question reaches null in <= 5 hops', () => {
    let currentId: string | null = FOCUS_LADDER_ENTRY_ID;
    let hops = 0;
    while (currentId && hops < 10) {
      const node = FOCUS_QUESTION_INDEX.get(currentId)!;
      const firstKey = node.answerOptions[0].key;
      currentId = getNextFocusQuestion(currentId, firstKey);
      hops += 1;
    }
    expect(currentId).toBeNull();
    expect(hops).toBeLessThanOrEqual(5);
  });
});

describe('Focus & Trade-offs question bank — prompt block', () => {
  it('buildFocusLadderPromptBlock serializes every question with its branch keys', () => {
    const en = buildFocusLadderPromptBlock('en');
    const pl = buildFocusLadderPromptBlock('pl');
    FOCUS_OPTION_LADDER.forEach((q) => {
      expect(en).toContain(`[${q.id}]`);
      expect(pl).toContain(`[${q.id}]`);
    });
    expect(en).not.toEqual(pl);
    expect(en).toContain('Δfocus');
  });
});

describe('Focus & Trade-offs question bank — forced trade-off validator (stronger than standard W2)', () => {
  it('rejects an empty or too-short answer', () => {
    expect(validateForcedTradeoffAnswer(undefined, ['Option B']).valid).toBe(false);
    expect(validateForcedTradeoffAnswer('', ['Option B']).valid).toBe(false);
    expect(validateForcedTradeoffAnswer('too short', ['Option B'])).toMatchObject({
      valid: false,
      reason: 'too-short',
    });
  });

  it('rejects a generic non-answer even if long enough to pass the plain W2 length check', () => {
    const result = validateForcedTradeoffAnswer("We'll just do everything anyway.", [
      'Option B',
      'Option C',
    ]);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('generic-non-answer');

    const resultPl = validateForcedTradeoffAnswer('Zrobimy po prostu wszystko naraz.', ['Opcja B']);
    expect(resultPl.valid).toBe(false);
  });

  it('rejects an answer with real content that names no OTHER option on the table', () => {
    const result = validateForcedTradeoffAnswer(
      'We will just deprioritize other things a bit to make room for this.',
      ['Expand into APAC', 'Rebuild the billing platform']
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('no-named-alternative');
  });

  it('accepts an answer that explicitly names a specific other option as the loser', () => {
    const result = validateForcedTradeoffAnswer(
      'This wins the quarter at the cost of Rebuild the billing platform, which we explicitly pause.',
      ['Expand into APAC', 'Rebuild the billing platform']
    );
    expect(result.valid).toBe(true);
  });

  it('accepts a substantial answer when there are no other options on the table yet', () => {
    const result = validateForcedTradeoffAnswer(
      'This is the only option scored so far, so there is nothing else it could cost yet.',
      []
    );
    expect(result.valid).toBe(true);
  });

  it('is case-insensitive when matching the named alternative', () => {
    const result = validateForcedTradeoffAnswer(
      'It costs us EXPAND INTO APAC this quarter, which we will not staff.',
      ['Expand into APAC']
    );
    expect(result.valid).toBe(true);
  });
});
