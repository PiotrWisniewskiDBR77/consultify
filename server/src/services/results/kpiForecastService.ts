/**
 * kpiForecastService — czysta prognoza trajektorii KPI (regresja liniowa).
 *
 * Brak zależności od bazy/IO. Działa na szeregu punktów {t, value} i pozwala:
 *  - wyznaczyć trend (least squares),
 *  - prognozować wartość w danym t,
 *  - oszacować, kiedy (i czy) trajektoria osiągnie target wg kierunku KPI,
 *  - wystawić alert wyprzedzający, gdy target nie zostanie trafiony przed deadline.
 */

export type KpiDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';

export interface TrendPoint {
  t: number;
  value: number;
}

export interface LinearTrend {
  slope: number;
  intercept: number;
}

export interface ProjectToTargetInput {
  points: TrendPoint[];
  target: number;
  direction: KpiDirection;
}

export type ForecastConfidence = 'low' | 'medium' | 'high';

export interface ProjectToTargetResult {
  willHitTarget: boolean;
  etaT: number | null;
  projectedAtLast: number | null;
  confidence: ForecastConfidence;
}

export interface LeadingAlertResult {
  alert: boolean;
  message: string;
}

const EPS = 1e-9;

function sanitize(points: TrendPoint[] | null | undefined): TrendPoint[] {
  if (!Array.isArray(points)) return [];
  return points.filter((p) => p != null && Number.isFinite(p.t) && Number.isFinite(p.value));
}

/**
 * Regresja liniowa metodą najmniejszych kwadratów.
 * Gdy < 2 punkty → slope = 0 (intercept = wartość jedynego punktu lub 0).
 */
export function linearTrend(points: Array<{ t: number; value: number }>): LinearTrend {
  const pts = sanitize(points);
  const n = pts.length;

  if (n < 2) {
    return { slope: 0, intercept: n === 1 ? pts[0].value : 0 };
  }

  let sumT = 0;
  let sumV = 0;
  let sumTT = 0;
  let sumTV = 0;
  for (const p of pts) {
    sumT += p.t;
    sumV += p.value;
    sumTT += p.t * p.t;
    sumTV += p.t * p.value;
  }

  const denom = n * sumTT - sumT * sumT;
  if (Math.abs(denom) < EPS) {
    // Wszystkie t identyczne — brak nachylenia, intercept = średnia wartości.
    return { slope: 0, intercept: sumV / n };
  }

  const slope = (n * sumTV - sumT * sumV) / denom;
  const intercept = (sumV - slope * sumT) / n;
  return { slope, intercept };
}

/**
 * Prognozowana wartość w punkcie atT z trendu liniowego.
 * Zwraca null, gdy brak punktów (nie da się dopasować linii).
 */
export function forecastValue(
  points: Array<{ t: number; value: number }>,
  atT: number
): number | null {
  const pts = sanitize(points);
  if (pts.length === 0 || !Number.isFinite(atT)) return null;
  const { slope, intercept } = linearTrend(pts);
  return slope * atT + intercept;
}

/**
 * Współczynnik determinacji R² dla dopasowania liniowego.
 * Gdy wariancja wartości ~ 0 (linia pozioma idealna) → 1.
 */
function rSquared(pts: TrendPoint[], trend: LinearTrend): number {
  const n = pts.length;
  if (n < 2) return 0;
  const meanV = pts.reduce((acc, p) => acc + p.value, 0) / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of pts) {
    const predicted = trend.slope * p.t + trend.intercept;
    ssTot += (p.value - meanV) ** 2;
    ssRes += (p.value - predicted) ** 2;
  }
  if (ssTot < EPS) {
    // Brak zmienności w danych — jeśli reszty też ~0, to perfekcyjne dopasowanie.
    return ssRes < EPS ? 1 : 0;
  }
  const r2 = 1 - ssRes / ssTot;
  if (!Number.isFinite(r2)) return 0;
  return Math.max(0, Math.min(1, r2));
}

function confidenceFrom(nPoints: number, r2: number): ForecastConfidence {
  if (nPoints < 2) return 'low';
  if (nPoints >= 5 && r2 >= 0.8) return 'high';
  if (nPoints >= 3 && r2 >= 0.5) return 'medium';
  return 'low';
}

/**
 * Z trendu policz, kiedy trajektoria osiągnie target.
 *  - willHitTarget zależy od kierunku: dla HIGHER_IS_BETTER target trafiony,
 *    gdy prognoza osiąga/przekracza target w przyszłości (t > ostatni t);
 *    dla LOWER_IS_BETTER analogicznie w dół.
 *  - etaT = t, w którym linia trendu zrównuje się z targetem (null gdy nieosiągalne).
 *  - projectedAtLast = wartość prognozy w ostatnim t.
 *  - confidence wyliczone z liczby punktów + dopasowania (R²).
 */
export function projectToTarget(input: ProjectToTargetInput): ProjectToTargetResult {
  const pts = sanitize(input?.points);
  const target = input?.target;
  const direction: KpiDirection = input?.direction ?? 'HIGHER_IS_BETTER';

  if (pts.length === 0 || !Number.isFinite(target)) {
    return { willHitTarget: false, etaT: null, projectedAtLast: null, confidence: 'low' };
  }

  const trend = linearTrend(pts);
  const r2 = rSquared(pts, trend);
  const confidence = confidenceFrom(pts.length, r2);

  const lastT = pts.reduce((acc, p) => Math.max(acc, p.t), pts[0].t);
  const projectedAtLast = trend.slope * lastT + trend.intercept;

  // Czy obecna prognoza (na ostatnim t) już spełnia target?
  const alreadyMet =
    direction === 'HIGHER_IS_BETTER' ? projectedAtLast >= target : projectedAtLast <= target;

  // Punkt przecięcia z targetem: slope * t + intercept = target.
  let crossT: number | null = null;
  if (Math.abs(trend.slope) >= EPS) {
    crossT = (target - trend.intercept) / trend.slope;
  } else {
    // Trend płaski — osiągnięcie zależy wyłącznie od tego, czy już spełniony.
    crossT = alreadyMet ? lastT : null;
  }

  // Czy trend zmierza we właściwą stronę względem kierunku?
  const movingTowardTarget = direction === 'HIGHER_IS_BETTER' ? trend.slope > 0 : trend.slope < 0;

  let willHitTarget: boolean;
  let etaT: number | null;

  if (alreadyMet) {
    willHitTarget = true;
    // Jeśli już spełniony, ETA = pierwszy moment przecięcia (lub ostatni t).
    etaT = crossT != null && Number.isFinite(crossT) ? Math.min(crossT, lastT) : lastT;
  } else if (movingTowardTarget && crossT != null && Number.isFinite(crossT) && crossT >= lastT) {
    willHitTarget = true;
    etaT = crossT;
  } else {
    willHitTarget = false;
    etaT = null;
  }

  return {
    willHitTarget,
    etaT,
    projectedAtLast: Number.isFinite(projectedAtLast) ? projectedAtLast : null,
    confidence,
  };
}

/**
 * Alert wyprzedzający — sygnalizuje, gdy prognoza nie trafi w target
 * (w ogóle, lub nie przed podanym deadline).
 */
export function leadingAlert(proj: ProjectToTargetResult, deadlineT?: number): LeadingAlertResult {
  if (!proj) {
    return { alert: false, message: 'Brak prognozy.' };
  }

  if (!proj.willHitTarget) {
    return {
      alert: true,
      message: 'Prognoza wskazuje, że KPI nie osiągnie targetu przy obecnym trendzie.',
    };
  }

  if (
    deadlineT != null &&
    Number.isFinite(deadlineT) &&
    proj.etaT != null &&
    proj.etaT > deadlineT
  ) {
    return {
      alert: true,
      message: `KPI osiągnie target dopiero w t=${proj.etaT}, po deadline t=${deadlineT}.`,
    };
  }

  return { alert: false, message: 'KPI na trajektorii do trafienia w target.' };
}

export default {
  linearTrend,
  forecastValue,
  projectToTarget,
  leadingAlert,
};
