import type { RegisteredInitiativeReadModel } from '@/services/initiatives-execution/runtimeApi';
import { InitiativeStatus, type PortfolioInitiative } from '@/types';

export type InitiativeLifecyclePreset =
  | 'PREPARATION'
  | 'DECISION'
  | 'APPROVED_BACKLOG'
  | 'SCHEDULED'
  | 'IN_EXECUTION'
  | 'RESULTS'
  | 'HISTORICAL';

export const INITIATIVE_LIFECYCLE_PRESETS: Array<{
  id: InitiativeLifecyclePreset;
  label: string;
  states: string[];
}> = [
  {
    id: 'PREPARATION',
    label: 'W przygotowaniu',
    states: ['REGISTERED_DRAFT', 'DEFINING', 'DEFINED', 'ANALYZING'],
  },
  { id: 'DECISION', label: 'Do decyzji', states: ['READY_FOR_DECISION'] },
  { id: 'APPROVED_BACKLOG', label: 'Zatwierdzony backlog', states: ['APPROVED_BACKLOG'] },
  { id: 'SCHEDULED', label: 'Zaplanowane', states: ['SCHEDULED'] },
  { id: 'IN_EXECUTION', label: 'W realizacji', states: ['IN_EXECUTION'] },
  {
    id: 'RESULTS',
    label: 'Rezultaty',
    states: ['DELIVERED', 'BENEFITS_TRACKING', 'EFFECTIVENESS_REVIEWED'],
  },
  { id: 'HISTORICAL', label: 'Zamknięte', states: ['CLOSED', 'ARCHIVED', 'CANCELLED'] },
];

export const INITIATIVE_LIFECYCLE_LABELS: Record<string, string> = {
  REGISTERED_DRAFT: 'Szkic zarejestrowany',
  DEFINING: 'Definiowanie',
  DEFINED: 'Zdefiniowana',
  ANALYZING: 'Analiza',
  READY_FOR_DECISION: 'Gotowa do decyzji',
  APPROVED_BACKLOG: 'Zatwierdzony backlog',
  SCHEDULED: 'Zaplanowana',
  IN_EXECUTION: 'W realizacji',
  DELIVERED: 'Dostarczona',
  BENEFITS_TRACKING: 'Pomiar efektów',
  EFFECTIVENESS_REVIEWED: 'Efektywność oceniona',
  CLOSED: 'Zamknięta',
  CANCELLED: 'Anulowana',
  ARCHIVED: 'Zarchiwizowana',
};

export const nextStepForLifecycle = (lifecycle: string) => {
  switch (lifecycle) {
    case 'REGISTERED_DRAFT':
    case 'DEFINING':
      return { gate: 'Definition', action: 'Uzupełnij definicję' };
    case 'DEFINED':
    case 'ANALYZING':
      return { gate: 'Analysis', action: 'Uzupełnij analizę' };
    case 'READY_FOR_DECISION':
      return { gate: 'Portfolio', action: 'Przygotuj decyzję portfelową' };
    case 'APPROVED_BACKLOG':
      return { gate: 'Schedule', action: 'Zaplanuj realizację' };
    case 'SCHEDULED':
      return { gate: 'Handoff', action: 'Przekaż do realizacji' };
    case 'IN_EXECUTION':
      return { gate: 'Delivery', action: 'Monitoruj realizację' };
    case 'DELIVERED':
    case 'BENEFITS_TRACKING':
      return { gate: 'Effectiveness', action: 'Zweryfikuj efekty' };
    case 'EFFECTIVENESS_REVIEWED':
      return { gate: 'Closure', action: 'Przygotuj zamknięcie' };
    default:
      return { gate: '—', action: 'Przejrzyj historię' };
  }
};

export const lifecycleMatchesPreset = (
  lifecycle: string,
  presetId: InitiativeLifecyclePreset | null
) => {
  if (!presetId) return true;
  return Boolean(
    INITIATIVE_LIFECYCLE_PRESETS.find((preset) => preset.id === presetId)?.states.includes(
      lifecycle
    )
  );
};

export const projectCanonicalInitiativeRegisterRow = (record: RegisteredInitiativeReadModel) => {
  const lifecycle = record.initiative.lifecycleState.toUpperCase();
  const nextStep = nextStepForLifecycle(lifecycle);
  return {
    id: record.initiative.initiativeId,
    canonicalVersion: record.version,
    title: record.initiative.title,
    problem: record.initiative.problem || null,
    lifecycle,
    lifecycleLabel: INITIATIVE_LIFECYCLE_LABELS[lifecycle] || 'UNKNOWN',
    gateName: nextStep.gate,
    gateReadiness:
      record.initiative.gateReadiness || record.initiative.readiness || 'NOT_EVALUATED',
    ownerId: record.initiative.initiativeOwnerId || null,
    nextAction: nextStep.action,
    expectedImpact: record.initiative.proposedOutcome || 'UNKNOWN',
    impactConfidence: 'UNKNOWN',
    plannedWindow: null,
    healthState: lifecycle === 'IN_EXECUTION' ? 'UNKNOWN' : 'N/A',
    sourceFreshness: record.initiative.source.freshness || 'UNKNOWN',
    updatedAt: record.updatedAt,
  } as const;
};

export const lifecycleToInitiativeStatus = (lifecycle: string): InitiativeStatus => {
  const state = lifecycle.toUpperCase();
  if (state === 'REGISTERED_DRAFT') return InitiativeStatus.DRAFT;
  if (state === 'DEFINED' || state === 'ANALYZING' || state === 'READY_FOR_DECISION')
    return InitiativeStatus.REVIEW;
  if (state === 'APPROVED_BACKLOG') return InitiativeStatus.APPROVED;
  if (state === 'SCHEDULED') return InitiativeStatus.SCHEDULED;
  if (state === 'IN_EXECUTION') return InitiativeStatus.EXECUTING;
  if (state === 'DELIVERED' || state === 'BENEFITS_TRACKING') return InitiativeStatus.TRACKING;
  if (state === 'CLOSED') return InitiativeStatus.DONE;
  if (state === 'ARCHIVED') return InitiativeStatus.ARCHIVED;
  return InitiativeStatus.DRAFT;
};

/** One canonical adapter used by both the Initiatives and Execution registers. */
export const toCanonicalInitiativeRegisterItem = (
  record: RegisteredInitiativeReadModel,
  actor?: { id?: string | null; displayName?: string | null }
): PortfolioInitiative => {
  const { initiative, updatedAt } = record;
  const projection = projectCanonicalInitiativeRegisterRow(record);
  const ownerId = initiative.initiativeOwnerId?.trim() || '';
  const ownerDisplayName =
    ownerId && actor?.id === ownerId && actor.displayName?.trim()
      ? actor.displayName.trim()
      : ownerId && !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(ownerId)
        ? ownerId.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
        : ownerId
          ? 'Przypisany właściciel'
          : '';
  return {
    ...projection,
    name: initiative.title,
    summary: initiative.problem,
    description: initiative.problem,
    axis: 'operational',
    status: lifecycleToInitiativeStatus(projection.lifecycle),
    displayStatus: projection.lifecycle,
    priority: undefined as unknown as PortfolioInitiative['priority'],
    progress: undefined as unknown as number,
    budget: undefined as unknown as number,
    projectId: initiative.projectId,
    sourceId: initiative.source.sourceId,
    sourceType: initiative.source.sourceType,
    ownerBusiness: ownerId
      ? {
          id: ownerId,
          firstName: ownerDisplayName,
          lastName: '',
        }
      : undefined,
    createdAt: updatedAt,
    updatedAt,
  } as PortfolioInitiative;
};
