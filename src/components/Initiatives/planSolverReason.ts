/**
 * UZASADNIENIE SOLVERA PO POLSKU (P15-K3, DEC-421, §4.1 pkt 3).
 *
 * Lustro `server/src/domain/initiatives-execution/planSolverReason.ts` — trzymaj
 * oba pliki w zgodzie (test `tests/unit/initiatives-execution/planSolverReason.test.ts`
 * porównuje je wprost: KODER z serwera, DEKODER stąd).
 *
 * POMIAR 07.09: solver zapisywał do `windows[].rationale` angielskie zdanie
 * („Deterministic solver selected Tydzień 2: no scheduled predecessor…") i to
 * zdanie było widoczne w polskiej karcie planu oraz w tabeli propozycji. Teraz
 * serwer zapisuje KOD z parametrami, a język wybiera ta funkcja.
 *
 * Napis bez prefiksu `SOLVER-1:` to uzasadnienie CZŁOWIEKA (albo plan sprzed
 * tej paczki) — renderujemy go dosłownie, nie ukrywamy.
 */

export const PLAN_SOLVER_REASON_PREFIX = 'SOLVER-1:';

/** Skąd wzięła się DOLNA granica okresu: brak poprzednika albo poprzednik. */
export type PlanSolverDependencyReason =
  | { code: 'NO_PREDECESSOR' }
  | { code: 'AFTER_DEPENDENCY'; period: number };

/** Jak (i czy w ogóle) zadziałało ograniczenie mocy przerobowej. */
export type PlanSolverCapacityReason =
  | { code: 'NO_CAPACITY_SCENARIO' }
  | { code: 'CAPACITY_UNKNOWN' }
  | { code: 'DEMAND_UNKNOWN' }
  | { code: 'CAPACITY_KNOWN'; used: number; supply: number };

/** Powód wyboru okresu dla jednej inicjatywy. */
export interface PlanSolverAssignmentReason {
  code: 'SELECTED';
  period: string;
  dependency: PlanSolverDependencyReason;
  capacity: PlanSolverCapacityReason;
  /** Propozycja nie zmienia planu bez decyzji człowieka (P15 §4.0 D5). */
  humanReviewRequired: true;
}

/** Konflikt, którego solver nie potrafi rozwiązać sam. */
export type PlanSolverConflictReason =
  | { code: 'NO_PERIODS' }
  | { code: 'DEPENDENCY_CYCLE'; path: string[] }
  | { code: 'MISSING_DEPENDENCY'; initiativeId: string; dependencyId: string }
  | { code: 'NO_FEASIBLE_PERIOD'; initiativeId: string }
  | { code: 'NO_FEASIBLE_PERIOD_CYCLE'; initiativeId: string };

/** Założenie, pod którym solver policzył wynik. */
export type PlanSolverAssumptionReason =
  | { code: 'DEPENDENCIES_PRECEDE' }
  | { code: 'ONE_FEASIBLE_PERIOD' }
  | { code: 'CAPACITY_UNKNOWN_FOR_PERIOD'; period: string }
  | { code: 'DEMAND_UNKNOWN_FOR_INITIATIVE'; initiativeId: string; period: string };

export type PlanSolverReason =
  | PlanSolverAssignmentReason
  | PlanSolverConflictReason
  | PlanSolverAssumptionReason;

/** Odwrotność kodowania procentowego z kodera serwera (patrz lustro). */
const decodeValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * Odczyt kodu z napisu. Zwraca `null` dla tekstu człowieka i dla planów sprzed
 * tej paczki. Rozumie też PIERWSZĄ postać kodu (JSON) — także po tym, jak
 * sanitizer zamienił w niej `"` na `&quot;` — żeby plany zapisane w trakcie
 * wdrożenia nie zostały na ekranie jako surowy kod.
 */
export function decodePlanSolverReason(value: string): PlanSolverReason | null {
  if (!value.startsWith(PLAN_SOLVER_REASON_PREFIX)) return null;
  const body = value.slice(PLAN_SOLVER_REASON_PREFIX.length);
  if (body.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(body.replace(/&quot;/g, '"'));
      if (!parsed || typeof parsed !== 'object') return null;
      return typeof (parsed as { code?: unknown }).code === 'string'
        ? (parsed as PlanSolverReason)
        : null;
    } catch {
      return null;
    }
  }
  const [code, ...pairs] = body.split(';');
  if (!code) return null;
  const params = new Map<string, string>();
  for (const pair of pairs) {
    const index = pair.indexOf('=');
    if (index > 0) params.set(pair.slice(0, index), pair.slice(index + 1));
  }
  const text = (key: string) => decodeValue(params.get(key) ?? '');
  const number = (key: string) => Number(params.get(key) ?? '0');
  switch (code) {
    case 'SELECTED':
      return {
        code: 'SELECTED',
        period: text('period'),
        dependency:
          params.get('dep') === 'AFTER_DEPENDENCY'
            ? { code: 'AFTER_DEPENDENCY', period: number('depPeriod') }
            : { code: 'NO_PREDECESSOR' },
        capacity:
          params.get('cap') === 'CAPACITY_KNOWN'
            ? { code: 'CAPACITY_KNOWN', used: number('capUsed'), supply: number('capSupply') }
            : params.get('cap') === 'CAPACITY_UNKNOWN'
              ? { code: 'CAPACITY_UNKNOWN' }
              : params.get('cap') === 'DEMAND_UNKNOWN'
                ? { code: 'DEMAND_UNKNOWN' }
                : { code: 'NO_CAPACITY_SCENARIO' },
        humanReviewRequired: true,
      };
    case 'NO_PERIODS':
      return { code: 'NO_PERIODS' };
    case 'DEPENDENCY_CYCLE':
      return {
        code: 'DEPENDENCY_CYCLE',
        path: (params.get('path') ?? '')
          .split(',')
          .filter(Boolean)
          .map((item) => decodeValue(item)),
      };
    case 'MISSING_DEPENDENCY':
      return {
        code: 'MISSING_DEPENDENCY',
        initiativeId: text('initiativeId'),
        dependencyId: text('dependencyId'),
      };
    case 'NO_FEASIBLE_PERIOD':
      return { code: 'NO_FEASIBLE_PERIOD', initiativeId: text('initiativeId') };
    case 'NO_FEASIBLE_PERIOD_CYCLE':
      return { code: 'NO_FEASIBLE_PERIOD_CYCLE', initiativeId: text('initiativeId') };
    case 'DEPENDENCIES_PRECEDE':
      return { code: 'DEPENDENCIES_PRECEDE' };
    case 'ONE_FEASIBLE_PERIOD':
      return { code: 'ONE_FEASIBLE_PERIOD' };
    case 'CAPACITY_UNKNOWN_FOR_PERIOD':
      return { code: 'CAPACITY_UNKNOWN_FOR_PERIOD', period: text('period') };
    case 'DEMAND_UNKNOWN_FOR_INITIATIVE':
      return {
        code: 'DEMAND_UNKNOWN_FOR_INITIATIVE',
        initiativeId: text('initiativeId'),
        period: text('period'),
      };
    default:
      return null;
  }
}

export type PlanSolverTranslate = (key: string, options: Record<string, unknown>) => string;

const dependencyText = (
  reason: PlanSolverDependencyReason,
  t: PlanSolverTranslate
): string =>
  reason.code === 'AFTER_DEPENDENCY'
    ? t('initiatives.planSolver.dependency.afterDependency', {
        defaultValue: 'po okresie poprzednika ({{period}})',
        period: reason.period,
      })
    : t('initiatives.planSolver.dependency.noPredecessor', {
        defaultValue: 'brak zaplanowanego poprzednika',
      });

const capacityText = (reason: PlanSolverCapacityReason, t: PlanSolverTranslate): string => {
  if (reason.code === 'CAPACITY_KNOWN')
    return t('initiatives.planSolver.capacity.known', {
      defaultValue: 'znana moc {{used}}/{{supply}}',
      used: reason.used,
      supply: reason.supply,
    });
  if (reason.code === 'CAPACITY_UNKNOWN')
    return t('initiatives.planSolver.capacity.unknown', {
      defaultValue: 'obciążenie jest NIEZNANE, więc ograniczenie mocy nie zostało zastosowane',
    });
  if (reason.code === 'DEMAND_UNKNOWN')
    return t('initiatives.planSolver.capacity.demandUnknown', {
      defaultValue: 'popyt inicjatywy jest NIEZNANY, więc ograniczenie mocy nie zostało zastosowane',
    });
  return t('initiatives.planSolver.capacity.noScenario', {
    defaultValue: 'brak powiązanej opublikowanej analizy obciążenia',
  });
};

/**
 * Napis dla człowieka. `resolveName` zamienia identyfikator inicjatywy na jej
 * nazwę — surowy UUID w treści to defekt K28 kontraktu karty N.
 */
export function formatPlanSolverReason(
  value: string,
  t: PlanSolverTranslate,
  resolveName: (initiativeId: string) => string = (id) => id
): string {
  const reason = decodePlanSolverReason(value);
  if (!reason) return value;
  switch (reason.code) {
    case 'SELECTED':
      return t('initiatives.planSolver.selected', {
        defaultValue:
          'Solver wybrał {{period}}: {{dependency}}; okno inicjatywy obejmuje ten okres; {{capacity}}. Do potwierdzenia przez człowieka.',
        period: reason.period,
        dependency: dependencyText(reason.dependency, t),
        capacity: capacityText(reason.capacity, t),
      });
    case 'NO_PERIODS':
      return t('initiatives.planSolver.conflict.noPeriods', {
        defaultValue: 'Plan nie ma żadnych okresów.',
      });
    case 'DEPENDENCY_CYCLE':
      return t('initiatives.planSolver.conflict.dependencyCycle', {
        defaultValue: 'Cykl zależności: {{path}}',
        path: reason.path.map(resolveName).join(' → '),
      });
    case 'MISSING_DEPENDENCY':
      return t('initiatives.planSolver.conflict.missingDependency', {
        defaultValue: 'Zależność spoza planu: {{initiative}} → {{dependency}}',
        initiative: resolveName(reason.initiativeId),
        dependency: resolveName(reason.dependencyId),
      });
    case 'NO_FEASIBLE_PERIOD':
      return t('initiatives.planSolver.conflict.noFeasiblePeriod', {
        defaultValue:
          'Brak możliwego okresu dla „{{initiative}}": granica zależności, własne okno albo znana moc wykluczają każdy okres.',
        initiative: resolveName(reason.initiativeId),
      });
    case 'NO_FEASIBLE_PERIOD_CYCLE':
      return t('initiatives.planSolver.conflict.noFeasiblePeriodCycle', {
        defaultValue: 'Brak możliwego okresu dla „{{initiative}}": cykl zależności.',
        initiative: resolveName(reason.initiativeId),
      });
    case 'DEPENDENCIES_PRECEDE':
      return t('initiatives.planSolver.assumption.dependenciesPrecede', {
        defaultValue: 'Zależności poprzedzają inicjatywy zależne.',
      });
    case 'ONE_FEASIBLE_PERIOD':
      return t('initiatives.planSolver.assumption.oneFeasiblePeriod', {
        defaultValue:
          'Deterministyczny solver wybiera jeden możliwy okres docelowy na inicjatywę; żadna data planu ani inicjatywy nie została zmieniona.',
      });
    case 'CAPACITY_UNKNOWN_FOR_PERIOD':
      return t('initiatives.planSolver.assumption.capacityUnknownForPeriod', {
        defaultValue:
          'Obciążenie nieznane dla okresu {{period}} — ograniczenie mocy nie zostało zastosowane.',
        period: reason.period,
      });
    case 'DEMAND_UNKNOWN_FOR_INITIATIVE':
      return t('initiatives.planSolver.assumption.demandUnknownForInitiative', {
        defaultValue:
          'Popyt nieznany dla „{{initiative}}" w okresie {{period}} — ograniczenie mocy nie zostało zastosowane.',
        initiative: resolveName(reason.initiativeId),
        period: reason.period,
      });
    default:
      return value;
  }
}

/** Czy uzasadnienie pochodzi od solvera (a nie od człowieka). */
export function isPlanSolverReason(value: string): boolean {
  return decodePlanSolverReason(value) !== null;
}
