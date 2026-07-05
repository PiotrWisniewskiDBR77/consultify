import { describe, expect, it } from 'vitest';

import {
  ANSOFF_DEEPENING_LADDER,
  ANSOFF_LADDER_RUNG_ORDER,
  ANSOFF_PROPOSAL_BANK,
  ANSOFF_QUADRANTS,
  buildAnsoffConclusionPrompt,
  buildW2MoveSequence,
  localizeLadder,
  rankGrowthPaths,
  synthesizeGrowthPaths,
  toGrowthMove,
  validateW2Move,
} from '../../src/config/ansoff';
import type {
  GrowthPathItem,
  GrowthPathsData,
  GrowthQuadrantId,
} from '../../src/store/useToolStore';

const opt = (
  id: string,
  overrides: Partial<GrowthPathItem> = {}
): GrowthPathItem => ({
  id,
  title: `Option ${id}`,
  description: 'desc',
  impact: 'medium',
  effort: 'medium',
  riskLevel: 'medium',
  evidence: [],
  ...overrides,
});

const buildData = (
  quadrants: Partial<Record<GrowthQuadrantId, GrowthPathItem[]>>,
  goal = 'Define next growth direction'
): GrowthPathsData =>
  ({
    context: { goal, scope: 'company', timeframe: 'medium', successSignal: 'agreed path' },
    signals: [],
    quadrants: {
      marketPenetration: quadrants.marketPenetration || [],
      marketDevelopment: quadrants.marketDevelopment || [],
      productDevelopment: quadrants.productDevelopment || [],
      diversification: quadrants.diversification || [],
    },
    comparisons: [],
    recommendedMoves: [],
    outputCandidates: [],
  }) as GrowthPathsData;

describe('Ansoff config — structure', () => {
  it('defines all four quadrants with a full 4-rung deepening ladder in canonical order', () => {
    expect(ANSOFF_QUADRANTS).toHaveLength(4);
    expect(ANSOFF_LADDER_RUNG_ORDER).toEqual([
      'surface',
      'evidence',
      'quantification',
      'risk-capability',
    ]);

    ANSOFF_QUADRANTS.forEach((quadrant) => {
      const rungs = ANSOFF_DEEPENING_LADDER[quadrant];
      expect(rungs).toHaveLength(4);
      // depths are 1..4, distinct, ascending by canonical order
      expect(rungs.map((r) => r.id).sort()).toEqual(
        [...ANSOFF_LADDER_RUNG_ORDER].sort()
      );
      rungs.forEach((rung) => {
        expect(rung.label.pl.trim().length).toBeGreaterThan(0);
        expect(rung.label.en.trim().length).toBeGreaterThan(0);
        expect(rung.question.pl.trim().length).toBeGreaterThan(0);
        expect(rung.question.en.trim().length).toBeGreaterThan(0);
        expect(rung.rationale.pl.trim().length).toBeGreaterThan(0);
        expect(rung.rationale.en.trim().length).toBeGreaterThan(0);
      });
    });
  });

  it('has a partner-grade bilingual proposal bank for every quadrant', () => {
    ANSOFF_QUADRANTS.forEach((quadrant) => {
      const bank = ANSOFF_PROPOSAL_BANK[quadrant];
      expect(bank.length).toBeGreaterThanOrEqual(4);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(ANSOFF_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('marketPenetration', true);
    const en = localizeLadder('marketPenetration', false);
    expect(pl.map((r) => r.id)).toEqual(ANSOFF_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(ANSOFF_LADDER_RUNG_ORDER);
    expect(pl[0].label).not.toEqual(en[0].label);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('Ansoff engine — scoring & ranking', () => {
  it('ranks empty session with no ordered paths and a helpful rationale', () => {
    const ranking = rankGrowthPaths(buildData({}));
    expect(ranking.ordered).toHaveLength(0);
    expect(ranking.rationale.en).toContain('No accepted growth options');
  });

  it('ranks high-impact low-effort evidence-backed penetration above risky diversification', () => {
    const data = buildData({
      marketPenetration: [
        opt('p1', { impact: 'high', effort: 'low', riskLevel: 'low', evidence: ['share data'] }),
        opt('p2', { impact: 'high', effort: 'low', riskLevel: 'low', evidence: ['pipeline'] }),
      ],
      diversification: [
        opt('d1', { impact: 'medium', effort: 'high', riskLevel: 'high' }),
      ],
    });
    const ranking = rankGrowthPaths(data);
    expect(ranking.ordered[0]).toBe('marketPenetration');
    expect(ranking.ordered[ranking.ordered.length - 1]).toBe('diversification');

    const pen = ranking.scores.find((s) => s.quadrant === 'marketPenetration')!;
    const div = ranking.scores.find((s) => s.quadrant === 'diversification')!;
    expect(pen.score).toBeGreaterThan(div.score);
    expect(pen.risk).toBeLessThan(div.risk);
    expect(pen.attractiveness).toBeGreaterThanOrEqual(div.attractiveness);
  });

  it('excludes empty quadrants from ordering but reports them with score 0', () => {
    const data = buildData({ marketDevelopment: [opt('m1', { impact: 'high' })] });
    const ranking = rankGrowthPaths(data);
    expect(ranking.ordered).toEqual(['marketDevelopment']);
    const emptyOnes = ranking.scores.filter((s) => s.optionCount === 0);
    expect(emptyOnes).toHaveLength(3);
    emptyOnes.forEach((s) => expect(s.score).toBe(0));
  });
});

describe('Ansoff engine — W2 move validator', () => {
  it('validates that a move must carry rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).valid).toBe(false);
    expect(validateW2Move({}).missing).toEqual([
      'rationale',
      'tradeOff',
      'rejectedVariant',
    ]);

    const partial = validateW2Move({ rationale: 'This is a solid enough rationale' });
    expect(partial.valid).toBe(false);
    expect(partial.missing).toEqual(['tradeOff', 'rejectedVariant']);

    const thin = validateW2Move({
      rationale: 'ok',
      tradeOff: 'ok',
      rejectedVariant: 'ok',
    });
    expect(thin.valid).toBe(false);
    expect(thin.weak).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);

    const full = validateW2Move({
      rationale: 'Lead with penetration because it is fastest to return',
      tradeOff: 'At the cost of pace on other paths this cycle',
      rejectedVariant: 'We reject growing everywhere a little at once',
    });
    expect(full.valid).toBe(true);
    expect(full.missing).toHaveLength(0);
    expect(full.weak).toHaveLength(0);
  });

  it('every synthesized move passes its own W2 validation', () => {
    const data = buildData({
      marketPenetration: [opt('p1', { impact: 'high', effort: 'low', evidence: ['x'] })],
      diversification: [opt('d1', { impact: 'low', effort: 'high', riskLevel: 'high' })],
    });
    const sequence = buildW2MoveSequence(data);
    expect(sequence.length).toBeGreaterThan(0);
    sequence.forEach((move) => {
      expect(move.validation.valid).toBe(true);
      // structural W2: all three justification fields non-empty in both languages
      expect(move.rationale.pl.trim()).not.toEqual('');
      expect(move.tradeOff.en.trim()).not.toEqual('');
      expect(move.rejectedVariant.pl.trim()).not.toEqual('');
      const revalidated = validateW2Move({
        rationale: move.rationale.en,
        tradeOff: move.tradeOff.en,
        rejectedVariant: move.rejectedVariant.en,
      });
      expect(revalidated.valid).toBe(true);
    });
  });

  it('leads with the strongest path and explicitly defers the weakest/riskiest', () => {
    const data = buildData({
      marketPenetration: [
        opt('p1', { impact: 'high', effort: 'low', riskLevel: 'low', evidence: ['a'] }),
        opt('p2', { impact: 'high', effort: 'low', riskLevel: 'low', evidence: ['b'] }),
      ],
      diversification: [opt('d1', { impact: 'low', effort: 'high', riskLevel: 'high' })],
    });
    const sequence = buildW2MoveSequence(data);
    const lead = sequence[0];
    expect(lead.order).toBe(1);
    expect(lead.quadrant).toBe('marketPenetration');

    const defer = sequence.find((m) => m.title.en.startsWith('Defer'));
    expect(defer).toBeTruthy();
    expect(defer!.quadrant).toBe('diversification');
    expect(defer!.riskLevel).toBe('high');
  });

  it('inserts a validate-first move when the primary path lacks evidence', () => {
    const data = buildData({
      marketPenetration: [
        opt('p1', { impact: 'high', effort: 'low', evidence: [] }),
        opt('p2', { impact: 'high', effort: 'low', evidence: [] }),
      ],
    });
    const sequence = buildW2MoveSequence(data);
    expect(sequence.some((m) => m.category === 'validate-first')).toBe(true);
  });

  it('does NOT insert validate-first when the primary path is well-evidenced', () => {
    const data = buildData({
      marketPenetration: [
        opt('p1', { impact: 'high', effort: 'low', evidence: ['a'] }),
        opt('p2', { impact: 'high', effort: 'low', evidence: ['b'] }),
      ],
    });
    const sequence = buildW2MoveSequence(data);
    // single well-evidenced path => only the lead move
    expect(sequence.filter((m) => m.category === 'validate-first')).toHaveLength(0);
  });
});

describe('Ansoff engine — bridges', () => {
  it('toGrowthMove folds trade-off and rejected variant into the store rationale field', () => {
    const [move] = buildW2MoveSequence(
      buildData({ marketPenetration: [opt('p1', { impact: 'high', effort: 'low', evidence: ['a'] })] })
    );
    const growthMove = toGrowthMove(move, false, 'move-1');
    expect(growthMove.id).toBe('move-1');
    expect(growthMove.linkedQuadrants).toEqual(['marketPenetration']);
    expect(growthMove.rationale).toContain(move.rationale.en);
    expect(growthMove.rationale).toContain(move.tradeOff.en);
    expect(growthMove.rationale).toContain(move.rejectedVariant.en);
    expect(growthMove.proposalStatus).toBe('ai-proposed');
  });

  it('buildAnsoffConclusionPrompt returns null for empty session and a grounded prompt otherwise', () => {
    expect(buildAnsoffConclusionPrompt(buildData({}), false)).toBeNull();

    const prompt = buildAnsoffConclusionPrompt(
      buildData({
        marketPenetration: [opt('p1', { impact: 'high', effort: 'low', evidence: ['a'] })],
        diversification: [opt('d1', { impact: 'low', effort: 'high', riskLevel: 'high' })],
      }),
      false
    )!;
    expect(prompt).toContain('SCORED PATHS');
    expect(prompt).toContain('W2 MOVE SEQUENCE');
    expect(prompt).toContain('rejected variant');
    // the JSON contract must expose the W2 fields
    expect(prompt).toContain('"tradeOff"');
    expect(prompt).toContain('"rejectedVariant"');
  });

  it('synthesizeGrowthPaths returns a consistent ranking + sequence', () => {
    const data = buildData({
      marketPenetration: [opt('p1', { impact: 'high', effort: 'low', evidence: ['a'] })],
      marketDevelopment: [opt('m1', { impact: 'medium', effort: 'medium' })],
    });
    const { ranking, sequence } = synthesizeGrowthPaths(data);
    expect(ranking.ordered[0]).toBe(sequence[0].quadrant);
  });
});
