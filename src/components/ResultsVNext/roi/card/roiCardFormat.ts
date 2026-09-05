/**
 * ROI (P7K C) — formatowanie i etykiety karty analizy. CZYSTE funkcje, żeby
 * ten sam kod obsługiwał ekran żywy i harness dev-render (jedna prawda o tym,
 * jak wygląda liczba, zamiast dwóch, które cicho się rozjadą).
 *
 * TERMINOLOGIA WŁAŚCICIELA JEST NIETŁUMACZALNA. `GO / CONDITIONAL GO / NO-GO`,
 * `Conservative / Base / Upside`, `Expected / Actual`, `CAPEX`, `NPV`, `IRR`,
 * `PI`, `BCR`, `Payback` zostają po angielsku w OBU językach — to jest SSOT
 * właściciela (docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md §4), a nie
 * przeoczenie w tłumaczeniu. Reszta interfejsu jest po polsku bez wyjątku.
 *
 * BRAK = „—", NIGDY 0 (SSOT §6). Dlatego każdy formatter przyjmuje
 * `number | null` i sam decyduje o kresce — wywołujący nie ma jak o tym
 * zapomnieć.
 */
import type {
  RoiAssumptionVerdict,
  RoiBenefitClass,
  RoiCardCadence,
  RoiCardPhase,
  RoiInvestmentRecommendation,
} from './roiCardApi';

export const BRAK = '—';

const locale = (isPolish: boolean) => (isPolish ? 'pl-PL' : 'en-US');

export function fmtMoney(
  value: number | null | undefined,
  currency: string | null,
  isPolish: boolean
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return BRAK;
  try {
    return new Intl.NumberFormat(locale(isPolish), {
      style: 'currency',
      currency: currency || 'PLN',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString(locale(isPolish), { maximumFractionDigits: 0 })} ${currency ?? ''}`.trim();
  }
}

export function fmtPercent(
  value: number | null | undefined,
  isPolish: boolean,
  digits = 1
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return BRAK;
  return `${value.toLocaleString(locale(isPolish), { maximumFractionDigits: digits })}\u00a0%`;
}

export function fmtRatio(value: number | null | undefined, isPolish: boolean): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return BRAK;
  return value.toLocaleString(locale(isPolish), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Lata z jednostką, PO POLSKU POPRAWNIE.
 *
 * „2 roku" to ta sama klasa błędu, co osławione „8dni": liczba i słowo sklejone
 * bez odmiany. Polszczyzna ma tu trzy formy, zależne od tego, czy liczba jest
 * całkowita, i od jej dwóch ostatnich cyfr:
 *   1 rok · 2/3/4 lata (ale 12/13/14 lat) · 5-21 lat · ułamki „2,5 roku".
 * Spacja jest NIEŁAMLIWA — liczba i jednostka nigdy nie rozjadą się na dwie
 * linie (werdykt K2/K13).
 */
export function fmtYears(value: number | null | undefined, isPolish: boolean): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return BRAK;
  const n = value.toLocaleString(locale(isPolish), { maximumFractionDigits: 2 });
  if (!isPolish) return `${n}\u00a0yrs`;
  if (!Number.isInteger(value)) return `${n}\u00a0roku`;
  const abs = Math.abs(value);
  if (abs === 1) return `${n}\u00a0rok`;
  const last = abs % 10;
  const lastTwo = abs % 100;
  const lata = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14);
  return `${n}\u00a0${lata ? 'lata' : 'lat'}`;
}

export function fmtNumber(
  value: number | null | undefined,
  isPolish: boolean,
  digits = 0
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return BRAK;
  return value.toLocaleString(locale(isPolish), { maximumFractionDigits: digits });
}

export function fmtDate(value: string | null | undefined, isPolish: boolean): string {
  if (!value) return BRAK;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(locale(isPolish), { year: 'numeric', month: 'short', day: 'numeric' });
}

/** ROI zawsze Z HORYZONTEM (metodyka §17: „ROI 3Y", „ROI 5Y"), nigdy nagi procent. */
export function fmtRoiWithHorizon(
  roiPct: number | null | undefined,
  horizon: number | null | undefined,
  isPolish: boolean
): string {
  if (roiPct === null || roiPct === undefined || !Number.isFinite(roiPct)) return BRAK;
  const value = fmtPercent(roiPct, isPolish, 0);
  return horizon ? `ROI ${horizon}Y ${value}` : `ROI ${value}`;
}

export function roiHorizonLabel(horizon: number | null | undefined): string {
  return horizon ? `ROI ${horizon}Y` : 'ROI';
}

// ==========================================
// Etykiety — słownictwo właściciela
// ==========================================

/** Terminologia SSOT: wersalikami, bez tłumaczenia, w obu językach. */
export const RECOMMENDATION_LABEL: Record<RoiInvestmentRecommendation, string> = {
  go: 'GO',
  conditional_go: 'CONDITIONAL GO',
  no_go: 'NO-GO',
};

export function phaseLabel(phase: RoiCardPhase, isPolish: boolean): string {
  if (phase === 'realization') return isPolish ? 'Realizacja' : 'Realization';
  if (phase === 'calculations') return isPolish ? 'Wyliczenia' : 'Calculations';
  return isPolish ? 'Założenia' : 'Assumptions';
}

export function benefitClassLabel(cls: RoiBenefitClass | null, isPolish: boolean): string {
  if (!cls) return BRAK;
  // Nazwy klas są terminami metodyki (§33-35) — zostają po angielsku,
  // dokładnie jak GO / CONDITIONAL GO.
  if (cls === 'hard') return 'Hard';
  if (cls === 'avoided') return 'Avoided';
  if (cls === 'soft') return isPolish ? 'Soft (nie monetyzowana)' : 'Soft (not monetized)';
  return isPolish ? 'Strategic (nie monetyzowana)' : 'Strategic (not monetized)';
}

export function verdictLabel(v: RoiAssumptionVerdict | null, isPolish: boolean): string {
  if (!v) return BRAK;
  if (v === 'confirmed') return isPolish ? 'Potwierdzone' : 'Confirmed';
  if (v === 'partially_confirmed') return isPolish ? 'Częściowo potwierdzone' : 'Partially confirmed';
  return isPolish ? 'Obalone' : 'Refuted';
}

export function confidenceLabel(value: string | null, isPolish: boolean): string {
  if (!value) return BRAK;
  if (value === 'high') return isPolish ? 'wysoka' : 'high';
  if (value === 'medium') return isPolish ? 'średnia' : 'medium';
  if (value === 'low') return isPolish ? 'niska' : 'low';
  return value;
}

export function riskLevelLabel(value: string | null, isPolish: boolean): string {
  if (!value) return BRAK;
  if (value === 'high') return isPolish ? 'wysokie' : 'high';
  if (value === 'medium') return isPolish ? 'średnie' : 'medium';
  if (value === 'low') return isPolish ? 'niskie' : 'low';
  return value;
}

export function cadenceLabel(cadence: RoiCardCadence | null, isPolish: boolean): string {
  if (!cadence) return isPolish ? 'jednorazowo' : 'one-time';
  if (cadence === 'monthly') return isPolish ? 'miesięcznie' : 'monthly';
  if (cadence === 'quarterly') return isPolish ? 'kwartalnie' : 'quarterly';
  return isPolish ? 'rocznie' : 'annually';
}

/** Scenariusze: nazwy z SSOT właściciela, po angielsku w obu językach. */
export function scenarioTypeLabel(scenarioType: string): string {
  if (scenarioType === 'downside') return 'Conservative';
  if (scenarioType === 'upside') return 'Upside';
  if (scenarioType === 'base') return 'Base';
  return scenarioType;
}

export function sensitivityDriverLabel(
  driverId: 'capex' | 'annual_benefit' | 'annual_opex' | 'discount_rate',
  isPolish: boolean
): string {
  if (driverId === 'capex') return 'CAPEX';
  if (driverId === 'annual_benefit') return isPolish ? 'Roczna korzyść' : 'Annual benefit';
  if (driverId === 'annual_opex') return isPolish ? 'Roczny OPEX' : 'Annual OPEX';
  return isPolish ? 'Stopa dyskontowa' : 'Discount rate';
}

/** Etykieta wariantu inwestycyjnego: „2 · Pełna automatyzacja gniazda". */
export function variantLabel(
  optionVariant: number | null,
  optionVariantLabel: string | null
): string {
  if (optionVariant === null && !optionVariantLabel) return BRAK;
  if (optionVariant === null) return optionVariantLabel as string;
  return optionVariantLabel ? `${optionVariant} · ${optionVariantLabel}` : String(optionVariant);
}

/**
 * Znak wariancji z perspektywy KORZYSTNE/NIEKORZYSTNE.
 *
 * Kierunek nie jest oczywisty i NIE wolno go zgadywać ze znaku liczby:
 * CAPEX wyższy od oczekiwanego jest zły, a korzyść wyższa od oczekiwanej jest
 * dobra. Metryki, których kierunku nie znamy, wracają jako `neutral` —
 * wtedy liczba nie dostaje koloru semantycznego w ogóle, zamiast dostać
 * przypadkowy.
 */
export type RoiVarianceDirection = 'favourable' | 'unfavourable' | 'neutral';

const LOWER_IS_BETTER = ['capex', 'payback', 'opex', 'koszt', 'cost', 'nakład'];
const HIGHER_IS_BETTER = ['korzy', 'benefit', 'fte', 'output', 'roi', 'npv', 'irr', 'oee'];

export function varianceDirection(metric: string, varianceAmount: number | null): RoiVarianceDirection {
  if (varianceAmount === null || varianceAmount === 0) return 'neutral';
  const m = metric.toLowerCase();
  if (LOWER_IS_BETTER.some((k) => m.includes(k))) {
    return varianceAmount > 0 ? 'unfavourable' : 'favourable';
  }
  if (HIGHER_IS_BETTER.some((k) => m.includes(k))) {
    return varianceAmount > 0 ? 'favourable' : 'unfavourable';
  }
  return 'neutral';
}

/** Wariancja z jawnym znakiem („+80 000 zł", „−3"). Minus jest typograficzny
 *  (U+2212), żeby nie wyglądał jak dywiz w środku liczby. */
export function fmtSignedNumber(
  value: number | null,
  isPolish: boolean,
  suffix?: string
): string {
  if (value === null || !Number.isFinite(value)) return BRAK;
  const abs = Math.abs(value).toLocaleString(locale(isPolish), { maximumFractionDigits: 2 });
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${abs}${suffix ? ` ${suffix}` : ''}`;
}
