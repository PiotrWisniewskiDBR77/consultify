/* ────────────────────────────────────────────────────────────────────────────
   M14/2.5 — ganttBaseline
   Pure baseline-vs-actual comparison helpers for the Execution Gantt.
   No React, no I/O. Logic only; rendering lives elsewhere.
   ──────────────────────────────────────────────────────────────────────────── */

const MS_PER_DAY = 86_400_000;

export type BaselineStatus = 'ahead' | 'on_track' | 'slipping' | 'late' | 'unknown';

export interface DateRangeInput {
  start?: string | null;
  end?: string | null;
}

export interface BaselineComparison {
  startSlipDays: number;
  endSlipDays: number;
  durationPlannedDays: number | null;
  durationActualDays: number | null;
  status: BaselineStatus;
}

export interface BarPlacement {
  leftPct: number;
  widthPct: number;
}

export interface BaselineBarGeometry {
  baseline: BarPlacement | null;
  actual: BarPlacement | null;
}

/* ────────────────────────────────────────────────────────────────────────────
   Internal helpers
   ──────────────────────────────────────────────────────────────────────────── */

/** Parse an ISO-ish date string to epoch-ms, or null when absent/invalid. */
function parseDate(value?: string | null): number | null {
  if (value === undefined || value === null || value === '') return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Whole-day delta (b - a) in days, or null when either side is missing. */
function diffDays(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return (b - a) / MS_PER_DAY;
}

function clampPct(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/* ────────────────────────────────────────────────────────────────────────────
   1. computeBaselineComparison
   ──────────────────────────────────────────────────────────────────────────── */

export function computeBaselineComparison(
  planned: DateRangeInput,
  actual: DateRangeInput,
  asOf: number
): BaselineComparison {
  const plannedStart = parseDate(planned?.start);
  const plannedEnd = parseDate(planned?.end);
  const actualStart = parseDate(actual?.start);
  const actualEnd = parseDate(actual?.end);

  const startSlip = diffDays(plannedStart, actualStart);
  const endSlip = diffDays(plannedEnd, actualEnd);

  const durationPlannedDays = diffDays(plannedStart, plannedEnd);
  const durationActualDays = diffDays(actualStart, actualEnd);

  const startSlipDays = startSlip ?? 0;
  const endSlipDays = endSlip ?? 0;

  let status: BaselineStatus;

  const pastPlannedEnd = plannedEnd !== null && asOf > plannedEnd;
  const notFinished = actualEnd === null;

  if (plannedEnd === null) {
    // No baseline end to compare against.
    status = 'unknown';
  } else if (notFinished) {
    // No actual delivery yet — only the clock tells us anything.
    // Overdue against the baseline → late; otherwise still indeterminate.
    status = pastPlannedEnd ? 'late' : 'unknown';
  } else if (endSlip === null) {
    // Defensive: actual end present but unparsable.
    status = 'unknown';
  } else if (endSlip < 0) {
    status = 'ahead';
  } else if (endSlip === 0) {
    status = 'on_track';
  } else {
    // endSlip > 0 — delivered, but after the baseline end. Per spec, 'late' is
    // reserved for unfinished+overdue work; a finished overrun is 'slipping'.
    status = 'slipping';
  }

  return {
    startSlipDays,
    endSlipDays,
    durationPlannedDays,
    durationActualDays,
    status,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   2. baselineBarGeometry
   ──────────────────────────────────────────────────────────────────────────── */

/** Map a [start,end] interval to a clamped {leftPct,widthPct} inside the window. */
function placeBar(
  start: number | null,
  end: number | null,
  windowStart: number,
  windowEnd: number
): BarPlacement | null {
  if (start === null || end === null) return null;

  const span = windowEnd - windowStart;
  if (span <= 0) return null;

  // Normalise so start <= end even if inputs are reversed.
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);

  // Entirely outside the window → nothing to draw.
  if (hi < windowStart || lo > windowEnd) return null;

  const leftPct = clampPct(((lo - windowStart) / span) * 100);
  const rightPct = clampPct(((hi - windowStart) / span) * 100);
  const widthPct = rightPct - leftPct;

  return { leftPct, widthPct };
}

export function baselineBarGeometry(
  planned: DateRangeInput,
  actual: DateRangeInput,
  windowStart: number,
  windowEnd: number
): BaselineBarGeometry {
  return {
    baseline: placeBar(parseDate(planned?.start), parseDate(planned?.end), windowStart, windowEnd),
    actual: placeBar(parseDate(actual?.start), parseDate(actual?.end), windowStart, windowEnd),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   3. varianceLabel (PL)
   ──────────────────────────────────────────────────────────────────────────── */

export function varianceLabel(endSlipDays: number): string {
  if (!Number.isFinite(endSlipDays) || endSlipDays === 0) {
    return 'w terminie';
  }
  // Whole-day magnitude for the human-readable label.
  const magnitude = Math.abs(Math.round(endSlipDays));
  if (magnitude === 0) {
    return 'w terminie';
  }
  if (endSlipDays > 0) {
    return `+${magnitude}d za planem`;
  }
  return `-${magnitude}d przed planem`;
}
