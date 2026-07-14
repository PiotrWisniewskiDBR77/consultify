import { describe, expect, it } from 'vitest';

import {
  AMBITION_QUESTION_BANK,
  AMBITION_QUESTION_ROOT_ID,
  type AmbitionInitiativeNode,
  MIN_THEMES_FOR_UMBRELLA,
  buildAmbitionDecomposerConclusionPrompt,
  buildAmbitionQuestionBankPromptRules,
  buildAmbitionStaircasePromptRules,
  buildAmbitionTree,
  buildAmbitionTreePromptRules,
  detectAmbitionGaps,
  detectUmbrellaAmbition,
  getAmbitionQuestion,
  getAmbitionQuestionsByLevel,
  getNextAmbitionQuestionId,
  isForcedLoopQuestion,
  isUmbrellaAmbition,
  rankThemes,
  sequenceInitiativesTopologically,
  textMakesQuantifiedClaim,
  type ThemeItem,
  validateAmbitionDecomposition,
  validateAmbitionInsightStaircase,
} from '../../src/config/ambitiondecomposer';

const theme = (id: string, overrides: Partial<ThemeItem> = {}): ThemeItem => ({
  id,
  title: `Theme ${id}`,
  targetMetric: 'metric',
  targetValue: '100',
  horizon: 'medium',
  importance: 'medium',
  evidence: [],
  ...overrides,
});

const initiative = (
  id: string,
  themeId: string,
  overrides: Partial<AmbitionInitiativeNode> = {}
): AmbitionInitiativeNode => ({
  id,
  title: `Initiative ${id}`,
  themeId,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Question bank: structure, branching, forced loop
// ---------------------------------------------------------------------------

describe('Ambition Decomposer O3 — laddered question bank', () => {
  it('covers all 4 levels with the canonical root id', () => {
    expect(getAmbitionQuestion(AMBITION_QUESTION_ROOT_ID)).toBeTruthy();
    expect(getAmbitionQuestion(AMBITION_QUESTION_ROOT_ID)!.level).toBe(1);
    const levels = new Set(AMBITION_QUESTION_BANK.map((q) => q.level));
    expect(levels).toEqual(new Set([1, 2, 3, 4]));
    expect(getAmbitionQuestionsByLevel(2).length).toBeGreaterThanOrEqual(2);
    expect(getAmbitionQuestionsByLevel(4).length).toBeGreaterThanOrEqual(2);
  });

  it('every node is bilingual, non-empty, and has at least 2 answer options', () => {
    AMBITION_QUESTION_BANK.forEach((q) => {
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
    const ids = new Set(AMBITION_QUESTION_BANK.map((q) => q.id));
    AMBITION_QUESTION_BANK.forEach((q) => {
      Object.values(q.branches).forEach((target) => {
        if (target !== null) expect(ids.has(target)).toBe(true);
      });
      if (q.defaultNextId !== null) expect(ids.has(q.defaultNextId)).toBe(true);
      // Every answer option key must be wired into branches.
      q.answerOptions.forEach((opt) => {
        expect(Object.prototype.hasOwnProperty.call(q.branches, opt.key)).toBe(true);
      });
    });
  });

  it('branches the ambition surface question by whether a target already exists', () => {
    expect(getNextAmbitionQuestionId('amb-surface', 'has-number-date')).toBe('amb-decompose-check');
    expect(getNextAmbitionQuestionId('amb-surface', 'phrase-only')).toBe('amb-decompose-force');
  });

  it('unknown answer key falls back to defaultNextId', () => {
    expect(getNextAmbitionQuestionId('amb-surface', 'nonsense-key')).toBe(
      getAmbitionQuestion('amb-surface')!.defaultNextId
    );
  });

  it('unknown question id returns undefined', () => {
    expect(getNextAmbitionQuestionId('does-not-exist', 'x')).toBeUndefined();
  });

  it('the forced-decomposition question loops back on itself until the user actually splits the ambition', () => {
    expect(isForcedLoopQuestion('amb-decompose-force')).toBe(true);
    expect(getNextAmbitionQuestionId('amb-decompose-force', 'still-one-theme')).toBe(
      'amb-decompose-force'
    );
    expect(getNextAmbitionQuestionId('amb-decompose-force', 'decomposed')).toBe('amb-quant-entry');
    // Non-forced nodes do not loop.
    expect(isForcedLoopQuestion('amb-quant-entry')).toBe(false);
    expect(isForcedLoopQuestion('amb-surface')).toBe(false);
  });

  it('the initiatives level ends the ladder (null) once dependencies are addressed', () => {
    expect(getNextAmbitionQuestionId('amb-init-deps', 'deps-named')).toBeNull();
    expect(getNextAmbitionQuestionId('amb-init-deps', 'independent')).toBeNull();
  });

  it('exposes non-empty bilingual prompt rules for the ladder contract', () => {
    const pl = buildAmbitionQuestionBankPromptRules('pl');
    const en = buildAmbitionQuestionBankPromptRules('en');
    expect(pl).toContain('amb-decompose-force');
    expect(en).toContain('amb-decompose-force');
    expect(pl).not.toEqual(en);
  });
});

// ---------------------------------------------------------------------------
// Forced decomposition of umbrella ambitions
// ---------------------------------------------------------------------------

describe('Ambition Decomposer O3 — forced decomposition guard', () => {
  it('detects umbrella ambition phrases in PL and EN', () => {
    expect(isUmbrellaAmbition('Zostać liderem rynku w 3 lata')).toBe(true);
    expect(isUmbrellaAmbition('Become the market leader in our category')).toBe(true);
    expect(isUmbrellaAmbition('Przeprowadzić transformację cyfrową firmy')).toBe(true);
    expect(isUmbrellaAmbition('Osiągnąć doskonałość operacyjną')).toBe(true);
    expect(detectUmbrellaAmbition('Increase EBITDA margin from 8% to 12% by FY2027')).toBeNull();
  });

  it('a specific, already-quantified ambition is not flagged as an umbrella', () => {
    expect(
      isUmbrellaAmbition('Zwiększyć marżę EBITDA z 8% do 12% do końca 2027, poprzez 3 nazwane dźwignie')
    ).toBe(false);
  });

  it('rejects a parasol ambition with fewer than MIN_THEMES_FOR_UMBRELLA accepted themes', () => {
    const issues = validateAmbitionDecomposition({
      ambitionStatement: 'Become the market leader in our category',
      acceptedThemeCount: 1,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('ambition-needs-decomposition');
    expect(issues[0].messageEn).toContain(String(MIN_THEMES_FOR_UMBRELLA));
  });

  it('accepts a parasol ambition once it has been decomposed into enough themes', () => {
    const issues = validateAmbitionDecomposition({
      ambitionStatement: 'Become the market leader in our category',
      acceptedThemeCount: MIN_THEMES_FOR_UMBRELLA,
    });
    expect(issues).toHaveLength(0);
  });

  it('does not require decomposition for a non-umbrella, already-specific ambition', () => {
    const issues = validateAmbitionDecomposition({
      ambitionStatement: 'Cut customer churn from 6% to 3% within 18 months',
      acceptedThemeCount: 0,
    });
    expect(issues).toHaveLength(0);
  });

  it('is a no-op when there is no ambition statement yet', () => {
    expect(validateAmbitionDecomposition({ acceptedThemeCount: 0 })).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// K1->K2->K3 staircase + invented-number guard per theme
// ---------------------------------------------------------------------------

describe('Ambition Decomposer O3 — per-theme insight staircase', () => {
  it('flags missing fact / interpretation / implication', () => {
    const issues = validateAmbitionInsightStaircase({ id: 't1', title: 'Expand into APAC' });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('missing-fact');
    expect(codes).toContain('missing-interpretation');
    expect(codes).toContain('missing-implication');
  });

  it('flags an interpretation that just restates the fact', () => {
    const issues = validateAmbitionInsightStaircase({
      id: 't1',
      title: 'Expand into APAC',
      staircase: {
        fact: 'Revenue in APAC grew 4% last year',
        factRefs: ['sig-1'],
        interpretation: 'Revenue in APAC grew 4% last year',
        implication: 'We should invest more in the region',
      },
    });
    expect(issues.map((i) => i.code)).toContain('interpretation-is-restatement');
  });

  it('passes a fully-formed staircase with sourced evidence', () => {
    const issues = validateAmbitionInsightStaircase({
      id: 't1',
      title: 'Expand into APAC',
      staircase: {
        fact: 'Revenue in APAC grew 4% last year',
        factRefs: ['sig-1'],
        interpretation: 'The region is underweighted relative to its growth rate',
        implication: 'A dedicated APAC theme should rank above table-stakes markets',
      },
    });
    expect(issues).toHaveLength(0);
  });

  it('invented-number guard: a quantified claim with no evidence and no declared status is flagged', () => {
    const issues = validateAmbitionInsightStaircase({
      id: 't1',
      title: 'Cut fulfillment cost by 30%',
      targetValue: '30%',
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
    const issues = validateAmbitionInsightStaircase({
      id: 't1',
      title: 'Cut fulfillment cost by 30%',
      targetValue: '30%',
      evidence: ['benchmark-2026'],
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
    const issues = validateAmbitionInsightStaircase({
      id: 't1',
      title: 'Cut fulfillment cost by 30%',
      targetValue: '30%',
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
    const issues = validateAmbitionInsightStaircase({
      id: 't1',
      title: 'Improve onboarding satisfaction',
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

  it('textMakesQuantifiedClaim recognizes percentages, multipliers and currency', () => {
    expect(textMakesQuantifiedClaim('grow by 30%')).toBe(true);
    expect(textMakesQuantifiedClaim('double throughput 2x')).toBe(true);
    expect(textMakesQuantifiedClaim('open a €1.2M ARR segment')).toBe(true);
    expect(textMakesQuantifiedClaim('become the best in class')).toBe(false);
  });

  it('exposes non-empty, distinct bilingual staircase prompt rules', () => {
    const pl = buildAmbitionStaircasePromptRules('pl');
    const en = buildAmbitionStaircasePromptRules('en');
    expect(pl).toContain(String(MIN_THEMES_FOR_UMBRELLA));
    expect(en).toContain(String(MIN_THEMES_FOR_UMBRELLA));
    expect(pl).not.toEqual(en);
  });
});

// ---------------------------------------------------------------------------
// Ambition tree + "ambition without a path" gap detection
// ---------------------------------------------------------------------------

describe('Ambition Decomposer O3 — ambition tree & gap detection', () => {
  it('groups accepted initiatives under their theme and finds orphans', () => {
    const tree = buildAmbitionTree({
      context: { ambitionStatement: 'Grow EBITDA' },
      themes: [theme('found1'), theme('acc1')],
      initiatives: [
        initiative('i1', 'found1'),
        initiative('i2', 'found1'),
        initiative('i3', 'ghost-theme'),
      ],
    });
    expect(tree.themes.find((t) => t.theme.id === 'found1')!.initiatives).toHaveLength(2);
    expect(tree.themes.find((t) => t.theme.id === 'acc1')!.initiatives).toHaveLength(0);
    expect(tree.orphanInitiatives).toHaveLength(1);
    expect(tree.orphanInitiatives[0].id).toBe('i3');
  });

  it('flags "ambition without themes" when the statement exists but nothing was decomposed', () => {
    const gaps = detectAmbitionGaps({ context: { ambitionStatement: 'Become #1 in our segment' }, themes: [] });
    expect(gaps.some((g) => g.code === 'ambition-without-themes')).toBe(true);
  });

  it('flags a critical theme (foundation) with zero initiatives as a path gap', () => {
    const gaps = detectAmbitionGaps({
      context: { ambitionStatement: 'Grow EBITDA' },
      themes: [theme('found1', { importance: 'high', horizon: 'short' })],
      initiatives: [],
    });
    expect(gaps.some((g) => g.code === 'theme-without-initiative' && g.themeId === 'found1')).toBe(
      true
    );
  });

  it('does not flag a critical theme once it has at least one initiative', () => {
    const gaps = detectAmbitionGaps({
      context: { ambitionStatement: 'Grow EBITDA' },
      themes: [theme('found1', { importance: 'high', horizon: 'short' })],
      initiatives: [initiative('i1', 'found1')],
    });
    expect(gaps.some((g) => g.code === 'theme-without-initiative')).toBe(false);
  });

  it('does not flag a low-importance enabler theme for having zero initiatives', () => {
    const gaps = detectAmbitionGaps({
      context: { ambitionStatement: 'Grow EBITDA' },
      themes: [theme('en1', { importance: 'low', horizon: 'medium' })],
      initiatives: [],
    });
    expect(gaps.some((g) => g.code === 'theme-without-initiative')).toBe(false);
  });

  it('flags an orphan initiative pointing at a nonexistent/rejected theme', () => {
    const gaps = detectAmbitionGaps({
      context: { ambitionStatement: 'Grow EBITDA' },
      themes: [theme('found1', { importance: 'high', horizon: 'short' })],
      initiatives: [initiative('i1', 'found1'), initiative('i2', 'missing-theme')],
    });
    expect(gaps.some((g) => g.code === 'orphan-initiative' && g.initiativeId === 'i2')).toBe(true);
  });

  it('a fully-covered ambition (every critical theme has an initiative) has zero path gaps', () => {
    const gaps = detectAmbitionGaps({
      context: { ambitionStatement: 'Grow EBITDA' },
      themes: [
        theme('found1', { importance: 'high', horizon: 'short' }),
        theme('bet1', { importance: 'high', horizon: 'long' }),
      ],
      initiatives: [initiative('i1', 'found1'), initiative('i2', 'bet1')],
    });
    expect(gaps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Topological sequencing of initiatives
// ---------------------------------------------------------------------------

describe('Ambition Decomposer O3 — topological sequencing', () => {
  it('orders a dependency chain A <- B <- C as A, B, C', () => {
    const initiatives = [
      initiative('c', 'found1', { dependencies: ['b'] }),
      initiative('a', 'found1'),
      initiative('b', 'found1', { dependencies: ['a'] }),
    ];
    const result = sequenceInitiativesTopologically(initiatives);
    expect(result.ordered.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(result.blocked).toHaveLength(0);
    expect(result.cycles).toHaveLength(0);
  });

  it('never schedules a dependent initiative before its dependency', () => {
    const initiatives = [
      initiative('launch', 'found1', { dependencies: ['build-platform'] }),
      initiative('build-platform', 'found1'),
    ];
    const result = sequenceInitiativesTopologically(initiatives);
    const orderOf = (id: string) => result.ordered.find((n) => n.id === id)!.order;
    expect(orderOf('build-platform')).toBeLessThan(orderOf('launch'));
  });

  it('breaks ties among independent initiatives using the theme priority ranking', () => {
    const themes = [
      theme('found1', { importance: 'high', horizon: 'short' }), // foundation, rank 0
      theme('bet1', { importance: 'high', horizon: 'long' }), // bet, rank 3
    ];
    const ranking = rankThemes({ themes });
    const initiatives = [initiative('bet-init', 'bet1'), initiative('found-init', 'found1')];
    const result = sequenceInitiativesTopologically(initiatives, ranking);
    expect(result.ordered[0].id).toBe('found-init');
    expect(result.ordered[1].id).toBe('bet-init');
  });

  it('detects a dependency cycle and blocks its members instead of guessing an order', () => {
    const initiatives = [
      initiative('x', 'found1', { dependencies: ['y'] }),
      initiative('y', 'found1', { dependencies: ['x'] }),
    ];
    const result = sequenceInitiativesTopologically(initiatives);
    expect(result.ordered).toHaveLength(0);
    expect(result.cycles.length).toBeGreaterThan(0);
    expect(result.blocked.map((b) => b.id).sort()).toEqual(['x', 'y']);
    expect(result.blocked.every((b) => b.reason.includes('circular'))).toBe(true);
  });

  it('reports a dangling dependency without blocking the initiative', () => {
    const initiatives = [initiative('a', 'found1', { dependencies: ['ghost-initiative'] })];
    const result = sequenceInitiativesTopologically(initiatives);
    expect(result.danglingDependencies).toEqual([{ id: 'a', missing: ['ghost-initiative'] }]);
    expect(result.ordered.map((n) => n.id)).toEqual(['a']);
  });

  it('excludes rejected/rethinking initiatives from the sequence', () => {
    const initiatives = [
      initiative('keep', 'found1'),
      initiative('drop', 'found1', { proposalStatus: 'rejected' }),
    ];
    const result = sequenceInitiativesTopologically(initiatives);
    expect(result.ordered.map((n) => n.id)).toEqual(['keep']);
  });

  it('an empty initiative set sequences to an empty, gap-free result', () => {
    const result = sequenceInitiativesTopologically([]);
    expect(result.ordered).toHaveLength(0);
    expect(result.blocked).toHaveLength(0);
    expect(result.cycles).toHaveLength(0);
    expect(result.danglingDependencies).toHaveLength(0);
  });

  it('exposes non-empty, distinct bilingual tree prompt rules', () => {
    const pl = buildAmbitionTreePromptRules('pl');
    const en = buildAmbitionTreePromptRules('en');
    expect(pl.toLowerCase()).toContain('themeid');
    expect(en.toLowerCase()).toContain('themeid');
    expect(pl).not.toEqual(en);
  });
});

// ---------------------------------------------------------------------------
// Conclusion prompt integration: gaps + staircase + tree rules surfaced
// ---------------------------------------------------------------------------

describe('Ambition Decomposer O3 — conclusion prompt surfaces gaps and guards', () => {
  it('includes the gap section and a named gap when a critical theme has no initiative', () => {
    const data = {
      context: { ambitionStatement: 'Become the market leader', scope: 'company' },
      themes: [theme('found1', { importance: 'high', horizon: 'short' })],
      initiatives: [] as AmbitionInitiativeNode[],
    };
    const prompt = buildAmbitionDecomposerConclusionPrompt(data, false)!;
    expect(prompt).toContain('AMBITION WITHOUT A PATH');
    expect(prompt).toContain('theme-without-initiative');
    expect(prompt).toContain('amb-decompose-force');
  });

  it('reports no gaps when every critical theme has a delivery path', () => {
    const data = {
      context: { ambitionStatement: 'Grow EBITDA', scope: 'company' },
      themes: [theme('found1', { importance: 'high', horizon: 'short' })],
      initiatives: [initiative('i1', 'found1')] as AmbitionInitiativeNode[],
    };
    const prompt = buildAmbitionDecomposerConclusionPrompt(data, false)!;
    expect(prompt).toContain('no "ambition without a path" gaps detected');
  });
});
