import {
  InitiativeStatus,
  type InitiativeStatus as InitiativeStatusCode,
} from '../../../packages/shared/src/constants/initiativeStatuses.generated';
import {
  INITIATIVE_LIFECYCLE,
  type InitiativeLifecycleStatus,
} from './foundation';

export interface InitiativeStatusProjection {
  status: InitiativeStatusCode;
  archived: boolean;
}

const runtimeToStatus: Record<InitiativeLifecycleStatus, InitiativeStatusProjection> = {
  REGISTERED_DRAFT: { status: InitiativeStatus.DRAFT, archived: false },
  DEFINED: { status: InitiativeStatus.DRAFT, archived: false },
  ANALYZING: { status: InitiativeStatus.PENDING_APPROVAL, archived: false },
  READY_FOR_DECISION: { status: InitiativeStatus.PENDING_APPROVAL, archived: false },
  APPROVED_BACKLOG: { status: InitiativeStatus.APPROVED, archived: false },
  SCHEDULED: { status: InitiativeStatus.APPROVED, archived: false },
  IN_EXECUTION: { status: InitiativeStatus.IN_EXECUTION, archived: false },
  DELIVERED: { status: InitiativeStatus.CLOSED, archived: false },
  BENEFITS_TRACKING: { status: InitiativeStatus.CLOSED, archived: false },
  EFFECTIVENESS_REVIEWED: { status: InitiativeStatus.CLOSED, archived: false },
  CLOSED: { status: InitiativeStatus.CLOSED, archived: false },
  ARCHIVED: { status: InitiativeStatus.CLOSED, archived: true },
};

const statusToRuntime: Record<InitiativeStatusCode, readonly InitiativeLifecycleStatus[]> = {
  PROPOSED: [],
  DRAFT: ['REGISTERED_DRAFT', 'DEFINED'],
  PENDING_APPROVAL: ['ANALYZING', 'READY_FOR_DECISION'],
  APPROVED: ['APPROVED_BACKLOG', 'SCHEDULED'],
  IN_EXECUTION: ['IN_EXECUTION'],
  CLOSED: ['DELIVERED', 'BENEFITS_TRACKING', 'EFFECTIVENESS_REVIEWED', 'CLOSED', 'ARCHIVED'],
  REJECTED: [],
};

const legacyToRuntime: Record<string, InitiativeLifecycleStatus> = {
  PROPOSED: 'REGISTERED_DRAFT', DRAFT: 'REGISTERED_DRAFT',
  PENDING_REVIEW: 'READY_FOR_DECISION', REVIEW: 'READY_FOR_DECISION',
  PROMOTED: 'READY_FOR_DECISION', PLANNING: 'READY_FOR_DECISION',
  PENDING_APPROVAL: 'READY_FOR_DECISION', APPROVED: 'APPROVED_BACKLOG',
  SCHEDULED: 'SCHEDULED', EXECUTING: 'IN_EXECUTION', IN_PROGRESS: 'IN_EXECUTION',
  IN_EXECUTION: 'IN_EXECUTION', BLOCKED: 'IN_EXECUTION', DONE: 'CLOSED',
  TRACKING: 'BENEFITS_TRACKING', ARCHIVED: 'ARCHIVED', CLOSED: 'CLOSED',
  CANCELLED: 'CLOSED', REJECTED: 'CLOSED',
};

export function mapInitiativeStatus(input: {
  direction: 'runtime-to-status'; lifecycle: InitiativeLifecycleStatus;
}): InitiativeStatusProjection;
export function mapInitiativeStatus(input: {
  direction: 'status-to-runtime'; status: InitiativeStatusCode;
}): readonly InitiativeLifecycleStatus[];
export function mapInitiativeStatus(input: {
  direction: 'legacy-to-runtime'; status: string;
}): InitiativeLifecycleStatus | null;
export function mapInitiativeStatus(input:
  | { direction: 'runtime-to-status'; lifecycle: InitiativeLifecycleStatus }
  | { direction: 'status-to-runtime'; status: InitiativeStatusCode }
  | { direction: 'legacy-to-runtime'; status: string }
): InitiativeStatusProjection | readonly InitiativeLifecycleStatus[] | InitiativeLifecycleStatus | null {
  if (input.direction === 'runtime-to-status') return runtimeToStatus[input.lifecycle];
  if (input.direction === 'status-to-runtime') return statusToRuntime[input.status];
  const normalized = String(input.status || '').trim().toUpperCase();
  if ((INITIATIVE_LIFECYCLE as readonly string[]).includes(normalized)) {
    return normalized as InitiativeLifecycleStatus;
  }
  return legacyToRuntime[normalized] ?? null;
}
