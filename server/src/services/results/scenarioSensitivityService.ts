/**
 * scenarioSensitivityService — czyste funkcje finansowe dla M15 Rezultaty.
 *
 * Brak zależności od bazy / IO / czasu / losowości: w pełni deterministyczne,
 * dające się testować jednostkowo. Obejmuje:
 *   - npv(rate, cashflows)           — wartość bieżąca netto
 *   - irr(cashflows, guess?)         — wewnętrzna stopa zwrotu (Newton-Raphson)
 *   - paybackPeriod(cashflows)       — okres zwrotu (skumulowany dodatni)
 *   - runScenarios(base, scenarios)  — scenariusze (skalowanie dodatnich przepływów)
 *   - sensitivity(base, deltas)      — analiza wrażliwości NPV/IRR
 *
 * Konwencja przepływów: cashflows[0] to zwykle ujemny capex (nakład w okresie 0),
 * a kolejne elementy to przepływy w okresach 1..n.
 */

export interface ScenarioInput {
  cashflows: number[];
}

export interface ScenarioSpec {
  label: string;
  /** Mnożnik dla dodatnich przepływów (np. 0.8 = scenariusz pesymistyczny). */
  multiplier: number;
}

export interface ScenarioResult {
  label: string;
  irr: number | null;
  npv: number;
  payback: number | null;
}

export interface SensitivityInput {
  cashflows: number[];
  /** Stopa dyskontowa dla NPV; domyślnie 0.1. */
  rate?: number;
}

export interface SensitivityResult {
  deltaPct: number;
  npv: number;
  irr: number | null;
}

const DEFAULT_RATE = 0.1;

/**
 * Wartość bieżąca netto (NPV) dla zadanej stopy dyskontowej.
 * Element o indeksie t dyskontowany jest przez (1 + rate)^t.
 */
export function npv(rate: number, cashflows: number[]): number {
  if (!Array.isArray(cashflows) || cashflows.length === 0) return 0;
  let acc = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const cf = cashflows[t];
    if (!Number.isFinite(cf)) continue;
    acc += cf / Math.pow(1 + rate, t);
  }
  return acc;
}

/** Pochodna NPV względem stopy (dla metody Newtona). */
function npvDerivative(rate: number, cashflows: number[]): number {
  let acc = 0;
  for (let t = 1; t < cashflows.length; t++) {
    const cf = cashflows[t];
    if (!Number.isFinite(cf)) continue;
    acc += (-t * cf) / Math.pow(1 + rate, t + 1);
  }
  return acc;
}

/** Czy przepływy zmieniają znak (warunek konieczny istnienia IRR). */
function hasSignChange(cashflows: number[]): boolean {
  let sawPositive = false;
  let sawNegative = false;
  for (const cf of cashflows) {
    if (!Number.isFinite(cf) || cf === 0) continue;
    if (cf > 0) sawPositive = true;
    else sawNegative = true;
    if (sawPositive && sawNegative) return true;
  }
  return false;
}

/**
 * Wewnętrzna stopa zwrotu (IRR) — stopa, przy której NPV = 0.
 * Metoda Newtona-Raphsona z punktem startowym `guess`.
 * Zwraca null gdy: brak zmiany znaku przepływów, brak zbieżności,
 * lub gdy wynik nie jest skończony.
 */
export function irr(cashflows: number[], guess: number = 0.1): number | null {
  if (!Array.isArray(cashflows) || cashflows.length < 2) return null;
  if (!hasSignChange(cashflows)) return null;

  const MAX_ITER = 100;
  const TOL = 1e-7;

  let rate = Number.isFinite(guess) ? guess : 0.1;

  for (let i = 0; i < MAX_ITER; i++) {
    const value = npv(rate, cashflows);
    if (Math.abs(value) < TOL) {
      return Number.isFinite(rate) ? rate : null;
    }
    const deriv = npvDerivative(rate, cashflows);
    if (!Number.isFinite(deriv) || Math.abs(deriv) < 1e-12) {
      // Pochodna ~0 — Newton się załamuje.
      return null;
    }
    const next = rate - value / deriv;
    if (!Number.isFinite(next) || next <= -1) {
      // Stopa <= -100% wyprowadza dyskontowanie poza dziedzinę.
      return null;
    }
    if (Math.abs(next - rate) < TOL) {
      rate = next;
      return Number.isFinite(rate) ? rate : null;
    }
    rate = next;
  }

  // Brak zbieżności w limicie iteracji.
  return null;
}

/**
 * Okres zwrotu — pierwszy okres, w którym skumulowany przepływ staje się
 * (i pozostaje na danym kroku) dodatni. Zwraca null gdy nigdy nie osiągnięty.
 * Liczony jako liczba okresów; uwzględnia interpolację liniową w obrębie okresu.
 */
export function paybackPeriod(cashflows: number[]): number | null {
  if (!Array.isArray(cashflows) || cashflows.length === 0) return null;

  let cumulative = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const cf = Number.isFinite(cashflows[t]) ? cashflows[t] : 0;
    const prev = cumulative;
    cumulative += cf;
    if (cumulative >= 0) {
      if (t === 0) return 0;
      // Interpolacja w obrębie okresu t (prev < 0, cf > 0).
      if (cf > 0 && prev < 0) {
        const fraction = -prev / cf;
        return t - 1 + fraction;
      }
      return t;
    }
  }
  return null;
}

/** Skalowanie dodatnich przepływów przez mnożnik (ujemne pozostają nietknięte). */
function scalePositive(cashflows: number[], multiplier: number): number[] {
  return cashflows.map((cf) => (Number.isFinite(cf) && cf > 0 ? cf * multiplier : cf));
}

/**
 * Uruchamia zestaw scenariuszy. Każdy scenariusz skaluje dodatnie przepływy
 * bazowe przez swój mnożnik, po czym liczy IRR, NPV (rate = 0.1) i payback.
 */
export function runScenarios(base: ScenarioInput, scenarios: ScenarioSpec[]): ScenarioResult[] {
  const baseFlows = Array.isArray(base?.cashflows) ? base.cashflows : [];
  if (!Array.isArray(scenarios)) return [];

  return scenarios.map((s) => {
    const flows = scalePositive(baseFlows, s.multiplier);
    return {
      label: s.label,
      irr: irr(flows),
      npv: npv(DEFAULT_RATE, flows),
      payback: paybackPeriod(flows),
    };
  });
}

/**
 * Analiza wrażliwości: dla każdej delty (±frakcja) przeskalowuje WSZYSTKIE
 * przepływy o (1 + delta) i liczy NPV (przy base.rate ?? 0.1) oraz IRR.
 * deltaPct zwracane jako wejściowa delta (np. 0.1 = +10%).
 */
export function sensitivity(base: SensitivityInput, deltas: number[]): SensitivityResult[] {
  const baseFlows = Array.isArray(base?.cashflows) ? base.cashflows : [];
  const rate = Number.isFinite(base?.rate as number) ? (base.rate as number) : DEFAULT_RATE;
  if (!Array.isArray(deltas)) return [];

  return deltas.map((delta) => {
    const factor = 1 + delta;
    const flows = baseFlows.map((cf) => (Number.isFinite(cf) ? cf * factor : cf));
    return {
      deltaPct: delta,
      npv: npv(rate, flows),
      irr: irr(flows),
    };
  });
}
