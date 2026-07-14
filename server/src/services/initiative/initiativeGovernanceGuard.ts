/**
 * Initiative Governance Guard (M13 security layer)
 *
 * Server-side role / capability enforcement for initiative governance gates and
 * for the pilot-participant create/generate block. This is the authoritative
 * companion to the UI-only gating in `src/utils/roleGuards.ts` /
 * `src/utils/pilotAccess.ts` — those control what the UI *shows*; this controls
 * what the backend *allows*.
 *
 * Role vocabulary derives from:
 * - docs/product/ROLES_MODEL.md (system roles + initiative effective roles)
 * - docs/product/INITIATIVE_GOVERNANCE_MODEL.md (gate owners / approvers)
 * - docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md (status × role × CTA)
 *
 * Reuses the existing `resolveInitiativeAccessContext` resolver (effective
 * roles) and the existing `normalizeApplicationRole` band logic. It does NOT
 * introduce a new auth framework.
 */
import { normalizeApplicationRole } from '../../utils/roleNormalization.js';
import {
  type InitiativeAccessContext,
  resolveInitiativeAccessContext,
} from './initiativeAccessResolver.js';

/**
 * Governance gate identifiers (workflow transitions owned by a governance role).
 */
export type InitiativeGovernanceGate = 'SUBMIT_REVIEW' | 'APPROVE' | 'REJECT';

/**
 * Effective roles permitted to execute each governance gate.
 *
 * Source: INITIATIVE_GOVERNANCE_MODEL.md §UX permissions + §gate catalog and
 * ROLES_MODEL.md §6 (effective role identifiers). `ADMIN` is the system-admin
 * override (admin/owner/superadmin) and may always act on gates.
 *
 * - SUBMIT_REVIEW: owned by the Initiative Owner; PMO / Project Leader (delivery
 *   command) may also submit on behalf of the area. A bare TEAM_MEMBER may not.
 * - APPROVE / REJECT: governance decision owned by the Project Sponsor (or the
 *   Steering Committee when the board is enabled). PMO owns the SCHEDULED/DONE
 *   workflow gates. A bare TEAM_MEMBER / pilot participant may not.
 */
const GATE_PERMITTED_ROLES: Record<InitiativeGovernanceGate, ReadonlySet<string>> = {
  SUBMIT_REVIEW: new Set(['ADMIN', 'INITIATIVE_OWNER', 'PROJECT_MANAGER', 'PROJECT_LEAD', 'PMO']),
  APPROVE: new Set(['ADMIN', 'PROJECT_SPONSOR', 'STEERING_COMMITTEE', 'PORTFOLIO_OWNER', 'PMO']),
  REJECT: new Set(['ADMIN', 'PROJECT_SPONSOR', 'STEERING_COMMITTEE', 'PORTFOLIO_OWNER', 'PMO']),
};

export interface GovernanceGuardDecision {
  allowed: boolean;
  /** Stable machine code for the 403 body. */
  code: string;
  /** Human-readable reason (English; UI localizes its own copy). */
  reason: string;
}

const FORBIDDEN_GATE = (gate: InitiativeGovernanceGate): GovernanceGuardDecision => ({
  allowed: false,
  code: 'INITIATIVE_GATE_ROLE_REQUIRED',
  reason: `Your role is not permitted to perform the ${gate} gate on this initiative.`,
});

const FORBIDDEN_PILOT: GovernanceGuardDecision = {
  allowed: false,
  code: 'INITIATIVE_PILOT_WRITE_FORBIDDEN',
  reason:
    'Pilot participants cannot create or generate initiatives. This action is reserved for project leads and administrators.',
};

const ALLOWED: GovernanceGuardDecision = {
  allowed: true,
  code: 'OK',
  reason: '',
};

/**
 * Delivery/staff roles that fall in the USER band by normalization but are NOT
 * pilot respondents — they operate the platform (create/run initiatives). Genuine
 * pilot respondents (bare USER, MEMBER/TEAM_MEMBER, GUEST/VIEWER/CLIENT) stay
 * restricted. Keep in sync with `STAFF_EXEMPT_FROM_PILOT` on the frontend
 * (src/utils/roleGuards.ts).
 */
const STAFF_EXEMPT_FROM_PILOT: ReadonlySet<string> = new Set([
  'PROJECT_MANAGER',
  'MANAGER',
  'CONSULTANT',
]);

/**
 * Pilot participants are the application "USER"/"GUEST" band (TEAM_MEMBER,
 * MEMBER, VIEWER, CLIENT, …) MINUS the delivery/staff roles above. Mirrors
 * `isPilotRestrictedRole` on the frontend.
 */
export function isPilotRestrictedSystemRole(role: string | null | undefined): boolean {
  const raw = String(role || '')
    .trim()
    .toUpperCase();
  if (STAFF_EXEMPT_FROM_PILOT.has(raw)) return false;
  const band = normalizeApplicationRole(role);
  return band === 'USER' || band === 'GUEST';
}

/**
 * Is the system role an admin-band override (admin / owner / superadmin)?
 */
function isAdminBand(role: string | null | undefined): boolean {
  const band = normalizeApplicationRole(role);
  return band === 'ADMIN' || band === 'OWNER';
}

/**
 * Decide whether the user may CREATE or GENERATE initiatives.
 *
 * Pilot-restricted system roles (USER/GUEST band) are blocked server-side. This
 * is the authoritative backend of the UI-only pilot gating.
 */
export function evaluateInitiativeWriteAccess(
  systemRole: string | null | undefined,
  options?: { isSuperAdmin?: boolean }
): GovernanceGuardDecision {
  // Superadmin always passes (technical override).
  if (options?.isSuperAdmin) return ALLOWED;
  if (isPilotRestrictedSystemRole(systemRole)) return FORBIDDEN_PILOT;
  return ALLOWED;
}

/**
 * Express middleware: block pilot participants (USER/GUEST band) from a
 * create/generate route. Mounts AFTER `verifyToken` / `requireOrgAccess` so
 * `req.user.role` is populated. Returns 403 with a stable code on block.
 *
 * Reusable across the PMO initiatives router and the generator router so the
 * pilot write-block is enforced consistently without a new auth framework.
 */
export function requireInitiativeWriteAccess() {
  return (req: any, res: any, next: () => void): void => {
    const decision = evaluateInitiativeWriteAccess(req?.user?.role, {
      isSuperAdmin: req?.user?.isSuperAdmin === true,
    });
    if (!decision.allowed) {
      res.status(403).json({ error: decision.reason, code: decision.code });
      return;
    }
    next();
  };
}

/**
 * Decide whether the user may execute a governance gate on a specific
 * initiative, using the resolved effective-role set.
 *
 * Admin-band system roles short-circuit to allowed (technical override; matches
 * the resolver, which injects an `ADMIN` effective role for them).
 */
export async function evaluateInitiativeGateAccess(params: {
  organizationId: string;
  initiativeId: string;
  userId: string;
  gate: InitiativeGovernanceGate;
  systemRoleHint?: string | null;
  isSuperAdmin?: boolean;
}): Promise<GovernanceGuardDecision> {
  const { organizationId, initiativeId, userId, gate, systemRoleHint, isSuperAdmin } = params;

  if (isSuperAdmin || isAdminBand(systemRoleHint)) return ALLOWED;

  let context: InitiativeAccessContext;
  try {
    context = await resolveInitiativeAccessContext(
      organizationId,
      initiativeId,
      userId,
      systemRoleHint
    );
  } catch {
    // Fail closed: if we cannot resolve the access context, deny the gate.
    return FORBIDDEN_GATE(gate);
  }

  // Resolver injects ADMIN effective role for system admins; honor it.
  if (context.effectiveRoles.includes('ADMIN')) return ALLOWED;

  const permitted = GATE_PERMITTED_ROLES[gate];
  const hasPermittedRole = context.effectiveRoles.some((role) => permitted.has(role));
  return hasPermittedRole ? ALLOWED : FORBIDDEN_GATE(gate);
}
