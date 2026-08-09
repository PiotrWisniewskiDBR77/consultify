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

import { v4 as uuidv4 } from 'uuid';

import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';

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
export async function createWait(input: CreateWaitInput): Promise<CaseWait> {
  const caseId = requireNonBlank(input.caseId, 'wait_case_id_required');
  const correlationKey = requireNonBlank(input.correlationKey, 'wait_correlation_key_required');
  const waitType = requireEnum(input.waitType, WAIT_TYPES, 'wait_type_invalid');

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
    const renewed = await client.query<{ wait_id: string }>(
      `UPDATE case_workspace_waits
          SET claim_lease_expires_at = (NOW() + (? || ' milliseconds')::interval)::text,
              updated_at = ?
        WHERE wait_id = ? AND claim_owner_token = ? AND claim_fencing_token = ?
          AND status = 'ACTIVE'
        RETURNING wait_id`,
      [String(leaseMsResolved), now, id, owner, fencingToken]
    );
    if (renewed.rows[0]) return 'renewed';

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
 */
export async function resolveWait(
  waitId: string,
  input: ResolveWaitInput,
  expectedVersion: number
): Promise<CaseWait> {
  const id = requireNonBlank(waitId, 'wait_id_required');
  const satisfiedByEventId = requireNonBlank(
    input.satisfiedByEventId,
    'wait_satisfied_by_event_id_required'
  );
  if (typeof expectedVersion !== 'number') throw new Error('wait_expected_version_required');

  return withPgTransaction(async (client) => {
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
    return mapRow(updated.rows[0]);
  });
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
  requireNonBlank(input.actorUserId, 'wait_human_input_actor_required');

  const wait = await getWait(id);
  if (!wait) throw new Error('wait_not_found');
  if (wait.waitType !== 'HUMAN') throw new Error('wait_wrong_type_for_human_input');

  return resolveWait(id, { satisfiedByEventId: inputRef }, expectedVersion);
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
 */
export async function expireWait(
  waitId: string,
  expectedVersion: number
): Promise<CaseWait> {
  return applySimpleWaitTransition(waitId, expectedVersion, 'EXPIRED');
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
  requireNonBlank(actor?.actorUserId, 'wait_actor_required');
  requireNonBlank(reason, 'wait_cancel_reason_required');
  return applySimpleWaitTransition(waitId, expectedVersion, 'CANCELLED');
}

/**
 * Shared plain-OCC transition body for the status changes that need no
 * extra domain check beyond ALLOWED_TRANSITIONS reachability
 * (expireWait/cancelWait — mirrors proposalApprovalService.
 * applySimpleTransition()'s own shape).
 */
async function applySimpleWaitTransition(
  waitId: string,
  expectedVersion: number,
  nextStatus: CaseWaitStatus
): Promise<CaseWait> {
  const id = requireNonBlank(waitId, 'wait_id_required');
  if (typeof expectedVersion !== 'number') throw new Error('wait_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
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
    return mapRow(updated.rows[0]);
  });
}

/** CW-RT-020, CW-DOD-B5. Plain read, no lock. */
export async function getWait(waitId: string): Promise<CaseWait | null> {
  const row = await queryOne<CaseWorkspaceWaitRow>(
    `SELECT * FROM case_workspace_waits WHERE wait_id = ?`,
    [requireNonBlank(waitId, 'wait_id_required')]
  );
  return row ? mapRow(row) : null;
}

/**
 * CW-GR-026 (GET /api/runs/:runId/waits), CW-02-029. Plain read, no lock,
 * newest created_at first.
 */
export async function listWaitsForRun(runId: string): Promise<CaseWait[]> {
  const id = requireNonBlank(runId, 'wait_run_id_required');
  const rows = await queryAll<CaseWorkspaceWaitRow>(
    `SELECT * FROM case_workspace_waits WHERE run_id = ? ORDER BY created_at DESC`,
    [id]
  );
  return rows.map(mapRow);
}

/**
 * CW-DOD-B5, CW-DOD-B8. Plain read, no lock, newest created_at first.
 * Mirrors listActionProposalsForCase()'s own filter shape.
 */
export async function listWaitsForCase(
  caseId: string,
  filters?: { status?: CaseWaitStatus; waitType?: CaseWaitType }
): Promise<CaseWait[]> {
  const id = requireNonBlank(caseId, 'wait_case_id_required');
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
