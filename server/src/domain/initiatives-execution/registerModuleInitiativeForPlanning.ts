import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandRuleError,
} from './materialCommand.js';

/**
 * MOST: inicjatywa MODUŁU -> agregat planowania (P15-K2, DEC-421, decyzja D1').
 *
 * POMIAR 07.09 (evidence/p15-k2/przed.json, własne API :4153 na kopii bazy):
 * moduł ma 72 wiersze w `initiatives`, a plan widzi tylko 5 agregatów
 * `ie_aggregate_state/initiative` z seedu P11. CREATE planu z oknem na inicjatywę
 * modułu spoza seedu = HTTP 400 `PLAN_MEMBER_NOT_APPROVED`. Jedyny istniejący most
 * (`adoptions/accepted-classic`) zwraca 422 `INITIATIVE_OWNER_INELIGIBLE`, bo wymaga
 * wiersza w `project_members` (0 wierszy w CAŁEJ bazie) i rodowodu SWOT (0/72).
 *
 * Ta komenda jest mostem GENERYCZNYM: bierze inicjatywę modułu w statusie
 * `APPROVED` (albo `PENDING_APPROVAL` jako „warunkową", gdy PMO na to pozwoli)
 * i zakłada/odświeża dla niej agregat `ie/initiative` w stanie `APPROVED_BACKLOG`,
 * którego wymaga `mutatePlanScenario`. BEZ warunku `project_members` i BEZ rodowodu
 * SWOT — te dwa warunki opisują inną ścieżkę (adopcję kandydata z Assessmentu),
 * nie planowanie zatwierdzonej inicjatywy modułu.
 */

/** Stany, z których NIE wolno cofnąć inicjatywy do backlogu planowania. */
export const NON_PLANNABLE_LIFECYCLE_STATES = [
  'IN_EXECUTION',
  'EXECUTING',
  'DELIVERED',
  'CLOSED',
  'ARCHIVED',
  'CANCELLED',
] as const;

/** Statusy modułu, które kwalifikują inicjatywę do planowania. */
export const PLANNABLE_MODULE_STATUSES = ['APPROVED', 'PENDING_APPROVAL'] as const;

export const PLANNING_SOURCE = 'MODULE_INITIATIVE';
export const INITIATIVE_NOT_PLANNABLE_RULE = 'INITIATIVE_NOT_PLANNABLE';

export interface ModuleInitiativeForPlanning {
  initiativeId: string;
  name: string;
  status: string;
  projectId: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  requiredCapacityFte: number | null;
  dependsOn: string[];
}

export interface RegisterForPlanningPayload {
  /** PMO świadomie dopuszcza inicjatywy „Do zatwierdzenia" jako warunkowe. */
  allowConditional: boolean;
}

export interface PlanningRegisteredInitiative {
  initiativeId: string;
  lifecycleState: 'APPROVED_BACKLOG';
  title: string;
  name: string;
  projectId: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  requiredCapacityFte: number | null;
  conditional: boolean;
  dependencySnapshot: string[];
  planning: {
    source: typeof PLANNING_SOURCE;
    moduleStatus: string;
    conditional: boolean;
    registeredBy: string;
    registeredAt: string;
  };
  [key: string]: unknown;
}

/**
 * `projectId` agregatu = projekt inicjatywy modułu, a gdy go NIE MA (pomiar 07.09:
 * 43 z 72 inicjatyw ma `project_id` NULL) — identyfikator organizacji. Powód:
 * `resolveProjectIdsForAggregate` zwraca dla pustego `projectId` listę pustą, a
 * `authorizeProjects` na pustej liście zwraca `false` — agregat byłby niewidoczny
 * dla wszystkich. Organizacja jako zakres jest UCZCIWYM odpowiednikiem inicjatywy
 * bez projektu (autoryzacja schodzi wtedy do roli aplikacyjnej), a nie obejściem.
 */
export function planningProjectScope(
  moduleProjectId: string | null,
  organizationId: string
): string {
  const trimmed = (moduleProjectId ?? '').trim();
  return trimmed || organizationId;
}

/** Czysta funkcja decyzji: czy i jak wolno przyjąć inicjatywę do planowania. */
export function assertPlannable(
  module: ModuleInitiativeForPlanning,
  existingLifecycleState: string | null,
  allowConditional: boolean
): { conditional: boolean } {
  const conditional = module.status === 'PENDING_APPROVAL';
  if (module.status !== 'APPROVED' && !(conditional && allowConditional)) {
    throw new MaterialCommandRuleError(
      INITIATIVE_NOT_PLANNABLE_RULE,
      400,
      `module initiative status ${module.status} is not plannable`
    );
  }
  if (
    existingLifecycleState &&
    (NON_PLANNABLE_LIFECYCLE_STATES as readonly string[]).includes(existingLifecycleState)
  ) {
    throw new MaterialCommandRuleError(
      INITIATIVE_NOT_PLANNABLE_RULE,
      400,
      `initiative aggregate is already in ${existingLifecycleState}`
    );
  }
  return { conditional };
}

/**
 * Kształt agregatu po przyjęciu do planowania. ŁĄCZY istniejący ładunek (5 agregatów
 * seedu P11 niesie `cardRefs`, bramki i decyzje — nadpisanie ich skasowałoby historię)
 * z polami planistycznymi z modułu.
 */
export function planningRegistrationState(
  module: ModuleInitiativeForPlanning,
  existing: Record<string, unknown> | null,
  conditional: boolean,
  envelope: { organizationId: string; actorId: string; policyId: string; policyVersion: number },
  now: string
): PlanningRegisteredInitiative {
  return {
    ...(existing ?? {}),
    initiativeId: module.initiativeId,
    lifecycleState: 'APPROVED_BACKLOG',
    title: typeof existing?.title === 'string' && existing.title.trim() ? existing.title : module.name,
    name: module.name,
    projectId: planningProjectScope(module.projectId, envelope.organizationId),
    plannedStartDate: module.plannedStartDate,
    plannedEndDate: module.plannedEndDate,
    requiredCapacityFte: module.requiredCapacityFte,
    conditional,
    dependencySnapshot: module.dependsOn,
    source: existing?.source ?? {
      proposalId: null,
      proposalVersion: null,
      sourceType: 'module_initiative',
      sourceId: module.initiativeId,
      sourceVersion: 1,
      freshness: 'CURRENT',
      refreshedAt: now,
    },
    governance: existing?.governance ?? {
      policyId: envelope.policyId,
      policyVersion: envelope.policyVersion,
    },
    readiness: existing?.readiness ?? 'NOT_EVALUATED',
    planning: {
      source: PLANNING_SOURCE,
      moduleStatus: module.status,
      conditional,
      registeredBy: envelope.actorId,
      registeredAt: now,
    },
  };
}

/**
 * Czy zapisany agregat jest JUŻ dokładnie tym, co zapisalibyśmy teraz.
 * Trasa używa tego, żeby powtórzone „przyjmij do planowania" nie podbijało
 * wersji agregatu (wymóg idempotencji kroku K2).
 */
export function planningRegistrationUnchanged(
  existing: Record<string, unknown> | null,
  next: PlanningRegisteredInitiative
): boolean {
  if (!existing) return false;
  const compare = (value: Record<string, unknown>) => ({
    lifecycleState: value.lifecycleState,
    name: value.name,
    projectId: value.projectId,
    plannedStartDate: value.plannedStartDate ?? null,
    plannedEndDate: value.plannedEndDate ?? null,
    requiredCapacityFte: value.requiredCapacityFte ?? null,
    conditional: value.conditional ?? null,
    dependencySnapshot: value.dependencySnapshot ?? [],
    planningSource: (value.planning as { source?: unknown } | undefined)?.source ?? null,
    moduleStatus: (value.planning as { moduleStatus?: unknown } | undefined)?.moduleStatus ?? null,
  });
  return JSON.stringify(compare(existing)) === JSON.stringify(compare(next));
}

export async function registerModuleInitiativeForPlanning(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<RegisterForPlanningPayload>
): Promise<MaterialCommandResult<PlanningRegisteredInitiative>> {
  if (
    envelope.commandType !== 'initiative.planning.register' ||
    envelope.aggregateType !== 'initiative'
  ) {
    throw new MaterialCommandRuleError(
      INITIATIVE_NOT_PLANNABLE_RULE,
      400,
      'Invalid planning registration command target'
    );
  }
  return executeMaterialCommand(unitOfWork, envelope, async (tx) => {
    const module = await tx.getModuleInitiativeForPlanning(
      envelope.organizationId,
      envelope.aggregateId
    );
    if (!module) {
      throw new MaterialCommandRuleError(
        INITIATIVE_NOT_PLANNABLE_RULE,
        400,
        'module initiative not found'
      );
    }
    const existing = await tx.getAggregatePayload<Record<string, unknown>>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    const { conditional } = assertPlannable(
      module,
      typeof existing?.lifecycleState === 'string' ? existing.lifecycleState : null,
      envelope.payload.allowConditional
    );
    const state = planningRegistrationState(
      module,
      existing,
      conditional,
      envelope,
      new Date().toISOString()
    );
    return {
      mutation: state,
      response: state,
      eventType: 'initiative.planning.registered',
      eventPayload: {
        initiativeId: state.initiativeId,
        lifecycleState: state.lifecycleState,
        moduleStatus: module.status,
        conditional,
      },
      auditPayload: { disposition: 'REGISTER_FOR_PLANNING', before: existing, after: state },
    };
  });
}
