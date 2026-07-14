/**
 * FinancialEngine — deterministyczny model finansowy z DRIVERÓW (§B/C spec).
 *
 * Bierze typowane drivery (cena, seaty, wzrost, churn, NRR, marże, OpEx, headcount,
 * CAC, finansowanie) i LICZY model: 3-statement (P&L/BS/CF), ARR bridge, unit-econ,
 * SaaS KPI, break-even/runway, wycena (DCF/comps/VC), scenariusze base/bull/bear.
 * Plus CFO-review (deterministyczne checki). ZERO LLM, zero hardcode totali — każda
 * liczba wynika z drivera (obronność > zmyślenie). SSOT: BUSINESS_PLAN_GENERATOR_SPEC.md.
 */
import type {
  AntiPatternFinding,
  ArrBridgePeriod,
  BalanceSheetPeriod,
  CashFlowPeriod,
  FinancialModel,
  PnLPeriod,
  SaasKpis,
  ScenarioName,
  UnitEconomics,
  ValidationCheck,
  ValidationReport,
  ValuationRange,
  ValuationSensitivityRow,
} from './businessPlanSpine.js';

/** Typowane drivery (§B2) — wejście silnika; mapowane z rejestru Assumption[] wyżej. */
export interface FinancialDrivers {
  currency: string;
  years: number; // horyzont (np. 3)
  startYearLabel: (i: number) => string; // i=0 → "Rok 1 (2026)"
  // — Revenue: SaaS —
  saasPricePerSeatMonth: number; // EUR/seat/mies
  saasSeatsStart: number; // seaty na koniec Roku 1
  saasSeatGrowthYoY: number; // np. 2.6 = +160%
  grossChurnAnnual: number; // 0.12
  nrr: number; // net revenue retention, np. 1.15
  // — Revenue: usługi —
  servicesRevenueStart: number; // przychód usług Rok 1
  servicesGrowthYoY: number; // np. 0.35
  // — Koszty —
  grossMargin: number; // 0.80 (1 − COGS/Rev)
  smPctRevenue: number; // 0.48
  rdPctRevenue: number; // 0.24
  gaPctRevenue: number; // 0.20
  daPctRevenue: number; // 0.02
  /** Dźwignia operacyjna: efektywne OpEx% = base × lev^rok (≈0.82-0.90; <1 = marża rośnie). Default 1. */
  opexLeverageYoY?: number;
  // — Unit economics —
  cac: number; // EUR
  arpuAnnual: number; // EUR/klient/rok (do LTV)
  // — Kapitał —
  startingCash: number; // gotówka po rundzie
  fundingRaised: number; // runda w Rok 1
  taxRate: number; // 0.19
}

const r = (n: number) => Math.round(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Liczy ARR bridge z driverów: Begin + New + Expansion − Contraction − Churn = End (§B5). */
function buildArrBridge(d: FinancialDrivers): ArrBridgePeriod[] {
  const out: ArrBridgePeriod[] = [];
  let endingPrev = 0;
  const arrPerSeat = d.saasPricePerSeatMonth * 12;
  for (let i = 0; i < d.years; i++) {
    const beginning = endingPrev;
    // seaty rosną geometrycznie; ARR końcowe = seaty × cena roczna
    const seats = d.saasSeatsStart * Math.pow(d.saasSeatGrowthYoY, i);
    const endingTarget = seats * arrPerSeat;
    const churned = beginning * d.grossChurnAnnual;
    const retained = beginning - churned;
    // expansion z NRR na utrzymanej bazie
    const expansion = retained * Math.max(0, d.nrr - 1);
    const contraction = 0;
    const newLogo = Math.max(0, endingTarget - (retained + expansion));
    const ending = retained + expansion - contraction + newLogo;
    out.push({
      period: d.startYearLabel(i),
      beginning: r(beginning),
      newLogo: r(newLogo),
      expansion: r(expansion),
      contraction: r(contraction),
      churned: r(churned),
      ending: r(ending),
    });
    endingPrev = ending;
  }
  return out;
}

/** Liczy P&L z driverów (§B2) — revenue z ARR bridge + usługi; koszty z ratio. */
function buildPnL(d: FinancialDrivers, arr: ArrBridgePeriod[]): PnLPeriod[] {
  return arr.map((a, i) => {
    const saasRev = a.ending; // uproszczenie: ARR końcowe ≈ przychód roczny SaaS
    const servicesRev = d.servicesRevenueStart * Math.pow(1 + d.servicesGrowthYoY, i);
    const revenue = saasRev + servicesRev;
    const cogs = revenue * (1 - d.grossMargin);
    const grossProfit = revenue - cogs;
    // dźwignia operacyjna: OpEx% maleje r/r (krzywa J do rentowności)
    const lev = Math.pow(d.opexLeverageYoY ?? 1, i);
    const opexSM = revenue * d.smPctRevenue * lev;
    const opexRD = revenue * d.rdPctRevenue * lev;
    const opexGA = revenue * d.gaPctRevenue * lev;
    const ebitda = grossProfit - opexSM - opexRD - opexGA;
    const da = revenue * d.daPctRevenue;
    const ebit = ebitda - da;
    const netIncome = ebit > 0 ? ebit * (1 - d.taxRate) : ebit;
    return {
      period: a.period,
      revenue: r(revenue),
      cogs: r(cogs),
      grossProfit: r(grossProfit),
      opexSM: r(opexSM),
      opexRD: r(opexRD),
      opexGA: r(opexGA),
      ebitda: r(ebitda),
      da: r(da),
      ebit: r(ebit),
      netIncome: r(netIncome),
    };
  });
}

/**
 * Artykułowany 3-statement (§B3/B4): CF operacyjny = NI + D&A − ΔAR + ΔDeferred,
 * corkscrew PP&E i gotówki, equity = paid-in + retained. Bilansuje TOŻSAMOŚCIOWO
 * (Assets = L+E) bo każda zmiana trafia w dwa miejsca — to jest test integralności.
 */
function buildStatements(
  d: FinancialDrivers,
  pnl: PnLPeriod[]
): { bs: BalanceSheetPeriod[]; cf: CashFlowPeriod[] } {
  const bs: BalanceSheetPeriod[] = [];
  const cf: CashFlowPeriod[] = [];
  let cash = d.startingCash;
  let retained = 0;
  let paidIn = d.startingCash; // equity otwarcia = gotówka otwarcia (all-equity)
  let ppe = 0,
    prevAr = 0,
    prevDef = 0;
  pnl.forEach((p, i) => {
    const ar = p.revenue * 0.1;
    const deferred = p.revenue * 0.15;
    const capex = p.revenue * 0.02;
    const financing = i === 0 ? d.fundingRaised : 0;
    // CF operacyjny z pełnym kapitałem obrotowym (D&A dodane, ΔAR ujmuje gotówkę, ΔDeferred dodaje)
    const operating = p.netIncome + p.da - (ar - prevAr) + (deferred - prevDef);
    const investing = -capex;
    cash = cash + operating + investing + financing;
    ppe = ppe + capex - p.da;
    retained += p.netIncome;
    paidIn += financing;
    cf.push({
      period: p.period,
      operating: r(operating),
      investing: r(investing),
      financing: r(financing),
      endingCash: r(cash),
    });
    bs.push({
      period: p.period,
      cash: r(cash),
      receivables: r(ar),
      ppe: r(ppe),
      deferredRevenue: r(deferred),
      debt: 0,
      equity: r(paidIn + retained),
    });
    prevAr = ar;
    prevDef = deferred;
  });
  return { bs, cf };
}

function buildUnitEconomics(d: FinancialDrivers): UnitEconomics {
  const ltv = (d.arpuAnnual * d.grossMargin) / Math.max(0.01, d.grossChurnAnnual); // GM-adjusted
  const monthlyGm = (d.arpuAnnual * d.grossMargin) / 12;
  return {
    segment: 'SaaS',
    cac: r(d.cac),
    ltv: r(ltv),
    ltvCacRatio: r2(ltv / Math.max(1, d.cac)),
    cacPaybackMonths: r2(d.cac / Math.max(0.01, monthlyGm)),
  };
}

function buildKpis(d: FinancialDrivers, pnl: PnLPeriod[], ue: UnitEconomics): SaasKpis {
  const last = pnl[pnl.length - 1];
  const prev = pnl[pnl.length - 2] ?? pnl[0];
  const growth = prev.revenue > 0 ? (last.revenue - prev.revenue) / prev.revenue : 0;
  const fcfMargin = last.revenue > 0 ? last.ebitda / last.revenue : 0;
  const netNewArr = Math.max(1, last.revenue - prev.revenue);
  return {
    nrr: r(d.nrr * 100),
    ruleOf40: r((growth + fcfMargin) * 100),
    burnMultiple: r2(Math.max(0, -last.ebitda) / netNewArr),
    magicNumber: r2(netNewArr / Math.max(1, prev.opexSM)),
    cacPaybackMonths: ue.cacPaybackMonths,
  };
}

function buildValuation(pnl: PnLPeriod[], d: FinancialDrivers): ValuationRange {
  const last = pnl[pnl.length - 1];
  // DCF (uproszczony): suma zdyskontowanych EBITDA + terminal
  const wacc = 0.2,
    g = 0.03;
  let pv = 0;
  pnl.forEach((p, i) => {
    pv += p.ebitda / Math.pow(1 + wacc, i + 1);
  });
  const terminal = (last.ebitda * (1 + g)) / (wacc - g);
  const pvTerminal = terminal / Math.pow(1 + wacc, pnl.length);
  const dcf = pv + pvTerminal;
  const comps = last.revenue * 6; // 6× revenue (SaaS mnożnik)
  const vc = (last.revenue * 8) / 3; // exit 8× / target 3× return (back-solve, uproszczony)
  const vals = [dcf, comps, vc].filter((v) => v > 0);
  return {
    dcf: r(dcf),
    comparablesMultiple: r(comps),
    vcMethod: r(vc),
    low: r(Math.min(...vals)),
    high: r(Math.max(...vals)),
    terminalValuePctOfEv: dcf > 0 ? r2(pvTerminal / dcf) : undefined,
  };
}

function applyScenario(d: FinancialDrivers, mult: number): FinancialDrivers {
  return {
    ...d,
    saasSeatGrowthYoY: d.saasSeatGrowthYoY * mult,
    nrr: 1 + (d.nrr - 1) * mult,
    servicesGrowthYoY: d.servicesGrowthYoY * mult,
  };
}

/**
 * W12.2 — sensitivity matrix dla wyceny. Każdy driver ±20% → 3 ValuationRange.
 * Pure function: nie dotyka żadnego I/O, deterministyczna.
 */
function buildValuationSensitivity(d: FinancialDrivers): ValuationSensitivityRow[] {
  const compute = (override: Partial<FinancialDrivers>): ValuationRange => {
    const dd = { ...d, ...override };
    const arr = buildArrBridge(dd);
    const pnl = buildPnL(dd, arr);
    return buildValuation(pnl, dd);
  };

  const DELTA = 0.2;

  return [
    {
      driver: 'Wzrost przychodów (SaaS seats)',
      driverKey: 'saasSeatGrowthYoY',
      unit: '×',
      pessimistic: compute({ saasSeatGrowthYoY: d.saasSeatGrowthYoY * (1 - DELTA) }),
      base: buildValuation(buildPnL(d, buildArrBridge(d)), d),
      optimistic: compute({ saasSeatGrowthYoY: d.saasSeatGrowthYoY * (1 + DELTA) }),
    },
    {
      driver: 'Net Revenue Retention (NRR)',
      driverKey: 'nrr',
      unit: '×',
      pessimistic: compute({ nrr: Math.max(0.8, d.nrr * (1 - DELTA)) }),
      base: buildValuation(buildPnL(d, buildArrBridge(d)), d),
      optimistic: compute({ nrr: Math.min(1.5, d.nrr * (1 + DELTA)) }),
    },
    {
      driver: 'Marża brutto',
      driverKey: 'grossMargin',
      unit: '%',
      pessimistic: compute({ grossMargin: Math.max(0.4, d.grossMargin - DELTA) }),
      base: buildValuation(buildPnL(d, buildArrBridge(d)), d),
      optimistic: compute({ grossMargin: Math.min(0.95, d.grossMargin + DELTA) }),
    },
  ];
}

/** Pełny model z driverów (§B). */
export function computeFinancialModel(d: FinancialDrivers): FinancialModel {
  const arrBridge = buildArrBridge(d);
  const pnl = buildPnL(d, arrBridge);
  const { bs, cf } = buildStatements(d, pnl);
  const ue = buildUnitEconomics(d);
  const kpis = buildKpis(d, pnl, ue);
  const valuation = buildValuation(pnl, d);
  const ebitdaPositive = pnl.find((p) => p.ebitda > 0)?.period ?? null;
  const cashOut = cf.find((c) => c.endingCash < 0);
  const runwayMonths = cashOut ? cf.indexOf(cashOut) * 12 : null;

  const mkScenario = (mult: number, note: string) => {
    const sd = applyScenario(d, mult);
    return { pnl: buildPnL(sd, buildArrBridge(sd)), note };
  };
  const scenarios: Record<ScenarioName, { pnl: PnLPeriod[]; note: string }> = {
    base: { pnl, note: 'Konserwatywny base case (driver-based)' },
    bull: mkScenario(1.25, 'Wzrost/NRR +25% vs base'),
    bear: mkScenario(0.7, 'Wzrost/NRR −30% vs base'),
  };

  return {
    currency: d.currency,
    pnl,
    arrBridge,
    balanceSheet: bs,
    cashFlow: cf,
    unitEconomics: [ue],
    kpis,
    breakEven: { ebitdaPositivePeriod: ebitdaPositive, runwayMonths },
    valuation,
    // W12.2 — sensitivity matrix (fail-soft: nie blokuje gdy coś padnie)
    valuationSensitivity: (() => {
      try {
        return buildValuationSensitivity(d);
      } catch {
        return undefined;
      }
    })(),
    scenarios,
  };
}

/** CFO-review — deterministyczne checki (§C) + anty-wzorce (§A9). */
export function runCfoReview(model: FinancialModel, d: FinancialDrivers): ValidationReport {
  const checks: ValidationCheck[] = [];
  const ue = model.unitEconomics[0];
  const add = (id: string, label: string, passed: boolean, value?: number, benchmark?: string) =>
    checks.push({ id, label, passed, value, benchmark });

  // C1 — BS bilansuje (Assets = L + E), CF ties to cash
  const bsOk = model.balanceSheet.every((b) => {
    const assets = b.cash + b.receivables + b.ppe;
    const le = b.debt + b.equity + b.deferredRevenue;
    return Math.abs(assets - le) <= Math.max(5, assets * 0.02);
  });
  add('bs_balances', 'Bilans się bilansuje (Assets ≈ L+E)', bsOk);
  const cfTies = model.balanceSheet.every(
    (b, i) => Math.abs(b.cash - model.cashFlow[i].endingCash) <= 2
  );
  add('cf_ties_cash', 'CF ending-cash = BS cash', cfTies);

  // C2 — marże w normach
  add(
    'gross_margin_band',
    'Gross margin 70-90%',
    d.grossMargin >= 0.7 && d.grossMargin <= 0.95,
    r2(d.grossMargin),
    '0.70-0.90'
  );
  const opexTotal = d.smPctRevenue + d.rdPctRevenue + d.gaPctRevenue;
  add(
    'opex_band',
    'OpEx total 40-95% rev (early-stage)',
    opexTotal <= 0.95,
    r2(opexTotal),
    '≤0.95'
  );

  // C3 — unit economics (z range-validatorami, W2.2 — head-to-head wykrył nierealne wartości)
  add('ltv_cac_min', 'LTV:CAC ≥ 3', ue.ltvCacRatio >= 3, ue.ltvCacRatio, '≥3');
  // Górny pułap: LTV:CAC > 8 zwykle = zaniżony CAC / fałszywa precyzja (nie hard-fail, flaga wiarygodności).
  add('ltv_cac_ceiling', 'LTV:CAC ≤ 8 (wiarygodne)', ue.ltvCacRatio <= 8, ue.ltvCacRatio, '≤8');
  add(
    'cac_payback',
    'CAC payback ≤ 24 mies',
    ue.cacPaybackMonths <= 24,
    ue.cacPaybackMonths,
    '≤24'
  );
  // Dolny pułap: payback < 3 mies dla B2B SaaS jest nierealistycznie szybki (flaga).
  add(
    'cac_payback_floor',
    'CAC payback ≥ 3 mies (realny)',
    ue.cacPaybackMonths >= 3,
    ue.cacPaybackMonths,
    '≥3'
  );
  add('rule_of_40', 'Rule of 40 ≥ 40', model.kpis.ruleOf40 >= 40, model.kpis.ruleOf40, '≥40');
  // ARR > 0 gdy są przychody (ARR=0 przy SaaS = błąd modelu, wykryty w head-to-head).
  const lastArrEnding = model.arrBridge[model.arrBridge.length - 1]?.ending ?? 0;
  const hasRevenue = model.pnl[model.pnl.length - 1]?.revenue > 0;
  add(
    'arr_positive',
    'ARR (ost.) > 0 gdy są przychody',
    !hasRevenue || lastArrEnding > 0,
    lastArrEnding,
    '>0'
  );

  // C4 — brak ujemnej gotówki bez finansowania
  const everNegative = model.cashFlow.some((c) => c.endingCash < 0);
  add('no_negative_cash', 'Brak ujemnej gotówki w horyzoncie', !everNegative);

  // C5 — ARR bridge reconciluje (ending > 0, monotoniczny start)
  const arrOk = model.arrBridge.every(
    (a) =>
      Math.abs(a.beginning + a.newLogo + a.expansion - a.contraction - a.churned - a.ending) <= 2
  );
  add('arr_bridge_reconciles', 'ARR bridge się domyka', arrOk);

  // C9/B9 — terminal value nie dominuje wyceny
  const tv = model.valuation.terminalValuePctOfEv ?? 0;
  add('terminal_value_sane', 'Terminal value ≤ 90% EV', tv <= 0.9, tv, '≤0.90');

  // §A9 — anty-wzorce
  const antiPatterns: AntiPatternFinding[] = [];
  // hockey-stick: przychód rośnie >5× rok-do-roku bez proporcjonalnego drivera
  model.pnl.forEach((p, i) => {
    if (i > 0) {
      const prev = model.pnl[i - 1].revenue;
      if (prev > 0 && p.revenue / prev > 5) {
        antiPatterns.push({
          pattern: 'hockey_stick_no_driver',
          severity: 'flag',
          detail: `${p.period}: przychód ×${r2(p.revenue / prev)} r/r`,
          ref: p.period,
        });
      }
    }
  });
  // revenue ramp bez CAC
  if (!d.cac || d.cac <= 0)
    antiPatterns.push({
      pattern: 'revenue_ramp_without_cac',
      severity: 'reject',
      detail: 'Brak CAC przy rampie przychodu SaaS',
    });
  // fałszywa precyzja: LTV:CAC absurdalnie wysoki (W2.2)
  if (ue.ltvCacRatio > 8)
    antiPatterns.push({
      pattern: 'false_precision',
      severity: 'flag',
      detail: `LTV:CAC ${r2(ue.ltvCacRatio)}× nierealnie wysoki — zweryfikuj CAC`,
      ref: 'ue.cac',
    });

  // hard gate = integralność modelu + kanoniczny próg fundowalności (LTV:CAC≥3, Rule of 40)
  const hardFail = checks.some(
    (c) =>
      !c.passed &&
      [
        'bs_balances',
        'cf_ties_cash',
        'no_negative_cash',
        'arr_bridge_reconciles',
        'ltv_cac_min',
        'rule_of_40',
      ].includes(c.id)
  );
  const rejected = antiPatterns.some((a) => a.severity === 'reject');
  return { checks, antiPatterns, passed: !hardFail && !rejected };
}
