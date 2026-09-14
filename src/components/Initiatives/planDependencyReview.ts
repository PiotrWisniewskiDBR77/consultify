import type { PlanCardWindow } from './cards/PlanCard';

export type DependencyKind = 'ABSOLUTE' | 'CONDITIONAL';

export interface DependencyObservation {
  observationId: string;
  predecessorId: string;
  successorId: string;
  kind: DependencyKind;
  condition: string | null;
  rationale: string;
  evidenceRefs: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ObservationReview {
  observationId: string;
  outcome: 'ACCEPTED' | 'REJECTED';
  humanComment: string;
  finalObservation: DependencyObservation;
}

/**
 * Applies accepted AI predecessor contracts to the canonical plan snapshot.
 * Existing human-authored dependencies are retained. The returned order is a
 * stable topological order: unrelated initiatives keep their previous order.
 */
export function applyDependencyObservationReviews<T extends PlanCardWindow>(
  windows: T[],
  reviews: ObservationReview[]
): T[] {
  const accepted = reviews
    .filter((review) => review.outcome === 'ACCEPTED')
    .map((review) => review.finalObservation);
  const ids = new Set(windows.map((window) => window.initiativeId));
  const predecessors = new Map(windows.map((window) => [window.initiativeId, new Set(window.dependencySnapshot)]));

  for (const observation of accepted) {
    if (!ids.has(observation.predecessorId) || !ids.has(observation.successorId)) continue;
    predecessors.get(observation.successorId)?.add(observation.predecessorId);
  }

  const sourceOrder = new Map(windows.map((window, index) => [window.initiativeId, index]));
  const indegree = new Map(windows.map((window) => [window.initiativeId, 0]));
  const successors = new Map(windows.map((window) => [window.initiativeId, new Set<string>()]));
  for (const [successorId, deps] of predecessors) {
    for (const predecessorId of deps) {
      if (!ids.has(predecessorId) || predecessorId === successorId) continue;
      indegree.set(successorId, (indegree.get(successorId) ?? 0) + 1);
      successors.get(predecessorId)?.add(successorId);
    }
  }

  const ready = [...indegree]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id)
    .sort((a, b) => (sourceOrder.get(a) ?? 0) - (sourceOrder.get(b) ?? 0));
  const orderedIds: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    orderedIds.push(id);
    for (const successorId of successors.get(id) ?? []) {
      const next = (indegree.get(successorId) ?? 1) - 1;
      indegree.set(successorId, next);
      if (next === 0) {
        ready.push(successorId);
        ready.sort((a, b) => (sourceOrder.get(a) ?? 0) - (sourceOrder.get(b) ?? 0));
      }
    }
  }
  // The server rejects cycles. Retain the current order if stale UI data somehow contains one.
  const finalIds = orderedIds.length === windows.length ? orderedIds : windows.map((window) => window.initiativeId);
  const byId = new Map(
    windows.map((window) => [
      window.initiativeId,
      { ...window, dependencySnapshot: [...(predecessors.get(window.initiativeId) ?? [])] },
    ])
  );
  return finalIds.map((id) => byId.get(id)!).filter(Boolean) as T[];
}

