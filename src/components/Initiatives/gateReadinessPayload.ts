import type { V8PlanningGateReadinessCheck } from '@/services/api/v8/planning';

export function normalizeGateReadinessPayload(
  value: unknown
): Partial<V8PlanningGateReadinessCheck> | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return { readiness: value };
  }
  if (typeof value === 'object') {
    return value as V8PlanningGateReadinessCheck;
  }
  return null;
}
