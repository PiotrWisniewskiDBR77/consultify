/**
 * counterfactualBaselineService — counterfactual baseline for attribution.
 *
 * Pure functions (no IO). Given the pre-intervention time series for a KPI,
 * estimate what the value WOULD have been at time `atT` if the initiative had
 * never happened (the "counterfactual" / "do-nothing" baseline), then derive
 * the attributable delta = observed − counterfactual.
 *
 * Method: ordinary-least-squares linear trend fit over the pre-intervention
 * points, extrapolated to `atT`. Confidence is a coarse label derived from the
 * number of pre points and the goodness of fit (R²) of that trend.
 */

export interface TimePoint {
  t: number;
  value: number;
}

export type ConfidenceLabel = 'low' | 'medium' | 'high';

export interface AttributableDeltaInput {
  observedValue: number;
  prePoints: TimePoint[];
  atT: number;
}

export interface AttributableDeltaResult {
  counterfactual: number | null;
  attributable: number | null;
  attributablePct: number | null;
}

interface LinearFit {
  slope: number;
  intercept: number;
  /** Coefficient of determination R² in [0,1]. 1 when all points are colinear. */
  r2: number;
  n: number;
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/** Keep only well-formed, finite points. */
function cleanPoints(prePoints: TimePoint[] | null | undefined): TimePoint[] {
  if (!Array.isArray(prePoints)) return [];
  return prePoints.filter(
    (p): p is TimePoint => !!p && isFiniteNumber(p.t) && isFiniteNumber(p.value)
  );
}

/**
 * Fit a least-squares line value = slope*t + intercept over the points.
 * Returns null when there are fewer than 2 distinct-t points (no determinable
 * trend).
 */
function fitLinearTrend(points: TimePoint[]): LinearFit | null {
  const n = points.length;
  if (n < 2) return null;

  let sumT = 0;
  let sumV = 0;
  for (const p of points) {
    sumT += p.t;
    sumV += p.value;
  }
  const meanT = sumT / n;
  const meanV = sumV / n;

  let sTT = 0; // Σ (t-meanT)²
  let sTV = 0; // Σ (t-meanT)(v-meanV)
  let sVV = 0; // Σ (v-meanV)²
  for (const p of points) {
    const dt = p.t - meanT;
    const dv = p.value - meanV;
    sTT += dt * dt;
    sTV += dt * dv;
    sVV += dv * dv;
  }

  // All points share the same t → trend is undefined (vertical line).
  if (sTT === 0) return null;

  const slope = sTV / sTT;
  const intercept = meanV - slope * meanT;

  // R²: when variance in value is 0 (flat series) the line fits perfectly.
  const r2 = sVV === 0 ? 1 : Math.max(0, Math.min(1, (sTV * sTV) / (sTT * sVV)));

  return { slope, intercept, r2, n };
}

/**
 * Extrapolate the pre-intervention linear trend to time `atT`.
 * Returns null when there is insufficient/degenerate data to determine a trend.
 */
export function projectCounterfactual(prePoints: TimePoint[], atT: number): number | null {
  if (!isFiniteNumber(atT)) return null;
  const pts = cleanPoints(prePoints);
  const fit = fitLinearTrend(pts);
  if (!fit) return null;
  const projected = fit.slope * atT + fit.intercept;
  return Number.isFinite(projected) ? projected : null;
}

/**
 * attributable = observed − counterfactual.
 * attributablePct = attributable / |counterfactual| (null when counterfactual is
 * 0 or unavailable).
 */
export function attributableDelta(input: AttributableDeltaInput): AttributableDeltaResult {
  const { observedValue, prePoints, atT } = input;
  const counterfactual = projectCounterfactual(prePoints, atT);

  if (counterfactual == null || !isFiniteNumber(observedValue)) {
    return { counterfactual, attributable: null, attributablePct: null };
  }

  const attributable = observedValue - counterfactual;
  const attributablePct =
    counterfactual === 0 ? null : attributable / Math.abs(counterfactual);

  return {
    counterfactual,
    attributable,
    attributablePct: attributablePct != null && Number.isFinite(attributablePct)
      ? attributablePct
      : null,
  };
}

/**
 * Coarse confidence label for the counterfactual estimate, derived from the
 * number of usable pre-intervention points and the goodness of fit (R²).
 *
 * - < 2 usable points or degenerate trend → 'low'
 * - >= 5 points and a strong fit (R² >= 0.8) → 'high'
 * - >= 3 points and a reasonable fit (R² >= 0.5) → 'medium'
 * - otherwise → 'low'
 */
export function confidenceLabel(prePoints: TimePoint[]): ConfidenceLabel {
  const pts = cleanPoints(prePoints);
  const fit = fitLinearTrend(pts);
  if (!fit) return 'low';

  const { n, r2 } = fit;
  if (n >= 5 && r2 >= 0.8) return 'high';
  if (n >= 3 && r2 >= 0.5) return 'medium';
  return 'low';
}
