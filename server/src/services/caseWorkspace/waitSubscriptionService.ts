/**
 * Case Workspace — Wait Subscription service (CW-P06, EPIC E5 "Durable
 * waits and events").
 *
 * Backs the `case_workspace_waits` table added in
 * server/migrations/20260809_case_workspace_wait_subscription.sql. Per the
 * packet's collision-avoidance mandate (docs/product/case-workspace/
 * acceptance/CODEBASE_CONVERGENCE_MAP.csv, area=migrations-flags-outbox),
 * this service only ever SELECTs `case_core` (CW-P01), `case_workspace_run_
 * bindings` (CW-P04) and `case_workspace_action_proposals` (CW-P05) — it
 * never INSERT/UPDATE/DELETEs any of them, and never references Finance or
 * Results.
 *
 * `server/src/services/lineage/operationClaimService.ts`
 * (`artifact_lineage_operation_claims`, MAT-010) is a READ-ONLY PATTERN
 * REFERENCE, never a shared table: this service reuses that file's exact
 * atomic-claiming SQL idiom (owner_token + monotonic fencing_token +
 * Postgres-clock lease_expires_at, single conditional UPDATE, CAS finalize)
 * on this packet's OWN three lease columns
 * (claim_owner_token/claim_fencing_token/claim_lease_expires_at), collapsed
 * into one statement per claim attempt since a wait row always pre-exists
 * from createWait() (no fresh-INSERT-vs-reclaim split is needed, unlike
 * operationClaimService's own two-phase acquire). This file imports nothing
 * from operationClaimService.ts and never references
 * artifact_lineage_operation_claims/artifact_lineage_events anywhere.
 *
 * Scope for THIS packet: WaitSubscription persistence + create/claim/
 * resolve/cancel service for HUMAN and TIMER wait types only (the two this
 * packet can fully implement without new infrastructure). DOMAIN_EVENT and
 * EXTERNAL_CALLBACK are valid `wait_type` enum values with a resolve() path
 * only — their real subscription/authentication/dedupe mechanics need a
 * future event-bus/inbox packet (CW-CANON-12), not built here.
 *
 * req_id coverage (docs/product/case-workspace/acceptance/
 * FUNCTIONAL_REQUIREMENT_COVERAGE.csv, filter epics contains "E5" AND
 * row_id starts with "CW-"; the AEV8-* rows also tagged E5 describe the
 * pre-existing V8 authority contract, not new work for this packet):
 *
 *   createWait                  -> CW-RT-020, CW-RT-021, CW-00-020-INV10, CW-RT-043, CW-RT-060
 *   claimTimerWait               -> CW-RT-021, CW-00-020-INV10, CW-RT-052, CW-CANON-11
 *   renewTimerWaitClaimLease     -> CW-RT-021, CW-RT-052, CW-CANON-11, CW-DOD-C5
 *   resolveWait                  -> CW-RT-020, CW-RT-021, CW-RT-043, CW-CANON-11, CW-01-026-INV8
 *   provideHumanInput            -> CW-RT-043, CW-01-026-INV8, CW-02-029
 *   expireWait                   -> CW-RT-043, CW-RT-052, CW-RT-062, CW-DOD-C5
 *   cancelWait                   -> CW-02-029, CW-RT-052
 *   getWait                      -> CW-RT-020, CW-DOD-B5
 *   listWaitsForRun              -> CW-GR-026, CW-02-029
 *   listWaitsForCase             -> CW-DOD-B5, CW-DOD-B8
 *   listDueTimerWaitsForClaim    -> CW-RT-021, CW-DOD-I6
 *   computeWaitOverdueState      -> CW-02-029, CW-DOD-E6, CW-03-015
 *
 * Cross-cutting invariants held by this service (see the migration file's
 * header for the exact canon citations):
 *   - no approved_by/decided_by-shaped column exists on case_workspace_waits
 *     anywhere — CW-RT-021's "timer waits do not reuse approval state and do
 *     not write approved_by=system:scheduler" is structurally impossible,
 *     not merely policed at runtime;
 *   - TIMER claiming reuses operationClaimService.ts's atomic WHERE-guard
 *     idiom verbatim (owner_token + monotonic fencing_token + Postgres-clock
 *     lease_expires_at comparisons), collapsed into a single conditional
 *     UPDATE per claim attempt;
 *   - resolveWait()'s CAS on (claim_owner_token, claim_fencing_token) for
 *     TIMER waits, evaluated under a FOR UPDATE row lock, ensures a claim
 *     already lost to a reclaim can never finalize — mirrors
 *     finalizeOperationClaim()'s 'fenced' outcome;
 *   - createWait() is idempotent via UNIQUE(case_id, correlation_key) +
 *     `INSERT ... ON CONFLICT DO NOTHING` + a wait_type compare-fallback on
 *     replay — fails closed (wait_correlation_key_conflict) on a mismatched
 *     replay, matching the recordIdempotencyKeyCheck convention used
 *     throughout CW-P01-05;
 *   - status only moves per ALLOWED_TRANSITIONS = { ACTIVE: [SATISFIED,
 *     EXPIRED, CANCELLED] }; SATISFIED/EXPIRED/CANCELLED are all terminal —
 *     no method anywhere transitions out of them;
 *   - every mutating method except createWait()'s initial INSERT uses
 *     loadForUpdate + `WHERE ... AND version = expectedVersion`; a 0-row
 *     UPDATE throws a *_version_conflict error with no partial write,
 *     matching every prior CW-P01-05 service exactly;
 *   - this service only ever SELECTs case_core, case_workspace_run_bindings
 *     and case_workspace_action_proposals — it never INSERT/UPDATE/DELETEs
 *     any of the three, and never references Finance or Results;
 *   - artifact_lineage_operation_claims (operationClaimService's own table)
 *     is never read or written by this service — the claiming pattern is
 *     reused by SQL idiom only, per the packet's explicit "read-only pattern
 *     reference, not a shared table" mandate;
 *   - DOMAIN_EVENT and EXTERNAL_CALLBACK are valid wait_type enum members
 *     with a resolve() path only; no subscription/authentication/dedupe
 *     mechanics are built for them here (deferred to a future event-bus/
 *     inbox packet, per CW-CANON-12);
 *   - resume_token_hash is caller-pre-hashed; this service never receives,
 *     computes, or stores a raw resume token — same CW-DOD-C3 posture as
 *     payload_digest on case_workspace_action_proposals.
 *
 * OPEN QUESTIONS (flagged in the approved design, carried forward here — not
 * resolved by this packet, product/API-owner confirmation needed):
 *   1. node_run_id nullability tension: CW-RT-020 lists nodeRunId as a
 *      literal required field, but this packet's own mandate makes run_id
 *      optional ("a wait could exist before a Run is bound") — a NodeRun
 *      cannot logically exist before its owning Run. This design makes
 *      node_run_id nullable to match, deviating from the literal schema;
 *      confirm with product whether a pre-Run wait should carry a
 *      placeholder nodeRunId or is legitimately node_run_id-less.
 *   2. action_proposal_id is not part of CW-RT-020's literal WaitSubscription
 *      schema at all — it is an addition made per this packet's task
 *      instructions. Confirm this optional FK is the intended mechanism for
 *      "a wait gating a specific ActionProposal" rather than some other
 *      planned linkage.
 *   3. claim_owner_token/claim_fencing_token/claim_lease_expires_at are
 *      packet-added columns beyond CW-RT-020's literal schema, needed to
 *      technically satisfy CW-RT-021's "leases and atomic claiming". They
 *      mirror NodeRun's own literal leaseOwner?/leaseExpiresAt?/
 *      heartbeatAt? fields (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:117)
 *      rather than WaitSubscription's. Confirm whether lease state belongs
 *      on WaitSubscription itself (this design's choice) or should live only
 *      on NodeRun with WaitSubscription staying purely declarative.
 *   4. claimTimerWait() deliberately omits
 *      operationClaimService.acquireOrReclaimOperationClaim's bounded-wait
 *      polling (default 8s) for the "genuinely concurrent" case, since a
 *      caller here is envisioned as a scheduler sweep
 *      (listDueTimerWaitsForClaim -> claimTimerWait per candidate), not an
 *      HTTP request racing a fast in-flight duplicate. Confirm this
 *      assumption; if two scheduler replicas can legitimately race the same
 *      due wait within one tick and must wait out a winner rather than skip
 *      it, the polling behavior would need to be added.
 *   5. correlation_key serves double duty: CW-RT-020's literal
 *      domain-correlation field for matching inbound events/callbacks, AND
 *      (in this design) the idempotent-create key, since WaitSubscription
 *      has no separate idempotencyKey field (unlike ActionProposal). Confirm
 *      this overload is intended or whether a future revision needs a
 *      distinct idempotency_key column — same naming-collision pattern
 *      CW-P02/CW-P03/CW-P05 already flagged repeatedly for other fields.
 *   6. wait_target_required (at least one of run_id/action_proposal_id set)
 *      is enforced here as a service-level check per the task brief, but is
 *      not stated as a literal rule anywhere in the E5 rows of
 *      FUNCTIONAL_REQUIREMENT_COVERAGE.csv. Confirm whether a Wait with
 *      neither set (e.g. a purely Case-level HUMAN wait unrelated to any Run
 *      or Proposal) is a legitimate state this check would wrongly reject.
 *   7. expireWait()'s and the TIMER-claim sweep's actual trigger points (a
 *      cron/worker loop calling listDueTimerWaitsForClaim -> claimTimerWait
 *      -> resolveWait/expireWait) are not built by this packet — only the
 *      durable primitives are. Same "orchestration trigger point is out of
 *      scope" carve-out as CW-P04 runBindingService.ts's own open_question
 *      #1.
 *   8. DOMAIN_EVENT/EXTERNAL_CALLBACK waits' real satisfaction path
 *      (authenticated inbound callback -> dedupe -> resolveWait) needs an
 *      event bus/inbox this packet does not build (CW-CANON-12 explicitly
 *      deferred). resolveWait() is callable for these two types today with
 *      no authentication or dedupe — a route built on top of this service
 *      must not expose it for these wait types without that missing layer,
 *      or CW-DOD-D6 ("forged/replayed callbacks fail closed") is violated.
 *   9. provideHumanInput()'s actorUserId is accepted but not persisted
 *      anywhere on case_workspace_waits (no decided_by-shaped column exists
 *      in CW-RT-020's literal WaitSubscription schema, unlike
 *      ApprovalDecision.decided_by_actor_id). Confirm whether HUMAN wait
 *      resolution needs its own append-only "who actually did it" audit row
 *      (a WaitResolution/WaitEvent table analogous to
 *      case_workspace_action_proposal_decisions) — not built by this design.
 *      cancelWait()'s `reason` has the same fate: validated non-blank,
 *      never persisted — same shape as proposalApprovalService.
 *      revokeApprovedProposal()'s own `reason` parameter.
 *  10. Tenant/membership fail-closed checks (CW-RT-065, CW-DOD-D5/D6) are,
 *      per the established convention across every CW-P01-05 service, not
 *      performed at this service layer — no method here takes an
 *      orgId/membership guard parameter. Flag loudly before any of these
 *      methods are wired into a route, same posture as every prior packet's
 *      own open_questions.
 */

import { createHash } from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';
import { CaseWorkspaceAuthError, requireCaseAccess } from './caseWorkspaceAuthContext.js';
import { publishEvent, redact } from './eventOutboxService.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CaseWaitType = 'HUMAN' | 'TIMER' | 'DOMAIN_EVENT' | 'EXTERNAL_CALLBACK';
export type CaseWaitStatus = 'ACTIVE' | 'SATISFIED' | 'EXPIRED' | 'CANCELLED';
export type WaitOverdueState = 'ON_TRACK' | 'OVERDUE' | 'NO_DEADLINE';

export interface CaseActor {
  actorUserId: string;
}

interface CaseWorkspaceWaitRow {
  wait_id: string;
  organization_id: string;
  project_id: string | null;
  case_id: string;
  run_id: string | null;
  node_run_id: string | null;
  action_proposal_id: string | null;
  wait_type: CaseWaitType;
  status: CaseWaitStatus;
  correlation_key: string;
  expected_event_type: string | null;
  predicate_ref: string | null;
  due_at: string | null;
  timeout_at: string | null;
  resume_token_hash: string | null;
  satisfied_at: string | null;
  satisfied_by_event_id: string | null;
  claim_owner_token: string | null;
  claim_fencing_token: number | string;
  claim_lease_expires_at: string | null;
  version: number | string;
  created_at: string;
  updated_at: string;
}

export interface CaseWait {
  waitId: string;
  organizationId: string;
  projectId: string | null;
  caseId: string;
  runId: string | null;
  nodeRunId: string | null;
  actionProposalId: string | null;
  waitType: CaseWaitType;
  status: CaseWaitStatus;
  correlationKey: string;
  expectedEventType: string | null;
  predicateRef: string | null;
  dueAt: string | null;
  timeoutAt: string | null;
  resumeTokenHash: string | null;
  satisfiedAt: string | null;
  satisfiedByEventId: string | null;
  claimOwnerToken: string | null;
  claimFencingToken: number;
  claimLeaseExpiresAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWaitInput {
  caseId: string;
  runId?: string | null;
  actionProposalId?: string | null;
  nodeRunId?: string | null;
  waitType: CaseWaitType;
  correlationKey: string;
  expectedEventType?: string | null;
  predicateRef?: string | null;
  dueAt?: string | null;
  timeoutAt?: string | null;
  resumeTokenHash?: string | null;
}

export type ClaimTimerWaitOutcome =
  | { outcome: 'claimed'; wait: CaseWait; ownerToken: string; fencingToken: number }
  | { outcome: 'active_elsewhere' }
  | { outcome: 'not_claimable' }
  | { outcome: 'not_found' };

export type RenewTimerWaitClaimLeaseOutcome = 'renewed' | 'fenced' | 'not_found';

export interface ResolveWaitInput {
  satisfiedByEventId: string;
  /** Required, and CAS-checked, when the target wait's wait_type is TIMER. */
  timerClaim?: { ownerToken: string; fencingToken: number };
}

export interface ProvideHumanInputInput {
  inputRef: string;
  /** Accepted for caller-side audit context only — NOT persisted anywhere
   * on case_workspace_waits (open_question #9). */
  actorUserId: string;
}

interface CaseCoreRefRow {
  case_id: string;
  organization_id: string;
  project_id: string | null;
}

interface RunBindingRefRow {
  run_id: string;
  case_id: string;
}

interface ActionProposalRefRow {
  action_proposal_id: string;
  case_id: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WAIT_TYPES: readonly CaseWaitType[] = ['HUMAN', 'TIMER', 'DOMAIN_EVENT', 'EXTERNAL_CALLBACK'];
const WAIT_STATUSES: readonly CaseWaitStatus[] = ['ACTIVE', 'SATISFIED', 'EXPIRED', 'CANCELLED'];

// CW-RT-020/CW-RT-021's literal state graph: ACTIVE -> {SATISFIED, EXPIRED,
// CANCELLED}; all three are terminal. No method in this file transitions out
// of a terminal status.
const ALLOWED_TRANSITIONS: Record<CaseWaitStatus, readonly CaseWaitStatus[]> = {
  ACTIVE: ['SATISFIED', 'EXPIRED', 'CANCELLED'],
  SATISFIED: [],
  EXPIRED: [],
  CANCELLED: [],
};

// Same default as operationClaimService.ts's DEFAULT_CLAIM_LEASE_MS — long
// enough for a normal claim -> resolve/renew cycle, short enough that a
// crashed claimant's lease self-heals within one human-noticeable interval.
const DEFAULT_TIMER_CLAIM_LEASE_MS = 30_000;

// ---------------------------------------------------------------------------
// Local helpers (mirrors caseCoreService.ts/casePlanVersionService.ts/
// capabilityRegistryService.ts/runBindingService.ts/proposalApprovalService.
// ts's own local helpers — not imported from there, each service file in
// this directory keeps its own copy per that file's existing convention).
// ---------------------------------------------------------------------------

function requireNonBlank(value: string | null | undefined, reason: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

function requireEnum<T extends string>(
  value: T | null | undefined,
  allowed: readonly T[],
  reason: string
): T {
  if (!value || !allowed.includes(value)) throw new Error(reason);
  return value;
}

function mapRow(row: CaseWorkspaceWaitRow): CaseWait {
  return {
    waitId: row.wait_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    caseId: row.case_id,
    runId: row.run_id,
    nodeRunId: row.node_run_id,
    actionProposalId: row.action_proposal_id,
    waitType: row.wait_type,
    status: row.status,
    correlationKey: row.correlation_key,
    expectedEventType: row.expected_event_type,
    predicateRef: row.predicate_ref,
    dueAt: row.due_at,
    timeoutAt: row.timeout_at,
    resumeTokenHash: row.resume_token_hash,
    satisfiedAt: row.satisfied_at,
    satisfiedByEventId: row.satisfied_by_event_id,
    claimOwnerToken: row.claim_owner_token,
    claimFencingToken: Number(row.claim_fencing_token),
    claimLeaseExpiresAt: row.claim_lease_expires_at,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Domain events — docs/product/case-workspace/acceptance/EVENT_TAXONOMY.md,
// section "waitSubscriptionService — aggregate WAIT".
//
// Every publishEvent() below runs on the SAME withPgTransaction client as the
// mutation that produced it (§6 "Domain changes and outbox records commit
// atomically"). This matters most for resolveWait: §8 says "Wait satisfaction is
// atomic and unique", and the outbox row inside the status flip's own
// transaction is what makes that provable rather than asserted.
//
// Read-only members (getWait, listWaitsForRun, listWaitsForCase,
// listDueTimerWaitsForClaim, computeWaitOverdueState) emit nothing. A
// non-claiming outcome of claimTimerWait ('active_elsewhere'/'not_claimable'/
// 'not_found') and a non-renewing outcome of renewTimerWaitClaimLease
// ('fenced'/'not_found') also emit nothing — no row changed, so there is no fact.
// createWait's idempotent replay likewise emits nothing (§8 dedup: a retried
// command must not look like a second registration).
//
// SYSTEM ACTORS. §1 `actorUserId`: "`system:<worker>` for scheduler/worker
// emitters (e.g. `expireWait`)". claimTimerWait, renewTimerWaitClaimLease,
// expireWait and the bare resolveWait entry point have no human actor in their
// signatures at all (they are the INTERNAL-ONLY scheduler primitives documented
// in this file's header), so they emit under an explicit system token rather
// than an invented user id.
// ---------------------------------------------------------------------------

/** §6 aggregate discriminator for every event emitted by this service. */
const WAIT_AGGREGATE_TYPE = 'WAIT';

const SYSTEM_ACTOR_TIMER_CLAIMER = 'system:case-workspace-timer-claimer';
const SYSTEM_ACTOR_WAIT_RESOLVER = 'system:case-workspace-wait-resolver';
const SYSTEM_ACTOR_WAIT_SCHEDULER = 'system:case-workspace-wait-scheduler';

/**
 * §1 `eventId`: a deterministic id derived from the command's idempotency key is
 * what makes publishEvent's `ON CONFLICT DO NOTHING` a real deduplication.
 * createWait's idempotency key is (case_id, correlation_key) — open_question #5
 * flags that overload; the event id inherits it rather than inventing a second
 * one. Hashed so an opaque key of any length yields a bounded id and is not
 * echoed verbatim into a durable audit row.
 */
function deterministicEventId(kind: string, ...parts: string[]): string {
  const digest = createHash('sha256').update(parts.join(' ')).digest('hex').slice(0, 40);
  return `cwevt-${kind}-${digest}`;
}

/**
 * cancelWait's `reason` is free text and is not persisted on the table at all
 * (open_question #9) — it must not become durable by the back door of an event
 * summary either. Same posture as proposalApprovalService's own classifyReason.
 */
function classifyReason(reason: string): { reasonClass: string; reasonDigest: string } {
  const trimmed = String(reason ?? '').trim();
  return {
    reasonClass: /^[A-Za-z0-9_.:-]{1,120}$/.test(trimmed) ? trimmed : 'unclassified',
    reasonDigest: `sha256:${createHash('sha256').update(trimmed).digest('hex').slice(0, 32)}`,
  };
}

/**
 * §3 tenancy + §10 correlation chain, read from the row the command just wrote
 * (`RETURNING *`), never from input and never from a second SELECT — so
 * `aggregateVersion` is always the POST-mutation OCC counter. `attemptId` has no
 * column on this aggregate and is deliberately absent rather than invented.
 */
function waitEventIdentity(row: CaseWorkspaceWaitRow): {
  organizationId: string;
  projectId: string | null;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  caseId: string;
  runId: string | null;
  nodeRunId: string | null;
} {
  return {
    organizationId: row.organization_id,
    projectId: row.project_id,
    aggregateType: WAIT_AGGREGATE_TYPE,
    aggregateId: row.wait_id,
    aggregateVersion: Number(row.version),
    caseId: row.case_id,
    runId: row.run_id,
    nodeRunId: row.node_run_id,
  };
}

// ---------------------------------------------------------------------------
// Row loaders
// ---------------------------------------------------------------------------

async function loadForUpdate(
  client: PgTransactionClient,
  waitId: string
): Promise<CaseWorkspaceWaitRow> {
  const result = await client.query<CaseWorkspaceWaitRow>(
    `SELECT * FROM case_workspace_waits WHERE wait_id = ? FOR UPDATE`,
    [waitId]
  );
  const row = result.rows[0];
  if (!row) throw new Error('wait_not_found');
  return row;
}

// ---------------------------------------------------------------------------
// Pure, read-only helpers (no DB access)
// ---------------------------------------------------------------------------

/**
 * CW-02-029, CW-DOD-E6, CW-03-015. Pure, no DB access — mirrors
 * proposalApprovalService.computeProposalExpiryState()'s read-time-overlay
 * pattern. Returns OVERDUE once timeoutAt (falling back to dueAt) has passed
 * for a still-ACTIVE wait, without mutating status; NO_DEADLINE when neither
 * is set or the wait is already terminal. Feeds CW-02-029's SLA/deadline
 * display and CW-DOD-E6's "never look like infinite AI computation"
 * distinction without a stored transition.
 */
export function computeWaitOverdueState(
  wait: Pick<CaseWait, 'dueAt' | 'timeoutAt' | 'status'>,
  now: Date = new Date()
): WaitOverdueState {
  if (wait.status !== 'ACTIVE') return 'NO_DEADLINE';
  const deadline = wait.timeoutAt ?? wait.dueAt;
  if (!deadline) return 'NO_DEADLINE';
  const deadlineMs = Date.parse(deadline);
  if (Number.isNaN(deadlineMs)) return 'NO_DEADLINE';
  return deadlineMs <= now.getTime() ? 'OVERDUE' : 'ON_TRACK';
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * CW-RT-020 (WaitSubscription schema), CW-RT-021, CW-00-020-INV10,
 * CW-RT-043, CW-RT-060 (duplicate dispatch produces one effect).
 *
 * RegisterWait. Plain SELECT (no lock — no ordinal is derived here, unlike
 * createActionProposal's case_core FOR UPDATE) of case_core for
 * organization_id/project_id; throws wait_case_not_found if absent. If
 * runId is given, SELECTs case_workspace_run_bindings WHERE run_id=?,
 * throws wait_run_binding_not_found if absent or
 * wait_run_binding_case_mismatch if its case_id differs. If
 * actionProposalId is given, SELECTs case_workspace_action_proposals WHERE
 * action_proposal_id=?, throws wait_action_proposal_not_found /
 * wait_action_proposal_case_mismatch analogously. Throws
 * wait_target_required if both runId and actionProposalId are absent
 * (service-level only, not a DB CHECK — open_question #6). Idempotency via
 * `INSERT ... ON CONFLICT (case_id, correlation_key) DO NOTHING RETURNING
 * *`; on 0 rows, SELECTs the existing row by (case_id, correlation_key) and
 * compares wait_type — mismatch throws wait_correlation_key_conflict, else
 * returns the existing row unchanged (safe replay). Inserts with
 * status='ACTIVE', version=1, claim_fencing_token=0.
 */
export async function createWait(input: CreateWaitInput, actorUserId: string): Promise<CaseWait> {
  const caseId = requireNonBlank(input.caseId, 'wait_case_id_required');
  const correlationKey = requireNonBlank(input.correlationKey, 'wait_correlation_key_required');
  const waitType = requireEnum(input.waitType, WAIT_TYPES, 'wait_type_invalid');

  await requireCaseAccess(requireNonBlank(actorUserId, 'wait_actor_required'), caseId);

  return withPgTransaction(async (client) => {
    const caseResult = await client.query<CaseCoreRefRow>(
      `SELECT case_id, organization_id, project_id FROM case_core WHERE case_id = ?`,
      [caseId]
    );
    const caseRow = caseResult.rows[0];
    if (!caseRow) throw new Error('wait_case_not_found');

    let runId: string | null = null;
    if (input.runId) {
      const runResult = await client.query<RunBindingRefRow>(
        `SELECT run_id, case_id FROM case_workspace_run_bindings WHERE run_id = ?`,
        [input.runId]
      );
      const runRow = runResult.rows[0];
      if (!runRow) throw new Error('wait_run_binding_not_found');
      if (runRow.case_id !== caseId) throw new Error('wait_run_binding_case_mismatch');
      runId = runRow.run_id;
    }

    let actionProposalId: string | null = null;
    if (input.actionProposalId) {
      const proposalResult = await client.query<ActionProposalRefRow>(
        `SELECT action_proposal_id, case_id FROM case_workspace_action_proposals
          WHERE action_proposal_id = ?`,
        [input.actionProposalId]
      );
      const proposalRow = proposalResult.rows[0];
      if (!proposalRow) throw new Error('wait_action_proposal_not_found');
      if (proposalRow.case_id !== caseId) throw new Error('wait_action_proposal_case_mismatch');
      actionProposalId = proposalRow.action_proposal_id;
    }

    if (!runId && !actionProposalId) {
      throw new Error('wait_target_required');
    }

    const waitId = `cwwait-${uuidv4()}`;
    const now = new Date().toISOString();

    const inserted = await client.query<CaseWorkspaceWaitRow>(
      `INSERT INTO case_workspace_waits (
         wait_id, organization_id, project_id, case_id, run_id, node_run_id,
         action_proposal_id, wait_type, status, correlation_key,
         expected_event_type, predicate_ref, due_at, timeout_at,
         resume_token_hash, claim_fencing_token, version, created_at, updated_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, 0, 1, ?, ?
       )
       ON CONFLICT (case_id, correlation_key) DO NOTHING
       RETURNING *`,
      [
        waitId,
        caseRow.organization_id,
        caseRow.project_id,
        caseId,
        runId,
        input.nodeRunId ?? null,
        actionProposalId,
        waitType,
        correlationKey,
        input.expectedEventType ?? null,
        input.predicateRef ?? null,
        input.dueAt ?? null,
        input.timeoutAt ?? null,
        input.resumeTokenHash ?? null,
        now,
        now,
      ]
    );

    if (inserted.rows[0]) {
      // Taxonomy: `wait.registered`. Summary: wait_type + due time, per that row.
      // `predicateRef`/`resumeTokenHash` are deliberately NOT copied — the first
      // is a pointer the consumer can resolve itself, the second is
      // credential-shaped.
      await publishEvent(client, {
        eventId: deterministicEventId('waitregistered', caseId, correlationKey),
        eventType: 'wait.registered',
        ...waitEventIdentity(inserted.rows[0]),
        actorUserId,
        redactedSummary: redact({
          waitType,
          status: 'ACTIVE',
          correlationKey,
          expectedEventType: input.expectedEventType ?? null,
          dueAt: input.dueAt ?? null,
          timeoutAt: input.timeoutAt ?? null,
          actionProposalId,
        }),
        payloadRef: input.predicateRef ?? null,
      });
      return mapRow(inserted.rows[0]);
    }

    const existingResult = await client.query<CaseWorkspaceWaitRow>(
      `SELECT * FROM case_workspace_waits WHERE case_id = ? AND correlation_key = ?`,
      [caseId, correlationKey]
    );
    const existing = existingResult.rows[0];
    if (!existing) throw new Error('wait_idempotency_record_not_found');
    if (existing.wait_type !== waitType) {
      throw new Error('wait_correlation_key_conflict');
    }
    return mapRow(existing);
  });
}

/**
 * CW-RT-021, CW-00-020-INV10, CW-RT-052, CW-CANON-11.
 *
 * TIMER-only. One atomic UPDATE reusing operationClaimService's exact
 * WHERE-guard idiom collapsed to a single statement (the row always
 * pre-exists, so there is no fresh-INSERT-vs-reclaim split):
 * `UPDATE case_workspace_waits SET claim_owner_token=?,
 * claim_fencing_token=claim_fencing_token+1,
 * claim_lease_expires_at=(NOW()+interval)::text, updated_at=? WHERE
 * wait_id=? AND wait_type='TIMER' AND status='ACTIVE' AND
 * (claim_owner_token IS NULL OR claim_lease_expires_at::timestamptz <
 * NOW()) RETURNING *`. 0 rows -> read current row: not found -> 'not_found';
 * wait_type<>TIMER or status<>ACTIVE -> 'not_claimable'; otherwise (a live,
 * non-expired lease held by someone else) -> 'active_elsewhere'.
 * Deliberately omits operationClaimService.
 * acquireOrReclaimOperationClaim's bounded-wait polling (open_question #4).
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED. This is a scheduler-sweep primitive
 * with no human actor in its signature — deliberately NO
 * requireCaseAccess/requireOrgMember call is performed here (CW-P12
 * auth-retrofit decision). Must only ever be invoked from a trusted internal
 * worker, gated at a service/system-credential layer if ever reachable from
 * a route.
 */
export async function claimTimerWait(
  waitId: string,
  params?: { leaseMs?: number }
): Promise<ClaimTimerWaitOutcome> {
  const id = requireNonBlank(waitId, 'wait_id_required');
  const leaseMs = params?.leaseMs ?? DEFAULT_TIMER_CLAIM_LEASE_MS;
  const ownerToken = uuidv4();

  return withPgTransaction(async (client) => {
    const now = new Date().toISOString();
    const claimed = await client.query<CaseWorkspaceWaitRow>(
      `UPDATE case_workspace_waits
          SET claim_owner_token = ?,
              claim_fencing_token = claim_fencing_token + 1,
              claim_lease_expires_at = (NOW() + (? || ' milliseconds')::interval)::text,
              updated_at = ?
        WHERE wait_id = ? AND wait_type = 'TIMER' AND status = 'ACTIVE'
          AND (claim_owner_token IS NULL OR claim_lease_expires_at::timestamptz < NOW())
        RETURNING *`,
      [ownerToken, String(leaseMs), now, id]
    );

    const claimedRow = claimed.rows[0];
    if (claimedRow) {
      // Taxonomy: `wait.claimed`, scheduler actor, flagged high-volume (§5.8).
      // The owner token is a capability secret and never enters the event; the
      // fencing token (a monotonic ordinal) is the auditable fact.
      await publishEvent(client, {
        eventType: 'wait.claimed',
        ...waitEventIdentity(claimedRow),
        actorUserId: SYSTEM_ACTOR_TIMER_CLAIMER,
        redactedSummary: redact({
          waitType: claimedRow.wait_type,
          // NOT `fencingToken`: PiiRedactor matches field names by SUBSTRING, so
          // any key containing "token" is blanked to [REDACTED]. The fencing
          // value is a monotonic counter, not a credential, and losing it would
          // gut the §10 lease trace — so it is named for what it is.
          claimFencingCounter: Number(claimedRow.claim_fencing_token),
          leaseMs,
          leaseExpiresAt: claimedRow.claim_lease_expires_at,
          dueAt: claimedRow.due_at,
        }),
      });
      return {
        outcome: 'claimed',
        wait: mapRow(claimedRow),
        ownerToken,
        fencingToken: Number(claimedRow.claim_fencing_token),
      };
    }

    const currentResult = await client.query<CaseWorkspaceWaitRow>(
      `SELECT * FROM case_workspace_waits WHERE wait_id = ?`,
      [id]
    );
    const current = currentResult.rows[0];
    if (!current) return { outcome: 'not_found' };
    if (current.wait_type !== 'TIMER' || current.status !== 'ACTIVE') {
      return { outcome: 'not_claimable' };
    }
    return { outcome: 'active_elsewhere' };
  });
}

/**
 * CW-RT-021, CW-RT-052, CW-CANON-11, CW-DOD-C5.
 *
 * Mirrors operationClaimService.renewOperationClaimLease()'s CAS idiom
 * exactly, scoped to this row: `UPDATE case_workspace_waits SET
 * claim_lease_expires_at=(NOW()+interval)::text, updated_at=? WHERE
 * wait_id=? AND claim_owner_token=? AND claim_fencing_token=? AND
 * status='ACTIVE'`. 0 rows against an existing row -> 'fenced' (ownership
 * already lost to a reclaim); wait_id not found -> 'not_found'. A heartbeat
 * wrapper analogous to operationClaimService.startClaimHeartbeat() can be
 * layered on top by a future caller; not required as a separate exported
 * primitive by this packet.
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED. Same treatment as claimTimerWait — no
 * human actor in its signature, deliberately NO
 * requireCaseAccess/requireOrgMember call (CW-P12 auth-retrofit decision).
 */
export async function renewTimerWaitClaimLease(
  waitId: string,
  ownerToken: string,
  fencingToken: number,
  leaseMs?: number
): Promise<RenewTimerWaitClaimLeaseOutcome> {
  const id = requireNonBlank(waitId, 'wait_id_required');
  const owner = requireNonBlank(ownerToken, 'wait_claim_owner_token_required');
  if (typeof fencingToken !== 'number') {
    throw new Error('wait_claim_fencing_token_required');
  }
  const leaseMsResolved = leaseMs ?? DEFAULT_TIMER_CLAIM_LEASE_MS;

  return withPgTransaction(async (client) => {
    const now = new Date().toISOString();
    // RETURNING * (not just wait_id): the renewed row is the ONLY legitimate
    // source of the event's tenancy/correlation identity — re-SELECTing it would
    // be a different read under concurrency (§3 of the taxonomy's checklist).
    const renewed = await client.query<CaseWorkspaceWaitRow>(
      `UPDATE case_workspace_waits
          SET claim_lease_expires_at = (NOW() + (? || ' milliseconds')::interval)::text,
              updated_at = ?
        WHERE wait_id = ? AND claim_owner_token = ? AND claim_fencing_token = ?
          AND status = 'ACTIVE'
        RETURNING *`,
      [String(leaseMsResolved), now, id, owner, fencingToken]
    );
    if (renewed.rows[0]) {
      // Taxonomy: `wait.claim_lease_renewed` — the heartbeat, explicitly the
      // highest-volume event in this table (§5.8). Kept because §10 wants
      // "worker utilization, leases and stuck nodes" observable.
      await publishEvent(client, {
        eventType: 'wait.claim_lease_renewed',
        ...waitEventIdentity(renewed.rows[0]),
        actorUserId: SYSTEM_ACTOR_TIMER_CLAIMER,
        redactedSummary: redact({
          waitType: renewed.rows[0].wait_type,
          // See claimTimerWait — deliberately not named `fencingToken`.
          claimFencingCounter: Number(renewed.rows[0].claim_fencing_token),
          leaseMs: leaseMsResolved,
          leaseExpiresAt: renewed.rows[0].claim_lease_expires_at,
        }),
      });
      return 'renewed';
    }

    const existingResult = await client.query<{ wait_id: string }>(
      `SELECT wait_id FROM case_workspace_waits WHERE wait_id = ?`,
      [id]
    );
    return existingResult.rows[0] ? 'fenced' : 'not_found';
  });
}

/**
 * CW-RT-020, CW-RT-021, CW-RT-043, CW-CANON-11, CW-01-026-INV8.
 *
 * SatisfyWait command (and the mechanical core behind provideHumanInput()
 * for HUMAN waits). loadForUpdate locks the row; throws
 * wait_status_transition_not_allowed if status<>ACTIVE. If wait_type=TIMER,
 * requires input.timerClaim and throws wait_claim_fenced if
 * claim_owner_token/claim_fencing_token do not match the locked row exactly
 * (CAS loss, mirrors finalizeOperationClaim()'s 'fenced' outcome — thrown
 * here, not returned, since a fenced finalize is a caller bug/lost race the
 * caller must not treat as success). UPDATE SET status='SATISFIED',
 * satisfied_at=?, satisfied_by_event_id=?, version=version+1, updated_at=?
 * WHERE wait_id=? AND version=expectedVersion RETURNING * (0 rows ->
 * wait_version_conflict). DOMAIN_EVENT/EXTERNAL_CALLBACK can call this path
 * today but nothing here authenticates or deduplicates the caller
 * (open_question #8).
 *
 * NO signature change and no direct requireCaseAccess call in this function
 * itself (CW-P12 auth-retrofit decision). Used by both the HUMAN path (via
 * provideHumanInput, which performs its own check via getWait before
 * delegating here) and by TIMER/DOMAIN_EVENT/EXTERNAL_CALLBACK paths that
 * have no real end-user actor — a mandatory actor param here would be
 * meaningless for those paths. DOMAIN_EVENT/EXTERNAL_CALLBACK specifically
 * remain INTERNAL-ONLY / NOT ROUTE-EXPOSED pending a future
 * authentication/dedupe layer (open_question #8, unresolved by this
 * retrofit).
 */
export async function resolveWait(
  waitId: string,
  input: ResolveWaitInput,
  expectedVersion: number
): Promise<CaseWait> {
  return resolveWaitCore(waitId, input, expectedVersion, {
    eventType: 'wait.satisfied',
    // No actor exists in this signature by design (TIMER/DOMAIN_EVENT/
    // EXTERNAL_CALLBACK paths have no end user); §1 permits a `system:<worker>`
    // token, which is honest, whereas borrowing an unrelated user id would not be.
    actorUserId: SYSTEM_ACTOR_WAIT_RESOLVER,
    summary: { satisfiedByEventId: input.satisfiedByEventId },
  });
}

/**
 * The shared satisfaction body behind BOTH `resolveWait` (taxonomy
 * `wait.satisfied`) and `provideHumanInput` (taxonomy
 * `wait.human_input_provided`).
 *
 * WHY THE EVENT IS A PARAMETER RATHER THAN A CONSTANT. The taxonomy gives those
 * two commands DIFFERENT event types and states "one row = one command = one
 * event_type" with 55 of 57 commands emitting exactly one event. If
 * provideHumanInput simply delegated to the public resolveWait, one command
 * would emit the wrong type; if it emitted its own event around the delegate, a
 * single human submission would produce TWO outbox rows with different ids that
 * §8's dedup-by-eventId cannot collapse — precisely the double-count the
 * taxonomy forbids for `cancelCase` in §5.3. Threading the event through the one
 * transaction gives each command exactly one event, of its own type, atomic with
 * the status flip.
 */
async function resolveWaitCore(
  waitId: string,
  input: ResolveWaitInput,
  expectedVersion: number,
  event: {
    eventType: string;
    actorUserId: string;
    summary?: Record<string, unknown>;
    payloadRef?: string | null;
  }
): Promise<CaseWait> {
  return withPgTransaction((client) =>
    satisfyWaitOnClient(client, waitId, input, expectedVersion, event)
  );
}

/**
 * The same satisfaction body as resolveWaitCore, but running on a transaction
 * client the CALLER already owns instead of opening its own.
 *
 * WHY THIS EXISTS AS A SEPARATE EXPORT. eventInboxService has to record an
 * inbound external event AND satisfy the wait it correlates to in ONE
 * transaction — that atomicity is the entire proof behind doc 06 §8's
 * "duplicate or late events … do not reactivate completed/cancelled Runs" and
 * "Wait satisfaction is atomic and unique". Calling the public resolveWait()
 * from inside the inbox's transaction would open a SECOND connection
 * (withPgTransaction always does), producing exactly the dual-write hole the
 * outbox pattern exists to remove: the inbox row could commit while the wait
 * flip rolled back, or the reverse. There is no way to close that from the
 * caller's side, only by never opening it — hence this export rather than a
 * clever wrapper.
 *
 * `client` MUST be an already-open transaction client from withPgTransaction.
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED — it performs no auth check of its own
 * (same posture as resolveWait, whose DOMAIN_EVENT/EXTERNAL_CALLBACK paths
 * have no end-user actor); the caller is responsible for the trust boundary.
 */
export async function satisfyWaitOnClient(
  client: PgTransactionClient,
  waitId: string,
  input: ResolveWaitInput,
  expectedVersion: number,
  event: {
    eventType: string;
    actorUserId: string;
    summary?: Record<string, unknown>;
    payloadRef?: string | null;
  }
): Promise<CaseWait> {
  const id = requireNonBlank(waitId, 'wait_id_required');
  const satisfiedByEventId = requireNonBlank(
    input.satisfiedByEventId,
    'wait_satisfied_by_event_id_required'
  );
  if (typeof expectedVersion !== 'number') throw new Error('wait_expected_version_required');

  {
    const row = await loadForUpdate(client, id);
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes('SATISFIED')) {
      throw new Error(`wait_status_transition_not_allowed:${row.status}->SATISFIED`);
    }

    if (row.wait_type === 'TIMER') {
      if (!input.timerClaim) throw new Error('wait_timer_claim_required');
      if (
        row.claim_owner_token !== input.timerClaim.ownerToken ||
        Number(row.claim_fencing_token) !== input.timerClaim.fencingToken
      ) {
        throw new Error('wait_claim_fenced');
      }
    }

    const now = new Date().toISOString();
    const updated = await client.query<CaseWorkspaceWaitRow>(
      `UPDATE case_workspace_waits
          SET status = 'SATISFIED', satisfied_at = ?, satisfied_by_event_id = ?,
              version = version + 1, updated_at = ?
        WHERE wait_id = ? AND version = ?
        RETURNING *`,
      [now, satisfiedByEventId, now, id, expectedVersion]
    );
    if (!updated.rows[0]) throw new Error('wait_version_conflict');

    // §8 "Wait satisfaction is atomic and unique" — this row, written on the
    // same client inside the same transaction as the status flip, is the proof.
    await publishEvent(client, {
      eventType: event.eventType,
      ...waitEventIdentity(updated.rows[0]),
      actorUserId: event.actorUserId,
      redactedSummary: redact({
        waitType: row.wait_type,
        from: row.status,
        to: 'SATISFIED',
        correlationKey: row.correlation_key,
        ...(event.summary ?? {}),
      }),
      payloadRef: event.payloadRef ?? null,
    });
    return mapRow(updated.rows[0]);
  }
}

/**
 * CW-RT-043, CW-01-026-INV8, CW-02-029.
 *
 * ProvideHumanInput command — thin HUMAN-only wrapper. Throws
 * wait_wrong_type_for_human_input if wait_type<>HUMAN (checked via a plain
 * read; wait_type is immutable once created, so there is no race between
 * this check and the delegated resolveWait() call below). Delegates to the
 * same resolve path with satisfiedByEventId=input.inputRef (an opaque
 * pointer to wherever the submitted input payload actually lives — this
 * packet never persists the payload itself). input.actorUserId is accepted
 * for caller-side audit context only and is NOT persisted anywhere on this
 * table (open_question #9).
 */
export async function provideHumanInput(
  waitId: string,
  input: ProvideHumanInputInput,
  expectedVersion: number
): Promise<CaseWait> {
  const id = requireNonBlank(waitId, 'wait_id_required');
  const inputRef = requireNonBlank(input.inputRef, 'wait_human_input_ref_required');
  const actorUserId = requireNonBlank(input.actorUserId, 'wait_human_input_actor_required');

  const wait = await getWait(id, actorUserId);
  if (!wait) throw new Error('wait_not_found');
  if (wait.waitType !== 'HUMAN') throw new Error('wait_wrong_type_for_human_input');

  // Taxonomy: `wait.human_input_provided`, and "Summary must NOT contain the
  // human's free text — `payloadRef` it". inputRef is exactly that pointer, so
  // it goes to payloadRef and nowhere else. Delegates to resolveWaitCore (not to
  // the public resolveWait) so this command emits its OWN single event rather
  // than `wait.satisfied` or two rows — see resolveWaitCore's header.
  return resolveWaitCore(id, { satisfiedByEventId: inputRef }, expectedVersion, {
    eventType: 'wait.human_input_provided',
    actorUserId,
    payloadRef: inputRef,
  });
}

/**
 * CW-RT-043, CW-RT-052, CW-RT-062, CW-DOD-C5.
 *
 * ExpireWait command. loadForUpdate; throws
 * wait_status_transition_not_allowed if status<>ACTIVE. UPDATE SET
 * status='EXPIRED', version=version+1, updated_at=? WHERE wait_id=? AND
 * version=? RETURNING * (0 rows -> wait_version_conflict). Only the
 * mutation primitive — the timeout-detection sweep that decides WHEN to
 * call this is a future scheduler job, out of this packet's scope (mirrors
 * runBindingService.ts's open_question #1 pattern).
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED. Calls the shared
 * applySimpleWaitTransition WITHOUT an actorUserId argument — a
 * system/scheduler timeout-sweep primitive, deliberately left unguarded at
 * this layer (CW-P12 auth-retrofit decision), same posture as
 * claimTimerWait/renewTimerWaitClaimLease.
 */
export async function expireWait(
  waitId: string,
  expectedVersion: number
): Promise<CaseWait> {
  // Taxonomy: `wait.expired`, "Scheduler actor" — §1 names expireWait as the
  // literal example of a `system:<worker>` emitter.
  return applySimpleWaitTransition(waitId, expectedVersion, 'EXPIRED', {
    eventType: 'wait.expired',
    actorUserId: SYSTEM_ACTOR_WAIT_SCHEDULER,
  });
}

/**
 * CW-02-029, CW-RT-052.
 *
 * ACTIVE -> CANCELLED via the same loadForUpdate + OCC UPDATE shape as
 * expireWait(). `reason` is required and validated non-blank, but — same
 * shape as proposalApprovalService.revokeApprovedProposal()'s own `reason`
 * — is not persisted anywhere on this table (open_question #9). `actor` is
 * accepted for caller-side audit context only, same posture. Backs
 * CW-02-029's explicit "cancel" permitted step-card action.
 */
export async function cancelWait(
  waitId: string,
  actor: CaseActor,
  reason: string,
  expectedVersion: number
): Promise<CaseWait> {
  const actorUserId = requireNonBlank(actor?.actorUserId, 'wait_actor_required');
  requireNonBlank(reason, 'wait_cancel_reason_required');
  return applySimpleWaitTransition(
    waitId,
    expectedVersion,
    'CANCELLED',
    // Taxonomy: `wait.cancelled`. `reason` is not persisted on the table
    // (open_question #9) and must not become durable via the event either —
    // classifyReason keeps the class + digest, never the prose.
    { eventType: 'wait.cancelled', actorUserId, summary: classifyReason(reason) },
    actorUserId
  );
}

/**
 * Shared plain-OCC transition body for the status changes that need no
 * extra domain check beyond ALLOWED_TRANSITIONS reachability
 * (expireWait/cancelWait — mirrors proposalApprovalService.
 * applySimpleTransition()'s own shape).
 *
 * `event` is REQUIRED, not optional: this helper is the single write path for
 * two distinct taxonomy rows with two different actors (scheduler vs. human), and
 * a defaulted event_type here is exactly how a command would silently stop being
 * observable. Note `event.actorUserId` is separate from the trailing
 * `actorUserId` guard argument — the latter decides whether requireCaseAccess
 * runs at all (expireWait is an unguarded system primitive), the former is the
 * accountable actor recorded on the event, which every event must have.
 */
async function applySimpleWaitTransition(
  waitId: string,
  expectedVersion: number,
  nextStatus: CaseWaitStatus,
  event: { eventType: string; actorUserId: string; summary?: Record<string, unknown> },
  actorUserId?: string
): Promise<CaseWait> {
  const id = requireNonBlank(waitId, 'wait_id_required');
  if (typeof expectedVersion !== 'number') throw new Error('wait_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    if (actorUserId) {
      await requireCaseAccess(actorUserId, row.case_id);
    }
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes(nextStatus)) {
      throw new Error(`wait_status_transition_not_allowed:${row.status}->${nextStatus}`);
    }

    const now = new Date().toISOString();
    const updated = await client.query<CaseWorkspaceWaitRow>(
      `UPDATE case_workspace_waits
          SET status = ?, version = version + 1, updated_at = ?
        WHERE wait_id = ? AND version = ?
        RETURNING *`,
      [nextStatus, now, id, expectedVersion]
    );
    if (!updated.rows[0]) throw new Error('wait_version_conflict');

    await publishEvent(client, {
      eventType: event.eventType,
      ...waitEventIdentity(updated.rows[0]),
      actorUserId: event.actorUserId,
      redactedSummary: redact({
        waitType: row.wait_type,
        from: row.status,
        to: nextStatus,
        correlationKey: row.correlation_key,
        dueAt: row.due_at,
        timeoutAt: row.timeout_at,
        ...(event.summary ?? {}),
      }),
    });
    return mapRow(updated.rows[0]);
  });
}

/** CW-RT-020, CW-DOD-B5. Plain read, no lock. */
export async function getWait(
  waitId: string,
  actorUserId: string
): Promise<CaseWait | null> {
  const actor = requireNonBlank(actorUserId, 'wait_actor_required');
  const row = await queryOne<CaseWorkspaceWaitRow>(
    `SELECT * FROM case_workspace_waits WHERE wait_id = ?`,
    [requireNonBlank(waitId, 'wait_id_required')]
  );
  if (!row) return null;
  try {
    await requireCaseAccess(actor, row.case_id);
  } catch (err) {
    if (err instanceof CaseWorkspaceAuthError) return null;
    throw err;
  }
  return mapRow(row);
}

/**
 * CW-GR-026 (GET /api/runs/:runId/waits), CW-02-029. Plain read, no lock,
 * newest created_at first.
 */
export async function listWaitsForRun(
  runId: string,
  actorUserId: string
): Promise<CaseWait[]> {
  const id = requireNonBlank(runId, 'wait_run_id_required');
  const actor = requireNonBlank(actorUserId, 'wait_actor_required');
  const rows = await queryAll<CaseWorkspaceWaitRow>(
    `SELECT * FROM case_workspace_waits WHERE run_id = ? ORDER BY created_at DESC`,
    [id]
  );
  if (rows.length === 0) return [];
  await requireCaseAccess(actor, rows[0].case_id);
  return rows.map(mapRow);
}

/**
 * CW-DOD-B5, CW-DOD-B8. Plain read, no lock, newest created_at first.
 * Mirrors listActionProposalsForCase()'s own filter shape.
 */
export async function listWaitsForCase(
  caseId: string,
  filters: { status?: CaseWaitStatus; waitType?: CaseWaitType } | undefined,
  actorUserId: string
): Promise<CaseWait[]> {
  const id = requireNonBlank(caseId, 'wait_case_id_required');
  await requireCaseAccess(requireNonBlank(actorUserId, 'wait_actor_required'), id);
  const conditions = ['case_id = ?'];
  const params: unknown[] = [id];
  if (filters?.status) {
    conditions.push('status = ?');
    params.push(requireEnum(filters.status, WAIT_STATUSES, 'wait_status_invalid'));
  }
  if (filters?.waitType) {
    conditions.push('wait_type = ?');
    params.push(requireEnum(filters.waitType, WAIT_TYPES, 'wait_type_invalid'));
  }
  const rows = await queryAll<CaseWorkspaceWaitRow>(
    `SELECT * FROM case_workspace_waits
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC`,
    params
  );
  return rows.map(mapRow);
}

/**
 * CW-RT-021, CW-DOD-I6. Plain read, no lock: candidates whose lease is
 * either never claimed or expired, ordered soonest-due-first. Never itself
 * makes a claiming decision (mirrors operationClaimService.
 * readClaimRow()'s "report, don't decide" posture) — generates candidates
 * for the caller's own subsequent, individually-atomic claimTimerWait()
 * calls. Uses the (wait_type, status, due_at) index CW-RT-021 requires.
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED. Inherently a cross-case, cross-org
 * scheduler-sweep read by design (candidates across the whole platform) —
 * NO auth call is added here (CW-P12 auth-retrofit decision). Must never be
 * exposed via any user-facing route; gate at the route layer with a
 * system/service credential instead of an actor/org check.
 */
export async function listDueTimerWaitsForClaim(
  now: Date = new Date(),
  limit: number = 50
): Promise<CaseWait[]> {
  const nowIso = now.toISOString();
  const rows = await queryAll<CaseWorkspaceWaitRow>(
    `SELECT * FROM case_workspace_waits
       WHERE wait_type = 'TIMER' AND status = 'ACTIVE'
         AND due_at IS NOT NULL AND due_at::timestamptz <= ?::timestamptz
         AND (claim_owner_token IS NULL OR claim_lease_expires_at::timestamptz < ?::timestamptz)
       ORDER BY due_at ASC
       LIMIT ?`,
    [nowIso, nowIso, limit]
  );
  return rows.map(mapRow);
}

// ---------------------------------------------------------------------------
// SCHEDULER COMPLETION (doc 06 §8) — heartbeats, expired-lease recovery with a
// mandatory idempotency/reconciliation check, and the inbox's wait lookup.
//
// What was already here: claimTimerWait (atomic claim) and
// renewTimerWaitClaimLease (a single CAS renewal). What was MISSING, and is
// added below, is everything §8 actually requires around them:
//   - "Worker claims use leases/heartbeats" — a single renewal primitive is not
//     a heartbeat. startTimerWaitClaimHeartbeat is the loop, and critically it
//     tells the caller the moment ownership is LOST, which is the only way a
//     worker can stop before it collides with the new holder.
//   - "Expired leases are reclaimed only after idempotency or reconciliation
//     checks" — claimTimerWait happily takes an expired lease with no check at
//     all. reclaimExpiredTimerWaitClaim is the guarded path.
//   - "External effects without provider idempotency require readback
//     reconciliation before retry" — the reconcile callback is mandatory, and
//     an `alreadyApplied` verdict SATISFIES the wait from the readback instead
//     of handing it to a new worker to do a second time.
// ---------------------------------------------------------------------------

/**
 * §8's mandatory pre-reclaim check, as a verdict. `alreadyApplied: true` means
 * a readback against the external system PROVED the previous claimant's effect
 * landed; the wait must then be satisfied from that readback, never retried.
 */
export interface TimerWaitReconciliationVerdict {
  alreadyApplied: boolean;
  /** The event/effect id the readback found. Required when alreadyApplied. */
  satisfiedByEventId?: string | null;
  detail?: Record<string, unknown>;
}

export type ReclaimExpiredTimerWaitClaimOutcome =
  | { outcome: 'reclaimed'; wait: CaseWait; ownerToken: string; fencingToken: number }
  | { outcome: 'already_applied'; wait: CaseWait }
  | { outcome: 'lease_active' }
  | { outcome: 'not_reclaimable' }
  | { outcome: 'not_found' };

/**
 * §8 "Worker claims use leases/heartbeats". A real heartbeat loop over
 * renewTimerWaitClaimLease.
 *
 * Returns a stop function. `onLost` fires on the first non-'renewed' outcome —
 * that is the signal for the worker to ABANDON the wait, because a 'fenced'
 * result means someone else already owns it and any further action would be a
 * double effect. A heartbeat that silently kept retrying after being fenced
 * would be worse than no heartbeat at all.
 *
 * The interval defaults to a third of the lease so two consecutive heartbeats
 * may be lost before the lease actually lapses. A transient DB error does NOT
 * kill the loop (the lease still has time left); only genuine loss of
 * ownership does. The timer is unref'd — a background heartbeat must never be
 * the reason a process refuses to exit.
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED.
 */
export function startTimerWaitClaimHeartbeat(
  waitId: string,
  ownerToken: string,
  fencingToken: number,
  options: {
    intervalMs?: number;
    leaseMs?: number;
    onLost?: (outcome: RenewTimerWaitClaimLeaseOutcome) => void;
  } = {}
): () => void {
  const leaseMs = options.leaseMs ?? DEFAULT_TIMER_CLAIM_LEASE_MS;
  const intervalMs = options.intervalMs ?? Math.max(1_000, Math.floor(leaseMs / 3));

  let stopped = false;
  const timer = setInterval(() => {
    void (async () => {
      if (stopped) return;
      try {
        const outcome = await renewTimerWaitClaimLease(waitId, ownerToken, fencingToken, leaseMs);
        if (outcome !== 'renewed') {
          stopped = true;
          clearInterval(timer);
          options.onLost?.(outcome);
        }
      } catch {
        // Transient DB failure — the lease has not lapsed yet and the next tick
        // may succeed. Real loss of ownership arrives as 'fenced', not a throw.
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
 * This is the ONLY sanctioned way to take over an EXPIRED timer-wait claim.
 * Note that claimTimerWait() will also take an expired lease — it predates this
 * rule and stays as-is for the never-claimed case; callers sweeping abandoned
 * work must use THIS function, which is why listExpiredTimerWaitClaimsForRecovery
 * below feeds it rather than feeding claimTimerWait.
 *
 * `reconcile` is MANDATORY and has no permissive default: a default would make
 * the unsafe path the one every caller gets for free, and the failure it
 * guards against (re-running an external effect that already committed, because
 * the first worker died before recording it) is silent until it is expensive.
 *
 *   1. read the row; confirm the lease genuinely expired;
 *   2. run the caller's readback;
 *   3a. alreadyApplied -> SATISFY the wait from the readback, do NOT hand it to
 *       a new worker. `satisfiedByEventId` is required here, because "it already
 *       happened" with no evidence pointer is not a reconciliation;
 *   3b. otherwise -> one conditional UPDATE re-checks the expiry guard and takes
 *       the lease with a bumped fencing token.
 *
 * Two workers racing at step 3b serialize on the row lock; the loser's WHERE no
 * longer matches (the winner pushed claim_lease_expires_at into the future) and
 * it gets 'lease_active'. Both may run `reconcile` — that is inherent to a
 * read-only external check, and is exactly why the decisive statement is still
 * guarded. A throwing `reconcile` aborts the reclaim rather than being
 * swallowed into a retry; the wait stays expired and recoverable.
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED.
 */
export async function reclaimExpiredTimerWaitClaim(
  waitId: string,
  reconcile: (wait: CaseWait) => Promise<TimerWaitReconciliationVerdict> | TimerWaitReconciliationVerdict,
  params: { leaseMs?: number } = {}
): Promise<ReclaimExpiredTimerWaitClaimOutcome> {
  const id = requireNonBlank(waitId, 'wait_id_required');
  if (typeof reconcile !== 'function') throw new Error('wait_reconciliation_required');
  const leaseMs = params.leaseMs ?? DEFAULT_TIMER_CLAIM_LEASE_MS;

  const current = await queryOne<CaseWorkspaceWaitRow>(
    `SELECT * FROM case_workspace_waits WHERE wait_id = ?`,
    [id]
  );
  if (!current) return { outcome: 'not_found' };
  if (current.wait_type !== 'TIMER' || current.status !== 'ACTIVE') {
    return { outcome: 'not_reclaimable' };
  }
  if (!current.claim_owner_token) return { outcome: 'not_reclaimable' };
  if (
    current.claim_lease_expires_at &&
    Date.parse(current.claim_lease_expires_at) > Date.now()
  ) {
    return { outcome: 'lease_active' };
  }

  const verdict = await reconcile(mapRow(current));

  if (verdict?.alreadyApplied) {
    const satisfiedByEventId = requireNonBlank(
      verdict.satisfiedByEventId,
      'wait_reconciliation_satisfied_by_event_id_required'
    );
    return withPgTransaction(async (client) => {
      const row = await loadForUpdate(client, id);
      if (row.status !== 'ACTIVE') return { outcome: 'not_reclaimable' as const };
      // Satisfied on the RECONCILED path, so the TIMER claim CAS in
      // satisfyWaitOnClient is bypassed deliberately: the owner token being
      // CAS-checked belongs to a worker that is provably gone. The evidence is
      // the readback's own event id, carried into satisfied_by_event_id.
      const satisfied = await client.query<CaseWorkspaceWaitRow>(
        `UPDATE case_workspace_waits
            SET status = 'SATISFIED', satisfied_at = ?, satisfied_by_event_id = ?,
                claim_owner_token = NULL, claim_lease_expires_at = NULL,
                version = version + 1, updated_at = ?
          WHERE wait_id = ? AND version = ?
          RETURNING *`,
        [
          new Date().toISOString(),
          satisfiedByEventId,
          new Date().toISOString(),
          id,
          Number(row.version),
        ]
      );
      const satisfiedRow = satisfied.rows[0];
      if (!satisfiedRow) throw new Error('wait_version_conflict');

      await publishEvent(client, {
        eventType: 'wait.reconciled_already_applied',
        ...waitEventIdentity(satisfiedRow),
        actorUserId: SYSTEM_ACTOR_WAIT_SCHEDULER,
        redactedSummary: redact({
          waitType: satisfiedRow.wait_type,
          from: row.status,
          to: 'SATISFIED',
          previousLeaseExpired: true,
          reconciliation: verdict.detail ?? {},
        }),
      });
      return { outcome: 'already_applied' as const, wait: mapRow(satisfiedRow) };
    });
  }

  return withPgTransaction(async (client) => {
    const ownerToken = uuidv4();
    const now = new Date().toISOString();
    const reclaimed = await client.query<CaseWorkspaceWaitRow>(
      `UPDATE case_workspace_waits
          SET claim_owner_token = ?,
              claim_fencing_token = claim_fencing_token + 1,
              claim_lease_expires_at = (NOW() + (? || ' milliseconds')::interval)::text,
              updated_at = ?
        WHERE wait_id = ? AND wait_type = 'TIMER' AND status = 'ACTIVE'
          AND claim_owner_token IS NOT NULL
          AND claim_lease_expires_at IS NOT NULL
          AND claim_lease_expires_at::timestamptz < NOW()
        RETURNING *`,
      [ownerToken, String(leaseMs), now, id]
    );
    const reclaimedRow = reclaimed.rows[0];
    if (!reclaimedRow) {
      const after = await client.query<CaseWorkspaceWaitRow>(
        `SELECT * FROM case_workspace_waits WHERE wait_id = ?`,
        [id]
      );
      const afterRow = after.rows[0];
      if (!afterRow) return { outcome: 'not_found' as const };
      if (afterRow.wait_type !== 'TIMER' || afterRow.status !== 'ACTIVE') {
        return { outcome: 'not_reclaimable' as const };
      }
      return { outcome: 'lease_active' as const };
    }

    await publishEvent(client, {
      eventType: 'wait.claim_reclaimed',
      ...waitEventIdentity(reclaimedRow),
      actorUserId: SYSTEM_ACTOR_TIMER_CLAIMER,
      redactedSummary: redact({
        waitType: reclaimedRow.wait_type,
        // Deliberately not named `fencingToken` — see claimTimerWait.
        claimFencingCounter: Number(reclaimedRow.claim_fencing_token),
        leaseMs,
        leaseExpiresAt: reclaimedRow.claim_lease_expires_at,
        reconciliation: verdict?.detail ?? {},
      }),
    });

    return {
      outcome: 'reclaimed' as const,
      wait: mapRow(reclaimedRow),
      ownerToken,
      fencingToken: Number(reclaimedRow.claim_fencing_token),
    };
  });
}

/**
 * §8 expired-lease recovery candidates: ACTIVE timer waits that ARE claimed but
 * whose lease has lapsed — i.e. abandoned work. Distinct from
 * listDueTimerWaitsForClaim(), which also returns never-claimed waits; feeding
 * abandoned work into claimTimerWait() would take the lease with no
 * reconciliation at all, which is precisely what §8 forbids. Feed these into
 * reclaimExpiredTimerWaitClaim() instead.
 *
 * "Report, don't decide": no claiming decision is made here.
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED (cross-case, cross-org by design).
 */
export async function listExpiredTimerWaitClaimsForRecovery(
  now: Date = new Date(),
  limit: number = 50
): Promise<CaseWait[]> {
  const nowIso = now.toISOString();
  const rows = await queryAll<CaseWorkspaceWaitRow>(
    `SELECT * FROM case_workspace_waits
       WHERE wait_type = 'TIMER' AND status = 'ACTIVE'
         AND claim_owner_token IS NOT NULL
         AND claim_lease_expires_at IS NOT NULL
         AND claim_lease_expires_at::timestamptz < ?::timestamptz
       ORDER BY claim_lease_expires_at ASC
       LIMIT ?`,
    [nowIso, limit]
  );
  return rows.map(mapRow);
}

/**
 * The inbox's wait lookup, on the CALLER's transaction client and with the row
 * LOCKED (`FOR UPDATE`).
 *
 * It lives here, not in eventInboxService, for one reason: `case_workspace_waits`
 * is this service's table, and letting another service issue its own locking
 * SELECT against it is how two different lock orders end up in one codebase.
 * The lock is taken as part of the inbox's single transaction so that
 * "authenticate -> dedupe -> validate tenant -> satisfy" is one atomic step
 * (doc 06 §8: an external callback must be validated for tenant/correlation
 * BEFORE it may influence a wait, and wait satisfaction must be "atomic and
 * unique").
 *
 * Returns null when no wait carries that correlation key. Deliberately does NOT
 * filter by organization_id: the CALLER compares the wait's real
 * organization_id against the claimed one and rejects a mismatch as a recorded
 * TENANT_MISMATCH security event. Filtering here instead would collapse
 * "wrong tenant" into "not found" and erase the attack signal.
 *
 * INTERNAL-ONLY / NOT ROUTE-EXPOSED.
 */
export async function loadWaitByCorrelationKeyOnClient(
  client: PgTransactionClient,
  correlationKey: string
): Promise<CaseWait | null> {
  const key = requireNonBlank(correlationKey, 'wait_correlation_key_required');
  const result = await client.query<CaseWorkspaceWaitRow>(
    `SELECT * FROM case_workspace_waits WHERE correlation_key = ?
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE`,
    [key]
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}
