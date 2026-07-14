import { describe, expect, it } from 'vitest';

import {
  buildCapabilityLadderPromptBlock,
  CAPABILITY_QUESTION_BANK,
  getCapabilityEntryQuestion,
  getNextCapabilityQuestion,
  readCapabilityLadderHints,
  validateCapabilityQuestionBank,
} from '../../src/config/capabilitymapper/capabilityQuestionBank';
import {
  buildCapabilityStaircasePromptRules,
  guardCapabilitySet,
  textMakesQuantifiedClaim,
  validateCapabilityStaircase,
  type CapabilityInsightStaircase,
} from '../../src/config/capabilitymapper/capabilityInsightStaircase';
import {
  buildCapabilityMatrixPromptRules,
  classifyCapabilityMatrix,
  classifyCapabilityQuadrant,
  flagSourcingQuadrantMismatch,
  groupByCapabilityQuadrant,
  guardSourcingAgainstMatrix,
  rankCapabilityGapsByFeasibility,
  CAPABILITY_QUADRANT_META,
} from '../../src/config/capabilitymapper/capabilityMatrixEngine';
import type { CapabilityItem, CapabilityMapperData } from '../../src/config/capabilitymapper/moveValidator';

const cap = (id: string, overrides: Partial<CapabilityItem> = {}): CapabilityItem => ({
  id,
  name: `Capability ${id}`,
  domain: 'technology',
  currentMaturity: 2,
  targetMaturity: 4,
  importance: 'medium',
  evidence: [],
  ...overrides,
});

const buildData = (capabilities: CapabilityItem[]): CapabilityMapperData => ({
  context: { goal: 'Zbudowac przewage zdolnosci', scope: 'company' },
  capabilities,
});

// ---------------------------------------------------------------------------
// Q-BANK — identification -> maturity evidence -> importance & gap -> move
// ---------------------------------------------------------------------------

describe('Capability Mapper O3 — question bank (drabinka)', () => {
  it('has zero structural problems (no dangling branches, no cycles, no skipped levels)', () => {
    expect(validateCapabilityQuestionBank()).toEqual([]);
  });

  it('has exactly the 4 doctrine rungs in order: identification -> maturity-evidence -> importance-gap -> move', () => {
    const questions = CAPABILITY_QUESTION_BANK.capability;
    expect(questions.map((q) => q.rung)).toEqual([
      'identification',
      'maturity-evidence',
      'importance-gap',
      'move',
    ]);
    expect(questions.map((q) => q.level)).toEqual([1, 2, 3, 4]);
  });

  it('every question has bilingual text and at least 2 branch-covered answer options', () => {
    CAPABILITY_QUESTION_BANK.capability.forEach((q) => {
      expect(q.textPl.trim().length).toBeGreaterThan(0);
      expect(q.textEn.trim().length).toBeGreaterThan(0);
      expect(q.answerOptions.length).toBeGreaterThanOrEqual(2);
      q.answerOptions.forEach((opt) => {
        expect(opt.key in q.branches).toBe(true);
        expect(opt.labelPl).not.toEqual(opt.labelEn);
      });
    });
  });

  it('entry question is the identification rung', () => {
    expect(getCapabilityEntryQuestion().id).toBe('c1-identification');
  });

  it('walks the full ladder identification -> maturity -> importance/gap -> move', () => {
    let current = getCapabilityEntryQuestion();
    expect(current.rung).toBe('identification');
    current = getNextCapabilityQuestion(current.id, 'goal-clear')!;
    expect(current.rung).toBe('maturity-evidence');
    current = getNextCapabilityQuestion(current.id, 'sourced')!;
    expect(current.rung).toBe('importance-gap');
    current = getNextCapabilityQuestion(current.id, 'core-with-gap')!;
    expect(current.rung).toBe('move');
    expect(getNextCapabilityQuestion(current.id, 'build')).toBeNull();
  });

  it('unknown answer keys fall back to defaultNextId instead of dead-ending', () => {
    const next = getNextCapabilityQuestion('c1-identification', 'nonsense-key');
    expect(next?.id).toBe('c2-maturity-source');
  });

  it('reads structured hints out of a full answer set', () => {
    const hints = readCapabilityLadderHints([
      { questionId: 'c1-identification', answerKey: 'goal-clear' },
      { questionId: 'c2-maturity-source', answerKey: 'assumed' },
      { questionId: 'c3-importance-gap', answerKey: 'core-with-gap' },
      { questionId: 'c4-move', answerKey: 'build' },
    ]);
    expect(hints.maturityEvidence).toBe('assumed');
    expect(hints.strategicRead).toBe('core-with-gap');
    expect(hints.moveLean).toBe('build');
  });

  it('defaults hints to unknown when no answers are given', () => {
    const hints = readCapabilityLadderHints([]);
    expect(hints).toEqual({
      maturityEvidence: 'unknown',
      strategicRead: 'unknown',
      moveLean: 'unknown',
    });
  });

  it('serializes the ladder into a PL and EN prompt block covering every question id', () => {
    const pl = buildCapabilityLadderPromptBlock('pl');
    const en = buildCapabilityLadderPromptBlock('en');
    CAPABILITY_QUESTION_BANK.capability.forEach((q) => {
      expect(pl).toContain(q.id);
      expect(en).toContain(q.id);
    });
    expect(pl).not.toEqual(en);
  });
});

// ---------------------------------------------------------------------------
// INSIGHT STAIRCASE + INVENTED-NUMBER GUARD
// ---------------------------------------------------------------------------

describe('Capability Mapper O3 — insight staircase + invented-number guard', () => {
  const sourcedStaircase: CapabilityInsightStaircase = {
    maturity: [
      { lever: 'track-record', claim: 'Delivered 4/5 launches on time', sourceRefs: ['audit-1'] },
    ],
    importance: [
      { lever: 'differentiation', claim: 'Named by 6 of 10 win/loss interviews', sourceRefs: ['signal-1'] },
    ],
  };

  it('flags a maturity score with no ladder at all', () => {
    const issues = validateCapabilityStaircase({
      capabilityId: 'c1',
      name: 'Cap',
      currentMaturity: 4,
    });
    expect(issues.some((i) => i.code === 'missing-maturity-ladder')).toBe(true);
  });

  it('flags an importance score with no ladder at all', () => {
    const issues = validateCapabilityStaircase({
      capabilityId: 'c1',
      name: 'Cap',
      importanceScore: 3,
    });
    expect(issues.some((i) => i.code === 'missing-importance-ladder')).toBe(true);
  });

  it('flags a maturity ladder whose rungs carry no source and no assumption', () => {
    const issues = validateCapabilityStaircase({
      capabilityId: 'c1',
      name: 'Cap',
      currentMaturity: 4,
      staircase: {
        maturity: [{ lever: 'process', claim: 'We are good at this', sourceRefs: [] }],
        importance: [],
      },
    });
    expect(issues.some((i) => i.code === 'maturity-score-without-source')).toBe(true);
  });

  it('accepts a rung backed by an explicit assumption (declared, not invented)', () => {
    const issues = validateCapabilityStaircase({
      capabilityId: 'c1',
      name: 'Cap',
      currentMaturity: 3,
      staircase: {
        maturity: [
          { lever: 'process', claim: 'Our best guess', sourceRefs: [], assumption: 'no audit yet, team estimate' },
        ],
        importance: [],
      },
    });
    expect(issues.some((i) => i.code === 'maturity-score-without-source')).toBe(false);
  });

  it('is clean when every axis is fully sourced', () => {
    const issues = validateCapabilityStaircase({
      capabilityId: 'c1',
      name: 'Data platform capability',
      currentMaturity: 4,
      importanceScore: 3,
      staircase: sourcedStaircase,
    });
    expect(issues).toEqual([]);
  });

  it('invented-number guard: flags a quantified claim in the name/description with no sourced rung', () => {
    const issues = validateCapabilityStaircase({
      capabilityId: 'c1',
      name: 'Ops capability',
      description: 'Cuts fulfillment cost by 30% once built',
      staircase: { maturity: [], importance: [] },
    });
    expect(issues.some((i) => i.code === 'invented-number')).toBe(true);
  });

  it('invented-number guard: does NOT flag when the quantified claim has a sourced rung', () => {
    const issues = validateCapabilityStaircase({
      capabilityId: 'c1',
      name: 'Ops capability',
      description: 'Cuts fulfillment cost by 30% once built',
      staircase: sourcedStaircase,
    });
    expect(issues.some((i) => i.code === 'invented-number')).toBe(false);
  });

  it('invented-number guard: does NOT flag when the capability is explicitly declared/unconfirmed', () => {
    const issues = validateCapabilityStaircase({
      capabilityId: 'c1',
      name: 'Ops capability',
      description: 'Cuts fulfillment cost by 30% once built',
      evidenceStatus: 'declared',
    });
    expect(issues.some((i) => i.code === 'invented-number')).toBe(false);
  });

  it('textMakesQuantifiedClaim recognizes percentages, multipliers and currencies', () => {
    expect(textMakesQuantifiedClaim('cuts cost by 30%')).toBe(true);
    expect(textMakesQuantifiedClaim('2x faster than today')).toBe(true);
    expect(textMakesQuantifiedClaim('saves 100k PLN a year')).toBe(true);
    expect(textMakesQuantifiedClaim('makes the team happier')).toBe(false);
  });

  it('guardCapabilitySet aggregates issues per capability and reports ok=false when any capability fails', () => {
    const result = guardCapabilitySet([
      { capabilityId: 'ok', name: 'Sourced cap', currentMaturity: 4, importanceScore: 3, staircase: sourcedStaircase },
      { capabilityId: 'bad', name: 'Unsourced cap', currentMaturity: 4, staircase: { maturity: [{ lever: 'process', claim: 'gut feel', sourceRefs: [] }], importance: [] } },
    ]);
    expect(result.ok).toBe(false);
    expect(result.perCapability.find((c) => c.capabilityId === 'ok')!.issues).toEqual([]);
    expect(result.perCapability.find((c) => c.capabilityId === 'bad')!.issues.length).toBeGreaterThan(0);
  });

  it('emits distinct, non-empty PL and EN staircase prompt rules', () => {
    const pl = buildCapabilityStaircasePromptRules('pl');
    const en = buildCapabilityStaircasePromptRules('en');
    expect(pl).not.toEqual(en);
    expect(pl).toContain('sourceRefs');
    expect(en).toContain('sourceRefs');
  });
});

// ---------------------------------------------------------------------------
// MATRIX ENGINE — maturity x importance, core vs commodity, ranking, guard
// ---------------------------------------------------------------------------

describe('Capability Mapper O3 — maturity x importance matrix (core vs commodity)', () => {
  it('classifies the 4 quadrants correctly at the midpoints', () => {
    expect(classifyCapabilityQuadrant(4, 3)).toBe('core-strength'); // high maturity, high importance
    expect(classifyCapabilityQuadrant(2, 3)).toBe('core-gap'); // low maturity, high importance
    expect(classifyCapabilityQuadrant(4, 1)).toBe('commodity-strength'); // high maturity, low importance
    expect(classifyCapabilityQuadrant(2, 1)).toBe('commodity-low'); // low maturity, low importance
  });

  it('every quadrant has bilingual, distinct meta text and a correct isCore flag', () => {
    expect(CAPABILITY_QUADRANT_META['core-strength'].isCore).toBe(true);
    expect(CAPABILITY_QUADRANT_META['core-gap'].isCore).toBe(true);
    expect(CAPABILITY_QUADRANT_META['commodity-strength'].isCore).toBe(false);
    expect(CAPABILITY_QUADRANT_META['commodity-low'].isCore).toBe(false);
    Object.values(CAPABILITY_QUADRANT_META).forEach((meta) => {
      expect(meta.titlePl).not.toEqual(meta.titleEn);
      expect(meta.stancePl.length).toBeGreaterThan(10);
    });
  });

  it('classifies only accepted capabilities and excludes rejected/rethinking ones', () => {
    const data = buildData([
      cap('a', { importance: 'high', currentMaturity: 4 }),
      cap('b', { importance: 'high', currentMaturity: 4, proposalStatus: 'rejected' }),
    ]);
    const classified = classifyCapabilityMatrix(data);
    expect(classified).toHaveLength(1);
    expect(classified[0].id).toBe('a');
  });

  it('groups classified capabilities by quadrant', () => {
    const data = buildData([
      cap('core1', { importance: 'high', currentMaturity: 4 }),
      cap('gap1', { importance: 'high', currentMaturity: 2 }),
      cap('comm1', { importance: 'low', currentMaturity: 4 }),
      cap('low1', { importance: 'low', currentMaturity: 2 }),
    ]);
    const dist = groupByCapabilityQuadrant(classifyCapabilityMatrix(data));
    expect(dist['core-strength'].map((c) => c.id)).toEqual(['core1']);
    expect(dist['core-gap'].map((c) => c.id)).toEqual(['gap1']);
    expect(dist['commodity-strength'].map((c) => c.id)).toEqual(['comm1']);
    expect(dist['commodity-low'].map((c) => c.id)).toEqual(['low1']);
  });

  it('ranks gaps by importance x gap x feasibility, not gap x importance alone', () => {
    const data = buildData([
      // gap 2, high importance, LOW feasibility -> 2*3*1 = 6
      cap('hard', { importance: 'high', currentMaturity: 2, targetMaturity: 4, feasibility: 'low' }),
      // gap 2, high importance, HIGH feasibility -> 2*3*3 = 18 (should outrank "hard")
      cap('easy', { importance: 'high', currentMaturity: 2, targetMaturity: 4, feasibility: 'high' }),
    ]);
    const ranked = rankCapabilityGapsByFeasibility(data);
    expect(ranked[0].id).toBe('easy');
    expect(ranked[0].gapScore).toBeGreaterThan(ranked[1].gapScore);
  });

  it('excludes capabilities with no real gap (target <= current) from the ranking', () => {
    const data = buildData([
      cap('done', { importance: 'high', currentMaturity: 5, targetMaturity: 5 }),
      cap('open', { importance: 'medium', currentMaturity: 2, targetMaturity: 4 }),
    ]);
    const ranked = rankCapabilityGapsByFeasibility(data);
    expect(ranked.map((r) => r.id)).toEqual(['open']);
  });

  it('defaults feasibility to medium when not provided', () => {
    const data = buildData([cap('x', { importance: 'medium', currentMaturity: 2, targetMaturity: 4 })]);
    const ranked = rankCapabilityGapsByFeasibility(data);
    expect(ranked[0].feasibility).toBe('medium');
    expect(ranked[0].gapScore).toBe(2 /* gap */ * 2 /* importance medium */ * 2 /* feasibility medium */);
  });

  it('flags a build move on a commodity-strength capability', () => {
    const issue = flagSourcingQuadrantMismatch('c1', 'Commodity cap', 'commodity-strength', 'build');
    expect(issue).not.toBeNull();
    expect(issue!.code).toBe('build-on-commodity');
  });

  it('flags a build move on a commodity-low capability', () => {
    const issue = flagSourcingQuadrantMismatch('c1', 'Commodity cap', 'commodity-low', 'build');
    expect(issue).not.toBeNull();
  });

  it('does NOT flag a build move on core-gap or core-strength capabilities', () => {
    expect(flagSourcingQuadrantMismatch('c1', 'Core cap', 'core-gap', 'build')).toBeNull();
    expect(flagSourcingQuadrantMismatch('c1', 'Core cap', 'core-strength', 'build')).toBeNull();
  });

  it('does NOT flag a buy/partner/sustain move on any quadrant', () => {
    (['core-strength', 'core-gap', 'commodity-strength', 'commodity-low'] as const).forEach((q) => {
      expect(flagSourcingQuadrantMismatch('c1', 'Cap', q, 'buy')).toBeNull();
      expect(flagSourcingQuadrantMismatch('c1', 'Cap', q, 'partner')).toBeNull();
      expect(flagSourcingQuadrantMismatch('c1', 'Cap', q, 'sustain')).toBeNull();
    });
  });

  it('guardSourcingAgainstMatrix batches the mismatch check across a whole session', () => {
    const data = buildData([
      cap('commodity1', { importance: 'low', currentMaturity: 4 }),
      cap('core1', { importance: 'high', currentMaturity: 2 }),
    ]);
    const issues = guardSourcingAgainstMatrix(data, { commodity1: 'build', core1: 'build' });
    expect(issues).toHaveLength(1);
    expect(issues[0].capabilityId).toBe('commodity1');
  });

  it('emits distinct, non-empty PL and EN matrix prompt rules', () => {
    const pl = buildCapabilityMatrixPromptRules('pl');
    const en = buildCapabilityMatrixPromptRules('en');
    expect(pl).not.toEqual(en);
    expect(pl).toContain('wykonalność');
    expect(en).toContain('feasibility');
  });
});
