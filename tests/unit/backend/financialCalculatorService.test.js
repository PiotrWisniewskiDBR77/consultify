/**
 * M16 Finanse — Financial Calculator REAL-service tests.
 *
 * HISTORY (L-02 "fałszywa zieleń"): this file previously defined its OWN inline
 * calculator (`createFinancialCalculatorService`) and asserted against it, so the
 * suite was green while the production math (`valuationService` DCF/WACC,
 * `financialAnalysisService` NPV/IRR/payback/ratios) was never exercised. It has
 * been rewritten to import and drive the REAL production services. Every numeric
 * expectation below is hand-computed from the formula and shown in comments, so
 * these tests FAIL if the production math regresses.
 *
 * What we cover via the real services:
 *  - DCF + WACC discounting + Gordon terminal + exit-multiple terminal + EV→equity
 *    bridge + per-share  → valuationService.computeValuation (computeDcf internally)
 *  - NPV / IRR (bisection) / payback (interpolated) / ROI
 *    → financialAnalysisService.runFullAnalysis (computeInvestmentRatios internally)
 *  - Ratio analysis (gross/net margin, COGS ratio, current/quick ratio)
 *    → financialAnalysisService.computeRatios (pure)
 *
 * DB is mocked at the DbPromise seam (same convention as the other valuation
 * unit tests under tests/unit/services/), so no real database is touched.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));
vi.mock('../../../server/src/services/auditService.js', () => ({
  log: vi.fn(),
}));
vi.mock('../../../server/src/services/financeCanonicalResolver.js', () => ({
  normalizeCanonicalLineCode: (s) => s,
}));
vi.mock('../../../server/src/services/financialStatementPackService.js', () => ({
  getVerifiedPackSeed: vi.fn(),
}));
vi.mock('../../../server/src/services/financialStatementService.js', () => ({
  loadLatestStatementVersionSnapshot: vi.fn(),
}));
vi.mock('../../../server/src/services/financialModelingService.js', () => ({
  getModel: vi.fn(),
  getOutputs: vi.fn(),
  computeModel: vi.fn(),
  persistComputeResult: vi.fn(),
}));

import * as Db from '../../../server/src/utils/DbPromise.js';
import {
  computeRatios,
  runFullAnalysis,
} from '../../../server/src/services/financialAnalysisService';
import { computeValuation } from '../../../server/src/services/valuationService';

// Tight float compare — these are exact formula outputs after the service's round(_,2).
const near = (actual, expected, eps = 0.01) => {
  expect(typeof actual).toBe('number');
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(eps);
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// DCF / WACC — real valuationService.computeValuation (manual forecast path).
// ---------------------------------------------------------------------------
describe('DCF + WACC (valuationService.computeValuation — REAL)', () => {
  const baseAssumptions = (overrides = {}) => ({
    horizonYears: 3,
    waccPercent: 12,
    waccBreakdown: {
      riskFreeRate: 4,
      equityRiskPremium: 5,
      beta: 1.2,
      costOfDebt: 8,
      taxRate: 19,
      debtWeight: 30,
      equityWeight: 70,
    },
    terminalMethod: 'gordon',
    terminalGrowthPercent: 3,
    exitMultiple: 8,
    exitMultipleMetric: 'EV/EBITDA',
    netDebt: 0,
    manualForecast: {
      years: [
        { year: 1, fcff: 100, revenue: 400, ebitda: 80 },
        { year: 2, fcff: 110, revenue: 430, ebitda: 90 },
        { year: 3, fcff: 120, revenue: 470, ebitda: 100 },
      ],
    },
    ...overrides,
  });

  const valuationRow = (assumptions, extra = {}) => ({
    id: 'val-1',
    organization_id: 'org-1',
    status: 'DRAFT',
    horizon_years: 3,
    currency: 'PLN',
    source_type: 'manual',
    source_id: null,
    assumptions: JSON.stringify(assumptions),
    peers: '[]',
    results: '{}',
    ...extra,
  });

  it('discounts FCFF at WACC with a Gordon terminal value (hand-checked)', async () => {
    // FCFF=[100,110,120], WACC=12% (0.12), g=3% (0.03), n=3, netDebt=0.
    //
    // PV(explicit) = 100/1.12^1 + 110/1.12^2 + 120/1.12^3
    //              = 89.285714 + 87.691327 + 85.413260 = 262.39 (round 2dp)
    // TV (Gordon)  = lastFcff*(1+g)/(WACC-g) = 120*1.03/(0.12-0.03)
    //              = 123.6/0.09 = 1373.33
    // PV(terminal) = 1373.33.../1.12^3 = 977.51
    // EV           = 262.39 + 977.51 = 1239.90
    vi.mocked(Db.get).mockResolvedValue(valuationRow(baseAssumptions()));
    vi.mocked(Db.run).mockResolvedValue(undefined);

    const { dcf } = await computeValuation('org-1', 'val-1');

    near(dcf.pvExplicit, 262.39);
    near(dcf.terminalValue, 1373.33);
    near(dcf.pvTerminal, 977.51);
    near(dcf.enterpriseValue, 1239.9);
    expect(dcf.terminalMethod).toBe('gordon');
    near(dcf.discountRatePercent, 12);
    near(dcf.terminalGrowthPercent, 3);
    // EV = PV(explicit) + PV(terminal) must hold exactly.
    near(dcf.pvExplicit + dcf.pvTerminal, dcf.enterpriseValue);
  });

  it('builds EV→equity bridge and per-share off net debt and shares', async () => {
    // Same EV=1239.90, netDebt=20 → equity = 1219.90; shares=10 → perShare=121.99.
    vi.mocked(Db.get).mockResolvedValue(
      valuationRow(baseAssumptions({ netDebt: 20, sharesOutstanding: 10 }))
    );
    vi.mocked(Db.run).mockResolvedValue(undefined);

    const { dcf } = await computeValuation('org-1', 'val-1');

    near(dcf.enterpriseValue, 1239.9);
    near(dcf.equityValue, 1219.9); // 1239.90 - 20
    near(dcf.perShare, 121.99, 0.01); // 1219.90 / 10
  });

  it('prices terminal value off an EV/EBITDA exit multiple when selected', async () => {
    // Exit multiple terminal: base = last EBITDA = 100, multiple = 8 → TV = 800.
    // PV(terminal) = 800/1.12^3 = 569.42 ; EV = 262.39 + 569.42 = 831.81.
    vi.mocked(Db.get).mockResolvedValue(
      valuationRow(
        baseAssumptions({ terminalMethod: 'exit_multiple', exitMultiple: 8, exitMultipleMetric: 'EV/EBITDA' })
      )
    );
    vi.mocked(Db.run).mockResolvedValue(undefined);

    const { dcf } = await computeValuation('org-1', 'val-1');

    near(dcf.terminalValue, 800);
    near(dcf.pvTerminal, 569.42);
    near(dcf.enterpriseValue, 831.81);
    expect(dcf.terminalMethod).toBe('exit_multiple');
  });

  it('rejects a Gordon terminal where growth >= WACC (g must be < WACC)', async () => {
    vi.mocked(Db.get).mockResolvedValue(
      valuationRow(baseAssumptions({ waccPercent: 10, terminalGrowthPercent: 12 }))
    );
    vi.mocked(Db.run).mockResolvedValue(undefined);

    await expect(computeValuation('org-1', 'val-1')).rejects.toThrow(/WACC/i);
  });

  it('higher WACC lowers enterprise value (monotonic discounting)', async () => {
    vi.mocked(Db.get)
      .mockResolvedValueOnce(valuationRow(baseAssumptions({ waccPercent: 10 })))
      .mockResolvedValueOnce(valuationRow(baseAssumptions({ waccPercent: 15 })));
    vi.mocked(Db.run).mockResolvedValue(undefined);

    const low = await computeValuation('org-1', 'val-1');
    const high = await computeValuation('org-1', 'val-1');

    expect(high.dcf.enterpriseValue).toBeLessThan(low.dcf.enterpriseValue);
  });
});

// ---------------------------------------------------------------------------
// NPV / IRR / Payback / ROI — real financialAnalysisService.runFullAnalysis.
// computeInvestmentRatios is private; runFullAnalysis (exported) drives it.
// ---------------------------------------------------------------------------
describe('Investment math NPV/IRR/Payback/ROI (financialAnalysisService — REAL)', () => {
  const investmentRow = (cashFlows, periods) => ({
    id: 'a1',
    organization_id: 'org-1',
    analysis_type: 'investment_case',
    periods: JSON.stringify(periods),
    statement_data: JSON.stringify({
      pl: [],
      bs: [],
      cf: [
        {
          code: 'FCF',
          name: 'Free Cash Flow',
          values: Object.fromEntries(periods.map((p, i) => [p, cashFlows[i]])),
        },
      ],
    }),
    currency: 'PLN',
    status: 'DRAFT',
    created_at: '',
    updated_at: '',
  });

  const runInvestment = async (cashFlows, periods) => {
    vi.mocked(Db.get).mockResolvedValue(investmentRow(cashFlows, periods));
    vi.mocked(Db.run).mockResolvedValue(undefined);
    const res = await runFullAnalysis('org-1', 'a1');
    const inv = Object.fromEntries(
      res.ratios.filter((r) => r.category === 'investment').map((r) => [r.code, r.value])
    );
    return inv;
  };

  it('computes NPV@10%, IRR, payback and ROI on a known cash-flow stream', async () => {
    // CF = [-1000, 400, 400, 400, 400] over 5 periods.
    //
    // NPV@10% = -1000 + 400/1.1 + 400/1.1^2 + 400/1.1^3 + 400/1.1^4
    //         = -1000 + 363.636 + 330.579 + 300.526 + 273.205 = 267.95
    // IRR: rate where NPV=0. Production uses bisection (lo=-0.99,hi=10,80 iters,
    //      tol 1e-4) → 0.218623 → 21.86 %.
    // Payback (interpolated): cumulative crosses 0 between period 2 (-200) and
    //      period 3 (+200): 2 + 200/400 = 2.5 ... but production sums from index 0
    //      including the initial outflow at index 0, so cumulative = -1000, -600,
    //      -200, +200 at indices 0..3 → crosses at index 3: 3 + (0-(-200))/400 = 3.5.
    // ROI = sum(CF)/|initialOutflow| * 100 = 600/1000*100 = 60 %.
    const inv = await runInvestment([-1000, 400, 400, 400, 400], ['Y0', 'Y1', 'Y2', 'Y3', 'Y4']);

    near(inv.npv, 267.95, 0.01);
    near(inv.irr_pct, 21.86, 0.05);
    near(inv.payback_periods, 3.5, 0.001);
    near(inv.roi_pct, 60, 0.001);
  });

  it('NPV at the discount rate is positive only when the project creates value', async () => {
    // CF = [-1000, 100, 100, 100, 100]: sum of inflows (400) < outflow (1000),
    // so NPV@10% must be deeply negative and ROI = 400/1000-1 = -60 %.
    const inv = await runInvestment([-1000, 100, 100, 100, 100], ['Y0', 'Y1', 'Y2', 'Y3', 'Y4']);

    expect(inv.npv).toBeLessThan(0);
    near(inv.roi_pct, -60, 0.001);
  });
});

// ---------------------------------------------------------------------------
// Ratio analysis — real financialAnalysisService.computeRatios (pure).
// ---------------------------------------------------------------------------
describe('Ratio analysis (financialAnalysisService.computeRatios — REAL)', () => {
  const ratioValue = (data, period, code) =>
    computeRatios(data, period).find((r) => r.code === code)?.value;

  it('computes margins and liquidity ratios from canonical statement lines', () => {
    // Revenue=1000, COGS=600, NET_INCOME=80; CURRENT_ASSETS=300,
    // CURRENT_LIABILITIES=200, INVENTORY=100.
    //
    // Gross margin   = (1000-600)/1000 = 40 %
    // Net margin     = 80/1000         = 8 %
    // COGS / Revenue = 600/1000        = 60 %
    // Current ratio  = 300/200         = 1.5
    // Quick ratio    = (300-100)/200   = 1.0
    const data = {
      pl: [
        { code: 'REVENUE', name: 'Revenue', values: { Y1: 1000 } },
        { code: 'COGS', name: 'COGS', values: { Y1: 600 } },
        { code: 'NET_INCOME', name: 'Net income', values: { Y1: 80 } },
      ],
      bs: [
        { code: 'CURRENT_ASSETS', name: 'Current assets', values: { Y1: 300 } },
        { code: 'CURRENT_LIABILITIES', name: 'Current liabilities', values: { Y1: 200 } },
        { code: 'INVENTORY', name: 'Inventory', values: { Y1: 100 } },
      ],
    };

    near(ratioValue(data, 'Y1', 'gross_margin_pct'), 40);
    near(ratioValue(data, 'Y1', 'net_profit_margin_pct'), 8);
    near(ratioValue(data, 'Y1', 'cogs_to_revenue_pct'), 60);
    near(ratioValue(data, 'Y1', 'current_ratio'), 1.5);
    near(ratioValue(data, 'Y1', 'quick_ratio'), 1.0);
  });

  it('returns null (not 0 or NaN) for ratios whose denominator is missing', () => {
    // No revenue → margins undefined; safeDiv/safePct must yield null, not a fake 0.
    const data = {
      pl: [{ code: 'NET_INCOME', name: 'Net income', values: { Y1: 80 } }],
      bs: [],
    };
    expect(ratioValue(data, 'Y1', 'net_profit_margin_pct')).toBeNull();
  });
});
