/**
 * ideaDecisionGovernance — decision log model for Ideas.
 * Program D / epic E08, master program §6.4 (Decision governance).
 *
 * WHAT EXISTED BEFORE THIS FILE (2026-08-10 finding):
 * the Table tool's "Log decyzji" (Decision log) view is a single `select`
 * column (`buildDecisionColumnSeedPlan` in `ViewSetupEmptyState.tsx`) with
 * four option VALUES — open / made / deferred / rejected — that the saved
 * view groups rows by. That is a status chip on a row, not a decision log:
 * no question, no alternatives, no recommendation, no named approver, no
 * rationale field, no conditions, no expiry/review date, no history, and
 * "made" is not the same shape as §6.4's four outcomes (`Approve` / `Reject`
 * / `Return for evidence` / `Defer` — the seed plan has no "needs more
 * evidence" outcome at all, and "made" conflates approve+reject into one
 * label). There is also no gate anywhere: nothing stops a row from being set
 * to "made" with zero evidence or rationale attached.
 *
 * Separately, Consultify already has an UNRELATED "Decision" object
 * (`DecisionsKanbanBoard.tsx`, `DecisionDetailModal.tsx`, Execution module)
 * with its own status pipeline (pending/escalated/approved/rejected/
 * deferred) and its own `Api.updateDecision`. That object also has no
 * "return for evidence" outcome and mutates `status` in place rather than
 * versioning on reopen. It is a different artefact (Execution decisions, not
 * an Idea's business-case decision log) and out of scope for this file, but
 * is worth the orchestrator's attention if E08's model is meant to unify with
 * it later.
 *
 * This file is the missing decision-log model, as pure/storage-agnostic
 * logic: four distinct outcomes (not a boolean), mandatory-evidence and
 * stale-financials approval gating, reopen-creates-a-new-version semantics,
 * and explicit role permissions. The host component owns persistence and UI.
 */

// ─────────────────────────────────────────────────────────────────────────
// Outcomes — "Approve, Reject, Return for evidence and Defer are distinct
// outcomes" (§6.4), not a boolean.
// ─────────────────────────────────────────────────────────────────────────

export const DECISION_OUTCOMES = ['approved', 'rejected', 'returned_for_evidence', 'deferred'] as const;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];

/** A decision entry that has not been ruled on yet. Distinct from all four
 *  real outcomes so "nobody has decided" is never confused with "deferred". */
export type DecisionState = DecisionOutcome | 'pending';

export interface DecisionAlternative {
  label: string;
  summary?: string;
}

export interface DecisionLogEntry {
  id: string;
  ideaId: string;
  /** 1-based. Bumped only by `reopenDecision` — never edited in place. */
  version: number;
  /** Id of the entry this one reopens, if any. */
  supersedesId?: string;
  /** Set on the OLD entry once a newer version exists — the only field a
   *  "closed" entry is ever allowed to gain after the fact; every other
   *  field on a ruled entry is immutable (see `reopenDecision`). */
  supersededById?: string;

  question: string;
  alternatives: DecisionAlternative[];
  recommendation: string;
  approver: string;

  decision: DecisionState;
  rationale?: string;
  conditions?: string;
  expiryDate?: string;
  reviewDate?: string;

  decidedAt?: string;
  decidedBy?: string;

  /** Evidence actually attached (ids/urls/refs — shape owned by the host). */
  evidenceRefs: string[];
  /** Evidence the approver has marked mandatory before `approved` is legal. */
  requiredEvidenceKeys: string[];

  createdAt: string;
  createdBy?: string;
}

export function createDecisionEntry(opts: {
  id: string;
  ideaId: string;
  question: string;
  alternatives: DecisionAlternative[];
  recommendation: string;
  approver: string;
  requiredEvidenceKeys?: string[];
  evidenceRefs?: string[];
  expiryDate?: string;
  reviewDate?: string;
  createdBy?: string;
  now?: string;
}): DecisionLogEntry {
  return {
    id: opts.id,
    ideaId: opts.ideaId,
    version: 1,
    question: opts.question,
    alternatives: opts.alternatives,
    recommendation: opts.recommendation,
    approver: opts.approver,
    decision: 'pending',
    evidenceRefs: opts.evidenceRefs ?? [],
    requiredEvidenceKeys: opts.requiredEvidenceKeys ?? [],
    expiryDate: opts.expiryDate,
    reviewDate: opts.reviewDate,
    createdAt: opts.now ?? new Date().toISOString(),
    createdBy: opts.createdBy,
  };
}

export interface DecisionValidationError {
  field: string;
  message: string;
}

/** Structural validation only (required fields for the CURRENT state) —
 *  does not evaluate the approval gate (`evaluateApprovalGate`), which is a
 *  separate, outcome-specific check. */
export function validateDecisionEntry(entry: DecisionLogEntry): DecisionValidationError[] {
  const errors: DecisionValidationError[] = [];
  if (!entry.question.trim()) errors.push({ field: 'question', message: 'Question is required.' });
  if (!entry.recommendation.trim())
    errors.push({ field: 'recommendation', message: 'Recommendation is required.' });
  if (!entry.approver.trim()) errors.push({ field: 'approver', message: 'Approver is required.' });
  if (entry.decision !== 'pending' && !(entry.rationale ?? '').trim()) {
    errors.push({ field: 'rationale', message: 'Rationale is required once a decision has been ruled on.' });
  }
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────
// Roles / permissions — "role/permission behavior must be explicit"
// ─────────────────────────────────────────────────────────────────────────

export const DECISION_ROLES = ['viewer', 'contributor', 'approver', 'admin'] as const;
export type DecisionRole = (typeof DECISION_ROLES)[number];

/**
 * Who may record which outcome. `viewer` may record none (read-only).
 * `contributor` may only move a decision to the two non-final, evidence-
 * gathering outcomes (`returned_for_evidence`, `deferred`) — the two calls
 * that carry real authority (`approved`, `rejected`) are reserved for
 * `approver`/`admin`. This is an explicit table, not an inferred default, so
 * a reviewer can audit it directly rather than reverse-engineer it from code
 * paths.
 */
const OUTCOME_PERMISSIONS: Record<DecisionOutcome, readonly DecisionRole[]> = {
  approved: ['approver', 'admin'],
  rejected: ['approver', 'admin'],
  returned_for_evidence: ['contributor', 'approver', 'admin'],
  deferred: ['contributor', 'approver', 'admin'],
};

export function canRecordOutcome(role: DecisionRole, outcome: DecisionOutcome): boolean {
  return OUTCOME_PERMISSIONS[outcome].includes(role);
}

/** Reopening a ruled decision is an approval-weight action (it un-does a
 *  standing Approve/Reject and starts a fresh version) — same bar as
 *  recording `approved`/`rejected` in the first place. */
export function canReopenDecision(role: DecisionRole): boolean {
  return role === 'approver' || role === 'admin';
}

// ─────────────────────────────────────────────────────────────────────────
// Financial freshness — the cross-dependency interface for the financial
// layer (§7 / master program, built by sibling agents in this program).
// ─────────────────────────────────────────────────────────────────────────

export type FinancialFreshnessStatus = 'fresh' | 'stale' | 'unknown';

export interface FinancialFreshnessResult {
  status: FinancialFreshnessStatus;
  /** ISO timestamp the underlying financial calculation was last computed,
   *  when known. */
  asOf?: string;
  /** Human-readable explanation — required for 'stale'/'unknown' so the gate
   *  (and the UI showing it) never has to invent a reason. */
  reason?: string;
}

/**
 * The predicate this module needs from the financial layer: "is this Idea's
 * financial case valid and fresh enough to approve against?" Kept as a
 * function type (not a hard import) so this file has zero dependency on
 * however the financial layer ends up computed/stored.
 *
 * CONTRACT the orchestrator should wire at merge time: call the real
 * financial-freshness check for `ideaId` and return `'stale'` whenever that
 * layer's own staleness flag is set (see §7/E09 — "invalid/stale state
 * blocks approval" is that layer's own DoD line, this file only consumes the
 * result).
 */
export type FinancialFreshnessProvider = (
  ideaId: string
) => FinancialFreshnessResult | Promise<FinancialFreshnessResult>;

/**
 * Honest default for when the financial layer is not wired in yet: treats
 * unknown as NOT BLOCKING (an idea with no financial case at all — e.g. a
 * pure ops/compliance idea — must still be approvable), but the result is
 * still `'unknown'` with a reason, so callers can and should surface it in
 * the UI rather than pretend the check happened. Never silently promote
 * 'unknown' to 'fresh'.
 */
export const UNWIRED_FINANCIAL_FRESHNESS_PROVIDER: FinancialFreshnessProvider = () => ({
  status: 'unknown',
  reason: 'Financial freshness has not been wired in for this idea yet.',
});

// ─────────────────────────────────────────────────────────────────────────
// Approval gate — "approval is blocked by missing mandatory evidence or
// stale financial calculations"
// ─────────────────────────────────────────────────────────────────────────

export type ApprovalBlockReason =
  | { type: 'missing-evidence'; missingKeys: string[] }
  | { type: 'stale-financials'; asOf?: string; reason?: string };

export interface ApprovalGateResult {
  blocked: boolean;
  blockers: ApprovalBlockReason[];
  /** Non-blocking notices — e.g. financial freshness is 'unknown'. Always
   *  surfaced, never swallowed, per this module's header contract. */
  warnings: string[];
}

/**
 * Evaluates whether `entry` may legally be moved to `approved`. Only
 * evaluated for the `approved` outcome — `rejected`/`returned_for_evidence`/
 * `deferred` are never blocked by evidence or financial state (rejecting an
 * idea, or explicitly asking for more evidence, must always be possible).
 */
export function evaluateApprovalGate(
  entry: DecisionLogEntry,
  opts: { financialFreshness: FinancialFreshnessResult }
): ApprovalGateResult {
  const blockers: ApprovalBlockReason[] = [];
  const warnings: string[] = [];

  const missingKeys = entry.requiredEvidenceKeys.filter((k) => !entry.evidenceRefs.includes(k));
  if (missingKeys.length > 0) {
    blockers.push({ type: 'missing-evidence', missingKeys });
  }

  if (opts.financialFreshness.status === 'stale') {
    blockers.push({
      type: 'stale-financials',
      asOf: opts.financialFreshness.asOf,
      reason: opts.financialFreshness.reason,
    });
  } else if (opts.financialFreshness.status === 'unknown') {
    warnings.push(
      opts.financialFreshness.reason ?? 'Financial freshness could not be determined for this idea.'
    );
  }

  return { blocked: blockers.length > 0, blockers, warnings };
}

// ─────────────────────────────────────────────────────────────────────────
// Recording an outcome
// ─────────────────────────────────────────────────────────────────────────

export class ForbiddenOutcomeError extends Error {}
export class MissingRationaleError extends Error {}
export class DecisionGateBlockedError extends Error {
  blockers: ApprovalBlockReason[];
  constructor(message: string, blockers: ApprovalBlockReason[]) {
    super(message);
    this.blockers = blockers;
  }
}

/**
 * Records one of the four outcomes on `entry`, returning a NEW entry object
 * (the caller owns persistence — this never mutates its input). Enforces, in
 * order: role permission → mandatory rationale → (approve-only) the approval
 * gate. Any failure throws a typed error rather than silently no-opping.
 */
export function recordDecisionOutcome(
  entry: DecisionLogEntry,
  opts: {
    outcome: DecisionOutcome;
    rationale: string;
    decidedBy: string;
    role: DecisionRole;
    financialFreshness: FinancialFreshnessResult;
    now?: string;
  }
): DecisionLogEntry {
  if (!canRecordOutcome(opts.role, opts.outcome)) {
    throw new ForbiddenOutcomeError(`Role "${opts.role}" may not record outcome "${opts.outcome}".`);
  }
  const rationale = opts.rationale.trim();
  if (rationale.length === 0) {
    throw new MissingRationaleError('A decision outcome requires a non-empty rationale.');
  }
  if (opts.outcome === 'approved') {
    const gate = evaluateApprovalGate(entry, { financialFreshness: opts.financialFreshness });
    if (gate.blocked) {
      throw new DecisionGateBlockedError('Approval blocked by outstanding gate conditions.', gate.blockers);
    }
  }
  return {
    ...entry,
    decision: opts.outcome,
    rationale,
    decidedAt: opts.now ?? new Date().toISOString(),
    decidedBy: opts.decidedBy,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Reopen — "reopened decisions create a NEW VERSION rather than erasing the
// approved one"
// ─────────────────────────────────────────────────────────────────────────

export class CannotReopenError extends Error {}

export interface ReopenResult {
  /** The original entry, UNCHANGED except for the new `supersededById`
   *  link — every ruled field (decision/rationale/decidedAt/decidedBy) is
   *  preserved exactly as approved/rejected/etc. */
  previous: DecisionLogEntry;
  /** A fresh entry: new id, `version + 1`, `supersedesId` pointing back,
   *  decision reset to `pending` so it goes through the same
   *  question→outcome flow as any decision, evidence/alternatives carried
   *  forward as a starting draft (not erased — the reopening reviewer edits
   *  from there rather than starting blank). */
  next: DecisionLogEntry;
}

export function reopenDecision(
  entry: DecisionLogEntry,
  opts: { role: DecisionRole; nextId: string; now?: string }
): ReopenResult {
  if (!canReopenDecision(opts.role)) {
    throw new ForbiddenOutcomeError(`Role "${opts.role}" may not reopen a decision.`);
  }
  if (entry.decision === 'pending') {
    throw new CannotReopenError('Cannot reopen a decision that has never been ruled on.');
  }
  if (entry.supersededById) {
    throw new CannotReopenError('This decision has already been reopened into a newer version.');
  }

  const now = opts.now ?? new Date().toISOString();
  const previous: DecisionLogEntry = { ...entry, supersededById: opts.nextId };
  const next: DecisionLogEntry = {
    ...entry,
    id: opts.nextId,
    version: entry.version + 1,
    supersedesId: entry.id,
    supersededById: undefined,
    decision: 'pending',
    rationale: undefined,
    decidedAt: undefined,
    decidedBy: undefined,
    createdAt: now,
  };
  return { previous, next };
}

/** Walks a set of entries for one idea and returns the newest version in
 *  each supersession chain — what the UI should show by default; the full
 *  history remains available by keeping every entry (this function never
 *  deletes anything, it only picks which ones are "current"). */
export function getActiveDecisions(entries: DecisionLogEntry[]): DecisionLogEntry[] {
  return entries.filter((e) => !e.supersededById);
}

/** Full version chain for one decision, oldest first, by following
 *  `supersedesId` backward from `entry`. */
export function getVersionChain(entry: DecisionLogEntry, allEntries: DecisionLogEntry[]): DecisionLogEntry[] {
  const byId = new Map(allEntries.map((e) => [e.id, e]));
  const chain: DecisionLogEntry[] = [entry];
  let cur = entry;
  while (cur.supersedesId) {
    const prev = byId.get(cur.supersedesId);
    if (!prev) break;
    chain.unshift(prev);
    cur = prev;
  }
  return chain;
}
