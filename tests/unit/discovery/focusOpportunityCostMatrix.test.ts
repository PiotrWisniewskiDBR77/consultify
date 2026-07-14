import { describe, expect, it } from 'vitest';

import {
  buildAntiFocusPromptRules,
  buildOpportunityCostMatrix,
  buildOpportunityCostPromptBlock,
  detectAntiFocus,
} from '../../../src/config/focustradeoffs/focusOpportunityCostMatrix';
import type { FocusPriority, FocusTradeoffData } from '../../../src/store/useToolStore';

const prio = (
  id: string,
  recommendation: FocusPriority['recommendation'],
  overrides: Partial<FocusPriority> = {}
): FocusPriority => ({
  id,
  title: `Priority ${id}`,
  description: 'desc',
  valueScore: 3,
  effortScore: 3,
  strategicFit: 3,
  recommendation,
  drivers: [],
  evidence: [],
  ...overrides,
});

const buildData = (priorities: FocusPriority[]): FocusTradeoffData =>
  ({
    context: {
      competingPriorities: 'many',
      decisionCriteria: 'value/effort/fit',
      goal: 'Choose focus',
      scope: 'company',
      timeframe: 'medium',
      successSignal: 'agreed focus',
    },
    signals: [],
    priorities,
    tradeoffs: [],
    recommendedMoves: [],
    outputCandidates: [],
  }) as FocusTradeoffData;

describe('Focus & Trade-offs opportunity-cost matrix', () => {
  it('returns an empty matrix for a session with no priorities', () => {
    expect(buildOpportunityCostMatrix(buildData([]))).toEqual([]);
  });

  it('pairs a single priority with no opportunity cost (nothing to compare against yet)', () => {
    const matrix = buildOpportunityCostMatrix(buildData([prio('a', 'pursue')]));
    expect(matrix).toHaveLength(1);
    expect(matrix[0].opportunityCostId).toBeUndefined();
    expect(matrix[0].magnitude).toBe('low');
  });

  it('pairs the top priority against the runner-up and computes a magnitude from the score gap', () => {
    const data = buildData([
      prio('a', 'pursue', { valueScore: 5, strategicFit: 5, effortScore: 1, evidence: ['x'] }),
      prio('b', 'drop', { valueScore: 1, strategicFit: 1, effortScore: 5 }),
    ]);
    const matrix = buildOpportunityCostMatrix(data);
    expect(matrix).toHaveLength(2);
    const top = matrix.find((r) => r.priorityId === 'a')!;
    expect(top.opportunityCostId).toBe('b');
    expect(top.magnitude).toBe('high');
    expect(top.narrative.en).toContain('Priority b');
  });

  it('excludes rejected priorities from the matrix', () => {
    const data = buildData([
      prio('a', 'pursue', { valueScore: 5, strategicFit: 5, effortScore: 1 }),
      prio('b', 'pursue', { proposalStatus: 'rejected' }),
    ]);
    const matrix = buildOpportunityCostMatrix(data);
    expect(matrix.map((r) => r.priorityId)).toEqual(['a']);
  });

  it('buildOpportunityCostPromptBlock renders a placeholder for an empty session and rows otherwise', () => {
    expect(buildOpportunityCostPromptBlock(buildData([]), false)).toContain('empty');
    expect(buildOpportunityCostPromptBlock(buildData([]), true)).toContain('pusta');

    const block = buildOpportunityCostPromptBlock(
      buildData([
        prio('a', 'pursue', { valueScore: 5, strategicFit: 5, effortScore: 1 }),
        prio('b', 'drop', { valueScore: 1, strategicFit: 1, effortScore: 5 }),
      ]),
      false
    );
    expect(block).toContain('[a]');
    expect(block).toContain('opportunity cost');
  });
});

describe('Focus & Trade-offs anti-focus detector', () => {
  it('does not flag an empty session', () => {
    const verdict = detectAntiFocus(buildData([]));
    expect(verdict.flagged).toBe(false);
    expect(verdict.reason).toBe('no-priorities');
  });

  it('does not flag a single-priority session (no rejection pattern possible yet)', () => {
    const verdict = detectAntiFocus(buildData([prio('a', 'pursue')]));
    expect(verdict.flagged).toBe(false);
    expect(verdict.totalCount).toBe(1);
  });

  it('flags "nothing-rejected" when every active priority is pursue and none is deferred or dropped', () => {
    const verdict = detectAntiFocus(
      buildData([prio('a', 'pursue'), prio('b', 'pursue'), prio('c', 'pursue')])
    );
    expect(verdict.flagged).toBe(true);
    expect(verdict.reason).toBe('nothing-rejected');
    expect(verdict.pursueCount).toBe(3);
    expect(verdict.dropCount).toBe(0);
    expect(verdict.message.en).toContain('No-strategy flag');
    expect(verdict.message.pl).toContain('braku strategii');
  });

  it('flags "everything-pursue" when the pursue ratio is >= 80% and nothing was ever dropped', () => {
    const verdict = detectAntiFocus(
      buildData([
        prio('a', 'pursue'),
        prio('b', 'pursue'),
        prio('c', 'pursue'),
        prio('d', 'pursue'),
        prio('e', 'defer'),
      ])
    );
    expect(verdict.flagged).toBe(true);
    expect(verdict.reason).toBe('everything-pursue');
    expect(verdict.pursueRatio).toBeCloseTo(0.8);
  });

  it('does NOT flag a session with a real cut and a healthy pursue ratio', () => {
    const verdict = detectAntiFocus(
      buildData([prio('a', 'pursue'), prio('b', 'defer'), prio('c', 'drop')])
    );
    expect(verdict.flagged).toBe(false);
    expect(verdict.message.en).toContain('Focus demonstrated');
  });

  it('excludes rejected/rethinking priorities from the anti-focus count', () => {
    const verdict = detectAntiFocus(
      buildData([
        prio('a', 'pursue'),
        prio('b', 'pursue'),
        prio('c', 'drop', { proposalStatus: 'rejected' }),
      ])
    );
    // Only 'a' and 'b' are active — both pursue, none rejected/deferred among active set.
    expect(verdict.totalCount).toBe(2);
    expect(verdict.flagged).toBe(true);
  });

  it('buildAntiFocusPromptRules returns distinct, non-empty PL/EN guidance mentioning the anti-focus gate', () => {
    const en = buildAntiFocusPromptRules('en');
    const pl = buildAntiFocusPromptRules('pl');
    expect(en).toContain('ANTI-FOCUS');
    expect(pl).toContain('ANTY-FOKUS');
    expect(en).not.toEqual(pl);
  });
});
