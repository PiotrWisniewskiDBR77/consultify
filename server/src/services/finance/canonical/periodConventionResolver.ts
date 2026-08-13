/**
 * Finance v3 canonical — Analysis period-convention resolver (Gate D / Fala 4, WP-D04).
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 6 (period conventions: average balance, LTM, interim annualization,
 * days in period). Schema: `docs/validation/finance-v3/generated/gate-d/
 * WP-D03_analysis_schema_ADR.md` section 6.4 ("Period conventions — realizacja
 * przez `periodOffset` + dynamiczne stałe"). Reuses `finance_stmt_periods`
 * (WP-D01) EXACTLY as that ADR shipped it — this module projects no period
 * table of its own and does not duplicate `previous_period_id` navigation
 * with a date heuristic (ADR section 2.1 / 6.4: "reużywa istniejący jawny
 * łańcuch okresów, nie heurystykę dat").
 *
 * PURE module: zero DB imports. Takes a `PeriodGraphLookup` callback (a plain
 * function over an in-memory `Map`/object the caller already loaded via one
 * `SELECT * FROM finance_stmt_periods WHERE fiscal_calendar_id = ...` query)
 * so every function here is unit-testable without a database, exactly the
 * "pure, DB-free" discipline `lifecycleService.ts` already established for
 * the state machine and `statementReconciliationService.ts`'s
 * `computeWaterfall` already established for the waterfall math.
 *
 * `kpiComputeService.ts` is the only caller that touches Postgres — it loads
 * the period rows once per compute run and passes a `PeriodGraphLookup`
 * closure into this module's functions (and, transitively, into
 * `formulaAstEvaluator.ts`'s `CellResolver`).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PeriodType = 'FY' | 'Q' | 'MONTH' | 'WEEK';

/** Mirrors the columns of `finance_stmt_periods` (WP-D01) this module actually needs. */
export interface PeriodMeta {
  periodId: string;
  periodType: PeriodType;
  fiscalYear: number;
  fiscalQuarter: number | null;
  fiscalMonth: number | null;
  /** ISO date string (`YYYY-MM-DD`), as returned by the pg driver for a DATE column. */
  periodStart: string;
  periodEnd: string;
  previousPeriodId: string | null;
}

export type PeriodGraphLookup = (periodId: string) => PeriodMeta | undefined;

/**
 * The 6 `periodOffset` values `CellRefOperand.periodOffset` may carry
 * (WP-D03 ADR section 5.2's `CellRefOperand` JSON schema, verbatim).
 */
export type PeriodOffset =
  | 'CURRENT'
  | 'PRIOR_PERIOD'
  | 'PRIOR_YEAR_SAME_PERIOD'
  | 'AVERAGE_CURRENT_AND_PRIOR'
  | 'LTM_SUM_4Q'
  | 'LTM_LATEST_Q_CLOSE';

export type CombineStrategy = 'SINGLE' | 'AVERAGE' | 'SUM';

export type ResolvedPeriodPlanFailureReason =
  /** No `previous_period_id` chain far enough back (ADR 6.4: "Brak poprzedniego okresu ... quality_flag='INSUFFICIENT_HISTORY', nie cichy fallback"). Maps 1:1 to the `finance_analysis_kpi_values.quality_flag` DB enum value. */
  | 'INSUFFICIENT_HISTORY'
  /** LTM requested against a period whose `period_type` is not `'Q'` (ADR 6.4: "Wymaga danych kwartalnych ... to jest warunek readiness, nie CHECK"). Not itself a DB `quality_flag` value — this is a configuration/readiness problem the readiness gate (WP-D03b file 4) is supposed to catch before compute ever runs, not a data-quality fact about one cell. */
  | 'WRONG_PERIOD_TYPE_FOR_LTM'
  /** `PRIOR_YEAR_SAME_PERIOD` requested against a `period_type` this module does not know how to hop a fiscal year for (only FY/Q/MONTH are supported — WEEK is a forward reference, same status as WP-D01 section 11). */
  | 'UNSUPPORTED_PERIOD_TYPE_FOR_YOY';

export type ResolvedPeriodPlan =
  | { ok: true; periodIds: readonly string[]; combine: CombineStrategy }
  | { ok: false; reason: ResolvedPeriodPlanFailureReason; detail: string };

// ---------------------------------------------------------------------------
// previous_period_id chain walk (shared helper)
// ---------------------------------------------------------------------------

/** Walks `previous_period_id` exactly `hops` times. Returns `null` if the chain runs out before `hops` steps. */
function walkPrevious(periodId: string, hops: number, lookup: PeriodGraphLookup): string | null {
  let current = periodId;
  for (let i = 0; i < hops; i++) {
    const meta = lookup(current);
    if (!meta || !meta.previousPeriodId) return null;
    current = meta.previousPeriodId;
  }
  return current;
}

/** ADR 6.4 PRIOR_YEAR_SAME_PERIOD hop count: one fiscal year's worth of `previous_period_id` hops for this granularity. */
function yoyHopCount(periodType: PeriodType): number | null {
  switch (periodType) {
    case 'FY':
      return 1;
    case 'Q':
      return 4;
    case 'MONTH':
      return 12;
    case 'WEEK':
      // 4-4-5/53-week calendars do not have a fixed week-count-per-year — a correct hop count
      // needs the calendar's own week-count metadata, which this ADR's period table does not
      // expose to this pure module. Forward-referenced, same as WP-D01 section 11's own
      // unresolved WEEK-granularity items — not silently approximated with 52.
      return null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// resolvePeriodOffset — the one entry point formulaAstEvaluator's CellResolver
// (built by kpiComputeService) calls for every cell_ref operand.
// ---------------------------------------------------------------------------

export function resolvePeriodOffset(
  offset: PeriodOffset,
  currentPeriodId: string,
  lookup: PeriodGraphLookup
): ResolvedPeriodPlan {
  const current = lookup(currentPeriodId);
  if (!current) {
    return { ok: false, reason: 'INSUFFICIENT_HISTORY', detail: `unknown period_id ${currentPeriodId}` };
  }

  switch (offset) {
    case 'CURRENT':
      return { ok: true, periodIds: [currentPeriodId], combine: 'SINGLE' };

    case 'PRIOR_PERIOD': {
      const prior = walkPrevious(currentPeriodId, 1, lookup);
      if (!prior) {
        return {
          ok: false,
          reason: 'INSUFFICIENT_HISTORY',
          detail: `period ${currentPeriodId} has no previous_period_id (first period on record)`,
        };
      }
      return { ok: true, periodIds: [prior], combine: 'SINGLE' };
    }

    case 'AVERAGE_CURRENT_AND_PRIOR': {
      // ADR 6.4: "(value(CURRENT) + value(PRIOR_PERIOD via previous_period_id)) / 2".
      const prior = walkPrevious(currentPeriodId, 1, lookup);
      if (!prior) {
        return {
          ok: false,
          reason: 'INSUFFICIENT_HISTORY',
          detail: `AVERAGE_BALANCE needs a previous_period_id for ${currentPeriodId} (first period on record) — no silent fallback to the point-in-time value`,
        };
      }
      return { ok: true, periodIds: [currentPeriodId, prior], combine: 'AVERAGE' };
    }

    case 'LTM_SUM_4Q': {
      if (current.periodType !== 'Q') {
        return {
          ok: false,
          reason: 'WRONG_PERIOD_TYPE_FOR_LTM',
          detail: `LTM_SUM_4Q requires a period_type='Q' current period, got '${current.periodType}' for ${currentPeriodId}`,
        };
      }
      const ids: string[] = [currentPeriodId];
      let cursor = currentPeriodId;
      for (let i = 0; i < 3; i++) {
        const meta = lookup(cursor);
        if (!meta || !meta.previousPeriodId) {
          return {
            ok: false,
            reason: 'INSUFFICIENT_HISTORY',
            detail: `LTM_SUM_4Q needs 3 prior quarters before ${currentPeriodId}, chain ran out after ${ids.length} period(s)`,
          };
        }
        const prevMeta = lookup(meta.previousPeriodId);
        if (!prevMeta || prevMeta.periodType !== 'Q') {
          return {
            ok: false,
            reason: 'WRONG_PERIOD_TYPE_FOR_LTM',
            detail: `LTM_SUM_4Q chain hit a non-quarterly period before collecting 4 quarters (predecessor of ${cursor})`,
          };
        }
        ids.push(meta.previousPeriodId);
        cursor = meta.previousPeriodId;
      }
      return { ok: true, periodIds: ids, combine: 'SUM' };
    }

    case 'LTM_LATEST_Q_CLOSE': {
      // ADR 6.4: stock (BS) lines under LTM take the latest quarter's closing value, no summing —
      // "a balance sheet does not sum across periods". That latest quarter IS the current period
      // this cell_ref was resolved against (the compute engine always calls this with the
      // Analysis's own target period as `currentPeriodId`).
      if (current.periodType !== 'Q') {
        return {
          ok: false,
          reason: 'WRONG_PERIOD_TYPE_FOR_LTM',
          detail: `LTM_LATEST_Q_CLOSE requires a period_type='Q' current period, got '${current.periodType}' for ${currentPeriodId}`,
        };
      }
      return { ok: true, periodIds: [currentPeriodId], combine: 'SINGLE' };
    }

    case 'PRIOR_YEAR_SAME_PERIOD': {
      const hops = yoyHopCount(current.periodType);
      if (hops === null) {
        return {
          ok: false,
          reason: 'UNSUPPORTED_PERIOD_TYPE_FOR_YOY',
          detail: `PRIOR_YEAR_SAME_PERIOD is not implemented for period_type='${current.periodType}'`,
        };
      }
      const target = walkPrevious(currentPeriodId, hops, lookup);
      if (!target) {
        return {
          ok: false,
          reason: 'INSUFFICIENT_HISTORY',
          detail: `PRIOR_YEAR_SAME_PERIOD needs ${hops} previous_period_id hop(s) before ${currentPeriodId}, chain ran out`,
        };
      }
      return { ok: true, periodIds: [target], combine: 'SINGLE' };
    }

    default: {
      const _exhaustive: never = offset;
      throw new Error(`resolvePeriodOffset: unknown periodOffset ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Dynamic named constants (ADR 6.4: "DAYS_IN_PERIOD"/"ANNUALIZATION_FACTOR",
// resolved by the compute engine from finance_stmt_periods metadata, never
// hardcoded in the formula").
// ---------------------------------------------------------------------------

/**
 * `period_end - period_start + 1` — inclusive day count. NOT hardcoded 365:
 * a quarter is ~91 days, a leap year is 366. ADR 6.4 / addendum §2 pkt 7
 * "days in period".
 */
export function daysInPeriod(period: PeriodMeta): number {
  const start = Date.parse(`${period.periodStart}T00:00:00Z`);
  const end = Date.parse(`${period.periodEnd}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error(`daysInPeriod: unparseable period_start/period_end for ${period.periodId}`);
  }
  const days = Math.round((end - start) / 86_400_000) + 1;
  if (days <= 0) throw new Error(`daysInPeriod: non-positive day count (${days}) for ${period.periodId}`);
  return days;
}

/**
 * ADR 6.4 INTERIM_ANNUALIZED: `periods_per_year / periods_elapsed`
 * (`12/fiscal_month` for monthly YTD granularity, `4/fiscal_quarter` for
 * quarterly — "oba interpretacje ... ten sam wzór z różnym mianownikiem
 * granularności"). Returns `null` when the period's own type does not carry
 * an "elapsed" position within the year (FY periods are already full-year,
 * factor=1; WEEK is unsupported, same as `yoyHopCount` above).
 */
export function annualizationFactor(period: PeriodMeta): number | null {
  if (period.periodType === 'FY') return 1;
  if (period.periodType === 'MONTH' && period.fiscalMonth) return 12 / period.fiscalMonth;
  if (period.periodType === 'Q' && period.fiscalQuarter) return 4 / period.fiscalQuarter;
  return null;
}
