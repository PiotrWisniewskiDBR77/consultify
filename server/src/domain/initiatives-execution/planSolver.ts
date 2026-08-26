import type { CapacityScenario } from './capacityScenario.js';
import type { PlannedWindow, PlanScenario } from './planScenario.js';

export interface PlanSolverResult {
  assignments: Array<{
    window: PlannedWindow;
    periodId: string;
    rationale: string;
  }>;
  conflicts: string[];
  assumptions: string[];
}

export function dependencyOrder(windows: PlannedWindow[]) {
  const byId = new Map(windows.map((window) => [window.initiativeId, window]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const cycleMembers = new Set<string>();
  const ordered: PlannedWindow[] = [];
  const conflicts: string[] = [];

  const visit = (window: PlannedWindow, path: string[]) => {
    if (visited.has(window.initiativeId)) return;
    if (visiting.has(window.initiativeId)) {
      const cycleStart = path.indexOf(window.initiativeId);
      for (const id of path.slice(Math.max(0, cycleStart))) cycleMembers.add(id);
      cycleMembers.add(window.initiativeId);
      conflicts.push(
        `Dependency cycle: ${[...path.slice(cycleStart), window.initiativeId].join(' -> ')}`
      );
      return;
    }
    visiting.add(window.initiativeId);
    for (const dependency of [...window.dependencySnapshot].sort()) {
      const source = byId.get(dependency);
      if (source) visit(source, [...path, window.initiativeId]);
      else conflicts.push(`Missing dependency in plan: ${window.initiativeId} -> ${dependency}`);
    }
    visiting.delete(window.initiativeId);
    visited.add(window.initiativeId);
    ordered.push(window);
  };

  [...windows]
    .sort((left, right) => left.initiativeId.localeCompare(right.initiativeId))
    .forEach((window) => visit(window, []));
  return { ordered, conflicts: [...new Set(conflicts)], cycleMembers };
}

const intersects = (window: PlannedWindow, period: PlanScenario['periods'][number]): boolean =>
  (window.earliest === null || period.end >= window.earliest) &&
  (window.latest === null || period.start <= window.latest);

const demandFor = (
  capacity: CapacityScenario | undefined,
  initiativeId: string,
  periodId: string
) => {
  if (!capacity) return { value: 1, known: true };
  const assignments = capacity.proposedAssignments.filter(
    (assignment) =>
      assignment.initiativeId === initiativeId && assignment.periodIds.includes(periodId)
  );
  if (!assignments.length) return { value: 1, known: true };
  if (assignments.some((assignment) => assignment.demand.base === null))
    return { value: 0, known: false };
  return {
    value: assignments.reduce((sum, assignment) => sum + (assignment.demand.base ?? 0), 0),
    known: true,
  };
};

export function solvePlanScenario(
  scenario: PlanScenario,
  capacity?: CapacityScenario
): PlanSolverResult {
  const { ordered, conflicts, cycleMembers } = dependencyOrder(scenario.windows);
  const assignments: PlanSolverResult['assignments'] = [];
  const assumptions: string[] = [];
  const assignedPeriodIndex = new Map<string, number>();
  const usedCapacity = new Map<string, number>();

  if (!scenario.periods.length) {
    return {
      assignments: [],
      conflicts: [...conflicts, 'Plan has no periods'],
      assumptions,
    };
  }

  for (const window of ordered) {
    if (cycleMembers.has(window.initiativeId)) continue;
    const dependencyIndexes = window.dependencySnapshot
      .map((dependency) => assignedPeriodIndex.get(dependency))
      .filter((value): value is number => value !== undefined);
    const firstAllowed = dependencyIndexes.length ? Math.max(...dependencyIndexes) + 1 : 0;
    const candidates = scenario.periods
      .map((period, index) => ({ period, index }))
      .filter(({ period, index }) => index >= firstAllowed && intersects(window, period));

    const targetCandidate = candidates.find(
      ({ period }) =>
        window.target !== null && period.start <= window.target && period.end >= window.target
    );
    const orderedCandidates = targetCandidate
      ? [targetCandidate, ...candidates.filter(({ index }) => index !== targetCandidate.index)]
      : candidates;
    let selected: (typeof candidates)[number] | undefined;
    let selectedReason = '';

    for (const candidate of orderedCandidates) {
      const capacityPeriod = capacity?.periods.find(
        (period) => period.periodId === candidate.period.periodId
      );
      if (!capacityPeriod || capacityPeriod.supply.base === null) {
        if (capacityPeriod?.supply.knowledgeState === 'UNKNOWN') {
          assumptions.push(
            `Capacity unknown for period ${candidate.period.periodId} — capacity constraint not applied`
          );
        }
        selected = candidate;
        selectedReason = capacityPeriod
          ? 'capacity is UNKNOWN, so the capacity constraint was explicitly not applied'
          : 'no linked published capacity scenario was supplied';
        break;
      }
      const demand = demandFor(capacity, window.initiativeId, candidate.period.periodId);
      if (!demand.known) {
        assumptions.push(
          `Demand unknown for initiative ${window.initiativeId} in period ${candidate.period.periodId} — capacity constraint not applied`
        );
        selected = candidate;
        selectedReason =
          'initiative demand is UNKNOWN, so the capacity constraint was explicitly not applied';
        break;
      }
      const alreadyUsed = usedCapacity.get(candidate.period.periodId) ?? 0;
      if (alreadyUsed + demand.value <= capacityPeriod.supply.base) {
        selected = candidate;
        usedCapacity.set(candidate.period.periodId, alreadyUsed + demand.value);
        selectedReason = `known capacity ${alreadyUsed + demand.value}/${capacityPeriod.supply.base}`;
        break;
      }
    }

    if (!selected) {
      conflicts.push(
        `No feasible period for ${window.initiativeId}: dependency boundary, own window, or known capacity excludes every period`
      );
      continue;
    }
    assignedPeriodIndex.set(window.initiativeId, selected.index);
    const dependencyReason = dependencyIndexes.length
      ? `after dependency period ${Math.max(...dependencyIndexes) + 1}`
      : 'no scheduled predecessor';
    assignments.push({
      window,
      periodId: selected.period.periodId,
      rationale: `Deterministic solver selected ${selected.period.periodId}: ${dependencyReason}; own window intersects the period; ${selectedReason}.`,
    });
  }

  for (const cycleMember of [...cycleMembers].sort()) {
    conflicts.push(`No feasible period for ${cycleMember}: dependency cycle`);
  }
  return {
    assignments,
    conflicts: [...new Set(conflicts)],
    assumptions: [...new Set(assumptions)],
  };
}
