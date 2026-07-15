import { describe, expect, it } from 'vitest';

import {
  type AutomationBaselineInput,
  type AutomationCandidate,
  AUTOMATION_QUESTION_BANK,
  AUTOMATION_QUESTION_ROOT_ID,
  type AutomationSession,
  buildAutomationQuestionBankPromptRules,
  buildAutomationStaircasePromptRules,
  buildProcessAutomationConclusionPrompt,
  detectAutomationGaps,
  getAutomationQuestion,
  getAutomationQuestionsByLevel,
  getNextAutomationQuestionId,
  isForcedLoopAutomationQuestion,
  textMakesQuantifiedClaim,
  validateAutomationInsightStaircase,
} from '../../src/config/processautomation';

const candidate = (id: string, overrides: Partial<AutomationCandidate> = {}): AutomationCandidate => ({
  id,
  phase: 'automate',
  impact: 'medium',
  effort: 'medium',
  evidence: [],
  minutesSaved: 5,
  ...overrides,
});

const session = (
  candidates: AutomationCandidate[] = [],
  baseline: AutomationBaselineInput = {}
): AutomationSession => ({ candidates, baseline });

// ---------------------------------------------------------------------------
// Question bank: structure, branching, two forced loops
// ---------------------------------------------------------------------------

describe('Process Automation O3 — laddered question bank', () => {
  it('covers all 4 levels with the canonical root id', () => {
    expect(getAutomationQuestion(AUTOMATION_QUESTION_ROOT_ID)).toBeTruthy();
    expect(getAutomationQuestion(AUTOMATION_QUESTION_ROOT_ID)!.level).toBe(1);
    const levels = new Set(AUTOMATION_QUESTION_BANK.map((q) => q.level));
    expect(levels).toEqual(new Set([1, 2, 3, 4]));
    expect(getAutomationQuestionsByLevel(2).length).toBeGreaterThanOrEqual(3);
  });

  it('every node is bilingual, non-empty, and has at least 2 answer options', () => {
    AUTOMATION_QUESTION_BANK.forEach((q) => {
      expect(q.textPl.trim().length).toBeGreaterThan(0);
      expect(q.textEn.trim().length).toBeGreaterThan(0);
      expect(q.answerOptions.length).toBeGreaterThanOrEqual(2);
      q.answerOptions.forEach((opt) => {
        expect(opt.labelPl.trim().length).toBeGreaterThan(0);
        expect(opt.labelEn.trim().length).toBeGreaterThan(0);
      });
    });
  });

  it('every branch target resolves to a real question id or null (no dangling links)', () => {
    const ids = new Set(AUTOMATION_QUESTION_BANK.map((q) => q.id));
    AUTOMATION_QUESTION_BANK.forEach((q) => {
      Object.values(q.branches).forEach((target) => {
        if (target !== null) expect(ids.has(target)).toBe(true);
      });
      if (q.defaultNextId !== null) expect(ids.has(q.defaultNextId)).toBe(true);
      q.answerOptions.forEach((opt) => {
        expect(Object.prototype.hasOwnProperty.call(q.branches, opt.key)).toBe(true);
      });
    });
  });

  it('branches the surface question by whether the process is mapped', () => {
    expect(getNextAutomationQuestionId('pa-surface', 'mapped')).toBe('pa-standardize-check');
    expect(getNextAutomationQuestionId('pa-surface', 'not-mapped')).toBe('pa-map-force');
  });

  it('has TWO independent forced loops: mapping and standardization', () => {
    expect(isForcedLoopAutomationQuestion('pa-map-force')).toBe(true);
    expect(isForcedLoopAutomationQuestion('pa-standardize-force')).toBe(true);
    expect(getNextAutomationQuestionId('pa-map-force', 'still-not-mapped')).toBe('pa-map-force');
    expect(getNextAutomationQuestionId('pa-standardize-force', 'still-varies')).toBe(
      'pa-standardize-force'
    );
    expect(isForcedLoopAutomationQuestion('pa-quant-entry')).toBe(false);
  });

  it('the mapped path still hits the standardize gate before quantification', () => {
    expect(getNextAutomationQuestionId('pa-standardize-check', 'one-way')).toBe('pa-quant-entry');
    expect(getNextAutomationQuestionId('pa-standardize-check', 'varies')).toBe('pa-standardize-force');
  });

  it('the sustain level ends the ladder (null)', () => {
    expect(getNextAutomationQuestionId('pa-sustain-entry', 'owner-and-fallback-named')).toBeNull();
    expect(getNextAutomationQuestionId('pa-sustain-entry', 'no-owner-yet')).toBeNull();
  });

  it('unknown question id returns undefined and unknown answer key falls back to defaultNextId', () => {
    expect(getNextAutomationQuestionId('does-not-exist', 'x')).toBeUndefined();
    expect(getNextAutomationQuestionId('pa-surface', 'nonsense')).toBe(
      getAutomationQuestion('pa-surface')!.defaultNextId
    );
  });

  it('exposes non-empty, distinct bilingual prompt rules for the ladder contract', () => {
    const pl = buildAutomationQuestionBankPromptRules('pl');
    const en = buildAutomationQuestionBankPromptRules('en');
    expect(pl).toContain('pa-map-force');
    expect(pl).toContain('pa-standardize-force');
    expect(en).toContain('pa-map-force');
    expect(en).toContain('pa-standardize-force');
    expect(pl).not.toEqual(en);
  });
});

// ---------------------------------------------------------------------------
// Insight staircase + invented-number guard
// ---------------------------------------------------------------------------

describe('Process Automation O3 — per-candidate insight staircase', () => {
  it('flags missing fact / interpretation / implication', () => {
    const issues = validateAutomationInsightStaircase({ id: 'c1', title: 'Automate the reconciliation step' });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('missing-fact');
    expect(codes).toContain('missing-interpretation');
    expect(codes).toContain('missing-implication');
  });

  it('flags an interpretation that just restates the fact', () => {
    const issues = validateAutomationInsightStaircase({
      id: 'c1',
      staircase: {
        fact: 'The reconciliation step runs 200 times a week',
        factRefs: ['log-1'],
        interpretation: 'The reconciliation step runs 200 times a week',
        implication: 'Automate it',
      },
    });
    expect(issues.map((i) => i.code)).toContain('interpretation-is-restatement');
  });

  it('passes a fully-formed staircase with sourced evidence', () => {
    const issues = validateAutomationInsightStaircase({
      id: 'c1',
      staircase: {
        fact: 'The reconciliation step runs 200 times a week',
        factRefs: ['log-1'],
        interpretation: 'The volume justifies automation over manual triage',
        implication: 'It should lead the automate phase once standardized',
      },
    });
    expect(issues).toHaveLength(0);
  });

  it('invented-number guard: a quantified claim with no evidence and no declared status is flagged', () => {
    const issues = validateAutomationInsightStaircase({
      id: 'c1',
      title: 'Cuts cycle time by 25%',
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
    const withEvidence = validateAutomationInsightStaircase({
      id: 'c1',
      title: 'Cuts cycle time by 25%',
      evidence: ['pilot-1'],
      staircase: {
        fact: 'fact',
        factRefs: ['x'],
        interpretation: 'meaningful interpretation text here',
        implication: 'meaningful implication text here',
      },
    });
    expect(withEvidence.map((i) => i.code)).not.toContain('invented-number');

    const declared = validateAutomationInsightStaircase({
      id: 'c1',
      title: 'Cuts cycle time by 25%',
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

  it('textMakesQuantifiedClaim recognizes percentages, minutes and multipliers', () => {
    expect(textMakesQuantifiedClaim('cuts cycle time by 25%')).toBe(true);
    expect(textMakesQuantifiedClaim('saves 8 min per run')).toBe(true);
    expect(textMakesQuantifiedClaim('runs 3x faster')).toBe(true);
    expect(textMakesQuantifiedClaim('makes the process smoother')).toBe(false);
  });

  it('exposes non-empty, distinct bilingual staircase prompt rules', () => {
    const pl = buildAutomationStaircasePromptRules('pl');
    const en = buildAutomationStaircasePromptRules('en');
    expect(pl.toLowerCase()).toContain('staircase.fact');
    expect(en.toLowerCase()).toContain('staircase.fact');
    expect(pl).not.toEqual(en);
  });
});

// ---------------------------------------------------------------------------
// Structural gap detection
// ---------------------------------------------------------------------------

describe('Process Automation O3 — structural gap detection', () => {
  it('flags automate candidates with zero standardize candidates logged', () => {
    const gaps = detectAutomationGaps(session([candidate('c1', { phase: 'automate' })]));
    expect(gaps.some((g) => g.code === 'automate-before-standardize')).toBe(true);
  });

  it('does not flag once a standardize candidate exists', () => {
    const gaps = detectAutomationGaps(
      session([candidate('c1', { phase: 'automate' }), candidate('c2', { phase: 'standardize' })])
    );
    expect(gaps.some((g) => g.code === 'automate-before-standardize')).toBe(false);
  });

  it('flags candidates proposed on an unquantified baseline', () => {
    const gaps = detectAutomationGaps(session([candidate('c1', { phase: 'standardize' })], {}));
    expect(gaps.some((g) => g.code === 'unquantified-baseline-with-candidates')).toBe(true);
  });

  it('does not flag once the baseline is quantified', () => {
    const gaps = detectAutomationGaps(
      session([candidate('c1', { phase: 'standardize' })], {
        volumePerWeek: 100,
        baselineMinutesPerCycle: 10,
      })
    );
    expect(gaps.some((g) => g.code === 'unquantified-baseline-with-candidates')).toBe(false);
  });

  it('flags an error-rate target with no baseline error rate', () => {
    const gaps = detectAutomationGaps(session([], { errorRateTargetPct: 1 }));
    expect(gaps.some((g) => g.code === 'error-target-without-baseline')).toBe(true);
  });

  it('does not flag once a baseline error rate exists', () => {
    const gaps = detectAutomationGaps(
      session([], { errorRateTargetPct: 1, errorRateBaselinePct: 5 })
    );
    expect(gaps.some((g) => g.code === 'error-target-without-baseline')).toBe(false);
  });

  it('a clean, fully-quantified, correctly-ordered session has zero gaps', () => {
    const gaps = detectAutomationGaps(
      session([candidate('c1', { phase: 'standardize' }), candidate('c2', { phase: 'automate' })], {
        volumePerWeek: 100,
        baselineMinutesPerCycle: 10,
        errorRateBaselinePct: 5,
        errorRateTargetPct: 1,
      })
    );
    expect(gaps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Conclusion prompt integration
// ---------------------------------------------------------------------------

describe('Process Automation O3 — conclusion prompt surfaces gaps and guards', () => {
  it('includes the gap section and a named gap when automate skips standardize', () => {
    const data = session([
      candidate('c1', { phase: 'automate', impact: 'high', effort: 'low', evidence: ['x'] }),
    ]);
    const prompt = buildProcessAutomationConclusionPrompt(data, false)!;
    expect(prompt).toContain('STRUCTURAL GAPS');
    expect(prompt).toContain('automate-before-standardize');
    expect(prompt).toContain('pa-map-force');
    expect(prompt).toContain('staircase.fact');
  });

  it('reports no gaps for a correctly-ordered, quantified session', () => {
    const data = session(
      [
        candidate('c1', { phase: 'standardize', impact: 'high', effort: 'low', evidence: ['x'] }),
        candidate('c2', { phase: 'automate', impact: 'high', effort: 'low', evidence: ['x'] }),
      ],
      { volumePerWeek: 100, baselineMinutesPerCycle: 10 }
    );
    const prompt = buildProcessAutomationConclusionPrompt(data, false)!;
    expect(prompt).toContain('no structural gaps detected');
  });
});
