import { describe, expect, it } from 'vitest';

import {
  buildPortfolioLadderPromptBlock,
  getNextPortfolioQuestion,
  getPortfolioEntryQuestion,
  getPortfolioQuestionById,
  readPortfolioLadderHints,
  validatePortfolioQuestionBank,
} from '@/config/portfolio/portfolioQuestionBank';
import {
  importOrgInitiativesAsElements,
} from '@/config/portfolio/portfolioOrgImport';
import { classifyPortfolio } from '@/config/portfolio/portfolioMatrixEngine';

describe('portfolioQuestionBank — structure', () => {
  it('passes its own structural self-check (branches, levels, termination)', () => {
    expect(validatePortfolioQuestionBank()).toEqual([]);
  });

  it('starts at a level-1 surface question', () => {
    const entry = getPortfolioEntryQuestion();
    expect(entry.level).toBe(1);
    expect(entry.rung).toBe('surface');
  });

  it('ladders surface -> value-evidence -> feasibility-evidence -> urgency', () => {
    const q1 = getPortfolioEntryQuestion();
    const q2 = getNextPortfolioQuestion(q1.id, q1.answerOptions[0].key)!;
    const q3 = getNextPortfolioQuestion(q2.id, q2.answerOptions[0].key)!;
    const q4 = getNextPortfolioQuestion(q3.id, q3.answerOptions[0].key)!;
    expect([q1.rung, q2.rung, q3.rung, q4.rung]).toEqual([
      'surface',
      'value-evidence',
      'feasibility-evidence',
      'urgency',
    ]);
    // urgency is terminal
    expect(getNextPortfolioQuestion(q4.id, q4.answerOptions[0].key)).toBeNull();
  });

  it('falls back to defaultNextId for an unknown answer key', () => {
    const entry = getPortfolioEntryQuestion();
    const next = getNextPortfolioQuestion(entry.id, 'nonsense-key');
    expect(next?.id).toBe(entry.defaultNextId);
  });

  it('exposes questions by id', () => {
    expect(getPortfolioQuestionById('e3-feasibility')?.rung).toBe('feasibility-evidence');
    expect(getPortfolioQuestionById('missing')).toBeUndefined();
  });
});

describe('portfolioQuestionBank — hints from answers', () => {
  it('reads value-evidence, dependency, capability gap and urgency', () => {
    const hints = readPortfolioLadderHints([
      { questionId: 'e2-value-source', answerKey: 'assumed' },
      { questionId: 'e3-feasibility', answerKey: 'needs-prereq' },
      { questionId: 'e4-urgency', answerKey: 'window-closing' },
    ]);
    expect(hints).toEqual({
      valueEvidence: 'assumed',
      hasDependency: true,
      capabilityGap: false,
      urgent: true,
    });
  });

  it('marks capability gap when feasibility answer says so', () => {
    const hints = readPortfolioLadderHints([
      { questionId: 'e3-feasibility', answerKey: 'capability-gap' },
    ]);
    expect(hints.capabilityGap).toBe(true);
    expect(hints.hasDependency).toBe(false);
  });
});

describe('portfolioQuestionBank — prompt block', () => {
  it('serializes the ladder bilingually with intents and branch targets', () => {
    const pl = buildPortfolioLadderPromptBlock('pl');
    const en = buildPortfolioLadderPromptBlock('en');
    expect(pl).toMatch(/e1-surface/);
    expect(pl).toMatch(/L2/);
    expect(en).toMatch(/e4-urgency/);
    expect(en).toMatch(/ladder complete/);
  });
});

describe('portfolioOrgImport — bonus coherence with real org initiatives', () => {
  it('imports initiatives as elements, mapping impact->value and effort->feasibility', () => {
    const els = importOrgInitiativesAsElements({
      initiatives: [
        { id: 'i1', title: 'Big win', estimatedImpact: 'high', estimatedEffort: 'low' },
        { id: 'i2', name: 'Hard slog', estimatedImpact: 'medium', estimatedEffort: 'high', dependsOn: ['i1'] },
      ],
    });
    expect(els).toHaveLength(2);
    const i1 = els.find((e) => e.id === 'i1')!;
    expect(i1.valueScore).toBe(5); // high impact
    expect(i1.feasibilityScore).toBe(5); // low effort -> high feasibility
    const i2 = els.find((e) => e.id === 'i2')!;
    expect(i2.feasibilityScore).toBe(1); // high effort -> low feasibility
    expect(i2.dependencies?.[0]?.dependsOnElementId).toBe('i1');
    // imported elements are proposed, not auto-accepted
    expect(i2.status).toBe('proposed');
  });

  it('imported (proposed) elements do not count until accepted', () => {
    const els = importOrgInitiativesAsElements({
      initiatives: [{ id: 'i1', title: 'x', estimatedImpact: 'high', estimatedEffort: 'low' }],
    });
    expect(classifyPortfolio(els)).toHaveLength(0); // proposed => excluded
    const accepted = els.map((e) => ({ ...e, status: 'accepted' as const }));
    expect(classifyPortfolio(accepted)).toHaveLength(1);
  });

  it('missing scores land on the neutral midpoint, never invented', () => {
    const els = importOrgInitiativesAsElements({ items: [{ title: 'unknown' }] });
    expect(els[0].valueScore).toBe(3);
    expect(els[0].feasibilityScore).toBe(3);
  });
});
