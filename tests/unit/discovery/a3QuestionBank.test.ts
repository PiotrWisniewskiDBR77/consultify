import { describe, expect, it } from 'vitest';

import {
  A3_DECLARED_UNCONFIRMED_LABEL,
  A3_QUESTION_BANK,
  A3_STEP_IDS,
  buildA3StepLadderPromptBlock,
  evaluateA3ElementEvidence,
  getA3EntryQuestion,
  getA3QuestionById,
  getNextA3Question,
  validateA3QuestionBank,
  type A3StepId,
} from '@/config/a3problemsolving/a3QuestionBank';

describe('a3QuestionBank — structure', () => {
  it('passes its own structural validation (branch targets, levels, PL/EN, no cycles)', () => {
    expect(validateA3QuestionBank()).toEqual([]);
  });

  it('covers all seven canonical A3 steps, each with a level-1 entry', () => {
    expect(A3_STEP_IDS).toEqual([
      'background',
      'current-state',
      'target',
      'root-cause',
      'countermeasures',
      'plan',
      'follow-up',
    ]);
    A3_STEP_IDS.forEach((step) => {
      expect(A3_QUESTION_BANK[step].length).toBeGreaterThanOrEqual(2);
      expect(getA3EntryQuestion(step).level).toBe(1);
    });
  });

  it('ladders start at level 1 and never skip a level', () => {
    A3_STEP_IDS.forEach((step) => {
      const levels = A3_QUESTION_BANK[step].map((q) => q.level).sort((a, b) => a - b);
      expect(levels[0]).toBe(1);
      for (let i = 1; i < levels.length; i += 1) {
        expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
      }
    });
  });

  it('every question carries partner-grade PL and EN text plus consultant signals per option', () => {
    A3_STEP_IDS.forEach((step) => {
      A3_QUESTION_BANK[step].forEach((q) => {
        expect(q.textPl.length).toBeGreaterThan(20);
        expect(q.textEn.length).toBeGreaterThan(20);
        expect(q.intentPl.length).toBeGreaterThan(0);
        expect(q.intentEn.length).toBeGreaterThan(0);
        expect(q.answerOptions.length).toBeGreaterThanOrEqual(2);
        q.answerOptions.forEach((opt) => {
          expect(opt.labelPl.length).toBeGreaterThan(0);
          expect(opt.labelEn.length).toBeGreaterThan(0);
          expect(opt.consultantSignalPl.length).toBeGreaterThan(0);
          expect(opt.consultantSignalEn.length).toBeGreaterThan(0);
        });
      });
    });
  });

  it('the root-cause ladder reaches L4 and classifies the root dimension', () => {
    const rc4 = getA3QuestionById('rc4-dimension');
    expect(rc4?.level).toBe(4);
    const keys = rc4?.answerOptions.map((o) => o.key).sort();
    expect(keys).toEqual(['incentives', 'process', 'skills', 'tools']);
  });
});

describe('a3QuestionBank — branching', () => {
  it('walks the root-cause ladder from surface to a terminal via branch keys', () => {
    const entry = getA3EntryQuestion('root-cause');
    expect(entry.id).toBe('rc1-symptom');

    const l2 = getNextA3Question('rc1-symptom', 'deeper');
    expect(l2?.id).toBe('rc2-chain');

    const l3 = getNextA3Question('rc2-chain', 'evidenced-chain');
    expect(l3?.id).toBe('rc3-share');

    const l4 = getNextA3Question('rc3-share', 'dominant-cause');
    expect(l4?.id).toBe('rc4-dimension');

    // L4 dimension answers terminate the ladder.
    expect(getNextA3Question('rc4-dimension', 'process')).toBeNull();
  });

  it('unknown answer keys fall back to defaultNextId instead of dead-ending', () => {
    const next = getNextA3Question('rc1-symptom', 'some-unmapped-free-text');
    expect(next?.id).toBe('rc2-chain');
  });

  it('returns null for an unknown question id', () => {
    expect(getNextA3Question('ghost', 'any')).toBeNull();
    expect(getA3QuestionById('ghost')).toBeUndefined();
  });

  it('terminal questions end the ladder (null) across steps', () => {
    expect(getNextA3Question('bg2-sponsor', 'named-sponsor')).toBeNull();
    expect(getNextA3Question('cs3-baseline', 'baselined')).toBeNull();
    expect(getNextA3Question('tg2-deadline', 'dated')).toBeNull();
    expect(getNextA3Question('cm3-pilot', 'pilot-first')).toBeNull();
    expect(getNextA3Question('pl2-sequence', 'dependency-ordered')).toBeNull();
    expect(getNextA3Question('fu2-sustain', 'standardized')).toBeNull();
  });

  it('every path from every entry question reaches a terminal within the ladder', () => {
    A3_STEP_IDS.forEach((step) => {
      const entry = getA3EntryQuestion(step);
      const walk = (id: string, depth: number): void => {
        expect(depth).toBeLessThan(12); // guard against cycles
        const node = getA3QuestionById(id);
        expect(node).toBeDefined();
        node!.answerOptions.forEach((opt) => {
          const target = node!.branches[opt.key];
          if (target) walk(target, depth + 1);
        });
      };
      walk(entry.id, 0);
    });
  });
});

describe('a3QuestionBank — evidence gate', () => {
  it('evidence refs confirm the element', () => {
    expect(evaluateA3ElementEvidence({ evidenceRefs: ['data-1'] }).status).toBe('confirmed');
  });

  it('an evidence note confirms the element', () => {
    expect(
      evaluateA3ElementEvidence({ evidenceNote: 'cycle time 42s vs 30s std, station 4' }).status
    ).toBe('confirmed');
  });

  it('no evidence -> explicitly declared with the bilingual "declaration, unconfirmed" label', () => {
    const result = evaluateA3ElementEvidence({});
    expect(result.status).toBe('declared');
    expect(result.label?.pl).toBe(A3_DECLARED_UNCONFIRMED_LABEL.pl);
    expect(result.label?.en).toBe(A3_DECLARED_UNCONFIRMED_LABEL.en);
  });

  it('whitespace-only note and empty refs do not count as evidence', () => {
    expect(evaluateA3ElementEvidence({ evidenceNote: '   ', evidenceRefs: [] }).status).toBe(
      'declared'
    );
  });
});

describe('a3QuestionBank — prompt serialization (single source of truth)', () => {
  it('renders each step ladder with ids, branch keys and localized text', () => {
    (['pl', 'en'] as const).forEach((language) => {
      A3_STEP_IDS.forEach((step: A3StepId) => {
        const block = buildA3StepLadderPromptBlock(step, language);
        A3_QUESTION_BANK[step].forEach((q) => {
          expect(block).toContain(`[${q.id}]`);
          expect(block).toContain(language === 'pl' ? q.textPl : q.textEn);
          q.answerOptions.forEach((opt) => expect(block).toContain(`[${opt.key}]`));
        });
      });
    });
  });

  it('the PL and EN serializations of a step differ', () => {
    const en = buildA3StepLadderPromptBlock('countermeasures', 'en');
    const pl = buildA3StepLadderPromptBlock('countermeasures', 'pl');
    expect(pl).not.toEqual(en);
  });
});
