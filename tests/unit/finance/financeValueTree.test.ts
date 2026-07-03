import { describe, expect, it } from 'vitest';

import {
  buildBenefitValueTree,
  narrateValueTree,
  RISK_WEIGHT,
  type ValueComponentInput,
} from '../../../server/src/services/financeValueTree.ts';

const components: ValueComponentInput[] = [
  { label: 'redukcja roboczogodzin', bucket: 'savings', amount: 500_000, risk: 'hard' },
  { label: 'nowi klienci DACH', bucket: 'growth', amount: 300_000, risk: 'soft' },
  { label: 'uniknięte kary SLA', bucket: 'risk', amount: 200_000, risk: 'soft' },
];

describe('buildBenefitValueTree', () => {
  const tree = buildBenefitValueTree(components);

  it('splits benefit into savings / growth / risk buckets', () => {
    const names = tree.buckets.map((b) => b.bucket);
    expect(names).toEqual(['savings', 'growth', 'risk']);
  });

  it('computes gross and bankable (risk-weighted) totals', () => {
    expect(tree.gross).toBe(1_000_000);
    // 500k*1 + 300k*0.4 + 200k*0.4 = 500k + 120k + 80k = 700k
    expect(tree.bankable).toBe(700_000);
    expect(tree.solidity).toBeCloseTo(0.7, 5);
  });

  it('weights each component by its risk grade', () => {
    const hard = tree.components.find((c) => c.risk === 'hard')!;
    expect(hard.bankable).toBe(hard.amount * RISK_WEIGHT.hard);
    const soft = tree.components.find((c) => c.label === 'nowi klienci DACH')!;
    expect(soft.bankable).toBe(soft.amount * RISK_WEIGHT.soft);
  });

  it('identifies the largest speculative (soft) component for honest flagging', () => {
    expect(tree.largestSoftComponent).not.toBeNull();
    expect(tree.largestSoftComponent!.label).toBe('nowi klienci DACH');
  });

  it('defaults grade by bucket when caller omits risk (savings=firm, growth/risk=soft)', () => {
    const tree2 = buildBenefitValueTree([
      { label: 'x', bucket: 'savings', amount: 100 },
      { label: 'y', bucket: 'growth', amount: 100 },
    ]);
    const sav = tree2.components.find((c) => c.bucket === 'savings')!;
    const grw = tree2.components.find((c) => c.bucket === 'growth')!;
    expect(sav.risk).toBe('firm');
    expect(grw.risk).toBe('soft');
  });

  it('handles an empty / all-zero benefit without dividing by zero', () => {
    const empty = buildBenefitValueTree([]);
    expect(empty.gross).toBe(0);
    expect(empty.bankable).toBe(0);
    expect(empty.solidity).toBe(0);
    expect(empty.largestSoftComponent).toBeNull();
  });
});

describe('narrateValueTree', () => {
  it('leads with bankable value and flags the speculative slice (PL)', () => {
    const tree = buildBenefitValueTree(components);
    const prose = narrateValueTree(tree, 'pl');
    expect(prose).toContain('700'); // bankable
    expect(prose).toContain('nowi klienci DACH'); // soft slice named
    expect(prose).toMatch(/zakład|spekulat/);
  });

  it('states an honest fallback when there is nothing to grade', () => {
    expect(narrateValueTree(buildBenefitValueTree([]), 'pl')).toContain('do ustalenia');
  });
});
