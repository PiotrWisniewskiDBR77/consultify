/**
 * Business-Case Generator (M16/3.2)
 *
 * Pure functions that turn an initiative's economics into a one-pager
 * business case (NPV / payback / IRR / profitability index) computed
 * BEFORE funding, using a caller-supplied WACC (never hardcoded).
 *
 * No external service imports — NPV/IRR/payback are implemented locally
 * to keep this module self-contained.
 */

/** Economic shape of a single initiative (pre-funding). */
export interface InitiativeEconomics {
  id: string;
  name: string;
  /** Up-front capital expenditure (year 0 outflow), positive number. */
  capex: number;
  /** Recurring annual operating cost over the horizon, positive number. */
  opexAnnual: number;
  /** Recurring annual gross benefit (savings + revenue) over the horizon. */
  benefitAnnual: number;
  /** Analysis horizon in whole years. */
  horizonYears: number;
}

export type Verdict = 'go' | 'conditional' | 'no-go';

export interface OnePager {
  id: string;
  name: string;
  capex: number;
  opexAnnual: number;
  benefitAnnual: number;
  horizonYears: number;
  /** Net present value at the supplied WACC. */
  npv: number;
  /** Internal rate of return as a fraction (e.g. 0.18 = 18%), or null if undefined. */
  irr: number | null;
  /** Discounted payback period in years, or null if never recovered. */
  paybackYears: number | null;
  /** Profitability index = PV(net benefits) / capex. */
  pi: number;
  verdict: Verdict;
  summary: string;
}

export interface ComparisonRow {
  id: string;
  npv: number;
  pi: number;
  rank: number;
  recommendation: Verdict;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

const sanitize = (n: unknown): number => {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};

/**
 * Net present value of a series of cash flows.
 * cashFlows[0] is the year-0 flow (typically negative capex), discounted at rate^0 = 1.
 * rate is a fraction (0.1 = 10%).
 */
export function npv(rate: number, cashFlows: number[]): number {
  return cashFlows.reduce(
    (acc, cf, t) => acc + cf / Math.pow(1 + rate, t),
    0,
  );
}

/**
 * Internal rate of return via bisection on the NPV function.
 * Returns null when no sign change exists in the searched range
 * (e.g. all-positive or all-negative flows → IRR undefined).
 */
export function irr(cashFlows: number[]): number | null {
  if (!cashFlows.length) return null;
  const hasPositive = cashFlows.some((c) => c > 0);
  const hasNegative = cashFlows.some((c) => c < 0);
  if (!hasPositive || !hasNegative) return null;

  const f = (rate: number) => npv(rate, cashFlows);

  // Search a wide bracket for a sign change: -99% .. +1000%
  let lo = -0.9999;
  let hi = 10;
  let flo = f(lo);
  let fhi = f(hi);
  if (flo * fhi > 0) {
    // No sign change in the standard bracket → IRR undefined / out of range.
    return null;
  }

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fmid = f(mid);
    if (Math.abs(fmid) < 1e-7) return round4(mid);
    if (flo * fmid < 0) {
      hi = mid;
      fhi = fmid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return round4((lo + hi) / 2);
}

/**
 * Discounted payback period in years (with fractional interpolation within
 * the recovery year). Returns null if cumulative discounted cash flow never
 * turns positive within the horizon.
 */
export function discountedPayback(rate: number, cashFlows: number[]): number | null {
  let cumulative = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    const discounted = cashFlows[t] / Math.pow(1 + rate, t);
    const prev = cumulative;
    cumulative += discounted;
    if (cumulative >= 0 && t > 0) {
      // Interpolate within year t: fraction of the year needed to break even.
      const needed = -prev;
      const fraction = discounted !== 0 ? needed / discounted : 0;
      return round2((t - 1) + Math.max(0, Math.min(1, fraction)));
    }
  }
  return null;
}

/** Build the year-0..horizon cash-flow vector for an initiative (pre-funding). */
function buildCashFlows(eco: InitiativeEconomics): number[] {
  const capex = sanitize(eco.capex);
  const opex = sanitize(eco.opexAnnual);
  const benefit = sanitize(eco.benefitAnnual);
  const horizon = Math.max(0, Math.floor(sanitize(eco.horizonYears)));

  const netAnnual = benefit - opex;
  const flows: number[] = [-capex];
  for (let y = 1; y <= horizon; y++) flows.push(netAnnual);
  return flows;
}

function deriveVerdict(npvValue: number, pi: number): Verdict {
  if (npvValue > 0 && pi >= 1.2) return 'go';
  if (npvValue > 0 && pi >= 1.0) return 'conditional';
  return 'no-go';
}

const VERDICT_LABEL: Record<Verdict, string> = {
  go: 'REKOMENDACJA: GO',
  conditional: 'REKOMENDACJA: WARUNKOWO',
  'no-go': 'REKOMENDACJA: NO-GO',
};

const fmtMoney = (n: number): string =>
  new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(Math.round(n));

/**
 * Generate a complete one-pager business case for a single initiative,
 * discounting at the supplied WACC (percent, e.g. 12 = 12%).
 */
export function generateOnePager(
  initiative: InitiativeEconomics,
  waccPct: number,
): OnePager {
  const wacc = sanitize(waccPct);
  const rate = wacc / 100;
  const capex = sanitize(initiative.capex);
  const opexAnnual = sanitize(initiative.opexAnnual);
  const benefitAnnual = sanitize(initiative.benefitAnnual);
  const horizonYears = Math.max(0, Math.floor(sanitize(initiative.horizonYears)));

  const flows = buildCashFlows(initiative);
  const npvValue = round2(npv(rate, flows));

  // PV of net benefits (years 1..horizon only, excluding capex outflow).
  const pvNetBenefits = flows
    .slice(1)
    .reduce((acc, cf, idx) => acc + cf / Math.pow(1 + rate, idx + 1), 0);
  const pi = capex > 0 ? round2(pvNetBenefits / capex) : pvNetBenefits > 0 ? Infinity : 0;

  const irrValue = irr(flows);
  const paybackYears = discountedPayback(rate, flows);
  const verdict = deriveVerdict(npvValue, Number.isFinite(pi) ? pi : Number.MAX_SAFE_INTEGER);

  const paybackText =
    paybackYears !== null
      ? `zwrot w ${paybackYears.toLocaleString('pl-PL')} lat`
      : 'brak zwrotu w horyzoncie';
  const irrText = irrValue !== null ? `, IRR ${round2(irrValue * 100)}%` : '';

  const summary =
    `${initiative.name}: NPV ${fmtMoney(npvValue)} przy WACC ${round2(wacc)}%, ` +
    `${paybackText}${irrText} (PI ${Number.isFinite(pi) ? pi : '∞'}) ` +
    `— ${VERDICT_LABEL[verdict]}.`;

  return {
    id: initiative.id,
    name: initiative.name,
    capex,
    opexAnnual,
    benefitAnnual,
    horizonYears,
    npv: npvValue,
    irr: irrValue,
    paybackYears,
    pi: Number.isFinite(pi) ? pi : Number.POSITIVE_INFINITY,
    verdict,
    summary,
  };
}

/**
 * Rank a portfolio of initiatives by their one-pager economics.
 * Ranking is by NPV descending (capital-constrained tie-break by PI).
 */
export function compareInitiatives(
  initiatives: InitiativeEconomics[],
  waccPct: number,
): ComparisonRow[] {
  const pagers = (initiatives || []).map((i) => generateOnePager(i, waccPct));

  const sorted = [...pagers].sort((a, b) => {
    if (b.npv !== a.npv) return b.npv - a.npv;
    return b.pi - a.pi;
  });

  return sorted.map((p, idx) => ({
    id: p.id,
    npv: p.npv,
    pi: p.pi,
    rank: idx + 1,
    recommendation: p.verdict,
  }));
}
