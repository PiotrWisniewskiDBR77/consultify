/**
 * Z111 — financeRatioFamilyCatalog unit tests.
 *
 * Pure-function engine (no DB, nothing mocked): every expectation is
 * hand-computed from the production formula and shown inline, mirroring the
 * convention in extendedRatiosService.test.ts. Covers the three contracts
 * demanded by the concept doc (§3.1):
 *   1. complete canonical-line data → every ratio in the 5 families computes
 *   2. a missing canonical line → only the ratios that need it are
 *      `skipped` with value `null` (never silently 0 / guessed)
 *   3. the DuPont 3-step identity holds exactly: ROE = netMargin ×
 *      assetTurnover × equityMultiplier
 */
import { describe, expect, it } from 'vitest';

import {
  FINANCE_RATIO_FAMILY_CATALOG,
  type LineValueMap,
  computeDupontFromLines,
  computeFinanceRatioFamilyCatalog,
  groupByFamily,
} from '../../../server/src/services/financeRatioFamilyCatalog.js';

// Reference company — every identity below is hand-computed from these lines.
//   REVENUE=1000, COGS=600, GROSS_PROFIT=400, EBITDA=220, EBIT=180
//   EBT=120, TAX_EXPENSE=30 (effective tax rate 25%), NET_INCOME=90
//   CURRENT_ASSETS=500, CURRENT_LIABILITIES=250, INVENTORY=150, CASH=80
//   AR=120, AP=90, TOTAL_ASSETS=1200, TOTAL_EQUITY=600, TOTAL_DEBT=400
//   NET_DEBT=320 (=TOTAL_DEBT-CASH, given directly to exercise the
//   "prefer canonical line" path), INTEREST_EXPENSE=40, CAPEX=-60,
//   FREE_CASH_FLOW=100.
// NOPAT / INVESTED_CAPITAL are deliberately OMITTED so ROIC exercises the
// derivation fallback (NOPAT = EBIT×(1−|TAX_EXPENSE|/|EBT|), INVESTED_CAPITAL
// = TOTAL_EQUITY + NET_DEBT).
const COMPLETE: LineValueMap = {
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

function byCode(ratios: ReturnType<typeof computeFinanceRatioFamilyCatalog>, code: string) {
  const r = ratios.find((x) => x.code === code);
  if (!r) throw new Error(`ratio ${code} not found`);
  return r;
}

describe('FINANCE_RATIO_FAMILY_CATALOG registry shape', () => {
  it('declares at least 20 ratios across exactly the 5 concept families', () => {
    expect(FINANCE_RATIO_FAMILY_CATALOG.length).toBeGreaterThanOrEqual(20);
    const families = new Set(FINANCE_RATIO_FAMILY_CATALOG.map((d) => d.family));
    expect(families).toEqual(
      new Set(['liquidity', 'profitability', 'leverage', 'efficiency', 'value'])
    );
  });

  it('every entry has code/family/formula/direction/unit and a unique code', () => {
    const codes = new Set<string>();
    for (const def of FINANCE_RATIO_FAMILY_CATALOG) {
      expect(typeof def.code).toBe('string');
      expect(def.code.length).toBeGreaterThan(0);
      expect(['liquidity', 'profitability', 'leverage', 'efficiency', 'value']).toContain(
        def.family
      );
      expect(typeof def.formula).toBe('string');
      expect(['higher_better', 'lower_better']).toContain(def.direction);
      expect(['x', '%', 'days', 'currency', 'pp']).toContain(def.unit);
      expect(def.requiredLineCodes.length).toBeGreaterThan(0);
      codes.add(def.code);
    }
    expect(codes.size).toBe(FINANCE_RATIO_FAMILY_CATALOG.length);
  });

  it('matches the concept §3.1 family sizes: 4/6/5/5/4', () => {
    const grouped = groupByFamily(computeFinanceRatioFamilyCatalog(COMPLETE));
    expect(grouped.liquidity).toHaveLength(4);
    expect(grouped.profitability).toHaveLength(6);
    expect(grouped.leverage).toHaveLength(5);
    expect(grouped.efficiency).toHaveLength(5);
    expect(grouped.value).toHaveLength(4);
  });
});

describe('computeFinanceRatioFamilyCatalog — complete data', () => {
  const ratios = computeFinanceRatioFamilyCatalog(COMPLETE);

  it('computes every ratio except the WACC-dependent spread (no wacc supplied)', () => {
    const skipped = ratios.filter((r) => r.status === 'skipped');
    expect(skipped.map((r) => r.code)).toEqual(['ROIC_WACC_SPREAD']);
  });

  it('CURRENT_RATIO = 500 / 250 = 2', () => {
    expect(byCode(ratios, 'CURRENT_RATIO').value).toBeCloseTo(2, 10);
  });

  it('QUICK_RATIO = (500 − 150) / 250 = 1.4', () => {
    expect(byCode(ratios, 'QUICK_RATIO').value).toBeCloseTo(1.4, 10);
  });

  it('CASH_RATIO = 80 / 250 = 0.32', () => {
    expect(byCode(ratios, 'CASH_RATIO').value).toBeCloseTo(0.32, 10);
  });

  it('CCC = DSO + DIO − DPO = 43.8 + 91.25 − 54.75 = 80.3', () => {
    const dso = (120 / 1000) * 365; // 43.8
    const dio = (150 / 600) * 365; // 91.25
    const dpo = (90 / 600) * 365; // 54.75
    expect(byCode(ratios, 'CCC').value).toBeCloseTo(dso + dio - dpo, 4);
  });

  it('GROSS_MARGIN = 400/1000×100 = 40', () => {
    expect(byCode(ratios, 'GROSS_MARGIN').value).toBeCloseTo(40, 10);
  });

  it('EBITDA_MARGIN = 220/1000×100 = 22', () => {
    expect(byCode(ratios, 'EBITDA_MARGIN').value).toBeCloseTo(22, 10);
  });

  it('OPERATING_MARGIN = 180/1000×100 = 18', () => {
    expect(byCode(ratios, 'OPERATING_MARGIN').value).toBeCloseTo(18, 10);
  });

  it('NET_MARGIN = 90/1000×100 = 9', () => {
    expect(byCode(ratios, 'NET_MARGIN').value).toBeCloseTo(9, 10);
  });

  it('ROA = 90/1200×100 = 7.5', () => {
    expect(byCode(ratios, 'ROA').value).toBeCloseTo(7.5, 10);
  });

  it('ROE = 90/600×100 = 15', () => {
    expect(byCode(ratios, 'ROE').value).toBeCloseTo(15, 10);
  });

  it('DEBT_TO_EQUITY = 400/600 = 0.6667', () => {
    expect(byCode(ratios, 'DEBT_TO_EQUITY').value).toBeCloseTo(400 / 600, 4);
  });

  it('NET_DEBT_TO_EBITDA uses the canonical NET_DEBT line = 320/220', () => {
    expect(byCode(ratios, 'NET_DEBT_TO_EBITDA').value).toBeCloseTo(320 / 220, 4);
  });

  it('INTEREST_COVERAGE = 180/|−40|... = 180/40 = 4.5', () => {
    expect(byCode(ratios, 'INTEREST_COVERAGE').value).toBeCloseTo(4.5, 10);
  });

  it('NET_DEBT exposes the canonical figure directly = 320', () => {
    expect(byCode(ratios, 'NET_DEBT').value).toBeCloseTo(320, 10);
  });

  it('EQUITY_RATIO = 600/1200×100 = 50', () => {
    expect(byCode(ratios, 'EQUITY_RATIO').value).toBeCloseTo(50, 10);
  });

  it('ASSET_TURNOVER = 1000/1200 = 0.8333', () => {
    expect(byCode(ratios, 'ASSET_TURNOVER').value).toBeCloseTo(1000 / 1200, 4);
  });

  it('DSO = 120/1000×365 = 43.8', () => {
    expect(byCode(ratios, 'DSO').value).toBeCloseTo(43.8, 4);
  });

  it('DIO = 150/600×365 = 91.25', () => {
    expect(byCode(ratios, 'DIO').value).toBeCloseTo(91.25, 4);
  });

  it('DPO = 90/600×365 = 54.75', () => {
    expect(byCode(ratios, 'DPO').value).toBeCloseTo(54.75, 4);
  });

  it('WC_TURNOVER = 1000/(500−250) = 4', () => {
    expect(byCode(ratios, 'WC_TURNOVER').value).toBeCloseTo(4, 10);
  });

  it('ROIC derives NOPAT and INVESTED_CAPITAL when the canonical lines are absent: 135/920×100', () => {
    // NOPAT = EBIT × (1 − |TAX_EXPENSE|/|EBT|) = 180 × (1 − 30/120) = 180 × 0.75 = 135
    // INVESTED_CAPITAL = TOTAL_EQUITY + NET_DEBT = 600 + 320 = 920
    expect(byCode(ratios, 'ROIC').value).toBeCloseTo((135 / 920) * 100, 4);
  });

  it('ROIC prefers the canonical NOPAT/INVESTED_CAPITAL lines when present', () => {
    const withCanonical = computeFinanceRatioFamilyCatalog({
      ...COMPLETE,
      NOPAT: 200,
      INVESTED_CAPITAL: 1000,
    });
    expect(byCode(withCanonical, 'ROIC').value).toBeCloseTo(20, 10); // 200/1000×100
  });

  it('FCF_CONVERSION = 100/220×100 = 45.4545', () => {
    expect(byCode(ratios, 'FCF_CONVERSION').value).toBeCloseTo((100 / 220) * 100, 4);
  });

  it('CAPEX_TO_REVENUE = |−60|/1000×100 = 6', () => {
    expect(byCode(ratios, 'CAPEX_TO_REVENUE').value).toBeCloseTo(6, 10);
  });

  it('ROIC_WACC_SPREAD is skipped (null, not 0) without an explicit wacc input', () => {
    const spread = byCode(ratios, 'ROIC_WACC_SPREAD');
    expect(spread.value).toBeNull();
    expect(spread.status).toBe('skipped');
  });

  it('ROIC_WACC_SPREAD computes once a wacc% is supplied: ROIC% − WACC%', () => {
    const withWacc = computeFinanceRatioFamilyCatalog(COMPLETE, { waccPct: 10 });
    const roicPct = (135 / 920) * 100;
    expect(byCode(withWacc, 'ROIC_WACC_SPREAD').value).toBeCloseTo(roicPct - 10, 4);
    expect(byCode(withWacc, 'ROIC_WACC_SPREAD').status).toBe('computed');
  });
});

describe('computeFinanceRatioFamilyCatalog — missing data is skipped, never guessed', () => {
  it('dropping INVENTORY skips only inventory-dependent ratios; CURRENT_RATIO still computes', () => {
    const { INVENTORY: _drop, ...withoutInventory } = COMPLETE;
    const ratios = computeFinanceRatioFamilyCatalog(withoutInventory);

    for (const code of ['QUICK_RATIO', 'CCC', 'DIO']) {
      const r = byCode(ratios, code);
      expect(r.value).toBeNull();
      expect(r.status).toBe('skipped');
      expect(r.missingLineCodes).toContain('INVENTORY');
    }

    // Unaffected ratios keep computing — a missing line must not zero out
    // ratios that never referenced it.
    expect(byCode(ratios, 'CURRENT_RATIO').value).toBeCloseTo(2, 10);
    expect(byCode(ratios, 'CASH_RATIO').value).toBeCloseTo(0.32, 10);
  });

  it('dropping TOTAL_EQUITY skips every equity-dependent ratio and the DuPont decomposition, never substitutes 0', () => {
    const { TOTAL_EQUITY: _drop, ...withoutEquity } = COMPLETE;
    const ratios = computeFinanceRatioFamilyCatalog(withoutEquity);

    for (const code of ['ROE', 'DEBT_TO_EQUITY', 'EQUITY_RATIO']) {
      const r = byCode(ratios, code);
      expect(r.value).toBeNull();
      expect(r.status).toBe('skipped');
    }
    // ROA does not depend on equity — must still compute normally.
    expect(byCode(ratios, 'ROA').value).toBeCloseTo(7.5, 10);

    // ROIC falls back to NOPAT + (TOTAL_EQUITY + NET_DEBT); without equity
    // AND without a canonical INVESTED_CAPITAL line it must also skip
    // rather than silently treating equity as 0.
    expect(byCode(ratios, 'ROIC').value).toBeNull();
    expect(byCode(ratios, 'ROIC').status).toBe('skipped');

    const dupont = computeDupontFromLines(withoutEquity);
    expect(dupont.status).toBe('skipped');
    expect(dupont.roe).toBeNull();
    expect(dupont.missingLineCodes).toContain('TOTAL_EQUITY');
  });

  it('an empty value map skips every ratio with value null (never 0)', () => {
    const ratios = computeFinanceRatioFamilyCatalog({});
    expect(ratios).toHaveLength(FINANCE_RATIO_FAMILY_CATALOG.length);
    for (const r of ratios) {
      expect(r.value).toBeNull();
      expect(r.status).toBe('skipped');
    }
  });
});

describe('computeDupontFromLines — 3-step ROE identity', () => {
  it('netMargin × assetTurnover × equityMultiplier reproduces ROE exactly', () => {
    const dupont = computeDupontFromLines(COMPLETE);
    expect(dupont.status).toBe('computed');

    const netMarginFraction = 90 / 1000; // 0.09
    const assetTurnover = 1000 / 1200; // 0.83333...
    const equityMultiplier = 1200 / 600; // 2
    const expectedRoePct = netMarginFraction * assetTurnover * equityMultiplier * 100; // 15

    expect(dupont.roe).toBeCloseTo(expectedRoePct, 4);
    expect(dupont.roe).toBeCloseTo(15, 4);
    // Cross-check against the flat catalog's direct ROE ratio (90/600×100 = 15).
    const flatRoe = byCode(computeFinanceRatioFamilyCatalog(COMPLETE), 'ROE').value;
    expect(dupont.roe).toBeCloseTo(flatRoe as number, 4);

    expect(dupont.netMarginPct).toBeCloseTo(9, 10);
    expect(dupont.assetTurnover).toBeCloseTo(assetTurnover, 4);
    expect(dupont.equityMultiplier).toBeCloseTo(2, 10);

    // Re-multiply the returned components to double-check the identity holds
    // on the ROUNDED output too (not just the raw internal computation).
    const recombined =
      (dupont.netMarginPct! / 100) * dupont.assetTurnover! * dupont.equityMultiplier!;
    expect(recombined * 100).toBeCloseTo(dupont.roe as number, 1);
  });

  it('is skipped (not partially computed) when any required line is missing', () => {
    const { REVENUE: _drop, ...withoutRevenue } = COMPLETE;
    const dupont = computeDupontFromLines(withoutRevenue);
    expect(dupont.status).toBe('skipped');
    expect(dupont.roe).toBeNull();
    expect(dupont.netMarginPct).toBeNull();
    expect(dupont.assetTurnover).toBeNull();
    expect(dupont.equityMultiplier).toBeNull();
  });
});
