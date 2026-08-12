/**
 * Case Workspace — canonical NodeRun aggregate service.
 *
 * Implements docs/product/case-workspace/04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md
 * §3.4 (NodeRun schema) and §4.5 (NodeRun state machine) plus
 * docs/product/case-workspace/06_SECURITY_EVENTS_OBSERVABILITY.md §8 (leases,
 * heartbeats, expired-lease recovery) on top of the two tables added by
 * server/migrations/20260810_case_workspace_node_run_and_inbox.sql.
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS
 * ===========================================================================
 * Until now `node_run_id` was a free-text column on four shipped tables
 * (case_workspace_action_proposals, case_workspace_gateway_evaluations,
 * case_workspace_node_result_acceptances, case_workspace_waits) plus the
 * outbox, pointing at an identity nothing ever minted, and `attempt_id` had no
 * producer at all. This service mints both, so §10's correlation chain
 * caseId -> runId -> nodeRunId -> attemptId finally has all four links.
 *
 * ===========================================================================
 * THE THREE COUNTERS ARE NOT INTERCHANGEABLE
 * ===========================================================================
 *   `version`             — OCC guard for status transitions. Every mutating
 *                           method takes `expectedVersion` and its UPDATE ends
 *                           `WHERE node_run_id = ? AND version = ?`; zero rows
 *                           is `node_run_version_conflict`, never a silent
 *                           overwrite.
 *   `lease_fencing_token` — monotonic proof of WHO owns the work right now.
 *                           A worker whose lease was reclaimed still holds a
 *                           valid `version` but a stale fencing token, and
 *                           every worker-side write is CAS-guarded on the
 *                           token, so a resurrected zombie cannot complete an
 *                           attempt that was taken from it.
 *   `attempt`             — the execution ordinal. Carries no concurrency
 *                           meaning whatsoever.
 * Collapsing any two of these is the classic way a retry silently becomes a
 * double execution; they are kept apart deliberately, the same separation
 * case_workspace_waits already documents for version/claim_fencing_token.
 *
 * ===========================================================================
 * ATOMICITY
 * ===========================================================================
 * Every mutating method runs inside ONE withPgTransaction, and its
 * publishEvent() call runs on that same client — so the aggregate mutation,
 * the attempt row and the outbox event commit or roll back together (doc 06
 * §6 "Domain changes and outbox records commit atomically"). SQL uses this
 * codebase's `?` house style, which withPgTransaction's adaptQuery rewrites.
 *
 * ===========================================================================
 * AUTHORIZATION
 * ===========================================================================
 * Same split the rest of this directory already uses (the CW-P12 retrofit
 * decision): methods with a human actor in their signature
 * (createNodeRun/getNodeRun/listNodeRunsForRun/listAttemptsForNodeRun) gate
 * through caseWorkspaceAuthContext.requireCaseAccess. The scheduler primitives
 * (claimNodeRun, heartbeatNodeRunLease, reclaimExpiredNodeRunLease,
 * startNodeRunAttempt, completeNodeRunAttempt, timeoutNodeRunAttempt,
 * transitionNodeRun, listClaimableNodeRuns, listTimedOutNodeRuns,
 * listOrphanNodeRunReferences) have no human actor and are INTERNAL-ONLY /
 * NOT ROUTE-EXPOSED — they must be gated at a service/system-credential layer
 * if ever reachable from a route.
 */

import { createHash } from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';
import { requireCaseAccess } from './caseWorkspaceAuthContext.js';
import { publishEvent, redact } from './eventOutboxService.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** §4.5's state vocabulary, verbatim. */
export type NodeRunStatus =
  | 'PENDING'
  | 'READY'
  | 'CLAIMED'
  | 'RUNNING'
  | 'WAITING_HUMAN'
  | 'WAITING_TIMER'
  | 'WAITING_EVENT'
  | 'FAILED_RETRYABLE'
  | 'RETRY_SCHEDULED'
  | 'SUCCEEDED'
  | 'SKIPPED'
  | 'FAILED_TERMINAL'
  | 'CANCELLED';

export type NodeRunAttemptStatus =
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED_RETRYABLE'
  | 'FAILED_TERMINAL'
  | 'TIMED_OUT'
  | 'CANCELLED';

export type NodeRunCompensationState =
  | 'NOT_REQUIRED'
  | 'REQUIRED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED';

interface NodeRunRow {
  node_run_id: string;
  organization_id: string;
  project_id: string | null;
  case_id: string;
  run_id: string;
  node_id: string;
  node_version_ref: string;
  status: NodeRunStatus;
  attempt: number | string;
  max_attempts: number | string;
  current_attempt_id: string | null;
  input_snapshot_ref: string | null;
  output_snapshot_ref: string | null;
  wait_id: string | null;
  action_proposal_id: string | null;
  idempotency_key: string;
  lease_owner: string | null;
  lease_fencing_token: number | string;
  lease_expires_at: string | null;
  heartbeat_at: string | null;
  timeout_at: string | null;
  retry_not_before: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_detail_ref: string | null;
  compensation_state: NodeRunCompensationState;
  compensation_ref: string | null;
  version: number | string;
  created_at: string;
  updated_at: string;
}

interface NodeRunAttemptRow {
  attempt_id: string;
  node_run_id: string;
  attempt_number: number | string;
  organization_id: string;
  case_id: string;
  run_id: string;
  status: NodeRunAttemptStatus;
  lease_owner: string | null;
  capability_registry_id: string | null;
  timeout_at: string | null;
  started_at: string;
  ended_at: string | null;
  error_code: string | null;
  error_detail_ref: string | null;
  output_snapshot_ref: string | null;
  created_at: string;
}

export interface NodeRun {
  nodeRunId: string;
  organizationId: string;
  projectId: string | null;
  caseId: string;
  runId: string;
  nodeId: string;
  nodeVersionRef: string;
  status: NodeRunStatus;
  attempt: number;
  maxAttempts: number;
  currentAttemptId: string | null;
  inputSnapshotRef: string | null;
  outputSnapshotRef: string | null;
  waitId: string | null;
  actionProposalId: string | null;
  idempotencyKey: string;
  leaseOwner: string | null;
  leaseFencingToken: number;
  leaseExpiresAt: string | null;
  heartbeatAt: string | null;
  timeoutAt: string | null;
  retryNotBefore: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorDetailRef: string | null;
  compensationState: NodeRunCompensationState;
  compensationRef: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface NodeRunAttempt {
  attemptId: string;
  nodeRunId: string;
  attemptNumber: number;
  organizationId: string;
  caseId: string;
  runId: string;
  status: NodeRunAttemptStatus;
  leaseOwner: string | null;
  capabilityRegistryId: string | null;
  timeoutAt: string | null;
  startedAt: string;
  endedAt: string | null;
  errorCode: string | null;
  errorDetailRef: string | null;
  outputSnapshotRef: string | null;
  createdAt: string;
}

export interface CreateNodeRunInput {
  caseId: string;
  runId: string;
  nodeId: string;
  nodeVersionRef: string;
  idempotencyKey: string;
  maxAttempts?: number;
  inputSnapshotRef?: string | null;
  waitId?: string | null;
  actionProposalId?: string | null;
  /** Initial status; only PENDING or READY are legal entry points (§4.5). */
  initialStatus?: Extract<NodeRunStatus, 'PENDING' | 'READY'>;
}

export type ClaimNodeRunOutcome =
  | { outcome: 'claimed'; nodeRun: NodeRun; leaseOwner: string; fencingToken: number }
  | { outcome: 'lease_active' }
  | { outcome: 'not_claimable' }
  | { outcome: 'not_found' };

export type HeartbeatNodeRunLeaseOutcome = 'renewed' | 'fenced' | 'not_found';

/**
 * §8: "Expired leases are reclaimed only after idempotency or reconciliation
 * checks." The caller supplies that check; this is its verdict.
 *  - `alreadyApplied: true` means the previous holder's external effect DID
 *    land (readback proved it), so the work must be COMPLETED from the
 *    readback, never retried.
 */
export interface NodeRunReconciliationVerdict {
  alreadyApplied: boolean;
  outputSnapshotRef?: string | null;
  detail?: Record<string, unknown>;
}

export type ReclaimExpiredNodeRunLeaseOutcome =
  | { outcome: 'reclaimed'; nodeRun: NodeRun; leaseOwner: string; fencingToken: number }
  | { outcome: 'already_applied'; nodeRun: NodeRun }
  | { outcome: 'lease_active' }
  | { outcome: 'not_reclaimable' }
  | { outcome: 'not_found' };

export interface StartNodeRunAttemptInput {
  leaseOwner: string;
  fencingToken: number;
  timeoutMs?: number;
  capabilityRegistryId?: string | null;
}

export interface CompleteNodeRunAttemptInput {
  attemptId: string;
  leaseOwner: string;
  fencingToken: number;
  outcome: 'SUCCEEDED' | 'FAILED_RETRYABLE' | 'FAILED_TERMINAL';
  outputSnapshotRef?: string | null;
  errorCode?: string | null;
  errorDetailRef?: string | null;
  /** Backoff applied when the outcome is retryable and budget remains. */
  retryDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_RUN_TABLE = 'case_workspace_node_runs';
const ATTEMPT_TABLE = 'case_workspace_node_run_attempts';

/** §6 aggregate discriminator. Matches EVENT_TAXONOMY.md's existing `NODE_RUN`. */
const NODE_RUN_AGGREGATE_TYPE = 'NODE_RUN';

const SYSTEM_ACTOR_SCHEDULER = 'system:case-workspace-node-scheduler';
const SYSTEM_ACTOR_WORKER = 'system:case-workspace-node-worker';

/** Same lease default as case_workspace_waits' DEFAULT_TIMER_CLAIM_LEASE_MS. */
const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 60_000;

/**
 * §4.5's state machine, verbatim:
 *   PENDING -> READY -> CLAIMED -> RUNNING -> SUCCEEDED
 *   PENDING | READY -> SKIPPED
 *   RUNNING -> WAITING_HUMAN | WAITING_TIMER | WAITING_EVENT -> READY
 *   RUNNING -> FAILED_RETRYABLE -> RETRY_SCHEDULED -> READY
 *   RUNNING -> FAILED_TERMINAL
 *   PENDING | READY | WAITING_* | FAILED_RETRYABLE -> CANCELLED
 *
 * Two edges below are NOT in the doc's arrow list and are called out here
 * rather than smuggled in:
 *   CLAIMED -> READY   — a claim that is released or whose lease is reclaimed
 *                        without ever starting an attempt. The doc's list has
 *                        no way back out of CLAIMED at all, which would strand
 *                        every crashed claimant forever; the alternative
 *                        (allowing recovery only via CANCELLED) would report
 *                        cancellations that never happened.
 *   CLAIMED -> FAILED_TERMINAL — a claim that cannot be started at all (e.g.
 *                        its capability is UNAVAILABLE). Without it the node
 *                        would have to be marked RUNNING first, inventing an
 *                        attempt that never ran.
 * Notably ABSENT, and intentionally so: CLAIMED and RUNNING -> CANCELLED. §4.5
 * lists cancellation only from PENDING, READY, WAITING_* and FAILED_RETRYABLE, and
 * §4.5's "a cancelled Run … does not pretend that committed external effects
 * were rolled back" is exactly why in-flight work is not cancellable in place:
 * it must first terminate (or time out), and any external effect is then
 * handled on the compensation axis.
 */
const ALLOWED_TRANSITIONS: Record<NodeRunStatus, readonly NodeRunStatus[]> = {
  PENDING: ['READY', 'SKIPPED', 'CANCELLED'],
  READY: ['CLAIMED', 'SKIPPED', 'CANCELLED'],
  CLAIMED: ['RUNNING', 'READY', 'FAILED_TERMINAL'],
  RUNNING: [
    'SUCCEEDED',
    'WAITING_HUMAN',
    'WAITING_TIMER',
    'WAITING_EVENT',
    'FAILED_RETRYABLE',
    'FAILED_TERMINAL',
  ],
  WAITING_HUMAN: ['READY', 'CANCELLED'],
  WAITING_TIMER: ['READY', 'CANCELLED'],
  WAITING_EVENT: ['READY', 'CANCELLED'],
  FAILED_RETRYABLE: ['RETRY_SCHEDULED', 'FAILED_TERMINAL', 'CANCELLED'],
  RETRY_SCHEDULED: ['READY', 'CANCELLED'],
  SUCCEEDED: [],
  SKIPPED: [],
  FAILED_TERMINAL: [],
  CANCELLED: [],
};

const COMPENSATION_STATES: readonly NodeRunCompensationState[] = [
  'NOT_REQUIRED',
  'REQUIRED',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
];

/**
 * The four already-shipped tables that carry a loose, FK-less `node_run_id`.
 * listOrphanNodeRunReferences() reports — never repairs — references from
 * these to a NodeRun that does not exist. See the migration header for why an
 * FK retrofit is a separate, backfill-first migration.
 */
const LOOSE_NODE_RUN_REFERENCE_TABLES = [
  'case_workspace_action_proposals',
  'case_workspace_gateway_evaluations',
  'case_workspace_node_result_acceptances',
  'case_workspace_waits',
] as const;

// ---------------------------------------------------------------------------
// Local helpers (each service file in this directory keeps its own copy, per
// the existing convention here — they are not imported across services).
// ---------------------------------------------------------------------------

function requireNonBlank(value: string | null | undefined, reason: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

function optionalTrimmed(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function requirePositiveInt(value: unknown, fallback: number, reason: string): number {
  if (value === undefined || value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(reason);
  return parsed;
}

function mapRow(row: NodeRunRow): NodeRun {
  return {
    nodeRunId: row.node_run_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    caseId: row.case_id,
    runId: row.run_id,
    nodeId: row.node_id,
    nodeVersionRef: row.node_version_ref,
    status: row.status,
    attempt: Number(row.attempt),
    maxAttempts: Number(row.max_attempts),
    currentAttemptId: row.current_attempt_id,
    inputSnapshotRef: row.input_snapshot_ref,
    outputSnapshotRef: row.output_snapshot_ref,
    waitId: row.wait_id,
    actionProposalId: row.action_proposal_id,
    idempotencyKey: row.idempotency_key,
    leaseOwner: row.lease_owner,
    leaseFencingToken: Number(row.lease_fencing_token),
    leaseExpiresAt: row.lease_expires_at,
    heartbeatAt: row.heartbeat_at,
    timeoutAt: row.timeout_at,
    retryNotBefore: row.retry_not_before,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorCode: row.error_code,
    errorDetailRef: row.error_detail_ref,
    compensationState: row.compensation_state,
    compensationRef: row.compensation_ref,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttemptRow(row: NodeRunAttemptRow): NodeRunAttempt {
  return {
    attemptId: row.attempt_id,
    nodeRunId: row.node_run_id,
    attemptNumber: Number(row.attempt_number),
    organizationId: row.organization_id,
    caseId: row.case_id,
    runId: row.run_id,
    status: row.status,
    leaseOwner: row.lease_owner,
    capabilityRegistryId: row.capability_registry_id,
    timeoutAt: row.timeout_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    errorCode: row.error_code,
    errorDetailRef: row.error_detail_ref,
    outputSnapshotRef: row.output_snapshot_ref,
    createdAt: row.created_at,
  };
}

/**
 * §3 tenancy + §10 correlation, always read from the row the command just
 * WROTE (`RETURNING *`) rather than from input or a second SELECT — so
 * `aggregateVersion` is the POST-mutation OCC counter, exactly as
 * waitSubscriptionService.waitEventIdentity() does.
 */
function nodeRunEventIdentity(row: NodeRunRow): {
  organizationId: string;
  projectId: string | null;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  caseId: string;
  runId: string;
  nodeRunId: string;
} {
  return {
    organizationId: row.organization_id,
    projectId: row.project_id,
    aggregateType: NODE_RUN_AGGREGATE_TYPE,
    aggregateId: row.node_run_id,
    aggregateVersion: Number(row.version),
    caseId: row.case_id,
    runId: row.run_id,
    nodeRunId: row.node_run_id,
  };
}

/**
 * A caller-supplied error detail is very often the provider's raw message,
 * which is the most common way a credential, a client name or a full request
 * body leaks into a durable audit row (§6/§9). Anything that does not already
 * look like a deliberate reference (`sha256:…`, `log:…`, `ref:…`, `blob:…`) is
 * therefore replaced by a digest of itself: still correlatable, no longer a
 * copy.
 */
function toDetailRef(detail: string | null | undefined): string | null {
  const trimmed = optionalTrimmed(detail);
  if (trimmed === null) return null;
  if (/^(sha256:|log:|ref:|blob:)/.test(trimmed)) return trimmed;
  return `sha256:${createHash('sha256').update(trimmed).digest('hex').slice(0, 32)}`;
}

/**
 * An error CODE is meant to be a stable, enumerable token that is safe to
 * render, group and alert on. Free-form text in that column would make every
 * dashboard a string-matching exercise and would be another leak path, so the
 * shape is enforced and anything else collapses to a single honest bucket.
 */
function normalizeErrorCode(code: string | null | undefined): string | null {
  const trimmed = optionalTrimmed(code);
  if (trimmed === null) return null;
  return /^[A-Z][A-Z0-9_]{1,63}$/.test(trimmed) ? trimmed : 'UNCLASSIFIED_ERROR';
}

async function loadForUpdate(
  client: PgTransactionClient,
  nodeRunId: string
): Promise<NodeRunRow> {
  const result = await client.query<NodeRunRow>(
    `SELECT * FROM ${NODE_RUN_TABLE} WHERE node_run_id = ? FOR UPDATE`,
    [nodeRunId]
  );
  const row = result.rows[0];
  if (!row) throw new Error('node_run_not_found');
  return row;
}

function assertTransitionAllowed(from: NodeRunStatus, to: NodeRunStatus): void {
  if (!(ALLOWED_TRANSITIONS[from] ?? []).includes(to)) {
    throw new Error(`node_run_status_transition_not_allowed:${from}->${to}`);
  }
}

// ---------------------------------------------------------------------------
// createNodeRun
// ---------------------------------------------------------------------------

/**
 * §3.4. Mints the canonical NodeRun identity.
 *
 * IDEMPOTENT on (run_id, idempotency_key) — §3.4: "Idempotency identity is
 * stable for the intended business effect, not generated afresh on transport
 * retry." A redelivered StartNode command therefore finds the existing row and
 * returns it UNCHANGED, and emits NO event (a replay is not a second
 * creation — the same rule createWait already follows).
 *
 * The Case and the Run binding are both verified, and the binding's case_id
 * must match the Case: `run_id` and `case_id` are two independent FKs, so
 * nothing at the schema level stops a caller from attaching a node to Run A
 * while claiming Case B. That check is here.
 */
export async function createNodeRun(
  input: CreateNodeRunInput,
  actorUserId: string
): Promise<NodeRun> {
  const caseId = requireNonBlank(input.caseId, 'node_run_case_id_required');
  const runId = requireNonBlank(input.runId, 'node_run_run_id_required');
  const nodeId = requireNonBlank(input.nodeId, 'node_run_node_id_required');
  const nodeVersionRef = requireNonBlank(
    input.nodeVersionRef,
    'node_run_node_version_ref_required'
  );
  const idempotencyKey = requireNonBlank(
    input.idempotencyKey,
    'node_run_idempotency_key_required'
  );
  const maxAttempts = requirePositiveInt(input.maxAttempts, 1, 'node_run_max_attempts_invalid');
  const initialStatus = input.initialStatus ?? 'PENDING';
  if (initialStatus !== 'PENDING' && initialStatus !== 'READY') {
    throw new Error('node_run_initial_status_invalid');
  }

  await requireCaseAccess(requireNonBlank(actorUserId, 'node_run_actor_required'), caseId);

  return withPgTransaction(async (client) => {
    const caseResult = await client.query<{
      case_id: string;
      organization_id: string;
      project_id: string | null;
    }>(`SELECT case_id, organization_id, project_id FROM case_core WHERE case_id = ?`, [caseId]);
    const caseRow = caseResult.rows[0];
    if (!caseRow) throw new Error('node_run_case_not_found');

    const bindingResult = await client.query<{ run_id: string; case_id: string }>(
      `SELECT run_id, case_id FROM case_workspace_run_bindings WHERE run_id = ?`,
      [runId]
    );
    const binding = bindingResult.rows[0];
    if (!binding) throw new Error('node_run_run_binding_not_found');
    if (binding.case_id !== caseId) throw new Error('node_run_run_binding_case_mismatch');

    const now = new Date().toISOString();
    const nodeRunId = `cwnode-${uuidv4()}`;

    const inserted = await client.query<NodeRunRow>(
      `INSERT INTO ${NODE_RUN_TABLE} (
         node_run_id, organization_id, project_id, case_id, run_id,
         node_id, node_version_ref, status, attempt, max_attempts,
         input_snapshot_ref, wait_id, action_proposal_id, idempotency_key,
         version, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT (run_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [
        nodeRunId,
        caseRow.organization_id,
        caseRow.project_id,
        caseId,
        runId,
        nodeId,
        nodeVersionRef,
        initialStatus,
        maxAttempts,
        optionalTrimmed(input.inputSnapshotRef),
        optionalTrimmed(input.waitId),
        optionalTrimmed(input.actionProposalId),
        idempotencyKey,
        now,
        now,
      ]
    );

    const insertedRow = inserted.rows[0];
    if (!insertedRow) {
      // Idempotent replay. Return the existing row untouched and emit nothing —
      // a retried transport delivery must not look like a second NodeRun.
      const existingResult = await client.query<NodeRunRow>(
        `SELECT * FROM ${NODE_RUN_TABLE} WHERE run_id = ? AND idempotency_key = ?`,
        [runId, idempotencyKey]
      );
      const existing = existingResult.rows[0];
      if (!existing) throw new Error('node_run_idempotent_row_missing');
      if (existing.node_id !== nodeId) throw new Error('node_run_idempotency_key_conflict');
      return mapRow(existing);
    }

    await publishEvent(client, {
      eventType: 'node.run_created',
      ...nodeRunEventIdentity(insertedRow),
      actorUserId: requireNonBlank(actorUserId, 'node_run_actor_required'),
      redactedSummary: redact({
        nodeId,
        nodeVersionRef,
        status: insertedRow.status,
        maxAttempts,
      }),
    });

    return mapRow(insertedRow);
  });
}

// ---------------------------------------------------------------------------
// transitionNodeRun — the generic, OCC-guarded status flip
// ---------------------------------------------------------------------------

/**
 * §4.5. A single state transition, guarded by BOTH the state machine and OCC.
 *
 * `WHERE node_run_id = ? AND version = ?` is the whole OCC mechanism: a caller
 * holding a stale version writes nothing and gets `node_run_version_conflict`.
 * The row is also SELECTed FOR UPDATE first, so the transition legality is
 * decided against a locked, current row rather than against the caller's
 * possibly-stale copy.
 *
 * Entering a terminal status stamps completed_at and clears the lease and the
 * in-flight deadline; a node that is finished must not keep appearing in the
 * lease-recovery or timeout sweeps.
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED (scheduler primitive, no human actor).
 */
export async function transitionNodeRun(
  nodeRunId: string,
  toStatus: NodeRunStatus,
  expectedVersion: number,
  options: {
    waitId?: string | null;
    retryNotBefore?: string | null;
    errorCode?: string | null;
    errorDetailRef?: string | null;
    outputSnapshotRef?: string | null;
    actorUserId?: string;
  } = {}
): Promise<NodeRun> {
  const id = requireNonBlank(nodeRunId, 'node_run_id_required');
  if (typeof expectedVersion !== 'number') throw new Error('node_run_expected_version_required');
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_TRANSITIONS, toStatus)) {
    throw new Error('node_run_status_invalid');
  }

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    assertTransitionAllowed(row.status, toStatus);

    const now = new Date().toISOString();
    const terminal = (ALLOWED_TRANSITIONS[toStatus] ?? []).length === 0;

    const updated = await client.query<NodeRunRow>(
      `UPDATE ${NODE_RUN_TABLE}
          SET status = ?,
              wait_id = COALESCE(?, wait_id),
              retry_not_before = ?,
              error_code = COALESCE(?, error_code),
              error_detail_ref = COALESCE(?, error_detail_ref),
              output_snapshot_ref = COALESCE(?, output_snapshot_ref),
              completed_at = CASE WHEN ? THEN ? ELSE completed_at END,
              lease_owner = CASE WHEN ? THEN NULL ELSE lease_owner END,
              lease_expires_at = CASE WHEN ? THEN NULL ELSE lease_expires_at END,
              timeout_at = CASE WHEN ? THEN NULL ELSE timeout_at END,
              version = version + 1,
              updated_at = ?
        WHERE node_run_id = ? AND version = ?
        RETURNING *`,
      [
        toStatus,
        optionalTrimmed(options.waitId),
        toStatus === 'RETRY_SCHEDULED' ? optionalTrimmed(options.retryNotBefore) : null,
        normalizeErrorCode(options.errorCode),
        toDetailRef(options.errorDetailRef),
        optionalTrimmed(options.outputSnapshotRef),
        terminal,
        now,
        terminal,
        terminal,
        terminal,
        now,
        id,
        expectedVersion,
      ]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error('node_run_version_conflict');

    await publishEvent(client, {
      eventType: 'node.state_changed',
      ...nodeRunEventIdentity(updatedRow),
      attemptId: updatedRow.current_attempt_id,
      actorUserId: optionalTrimmed(options.actorUserId) ?? SYSTEM_ACTOR_SCHEDULER,
      redactedSummary: redact({
        from: row.status,
        to: updatedRow.status,
        attempt: Number(updatedRow.attempt),
        // The stable code is a fact worth carrying; the detail is a reference
        // by construction (toDetailRef), never a provider message.
        errorCode: updatedRow.error_code,
      }),
    });

    return mapRow(updatedRow);
  });
}

// ---------------------------------------------------------------------------
// Leases — §8 "Worker claims use leases/heartbeats"
// ---------------------------------------------------------------------------

/**
 * §8. Atomically take the lease on a READY (or backoff-elapsed
 * RETRY_SCHEDULED) node and move it to CLAIMED.
 *
 * ONE conditional UPDATE does the whole thing, reusing the idiom already
 * proven on case_workspace_waits: the guard
 * `(lease_owner IS NULL OR lease_expires_at::timestamptz < NOW())` means two
 * concurrent workers cannot both succeed — the second blocks on the row lock,
 * then re-evaluates the WHERE against the winner's committed row and matches
 * nothing. `NOW()` is Postgres' clock, never the application's, so a worker
 * with a skewed clock cannot grant itself a lease.
 *
 * `lease_fencing_token + 1` on every claim is what makes a zombie harmless:
 * every worker-side write below is CAS-guarded on (lease_owner, fencing token).
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED.
 */
export async function claimNodeRun(
  nodeRunId: string,
  params: { leaseOwner?: string; leaseMs?: number } = {}
): Promise<ClaimNodeRunOutcome> {
  const id = requireNonBlank(nodeRunId, 'node_run_id_required');
  const leaseOwner = optionalTrimmed(params.leaseOwner) ?? `worker-${uuidv4()}`;
  const leaseMs = requirePositiveInt(params.leaseMs, DEFAULT_LEASE_MS, 'node_run_lease_ms_invalid');

  return withPgTransaction(async (client) => {
    const now = new Date().toISOString();
    const claimed = await client.query<NodeRunRow>(
      `UPDATE ${NODE_RUN_TABLE}
          SET status = 'CLAIMED',
              lease_owner = ?,
              lease_fencing_token = lease_fencing_token + 1,
              lease_expires_at = (NOW() + (? || ' milliseconds')::interval)::text,
              heartbeat_at = ?,
              version = version + 1,
              updated_at = ?
        WHERE node_run_id = ?
          AND (
                status = 'READY'
             OR (status = 'RETRY_SCHEDULED'
                 AND (retry_not_before IS NULL OR retry_not_before::timestamptz <= NOW()))
              )
          AND (lease_owner IS NULL OR lease_expires_at::timestamptz < NOW())
        RETURNING *`,
      [leaseOwner, String(leaseMs), now, now, id]
    );

    const claimedRow = claimed.rows[0];
    if (claimedRow) {
      await publishEvent(client, {
        eventType: 'node.claimed',
        ...nodeRunEventIdentity(claimedRow),
        actorUserId: SYSTEM_ACTOR_SCHEDULER,
        redactedSummary: redact({
          // NOT named `*Token*`: PiiRedactor blanks any key containing "token"
          // by substring, and the fencing value is a monotonic counter, not a
          // credential — losing it would gut the §10 lease trace. Same naming
          // decision waitSubscriptionService already documents.
          leaseFencingCounter: Number(claimedRow.lease_fencing_token),
          leaseMs,
          leaseExpiresAt: claimedRow.lease_expires_at,
          attempt: Number(claimedRow.attempt),
        }),
      });
      return {
        outcome: 'claimed',
        nodeRun: mapRow(claimedRow),
        leaseOwner,
        fencingToken: Number(claimedRow.lease_fencing_token),
      };
    }

    const currentResult = await client.query<NodeRunRow>(
      `SELECT * FROM ${NODE_RUN_TABLE} WHERE node_run_id = ?`,
      [id]
    );
    const current = currentResult.rows[0];
    if (!current) return { outcome: 'not_found' };
    if (current.status !== 'READY' && current.status !== 'RETRY_SCHEDULED') {
      return { outcome: 'not_claimable' };
    }
    if (current.status === 'RETRY_SCHEDULED' && current.retry_not_before) {
      if (Date.parse(current.retry_not_before) > Date.now()) return { outcome: 'not_claimable' };
    }
    return { outcome: 'lease_active' };
  });
}

/**
 * §8/§3.4 heartbeatAt. CAS-guarded lease renewal: 0 rows against an existing
 * row means ownership was already lost to a reclaim ('fenced'), which is the
 * signal for the caller to STOP working rather than to retry the heartbeat.
 *
 * Deliberately does NOT bump `version`: a heartbeat is liveness, not a domain
 * transition, and bumping OCC here would invalidate the very worker's own
 * pending `expectedVersion` for completeNodeRunAttempt — the heartbeat would
 * sabotage the work it exists to protect.
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED.
 */
export async function heartbeatNodeRunLease(
  nodeRunId: string,
  leaseOwner: string,
  fencingToken: number,
  leaseMs?: number
): Promise<HeartbeatNodeRunLeaseOutcome> {
  const id = requireNonBlank(nodeRunId, 'node_run_id_required');
  const owner = requireNonBlank(leaseOwner, 'node_run_lease_owner_required');
  if (typeof fencingToken !== 'number') throw new Error('node_run_fencing_token_required');
  const leaseMsResolved = requirePositiveInt(leaseMs, DEFAULT_LEASE_MS, 'node_run_lease_ms_invalid');

  return withPgTransaction(async (client) => {
    const now = new Date().toISOString();
    const renewed = await client.query<NodeRunRow>(
      `UPDATE ${NODE_RUN_TABLE}
          SET lease_expires_at = (NOW() + (? || ' milliseconds')::interval)::text,
              heartbeat_at = ?,
              updated_at = ?
        WHERE node_run_id = ? AND lease_owner = ? AND lease_fencing_token = ?
          AND status IN ('CLAIMED', 'RUNNING')
        RETURNING *`,
      [String(leaseMsResolved), now, now, id, owner, fencingToken]
    );
    if (renewed.rows[0]) {
      await publishEvent(client, {
        eventType: 'node.lease_renewed',
        ...nodeRunEventIdentity(renewed.rows[0]),
        attemptId: renewed.rows[0].current_attempt_id,
        actorUserId: SYSTEM_ACTOR_WORKER,
        redactedSummary: redact({
          leaseFencingCounter: Number(renewed.rows[0].lease_fencing_token),
          leaseMs: leaseMsResolved,
          leaseExpiresAt: renewed.rows[0].lease_expires_at,
        }),
      });
      return 'renewed';
    }
    const existing = await client.query<{ node_run_id: string }>(
      `SELECT node_run_id FROM ${NODE_RUN_TABLE} WHERE node_run_id = ?`,
      [id]
    );
    return existing.rows[0] ? 'fenced' : 'not_found';
  });
}

/**
 * A real heartbeat loop over heartbeatNodeRunLease. Returns a stop function;
 * `onLost` fires the moment the lease is fenced or the row disappears, so the
 * worker can abandon work it no longer owns instead of racing the new holder.
 *
 * The timer is unref'd — a background heartbeat must never be the reason a
 * process refuses to exit.
 */
export function startNodeRunLeaseHeartbeat(
  nodeRunId: string,
  leaseOwner: string,
  fencingToken: number,
  options: { intervalMs?: number; leaseMs?: number; onLost?: (outcome: 'fenced' | 'not_found') => void } = {}
): () => void {
  const leaseMs = requirePositiveInt(options.leaseMs, DEFAULT_LEASE_MS, 'node_run_lease_ms_invalid');
  // Default to a third of the lease: two consecutive heartbeats may be lost
  // before the lease actually lapses.
  const intervalMs = requirePositiveInt(
    options.intervalMs,
    Math.max(1_000, Math.floor(leaseMs / 3)),
    'node_run_heartbeat_interval_invalid'
  );

  let stopped = false;
  const timer = setInterval(() => {
    void (async () => {
      if (stopped) return;
      try {
        const outcome = await heartbeatNodeRunLease(nodeRunId, leaseOwner, fencingToken, leaseMs);
        if (outcome !== 'renewed') {
          stopped = true;
          clearInterval(timer);
          options.onLost?.(outcome);
        }
      } catch {
        // A transient DB error must not kill the loop — the lease still has
        // time left, and the next tick may well succeed. Genuine loss of
        // ownership arrives as 'fenced', not as a throw.
      }
    })();
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

/**
 * §8: "Expired leases are reclaimed only after idempotency or reconciliation
 * checks." and "External effects without provider idempotency require readback
 * reconciliation before retry."
 *
 * This is the ONLY sanctioned way to take over an expired lease, and the
 * `reconcile` callback is MANDATORY — not optional with a permissive default.
 * A default would make the safe path the one every caller forgets, and the
 * whole failure mode this guards against (charging a customer twice because
 * the first worker died after the provider committed but before it recorded
 * anything) is invisible until it happens in production.
 *
 * Order of operations, deliberately:
 *   1. read the row and confirm the lease really has expired;
 *   2. run the caller's readback against the external system;
 *   3a. `alreadyApplied` -> the previous attempt DID land. The node is closed
 *       as SUCCEEDED from the readback and is NOT reclaimed, so no retry can
 *       ever be issued for an effect that already exists;
 *   3b. otherwise -> one conditional UPDATE re-checks the expiry guard and
 *       takes the lease with a bumped fencing token. Two workers racing here
 *       serialize on the row lock and exactly one matches the guard.
 *
 * The reconcile call happens OUTSIDE the row lock's protection window in the
 * sense that both racers may run it; that is inherent to a read-only external
 * check and is why the decisive UPDATE is still guarded. A reconcile that
 * throws aborts the reclaim (the lease stays expired and the node stays
 * recoverable) rather than being swallowed into a retry.
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED.
 */
export async function reclaimExpiredNodeRunLease(
  nodeRunId: string,
  reconcile: (nodeRun: NodeRun) => Promise<NodeRunReconciliationVerdict> | NodeRunReconciliationVerdict,
  params: { leaseOwner?: string; leaseMs?: number } = {}
): Promise<ReclaimExpiredNodeRunLeaseOutcome> {
  const id = requireNonBlank(nodeRunId, 'node_run_id_required');
  if (typeof reconcile !== 'function') throw new Error('node_run_reconciliation_required');
  const leaseOwner = optionalTrimmed(params.leaseOwner) ?? `worker-${uuidv4()}`;
  const leaseMs = requirePositiveInt(params.leaseMs, DEFAULT_LEASE_MS, 'node_run_lease_ms_invalid');

  const currentRow = await queryOne<NodeRunRow>(
    `SELECT * FROM ${NODE_RUN_TABLE} WHERE node_run_id = ?`,
    [id]
  );
  if (!currentRow) return { outcome: 'not_found' };
  if (currentRow.status !== 'CLAIMED' && currentRow.status !== 'RUNNING') {
    return { outcome: 'not_reclaimable' };
  }
  if (!currentRow.lease_owner) return { outcome: 'not_reclaimable' };
  if (currentRow.lease_expires_at && Date.parse(currentRow.lease_expires_at) > Date.now()) {
    return { outcome: 'lease_active' };
  }

  const verdict = await reconcile(mapRow(currentRow));

  if (verdict?.alreadyApplied) {
    // The dead worker's effect landed. Close the node from the readback rather
    // than retrying it — this is the entire point of §8's rule.
    return withPgTransaction(async (client) => {
      const row = await loadForUpdate(client, id);
      if (row.status !== 'CLAIMED' && row.status !== 'RUNNING') {
        return { outcome: 'not_reclaimable' as const };
      }
      const now = new Date().toISOString();
      const closed = await client.query<NodeRunRow>(
        `UPDATE ${NODE_RUN_TABLE}
            SET status = 'SUCCEEDED',
                output_snapshot_ref = COALESCE(?, output_snapshot_ref),
                completed_at = ?,
                lease_owner = NULL,
                lease_expires_at = NULL,
                timeout_at = NULL,
                version = version + 1,
                updated_at = ?
          WHERE node_run_id = ? AND version = ?
          RETURNING *`,
        [optionalTrimmed(verdict.outputSnapshotRef), now, now, id, Number(row.version)]
      );
      const closedRow = closed.rows[0];
      if (!closedRow) throw new Error('node_run_version_conflict');

      // Close the orphaned attempt too, so the ledger never shows an attempt
      // that is still RUNNING under a worker that no longer exists.
      if (closedRow.current_attempt_id) {
        await client.query(
          `UPDATE ${ATTEMPT_TABLE}
              SET status = 'SUCCEEDED', ended_at = ?,
                  output_snapshot_ref = COALESCE(?, output_snapshot_ref)
            WHERE attempt_id = ? AND status = 'RUNNING'`,
          [now, optionalTrimmed(verdict.outputSnapshotRef), closedRow.current_attempt_id]
        );
      }

      await publishEvent(client, {
        eventType: 'node.reconciled_already_applied',
        ...nodeRunEventIdentity(closedRow),
        attemptId: closedRow.current_attempt_id,
        actorUserId: SYSTEM_ACTOR_SCHEDULER,
        redactedSummary: redact({
          previousLeaseExpired: true,
          attempt: Number(closedRow.attempt),
          reconciliation: verdict.detail ?? {},
        }),
      });
      return { outcome: 'reclaimed' as const, nodeRun: mapRow(closedRow) };
    }).then((result) =>
      result.outcome === 'reclaimed'
        ? ({ outcome: 'already_applied', nodeRun: result.nodeRun } as ReclaimExpiredNodeRunLeaseOutcome)
        : (result as ReclaimExpiredNodeRunLeaseOutcome)
    );
  }

  return withPgTransaction(async (client) => {
    const now = new Date().toISOString();
    const reclaimed = await client.query<NodeRunRow>(
      `UPDATE ${NODE_RUN_TABLE}
          SET status = 'CLAIMED',
              lease_owner = ?,
              lease_fencing_token = lease_fencing_token + 1,
              lease_expires_at = (NOW() + (? || ' milliseconds')::interval)::text,
              heartbeat_at = ?,
              timeout_at = NULL,
              version = version + 1,
              updated_at = ?
        WHERE node_run_id = ?
          AND status IN ('CLAIMED', 'RUNNING')
          AND lease_owner IS NOT NULL
          AND lease_expires_at IS NOT NULL
          AND lease_expires_at::timestamptz < NOW()
        RETURNING *`,
      [leaseOwner, String(leaseMs), now, now, id]
    );
    const reclaimedRow = reclaimed.rows[0];
    if (!reclaimedRow) {
      const after = await client.query<NodeRunRow>(
        `SELECT * FROM ${NODE_RUN_TABLE} WHERE node_run_id = ?`,
        [id]
      );
      const afterRow = after.rows[0];
      if (!afterRow) return { outcome: 'not_found' as const };
      if (afterRow.status !== 'CLAIMED' && afterRow.status !== 'RUNNING') {
        return { outcome: 'not_reclaimable' as const };
      }
      return { outcome: 'lease_active' as const };
    }

    // The abandoned attempt is closed as TIMED_OUT: it neither succeeded nor
    // failed on its own terms — its worker vanished. Leaving it RUNNING forever
    // would corrupt every attempt-duration and failure-rate metric.
    if (reclaimedRow.current_attempt_id) {
      await client.query(
        `UPDATE ${ATTEMPT_TABLE}
            SET status = 'TIMED_OUT', ended_at = ?, error_code = 'NODE_RUN_LEASE_EXPIRED'
          WHERE attempt_id = ? AND status = 'RUNNING'`,
        [now, reclaimedRow.current_attempt_id]
      );
    }

    await publishEvent(client, {
      eventType: 'node.lease_reclaimed',
      ...nodeRunEventIdentity(reclaimedRow),
      attemptId: reclaimedRow.current_attempt_id,
      actorUserId: SYSTEM_ACTOR_SCHEDULER,
      redactedSummary: redact({
        leaseFencingCounter: Number(reclaimedRow.lease_fencing_token),
        leaseMs,
        attempt: Number(reclaimedRow.attempt),
        reconciliation: verdict?.detail ?? {},
      }),
    });

    return {
      outcome: 'reclaimed' as const,
      nodeRun: mapRow(reclaimedRow),
      leaseOwner,
      fencingToken: Number(reclaimedRow.lease_fencing_token),
    };
  });
}

// ---------------------------------------------------------------------------
// Attempts — §3.4 "A retry creates an auditable attempt"
// ---------------------------------------------------------------------------

/**
 * §3.4. Open a new attempt: CLAIMED -> RUNNING, `attempt + 1`, one new row in
 * the attempt ledger, and a deadline stamped on the node.
 *
 * CAS-guarded on (lease_owner, lease_fencing_token): only the current lease
 * holder may start an attempt. A zombie worker whose lease was reclaimed is
 * rejected with `node_run_lease_fenced` instead of quietly starting a second,
 * parallel execution of the same node.
 *
 * The retry budget is checked BEFORE the attempt row exists, so exhausting it
 * is a refusal (`node_run_attempts_exhausted`), not an orphaned attempt.
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED.
 */
export async function startNodeRunAttempt(
  nodeRunId: string,
  input: StartNodeRunAttemptInput,
  expectedVersion: number
): Promise<{ nodeRun: NodeRun; attempt: NodeRunAttempt }> {
  const id = requireNonBlank(nodeRunId, 'node_run_id_required');
  const leaseOwner = requireNonBlank(input.leaseOwner, 'node_run_lease_owner_required');
  if (typeof input.fencingToken !== 'number') throw new Error('node_run_fencing_token_required');
  if (typeof expectedVersion !== 'number') throw new Error('node_run_expected_version_required');
  const timeoutMs = requirePositiveInt(
    input.timeoutMs,
    DEFAULT_ATTEMPT_TIMEOUT_MS,
    'node_run_timeout_ms_invalid'
  );

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    assertTransitionAllowed(row.status, 'RUNNING');
    if (row.lease_owner !== leaseOwner || Number(row.lease_fencing_token) !== input.fencingToken) {
      throw new Error('node_run_lease_fenced');
    }
    const nextAttemptNumber = Number(row.attempt) + 1;
    if (nextAttemptNumber > Number(row.max_attempts)) {
      throw new Error('node_run_attempts_exhausted');
    }

    const now = new Date().toISOString();
    const attemptId = `cwattempt-${uuidv4()}`;

    const attemptInserted = await client.query<NodeRunAttemptRow>(
      `INSERT INTO ${ATTEMPT_TABLE} (
         attempt_id, node_run_id, attempt_number, organization_id, case_id, run_id,
         status, lease_owner, capability_registry_id, timeout_at, started_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'RUNNING', ?, ?, (NOW() + (? || ' milliseconds')::interval)::text, ?, ?)
       RETURNING *`,
      [
        attemptId,
        id,
        nextAttemptNumber,
        row.organization_id,
        row.case_id,
        row.run_id,
        leaseOwner,
        optionalTrimmed(input.capabilityRegistryId),
        String(timeoutMs),
        now,
        now,
      ]
    );
    const attemptRow = attemptInserted.rows[0];
    if (!attemptRow) throw new Error('node_run_attempt_insert_failed');

    const updated = await client.query<NodeRunRow>(
      `UPDATE ${NODE_RUN_TABLE}
          SET status = 'RUNNING',
              attempt = ?,
              current_attempt_id = ?,
              timeout_at = ?,
              retry_not_before = NULL,
              started_at = COALESCE(started_at, ?),
              version = version + 1,
              updated_at = ?
        WHERE node_run_id = ? AND version = ?
        RETURNING *`,
      [nextAttemptNumber, attemptId, attemptRow.timeout_at, now, now, id, expectedVersion]
    );
    const updatedRow = updated.rows[0];
    // Rolls back the attempt INSERT above with it — same transaction, which is
    // why the attempt is never written without its node-side counterpart.
    if (!updatedRow) throw new Error('node_run_version_conflict');

    await publishEvent(client, {
      eventType: 'node.attempt_started',
      ...nodeRunEventIdentity(updatedRow),
      attemptId,
      actorUserId: SYSTEM_ACTOR_WORKER,
      redactedSummary: redact({
        attemptNumber: nextAttemptNumber,
        maxAttempts: Number(updatedRow.max_attempts),
        timeoutMs,
        capabilityRegistryId: optionalTrimmed(input.capabilityRegistryId),
      }),
    });

    return { nodeRun: mapRow(updatedRow), attempt: mapAttemptRow(attemptRow) };
  });
}

/**
 * §3.4/§4.5. Close the in-flight attempt and move the node accordingly:
 *   SUCCEEDED        -> node SUCCEEDED (terminal; lease and deadline cleared)
 *   FAILED_RETRYABLE -> node FAILED_RETRYABLE, then immediately
 *                       RETRY_SCHEDULED with a backoff floor IF budget
 *                       remains; otherwise the failure is promoted to
 *                       FAILED_TERMINAL, because a retryable failure with no
 *                       retries left is terminal in fact and pretending
 *                       otherwise strands the node forever.
 *   FAILED_TERMINAL  -> node FAILED_TERMINAL.
 *
 * CAS-guarded on the lease AND OCC-guarded on version, and the attempt id must
 * be the node's current attempt — a late completion from a superseded attempt
 * is rejected (`node_run_attempt_not_current`) rather than overwriting the
 * result of the attempt that replaced it.
 *
 * Exactly ONE event per call (`node.attempt_completed`), even though the
 * retryable path performs two logical steps: the taxonomy's "one command = one
 * event" rule, and a second event here would double-count failures in every
 * reliability metric.
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED.
 */
export async function completeNodeRunAttempt(
  nodeRunId: string,
  input: CompleteNodeRunAttemptInput,
  expectedVersion: number
): Promise<{ nodeRun: NodeRun; attempt: NodeRunAttempt }> {
  const id = requireNonBlank(nodeRunId, 'node_run_id_required');
  const attemptId = requireNonBlank(input.attemptId, 'node_run_attempt_id_required');
  const leaseOwner = requireNonBlank(input.leaseOwner, 'node_run_lease_owner_required');
  if (typeof input.fencingToken !== 'number') throw new Error('node_run_fencing_token_required');
  if (typeof expectedVersion !== 'number') throw new Error('node_run_expected_version_required');
  if (!['SUCCEEDED', 'FAILED_RETRYABLE', 'FAILED_TERMINAL'].includes(input.outcome)) {
    throw new Error('node_run_attempt_outcome_invalid');
  }
  const retryDelayMs = requirePositiveInt(input.retryDelayMs, 0, 'node_run_retry_delay_invalid');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    if (row.status !== 'RUNNING') {
      throw new Error(`node_run_status_transition_not_allowed:${row.status}->${input.outcome}`);
    }
    if (row.lease_owner !== leaseOwner || Number(row.lease_fencing_token) !== input.fencingToken) {
      throw new Error('node_run_lease_fenced');
    }
    if (row.current_attempt_id !== attemptId) throw new Error('node_run_attempt_not_current');

    const budgetRemains = Number(row.attempt) < Number(row.max_attempts);
    // A retryable failure with no budget left IS terminal. Recording it as
    // retryable would leave the node parked in a state nothing will ever pick
    // up, which reads as "still working" in every projection.
    const nodeStatus: NodeRunStatus =
      input.outcome === 'SUCCEEDED'
        ? 'SUCCEEDED'
        : input.outcome === 'FAILED_TERMINAL'
          ? 'FAILED_TERMINAL'
          : budgetRemains
            ? 'RETRY_SCHEDULED'
            : 'FAILED_TERMINAL';
    const terminal = nodeStatus === 'SUCCEEDED' || nodeStatus === 'FAILED_TERMINAL';

    const now = new Date().toISOString();
    const errorCode = normalizeErrorCode(input.errorCode);
    const errorDetailRef = toDetailRef(input.errorDetailRef);

    const attemptUpdated = await client.query<NodeRunAttemptRow>(
      `UPDATE ${ATTEMPT_TABLE}
          SET status = ?, ended_at = ?, error_code = ?, error_detail_ref = ?,
              output_snapshot_ref = ?
        WHERE attempt_id = ? AND node_run_id = ? AND status = 'RUNNING'
        RETURNING *`,
      [
        input.outcome,
        now,
        errorCode,
        errorDetailRef,
        optionalTrimmed(input.outputSnapshotRef),
        attemptId,
        id,
      ]
    );
    const attemptRow = attemptUpdated.rows[0];
    if (!attemptRow) throw new Error('node_run_attempt_not_running');

    const retryNotBefore =
      nodeStatus === 'RETRY_SCHEDULED'
        ? new Date(Date.now() + (retryDelayMs || 0)).toISOString()
        : null;

    const updated = await client.query<NodeRunRow>(
      `UPDATE ${NODE_RUN_TABLE}
          SET status = ?,
              output_snapshot_ref = COALESCE(?, output_snapshot_ref),
              error_code = ?,
              error_detail_ref = ?,
              retry_not_before = ?,
              completed_at = CASE WHEN ? THEN ? ELSE completed_at END,
              lease_owner = NULL,
              lease_expires_at = NULL,
              timeout_at = NULL,
              current_attempt_id = ?,
              version = version + 1,
              updated_at = ?
        WHERE node_run_id = ? AND version = ?
        RETURNING *`,
      [
        nodeStatus,
        optionalTrimmed(input.outputSnapshotRef),
        errorCode,
        errorDetailRef,
        retryNotBefore,
        terminal,
        now,
        attemptId,
        now,
        id,
        expectedVersion,
      ]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error('node_run_version_conflict');

    await publishEvent(client, {
      eventType: 'node.attempt_completed',
      ...nodeRunEventIdentity(updatedRow),
      attemptId,
      actorUserId: SYSTEM_ACTOR_WORKER,
      redactedSummary: redact({
        attemptNumber: Number(attemptRow.attempt_number),
        attemptOutcome: input.outcome,
        nodeStatus,
        retriesRemaining: Math.max(0, Number(updatedRow.max_attempts) - Number(updatedRow.attempt)),
        errorCode,
        retryNotBefore,
      }),
    });

    return { nodeRun: mapRow(updatedRow), attempt: mapAttemptRow(attemptRow) };
  });
}

/**
 * §4.5 timeout path. The SWEEPER's entry point: no lease CAS, because the whole
 * point is that the lease holder is unresponsive and cannot be asked to
 * cooperate. Guarded instead by the deadline itself
 * (`timeout_at::timestamptz <= NOW()`, Postgres' clock), so a sweeper with a
 * fast clock cannot kill a healthy attempt.
 *
 * Marks the attempt TIMED_OUT (a distinct fact from FAILED — the work may well
 * still be running somewhere), then applies the same budget rule as
 * completeNodeRunAttempt: retry if budget remains, otherwise FAILED_TERMINAL.
 *
 * Sets compensation_state = 'REQUIRED' when the timed-out attempt ends the node
 * terminally: a timeout means we do NOT know whether the external effect
 * landed, and §4.5 forbids pretending otherwise. Flagging it as REQUIRED is
 * what puts it in front of a human or a compensator instead of leaving a
 * possible orphaned side effect unrecorded.
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED.
 */
export async function timeoutNodeRunAttempt(
  nodeRunId: string,
  options: { retryDelayMs?: number } = {}
): Promise<{ nodeRun: NodeRun; attempt: NodeRunAttempt | null } | { outcome: 'not_timed_out' }> {
  const id = requireNonBlank(nodeRunId, 'node_run_id_required');
  const retryDelayMs = requirePositiveInt(options.retryDelayMs, 0, 'node_run_retry_delay_invalid');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    if (row.status !== 'RUNNING' && row.status !== 'CLAIMED') {
      return { outcome: 'not_timed_out' as const };
    }
    if (!row.timeout_at) return { outcome: 'not_timed_out' as const };

    const dueResult = await client.query<{ due: boolean }>(
      `SELECT (?::timestamptz <= NOW()) AS due`,
      [row.timeout_at]
    );
    if (!dueResult.rows[0]?.due) return { outcome: 'not_timed_out' as const };

    const now = new Date().toISOString();
    const budgetRemains = Number(row.attempt) < Number(row.max_attempts);
    const nodeStatus: NodeRunStatus = budgetRemains ? 'RETRY_SCHEDULED' : 'FAILED_TERMINAL';
    const terminal = nodeStatus === 'FAILED_TERMINAL';

    let attemptRow: NodeRunAttemptRow | null = null;
    if (row.current_attempt_id) {
      const attemptUpdated = await client.query<NodeRunAttemptRow>(
        `UPDATE ${ATTEMPT_TABLE}
            SET status = 'TIMED_OUT', ended_at = ?, error_code = 'NODE_RUN_ATTEMPT_TIMEOUT'
          WHERE attempt_id = ? AND status = 'RUNNING'
          RETURNING *`,
        [now, row.current_attempt_id]
      );
      attemptRow = attemptUpdated.rows[0] ?? null;
    }

    const updated = await client.query<NodeRunRow>(
      `UPDATE ${NODE_RUN_TABLE}
          SET status = ?,
              error_code = 'NODE_RUN_ATTEMPT_TIMEOUT',
              retry_not_before = ?,
              completed_at = CASE WHEN ? THEN ? ELSE completed_at END,
              lease_owner = NULL,
              lease_expires_at = NULL,
              timeout_at = NULL,
              compensation_state = CASE
                WHEN ? AND compensation_state = 'NOT_REQUIRED' THEN 'REQUIRED'
                ELSE compensation_state END,
              version = version + 1,
              updated_at = ?
        WHERE node_run_id = ? AND version = ?
        RETURNING *`,
      [
        nodeStatus,
        nodeStatus === 'RETRY_SCHEDULED'
          ? new Date(Date.now() + (retryDelayMs || 0)).toISOString()
          : null,
        terminal,
        now,
        terminal,
        now,
        id,
        Number(row.version),
      ]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error('node_run_version_conflict');

    await publishEvent(client, {
      eventType: 'node.attempt_timed_out',
      ...nodeRunEventIdentity(updatedRow),
      attemptId: row.current_attempt_id,
      actorUserId: SYSTEM_ACTOR_SCHEDULER,
      redactedSummary: redact({
        attempt: Number(updatedRow.attempt),
        nodeStatus,
        compensationState: updatedRow.compensation_state,
        retriesRemaining: Math.max(0, Number(updatedRow.max_attempts) - Number(updatedRow.attempt)),
      }),
    });

    return { nodeRun: mapRow(updatedRow), attempt: attemptRow ? mapAttemptRow(attemptRow) : null };
  });
}

/**
 * The compensation axis, kept deliberately off §4.5's status enum (see the
 * migration's compensation_state comment). OCC-guarded like every other
 * mutation here.
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED.
 */
export async function recordNodeRunCompensation(
  nodeRunId: string,
  compensationState: NodeRunCompensationState,
  expectedVersion: number,
  options: { compensationRef?: string | null; actorUserId?: string } = {}
): Promise<NodeRun> {
  const id = requireNonBlank(nodeRunId, 'node_run_id_required');
  if (!COMPENSATION_STATES.includes(compensationState)) {
    throw new Error('node_run_compensation_state_invalid');
  }
  if (typeof expectedVersion !== 'number') throw new Error('node_run_expected_version_required');

  return withPgTransaction(async (client) => {
    await loadForUpdate(client, id);
    const now = new Date().toISOString();
    const updated = await client.query<NodeRunRow>(
      `UPDATE ${NODE_RUN_TABLE}
          SET compensation_state = ?,
              compensation_ref = COALESCE(?, compensation_ref),
              version = version + 1,
              updated_at = ?
        WHERE node_run_id = ? AND version = ?
        RETURNING *`,
      [compensationState, optionalTrimmed(options.compensationRef), now, id, expectedVersion]
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error('node_run_version_conflict');

    await publishEvent(client, {
      eventType: 'node.compensation_recorded',
      ...nodeRunEventIdentity(updatedRow),
      attemptId: updatedRow.current_attempt_id,
      actorUserId: optionalTrimmed(options.actorUserId) ?? SYSTEM_ACTOR_SCHEDULER,
      redactedSummary: redact({
        compensationState,
        nodeStatus: updatedRow.status,
      }),
    });
    return mapRow(updatedRow);
  });
}

// ---------------------------------------------------------------------------
// Read-only queries — nothing below this line mutates anything
// ---------------------------------------------------------------------------

export async function getNodeRun(nodeRunId: string, actorUserId: string): Promise<NodeRun | null> {
  const id = requireNonBlank(nodeRunId, 'node_run_id_required');
  const actor = requireNonBlank(actorUserId, 'node_run_actor_required');
  const row = await queryOne<NodeRunRow>(
    `SELECT * FROM ${NODE_RUN_TABLE} WHERE node_run_id = ?`,
    [id]
  );
  if (!row) return null;
  await requireCaseAccess(actor, row.case_id);
  return mapRow(row);
}

export async function listNodeRunsForRun(runId: string, actorUserId: string): Promise<NodeRun[]> {
  const id = requireNonBlank(runId, 'node_run_run_id_required');
  const actor = requireNonBlank(actorUserId, 'node_run_actor_required');
  const rows = await queryAll<NodeRunRow>(
    `SELECT * FROM ${NODE_RUN_TABLE} WHERE run_id = ? ORDER BY created_at ASC`,
    [id]
  );
  if (rows.length === 0) return [];
  await requireCaseAccess(actor, rows[0].case_id);
  return rows.map(mapRow);
}

export async function listAttemptsForNodeRun(
  nodeRunId: string,
  actorUserId: string
): Promise<NodeRunAttempt[]> {
  const id = requireNonBlank(nodeRunId, 'node_run_id_required');
  const actor = requireNonBlank(actorUserId, 'node_run_actor_required');
  const rows = await queryAll<NodeRunAttemptRow>(
    `SELECT * FROM ${ATTEMPT_TABLE} WHERE node_run_id = ? ORDER BY attempt_number ASC`,
    [id]
  );
  if (rows.length === 0) return [];
  await requireCaseAccess(actor, rows[0].case_id);
  return rows.map(mapAttemptRow);
}

/**
 * Run-lifecycle orchestration primitive (Stream A, runLifecycleService.ts).
 *
 * `node_id` is NOT unique per Run: §5's `RetryNode` command and this
 * service's own idempotency model (createNodeRun keys on (run_id,
 * idempotency_key), not on (run_id, node_id)) both mean a node may have
 * MULTIPLE NodeRun rows over its lifetime — one per explicit retry attempt at
 * the business effect, each an honest, separate audit row (§3.4: "A retry
 * creates an auditable attempt"). Graph advancement and RetryNode both need
 * "what is this node's CURRENT state right now", which is the most recently
 * created row, never an aggregate/merge across them. Read-only; returns null
 * when the node has never had a NodeRun at all.
 */
export async function getLatestNodeRunForNode(
  runId: string,
  nodeId: string,
  actorUserId: string
): Promise<NodeRun | null> {
  const id = requireNonBlank(runId, 'node_run_run_id_required');
  const node = requireNonBlank(nodeId, 'node_run_node_id_required');
  const actor = requireNonBlank(actorUserId, 'node_run_actor_required');
  const row = await queryOne<NodeRunRow>(
    `SELECT * FROM ${NODE_RUN_TABLE} WHERE run_id = ? AND node_id = ?
       ORDER BY created_at DESC, node_run_id DESC LIMIT 1`,
    [id, node]
  );
  if (!row) return null;
  await requireCaseAccess(actor, row.case_id);
  return mapRow(row);
}

/**
 * Idempotency-key lookup: the row (if any) already minted under
 * (run_id, idempotency_key) — `createNodeRun`'s own idempotency identity
 * (§3.4: "Idempotency identity is stable for the intended business effect"),
 * exposed here read-only for a caller that must decide "was this exact
 * command already applied?" WITHOUT attempting a write first. Read-only;
 * returns null when no NodeRun was ever minted under this exact key.
 *
 * Exists for runLifecycleService.retryNode's own idempotent-replay path: a
 * caller-supplied idempotencyKey is meaningless as a safety net if the
 * command re-derives its precondition from `getLatestNodeRunForNode`
 * (§4.5's "current state" reader) instead — by the time a replay runs, the
 * FIRST call's own effect IS the latest NodeRun, so re-checking against
 * "latest" wrongly refuses the replay as "not retryable" rather than
 * recognizing it as the same command already having landed.
 */
export async function getNodeRunByIdempotencyKey(
  runId: string,
  idempotencyKey: string,
  actorUserId: string
): Promise<NodeRun | null> {
  const id = requireNonBlank(runId, 'node_run_run_id_required');
  const key = requireNonBlank(idempotencyKey, 'node_run_idempotency_key_required');
  const actor = requireNonBlank(actorUserId, 'node_run_actor_required');
  const row = await queryOne<NodeRunRow>(
    `SELECT * FROM ${NODE_RUN_TABLE} WHERE run_id = ? AND idempotency_key = ?`,
    [id, key]
  );
  if (!row) return null;
  await requireCaseAccess(actor, row.case_id);
  return mapRow(row);
}

/**
 * Scheduler candidate scan. "Report, don't decide" — it never claims anything;
 * the caller follows up with individually-atomic claimNodeRun() calls.
 * INTERNAL-ONLY: cross-case, cross-org by design.
 */
export async function listClaimableNodeRuns(
  now: Date = new Date(),
  limit: number = 50
): Promise<NodeRun[]> {
  const nowIso = now.toISOString();
  const rows = await queryAll<NodeRunRow>(
    `SELECT * FROM ${NODE_RUN_TABLE}
       WHERE (
              status = 'READY'
           OR (status = 'RETRY_SCHEDULED'
               AND (retry_not_before IS NULL OR retry_not_before::timestamptz <= ?::timestamptz))
             )
         AND (lease_owner IS NULL OR lease_expires_at::timestamptz < ?::timestamptz)
       ORDER BY created_at ASC
       LIMIT ?`,
    [nowIso, nowIso, limit]
  );
  return rows.map(mapRow);
}

/** Timeout sweeper candidates. INTERNAL-ONLY. */
export async function listTimedOutNodeRuns(
  now: Date = new Date(),
  limit: number = 50
): Promise<NodeRun[]> {
  const nowIso = now.toISOString();
  const rows = await queryAll<NodeRunRow>(
    `SELECT * FROM ${NODE_RUN_TABLE}
       WHERE status IN ('CLAIMED', 'RUNNING')
         AND timeout_at IS NOT NULL
         AND timeout_at::timestamptz <= ?::timestamptz
       ORDER BY timeout_at ASC
       LIMIT ?`,
    [nowIso, limit]
  );
  return rows.map(mapRow);
}

/** Expired-lease recovery candidates (feed into reclaimExpiredNodeRunLease). INTERNAL-ONLY. */
export async function listExpiredLeaseNodeRuns(
  now: Date = new Date(),
  limit: number = 50
): Promise<NodeRun[]> {
  const nowIso = now.toISOString();
  const rows = await queryAll<NodeRunRow>(
    `SELECT * FROM ${NODE_RUN_TABLE}
       WHERE status IN ('CLAIMED', 'RUNNING')
         AND lease_owner IS NOT NULL
         AND lease_expires_at IS NOT NULL
         AND lease_expires_at::timestamptz < ?::timestamptz
       ORDER BY lease_expires_at ASC
       LIMIT ?`,
    [nowIso, limit]
  );
  return rows.map(mapRow);
}

/**
 * The honest measurement of the gap this packet could not close in one step:
 * every row in the four already-shipped tables whose `node_run_id` names a
 * NodeRun that does not exist. Read-only — it REPORTS, it never repairs, and
 * it never creates a placeholder NodeRun (that would turn a data-quality
 * signal into fabricated history).
 *
 * This is the input for the future backfill-then-constrain migration described
 * in the migration header; until that lands, this function is how anyone can
 * see the real size of the problem instead of assuming it is zero.
 */
export async function listOrphanNodeRunReferences(
  options: { organizationId?: string; limit?: number } = {}
): Promise<Array<{ tableName: string; rowCount: number }>> {
  const organizationId = optionalTrimmed(options.organizationId);
  const results: Array<{ tableName: string; rowCount: number }> = [];
  for (const tableName of LOOSE_NODE_RUN_REFERENCE_TABLES) {
    // tableName is from a module-private const tuple, never from input.
    const rows = await queryAll<{ orphan_count: string | number }>(
      `SELECT count(*)::int AS orphan_count
         FROM ${tableName} t
        WHERE t.node_run_id IS NOT NULL
          AND (?::text IS NULL OR t.organization_id = ?)
          AND NOT EXISTS (
            SELECT 1 FROM ${NODE_RUN_TABLE} n WHERE n.node_run_id = t.node_run_id
          )`,
      [organizationId, organizationId]
    );
    results.push({ tableName, rowCount: Number(rows[0]?.orphan_count ?? 0) });
  }
  return results;
}
