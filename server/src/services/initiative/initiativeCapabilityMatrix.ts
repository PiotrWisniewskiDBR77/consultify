/**
 * INI-04 — CANONICAL INITIATIVE CAPABILITY MATRIX
 * ============================================================================
 *
 * ONE place that turns an initiative's role profile into capabilities.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Before INI-04 the same matrix was re-encoded in FOUR independent places:
 *
 *   1. `InitiativeController.getTopBarCapabilities`      — write enforcement
 *      (PUT /initiatives/:id, PATCH /:id/quick-update)
 *   2. `InitiativeController.getGateReadinessCheck`      — read model A
 *      (GET /api/initiatives/:id/gate-readiness-check)
 *   3. `planningPortfolioReadService.getInitiativeGateReadinessRead`
 *                                                        — read model B
 *      (GET /api/v8/planning/initiatives/:id/gate-readiness-check — the one
 *       the UI actually prefers; #2 is only its fallback)
 *   4. `initiativeTransitionService` inline `canExecute` — approval enforcement
 *      (PATCH /initiatives/:id/status)
 *
 * Four copies of one rule set is four chances to drift: read model B could say
 * "you may edit the owner" while the writer in #1 answers 403, and nothing in
 * the build would notice. Every one of those call sites now delegates here.
 *
 * WHAT IS *NOT* IN SCOPE
 * ----------------------
 * This is NOT a new IAM domain and it does not replace the platform RBAC.
 * Role RESOLUTION stays where it already was and is already canonical —
 * `initiativeAccessResolver.resolveInitiativeAccessContext` (system role +
 * project membership + explicit/derived gate roles + steering board). The
 * separate, still-inert `effectiveAccessService` / `requireInitiativeCapability`
 * shadow layer is deliberately untouched.
 *
 * THE INPUTS TO THE MATRIX
 * ------------------------
 *   owner            — `initiatives.owner_business_id` / `owner_execution_id`
 *                      → INITIATIVE_OWNER / BUSINESS_OWNER (via the resolver)
 *   sponsor          — `initiatives.sponsor_id`
 *                      → PROJECT_SPONSOR (via the resolver)
 *   project role     — `project_members.project_role` → canonical project role
 *   steering board   — `project_steering_board_members`
 *   RACI             — `initiative_stakeholders.raci_type` (R/A/C/I)
 *                      → RACI_* role tokens, added by THIS module (the resolver
 *                        never read that table; RACI was a silo with a live
 *                        write path and zero effect on permissions)
 *   approval profile — `GATE_PERMISSIONS[gate]` per lifecycle gate, i.e. which
 *                      roles may execute which transition, plus who is actually
 *                      assigned to those roles
 *
 * FAIL-CLOSED DOCTRINE
 * --------------------
 * No role resolved ⇒ NO capability. Every set below is an allow-list; there is
 * no default-allow branch and no "unknown role ⇒ treat as owner" fallback. A
 * read of `initiative_stakeholders` that throws (table absent on an old DB)
 * yields an EMPTY RACI role set, never a permissive one.
 *
 * RACI SEMANTICS (deliberate, and deliberately narrow)
 * ----------------------------------------------------
 *   A (Accountable) → artifact EDIT capability
 *   R (Responsible) → artifact EDIT capability
 *   C (Consulted)   → nothing (deny)
 *   I (Informed)    → nothing (deny)
 *
 * RACI NEVER grants a gate/approval capability. Lifecycle approvals remain
 * strictly `GATE_PERMISSIONS`, so wiring RACI in cannot weaken a gate — it can
 * only widen who may edit the card's content, which is exactly what an
 * Accountable/Responsible stakeholder is for.
 */

import {
  GATE_PERMISSIONS,
  getGateForTransition,
  VALID_TRANSITIONS,
} from '../../constants/initiativeStatuses.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  type InitiativeAccessContext,
  resolveInitiativeAccessContext,
} from './initiativeAccessResolver.js';

// ---------------------------------------------------------------------------
// Role tokens
// ---------------------------------------------------------------------------

/** RACI letter → effective-role token used inside the matrix. */
export const RACI_ROLE_TOKENS = {
  R: 'RACI_RESPONSIBLE',
  A: 'RACI_ACCOUNTABLE',
  C: 'RACI_CONSULTED',
  I: 'RACI_INFORMED',
} as const;

export type RaciLetter = keyof typeof RACI_ROLE_TOKENS;
export type RaciRoleToken = (typeof RACI_ROLE_TOKENS)[RaciLetter];

/** Admin-band roles. The resolver injects `ADMIN` for system admins. */
const ADMIN_ROLES = new Set(['ADMIN', 'SUPERADMIN']);

/**
 * Allow-list for artifact EDIT capability (top bar + cards + AI + context
 * create). ORDER OF THE SET IS IRRELEVANT — membership is the whole rule.
 * Anything not listed here is denied.
 */
const EDIT_CAPABLE_ROLES = new Set<string>([
  'PMO',
  'PROJECT_MANAGER',
  'PROJECT_LEAD',
  'INITIATIVE_OWNER',
  'PROJECT_SPONSOR',
  RACI_ROLE_TOKENS.A,
  RACI_ROLE_TOKENS.R,
]);

/** Statuses in which the artifact is frozen for everyone, admins included. */
const TERMINAL_STATUSES = new Set(['CANCELLED', 'ARCHIVED']);

const STATUSES_WITH_TASK_CREATE = [
  'PLANNING',
  'APPROVED',
  'SCHEDULED',
  'EXECUTING',
  'BLOCKED',
] as const;

const STATUSES_WITH_GOVERNANCE_CREATE = ['REVIEW', 'PROMOTED', 'PENDING_REVIEW', 'DRAFT'] as const;

const upper = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toUpperCase();

const uniq = <T>(values: T[]): T[] => Array.from(new Set(values));

// ---------------------------------------------------------------------------
// Pure matrix — no I/O, no DB, fully unit-testable
// ---------------------------------------------------------------------------

export interface InitiativeCapabilityInput {
  /** Already-normalized lifecycle status (DRAFT, REVIEW, EXECUTING, …). */
  status: string;
  /** Effective roles for THIS user on THIS initiative (RACI tokens included). */
  effectiveRoles: string[];
}

export interface InitiativeTopBarCapabilities {
  canEditPriority: boolean;
  canEditOwner: boolean;
  canEditTargetDate: boolean;
}

export interface InitiativeCapabilityDecision {
  topBar: InitiativeTopBarCapabilities;
  cards: { canEditCards: boolean; reasonCode: string | null };
  ai: { canUseAi: boolean; allowedSectionKeys: string[] };
  contextCreateActions: string[];
  isAdmin: boolean;
  isTerminal: boolean;
  hasEditRole: boolean;
}

/**
 * THE matrix. Everything else in this module either feeds this function or
 * formats its output.
 */
export function computeInitiativeCapabilities(
  input: InitiativeCapabilityInput
): InitiativeCapabilityDecision {
  const status = upper(input.status);
  const isTerminal = TERMINAL_STATUSES.has(status);
  const roles = uniq((input.effectiveRoles || []).map(upper).filter(Boolean));

  const isAdmin = roles.some((role) => ADMIN_ROLES.has(role));
  // Fail closed: an empty role set can never reach `true` here.
  const hasEditRole = isAdmin || roles.some((role) => EDIT_CAPABLE_ROLES.has(role));

  const canEdit = hasEditRole && !isTerminal;
  const topBar: InitiativeTopBarCapabilities = {
    canEditPriority: canEdit,
    canEditOwner: canEdit,
    canEditTargetDate: canEdit,
  };

  const contextCreateActions = (() => {
    if (!canEdit) return [];
    if ((STATUSES_WITH_TASK_CREATE as readonly string[]).includes(status)) {
      return ['task', 'decision', 'raid'];
    }
    if ((STATUSES_WITH_GOVERNANCE_CREATE as readonly string[]).includes(status)) {
      return ['decision', 'raid'];
    }
    return [];
  })();

  const canEditCards =
    topBar.canEditPriority ||
    topBar.canEditOwner ||
    topBar.canEditTargetDate ||
    contextCreateActions.length > 0;

  const canUseAi = canEditCards && !isTerminal;

  return {
    topBar,
    cards: {
      canEditCards,
      reasonCode: canEditCards ? null : 'NO_EDIT_PERMISSION_FOR_STATUS_OR_ROLE',
    },
    ai: { canUseAi, allowedSectionKeys: canUseAi ? ['*'] : [] },
    contextCreateActions,
    isAdmin,
    isTerminal,
    hasEditRole,
  };
}

/**
 * Top-bar slice only. This is the entry point the WRITE routes use, so the
 * writer and the read model can never disagree about `canEditOwner`.
 */
export function getInitiativeTopBarCapabilities(
  status: string,
  effectiveRoles: string[]
): InitiativeTopBarCapabilities {
  return computeInitiativeCapabilities({ status, effectiveRoles }).topBar;
}

// ---------------------------------------------------------------------------
// Approval profile (gates) — also pure
// ---------------------------------------------------------------------------

/**
 * Roles that may execute `gate`. Without an enabled steering board the
 * STEERING_COMMITTEE requirement degrades to PROJECT_SPONSOR/PORTFOLIO_OWNER
 * (an org that never stood up a board must still be able to move initiatives).
 */
export function resolveGateRequiredRoles(
  gate: string | null,
  steeringBoardEnabled: boolean
): string[] {
  if (!gate) return [];
  const required = (GATE_PERMISSIONS as Record<string, string[]>)[gate] || [];
  if (steeringBoardEnabled) return [...required];
  return required.flatMap((role) =>
    role === 'STEERING_COMMITTEE' ? ['PROJECT_SPONSOR', 'PORTFOLIO_OWNER'] : [role]
  );
}

export interface GateExecutionInput {
  gate: string | null;
  effectiveRoles: string[];
  steeringBoardEnabled: boolean;
}

/**
 * Single source of truth for "may this actor pass this gate".
 *
 * NOTE ON THE `!gate` BRANCH: a transition with no gate is an ungated edge of
 * the state machine (there is no approval profile to satisfy), so it returns
 * true — that is the pre-existing, deliberate contract of VALID_TRANSITIONS,
 * NOT a default-allow for a missing ROLE. Every gated transition still requires
 * a role from the approval profile, and an empty role set never passes one.
 */
export function canExecuteGate(input: GateExecutionInput): boolean {
  const roles = uniq((input.effectiveRoles || []).map(upper).filter(Boolean));
  if (roles.some((role) => ADMIN_ROLES.has(role))) return true;
  if (!input.gate) return true;
  const required = resolveGateRequiredRoles(input.gate, input.steeringBoardEnabled);
  return required.some((role) => roles.includes(upper(role)));
}

export interface RoleAssignment {
  gateRole: string;
  userId: string;
}

export interface AvailableTransition {
  targetStatus: string;
  gate: string | null;
  requiredRoles: string[];
  assignedApprovers: RoleAssignment[];
  canCurrentUserExecute: boolean;
  hasAssignedApprover: boolean;
}

/**
 * The initiative's approval profile as seen by one actor: for every valid next
 * status — which gate guards it, which roles satisfy that gate, who holds those
 * roles, and whether this actor is one of them.
 */
export function computeApprovalProfile(input: {
  status: string;
  effectiveRoles: string[];
  steeringBoardEnabled: boolean;
  assignments: RoleAssignment[];
}): AvailableTransition[] {
  const status = upper(input.status);
  const validNext = (VALID_TRANSITIONS as Record<string, string[]>)[status] || ([] as string[]);

  return validNext.map((nextStatus) => {
    const gate = getGateForTransition(status as never, nextStatus as never);
    const requiredRoles = resolveGateRequiredRoles(gate, input.steeringBoardEnabled);
    const assignedApprovers = requiredRoles.flatMap((role) =>
      (input.assignments || []).filter((a) => upper(a.gateRole) === upper(role))
    );
    return {
      targetStatus: nextStatus,
      gate: gate || null,
      requiredRoles,
      assignedApprovers,
      canCurrentUserExecute: canExecuteGate({
        gate,
        effectiveRoles: input.effectiveRoles,
        steeringBoardEnabled: input.steeringBoardEnabled,
      }),
      hasAssignedApprover: assignedApprovers.length > 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Wire format — the `capabilities` block both read models return
// ---------------------------------------------------------------------------

export interface InitiativeCapabilityContract {
  version: number;
  source: 'backend';
  topBar: InitiativeTopBarCapabilities;
  cards: { canEditCards: boolean; reasonCode: string | null };
  reasonCodes: Record<string, unknown>;
  ctaBar: {
    workflowActions: Array<{ targetStatus: string; gate: string | null }>;
    contextCreateActions: string[];
    canUseAi: boolean;
    aiAllowedSectionKeys: string[];
  };
}

/**
 * Build the versioned `capabilities` payload. Both `GET .../gate-readiness-check`
 * implementations call THIS — byte-identical shape by construction, so the UI
 * cannot see one contract on the v8 route and a different one on its fallback.
 */
export function buildInitiativeCapabilityContract(params: {
  decision: InitiativeCapabilityDecision;
  availableTransitions: AvailableTransition[];
}): InitiativeCapabilityContract {
  const { decision, availableTransitions } = params;
  const { topBar, cards, ai, contextCreateActions } = decision;

  return {
    version: 1,
    source: 'backend',
    topBar,
    cards,
    reasonCodes: {
      topBar: {
        priority: topBar.canEditPriority ? null : 'TOP_BAR_PRIORITY_LOCKED_BY_ROLE_OR_STATUS',
        owner: topBar.canEditOwner ? null : 'TOP_BAR_OWNER_LOCKED_BY_ROLE_OR_STATUS',
        targetDate: topBar.canEditTargetDate
          ? null
          : 'TOP_BAR_TARGET_DATE_LOCKED_BY_ROLE_OR_STATUS',
      },
      cards: { edit: cards.canEditCards ? null : 'NO_EDIT_PERMISSION_FOR_STATUS_OR_ROLE' },
      ai: { use: ai.canUseAi ? null : 'AI_LOCKED_NO_EDIT_CAPABILITY' },
    },
    ctaBar: {
      workflowActions: availableTransitions
        .filter((transition) => transition.canCurrentUserExecute)
        .map((transition) => ({ targetStatus: transition.targetStatus, gate: transition.gate })),
      contextCreateActions,
      canUseAi: ai.canUseAi,
      aiAllowedSectionKeys: ai.allowedSectionKeys,
    },
  };
}

// ---------------------------------------------------------------------------
// I/O — RACI input, tenant scope, and the composed context
// ---------------------------------------------------------------------------

/**
 * RACI role tokens for one user on one initiative.
 *
 * THREE-WAY TENANT SCOPE, on purpose: the stakeholder row is joined to the
 * initiative (org-scoped) AND to the user (org-scoped). `initiative_stakeholders`
 * carries no `organization_id` of its own, and a row pointing at a foreign-org
 * user may already exist from before the write guard below — such a row must
 * grant NOTHING rather than leak capability across tenants.
 */
export async function readInitiativeRaciRoles(
  organizationId: string,
  initiativeId: string,
  userId: string
): Promise<RaciRoleToken[]> {
  if (!organizationId || !initiativeId || !userId) return [];
  try {
    const rows = await queryHelpers.queryAll(
      `SELECT s.raci_type as "raciType"
         FROM initiative_stakeholders s
         JOIN initiatives i ON i.id = s.initiative_id
         JOIN users u ON u.id = s.user_id
        WHERE s.initiative_id = ?
          AND s.user_id = ?
          AND i.organization_id = ?
          AND u.organization_id = ?`,
      [initiativeId, userId, organizationId, organizationId]
    );
    const tokens = (rows as Array<{ raciType?: string | null }>)
      .map((row) => upper(row?.raciType) as RaciLetter)
      .filter((letter): letter is RaciLetter => letter in RACI_ROLE_TOKENS)
      .map((letter) => RACI_ROLE_TOKENS[letter]);
    return uniq(tokens);
  } catch {
    // Fail closed — an unreadable RACI table grants no roles.
    return [];
  }
}

export interface InitiativeCapabilityContext {
  access: InitiativeAccessContext;
  /** Access-resolver roles PLUS the RACI tokens. This is what the matrix eats. */
  effectiveRoles: string[];
  raciRoles: RaciRoleToken[];
  steeringBoardEnabled: boolean;
  projectId: string | null;
}

/**
 * Canonical role profile for the capability matrix: the existing access context
 * (owner · sponsor · project role · gate roles · steering board) with RACI
 * folded in. Every caller that needs capabilities should start here.
 */
export async function resolveInitiativeCapabilityContext(
  organizationId: string,
  initiativeId: string,
  userId: string,
  systemRoleHint?: string | null
): Promise<InitiativeCapabilityContext> {
  const access = await resolveInitiativeAccessContext(
    organizationId,
    initiativeId,
    userId,
    systemRoleHint
  );
  const raciRoles = await readInitiativeRaciRoles(organizationId, initiativeId, userId);
  return {
    access,
    raciRoles,
    effectiveRoles: uniq([...access.effectiveRoles, ...raciRoles]),
    steeringBoardEnabled: !!access.steeringBoard?.enabled,
    projectId: access.projectId,
  };
}

// ---------------------------------------------------------------------------
// Tenant guard for role ASSIGNMENT
// ---------------------------------------------------------------------------

export interface TenantScopeVerdict {
  ok: boolean;
  /** User ids that are not members of `organizationId` (or do not exist). */
  offending: string[];
}

/**
 * Deny assigning a user from another organization to any initiative role.
 *
 * Applies to owner/sponsor writes, explicit gate-role assignment and RACI
 * stakeholder rows. Unknown user id counts as offending — fail closed, so a
 * typo cannot create a role held by nobody in this tenant.
 */
export async function assertUsersInOrganization(
  organizationId: string,
  userIds: Array<string | null | undefined>
): Promise<TenantScopeVerdict> {
  const candidates = uniq(
    (userIds || []).map((id) => String(id ?? '').trim()).filter((id) => id.length > 0)
  );
  if (candidates.length === 0) return { ok: true, offending: [] };
  if (!organizationId) return { ok: false, offending: candidates };

  const offending: string[] = [];
  for (const candidate of candidates) {
    let row: unknown = null;
    try {
      row = await queryHelpers.queryOne(
        `SELECT id FROM users WHERE id = ? AND organization_id = ?`,
        [candidate, organizationId]
      );
    } catch {
      // Unreadable users table ⇒ cannot prove same-tenant ⇒ deny.
      row = null;
    }
    if (!row) offending.push(candidate);
  }
  return { ok: offending.length === 0, offending };
}

/** Shared 403 body so every route reports a cross-tenant denial identically. */
export function crossTenantDenialBody(offending: string[]) {
  return {
    error: 'Cannot assign a user from another organization to this initiative',
    code: 'CROSS_TENANT_ASSIGNMENT_DENIED',
    offendingUserIds: offending,
  };
}
