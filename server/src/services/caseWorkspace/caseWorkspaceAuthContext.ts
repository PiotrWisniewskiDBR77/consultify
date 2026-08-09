/**
 * Case Workspace — Authorization Context service (CW-P12).
 *
 * A stateless, read-only authorization primitive for the Case Workspace
 * domain. It is the "future route layer" that every one of the eleven prior
 * packets (CW-P01 caseCoreService.ts, CW-P02 casePlanVersionService.ts,
 * CW-P03 capabilityRegistryService.ts, CW-P04 runBindingService.ts, CW-P05
 * proposalApprovalService.ts, CW-P06 executionGraphService.ts /
 * artifactLinkService.ts, CW-P07 caseHistoryService.ts, CW-P08
 * waitSubscriptionService.ts, CW-P09/CW-P10/CW-P11 and others) each flagged
 * in their own open_questions as: "Tenant/membership fail-closed checks
 * (CW-RT-065, CW-DOD-D5/D6) are not performed at this service layer... left
 * to a route layer that does not yet exist anywhere in this codebase." This
 * packet builds that missing primitive — it does NOT wire it into any of
 * the eleven existing services (see the retrofit note at the bottom of this
 * comment) and does NOT add a migration: it reads `organization_members`
 * (server/migrations/727_beta_missing_tables.sql) and `case_core` (CW-P01's
 * table), both already exist, both strictly read-only here, exactly the
 * same read-only-reference posture every prior packet already uses for
 * tables it does not own.
 *
 * req_id coverage (docs/product/case-workspace/acceptance/
 * FUNCTIONAL_REQUIREMENT_COVERAGE.csv, category=security):
 *
 *   resolveActorMembership -> CW-DOD-D5, CW-DOD-D6, SEC-003, SEC-004
 *   requireOrgMember        -> CW-DOD-D5, CW-DOD-D6, SEC-001, SEC-003
 *   requireOrgRole          -> CW-DOD-D5, GOV-013, SEC-001
 *   requireCaseAccess       -> CW-DOD-D5, CW-DOD-D6, SEC-006, SEC-007,
 *                               SEC-008, SEC-009, CW-01-026-INV1
 *
 * ENUMERATION-ORACLE DECISION (requireCaseAccess):
 * requireCaseAccess makes "case not found" and "actor is not an authorized
 * member of the case's organization" externally IDENTICAL — same thrown
 * code ('case_access_denied'), same message, in all three of: (a) a caseId
 * belonging to a real case in a different tenant, (b) a caseId that does
 * not exist at all, and (c) a caseId for a real case in the caller's own
 * org that the actor simply is not an active member of. This satisfies
 * SEC-009 ("Cross-tenant/project... references fail closed without
 * disclosing existence") and CW-DOD-D6 ("Swapped IDs, revoked membership...
 * fail closed"): an attacker probing caseIds cannot use the error shape to
 * learn whether a given caseId exists. The distinguishing detail (which of
 * the three actually happened) is preserved ONLY on a non-public
 * `internalReason` field of the thrown CaseWorkspaceAuthError, explicitly
 * documented below as log-only and never to be serialized into an HTTP
 * response, so operators keep debuggability without callers gaining an
 * oracle. This departs from a literal "throw a distinct case_not_found"
 * reading in favor of SEC-009/CW-DOD-D6, both authority_level
 * FROZEN_TARGET_CONTRACT/DOD in the SSOT, which this design treats as
 * higher-authority than an undifferentiated case_not_found. By contrast,
 * requireOrgMember and requireOrgRole DO surface distinct
 * 'not_org_member' / 'insufficient_org_role' codes: organizationId in those
 * calls is assumed already known to the caller's own session/org context
 * (a route's own tenant resolution), not a caller-supplied id being probed
 * for existence, so there is no cross-tenant object to enumerate at that
 * layer.
 *
 * RETROFIT NOTE (doc-comment only — no code changes to any of the eleven
 * existing service files in this packet; a separate future packet's job).
 * Highest-priority call sites for a future route layer to wire this module
 * into, in priority order:
 *   1. proposalApprovalService.recordApprovalDecision — the literal human
 *      authorization decision point (GOV-022's self-approval ceiling,
 *      SEC-017/018 approval binding). Today it checks self-approval and
 *      proposal staleness but never that decidedByActorId is even an active
 *      member of the case's organization, let alone holds a role the org's
 *      policy requires for that effect_class.
 *   2. proposalApprovalService.transitionProposalToExecuting /
 *      retryProposalFromFailed — SEC-004's "execution still checks current
 *      authority; revocation after approval blocks execution" is not
 *      implemented anywhere today; these are the exact call sites that must
 *      re-run requireCaseAccess/requireOrgRole at the execution moment, not
 *      just at approval time, so a membership revoked between APPROVE and
 *      EXECUTING is caught.
 *   3. caseCoreService.transitionStatus (especially -> CLOSED/CANCELLED)
 *      and recordClosure — governance-terminal state changes with no role
 *      floor today; a MEMBER can currently close/cancel a Case exactly as
 *      freely as an OWNER.
 *   4. casePlanVersionService.publishPlanVersion — GOV-030 requires an
 *      explicit approval control for a "published plan"; the method
 *      validates graph structure but never the publisher's standing.
 *   5. proposalApprovalService.createActionProposal — first mutation point
 *      in the approval pipeline; should verify the creator is at least an
 *      active member (and arguably role-gated by effectClass) before a
 *      proposal can exist.
 *   6. waitSubscriptionService's callback-processing method — its own
 *      open_question already names CW-DOD-D6 ("forged/replayed callbacks
 *      fail closed") as unenforced; callbacks are the classic
 *      caller-supplied-ID vector requireCaseAccess's fail-closed design is
 *      built for.
 *
 * OPEN QUESTIONS (carried forward, not resolved by this packet):
 *   1. requireOrgRole is a single flat floor (>= one role). Real policy per
 *      GOV-013/CW-00-013 may need per-effectClass or per-action role floors
 *      (e.g. A3/A4 material actions need a higher floor than A1 drafting) —
 *      this module deliberately provides only the primitive comparison, not
 *      a policy table; a future policy-mapping layer (proposal.effectClass
 *      -> minimumRole) is out of scope here and not yet designed anywhere
 *      in this codebase.
 *   2. requireCaseAccess only proves "is an active member of the case's
 *      org" — it does NOT check object-level ACL beyond org (SEC-001's
 *      "object ACL" term, SEC-003's "object ACL and current target
 *      version" step) since no per-case or per-artifact ACL table exists in
 *      this codebase yet (only org-level organization_members). When/if a
 *      finer-grained Case-level ACL table is added, requireCaseAccess is
 *      the natural place to extend, not a new module.
 *   3. No delegation/execute-as support (SEC-012/SEC-013's ActorContext
 *      HUMAN/AGENT/SYSTEM distinction and delegated-authority scope) —
 *      actorUserId is assumed to already be the correct "on whose behalf"
 *      identity resolved upstream; this module does not itself resolve
 *      Teresa-acting-for-user delegation chains.
 *   4. Should requireOrgRole's insufficient_org_role failure ALSO be folded
 *      into the anonymized case_access_denied shape when a future
 *      requireCaseAccessWithRole composes both? This design leaves
 *      requireOrgRole's distinct code observable when called standalone
 *      (organizationId assumed already known to the caller), but a
 *      composed case+role helper would need to decide whether
 *      role-insufficient-on-a-real-case should also collapse into the
 *      generic denial to stay consistent with the enumeration-oracle
 *      decision above. Not resolved here — flagged for whoever builds that
 *      composition.
 *   5. case_core.organization_id is read with a plain (non-locking)
 *      queryOne, consistent with this being a read for a permission GATE
 *      rather than a value the caller mutates — relies on CW-01-026-INV1
 *      ("one org context per Case, never mutated after create") rather than
 *      re-locking; flagged in case that invariant is ever relaxed.
 *   6. Whether resolveActorMembership should also expose a raw/unfiltered
 *      variant (returning inactive rows too, with status visible) for
 *      admin/audit UI use cases is left undesigned — today the only
 *      exported reader deliberately collapses non-ACTIVE to null with no
 *      visibility of why, correct for authorization but wrong for an audit
 *      screen; a second function name would be needed, not a parameter that
 *      weakens the fail-closed default.
 */

import { queryOne } from '../../utils/queryHelpers.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Mirrors organization_members' CHECK constraint verbatim
 * (server/migrations/727_beta_missing_tables.sql, line 12). Ordering
 * (lowest -> highest privilege, index = rank) is corroborated by two
 * independent existing implementations rather than invented:
 * finalBatchService.ts's roleRank() (OWNER/SUPERADMIN highest, ADMIN next,
 * MEMBER/TEAM_MEMBER/USER below that, CONSULTANT falling into the
 * VIEWER/GUEST/CLIENT lowest bucket) and chatPermissionService.ts's
 * mapOrgRoleToChatRole() (OWNER+ADMIN -> 'owner' tier, MEMBER ->
 * 'contributor', CONSULTANT -> 'viewer', comment literally reads "Viewer —
 * CONSULTANT / VIEWER -> read-only"). Both agree OWNER and ADMIN outrank
 * MEMBER, which outranks CONSULTANT.
 */
export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT';

// Ascending privilege order — index = rank. Same "lowest -> highest, index =
// rank" idiom already used verbatim in
// server/src/services/v8/workspaceGovernanceService.ts's ROLE_RANK_ORDER.
const ORG_ROLES: readonly OrgRole[] = ['CONSULTANT', 'MEMBER', 'ADMIN', 'OWNER'];

/** camelCase projection of an organization_members row (id -> membershipId),
 * matching this directory's universal snake_case-row/camelCase-public-type
 * convention (e.g. CaseCoreRow/CaseCore in caseCoreService.ts). */
export interface OrgMembership {
  membershipId: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  status: string;
  invitedByUserId: string | null;
  createdAt: string;
}

export type CaseWorkspaceAuthErrorCode =
  | 'not_org_member'
  | 'insufficient_org_role'
  | 'case_access_denied';

/**
 * The typed error this packet's design calls for. Chosen over this
 * directory's sibling convention of a bare `new Error('snake_case_code')`
 * (used by all eleven existing services) specifically because a future
 * route layer needs to `instanceof`-branch this into an HTTP 403 without
 * string-parsing `.message`, and because `internalReason` must be
 * structurally kept OFF the public code/message surface (see the
 * enumeration-oracle decision above) — a bare Error has no place to carry a
 * log-only field separately from a message a route might echo back.
 *
 * Does NOT extend the codebase-wide server/src/utils/ErrorHandler.ts
 * AppError (statusCode/details/status): AppError is HTTP-response-shaped,
 * and this module is deliberately below and agnostic of any route layer. A
 * future route layer should be the one place that maps
 * CaseWorkspaceAuthError -> AppError(403, ...).
 *
 * `internalReason` is log-only. It MUST NEVER be serialized into an HTTP
 * response body — that would recreate the exact existence oracle
 * `requireCaseAccess` is designed to prevent (see the enumeration-oracle
 * decision above).
 */
export class CaseWorkspaceAuthError extends Error {
  readonly code: CaseWorkspaceAuthErrorCode;
  /** Log-only. Never serialize into an HTTP response — see class doc. */
  readonly internalReason?: string;

  constructor(code: CaseWorkspaceAuthErrorCode, message: string, internalReason?: string) {
    super(message);
    this.name = 'CaseWorkspaceAuthError';
    this.code = code;
    this.internalReason = internalReason;
  }
}

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

interface OrganizationMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  status: string | null;
  invited_by_user_id: string | null;
  created_at: string;
}

interface CaseCoreOrgRefRow {
  organization_id: string;
}

// ---------------------------------------------------------------------------
// Local helpers (mirrors caseCoreService.ts/casePlanVersionService.ts/
// proposalApprovalService.ts's own local helpers — not imported from there,
// each service file in this directory keeps its own copy per that file's
// existing convention).
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

function mapMembershipRow(row: OrganizationMemberRow): OrgMembership {
  return {
    membershipId: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role,
    status: row.status ?? 'ACTIVE',
    invitedByUserId: row.invited_by_user_id,
    // organization_members.created_at is TIMESTAMPTZ (unlike case_core's TEXT
    // created_at elsewhere in this directory), so node-postgres hands this
    // back as a native Date, not a string, despite OrganizationMemberRow's
    // declared shape — normalize to an ISO string to actually satisfy the
    // documented `OrgMembership.createdAt: string` contract.
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

function roleRank(role: OrgRole): number {
  return ORG_ROLES.indexOf(role);
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * CW-DOD-D5, CW-DOD-D6, SEC-003, SEC-004.
 *
 * Plain read, no lock — mirrors getCase()/getPlanVersion()/
 * getActionProposal()'s plain-read pattern in the sibling services, since
 * this is a query used to gate an action rather than itself a mutation
 * needing OCC. Returns null when no membership row exists for
 * (actorUserId, organizationId), or when one exists but
 * `status !== 'ACTIVE'` (covers 'REVOKED', 'SUSPENDED', 'PENDING', any
 * future non-active value, and a defensively-treated null/empty status
 * despite the column's DB-level DEFAULT 'ACTIVE') — a revoked/suspended
 * member fails closed exactly like a missing row, never fails open on an
 * unrecognized status string.
 */
export async function resolveActorMembership(
  actorUserId: string,
  organizationId: string
): Promise<OrgMembership | null> {
  const userId = requireNonBlank(actorUserId, 'auth_actor_user_id_required');
  const orgId = requireNonBlank(organizationId, 'auth_organization_id_required');

  const row = await queryOne<OrganizationMemberRow>(
    `SELECT id, organization_id, user_id, role, status, invited_by_user_id, created_at
       FROM organization_members
      WHERE user_id = ? AND organization_id = ?`,
    [userId, orgId]
  );
  if (!row) return null;
  if ((row.status ?? '').trim().toUpperCase() !== 'ACTIVE') return null;
  return mapMembershipRow(row);
}

/**
 * CW-DOD-D5, CW-DOD-D6, SEC-001, SEC-003.
 *
 * The direct implementation every one of the eleven sibling services'
 * repeated open_question ("Tenant/membership fail-closed checks... are not
 * performed at this service layer") points at as the missing piece. Throws
 * a CaseWorkspaceAuthError('not_org_member', ...) if
 * resolveActorMembership returns null (no row, or a non-ACTIVE row);
 * otherwise returns the membership.
 */
export async function requireOrgMember(
  actorUserId: string,
  organizationId: string
): Promise<OrgMembership> {
  const membership = await resolveActorMembership(actorUserId, organizationId);
  if (!membership) {
    throw new CaseWorkspaceAuthError(
      'not_org_member',
      'Actor is not an active member of this organization.'
    );
  }
  return membership;
}

/**
 * CW-DOD-D5, GOV-013, SEC-001.
 *
 * Calls requireOrgMember first (so a missing/inactive membership already
 * fails closed via that path), then compares roleRank(membership.role)
 * against roleRank(minimumRole). Throws
 * CaseWorkspaceAuthError('insufficient_org_role', ...) if the actor's role
 * ranks below `minimumRole`; otherwise returns the membership.
 *
 * A single flat floor only — no per-effectClass/per-action policy table
 * (see open_questions #1 above).
 */
export async function requireOrgRole(
  actorUserId: string,
  organizationId: string,
  minimumRole: OrgRole
): Promise<OrgMembership> {
  requireEnum(minimumRole, ORG_ROLES, 'auth_minimum_role_invalid');
  const membership = await requireOrgMember(actorUserId, organizationId);
  if (roleRank(membership.role) < roleRank(minimumRole)) {
    throw new CaseWorkspaceAuthError(
      'insufficient_org_role',
      `Actor role ${membership.role} does not meet the minimum required role ${minimumRole}.`
    );
  }
  return membership;
}

/**
 * CW-DOD-D5, CW-DOD-D6, SEC-006, SEC-007, SEC-008, SEC-009,
 * CW-01-026-INV1.
 *
 * Reads (never writes) `case_core.organization_id` for the given caseId —
 * same read-only-reference posture every prior packet already uses for
 * `case_core` — then requires the actor to be an active org member for
 * that Case's organization. Deliberately takes no minimumRole parameter:
 * callers needing a role floor on top of case access should compose
 * `requireCaseAccess(...)` then `requireOrgRole(...)` themselves, keeping
 * this function's job to exactly one thing — "does this actor have any
 * standing to touch this case at all".
 *
 * See the enumeration-oracle decision in this file's header: a caseId that
 * does not exist, a caseId belonging to another tenant, and a real caseId
 * the actor is simply not a member of all throw the SAME
 * CaseWorkspaceAuthError('case_access_denied', ...) with the same public
 * message, so a caller cannot use the error shape to learn whether a given
 * caseId exists (SEC-009, CW-DOD-D6). The distinguishing detail is carried
 * only in the log-only `internalReason` field.
 */
export async function requireCaseAccess(
  actorUserId: string,
  caseId: string
): Promise<OrgMembership> {
  const userId = requireNonBlank(actorUserId, 'auth_actor_user_id_required');
  const id = requireNonBlank(caseId, 'auth_case_id_required');

  const caseRow = await queryOne<CaseCoreOrgRefRow>(
    `SELECT organization_id FROM case_core WHERE case_id = ?`,
    [id]
  );
  if (!caseRow) {
    throw new CaseWorkspaceAuthError(
      'case_access_denied',
      'Access to this case is denied.',
      'case_not_found'
    );
  }

  try {
    return await requireOrgMember(userId, caseRow.organization_id);
  } catch (err) {
    if (err instanceof CaseWorkspaceAuthError) {
      throw new CaseWorkspaceAuthError(
        'case_access_denied',
        'Access to this case is denied.',
        err.code
      );
    }
    throw err;
  }
}
