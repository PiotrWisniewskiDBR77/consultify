import { describe, expect, it } from 'vitest';

import {
  AXIS_MIDPOINT,
  classifyPortfolio,
  classifyQuadrant,
  groupByQuadrant,
  isAcceptedElement,
  QUADRANT_META,
  sequencePortfolio,
  validatePortfolioMove,
  validatePortfolioMoveSet,
  type PortfolioElement,
} from '@/config/portfolio/portfolioMatrixEngine';

const el = (
  id: string,
  valueScore: number,
  feasibilityScore: number,
  extra: Partial<PortfolioElement> = {}
): PortfolioElement => ({
  id,
  title: id,
  valueScore,
  feasibilityScore,
  proposalStatus: 'accepted',
  ...extra,
});

describe('portfolioMatrixEngine — 2x2 classification', () => {
  it('maps value x feasibility onto quick-win / big-bet / fill-in / money-pit', () => {
    expect(classifyQuadrant(5, 5)).toBe('quick-win');
    expect(classifyQuadrant(5, 1)).toBe('big-bet');
    expect(classifyQuadrant(1, 5)).toBe('fill-in');
    expect(classifyQuadrant(1, 1)).toBe('money-pit');
  });

  it('uses the midpoint as the high/low split (inclusive high)', () => {
    expect(classifyQuadrant(AXIS_MIDPOINT, AXIS_MIDPOINT)).toBe('quick-win');
    expect(classifyQuadrant(AXIS_MIDPOINT - 1, AXIS_MIDPOINT - 1)).toBe('money-pit');
  });

  it('classifies only ACCEPTED elements and groups them', () => {
    const dist = groupByQuadrant(
      classifyPortfolio([
        el('a', 5, 5),
        el('b', 5, 1),
        el('ghost', 5, 5, { proposalStatus: 'ai-proposed' }),
      ])
    );
    expect(dist['quick-win'].map((e) => e.id)).toEqual(['a']);
    expect(dist['big-bet'].map((e) => e.id)).toEqual(['b']);
    // ai-proposed excluded from every bucket
    expect([...Object.values(dist)].flat().some((e) => e.id === 'ghost')).toBe(false);
  });

  it('acceptance filter: legacy user items count, rejected/proposed do not', () => {
    expect(isAcceptedElement({ proposalStatus: 'accepted' })).toBe(true);
    expect(isAcceptedElement({ proposalStatus: 'ai-proposed' })).toBe(false);
    expect(isAcceptedElement({ status: 'accepted' })).toBe(true);
    expect(isAcceptedElement({})).toBe(true);
    expect(isAcceptedElement({ status: 'proposed' })).toBe(false);
  });

  it('exposes stance metadata for all four quadrants', () => {
    (['quick-win', 'big-bet', 'fill-in', 'money-pit'] as const).forEach((q) => {
      expect(QUADRANT_META[q].titleEn).toBeTruthy();
      expect(QUADRANT_META[q].titlePl).toBeTruthy();
    });
  });
});

describe('portfolioMatrixEngine — dependency-aware, budget-capped sequencing', () => {
  it('orders a hard dependency before the element that needs it', () => {
    const seq = sequencePortfolio([
      el('B', 5, 4, { dependencies: [{ dependsOnElementId: 'A', reason: 'needs A', kind: 'hard' }] }),
      el('A', 4, 5),
    ]);
    const order = seq.funded.map((f) => f.elementId);
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
    expect(seq.funded.find((f) => f.elementId === 'B')?.unlockedBy).toEqual(['A']);
  });

  it('among ready elements prefers higher value, then quadrant priority', () => {
    const seq = sequencePortfolio([el('low', 3, 5), el('high', 5, 5)]);
    expect(seq.funded[0].elementId).toBe('high');
  });

  it('stops funding at the budget cap and DEFERS the rest with a reason', () => {
    const seq = sequencePortfolio(
      [el('a', 5, 5, { cost: 2 }), el('b', 4, 5, { cost: 2 }), el('c', 3, 5, { cost: 2 })],
      { budgetCap: 3 }
    );
    expect(seq.funded.map((f) => f.elementId)).toEqual(['a']); // 2 fits, 4 would exceed 3
    expect(seq.deferred.map((d) => d.elementId)).toEqual(expect.arrayContaining(['b', 'c']));
    expect(seq.deferred[0].reason).toMatch(/budget cap/i);
  });

  it('does not auto-fund money-pits (default stance = stop)', () => {
    const seq = sequencePortfolio([el('pit', 1, 1), el('win', 5, 5)]);
    expect(seq.funded.map((f) => f.elementId)).toEqual(['win']);
    expect(seq.funded.some((f) => f.elementId === 'pit')).toBe(false);
  });

  it('reports elements blocked by an unfunded hard dependency', () => {
    // A is a money-pit (never funded) => B, which hard-depends on A, is blocked.
    const seq = sequencePortfolio([
      el('A', 1, 1),
      el('B', 5, 5, { dependencies: [{ dependsOnElementId: 'A', reason: 'x', kind: 'hard' }] }),
    ]);
    expect(seq.blocked.map((b) => b.elementId)).toContain('B');
  });

  it('detects a circular hard-dependency chain instead of hanging', () => {
    const seq = sequencePortfolio([
      el('A', 5, 5, { dependencies: [{ dependsOnElementId: 'B', reason: 'x', kind: 'hard' }] }),
      el('B', 5, 5, { dependencies: [{ dependsOnElementId: 'A', reason: 'x', kind: 'hard' }] }),
    ]);
    expect(seq.cycles.length).toBeGreaterThan(0);
    expect(seq.funded).toHaveLength(0);
  });

  it('soft dependencies do not block or reorder funding', () => {
    const seq = sequencePortfolio([
      el('B', 5, 5, { dependencies: [{ dependsOnElementId: 'A', reason: 'nice', kind: 'soft' }] }),
      el('A', 1, 1), // money-pit, unfunded — but dep is soft
    ]);
    expect(seq.funded.map((f) => f.elementId)).toContain('B');
    expect(seq.blocked.some((b) => b.elementId === 'B')).toBe(false);
  });
});

describe('portfolioMatrixEngine — W2 move validation (trade-off mandatory)', () => {
  const session = { elementIds: new Set(['a', 'b']) };
  const validMove = {
    rationale: 'Fund quick-wins a,b first to self-fund the big bet (a, b).',
    linkedItemIds: ['a', 'b'],
    tradeoff: {
      chosen: 'Fund a and b this quarter',
      deferred: 'the big bet c to next quarter',
      cost: 'one quarter of delayed strategic upside',
    },
    rejectedAlternative: {
      option: 'Fund everything at once',
      reason: 'dilutes resources across too many fronts, finishing none',
    },
  };

  it('accepts a fully-formed move', () => {
    expect(validatePortfolioMove(validMove, session)).toEqual([]);
  });

  it('rejects a move without a trade-off', () => {
    const issues = validatePortfolioMove({ ...validMove, tradeoff: undefined }, session);
    expect(issues.map((i) => i.code)).toContain('missing-tradeoff');
  });

  it('rejects an incomplete trade-off', () => {
    const issues = validatePortfolioMove(
      { ...validMove, tradeoff: { chosen: 'x', deferred: '', cost: '' } },
      session
    );
    expect(issues.map((i) => i.code)).toContain('incomplete-tradeoff');
  });

  it('rejects a missing rejected alternative (the "everything at once" variant)', () => {
    const issues = validatePortfolioMove({ ...validMove, rejectedAlternative: undefined }, session);
    expect(issues.map((i) => i.code)).toContain('missing-rejected-alternative');
  });

  it('rejects unlinked and dangling rationale', () => {
    expect(
      validatePortfolioMove({ ...validMove, linkedItemIds: [] }, session).map((i) => i.code)
    ).toContain('unlinked-rationale');
    expect(
      validatePortfolioMove({ ...validMove, linkedItemIds: ['ghost'] }, session).map((i) => i.code)
    ).toContain('dangling-links');
  });

  it('validatePortfolioMoveSet skips rejected moves and aggregates issues', () => {
    const verdict = validatePortfolioMoveSet(
      [
        { ...validMove, title: 'Good' },
        { ...validMove, title: 'Skipped', tradeoff: undefined, proposalStatus: 'rejected' },
        { ...validMove, title: 'Bad', tradeoff: undefined },
      ],
      [{ id: 'a' }, { id: 'b' }]
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.perMove).toHaveLength(2);
    expect(verdict.perMove.find((m) => m.title === 'Good')?.issues).toEqual([]);
    expect(verdict.perMove.find((m) => m.title === 'Bad')?.issues.map((i) => i.code)).toContain(
      'missing-tradeoff'
    );
  });
});
