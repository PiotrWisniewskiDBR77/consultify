export const CAPACITY_POLICY = Object.freeze({
  weeklyHoursPerFte: 40,
  overloadRatio: 1.05,
  timelineWeeks: 12,
});

export function clampAllocationPercent(value: unknown): number {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

export function capacityHoursForAllocation(value: unknown): number {
  return (clampAllocationPercent(value) / 100) * CAPACITY_POLICY.weeklyHoursPerFte;
}

export function utilizationPercent(allocatedHours: number, capacityHours: number): number {
  return capacityHours > 0 ? Math.round((allocatedHours / capacityHours) * 100) : 0;
}

export function isOverloaded(allocatedHours: number, capacityHours: number): boolean {
  return allocatedHours > capacityHours * CAPACITY_POLICY.overloadRatio;
}
