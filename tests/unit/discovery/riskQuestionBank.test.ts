import { describe, expect, it } from 'vitest';

import {
  buildRiskLadderPromptBlock,
  buildRiskQuestionBankPromptRules,
  getNextRiskQuestionId,
  isForcedLoopRiskQuestion,
  RISK_ITEM_LADDER,
  RISK_LADDER_ENTRY_ID,
  RISK_QUESTION_INDEX,
  validateForcedQuantificationAnswer,
  validateForcedResponseStrategyAnswer,
  validateRiskQuestionBankStructure,
} from '../../../src/config/riskuncertainty/riskQuestionBank';

describe('Risk & Uncertainty question bank — structure', () => {
  it('defines a 4-level ladder in canonical order starting at the entry question', () => {
    expect(RISK_ITEM_LADDER.map((q) => q.level)).toEqual([1, 2, 2, 3, 4]);
    expect(RISK_ITEM_LADDER[0].id).toBe(RISK_LADDER_ENTRY_ID);
    expect(RISK_QUESTION_INDEX.has(RISK_LADDER_ENTRY_ID)).toBe(true);
  });

  it('every question has bilingual text, intent, and at least one answer option', () => {
    RISK_ITEM_LADDER.forEach((q) => {
      expect(q.textPl.trim().length).toBeGreaterThan(0);
      expect(q.textEn.trim().length).toBeGreaterThan(0);
      expect(q.intentPl.trim().length).toBeGreaterThan(0);
      expect(q.intentEn.trim().length).toBeGreaterThan(0);
      expect(q.answerOptions.length).toBeGreaterThan(0);
      q.answerOptions.forEach((opt) => {
        expect(opt.labelPl).not.toEqual(opt.labelEn);
        expect(opt.consultantSignalPl).not.toEqual(opt.consultantSignalEn);
      });
    });
  });

  it('the ladder is well-formed: no dangling branches, no missing text, no stray cycles', () => {
    const problems = validateRiskQuestionBankStructure();
    expect(problems).toEqual([]);
  });

  it('the L2 quantification force node is a forced loop (self-branch on the unquantified answer)', () => {
    expect(isForcedLoopRiskQuestion('risk-l2-quantify-force')).toBe(true);
    const node = RISK_QUESTION_INDEX.get('risk-l2-quantify-force')!;
    expect(node.level).toBe(2);
    expect(node.branches['still-only-label']).toBe('risk-l2-quantify-force');
    expect(node.branches['now-quantified']).toBe('risk-l3-response');
  });

  it('the L2 entry node routes an unquantified answer INTO the forced loop, never past it', () => {
    const node = RISK_QUESTION_INDEX.get('risk-l2-quantify')!;
    expect(node.branches['label-only']).toBe('risk-l2-quantify-force');
    expect(node.branches['numeric-with-source']).toBe('risk-l3-response');
  });

  it('the L3 response-strategy node is ALSO a forced loop on a generic non-strategy answer', () => {
    expect(isForcedLoopRiskQuestion('risk-l3-response')).toBe(true);
    const node = RISK_QUESTION_INDEX.get('risk-l3-response')!;
    expect(node.branches['generic-non-strategy']).toBe('risk-l3-response');
    expect(node.branches['strategy-named-with-rationale']).toBe('risk-l4-raid');
  });

  it('the L1 identification and L4 raid nodes are NOT forced loops', () => {
    expect(isForcedLoopRiskQuestion('risk-l1-identify')).toBe(false);
    expect(isForcedLoopRiskQuestion('risk-l4-raid')).toBe(false);
  });

  it('the level-4 owner+trigger+RAID question terminates the ladder on every branch', () => {
    const node = RISK_QUESTION_INDEX.get('risk-l4-raid')!;
    expect(node.level).toBe(4);
    expect(node.defaultNextId).toBeNull();
    Object.values(node.branches).forEach((target) => expect(target).toBeNull());
  });

  it('returns false for isForcedLoopRiskQuestion on an unknown id', () => {
    expect(isForcedLoopRiskQuestion('not-a-real-question')).toBe(false);
  });
});

describe('Risk & Uncertainty question bank — branching', () => {
  it('getNextRiskQuestionId follows the branch for a known answer key', () => {
    expect(getNextRiskQuestionId('risk-l1-identify', 'named-event-with-signal')).toBe(
      'risk-l2-quantify'
    );
    expect(getNextRiskQuestionId('risk-l2-quantify', 'numeric-with-source')).toBe(
      'risk-l3-response'
    );
    expect(getNextRiskQuestionId('risk-l3-response', 'strategy-named-with-rationale')).toBe(
      'risk-l4-raid'
    );
    expect(getNextRiskQuestionId('risk-l4-raid', 'owner-trigger-raid-ready')).toBeNull();
  });

  it('getNextRiskQuestionId falls back to defaultNextId for an unknown answer key', () => {
    expect(getNextRiskQuestionId('risk-l1-identify', 'never-heard-of-this-key')).toBe(
      'risk-l2-quantify'
    );
  });

  it('getNextRiskQuestionId returns null for an unknown question id', () => {
    expect(getNextRiskQuestionId('not-a-real-question', 'anything')).toBeNull();
  });

  it('walking the ladder end-to-end from the entry question via the FORWARD branch reaches null in <= 6 hops', () => {
    let currentId: string | null = RISK_LADDER_ENTRY_ID;
    let hops = 0;
    while (currentId && hops < 10) {
      const node = RISK_QUESTION_INDEX.get(currentId)!;
      const firstKey = node.answerOptions[0].key; // forward-branch option is always listed first
      currentId = getNextRiskQuestionId(currentId, firstKey);
      hops += 1;
    }
    expect(currentId).toBeNull();
    expect(hops).toBeLessThanOrEqual(6);
  });

  it('an unquantified L2 answer holds the ladder in the force loop until a real answer lands', () => {
    // Simulate the client stalling on "label-only" three times before quantifying.
    let currentId: string | null = 'risk-l2-quantify';
    currentId = getNextRiskQuestionId(currentId, 'label-only');
    expect(currentId).toBe('risk-l2-quantify-force');
    currentId = getNextRiskQuestionId(currentId, 'still-only-label');
    expect(currentId).toBe('risk-l2-quantify-force'); // still held
    currentId = getNextRiskQuestionId(currentId, 'still-only-label');
    expect(currentId).toBe('risk-l2-quantify-force'); // still held
    currentId = getNextRiskQuestionId(currentId, 'now-quantified');
    expect(currentId).toBe('risk-l3-response'); // released once quantified
  });
});

describe('Risk & Uncertainty question bank — prompt block + rules', () => {
  it('buildRiskLadderPromptBlock serializes every question with its branch keys, bilingual', () => {
    const en = buildRiskLadderPromptBlock('en');
    const pl = buildRiskLadderPromptBlock('pl');
    RISK_ITEM_LADDER.forEach((q) => {
      expect(en).toContain(`[${q.id}]`);
      expect(pl).toContain(`[${q.id}]`);
    });
    expect(en).not.toEqual(pl);
    expect(en).toContain('risk-l2-quantify-force');
  });

  it('buildRiskQuestionBankPromptRules documents the 4 levels and the FORCED loop, bilingual', () => {
    const en = buildRiskQuestionBankPromptRules('en');
    const pl = buildRiskQuestionBankPromptRules('pl');
    expect(en).toMatch(/FORCED quantification/i);
    expect(en).toContain('validateForcedQuantificationAnswer');
    expect(pl).toMatch(/WYMUSZONA kwantyfikacja/i);
    expect(en).not.toEqual(pl);
  });
});

describe('Risk & Uncertainty question bank — forced quantification validator (L2 gate)', () => {
  it('rejects an empty or too-short answer', () => {
    expect(validateForcedQuantificationAnswer(undefined).valid).toBe(false);
    expect(validateForcedQuantificationAnswer('').valid).toBe(false);
    expect(validateForcedQuantificationAnswer('high')).toMatchObject({
      valid: false,
      reason: 'too-short',
    });
  });

  it('rejects a bare qualitative label with no number, in English or Polish', () => {
    const en = validateForcedQuantificationAnswer('It is a high risk with severe impact.');
    expect(en.valid).toBe(false);
    expect(en.reason).toBe('qualitative-label-only');

    const pl = validateForcedQuantificationAnswer(
      'To jest wysokie ryzyko o poważnym wpływie na firmę.'
    );
    expect(pl.valid).toBe(false);
    expect(pl.reason).toBe('qualitative-label-only');
  });

  it('rejects a long non-numeric answer that is not even a recognized qualitative label', () => {
    const result = validateForcedQuantificationAnswer(
      'We are honestly not sure how bad this could get for the business.'
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('no-numeric-value');
  });

  it('accepts a 1-5 scale answer with a source', () => {
    const result = validateForcedQuantificationAnswer(
      'Probability 4/5, impact 5/5, based on last year\'s two near-misses.'
    );
    expect(result.valid).toBe(true);
  });

  it('accepts a percentage/cost-range answer even without a 1-5 scale', () => {
    const result = validateForcedQuantificationAnswer(
      'About 30% likely, and it would cost roughly 200k EUR if it hits.'
    );
    expect(result.valid).toBe(true);
  });

  it('accepts a Polish numeric answer with a source', () => {
    const result = validateForcedQuantificationAnswer(
      'Prawdopodobieństwo 4/5, wpływ 5/5, na podstawie dwóch incydentów w zeszłym roku.'
    );
    expect(result.valid).toBe(true);
  });
});

describe('Risk & Uncertainty question bank — forced response-strategy validator (L3 gate)', () => {
  it('rejects an empty or too-short answer', () => {
    expect(validateForcedResponseStrategyAnswer(undefined).valid).toBe(false);
    expect(validateForcedResponseStrategyAnswer('mitigate').valid).toBe(false);
  });

  it('rejects a generic non-strategy answer with no named response', () => {
    const result = validateForcedResponseStrategyAnswer(
      "We'll manage it as it comes and keep watching the situation closely."
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('generic-non-strategy');

    const resultPl = validateForcedResponseStrategyAnswer(
      'Będziemy obserwować sytuację i jakoś sobie poradzimy, gdyby coś się zmieniło.'
    );
    expect(resultPl.valid).toBe(false);
    expect(resultPl.reason).toBe('generic-non-strategy');
  });

  it('accepts an answer naming one of the four canonical strategies, in English', () => {
    expect(
      validateForcedResponseStrategyAnswer(
        'We mitigate this by adding a redundant supplier within 60 days.'
      ).valid
    ).toBe(true);
    expect(
      validateForcedResponseStrategyAnswer(
        'We transfer this exposure via a contractual penalty clause with the vendor.'
      ).valid
    ).toBe(true);
    expect(
      validateForcedResponseStrategyAnswer(
        'We consciously accept this risk given its low exposure and monitor it quarterly.'
      ).valid
    ).toBe(true);
    expect(
      validateForcedResponseStrategyAnswer(
        'We avoid this altogether by dropping the affected product line.'
      ).valid
    ).toBe(true);
  });

  it('accepts an answer naming a canonical strategy in Polish', () => {
    const result = validateForcedResponseStrategyAnswer(
      'Łagodzimy to ryzyko, dodając zapasowego dostawcę w ciągu 60 dni.'
    );
    expect(result.valid).toBe(true);
  });
});
