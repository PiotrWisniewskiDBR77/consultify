/**
 * UZASADNIENIE SOLVERA JAKO KOD, NIE ZDANIE (P15-K3, DEC-421, §4.1 pkt 3).
 *
 * POMIAR 07.09 (`planSolver.ts:159`, karta planu → „Kolejność i okna"): solver
 * sklejał uzasadnienie po ANGIELSKU i zapisywał je do `windows[].rationale`,
 * więc polski ekran pokazywał „Deterministic solver selected Tydzień 2: no
 * scheduled predecessor…". Tekst szedł do bazy, więc nie dało się go
 * przetłumaczyć po fakcie.
 *
 * Od tej paczki solver zwraca KOD + PARAMETRY, a język wybiera front
 * (`src/components/Initiatives/planSolverReason.ts` — lustro tego pliku,
 * trzymaj oba w zgodzie; test `planSolverReason.test.ts` porównuje je wprost).
 * Matematyka solvera się NIE zmienia — zmienia się wyłącznie nośnik powodu.
 *
 * ZAPIS BEZ CUDZYSŁOWÓW — ZMIERZONE 07.09 w przepływie klikanym: pierwsza
 * wersja kodowała parametry jako JSON i wracała z przeglądarki przez sanitizer
 * żądań, który zamienia `"` na `&quot;`. W bazie lądowało
 * `SOLVER-1:{&quot;code&quot;:…}`, `JSON.parse` padał, a ekran pokazywał surowy
 * kod (zrzut `evidence/p15-k3/przeplyw/07-…` z pierwszego przebiegu). Format
 * `KOD;klucz=wartość` z wartościami w kodowaniu procentowym nie zawiera ANI
 * JEDNEGO znaku, który sanitizer zmienia.
 *
 * Napis bez prefiksu `SOLVER-1:` to uzasadnienie napisane przez CZŁOWIEKA
 * (albo plan sprzed tej paczki) — wołający renderuje go dosłownie.
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

/**
 * Kodowanie procentowe „na maksa": `encodeURIComponent` zostawia `!'()*~`,
 * a sanitizer bywa czuły na apostrof. Domykamy je ręcznie, żeby w napisie
 * zostały wyłącznie litery, cyfry, `%`, `-`, `_`, `.`, `;`, `=`, `,` i `:`.
 */
const encodeValue = (value: string | number): string =>
  encodeURIComponent(String(value)).replace(
    /[!'()*~]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
const decodeValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** Kod + parametry w jednym napisie nadającym się do zapisu w `rationale`. */
export function encodePlanSolverReason(reason: PlanSolverReason): string {
  const parts: string[] = [reason.code];
  const push = (key: string, value: string | number) =>
    parts.push(`${key}=${encodeValue(value)}`);
  switch (reason.code) {
    case 'SELECTED':
      push('period', reason.period);
      push('dep', reason.dependency.code);
      if (reason.dependency.code === 'AFTER_DEPENDENCY')
        push('depPeriod', reason.dependency.period);
      push('cap', reason.capacity.code);
      if (reason.capacity.code === 'CAPACITY_KNOWN') {
        push('capUsed', reason.capacity.used);
        push('capSupply', reason.capacity.supply);
      }
      break;
    case 'DEPENDENCY_CYCLE':
      parts.push(`path=${reason.path.map((id) => encodeValue(id)).join(',')}`);
      break;
    case 'MISSING_DEPENDENCY':
      push('initiativeId', reason.initiativeId);
      push('dependencyId', reason.dependencyId);
      break;
    case 'NO_FEASIBLE_PERIOD':
    case 'NO_FEASIBLE_PERIOD_CYCLE':
      push('initiativeId', reason.initiativeId);
      break;
    case 'CAPACITY_UNKNOWN_FOR_PERIOD':
      push('period', reason.period);
      break;
    case 'DEMAND_UNKNOWN_FOR_INITIATIVE':
      push('initiativeId', reason.initiativeId);
      push('period', reason.period);
      break;
    default:
      break;
  }
  return `${PLAN_SOLVER_REASON_PREFIX}${parts.join(';')}`;
}

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
