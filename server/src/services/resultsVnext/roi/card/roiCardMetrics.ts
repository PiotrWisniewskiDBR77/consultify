/**
 * ROI (P7K C) — CZYSTA warstwa liczenia karty analizy ROI.
 *
 * Źródło prawdy metodyczne: docs/program/grafika/ROI_METODYKA_WLASCICIELA_20260905.md
 * (§3 CAPEX, §4 ΔNWC, §5 incremental OPEX, §15 przepływy, §16-25 wskaźniki,
 * §28 wrażliwość ±20 %) i docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md §4.
 *
 * DLACZEGO OSOBNY, CZYSTY MODUŁ: dokładnie ta sama zasada, którą już trzyma
 * `engine/roiCalculationEngine.ts` (Decyzja D2) — zero importów `pg`/`express`,
 * zero I/O, wszystko wchodzi i wychodzi jako `number | null`. Dzięki temu
 * przeliczenia NPV/IRR/PP dają się przetestować na przykładach z metodyki bez
 * bazy, a dowód mutacyjny (zmiana stopy dyskontowej) uderza w JEDNO miejsce.
 *
 * CZEGO TU NIE MA: żadnego zgadywania. Gdy składnika nie da się policzyć ze
 * ZAPISANYCH wierszy (brak pozycji, brak stopy, brak przebiegu), funkcja zwraca
 * `null`, a UI pokazuje „—" (SSOT §6: brak danych to nigdy 0).
 *
 * Wzory liczbowe pochodzą z `investmentAppraisalService.ts` (npv/irr/payback/
 * discountedPayback/profitabilityIndex) — importowane, NIE przepisane, żeby nie
 * powstała druga prawda o tym, czym jest NPV w tym repozytorium.
 */
import {
  discountedPayback,
  irr,
  npv,
  payback,
  profitabilityIndex,
} from '../../../investmentAppraisalService.js';

export type RoiCardPhase = 'assumptions' | 'calculations' | 'realization';
export type RoiInvestmentRecommendation = 'go' | 'conditional_go' | 'no_go';
export type RoiBenefitClass = 'hard' | 'avoided' | 'soft' | 'strategic';
export type RoiAssumptionVerdict = 'confirmed' | 'partially_confirmed' | 'refuted';

export type RoiCardTimingType = 'one_time' | 'recurring';
export type RoiCardCadence = 'monthly' | 'quarterly' | 'annual';

/** Ile razy w roku występuje pozycja cykliczna. Brak kadencji = raz w roku
 *  (najostrożniejsze założenie: nie zawyża korzyści ani nie zaniża kosztu). */
export function periodsPerYear(cadence: RoiCardCadence | null): number {
  if (cadence === 'monthly') return 12;
  if (cadence === 'quarterly') return 4;
  return 1;
}

export interface RoiCardLine {
  amount: number | null;
  timingType: RoiCardTimingType;
  recurrenceCadence: RoiCardCadence | null;
  /** Pozycja niefinansowa (Soft/Strategic) NIE wchodzi do przepływów. */
  isFinancial?: boolean;
}

/** Nakład początkowy = suma pozycji jednorazowych (CAPEX + rezerwa + wszystko,
 *  co analityk zaksięgował jako `one_time`). Metodyka §3. */
export function sumOneTime(lines: RoiCardLine[]): number | null {
  const relevant = lines.filter((l) => l.timingType === 'one_time' && typeof l.amount === 'number');
  if (relevant.length === 0) return null;
  return relevant.reduce((acc, l) => acc + (l.amount as number), 0);
}

/** Roczna wartość pozycji cyklicznych (kwota × liczba wystąpień w roku). */
export function sumRecurringPerYear(lines: RoiCardLine[]): number | null {
  const relevant = lines.filter(
    (l) => l.timingType === 'recurring' && typeof l.amount === 'number' && l.isFinancial !== false
  );
  if (relevant.length === 0) return null;
  return relevant.reduce(
    (acc, l) => acc + (l.amount as number) * periodsPerYear(l.recurrenceCadence),
    0
  );
}

/**
 * Horyzont analizy w PEŁNYCH latach (metodyka §2). Liczony z dat analizy,
 * nie z okresu amortyzacji. `2026-01-01`…`2030-12-31` = 5 lat.
 */
export function horizonYears(analysisStart: string | null, analysisEnd: string | null): number | null {
  if (!analysisStart || !analysisEnd) return null;
  const start = new Date(analysisStart);
  const end = new Date(analysisEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
  if (months <= 0) return null;
  return Math.round(months / 12);
}

export interface RoiCardCashFlowRow {
  /** 0 = rok nakładu, 1..n = lata eksploatacji. */
  year: number;
  label: string;
  costs: number;
  benefits: number;
  net: number;
  cumulative: number;
  discounted: number | null;
  cumulativeDiscounted: number | null;
}

export interface BuildCashFlowInput {
  analysisStart: string | null;
  horizon: number | null;
  initialInvestment: number | null;
  annualCosts: number | null;
  annualBenefits: number | null;
  discountRatePct: number | null;
}

/**
 * Tabela przepływów rok 0–n (metodyka §15, struktura raportu §42 VII).
 *
 * Rok 0 niesie WYŁĄCZNIE nakład (pozycje jednorazowe), lata 1..n różnicę
 * cyklicznych korzyści i kosztów. To jest ta sama konwencja, którą przyjmuje
 * `investmentAppraisalService` (`initialInvestment` osobno od `cashflows[1..N]`),
 * więc tabela i wskaźniki nie mogą się rozjechać.
 */
export function buildCashFlowRows(input: BuildCashFlowInput): RoiCardCashFlowRow[] {
  const { analysisStart, horizon, initialInvestment, annualCosts, annualBenefits, discountRatePct } = input;
  if (!horizon || horizon <= 0) return [];
  const startYear = analysisStart ? new Date(analysisStart).getUTCFullYear() : null;
  const rate = typeof discountRatePct === 'number' ? discountRatePct / 100 : null;

  const rows: RoiCardCashFlowRow[] = [];
  let cumulative = 0;
  let cumulativeDiscounted = 0;

  const year0Costs = initialInvestment ?? 0;
  cumulative -= year0Costs;
  cumulativeDiscounted -= year0Costs;
  rows.push({
    year: 0,
    label: startYear ? String(startYear) : 'Rok 0',
    costs: year0Costs,
    benefits: 0,
    net: -year0Costs,
    cumulative,
    discounted: rate === null ? null : -year0Costs,
    cumulativeDiscounted: rate === null ? null : cumulativeDiscounted,
  });

  for (let t = 1; t <= horizon; t += 1) {
    const costs = annualCosts ?? 0;
    const benefits = annualBenefits ?? 0;
    const net = benefits - costs;
    cumulative += net;
    const discounted = rate === null ? null : net / Math.pow(1 + rate, t);
    if (discounted !== null) cumulativeDiscounted += discounted;
    rows.push({
      year: t,
      label: startYear ? String(startYear + t) : `Rok ${t}`,
      costs,
      benefits,
      net,
      cumulative,
      discounted,
      cumulativeDiscounted: rate === null ? null : cumulativeDiscounted,
    });
  }
  return rows;
}

export interface RoiCardIndicators {
  capex: number | null;
  annualNetBenefit: number | null;
  horizonYears: number | null;
  /** ROI za CAŁY horyzont, w procentach (metodyka §17 — zawsze z horyzontem). */
  roiPct: number | null;
  /** ARR = średni roczny zysk / średnia inwestycja (metodyka §19, pomocniczo). */
  arrPct: number | null;
  paybackYears: number | null;
  discountedPaybackYears: number | null;
  npv: number | null;
  irrPct: number | null;
  profitabilityIndex: number | null;
  benefitCostRatio: number | null;
  discountRatePct: number | null;
}

export interface ComputeIndicatorsInput {
  initialInvestment: number | null;
  annualNetBenefit: number | null;
  horizon: number | null;
  discountRatePct: number | null;
}

/** `Infinity` z `payback`/`discountedPayback` znaczy „nigdy się nie zwraca" —
 *  to nie jest liczba do pokazania, więc zamieniamy na `null` („—"). */
function finiteOrNull(value: number | null): number | null {
  if (value === null) return null;
  return Number.isFinite(value) ? value : null;
}

/**
 * Wskaźniki z metodyki §16–25 policzone ze ZAPISANEGO modelu.
 * Każdy zwraca `null`, gdy brakuje składnika — nigdy 0 zastępczego.
 */
export function computeRoiIndicators(input: ComputeIndicatorsInput): RoiCardIndicators {
  const { initialInvestment, annualNetBenefit, horizon, discountRatePct } = input;

  const base: RoiCardIndicators = {
    capex: initialInvestment,
    annualNetBenefit,
    horizonYears: horizon,
    roiPct: null,
    arrPct: null,
    paybackYears: null,
    discountedPaybackYears: null,
    npv: null,
    irrPct: null,
    profitabilityIndex: null,
    benefitCostRatio: null,
    discountRatePct,
  };

  if (initialInvestment === null || initialInvestment <= 0 || annualNetBenefit === null || !horizon) {
    return base;
  }

  const flows = Array.from({ length: horizon }, () => annualNetBenefit);
  const totalBenefits = annualNetBenefit * horizon;

  base.roiPct = ((totalBenefits - initialInvestment) / initialInvestment) * 100;
  // ARR: średnia roczna nadwyżka nad odpisem liniowym / średnia inwestycja.
  base.arrPct =
    ((annualNetBenefit - initialInvestment / horizon) / (initialInvestment / 2)) * 100;
  base.paybackYears = finiteOrNull(payback(flows, initialInvestment));
  base.benefitCostRatio = totalBenefits / initialInvestment;

  if (typeof discountRatePct === 'number') {
    base.npv = npv(flows, discountRatePct, initialInvestment);
    base.discountedPaybackYears = finiteOrNull(
      discountedPayback(flows, discountRatePct, initialInvestment)
    );
    base.profitabilityIndex = finiteOrNull(
      profitabilityIndex(flows, discountRatePct, initialInvestment)
    );
  }
  base.irrPct = irr(flows, initialInvestment);

  return base;
}

export interface RoiSensitivityRow {
  driverId: 'capex' | 'annual_benefit' | 'annual_opex' | 'discount_rate';
  minusNpv: number | null;
  minusRoiPct: number | null;
  minusPaybackYears: number | null;
  plusNpv: number | null;
  plusRoiPct: number | null;
  plusPaybackYears: number | null;
}

export interface SensitivityInput {
  initialInvestment: number | null;
  annualBenefits: number | null;
  annualCosts: number | null;
  horizon: number | null;
  discountRatePct: number | null;
  /** Wychylenie w procentach; metodyka §28 mówi ±20 %. */
  swingPct?: number;
}

/**
 * Wrażliwość pojedynczych zmiennych ±20 % (metodyka §28) — value drivers.
 *
 * ŚWIADOMIE liczona na STERUJĄCYCH WIELKOŚCIACH MODELU (CAPEX, roczna korzyść,
 * roczny OPEX, stopa dyskontowa), a nie na dowolnym założeniu z listy: schemat
 * nie ma żadnego powiązania założenie→pozycja (patrz nagłówek
 * `roiCalculationEngine.ts` o „mirror-matching"), więc wychylanie założenia
 * „stawka spawacza" bez takiego powiązania nie zmieniłoby ani jednej liczby i
 * dałoby tabelę samych zer — czyli kłamstwo o odporności modelu.
 */
export function computeSensitivity(input: SensitivityInput): RoiSensitivityRow[] {
  const {
    initialInvestment,
    annualBenefits,
    annualCosts,
    horizon,
    discountRatePct,
    swingPct = 20,
  } = input;
  if (initialInvestment === null || annualBenefits === null || !horizon) return [];
  const swing = swingPct / 100;
  const costs = annualCosts ?? 0;

  const at = (capex: number, benefits: number, opex: number, rate: number | null) =>
    computeRoiIndicators({
      initialInvestment: capex,
      annualNetBenefit: benefits - opex,
      horizon,
      discountRatePct: rate,
    });

  const rows: RoiSensitivityRow[] = [];
  const push = (
    driverId: RoiSensitivityRow['driverId'],
    minus: RoiCardIndicators,
    plus: RoiCardIndicators
  ) => {
    rows.push({
      driverId,
      minusNpv: minus.npv,
      minusRoiPct: minus.roiPct,
      minusPaybackYears: minus.paybackYears,
      plusNpv: plus.npv,
      plusRoiPct: plus.roiPct,
      plusPaybackYears: plus.paybackYears,
    });
  };

  push(
    'capex',
    at(initialInvestment * (1 - swing), annualBenefits, costs, discountRatePct),
    at(initialInvestment * (1 + swing), annualBenefits, costs, discountRatePct)
  );
  push(
    'annual_benefit',
    at(initialInvestment, annualBenefits * (1 - swing), costs, discountRatePct),
    at(initialInvestment, annualBenefits * (1 + swing), costs, discountRatePct)
  );
  if (costs > 0) {
    push(
      'annual_opex',
      at(initialInvestment, annualBenefits, costs * (1 - swing), discountRatePct),
      at(initialInvestment, annualBenefits, costs * (1 + swing), discountRatePct)
    );
  }
  if (typeof discountRatePct === 'number') {
    push(
      'discount_rate',
      at(initialInvestment, annualBenefits, costs, discountRatePct * (1 - swing)),
      at(initialInvestment, annualBenefits, costs, discountRatePct * (1 + swing))
    );
  }
  return rows;
}

/**
 * FAZA karty = najdalsza WYPEŁNIONA część (SSOT §4: Założenia → Wyliczenia →
 * Realizacja). Wyprowadzana z faktów, nie z pola statusu: „Realizacja" dopiero
 * gdy istnieje przegląd albo choć jedna wariancja, „Wyliczenia" gdy istnieje
 * zakończony przebieg kalkulacji, w przeciwnym razie „Założenia".
 */
export function deriveRoiCardPhase(facts: {
  hasCompletedRun: boolean;
  hasRealizationData: boolean;
}): RoiCardPhase {
  if (facts.hasRealizationData) return 'realization';
  if (facts.hasCompletedRun) return 'calculations';
  return 'assumptions';
}
