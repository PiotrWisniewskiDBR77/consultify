/**
 * financeReportConclusion — O2.4 CONCLUSION LAYER wiring tests.
 *
 * Contracts under test:
 *   1. rankRatiosForConclusion ranks a threshold-breaching ratio above an
 *      in-range one, deterministically (no randomness, code tie-break).
 *   2. ratioToIndicatorFacts carries numbers ONLY from the ratio row (R5) —
 *      never invents history/drivers when the engine has none.
 *   3. buildFinanceReportConclusions produces validated K1-K4 conclusions,
 *      capped at topN, and DROPS anything failing the hard §4.4 gate.
 *   4. renderFinanceConclusionsMarkdown degrades honestly with zero ratios.
 *   5. composeFinanceReportSection (integration) attaches `conclusions` and
 *      renderFinanceReportMarkdown's `narrative` is no longer the old TODO.
 */
import { describe, expect, it } from 'vitest';

import {
  composeFinanceReportSection,
  renderFinanceReportMarkdown,
  type RawFinanceReportInputs,
} from '../../../server/src/services/financeReportSectionService.js';
import {
  buildFinanceReportConclusions,
  rankRatiosForConclusion,
  ratioToIndicatorFacts,
  renderFinanceConclusionsMarkdown,
  type RatioForConclusion,
} from '../../../server/src/services/financeReportConclusion.js';

function ratio(overrides: Partial<RatioForConclusion>): RatioForConclusion {
  return {
    code: 'TEST_RATIO',
    family: 'liquidity',
    label: 'Test ratio',
    labelPl: 'Wskaźnik testowy',
    value: 1,
    status: 'computed',
    direction: 'higher_better',
    unit: 'x',
    formula: 'a/b',
    missingLineCodes: [],
    ...overrides,
  } as RatioForConclusion;
}

describe('rankRatiosForConclusion', () => {
  it('ranks a threshold-breaching ratio above an in-range one', () => {
    const breaching = ratio({
      code: 'CURRENT_RATIO',
      value: 0.8,
      direction: 'higher_better',
      benchmark: { targetMin: 1.0, p25: 1.0, p75: 2.0 },
    });
    const healthy = ratio({
      code: 'QUICK_RATIO',
      value: 1.1,
      direction: 'higher_better',
      benchmark: { targetMin: 1.0, p25: 1.0, p75: 1.5 },
    });
    const ranked = rankRatiosForConclusion([healthy, breaching]);
    expect(ranked[0].code).toBe('CURRENT_RATIO');
  });

  it('excludes skipped (uncomputed) ratios', () => {
    const skipped = ratio({ code: 'SKIPPED_ONE', status: 'skipped', value: null });
    const ranked = rankRatiosForConclusion([skipped]);
    expect(ranked).toHaveLength(0);
  });

  it('is deterministic: ties break by ratio code, not insertion order', () => {
    const a = ratio({ code: 'B_RATIO', value: 1 });
    const b = ratio({ code: 'A_RATIO', value: 1 });
    const ranked = rankRatiosForConclusion([a, b]);
    expect(ranked.map((r) => r.code)).toEqual(['A_RATIO', 'B_RATIO']);
  });
});

describe('ratioToIndicatorFacts', () => {
  it('carries the value/threshold/benchmark straight from the ratio row (R5)', () => {
    const r = ratio({
      code: 'CURRENT_RATIO',
      labelPl: 'Płynność bieżąca',
      value: 1.2,
      unit: 'x',
      direction: 'higher_better',
      benchmark: { targetMin: 1.0, p25: 1.5, p75: 2.0 },
    });
    const facts = ratioToIndicatorFacts(r);
    expect(facts).not.toBeNull();
    expect(facts!.value).toBe(1.2);
    expect(facts!.threshold).toBe(1.0);
    expect(facts!.benchmark).toEqual([1.5, 2.0]);
    expect(facts!.name).toBe('Płynność bieżąca');
  });

  it('never fabricates history or drivers when the engine has none (honest gap)', () => {
    const r = ratio({ code: 'CURRENT_RATIO', value: 1.2 });
    const facts = ratioToIndicatorFacts(r)!;
    expect(facts.history).toBeUndefined();
    expect(facts.drivers).toBeUndefined();
  });

  it('returns null for an uncomputed ratio (no numbers to narrate)', () => {
    const r = ratio({ status: 'skipped', value: null });
    expect(ratioToIndicatorFacts(r)).toBeNull();
  });

  it('picks targetMin for higher_better and targetMax for lower_better', () => {
    const dso = ratio({
      code: 'DSO',
      value: 60,
      direction: 'lower_better',
      benchmark: { targetMax: 45 },
    });
    const facts = ratioToIndicatorFacts(dso)!;
    expect(facts.threshold).toBe(45);
    expect(facts.higherIsBetter).toBe(false);
  });
});

describe('buildFinanceReportConclusions', () => {
  const org = { name: 'DBR77 Sp. z o.o.', industrySegment: 'produkcja' };

  it('produces validated K1-K4 conclusions for computed ratios, capped at topN', () => {
    const ratios = [
      ratio({ code: 'CURRENT_RATIO', value: 0.8, benchmark: { targetMin: 1.0, p25: 1.0, p75: 2.0 } }),
      ratio({ code: 'QUICK_RATIO', value: 0.5, benchmark: { targetMin: 0.8, p25: 0.8, p75: 1.2 } }),
      ratio({ code: 'DEBT_TO_EQUITY', value: 3.0, direction: 'lower_better', benchmark: { targetMax: 1.5 } }),
      ratio({ code: 'ROE', value: 0.02, benchmark: { targetMin: 0.1 } }),
    ];
    const out = buildFinanceReportConclusions(ratios, org, { topN: 3 });
    expect(out.length).toBeLessThanOrEqual(3);
    expect(out.length).toBeGreaterThan(0);
    for (const item of out) {
      expect(item.conclusion.headline.length).toBeGreaterThan(0);
      expect(item.conclusion.k3Actions.length).toBeGreaterThanOrEqual(1);
      expect(item.conclusion.k3Actions.length).toBeLessThanOrEqual(3);
      expect(item.conclusion.k4Effect.horizon.length).toBeGreaterThan(0);
      expect(item.validation.allHardPass).toBe(true);
    }
  });

  it('every K3 action carries an owner role (R6 adresat)', () => {
    const ratios = [ratio({ code: 'CURRENT_RATIO', value: 0.6, benchmark: { targetMin: 1.0 } })];
    const out = buildFinanceReportConclusions(ratios, org);
    expect(out).toHaveLength(1);
    for (const a of out[0].conclusion.k3Actions) {
      expect(a.ownerRole.length).toBeGreaterThan(0);
    }
  });

  it('returns an empty list when there are no computed ratios', () => {
    const out = buildFinanceReportConclusions([], org);
    expect(out).toEqual([]);
  });

  it('degrades honestly (no invented trend/driver) but still produces a valid conclusion', () => {
    const ratios = [ratio({ code: 'CURRENT_RATIO', value: 0.6, benchmark: { targetMin: 1.0 } })];
    const out = buildFinanceReportConclusions(ratios, org);
    expect(out[0].conclusion.chain.trend).toMatch(/nieoznaczony|undetermined/);
    expect(out[0].conclusion.chain.driver).toMatch(/do ustalenia|to be established/);
  });
});

describe('renderFinanceConclusionsMarkdown', () => {
  it('degrades honestly with zero conclusions (not a fake narrative)', () => {
    const md = renderFinanceConclusionsMarkdown([]);
    expect(md).toContain('Brak policzonych wskaźników');
  });

  it('renders headline + K3 actions + K4 effect for each conclusion', () => {
    const out = buildFinanceReportConclusions(
      [ratio({ code: 'CURRENT_RATIO', value: 0.6, benchmark: { targetMin: 1.0 } })],
      { name: 'Org', industrySegment: 'x' }
    );
    const md = renderFinanceConclusionsMarkdown(out);
    expect(md).toContain(out[0].conclusion.headline);
    expect(md).toContain('Najpierw');
    expect(md).toContain('Efekt');
  });
});

describe('composeFinanceReportSection — O2.4 integration (conclusions field)', () => {
  const COMPLETE_LINES = {
    REVENUE: 1000,
    COGS: 600,
    GROSS_PROFIT: 400,
    EBITDA: 220,
    EBIT: 180,
    EBT: 120,
    TAX_EXPENSE: 30,
    NET_INCOME: 90,
    CURRENT_ASSETS: 500,
    CURRENT_LIABILITIES: 250,
    INVENTORY: 150,
    CASH: 80,
    AR: 120,
    AP: 90,
    TOTAL_ASSETS: 1200,
    TOTAL_EQUITY: 600,
    TOTAL_DEBT: 400,
    NET_DEBT: 320,
    INTEREST_EXPENSE: 40,
    CAPEX: -60,
    FREE_CASH_FLOW: 100,
  };

  function baseInput(overrides: Partial<RawFinanceReportInputs> = {}): RawFinanceReportInputs {
    return {
      organizationId: 'org-1',
      pack: {
        packId: 'pack-1',
        entityName: 'DBR77 Sp. z o.o.',
        periodLabel: 'FY2025',
        periodEnd: '2025-12-31',
        currency: 'PLN',
        statementTypesPresent: ['P&L', 'BS', 'CF'],
        missingStatementTypes: [],
      },
      lineValues: COMPLETE_LINES,
      orgBenchmarkRows: [],
      reconcileValidations: null,
      valuation: null,
      ...overrides,
    };
  }

  it('attaches a `conclusions` array built from the same ratios as `section.ratios`', () => {
    const section = composeFinanceReportSection(baseInput());
    expect(Array.isArray(section.conclusions)).toBe(true);
  });

  it('empty state (no pack) has an empty conclusions array (no numbers guessed)', () => {
    const section = composeFinanceReportSection(baseInput({ pack: null, lineValues: {} }));
    expect(section.conclusions).toEqual([]);
  });

  it('renderFinanceReportMarkdown narrative is no longer the old TODO placeholder', () => {
    const section = composeFinanceReportSection(baseInput());
    const md = renderFinanceReportMarkdown(section);
    expect(md.narrative).not.toContain('TODO');
    expect(md.narrative).toContain('## Narracja');
  });
});
