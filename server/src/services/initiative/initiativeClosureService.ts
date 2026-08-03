/**
 * EXE-08 — Closure/Evidence Gate service.
 *
 * An initiative cannot reach DONE without a persistent evidence pack and an
 * explicit approver decision. This module owns the closure-request workflow
 * (draft -> submitted -> [returned -> submitted]* -> approved -> done) and is
 * the ONLY caller in this packet that invokes the canonical transition
 * engine (`initiativeTransitionService.executeInitiativeTransition`, read
 * -only / not modified here) to actually flip `initiatives.status` to DONE.
 * No other new code in this packet writes `initiatives.status` directly.
 *
 * ATOMICITY — read this before touching approveClosureRequest.
 *
 * `executeInitiativeTransition` opens its OWN dedicated `withPgTransaction`
 * internally (row-locks `initiatives`, validates the transition, writes the
 * status + its own audit rows, all on one pinned connection) and does not
 * accept an externally-supplied client. It cannot be nested inside a second,
 * independent `withPgTransaction` and still be "one transaction" — that would
 * be two different physical Postgres connections, which is exactly the false
 * -atomicity anti-pattern this packet's brief explicitly forbids claiming.
 * Modifying the engine to accept an external client was out of scope (it is
 * canonical, shared infrastructure — the brief's spirit throughout this
 * lineage has been "reuse the canonical engine, don't fork it").
 *
 * So `approveClosureRequest` is honestly TWO separate atomic units, made safe
 * by idempotent reconciliation rather than a single cross-unit transaction:
 *
 *   Unit 1 (this module's own `withPgTransaction`): row-lock the closure
 *   request, validate the gate (evidence complete, approver authorized,
 *   expectedInitiativeVersion still current, request still `submitted`),
 *   durably record the approval decision, mark the request
 *   `approved_pending_transition`. COMMIT. <- the "jawna decyzja" is durable
 *   here, before the engine is ever called.
 *
 *   Unit 2 (the engine's own transaction): flip `initiatives.status` to DONE
 *   with its own row lock, its own transition-validity/RBAC/readiness gates,
 *   its own atomic audit writes.
 *
 *   Reconciliation: on success, a small follow-up write finalizes the
 *   closure request to `done` with a reference to the audit row the engine
 *   wrote. If that follow-up write fails (process crash, connection drop),
 *   the initiative is ALREADY correctly DONE with its own audit — the
 *   closure request is left `approved_pending_transition`/`transition_failed`
 *   and self-heals to `done` the next time it is read (see
 *   `reconcileClosureRequestStatus`) or retried with the same idempotency
 *   key (see `approveClosureRequest`'s own pre-check). At no point can this
 *   sequence produce a SECOND transition or a second audit row for the same
 *   approval — each stage is individually idempotent and the partial unique
 *   index `idx_closure_requests_one_active_per_initiative` (see the
 *   migration) prevents a second closure request from racing the same
 *   initiative through a different row.
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { type PgTransactionClient, withPgTransaction } from '../../utils/queryHelpers.js';
import { resolveInitiativeAccessContext } from './initiativeAccessResolver.js';
import { executeInitiativeTransition } from './initiativeTransitionService.js';

// Mirrors GATE_PERMISSIONS[GateType.COMPLETE] in constants/initiativeStatuses.ts
// exactly (read there, not re-exported — that module only exports gate-to-role
// maps keyed by GateType, and COMPLETE is EXECUTING->DONE, precisely the
// transition this service exists to gate). Duplicated as a literal set here
// deliberately: this is the role check for "who may even submit an approval
// decision", which must be evaluated BEFORE calling the engine (for a clear,
// closure-specific error) — the engine enforces the same set again as the
// backstop of record when it actually performs the transition.
const CLOSURE_APPROVER_ROLES = new Set(['ADMIN', 'INITIATIVE_OWNER', 'PMO']);

export type EvidenceType = 'task' | 'milestone' | 'decision';

export interface ClosureGateError {
  code: string;
  message: string;
  httpStatus: number;
  details?: Record<string, unknown>;
}

export class ClosureGateFailure extends Error {
  code: string;
  httpStatus: number;
  details?: Record<string, unknown>;
  constructor(err: ClosureGateError) {
    super(err.message);
    this.code = err.code;
    this.httpStatus = err.httpStatus;
    this.details = err.details;
  }
}

function fail(
  code: string,
  message: string,
  httpStatus: number,
  details?: Record<string, unknown>
): never {
  throw new ClosureGateFailure({ code, message, httpStatus, details });
}

// ---------------------------------------------------------------------------
// Evidence ownership validation — evidence MUST point at a real row that (a)
// belongs to the caller's organization AND (b) belongs to the SPECIFIC
// initiative being closed AND (c) is itself in a terminal/approved state.
// Never trust a bare id: checking only organization_id would let evidence
// from a DIFFERENT initiative in the SAME org close this one (Codex review
// finding — a real cross-initiative evidence bypass, not theoretical: two
// unrelated initiatives could "close" off the same shared task). Checking
// only initiative_id without a terminal-status check would let an
// in-progress task/milestone/decision count as "done" evidence.
// ---------------------------------------------------------------------------

async function assertEvidenceRefBelongsToInitiative(
  orgId: string,
  initiativeId: string,
  evidenceType: EvidenceType,
  evidenceRefId: string
): Promise<void> {
  let row: { id: string; status: string | null } | null = null;
  let terminal = false;
  if (evidenceType === 'task') {
    row = await queryHelpers.queryOne<{ id: string; status: string | null }>(
      `SELECT id, status FROM tasks WHERE id = ? AND organization_id = ? AND initiative_id = ?`,
      [evidenceRefId, orgId, initiativeId]
    );
    terminal = !!row && ['done', 'completed'].includes(String(row.status || '').toLowerCase());
  } else if (evidenceType === 'milestone') {
    row = await queryHelpers.queryOne<{ id: string; status: string | null }>(
      `SELECT id, status FROM initiative_milestones WHERE id = ? AND organization_id = ? AND initiative_id = ?`,
      [evidenceRefId, orgId, initiativeId]
    );
    terminal = !!row && String(row.status || '').toUpperCase() === 'COMPLETED';
  } else if (evidenceType === 'decision') {
    // decisions.status domain is 'pending' | 'approved' | 'rejected' |
    // 'deferred' (server/src/types/index.ts DecisionStatus) — 'approved' is
    // the only resolved/accepted terminal state.
    row = await queryHelpers.queryOne<{ id: string; status: string | null }>(
      `SELECT id, status FROM decisions WHERE id = ? AND organization_id = ? AND initiative_id = ?`,
      [evidenceRefId, orgId, initiativeId]
    );
    terminal = !!row && String(row.status || '').toLowerCase() === 'approved';
  } else {
    fail('EVIDENCE_TYPE_INVALID', `Unknown evidence type: ${String(evidenceType)}`, 400);
  }
  if (!row) {
    // 404, not a more specific "wrong org/initiative" message — do not
    // confirm the referenced row's existence to a caller who doesn't own it
    // or reveal that it exists but belongs to a different initiative.
    fail(
      'EVIDENCE_REF_NOT_FOUND',
      `Evidence reference (${evidenceType}:${evidenceRefId}) was not found for this initiative`,
      404
    );
  }
  if (!terminal) {
    fail(
      'EVIDENCE_NOT_TERMINAL',
      `Evidence reference (${evidenceType}:${evidenceRefId}) exists but is not in a terminal/approved state`,
      409
    );
  }
}

// ---------------------------------------------------------------------------
// Closure request lifecycle
// ---------------------------------------------------------------------------

export async function assertInitiativeInOrg(orgId: string, initiativeId: string) {
  const initiative = await queryHelpers.queryOne<{
    id: string;
    status: string;
    updatedAt: string;
  }>(
    `SELECT id, status, updated_at as "updatedAt" FROM initiatives WHERE id = ? AND organization_id = ?`,
    [initiativeId, orgId]
  );
  if (!initiative) fail('INITIATIVE_NOT_FOUND', 'Initiative not found', 404);
  return initiative;
}

export interface CreateClosureRequestInput {
  orgId: string;
  initiativeId: string;
  actorId: string;
  closureRationale?: string;
  outcomeSummary?: string;
  idempotencyKey?: string;
}

export async function createClosureRequest(input: CreateClosureRequestInput) {
  const initiative = await assertInitiativeInOrg(input.orgId, input.initiativeId);
  if (initiative.status !== 'EXECUTING') {
    fail(
      'INITIATIVE_NOT_EXECUTING',
      `Closure can only be requested while the initiative is EXECUTING (current: ${initiative.status})`,
      409
    );
  }

  if (input.idempotencyKey) {
    const existing = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM initiative_closure_requests WHERE initiative_id = ? AND idempotency_key = ?`,
      [input.initiativeId, input.idempotencyKey]
    );
    if (existing) return { id: existing.id, idempotent: true as const };
  }

  const id = uuidv4();
  try {
    await queryHelpers.queryRun(
      `INSERT INTO initiative_closure_requests
        (id, organization_id, initiative_id, requested_by, expected_initiative_version,
         closure_rationale, outcome_summary, status, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [
        id,
        input.orgId,
        input.initiativeId,
        input.actorId,
        initiative.updatedAt,
        input.closureRationale || null,
        input.outcomeSummary || null,
        input.idempotencyKey || null,
      ]
    );
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === '23505' && input.idempotencyKey) {
      const winner = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM initiative_closure_requests WHERE initiative_id = ? AND idempotency_key = ?`,
        [input.initiativeId, input.idempotencyKey]
      );
      if (winner) return { id: winner.id, idempotent: true as const };
    }
    throw err;
  }

  return { id, idempotent: false as const };
}

export interface AddEvidenceInput {
  orgId: string;
  initiativeId: string;
  closureRequestId: string;
  actorId: string;
  evidenceType: EvidenceType;
  evidenceRefId: string;
  notes?: string;
  idempotencyKey?: string;
}

async function loadClosureRequest(orgId: string, initiativeId: string, closureRequestId: string) {
  const row = await queryHelpers.queryOne<{
    id: string;
    status: string;
    requestedBy: string;
    version: number;
  }>(
    `SELECT id, status, requested_by as "requestedBy", version
     FROM initiative_closure_requests
     WHERE id = ? AND initiative_id = ? AND organization_id = ?`,
    [closureRequestId, initiativeId, orgId]
  );
  if (!row) fail('CLOSURE_REQUEST_NOT_FOUND', 'Closure request not found', 404);
  return row;
}

export async function addEvidence(input: AddEvidenceInput) {
  await assertInitiativeInOrg(input.orgId, input.initiativeId);
  const request = await loadClosureRequest(input.orgId, input.initiativeId, input.closureRequestId);
  if (request.status !== 'draft' && request.status !== 'returned') {
    fail(
      'CLOSURE_REQUEST_NOT_EDITABLE',
      `Evidence can only be added while the request is draft/returned (current: ${request.status})`,
      409
    );
  }

  await assertEvidenceRefBelongsToInitiative(
    input.orgId,
    input.initiativeId,
    input.evidenceType,
    input.evidenceRefId
  );

  if (input.idempotencyKey) {
    const existing = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM initiative_closure_evidence WHERE closure_request_id = ? AND idempotency_key = ?`,
      [input.closureRequestId, input.idempotencyKey]
    );
    if (existing) return { id: existing.id, idempotent: true as const };
  }

  const id = uuidv4();
  try {
    await queryHelpers.queryRun(
      `INSERT INTO initiative_closure_evidence
        (id, organization_id, closure_request_id, initiative_id, evidence_type, evidence_ref_id, notes, added_by, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.orgId,
        input.closureRequestId,
        input.initiativeId,
        input.evidenceType,
        input.evidenceRefId,
        input.notes || null,
        input.actorId,
        input.idempotencyKey || null,
      ]
    );
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === '23505') {
      // Either the idempotency key OR the (request, type, ref) dedup index —
      // both mean "this exact evidence link already exists", so re-select by
      // the natural key rather than the idempotency key alone.
      const winner = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM initiative_closure_evidence
         WHERE closure_request_id = ? AND evidence_type = ? AND evidence_ref_id = ?`,
        [input.closureRequestId, input.evidenceType, input.evidenceRefId]
      );
      if (winner) return { id: winner.id, idempotent: true as const };
    }
    throw err;
  }

  return { id, idempotent: false as const };
}

// ---------------------------------------------------------------------------
// Readiness checklist — computed, not stored. Used both by the submit gate
// and by a read-only "what's missing" endpoint the UI polls.
// ---------------------------------------------------------------------------

export interface ReadinessChecklistItem {
  key: string;
  label: string;
  satisfied: boolean;
}

export interface ReadinessChecklist {
  items: ReadinessChecklistItem[];
  ready: boolean;
  incompleteTaskCount: number;
  incompleteMilestoneCount: number;
}

export async function getReadinessChecklist(
  orgId: string,
  initiativeId: string,
  closureRequestId: string
): Promise<ReadinessChecklist> {
  const request = await queryHelpers.queryOne<{
    closureRationale: string | null;
    outcomeSummary: string | null;
    exceptionsWaivers: string | null;
  }>(
    `SELECT closure_rationale as "closureRationale", outcome_summary as "outcomeSummary",
            exceptions_waivers as "exceptionsWaivers"
     FROM initiative_closure_requests WHERE id = ? AND initiative_id = ? AND organization_id = ?`,
    [closureRequestId, initiativeId, orgId]
  );
  if (!request) fail('CLOSURE_REQUEST_NOT_FOUND', 'Closure request not found', 404);

  const evidenceCountRow = await queryHelpers.queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM initiative_closure_evidence WHERE closure_request_id = ?`,
    [closureRequestId]
  );
  const evidenceCount = Number(evidenceCountRow?.count || 0);

  // NEEDS_PRODUCT_DECISION: whether ALL tasks/milestones must be complete
  // before closure, or only those the requester chooses to cite as evidence,
  // is not specified anywhere in the product docs this codebase ships today
  // (confirmed during discovery — no acceptance-criteria/DoD table, no
  // "all items done" rule anywhere in the initiative domain). Rather than
  // invent a hard rule, this gate is deliberately soft: incomplete
  // tasks/milestones are counted and surfaced, and are NOT a hard blocker —
  // but if any exist, `exceptions_waivers` must be non-empty (an explicit,
  // written acknowledgement), satisfying the brief's "required tasks/
  // milestones są zakończone ALBO mają jawne wyjątki" without guessing what
  // "required" means.
  const incompleteTasksRow = await queryHelpers.queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM tasks
     WHERE initiative_id = ? AND organization_id = ?
       AND LOWER(COALESCE(status, '')) NOT IN ('done', 'completed', 'cancelled')`,
    [initiativeId, orgId]
  );
  const incompleteMilestonesRow = await queryHelpers.queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM initiative_milestones
     WHERE initiative_id = ? AND organization_id = ?
       AND UPPER(COALESCE(status, '')) NOT IN ('COMPLETED')`,
    [initiativeId, orgId]
  );
  const incompleteTaskCount = Number(incompleteTasksRow?.count || 0);
  const incompleteMilestoneCount = Number(incompleteMilestonesRow?.count || 0);
  const hasIncompleteItems = incompleteTaskCount + incompleteMilestoneCount > 0;
  const hasExceptionsWaivers = Boolean(
    request.exceptionsWaivers &&
    String(request.exceptionsWaivers).trim() !== '' &&
    String(request.exceptionsWaivers).trim() !== '[]' &&
    String(request.exceptionsWaivers).trim() !== '{}'
  );

  const items: ReadinessChecklistItem[] = [
    {
      key: 'closureRationale',
      label: 'Closure rationale provided',
      satisfied: Boolean(request.closureRationale && request.closureRationale.trim() !== ''),
    },
    {
      key: 'outcomeSummary',
      label: 'Outcome summary provided',
      satisfied: Boolean(request.outcomeSummary && request.outcomeSummary.trim() !== ''),
    },
    {
      key: 'evidenceMinimumTwo',
      label: 'At least two evidence references attached',
      satisfied: evidenceCount >= 2,
    },
    {
      key: 'incompleteItemsExplained',
      label: hasIncompleteItems
        ? `${incompleteTaskCount + incompleteMilestoneCount} incomplete task(s)/milestone(s) require an explicit exception note`
        : 'All tasks/milestones complete',
      satisfied: !hasIncompleteItems || hasExceptionsWaivers,
    },
  ];

  return {
    items,
    ready: items.every((i) => i.satisfied),
    incompleteTaskCount,
    incompleteMilestoneCount,
  };
}

export interface SubmitClosureRequestInput {
  orgId: string;
  initiativeId: string;
  closureRequestId: string;
  actorId: string;
  closureRationale?: string;
  outcomeSummary?: string;
  exceptionsWaivers?: unknown;
}

export async function submitClosureRequest(input: SubmitClosureRequestInput) {
  const initiative = await assertInitiativeInOrg(input.orgId, input.initiativeId);
  const request = await loadClosureRequest(input.orgId, input.initiativeId, input.closureRequestId);
  if (request.status !== 'draft' && request.status !== 'returned') {
    fail(
      'CLOSURE_REQUEST_NOT_EDITABLE',
      `Only draft/returned requests can be submitted (current: ${request.status})`,
      409
    );
  }

  // Persist any last-edit fields the caller supplied before evaluating
  // readiness, so the readiness check reflects what is about to be submitted.
  if (
    input.closureRationale !== undefined ||
    input.outcomeSummary !== undefined ||
    input.exceptionsWaivers !== undefined
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (input.closureRationale !== undefined) {
      sets.push('closure_rationale = ?');
      params.push(input.closureRationale);
    }
    if (input.outcomeSummary !== undefined) {
      sets.push('outcome_summary = ?');
      params.push(input.outcomeSummary);
    }
    if (input.exceptionsWaivers !== undefined) {
      sets.push('exceptions_waivers = ?');
      params.push(JSON.stringify(input.exceptionsWaivers));
    }
    sets.push('updated_at = ?', 'version = version + 1');
    params.push(new Date().toISOString(), input.closureRequestId, input.orgId);
    await queryHelpers.queryRun(
      `UPDATE initiative_closure_requests SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );
  }

  const readiness = await getReadinessChecklist(
    input.orgId,
    input.initiativeId,
    input.closureRequestId
  );
  if (!readiness.ready) {
    fail('CLOSURE_NOT_READY', 'Closure request is not ready to submit', 422, {
      checklist: readiness.items,
    });
  }

  // Snapshot acceptance criteria + completed items at the moment of submit —
  // this is what an approver reviews and what stays immutable afterward.
  const successCriteriaRow = await queryHelpers.queryOne<{ successCriteria: string | null }>(
    `SELECT success_criteria as "successCriteria" FROM initiatives WHERE id = ? AND organization_id = ?`,
    [input.initiativeId, input.orgId]
  );
  const completedItemsRows = await queryHelpers.queryAll<{
    id: string;
    title: string;
    kind: string;
  }>(
    `SELECT id, title, 'task' as kind FROM tasks
       WHERE initiative_id = ? AND organization_id = ? AND LOWER(COALESCE(status,'')) IN ('done','completed')
     UNION ALL
     SELECT id, name as title, 'milestone' as kind FROM initiative_milestones
       WHERE initiative_id = ? AND organization_id = ? AND UPPER(COALESCE(status,'')) = 'COMPLETED'`,
    [input.initiativeId, input.orgId, input.initiativeId, input.orgId]
  );

  await queryHelpers.queryRun(
    `UPDATE initiative_closure_requests
     SET status = 'submitted',
         acceptance_criteria_snapshot = ?,
         completed_items_snapshot = ?,
         approval_status = 'pending',
         approver_id = NULL,
         approved_at = NULL,
         returned_at = NULL,
         expected_initiative_version = ?,
         updated_at = ?,
         version = version + 1
     WHERE id = ? AND organization_id = ?`,
    [
      successCriteriaRow?.successCriteria || '[]',
      JSON.stringify(completedItemsRows || []),
      initiative.updatedAt,
      new Date().toISOString(),
      input.closureRequestId,
      input.orgId,
    ]
  );

  await writeInitiativeHistory({
    initiativeId: input.initiativeId,
    action: 'closure_requested',
    oldValue: null,
    newValue: { closureRequestId: input.closureRequestId },
    changedBy: input.actorId,
    notes: input.closureRationale || null,
  });

  return { id: input.closureRequestId, status: 'submitted' as const };
}

export interface ReturnClosureRequestInput {
  orgId: string;
  initiativeId: string;
  closureRequestId: string;
  actorId: string;
  reviewRationale: string;
}

export async function returnClosureRequest(input: ReturnClosureRequestInput) {
  await assertInitiativeInOrg(input.orgId, input.initiativeId);
  if (!input.reviewRationale || !input.reviewRationale.trim()) {
    fail(
      'RETURN_RATIONALE_REQUIRED',
      'A review rationale is required to return a closure request',
      400
    );
  }
  await assertActorCanApprove(input.orgId, input.initiativeId, input.actorId);

  const request = await loadClosureRequest(input.orgId, input.initiativeId, input.closureRequestId);
  if (request.status !== 'submitted') {
    fail(
      'CLOSURE_REQUEST_NOT_SUBMITTED',
      `Only a submitted request can be returned (current: ${request.status})`,
      409
    );
  }

  await queryHelpers.queryRun(
    `UPDATE initiative_closure_requests
     SET status = 'returned', approval_status = 'returned', approver_id = ?,
         returned_at = ?, review_rationale = ?, updated_at = ?, version = version + 1
     WHERE id = ? AND organization_id = ? AND status = 'submitted'`,
    [
      input.actorId,
      new Date().toISOString(),
      input.reviewRationale,
      new Date().toISOString(),
      input.closureRequestId,
      input.orgId,
    ]
  );

  await writeInitiativeHistory({
    initiativeId: input.initiativeId,
    action: 'closure_returned',
    oldValue: null,
    newValue: { closureRequestId: input.closureRequestId },
    changedBy: input.actorId,
    notes: input.reviewRationale,
  });

  return { id: input.closureRequestId, status: 'returned' as const };
}

/**
 * Exported (EXE-09, minimal additive visibility change only — no behavior
 * change) so a new route acting on the SAME initiative-closure capability
 * (retrying a stuck Results/Finance delivery for an already-closed
 * initiative) can reuse the EXACT same approver-role gate instead of
 * inventing a parallel one. Same semantics: "can this actor act on this
 * initiative's closure."
 */
export async function assertActorCanApprove(orgId: string, initiativeId: string, actorId: string) {
  const access = await resolveInitiativeAccessContext(orgId, initiativeId, actorId);
  const permitted = access.effectiveRoles.some((r) => CLOSURE_APPROVER_ROLES.has(r));
  if (!permitted) {
    fail(
      'CLOSURE_APPROVER_ROLE_REQUIRED',
      'Your role is not permitted to approve or return a closure request on this initiative',
      403,
      { effectiveRoles: access.effectiveRoles }
    );
  }
}

// ---------------------------------------------------------------------------
// Audit write — reuses the established initiative_history convention
// (InitiativeController.ts / execution-control.routes.ts) so closure events
// appear in the SAME GET /:id/history the front end already reads. See file
// header for why this is NOT part of the same DB transaction as the writes
// above (queryHelpers.queryRun goes through the shared pool, not a pinned
// connection) — logged loudly (not silently swallowed) on failure, matching
// the fix applied to EXE-06's progress/reforecast audit writes.
// ---------------------------------------------------------------------------

async function writeInitiativeHistory(params: {
  initiativeId: string;
  action: string;
  oldValue: unknown;
  newValue: unknown;
  changedBy: string;
  notes: string | null;
  idempotencyKey?: string | null;
}) {
  try {
    await queryHelpers.queryRun(
      `INSERT INTO initiative_history (id, initiative_id, action, old_value, new_value, changed_by, notes, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.initiativeId,
        params.action,
        params.oldValue !== null ? JSON.stringify(params.oldValue) : null,
        params.newValue !== null ? JSON.stringify(params.newValue) : null,
        params.changedBy,
        params.notes,
        params.idempotencyKey || null,
      ]
    );
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code !== '23505') {
      logger.error('[initiativeClosureService] failed to write initiative_history', {
        action: params.action,
        initiativeId: params.initiativeId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Approval — the atomic-within-each-unit core. See file header.
// ---------------------------------------------------------------------------

export interface ApproveClosureRequestInput {
  orgId: string;
  initiativeId: string;
  closureRequestId: string;
  actorId: string;
  actorRole?: string | null;
  reviewRationale?: string;
  idempotencyKey?: string;

  // Test-only crash-injection seam (Codex review: prove the honest two-unit
  // recovery model actually recovers, not just that it's documented as
  // theoretically sound). NEVER populated by initiativeClosure.routes.ts —
  // that adapter passes only the named HTTP-body fields above, so these
  // cannot be reached from a request body. Mirrors the pattern of the
  // canonical engine's own `__testSyncHook` (initiativeTransitionService.ts)
  // without touching that frozen file.
  __testFailBeforeUnit1Commit?: boolean; // throws inside Unit 1's own transaction, before its final writes -> ROLLBACK, nothing persisted (recovery scenario C).
  __testFailAfterUnit1?: boolean; // throws after Unit 1 commits, before Unit 2 (the engine) is called (recovery scenario A).
  __testFailAfterEngineBeforeFinalize?: boolean; // throws after Unit 2 (the engine) succeeds, before the finalize write (recovery scenario B).
}

export type ApproveClosureRequestResult =
  | { ok: true; idempotent: boolean; status: 'done'; initiativeHistoryId: string | null }
  | { ok: true; idempotent: true; status: 'approved_pending_transition' | 'transition_failed' };

export async function approveClosureRequest(
  input: ApproveClosureRequestInput
): Promise<ApproveClosureRequestResult> {
  await assertInitiativeInOrg(input.orgId, input.initiativeId);
  await assertActorCanApprove(input.orgId, input.initiativeId, input.actorId);

  // Recover from a prior crash (real or test-injected) before attempting a
  // fresh approval — if a PREVIOUS call left this request stuck in
  // approved_pending_transition/transition_failed, either finalize it (the
  // engine already succeeded) or retry Unit 2 (the engine was never
  // reached). See reconcileClosureRequestStatus doc comment. This call is a
  // no-op for the normal 'draft'/'submitted' path.
  await reconcileClosureRequestStatus(input.orgId, input.closureRequestId);

  // ---- Unit 1: durably record the approval decision (own transaction) ----
  const unit1 = await withPgTransaction(async (client) => {
    return approveUnit1OnClient(client, input);
  });

  if (unit1.kind === 'already_done') {
    return {
      ok: true,
      idempotent: true,
      status: 'done',
      initiativeHistoryId: unit1.initiativeHistoryId,
    };
  }
  if (unit1.kind === 'already_pending') {
    // A concurrent/retried call already committed unit 1 and either is mid
    // -flight on unit 2 or crashed before reconciling. Let the caller re-poll
    // (GET reconciles on read) rather than racing a second engine call here.
    return { ok: true, idempotent: true, status: unit1.status };
  }

  if (input.__testFailAfterUnit1) {
    throw new Error('TEST_INJECTED_FAILURE_AFTER_UNIT1_BEFORE_ENGINE');
  }

  // ---- Unit 2: the canonical engine performs the actual transition ----
  let transitionResult;
  try {
    transitionResult = await executeInitiativeTransition({
      orgId: input.orgId,
      initiativeId: input.initiativeId,
      actorId: input.actorId,
      actorRole: input.actorRole || undefined,
      nextStatusInput: 'DONE',
      reason: input.reviewRationale || 'Closure approved',
      expectedCurrentStatus: 'EXECUTING',
      actor: { kind: 'user' },
    });
  } catch (err) {
    await markTransitionFailed(input.closureRequestId, input.orgId, err);
    throw err;
  }

  if (!transitionResult.ok) {
    await markTransitionFailed(input.closureRequestId, input.orgId, transitionResult);
    fail(
      'CLOSURE_TRANSITION_REJECTED',
      'The canonical transition engine rejected the DONE transition',
      transitionResult.statusCode || 409,
      { engineError: transitionResult.body }
    );
  }

  if (input.__testFailAfterEngineBeforeFinalize) {
    throw new Error('TEST_INJECTED_FAILURE_AFTER_ENGINE_BEFORE_FINALIZE');
  }

  // ---- Reconciliation: finalize the closure request to `done` ----
  const initiativeHistoryId = await finalizeClosureRequestDone(
    input.closureRequestId,
    input.orgId,
    transitionResult.correlationId
  );

  return { ok: true, idempotent: false, status: 'done', initiativeHistoryId };
}

type Unit1Result =
  | { kind: 'proceed' }
  | { kind: 'already_done'; initiativeHistoryId: string | null }
  | { kind: 'already_pending'; status: 'approved_pending_transition' | 'transition_failed' };

async function approveUnit1OnClient(
  client: PgTransactionClient,
  input: ApproveClosureRequestInput
): Promise<Unit1Result> {
  // Row-lock THIS closure request — serializes concurrent double-approve
  // attempts on the SAME request to one winner; the loser sees the
  // already-updated row once the lock releases.
  const rows = await client.query<{
    id: string;
    status: string;
    expectedInitiativeVersion: string | null;
    transitionAuditRef: string | null;
  }>(
    `SELECT id, status, expected_initiative_version as "expectedInitiativeVersion",
            transition_audit_ref as "transitionAuditRef"
     FROM initiative_closure_requests
     WHERE id = ? AND initiative_id = ? AND organization_id = ?
     FOR UPDATE`,
    [input.closureRequestId, input.initiativeId, input.orgId]
  );
  const request = rows.rows[0];
  if (!request) fail('CLOSURE_REQUEST_NOT_FOUND', 'Closure request not found', 404);

  if (request.status === 'done') {
    return { kind: 'already_done', initiativeHistoryId: request.transitionAuditRef };
  }
  if (request.status === 'approved_pending_transition' || request.status === 'transition_failed') {
    return { kind: 'already_pending', status: request.status };
  }
  if (request.status !== 'submitted') {
    fail(
      'CLOSURE_REQUEST_NOT_SUBMITTED',
      `Only a submitted request can be approved (current: ${request.status})`,
      409
    );
  }

  if (input.idempotencyKey) {
    const dup = await client.query<{ id: string }>(
      `SELECT id FROM initiative_history WHERE initiative_id = ? AND action = 'closure_approved' AND idempotency_key = ?`,
      [input.initiativeId, input.idempotencyKey]
    );
    if (dup.rows[0]) {
      // We already recorded this exact approval decision before (a retry
      // arrived after unit 1 committed but the caller never saw the
      // response). Treat as already-pending so the caller re-polls instead
      // of re-running the engine call from a fresh client.
      return { kind: 'already_pending', status: 'approved_pending_transition' };
    }
  }

  // Stale-version guard: the initiative must not have changed since this
  // closure request last snapshotted it.
  const initiativeRows = await client.query<{ status: string; updatedAt: string }>(
    `SELECT status, updated_at as "updatedAt" FROM initiatives WHERE id = ? AND organization_id = ?`,
    [input.initiativeId, input.orgId]
  );
  const initiative = initiativeRows.rows[0];
  if (!initiative) fail('INITIATIVE_NOT_FOUND', 'Initiative not found', 404);
  // Compare by parsed instant, not string representation: `initiative.updatedAt`
  // comes back from this pinned pg connection as a JS Date (node-pg's default
  // timestamptz type parser), while `expectedInitiativeVersion` was written into
  // a TEXT column from a Date parameter and round-trips as an ISO-ish string in
  // a *different* textual shape. `String(Date)` vs that stored string can never
  // match even when both denote the same instant — compare `.getTime()` instead.
  if (
    request.expectedInitiativeVersion &&
    new Date(initiative.updatedAt).getTime() !==
      new Date(request.expectedInitiativeVersion).getTime()
  ) {
    fail(
      'STALE_VERSION',
      'The initiative has changed since this closure request was submitted',
      409,
      {
        expected: request.expectedInitiativeVersion,
        actual: initiative.updatedAt,
      }
    );
  }

  if (input.__testFailBeforeUnit1Commit) {
    // Thrown INSIDE Unit 1's own withPgTransaction callback, after the row
    // lock and all validation but before any write in this function — the
    // caller's ROLLBACK undoes the transaction, proving nothing partial is
    // ever left behind (recovery scenario C).
    throw new Error('TEST_INJECTED_FAILURE_BEFORE_UNIT1_COMMIT');
  }

  await client.query(
    `UPDATE initiative_closure_requests
     SET status = 'approved_pending_transition', approval_status = 'approved', approver_id = ?,
         approved_at = ?, review_rationale = ?, updated_at = ?, version = version + 1
     WHERE id = ? AND organization_id = ? AND status = 'submitted'`,
    [
      input.actorId,
      new Date().toISOString(),
      input.reviewRationale || null,
      new Date().toISOString(),
      input.closureRequestId,
      input.orgId,
    ]
  );

  await client.query(
    `INSERT INTO initiative_history (id, initiative_id, action, old_value, new_value, changed_by, notes, idempotency_key)
     VALUES (?, ?, 'closure_approved', NULL, ?, ?, ?, ?)`,
    [
      uuidv4(),
      input.initiativeId,
      JSON.stringify({ closureRequestId: input.closureRequestId }),
      input.actorId,
      input.reviewRationale || null,
      input.idempotencyKey || null,
    ]
  );

  return { kind: 'proceed' };
}

async function markTransitionFailed(closureRequestId: string, orgId: string, err: unknown) {
  try {
    await queryHelpers.queryRun(
      `UPDATE initiative_closure_requests
       SET status = 'transition_failed', updated_at = ?, version = version + 1
       WHERE id = ? AND organization_id = ? AND status = 'approved_pending_transition'`,
      [new Date().toISOString(), closureRequestId, orgId]
    );
  } catch (updateErr) {
    logger.error('[initiativeClosureService] failed to mark closure request transition_failed', {
      closureRequestId,
      error: updateErr instanceof Error ? updateErr.message : String(updateErr),
    });
  }
  logger.error(
    '[initiativeClosureService] canonical transition rejected/failed during closure approval',
    {
      closureRequestId,
      error: err instanceof Error ? err.message : JSON.stringify(err),
    }
  );
}

async function finalizeClosureRequestDone(
  closureRequestId: string,
  orgId: string,
  correlationId?: string
): Promise<string | null> {
  // The canonical engine writes exactly one initiative_history row per
  // transition with action='status_changed' and a `notes` JSON payload
  // containing the SAME correlationId returned to this caller
  // (initiativeTransitionService.ts, the 'status_changed' INSERT) — match on
  // that for a precise, unambiguous audit reference rather than "most
  // recent row for this initiative" (which could be wrong if another write
  // races in between).
  let auditRow: { id: string } | null = null;
  if (correlationId) {
    auditRow = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM initiative_history
       WHERE initiative_id = (SELECT initiative_id FROM initiative_closure_requests WHERE id = ?)
         AND action = 'status_changed'
         AND notes::jsonb->>'correlationId' = ?
       ORDER BY changed_at DESC LIMIT 1`,
      [closureRequestId, correlationId]
    );
  }
  if (!auditRow) {
    // Reconciliation-on-read path (reconcileClosureRequestStatus) has no
    // correlationId to hand — fall back to "most recent status_changed row
    // for this initiative", which is the best available evidence without one.
    auditRow = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM initiative_history
       WHERE initiative_id = (SELECT initiative_id FROM initiative_closure_requests WHERE id = ?)
         AND action = 'status_changed'
       ORDER BY changed_at DESC LIMIT 1`,
      [closureRequestId]
    );
  }
  await queryHelpers.queryRun(
    `UPDATE initiative_closure_requests
     SET status = 'done', transition_audit_ref = ?, updated_at = ?, version = version + 1
     WHERE id = ? AND organization_id = ?`,
    [auditRow?.id || null, new Date().toISOString(), closureRequestId, orgId]
  );
  return auditRow?.id || null;
}

/**
 * Self-healing reconciliation: called on every GET of a closure request, and
 * at the top of every fresh `approveClosureRequest` call (so a retry via
 * POST .../approve heals too, not just a poll via GET). If the request is
 * stuck in `approved_pending_transition`/`transition_failed`, there are
 * exactly two ways it got there and this function resolves both:
 *
 *   (B) Unit 2 (the engine) already succeeded but the finalize write never
 *       ran (process crashed between the engine call and
 *       `finalizeClosureRequestDone`) — the initiative is ALREADY DONE.
 *       Just finalize; no second engine call.
 *
 *   (A) Unit 2 was NEVER called (process crashed between Unit 1's commit and
 *       the engine call) — the initiative is still NOT DONE. Retry Unit 2
 *       here. This is safe even if another process is concurrently
 *       attempting the same thing: the canonical engine takes its own row
 *       lock on `initiatives` and checks `expectedCurrentStatus`, so a
 *       second concurrent call either serializes behind the first (and then
 *       sees the initiative already DONE, a clean no-op via the `!ok` branch
 *       below re-checking live status) or the first was the one that never
 *       actually started, and this one proceeds — never two real
 *       transitions, never two audit rows for one approval.
 */
export async function reconcileClosureRequestStatus(orgId: string, closureRequestId: string) {
  const request = await queryHelpers.queryOne<{
    id: string;
    status: string;
    initiativeId: string;
    approverId: string | null;
    reviewRationale: string | null;
  }>(
    `SELECT id, status, initiative_id as "initiativeId", approver_id as "approverId",
            review_rationale as "reviewRationale"
     FROM initiative_closure_requests
     WHERE id = ? AND organization_id = ?`,
    [closureRequestId, orgId]
  );
  if (!request) return;
  if (request.status !== 'approved_pending_transition' && request.status !== 'transition_failed')
    return;

  const initiative = await queryHelpers.queryOne<{ status: string }>(
    `SELECT status FROM initiatives WHERE id = ? AND organization_id = ?`,
    [request.initiativeId, orgId]
  );
  if (!initiative) return;

  if (initiative.status === 'DONE') {
    await finalizeClosureRequestDone(closureRequestId, orgId);
    return;
  }

  // Scenario A: the initiative is not DONE, so Unit 2 was never (successfully)
  // called. approver_id is set by Unit 1's own write before this status is
  // ever reachable, so it is always present here — but guard anyway rather
  // than crash a reconciliation call on unexpected state.
  if (!request.approverId) return;

  let transitionResult;
  try {
    transitionResult = await executeInitiativeTransition({
      orgId,
      initiativeId: request.initiativeId,
      actorId: request.approverId,
      nextStatusInput: 'DONE',
      reason: request.reviewRationale || 'Closure approved (reconciliation retry)',
      expectedCurrentStatus: 'EXECUTING',
      actor: { kind: 'user' },
    });
  } catch (err) {
    await markTransitionFailed(closureRequestId, orgId, err);
    return;
  }

  if (!transitionResult.ok) {
    // Re-check live status: a concurrent caller may have completed the
    // transition between our read above and this call being rejected for
    // "current status is no longer EXECUTING" — that is success, not
    // failure, from this reconciliation's point of view.
    const recheck = await queryHelpers.queryOne<{ status: string }>(
      `SELECT status FROM initiatives WHERE id = ? AND organization_id = ?`,
      [request.initiativeId, orgId]
    );
    if (recheck?.status === 'DONE') {
      await finalizeClosureRequestDone(closureRequestId, orgId);
      return;
    }
    await markTransitionFailed(closureRequestId, orgId, transitionResult);
    return;
  }

  await finalizeClosureRequestDone(closureRequestId, orgId, transitionResult.correlationId);
}
