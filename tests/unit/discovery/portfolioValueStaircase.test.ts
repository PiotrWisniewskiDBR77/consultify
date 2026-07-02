import { describe, expect, it } from 'vitest';

import {
  buildPortfolioStaircasePromptRules,
  mentionsPrerequisite,
  textMakesQuantifiedClaim,
  validatePortfolioStaircase,
  type PortfolioValueStaircase,
} from '@/config/portfolio/portfolioValueStaircase';

const sourcedStaircase: PortfolioValueStaircase = {
  value: [{ lever: 'revenue', claim: 'opens €1.2M ARR segment', sourceRefs: ['sig-1'] }],
  feasibility: [{ lever: 'effort', claim: '2 sprints, existing squad', sourceRefs: ['sig-2'] }],
};

describe('portfolioValueStaircase — source enforcement', () => {
  it('passes a fully-sourced element with both ladders', () => {
    const issues = validatePortfolioStaircase({
      elementId: 'a',
      title: 'CRM revamp',
      valueScore: 5,
      feasibilityScore: 4,
      staircase: sourcedStaircase,
      evidenceStatus: 'confirmed',
    });
    expect(issues).toEqual([]);
  });

  it('flags a value score with no value ladder', () => {
    const issues = validatePortfolioStaircase({
      elementId: 'a',
      title: 'x',
      valueScore: 4,
      staircase: { value: [], feasibility: sourcedStaircase.feasibility },
    });
    expect(issues.map((i) => i.code)).toContain('missing-value-ladder');
  });

  it('flags a value rung with no source and no assumption', () => {
    const issues = validatePortfolioStaircase({
      elementId: 'a',
      title: 'x',
      valueScore: 4,
      staircase: {
        value: [{ lever: 'revenue', claim: 'big upside', sourceRefs: [] }],
        feasibility: sourcedStaircase.feasibility,
      },
    });
    expect(issues.map((i) => i.code)).toContain('value-score-without-source');
  });

  it('accepts an explicit assumption in place of a hard source', () => {
    const issues = validatePortfolioStaircase({
      elementId: 'a',
      title: 'x',
      valueScore: 4,
      feasibilityScore: 4,
      staircase: {
        value: [{ lever: 'risk', claim: 'cuts churn', sourceRefs: [], assumption: 'assume 10% churn cut, unvalidated' }],
        feasibility: sourcedStaircase.feasibility,
      },
    });
    expect(issues.map((i) => i.code)).not.toContain('value-score-without-source');
  });

  it('catches an invented number: a quantified claim with no sourced rung', () => {
    const issues = validatePortfolioStaircase({
      elementId: 'a',
      title: 'Save 30% on logistics',
      valueScore: 5,
      staircase: {
        value: [{ lever: 'cost', claim: 'less spend', sourceRefs: [], assumption: 'gut feel' }],
        feasibility: [],
      },
    });
    expect(issues.map((i) => i.code)).toContain('invented-number');
  });

  it('does not flag invented-number when the whole element is declared', () => {
    const issues = validatePortfolioStaircase({
      elementId: 'a',
      title: 'Save 30% on logistics',
      valueScore: 5,
      evidenceStatus: 'declared',
      staircase: { value: [{ lever: 'cost', claim: 'x', sourceRefs: [] }], feasibility: [] },
    });
    expect(issues.map((i) => i.code)).not.toContain('invented-number');
  });
});

describe('portfolioValueStaircase — dependency honesty', () => {
  it('flags a prerequisite implied in text but no declared dependency', () => {
    const issues = validatePortfolioStaircase({
      elementId: 'b',
      title: 'Analytics rollout',
      description: 'Start once the data warehouse is done.',
      feasibilityScore: 4,
      staircase: sourcedStaircase,
      dependencies: [],
    });
    expect(issues.map((i) => i.code)).toContain('dependency-not-declared');
  });

  it('flags a dangling dependency pointing outside the portfolio', () => {
    const issues = validatePortfolioStaircase({
      elementId: 'b',
      title: 'x',
      feasibilityScore: 4,
      staircase: sourcedStaircase,
      dependencies: [{ dependsOnElementId: 'ghost', reason: 'x', kind: 'hard' }],
      knownElementIds: new Set(['a', 'b']),
    });
    expect(issues.map((i) => i.code)).toContain('dangling-dependency');
  });

  it('accepts a properly declared, in-portfolio dependency', () => {
    const issues = validatePortfolioStaircase({
      elementId: 'b',
      title: 'Analytics rollout',
      description: 'Start once the warehouse is done.',
      feasibilityScore: 4,
      valueScore: 4,
      staircase: sourcedStaircase,
      evidenceStatus: 'confirmed',
      dependencies: [{ dependsOnElementId: 'a', reason: 'needs warehouse', kind: 'hard' }],
      knownElementIds: new Set(['a', 'b']),
    });
    expect(issues).toEqual([]);
  });
});

describe('portfolioValueStaircase — helpers + prompt', () => {
  it('detects quantified claims and prerequisites (PL + EN)', () => {
    expect(textMakesQuantifiedClaim('save 30%')).toBe(true);
    expect(textMakesQuantifiedClaim('€1.2M upside')).toBe(true);
    expect(textMakesQuantifiedClaim('improves things')).toBe(false);
    expect(mentionsPrerequisite('after the migration')).toBe(true);
    expect(mentionsPrerequisite('wymaga hurtowni danych')).toBe(true);
    expect(mentionsPrerequisite('standalone effort')).toBe(false);
  });

  it('emits bilingual prompt rules mentioning source enforcement and dependencies', () => {
    expect(buildPortfolioStaircasePromptRules('pl')).toMatch(/źródł|zależno/i);
    expect(buildPortfolioStaircasePromptRules('en')).toMatch(/source|depend/i);
  });
});
