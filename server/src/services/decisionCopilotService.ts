/**
 * Decision Copilot Service (M16/8.5)
 *
 * Deterministic, compute-based trade-off engine for financial "what-if"
 * scenarios. NO LLM — every output is a pure function of its inputs so that
 * results are reproducible and testable. Textual recommendations are simple
 * templates derived from the computed numbers.
 *
 * All monetary values are in the caller's currency unit. Periods are months
 * unless otherwise noted.
 */

/** Round to 2 decimals to keep currency math stable across platforms. */
const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/** Clamp a possibly-undefined number to a finite value, defaulting to 0. */
const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * Runway in months given opening cash and a (negative when burning) monthly
 * net cash flow. If the company is cash-flow positive (>= 0), runway is
 * effectively unbounded → represented as Infinity.
 */
export const computeRunwayMonths = (openingCash: number, monthlyNetCash: number): number => {
  const cash = num(openingCash);
  const net = num(monthlyNetCash);
  if (net >= 0) return Infinity;
  return cash / Math.abs(net);
};

const formatRunway = (months: number): string =>
  Number.isFinite(months) ? `${round2(months)} mies.` : 'bezterminowo (dodatni cash flow)';

// ---------------------------------------------------------------------------
// 1. whatIfHire
// ---------------------------------------------------------------------------

export interface HiringBaseline {
  /** Cash available at the start (before any new hires). */
  openingCash: number;
  /** Monthly net cash flow today (negative = burn). */
  monthlyNetCash: number;
  /** Monthly EBITDA today. */
  monthlyEbitda: number;
}

export interface WhatIfHireResult {
  /** Runway (months) before adding the new hires. */
  runwayBefore: number;
  /** Runway (months) after adding the new hires. */
  runwayAfter: number;
  /** Monthly EBITDA impact (negative — extra cost). */
  ebitdaImpact: number;
  /** How many periods sooner/later breakeven moves (positive = pushed later). */
  breakevenShiftPeriods: number;
  /** Human-readable trade-off summary. */
  tradeoff: string;
}

/**
 * "What if I hire N people in period X?" — projects the impact on runway,
 * monthly EBITDA, and breakeven timing.
 *
 * The fully-loaded monthly cost of the new headcount reduces both monthly net
 * cash and monthly EBITDA by the same amount (cost is cash + P&L). The
 * `startPeriod` defers the cost: cash burned before the hires start does not
 * count against the post-hire monthly burn, but for runway we conservatively
 * model the steady-state monthly burn after the hires land.
 */
export const whatIfHire = (
  baseline: HiringBaseline,
  newHires: number,
  loadedCostPerHire: number,
  startPeriod: number,
  horizon: number
): WhatIfHireResult => {
  const openingCash = num(baseline?.openingCash);
  const monthlyNetCash = num(baseline?.monthlyNetCash);
  const monthlyEbitda = num(baseline?.monthlyEbitda);
  const hires = Math.max(0, num(newHires));
  const costPerHire = Math.max(0, num(loadedCostPerHire));
  const start = Math.max(0, num(startPeriod));
  const span = Math.max(1, num(horizon, 12));

  const monthlyAddedCost = hires * costPerHire;

  const runwayBefore = computeRunwayMonths(openingCash, monthlyNetCash);

  // Cash burned at the old rate before the hires start.
  const monthsBeforeStart = Math.min(start, span);
  const cashAtStart = openingCash + monthlyNetCash * monthsBeforeStart;
  const monthlyNetCashAfter = monthlyNetCash - monthlyAddedCost;

  let runwayAfter: number;
  if (monthlyNetCashAfter >= 0) {
    runwayAfter = Infinity;
  } else if (cashAtStart <= 0) {
    // Already out of cash by the time hires would start.
    runwayAfter = runwayBefore;
  } else {
    runwayAfter = monthsBeforeStart + cashAtStart / Math.abs(monthlyNetCashAfter);
  }

  const ebitdaImpact = -monthlyAddedCost;

  // Breakeven shift: how many extra months of the new cost it takes the
  // (now lower) monthly EBITDA to absorb the added burden. If EBITDA was
  // already positive, the shift is how long the new cost delays profit.
  let breakevenShiftPeriods = 0;
  if (monthlyAddedCost > 0) {
    const ebitdaAfter = monthlyEbitda - monthlyAddedCost;
    if (ebitdaAfter >= 0) {
      // Still profitable — shift expressed as fraction of remaining margin.
      breakevenShiftPeriods = monthlyEbitda > 0 ? monthlyAddedCost / monthlyEbitda : 0;
    } else if (monthlyEbitda > 0) {
      // Was profitable, now isn't — months of margin wiped out.
      breakevenShiftPeriods = monthlyAddedCost / monthlyEbitda;
    } else {
      // Already loss-making — deepen by relative cost.
      breakevenShiftPeriods = monthlyAddedCost / Math.max(1, costPerHire);
    }
  }

  const tradeoff =
    hires <= 0
      ? 'Brak nowych etatów — bez zmiany runway, EBITDA ani breakeven.'
      : `Zatrudnienie ${hires} os. od okresu ${start} (koszt ${round2(monthlyAddedCost)}/mies.) ` +
        `skraca runway z ${formatRunway(runwayBefore)} do ${formatRunway(runwayAfter)}, ` +
        `obniża EBITDA o ${round2(monthlyAddedCost)}/mies. i przesuwa breakeven o ` +
        `${round2(breakevenShiftPeriods)} okr. ` +
        (monthlyNetCashAfter >= 0
          ? 'Cash flow pozostaje dodatni — decyzja bezpieczna.'
          : Number.isFinite(runwayAfter) && runwayAfter < 6
            ? 'OSTRZEŻENIE: runway < 6 mies. — rozważ etapowanie lub finansowanie.'
            : 'Zatrudnienie wykonalne przy obecnym buforze gotówki.');

  return {
    runwayBefore: round2(runwayBefore),
    runwayAfter: round2(runwayAfter),
    ebitdaImpact: round2(ebitdaImpact),
    breakevenShiftPeriods: round2(breakevenShiftPeriods),
    tradeoff,
  };
};

// ---------------------------------------------------------------------------
// 2. whatIfPriceChange
// ---------------------------------------------------------------------------

export interface PriceBaseline {
  /** Current monthly (or period) revenue. */
  revenue: number;
  /** Current variable cost as a fraction of revenue (0..1). Optional. */
  variableCostRatio?: number;
  /** Current monthly EBITDA. Optional — used to express impact off a base. */
  monthlyEbitda?: number;
}

export interface WhatIfPriceChangeResult {
  /** Revenue impact in currency (delta vs baseline). */
  revenueImpact: number;
  /** EBITDA impact in currency (delta vs baseline). */
  ebitdaImpact: number;
  /** Human-readable recommendation. */
  recommendation: string;
}

/**
 * "What if I change price by X% with volume elasticity E?"
 *
 * Volume responds to price via elasticity: %ΔVolume = elasticity × %ΔPrice.
 * For a normal good elasticity is negative (price up → volume down). New
 * revenue = price × volume, so:
 *   revenueFactor = (1 + priceΔ) × (1 + elasticity × priceΔ)
 *
 * EBITDA impact accounts for variable cost scaling with volume while price
 * changes only the revenue side.
 */
export const whatIfPriceChange = (
  baseline: PriceBaseline,
  priceChangePct: number,
  volumeElasticity: number
): WhatIfPriceChangeResult => {
  const revenue = num(baseline?.revenue);
  const variableCostRatio = Math.min(1, Math.max(0, num(baseline?.variableCostRatio)));
  const priceDelta = num(priceChangePct) / 100;
  const elasticity = num(volumeElasticity);

  const volumeFactor = 1 + elasticity * priceDelta; // multiplicative change in units
  const safeVolumeFactor = Math.max(0, volumeFactor); // volume cannot go negative
  const revenueFactor = (1 + priceDelta) * safeVolumeFactor;

  const newRevenue = revenue * revenueFactor;
  const revenueImpact = newRevenue - revenue;

  // Contribution margin: variable costs scale with VOLUME (not price).
  const baseVariableCost = revenue * variableCostRatio;
  const newVariableCost = baseVariableCost * safeVolumeFactor;
  const baseContribution = revenue - baseVariableCost;
  const newContribution = newRevenue - newVariableCost;
  const ebitdaImpact = newContribution - baseContribution;

  let recommendation: string;
  if (priceDelta === 0) {
    recommendation = 'Brak zmiany ceny — wynik bez zmian.';
  } else if (ebitdaImpact > 0) {
    recommendation =
      `Podwyżka/obniżka ceny o ${round2(priceDelta * 100)}% przy elastyczności ${round2(elasticity)} ` +
      `zwiększa EBITDA o ${round2(ebitdaImpact)} (przychód ${revenueImpact >= 0 ? '+' : ''}${round2(revenueImpact)}). ` +
      'REKOMENDACJA: wdrożyć — marża rośnie mimo reakcji wolumenu.';
  } else if (ebitdaImpact < 0) {
    recommendation =
      `Zmiana ceny o ${round2(priceDelta * 100)}% przy elastyczności ${round2(elasticity)} ` +
      `obniża EBITDA o ${round2(Math.abs(ebitdaImpact))} (przychód ${revenueImpact >= 0 ? '+' : ''}${round2(revenueImpact)}). ` +
      'REKOMENDACJA: wstrzymać — reakcja wolumenu przeważa nad efektem ceny.';
  } else {
    recommendation = 'Zmiana ceny neutralna dla EBITDA — decyzja zależy od celów udziału w rynku.';
  }

  return {
    revenueImpact: round2(revenueImpact),
    ebitdaImpact: round2(ebitdaImpact),
    recommendation,
  };
};

// ---------------------------------------------------------------------------
// 3. whatIfDelayInitiative
// ---------------------------------------------------------------------------

export interface InitiativeForNpv {
  /** Annual net benefit the initiative is expected to deliver. */
  annualBenefit: number;
  /** Annual discount rate as a fraction (e.g. 0.1 for 10%). */
  discountRate: number;
  /** Analysis horizon in years from today. */
  horizonYears: number;
  /** Optional upfront cost (positive number). */
  upfrontCost?: number;
}

export interface WhatIfDelayResult {
  /** Change in NPV vs the on-time plan (negative = value destroyed). */
  npvImpact: number;
  /** Value at risk = magnitude of NPV lost by the delay (non-negative). */
  valueAtRisk: number;
  /** Human-readable recommendation. */
  recommendation: string;
}

/**
 * NPV of an annuity of `annualBenefit` over `horizonYears`, optionally starting
 * after a delay (in years), net of an upfront cost paid at t=0 regardless of
 * the delay (cost is committed; only benefits slip).
 */
const npvOfInitiative = (init: InitiativeForNpv, delayYears: number): number => {
  const annualBenefit = num(init?.annualBenefit);
  const rate = num(init?.discountRate);
  const horizon = Math.max(0, num(init?.horizonYears));
  const upfront = Math.max(0, num(init?.upfrontCost));
  const delay = Math.max(0, delayYears);

  let pvBenefits = 0;
  // Benefits accrue in years (delay+1 .. horizon). Delay shortens the
  // effective benefit window inside the fixed horizon.
  for (let year = 1; year <= horizon; year += 1) {
    if (year <= delay) continue; // benefit not yet online
    pvBenefits += annualBenefit / Math.pow(1 + rate, year);
  }
  return pvBenefits - upfront;
};

/**
 * "What if I delay this initiative by N months?" — discounted benefits slip
 * later (and may fall outside the horizon), so NPV drops.
 */
export const whatIfDelayInitiative = (
  initiative: InitiativeForNpv,
  delayMonths: number
): WhatIfDelayResult => {
  const delayYears = Math.max(0, num(delayMonths)) / 12;

  const npvOnTime = npvOfInitiative(initiative, 0);
  const npvDelayed = npvOfInitiative(initiative, delayYears);

  const npvImpact = npvDelayed - npvOnTime; // negative when delay destroys value
  const valueAtRisk = Math.max(0, -npvImpact);

  let recommendation: string;
  if (delayYears === 0) {
    recommendation = 'Brak opóźnienia — NPV bez zmian.';
  } else if (valueAtRisk <= 0) {
    recommendation =
      `Opóźnienie o ${round2(num(delayMonths))} mies. nie niszczy wartości NPV. ` +
      'Decyzja elastyczna — można przesunąć bez kosztu wartości.';
  } else {
    const pctLost = npvOnTime !== 0 ? (valueAtRisk / Math.abs(npvOnTime)) * 100 : 0;
    recommendation =
      `Opóźnienie o ${round2(num(delayMonths))} mies. obniża NPV o ${round2(valueAtRisk)} ` +
      `(${round2(pctLost)}% wartości on-time). ` +
      (pctLost >= 20
        ? 'REKOMENDACJA: priorytetyzować — opóźnienie kosztuje istotną wartość.'
        : 'REKOMENDACJA: dopuszczalne, jeśli zwalnia zasoby pod ważniejsze inicjatywy.');
  }

  return {
    npvImpact: round2(npvImpact),
    valueAtRisk: round2(valueAtRisk),
    recommendation,
  };
};
