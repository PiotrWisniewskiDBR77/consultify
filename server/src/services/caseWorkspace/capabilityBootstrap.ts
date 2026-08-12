/**
 * Case Workspace — Capability Bootstrap safe config loader (packet E1).
 *
 * Implements OD-CW-BOOTSTRAP-20260812 (the frozen owner decision) exactly —
 * this is settled scope, not a design surface:
 *
 *   1. "DEDICATED SYNTHETIC SERVICE PRINCIPAL — never Piotr's personal
 *      account, never 'some ADMIN found in the database'." Enforced by:
 *      this file contains NO query that selects an actor/org — the ONLY two
 *      identifiers it will ever act on come from `loadCapabilityBootstrapConfig`
 *      (below), which reads exactly two env vars and nothing else. There is
 *      no code path anywhere in this file that looks up "an admin" — see
 *      this packet's final report for the `grep` that proves it codebase-wide.
 *   2. "Operates ONLY within a disposable test organization." Enforced
 *      operationally, not in code: the organization named by
 *      CASE_WORKSPACE_CAPABILITY_BOOT_ORG_ID is whatever the deployer
 *      configures. This loader has no way to verify "disposable-ness" from
 *      inside the database (no such flag exists on `organizations`), so the
 *      obligation is on whoever sets the env var; this file's contribution is
 *      making sure nothing else can be substituted silently (clause 4).
 *   3. "Holds the minimum required ADMIN role." Enforced by the pre-flight
 *      `requireOrgRole(actorId, orgId, 'ADMIN')` call in
 *      `bootstrapCaseWorkspaceCapabilities` below — the SAME primitive
 *      `registerCapability` itself uses internally (defense in depth: the
 *      loader checks once up front so a misconfigured actor never even
 *      causes the first adapter's binding to be set; `registerCapability`
 *      checks again, independently, inside every one of the seven adapter
 *      registrations it is not possible to reach without it).
 *   4. "Identifiers come from env... NOTHING hardcoded." Enforced by
 *      `loadCapabilityBootstrapConfig` — its only inputs are
 *      `env[ACTOR_ID_ENV_VAR]` / `env[ORG_ID_ENV_VAR]`; no default, no
 *      literal id, no query result is ever substituted for a missing value.
 *   5. "Missing or invalid configuration FAILS CLOSED — must NEVER fall back
 *      to picking the first ADMIN in the database... That fallback would be
 *      a privilege-escalation bug." Enforced by the very first branch of
 *      `bootstrapCaseWorkspaceCapabilities`: a missing actorId or orgId
 *      returns `SKIPPED_MISSING_CONFIG` immediately, BEFORE any database
 *      call of any kind — `registerBuiltinCapabilityAdapters` (and therefore
 *      every one of the seven `registerCapabilityWithAdapter` calls it
 *      makes) is never invoked on this path. There is no SELECT of any org
 *      role anywhere in this module — see the final report's grep.
 *   6. "Revoked membership or mismatched organization BLOCKS bootstrap."
 *      Enforced by the same pre-flight `requireOrgRole` call: it delegates
 *      to `resolveActorMembership`, which looks up EXACTLY
 *      `(actorId, orgId)` and treats any non-'ACTIVE' status (REVOKED,
 *      SUSPENDED, ...) as no membership at all (caseWorkspaceAuthContext.ts
 *      lines 289-294) — a membership that exists only under a DIFFERENT
 *      organizationId is likewise invisible to that lookup. Both collapse to
 *      the same `not_org_member` refusal this loader maps to
 *      `REFUSED_NOT_ORG_MEMBER`, and — critically — that refusal happens
 *      BEFORE `registerBuiltinCapabilityAdapters` is ever called, so zero
 *      registrations are attempted.
 *   7. "Re-boot is idempotent." Not re-implemented here — delegated
 *      entirely to `registerBuiltinCapabilityAdapters` /
 *      `registerCapabilityWithAdapter`, which are already idempotent across
 *      process restarts (capabilityAdapterService.ts's own header on
 *      `registerCapabilityWithAdapter`, "WHY THIS IS IDEMPOTENT ACROSS
 *      PROCESS BOOTS"). This loader adds a pre-flight authorization gate in
 *      FRONT of that existing idempotent call; it does not touch its
 *      idempotency.
 *   8. "An in-memory adapter binding must NEVER bypass the persistent
 *      registry or RBAC." Enforced by what this file does NOT do: it never
 *      calls `registerCapabilityBinding` (the bind-only, no-registry-row
 *      primitive) — the ONLY registration path used below is
 *      `registerBuiltinCapabilityAdapters`, which exclusively uses the
 *      coupled `registerCapabilityWithAdapter` (bind + a `registerCapability`
 *      call that itself enforces `requireOrgRole(..., 'ADMIN')`). See the
 *      final report's grep for confirmation this file contains no call to
 *      the bind-only primitive.
 *
 * WHY A SEPARATE PRE-FLIGHT CHECK, GIVEN `registerCapability` ALREADY
 * ENFORCES ADMIN INTERNALLY
 * ---------------------------------------------------------------------------
 * `registerCapabilityWithAdapter` (capabilityAdapterService.ts) sets its
 * in-memory binding BEFORE calling `registerCapability` (deliberately, so a
 * second boot's `capability_already_registered` doesn't lose the binding —
 * see that file's own header). That binding is documented as inert without a
 * matching ACTIVE registry row, so a misconfigured actor never gains any
 * reachability from it alone. But `registerBuiltinCapabilityAdapters` awaits
 * seven `register*Capability` calls in strict sequence: without a pre-flight
 * check, an unauthorized actor would still cause the FIRST adapter's binding
 * to be set (harmlessly inert) before the auth refusal on the row aborts the
 * whole chain — an unnecessary, avoidable side effect for a config that was
 * never going to succeed. Checking once, up front, means an invalid actor/org
 * causes literally zero in-memory or database mutation of any kind.
 *
 * NO SECRETS/IDENTIFIERS IN LOGS
 * ---------------------------------------------------------------------------
 * Every log line below is a fixed string plus, at most, a `CaseWorkspaceAuthError.code`
 * (a closed enum: 'not_org_member' | 'insufficient_org_role' | 'case_access_denied')
 * or this module's own closed `CapabilityBootstrapStatus` enum. Neither the
 * actor id nor the organization id is ever interpolated into a log message —
 * see this packet's final report for the grep proving it.
 */

import logger from '../../utils/Logger.js';
import {
  CaseWorkspaceAuthError,
  requireOrgRole,
  type OrgMembership,
} from './caseWorkspaceAuthContext.js';
import { registerBuiltinCapabilityAdapters } from './adapters/index.js';

/** Actor identifier env var — see OD-CW-BOOTSTRAP-20260812 clause 4. */
export const CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID_ENV_VAR =
  'CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID';
/** Organization identifier env var — see OD-CW-BOOTSTRAP-20260812 clause 4. */
export const CASE_WORKSPACE_CAPABILITY_BOOT_ORG_ID_ENV_VAR =
  'CASE_WORKSPACE_CAPABILITY_BOOT_ORG_ID';

/** The minimum role OD-CW-BOOTSTRAP-20260812 clause 3 requires. */
const REQUIRED_MIN_ROLE = 'ADMIN' as const;

export type CapabilityBootstrapStatus =
  /** Registration attempted and succeeded (first boot or an idempotent replay). */
  | 'REGISTERED'
  /** One or both env vars were missing/blank — zero registrations attempted. */
  | 'SKIPPED_MISSING_CONFIG'
  /**
   * The configured actor has no ACTIVE membership in the configured org —
   * covers an unknown actor, an actor whose only membership is in a
   * DIFFERENT organization, and a REVOKED/SUSPENDED membership. Zero
   * registrations attempted.
   */
  | 'REFUSED_NOT_ORG_MEMBER'
  /** The configured actor is an ACTIVE member but below ADMIN. Zero registrations attempted. */
  | 'REFUSED_INSUFFICIENT_ROLE'
  /** The pre-flight check itself threw something other than CaseWorkspaceAuthError. Zero registrations attempted. */
  | 'REFUSED_UNEXPECTED'
  /** Pre-flight passed, but registerBuiltinCapabilityAdapters itself failed (e.g. a TOCTOU revoke). */
  | 'FAILED_DURING_REGISTRATION';

export interface CapabilityBootstrapResult {
  status: CapabilityBootstrapStatus;
  /** True only once `registerBuiltinCapabilityAdapters` was actually invoked. */
  attempted: boolean;
}

/** Minimal shape this module reads from — `process.env`-compatible, but injectable for tests. */
export interface CapabilityBootstrapEnv {
  [key: string]: string | undefined;
}

export interface CapabilityBootstrapConfig {
  actorId: string | null;
  orgId: string | null;
}

function readTrimmed(env: CapabilityBootstrapEnv, key: string): string | null {
  const raw = env[key];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Pure config loader — no I/O, no database, no default. Normalizes a
 * missing/blank/whitespace-only env var to `null` (never `''`), so a
 * downstream `if (!actorId || !orgId)` presence check cannot be fooled by an
 * accidentally-empty-but-set variable.
 */
export function loadCapabilityBootstrapConfig(
  env: CapabilityBootstrapEnv = process.env
): CapabilityBootstrapConfig {
  return {
    actorId: readTrimmed(env, CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID_ENV_VAR),
    orgId: readTrimmed(env, CASE_WORKSPACE_CAPABILITY_BOOT_ORG_ID_ENV_VAR),
  };
}

/**
 * Bootstraps the seven builtin Case Workspace capability adapters under the
 * DEDICATED SYNTHETIC SERVICE PRINCIPAL named by
 * CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID / _ORG_ID, per
 * OD-CW-BOOTSTRAP-20260812. See this file's header for exactly how each
 * clause of that decision is enforced.
 *
 * NEVER THROWS for an expected outcome (missing config, an unauthorized
 * actor, a mismatched org) — same "outcome as return value" convention
 * `capabilityAdapterService.executeCapability` already documents for this
 * codebase. Only re-throws if `registerBuiltinCapabilityAdapters` itself
 * fails AFTER a successful pre-flight check (an unexpected condition, e.g. a
 * TOCTOU revoke between the check and the call, or a genuine bug) — callers
 * (server boot) already wrap this in their own try/catch, matching every
 * other opt-out startup block in server/src/index.ts.
 */
export async function bootstrapCaseWorkspaceCapabilities(
  env: CapabilityBootstrapEnv = process.env
): Promise<CapabilityBootstrapResult> {
  const { actorId, orgId } = loadCapabilityBootstrapConfig(env);

  // OD-CW-BOOTSTRAP-20260812 clause 5: fail closed on missing config, with NO
  // fallback of any kind. registerBuiltinCapabilityAdapters is not called on
  // this branch — zero database mutation, zero in-memory binding.
  if (!actorId || !orgId) {
    logger.warn(
      '[CaseWorkspace capability bootstrap] skipped: missing configuration ' +
        `(${CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID_ENV_VAR}=${actorId ? 'set' : 'unset'}, ` +
        `${CASE_WORKSPACE_CAPABILITY_BOOT_ORG_ID_ENV_VAR}=${orgId ? 'set' : 'unset'}). ` +
        'Set both to a dedicated synthetic service principal (ADMIN of a disposable test ' +
        'organization) to enable the builtin capability adapters.'
    );
    return { status: 'SKIPPED_MISSING_CONFIG', attempted: false };
  }

  // OD-CW-BOOTSTRAP-20260812 clauses 3 and 6: pre-flight ADMIN + ACTIVE
  // membership check in EXACTLY the configured org, before anything else
  // runs. See this file's header for why this is a deliberate, non-redundant
  // addition on top of registerCapability's own internal check.
  let membership: OrgMembership;
  try {
    membership = await requireOrgRole(actorId, orgId, REQUIRED_MIN_ROLE);
  } catch (error) {
    if (error instanceof CaseWorkspaceAuthError) {
      const status: CapabilityBootstrapStatus =
        error.code === 'insufficient_org_role' ? 'REFUSED_INSUFFICIENT_ROLE' : 'REFUSED_NOT_ORG_MEMBER';
      logger.warn(
        `[CaseWorkspace capability bootstrap] refused: ${error.code}. The configured service ` +
          'principal is not an active ADMIN of the configured organization. Zero capabilities registered.'
      );
      return { status, attempted: false };
    }
    logger.warn(
      '[CaseWorkspace capability bootstrap] refused: unexpected error validating the configured ' +
        'service principal. Zero capabilities registered.'
    );
    return { status: 'REFUSED_UNEXPECTED', attempted: false };
  }
  // membership.role is now guaranteed >= ADMIN, in exactly `orgId`, ACTIVE.
  void membership;

  // OD-CW-BOOTSTRAP-20260812 clause 8: the ONLY registration path taken —
  // registerBuiltinCapabilityAdapters exclusively uses the coupled
  // registerCapabilityWithAdapter (bind + RBAC-checked registry row). This
  // file never calls the bind-only registerCapabilityBinding primitive.
  try {
    await registerBuiltinCapabilityAdapters({
      createdByActorId: actorId,
      callerOrganizationId: orgId,
    });
  } catch (error) {
    logger.warn(
      '[CaseWorkspace capability bootstrap] registerBuiltinCapabilityAdapters failed after a ' +
        'successful pre-flight authorization check — registration not completed.'
    );
    return { status: 'FAILED_DURING_REGISTRATION', attempted: true };
  }

  logger.info(
    '[CaseWorkspace capability bootstrap] registered: builtin capability adapters bound for the ' +
      'configured service principal (7 adapters).'
  );
  return { status: 'REGISTERED', attempted: true };
}
