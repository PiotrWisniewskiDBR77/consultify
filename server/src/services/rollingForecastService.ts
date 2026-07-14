/**
 * Rolling Forecast Service (M16/6.2)
 *
 * Pure, DB-free functions for rolling-forecast workflows:
 *
 *   1. reforecast      — blend closed-period actuals with future plan
 *   2. rollForward     — extend a forecast N periods forward by trend
 *   3. fyBridge        — full-year YTD-actual + remaining-forecast bridge vs plan
 *   4. snapshotForecast — capture an immutable, labelled forecast version
 *
 * No side effects, no Date.now(), no I/O. The caller supplies any "current
 * period" context (e.g. snapshot period) explicitly so the functions stay
 * deterministic and testable.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** A single period/value pair (plan, actual, or forecast input). */
export interface PeriodValue {
  period: string;
  value: number;
}

/** A reforecast line: blended actual-or-forecast value with provenance. */
export interface ReforecastLine {
  period: string;
  value: number;
  source: 'actual' | 'forecast';
}

/** Full-year bridge between plan and the blended forecast. */
export interface FyBridge {
  /** Sum of the plan across all periods. */
  fyPlan: number;
  /** YTD actuals + remaining forecast. */
  fyForecast: number;
  /** Sum of actuals for closed periods. */
  ytdActual: number;
  /** Sum of plan for periods not yet closed. */
  remainingForecast: number;
  /** fyForecast - fyPlan (positive = ahead of plan). */
  variance: number;
}

/** An immutable snapshot of a forecast version. */
export interface ForecastSnapshot {
  label: string;
  createdPeriod: string;
  lines: PeriodValue[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toActualMap(actuals: PeriodValue[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of actuals) {
    map.set(a.period, a.value);
  }
  return map;
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

// ─── 1. Re-forecast ───────────────────────────────────────────────────────────

/**
 * Blend plan with actuals: for closed periods (present in `actuals`) take the
 * actual value; for future periods keep the plan. The result preserves the
 * plan's period order and marks each line's provenance.
 *
 * FY total = YTD actual + remaining forecast (see {@link fyBridge}).
 */
export function reforecast(plan: PeriodValue[], actuals: PeriodValue[]): ReforecastLine[] {
  const actualMap = toActualMap(actuals);

  return plan.map((p) => {
    if (actualMap.has(p.period)) {
      return { period: p.period, value: actualMap.get(p.period)!, source: 'actual' };
    }
    return { period: p.period, value: p.value, source: 'forecast' };
  });
}

// ─── 2. Roll-forward ──────────────────────────────────────────────────────────

/**
 * Roll a forecast `byPeriods` periods forward, always emitting exactly
 * `byPeriods` new lines extrapolated from the trailing trend.
 *
 * The trend is the average step between the last two known points; with a
 * single point (or a flat series) it degrades to the last value. New period
 * labels are derived by incrementing the numeric suffix of the last period
 * (e.g. "2026-M03" -> "2026-M04"); if no numeric suffix exists, an index is
 * appended (e.g. "FY" -> "FY+1").
 */
export function rollForward(forecast: PeriodValue[], byPeriods = 1): PeriodValue[] {
  const n = Math.max(0, Math.floor(byPeriods));
  if (n === 0 || forecast.length === 0) {
    return [];
  }

  const last = forecast[forecast.length - 1];
  const prev = forecast.length >= 2 ? forecast[forecast.length - 2] : undefined;
  const step = prev ? last.value - prev.value : 0;

  const out: PeriodValue[] = [];
  for (let i = 1; i <= n; i++) {
    out.push({
      period: nextPeriod(last.period, i),
      value: last.value + step * i,
    });
  }
  return out;
}

/**
 * Derive the period label `offset` steps after `period` by incrementing its
 * trailing integer. Falls back to a `<period>+<offset>` suffix when there is
 * no trailing integer to increment.
 */
function nextPeriod(period: string, offset: number): string {
  const match = period.match(/^(.*?)(\d+)(\D*)$/);
  if (!match) {
    return `${period}+${offset}`;
  }
  const [, prefix, digits, suffix] = match;
  const next = Number(digits) + offset;
  const padded = String(next).padStart(digits.length, '0');
  return `${prefix}${padded}${suffix}`;
}

// ─── 3. FY bridge ─────────────────────────────────────────────────────────────

/**
 * Build the full-year bridge: YTD actuals (closed periods) plus remaining
 * forecast (plan for not-yet-closed periods), compared against the plan FY.
 *
 * Invariant: `ytdActual + remainingForecast === fyForecast`.
 */
export function fyBridge(plan: PeriodValue[], actuals: PeriodValue[]): FyBridge {
  const actualMap = toActualMap(actuals);

  let ytdActual = 0;
  let remainingForecast = 0;
  for (const p of plan) {
    if (actualMap.has(p.period)) {
      ytdActual += actualMap.get(p.period)!;
    } else {
      remainingForecast += p.value;
    }
  }

  const fyPlan = sum(plan.map((p) => p.value));
  const fyForecast = ytdActual + remainingForecast;

  return {
    fyPlan,
    fyForecast,
    ytdActual,
    remainingForecast,
    variance: fyForecast - fyPlan,
  };
}

// ─── 4. Snapshot ──────────────────────────────────────────────────────────────

/**
 * Capture an immutable, labelled snapshot of a forecast. The "created" period
 * is supplied by the caller (no Date.now()) to keep the function pure. Lines
 * are deep-copied so later mutation of the input does not leak into the snapshot.
 */
export function snapshotForecast(
  forecast: PeriodValue[],
  label: string,
  createdPeriod: string
): ForecastSnapshot {
  return {
    label,
    createdPeriod,
    lines: forecast.map((f) => ({ period: f.period, value: f.value })),
  };
}
