import { describe, expect, it } from 'vitest';

import {
  computeInitiativeDeltaStatements,
  computePortfolioAggregateStatements,
  sumAggregateStatements,
  type AggregateStatements,
  type InitiativeDeltaInputs,
  type InitiativeDeltaResult,
} from '../../../server/src/services/financeAggregateScopeService.js';

// ---------------------------------------------------------------------------
// computeInitiativeDeltaStatements (A2) — pure, deterministic
// ---------------------------------------------------------------------------

describe('computeInitiativeDeltaStatements — budget_initiative_links precedence', () => {
  it('maps revenue_uplift → pnl.REVENUE (positive)', () => {
    const inputs: InitiativeDeltaInputs = {
      initiativeId: 'init-1',
      budgetLinks: { revenueUpliftSum: 500_000, costSavingsSum: 0, capexRequiredSum: 0, linkCount: 1 },
      benefits: null,
    };
    const result = computeInitiativeDeltaStatements(inputs);
    expect(result).not.toBeNull();
    expect(result!.sourceType).toBe('budget_initiative_links');
    expect(result!.statements.pnl.REVENUE).toBe(500_000);
    expect(result!.statements.pnl.OPEX).toBeUndefined();
    expect(result!.statements.cf.CAPEX).toBeUndefined();
  });

  it('maps cost_savings → pnl.OPEX as a NEGATIVE delta (reduces the display_absolute cost magnitude)', () => {
    const inputs: InitiativeDeltaInputs = {
      initiativeId: 'init-2',
      budgetLinks: { revenueUpliftSum: 0, costSavingsSum: 200_000, capexRequiredSum: 0, linkCount: 1 },
      benefits: null,
    };
    const result = computeInitiativeDeltaStatements(inputs);
    expect(result!.statements.pnl.OPEX).toBe(-200_000);
  });

  it('maps capex_required → cf.CAPEX as a POSITIVE delta (adds to the display_absolute spend magnitude)', () => {
    const inputs: InitiativeDeltaInputs = {
      initiativeId: 'init-3',
      budgetLinks: { revenueUpliftSum: 0, costSavingsSum: 0, capexRequiredSum: 120_000, linkCount: 1 },
      benefits: null,
    };
    const result = computeInitiativeDeltaStatements(inputs);
    expect(result!.statements.cf.CAPEX).toBe(120_000);
  });

  it('combines all three fields when all are nonzero, summed across multiple links', () => {
    const inputs: InitiativeDeltaInputs = {
      initiativeId: 'init-4',
      budgetLinks: {
        revenueUpliftSum: 300_000,
        costSavingsSum: 50_000,
        capexRequiredSum: 80_000,
        linkCount: 2, // e.g. the initiative is linked from two budgets, already pre-summed
      },
      benefits: { estimatedAnnualValueSum: 999_999, benefitCount: 1 }, // must be ignored: links win
    };
    const result = computeInitiativeDeltaStatements(inputs);
    expect(result!.sourceType).toBe('budget_initiative_links');
    expect(result!.statements.pnl.REVENUE).toBe(300_000);
    expect(result!.statements.pnl.OPEX).toBe(-50_000);
    expect(result!.statements.cf.CAPEX).toBe(80_000);
  });

  it('ignores an all-zero budget_initiative_links row and falls back to benefits', () => {
    const inputs: InitiativeDeltaInputs = {
      initiativeId: 'init-5',
      budgetLinks: { revenueUpliftSum: 0, costSavingsSum: 0, capexRequiredSum: 0, linkCount: 1 },
      benefits: { estimatedAnnualValueSum: 150_000, benefitCount: 1 },
    };
    const result = computeInitiativeDeltaStatements(inputs);
    expect(result!.sourceType).toBe('initiative_benefits');
    expect(result!.statements.pnl.REVENUE).toBe(150_000);
  });
});

describe('computeInitiativeDeltaStatements — initiative_benefits fallback', () => {
  it('uses estimated_annual_value as pnl.REVENUE when there is no budget link at all', () => {
    const inputs: InitiativeDeltaInputs = {
      initiativeId: 'init-6',
      budgetLinks: null,
      benefits: { estimatedAnnualValueSum: 75_000, benefitCount: 3 },
    };
    const result = computeInitiativeDeltaStatements(inputs);
    expect(result!.sourceType).toBe('initiative_benefits');
    expect(result!.statements.pnl.REVENUE).toBe(75_000);
    expect(result!.statements.bs).toEqual({});
    expect(result!.statements.cf).toEqual({});
  });
});

describe('computeInitiativeDeltaStatements — brak danych → skip, NIE 0', () => {
  it('returns null when both sources are absent', () => {
    const result = computeInitiativeDeltaStatements({
      initiativeId: 'init-7',
      budgetLinks: null,
      benefits: null,
    });
    expect(result).toBeNull();
  });

  it('returns null when budget links are all-zero AND benefits sum to zero', () => {
    const result = computeInitiativeDeltaStatements({
      initiativeId: 'init-8',
      budgetLinks: { revenueUpliftSum: 0, costSavingsSum: 0, capexRequiredSum: 0, linkCount: 1 },
      benefits: { estimatedAnnualValueSum: 0, benefitCount: 2 },
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// sumAggregateStatements — line-code union, additive
// ---------------------------------------------------------------------------

describe('sumAggregateStatements', () => {
  it('sums matching line codes across base + N deltas', () => {
    const base: AggregateStatements = { pnl: { REVENUE: 1_000_000, OPEX: 400_000 }, bs: {}, cf: {} };
    const deltaA: AggregateStatements = { pnl: { REVENUE: 300_000 }, bs: {}, cf: { CAPEX: 80_000 } };
    const deltaB: AggregateStatements = { pnl: { REVENUE: 150_000, OPEX: -50_000 }, bs: {}, cf: {} };

    const result = sumAggregateStatements(base, [deltaA, deltaB]);

    expect(result.pnl.REVENUE).toBe(1_000_000 + 300_000 + 150_000);
    expect(result.pnl.OPEX).toBe(400_000 - 50_000);
    expect(result.cf.CAPEX).toBe(80_000);
  });

  it('introduces a line code that only exists in a delta (union, not intersection)', () => {
    const base: AggregateStatements = { pnl: { REVENUE: 1_000_000 }, bs: {}, cf: {} };
    const delta: AggregateStatements = { pnl: { NEW_PRODUCT_LINE_REVENUE: 42_000 }, bs: {}, cf: {} };
    const result = sumAggregateStatements(base, [delta]);
    expect(result.pnl.REVENUE).toBe(1_000_000);
    expect(result.pnl.NEW_PRODUCT_LINE_REVENUE).toBe(42_000);
  });

  it('with zero deltas, returns the base statements unchanged', () => {
    const base: AggregateStatements = { pnl: { REVENUE: 500 }, bs: { CASH: 100 }, cf: { CAPEX: 10 } };
    const result = sumAggregateStatements(base, []);
    expect(result).toEqual(base);
  });
});

// ---------------------------------------------------------------------------
// computePortfolioAggregateStatements (A3 = A1 + ΣA2)
// ---------------------------------------------------------------------------

describe('computePortfolioAggregateStatements — A3 = A1 + ΣA2', () => {
  const base: AggregateStatements = {
    pnl: { REVENUE: 5_000_000, OPEX: 2_000_000 },
    bs: { CASH: 1_000_000 },
    cf: { CAPEX: 300_000 },
  };

  function deltaFor(initiativeId: string, revenue: number, opexDelta: number, capex: number): InitiativeDeltaResult {
    return {
      scope: 'initiative',
      initiativeId,
      sourceType: 'budget_initiative_links',
      statements: { pnl: { REVENUE: revenue, OPEX: opexDelta }, bs: {}, cf: { CAPEX: capex } },
    };
  }

  it('sums base + all included initiative deltas, and equals sumAggregateStatements directly', () => {
    const delta1 = deltaFor('init-a', 400_000, -100_000, 50_000);
    const delta2 = deltaFor('init-b', 250_000, 20_000, 30_000);

    const result = computePortfolioAggregateStatements({
      basePackId: 'pack-a1',
      base,
      initiativeDeltas: [
        { initiativeId: 'init-a', result: delta1 },
        { initiativeId: 'init-b', result: delta2 },
      ],
    });

    const expected = sumAggregateStatements(base, [delta1.statements, delta2.statements]);
    expect(result.statements).toEqual(expected);
    expect(result.statements.pnl.REVENUE).toBe(5_000_000 + 400_000 + 250_000);
    expect(result.statements.pnl.OPEX).toBe(2_000_000 - 100_000 + 20_000);
    expect(result.statements.cf.CAPEX).toBe(300_000 + 50_000 + 30_000);
    expect(result.includedInitiativeIds).toEqual(['init-a', 'init-b']);
    expect(result.skippedInitiativeIds).toEqual([]);
    expect(result.basePackId).toBe('pack-a1');
    expect(result.scope).toBe('portfolio');
  });

  it('excludes initiatives with a null delta from the sum and reports them as skipped (not zeroed)', () => {
    const included = deltaFor('init-live', 100_000, 0, 0);

    const result = computePortfolioAggregateStatements({
      basePackId: 'pack-a1',
      base,
      initiativeDeltas: [
        { initiativeId: 'init-live', result: included },
        { initiativeId: 'init-no-data', result: null },
      ],
    });

    expect(result.includedInitiativeIds).toEqual(['init-live']);
    expect(result.skippedInitiativeIds).toEqual(['init-no-data']);
    // Base + only the ONE included delta — the skipped initiative contributes nothing.
    expect(result.statements.pnl.REVENUE).toBe(5_000_000 + 100_000);
  });

  it('with zero initiatives selected, A3 equals A1 exactly', () => {
    const result = computePortfolioAggregateStatements({
      basePackId: 'pack-a1',
      base,
      initiativeDeltas: [],
    });
    expect(result.statements).toEqual(base);
    expect(result.includedInitiativeIds).toEqual([]);
    expect(result.skippedInitiativeIds).toEqual([]);
  });

  it('with ALL initiatives skipped (no data anywhere), A3 still equals A1 (never falls back to 0-injection)', () => {
    const result = computePortfolioAggregateStatements({
      basePackId: 'pack-a1',
      base,
      initiativeDeltas: [
        { initiativeId: 'init-x', result: null },
        { initiativeId: 'init-y', result: null },
      ],
    });
    expect(result.statements).toEqual(base);
    expect(result.skippedInitiativeIds).toEqual(['init-x', 'init-y']);
  });
});
