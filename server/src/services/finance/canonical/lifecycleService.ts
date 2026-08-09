/**
 * Finance v3 canonical — lifecycle / concurrency / SoD state machine.
 *
 * Gate C, WP-C02 "compatibility services". Pure, DB-free implementation of
 * the state machine and role/SoD rules specified in
 * `docs/validation/finance-v3/generated/gate-b/WP-B02_lifecycle_concurrency_ADR.md`
 * section 3 (transitions table T1-T12), section 7 (roles / risk tier /
 * self-approval) and section 8 (race rules — the parts expressible as a pure
 * decision function, i.e. everything that does not itself require a DB
 * round-trip such as "does an open child already exist").
 *
 * This module deliberately has ZERO imports from `pg`/`DbPromise`/Express —
 * every exported function is a pure function over plain data, so the whole
 * state-machine contract (which transition is legal from which status, for
 * which role, with which side effects) is unit-testable without a database.
 * `artifactVersionService.ts` is the caller that wires this into real
 * transactions (SELECT ... FOR UPDATE, CAS, audit log insert).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BusinessVersionStatus =
  | 'DRAFT'
  | 'READY_FOR_REVIEW'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'NEEDS_CHANGES'
  | 'SUPERSEDED'
  | 'ARCHIVED'
  | 'INVALIDATED';

export const TERMINAL_STATUSES: readonly BusinessVersionStatus[] = [
  'SUPERSEDED',
  'ARCHIVED',
  'INVALIDATED',
];

/** WP-B02 section 3.2 — action names, T9 (supersede) excluded: system-only side effect, not a caller-invoked action. */
export type LifecycleAction =
  | 'submit_for_review' // T2
  | 'withdraw' // T3 / T5
  | 'start_review' // T4
  | 'request_changes' // T6
  | 'resume_editing' // T7
  | 'approve' // T8 — handled by artifactVersionService.approveVersion, not transition()
  | 'archive' // T10
  | 'invalidate' // T11
  | 'reopen'; // T12 — handled by artifactVersionService.reopenVersion, not transition()

/** WP-B02 section 7.1 — five roles, additive over the existing org role model. */
export type FinanceRole = 'viewer' | 'preparer' | 'reviewer' | 'approver' | 'finance_admin';

export type RiskTier = 'LOW' | 'MATERIAL' | 'HIGH_RISK';

export type FinanceArtifactType =
  | 'STATEMENT_PACK'
  | 'HISTORICAL_ANALYSIS'
  | 'BASELINE_MODEL'
  | 'PREDICTION_SCENARIO'
  | 'VALUATION_CASE'
  | 'REPORT_EXPORT';

export interface TransitionDefinition {
  /** T-number from WP-B02 section 3.2, for traceability/debugging. */
  readonly id: string;
  readonly action: LifecycleAction;
  readonly from: readonly BusinessVersionStatus[];
  readonly to: BusinessVersionStatus;
  readonly allowedRoles: readonly FinanceRole[];
  readonly requiresReason: boolean;
}

// ---------------------------------------------------------------------------
// §3.2 — transition table (T1..T12 minus T1 create / T8 approve / T9 supersede
// / T12 reopen, which are not simple single-row status flips and are modeled
// as their own dedicated service functions elsewhere).
// ---------------------------------------------------------------------------

export const TRANSITIONS: readonly TransitionDefinition[] = [
  {
    id: 'T2',
    action: 'submit_for_review',
    from: ['DRAFT'],
    to: 'READY_FOR_REVIEW',
    allowedRoles: ['preparer', 'finance_admin'],
    requiresReason: false,
  },
  {
    id: 'T3',
    action: 'withdraw',
    from: ['READY_FOR_REVIEW'],
    to: 'DRAFT',
    allowedRoles: ['preparer', 'finance_admin'],
    requiresReason: false,
  },
  {
    id: 'T4',
    action: 'start_review',
    from: ['READY_FOR_REVIEW'],
    to: 'IN_REVIEW',
    allowedRoles: ['reviewer', 'approver', 'finance_admin'],
    requiresReason: false,
  },
  {
    id: 'T5',
    action: 'withdraw',
    from: ['IN_REVIEW'],
    to: 'DRAFT',
    allowedRoles: ['preparer', 'finance_admin'],
    requiresReason: false,
  },
  {
    id: 'T6',
    action: 'request_changes',
    from: ['IN_REVIEW'],
    to: 'NEEDS_CHANGES',
    allowedRoles: ['reviewer', 'approver', 'finance_admin'],
    requiresReason: true,
  },
  {
    id: 'T7',
    action: 'resume_editing',
    from: ['NEEDS_CHANGES'],
    to: 'DRAFT',
    allowedRoles: ['preparer', 'finance_admin'],
    requiresReason: false,
  },
  {
    id: 'T10',
    action: 'archive',
    from: ['APPROVED'],
    to: 'ARCHIVED',
    allowedRoles: ['approver', 'finance_admin'],
    requiresReason: false,
  },
  {
    id: 'T11',
    action: 'invalidate',
    from: ['APPROVED'],
    to: 'INVALIDATED',
    allowedRoles: ['finance_admin', 'approver'],
    requiresReason: true,
  },
];

export type TransitionOutcome =
  | { ok: true; toStatus: BusinessVersionStatus; requiresReason: boolean }
  | { ok: false; code: 'STATE_PRECONDITION_FAILED' | 'FORBIDDEN' | 'REASON_REQUIRED'; message: string };

/**
 * WP-B02 §3.2 / §7.3 — validate a proposed (status, action, role) combination.
 * Pure: does not know about `expectedVersion`/CAS (that is a DB-level
 * concern in the caller) or about a caller-supplied `reason` string's
 * emptiness (caller passes `reasonProvided` so this stays a pure boolean
 * decision, not a string-validation utility).
 */
export function validateTransition(
  currentStatus: BusinessVersionStatus,
  action: LifecycleAction,
  role: FinanceRole,
  opts: { reasonProvided?: boolean } = {}
): TransitionOutcome {
  const candidates = TRANSITIONS.filter((t) => t.action === action && t.from.includes(currentStatus));
  if (candidates.length === 0) {
    return {
      ok: false,
      code: 'STATE_PRECONDITION_FAILED',
      message: `Cannot ${action}: version is in status ${currentStatus}, which has no such transition`,
    };
  }
  // At most one candidate per (action, from-status) pair in the table above;
  // if a future action ever legitimately needs two, this line is the place
  // that would need to disambiguate further (there is none today).
  const def = candidates[0];
  if (!def.allowedRoles.includes(role)) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: `Role ${role} may not perform ${action} on a version in ${currentStatus}`,
    };
  }
  if (def.requiresReason && !opts.reasonProvided) {
    return { ok: false, code: 'REASON_REQUIRED', message: `${action} requires a non-empty reason` };
  }
  return { ok: true, toStatus: def.to, requiresReason: def.requiresReason };
}

/** WP-B02 §4.3 `allowedActionsFromCurrentStatus` — drives the UI action bar per OWN-FIN-012. */
export function allowedActionsFromStatus(
  currentStatus: BusinessVersionStatus,
  role: FinanceRole
): LifecycleAction[] {
  const actions = new Set<LifecycleAction>();
  for (const t of TRANSITIONS) {
    if (t.from.includes(currentStatus) && t.allowedRoles.includes(role)) {
      actions.add(t.action);
    }
  }
  if (currentStatus === 'IN_REVIEW' && (role === 'approver' || role === 'finance_admin')) {
    actions.add('approve');
  }
  if (currentStatus === 'APPROVED' && (role === 'approver' || role === 'finance_admin')) {
    actions.add('reopen');
  }
  return Array.from(actions);
}

export function isTerminal(status: BusinessVersionStatus): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

// ---------------------------------------------------------------------------
// §7.2 — materiality / risk tier
// ---------------------------------------------------------------------------

const RISK_TIER_ORDER: readonly RiskTier[] = ['LOW', 'MATERIAL', 'HIGH_RISK'];

/** WP-B02 §7.2 point 2 — default base tier per artifact type, before any org-threshold escalation. */
export function defaultRiskTierForArtifactType(artifactType: FinanceArtifactType): RiskTier {
  switch (artifactType) {
    case 'STATEMENT_PACK':
      return 'MATERIAL';
    case 'HISTORICAL_ANALYSIS':
      return 'LOW';
    case 'BASELINE_MODEL':
      return 'MATERIAL';
    case 'PREDICTION_SCENARIO':
      return 'MATERIAL';
    case 'VALUATION_CASE':
      return 'HIGH_RISK';
    case 'REPORT_EXPORT':
      return 'LOW';
    default:
      return 'LOW';
  }
}

/** WP-B02 §7.2 point 3 — escalate exactly one level (never more, never a jump), never applied downward. */
export function escalateRiskTier(tier: RiskTier): RiskTier {
  const idx = RISK_TIER_ORDER.indexOf(tier);
  return RISK_TIER_ORDER[Math.min(idx + 1, RISK_TIER_ORDER.length - 1)];
}

/**
 * WP-B02 §7.2 point 4 — "Nikt... nie może obniżyć tieru poniżej wartości
 * wyliczonej automatycznie". Returns true iff `proposed` is strictly below
 * `computed` (the auto-calculated floor) — callers must reject such a value
 * regardless of who is asking, including `finance_admin`.
 */
export function isRiskTierDowngrade(computed: RiskTier, proposed: RiskTier): boolean {
  return RISK_TIER_ORDER.indexOf(proposed) < RISK_TIER_ORDER.indexOf(computed);
}

// ---------------------------------------------------------------------------
// §7.2 point 6 — self-approval / SoD gate (T8 approve precondition)
// ---------------------------------------------------------------------------

export interface SelfApprovalCheckInput {
  riskTier: RiskTier;
  approverUserId: string;
  submittedBy: string | null;
  /** Every author of a mutating edit to the working revision since creation (from artifact_lifecycle_events). */
  editorUserIds?: readonly string[];
  reviewStartedBy?: string | null;
}

export type SelfApprovalCheckResult =
  | { forbidden: false }
  | { forbidden: true; code: 'SELF_APPROVAL_FORBIDDEN'; conflictingRole: 'preparer' | 'reviewer' };

/**
 * WP-B02 §7.2 point 6. LOW tier has no SoD gate. MATERIAL/HIGH_RISK forbid
 * the approver being the submitter or any mutating editor. HIGH_RISK
 * additionally forbids the approver having been the reviewer
 * (`review_started_by`) — a stricter rule layered on top of MATERIAL's.
 */
export function checkSelfApproval(input: SelfApprovalCheckInput): SelfApprovalCheckResult {
  if (input.riskTier === 'LOW') return { forbidden: false };

  const editors = input.editorUserIds ?? [];
  const isPreparerConflict =
    (input.submittedBy && input.submittedBy === input.approverUserId) ||
    editors.includes(input.approverUserId);
  if (isPreparerConflict) {
    return { forbidden: true, code: 'SELF_APPROVAL_FORBIDDEN', conflictingRole: 'preparer' };
  }

  if (input.riskTier === 'HIGH_RISK' && input.reviewStartedBy && input.reviewStartedBy === input.approverUserId) {
    return { forbidden: true, code: 'SELF_APPROVAL_FORBIDDEN', conflictingRole: 'reviewer' };
  }

  return { forbidden: false };
}

// ---------------------------------------------------------------------------
// §4.2 — optimistic concurrency request contract helper (pure parsing/validation)
// ---------------------------------------------------------------------------

export type VersionHintOutcome =
  | { ok: true; expectedVersion: number | undefined }
  | { ok: false; code: 'AMBIGUOUS_VERSION_HINT' | 'EXPECTED_VERSION_REQUIRED'; message: string };

/**
 * WP-B02 §4.2 — reconcile `If-Match`/`expectedVersion` body field into a
 * single expected version, per the documented rule: both present and
 * different -> 400 AMBIGUOUS_VERSION_HINT; neither present -> 400
 * EXPECTED_VERSION_REQUIRED. `required` lets non-mutating or best-effort
 * callers opt out of the "must always supply a version" half of the rule
 * (kept configurable since not every canonical-service caller in this
 * work package is a full lifecycle HTTP transition yet).
 */
export function resolveExpectedVersion(
  ifMatchVersion: number | undefined,
  bodyExpectedVersion: number | undefined,
  opts: { required?: boolean } = {}
): VersionHintOutcome {
  if (ifMatchVersion !== undefined && bodyExpectedVersion !== undefined && ifMatchVersion !== bodyExpectedVersion) {
    return {
      ok: false,
      code: 'AMBIGUOUS_VERSION_HINT',
      message: `If-Match (${ifMatchVersion}) and expectedVersion (${bodyExpectedVersion}) disagree`,
    };
  }
  const resolved = ifMatchVersion ?? bodyExpectedVersion;
  if (resolved === undefined && opts.required) {
    return {
      ok: false,
      code: 'EXPECTED_VERSION_REQUIRED',
      message: 'expectedVersion (or If-Match) is required for this operation',
    };
  }
  return { ok: true, expectedVersion: resolved };
}
