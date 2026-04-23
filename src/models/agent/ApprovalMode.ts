export const APPROVAL_MODES = ['implicit', 'explicit'] as const;

export type ApprovalMode = (typeof APPROVAL_MODES)[number];

export function assertApprovalMode(value: unknown): asserts value is ApprovalMode {
  if (value !== 'implicit' && value !== 'explicit') {
    throw new Error(`Invalid approval mode: ${String(value)}`);
  }
}

/**
 * V10-AGT-004 — ApprovalMode catalogue + upward-override rule
 * (Wave A seed, schema + pure resolver).
 *
 * Implements R-AGENT-4 from
 * `docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md#v10-agt-004`.
 *
 * Scope (Wave A seed)
 * -------------------
 *   - `ApprovalMode` 5-level ordinal (implicit < inline <
 *     explicit_form < multi_reviewer < admin_only) promoted from
 *     `ExecutionProposalV1.ts`
 *   - Per-mode `ApprovalModeSpec` table (required_reviewers count,
 *     audit_verbosity, ui_affordance, allows_downgrade_without_admin,
 *     idle_timeout_seconds)
 *   - Pure resolvers:
 *       compareApprovalMode(a, b)             → -1 | 0 | 1
 *       upgradeApprovalMode(current, proposed)→ never downgrades
 *       resolveEffectiveApprovalMode(sev, tenant, artifact)
 *
 * Upward-override rule (the critical invariant)
 * ---------------------------------------------
 * Per the dev plan: "tenant policy may only *upgrade* the severity's
 * default approval mode, never downgrade it". `upgradeApprovalMode`
 * enforces this: when `proposed` is weaker than `current`, the
 * function silently returns `current` (the stricter mode wins). Tests
 * assert this across all 25 (current, proposed) pairs.
 */

import type { ApprovalMode, Severity } from './ExecutionProposalV1';
import {
  getSeverityPolicy,
  SEVERITY_POLICIES,
} from './SeverityPolicies';

export type { ApprovalMode } from './ExecutionProposalV1';

// ---------------------------------------------------------------------------
// §1 — Ordinal canonicalisation.
// ---------------------------------------------------------------------------

export const APPROVAL_MODES: readonly ApprovalMode[] = [
  'implicit',
  'inline',
  'explicit_form',
  'multi_reviewer',
  'admin_only',
] as const;

function ordinalOf(mode: ApprovalMode): number {
  const ix = APPROVAL_MODES.indexOf(mode);
  if (ix < 0) throw new RangeError(`Unknown ApprovalMode: ${String(mode)}`);
  return ix;
}

export function compareApprovalMode(
  a: ApprovalMode,
  b: ApprovalMode,
): -1 | 0 | 1 {
  const diff = ordinalOf(a) - ordinalOf(b);
  if (diff < 0) return -1;
  if (diff > 0) return 1;
  return 0;
}

/**
 * Enforces the "never downgrade" rule: returns whichever of
 * `current` and `proposed` is stricter. If `proposed` is weaker,
 * `current` wins.
 */
export function upgradeApprovalMode(
  current: ApprovalMode,
  proposed: ApprovalMode,
): ApprovalMode {
  return compareApprovalMode(current, proposed) >= 0 ? current : proposed;
}

// ---------------------------------------------------------------------------
// §2 — Per-mode spec.
// ---------------------------------------------------------------------------

export type UiAffordance =
  | 'no_prompt'
  | 'inline_chip'
  | 'modal_with_diff'
  | 'multi_pane_review'
  | 'admin_signature_flow';

export interface ApprovalModeSpec {
  readonly mode: ApprovalMode;
  readonly requiredReviewers: number;
  readonly auditVerbosity: 'minimal' | 'standard' | 'full';
  readonly uiAffordance: UiAffordance;
  /** How long the approval prompt stays open before timing out (null ⇒ no idle timeout, blocks indefinitely). */
  readonly idleTimeoutSeconds: number | null;
}

export const APPROVAL_MODE_SPECS = {
  implicit: {
    mode: 'implicit',
    requiredReviewers: 0,
    auditVerbosity: 'minimal',
    uiAffordance: 'no_prompt',
    idleTimeoutSeconds: null,
  },
  inline: {
    mode: 'inline',
    requiredReviewers: 1,
    auditVerbosity: 'standard',
    uiAffordance: 'inline_chip',
    idleTimeoutSeconds: 120,
  },
  explicit_form: {
    mode: 'explicit_form',
    requiredReviewers: 1,
    auditVerbosity: 'full',
    uiAffordance: 'modal_with_diff',
    idleTimeoutSeconds: 600,
  },
  multi_reviewer: {
    mode: 'multi_reviewer',
    requiredReviewers: 2,
    auditVerbosity: 'full',
    uiAffordance: 'multi_pane_review',
    idleTimeoutSeconds: 86_400,
  },
  admin_only: {
    mode: 'admin_only',
    requiredReviewers: 1,
    auditVerbosity: 'full',
    uiAffordance: 'admin_signature_flow',
    idleTimeoutSeconds: null,
  },
} as const satisfies Record<ApprovalMode, ApprovalModeSpec>;

export function getApprovalModeSpec(mode: ApprovalMode): ApprovalModeSpec {
  return APPROVAL_MODE_SPECS[mode];
}

// ---------------------------------------------------------------------------
// §3 — Effective-mode resolver.
// ---------------------------------------------------------------------------

/**
 * Inputs needed to compute the *effective* approval mode for a
 * proposal. The severity drives the default; tenant / artifact
 * policies may only tighten.
 */
export interface EffectiveApprovalInput {
  readonly severity: Severity;
  /** Tenant-global minimum (null ⇒ "no tenant override"). */
  readonly tenantMinimum: ApprovalMode | null;
  /** Artifact-scoped minimum (null ⇒ "no per-artifact override"). */
  readonly artifactMinimum: ApprovalMode | null;
}

/**
 * Returns the strictest of:
 *   - severity default (`SEVERITY_POLICIES[sev].defaultApproval`)
 *   - tenantMinimum (if set)
 *   - artifactMinimum (if set)
 *
 * The strictest-wins contract is what Wave A seed enforces; the
 * runtime wiring lives in V10-AGT-008.
 */
export function resolveEffectiveApprovalMode(
  input: EffectiveApprovalInput,
): ApprovalMode {
  let effective = getSeverityPolicy(input.severity).defaultApproval;
  if (input.tenantMinimum !== null) {
    effective = upgradeApprovalMode(effective, input.tenantMinimum);
  }
  if (input.artifactMinimum !== null) {
    effective = upgradeApprovalMode(effective, input.artifactMinimum);
  }
  return effective;
}

/**
 * Iterates severity → default approval → spec. Consumed by tests to
 * assert the SEVERITY_POLICIES ↔ APPROVAL_MODE_SPECS bijection is
 * consistent (every severity's default exists as a spec).
 */
export function severityDefaultSpec(severity: Severity): ApprovalModeSpec {
  return APPROVAL_MODE_SPECS[SEVERITY_POLICIES[severity].defaultApproval];
}
