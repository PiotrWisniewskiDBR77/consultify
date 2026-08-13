export const INITIATIVE_LIFECYCLE = [
  'REGISTERED_DRAFT',
  'DEFINED',
  'ANALYZING',
  'READY_FOR_DECISION',
  'APPROVED_BACKLOG',
  'SCHEDULED',
  'IN_EXECUTION',
  'DELIVERED',
  'BENEFITS_TRACKING',
  'EFFECTIVENESS_REVIEWED',
  'CLOSED',
  'ARCHIVED',
] as const;

export type InitiativeLifecycleStatus = (typeof INITIATIVE_LIFECYCLE)[number];

export const INITIATIVE_LIFECYCLE_TRANSITIONS: Readonly<
  Record<InitiativeLifecycleStatus, readonly InitiativeLifecycleStatus[]>
> = {
  REGISTERED_DRAFT: ['DEFINED'],
  DEFINED: ['ANALYZING'],
  ANALYZING: ['READY_FOR_DECISION'],
  READY_FOR_DECISION: ['APPROVED_BACKLOG'],
  APPROVED_BACKLOG: ['SCHEDULED'],
  SCHEDULED: ['IN_EXECUTION'],
  IN_EXECUTION: ['DELIVERED'],
  DELIVERED: ['BENEFITS_TRACKING'],
  BENEFITS_TRACKING: ['EFFECTIVENESS_REVIEWED'],
  EFFECTIVENESS_REVIEWED: ['CLOSED'],
  CLOSED: ['ARCHIVED'],
  ARCHIVED: [],
};

export type GateState =
  | 'NOT_REQUESTED'
  | 'PREPARING'
  | 'PENDING_DECISION'
  | 'APPROVED'
  | 'RETURNED'
  | 'SUPERSEDED';

export type GateReadiness =
  | 'NOT_EVALUATED'
  | 'NOT_READY'
  | 'CONDITIONALLY_READY'
  | 'READY'
  | 'BLOCKED';

export type InitiativeDisposition =
  | 'ACTIVE'
  | 'DEFERRED'
  | 'REJECTED'
  | 'MERGED'
  | 'STOPPED'
  | 'CANCELLED';

export type ExecutionState =
  | 'NOT_STARTED'
  | 'HANDOFF_PENDING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CLOSING'
  | 'ENDED';

export type ExecutionHealth = 'NOT_APPLICABLE' | 'UNKNOWN' | 'ON_TRACK' | 'AT_RISK' | 'CRITICAL';

export type EffectivenessResult = 'NOT_MEASURED' | 'CONFIRMED' | 'PARTIAL' | 'NOT_ACHIEVED';

export type SaveState = 'CLEAN' | 'DIRTY' | 'SAVING' | 'SAVED' | 'SAVE_FAILED' | 'CONFLICT';

export interface InitiativeStateProjection {
  lifecycle: InitiativeLifecycleStatus;
  gateState: GateState;
  gateReadiness: GateReadiness;
  disposition: InitiativeDisposition;
  executionState: ExecutionState;
  executionHealth: ExecutionHealth;
  effectiveness: EffectivenessResult;
  saveState: SaveState;
}

export function canTransitionLifecycle(
  from: InitiativeLifecycleStatus,
  to: InitiativeLifecycleStatus
): boolean {
  return INITIATIVE_LIFECYCLE_TRANSITIONS[from].includes(to);
}

export type GovernanceBaseline = 'LITE' | 'STANDARD' | 'COMPLEX';

export interface GovernancePolicyRef {
  policyId: string;
  version: number;
  baseline: GovernanceBaseline;
  strictness: number;
  source: 'PRODUCT_BASELINE' | 'ORGANIZATION' | 'PROJECT' | 'INITIATIVE';
}

export interface GovernancePolicyResolutionInput {
  productBaseline: GovernancePolicyRef;
  organizationDefault?: GovernancePolicyRef;
  projectOverride?: GovernancePolicyRef;
  initiativeOverride?: GovernancePolicyRef;
  recommendedMinimumStrictness?: number;
  downgradeDecisionId?: string;
}

export interface GovernancePolicyResolution {
  effective: GovernancePolicyRef | null;
  candidate: GovernancePolicyRef | null;
  status: 'RESOLVED' | 'HUMAN_CONFIRMATION_REQUIRED' | 'BLOCKED';
  reasons: string[];
}

export function resolveGovernancePolicy(
  input: GovernancePolicyResolutionInput
): GovernancePolicyResolution {
  const candidate =
    input.initiativeOverride ??
    input.projectOverride ??
    input.organizationDefault ??
    input.productBaseline;
  const reasons: string[] = [];

  if (!candidate.policyId || !Number.isInteger(candidate.version) || candidate.version < 1) {
    return {
      effective: null,
      candidate,
      status: 'BLOCKED',
      reasons: ['governance policy identity/version is invalid'],
    };
  }

  const parent = input.projectOverride ?? input.organizationDefault ?? input.productBaseline;
  if (candidate.strictness < parent.strictness && !input.downgradeDecisionId) {
    return {
      effective: null,
      candidate,
      status: 'BLOCKED',
      reasons: ['governance downgrade requires an authorized Decision'],
    };
  }

  if (
    input.recommendedMinimumStrictness !== undefined &&
    candidate.strictness < input.recommendedMinimumStrictness
  ) {
    reasons.push('evidence recommends a stricter governance profile');
    return {
      effective: null,
      candidate,
      status: 'HUMAN_CONFIRMATION_REQUIRED',
      reasons,
    };
  }

  return { effective: candidate, candidate, status: 'RESOLVED', reasons };
}

export interface MaterialCommandMetadata {
  organizationId: string;
  actorId: string;
  clientRequestId: string;
  correlationId: string;
  expectedVersion: number;
  policyId: string;
  policyVersion: number;
}

export function validateMaterialCommandMetadata(metadata: MaterialCommandMetadata): string[] {
  const errors: string[] = [];
  for (const [field, value] of Object.entries(metadata)) {
    if (typeof value === 'string' && value.trim().length === 0) errors.push(`${field} is required`);
  }
  if (!Number.isInteger(metadata.expectedVersion) || metadata.expectedVersion < 0) {
    errors.push('expectedVersion must be a non-negative integer');
  }
  if (!Number.isInteger(metadata.policyVersion) || metadata.policyVersion < 1) {
    errors.push('policyVersion must be a positive integer');
  }
  return errors;
}
