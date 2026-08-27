import type { CapacityOption } from './capacityOptions.js';
import type { CapacityScenario } from './capacityScenario.js';
import type { PlanScenario } from './planScenario.js';
import { solvePlanScenario } from './planSolver.js';

export class NoCapacityPressureError extends Error {
  readonly code = 'NO_CAPACITY_PRESSURE_TO_RESOLVE';

  constructor() {
    super('No capacity pressure to resolve');
  }
}

const unknownRange = (unit: string) => ({
  low: null,
  base: null,
  high: null,
  unit,
  knowledgeState: 'UNKNOWN' as const,
  confidence: 'UNKNOWN' as const,
  sourceRefs: [],
});

const estimatedRange = (unit: string, base: number, sourceRef: string, version: number) => ({
  low: Math.max(0, base),
  base: Math.max(0, base),
  high: Math.max(0, base),
  unit,
  knowledgeState: 'ESTIMATED' as const,
  confidence: 'MEDIUM' as const,
  sourceRefs: [{ ref: sourceRef, version }],
});

export function proposeCapacityOptions(
  plan: PlanScenario,
  capacity: CapacityScenario
): CapacityOption[] {
  const overloaded = capacity.periods.filter(
    (period) =>
      period.demand.base !== null &&
      period.supply.base !== null &&
      period.demand.base > period.supply.base
  );
  if (!overloaded.length) throw new NoCapacityPressureError();

  const periodIds = new Set(overloaded.map((period) => period.periodId));
  const assignments = capacity.proposedAssignments.filter((assignment) =>
    assignment.periodIds.some((periodId) => periodIds.has(periodId))
  );
  const affectedInitiatives = [...new Set(assignments.map((item) => item.initiativeId))];
  const affectedResources = [
    ...new Set(assignments.map((item) => item.resourceOrRoleId).filter(Boolean)),
  ];
  const solver = solvePlanScenario(plan, capacity);
  const periodIndex = new Map(plan.periods.map((period, index) => [period.periodId, index]));
  const shifts = solver.assignments.flatMap(({ window, periodId }) => {
    const current = plan.periods.findIndex(
      (period) =>
        window.target !== null && period.start <= window.target && period.end >= window.target
    );
    const proposed = periodIndex.get(periodId);
    return current >= 0 && proposed !== undefined && proposed > current ? [proposed - current] : [];
  });
  const shiftPeriods = shifts.length ? Math.max(...shifts) : 1;
  const primaryPeriod = overloaded[0];
  const primaryResource = affectedResources[0] ?? 'zasób bez potwierdzonego przypisania';
  const sourceRef = `capacity-scenario:${capacity.scenarioId}`;
  const assumption = {
    assumption: `Przeciążenie ${primaryPeriod.periodId} wyliczono z opublikowanego scenariusza mocy.`,
    ownerId: capacity.publishedBy || capacity.updatedBy || capacity.createdBy,
    sourceRef: { ref: sourceRef, version: capacity.scenarioVersion },
    knowledgeState: 'KNOWN' as const,
  };
  const memberships = affectedInitiatives.map((initiativeId) => ({
    initiativeId,
    membershipVersion:
      plan.windows.find((window) => window.initiativeId === initiativeId)?.initiativeVersion ?? 1,
  }));
  const resources = affectedResources.map((resourceRef) => ({
    resourceRef,
    version: capacity.scenarioVersion,
  }));
  const common = {
    assumptions: [assumption],
    affectedMemberships: memberships,
    affectedPeriods: overloaded.map((period) => period.periodId),
    affectedResources: resources,
  };

  return [
    {
      ...common,
      optionId: `${capacity.scenarioId}:resequence:v${capacity.scenarioVersion}`,
      kind: 'RESEQUENCE',
      impact: {
        date: estimatedRange('periods', shiftPeriods, sourceRef, capacity.scenarioVersion),
        scope: unknownRange('items'),
        cost: unknownRange('PLN'),
        risk: unknownRange('score'),
      },
      rationale: `Przesuń kolejność prac obciążających okres ${primaryPeriod.periodId} dla zasobu ${primaryResource}; doradca wyliczył przesunięcie z okien Planu i ograniczeń Mocy.`,
    },
    {
      ...common,
      optionId: `${capacity.scenarioId}:scope-split:v${capacity.scenarioVersion}`,
      kind: 'SCOPE_SPLIT',
      impact: {
        date: unknownRange('periods'),
        scope: estimatedRange(
          'items',
          Math.max(1, assignments.length),
          sourceRef,
          capacity.scenarioVersion
        ),
        cost: unknownRange('PLN'),
        risk: unknownRange('score'),
      },
      rationale: `Wydziel ${Math.max(1, assignments.length)} elementów popytu z okresu ${primaryPeriod.periodId} dla zasobu ${primaryResource}; termin, koszt i ryzyko pozostają nieznane.`,
    },
    {
      ...common,
      optionId: `${capacity.scenarioId}:add-capacity:v${capacity.scenarioVersion}`,
      kind: 'ADD_CAPACITY',
      impact: {
        date: unknownRange('periods'),
        scope: unknownRange('items'),
        cost: unknownRange('PLN'),
        risk: unknownRange('score'),
      },
      rationale: `Uzupełnij brak podaży w okresie ${primaryPeriod.periodId} dla zasobu ${primaryResource}; koszt pozostaje UNKNOWN, ponieważ scenariusz nie zawiera stawki jednostkowej.`,
    },
  ];
}
