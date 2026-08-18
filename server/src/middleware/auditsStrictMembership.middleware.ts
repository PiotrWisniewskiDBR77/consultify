/**
 * Fail-closed ACTIVE-membership checks for security-sensitive mounts.
 *
 * The general `validateOrgMembership` caches a positive result for 60 seconds
 * and, on a database error, deliberately fails **open** so one bad query cannot
 * lock the whole product out. Both choices are defensible for the general API
 * and both are wrong here: a membership revoked at t+0 kept working until t+60,
 * which a browser run measured as `200,404,200,200` on the four Audits mounts
 * right after the revoke. Waiting the cache out proves the delay exists; it does
 * not remove it.
 *
 * This module exports TWO deliberately different guards. They were a single
 * shared function until the tenant-authoritative decision below; that made the
 * platform super-admin exemption implicitly shared by every consumer, which is
 * exactly the kind of coupling that turns one domain's policy change into a
 * silent change somewhere else.
 *
 *  - `requireActiveTenantMembership` — the ORIGINAL contract, unchanged.
 *    Consumed by `routes/tools.routes.ts`. Keeps the platform super-admin
 *    exemption that the rest of the API implements. Not modified in this
 *    change: narrowing it for Tools is a separate decision behind its own DoD.
 *
 *  - `requireActiveAuditsMembership` — TENANT-AUTHORITATIVE. Consumed by the
 *    four Audits mounts in Gateway.ts. Grants NO platform-level exemption: a
 *    super-admin is authorised exactly like anybody else, by a current ACTIVE
 *    row in `organization_members` for the target tenant. A super-admin without
 *    membership is denied 403, and the table is genuinely read for them (the
 *    check is not short-circuited). Audit evidence, findings and corrective
 *    actions are tenant property; platform role is not a substitute for
 *    membership in the tenant that owns them.
 *
 * Both guards share the rest of the contract: no cache (the table is read on
 * every request, so a revoke is effective on the very next one), and every
 * failure path denies — missing identity, missing organization, a context
 * accessor that throws, a database error, or a row whose status is anything but
 * ACTIVE.
 *
 * Nothing else in the application changes behaviour: every other route keeps
 * the cached, fail-open middleware it had.
 */

import type { NextFunction, Response } from 'express';

import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

import type { AuthRequest } from './auth.middleware.js';

function deny(res: Response) {
  return res.status(403).json({
    error: 'You no longer have access to this organization',
    code: 'ORG_MEMBERSHIP_REVOKED',
  });
}

function read<T>(get: () => T): T | undefined {
  try {
    return get();
  } catch {
    return undefined;
  }
}

interface MembershipGuardOptions {
  /**
   * When true, a genuine platform super-admin passes without a membership row
   * (the historic platform contract). When false, no platform role exempts
   * anyone: authorisation comes only from a current ACTIVE membership in the
   * target tenant.
   */
  allowPlatformSuperAdminBypass: boolean;
  /** Prefix for the deny log line, so the two guards are distinguishable in ops output. */
  logLabel: string;
  /** Distinguish an unreadable membership store from an ordinary revoked/missing row. */
  lookupFailureUnavailable?: boolean;
}

function createActiveMembershipGuard({
  allowPlatformSuperAdminBypass,
  logLabel,
  lookupFailureUnavailable = false,
}: MembershipGuardOptions) {
  return async function activeMembershipGuard(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const userId = String(read(() => req.user?.id) ?? read(() => req.userId) ?? '').trim();
    const organizationId = String(
      read(() => req.organizationId) ?? read(() => req.user?.organizationId) ?? ''
    ).trim();

    // Platform super-admins have no per-organization membership row by design —
    // but only the tenant-permissive guard honours that. The tenant-
    // authoritative guard falls through to the same lookup as everyone else.
    if (allowPlatformSuperAdminBypass && read(() => req.user?.isSuperAdmin) === true) {
      next();
      return;
    }

    // No identity or no tenant means there is nothing to authorise against.
    // The general middleware calls `next()` here; these ones refuse.
    if (!userId || !organizationId) {
      deny(res);
      return;
    }

    try {
      const membership = await DbPromise.get<{ status: string }>(
        `SELECT status FROM organization_members WHERE user_id = ? AND organization_id = ?`,
        [userId, organizationId],
        { fallback: false }
      );

      const active = String(membership?.status ?? '').toUpperCase() === 'ACTIVE';
      if (!active) {
        deny(res);
        return;
      }
      next();
    } catch (error) {
      // Fail CLOSED. An unreadable membership table must not become an open door
      // to audit evidence, findings and corrective actions.
      logger.warn(`${logLabel} membership lookup failed — denying`, {
        userId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (lookupFailureUnavailable) {
        res.status(503).json({
          error: 'Organization membership could not be verified',
          code: 'ORG_MEMBERSHIP_UNAVAILABLE',
        });
      } else {
        deny(res);
      }
    }
  };
}

/**
 * Tenant membership guard retaining the platform super-admin exemption.
 * Consumed by `routes/tools.routes.ts`. Unchanged in this transition — Tools
 * narrows this under its own DoD, not as a side effect of the Audits decision.
 */
export const requireActiveTenantMembership = createActiveMembershipGuard({
  allowPlatformSuperAdminBypass: true,
  logLabel: '[TenantStrictMembership]',
});

/**
 * MFA-specific tenant guard. Ordinary missing/revoked membership remains 403,
 * while a database lookup failure is distinguishable as a retryable 503. The
 * platform SUPERADMIN exemption is retained; MFA handlers bind all state to
 * req.user.id and never accept a target user from the request body.
 */
export const requireActiveTenantMembershipOrUnavailable = createActiveMembershipGuard({
  allowPlatformSuperAdminBypass: true,
  logLabel: '[MfaStrictMembership]',
  lookupFailureUnavailable: true,
});

/**
 * Tenant-authoritative membership guard for the Audits mounts: no platform
 * exemption of any kind. Every persona, super-admin included, needs a current
 * ACTIVE membership in the target tenant.
 */
export const requireActiveAuditsMembership = createActiveMembershipGuard({
  allowPlatformSuperAdminBypass: false,
  logLabel: '[AuditsStrictMembership]',
});

export default requireActiveAuditsMembership;
