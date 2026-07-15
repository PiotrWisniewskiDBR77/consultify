import { describe, expect, it } from 'vitest';

import {
  type AutomationIdea,
  buildRpaConclusionPrompt,
  buildRpaQuestionBankPromptRules,
  buildRpaStaircasePromptRules,
  detectRpaGaps,
  getNextRpaQuestionId,
  getRpaQuestion,
  getRpaQuestionsByLevel,
  isForcedLoopRpaQuestion,
  type ProcessCandidate,
  RPA_QUESTION_BANK,
  RPA_QUESTION_ROOT_ID,
  type RpaSession,
  textMakesQuantifiedClaim,
  validateRpaInsightStaircase,
} from '../../src/config/rpascanner';

const candidate = (id: string, overrides: Partial<ProcessCandidate> = {}): ProcessCandidate => ({
  id,
  gate: 'identify',
  standardization: 'high',
  volumePerMonth: 500,
  handlingMinutes: 10,
  exceptionRate: 0.05,
  measured: true,
  evidence: [],
  ...overrides,
});

const idea = (id: string, overrides: Partial<AutomationIdea> = {}): AutomationIdea => ({
  id,
  gate: 'quantify',
  impact: 'medium',
  effort: 'medium',
  evidence: [],
  ...overrides,
});

const session = (overrides: Partial<RpaSession> = {}): RpaSession => ({
  candidates: [],
  ideas: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Question bank: structure, branching, forced loop
// ---------------------------------------------------------------------------

describe('RPA Scanner O3 — laddered question bank', () => {
  it('covers all 4 levels with the canonical root id', () => {
    expect(getRpaQuestion(RPA_QUESTION_ROOT_ID)).toBeTruthy();
    expect(getRpaQuestion(RPA_QUESTION_ROOT_ID)!.level).toBe(1);
    const levels = new Set(RPA_QUESTION_BANK.map((q) => q.level));
    expect(levels).toEqual(new Set([1, 2, 3, 4]));
    expect(getRpaQuestionsByLevel(2).length).toBeGreaterThanOrEqual(3);
  });

  it('every node is bilingual, non-empty, and has at least 2 answer options', () => {
    RPA_QUESTION_BANK.forEach((q) => {
      expect(q.textPl.trim().length).toBeGreaterThan(0);
      expect(q.textEn.trim().length).toBeGreaterThan(0);
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
    const ids = new Set(RPA_QUESTION_BANK.map((q) => q.id));
    RPA_QUESTION_BANK.forEach((q) => {
      Object.values(q.branches).forEach((target) => {
        if (target !== null) expect(ids.has(target)).toBe(true);
      });
      if (q.defaultNextId !== null) expect(ids.has(q.defaultNextId)).toBe(true);
      q.answerOptions.forEach((opt) => {
        expect(Object.prototype.hasOwnProperty.call(q.branches, opt.key)).toBe(true);
      });
    });
  });

  it('branches the surface question by whether the volume is known', () => {
    expect(getNextRpaQuestionId('rpa-surface', 'volume-known')).toBe('rpa-standardize-check');
    expect(getNextRpaQuestionId('rpa-surface', 'volume-unknown')).toBe('rpa-volume-force');
  });

  it('the forced-volume question loops back on itself until the volume is counted', () => {
    expect(isForcedLoopRpaQuestion('rpa-volume-force')).toBe(true);
    expect(getNextRpaQuestionId('rpa-volume-force', 'still-unknown')).toBe('rpa-volume-force');
    expect(getNextRpaQuestionId('rpa-volume-force', 'volume-now-known')).toBe('rpa-standardize-check');
    expect(isForcedLoopRpaQuestion('rpa-quant-entry')).toBe(false);
  });

  it('the feasibility level ends the ladder (null)', () => {
    expect(getNextRpaQuestionId('rpa-feasibility', 'poc-proven')).toBeNull();
    expect(getNextRpaQuestionId('rpa-feasibility', 'assumed')).toBeNull();
  });

  it('unknown question id returns undefined and unknown answer key falls back to defaultNextId', () => {
    expect(getNextRpaQuestionId('does-not-exist', 'x')).toBeUndefined();
    expect(getNextRpaQuestionId('rpa-surface', 'nonsense')).toBe(
      getRpaQuestion('rpa-surface')!.defaultNextId
    );
  });

  it('exposes non-empty, distinct bilingual prompt rules for the ladder contract', () => {
    const pl = buildRpaQuestionBankPromptRules('pl');
    const en = buildRpaQuestionBankPromptRules('en');
    expect(pl).toContain('rpa-volume-force');
    expect(en).toContain('rpa-volume-force');
    expect(pl).not.toEqual(en);
  });
});

// ---------------------------------------------------------------------------
// Insight staircase + invented-number guard
// ---------------------------------------------------------------------------

describe('RPA Scanner O3 — per-idea insight staircase', () => {
  it('flags missing fact / interpretation / implication', () => {
    const issues = validateRpaInsightStaircase({ id: 'i1', title: 'Automate invoice matching' });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('missing-fact');
    expect(codes).toContain('missing-interpretation');
    expect(codes).toContain('missing-implication');
  });

  it('flags an interpretation that just restates the fact', () => {
    const issues = validateRpaInsightStaircase({
      id: 'i1',
      staircase: {
        fact: '500 invoices matched per month',
        factRefs: ['log-1'],
        interpretation: '500 invoices matched per month',
        implication: 'Automate the match step',
      },
    });
    expect(issues.map((i) => i.code)).toContain('interpretation-is-restatement');
  });

  it('passes a fully-formed staircase with sourced evidence', () => {
    const issues = validateRpaInsightStaircase({
      id: 'i1',
      staircase: {
        fact: '500 invoices matched per month',
        factRefs: ['log-1'],
        interpretation: 'The match is deterministic and rarely escalates',
        implication: 'It qualifies for plain RPA at high confidence',
      },
    });
    expect(issues).toHaveLength(0);
  });

  it('invented-number guard: a quantified claim with no evidence and no declared status is flagged', () => {
    const issues = validateRpaInsightStaircase({
      id: 'i1',
      title: 'Saves 40% of handling time',
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

  it('invented-number guard: passes with evidence or a declared status', () => {
    const withEvidence = validateRpaInsightStaircase({
      id: 'i1',
      title: 'Saves 40% of handling time',
      evidence: ['poc-1'],
      staircase: {
        fact: 'fact',
        factRefs: ['x'],
        interpretation: 'meaningful interpretation text here',
        implication: 'meaningful implication text here',
      },
    });
    expect(withEvidence.map((i) => i.code)).not.toContain('invented-number');

    const declared = validateRpaInsightStaircase({
      id: 'i1',
      title: 'Saves 40% of handling time',
      evidence: [],
      evidenceStatus: 'declared',
      staircase: {
        fact: 'fact',
        factRefs: ['x'],
        interpretation: 'meaningful interpretation text here',
        implication: 'meaningful implication text here',
      },
    });
    expect(declared.map((i) => i.code)).not.toContain('invented-number');
  });

  it('textMakesQuantifiedClaim recognizes percentages, currency and multipliers', () => {
    expect(textMakesQuantifiedClaim('saves 40% of handling time')).toBe(true);
    expect(textMakesQuantifiedClaim('worth $50k a year')).toBe(true);
    expect(textMakesQuantifiedClaim('doubles throughput 2x')).toBe(true);
    expect(textMakesQuantifiedClaim('makes the process much smoother')).toBe(false);
  });

  it('exposes non-empty, distinct bilingual staircase prompt rules', () => {
    const pl = buildRpaStaircasePromptRules('pl');
    const en = buildRpaStaircasePromptRules('en');
    expect(pl.toLowerCase()).toContain('staircase.fact');
    expect(en.toLowerCase()).toContain('staircase.fact');
    expect(pl).not.toEqual(en);
  });
});

// ---------------------------------------------------------------------------
// Structural gap detection
// ---------------------------------------------------------------------------

describe('RPA Scanner O3 — structural gap detection', () => {
  it('flags a tech-tier candidate missing volume or handling time', () => {
    const gaps = detectRpaGaps(
      session({ candidates: [candidate('c1', { techTier: 'rpa', volumePerMonth: undefined })] })
    );
    expect(gaps.some((g) => g.code === 'unquantified-candidate' && g.candidateId === 'c1')).toBe(true);
  });

  it('does not flag a fully quantified candidate', () => {
    const gaps = detectRpaGaps(session({ candidates: [candidate('c1', { techTier: 'rpa' })] }));
    expect(gaps.some((g) => g.code === 'unquantified-candidate')).toBe(false);
  });

  it('flags a high-exception candidate assigned plain rpa', () => {
    const gaps = detectRpaGaps(
      session({ candidates: [candidate('c1', { techTier: 'rpa', exceptionRate: 0.5 })] })
    );
    expect(gaps.some((g) => g.code === 'high-exception-optimistic-tier' && g.candidateId === 'c1')).toBe(
      true
    );
  });

  it('does not flag a high-exception candidate assigned to ai tier', () => {
    const gaps = detectRpaGaps(
      session({ candidates: [candidate('c1', { techTier: 'ai', exceptionRate: 0.5 })] })
    );
    expect(gaps.some((g) => g.code === 'high-exception-optimistic-tier')).toBe(false);
  });

  it('flags an idea whose processId has no matching candidate', () => {
    const gaps = detectRpaGaps(
      session({
        candidates: [candidate('c1')],
        ideas: [idea('i1', { processId: 'ghost-process' })],
      })
    );
    expect(gaps.some((g) => g.code === 'idea-without-candidate' && g.ideaId === 'i1')).toBe(true);
  });

  it('does not flag an idea pointing at a real candidate', () => {
    const gaps = detectRpaGaps(
      session({ candidates: [candidate('c1')], ideas: [idea('i1', { processId: 'c1' })] })
    );
    expect(gaps.some((g) => g.code === 'idea-without-candidate')).toBe(false);
  });

  it('flags a low-standardization candidate already fast-tracked to a tech tier', () => {
    const gaps = detectRpaGaps(
      session({ candidates: [candidate('c1', { standardization: 'low', techTier: 'rpa' })] })
    );
    expect(gaps.some((g) => g.code === 'low-standardization-fast-tracked')).toBe(true);
  });

  it('a clean, fully-quantified, well-tiered portfolio has zero gaps', () => {
    const gaps = detectRpaGaps(
      session({
        candidates: [candidate('c1')],
        ideas: [idea('i1', { processId: 'c1' })],
      })
    );
    expect(gaps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Conclusion prompt integration
// ---------------------------------------------------------------------------

describe('RPA Scanner O3 — conclusion prompt surfaces gaps and guards', () => {
  it('includes the gap section and a named gap for an under-quantified, high-exception candidate', () => {
    const data = session({
      candidates: [candidate('c1', { techTier: 'rpa', exceptionRate: 0.6 })],
      ideas: [idea('i1', { processId: 'c1', impact: 'high', effort: 'low', evidence: ['x'] })],
    });
    const prompt = buildRpaConclusionPrompt(data, false)!;
    expect(prompt).toContain('STRUCTURAL GAPS');
    expect(prompt).toContain('high-exception-optimistic-tier');
    expect(prompt).toContain('rpa-volume-force');
    expect(prompt).toContain('staircase.fact');
  });

  it('reports no gaps for a clean portfolio', () => {
    const data = session({
      candidates: [candidate('c1')],
      ideas: [idea('i1', { processId: 'c1', impact: 'high', effort: 'low', evidence: ['x'] })],
    });
    const prompt = buildRpaConclusionPrompt(data, false)!;
    expect(prompt).toContain('no structural gaps detected');
  });
});
