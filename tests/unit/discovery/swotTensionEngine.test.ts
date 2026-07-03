import { describe, expect, it } from 'vitest';

import {
  computeTensionCoverage,
  deriveTensionCandidates,
  isAcceptedSwotItem,
  TENSION_TYPE_TO_POSTURE,
  validateMoveSet,
  validateRecommendedMove,
} from '@/config/swot/swotTensionEngine';
import type { SWOTItem } from '@/store/useToolStore';

const item = (
  id: string,
  quadrant: SWOTItem['quadrant'],
  impact: SWOTItem['impact'] = 'medium',
  proposalStatus: SWOTItem['proposalStatus'] = 'accepted'
): SWOTItem => ({ id, text: `${quadrant} ${id}`, quadrant, impact, proposalStatus });

describe('swotTensionEngine — acceptance filter', () => {
  it('counts accepted proposals and legacy user items, rejects ai-proposed/rejected', () => {
    expect(isAcceptedSwotItem({ proposalStatus: 'accepted' })).toBe(true);
    expect(isAcceptedSwotItem({ proposalStatus: 'ai-proposed' })).toBe(false);
    expect(isAcceptedSwotItem({ proposalStatus: 'rejected' })).toBe(false);
    expect(isAcceptedSwotItem({ status: 'accepted' })).toBe(true);
    expect(isAcceptedSwotItem({})).toBe(true); // legacy user-entered item
    expect(isAcceptedSwotItem({ status: 'proposed' })).toBe(false);
  });
});

describe('swotTensionEngine — tension derivation from accepted items', () => {
  const items = [
    item('s1', 'strengths', 'high'),
    item('s2', 'strengths', 'low'),
    item('w1', 'weaknesses', 'high'),
    item('o1', 'opportunities', 'high'),
    item('t1', 'threats', 'medium'),
    item('x-proposed', 'strengths', 'high', 'ai-proposed'), // must be ignored
  ];

  it('produces all four SO/WO/ST/WT types when quadrants are populated', () => {
    const candidates = deriveTensionCandidates(items);
    const types = new Set(candidates.map((c) => c.type));
    expect(types).toEqual(new Set(['SO', 'WO', 'ST', 'WT']));
  });

  it('links exactly one internal and one external ACCEPTED item, verifiable by id', () => {
    const candidates = deriveTensionCandidates(items);
    const ids = new Set(items.filter(isAcceptedSwotItem).map((i) => i.id));
    candidates.forEach((c) => {
      expect(c.linkedItemIds).toHaveLength(2);
      c.linkedItemIds.forEach((id) => expect(ids.has(id)).toBe(true));
      expect(c.linkedItemIds).not.toContain('x-proposed');
    });
  });

  it('ranks pairs by combined impact and caps per type', () => {
    const candidates = deriveTensionCandidates(items, 1);
    const so = candidates.filter((c) => c.type === 'SO');
    expect(so).toHaveLength(1);
    // high strength (s1) + high opportunity beats low strength (s2)
    expect(so[0].linkedItemIds).toEqual(['s1', 'o1']);
    expect(so[0].weight).toBe(6);
  });

  it('cannot form a type when a quadrant has no accepted items', () => {
    const noThreats = items.filter((i) => i.quadrant !== 'threats');
    const candidates = deriveTensionCandidates(noThreats);
    expect(candidates.some((c) => c.type === 'ST' || c.type === 'WT')).toBe(false);
  });

  it('maps tension types onto the attack/repair/defend/protect postures', () => {
    expect(TENSION_TYPE_TO_POSTURE.SO.type).toBe('attack');
    expect(TENSION_TYPE_TO_POSTURE.WO.type).toBe('repair');
    expect(TENSION_TYPE_TO_POSTURE.ST.type).toBe('defend');
    expect(TENSION_TYPE_TO_POSTURE.WT.type).toBe('protect');
  });
});

describe('swotTensionEngine — coverage gate', () => {
  const items = [
    item('s1', 'strengths'),
    item('w1', 'weaknesses'),
    item('o1', 'opportunities'),
  ];

  it('flags formable-but-missing types and excuses structurally empty ones', () => {
    const coverage = computeTensionCoverage(items, [
      { type: 'attack', proposalStatus: 'accepted' },
    ]);
    expect(coverage.covered).toEqual(['SO']);
    expect(coverage.missing).toEqual(['WO']); // weaknesses+opportunities exist, tension does not
    expect(coverage.structurallyEmpty).toEqual(['ST', 'WT']); // no threats accepted
  });

  it('ignores rejected/rethinking tensions when computing coverage', () => {
    const coverage = computeTensionCoverage(items, [
      { type: 'attack', proposalStatus: 'rejected' },
    ]);
    expect(coverage.covered).toEqual([]);
    expect(coverage.missing).toEqual(['SO', 'WO']);
  });
});

describe('swotTensionEngine — W2 move validation (trade-off is mandatory)', () => {
  const session = { itemIds: new Set(['s1', 'w1']), tensionIds: new Set(['tension-1']) };

  const validMove = {
    rationale: 'Concentration at 61% of revenue makes the DACH entry unfinanceable (s1, w1).',
    linkedItemIds: ['s1', 'w1'],
    linkedTensionIds: ['tension-1'],
    tradeoff: {
      chosen: 'De-concentrate revenue below 45% first',
      deferred: 'DACH market entry by 2 quarters',
      cost: 'slower top-line growth in the interim',
    },
    rejectedAlternative: {
      option: 'Enter DACH immediately',
      reason: 'losing client A mid-expansion kills both legs at once',
    },
  };

  it('accepts a move with rationale, valid links, complete trade-off and a rejected alternative', () => {
    expect(validateRecommendedMove(validMove, session)).toEqual([]);
  });

  it('rejects a move without a trade-off — a recommendation without a trade-off is a list', () => {
    const issues = validateRecommendedMove({ ...validMove, tradeoff: undefined }, session);
    expect(issues.map((i) => i.code)).toContain('missing-tradeoff');
  });

  it('rejects an incomplete trade-off (all three parts required)', () => {
    const issues = validateRecommendedMove(
      { ...validMove, tradeoff: { chosen: 'X', deferred: '', cost: '' } },
      session
    );
    expect(issues.map((i) => i.code)).toContain('incomplete-tradeoff');
  });

  it('rejects a move without a rejected alternative with reason', () => {
    const noAlt = validateRecommendedMove({ ...validMove, rejectedAlternative: undefined }, session);
    expect(noAlt.map((i) => i.code)).toContain('missing-rejected-alternative');
    const noReason = validateRecommendedMove(
      { ...validMove, rejectedAlternative: { option: 'Do nothing', reason: '' } },
      session
    );
    expect(noReason.map((i) => i.code)).toContain('missing-rejected-alternative');
  });

  it('rejects untraceable rationale (no links) and dangling links (ids not in session)', () => {
    const unlinked = validateRecommendedMove(
      { ...validMove, linkedItemIds: [], linkedTensionIds: [] },
      session
    );
    expect(unlinked.map((i) => i.code)).toContain('unlinked-rationale');

    const dangling = validateRecommendedMove(
      { ...validMove, linkedItemIds: ['ghost-item'] },
      session
    );
    expect(dangling.map((i) => i.code)).toContain('dangling-links');
  });

  it('validateMoveSet skips rejected moves and aggregates per-move issues', () => {
    const verdict = validateMoveSet(
      [
        { ...validMove, title: 'Good move' },
        { ...validMove, title: 'Rejected move', tradeoff: undefined, proposalStatus: 'rejected' },
        { ...validMove, title: 'Bad move', tradeoff: undefined },
      ],
      [{ id: 's1' }, { id: 'w1' }],
      [{ id: 'tension-1' }]
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.perMove).toHaveLength(2); // rejected move excluded
    expect(verdict.perMove.find((m) => m.title === 'Good move')?.issues).toEqual([]);
    expect(
      verdict.perMove.find((m) => m.title === 'Bad move')?.issues.map((i) => i.code)
    ).toContain('missing-tradeoff');
  });
});
