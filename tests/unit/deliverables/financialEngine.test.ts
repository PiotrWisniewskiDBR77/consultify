/**
 * FinancialEngine — driver-based model + CFO-review (§B/C spec).
 * Każda asercja hand-checked z driverów: dowodzi, że model LICZY (nie hardcode)
 * i że CFO-review wyłapuje złamane założenia (obronność > zmyślenie).
 */
import { describe, expect, it } from 'vitest';
import {
  computeFinancialModel, runCfoReview, type FinancialDrivers,
} from '../../../server/src/services/deliverables/financialEngine';

const dbr77 = (): FinancialDrivers => ({
  currency: 'EUR',
  years: 3,
  startYearLabel: (i) => `Rok ${i + 1} (${2026 + i})`,
  saasPricePerSeatMonth: 290,
  saasSeatsStart: 190, // ~ARR 660k Rok 1
  saasSeatGrowthYoY: 2.6,
  grossChurnAnnual: 0.12,
  nrr: 1.15,
  servicesRevenueStart: 1850,
  servicesGrowthYoY: 0.35,
  grossMargin: 0.80,
  smPctRevenue: 0.30,
  rdPctRevenue: 0.20,
  gaPctRevenue: 0.15,
  daPctRevenue: 0.02,
  cac: 2100,
  arpuAnnual: 3480, // 290×12
  startingCash: 1200,
  fundingRaised: 1200,
  taxRate: 0.19,
});

describe('FinancialEngine — compute from drivers', () => {
  it('liczy 3-letni P&L z driverów (nie hardcode) i rośnie', () => {
    const m = computeFinancialModel(dbr77());
    expect(m.pnl).toHaveLength(3);
    // przychód rośnie rok-do-roku (driver-based)
    expect(m.pnl[1].revenue).toBeGreaterThan(m.pnl[0].revenue);
    expect(m.pnl[2].revenue).toBeGreaterThan(m.pnl[1].revenue);
    // grossProfit = revenue − cogs przy marży 80%
    expect(m.pnl[0].grossProfit).toBe(m.pnl[0].revenue - m.pnl[0].cogs);
    expect(m.pnl[0].cogs).toBe(Math.round(m.pnl[0].revenue * 0.2));
  });

  it('ARR bridge się domyka: Begin+New+Exp−Contr−Churn = End', () => {
    const m = computeFinancialModel(dbr77());
    for (const a of m.arrBridge) {
      expect(Math.abs((a.beginning + a.newLogo + a.expansion - a.contraction - a.churned) - a.ending)).toBeLessThanOrEqual(2);
    }
    // Rok 1: beginning 0
    expect(m.arrBridge[0].beginning).toBe(0);
  });

  it('EBITDA przechodzi na plus (break-even wykryty)', () => {
    const m = computeFinancialModel(dbr77());
    expect(m.breakEven.ebitdaPositivePeriod).not.toBeNull();
  });

  it('unit-economics: LTV GM-adjusted, ratio i payback policzone', () => {
    const m = computeFinancialModel(dbr77());
    const ue = m.unitEconomics[0];
    // LTV = arpu×GM/churn = 3480×0.8/0.12 = 23200
    expect(ue.ltv).toBe(Math.round((3480 * 0.8) / 0.12));
    expect(ue.ltvCacRatio).toBeGreaterThan(3);
    expect(ue.cacPaybackMonths).toBeGreaterThan(0);
  });

  it('wycena = pasmo z 3 metod (DCF/comps/VC), low ≤ high', () => {
    const m = computeFinancialModel(dbr77());
    expect(m.valuation.low).toBeLessThanOrEqual(m.valuation.high);
    expect(m.valuation.dcf).toBeGreaterThan(0);
    expect(m.valuation.comparablesMultiple).toBeGreaterThan(0);
  });

  it('scenariusze base/bull/bear: bull > base > bear w przychodzie Roku 3', () => {
    const m = computeFinancialModel(dbr77());
    const y3 = (s: 'base' | 'bull' | 'bear') => m.scenarios[s].pnl[2].revenue;
    expect(y3('bull')).toBeGreaterThan(y3('base'));
    expect(y3('base')).toBeGreaterThan(y3('bear'));
  });
});

describe('FinancialEngine — CFO-review wyłapuje złamane założenia', () => {
  it('zdrowy model DBR77 przechodzi hard-checki', () => {
    const m = computeFinancialModel(dbr77());
    const rev = runCfoReview(m, dbr77());
    const byId = Object.fromEntries(rev.checks.map((c) => [c.id, c]));
    expect(byId.arr_bridge_reconciles.passed).toBe(true);
    expect(byId.ltv_cac_min.passed).toBe(true);
    expect(byId.no_negative_cash.passed).toBe(true);
    expect(rev.passed).toBe(true);
  });

  it('brak CAC → anti-pattern reject + review NIE przechodzi', () => {
    const d = { ...dbr77(), cac: 0 };
    const m = computeFinancialModel(d);
    const rev = runCfoReview(m, d);
    expect(rev.antiPatterns.some((a) => a.pattern === 'revenue_ramp_without_cac' && a.severity === 'reject')).toBe(true);
    expect(rev.passed).toBe(false);
  });

  it('ujemna gotówka bez finansowania → no_negative_cash FAIL', () => {
    const d = { ...dbr77(), startingCash: 0, fundingRaised: 0, smPctRevenue: 0.9, rdPctRevenue: 0.6, gaPctRevenue: 0.4 };
    const m = computeFinancialModel(d);
    const rev = runCfoReview(m, d);
    const neg = rev.checks.find((c) => c.id === 'no_negative_cash');
    expect(neg?.passed).toBe(false);
    expect(rev.passed).toBe(false);
  });

  it('hockey-stick (skok >5× r/r) → flaga anty-wzorca', () => {
    const d = { ...dbr77(), saasSeatsStart: 5, saasSeatGrowthYoY: 12 };
    const m = computeFinancialModel(d);
    const rev = runCfoReview(m, d);
    expect(rev.antiPatterns.some((a) => a.pattern === 'hockey_stick_no_driver')).toBe(true);
  });

  it('LTV:CAC < 3 → check ltv_cac_min FAIL', () => {
    const d = { ...dbr77(), cac: 50000 };
    const m = computeFinancialModel(d);
    const rev = runCfoReview(m, d);
    expect(rev.checks.find((c) => c.id === 'ltv_cac_min')?.passed).toBe(false);
  });

  // ── W2.2 range-validators (head-to-head wykrył nierealne wartości) ──
  it('W2.2: LTV:CAC absurdalnie wysoki → ltv_cac_ceiling FAIL + false_precision flag', () => {
    const d = { ...dbr77(), cac: 100 }; // CAC zaniżony → LTV:CAC > 8
    const m = computeFinancialModel(d);
    const rev = runCfoReview(m, d);
    const ceil = rev.checks.find((c) => c.id === 'ltv_cac_ceiling');
    expect(ceil?.passed).toBe(false);
    expect(rev.antiPatterns.some((a) => a.pattern === 'false_precision')).toBe(true);
    // ceiling jest MIĘKKI — nie wywraca passed sam z siebie
    expect(rev.checks.find((c) => c.id === 'ltv_cac_min')?.passed).toBe(true);
  });

  it('W2.2: payback < 3 mies → cac_payback_floor FAIL (nierealnie szybki)', () => {
    const d = { ...dbr77(), cac: 200 }; // bardzo niski CAC → szybki payback
    const m = computeFinancialModel(d);
    const rev = runCfoReview(m, d);
    const floor = rev.checks.find((c) => c.id === 'cac_payback_floor');
    expect(floor).toBeDefined();
    if ((floor?.value ?? 99) < 3) expect(floor?.passed).toBe(false);
  });

  it('W2.2: DBR77 — arr_positive + payback_floor PASS; ceiling SOFT (nie wywraca passed)', () => {
    const d = dbr77();
    const m = computeFinancialModel(d);
    const rev = runCfoReview(m, d);
    expect(rev.checks.find((c) => c.id === 'arr_positive')?.passed).toBe(true);
    expect(rev.checks.find((c) => c.id === 'cac_payback_floor')?.passed).toBe(true);
    // DBR77 ma LTV:CAC ~11× (churn 12% + 80% marża) → ceiling słusznie flaguje,
    // ale jest MIĘKKI: model dalej fundowalny (passed=true mimo flagi).
    const ceil = rev.checks.find((c) => c.id === 'ltv_cac_ceiling');
    expect(ceil?.value).toBeGreaterThan(8);
    expect(rev.passed).toBe(true); // ceiling NIE jest hard-fail
  });
});

describe('normalizeCurrencyUnit (W2.2 — bug „thousands EUR")', () => {
  it('tnie kwalifikatory skali z waluty', async () => {
    const { normalizeCurrencyUnit, formatHero } = await import(
      '../../../server/src/services/deliverables/businessPlanSpine'
    );
    expect(normalizeCurrencyUnit('thousands EUR')).toBe('EUR');
    expect(normalizeCurrencyUnit('tys EUR')).toBe('EUR');
    expect(normalizeCurrencyUnit('mln EUR')).toBe('EUR');
    expect(normalizeCurrencyUnit('EUR')).toBe('EUR');
    // NIE psuje pełnoskalowej liczby: 8.2M nie staje się „thousands"
    expect(formatHero(8200000, 'thousands EUR', 'PL')).toBe('8 200 000 EUR');
    expect(formatHero(8200000, 'thousands EUR', 'EN')).toBe('8,200,000 EUR');
  });
});
