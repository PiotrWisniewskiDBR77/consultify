/**
 * P15-K5 (DEC-421) — ARKUSZ OKRES × ROLA: popyt z PLANU (D3'), podaż z PRODUKTU (D2').
 *
 * POMIAR, który tę decyzję wymusił (K0, 07.09, kopia bazy `consultify_fable`):
 *   `project_members` = 0 wierszy w całej bazie, `users.job_title` 0/31,
 *   `required_capacity_fte` 0/72, `competencies_required` 0/72.
 * Dlatego rola = STANOWISKO (`users.job_title`, to samo pole, które już czyta
 * arkusz Realizacja → Zasoby), a popyt wpisuje PMO w oknie planu (`roleDemand`).
 *
 * Reguła nadrzędna: brak danych = „Nieznane" (`null`), NIGDY zero. Zero jest
 * twierdzeniem („nikogo nie potrzeba" / „nikogo nie ma"), a my go nie mamy.
 */
import type {
  CapacityPeriod,
  CapacityRange,
  CapacityRoleLine,
  CapacityScenario,
} from './capacityScenario.js';
import { sumRoleLines } from './capacityScenario.js';
import type { PlanScenario } from './planScenario.js';

export const UNASSIGNED_ROLE_ID = 'bez-stanowiska';
export const UNASSIGNED_ROLE_LABEL = 'Bez stanowiska';

/** Slug stanowiska = tożsamość roli. Polskie znaki sprowadzone do ASCII, bo id trafia do URL-i i kluczy Reacta. */
export function roleSlug(label: string): string {
  const ascii = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L');
  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || UNASSIGNED_ROLE_ID;
}

/** Podaż jednej roli w organizacji, w FTE na TYDZIEŃ (1 FTE = 40 h — `CAPACITY_POLICY`). */
export interface RoleWeeklySupply {
  roleId: string;
  roleLabel: string;
  fteWeekly: number;
  headcount: number;
}

export interface RoleSheetInput {
  plan: PlanScenario;
  supply: RoleWeeklySupply[];
  /** `initiatives.required_capacity_fte` — awaryjny popyt BEZ podziału na role. */
  fallbackDemandFte?: Record<string, number>;
  /** Poprzednia wersja analizy: zachowujemy ręczne korekty podaży (`MANUAL`). */
  previous?: CapacityScenario | null;
  ownerId: string;
  asOf?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ile tygodni trwa okres (okres tygodniowy = 1). Podaż roli jest liczona na tydzień. */
export function periodWeeks(period: { start: string; end: string }): number {
  const span = Date.parse(period.end) - Date.parse(period.start);
  if (!Number.isFinite(span) || span <= 0) return 1;
  return Math.max(1, Math.round(span / (7 * DAY_MS)));
}

/**
 * Czy okno inicjatywy obejmuje okres (earliest..latest; okno z samą datą docelową
 * liczy się jako `target..target`).
 *
 * PRZEDZIAŁ PÓŁOTWARTY, i to jest ŚWIADOMA różnica wobec `planSolver.intersects`.
 * Okresy planu są STYCZNE (`period[n].end === period[n+1].start`), więc reguła
 * solvera (`period.start <= latest`) zaliczyłaby okno kończące się dokładnie
 * w chwili startu następnego tygodnia do TEGO tygodnia — i popyt roli byłby
 * doliczony o jeden okres za daleko (widoczne na zrzucie 06 z 07.09: „Tydzień 3"
 * pokazywał 5 FTE zamiast 2). Solver wybiera okres NA start prac i tam ta
 * hojność nie szkodzi; arkusz sumuje popyt i musi liczyć styk jako brak części
 * wspólnej. Dlatego `>` / `<` zamiast `>=` / `<=`.
 */
export function windowCoversPeriod(
  window: { earliest: string | null; target: string | null; latest: string | null },
  period: { start: string; end: string }
): boolean {
  const earliest = window.earliest ?? window.target;
  const latest = window.latest ?? window.target;
  if (earliest === null && latest === null) return false;
  // Okno punktowe (sam `target`): liczy się okres, który tę chwilę zawiera.
  if (earliest !== null && latest !== null && earliest === latest)
    return period.start <= earliest && period.end > earliest;
  return (
    (earliest === null || period.end > earliest) && (latest === null || period.start < latest)
  );
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

function scalarRange(
  total: number | null,
  contributing: CapacityRoleLine[],
  field: 'demand' | 'supply',
  ownerId: string,
  sourceRef: string,
  sourceVersion: number,
  asOf: string,
  unknownReason: string
): CapacityRange {
  if (total === null)
    return {
      knowledgeState: 'UNKNOWN',
      low: null,
      base: null,
      high: null,
      sourceRef: null,
      sourceVersion: null,
      asOf,
      confidence: 'UNKNOWN',
      ownerId,
      reason: unknownReason,
    };
  const estimated = contributing.some((role) =>
    field === 'demand' ? role.demandSource === 'UNKNOWN' : role.supplySource === 'UNKNOWN'
  );
  return {
    knowledgeState: estimated ? 'ESTIMATED' : 'KNOWN',
    low: total,
    base: total,
    high: total,
    sourceRef,
    sourceVersion,
    asOf,
    confidence: estimated ? 'MEDIUM' : 'HIGH',
    ownerId,
    reason: null,
  };
}

/**
 * Buduje okresy analizy z opublikowanego planu i podaży organizacji.
 * Zestaw ról = suma ról z popytu planu i ról obsadzonych w organizacji.
 */
export function buildRoleSheet(input: RoleSheetInput): CapacityPeriod[] {
  const { plan, supply, previous } = input;
  const asOf = input.asOf ?? new Date().toISOString();
  const fallback = input.fallbackDemandFte ?? {};
  const planIsRoleAware = plan.windows.some((window) => (window.roleDemand ?? []).length > 0);

  const labels = new Map<string, string>();
  for (const role of supply) labels.set(role.roleId, role.roleLabel);
  for (const window of plan.windows)
    for (const line of window.roleDemand ?? []) labels.set(line.roleId, line.roleLabel);
  const needsUnassigned = plan.windows.some(
    (window) => !(window.roleDemand ?? []).length && (fallback[window.initiativeId] ?? 0) > 0
  );
  if (needsUnassigned && !labels.has(UNASSIGNED_ROLE_ID))
    labels.set(UNASSIGNED_ROLE_ID, UNASSIGNED_ROLE_LABEL);

  const supplyById = new Map(supply.map((role) => [role.roleId, role]));
  const previousById = new Map(
    (previous?.periods ?? []).map((period) => [
      period.periodId,
      new Map((period.roles ?? []).map((role) => [role.roleId, role])),
    ])
  );
  const roleIds = [...labels.keys()].sort((left, right) =>
    (labels.get(left) as string).localeCompare(labels.get(right) as string, 'pl')
  );

  return plan.periods.map((period) => {
    const weeks = periodWeeks(period);
    const covering = plan.windows.filter((window) => windowCoversPeriod(window, period));
    const roles: CapacityRoleLine[] = roleIds.map((roleId) => {
      const roleLabel = labels.get(roleId) as string;

      // --- POPYT (D3'): suma FTE z okien planu obejmujących ten okres ---
      let demand: number | null = null;
      let demandSource: CapacityRoleLine['demandSource'] = 'UNKNOWN';
      let declared = 0;
      let fallbackTotal = 0;
      for (const window of covering) {
        const line = (window.roleDemand ?? []).find((item) => item.roleId === roleId);
        if (line) {
          declared += line.fte;
          demandSource = 'PLAN';
          continue;
        }
        if (roleId === UNASSIGNED_ROLE_ID && !(window.roleDemand ?? []).length) {
          const requiredFte = fallback[window.initiativeId] ?? 0;
          if (requiredFte > 0) fallbackTotal += requiredFte;
        }
      }
      if (demandSource === 'PLAN') demand = round3(declared + fallbackTotal);
      else if (fallbackTotal > 0) {
        demand = round3(fallbackTotal);
        demandSource = 'UNKNOWN';
      } else if (planIsRoleAware) {
        demand = 0;
        demandSource = 'PLAN';
      }

      // --- PODAŻ (D2'): osoby z tym stanowiskiem × tygodnie okresu ---
      const manual = previousById.get(period.periodId)?.get(roleId);
      if (manual?.supplySource === 'MANUAL' && manual.supply !== null)
        return {
          roleId,
          roleLabel,
          demand,
          supply: manual.supply,
          supplySource: 'MANUAL',
          demandSource,
        };
      const available = supplyById.get(roleId);
      return {
        roleId,
        roleLabel,
        demand,
        supply: available ? round3(available.fteWeekly * weeks) : null,
        supplySource: available ? 'RESOURCE_PLAN' : 'UNKNOWN',
        demandSource,
      };
    });

    const demandSum = sumRoleLines(roles, 'demand');
    const supplySum = sumRoleLines(roles, 'supply');
    return {
      periodId: period.periodId,
      start: period.start,
      end: period.end,
      demand: scalarRange(
        demandSum.total,
        demandSum.contributing,
        'demand',
        input.ownerId,
        `plan-scenario:${plan.scenarioId}`,
        Math.max(1, plan.scenarioVersion),
        asOf,
        'Plan nie podaje popytu na role w tym okresie.'
      ),
      supply: scalarRange(
        supplySum.total,
        supplySum.contributing,
        'supply',
        input.ownerId,
        'execution-control:resource-plan',
        1,
        asOf,
        'Żadna osoba w organizacji nie ma stanowiska użytego w tym planie.'
      ),
      roles,
    };
  });
}
