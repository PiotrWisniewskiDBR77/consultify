import { describe, expect, it } from 'vitest';

import {
  buildValueChainMovePromptRules,
  computeMarginMap,
  computeMarginMapCoverage,
  deriveLeverCandidates,
  isScoredActivity,
  validateValueChainMove,
  validateValueChainMoveSet,
} from '@/config/valuechain/valueChainMarginEngine';
import type { ValueActivity, ValueActivityId } from '@/store/useToolStore';

const activity = (
  id: ValueActivityId,
  kind: ValueActivity['kind'],
  overrides: Partial<ValueActivity> = {}
): ValueActivity => ({
  id,
  name: id,
  kind,
  costContribution: 'medium',
  valueContribution: 'medium',
  marginRole: 'neutral',
  maturity: 'adequate',
  drivers: [],
  ...overrides,
});

const scoredMap = (): Partial<Record<ValueActivityId, ValueActivity>> => ({
  operations: activity('operations', 'primary', {
    costContribution: 'high',
    valueContribution: 'low',
    marginRole: 'drain',
    maturity: 'weak',
  }),
  marketingSales: activity('marketingSales', 'primary', {
    costContribution: 'medium',
    valueContribution: 'high',
    marginRole: 'creator',
    maturity: 'weak',
  }),
  procurement: activity('procurement', 'support', {
    costContribution: 'high',
    valueContribution: 'low',
    marginRole: 'drain',
    maturity: 'adequate',
  }),
  service: activity('service', 'primary'), // left on defaults → unscored
});

describe('valueChainMarginEngine — scored detection', () => {
  it('treats default-neutral activities as unscored, moved-or-described as scored', () => {
    expect(isScoredActivity(activity('service', 'primary'))).toBe(false);
    expect(
      isScoredActivity(activity('service', 'primary', { costContribution: 'high' }))
    ).toBe(true);
    expect(
      isScoredActivity(activity('service', 'primary', { drivers: ['manual triage'] }))
    ).toBe(true);
  });
});

describe('valueChainMarginEngine — margin map (computed, not narrated)', () => {
  it('separates creators from drains and concentrates cost', () => {
    const map = computeMarginMap(scoredMap());
    expect(map.creators).toContain('marketingSales');
    expect(map.drains).toEqual(expect.arrayContaining(['operations', 'procurement']));
    expect(map.drains).not.toContain('service'); // unscored, excluded
    expect(map.costInDrains).toBeGreaterThan(map.costInCreators);
  });

  it('excludes rejected activities', () => {
    const map = computeMarginMap({
      operations: activity('operations', 'primary', {
        costContribution: 'high',
        marginRole: 'drain',
        proposalStatus: 'rejected',
      }),
    });
    expect(map.entries).toHaveLength(0);
  });
});

describe('valueChainMarginEngine — lever candidates (high cost x low maturity x value)', () => {
  it('ranks the costly, immature drain first and caps the set', () => {
    const candidates = deriveLeverCandidates(scoredMap(), 2);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].activityId).toBe('operations'); // high cost + drain + weak maturity
    // A drain support activity is suggested to outsource; a costly primary drain, cost-reduction.
    expect(candidates[0].suggestedLeverType).toBe('cost-reduction');
  });

  it('suggests value-enhancement for a weak-maturity creator', () => {
    const candidates = deriveLeverCandidates(scoredMap(), 3);
    const mkt = candidates.find((c) => c.activityId === 'marketingSales');
    expect(mkt?.suggestedLeverType).toBe('value-enhancement');
  });

  it('suggests outsource for a support drain', () => {
    const candidates = deriveLeverCandidates({
      procurement: activity('procurement', 'support', {
        costContribution: 'high',
        marginRole: 'drain',
        maturity: 'weak',
      }),
    });
    expect(candidates[0].suggestedLeverType).toBe('outsource');
  });
});

describe('valueChainMarginEngine — coverage', () => {
  it('reports scored counts, unscored blind spots and the gradient flag', () => {
    const cov = computeMarginMapCoverage(scoredMap());
    expect(cov.scoredCount).toBe(3);
    expect(cov.primaryScored).toBe(2);
    expect(cov.supportScored).toBe(1);
    expect(cov.unscored).toContain('service');
    expect(cov.unscored).toContain('inboundLogistics');
    expect(cov.hasGradient).toBe(true); // has a creator AND a drain
  });
});

describe('valueChainMarginEngine — W2 move validation', () => {
  const session = {
    activityIds: new Set(['operations', 'procurement']),
    leverIds: new Set(['lever-1']),
  };

  const goodMove = {
    title: 'Automate order intake',
    rationale: 'Operations is the biggest, least mature margin drain.',
    linkedActivityIds: ['operations'] as ValueActivityId[],
    linkedLeverIds: ['lever-1'],
    tradeoff: { chosen: 'Automate receipt', deferred: 'CRM redesign', cost: 'CRM stays clunky one more quarter' },
    rejectedAlternative: { option: 'Outsource receiving', reason: 'Would surrender quality control on inputs' },
  };

  it('passes a fully-formed move', () => {
    expect(validateValueChainMove(goodMove, session)).toEqual([]);
  });

  it('flags a missing trade-off (a list, not a decision)', () => {
    const { tradeoff, ...noTradeoff } = goodMove;
    void tradeoff;
    expect(validateValueChainMove(noTradeoff, session).map((i) => i.code)).toContain(
      'missing-tradeoff'
    );
  });

  it('flags an incomplete trade-off', () => {
    const issues = validateValueChainMove(
      { ...goodMove, tradeoff: { chosen: 'x', deferred: '', cost: '' } },
      session
    );
    expect(issues.map((i) => i.code)).toContain('incomplete-tradeoff');
  });

  it('flags a missing rejected alternative', () => {
    const { rejectedAlternative, ...noAlt } = goodMove;
    void rejectedAlternative;
    expect(validateValueChainMove(noAlt, session).map((i) => i.code)).toContain(
      'missing-rejected-alternative'
    );
  });

  it('flags dangling links to non-existent elements', () => {
    const issues = validateValueChainMove(
      { ...goodMove, linkedActivityIds: ['inboundLogistics'] as ValueActivityId[], linkedLeverIds: [] },
      session
    );
    expect(issues.map((i) => i.code)).toContain('dangling-links');
  });

  it('flags an entirely unlinked move', () => {
    const issues = validateValueChainMove(
      { ...goodMove, linkedActivityIds: [], linkedLeverIds: [] },
      session
    );
    expect(issues.map((i) => i.code)).toContain('unlinked-rationale');
  });

  it('validateValueChainMoveSet skips rejected moves and aggregates a verdict', () => {
    const verdict = validateValueChainMoveSet(
      [
        { ...goodMove },
        { title: 'bad', rationale: '', linkedActivityIds: [], linkedLeverIds: [] },
        {
          title: 'rejected one',
          rationale: '',
          linkedActivityIds: [],
          linkedLeverIds: [],
          proposalStatus: 'rejected',
        },
      ],
      [{ id: 'operations' }, { id: 'procurement' }],
      [{ id: 'lever-1' }]
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.perMove).toHaveLength(2); // rejected one excluded
  });
});

describe('valueChainMarginEngine — prompt rules', () => {
  it('names the four move families in PL and EN', () => {
    const pl = buildValueChainMovePromptRules('pl');
    const en = buildValueChainMovePromptRules('en');
    expect(pl).toMatch(/USPRAWNIJ|ZAUTOMATYZUJ|OUTSOURCUJ|ZINTEGRUJ/);
    expect(en).toMatch(/IMPROVE|AUTOMATE|OUTSOURCE|INTEGRATE/);
    expect(en).toMatch(/tradeoff/i);
    expect(en).toMatch(/MANDATORY/);
  });
});
