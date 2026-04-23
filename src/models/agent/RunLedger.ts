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
  readonly status?: RunStatus;
  readonly severity?: Severity;
  readonly startedAtFrom?: string;
  readonly startedAtTo?: string;
};

export function assertTenantScoped(
  entity: { readonly tenantId: TenantId },
  tenantId: TenantId
): void {
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
  const terminal = new Set<RunStatus>(['succeeded', 'failed', 'cancelled']);
  if (terminal.has(from) && from !== to) {
    throw new Error(`Illegal run transition: ${from} -> ${to}`);
  }
}

/**
 * V10-AGT-014 — Run Ledger core schema (Wave A seed, typed).
 *
 * Implements R-AGENT-14 from
 * `docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md#v10-agt-014`.
 *
 * Scope (Wave A seed · schema-only)
 * ---------------------------------
 * The ledger is the durable record of every run. The durable Postgres
 * schema lands with V10-AGT-015 (QueueExecutor) — this ticket pins the
 * **TypeScript contracts and the FSM** the executor + checkpoint store
 * must honour. Sibling tickets (V10-AGT-015..017, V10-AGT-026) consume
 * these types verbatim.
 *
 * What lands here
 * ---------------
 *   - Branded ids: `RunId`, `StepId`, `CheckpointId`, `TraceId`.
 *   - Five table shapes (rows): `RunRow`, `StepRow`, `CheckpointRow`,
 *     `ArtifactRow`, `TraceRow` — matching the schema block in the
 *     dev plan §V10-AGT-014.
 *   - Closed status enums: `RunStatus`, `StepStatus` + transition
 *     tables.
 *   - Deterministic transition validators: `assertRunTransition`,
 *     `assertStepTransition`. Pure; structural only.
 *   - `LedgerQuery` shape (what the store supports out of the box) +
 *     `LedgerQueryField` whitelist (dev plan "queryable by: run ID,
 *     correlation ID, tenant, time range, status") — used by the
 *     RLS guard.
 *   - `assertTenantScoped` — every row must carry a non-empty
 *     `tenantId` matching the caller tenant; RLS is enforced at the
 *     store ingress.
 *   - `LedgerError` with structured reasons.
 *
 * What does NOT land here
 * -----------------------
 *   - Postgres DDL (`src/services/agent/ledger/schema.sql`) — ships
 *     with V10-AGT-015 QueueExecutor.
 *   - LISTEN/NOTIFY wiring (V10-AGT-015).
 *   - OTel trace export (V10-AGT-026).
 *   - P90 query performance guard (V10-AGT-014 acceptance criterion,
 *     lands with V10-AGT-015 integration suite).
 *
 * Invariants pinned at runtime here
 * ---------------------------------
 *   - Every row is tenant-scoped (`tenantId` non-empty) — cross-tenant
 *     reads return empty at the store level; this guard is the type-
 *     system mirror.
 *   - `RunStatus` / `StepStatus` transitions are closed tables; any
 *     illegal transition raises `LedgerError` with a structured
 *     `invalid_transition` reason.
 *   - Terminal states (`succeeded` / `failed` / `cancelled` on runs,
 *     `succeeded` / `failed` / `skipped` on steps) are sinks — no
 *     outbound transition is permitted.
 */

import type { Severity, TenantId } from './ExecutionProposalV1';

// ---------------------------------------------------------------------------
// §1 — Branded ids.
// ---------------------------------------------------------------------------

declare const RUN_ID_BRAND: unique symbol;
declare const STEP_ID_BRAND: unique symbol;
declare const CHECKPOINT_ID_BRAND: unique symbol;
declare const LEDGER_TRACE_ID_BRAND: unique symbol;

export type RunId = string & { readonly [RUN_ID_BRAND]: void };
export type StepId = string & { readonly [STEP_ID_BRAND]: void };
export type CheckpointId = string & { readonly [CHECKPOINT_ID_BRAND]: void };
export type TraceId = string & { readonly [LEDGER_TRACE_ID_BRAND]: void };

export const unsafeRunId = (v: string): RunId => v as RunId;
export const unsafeStepId = (v: string): StepId => v as StepId;
export const unsafeCheckpointId = (v: string): CheckpointId =>
  v as CheckpointId;
export const unsafeTraceId = (v: string): TraceId => v as TraceId;

// ---------------------------------------------------------------------------
// §2 — Status enums + FSM.
// ---------------------------------------------------------------------------

export const RUN_STATUSES = [
  'pending',
  'running',
  'paused',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const RUN_TERMINAL_STATUSES = ['succeeded', 'failed', 'cancelled'] as const;
export type RunTerminalStatus = (typeof RUN_TERMINAL_STATUSES)[number];

export const STEP_STATUSES = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'skipped',
] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const STEP_TERMINAL_STATUSES = [
  'succeeded',
  'failed',
  'skipped',
] as const;
export type StepTerminalStatus = (typeof STEP_TERMINAL_STATUSES)[number];

/**
 * Closed run-status transition table.
 *
 *   pending   → running, cancelled
 *   running   → paused, succeeded, failed, cancelled
 *   paused    → running, cancelled
 *   succeeded → ∅ (sink)
 *   failed    → ∅ (sink)
 *   cancelled → ∅ (sink)
 */
export const RUN_STATUS_TRANSITIONS: Readonly<
  Record<RunStatus, readonly RunStatus[]>
> = {
  pending: ['running', 'cancelled'],
  running: ['paused', 'succeeded', 'failed', 'cancelled'],
  paused: ['running', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
};

/**
 * Closed step-status transition table.
 *
 *   pending   → running, skipped
 *   running   → succeeded, failed
 *   succeeded → ∅ (sink)
 *   failed    → ∅ (sink)
 *   skipped   → ∅ (sink)
 */
export const STEP_STATUS_TRANSITIONS: Readonly<
  Record<StepStatus, readonly StepStatus[]>
> = {
  pending: ['running', 'skipped'],
  running: ['succeeded', 'failed'],
  succeeded: [],
  failed: [],
  skipped: [],
};

// ---------------------------------------------------------------------------
// §3 — Row shapes.
// ---------------------------------------------------------------------------

/**
 * Dev-plan schema (verbatim column list, retyped for the runtime):
 *
 *   runs(id, tenant_id, correlation_id, status, started_at,
 *        finished_at, severity, budget_used)
 *
 * `budgetUsed` is a typed dictionary — the Run Ledger stores the
 * effective cap burn per-dimension at the time of the last write;
 * V10-AGT-015 populates it incrementally.
 */
export interface RunRow {
  readonly id: RunId;
  readonly tenantId: TenantId;
  readonly correlationId: string;
  readonly status: RunStatus;
  readonly severity: Severity;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly budgetUsed: BudgetUsed;
}

export interface BudgetUsed {
  readonly wallMs: number;
  readonly costCents: number;
  readonly toolCalls: number;
  readonly tokens: number;
}

/**
 * Dev-plan schema:
 *
 *   steps(id, run_id, ordinal, op_type, status, started_at,
 *         finished_at, input_ref, output_ref, error)
 *
 * `inputRef` / `outputRef` are opaque content-addressed keys against
 * the artifact / blob store — the Run Ledger does not persist payloads
 * inline; V10-AGT-026 resolves the reference at trace-export time.
 */
export interface StepRow {
  readonly id: StepId;
  readonly runId: RunId;
  readonly tenantId: TenantId;
  readonly ordinal: number;
  readonly opType: string;
  readonly status: StepStatus;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly inputRef: string | null;
  readonly outputRef: string | null;
  readonly error: string | null;
}

/**
 * Dev-plan schema:
 *
 *   checkpoints(id, run_id, step_ordinal, state_blob, created_at)
 *
 * `stateBlobHash` is the deduplication key: V10-AGT-016 hashes the
 * state blob with SHA-256 (hex) and reuses a single row when the hash
 * collides.
 */
export interface CheckpointRow {
  readonly id: CheckpointId;
  readonly runId: RunId;
  readonly tenantId: TenantId;
  readonly stepOrdinal: number;
  readonly stateBlobHash: string;
  readonly stateBlobRef: string;
  readonly createdAt: string;
}

/**
 * Dev-plan schema:
 *
 *   artifacts(id, run_id, artifact_ref, created_at)
 *
 * `artifactRef` is the `ArtifactId` from `src/models/artifact/Artifact.ts`
 * stringified — the join is performed at read time (not a foreign key
 * to keep the ledger isolated).
 */
export interface ArtifactRow {
  readonly id: string;
  readonly runId: RunId;
  readonly tenantId: TenantId;
  readonly artifactRef: string;
  readonly createdAt: string;
}

/**
 * Dev-plan schema:
 *
 *   traces(id, run_id, otel_trace_id, span_tree_blob)
 *
 * `spanTreeBlobRef` is opaque — V10-AGT-026 will drop the OTel-
 * compatible span tree here. `otelTraceId` is the cross-system
 * correlation id the collector surfaces to Grafana / Honeycomb.
 */
export interface TraceRow {
  readonly id: TraceId;
  readonly runId: RunId;
  readonly tenantId: TenantId;
  readonly otelTraceId: string;
  readonly spanTreeBlobRef: string;
}

// ---------------------------------------------------------------------------
// §4 — Queryable fields (whitelist).
// ---------------------------------------------------------------------------

/**
 * Dev-plan: "Queryable by: run ID, correlation ID, tenant, time range,
 * status." The LedgerStore surface rejects queries against any field
 * not in this whitelist — prevents accidental full-table scans and
 * pins the RLS-compatible index plan.
 */
export const LEDGER_QUERY_FIELDS = [
  'id',
  'correlationId',
  'tenantId',
  'status',
  'severity',
  'startedAtFrom',
  'startedAtTo',
] as const;

export type LedgerQueryField = (typeof LEDGER_QUERY_FIELDS)[number];

export interface LedgerQuery {
  readonly tenantId: TenantId;
  readonly id?: RunId;
  readonly correlationId?: string;
  readonly status?: RunStatus;
  readonly severity?: Severity;
  readonly startedAtFrom?: string;
  readonly startedAtTo?: string;
  readonly limit?: number;
}

// ---------------------------------------------------------------------------
// §5 — Errors.
// ---------------------------------------------------------------------------

export type LedgerErrorReason =
  | 'invalid_run_transition'
  | 'invalid_step_transition'
  | 'tenant_scope_missing'
  | 'tenant_scope_mismatch'
  | 'query_field_not_whitelisted';

export class LedgerError extends Error {
  readonly reason: LedgerErrorReason;
  readonly details: Readonly<Record<string, string>>;

  constructor(reason: LedgerErrorReason, details: Record<string, string> = {}) {
    const detailStr = Object.entries(details)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    super(
      `LedgerError[${reason}]${detailStr.length > 0 ? ` ${detailStr}` : ''}`,
    );
    this.name = 'LedgerError';
    this.reason = reason;
    this.details = Object.freeze({ ...details });
  }
}

// ---------------------------------------------------------------------------
// §6 — Transition validators.
// ---------------------------------------------------------------------------

export function isRunTerminal(status: RunStatus): boolean {
  return (RUN_TERMINAL_STATUSES as readonly RunStatus[]).includes(status);
}

export function isStepTerminal(status: StepStatus): boolean {
  return (STEP_TERMINAL_STATUSES as readonly StepStatus[]).includes(status);
}

export function assertRunTransition(from: RunStatus, to: RunStatus): void {
  const allowed = RUN_STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new LedgerError('invalid_run_transition', { from, to });
  }
}

export function assertStepTransition(from: StepStatus, to: StepStatus): void {
  const allowed = STEP_STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new LedgerError('invalid_step_transition', { from, to });
  }
}

// ---------------------------------------------------------------------------
// §7 — Tenant-scope guard (RLS mirror).
// ---------------------------------------------------------------------------

/**
 * Every row carries a `tenantId`. The caller MUST pass its own
 * tenant; the guard rejects unscoped rows (`tenantId.length === 0`)
 * and rows from a different tenant. This is the runtime mirror of the
 * Postgres row-level security policy that V10-AGT-015 installs.
 */
export function assertTenantScoped<
  Row extends { readonly tenantId: TenantId },
>(row: Row, callerTenantId: TenantId): void {
  if (typeof row.tenantId !== 'string' || row.tenantId.length === 0) {
    throw new LedgerError('tenant_scope_missing');
  }
  if (row.tenantId !== callerTenantId) {
    throw new LedgerError('tenant_scope_mismatch', {
      rowTenantId: row.tenantId,
      callerTenantId,
    });
  }
}

/**
 * Guards a LedgerQuery: rejects queries with fields outside the
 * whitelist. Callers are compile-time-safe (`LedgerQuery` is a typed
 * shape) but boundary-deserialised queries from services / CLIs pass
 * through here.
 */
export function assertLedgerQueryWhitelisted(
  query: Readonly<Record<string, unknown>>,
): void {
  const allowed = new Set<string>(LEDGER_QUERY_FIELDS);
  allowed.add('limit');
  for (const key of Object.keys(query)) {
    if (!allowed.has(key)) {
      throw new LedgerError('query_field_not_whitelisted', { field: key });
    }
  }
}
