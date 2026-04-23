import type { Severity, TenantId } from './ExecutionProposalV1.js';

export type { TenantId } from './ExecutionProposalV1.js';

export type RunId = string & { readonly __brand: 'RunId' };
export type RunStatus = 'pending' | 'running' | 'paused' | 'succeeded' | 'failed' | 'cancelled';

export function unsafeRunId(value: string): RunId {
  return String(value) as RunId;
}

export type RunRow = {
  readonly id: RunId;
  readonly tenantId: TenantId;
  readonly correlationId: string;
  readonly conversationId?: string | null;
  readonly origin?: string | null;
  readonly runType?: string | null;
  readonly parentRunId?: RunId | null;
  readonly approvalState?: string | null;
  readonly latestBarrierState?: string | null;
  readonly latestInterruptState?: string | null;
  readonly status: RunStatus;
  readonly severity: Severity;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly budgetUsed: {
    readonly wallMs: number;
    readonly costCents: number;
    readonly toolCalls: number;
    readonly tokens: number;
  };
};

export type LedgerQuery = {
  readonly tenantId: TenantId;
  readonly limit?: number;
  readonly id?: RunId;
  readonly correlationId?: string;
  readonly conversationId?: string;
  readonly origin?: string;
  readonly runType?: string;
  readonly parentRunId?: RunId;
  readonly status?: RunStatus;
  readonly severity?: Severity;
  readonly startedAtFrom?: string;
  readonly startedAtTo?: string;
};

export function assertTenantScoped(entity: { readonly tenantId: TenantId }, tenantId: TenantId): void {
  if (entity.tenantId !== tenantId) {
    throw new Error(`Tenant scope mismatch: ${String(entity.tenantId)} !== ${String(tenantId)}`);
  }
}

export function assertLedgerQueryWhitelisted(query: Record<string, unknown>): void {
  const allowed = new Set([
    'tenantId',
    'limit',
    'id',
    'correlationId',
    'conversationId',
    'origin',
    'runType',
    'parentRunId',
    'status',
    'severity',
    'startedAtFrom',
    'startedAtTo',
  ]);
  for (const key of Object.keys(query)) {
    if (!allowed.has(key)) {
      throw new Error(`Ledger query key not allowed: ${key}`);
    }
  }
}

export function assertRunTransition(from: RunStatus, to: RunStatus): void {
  // Minimal invariant: terminal states cannot transition.
  const terminal = new Set<RunStatus>(['succeeded', 'failed', 'cancelled']);
  if (terminal.has(from) && from !== to) {
    throw new Error(`Illegal run transition: ${from} -> ${to}`);
  }
}

