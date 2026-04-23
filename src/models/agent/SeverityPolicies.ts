import type { ApprovalMode } from './ApprovalMode.js';
import type { Severity } from './ExecutionProposalV1.js';

export type SeverityPolicy = {
  readonly defaultApproval: ApprovalMode;
};

const DEFAULT_POLICIES: Record<Severity, SeverityPolicy> = {
  S0: { defaultApproval: 'implicit' },
  S1: { defaultApproval: 'explicit' },
  S2: { defaultApproval: 'explicit' },
  S3: { defaultApproval: 'explicit' },
  S4: { defaultApproval: 'explicit' },
};

export function getSeverityPolicy(severity: Severity): SeverityPolicy {
  return DEFAULT_POLICIES[severity];
}

/**
 * V10-AGT-002 — Severity S0..S4 policy table (Wave A seed, schema-only).
 *
 * Implements R-AGENT-2 from
 * `docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md#v10-agt-002`.
 *
 * Scope (Wave A seed)
 * -------------------
 * Promotes the `Severity` union out of `ExecutionProposalV1.ts` into a
 * first-class policy table. Each level has **exactly one** canonical
 * policy object with: default approval mode, undo window, audit
 * retention, UI treatment, and a one-line blast-radius description.
 *
 * Master plan §6 CI invariant 36 asserts "exactly one policy per
 * level" — this file is the artifact the invariant reads.
 *
 * Runtime behaviour
 * -----------------
 * One pure resolver, `getSeverityPolicy`, returns the policy for a
 * given Severity. No enforcement logic lives here; per-severity
 * enforcement tickets (V10-AGT-009..013) consume this table.
 *
 * Re-exports `Severity` + `SEVERITIES` from `./ExecutionProposalV1` so
 * downstream code can import either from here or from the envelope
 * module without union duplication.
 */

import type { ApprovalMode, Severity } from './ExecutionProposalV1';

export { SEVERITIES } from './ExecutionProposalV1';
export type { Severity } from './ExecutionProposalV1';

// ---------------------------------------------------------------------------
// §1 — Policy sub-types.
// ---------------------------------------------------------------------------

/**
 * How long a reversal of an applied action remains supported. Per the
 * dev plan's severity table:
 *   - S0 → N/A (read-only has no apply to reverse)
 *   - S1 → session (reverts when session ends or on explicit undo)
 *   - S2 → 24 h
 *   - S3 → 7 d via compensating ops (Saga pattern)
 *   - S4 → none (irreversible by construction; audit + forensics only)
 */
export type UndoWindow = 'none' | 'session' | '24h' | '7d_compensating';

/**
 * Audit-log retention per severity. Encoded as ISO-style duration
 * tokens so policy configs can be compared lexically without a date
 * library.
 */
export type AuditRetention = '7d' | '30d' | '365d' | '730d' | '7y';

/**
 * Approval-UI treatment catalogue. The mapping is deterministic per
 * severity; V10-AGT-008 consumes it to render the correct affordance.
 */
export type UiTreatment =
  | 'subtle_action_chip'
  | 'inline_approve_button'
  | 'approval_modal_with_diff'
  | 'multi_reviewer_gate'
  | 'admin_only_signature';

// ---------------------------------------------------------------------------
// §2 — SeverityPolicy shape.
// ---------------------------------------------------------------------------

export interface SeverityPolicy {
  readonly severity: Severity;
  /** Short human-readable description of the blast radius at this level. */
  readonly blastRadius: string;
  readonly defaultApproval: ApprovalMode;
  readonly undoWindow: UndoWindow;
  readonly auditRetention: AuditRetention;
  readonly uiTreatment: UiTreatment;
  /**
   * Whether this severity requires a cryptographic signature on the
   * audit entry. Only S4 requires this today; reserved as a policy
   * field so V10-AGT-029 (hardened audit store) has a hook.
   */
  readonly requiresSignature: boolean;
}

// ---------------------------------------------------------------------------
// §3 — The canonical table (one entry per severity).
// ---------------------------------------------------------------------------
// Matches the dev plan §V10-AGT-002 table verbatim.

export const SEVERITY_POLICIES = {
  S0: {
    severity: 'S0',
    blastRadius: 'read-only, no side effects',
    defaultApproval: 'implicit',
    undoWindow: 'none',
    auditRetention: '7d',
    uiTreatment: 'subtle_action_chip',
    requiresSignature: false,
  },
  S1: {
    severity: 'S1',
    blastRadius: 'reversible suggestion (UI-only state)',
    defaultApproval: 'inline',
    undoWindow: 'session',
    auditRetention: '30d',
    uiTreatment: 'inline_approve_button',
    requiresSignature: false,
  },
  S2: {
    severity: 'S2',
    blastRadius: 'reversible write (tenant-owned store)',
    defaultApproval: 'explicit_form',
    undoWindow: '24h',
    auditRetention: '365d',
    uiTreatment: 'approval_modal_with_diff',
    requiresSignature: false,
  },
  S3: {
    severity: 'S3',
    blastRadius: 'blast-radius mutation (multi-entity, external-visible)',
    defaultApproval: 'multi_reviewer',
    undoWindow: '7d_compensating',
    auditRetention: '730d',
    uiTreatment: 'multi_reviewer_gate',
    requiresSignature: false,
  },
  S4: {
    severity: 'S4',
    blastRadius: 'irreversible / external (send email, wire transfer, external API)',
    defaultApproval: 'admin_only',
    undoWindow: 'none',
    auditRetention: '7y',
    uiTreatment: 'admin_only_signature',
    requiresSignature: true,
  },
} as const satisfies Record<Severity, SeverityPolicy>;

/**
 * Pure resolver. Throws `RangeError` on unknown severity (should be
 * unreachable in TS code — the union is closed — but guards against
 * dynamic payloads at the boundary).
 */
export function getSeverityPolicy(severity: Severity): SeverityPolicy {
  const policy = SEVERITY_POLICIES[severity];
  if (!policy) {
    throw new RangeError(`Unknown severity: ${String(severity)}`);
  }
  return policy;
}

/**
 * Iteration-stable `{ S0..S4 } × SeverityPolicy` list for tests + UI
 * renderers that need to walk the full ladder.
 */
export const SEVERITY_POLICY_LIST: readonly SeverityPolicy[] = [
  SEVERITY_POLICIES.S0,
  SEVERITY_POLICIES.S1,
  SEVERITY_POLICIES.S2,
  SEVERITY_POLICIES.S3,
  SEVERITY_POLICIES.S4,
] as const;
