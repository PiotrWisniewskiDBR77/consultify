/**
 * What-if / Sensitivity (M16 / 5.4)
 *
 * Pure functions operating on a driver-tree (5.3) flattened to a map of
 * `driverId -> numeric value` plus a `targetFn` that recomputes the output
 * metric for any driver configuration. No I/O, no DB, no side effects —
 * everything is deterministic and unit-testable.
 *
 * Shapes are tailored to the FE components:
 *   - tornado()     -> <TornadoChart />
 *   - dataTable2D() -> <SensitivityHeatmap />
 */

export type Drivers = Record<string, number>;
export type TargetFn = (drivers: Drivers) => number;

/** One row of a one-way sensitivity sweep. */
export interface OneWayPoint {
  /** Percent change applied to the driver (e.g. -20, 0, 20). */
  deltaPct: number;
  /** Target value when the driver is scaled by `deltaPct`. */
  targetValue: number;
}

/** A single horizontal bar of a tornado diagram. */
export interface TornadoBar {
  /** Driver id / label. */
  label: string;
  /** Target value at the low end of the swing. */
  low: number;
  /** Target value at the high end of the swing. */
  high: number;
}

export interface TornadoResult {
  /** Target value at the unmodified base case. */
  base: number;
  /** Bars sorted by descending impact (|high - low|). */
  bars: TornadoBar[];
}

/** A single cell of a 2-variable data table. */
export interface DataTableCell {
  x: number;
  y: number;
  value: number;
}

export interface DataTable2DResult {
  xLabels: number[];
  yLabels: number[];
  matrix: DataTableCell[];
}

/** Apply a percent delta to a single driver, returning a fresh driver map. */
function withDriverScaled(base: Drivers, driverId: string, deltaPct: number): Drivers {
  const next: Drivers = { ...base };
  const current = next[driverId] ?? 0;
  next[driverId] = current * (1 + deltaPct / 100);
  return next;
}

/** Apply an absolute value to a single driver, returning a fresh driver map. */
function withDriverSet(base: Drivers, driverId: string, value: number): Drivers {
  return { ...base, [driverId]: value };
}

/**
 * One-way sensitivity: vary a single driver by each percent in `rangePct`
 * and evaluate the target for each. Returns one point per delta, preserving
 * the order of `rangePct`.
 */
export function oneWaySensitivity(
  baseDrivers: Drivers,
  targetFn: TargetFn,
  driverId: string,
  rangePct: number[] = [-20, -10, 0, 10, 20]
): OneWayPoint[] {
  return rangePct.map((deltaPct) => ({
    deltaPct,
    targetValue: targetFn(withDriverScaled(baseDrivers, driverId, deltaPct)),
  }));
}

/**
 * Tornado analysis: for each driver, swing it by ±`swingPct` and record the
 * low/high target values. Bars are sorted by descending impact so the FE can
 * render the classic widest-bar-on-top tornado.
 */
export function tornado(
  baseDrivers: Drivers,
  targetFn: TargetFn,
  driverIds: string[],
  swingPct = 20
): TornadoResult {
  const base = targetFn(baseDrivers);

  const bars: TornadoBar[] = driverIds.map((driverId) => {
    const low = targetFn(withDriverScaled(baseDrivers, driverId, -swingPct));
    const high = targetFn(withDriverScaled(baseDrivers, driverId, swingPct));
    return { label: driverId, low, high };
  });

  bars.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));

  return { base, bars };
}

/**
 * Two-variable data table: evaluate the target across the cartesian product
 * of `xRange` (absolute values of `xDriver`) and `yRange` (absolute values of
 * `yDriver`). Shape matches the heatmap component.
 */
export function dataTable2D(
  baseDrivers: Drivers,
  targetFn: TargetFn,
  xDriver: string,
  yDriver: string,
  xRange: number[],
  yRange: number[]
): DataTable2DResult {
  const matrix: DataTableCell[] = [];

  for (const y of yRange) {
    for (const x of xRange) {
      const drivers = withDriverSet(withDriverSet(baseDrivers, xDriver, x), yDriver, y);
      matrix.push({ x, y, value: targetFn(drivers) });
    }
  }

  return {
    xLabels: [...xRange],
    yLabels: [...yRange],
    matrix,
  };
}

/**
 * Break-even: find the absolute value of `driverId` at which the target equals
 * `target` (default 0), using bisection. Returns `null` when the target does
 * not cross `target` within the searched bracket (no sign change), which means
 * no break-even point is reachable by this driver alone.
 */
export function breakEven(
  baseDrivers: Drivers,
  targetFn: TargetFn,
  driverId: string,
  target = 0
): number | null {
  const evalAt = (value: number): number =>
    targetFn(withDriverSet(baseDrivers, driverId, value)) - target;

  // Build a search bracket around the current driver value. Scale the bracket
  // by the magnitude of the base value so it adapts to the driver's units.
  const baseValue = baseDrivers[driverId] ?? 0;
  const span = Math.max(Math.abs(baseValue), 1) * 1000;
  let lo = baseValue - span;
  let hi = baseValue + span;

  let fLo = evalAt(lo);
  let fHi = evalAt(hi);

  // A root sitting exactly on a bracket endpoint.
  if (fLo === 0) return lo;
  if (fHi === 0) return hi;

  // No sign change => no break-even within the bracket.
  if (fLo * fHi > 0) return null;

  const maxIters = 200;
  const tol = 1e-9;

  for (let i = 0; i < maxIters; i++) {
    const mid = (lo + hi) / 2;
    const fMid = evalAt(mid);

    if (fMid === 0 || (hi - lo) / 2 < tol) {
      return mid;
    }

    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }

  return (lo + hi) / 2;
}
