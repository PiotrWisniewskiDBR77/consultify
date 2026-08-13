/**
 * Case Workspace — AUTONOMY CLASSIFICATION AND POLICY ENFORCEMENT (EPIC E6).
 *
 * =========================================================================
 * WHAT WAS ACTUALLY MISSING (the reason this file exists)
 * =========================================================================
 * Before this file, `case_core.autonomy_policy` was a column that NOTHING
 * read. caseCoreService.updateAutonomyPolicy() even carries a parameter named
 * `_orgMaxAutonomyPolicy` that it explicitly discards (`void
 * _orgMaxAutonomyPolicy`, caseCoreService.ts:614). proposalApprovalService's
 * own header said it deliberately does NOT build "the A0-A4 execution-class
 * classification" nor "the three user AutonomyPolicy levels' enforcement".
 * So autonomy was stored, displayed and audited — and enforced nowhere. A
 * policy that is never read is a phantom, not a control.
 *
 * This file implements the three things canon requires and the codebase
 * lacked:
 *
 *   1. `classifyActionClass()` — an explicit, testable A0-A4 predicate
 *      (08_GOVERNANCE_AUTONOMY_APPROVALS.md §3.2), not a comment.
 *   2. `resolveEffectiveAutonomy()` — Case policy combined with the
 *      ORGANIZATION CEILING. §3.1: "The organization sets the maximum. The
 *      user may select a lower level, never a higher one." The ceiling wins
 *      even when the Case row is looser — that is the entire point of a
 *      ceiling, and it is why this cannot be read off `case_core` alone.
 *   3. `requireAutonomyFor()` — FAIL-CLOSED authorization. Absence of a
 *      resolvable policy is never consent (§9 "UNKNOWN means the fact has
 *      not been established. It is neither yes nor no.").
 *
 * =========================================================================
 * WHERE THE ORGANIZATION CEILING IS READ FROM — AND THE HONEST CAVEAT
 * =========================================================================
 * There is no canonical `case_workspace_org_autonomy_policy` table in this
 * codebase. `case_core.autonomy_policy_ref` is documented in its own
 * migration as a "forward-compatible pointer to an org-level max-autonomy
 * policy record" whose target table was never created.
 *
 * Rather than invent a phantom, this service reads the ceiling from the ONE
 * org-scoped policy row that actually exists in this schema:
 * `organization_ai_policy(organization_id PK, policy jsonb)`, under the
 * namespaced key `policy -> 'caseWorkspace' -> 'maxAutonomyPolicy'` (alias:
 * top-level `caseWorkspaceMaxAutonomyPolicy`). This service NEVER writes that
 * table; it only SELECTs it, and it tolerates the table being absent
 * (checked with `to_regclass`, not with a caught error — a caught 42P01
 * inside a transaction would poison the caller's transaction).
 *
 * PARTIAL, stated literally: this key is the interim ceiling source. A
 * dedicated, versioned, audited org-ceiling table with its own migration is
 * NOT built here (no migration is in this stream's allowlist). Any value that
 * is missing, malformed or not one of the three literal levels resolves to
 * `UNCONFIGURED_FAIL_CLOSED_DEFAULT` -> `ASK_EACH_ACTION` (the most
 * restrictive level). A misconfiguration can therefore only ever narrow
 * authority, never widen it.
 *
 * =========================================================================
 * THE AUTHORIZATION MATRIX (the literal rule, so it can be argued with)
 * =========================================================================
 * 06_SECURITY_EVENTS_OBSERVABILITY.md §5: "Conversational confirmation is an
 * input only for exact Chat-to-Case confirmation and A0/A1. A2 execution
 * requires an explicit control or an already published plan policy. […] A3/A4
 * and formal/material actions require an explicit control and the configured
 * authentication assurance; a chat message alone is never material approval
 * truth."
 *
 *   A0 (advise)   — allowed at every level, no control. No mutation exists to
 *                   gate; the classifier refuses to label anything carrying a
 *                   mutation signal as A0.
 *   A1 (prepare)  — allowed at every level, no control. Output stays
 *                   DRAFT/PROPOSED by construction.
 *   A2 (safe exec)— needs an explicit control, OR a published-plan policy
 *                   when the EFFECTIVE level is ASK_MATERIAL_ACTIONS or
 *                   EXECUTE_APPROVED_PLAN. Under ASK_EACH_ACTION ("stop
 *                   before every execution step") the plan-policy path is
 *                   closed and only an explicit control passes.
 *   A3 (material) — always needs an explicit control AND a configured
 *                   authentication assurance. No level can waive it (§3.1
 *                   hard ceiling: "unapproved material commitment […] cannot
 *                   be delegated by choosing a higher level").
 *   A4 (monitor)  — same requirement as A3: an explicit mandate control with
 *                   configured assurance. A standing monitor is a granted
 *                   mandate, not an unattended default.
 *
 * The autonomy LEVEL therefore decides WHEN a human control is required; it
 * never authorizes an action that a valid control was refused for, and a
 * valid explicit control is never overridden by a strict level (a human
 * pressing the button at ASK_EACH_ACTION is exactly what that level asks for).
 *
 * A control only counts when it is EXPLICIT and BOUND:
 *   - channel BUTTON (CONVERSATIONAL is never sufficient above A1;
 *     POLICY is a pre-authorization, accepted only on the A2 plan-policy path);
 *   - approver is not the proposer (no self-approval, GOV-022);
 *   - it binds the exact proposal version + payload digest under decision
 *     (§4 `proposal_id + exact_version + material_hash + approver_role +
 *     scope + expiry`);
 *   - it has not expired.
 *
 * =========================================================================
 * DENIAL LEAVES A TRAIL
 * =========================================================================
 * `publishPolicyDeniedEvent()` writes the §7 governance-family `policy.denied`
 * fact through eventOutboxService.publishEvent ON THE CALLER'S OPEN
 * TRANSACTION. A refusal that leaves no evidence is indistinguishable from an
 * action that was never attempted.
 *
 * NOTE for the caller (this is a real trap, not a nicety): a denial event
 * published inside a transaction that then THROWS is rolled back with the
 * throw. The caller must COMMIT the denial (returning a sentinel from the
 * transaction body) and raise `AutonomyPolicyDeniedError` AFTER the commit.
 * proposalApprovalService.transitionProposalToExecuting does exactly that.
 *
 * PARTIAL: `policy.denied` is canon (06 §7 governance family) but has no row
 * in acceptance/EVENT_TAXONOMY.md §2 — that file is not in this stream's
 * allowlist, so the taxonomy row is owed. Envelope sourcing here follows
 * §1/§3 of that document (aggregate = the aggregate whose action was refused).
 */

import {
  type PgTransactionClient,
  queryOne,
} from '../../utils/queryHelpers.js';
import type { CapabilityEffectClass } from './capabilityRegistryService.js';
import { publishEvent, redact } from './eventOutboxService.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The three user-selectable Case levels (08 §3.1). Same literals as case_core. */
export type AutonomyPolicy = 'ASK_EACH_ACTION' | 'ASK_MATERIAL_ACTIONS' | 'EXECUTE_APPROVED_PLAN';

/** The execution action classes (08 §3.2). Distinct from AutonomyPolicy — never conflate. */
export type AutonomyActionClass = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';

/** What the caller is trying to do, in the canon's own four verbs. */
export type ActionIntent = 'ADVISE' | 'PREPARE' | 'EXECUTE' | 'MONITOR';

export type ActionReversibility = 'REVERSIBLE' | 'COMPENSABLE' | 'IRREVERSIBLE' | 'UNKNOWN';

export type ActionDataClass = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' | 'UNKNOWN';

/**
 * The classifier's input. Everything except `intent` is an optional assertion
 * by the owning module; an assertion of UNKNOWN escalates, while omission
 * leaves the decision to `effectClass` (which the owning module is required
 * to state for any EXECUTE action — an EXECUTE with no effect class is
 * unclassifiable and escalates to A3).
 */
export interface ActionDescriptor {
  intent: ActionIntent;
  effectClass?: CapabilityEffectClass | string | null;
  /** Leaves the tenant: publication, provider call, message to a third party. */
  externalEffect?: boolean;
  /** Budget use, resourcing, contractual or client-facing commitment. */
  materialCommitment?: boolean;
  /** A formal business Decision / Initiative launch / official publication. */
  formalDecision?: boolean;
  reversibility?: ActionReversibility | string | null;
  dataClass?: ActionDataClass | string | null;
  /** Free label used only for audit summaries. Never authorization input. */
  actionRef?: string | null;
}

export interface ActionClassification {
  actionClass: AutonomyActionClass;
  /** Machine-readable reasons, ordered; the first is the deciding one. */
  reasons: string[];
}

export type ExplicitControlChannel = 'BUTTON' | 'CONVERSATIONAL' | 'POLICY';

/** Evidence that a human actually pressed something, with what it binds to. */
export interface ExplicitControlEvidence {
  channel: ExplicitControlChannel;
  approverActorId: string;
  authenticationAssurance?: string | null;
  boundProposalVersion?: number | null;
  boundPayloadDigest?: string | null;
  decidedAt?: string | null;
  /** Caller-computed (the caller owns the expiry clock for its aggregate). */
  expired?: boolean;
  /**
   * SEC-004 / CW-DOD-D6, re-checked AT EXECUTION TIME by the caller: "execution
   * still checks current authority; revocation after approval blocks
   * execution". An approval is evidence that an authorized human pressed the
   * button THEN; it is not evidence that they are still authorized NOW. The
   * caller re-reads the approver's CURRENT standing (membership/role) at the
   * moment of the material action and sets this to `true` when that standing is
   * gone. This gate cannot read it itself: the standing lives in
   * `organization_members`, which is the auth context's table, not this
   * service's, and the caller already owns the transaction the check must be
   * consistent with.
   */
  approverStandingRevoked?: boolean;
}

/** What the control MUST bind to for this specific action. */
export interface ControlBinding {
  proposalVersion?: number | null;
  payloadDigest?: string | null;
  /** Proposer of the action — an approval by this actor is self-approval. */
  proposerActorId?: string | null;
}

/** A published plan whose policy already discloses this class of safe work. */
export interface PublishedPlanPolicyEvidence {
  casePlanVersionId: string;
  published: boolean;
  policySnapshotRef?: string | null;
}

export type OrganizationCeilingSource =
  | 'ORG_POLICY_ROW'
  | 'CALLER_SUPPLIED'
  | 'UNCONFIGURED_FAIL_CLOSED_DEFAULT';

export interface EffectiveAutonomyResolution {
  organizationId: string;
  caseId: string;
  /** null when the Case row could not be resolved for this organization. */
  casePolicy: AutonomyPolicy | null;
  organizationCeiling: AutonomyPolicy;
  organizationCeilingSource: OrganizationCeilingSource;
  /** min(casePolicy, ceiling). ASK_EACH_ACTION whenever unresolved. */
  effectiveAutonomy: AutonomyPolicy;
  /** false = the policy fact was NOT established. Never treat as consent. */
  resolved: boolean;
  reasons: string[];
  /** Present only when an actionClass was supplied to the resolver. */
  requirement?: AutonomyRequirementForClass;
}

export interface AutonomyRequirementForClass {
  actionClass: AutonomyActionClass;
  requiredControl: RequiredControl;
  planPolicyPathOpen: boolean;
}

export type RequiredControl = 'NONE' | 'EXPLICIT_CONTROL' | 'EXPLICIT_CONTROL_WITH_STEP_UP';

export type AutonomyDenialCode =
  | 'autonomy_policy_unresolved'
  | 'autonomy_explicit_control_required'
  | 'autonomy_control_channel_not_explicit'
  | 'autonomy_control_not_bound_to_action'
  | 'autonomy_control_binding_evidence_missing'
  | 'autonomy_control_expired'
  | 'autonomy_control_self_approved'
  | 'autonomy_control_approver_standing_revoked'
  | 'autonomy_step_up_assurance_not_configured'
  | 'autonomy_plan_policy_path_closed';

export interface EvaluateAutonomyInput {
  organizationId: string;
  caseId: string;
  action: ActionDescriptor;
  control?: ExplicitControlEvidence | null;
  binding?: ControlBinding | null;
  planPolicy?: PublishedPlanPolicyEvidence | null;
  /**
   * Read the policy on the caller's OPEN transaction, so the level that was
   * enforced is the level that was true at mutation time. Omit only for
   * read-only/preflight callers.
   */
  client?: PgTransactionClient | null;
  /** Pre-resolved ceiling (e.g. an org-admin API already read it). */
  organizationCeiling?: AutonomyPolicy | null;
}

export interface AutonomyEvaluation {
  allowed: boolean;
  actionClass: AutonomyActionClass;
  classificationReasons: string[];
  requiredControl: RequiredControl;
  effectiveAutonomy: AutonomyPolicy;
  casePolicy: AutonomyPolicy | null;
  organizationCeiling: AutonomyPolicy;
  organizationCeilingSource: OrganizationCeilingSource;
  policyResolved: boolean;
  denialCode: AutonomyDenialCode | null;
  denialReasons: string[];
}

/** Thrown by requireAutonomyFor(). `code` is the stable machine reason. */
export class AutonomyPolicyDeniedError extends Error {
  public readonly code: AutonomyDenialCode;
  public readonly evaluation: AutonomyEvaluation;

  constructor(evaluation: AutonomyEvaluation) {
    const code = evaluation.denialCode ?? 'autonomy_policy_unresolved';
    super(`${code}:${evaluation.actionClass}:${evaluation.effectiveAutonomy}`);
    this.name = 'AutonomyPolicyDeniedError';
    this.code = code;
    this.evaluation = evaluation;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AUTONOMY_POLICIES: readonly AutonomyPolicy[] = [
  'ASK_EACH_ACTION',
  'ASK_MATERIAL_ACTIONS',
  'EXECUTE_APPROVED_PLAN',
];

/** Ordering used by the ceiling: a LOWER rank is the more restrictive level. */
const AUTONOMY_RANK: Record<AutonomyPolicy, number> = {
  ASK_EACH_ACTION: 0,
  ASK_MATERIAL_ACTIONS: 1,
  EXECUTE_APPROVED_PLAN: 2,
};

/** The level an unresolvable / unconfigured policy collapses to. */
export const FAIL_CLOSED_AUTONOMY: AutonomyPolicy = 'ASK_EACH_ACTION';

/** Effect classes whose own name asserts the mutation is safe and reversible. */
const SAFE_EFFECT_CLASSES: readonly string[] = ['SAFE_ADDITIVE', 'SAFE_UPDATE'];

/** Effect classes that are material by definition (08 §3.2 A3 ceiling). */
const MATERIAL_EFFECT_CLASSES: readonly string[] = [
  'SENSITIVE_UPDATE',
  'DESTRUCTIVE',
  'GOVERNANCE_TRANSITION',
];

/**
 * Assurance labels that mean "no step-up was configured". 06 §5 requires "the
 * configured authentication assurance" for A3/A4; a blank or explicitly-null
 * label is an absence, and an absence is never a pass. The vocabulary itself
 * has no canon enum (proposalApprovalService open_question #10), so this list
 * enumerates the NEGATIVE cases only — anything else counts as configured.
 */
const UNCONFIGURED_ASSURANCE_LABELS: readonly string[] = [
  '',
  'NONE',
  'NULL',
  'UNKNOWN',
  'UNSPECIFIED',
  'NOT_CONFIGURED',
  'N/A',
  'NA',
];

/** §7 governance family. */
export const POLICY_DENIED_EVENT_TYPE = 'policy.denied';

const ORG_CEILING_TABLE = 'organization_ai_policy';

// ---------------------------------------------------------------------------
// 1. A0-A4 CLASSIFICATION — a predicate, not a comment
// ---------------------------------------------------------------------------

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

/**
 * Any signal that this descriptor touches the canonical world. Used to refuse
 * an ADVISE/PREPARE label for something that is actually a mutation — a
 * mislabelled intent must never be the cheap path to A0.
 */
function mutationSignals(action: ActionDescriptor): string[] {
  const signals: string[] = [];
  if (action.externalEffect === true) signals.push('external_effect');
  if (action.materialCommitment === true) signals.push('material_commitment');
  if (action.formalDecision === true) signals.push('formal_decision');
  const effectClass = normalizeToken(action.effectClass);
  if (effectClass && MATERIAL_EFFECT_CLASSES.includes(effectClass)) {
    signals.push(`effect_class:${effectClass}`);
  }
  return signals;
}

/**
 * 08 §3.2. The single place A0-A4 is decided.
 *
 * Escalation is one-directional: every unresolved or asserted-UNKNOWN fact
 * moves the action UP (towards A3), never down. An EXECUTE whose effect class
 * is missing or outside the registry vocabulary is UNCLASSIFIABLE and is
 * therefore treated as material (A3) — the reverse default would let an
 * unlabelled action execute unattended, which is precisely the phantom this
 * file replaces.
 */
export function classifyActionClass(action: ActionDescriptor): ActionClassification {
  const reasons: string[] = [];
  const intent = normalizeToken(action?.intent) as ActionIntent;
  const effectClass = normalizeToken(action?.effectClass);
  const reversibility = normalizeToken(action?.reversibility);
  const dataClass = normalizeToken(action?.dataClass);
  const signals = mutationSignals(action ?? { intent: 'EXECUTE' });

  if (intent === 'ADVISE') {
    if (signals.length > 0) {
      reasons.push('advise_with_mutation_signal_escalated', ...signals);
      return { actionClass: 'A3', reasons };
    }
    if (effectClass) {
      reasons.push('advise_with_effect_class_escalated', `effect_class:${effectClass}`);
      return { actionClass: 'A1', reasons };
    }
    reasons.push('advise_no_mutation');
    return { actionClass: 'A0', reasons };
  }

  if (intent === 'PREPARE') {
    if (signals.length > 0) {
      reasons.push('prepare_with_mutation_signal_escalated', ...signals);
      return { actionClass: 'A3', reasons };
    }
    reasons.push('prepare_draft_or_proposal_only');
    return { actionClass: 'A1', reasons };
  }

  if (intent === 'MONITOR') {
    // A4's ceiling forbids autonomous remediation; a monitor that also
    // mutates materially is not a monitor, it is the mutation.
    if (signals.length > 0) {
      reasons.push('monitor_with_material_signal_escalated', ...signals);
      return { actionClass: 'A3', reasons };
    }
    reasons.push('monitor_mandate');
    return { actionClass: 'A4', reasons };
  }

  if (intent !== 'EXECUTE') {
    reasons.push(`intent_unrecognized_escalated:${intent || 'MISSING'}`);
    return { actionClass: 'A3', reasons };
  }

  if (signals.length > 0) {
    reasons.push('execute_material', ...signals);
    return { actionClass: 'A3', reasons };
  }
  if (reversibility === 'IRREVERSIBLE' || reversibility === 'UNKNOWN') {
    reasons.push(`execute_reversibility_escalated:${reversibility}`);
    return { actionClass: 'A3', reasons };
  }
  if (reversibility && !['REVERSIBLE', 'COMPENSABLE'].includes(reversibility)) {
    reasons.push(`execute_reversibility_unrecognized_escalated:${reversibility}`);
    return { actionClass: 'A3', reasons };
  }
  if (dataClass === 'RESTRICTED' || dataClass === 'UNKNOWN') {
    reasons.push(`execute_data_class_escalated:${dataClass}`);
    return { actionClass: 'A3', reasons };
  }
  if (dataClass && !['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'].includes(dataClass)) {
    reasons.push(`execute_data_class_unrecognized_escalated:${dataClass}`);
    return { actionClass: 'A3', reasons };
  }
  if (!effectClass) {
    reasons.push('execute_without_effect_class_escalated');
    return { actionClass: 'A3', reasons };
  }
  if (!SAFE_EFFECT_CLASSES.includes(effectClass)) {
    reasons.push(`execute_effect_class_not_safe_escalated:${effectClass}`);
    return { actionClass: 'A3', reasons };
  }

  reasons.push(`execute_safe_reversible_internal:${effectClass}`);
  return { actionClass: 'A2', reasons };
}

/** A3 is the material-mutation class; A4 is a mandate. Both need a human. */
export function isMaterialActionClass(actionClass: AutonomyActionClass): boolean {
  return actionClass === 'A3';
}

/**
 * The authorization matrix, expressed once. `effectiveAutonomy` decides only
 * the A2 row; A3/A4 are level-independent by canon.
 */
export function requiredControlFor(
  actionClass: AutonomyActionClass,
  effectiveAutonomy: AutonomyPolicy
): AutonomyRequirementForClass {
  if (actionClass === 'A0' || actionClass === 'A1') {
    return { actionClass, requiredControl: 'NONE', planPolicyPathOpen: false };
  }
  if (actionClass === 'A2') {
    return {
      actionClass,
      requiredControl: 'EXPLICIT_CONTROL',
      // "stop before every execution step" closes the pre-authorization path.
      planPolicyPathOpen: effectiveAutonomy !== 'ASK_EACH_ACTION',
    };
  }
  return {
    actionClass,
    requiredControl: 'EXPLICIT_CONTROL_WITH_STEP_UP',
    planPolicyPathOpen: false,
  };
}

// ---------------------------------------------------------------------------
// 2. resolveEffectiveAutonomy — Case policy under the ORGANIZATION CEILING
// ---------------------------------------------------------------------------

interface CaseAutonomyRow {
  case_id: string;
  organization_id: string;
  autonomy_policy: string;
}

interface OrgPolicyRow {
  policy: unknown;
}

interface RegClassRow {
  reg: string | null;
}

async function selectOne<T>(
  client: PgTransactionClient | null | undefined,
  sql: string,
  params: unknown[]
): Promise<T | null> {
  if (client) {
    const result = await client.query<T>(sql, params);
    return result.rows[0] ?? null;
  }
  return (await queryOne<T>(sql, params)) ?? null;
}

function asAutonomyPolicy(value: unknown): AutonomyPolicy | null {
  const token = normalizeToken(value);
  return (AUTONOMY_POLICIES as readonly string[]).includes(token)
    ? (token as AutonomyPolicy)
    : null;
}

/**
 * `policy` arrives as jsonb (already an object from pg) or, on some drivers /
 * legacy rows, as a JSON string. Both are handled; anything else is treated as
 * absent rather than guessed at.
 */
function readCeilingFromPolicyJson(policy: unknown): AutonomyPolicy | null {
  let parsed: unknown = policy;
  if (typeof policy === 'string') {
    try {
      parsed = JSON.parse(policy);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const root = parsed as Record<string, unknown>;

  const namespaced = root.caseWorkspace;
  if (namespaced && typeof namespaced === 'object') {
    const nested = namespaced as Record<string, unknown>;
    const fromNested = asAutonomyPolicy(nested.maxAutonomyPolicy);
    if (fromNested) return fromNested;
  }
  return asAutonomyPolicy(root.caseWorkspaceMaxAutonomyPolicy);
}

/**
 * Reads the org ceiling. Returns null for "not configured" — including when
 * the table does not exist in this environment, when there is no row, and when
 * the stored value is not one of the three literal levels. Every one of those
 * is an ABSENCE, and this function must never turn an absence into a level.
 *
 * Existence is probed with `to_regclass` rather than by catching 42P01,
 * because a caught 42P01 inside the caller's open transaction would leave that
 * transaction aborted for every subsequent statement.
 */
export async function readOrganizationAutonomyCeiling(
  organizationId: string,
  client?: PgTransactionClient | null
): Promise<AutonomyPolicy | null> {
  const orgId = String(organizationId ?? '').trim();
  if (!orgId) return null;

  const reg = await selectOne<RegClassRow>(
    client,
    `SELECT to_regclass('public.${ORG_CEILING_TABLE}')::text AS reg`,
    []
  );
  if (!reg?.reg) return null;

  const row = await selectOne<OrgPolicyRow>(
    client,
    `SELECT policy FROM ${ORG_CEILING_TABLE} WHERE organization_id = ?`,
    [orgId]
  );
  if (!row) return null;
  return readCeilingFromPolicyJson(row.policy);
}

/**
 * 08 §3.1. Combines the Case's own selected level with the organization's
 * hard maximum. The ceiling ALWAYS wins:
 *
 *     effective = min(casePolicy, organizationCeiling)   [by restrictiveness]
 *
 * A Case set to EXECUTE_APPROVED_PLAN under an org ceiling of ASK_EACH_ACTION
 * is ASK_EACH_ACTION. "The user may select a lower level, never a higher one."
 *
 * `actionClass` is optional and does NOT affect the resolution — when given it
 * only annotates the result with what that class would require at this level,
 * so a caller can render "why am I being asked" without a second call.
 *
 * Unresolvable (no such Case, or the Case belongs to another organization)
 * yields `resolved: false` and ASK_EACH_ACTION. The tenant mismatch is
 * reported with the SAME shape as a missing Case (SEC-009 enumeration-safety:
 * a caller must not learn that a Case id exists in someone else's tenant).
 */
export async function resolveEffectiveAutonomy(
  organizationId: string,
  caseId: string,
  actionClass?: AutonomyActionClass | null,
  options?: {
    client?: PgTransactionClient | null;
    organizationCeiling?: AutonomyPolicy | null;
  }
): Promise<EffectiveAutonomyResolution> {
  const orgId = String(organizationId ?? '').trim();
  const id = String(caseId ?? '').trim();
  const client = options?.client ?? null;
  const reasons: string[] = [];

  // THE CEILING IS A MINIMUM OPERATION, NOT AN ASSIGNMENT.
  //
  // A caller-supplied ceiling used to REPLACE the stored one, which made
  // `organizationCeiling` a privilege-RAISING parameter: a caller passing
  // EXECUTE_APPROVED_PLAN under a stored ceiling of ASK_EACH_ACTION got the
  // permissive level, re-opening the A2 plan-policy path the organization had
  // deliberately closed. The stored row is ALWAYS read and the two are combined
  // by restrictiveness, so a supplied value can only ever narrow authority.
  // `UNCONFIGURED_FAIL_CLOSED_DEFAULT` participates in that minimum as itself
  // (ASK_EACH_ACTION): an absent org policy is the strictest fact, so a caller
  // cannot manufacture a ceiling where the organization configured none.
  const suppliedCeiling = asAutonomyPolicy(options?.organizationCeiling);
  const stored = orgId ? await readOrganizationAutonomyCeiling(orgId, client) : null;
  const storedCeiling: AutonomyPolicy = stored ?? FAIL_CLOSED_AUTONOMY;
  const storedCeilingSource: OrganizationCeilingSource = stored
    ? 'ORG_POLICY_ROW'
    : 'UNCONFIGURED_FAIL_CLOSED_DEFAULT';
  if (!stored) reasons.push('organization_ceiling_not_configured');

  let ceiling: AutonomyPolicy;
  let ceilingSource: OrganizationCeilingSource;
  if (suppliedCeiling && AUTONOMY_RANK[suppliedCeiling] <= AUTONOMY_RANK[storedCeiling]) {
    // The supplied value is at least as restrictive as what is stored — it
    // wins, and is labelled as the source so an auditor sees who narrowed it.
    ceiling = suppliedCeiling;
    ceilingSource = 'CALLER_SUPPLIED';
  } else {
    ceiling = storedCeiling;
    ceilingSource = storedCeilingSource;
    if (suppliedCeiling) {
      reasons.push(
        `caller_supplied_ceiling_capped_by_organization:${suppliedCeiling}->${storedCeiling}`
      );
    }
  }

  const base = (casePolicy: AutonomyPolicy | null, resolved: boolean) => {
    const effective =
      resolved && casePolicy
        ? AUTONOMY_RANK[casePolicy] <= AUTONOMY_RANK[ceiling]
          ? casePolicy
          : ceiling
        : FAIL_CLOSED_AUTONOMY;
    const resolution: EffectiveAutonomyResolution = {
      organizationId: orgId,
      caseId: id,
      casePolicy,
      organizationCeiling: ceiling,
      organizationCeilingSource: ceilingSource,
      effectiveAutonomy: effective,
      resolved,
      reasons,
    };
    if (actionClass) resolution.requirement = requiredControlFor(actionClass, effective);
    return resolution;
  };

  if (!orgId || !id) {
    reasons.push('autonomy_scope_incomplete');
    return base(null, false);
  }

  const row = await selectOne<CaseAutonomyRow>(
    client,
    `SELECT case_id, organization_id, autonomy_policy FROM case_core WHERE case_id = ?`,
    [id]
  );
  if (!row || row.organization_id !== orgId) {
    reasons.push('case_autonomy_policy_unresolved');
    return base(null, false);
  }

  const casePolicy = asAutonomyPolicy(row.autonomy_policy);
  if (!casePolicy) {
    // A stored value outside the enum is a fact NOT established, not a level.
    reasons.push(`case_autonomy_policy_invalid:${normalizeToken(row.autonomy_policy)}`);
    return base(null, false);
  }
  if (AUTONOMY_RANK[casePolicy] > AUTONOMY_RANK[ceiling]) {
    reasons.push(`organization_ceiling_capped_case_policy:${casePolicy}->${ceiling}`);
  }
  return base(casePolicy, true);
}

// ---------------------------------------------------------------------------
// 3. requireAutonomyFor — fail-closed authorization
// ---------------------------------------------------------------------------

function assuranceIsConfigured(assurance: string | null | undefined): boolean {
  return !UNCONFIGURED_ASSURANCE_LABELS.includes(normalizeToken(assurance));
}

/**
 * Is this control an EXPLICIT, BOUND human control for THIS action?
 * Returns the denial code when it is not; null when it qualifies.
 *
 * FAIL-CLOSED ON MISSING EVIDENCE (the trap this function used to fall into):
 * every binding check below is conditional on the corresponding field being
 * PRESENT. Read naively that means an A3/A4 action supplying no `binding` at
 * all — no proposer identity, no version, no digest — skipped the self-approval
 * ceiling (GOV-022) AND the control-to-action binding (06 §4) and came out
 * `allowed`. Absence of evidence was being read as evidence of compliance,
 * which is the exact inversion the rest of this file exists to prevent. For the
 * classes that require a human (A3/A4) the binding evidence is therefore now
 * MANDATORY, checked before the field-by-field comparisons.
 */
function disqualifyControl(
  control: ExplicitControlEvidence | null | undefined,
  binding: ControlBinding | null | undefined,
  requiredControl: RequiredControl
): AutonomyDenialCode | null {
  if (!control) return 'autonomy_explicit_control_required';
  // SEC-004: authority at APPROVAL time is not authority at EXECUTION time.
  // Checked first — a control pressed by someone who no longer has standing is
  // void whatever else is right about it.
  if (control.approverStandingRevoked === true) {
    return 'autonomy_control_approver_standing_revoked';
  }
  if (control.channel !== 'BUTTON') return 'autonomy_control_channel_not_explicit';
  if (control.expired === true) return 'autonomy_control_expired';

  const approver = String(control.approverActorId ?? '').trim();
  if (!approver) return 'autonomy_explicit_control_required';

  if (requiredControl === 'EXPLICIT_CONTROL_WITH_STEP_UP') {
    // A3/A4. 06 §4 requires the decision to bind
    // `proposal_id + exact_version + material_hash + approver_role`; without a
    // proposer identity GOV-022's self-approval ceiling cannot be evaluated at
    // all. Any of these missing means the control cannot be PROVEN bound to
    // this action, and an unprovable binding is a refusal, not a pass.
    const boundVersionKnown =
      control.boundProposalVersion !== null && control.boundProposalVersion !== undefined;
    const requiredVersionKnown =
      binding?.proposalVersion !== null && binding?.proposalVersion !== undefined;
    const missing =
      !String(binding?.proposerActorId ?? '').trim() ||
      !requiredVersionKnown ||
      !boundVersionKnown ||
      !String(binding?.payloadDigest ?? '').trim() ||
      !String(control.boundPayloadDigest ?? '').trim();
    if (missing) return 'autonomy_control_binding_evidence_missing';
  }

  const proposer = String(binding?.proposerActorId ?? '').trim();
  if (proposer && proposer === approver) return 'autonomy_control_self_approved';

  if (binding?.proposalVersion !== null && binding?.proposalVersion !== undefined) {
    if (Number(control.boundProposalVersion) !== Number(binding.proposalVersion)) {
      return 'autonomy_control_not_bound_to_action';
    }
  }
  if (binding?.payloadDigest) {
    if (String(control.boundPayloadDigest ?? '') !== String(binding.payloadDigest)) {
      return 'autonomy_control_not_bound_to_action';
    }
  }
  if (
    requiredControl === 'EXPLICIT_CONTROL_WITH_STEP_UP' &&
    !assuranceIsConfigured(control.authenticationAssurance)
  ) {
    return 'autonomy_step_up_assurance_not_configured';
  }
  return null;
}

/**
 * The whole gate, without throwing — for callers that want to render "this
 * will need approval" before attempting anything.
 */
export async function evaluateAutonomy(
  input: EvaluateAutonomyInput
): Promise<AutonomyEvaluation> {
  const classification = classifyActionClass(input.action);
  const resolution = await resolveEffectiveAutonomy(
    input.organizationId,
    input.caseId,
    classification.actionClass,
    { client: input.client ?? null, organizationCeiling: input.organizationCeiling ?? null }
  );
  const requirement = requiredControlFor(
    classification.actionClass,
    resolution.effectiveAutonomy
  );

  const deny = (code: AutonomyDenialCode, extra: string[] = []): AutonomyEvaluation => ({
    allowed: false,
    actionClass: classification.actionClass,
    classificationReasons: classification.reasons,
    requiredControl: requirement.requiredControl,
    effectiveAutonomy: resolution.effectiveAutonomy,
    casePolicy: resolution.casePolicy,
    organizationCeiling: resolution.organizationCeiling,
    organizationCeilingSource: resolution.organizationCeilingSource,
    policyResolved: resolution.resolved,
    denialCode: code,
    denialReasons: [...resolution.reasons, ...extra],
  });

  const allow = (extra: string[] = []): AutonomyEvaluation => ({
    allowed: true,
    actionClass: classification.actionClass,
    classificationReasons: classification.reasons,
    requiredControl: requirement.requiredControl,
    effectiveAutonomy: resolution.effectiveAutonomy,
    casePolicy: resolution.casePolicy,
    organizationCeiling: resolution.organizationCeiling,
    organizationCeilingSource: resolution.organizationCeilingSource,
    policyResolved: resolution.resolved,
    denialCode: null,
    denialReasons: extra,
  });

  // A0 is the only class that survives an unresolvable policy: it is defined
  // as producing no canonical mutation and no external effect, so there is
  // nothing to authorize. Everything else needs the policy fact established
  // first — an unknown policy is not a permissive policy.
  if (classification.actionClass === 'A0') return allow(['a0_advice_not_policy_gated']);
  if (!resolution.resolved) return deny('autonomy_policy_unresolved');

  if (requirement.requiredControl === 'NONE') {
    return allow(['action_class_requires_no_control']);
  }

  const controlProblem = disqualifyControl(
    input.control,
    input.binding,
    requirement.requiredControl
  );
  if (!controlProblem) return allow(['explicit_control_verified']);

  // A2's only alternative to an explicit control: an already-published plan
  // whose policy discloses this safe class (06 §5), and only at a level that
  // does not demand a stop before every step.
  if (classification.actionClass === 'A2') {
    const planPolicyPresent = Boolean(input.planPolicy?.published);
    if (planPolicyPresent && requirement.planPolicyPathOpen) {
      return allow(['published_plan_policy_path']);
    }
    if (planPolicyPresent && !requirement.planPolicyPathOpen) {
      return deny('autonomy_plan_policy_path_closed', [
        `effective_autonomy:${resolution.effectiveAutonomy}`,
      ]);
    }
  }

  return deny(controlProblem);
}

/**
 * The enforcement entry point. Resolves, evaluates and THROWS
 * AutonomyPolicyDeniedError when the action is not authorized.
 *
 * Fail-closed by construction: every path that cannot establish an explicit
 * authorization ends in a throw. There is deliberately no "warn and continue"
 * mode and no boolean flag that turns enforcement off — such a flag is how a
 * policy becomes decorative.
 */
export async function requireAutonomyFor(
  input: EvaluateAutonomyInput
): Promise<AutonomyEvaluation> {
  const evaluation = await evaluateAutonomy(input);
  if (!evaluation.allowed) throw new AutonomyPolicyDeniedError(evaluation);
  return evaluation;
}

// ---------------------------------------------------------------------------
// 4. policy.denied — a refusal is a fact
// ---------------------------------------------------------------------------

export interface PublishPolicyDeniedInput {
  evaluation: AutonomyEvaluation;
  organizationId: string;
  projectId?: string | null;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion?: number | null;
  caseId?: string | null;
  runId?: string | null;
  nodeRunId?: string | null;
  actorUserId: string;
  /** Stable id for a retryable command, so a replay dedups (§8). */
  eventId?: string | null;
  /** Opaque pointer only — never the payload (§6). */
  payloadRef?: string | null;
  /** Extra audit facts (already free of payload/PII). */
  summaryExtra?: Record<string, unknown> | null;
}

/**
 * Writes the §7 `policy.denied` fact ON THE CALLER'S OPEN TRANSACTION.
 *
 * Carries the decision, not the payload: action class, effective level, the
 * ceiling AND its source (so an auditor can tell "the org capped this" from
 * "nobody ever configured a ceiling"), and the machine denial code.
 */
export async function publishPolicyDeniedEvent(
  client: PgTransactionClient,
  input: PublishPolicyDeniedInput
): Promise<void> {
  const { evaluation } = input;
  await publishEvent(client, {
    eventId: input.eventId ?? undefined,
    eventType: POLICY_DENIED_EVENT_TYPE,
    organizationId: input.organizationId,
    projectId: input.projectId ?? null,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    aggregateVersion: input.aggregateVersion ?? null,
    caseId: input.caseId ?? null,
    runId: input.runId ?? null,
    nodeRunId: input.nodeRunId ?? null,
    actorUserId: input.actorUserId,
    redactedSummary: redact({
      denialCode: evaluation.denialCode,
      denialReasons: evaluation.denialReasons,
      actionClass: evaluation.actionClass,
      classificationReasons: evaluation.classificationReasons,
      requiredControl: evaluation.requiredControl,
      effectiveAutonomy: evaluation.effectiveAutonomy,
      casePolicy: evaluation.casePolicy,
      organizationCeiling: evaluation.organizationCeiling,
      organizationCeilingSource: evaluation.organizationCeilingSource,
      policyResolved: evaluation.policyResolved,
      ...(input.summaryExtra ?? {}),
    }),
    payloadRef: input.payloadRef ?? null,
  });
}
