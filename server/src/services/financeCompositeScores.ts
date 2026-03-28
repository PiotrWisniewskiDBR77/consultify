/**
 * Finance Composite Scoring Models
 *
 * Professional-grade composite models used in banking, credit analysis,
 * and MBA-level corporate finance:
 *
 *   1. DuPont 5-Factor Decomposition — ROE breakdown
 *   2. Altman Z-Score — bankruptcy prediction
 *   3. Piotroski F-Score — financial health scoring
 *   4. Sustainable Growth Rate — max growth without external funding
 *   5. WACC Components — cost of capital inputs
 *   6. Unlevered FCF — DCF valuation input
 *   7. Enterprise Value Bridge — EV components
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DuPontDecomposition {
  roe: number | null;
  taxBurden: number | null;
  interestBurden: number | null;
  operatingMargin: number | null;
  assetTurnover: number | null;
  financialLeverage: number | null;
  components: {
    netIncome: number;
    ebt: number;
    ebit: number;
    revenue: number;
    totalAssets: number;
    equity: number;
  };
}

export interface AltmanZScore {
  score: number | null;
  zone: 'safe' | 'grey' | 'distress' | 'na';
  components: {
    x1_wc_ta: number | null;
    x2_re_ta: number | null;
    x3_ebit_ta: number | null;
    x4_mve_tl: number | null;
    x5_rev_ta: number | null;
  };
  model: 'original' | 'private' | 'emerging';
}

export interface PiotroskiFScore {
  score: number;
  maxScore: 9;
  signals: PiotroskiSignal[];
  interpretation: 'strong' | 'moderate' | 'weak';
}

export interface PiotroskiSignal {
  code: string;
  name: string;
  namePl: string;
  passed: boolean;
  value: number | null;
  description: string;
}

export interface SustainableGrowthRate {
  sgr: number | null;
  roe: number | null;
  retentionRatio: number | null;
  dividendPayoutRatio: number | null;
}

export interface WaccInputs {
  costOfDebt: number | null;
  effectiveTaxRate: number | null;
  afterTaxCostOfDebt: number | null;
  debtWeight: number | null;
  equityWeight: number | null;
  totalCapital: number | null;
}

export interface UnleveredFcf {
  nopat: number | null;
  depreciation: number | null;
  changeInWc: number | null;
  capex: number | null;
  ufcf: number | null;
}

export interface EvBridge {
  equityValue: number | null;
  netDebt: number | null;
  minorityInterest: number | null;
  enterpriseValue: number | null;
  evToEbitda: number | null;
  evToRevenue: number | null;
  evToEbit: number | null;
}

export interface CompositeScoresSummary {
  dupont: DuPontDecomposition;
  altmanZ: AltmanZScore;
  piotroskiF: PiotroskiFScore | null;
  sustainableGrowth: SustainableGrowthRate;
  waccInputs: WaccInputs;
  unleveredFcf: UnleveredFcf;
  evBridge: EvBridge;
}

// ─── Value accessor ─────────────────────────────────────────────────────────

type V = Record<string, number>;
const g = (v: V, key: string): number | undefined => v[key];
const g0 = (v: V, key: string): number => v[key] ?? 0;

// ─── 1. DuPont 5-Factor ─────────────────────────────────────────────────────

export function computeDuPont(v: V): DuPontDecomposition {
  const ni = g0(v, 'NET_INCOME');
  const ebt = g0(v, 'EBT');
  const ebit = g0(v, 'EBIT');
  const rev = g0(v, 'REVENUE');
  const ta = g0(v, 'TOTAL_ASSETS');
  const eq = g0(v, 'TOTAL_EQUITY');

  const taxBurden = ebt !== 0 ? ni / ebt : null;
  const interestBurden = ebit !== 0 ? ebt / ebit : null;
  const operatingMargin = rev !== 0 ? ebit / rev : null;
  const assetTurnover = ta !== 0 ? rev / ta : null;
  const financialLeverage = eq !== 0 ? ta / eq : null;

  let roe: number | null = null;
  if (
    taxBurden !== null &&
    interestBurden !== null &&
    operatingMargin !== null &&
    assetTurnover !== null &&
    financialLeverage !== null
  ) {
    roe = taxBurden * interestBurden * operatingMargin * assetTurnover * financialLeverage * 100;
  }

  return {
    roe,
    taxBurden: taxBurden !== null ? round4(taxBurden) : null,
    interestBurden: interestBurden !== null ? round4(interestBurden) : null,
    operatingMargin: operatingMargin !== null ? round4(operatingMargin * 100) : null,
    assetTurnover: assetTurnover !== null ? round4(assetTurnover) : null,
    financialLeverage: financialLeverage !== null ? round4(financialLeverage) : null,
    components: { netIncome: ni, ebt, ebit, revenue: rev, totalAssets: ta, equity: eq },
  };
}

// ─── 2. Altman Z-Score ──────────────────────────────────────────────────────

export function computeAltmanZ(
  v: V,
  options?: { model?: 'original' | 'private' | 'emerging'; marketCapEquity?: number }
): AltmanZScore {
  const ta = g0(v, 'TOTAL_ASSETS');
  if (ta === 0)
    return {
      score: null,
      zone: 'na',
      components: {
        x1_wc_ta: null,
        x2_re_ta: null,
        x3_ebit_ta: null,
        x4_mve_tl: null,
        x5_rev_ta: null,
      },
      model: options?.model || 'private',
    };

  const wc = g0(v, 'CURRENT_ASSETS') - g0(v, 'CURRENT_LIABILITIES');
  const re = g0(v, 'RETAINED_EARNINGS');
  const ebit = g0(v, 'EBIT');
  const tl = g0(v, 'TOTAL_LIABILITIES');
  const rev = g0(v, 'REVENUE');
  const eq = g0(v, 'TOTAL_EQUITY');

  const x1 = wc / ta;
  const x2 = re / ta;
  const x3 = ebit / ta;
  const x5 = rev / ta;

  const model = options?.model || (options?.marketCapEquity ? 'original' : 'private');

  let x4: number;
  let score: number;
  let safeThreshold: number;
  let distressThreshold: number;

  if (model === 'original') {
    const mve = options?.marketCapEquity ?? eq;
    x4 = tl !== 0 ? mve / tl : 0;
    score = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5;
    safeThreshold = 2.99;
    distressThreshold = 1.81;
  } else if (model === 'emerging') {
    x4 = tl !== 0 ? eq / tl : 0;
    score = 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4 + 3.25;
    safeThreshold = 2.6;
    distressThreshold = 1.1;
  } else {
    x4 = tl !== 0 ? eq / tl : 0;
    score = 0.717 * x1 + 0.847 * x2 + 3.107 * x3 + 0.42 * x4 + 0.998 * x5;
    safeThreshold = 2.9;
    distressThreshold = 1.23;
  }

  const zone = score >= safeThreshold ? 'safe' : score >= distressThreshold ? 'grey' : 'distress';

  return {
    score: round4(score),
    zone,
    components: {
      x1_wc_ta: round4(x1),
      x2_re_ta: round4(x2),
      x3_ebit_ta: round4(x3),
      x4_mve_tl: round4(x4),
      x5_rev_ta: round4(x5),
    },
    model,
  };
}

// ─── 3. Piotroski F-Score ───────────────────────────────────────────────────

export function computePiotroskiF(current: V, previous: V): PiotroskiFScore | null {
  const ta_c = g0(current, 'TOTAL_ASSETS');
  const ta_p = g0(previous, 'TOTAL_ASSETS');
  if (ta_c === 0 && ta_p === 0) return null;

  const avgTA = (ta_c + ta_p) / 2 || 1;
  const ni_c = g0(current, 'NET_INCOME');
  const ocf_c = g0(current, 'OPERATING_CF');

  const roa_c = ni_c / avgTA;
  const roa_p = ta_p !== 0 ? g0(previous, 'NET_INCOME') / ta_p : 0;

  const ltd_c = g0(current, 'LONG_TERM_DEBT') + g0(current, 'SHORT_TERM_DEBT');
  const ltd_p = g0(previous, 'LONG_TERM_DEBT') + g0(previous, 'SHORT_TERM_DEBT');
  const ltdRatio_c = ta_c !== 0 ? ltd_c / ta_c : 0;
  const ltdRatio_p = ta_p !== 0 ? ltd_p / ta_p : 0;

  const cr_c =
    g0(current, 'CURRENT_LIABILITIES') !== 0
      ? g0(current, 'CURRENT_ASSETS') / g0(current, 'CURRENT_LIABILITIES')
      : 0;
  const cr_p =
    g0(previous, 'CURRENT_LIABILITIES') !== 0
      ? g0(previous, 'CURRENT_ASSETS') / g0(previous, 'CURRENT_LIABILITIES')
      : 0;

  const shares_c = g(current, 'SHARES_OUTSTANDING');
  const shares_p = g(previous, 'SHARES_OUTSTANDING');

  const gm_c =
    g0(current, 'REVENUE') !== 0 ? g0(current, 'GROSS_PROFIT') / g0(current, 'REVENUE') : 0;
  const gm_p =
    g0(previous, 'REVENUE') !== 0 ? g0(previous, 'GROSS_PROFIT') / g0(previous, 'REVENUE') : 0;

  const at_c = g0(current, 'REVENUE') / (avgTA || 1);
  const at_p = ta_p !== 0 ? g0(previous, 'REVENUE') / ta_p : 0;

  const signals: PiotroskiSignal[] = [
    {
      code: 'F1_ROA',
      name: 'Positive ROA',
      namePl: 'Dodatni ROA',
      passed: roa_c > 0,
      value: round4(roa_c),
      description: 'Net income / avg total assets > 0',
    },
    {
      code: 'F2_OCF',
      name: 'Positive Operating CF',
      namePl: 'Dodatni CF operacyjny',
      passed: ocf_c > 0,
      value: ocf_c,
      description: 'Operating cash flow > 0',
    },
    {
      code: 'F3_ROA_DELTA',
      name: 'Improving ROA',
      namePl: 'Rosnący ROA',
      passed: roa_c > roa_p,
      value: round4(roa_c - roa_p),
      description: 'Current ROA > Prior ROA',
    },
    {
      code: 'F4_ACCRUALS',
      name: 'Cash > Accruals',
      namePl: 'Gotówka > Memoriał',
      passed: ocf_c > ni_c,
      value: round4(ocf_c - ni_c),
      description: 'Operating CF > Net Income (quality of earnings)',
    },
    {
      code: 'F5_LEVERAGE',
      name: 'Decreasing Leverage',
      namePl: 'Spadające zadłużenie',
      passed: ltdRatio_c < ltdRatio_p,
      value: round4(ltdRatio_c - ltdRatio_p),
      description: 'Debt/Assets ratio declining',
    },
    {
      code: 'F6_LIQUIDITY',
      name: 'Improving Liquidity',
      namePl: 'Rosnąca płynność',
      passed: cr_c > cr_p,
      value: round4(cr_c - cr_p),
      description: 'Current Ratio improving',
    },
    {
      code: 'F7_NO_DILUTION',
      name: 'No Share Dilution',
      namePl: 'Brak rozwodnienia akcji',
      passed: shares_c === undefined || shares_p === undefined || shares_c <= shares_p,
      value: shares_c !== undefined && shares_p !== undefined ? shares_c - shares_p : null,
      description: 'No new shares issued',
    },
    {
      code: 'F8_GROSS_MARGIN',
      name: 'Improving Gross Margin',
      namePl: 'Rosnąca marża brutto',
      passed: gm_c > gm_p,
      value: round4((gm_c - gm_p) * 100),
      description: 'Gross margin improving',
    },
    {
      code: 'F9_ASSET_TURNOVER',
      name: 'Improving Asset Turnover',
      namePl: 'Rosnąca obrotowość aktywów',
      passed: at_c > at_p,
      value: round4(at_c - at_p),
      description: 'Asset turnover improving',
    },
  ];

  const score = signals.filter((s) => s.passed).length;
  const interpretation = score >= 7 ? 'strong' : score >= 4 ? 'moderate' : 'weak';

  return { score, maxScore: 9, signals, interpretation };
}

// ─── 4. Sustainable Growth Rate ─────────────────────────────────────────────

export function computeSustainableGrowth(v: V): SustainableGrowthRate {
  const ni = g0(v, 'NET_INCOME');
  const eq = g0(v, 'TOTAL_EQUITY');
  const divPaid = Math.abs(g0(v, 'DIVIDENDS_PAID'));

  const roe = eq !== 0 ? (ni / eq) * 100 : null;
  const dividendPayoutRatio = ni !== 0 ? divPaid / Math.abs(ni) : null;
  const retentionRatio = dividendPayoutRatio !== null ? 1 - dividendPayoutRatio : null;
  const sgr = roe !== null && retentionRatio !== null ? (roe / 100) * retentionRatio * 100 : null;

  return {
    sgr: sgr !== null ? round4(sgr) : null,
    roe: roe !== null ? round4(roe) : null,
    retentionRatio: retentionRatio !== null ? round4(retentionRatio) : null,
    dividendPayoutRatio: dividendPayoutRatio !== null ? round4(dividendPayoutRatio) : null,
  };
}

// ─── 5. WACC Inputs ─────────────────────────────────────────────────────────

export function computeWaccInputs(v: V): WaccInputs {
  const totalDebt = g0(v, 'LONG_TERM_DEBT') + g0(v, 'SHORT_TERM_DEBT');
  const equity = g0(v, 'TOTAL_EQUITY');
  const totalCapital = totalDebt + equity;

  const interestExpense = Math.abs(g0(v, 'INTEREST_EXPENSE'));
  const costOfDebt = totalDebt > 0 ? (interestExpense / totalDebt) * 100 : null;

  const ebt = g0(v, 'EBT');
  const tax = Math.abs(g0(v, 'TAX_EXPENSE'));
  const effectiveTaxRate = Math.abs(ebt) > 0 ? (tax / Math.abs(ebt)) * 100 : null;

  const afterTaxCostOfDebt =
    costOfDebt !== null && effectiveTaxRate !== null
      ? costOfDebt * (1 - effectiveTaxRate / 100)
      : null;

  return {
    costOfDebt: costOfDebt !== null ? round4(costOfDebt) : null,
    effectiveTaxRate: effectiveTaxRate !== null ? round4(effectiveTaxRate) : null,
    afterTaxCostOfDebt: afterTaxCostOfDebt !== null ? round4(afterTaxCostOfDebt) : null,
    debtWeight: totalCapital > 0 ? round4((totalDebt / totalCapital) * 100) : null,
    equityWeight: totalCapital > 0 ? round4((equity / totalCapital) * 100) : null,
    totalCapital: totalCapital > 0 ? totalCapital : null,
  };
}

// ─── 6. Unlevered Free Cash Flow ────────────────────────────────────────────

export function computeUnleveredFcf(v: V): UnleveredFcf {
  const ebit = g(v, 'EBIT');
  const ebt = g0(v, 'EBT');
  const tax = Math.abs(g0(v, 'TAX_EXPENSE'));
  const taxRate = Math.abs(ebt) > 0 ? tax / Math.abs(ebt) : 0.19;

  const nopat = ebit !== undefined ? ebit * (1 - taxRate) : null;

  const depreciation = g(v, 'DEPRECIATION') ?? g(v, 'DEPRECIATION_ADDBACK') ?? null;
  const depAbs = depreciation !== null ? Math.abs(depreciation) : null;

  const changeAr = g0(v, 'CHANGE_AR');
  const changeInv = g0(v, 'CHANGE_INVENTORY');
  const changeAp = g0(v, 'CHANGE_AP');
  const wcItems = [changeAr, changeInv, changeAp].filter((x) => x !== 0);
  const changeInWc = wcItems.length > 0 ? changeAr + changeInv + changeAp : null;

  const capex = g(v, 'CAPEX') ?? null;

  let ufcf: number | null = null;
  if (nopat !== null) {
    ufcf = nopat + (depAbs ?? 0) - (changeInWc ?? 0) + (capex ?? 0);
  }

  return {
    nopat: nopat !== null ? Math.round(nopat) : null,
    depreciation: depAbs !== null ? Math.round(depAbs) : null,
    changeInWc: changeInWc !== null ? Math.round(changeInWc) : null,
    capex: capex !== null ? Math.round(capex) : null,
    ufcf: ufcf !== null ? Math.round(ufcf) : null,
  };
}

// ─── 7. Enterprise Value Bridge ─────────────────────────────────────────────

export function computeEvBridge(v: V, options?: { marketCapEquity?: number }): EvBridge {
  const equity = options?.marketCapEquity ?? g0(v, 'TOTAL_EQUITY');
  const ltd = g0(v, 'LONG_TERM_DEBT');
  const std = g0(v, 'SHORT_TERM_DEBT');
  const cash = g0(v, 'CASH');
  const minority = g0(v, 'MINORITY_INTEREST');

  const netDebt = ltd + std - cash;
  const ev = equity + netDebt + minority;

  const ebitda = g(v, 'EBITDA');
  const revenue = g(v, 'REVENUE');
  const ebit = g(v, 'EBIT');

  return {
    equityValue: equity || null,
    netDebt: netDebt,
    minorityInterest: minority || null,
    enterpriseValue: ev > 0 ? ev : null,
    evToEbitda: ebitda && ebitda > 0 && ev > 0 ? round4(ev / ebitda) : null,
    evToRevenue: revenue && revenue > 0 && ev > 0 ? round4(ev / revenue) : null,
    evToEbit: ebit && ebit > 0 && ev > 0 ? round4(ev / ebit) : null,
  };
}

// ─── Master function ────────────────────────────────────────────────────────

export function computeAllCompositeScores(
  current: V,
  previous?: V,
  options?: { marketCapEquity?: number }
): CompositeScoresSummary {
  return {
    dupont: computeDuPont(current),
    altmanZ: computeAltmanZ(current, { marketCapEquity: options?.marketCapEquity }),
    piotroskiF: previous ? computePiotroskiF(current, previous) : null,
    sustainableGrowth: computeSustainableGrowth(current),
    waccInputs: computeWaccInputs(current),
    unleveredFcf: computeUnleveredFcf(current),
    evBridge: computeEvBridge(current, { marketCapEquity: options?.marketCapEquity }),
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
