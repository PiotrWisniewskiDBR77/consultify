import { describe, expect, it } from 'vitest';

import {
  buildActivityLadder,
  buildActivityLadderPromptBlock,
  getAllActivityLadders,
  getNextQuestionId,
  getQuestionNode,
  L2_KEY_TO_POLE,
  L4_KEY_TO_FAMILY,
  VALUE_CHAIN_ACTIVITIES,
} from '@/config/valuechain/valueChainQuestionBank';
import type { ValueActivityId } from '@/store/useToolStore';

describe('valueChainQuestionBank — coverage', () => {
  it('defines all 9 canonical Porter activities (5 primary + 4 support)', () => {
    expect(VALUE_CHAIN_ACTIVITIES).toHaveLength(9);
    expect(VALUE_CHAIN_ACTIVITIES.filter((a) => a.kind === 'primary')).toHaveLength(5);
    expect(VALUE_CHAIN_ACTIVITIES.filter((a) => a.kind === 'support')).toHaveLength(4);
  });

  it('builds a full 4-rung ladder for every activity', () => {
    const ladders = getAllActivityLadders();
    (Object.keys(ladders) as ValueActivityId[]).forEach((id) => {
      const levels = new Set(ladders[id].map((n) => n.level));
      expect(levels).toEqual(new Set([1, 2, 3, 4]));
    });
  });

  it('gives every node bilingual text and stable branch keys', () => {
    const nodes = buildActivityLadder(VALUE_CHAIN_ACTIVITIES[0]);
    nodes.forEach((n) => {
      expect(n.textEn.trim()).not.toBe('');
      expect(n.textPl.trim()).not.toBe('');
      n.answerOptions.forEach((o) => {
        expect(o.key).toMatch(/^[a-z-]+$/);
        expect(o.key in n.branches).toBe(true);
      });
    });
  });
});

describe('valueChainQuestionBank — branching (surface → cost/value → benchmark → potential)', () => {
  const ops = 'operations';

  it('L2 cost-heavy routes to the cost benchmark, value-heavy to the value benchmark', () => {
    const l2 = `${ops}-l2`;
    expect(getNextQuestionId(l2, 'cost-heavy')).toBe(`${ops}-l3-cost`);
    expect(getNextQuestionId(l2, 'value-heavy')).toBe(`${ops}-l3-value`);
  });

  it('L2 "neither" short-circuits straight to the potential rung', () => {
    expect(getNextQuestionId(`${ops}-l2`, 'neither')).toBe(`${ops}-l4`);
  });

  it('L4 completes the ladder (all move families terminate)', () => {
    ['improve', 'automate', 'outsource', 'integrate'].forEach((key) => {
      expect(getNextQuestionId(`${ops}-l4`, key)).toBeNull();
    });
  });

  it('falls back to defaultNextId on an unknown answer key', () => {
    expect(getNextQuestionId(`${ops}-l1`, 'nonsense-key')).toBe(`${ops}-l2`);
  });

  it('returns null for an unknown node id (never dead-ends the caller)', () => {
    expect(getNextQuestionId('does-not-exist', 'improve')).toBeNull();
    expect(getQuestionNode('does-not-exist')).toBeUndefined();
  });
});

describe('valueChainQuestionBank — answer→family mappings', () => {
  it('maps L4 keys to the four move families', () => {
    expect(L4_KEY_TO_FAMILY).toEqual({
      improve: 'improve',
      automate: 'automate',
      outsource: 'outsource',
      integrate: 'integrate',
    });
  });

  it('maps L2 keys to cost/value poles', () => {
    expect(L2_KEY_TO_POLE['cost-heavy']).toBe('cost-drain');
    expect(L2_KEY_TO_POLE['value-heavy']).toBe('value-creator');
    expect(L2_KEY_TO_POLE['both-high']).toBe('mixed');
    expect(L2_KEY_TO_POLE.neither).toBe('neutral');
  });
});

describe('valueChainQuestionBank — prompt block', () => {
  it('renders the ladder with branch targets in the requested language', () => {
    const en = buildActivityLadderPromptBlock('operations', 'en');
    expect(en).toMatch(/L1 \(operations-l1\)/);
    expect(en).toMatch(/operations-l3-cost/);
    expect(en).toMatch(/END/); // L4 terminal branches
    const pl = buildActivityLadderPromptBlock('operations', 'pl');
    expect(pl).toMatch(/KONIEC/);
  });

  it('returns empty string for an unknown activity id', () => {
    expect(buildActivityLadderPromptBlock('nope' as ValueActivityId, 'en')).toBe('');
  });
});
