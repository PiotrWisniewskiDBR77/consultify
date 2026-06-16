/**
 * M16 Finanse — BOUNDARY / EDGE math against the REAL production services.
 *
 * Companion to financialCalculatorService.test.js (happy-path, hand-checked).
 * This file pins the *edges* — the places where bad inputs historically leak
 * NaN / Infinity / bogus roots into a financial deliverable. Every expectation
 * is hand-computed from the production formula and shown in comments, so a
 * regression at any edge FAILS here rather than silently shipping garbage.
 *
 * Production services exercised (no DB touched — DbPromise is mocked at the
 * same seam as the other valuation unit tests):
 *   - valuationService.computeValuation  → computeDcf (DCF/WACC/Gordon/exit/clamp)
 *   - financialAnalysisService.runFullAnalysis → computeInvestmentRatios (NPV/IRR)
 *   - financialAnalysisService.computeRatios     (ratio safeDiv/safePct null-guards)
 *   - financialAnalysisService.computeVerticalAnalysis / computeHorizontalAnalysis
 *   - financeCompositeScores.computeWaccInputs   (WACC weights: zero debt / equity)
 *   - financialStatementService.validateStatement (import: dup lines / missing totals)
 *
 * VERIFY-FIRST findings (see agent report for CONFIRMED/PARTIAL/NOT-REPRODUCED):
 *  - safeDiv guards ZERO denominators (returns null) but NOT negative ones — a
 *    negative denominator yields a finite (mathematically valid) ratio, never
 *    NaN/Infinity. We assert the honest behavior, not the prompt's loose wording.
 *  - waccBreakdown weights in valuationService are stored METADATA only; the DCF
 *    discount rate is `assumptions.waccPercent` directly. The real "WACC weights"
 *    math with zero-debt / zero-equity guards lives in computeWaccInputs.
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
// Keep the REAL financialStatementService (we exercise validateStatement directly)
// and only stub the DB-hitting snapshot loader used by financialAnalysisService.
vi.mock('../../../server/src/services/financialStatementService.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    loadLatestStatementVersionSnapshot: vi.fn(),
  };
});
vi.mock('../../../server/src/services/financialModelingService.js', () => ({
  getModel: vi.fn(),
  getOutputs: vi.fn(),
  computeModel: vi.fn(),
  persistComputeResult: vi.fn(),
}));

import * as Db from '../../../server/src/utils/DbPromise.js';
import {
  computeHorizontalAnalysis,
  computeRatios,
  computeVerticalAnalysis,
  runFullAnalysis,
} from '../../../server/src/services/financialAnalysisService';
import { computeWaccInputs } from '../../../server/src/services/financeCompositeScores';
import { computeValuation } from '../../../server/src/services/valuationService';
// validateStatement is a server-only (non-mocked) import; resolved via the real
// module path so the import mock above (loadLatestStatementVersionSnapshot only)
// does not shadow it. We import the real symbol directly here.
import { validateStatement } from '../../../server/src/services/financialStatementService';

const near = (actual, expected, eps = 0.01) => {
  expect(typeof actual).toBe('number');
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(eps);
};

const finite = (n) => Number.isFinite(n);

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// 1. RATIOS — zero / negative denominators must never produce NaN or Infinity.
// ===========================================================================
describe('computeRatios — denominator edge cases (REAL)', () => {
  const ratio = (data, period, code) =>
    computeRatios(data, period).find((r) => r.code === code);

  it('zero current liabilities → current/quick ratio = null (not Infinity)', () => {
    // safeDiv(ca, cl) with cl=0 → null. Production: `if (!d || d === 0) return null`.
    const data = {
      pl: [{ code: 'REVENUE', name: 'Rev', values: { Y1: 1000 } }],
      bs: [
        { code: 'CURRENT_ASSETS', name: 'CA', values: { Y1: 300 } },
        { code: 'CURRENT_LIABILITIES', name: 'CL', values: { Y1: 0 } },
        { code: 'INVENTORY', name: 'Inv', values: { Y1: 50 } },
      ],
    };
    expect(ratio(data, 'Y1', 'current_ratio').value).toBeNull();
    expect(ratio(data, 'Y1', 'quick_ratio').value).toBeNull();
  });

  it('zero revenue → every margin ratio = null (not NaN)', () => {
    // safePct(n, 0) → safeDiv returns null → null. No 0/0 NaN leak.
    const data = {
      pl: [
        { code: 'REVENUE', name: 'Rev', values: { Y1: 0 } },
        { code: 'COGS', name: 'COGS', values: { Y1: 600 } },
        { code: 'NET_INCOME', name: 'NI', values: { Y1: 80 } },
        { code: 'EBITDA', name: 'EBITDA', values: { Y1: 120 } },
      ],
      bs: [],
    };
    for (const code of [
      'gross_margin_pct',
      'ebitda_margin_pct',
      'net_profit_margin_pct',
      'cogs_to_revenue_pct',
      'contribution_margin_pct',
    ]) {
      expect(ratio(data, 'Y1', code).value).toBeNull();
    }
  });

  it('zero EBITDA → debt/EBITDA and OCF/EBITDA = null; zero interest → coverage = null', () => {
    // safeDiv(td, 0)=null ; safeDiv(operatingCf, 0)=null ; safeDiv(ebit, 0)=null.
    const data = {
      pl: [
        { code: 'REVENUE', name: 'Rev', values: { Y1: 1000 } },
        { code: 'EBITDA', name: 'EBITDA', values: { Y1: 0 } },
        { code: 'EBIT', name: 'EBIT', values: { Y1: 0 } },
        { code: 'INTEREST_EXPENSE', name: 'Int', values: { Y1: 0 } },
      ],
      bs: [{ code: 'TOTAL_DEBT', name: 'Debt', values: { Y1: 500 } }],
      cf: [{ code: 'OPERATING_CF', name: 'OCF', values: { Y1: 200 } }],
    };
    expect(ratio(data, 'Y1', 'debt_to_ebitda').value).toBeNull();
    expect(ratio(data, 'Y1', 'operating_cf_to_ebitda').value).toBeNull();
    expect(ratio(data, 'Y1', 'interest_coverage').value).toBeNull();
  });

  it('NEGATIVE denominator → finite ratio (NOT null, NOT NaN/Infinity)', () => {
    // VERIFY-FIRST: safeDiv only guards `!d || d === 0`. A negative denom is
    // truthy, so it returns a real number. Negative revenue (a credit-balance
    // contra/refund period) → net margin = 80 / -1000 = -0.08 → -8 %.
    // This is the HONEST production behavior; assert it stays finite, not null.
    const data = {
      pl: [
        { code: 'REVENUE', name: 'Rev', values: { Y1: -1000 } },
        { code: 'NET_INCOME', name: 'NI', values: { Y1: 80 } },
      ],
      bs: [],
    };
    const nm = ratio(data, 'Y1', 'net_profit_margin_pct').value;
    expect(nm).not.toBeNull();
    expect(finite(nm)).toBe(true);
    near(nm, -8); // 80 / -1000 * 100
  });

  it('every computed ratio value is null or finite — never NaN/Infinity (sweep)', () => {
    // Adversarial mix of zeros that historically produced 0/0 and x/0.
    const data = {
      pl: [
        { code: 'REVENUE', name: 'Rev', values: { Y1: 0 } },
        { code: 'COGS', name: 'COGS', values: { Y1: 0 } },
        { code: 'EBITDA', name: 'EBITDA', values: { Y1: 0 } },
      ],
      bs: [
        { code: 'CURRENT_ASSETS', name: 'CA', values: { Y1: 0 } },
        { code: 'CURRENT_LIABILITIES', name: 'CL', values: { Y1: 0 } },
        { code: 'INVENTORY', name: 'Inv', values: { Y1: 0 } },
        { code: 'TOTAL_DEBT', name: 'Debt', values: { Y1: 0 } },
      ],
      cf: [],
    };
    for (const r of computeRatios(data, 'Y1')) {
      if (r.value === null) continue;
      expect(Number.isNaN(r.value)).toBe(false);
      expect(Number.isFinite(r.value)).toBe(true);
    }
  });
});

// ===========================================================================
// 2. NPV / IRR — no sign change & all-negative streams must yield IRR=null.
// ===========================================================================
describe('computeInvestmentRatios — IRR / NPV edge cases (REAL via runFullAnalysis)', () => {
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
    return Object.fromEntries(
      res.ratios.filter((r) => r.category === 'investment').map((r) => [r.code, r.value])
    );
  };

  it('all-negative cash flows → NPV<0 and IRR=null (no bogus root)', async () => {
    // CF = [-1000, -50, -50, -50]. There is NO rate in [-0.99, 10] where NPV=0
    // (every term is negative for any rate), so the bisection guard
    // `lowNpv * highNpv < 0` is FALSE → irr stays null → irr_pct = null.
    // initialInvestment = |-1000| = 1000 (>0) so the block still runs (not skipped).
    const inv = await runInvestment([-1000, -50, -50, -50], ['Y0', 'Y1', 'Y2', 'Y3']);
    expect(inv.irr_pct).toBeNull();
    expect(inv.npv).toBeLessThan(0);
    expect(finite(inv.npv)).toBe(true);
  });

  it('deep-underwater stream still yields a FINITE IRR root, never NaN/Infinity', async () => {
    // VERIFY-FIRST correction: CF = [-1000, 10, 10, 10, 10] is NOT "no sign change".
    // npvAt(low=-0.99) = -1000 + 10/0.01 + 10/0.01^2 + ... is hugely POSITIVE, while
    // npvAt(high=10) is negative → the bracket DOES bracket a root, so bisection
    // legitimately finds a deeply negative IRR (~ -64.9 %). The boundary contract we
    // pin here is that the root stays FINITE (no NaN/Infinity leak from the loop) and
    // that NPV@10% is still deeply negative for a value-destroying project.
    const inv = await runInvestment(
      [-1000, 10, 10, 10, 10],
      ['Y0', 'Y1', 'Y2', 'Y3', 'Y4']
    );
    expect(inv.irr_pct).not.toBeNull();
    expect(finite(inv.irr_pct)).toBe(true);
    expect(inv.irr_pct).toBeLessThan(0); // value-destroying → negative IRR
    expect(inv.npv).toBeLessThan(0);
  });

  it('all-positive cash flows → investment ratios suppressed entirely (no initial investment)', async () => {
    // CF = [100, 100, 100]. There is no negative flow, and CAPEX line is absent, so
    // `initialInvestment` = 0 → computeInvestmentRatios returns [] → NO npv/irr/roi
    // rows at all (the service refuses to fabricate an investment case). Asserting
    // absence proves we never divide by a zero initial-investment for ROI.
    const inv = await runInvestment([100, 100, 100], ['Y0', 'Y1', 'Y2']);
    expect(inv.npv).toBeUndefined();
    expect(inv.irr_pct).toBeUndefined();
    expect(inv.roi_pct).toBeUndefined();
  });

  it('all-zero cash flows → investment ratios suppressed entirely', async () => {
    // cashFlows.every(v=>v===0) → early return [] → no rows, no NaN ROI.
    const inv = await runInvestment([0, 0, 0], ['Y0', 'Y1', 'Y2']);
    expect(inv.npv).toBeUndefined();
    expect(inv.roi_pct).toBeUndefined();
  });
});

// ===========================================================================
// 3. DCF — g>=WACC rejection + very short / very long horizon clamps.
// ===========================================================================
describe('computeValuation — DCF horizon & growth edge cases (REAL)', () => {
  const assumptions = (overrides = {}) => ({
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

  const valuationRow = (a, extra = {}) => ({
    id: 'val-1',
    organization_id: 'org-1',
    status: 'DRAFT',
    horizon_years: extra.horizon_years ?? 3,
    currency: 'PLN',
    source_type: 'manual',
    source_id: null,
    assumptions: JSON.stringify(a),
    peers: '[]',
    results: '{}',
    ...extra,
  });

  it('rejects Gordon terminal when g === WACC (boundary equality, not just >)', async () => {
    // g=12% == WACC=12% → wacc-g = 0 → division by zero. Production guards with
    // `if (g >= wacc) throw` — note >= so the EQUAL boundary is rejected too.
    vi.mocked(Db.get).mockResolvedValue(
      valuationRow(assumptions({ waccPercent: 12, terminalGrowthPercent: 12 }))
    );
    vi.mocked(Db.run).mockResolvedValue(undefined);
    await expect(computeValuation('org-1', 'val-1')).rejects.toThrow(/WACC/i);
  });

  it('rejects Gordon terminal when g > WACC', async () => {
    vi.mocked(Db.get).mockResolvedValue(
      valuationRow(assumptions({ waccPercent: 10, terminalGrowthPercent: 12 }))
    );
    vi.mocked(Db.run).mockResolvedValue(undefined);
    await expect(computeValuation('org-1', 'val-1')).rejects.toThrow(/WACC/i);
  });

  it('very short horizon (1 year, single FCFF) computes a finite EV with no divide-by-zero', async () => {
    // Manual forecast trimmed to 1 year via slice(0, horizonYears). horizon=1.
    // FCFF=[100], WACC=12%, g=3%.
    //   PV(explicit) = 100/1.12^1 = 89.285714 → round 89.29
    //   TV (Gordon)  = 100*1.03/(0.12-0.03) = 103/0.09 = 1144.444...→ 1144.44
    //   PV(terminal) = 1144.444.../1.12^1 = 1021.825... → 1021.83
    //   EV           = 89.285714 + 1021.825 = 1111.11 (1dp tolerance for rounding)
    vi.mocked(Db.get).mockResolvedValue(
      valuationRow(
        assumptions({
          horizonYears: 1,
          manualForecast: { years: [{ year: 1, fcff: 100, revenue: 400, ebitda: 80 }] },
        }),
        { horizon_years: 1 }
      )
    );
    vi.mocked(Db.run).mockResolvedValue(undefined);

    const { dcf, forecast } = await computeValuation('org-1', 'val-1');
    expect(forecast.years).toHaveLength(1);
    near(dcf.pvExplicit, 89.29, 0.02);
    near(dcf.terminalValue, 1144.44, 0.02);
    near(dcf.pvTerminal, 1021.83, 0.1);
    near(dcf.enterpriseValue, 1111.11, 0.1);
    expect(finite(dcf.enterpriseValue)).toBe(true);
  });

  it('very long horizon is clamped to 20 years (horizon_years=99 → 20 forecast years)', async () => {
    // computeValuation clamps horizon to [1,20]. Supply 25 manual years; expect 20.
    const years = Array.from({ length: 25 }, (_, i) => ({
      year: i + 1,
      fcff: 100,
      revenue: 400,
      ebitda: 80,
    }));
    vi.mocked(Db.get).mockResolvedValue(
      valuationRow(assumptions({ horizonYears: 99, manualForecast: { years } }), {
        horizon_years: 99,
      })
    );
    vi.mocked(Db.run).mockResolvedValue(undefined);

    const { dcf, forecast } = await computeValuation('org-1', 'val-1');
    expect(forecast.years).toHaveLength(20); // clamped, not 25
    expect(finite(dcf.enterpriseValue)).toBe(true);
    expect(dcf.enterpriseValue).toBeGreaterThan(0);
  });

  it('WACC below the 0.1% floor is clamped (discountRatePercent never 0 → no terminal blowup)', async () => {
    // waccPercent=0 → clamp(_,0.1,80) → 0.1 → 0.001. discountRatePercent rounds to 0.1.
    // With g=3% and wacc=0.1%, g>wacc → Gordon must REJECT (g>=wacc). Confirms the
    // clamp floor still feeds the g<WACC guard correctly rather than dividing by ~0.
    vi.mocked(Db.get).mockResolvedValue(
      valuationRow(assumptions({ waccPercent: 0, terminalGrowthPercent: 3 }))
    );
    vi.mocked(Db.run).mockResolvedValue(undefined);
    await expect(computeValuation('org-1', 'val-1')).rejects.toThrow(/WACC/i);
  });
});

// ===========================================================================
// 4. WACC weights — zero debt / zero equity / zero total capital.
//    Real weight math lives in financeCompositeScores.computeWaccInputs.
// ===========================================================================
describe('computeWaccInputs — capital-structure edge cases (REAL)', () => {
  it('zero debt → debtWeight=0, equityWeight=100, costOfDebt=null', () => {
    // totalDebt = 0, equity = 1000 → totalCapital = 1000 (>0).
    //   debtWeight   = 0/1000*100   = 0
    //   equityWeight = 1000/1000*100 = 100
    //   costOfDebt   = null (totalDebt not > 0)
    const w = computeWaccInputs({
      LONG_TERM_DEBT: 0,
      SHORT_TERM_DEBT: 0,
      TOTAL_EQUITY: 1000,
      INTEREST_EXPENSE: 0,
    });
    near(w.debtWeight, 0);
    near(w.equityWeight, 100);
    expect(w.costOfDebt).toBeNull();
    near(w.totalCapital, 1000);
  });

  it('zero equity → equityWeight=0, debtWeight=100, totalCapital=debt', () => {
    // totalDebt = 400, equity = 0 → totalCapital = 400 (>0).
    //   debtWeight   = 400/400*100 = 100
    //   equityWeight = 0/400*100   = 0
    const w = computeWaccInputs({
      LONG_TERM_DEBT: 300,
      SHORT_TERM_DEBT: 100,
      TOTAL_EQUITY: 0,
      INTEREST_EXPENSE: 20,
    });
    near(w.debtWeight, 100);
    near(w.equityWeight, 0);
    near(w.totalCapital, 400);
    // costOfDebt = 20/400*100 = 5%
    near(w.costOfDebt, 5);
  });

  it('zero total capital (no debt, no equity) → all weights null, totalCapital null', () => {
    // totalCapital = 0 → guarded: every weight null, totalCapital null. No /0.
    const w = computeWaccInputs({
      LONG_TERM_DEBT: 0,
      SHORT_TERM_DEBT: 0,
      TOTAL_EQUITY: 0,
    });
    expect(w.debtWeight).toBeNull();
    expect(w.equityWeight).toBeNull();
    expect(w.totalCapital).toBeNull();
    expect(w.costOfDebt).toBeNull();
  });

  it('debtWeight + equityWeight = 100 whenever total capital is positive (invariant)', () => {
    const w = computeWaccInputs({
      LONG_TERM_DEBT: 250,
      SHORT_TERM_DEBT: 150,
      TOTAL_EQUITY: 600,
      INTEREST_EXPENSE: 40,
    });
    // totalCapital = 400 + 600 = 1000. debtWeight=40, equityWeight=60.
    near(w.debtWeight, 40);
    near(w.equityWeight, 60);
    near(w.debtWeight + w.equityWeight, 100);
  });
});

// ===========================================================================
// 5. Statement import / canonical mapping — missing periods, non-numeric cells,
//    duplicate line items must be handled SAFELY (no NaN, no throw).
// ===========================================================================
describe('vertical/horizontal analysis — missing periods & non-numeric cells (REAL)', () => {
  it('vertical analysis with REVENUE=0 base → 0 (guarded), never NaN', () => {
    // r.pl[p][code] = rev ? (val/rev)*100 : 0. rev=0 → assigns 0, no 0/0.
    const data = {
      pl: [
        { code: 'REVENUE', name: 'Rev', values: { Y1: 0 } },
        { code: 'COGS', name: 'COGS', values: { Y1: 600 } },
      ],
      bs: [],
    };
    const v = computeVerticalAnalysis(data, ['Y1']);
    expect(v.pl.Y1.COGS).toBe(0);
    expect(Number.isNaN(v.pl.Y1.COGS)).toBe(false);
  });

  it('vertical analysis tolerates a missing period cell (treated as 0)', () => {
    // Period Y2 absent from values → `l.values?.[p] ?? 0` → 0 contribution, finite.
    const data = {
      pl: [
        { code: 'REVENUE', name: 'Rev', values: { Y1: 1000, Y2: 1200 } },
        { code: 'COGS', name: 'COGS', values: { Y1: 600 /* Y2 missing */ } },
      ],
      bs: [],
    };
    const v = computeVerticalAnalysis(data, ['Y1', 'Y2']);
    near(v.pl.Y1.COGS, 60); // 600/1000*100
    expect(v.pl.Y2.COGS).toBe(0); // missing cell → 0, not NaN
    expect(Number.isFinite(v.pl.Y2.COGS)).toBe(true);
  });

  it('horizontal analysis with prior period = 0 → pct guarded to 0 (no x/0)', () => {
    // pct = pv ? ((cv-pv)/|pv|)*100 : 0. prev=0 → 0, change still reported.
    const data = {
      pl: [{ code: 'REVENUE', name: 'Rev', values: { Y1: 0, Y2: 500 } }],
      bs: [],
    };
    const h = computeHorizontalAnalysis(data, ['Y1', 'Y2']);
    const cell = h.pl.Y1_to_Y2.REVENUE;
    expect(cell.change).toBe(500);
    expect(cell.pct).toBe(0); // guarded — not Infinity
    expect(Number.isFinite(cell.pct)).toBe(true);
  });
});

describe('validateStatement — import safety: duplicates & missing totals (REAL)', () => {
  it('duplicate canonical line items → single DUPLICATE warning, values summed, no throw', () => {
    // Two lines mapped to the same canonical id. validateStatement de-dupes the
    // warning and getValue sums them — it does not crash or double-count silently.
    const res = validateStatement(
      [
        { canonicalLineId: 'fsl-bs-total-assets', value: 600 },
        { canonicalLineId: 'fsl-bs-total-assets', value: 400 }, // duplicate
        { canonicalLineId: 'fsl-bs-total-liabilities', value: 700 },
        { canonicalLineId: 'fsl-bs-equity', value: 300 },
      ],
      'BS'
    );
    const dup = res.messages.find((m) => m.code === 'DUPLICATE_CANONICAL_LINES');
    expect(dup).toBeTruthy();
    expect(dup.type).toBe('warning');
    // Summed total assets = 1000 = liabilities(700)+equity(300) → equation OK, not error.
    expect(res.messages.some((m) => m.code === 'BS_EQUATION_OK')).toBe(true);
    expect(res.messages.some((m) => m.code === 'BS_EQUATION_MISMATCH')).toBe(false);
  });

  it('missing totals (incomplete periods) → INCOMPLETE warning, never a false mismatch', () => {
    // Only equity present; total assets/liabilities null → equation cannot be
    // checked. getValue returns null for absent ids → INCOMPLETE warning path.
    const res = validateStatement([{ canonicalLineId: 'fsl-bs-equity', value: 300 }], 'BS');
    expect(res.messages.some((m) => m.code === 'BS_EQUATION_INCOMPLETE')).toBe(true);
    expect(res.messages.some((m) => m.code === 'BS_EQUATION_MISMATCH')).toBe(false);
  });

  it('non-numeric cell values are coerced via Number(value||0), not NaN-propagated', () => {
    // A stray non-numeric value (e.g. an empty/garbage cell that slipped through as
    // undefined) is coerced by `Number(line.value || 0)`. undefined→0, so the
    // balance check stays deterministic instead of NaN-ing the whole equation.
    const res = validateStatement(
      [
        { canonicalLineId: 'fsl-bs-total-assets', value: 1000 },
        { canonicalLineId: 'fsl-bs-total-liabilities', value: 700 },
        // equity cell missing/garbage → coerced to 0 → 700+0=700 ≠ 1000 → MISMATCH,
        // a clean, finite diagnostic (NOT a NaN explosion).
        { canonicalLineId: 'fsl-bs-equity', value: undefined },
      ],
      'BS'
    );
    const mismatch = res.messages.find((m) => m.code === 'BS_EQUATION_MISMATCH');
    expect(mismatch).toBeTruthy();
    // details string must contain a finite numeric diff, never "NaN".
    expect(String(mismatch.details)).not.toContain('NaN');
  });
});
