/**
 * Authoritative, fail-closed ACTIVE-membership check for the Audits mounts.
 *
 * `validateOrgMembership` caches a positive result for 60 seconds and, on a
 * database error, deliberately fails **open** so one bad query cannot lock the
 * whole product out. Both choices are defensible for the general API and both
 * are wrong for Audits: a membership revoked at t+0 kept working until t+60,
 * which a browser run measured as `200,404,200,200` on the four mounts right
 * after the revoke. Waiting the cache out proves the delay exists; it does not
 * remove it.
 *
 * This middleware is the strict counterpart, mounted **only** on the four
 * Audits routers:
 *
 *  - it reads `organization_members` on every request, consulting no cache, so
 *    a revoke is effective on the very next request;
 *  - every failure path denies: missing identity, missing organization, a
 *    context accessor that throws, a database error, or a row whose status is
 *    anything but ACTIVE;
 *  - a genuine super-admin is still exempt, matching the platform contract the
 *    rest of the API already implements — narrowing that is a separate,
 *    product-wide decision.
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

export const requireActiveAuditsMembership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = String(read(() => req.user?.id) ?? read(() => req.userId) ?? '').trim();
  const organizationId = String(
    read(() => req.organizationId) ?? read(() => req.user?.organizationId) ?? ''
  ).trim();

  // A super-admin has no per-organization membership row by design.
  if (read(() => req.user?.isSuperAdmin) === true) {
    next();
    return;
  }

  // No identity or no tenant means there is nothing to authorise against.
  // The general middleware calls `next()` here; this one refuses.
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
    logger.warn('[AuditsStrictMembership] membership lookup failed — denying', {
      userId,
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    deny(res);
  }
};

export default requireActiveAuditsMembership;
