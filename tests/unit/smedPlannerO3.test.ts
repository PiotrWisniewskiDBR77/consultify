import { describe, expect, it } from 'vitest';

import {
  buildSmedConclusionPrompt,
  buildSmedQuestionBankPromptRules,
  buildSmedStaircasePromptRules,
  type ChangeoverStep,
  detectSmedGaps,
  getNextSmedQuestionId,
  getSmedQuestion,
  getSmedQuestionsByLevel,
  type ImprovementItem,
  isForcedLoopSmedQuestion,
  SMED_QUESTION_BANK,
  SMED_QUESTION_ROOT_ID,
  type SmedSession,
  textMakesQuantifiedClaim,
  validateSmedInsightStaircase,
} from '../../src/config/smedplanner';

const step = (id: string, overrides: Partial<ChangeoverStep> = {}): ChangeoverStep => ({
  id,
  kind: 'internal',
  durationMinutes: 10,
  measured: true,
  ...overrides,
});

const imp = (id: string, overrides: Partial<ImprovementItem> = {}): ImprovementItem => ({
  id,
  phase: 'convert',
  impact: 'medium',
  effort: 'medium',
  evidence: [],
  ...overrides,
});

const session = (overrides: Partial<SmedSession> = {}): SmedSession => ({
  steps: [],
  improvements: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Question bank: structure, branching, forced loop
// ---------------------------------------------------------------------------

describe('SMED Planner O3 — laddered question bank', () => {
  it('covers all 4 levels with the canonical root id', () => {
    expect(getSmedQuestion(SMED_QUESTION_ROOT_ID)).toBeTruthy();
    expect(getSmedQuestion(SMED_QUESTION_ROOT_ID)!.level).toBe(1);
    const levels = new Set(SMED_QUESTION_BANK.map((q) => q.level));
    expect(levels).toEqual(new Set([1, 2, 3, 4]));
    expect(getSmedQuestionsByLevel(2).length).toBeGreaterThanOrEqual(2);
    expect(getSmedQuestionsByLevel(4).length).toBeGreaterThanOrEqual(1);
  });

  it('every node is bilingual, non-empty, and has at least 2 answer options', () => {
    SMED_QUESTION_BANK.forEach((q) => {
      expect(q.textPl.trim().length).toBeGreaterThan(0);
      expect(q.textEn.trim().length).toBeGreaterThan(0);
      expect(q.intentPl.trim().length).toBeGreaterThan(0);
      expect(q.intentEn.trim().length).toBeGreaterThan(0);
      expect(q.answerOptions.length).toBeGreaterThanOrEqual(2);
      q.answerOptions.forEach((opt) => {
        expect(opt.labelPl.trim().length).toBeGreaterThan(0);
        expect(opt.labelEn.trim().length).toBeGreaterThan(0);
        expect(opt.consultantSignalPl.trim().length).toBeGreaterThan(0);
        expect(opt.consultantSignalEn.trim().length).toBeGreaterThan(0);
      });
    });
  });

  it('every branch target resolves to a real question id or null (no dangling links)', () => {
    const ids = new Set(SMED_QUESTION_BANK.map((q) => q.id));
    SMED_QUESTION_BANK.forEach((q) => {
      Object.values(q.branches).forEach((target) => {
        if (target !== null) expect(ids.has(target)).toBe(true);
      });
      if (q.defaultNextId !== null) expect(ids.has(q.defaultNextId)).toBe(true);
      q.answerOptions.forEach((opt) => {
        expect(Object.prototype.hasOwnProperty.call(q.branches, opt.key)).toBe(true);
      });
    });
  });

  it('branches the surface question by whether the step was classified', () => {
    expect(getNextSmedQuestionId('smed-surface', 'classified-with-reason')).toBe('smed-evidence-check');
    expect(getNextSmedQuestionId('smed-surface', 'unclassified-or-assumed')).toBe('smed-classify-force');
  });

  it('unknown answer key falls back to defaultNextId', () => {
    expect(getNextSmedQuestionId('smed-surface', 'nonsense-key')).toBe(
      getSmedQuestion('smed-surface')!.defaultNextId
    );
  });

  it('unknown question id returns undefined', () => {
    expect(getNextSmedQuestionId('does-not-exist', 'x')).toBeUndefined();
  });

  it('the forced-classification question loops back on itself until the step is actually classified', () => {
    expect(isForcedLoopSmedQuestion('smed-classify-force')).toBe(true);
    expect(getNextSmedQuestionId('smed-classify-force', 'still-unclassified')).toBe('smed-classify-force');
    expect(getNextSmedQuestionId('smed-classify-force', 'classified')).toBe('smed-evidence-check');
    expect(isForcedLoopSmedQuestion('smed-quant-entry')).toBe(false);
    expect(isForcedLoopSmedQuestion('smed-surface')).toBe(false);
  });

  it('the risk/ownership level ends the ladder (null)', () => {
    expect(getNextSmedQuestionId('smed-risk-owner', 'owner-and-loop-named')).toBeNull();
    expect(getNextSmedQuestionId('smed-risk-owner', 'no-owner-yet')).toBeNull();
  });

  it('exposes non-empty, distinct bilingual prompt rules for the ladder contract', () => {
    const pl = buildSmedQuestionBankPromptRules('pl');
    const en = buildSmedQuestionBankPromptRules('en');
    expect(pl).toContain('smed-classify-force');
    expect(en).toContain('smed-classify-force');
    expect(pl).not.toEqual(en);
  });
});

// ---------------------------------------------------------------------------
// Insight staircase + invented-number guard
// ---------------------------------------------------------------------------

describe('SMED Planner O3 — per-improvement insight staircase', () => {
  it('flags missing fact / interpretation / implication', () => {
    const issues = validateSmedInsightStaircase({ id: 'i1', title: 'Stage tooling in advance' });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('missing-fact');
    expect(codes).toContain('missing-interpretation');
    expect(codes).toContain('missing-implication');
  });

  it('flags an interpretation that just restates the fact', () => {
    const issues = validateSmedInsightStaircase({
      id: 'i1',
      title: 'Stage tooling',
      staircase: {
        fact: 'Tooling is fetched during the stop',
        factRefs: ['obs-1'],
        interpretation: 'Tooling is fetched during the stop',
        implication: 'Move it to a pre-stop cart',
      },
    });
    expect(issues.map((i) => i.code)).toContain('interpretation-is-restatement');
  });

  it('passes a fully-formed staircase with sourced evidence', () => {
    const issues = validateSmedInsightStaircase({
      id: 'i1',
      title: 'Stage tooling',
      staircase: {
        fact: 'Tooling is fetched during the stop',
        factRefs: ['obs-1'],
        interpretation: 'The fetch has no physical dependency on the machine being down',
        implication: 'It should convert to external with a staging cart',
      },
    });
    expect(issues).toHaveLength(0);
  });

  it('invented-number guard: a quantified claim with no evidence and no declared status is flagged', () => {
    const issues = validateSmedInsightStaircase({
      id: 'i1',
      title: 'Cut changeover by 30%',
      evidence: [],
      staircase: {
        fact: 'fact',
        factRefs: ['x'],
        interpretation: 'meaningful interpretation text here',
        implication: 'meaningful implication text here',
      },
    });
    expect(issues.map((i) => i.code)).toContain('invented-number');
  });

  it('invented-number guard: passes when the quantified claim has evidence', () => {
    const issues = validateSmedInsightStaircase({
      id: 'i1',
      title: 'Cut changeover by 30%',
      evidence: ['pilot-run-3'],
      staircase: {
        fact: 'fact',
        factRefs: ['x'],
        interpretation: 'meaningful interpretation text here',
        implication: 'meaningful implication text here',
      },
    });
    expect(issues.map((i) => i.code)).not.toContain('invented-number');
  });

  it('invented-number guard: passes when explicitly marked declared/unconfirmed', () => {
    const issues = validateSmedInsightStaircase({
      id: 'i1',
      title: 'Cut changeover by 30%',
      evidence: [],
      evidenceStatus: 'declared',
      staircase: {
        fact: 'fact',
        factRefs: ['x'],
        interpretation: 'meaningful interpretation text here',
        implication: 'meaningful implication text here',
      },
    });
    expect(issues.map((i) => i.code)).not.toContain('invented-number');
  });

  it('invented-number guard: text with no quantified claim never triggers the guard', () => {
    const issues = validateSmedInsightStaircase({
      id: 'i1',
      title: 'Simplify the clamp mechanism',
      evidence: [],
      staircase: {
        fact: 'fact',
        factRefs: ['x'],
        interpretation: 'meaningful interpretation text here',
        implication: 'meaningful implication text here',
      },
    });
    expect(issues.map((i) => i.code)).not.toContain('invented-number');
  });

  it('textMakesQuantifiedClaim recognizes percentages, minutes and multipliers', () => {
    expect(textMakesQuantifiedClaim('cut changeover by 30%')).toBe(true);
    expect(textMakesQuantifiedClaim('saves 12 min per cycle')).toBe(true);
    expect(textMakesQuantifiedClaim('halve the time 2x')).toBe(true);
    expect(textMakesQuantifiedClaim('make it much faster')).toBe(false);
  });

  it('exposes non-empty, distinct bilingual staircase prompt rules', () => {
    const pl = buildSmedStaircasePromptRules('pl');
    const en = buildSmedStaircasePromptRules('en');
    expect(pl.toLowerCase()).toContain('staircase.fact');
    expect(en.toLowerCase()).toContain('staircase.fact');
    expect(pl).not.toEqual(en);
  });
});

// ---------------------------------------------------------------------------
// Structural gap detection
// ---------------------------------------------------------------------------

describe('SMED Planner O3 — structural gap detection', () => {
  it('flags a convertible/shortenable step that is unmeasured', () => {
    const gaps = detectSmedGaps(
      session({
        steps: [step('s1', { potential: 'convertible', measured: false })],
      })
    );
    expect(gaps.some((g) => g.code === 'unmeasured-target-step' && g.stepId === 's1')).toBe(true);
  });

  it('does not flag a measured convertible step', () => {
    const gaps = detectSmedGaps(
      session({ steps: [step('s1', { potential: 'convertible', measured: true })] })
    );
    expect(gaps.some((g) => g.code === 'unmeasured-target-step')).toBe(false);
  });

  it('flags standardize proposed before any convert/streamline improvement exists', () => {
    const gaps = detectSmedGaps(
      session({ improvements: [imp('i1', { phase: 'standardize' })] })
    );
    expect(gaps.some((g) => g.code === 'standardize-before-gain')).toBe(true);
  });

  it('does not flag standardize once a convert improvement exists', () => {
    const gaps = detectSmedGaps(
      session({
        improvements: [imp('i1', { phase: 'standardize' }), imp('i2', { phase: 'convert' })],
      })
    );
    expect(gaps.some((g) => g.code === 'standardize-before-gain')).toBe(false);
  });

  it('flags a convertible step with no logged convert improvement', () => {
    const gaps = detectSmedGaps(
      session({ steps: [step('s1', { potential: 'convertible' })], improvements: [] })
    );
    expect(gaps.some((g) => g.code === 'convert-identified-not-logged')).toBe(true);
  });

  it('does not flag once a convert improvement is logged', () => {
    const gaps = detectSmedGaps(
      session({
        steps: [step('s1', { potential: 'convertible' })],
        improvements: [imp('i1', { phase: 'convert' })],
      })
    );
    expect(gaps.some((g) => g.code === 'convert-identified-not-logged')).toBe(false);
  });

  it('a clean, fully-measured, fully-logged session has zero gaps', () => {
    const gaps = detectSmedGaps(
      session({
        steps: [step('s1', { potential: 'convertible', measured: true })],
        improvements: [imp('i1', { phase: 'convert' })],
      })
    );
    expect(gaps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Conclusion prompt integration: gaps + q-bank + staircase rules surfaced
// ---------------------------------------------------------------------------

describe('SMED Planner O3 — conclusion prompt surfaces gaps and guards', () => {
  it('includes the gap section and a named gap when a step is unmeasured', () => {
    const data = session({
      steps: [step('s1', { potential: 'convertible', durationMinutes: 20, measured: false })],
      improvements: [imp('i1', { phase: 'convert', impact: 'high', effort: 'low', evidence: ['x'] })],
    });
    const prompt = buildSmedConclusionPrompt(data, false)!;
    expect(prompt).toContain('STRUCTURAL GAPS');
    expect(prompt).toContain('unmeasured-target-step');
    expect(prompt).toContain('smed-classify-force');
    expect(prompt).toContain('staircase.fact');
  });

  it('reports no gaps when the session is fully measured and logged', () => {
    const data = session({
      steps: [step('s1', { potential: 'convertible', durationMinutes: 20, measured: true })],
      improvements: [imp('i1', { phase: 'convert', impact: 'high', effort: 'low', evidence: ['x'] })],
    });
    const prompt = buildSmedConclusionPrompt(data, false)!;
    expect(prompt).toContain('no structural gaps detected');
  });
});
