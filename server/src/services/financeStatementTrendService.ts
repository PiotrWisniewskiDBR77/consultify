/**
 * financeStatementTrendService — O4.6 Analiza sprawozdań (trend + driver + prognoza)
 * ============================================================================
 * WHY THIS EXISTS (the gap this closes)
 * -------------------------------------
 * `financeStatementAnalyticsService` already de-aggregates and periodises an
 * imported statement into per-line, per-period values. But it STOPS at the
 * point-in-time value + a mapping "comment". The CONCLUSION_LAYER_STANDARD §W3
 * demands a chain: indicator → **trend → driver → forecast** → recommendation.
 * A partner does not report "revenue 12.3M"; they report "revenue growing but
 * decelerating (K1 trend), driven by price not volume (K2 driver), heading to
 * ~13M next period if the trend holds (K2/K4 forecast)".
 *
 * This service takes a SERIES of statement values for a line (oldest→newest)
 * and returns:
 *   - a TREND fact (direction + CAGR + acceleration/deceleration) — part of the
 *     FACT (K1), derived deterministically, never guessed;
 *   - a DRIVER decomposition — WHICH child lines / components moved the parent,
 *     ranked by contribution to the change (the K2 driver, from data);
 *   - a FORECAST — extrapolated next value(s), ONLY when the series is long
 *     enough to justify it, always with an explicit method + assumption, else
 *     `null` (per §W3: forecast only when the engine can compute it or state a
 *     named assumption).
 *
 * Pure functions only (no I/O). An optional org-scoped DB loader assembles a
 * line series from `financial_statement_values`, degrading to an empty series
 * rather than throwing, so the pure functions remain the SoT.
 */

import { all as dbAll } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ─── types ──────────────────────────────────────────────────────────────────

/** One observed value in a series (oldest→newest ordering by `periodIndex`). */
export interface SeriesPoint {
  periodLabel: string;
  periodIndex: number;
  value: number;
}

export type TrendDirection = 'rising' | 'falling' | 'flat';
export type TrendShape = 'accelerating' | 'decelerating' | 'steady';

export interface TrendFact {
  direction: TrendDirection;
  /** Shape of the trend across the series (2nd-order): is it speeding up? */
  shape: TrendShape;
  /** Total change over the whole window, absolute. newest − oldest. */
  totalChange: number;
  /** Total change over the window, percent of oldest (Infinity if oldest 0). */
  totalChangePct: number;
  /** Compound growth rate per period, percent. null when non-computable. */
  cagrPct: number | null;
  /** Number of usable periods. Trend needs ≥ 2. */
  periods: number;
}

export interface DriverContribution {
  /** Component / child-line name. */
  name: string;
  /** Absolute change of this component over the same window. */
  change: number;
  /** Share of the parent's absolute change [0..1]; sign-aware magnitude. */
  contributionShare: number;
  /** 'amplifying' = pushes parent same direction; 'dampening' = opposes. */
  role: 'amplifying' | 'dampening';
}

export type ForecastMethod = 'cagr-extrapolation' | 'linear-extrapolation' | 'none';

export interface Forecast {
  method: ForecastMethod;
  /** Projected next value(s), same units. Empty when method === 'none'. */
  projected: Array<{ periodIndex: number; value: number }>;
  /** The named assumption behind the projection (§W3 hard requirement). */
  assumption: { pl: string; en: string } | null;
  /** Provenance: computed vs. not-enough-data. */
  confidence: 'computed' | 'insufficient-data';
}

export interface StatementTrendAnalysis {
  lineCode: string;
  lineName: string;
  series: SeriesPoint[];
  trend: TrendFact;
  drivers: DriverContribution[];
  forecast: Forecast;
}

// ─── pure core ────────────────────────────────────────────────────────────────

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Sort a series oldest→newest and drop non-finite values. */
function normaliseSeries(points: SeriesPoint[]): SeriesPoint[] {
  return (points ?? [])
    .filter((p) => p && isNum(p.value))
    .slice()
    .sort((a, b) => a.periodIndex - b.periodIndex);
}

/**
 * Compute the TREND fact from a value series. Deterministic — this is K1, not
 * interpretation. Direction from net change; shape from whether successive
 * period-over-period deltas are growing (accelerating) or shrinking.
 */
export function computeTrend(points: SeriesPoint[], flatTolerancePct = 1): TrendFact {
  const s = normaliseSeries(points);
  const periods = s.length;
  if (periods < 2) {
    return {
      direction: 'flat',
      shape: 'steady',
      totalChange: 0,
      totalChangePct: 0,
      cagrPct: null,
      periods,
    };
  }

  const oldest = s[0].value;
  const newest = s[s.length - 1].value;
  const totalChange = round2(newest - oldest);
  const totalChangePct = oldest === 0 ? Infinity : round2((totalChange / Math.abs(oldest)) * 100);

  let direction: TrendDirection = 'flat';
  if (totalChangePct === Infinity) direction = totalChange > 0 ? 'rising' : 'falling';
  else if (Math.abs(totalChangePct) < flatTolerancePct) direction = 'flat';
  else direction = totalChange > 0 ? 'rising' : 'falling';

  // CAGR: only when both endpoints strictly positive (compound growth defined).
  let cagrPct: number | null = null;
  if (oldest > 0 && newest > 0 && periods >= 2) {
    const steps = periods - 1;
    cagrPct = round2((Math.pow(newest / oldest, 1 / steps) - 1) * 100);
  }

  // Shape: compare magnitude of the first half's average delta to the second.
  const deltas: number[] = [];
  for (let i = 1; i < s.length; i += 1) deltas.push(s[i].value - s[i - 1].value);
  let shape: TrendShape = 'steady';
  if (deltas.length >= 2) {
    const mid = Math.floor(deltas.length / 2);
    const firstHalf = deltas.slice(0, mid);
    const secondHalf = deltas.slice(mid);
    const avg = (arr: number[]): number =>
      arr.length ? arr.reduce((a, b) => a + Math.abs(b), 0) / arr.length : 0;
    const early = avg(firstHalf);
    const late = avg(secondHalf);
    const shapeTol = Math.abs(oldest || 1) * 0.02; // 2% of scale = "steady"
    if (late - early > shapeTol) shape = 'accelerating';
    else if (early - late > shapeTol) shape = 'decelerating';
  }

  return { direction, shape, totalChange, totalChangePct, cagrPct, periods };
}

/**
 * Decompose the parent's change into component contributions. Each component
 * carries its own oldest/newest series endpoints; the share is |Δcomponent| /
 * Σ|Δcomponents|, and `role` says whether it pushed the parent the same way
 * (amplifying) or against it (dampening). This is the K2 driver — from data.
 *
 * Ranked by absolute contribution descending (biggest mover first).
 */
export function decomposeDrivers(
  parentChange: number,
  components: Array<{ name: string; oldest: number; newest: number }>
): DriverContribution[] {
  const comps = (components ?? [])
    .filter((c) => c && isNum(c.oldest) && isNum(c.newest))
    .map((c) => ({ name: c.name, change: round2(c.newest - c.oldest) }));

  const totalAbs = comps.reduce((sum, c) => sum + Math.abs(c.change), 0);
  const parentDir = Math.sign(parentChange);

  return comps
    .map((c) => {
      const share = totalAbs === 0 ? 0 : round2(Math.abs(c.change) / totalAbs);
      const compDir = Math.sign(c.change);
      // Amplifying = moves the parent in its own net direction.
      const role: 'amplifying' | 'dampening' =
        parentDir === 0 || compDir === 0
          ? 'amplifying'
          : compDir === parentDir
            ? 'amplifying'
            : 'dampening';
      return { name: c.name, change: c.change, contributionShare: share, role };
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

/**
 * Extrapolate the next `horizon` period(s) — ONLY when the series is long
 * enough (≥ 3 points) to justify a projection. Prefers CAGR (compound) when
 * the trend is a clean positive-valued series; falls back to linear (last
 * period-over-period average delta). Returns method 'none' + insufficient-data
 * when the series is too short — never fabricates a number (§W3).
 */
export function extrapolate(points: SeriesPoint[], horizon = 1): Forecast {
  const s = normaliseSeries(points);
  if (s.length < 3) {
    return {
      method: 'none',
      projected: [],
      assumption: null,
      confidence: 'insufficient-data',
    };
  }

  const oldest = s[0].value;
  const newest = s[s.length - 1].value;
  const lastIndex = s[s.length - 1].periodIndex;
  const steps = s.length - 1;
  const projected: Array<{ periodIndex: number; value: number }> = [];

  // CAGR path: clean strictly-positive series → compound extrapolation.
  if (oldest > 0 && newest > 0) {
    const growth = Math.pow(newest / oldest, 1 / steps);
    let val = newest;
    for (let h = 1; h <= horizon; h += 1) {
      val = val * growth;
      projected.push({ periodIndex: lastIndex + h, value: round2(val) });
    }
    const ratePct = round2((growth - 1) * 100);
    return {
      method: 'cagr-extrapolation',
      projected,
      assumption: {
        pl: `Ekstrapolacja przy utrzymaniu średniego tempa ${ratePct}%/okres z ${s.length} okresów. Założenie: brak zdarzeń jednorazowych i strukturalnych zmian.`,
        en: `Extrapolation assuming the average ${ratePct}%/period rate from ${s.length} periods holds. Assumption: no one-off events or structural changes.`,
      },
      confidence: 'computed',
    };
  }

  // Linear fallback: average period-over-period delta.
  const deltas: number[] = [];
  for (let i = 1; i < s.length; i += 1) deltas.push(s[i].value - s[i - 1].value);
  const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  let val = newest;
  for (let h = 1; h <= horizon; h += 1) {
    val = val + avgDelta;
    projected.push({ periodIndex: lastIndex + h, value: round2(val) });
  }
  return {
    method: 'linear-extrapolation',
    projected,
    assumption: {
      pl: `Ekstrapolacja liniowa przy średniej zmianie ${round2(avgDelta)}/okres z ${s.length} okresów (seria zawiera wartości ≤ 0 — tempo złożone niezdefiniowane). Założenie: utrzymanie tempa liniowego.`,
      en: `Linear extrapolation at the average ${round2(avgDelta)}/period change from ${s.length} periods (series contains values ≤ 0 — compound rate undefined). Assumption: a steady linear pace.`,
    },
    confidence: 'computed',
  };
}

/**
 * Full O4.6 analysis for one statement line: trend + drivers + forecast.
 * `componentSeries` (optional) is the set of child lines whose changes drive
 * the parent — when absent, `drivers` is empty (honest: no decomposition data).
 */
export function analyseStatementLine(params: {
  lineCode: string;
  lineName: string;
  series: SeriesPoint[];
  componentSeries?: Array<{ name: string; oldest: number; newest: number }>;
  forecastHorizon?: number;
}): StatementTrendAnalysis {
  const series = normaliseSeries(params.series);
  const trend = computeTrend(series);
  const drivers = params.componentSeries?.length
    ? decomposeDrivers(trend.totalChange, params.componentSeries)
    : [];
  const forecast = extrapolate(series, params.forecastHorizon ?? 1);

  return {
    lineCode: params.lineCode,
    lineName: params.lineName,
    series,
    trend,
    drivers,
    forecast,
  };
}

// ─── optional org-scoped DB loader ───────────────────────────────────────────

/**
 * Load the value series for one canonical line across all imported statements
 * of an org, ordered oldest→newest. Period ordering uses the statement's
 * fiscal period when present, else the row/import order. Best-effort: schema
 * drift or missing tables degrade to an empty series rather than throwing.
 */
export async function loadLineSeries(params: {
  organizationId: string;
  lineCode: string;
}): Promise<SeriesPoint[]> {
  try {
    const rows = await dbAll(
      `SELECT
         COALESCE(fs.period_label, fs.period_end::text, fs.id::text) AS "periodLabel",
         ROW_NUMBER() OVER (
           ORDER BY fs.period_end NULLS LAST, fs.period_start NULLS LAST, fs.id
         ) - 1                                                        AS "periodIndex",
         SUM(fsv.value)                                               AS "value"
       FROM financial_statement_values fsv
       JOIN financial_statement_lines fsl ON fsl.id = fsv.canonical_line_id
       JOIN financial_statements fs ON fs.id = fsv.statement_id
       WHERE fs.organization_id = ? AND fsl.line_code = ?
       GROUP BY fs.id, fs.period_label, fs.period_end, fs.period_start
       ORDER BY fs.period_end NULLS LAST, fs.period_start NULLS LAST, fs.id`,
      [params.organizationId, params.lineCode]
    );
    return (rows ?? []).map((r: any, i: number) => ({
      periodLabel: String(r.periodLabel ?? `P${i}`),
      periodIndex: Number(r.periodIndex ?? i),
      value: Number(r.value ?? 0),
    }));
  } catch (err) {
    logger.warn(
      `[financeStatementTrend] loadLineSeries failed for org ${params.organizationId} line ${params.lineCode}: ${
        (err as Error)?.message ?? err
      }`
    );
    return [];
  }
}
