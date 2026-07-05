/**
 * Cash / Liquidity Forecast Service (M16 / 6.4)
 *
 * Pure functions for short-term liquidity planning:
 *
 *   1. directCashForecast — direct method (inflows − outflows), cumulative cash
 *   2. runway            — periods until cash is exhausted (closingCash ≤ 0)
 *   3. minCashAlerts     — periods where closingCash drops below a safety floor
 *   4. cashCurve         — flat {t, cash} series for the RunwayGauge component
 *
 * No I/O, no DB, no side effects — every export is referentially transparent.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CashForecastPeriodInput {
  /** Period label, e.g. "2026-01", "M1", "Q1". Optional — index used as fallback. */
  period?: string;
  inflows: number;
  outflows: number;
}

export interface CashForecastInput {
  /** Cash on hand at the start of the first period. */
  openingCash: number;
  periods: CashForecastPeriodInput[];
}

export interface CashForecastRow {
  period: string;
  inflows: number;
  outflows: number;
  /** inflows − outflows for the period. */
  netCash: number;
  /** Cumulative cash after this period. */
  closingCash: number;
}

export interface RunwayResult {
  /**
   * Number of periods the business can sustain before cash runs out
   * (first period whose closingCash ≤ 0). Equals the forecast length when
   * cash never goes non-positive.
   */
  runwayPeriods: number;
  /** Label of the first period where closingCash ≤ 0, or null if it never does. */
  cashOutPeriod: string | null;
}

export interface MinCashAlert {
  period: string;
  closingCash: number;
  /** How far below the floor — always > 0. (minCash − closingCash). */
  shortfall: number;
}

export interface CashCurvePoint {
  /** Period label. */
  t: string;
  /** Closing cash at that period. */
  cash: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function labelFor(period: string | undefined, index: number): string {
  if (typeof period === 'string' && period.trim().length > 0) return period;
  return `P${index + 1}`;
}

// ─── 1. Direct cash forecast ──────────────────────────────────────────────────

/**
 * Direct method cash forecast.
 *
 * For each period computes netCash = inflows − outflows and accumulates
 * closingCash starting from openingCash. The closingCash of one period is the
 * opening cash of the next.
 */
export function directCashForecast(input: CashForecastInput): CashForecastRow[] {
  const opening = num(input?.openingCash);
  const periods = Array.isArray(input?.periods) ? input.periods : [];

  let running = opening;
  return periods.map((p, i) => {
    const inflows = num(p?.inflows);
    const outflows = num(p?.outflows);
    const netCash = inflows - outflows;
    running += netCash;
    return {
      period: labelFor(p?.period, i),
      inflows,
      outflows,
      netCash,
      closingCash: running,
    };
  });
}

// ─── 2. Runway ─────────────────────────────────────────────────────────────────

/**
 * How many periods until cash is exhausted.
 *
 * Primary signal is the forecast itself: the first period whose closingCash ≤ 0
 * is the cash-out point, and runwayPeriods is the count of periods that survive
 * before it. If the forecast never goes non-positive and a monthlyBurn is
 * supplied, we extrapolate from the final closingCash (closing / burn additional
 * periods). With neither trigger, runwayPeriods = forecast length and
 * cashOutPeriod = null.
 */
export function runway(forecast: CashForecastRow[], monthlyBurn?: number): RunwayResult {
  const rows = Array.isArray(forecast) ? forecast : [];

  for (let i = 0; i < rows.length; i++) {
    if (num(rows[i]?.closingCash) <= 0) {
      return { runwayPeriods: i, cashOutPeriod: rows[i]?.period ?? null };
    }
  }

  // Cash survives the whole forecast. Optionally extrapolate with a flat burn.
  const burn = num(monthlyBurn);
  if (burn > 0 && rows.length > 0) {
    const finalCash = num(rows[rows.length - 1]?.closingCash);
    const extra = Math.floor(finalCash / burn);
    return { runwayPeriods: rows.length + extra, cashOutPeriod: null };
  }

  return { runwayPeriods: rows.length, cashOutPeriod: null };
}

// ─── 3. Minimum-cash alerts ────────────────────────────────────────────────────

/**
 * Periods where closingCash dips below a required minimum cash floor.
 * shortfall is the positive gap (minCash − closingCash).
 */
export function minCashAlerts(forecast: CashForecastRow[], minCash: number): MinCashAlert[] {
  const rows = Array.isArray(forecast) ? forecast : [];
  const floor = num(minCash);

  const alerts: MinCashAlert[] = [];
  for (const row of rows) {
    const closingCash = num(row?.closingCash);
    if (closingCash < floor) {
      alerts.push({
        period: row?.period ?? '',
        closingCash,
        shortfall: floor - closingCash,
      });
    }
  }
  return alerts;
}

// ─── 4. Cash curve (RunwayGauge) ───────────────────────────────────────────────

/**
 * Flat {t, cash} series mirroring closingCash over time — the shape the
 * RunwayGauge component consumes.
 */
export function cashCurve(forecast: CashForecastRow[]): CashCurvePoint[] {
  const rows = Array.isArray(forecast) ? forecast : [];
  return rows.map((row) => ({
    t: row?.period ?? '',
    cash: num(row?.closingCash),
  }));
}
