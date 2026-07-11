import { describe, expect, it } from 'vitest';

import { pickWeakestRung } from '../../src/hooks/discovery/toolAi/pickWeakestRung';
import { getToolSuggestionPrompt } from '../../src/hooks/discovery/toolAi/promptRegistry';
import type { OperationalItem } from '../../src/store/useToolStore';

/**
 * Dynamic deepening-ladder rung selection (feat/ladder-dynamic-rung).
 *
 * Context: promptRegistry.ts's 9 ladder overrides used to call
 * build<Tool>DeepenPrompt(sectionId, 'evidence'/'quantification', false) with
 * the rung PINNED regardless of session progress. pickWeakestRung derives the
 * next rung from the tool's own assess*() readiness score
 * (src/config/<tool>/moveValidator.ts::assessA3/assessSop), and is wired into
 * the A3 and SOP overrides — the two tools whose assess* exposes a compatible
 * per-section { itemCount, evidence|measurableRatio } shape.
 */
describe('pickWeakestRung (pure helper)', () => {
  it('targets "surface" when the section has no items yet', () => {
    expect(pickWeakestRung({ itemCount: 0, coverageRatio: 0 })).toBe('surface');
  });

  it('targets "evidence" when most items lack a measurable anchor', () => {
    expect(pickWeakestRung({ itemCount: 4, coverageRatio: 0.25 })).toBe('evidence');
  });

  it('targets "quantification" when evidence coverage is OK but not complete', () => {
    expect(pickWeakestRung({ itemCount: 3, coverageRatio: 2 / 3 })).toBe('quantification');
  });

  it('targets "risk-capability" once every item carries a measurable anchor', () => {
    expect(pickWeakestRung({ itemCount: 3, coverageRatio: 1 })).toBe('risk-capability');
  });

  it('falls back to the caller-provided default when no coverage data is available', () => {
    expect(pickWeakestRung(undefined, 'quantification')).toBe('quantification');
    expect(pickWeakestRung(undefined)).toBe('evidence');
  });
});

const unevidencedItem = (id: string): OperationalItem => ({
  id,
  title: `Item ${id}`,
  description: 'no measurable anchor set',
  impact: 'high',
  effort: 'medium',
});

const evidencedItem = (id: string): OperationalItem => ({
  id,
  title: `Item ${id}`,
  description: 'has a measurable anchor',
  impact: 'high',
  effort: 'medium',
  target: '95% on-time',
});

describe('promptRegistry: A3 deepen-ladder targets the weakest rung dynamically', () => {
  it('targets the evidence rung when the "problem" section has no measurable items', () => {
    const inputData = {
      context: { goal: 'Reduce cycle time', scope: 'Plant A' },
      sections: { problem: [unevidencedItem('p1'), unevidencedItem('p2')] },
    };
    const prompt = getToolSuggestionPrompt('a3-problem-solving', 'problem', inputData);
    // A3 "problem" section, evidence rung (EN) — src/config/a3problemsolving/deepeningLadder.ts
    expect(prompt).toContain('not just a team impression');
    expect(prompt).not.toContain('in numbers (frequency');
  });

  it('targets the quantification rung when the "problem" section is mostly evidenced but not complete', () => {
    const inputData = {
      context: { goal: 'Reduce cycle time', scope: 'Plant A' },
      sections: {
        problem: [evidencedItem('p1'), evidencedItem('p2'), unevidencedItem('p3')],
      },
    };
    const prompt = getToolSuggestionPrompt('a3-problem-solving', 'problem', inputData);
    // A3 "problem" section, quantification rung (EN)
    expect(prompt).toContain('in numbers (frequency');
    expect(prompt).not.toContain('not just a team impression');
  });

  it('targets the surface rung when the section is empty (nothing to evidence yet)', () => {
    const inputData = { context: { goal: 'Reduce cycle time', scope: 'Plant A' }, sections: {} };
    const prompt = getToolSuggestionPrompt('a3-problem-solving', 'problem', inputData);
    // A3 "problem" section, surface rung (EN)
    expect(prompt).toContain('in observable terms, not feelings');
  });
});

describe('promptRegistry: SOP deepen-ladder targets the weakest rung dynamically', () => {
  it('targets the evidence rung when "standards" has no measurable items', () => {
    const inputData = {
      context: { goal: 'Standardize onboarding', scope: 'Ops team' },
      sections: { standards: [unevidencedItem('s1'), unevidencedItem('s2')] },
    };
    const prompt = getToolSuggestionPrompt('sop-builder', 'standards', inputData);
    // SOP "standards" section, evidence rung (EN) — src/config/sopbuilder/deepeningLadder.ts
    expect(prompt).toContain('what is the evidence from practice');
    expect(prompt).not.toContain('judged "by eye"');
  });

  it('targets the quantification rung when "standards" is mostly evidenced but not complete', () => {
    const inputData = {
      context: { goal: 'Standardize onboarding', scope: 'Ops team' },
      sections: {
        standards: [evidencedItem('s1'), evidencedItem('s2'), unevidencedItem('s3')],
      },
    };
    const prompt = getToolSuggestionPrompt('sop-builder', 'standards', inputData);
    // SOP "standards" section, quantification rung (EN)
    expect(prompt).toContain('judged "by eye"');
    expect(prompt).not.toContain('what is the evidence from practice');
  });
});
