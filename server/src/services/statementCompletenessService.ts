/**
 * statementCompletenessService — M16/9.5 Statement Completeness
 *
 * Pure (side-effect-free) helpers that close three P1 audit gaps in financial
 * statement completeness analysis:
 *   1. FX — convert/normalize line values across currencies to one presentation
 *      currency before any completeness or comparison logic runs.
 *   2. Multi-year — merge several single-period statements into a YoY time series
 *      keyed by line code.
 *   3. Readiness threshold — a statement is "ready" when REQUIRED lines reach
 *      100% coverage, not when *every* line (incl. optional) does. The old
 *      all-lines-100% rule was too restrictive.
 *
 * No DB, no I/O — everything here is deterministic and unit-testable in isolation.
 */

export interface StatementLine {
  code: string;
  value: number;
  /** ISO-ish currency code (e.g. 'PLN', 'EUR'). Optional → treated as base. */
  currency?: string;
}

/** Map of currency code → rate expressed in the base currency (1 unit = rate base). */
export type FxRates = Record<string, number>;

export interface NormalizedLine {
  code: string;
  value: number;
  originalCcy: string;
}

export interface MultiYearStatement {
  period: string;
  lines: StatementLine[];
}

export interface MergedMultiYear {
  periods: string[];
  byCode: Record<string, number[]>;
}

export interface YoYPoint {
  period: string;
  value: number;
  /** Year-over-year percentage change vs the previous period; null for the first point. */
  yoyPct: number | null;
}

export interface ReadinessResult {
  ready: boolean;
  reason: string;
}

const BASE_CCY = '__BASE__';

function normalizeCode(ccy: string | undefined): string {
  return (ccy ?? BASE_CCY).trim().toUpperCase();
}

/**
 * Convert a value from `fromCcy` to `toCcy` using rates expressed in the base
 * currency. Returns `null` when a required rate is missing (caller decides how
 * to surface incompleteness) rather than throwing.
 *
 * rates[ccy] = how many base-currency units 1 unit of `ccy` is worth.
 * The base currency itself does not need an entry (implicit rate 1).
 */
export function convertCurrency(
  value: number,
  fromCcy: string | undefined,
  toCcy: string | undefined,
  rates: FxRates,
): number | null {
  if (!Number.isFinite(value)) return null;

  const from = normalizeCode(fromCcy);
  const to = normalizeCode(toCcy);

  if (from === to) return value;

  const rateFrom = from === BASE_CCY ? 1 : rates[from];
  const rateTo = to === BASE_CCY ? 1 : rates[to];

  if (rateFrom == null || !Number.isFinite(rateFrom) || rateFrom === 0) return null;
  if (rateTo == null || !Number.isFinite(rateTo) || rateTo === 0) return null;

  // value (from) → base → to
  const inBase = value * rateFrom;
  return inBase / rateTo;
}

/**
 * Normalize all statement lines to a single presentation currency.
 * Lines whose conversion fails (missing rate) keep their original value and
 * carry their original currency code so the caller can detect FX gaps.
 */
export function normalizeToPresentation(
  lines: StatementLine[],
  presentationCcy: string,
  rates: FxRates,
): NormalizedLine[] {
  if (!Array.isArray(lines)) return [];

  return lines.map((line) => {
    const originalCcy = normalizeCode(line.currency);
    const converted = convertCurrency(line.value, line.currency, presentationCcy, rates);
    return {
      code: line.code,
      value: converted == null ? line.value : converted,
      originalCcy,
    };
  });
}

/**
 * Merge several single-period statements into a time series per line code.
 * Periods are emitted in input order; `byCode[code]` is an array aligned to
 * `periods` (0 for a period where the line is absent).
 */
export function mergeMultiYear(statements: MultiYearStatement[]): MergedMultiYear {
  if (!Array.isArray(statements) || statements.length === 0) {
    return { periods: [], byCode: {} };
  }

  const periods: string[] = statements.map((s) => s.period);

  // Collect the union of all codes seen across every statement.
  const allCodes = new Set<string>();
  for (const stmt of statements) {
    for (const line of stmt.lines ?? []) {
      allCodes.add(line.code);
    }
  }

  const byCode: Record<string, number[]> = {};
  for (const code of allCodes) {
    byCode[code] = statements.map((stmt) => {
      const match = (stmt.lines ?? []).find((l) => l.code === code);
      return match && Number.isFinite(match.value) ? match.value : 0;
    });
  }

  return { periods, byCode };
}

/**
 * Compute year-over-year change for a single code's series.
 * Accepts either an aligned value array or an array of {period, value} points.
 * yoyPct is a percentage (e.g. 10 means +10%); null for the first point and
 * when the prior value is 0 (division undefined).
 */
export function computeYoY(
  series: number[] | Array<{ period: string; value: number }>,
): YoYPoint[] {
  if (!Array.isArray(series) || series.length === 0) return [];

  const points: Array<{ period: string; value: number }> = series.map((entry, idx) => {
    if (typeof entry === 'number') {
      return { period: String(idx), value: entry };
    }
    return { period: entry.period, value: entry.value };
  });

  return points.map((point, idx) => {
    if (idx === 0) {
      return { period: point.period, value: point.value, yoyPct: null };
    }
    const prev = points[idx - 1].value;
    if (!Number.isFinite(prev) || prev === 0) {
      return { period: point.period, value: point.value, yoyPct: null };
    }
    const yoyPct = ((point.value - prev) / Math.abs(prev)) * 100;
    return { period: point.period, value: point.value, yoyPct };
  });
}

/**
 * Readiness threshold — a statement is ready when its REQUIRED lines reach
 * 100% coverage. This deliberately ignores optional lines: covering every
 * single line (the old rule) was too restrictive and blocked otherwise-usable
 * statements.
 *
 * @param coverage          map of required-line code → covered (truthy) / not.
 * @param requiredCoverage  the set of codes that MUST be present.
 */
export function readinessThreshold(
  coverage: Record<string, boolean>,
  requiredCoverage: string[],
): ReadinessResult {
  const required = Array.isArray(requiredCoverage) ? requiredCoverage : [];

  if (required.length === 0) {
    return { ready: true, reason: 'No required lines defined — vacuously ready.' };
  }

  const cov = coverage ?? {};
  const missing = required.filter((code) => !cov[code]);

  if (missing.length === 0) {
    return {
      ready: true,
      reason: `All ${required.length} required line(s) covered (optional lines not required).`,
    };
  }

  const coveredCount = required.length - missing.length;
  const pct = Math.round((coveredCount / required.length) * 100);
  return {
    ready: false,
    reason: `Required coverage ${pct}% — missing: ${missing.join(', ')}.`,
  };
}
