/**
 * Capacity Model Service (M14 / F4) — PURE functions, no DB.
 *
 * Resource model for ExecutionHub: allocations / availability →
 * utilization, capacity-vs-demand, heatmap, overload alerts.
 *
 * All functions are deterministic and side-effect free so they can be
 * unit-tested in isolation. Data wiring (DB fetch → these inputs) is a
 * follow-up step.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ResourceAllocation {
  resourceId: string;
  initiativeId: string;
  /** Full-time equivalent committed to this initiative for the period. */
  allocatedFte: number;
  /** ISO date string (inclusive) marking the start of the allocation window. */
  periodStart: string;
  /** ISO date string (inclusive) marking the end of the allocation window. */
  periodEnd: string;
}

export interface ResourceCapacity {
  resourceId: string;
  /** Total FTE the resource has available. */
  availableFte: number;
}

export type UtilizationStatus = 'under' | 'optimal' | 'over';

export interface ResourceUtilization {
  resourceId: string;
  allocatedFte: number;
  availableFte: number;
  /** allocated / available, as a percentage (0–∞). 0 when no capacity. */
  utilizationPct: number;
  status: UtilizationStatus;
}

export interface CapacityVsDemand {
  totalCapacity: number;
  totalDemand: number;
  /** capacity − demand (negative = portfolio is over-committed). */
  gap: number;
  /** demand covered by capacity, as a percentage. 0 when no capacity. */
  coveragePct: number;
}

export interface HeatmapCell {
  period: string;
  utilizationPct: number;
  status: UtilizationStatus;
}

export interface ResourceHeatmapRow {
  resourceId: string;
  cells: HeatmapCell[];
}

export interface OverloadAlert {
  resourceId: string;
  utilizationPct: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const UNDER_THRESHOLD = 0.7;
const OPTIMAL_THRESHOLD = 1.0;

/** Classify a utilization ratio (allocated / available). */
function classify(ratio: number): UtilizationStatus {
  if (ratio < UNDER_THRESHOLD) return 'under';
  if (ratio <= OPTIMAL_THRESHOLD) return 'optimal';
  return 'over';
}

/** Round to 2 decimal places to keep percentages stable for display/tests. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Build a quick lookup of available FTE per resource. */
function capacityMap(capacities: ResourceCapacity[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of capacities) {
    map.set(c.resourceId, (map.get(c.resourceId) ?? 0) + (c.availableFte ?? 0));
  }
  return map;
}

/** True when an allocation window overlaps the given period key (ISO date). */
function allocationCoversPeriod(alloc: ResourceAllocation, period: string): boolean {
  // Inclusive bounds: period is "active" if it falls within [start, end].
  return alloc.periodStart <= period && period <= alloc.periodEnd;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.1 — Utilization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sum allocations per resource and compute utilization vs available capacity.
 * Resources are derived from the union of allocation + capacity resource ids,
 * so an idle resource (capacity, no allocation) still appears.
 */
export function computeUtilization(
  allocations: ResourceAllocation[],
  capacities: ResourceCapacity[]
): ResourceUtilization[] {
  const caps = capacityMap(capacities);

  // Sum allocated FTE per resource.
  const allocated = new Map<string, number>();
  for (const a of allocations) {
    allocated.set(a.resourceId, (allocated.get(a.resourceId) ?? 0) + (a.allocatedFte ?? 0));
  }

  const resourceIds = new Set<string>([...caps.keys(), ...allocated.keys()]);

  const rows: ResourceUtilization[] = [];
  for (const resourceId of resourceIds) {
    const allocatedFte = round2(allocated.get(resourceId) ?? 0);
    const availableFte = caps.get(resourceId) ?? 0;
    const ratio = availableFte > 0 ? allocatedFte / availableFte : 0;
    rows.push({
      resourceId,
      allocatedFte,
      availableFte,
      utilizationPct: round2(ratio * 100),
      status: availableFte > 0 ? classify(ratio) : 'under',
    });
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.1 — Capacity vs Demand (portfolio aggregate)
// ─────────────────────────────────────────────────────────────────────────────

export function capacityVsDemand(
  allocations: ResourceAllocation[],
  capacities: ResourceCapacity[]
): CapacityVsDemand {
  const totalCapacity = round2(capacities.reduce((sum, c) => sum + (c.availableFte ?? 0), 0));
  const totalDemand = round2(allocations.reduce((sum, a) => sum + (a.allocatedFte ?? 0), 0));
  const gap = round2(totalCapacity - totalDemand);
  const coveragePct = totalDemand > 0 ? round2((totalCapacity / totalDemand) * 100) : 0;

  return { totalCapacity, totalDemand, gap, coveragePct };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.2 — Heatmap (resource × period)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * For each resource, compute utilization in each requested period. An
 * allocation contributes to a period when its window overlaps that period.
 */
export function resourceHeatmap(
  allocations: ResourceAllocation[],
  capacities: ResourceCapacity[],
  periods: string[]
): ResourceHeatmapRow[] {
  const caps = capacityMap(capacities);

  // Group allocations by resource once.
  const byResource = new Map<string, ResourceAllocation[]>();
  for (const a of allocations) {
    const list = byResource.get(a.resourceId);
    if (list) list.push(a);
    else byResource.set(a.resourceId, [a]);
  }

  const resourceIds = new Set<string>([...caps.keys(), ...byResource.keys()]);

  const rows: ResourceHeatmapRow[] = [];
  for (const resourceId of resourceIds) {
    const availableFte = caps.get(resourceId) ?? 0;
    const resourceAllocs = byResource.get(resourceId) ?? [];

    const cells: HeatmapCell[] = periods.map((period) => {
      const allocatedFte = resourceAllocs
        .filter((a) => allocationCoversPeriod(a, period))
        .reduce((sum, a) => sum + (a.allocatedFte ?? 0), 0);
      const ratio = availableFte > 0 ? allocatedFte / availableFte : 0;
      return {
        period,
        utilizationPct: round2(ratio * 100),
        status: availableFte > 0 ? classify(ratio) : 'under',
      };
    });

    rows.push({ resourceId, cells });
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.2 — Overload alerts
// ─────────────────────────────────────────────────────────────────────────────

/** Surface only over-allocated resources (status === 'over'). */
export function overloadAlerts(util: ResourceUtilization[]): OverloadAlert[] {
  return util
    .filter((u) => u.status === 'over')
    .map((u) => ({ resourceId: u.resourceId, utilizationPct: u.utilizationPct }));
}

export default {
  computeUtilization,
  capacityVsDemand,
  resourceHeatmap,
  overloadAlerts,
};
