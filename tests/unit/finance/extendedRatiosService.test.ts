/**
 * M16/7.2 + 7.3 — extendedRatiosService unit tests.
 *
 * Pure-function service (no DB, nothing mocked). Every expectation is
 * hand-computed from the production formula and shown inline so a regression
 * in any extended ratio / DuPont identity / benchmark bucket fails here.
 */
import { describe, expect, it } from 'vitest';

import {
  type ExtendedFinancials,
  benchmarkStatus,
  computeExtendedRatios,
  dupontDecomposition,
} from '../../../server/src/services/extendedRatiosService.js';

// Reference company used across the suite.
//   netIncome = 120, equity = 600, totalAssets = 1000
//   ebit = 200, ebitda = 260, debt = 300, cash = 50
//   revenue = 800, fixedAssets = 400, taxRatePct = 20
const FIN: ExtendedFinancials = {
  netIncome: 120,
  equity: 600,
  totalAssets: 1000,
  ebit: 200,
  ebitda: 260,
  debt: 300,
  cash: 50,
  revenue: 800,
  fixedAssets: 400,
  taxRatePct: 20,
};

function byCode(fin: ExtendedFinancials, code: string) {
  const r = computeExtendedRatios(fin).find((x) => x.code === code);
  if (!r) throw new Error(`ratio ${code} not found`);
  return r;
}

describe('computeExtendedRatios', () => {
  it('computes ROE = netIncome / equity', () => {
    // 120 / 600 = 0.2
    expect(byCode(FIN, 'roe').value).toBeCloseTo(0.2, 10);
  });

  it('computes ROA = netIncome / totalAssets', () => {
    // 120 / 1000 = 0.12
    expect(byCode(FIN, 'roa').value).toBeCloseTo(0.12, 10);
  });

  it('computes ROIC = NOPAT / investedCapital', () => {
    // NOPAT = ebit*(1-0.20) = 200*0.8 = 160
    // investedCapital = equity + (debt - cash) = 600 + (300 - 50) = 850
    // 160 / 850 = 0.18823529...
    expect(byCode(FIN, 'roic').value).toBeCloseTo(160 / 850, 10);
  });

  it('computes ROCE = ebit / (equity + debt)', () => {
    // 200 / (600 + 300) = 200 / 900 = 0.22222...
    expect(byCode(FIN, 'roce').value).toBeCloseTo(200 / 900, 10);
  });

  it('computes D/E = debt / equity', () => {
    // 300 / 600 = 0.5
    expect(byCode(FIN, 'debt_to_equity').value).toBeCloseTo(0.5, 10);
  });

  it('computes equity ratio = equity / totalAssets', () => {
    // 600 / 1000 = 0.6
    expect(byCode(FIN, 'equity_ratio').value).toBeCloseTo(0.6, 10);
  });

  it('computes net debt / EBITDA = (debt - cash) / ebitda', () => {
    // (300 - 50) / 260 = 250 / 260 = 0.96153...
    expect(byCode(FIN, 'net_debt_to_ebitda').value).toBeCloseTo(250 / 260, 10);
  });

  it('computes DSCR = ebitda / debt', () => {
    // 260 / 300 = 0.86666...
    expect(byCode(FIN, 'dscr').value).toBeCloseTo(260 / 300, 10);
  });

  it('computes asset turnover = revenue / totalAssets', () => {
    // 800 / 1000 = 0.8
    expect(byCode(FIN, 'asset_turnover').value).toBeCloseTo(0.8, 10);
  });

  it('computes fixed-asset turnover = revenue / fixedAssets', () => {
    // 800 / 400 = 2
    expect(byCode(FIN, 'fixed_asset_turnover').value).toBeCloseTo(2, 10);
  });

  it('returns all ten extended ratios with a valid shape', () => {
    const ratios = computeExtendedRatios(FIN);
    expect(ratios).toHaveLength(10);
    for (const r of ratios) {
      expect(typeof r.code).toBe('string');
      expect(typeof r.label).toBe('string');
      expect(['return', 'leverage', 'coverage', 'efficiency']).toContain(
        r.category,
      );
      expect(['ok', 'warn', 'critical']).toContain(r.status);
    }
  });

  it('flags a healthy ROE as ok and a loss-making ROE as critical', () => {
    expect(byCode(FIN, 'roe').status).toBe('ok'); // 0.2 >= 0.1
    const loss = byCode({ ...FIN, netIncome: -50 }, 'roe');
    expect(loss.value).toBeCloseTo(-50 / 600, 10);
    expect(loss.status).toBe('critical'); // negative < 0
  });

  it('guards division by zero (equity = 0 → ROE null, status critical)', () => {
    const r = byCode({ ...FIN, equity: 0 }, 'roe');
    expect(r.value).toBeNull();
    expect(r.status).toBe('critical');
  });
});

describe('dupontDecomposition', () => {
  it('decomposes ROE into netMargin × assetTurnover × equityMultiplier', () => {
    const d = dupontDecomposition(FIN);
    // netMargin = 120/800 = 0.15
    // assetTurnover = 800/1000 = 0.8
    // equityMultiplier = 1000/600 = 1.66666...
    expect(d.netMargin).toBeCloseTo(0.15, 10);
    expect(d.assetTurnover).toBeCloseTo(0.8, 10);
    expect(d.equityMultiplier).toBeCloseTo(1000 / 600, 10);
  });

  it('product of the three factors equals ROE (identity holds)', () => {
    const d = dupontDecomposition(FIN);
    const product =
      (d.netMargin as number) *
      (d.assetTurnover as number) *
      (d.equityMultiplier as number);
    expect(product).toBeCloseTo(d.roe as number, 10);
    // and ROE matches the direct definition netIncome/equity = 0.2
    expect(d.roe).toBeCloseTo(0.2, 10);
  });

  it('falls back to direct ROE when a factor is undefined (equity = 0)', () => {
    // equity = 0 → equityMultiplier = totalAssets/0 → null, so the product
    // path is unusable and we fall back to direct ROE = netIncome/equity,
    // which is also null. The decomposition must not throw or yield NaN.
    const d = dupontDecomposition({ ...FIN, equity: 0 });
    expect(d.equityMultiplier).toBeNull();
    expect(d.roe).toBeNull();
  });

  it('netMargin is null when revenue = 0 (guarded division)', () => {
    const d = dupontDecomposition({ ...FIN, revenue: 0 });
    expect(d.netMargin).toBeNull(); // 120 / 0 → null
    expect(d.assetTurnover).toBeCloseTo(0, 10); // 0 / 1000 → 0 (finite)
    // product path unusable (netMargin null) → fall back to direct ROE = 0.2
    expect(d.roe).toBeCloseTo(0.2, 10);
  });
});

describe('benchmarkStatus', () => {
  const bm = { p25: 5, median: 10, p75: 15 };

  it('value below p25 → below / critical', () => {
    expect(benchmarkStatus(3, bm)).toEqual({
      percentile: 'below',
      status: 'critical',
    });
  });

  it('value in [p25, median) → p25 / warn', () => {
    expect(benchmarkStatus(7, bm)).toEqual({
      percentile: 'p25',
      status: 'warn',
    });
  });

  it('value at p25 exactly → p25 / warn', () => {
    expect(benchmarkStatus(5, bm)).toEqual({
      percentile: 'p25',
      status: 'warn',
    });
  });

  it('value in [median, p75) → median / ok', () => {
    expect(benchmarkStatus(12, bm)).toEqual({
      percentile: 'median',
      status: 'ok',
    });
  });

  it('value at median exactly → median / ok', () => {
    expect(benchmarkStatus(10, bm)).toEqual({
      percentile: 'median',
      status: 'ok',
    });
  });

  it('value at p75 exactly → p75 / ok', () => {
    expect(benchmarkStatus(15, bm)).toEqual({
      percentile: 'p75',
      status: 'ok',
    });
  });

  it('value above p75 → above / ok', () => {
    expect(benchmarkStatus(20, bm)).toEqual({
      percentile: 'above',
      status: 'ok',
    });
  });

  it('non-finite value → below / critical', () => {
    expect(benchmarkStatus(NaN, bm)).toEqual({
      percentile: 'below',
      status: 'critical',
    });
  });
});
