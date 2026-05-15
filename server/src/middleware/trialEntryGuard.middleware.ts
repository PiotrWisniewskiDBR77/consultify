/**
 * Trial Entry Guard Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Blocks organization-requiring actions for users in TRIAL_ENTRY status.
 * Users in Trial Entry can talk to AI and explore methodology, but cannot:
 * - Create initiatives
 * - Invite team members
 * - Upload data
 * - Generate reports
 * - Access dashboard features
 */

import { NextFunction, Request, Response } from 'express';

import { get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

// Database interface no longer needed - using DbPromise directly

interface UserRow {
  user_status?: string;
}

interface BlockedRoute {
  method: string;
  path: RegExp;
}

interface TrialRequest extends AuthRequest {
  isTrialEntry?: boolean;
}

interface Dependencies {
  // No longer needed - using DbPromise directly
}

// ==========================================
// CONSTANTS
// ==========================================

/**
 * List of blocked routes for Trial Entry users
 */
export const BLOCKED_ROUTES: BlockedRoute[] = [
  // Initiative creation/modification
  { method: 'POST', path: /^\/api\/initiatives/ },
  { method: 'PUT', path: /^\/api\/initiatives/ },
  { method: 'PATCH', path: /^\/api\/initiatives/ },
  { method: 'DELETE', path: /^\/api\/initiatives/ },

  // Team invitations
  // Avoid unbounded wildcard path matching.
  { method: 'POST', path: /^\/api\/organizations(?:\/[^/]+)+\/invite(?:\/|$)/ },
  { method: 'POST', path: /^\/api\/invitations/ },

  // Data upload
  { method: 'POST', path: /^\/api\/upload/ },
  { method: 'POST', path: /^\/api\/ingestion/ },

  // Report generation
  { method: 'POST', path: /^\/api\/reports/ },
  // Avoid unbounded wildcard path matching.
  { method: 'GET', path: /^\/api\/reports(?:\/[^/]+)+\/export(?:\/|$)/ },

  // Roadmap creation
  { method: 'POST', path: /^\/api\/roadmap/ },

  // Assessment submission (can view demo, not submit real)
  { method: 'POST', path: /^\/api\/assessment\/submit/ },

  // AI memory write (allowed to chat, not persist)
  { method: 'POST', path: /^\/api\/ai\/memory/ },
  { method: 'POST', path: /^\/api\/knowledge/ },
];
const MAX_TRIAL_GUARD_PATH_LEN = 8192;
const MAX_TRIAL_GUARD_USER_ID_LEN = 512;
const MAX_TRIAL_GUARD_METHOD_LEN = 64;
const MAX_TRIAL_GUARD_ORG_ID_LEN = 512;

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

// No dependencies needed

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const normalizeUserId = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'bigint') {
    return String(value);
  }
  return undefined;
};

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

/**
 * Check if user is in Trial Entry status
 */
export async function isTrialEntryUser(userId: string): Promise<boolean> {
  const userRow = await dbGet<UserRow>(`SELECT user_status FROM users WHERE id = ?`, [userId]);
  const normalizedStatus = normalizeOptionalString(userRow?.user_status)?.toUpperCase();
  return normalizedStatus === 'TRIAL_ENTRY';
}

/**
 * Check if route is blocked for Trial Entry users
 */
function isBlockedRoute(method: string, path: string): boolean {
  return BLOCKED_ROUTES.some((route) => route.method === method && route.path.test(path));
}

const readRequestPathForRouting = (req: Request): string => {
  const baseUrl = normalizeOptionalString(safeRead(() => req.baseUrl, undefined as unknown)) || '';
  const path = normalizeOptionalString(safeRead(() => req.path, undefined as unknown)) || '';
  return `${baseUrl}${path}`;
};

const normalizePathForRouteMatch = (path: string): string => path.replace(/\/+/g, '/');
const normalizeMethodForRouteMatch = (value: unknown): string | undefined =>
  normalizeOptionalString(value)?.toUpperCase();
const isRequestMethodLengthSafe = (value: unknown): boolean =>
  typeof value !== 'string' || value.length <= MAX_TRIAL_GUARD_METHOD_LEN;
const isSkippableTrialGuardMethod = (method: string | undefined): boolean =>
  method === 'OPTIONS' || method === 'HEAD' || method === 'TRACE';
const stripRouteQueryAndFragment = (path: string): string => path.split('?')[0]?.split('#')[0] || '';
const readOriginalUrlPathForRouting = (req: Request): string =>
  normalizeOptionalString(safeRead(() => req.originalUrl, undefined as unknown)) || '';
const readUrlPathForRouting = (req: Request): string =>
  normalizeOptionalString(safeRead(() => req.url, undefined as unknown)) || '';
const getCandidateTrialRoutePaths = (req: Request): string[] => {
  const mountedPath = stripRouteQueryAndFragment(
    normalizePathForRouteMatch(readRequestPathForRouting(req))
  );
  const originalUrlPath = stripRouteQueryAndFragment(
    normalizePathForRouteMatch(readOriginalUrlPathForRouting(req))
  );
  const urlPath = stripRouteQueryAndFragment(
    normalizePathForRouteMatch(readUrlPathForRouting(req))
  );
  const uniquePaths = new Set<string>();
  if (mountedPath) uniquePaths.add(mountedPath);
  if (originalUrlPath) uniquePaths.add(originalUrlPath);
  if (urlPath) uniquePaths.add(urlPath);
  return [...uniquePaths];
};
const sendTrialGuardJson = (
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>
): boolean => {
  if (safeRead(() => res.headersSent, false)) {
    return false;
  }
  try {
    res.status(statusCode).json(payload);
    return true;
  } catch {
    return false;
  }
};
const emitTrialGuardWriteFailure = (next: NextFunction, contextCode: string): void => {
  const error = new Error(contextCode);
  safeRead(() => {
    (error as { code?: string }).code = contextCode;
    return undefined as void;
  }, undefined as void);
  next(error);
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Trial Entry Guard Middleware
 *
 * Must be used AFTER auth middleware.
 */
export const trialEntryGuard = async (
  req: TrialRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip if no user (auth middleware not applied or failed)
    const userId = normalizeUserId(safeRead(() => req.user?.id, undefined as unknown));
    if (!userId) {
      next();
      return;
    }
    if (userId.length > MAX_TRIAL_GUARD_USER_ID_LEN) {
      logger.warn('[TrialEntryGuard] user id exceeded max supported length; skipping lookup', {
        userIdLength: userId.length,
      });
      next();
      return;
    }

    const requestMethod = normalizeMethodForRouteMatch(safeRead(() => req.method, undefined as unknown));
    if (isSkippableTrialGuardMethod(requestMethod)) {
      next();
      return;
    }
    if (!isRequestMethodLengthSafe(safeRead(() => req.method, undefined as unknown))) {
      const sent = sendTrialGuardJson(res, 400, {
        error: 'HTTP_METHOD_TOO_LONG',
        message: 'Metoda HTTP jest zbyt długa.',
        messageEn: 'The HTTP method is too long.',
      });
      if (!sent && !safeRead(() => res.headersSent, false)) {
        emitTrialGuardWriteFailure(next, 'TRIAL_ENTRY_GUARD_RESPONSE_FAILED');
      }
      return;
    }
    if (!requestMethod) {
      const sent = sendTrialGuardJson(res, 400, {
        error: 'INVALID_HTTP_METHOD',
        message: 'Nieprawidłowa metoda HTTP.',
        messageEn: 'The HTTP method is invalid.',
      });
      if (!sent && !safeRead(() => res.headersSent, false)) {
        emitTrialGuardWriteFailure(next, 'TRIAL_ENTRY_GUARD_RESPONSE_FAILED');
      }
      return;
    }
    const requestPathCandidates = getCandidateTrialRoutePaths(req);
    if (requestPathCandidates.some((candidatePath) => candidatePath.length > MAX_TRIAL_GUARD_PATH_LEN)) {
      const sent = sendTrialGuardJson(res, 400, {
        error: 'REQUEST_URI_TOO_LONG',
        message: 'Żądanie jest zbyt długie.',
        messageEn: 'The request URI is too long.',
      });
      if (!sent && !safeRead(() => res.headersSent, false)) {
        emitTrialGuardWriteFailure(next, 'TRIAL_ENTRY_GUARD_RESPONSE_FAILED');
      }
      return;
    }

    // Check if user is in Trial Entry
    const isTrialEntry = await isTrialEntryUser(userId);

    if (!isTrialEntry) {
      next();
      return;
    }

    if (requestPathCandidates.some((candidatePath) => isBlockedRoute(requestMethod, candidatePath))) {
      const sent = sendTrialGuardJson(res, 403, {
        error: 'TRIAL_ENTRY_RESTRICTION',
        message: 'Ta funkcja nie jest dostępna w Trial Entry. Załóż organizację, aby kontynuować.',
        messageEn:
          'This feature is not available in Trial Entry. Create an organization to continue.',
        cta: {
          label: 'Załóż organizację',
          path: '/trial/create-org',
        },
      });
      if (!sent && !safeRead(() => res.headersSent, false)) {
        emitTrialGuardWriteFailure(next, 'TRIAL_ENTRY_GUARD_RESPONSE_FAILED');
      }
      return;
    }

    // Attach flag only when trial user is allowed to continue.
    req.isTrialEntry = true;
    next();
  } catch (error: unknown) {
    logger.error('[TrialEntryGuard] Error:', error);
    next(error);
  }
};

/**
 * Middleware to require organization context
 * Use on routes that absolutely need an organization
 */
export const requireOrgContext = async (
  req: TrialRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (safeRead(() => Boolean(req.isTrialEntry), false)) {
      const sent = sendTrialGuardJson(res, 403, {
        error: 'ORG_REQUIRED',
        message: 'Ta funkcja wymaga organizacji. Jesteś w fazie Trial Entry.',
        cta: {
          label: 'Załóż organizację',
          path: '/trial/create-org',
        },
      });
      if (!sent && !safeRead(() => res.headersSent, false)) {
        emitTrialGuardWriteFailure(next, 'TRIAL_ENTRY_GUARD_RESPONSE_FAILED');
      }
      return;
    }

    const organizationId = normalizeOptionalString(
      safeRead(() => req.user?.organizationId, undefined as unknown)
    );
    if (!organizationId) {
      const sent = sendTrialGuardJson(res, 403, {
        error: 'ORG_REQUIRED',
        message: 'Brak kontekstu organizacji.',
      });
      if (!sent && !safeRead(() => res.headersSent, false)) {
        emitTrialGuardWriteFailure(next, 'TRIAL_ENTRY_GUARD_RESPONSE_FAILED');
      }
      return;
    }
    if (organizationId.length > MAX_TRIAL_GUARD_ORG_ID_LEN) {
      const sent = sendTrialGuardJson(res, 403, {
        error: 'ORG_REQUIRED',
        message: 'Brak kontekstu organizacji.',
      });
      if (!sent && !safeRead(() => res.headersSent, false)) {
        emitTrialGuardWriteFailure(next, 'TRIAL_ENTRY_GUARD_RESPONSE_FAILED');
      }
      return;
    }

    next();
  } catch (error: unknown) {
    logger.error('[TrialEntryGuard] requireOrgContext error:', error);
    next(error);
  }
};

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (_newDeps: Partial<Dependencies>): void => {
  // No longer needed - using DbPromise directly
};
