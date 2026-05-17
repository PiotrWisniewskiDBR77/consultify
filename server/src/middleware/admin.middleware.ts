/**
 * Admin Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Admin access control middleware
 */

import type { NextFunction, Request, Response } from 'express';

import { normalizeOrganizationRole } from '../services/organizationService.js';
import { get as dbGet } from '../utils/DbPromise.js';
import type { AuthRequest } from './auth.middleware.js';
import { getRequestAccessRole, isRequestSuperAdmin } from './requestAccess.js';

// ==========================================
// TYPES
// ==========================================

type UserRole = string;

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};
const MAX_MEMBERSHIP_LOOKUP_ID_CHARS = 128;
const LOOKUP_ID_DISALLOWED_CHARS = /[\u0000-\u001F\u007F\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069]/g;
const isWithinLookupIdLimit = (value: string | undefined): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_MEMBERSHIP_LOOKUP_ID_CHARS;
const sanitizeMembershipLookupId = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const sanitized = value.replace(LOOKUP_ID_DISALLOWED_CHARS, '').trim();
  return sanitized || undefined;
};
const safeNext = (next: NextFunction): void => {
  if (typeof next !== 'function') return;
  try {
    next();
  } catch {
    // fail-closed: auth middleware allow path should not throw outward
  }
};
const finishAllowPath = (next: NextFunction, res: Response): void => {
  if (typeof next !== 'function') {
    safeSendAdminAccessRequired(res);
    return;
  }
  // Defensive guard: if another middleware already committed the response, do not continue chain.
  if (safeRead(() => Boolean(res.headersSent), false)) return;
  if (safeRead(() => Boolean((res as Response & { writableEnded?: boolean }).writableEnded), false))
    return;
  safeNext(next);
};

// ==========================================
// HELPERS
// ==========================================

export const isAdminRole = (role: UserRole | undefined): boolean => {
  if (!role) return false;
  const normalized = safeRead(() => String(role).toLowerCase(), '');
  if (!normalized) return false;
  return ['admin', 'administrator', 'superadmin', 'owner'].includes(normalized);
};

const ADMIN_ACCESS_REQUIRED_BODY = { error: 'Admin access required' } as const;

const sendAdminAccessRequired = (res: Response): boolean => {
  try {
    if (!res || typeof res.status !== 'function') return false;
    if (safeRead(() => Boolean(res.headersSent), false)) return false;
    if (safeRead(() => Boolean((res as Response & { writableEnded?: boolean }).writableEnded), false))
      return false;
    try {
      const setHeader = (res as Response & {
        setHeader?: (name: string, value: string) => Response;
      }).setHeader;
      if (typeof setHeader === 'function') {
        const denySecurityHeaders: ReadonlyArray<readonly [string, string]> = [
          ['Cache-Control', 'no-store'],
          ['Pragma', 'no-cache'],
          ['Expires', '0'],
          ['X-Content-Type-Options', 'nosniff'],
          ['X-Frame-Options', 'DENY'],
          ['Referrer-Policy', 'no-referrer'],
          ['Vary', 'Authorization'],
        ];
        for (const [headerName, headerValue] of denySecurityHeaders) {
          safeRead(() => {
            setHeader.call(res, headerName, headerValue);
          }, undefined as void);
        }
      }
    } catch {
      // fail-closed: deny path must remain non-throwing
    }
    const statusResult = res.status(403) as Response;
    if (typeof statusResult?.json === 'function') {
      statusResult.json(ADMIN_ACCESS_REQUIRED_BODY);
      return true;
    }
    if (typeof res.sendStatus === 'function') {
      res.sendStatus(403);
      return true;
    }
    return false;
  } catch {
    try {
      if (res && !safeRead(() => Boolean(res.headersSent), false) && typeof res.sendStatus === 'function') {
        res.sendStatus(403);
        return true;
      }
    } catch {
      // fail-closed: authorization middleware should not throw during deny response
    }
    return false;
  }
};
const safeSendAdminAccessRequired = (res: Response): void => {
  const sent = safeRead(() => sendAdminAccessRequired(res), false);
  if (sent) return;
  try {
    if (!res || safeRead(() => Boolean(res.headersSent), false)) return;
    if (safeRead(() => Boolean((res as Response & { writableEnded?: boolean }).writableEnded), false))
      return;
    if (typeof (res as Response & { end?: () => void }).end === 'function') {
      (res as Response & { end: () => void }).end();
    }
  } catch {
    // fail-closed: authorization middleware should not throw during deny response
  }
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Verify admin access
 */
export const verifyAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const denySafely = (): void => {
    safeRead(() => {
      safeSendAdminAccessRequired(res);
    }, undefined as void);
  };
  try {
    if (req == null) {
      denySafely();
      return;
    }
    const isSuperAdmin = safeRead(() => isRequestSuperAdmin(req), false);
    if (isSuperAdmin) {
      finishAllowPath(next, res);
      return;
    }
    const role = safeRead(() => getRequestAccessRole(req), '');
    const orgIdRaw =
      normalizeOptionalString(safeRead(() => req.user?.organizationId, undefined as unknown)) ||
      normalizeOptionalString(
        safeRead(
          () => (req.user as { organization_id?: string } | undefined)?.organization_id,
          undefined as unknown
        )
      ) ||
      normalizeOptionalString(safeRead(() => req.organizationId, undefined as unknown));
    const userIdRaw =
      normalizeOptionalString(safeRead(() => req.user?.id, undefined as unknown)) ||
      normalizeOptionalString(safeRead(() => req.userId, undefined as unknown));
    const orgId = sanitizeMembershipLookupId(orgIdRaw);
    const userId = sanitizeMembershipLookupId(userIdRaw);
    if (isAdminRole(role)) {
      finishAllowPath(next, res);
      return;
    }

    if (isWithinLookupIdLimit(orgId) && isWithinLookupIdLimit(userId)) {
      try {
        const membership = await dbGet<{ role?: unknown }>(
          `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1`,
          [orgId, userId],
          { fallback: true }
        );
        const membershipRole =
          typeof membership?.role === 'string' ? normalizeOptionalString(membership.role) : undefined;
        const normalizedRole = safeRead(
          () => normalizeOrganizationRole(membershipRole || role),
          normalizeOrganizationRole('')
        );
        if (['OWNER', 'ADMIN'].includes(normalizedRole)) {
          finishAllowPath(next, res);
          return;
        }
      } catch {
        // fail closed
      }
    }

    denySafely();
  } catch {
    denySafely();
  }
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default verifyAdmin;
