/**
 * MW-DEC-001 — Decision OUTCOME lifecycle (the `decisions.status` axis).
 *
 * Two-axis status (MY_WORK_TASKS_AND_DECISIONS_OPERATING_SYSTEM.md §8
 * "Zakazy projektowe": "brak jednego pola status, które miesza wynik decyzji
 * z procesem approval"):
 *   - `decisions.status`          — OUTCOME axis (this file). What was
 *     actually decided.
 *   - `decisions.workflow_status` — PROCESS axis (decisionWorkflowService.ts,
 *     untouched by this packet). Whether the write-up has been drafted/
 *     reviewed/approved/published.
 *
 * These two axes are independent and this file does not read or write
 * `workflow_status`. A decision can be escalated (existing
 * DecisionController.escalateDecision, untouched) or cancelled (existing
 * DecisionController.deleteDecision — soft archive, untouched) through their
 * own dedicated endpoints; this module only governs the outcome transitions
 * reachable through PATCH/PUT /api/decisions/:id/decide and the terminal-
 * state guard reused by PUT /api/decisions/:id.
 */

/** Wire values as stored in `decisions.status` (lowercase). */
export const DECISION_OUTCOME_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'returned_for_clarification',
  'escalated',
  'cancelled',
] as const;

export type DecisionOutcomeStatus = (typeof DECISION_OUTCOME_STATUSES)[number];

/**
 * Terminal = no further outcome mutation is possible through `decide()` or
 * `updateDecision()`. `escalated`/`cancelled` are deliberately NOT terminal
 * here: escalation is a routing concern (existing escalateDecision endpoint,
 * untouched) that must still resolve to approved/rejected eventually, and
 * cancellation is its own already-idempotent terminal handled entirely by
 * deleteDecision (which already no-ops on a second cancel).
 */
export function isTerminalDecisionOutcome(status: string | null | undefined): boolean {
  const s = String(status || '').toLowerCase();
  return s === 'approved' || s === 'rejected';
}

/**
 * Statuses `decide()` is allowed to set. `pending` is included so a decision
 * `returned_for_clarification` can be resubmitted back to pending by its
 * owner (see updateDecision — resubmission is a plain field update, not a
 * new endpoint, since "owner edits fields incl. status while not-yet-decided"
 * is exactly what updateDecision already does).
 */
const DECIDE_TARGET_STATUSES: ReadonlySet<string> = new Set([
  'pending',
  'approved',
  'rejected',
  'returned_for_clarification',
]);

export function isValidDecideTarget(status: string | null | undefined): boolean {
  return DECIDE_TARGET_STATUSES.has(String(status || '').toLowerCase());
}

/**
 * Whether `decision_rationale` is a required, non-empty field for this
 * target status. Required exactly at APPROVED/REJECTED (product contract
 * DECISIONS_COMPLETE_PRODUCT_CONTRACT.md §4 "wybrany wynik, rationale,
 * warunki"); `returned_for_clarification` and `pending` do not require it
 * (a clarification request typically carries the ask in `notes`, not a
 * rationale for an outcome that hasn't happened yet).
 */
export function requiresRationale(targetStatus: string): boolean {
  const s = targetStatus.toLowerCase();
  return s === 'approved' || s === 'rejected';
}

export interface OutcomeTransitionResult {
  allowed: boolean;
  reason?: string;
  code?: 'INVALID_TARGET' | 'ALREADY_FINALIZED' | 'RATIONALE_REQUIRED';
}

/**
 * Pure validation for one `decide()` call. Does not touch the database —
 * callers pass in the row's current status and the caller-provided rationale
 * text (already trimmed).
 */
export function validateDecideTransition(input: {
  currentStatus: string | null | undefined;
  targetStatus: string;
  rationaleText: string;
}): OutcomeTransitionResult {
  const { currentStatus, targetStatus, rationaleText } = input;

  if (!isValidDecideTarget(targetStatus)) {
    return { allowed: false, code: 'INVALID_TARGET', reason: `Invalid decision target: ${targetStatus}` };
  }

  // Hard rule (non-negotiable per mission brief): a decision already at a
  // terminal outcome (approved/rejected) can never be silently moved again —
  // not back to pending, not to the other terminal, not re-decided with a
  // new rationale. Any further transition attempt is rejected outright.
  if (isTerminalDecisionOutcome(currentStatus)) {
    return {
      allowed: false,
      code: 'ALREADY_FINALIZED',
      reason: `Decision is already ${String(currentStatus).toLowerCase()} and cannot be transitioned again`,
    };
  }

  if (requiresRationale(targetStatus) && rationaleText.trim() === '') {
    return { allowed: false, code: 'RATIONALE_REQUIRED', reason: 'Decision rationale is required' };
  }

  return { allowed: true };
}

/**
 * Terminal-state guard reused by PUT /api/decisions/:id (updateDecision).
 * Per mission brief: "A decision in APPROVED or REJECTED ... can never
 * silently return to an earlier state — any further mutation attempt must be
 * rejected." Interpreted conservatively: once terminal, the whole
 * updateDecision surface (not just its `status` field) is frozen — owner/
 * priority/title/etc. edits on an already-decided row are exactly the kind
 * of silent state drift the mission calls out. Comments/alternatives/risks
 * are governed separately (decisionCollaborationService.ts) and are NOT
 * subject to this guard — see that file's freeze rule for alternatives/
 * risks specifically (comments remain postable after finalization).
 */
export function assertNotFinalized(currentStatus: string | null | undefined): OutcomeTransitionResult {
  if (isTerminalDecisionOutcome(currentStatus)) {
    return {
      allowed: false,
      code: 'ALREADY_FINALIZED',
      reason: `Decision is already ${String(currentStatus).toLowerCase()} and can no longer be edited`,
    };
  }
  return { allowed: true };
}
