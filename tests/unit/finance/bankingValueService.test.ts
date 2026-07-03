import { describe, expect, it } from 'vitest';

import {
  bankBenefit,
  bankingStatus,
  portfolioBanked,
  isBankable,
  type Benefit,
  type PortfolioItem,
} from '../../../server/src/services/bankingValueService.js';

const hardRunRateCostOut: Benefit = {
  value: 100_000,
  type: 'cost_out',
  isHard: true,
  isRunRate: true,
  mappedBudgetLine: 'OPEX-IT',
};

const hardRunRateRevenueUp: Benefit = {
  value: 50_000,
  type: 'revenue_up',
  isHard: true,
  isRunRate: true,
  mappedBudgetLine: 'REV-SaaS',
};

const softBenefit: Benefit = {
  ...hardRunRateCostOut,
  isHard: false,
};

const oneOffBenefit: Benefit = {
  ...hardRunRateCostOut,
  isRunRate: false,
};

describe('bankingValueService.bankBenefit', () => {
  it('wires a hard run-rate cost_out as a REDUCTION of the cost line', () => {
    const res = bankBenefit(hardRunRateCostOut, '2026-Q3');

    expect(res.bankedAmount).toBe(100_000);
    expect(res.budgetLineImpact.lineCode).toBe('OPEX-IT');
    expect(res.budgetLineImpact.deltaValue).toBe(-100_000); // cost line reduced
    expect(res.period).toBe('2026-Q3');
  });

  it('wires a hard run-rate revenue_up as an INCREASE of the revenue line', () => {
    const res = bankBenefit(hardRunRateRevenueUp, '2026-Q3');

    expect(res.bankedAmount).toBe(50_000);
    expect(res.budgetLineImpact.lineCode).toBe('REV-SaaS');
    expect(res.budgetLineImpact.deltaValue).toBe(50_000);
  });

  it('does NOT bank a soft benefit (zero impact)', () => {
    const res = bankBenefit(softBenefit, '2026-Q3');

    expect(isBankable(softBenefit)).toBe(false);
    expect(res.bankedAmount).toBe(0);
    expect(res.budgetLineImpact.deltaValue).toBe(0);
  });

  it('does NOT bank a one-off (non run-rate) benefit', () => {
    const res = bankBenefit(oneOffBenefit, '2026-Q3');

    expect(res.bankedAmount).toBe(0);
    expect(res.budgetLineImpact.deltaValue).toBe(0);
  });
});

describe('bankingValueService.bankingStatus', () => {
  it('marks banked when actual confirms the planned saving', () => {
    const res = bankingStatus(hardRunRateCostOut, 105_000);
    expect(res.status).toBe('banked');
    expect(res.variance).toBe(5_000);
  });

  it('marks banked when actual exactly equals plan (variance 0)', () => {
    const res = bankingStatus(hardRunRateCostOut, 100_000);
    expect(res.status).toBe('banked');
    expect(res.variance).toBe(0);
  });

  it('marks leaked when actual falls short (variance negative)', () => {
    const res = bankingStatus(hardRunRateCostOut, 60_000);
    expect(res.status).toBe('leaked');
    expect(res.variance).toBe(-40_000);
  });

  it('marks pending when no actual provided', () => {
    const res = bankingStatus(hardRunRateCostOut);
    expect(res.status).toBe('pending');
    expect(res.variance).toBe(0);
  });

  it('marks pending for non-bankable benefit even with an actual', () => {
    const res = bankingStatus(softBenefit, 100_000);
    expect(res.status).toBe('pending');
  });
});

describe('bankingValueService.portfolioBanked', () => {
  it('aggregates banked / pending / leaked and computes bankedPct', () => {
    const items: PortfolioItem[] = [
      { benefit: hardRunRateCostOut, actual: 105_000 }, // banked  100k
      { benefit: hardRunRateRevenueUp, actual: 20_000 }, // leaked  50k (short)
      { benefit: { ...hardRunRateCostOut, value: 40_000, mappedBudgetLine: 'OPEX-HR' } }, // pending 40k
      { benefit: softBenefit, actual: 100_000 }, // excluded (not bankable)
    ];

    const res = portfolioBanked(items);

    expect(res.totalBanked).toBe(100_000);
    expect(res.totalLeaked).toBe(50_000);
    expect(res.totalPending).toBe(40_000);
    // bankedPct = 100k / (100k + 50k + 40k) = 100/190
    expect(res.bankedPct).toBeCloseTo(100_000 / 190_000, 6);
  });

  it('returns zero bankedPct for an empty portfolio', () => {
    const res = portfolioBanked([]);
    expect(res.totalBanked).toBe(0);
    expect(res.bankedPct).toBe(0);
  });

  it('excludes all non-bankable items (bankedPct 0 when only soft/one-off)', () => {
    const res = portfolioBanked([
      { benefit: softBenefit, actual: 100_000 },
      { benefit: oneOffBenefit, actual: 100_000 },
    ]);
    expect(res.totalBanked).toBe(0);
    expect(res.totalPending).toBe(0);
    expect(res.totalLeaked).toBe(0);
    expect(res.bankedPct).toBe(0);
  });
});
