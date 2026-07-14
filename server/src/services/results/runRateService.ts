/**
 * runRateService — pure McKinsey-style run-rate vs in-year value functions.
 *
 * "Run-rate" annualizes value realized in a partial period (what the full year
 * would look like if the current pace held). "In-year" sums the value that has
 * actually landed within a given calendar year. The bridge reconciles the two:
 * already-realized value plus the run-rate projection over the months that
 * remain in the year.
 *
 * All functions are pure and deterministic. No argless `new Date()` — any year
 * boundary is taken from explicit inputs so results are reproducible in tests.
 */

/**
 * Annualized run-rate: project a partial-period realized value to a full year.
 * runRate = realizedInPeriod / periodMonths * 12.
 *
 * @param realizedInPeriod value realized over the elapsed period
 * @param periodMonths number of months the period spans (must be > 0)
 * @returns the annualized run-rate, or 0 when periodMonths <= 0
 */
export function annualizedRunRate(realizedInPeriod: number, periodMonths: number): number {
  if (!Number.isFinite(realizedInPeriod) || !Number.isFinite(periodMonths)) return 0;
  if (periodMonths <= 0) return 0;
  return (realizedInPeriod / periodMonths) * 12;
}

/**
 * In-year value: sum the realized values whose `month` falls in the given year.
 * `month` is expected as an ISO-ish string beginning with the 4-digit year,
 * e.g. "2026-03" or "2026-03-01". Entries that don't parse to `year` are ignored.
 *
 * @param monthlyRealized list of { month, value } points
 * @param year the calendar year to sum (e.g. 2026)
 * @returns the summed value for that year
 */
export function inYearValue(
  monthlyRealized: Array<{ month: string; value: number }>,
  year: number
): number {
  if (!Array.isArray(monthlyRealized)) return 0;
  return monthlyRealized.reduce((sum, point) => {
    if (!point || typeof point.month !== 'string') return sum;
    const pointYear = Number.parseInt(point.month.slice(0, 4), 10);
    if (pointYear !== year) return sum;
    const value = Number(point.value);
    if (!Number.isFinite(value)) return sum;
    return sum + value;
  }, 0);
}

export interface RunRateBridgeInput {
  /** value realized so far (within the current period) */
  realizedToDate: number;
  /** months the realized-to-date value spans (must be > 0 for a run-rate) */
  periodMonths: number;
  /** months still remaining in the calendar year to project over */
  remainingMonthsInYear: number;
}

export interface RunRateBridgeResult {
  /** annualized run-rate derived from realizedToDate / periodMonths */
  runRate: number;
  /** projected full in-year value = alreadyRealized + monthly run-rate * remaining */
  projectedInYear: number;
  /** value already realized to date (pass-through of input) */
  alreadyRealized: number;
}

/**
 * Run-rate bridge: reconcile already-realized value with a forward projection.
 * projectedInYear = alreadyRealized + (runRate / 12) * remainingMonthsInYear.
 *
 * @param input realizedToDate, periodMonths, remainingMonthsInYear
 * @returns { runRate, projectedInYear, alreadyRealized }
 */
export function runRateBridge(input: RunRateBridgeInput): RunRateBridgeResult {
  const alreadyRealized = Number.isFinite(input?.realizedToDate) ? input.realizedToDate : 0;
  const remaining =
    Number.isFinite(input?.remainingMonthsInYear) && input.remainingMonthsInYear > 0
      ? input.remainingMonthsInYear
      : 0;
  const runRate = annualizedRunRate(alreadyRealized, input?.periodMonths);
  const projectedInYear = alreadyRealized + (runRate / 12) * remaining;
  return { runRate, projectedInYear, alreadyRealized };
}

export interface ValueTimingItem {
  /** value realized for this item over its period */
  realizedValue?: number;
  /** months this item's realized value spans */
  periodMonths?: number;
}

export interface ValueTimingSplitResult {
  /** sum of annualized run-rates across all items */
  totalRunRate: number;
  /** sum of realized values across all items */
  totalRealized: number;
}

/**
 * Value timing split: aggregate a portfolio of items into total realized value
 * and total annualized run-rate. Missing values default to 0; items without a
 * positive periodMonths contribute 0 to the run-rate (but still to realized).
 *
 * @param items list of { realizedValue?, periodMonths? }
 * @returns { totalRunRate, totalRealized }
 */
export function valueTimingSplit(items: Array<ValueTimingItem>): ValueTimingSplitResult {
  if (!Array.isArray(items)) return { totalRunRate: 0, totalRealized: 0 };
  return items.reduce<ValueTimingSplitResult>(
    (acc, item) => {
      const realized = Number.isFinite(item?.realizedValue) ? (item.realizedValue as number) : 0;
      const months = Number.isFinite(item?.periodMonths) ? (item.periodMonths as number) : 0;
      acc.totalRealized += realized;
      acc.totalRunRate += annualizedRunRate(realized, months);
      return acc;
    },
    { totalRunRate: 0, totalRealized: 0 }
  );
}
