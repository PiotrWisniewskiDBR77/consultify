import type { ApprovalMode } from './ApprovalMode.js';

export const SEVERITIES = ['S0', 'S1', 'S2', 'S3', 'S4'] as const;
export type Severity = (typeof SEVERITIES)[number];

export type TenantId = string & { readonly __brand: 'TenantId' };
export type ActorId = string & { readonly __brand: 'ActorId' };

export function unsafeTenantId(value: string): TenantId {
  return String(value) as TenantId;
}

export function unsafeActorId(value: string): ActorId {
  return String(value) as ActorId;
}

export type ExecutionOp = {
  readonly kind: string;
  readonly compensatingOp?: unknown | null;
  readonly [key: string]: unknown;
};

export interface ExecutionProposalV1 {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly correlationId: string;
  readonly severity: Severity;
  readonly approvalMode: ApprovalMode;
  readonly ops: readonly ExecutionOp[];
  readonly proposedBy: ActorId | string;
}

