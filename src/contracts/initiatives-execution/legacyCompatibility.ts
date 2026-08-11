import type {
  ExecutionHealth,
  ExecutionState,
  GateState,
  InitiativeDisposition,
  InitiativeLifecycleStatus,
} from './foundation';

export const LEGACY_INITIATIVE_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'REVIEW',
  'PROMOTED',
  'PLANNING',
  'APPROVED',
  'SCHEDULED',
  'EXECUTING',
  'BLOCKED',
  'DONE',
  'TRACKING',
  'CANCELLED',
  'ARCHIVED',
] as const;

export type LegacyInitiativeStatus = (typeof LEGACY_INITIATIVE_STATUSES)[number];

export interface LegacyStatusProjection {
  runtimeStatus: LegacyInitiativeStatus;
  lifecycle: InitiativeLifecycleStatus;
  gateState: GateState;
  disposition: InitiativeDisposition | 'MIGRATION_REVIEW_REQUIRED';
  executionState: ExecutionState;
  executionHealth: ExecutionHealth;
  confidence: 'DETERMINISTIC' | 'COMPATIBILITY_INFERENCE' | 'AMBIGUOUS';
  notes: readonly string[];
}

export const LEGACY_STATUS_PROJECTIONS: Readonly<
  Record<LegacyInitiativeStatus, LegacyStatusProjection>
> = {
  DRAFT: {
    runtimeStatus: 'DRAFT',
    lifecycle: 'REGISTERED_DRAFT',
    gateState: 'NOT_REQUESTED',
    disposition: 'ACTIVE',
    executionState: 'NOT_STARTED',
    executionHealth: 'NOT_APPLICABLE',
    confidence: 'COMPATIBILITY_INFERENCE',
    notes: [
      'candidate state must not be inferred; projection applies only to an Initiative record',
    ],
  },
  PENDING_REVIEW: {
    runtimeStatus: 'PENDING_REVIEW',
    lifecycle: 'REGISTERED_DRAFT',
    gateState: 'PENDING_DECISION',
    disposition: 'ACTIVE',
    executionState: 'NOT_STARTED',
    executionHealth: 'NOT_APPLICABLE',
    confidence: 'COMPATIBILITY_INFERENCE',
    notes: ['legacy review does not prove approved Definition'],
  },
  REVIEW: {
    runtimeStatus: 'REVIEW',
    lifecycle: 'REGISTERED_DRAFT',
    gateState: 'PENDING_DECISION',
    disposition: 'ACTIVE',
    executionState: 'NOT_STARTED',
    executionHealth: 'NOT_APPLICABLE',
    confidence: 'COMPATIBILITY_INFERENCE',
    notes: ['definition approval snapshot must be verified before mapping to DEFINED'],
  },
  PROMOTED: {
    runtimeStatus: 'PROMOTED',
    lifecycle: 'DEFINED',
    gateState: 'APPROVED',
    disposition: 'ACTIVE',
    executionState: 'NOT_STARTED',
    executionHealth: 'NOT_APPLICABLE',
    confidence: 'COMPATIBILITY_INFERENCE',
    notes: ['legacy promotion is treated as Definition approval, not Portfolio approval'],
  },
  PLANNING: {
    runtimeStatus: 'PLANNING',
    lifecycle: 'ANALYZING',
    gateState: 'PREPARING',
    disposition: 'ACTIVE',
    executionState: 'NOT_STARTED',
    executionHealth: 'NOT_APPLICABLE',
    confidence: 'COMPATIBILITY_INFERENCE',
    notes: ['decision readiness is separately evaluated'],
  },
  APPROVED: {
    runtimeStatus: 'APPROVED',
    lifecycle: 'APPROVED_BACKLOG',
    gateState: 'APPROVED',
    disposition: 'ACTIVE',
    executionState: 'NOT_STARTED',
    executionHealth: 'NOT_APPLICABLE',
    confidence: 'COMPATIBILITY_INFERENCE',
    notes: ['legacy approval must retain its evidence reference if available'],
  },
  SCHEDULED: {
    runtimeStatus: 'SCHEDULED',
    lifecycle: 'SCHEDULED',
    gateState: 'APPROVED',
    disposition: 'ACTIVE',
    executionState: 'HANDOFF_PENDING',
    executionHealth: 'UNKNOWN',
    confidence: 'DETERMINISTIC',
    notes: [],
  },
  EXECUTING: {
    runtimeStatus: 'EXECUTING',
    lifecycle: 'IN_EXECUTION',
    gateState: 'APPROVED',
    disposition: 'ACTIVE',
    executionState: 'ACTIVE',
    executionHealth: 'UNKNOWN',
    confidence: 'DETERMINISTIC',
    notes: [],
  },
  BLOCKED: {
    runtimeStatus: 'BLOCKED',
    lifecycle: 'IN_EXECUTION',
    gateState: 'APPROVED',
    disposition: 'ACTIVE',
    executionState: 'ACTIVE',
    executionHealth: 'CRITICAL',
    confidence: 'COMPATIBILITY_INFERENCE',
    notes: ['BLOCKED becomes an execution signal/overlay; root cause remains required'],
  },
  DONE: {
    runtimeStatus: 'DONE',
    lifecycle: 'DELIVERED',
    gateState: 'APPROVED',
    disposition: 'ACTIVE',
    executionState: 'ENDED',
    executionHealth: 'NOT_APPLICABLE',
    confidence: 'COMPATIBILITY_INFERENCE',
    notes: ['delivery evidence/acceptance must be reconciled'],
  },
  TRACKING: {
    runtimeStatus: 'TRACKING',
    lifecycle: 'BENEFITS_TRACKING',
    gateState: 'APPROVED',
    disposition: 'ACTIVE',
    executionState: 'ENDED',
    executionHealth: 'NOT_APPLICABLE',
    confidence: 'COMPATIBILITY_INFERENCE',
    notes: ['effectiveness result remains NOT_MEASURED until Results evidence exists'],
  },
  CANCELLED: {
    runtimeStatus: 'CANCELLED',
    lifecycle: 'REGISTERED_DRAFT',
    gateState: 'SUPERSEDED',
    disposition: 'MIGRATION_REVIEW_REQUIRED',
    executionState: 'ENDED',
    executionHealth: 'NOT_APPLICABLE',
    confidence: 'AMBIGUOUS',
    notes: ['legacy CANCELLED may mean target CANCELLED, REJECTED or STOPPED'],
  },
  ARCHIVED: {
    runtimeStatus: 'ARCHIVED',
    lifecycle: 'ARCHIVED',
    gateState: 'SUPERSEDED',
    disposition: 'ACTIVE',
    executionState: 'ENDED',
    executionHealth: 'NOT_APPLICABLE',
    confidence: 'DETERMINISTIC',
    notes: ['prior lifecycle/effectiveness remains historical and may require backfill'],
  },
};

export function projectLegacyInitiativeStatus(status: string): LegacyStatusProjection | null {
  return Object.prototype.hasOwnProperty.call(LEGACY_STATUS_PROJECTIONS, status)
    ? LEGACY_STATUS_PROJECTIONS[status as LegacyInitiativeStatus]
    : null;
}
