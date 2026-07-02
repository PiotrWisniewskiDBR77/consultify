/**
 * Capacity Signal Service (M14 / 4.3) — PURE functions, no DB.
 *
 * Upgrades the raw capacity model output (capacityModelService) into
 * normalized "signals" for ExecutionHub: instead of bare overload alerts we
 * emit typed + severity-graded signals derived from the utilization model.
 *
 * Deterministic and side-effect free so it can be unit-tested in isolation.
 * This is a clean signal builder — it does NOT touch riskDetectionService or
 * managerProblemsService.
 */

import {
  computeUtilization,
  type ResourceAllocation,
  type ResourceCapacity,
  type ResourceUtilization,
} from './capacityModelService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CapacitySignalType = 'CAPACITY_OVERLOAD' | 'CAPACITY_UNDERUTILIZED';

export type CapacitySignalSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CapacitySignal {
  id: string;
  type: CapacitySignalType;
  severity: CapacitySignalSeverity;
  resourceId: string;
  /** allocated / available as a percentage (mirrors the model output). */
  utilizationPct: number;
  /** Human-readable PL title quoting the utilization %. */
  title: string;
}

export type PortfolioBalance = 'critical' | 'strained' | 'healthy';

export interface CapacityPortfolioSignal {
  overloadedCount: number;
  underutilizedCount: number;
  /** Highest utilization % seen across resources (0 when no resources). */
  worstUtilizationPct: number;
  balance: PortfolioBalance;
}

// ─────────────────────────────────────────────────────────────────────────────
// Thresholds (ratios, applied to utilizationPct / 100)
// ─────────────────────────────────────────────────────────────────────────────

/** Over-allocation ratio above which a signal is CRITICAL. */
const OVERLOAD_CRITICAL_RATIO = 1.5;
/** Over-allocation ratio above which a signal is HIGH. */
const OVERLOAD_HIGH_RATIO = 1.2;
/** Under-utilization ratio below which an idle resource is surfaced. */
const UNDERUTILIZED_RATIO = 0.4;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Severity for an over-allocated resource, by utilization ratio. */
function overloadSeverity(ratio: number): CapacitySignalSeverity {
  if (ratio > OVERLOAD_CRITICAL_RATIO) return 'CRITICAL';
  if (ratio > OVERLOAD_HIGH_RATIO) return 'HIGH';
  return 'MEDIUM';
}

/** Render utilizationPct for display (no trailing ".0" noise). */
function formatPct(utilizationPct: number): string {
  return `${utilizationPct}%`;
}

function overloadTitle(u: ResourceUtilization): string {
  return `Zasób ${u.resourceId} przeciążony — wykorzystanie ${formatPct(u.utilizationPct)}`;
}

function underutilizedTitle(u: ResourceUtilization): string {
  return `Zasób ${u.resourceId} niedociążony — wykorzystanie ${formatPct(u.utilizationPct)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.3 — Per-resource signals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build typed, severity-graded capacity signals from the utilization model.
 *
 * - status 'over'  → CAPACITY_OVERLOAD
 *     severity: ratio > 1.5 CRITICAL, > 1.2 HIGH, else MEDIUM
 * - status 'under' && ratio < 0.4 → CAPACITY_UNDERUTILIZED (LOW)
 *
 * Resources at 'optimal' (or mildly under) emit no signal.
 */
export function buildCapacitySignals(
  allocations: ResourceAllocation[],
  capacities: ResourceCapacity[],
): CapacitySignal[] {
  const util = computeUtilization(allocations, capacities);

  const signals: CapacitySignal[] = [];
  for (const u of util) {
    const ratio = u.utilizationPct / 100;

    if (u.status === 'over') {
      signals.push({
        id: `capacity-overload-${u.resourceId}`,
        type: 'CAPACITY_OVERLOAD',
        severity: overloadSeverity(ratio),
        resourceId: u.resourceId,
        utilizationPct: u.utilizationPct,
        title: overloadTitle(u),
      });
    } else if (u.status === 'under' && ratio < UNDERUTILIZED_RATIO) {
      signals.push({
        id: `capacity-underutilized-${u.resourceId}`,
        type: 'CAPACITY_UNDERUTILIZED',
        severity: 'LOW',
        resourceId: u.resourceId,
        utilizationPct: u.utilizationPct,
        title: underutilizedTitle(u),
      });
    }
  }

  return signals;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.3 — Portfolio aggregate signal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate the per-resource signals into a single portfolio-level health
 * indicator.
 *
 * balance:
 *  - 'critical'  → there is a CRITICAL- or HIGH-severity overload
 *  - 'strained'  → there is any overload (MEDIUM)
 *  - 'healthy'   → no overloads
 */
export function capacityPortfolioSignal(
  allocations: ResourceAllocation[],
  capacities: ResourceCapacity[],
): CapacityPortfolioSignal {
  const signals = buildCapacitySignals(allocations, capacities);

  const overloads = signals.filter((s) => s.type === 'CAPACITY_OVERLOAD');
  const overloadedCount = overloads.length;
  const underutilizedCount = signals.filter(
    (s) => s.type === 'CAPACITY_UNDERUTILIZED',
  ).length;

  const worstUtilizationPct = signals.reduce(
    (max, s) => (s.utilizationPct > max ? s.utilizationPct : max),
    0,
  );

  const hasSevereOverload = overloads.some(
    (s) => s.severity === 'CRITICAL' || s.severity === 'HIGH',
  );

  let balance: PortfolioBalance = 'healthy';
  if (hasSevereOverload) balance = 'critical';
  else if (overloadedCount > 0) balance = 'strained';

  return { overloadedCount, underutilizedCount, worstUtilizationPct, balance };
}

export default {
  buildCapacitySignals,
  capacityPortfolioSignal,
};
