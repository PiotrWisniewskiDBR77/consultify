import { describe, expect, it } from 'vitest';

import {
  buildPorterMoveConclusionPromptRules,
  intensityFromScore,
  mapIndustryProfitability,
  synthesizeAllForces,
  synthesizeForceIntensity,
  validatePorterMove,
  validatePorterMoveSet,
} from '@/config/porter/porterSynthesisEngine';
import type { PorterForceId } from '@/store/useToolStore';

describe('porterSynthesisEngine — deterministic intensity from ladder answers', () => {
  it('rates rivalry HIGH when the answers accumulate positive deltas, with traceable reasons', () => {
    const verdict = synthesizeForceIntensity('rivalry', [
      { questionId: 'riv1-surface', answerKey: 'price-war' }, // +1
      { questionId: 'riv2-concentration', answerKey: 'fragmented-overcapacity' }, // +1
      { questionId: 'riv3-quantify', answerKey: 'quantified-tight' }, // +1
      { questionId: 'riv4-trend', answerKey: 'intensifying' }, // +1
    ]);
    expect(verdict.intensity).toBe('high');
    expect(verdict.score).toBe(4);
    expect(verdict.reasonKeys).toEqual(
      expect.arrayContaining(['price-war', 'fragmented-overcapacity', 'quantified-tight', 'intensifying'])
    );
    expect(verdict.provisional).toBe(false);
  });

  it('rates a force LOW when negative deltas dominate', () => {
    const verdict = synthesizeForceIntensity('newEntrants', [
      { questionId: 'ent1-surface', answerKey: 'no-plausible-entrant' }, // -1
      { questionId: 'ent2-barriers', answerKey: 'hard-barriers' }, // -1
      { questionId: 'ent3-quantify', answerKey: 'high-cost' }, // -1
      { questionId: 'ent4-trend', answerKey: 'rising-barrier' }, // -1
    ]);
    expect(verdict.intensity).toBe('low');
    expect(verdict.score).toBe(-4);
    // reasons cite only the answers pushing toward the winning (low) direction
    expect(verdict.reasonKeys).toEqual(
      expect.arrayContaining(['no-plausible-entrant', 'hard-barriers', 'high-cost', 'rising-barrier'])
    );
  });

  it('rates MEDIUM and marks provisional when the ladder is unanswered / all neutral', () => {
    const empty = synthesizeForceIntensity('substitutes', []);
    expect(empty.intensity).toBe('medium');
    expect(empty.provisional).toBe(true);

    const neutral = synthesizeForceIntensity('substitutes', [
      { questionId: 'sub3-quantify', answerKey: 'no-number' }, // 0
    ]);
    expect(neutral.intensity).toBe('medium');
    expect(neutral.provisional).toBe(true);
  });

  it('ignores unknown question/answer keys without crashing', () => {
    const verdict = synthesizeForceIntensity('rivalry', [
      { questionId: 'ghost', answerKey: 'nope' },
      { questionId: 'riv1-surface', answerKey: 'price-war' }, // +1
    ]);
    expect(verdict.score).toBe(1);
    expect(verdict.intensity).toBe('high');
  });

  it('score-based fallback maps 1-5 sliders to intensity bands', () => {
    expect(intensityFromScore(5)).toBe('high');
    expect(intensityFromScore(4)).toBe('high');
    expect(intensityFromScore(3)).toBe('medium');
    expect(intensityFromScore(2)).toBe('low');
    expect(intensityFromScore(1)).toBe('low');
  });
});

describe('porterSynthesisEngine — industry profitability map', () => {
  const highAnswers = (force: PorterForceId, q: string) => ({ questionId: q, answerKey: 'x' });

  it('names structurally-unattractive when high forces dominate', () => {
    const verdicts = synthesizeAllForces({
      rivalry: [{ questionId: 'riv1-surface', answerKey: 'price-war' }, { questionId: 'riv3-quantify', answerKey: 'quantified-tight' }],
      buyerPower: [{ questionId: 'buy1-surface', answerKey: 'concentrated-buyers' }, { questionId: 'buy2-switching', answerKey: 'low-switching' }],
      supplierPower: [{ questionId: 'sup1-surface', answerKey: 'few-suppliers' }, { questionId: 'sup2-switching', answerKey: 'locked-or-forward' }],
      substitutes: [{ questionId: 'sub1-surface', answerKey: 'weak-substitute' }],
      newEntrants: [{ questionId: 'ent1-surface', answerKey: 'no-plausible-entrant' }],
    });
    const map = mapIndustryProfitability(verdicts);
    expect(map.attractiveness).toBe('structurally-unattractive');
    expect(map.pressureScore).toBeGreaterThanOrEqual(6);
    expect(map.dominantForces).toEqual(
      expect.arrayContaining(['rivalry', 'buyerPower', 'supplierPower'])
    );
    expect(map.verdictPl).toContain('presja');
  });

  it('names structurally-attractive when forces are broadly low', () => {
    const verdicts = synthesizeAllForces({
      rivalry: [{ questionId: 'riv2-concentration', answerKey: 'concentrated-disciplined' }],
      buyerPower: [{ questionId: 'buy1-surface', answerKey: 'fragmented-buyers' }],
      supplierPower: [{ questionId: 'sup1-surface', answerKey: 'many-suppliers' }],
      substitutes: [{ questionId: 'sub1-surface', answerKey: 'weak-substitute' }],
      newEntrants: [{ questionId: 'ent1-surface', answerKey: 'no-plausible-entrant' }],
    });
    const map = mapIndustryProfitability(verdicts);
    expect(map.attractiveness).toBe('structurally-attractive');
    expect(map.favorableForces.length).toBeGreaterThanOrEqual(4);
  });
});

describe('porterSynthesisEngine — W2 strategic-response validation (trade-off mandatory)', () => {
  const session = { forceIds: new Set(['buyerPower', 'rivalry']), implicationIds: new Set(['impl-1']) };

  const validMove = {
    rationale: 'Buyer power is high (top 3 = 58% of revenue, low switching) — lock-in beats price war (buyerPower, impl-1).',
    linkedForceIds: ['buyerPower'] as PorterForceId[],
    linkedImplicationIds: ['impl-1'],
    tradeoff: {
      chosen: 'Raise switching costs via deeper integration',
      deferred: 'Aggressive new-logo discounting',
      cost: 'lower short-term margin on integration build-out',
    },
    rejectedAlternative: {
      option: 'Match the cheapest rival on price',
      reason: 'a price war in a fragmented market destroys margin for everyone',
    },
  };

  it('accepts a response with rationale, valid links, complete trade-off and a rejected alternative', () => {
    expect(validatePorterMove(validMove, session)).toEqual([]);
  });

  it('rejects a response without a trade-off', () => {
    const issues = validatePorterMove({ ...validMove, tradeoff: undefined }, session);
    expect(issues.map((i) => i.code)).toContain('missing-tradeoff');
  });

  it('rejects an incomplete trade-off (all three parts required)', () => {
    const issues = validatePorterMove(
      { ...validMove, tradeoff: { chosen: 'X', deferred: '', cost: '' } },
      session
    );
    expect(issues.map((i) => i.code)).toContain('incomplete-tradeoff');
  });

  it('rejects a response without a rejected alternative with reason', () => {
    const noAlt = validatePorterMove({ ...validMove, rejectedAlternative: undefined }, session);
    expect(noAlt.map((i) => i.code)).toContain('missing-rejected-alternative');
  });

  it('rejects untraceable rationale (no links) and dangling links', () => {
    const unlinked = validatePorterMove(
      { ...validMove, linkedForceIds: [], linkedImplicationIds: [] },
      session
    );
    expect(unlinked.map((i) => i.code)).toContain('unlinked-rationale');

    const dangling = validatePorterMove(
      { ...validMove, linkedImplicationIds: ['ghost-impl'] },
      session
    );
    expect(dangling.map((i) => i.code)).toContain('dangling-links');
  });

  it('validatePorterMoveSet skips rejected moves and aggregates per-move issues', () => {
    const verdict = validatePorterMoveSet(
      [
        { ...validMove, title: 'Good response' },
        { ...validMove, title: 'Rejected response', tradeoff: undefined, proposalStatus: 'rejected' },
        { ...validMove, title: 'Bad response', tradeoff: undefined },
      ],
      ['buyerPower', 'rivalry'],
      [{ id: 'impl-1' }]
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.perMove).toHaveLength(2);
    expect(verdict.perMove.find((m) => m.title === 'Good response')?.issues).toEqual([]);
    expect(
      verdict.perMove.find((m) => m.title === 'Bad response')?.issues.map((i) => i.code)
    ).toContain('missing-tradeoff');
  });
});

describe('porterSynthesisEngine — move conclusion prompt rules', () => {
  it('produces distinct bilingual rules naming the mandatory trade-off', () => {
    const en = buildPorterMoveConclusionPromptRules('en');
    const pl = buildPorterMoveConclusionPromptRules('pl');
    expect(en).toContain('tradeoff');
    expect(en.toLowerCase()).toContain('switching cost');
    expect(pl).toContain('KOSZTEM marży');
    expect(en).not.toEqual(pl);
  });
});
