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

/**
 * P15-K5 (DEC-421, §4.2 pkt 1): LUKA LICZONA PER ROLA.
 * Suma po rolach kłamie w obie strony — nadmiar analityka zasłania brak inżyniera
 * automatyka w tym samym tygodniu, a doradca milczał („brak przeciążeń"), choć
 * jedna rola była przeciążona dwukrotnie.
 */
export interface RoleGap {
  periodId: string;
  roleId: string;
  roleLabel: string;
  demand: number;
  supply: number;
  gap: number;
}
export function findRoleGaps(capacity: CapacityScenario): RoleGap[] {
  return capacity.periods.flatMap((period) =>
    (period.roles ?? []).flatMap((role) =>
      role.demand !== null && role.supply !== null && role.demand > role.supply
        ? [
            {
              periodId: period.periodId,
              roleId: role.roleId,
              roleLabel: role.roleLabel,
              demand: role.demand,
              supply: role.supply,
              gap: Math.round((role.supply - role.demand) * 1000) / 1000,
            },
          ]
        : []
    )
  );
}

export function proposeCapacityOptions(
  plan: PlanScenario,
  capacity: CapacityScenario
): CapacityOption[] {
  const roleGaps = findRoleGaps(capacity);
  const hasRoleSheet = capacity.periods.some((period) => (period.roles ?? []).length > 0);
  // Analizy sprzed K5 nie mają wymiaru roli — dla nich zostaje porównanie skalarów.
  const overloaded = hasRoleSheet
    ? capacity.periods.filter((period) => roleGaps.some((gap) => gap.periodId === period.periodId))
    : capacity.periods.filter(
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
  // Analiza policzona z planu (K5) nie ma `proposedAssignments` — inicjatywy biorą się
  // z okien planu obejmujących przeciążony okres, a „zasoby" to PRZECIĄŻONE ROLE.
  const affectedInitiatives = assignments.length
    ? [...new Set(assignments.map((item) => item.initiativeId))]
    : [
        ...new Set(
          plan.windows
            .filter((window) =>
              overloaded.some(
                (period) =>
                  (window.earliest === null || period.end >= window.earliest) &&
                  (window.latest === null || period.start <= window.latest)
              )
            )
            .map((window) => window.initiativeId)
        ),
      ];
  const affectedResources = roleGaps.length
    ? [...new Set(roleGaps.map((gap) => gap.roleId))]
    : [...new Set(assignments.map((item) => item.resourceOrRoleId).filter(Boolean))];
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
  const canResequence = shifts.length > 0;
  const shiftPeriods = canResequence ? Math.max(...shifts) : null;
  const primaryPeriod = overloaded[0];
  const primaryGap =
    roleGaps.find((gap) => gap.periodId === primaryPeriod.periodId) ?? roleGaps[0] ?? null;
  // Nazwa roli, nie surowe id — to zdanie czyta PMO w karcie analizy.
  const primaryResource = primaryGap
    ? `rola ${primaryGap.roleLabel}`
    : (affectedResources[0] ?? 'zasób bez potwierdzonego przypisania');
  const sourceRef = `capacity-scenario:${capacity.scenarioId}`;
  const assumption = {
    assumption: primaryGap
      ? `Przeciążenie ${primaryPeriod.periodId} dotyczy roli ${primaryGap.roleLabel} (${primaryGap.roleId}): popyt ${primaryGap.demand} FTE wobec podaży ${primaryGap.supply} FTE.`
      : `Przeciążenie ${primaryPeriod.periodId} wyliczono z opublikowanego scenariusza mocy.`,
    ownerId: capacity.publishedBy || capacity.updatedBy || capacity.createdBy,
    sourceRef: { ref: sourceRef, version: capacity.scenarioVersion },
    knowledgeState: 'KNOWN' as const,
  };
  const roleGapAssumptions = roleGaps
    .filter((gap) => gap !== primaryGap)
    .map((gap) => ({
      assumption: `Luka roli ${gap.roleLabel} (${gap.roleId}) w okresie ${gap.periodId}: ${gap.gap} FTE.`,
      ownerId: capacity.publishedBy || capacity.updatedBy || capacity.createdBy,
      sourceRef: { ref: sourceRef, version: capacity.scenarioVersion },
      knowledgeState: 'KNOWN' as const,
    }));
  // P15-K3 (DEC-421): konflikt solvera przechodzi tu jako KOD, bez doklejania
  // prefiksu — inaczej front nie mógłby go przetłumaczyć i pokazałby surowe
  // `SOLVER-1:{…}` w oknie propozycji.
  const solverConflictAssumptions = solver.conflicts.map((conflict) => ({
    assumption: conflict,
    ownerId: capacity.publishedBy || capacity.updatedBy || capacity.createdBy,
    sourceRef: { ref: sourceRef, version: capacity.scenarioVersion },
    knowledgeState: 'KNOWN' as const,
  }));
  // Liczba elementów popytu do wydzielenia: przy analizie z planu liczą się okna
  // objęte przeciążeniem, a nie (puste) `proposedAssignments`.
  const splitCandidates = assignments.length || affectedInitiatives.length;
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
    assumptions: [assumption, ...roleGapAssumptions, ...solverConflictAssumptions],
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
        date: canResequence
          ? estimatedRange('periods', shiftPeriods as number, sourceRef, capacity.scenarioVersion)
          : unknownRange('periods'),
        scope: unknownRange('items'),
        cost: unknownRange('PLN'),
        risk: unknownRange('score'),
      },
      rationale: canResequence
        ? `Przesuń kolejność prac obciążających okres ${primaryPeriod.periodId} dla zasobu ${primaryResource}; doradca wyliczył przesunięcie z okien Planu i ograniczeń Mocy.`
        : `Resekwencja okresu ${primaryPeriod.periodId} dla zasobu ${primaryResource} jest niewykonalna przy obecnych ograniczeniach — deterministyczny solver nie znalazł żadnego wykonalnego okresu (granica zależności, własne okno lub znana Moc wykluczają każdy okres); przesunięcie pozostaje UNKNOWN.`,
    },
    {
      ...common,
      optionId: `${capacity.scenarioId}:scope-split:v${capacity.scenarioVersion}`,
      kind: 'SCOPE_SPLIT',
      impact: {
        date: unknownRange('periods'),
        scope: estimatedRange(
          'items',
          Math.max(1, splitCandidates),
          sourceRef,
          capacity.scenarioVersion
        ),
        cost: unknownRange('PLN'),
        risk: unknownRange('score'),
      },
      rationale: `Wydziel ${Math.max(1, splitCandidates)} elementów popytu z okresu ${primaryPeriod.periodId} dla zasobu ${primaryResource}; termin, koszt i ryzyko pozostają nieznane.`,
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
