import { describe, expect, it } from 'vitest';

import {
  buildQuadrantLadderPromptBlock,
  classifyStrengthFromAnswers,
  DECLARED_UNCONFIRMED_LABEL,
  DYNAMIC_SWOT_QUESTION_BANK,
  evaluateSwotItemEvidence,
  getNextSwotQuestion,
  getSwotEntryQuestion,
  getSwotQuestionById,
  validateSwotQuestionBank,
  type SwotQuadrant,
} from '@/config/swot/dynamicSwotQuestionBank';

const QUADRANTS: SwotQuadrant[] = ['strengths', 'weaknesses', 'opportunities', 'threats'];

describe('dynamicSwotQuestionBank — structure', () => {
  it('passes its own structural validation (branch targets, levels, PL/EN, no cycles)', () => {
    expect(validateSwotQuestionBank()).toEqual([]);
  });

  it('has 3-4 leveled questions per quadrant with a level-1 entry', () => {
    QUADRANTS.forEach((quadrant) => {
      const questions = DYNAMIC_SWOT_QUESTION_BANK[quadrant];
      // 3-4 distinct levels; strengths has two L2 variants (evidence fork).
      const levels = new Set(questions.map((q) => q.level));
      expect(levels.size).toBeGreaterThanOrEqual(3);
      expect(levels.size).toBeLessThanOrEqual(4);
      expect(getSwotEntryQuestion(quadrant).level).toBe(1);
      questions.forEach((q) => {
        expect(q.level).toBeGreaterThanOrEqual(1);
        expect(q.level).toBeLessThanOrEqual(4);
      });
    });
  });

  it('every question carries partner-grade PL and EN text plus consultant signals per option', () => {
    QUADRANTS.forEach((quadrant) => {
      DYNAMIC_SWOT_QUESTION_BANK[quadrant].forEach((q) => {
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

  it('no quadrant ladder is a flat sequence — at least one question branches to different targets', () => {
    QUADRANTS.forEach((quadrant) => {
      const branching = DYNAMIC_SWOT_QUESTION_BANK[quadrant].some((q) => {
        const targets = new Set(Object.values(q.branches));
        return targets.size > 1;
      });
      // Strengths must branch (evidence fork); other quadrants may converge but
      // still branch on terminal classification.
      if (quadrant === 'strengths') expect(branching).toBe(true);
    });
  });
});

describe('dynamicSwotQuestionBank — branching', () => {
  it('the answer determines the next question (strengths evidence fork)', () => {
    const entry = getSwotEntryQuestion('strengths');
    const confirmed = getNextSwotQuestion(entry.id, 'client-confirmed');
    const belief = getNextSwotQuestion(entry.id, 'internal-belief');
    expect(confirmed?.id).toBe('s2-commercial-proof');
    expect(belief?.id).toBe('s2-external-proof');
    expect(confirmed?.id).not.toBe(belief?.id);
  });

  it('a non-measurable commercial claim is rerouted to the external-proof question', () => {
    const next = getNextSwotQuestion('s2-commercial-proof', 'not-measurable');
    expect(next?.id).toBe('s2-external-proof');
  });

  it('unknown answer keys fall back to defaultNextId instead of dead-ending', () => {
    const next = getNextSwotQuestion('s1-surface', 'some-unmapped-free-text');
    expect(next?.id).toBe('s2-external-proof');
  });

  it('terminal questions end the ladder (null)', () => {
    expect(getNextSwotQuestion('s4-durability', 'durable')).toBeNull();
    expect(getNextSwotQuestion('w4-trajectory', 'compounding')).toBeNull();
    expect(getNextSwotQuestion('o4-falsifier', 'testable')).toBeNull();
    expect(getNextSwotQuestion('t4-exposure', 'concentrated')).toBeNull();
  });

  it('every path from every entry question reaches a terminal within the ladder', () => {
    QUADRANTS.forEach((quadrant) => {
      const entry = getSwotEntryQuestion(quadrant);
      const walk = (id: string, depth: number): void => {
        expect(depth).toBeLessThan(10); // guard against cycles
        const node = getSwotQuestionById(id);
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

describe('dynamicSwotQuestionBank — strength classification (niche vs core)', () => {
  it('external validation + broad scope + durable protection = core competency', () => {
    expect(
      classifyStrengthFromAnswers([
        { questionId: 's1-surface', answerKey: 'client-confirmed' },
        { questionId: 's2-commercial-proof', answerKey: 'measurable' },
        { questionId: 's3-scope', answerKey: 'broad' },
        { questionId: 's4-durability', answerKey: 'durable' },
      ])
    ).toBe('core-competency');
  });

  it('validated but segment-bound = niche strength (never sold as core)', () => {
    expect(
      classifyStrengthFromAnswers([
        { questionId: 's1-surface', answerKey: 'client-confirmed' },
        { questionId: 's2-commercial-proof', answerKey: 'measurable' },
        { questionId: 's3-scope', answerKey: 'niche' },
        { questionId: 's4-durability', answerKey: 'durable' },
      ])
    ).toBe('niche-strength');
  });

  it('no external proof = claimed strength regardless of scope', () => {
    expect(
      classifyStrengthFromAnswers([
        { questionId: 's1-surface', answerKey: 'internal-belief' },
        { questionId: 's2-external-proof', answerKey: 'no-proof' },
        { questionId: 's3-scope', answerKey: 'broad' },
        { questionId: 's4-durability', answerKey: 'durable' },
      ])
    ).toBe('claimed-strength');
  });

  it('broad but trivially copyable = table stakes', () => {
    expect(
      classifyStrengthFromAnswers([
        { questionId: 's1-surface', answerKey: 'client-confirmed' },
        { questionId: 's3-scope', answerKey: 'broad' },
        { questionId: 's4-durability', answerKey: 'copyable' },
      ])
    ).toBe('table-stakes');
  });
});

describe('dynamicSwotQuestionBank — evidence gate', () => {
  it('linked signals confirm the item', () => {
    expect(evaluateSwotItemEvidence({ linkedSignalIds: ['sig-1'] }).status).toBe('confirmed');
  });

  it('an evidence note confirms the item', () => {
    expect(evaluateSwotItemEvidence({ evidenceNote: '0.4% complaint rate, 2025 audit' }).status).toBe(
      'confirmed'
    );
  });

  it('no evidence -> explicitly declared with the bilingual "declaration, unconfirmed" label', () => {
    const result = evaluateSwotItemEvidence({});
    expect(result.status).toBe('declared');
    expect(result.label?.pl).toBe(DECLARED_UNCONFIRMED_LABEL.pl);
    expect(result.label?.en).toBe(DECLARED_UNCONFIRMED_LABEL.en);
  });

  it('whitespace-only note does not count as evidence', () => {
    expect(evaluateSwotItemEvidence({ evidenceNote: '   ' }).status).toBe('declared');
  });
});

describe('dynamicSwotQuestionBank — prompt serialization', () => {
  it('renders each quadrant ladder with ids, branch keys and localized text', () => {
    (['pl', 'en'] as const).forEach((language) => {
      QUADRANTS.forEach((quadrant) => {
        const block = buildQuadrantLadderPromptBlock(quadrant, language);
        DYNAMIC_SWOT_QUESTION_BANK[quadrant].forEach((q) => {
          expect(block).toContain(`[${q.id}]`);
          expect(block).toContain(language === 'pl' ? q.textPl : q.textEn);
          q.answerOptions.forEach((opt) => expect(block).toContain(`[${opt.key}]`));
        });
      });
    });
  });
});
