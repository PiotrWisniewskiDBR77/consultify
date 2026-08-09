/**
 * KPI-E001/E002 — target-geometry performance evaluator.
 *
 * Design: docs/product/results-vnext/KPI_E001_E002_DESIGN.md §C.
 * Pure function, zero I/O — takes a measurement's actual value plus the
 * bounds carried on its `rvn_kpi_definition_versions` row and returns a
 * `KpiPerformanceStatus`. Never touches the DB, never throws for "bad" input
 * (missing/invalid input degrades to `'neutral'`, per the rule below — a
 * pure function computing a display status must never crash a write path).
 *
 * -- DEVIATION FROM DESIGN (documented once, applies to this whole file):
 * the design doc's §C is "ratified as-is" from a prior draft whose literal
 * text is not present in this worktree (see EXECUTION_LEDGER.md §15 for the
 * grep that established this before any KPI code was written). The THREE
 * decisions the design doc states explicitly about this evaluator are
 * followed to the letter:
 *   - decyzja #7 (Boundary Rule): "the threshold value belongs to the
 *     safer/nearer-target zone — crossing requires strict inequality".
 *     Applied uniformly below: every boundary value itself counts as the
 *     BETTER of the two zones it separates; you must go strictly PAST a
 *     boundary to fall into the worse zone.
 *   - decyzja #9: `custom` geometry ALWAYS returns `'neutral'`, the
 *     `formula_text` a version might carry is never read or evaluated here
 *     ("no arbitrary code execution in custom formulas" is a non-goal of
 *     this whole package, not a gap).
 *   - decyzja #10: for `exact`, when neither `criticalLow` nor
 *     `criticalHigh` is supplied, anything outside the tolerance band
 *     (`warningLow`..`warningHigh`, or exactly `targetValue` if neither
 *     warning bound is supplied either) is `'critical'` directly — no
 *     `'warning'` zone in between.
 * The specific 5-geometry vocabulary (`threshold_min`/`threshold_max`/
 * `range`/`exact`/`custom`) and the exact shape of `range`'s two-sided
 * warning band are this implementer's reconstruction (see the migration's
 * own DEVIATION note) built to satisfy the two decisions above consistently
 * across every geometry, not a recovered original.
 */
import type { KpiPerformanceStatus, KpiTargetGeometry } from './kpiTypes.js';

export interface TargetGeometryEvaluationInput {
  geometry: KpiTargetGeometry;
  /** The measurement being evaluated. `null`/`undefined` -> always `'neutral'`
   * regardless of geometry (missing input never fabricates a status). */
  actualValue: number | null | undefined;
  targetValue?: number | null;
  targetMin?: number | null;
  targetMax?: number | null;
  warningLow?: number | null;
  warningHigh?: number | null;
  criticalLow?: number | null;
  criticalHigh?: number | null;
}

function isNum(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * `threshold_min` — "higher is better", `targetValue` is the minimum
 * acceptable value. Boundary rule: `actual === targetValue` is `on_target`
 * (the boundary belongs to the safer/nearer-target zone); `actual ===
 * warningLow` is `warning`, not `critical` (same rule, one zone down).
 */
function evalThresholdMin(input: TargetGeometryEvaluationInput): KpiPerformanceStatus {
  const { actualValue, targetValue, warningLow } = input;
  if (!isNum(actualValue) || !isNum(targetValue)) return 'neutral';

  if (actualValue >= targetValue) return 'on_target';

  if (isNum(warningLow)) {
    return actualValue >= warningLow ? 'warning' : 'critical';
  }
  // No warning band configured — binary on_target/critical (decyzja #10's
  // "no warning zone" pattern, applied consistently to threshold geometries
  // too, not only `exact`).
  return 'critical';
}

/** `threshold_max` — "lower is better", mirror of `evalThresholdMin`. */
function evalThresholdMax(input: TargetGeometryEvaluationInput): KpiPerformanceStatus {
  const { actualValue, targetValue, warningHigh } = input;
  if (!isNum(actualValue) || !isNum(targetValue)) return 'neutral';

  if (actualValue <= targetValue) return 'on_target';

  if (isNum(warningHigh)) {
    return actualValue <= warningHigh ? 'warning' : 'critical';
  }
  return 'critical';
}

/**
 * `range` — `[targetMin, targetMax]` is the on-target band. `warningLow`/
 * `warningHigh` (if supplied) widen it symmetrically-or-not into a warning
 * band on each side; beyond that (or beyond the target band directly, if no
 * warning bounds are supplied) is `critical`. Both `targetMin` AND
 * `targetMax` are required — a range with only one bound is not a range,
 * it degrades to `neutral` rather than silently behaving like a threshold.
 */
function evalRange(input: TargetGeometryEvaluationInput): KpiPerformanceStatus {
  const { actualValue, targetMin, targetMax, warningLow, warningHigh } = input;
  if (!isNum(actualValue) || !isNum(targetMin) || !isNum(targetMax)) return 'neutral';

  if (actualValue >= targetMin && actualValue <= targetMax) return 'on_target';

  if (actualValue < targetMin) {
    if (isNum(warningLow)) {
      return actualValue >= warningLow ? 'warning' : 'critical';
    }
    return 'critical';
  }

  // actualValue > targetMax
  if (isNum(warningHigh)) {
    return actualValue <= warningHigh ? 'warning' : 'critical';
  }
  return 'critical';
}

/**
 * `exact` — decyzja #10. Tolerance band = `[warningLow, warningHigh]` if
 * supplied, else exactly `targetValue` (no tolerance at all). Within
 * tolerance -> `on_target`. Outside tolerance: if `criticalLow`/
 * `criticalHigh` are supplied, the zone between the tolerance edge and the
 * critical edge is `warning`, beyond the critical edge is `critical`
 * (three-zone). If NEITHER critical bound is supplied, anything outside
 * tolerance is `critical` directly — decyzja #10's literal "no warning
 * zone" case.
 */
function evalExact(input: TargetGeometryEvaluationInput): KpiPerformanceStatus {
  const { actualValue, targetValue, warningLow, warningHigh, criticalLow, criticalHigh } = input;
  if (!isNum(actualValue) || !isNum(targetValue)) return 'neutral';

  const hasToleranceBand = isNum(warningLow) || isNum(warningHigh);
  const toleranceLow = isNum(warningLow) ? warningLow : targetValue;
  const toleranceHigh = isNum(warningHigh) ? warningHigh : targetValue;

  if (actualValue >= toleranceLow && actualValue <= toleranceHigh) {
    return 'on_target';
  }
  // hasToleranceBand only affects whether toleranceLow/High came from real
  // warning bounds or defaulted to targetValue — the on_target check above
  // already accounts for both cases identically, so no further branch on
  // it is needed here; kept as a named constant purely for readability at
  // the call site above.
  void hasToleranceBand;

  const hasCriticalBand = isNum(criticalLow) || isNum(criticalHigh);
  if (!hasCriticalBand) {
    // decyzja #10, literal: outside tolerance, no critical bound configured
    // -> critical directly, no warning zone.
    return 'critical';
  }

  if (actualValue < toleranceLow) {
    if (isNum(criticalLow)) {
      return actualValue >= criticalLow ? 'warning' : 'critical';
    }
    // Only criticalHigh was supplied — the low side still has no critical
    // bound of its own, same binary rule as the no-critical-band case.
    return 'critical';
  }

  // actualValue > toleranceHigh
  if (isNum(criticalHigh)) {
    return actualValue <= criticalHigh ? 'warning' : 'critical';
  }
  return 'critical';
}

/**
 * `custom` — decyzja #9, literal: always `'neutral'`. `formula_text` (or
 * any other field) is never read. A restricted expression engine is
 * explicitly out of scope for this package (tracked as a distinct future
 * package per the design doc, not silently expanded into this evaluator).
 */
function evalCustom(): KpiPerformanceStatus {
  return 'neutral';
}

/**
 * Evaluates a measurement's `actualValue` against its definition version's
 * target geometry and bounds. Pure, synchronous, total (never throws) —
 * missing/non-finite numeric input always resolves to `'neutral'`, never a
 * fabricated `'critical'`/`'on_target'` and never a numeric fallback like
 * treating a missing value as `0`.
 */
export function evaluatePerformanceStatus(
  input: TargetGeometryEvaluationInput
): KpiPerformanceStatus {
  switch (input.geometry) {
    case 'threshold_min':
      return evalThresholdMin(input);
    case 'threshold_max':
      return evalThresholdMax(input);
    case 'range':
      return evalRange(input);
    case 'exact':
      return evalExact(input);
    case 'custom':
      return evalCustom();
    default: {
      // Exhaustiveness guard — unreachable given KpiTargetGeometry, but this
      // function must stay total even if a future geometry value reaches it
      // before this file is updated (e.g. a DB row from a newer deploy).
      const _exhaustive: never = input.geometry;
      void _exhaustive;
      return 'neutral';
    }
  }
}
