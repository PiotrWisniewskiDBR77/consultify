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

import { NextFunction, Request, RequestHandler, Response } from 'express';

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

const MAX_USER_ID_LENGTH = 512;
const MAX_HTTP_METHOD_LENGTH = 64;
const MAX_REQUEST_PATH_LENGTH = 8192;
const SAFE_METHODS = new Set(['OPTIONS', 'HEAD', 'TRACE']);

type ResponsePayload = Record<string, unknown>;

// ==========================================
// CONSTANTS
// ==========================================

/**
 * List of blocked routes for Trial Entry users
 */
export const BLOCKED_ROUTES: BlockedRoute[] = [
  // Initiative creation/modification
  { method: 'POST', path: /^\/api\/initiatives/ },
  { method: 'PATCH', path: /^\/api\/initiatives/ },
  { method: 'PUT', path: /^\/api\/initiatives/ },
  { method: 'DELETE', path: /^\/api\/initiatives/ },

  // Team invitations
  { method: 'POST', path: /^\/api\/organizations\/.*\/invite/ },
  { method: 'POST', path: /^\/api\/invitations/ },

  // Data upload
  { method: 'POST', path: /^\/api\/upload/ },
  { method: 'POST', path: /^\/api\/ingestion/ },

  // Report generation
  { method: 'POST', path: /^\/api\/reports/ },
  { method: 'GET', path: /^\/api\/reports\/.*\/export/ },

  // Roadmap creation
  { method: 'POST', path: /^\/api\/roadmap/ },

  // Assessment submission (can view demo, not submit real)
  { method: 'POST', path: /^\/api\/assessment\/submit/ },

  // AI memory write (allowed to chat, not persist)
  { method: 'POST', path: /^\/api\/ai\/memory/ },
  { method: 'POST', path: /^\/api\/knowledge/ },
];

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

// No dependencies needed

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const normalizeMethod = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
};

const normalizeUserId = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return value.toString();
  return '';
};

const normalizePathComponent = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withoutQuery = trimmed.split('?')[0];
  if (!withoutQuery) return '';
  let normalized = withoutQuery.replace(/\/{2,}/g, '/');
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  return normalized;
};

const normalizeRequestPath = (req: TrialRequest): string => {
  const candidates = [
    safeRead(() => req.originalUrl, ''),
    safeRead(() => req.url, ''),
    `${safeRead(() => req.baseUrl, '') || ''}${safeRead(() => req.path, '') || ''}`,
    safeRead(() => req.path, ''),
  ];

  for (const candidate of candidates) {
    const normalized = normalizePathComponent(candidate);
    if (normalized) return normalized;
  }
  return '';
};

const getNormalizedRequestPaths = (req: TrialRequest): string[] => {
  const rawCandidates = [
    safeRead(() => req.originalUrl, ''),
    safeRead(() => req.url, ''),
    `${safeRead(() => req.baseUrl, '') || ''}${safeRead(() => req.path, '') || ''}`,
    safeRead(() => req.path, ''),
  ];

  const normalized = rawCandidates
    .map((candidate) => normalizePathComponent(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));

  return Array.from(new Set(normalized));
};

const safeNext = (next: NextFunction, error?: unknown): void => {
  try {
    if (error === undefined) next();
    else next(error);
  } catch (nextError) {
    if (error === undefined) {
      try {
        next(nextError);
      } catch {
        // swallow - middleware must not crash process
      }
    }
  }
};

const safeRespond = (
  res: Response,
  next: NextFunction,
  statusCode: number,
  payload: ResponsePayload
): boolean => {
  if (safeRead(() => Boolean(res.headersSent), false)) return false;
  try {
    res.status(statusCode).json(payload);
    return true;
  } catch (error) {
    safeNext(
      next,
      new Error(`TRIAL_ENTRY_GUARD_RESPONSE_FAILED: ${String((error as Error)?.message || error)}`)
    );
    return false;
  }
};

/**
 * Check if user is in Trial Entry status
 */
export async function isTrialEntryUser(userId: string): Promise<boolean> {
  const userRow = await dbGet<UserRow>(`SELECT user_status FROM users WHERE id = ?`, [userId]);
  const status = safeRead(() => String(userRow?.user_status || ''), '')
    .trim()
    .toUpperCase();
  return status === 'TRIAL_ENTRY';
}

/**
 * Check if route is blocked for Trial Entry users
 */
function isBlockedRoute(method: string, path: string): boolean {
  return BLOCKED_ROUTES.some((route) => route.method === method && route.path.test(path));
}

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Trial Entry Guard Middleware
 *
 * Must be used AFTER auth middleware.
 */
export const trialEntryGuard: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const trialReq = req as TrialRequest;
  try {
    // Skip if no user (auth middleware not applied or failed)
    const userId = normalizeUserId(safeRead(() => trialReq.user?.id, undefined));
    if (!userId || userId.length > MAX_USER_ID_LENGTH) {
      safeNext(next);
      return;
    }

    const method = normalizeMethod(safeRead(() => trialReq.method, ''));
    if (!method) {
      safeRespond(res, next, 400, { error: 'INVALID_HTTP_METHOD' });
      return;
    }
    if (method.length > MAX_HTTP_METHOD_LENGTH) {
      safeRespond(res, next, 400, { error: 'HTTP_METHOD_TOO_LONG' });
      return;
    }
    if (SAFE_METHODS.has(method)) {
      safeNext(next);
      return;
    }

    const normalizedPath = normalizeRequestPath(trialReq);
    const normalizedPaths = getNormalizedRequestPaths(trialReq);
    if (normalizedPath.length > MAX_REQUEST_PATH_LENGTH) {
      safeRespond(res, next, 400, { error: 'REQUEST_URI_TOO_LONG' });
      return;
    }

    // Check if user is in Trial Entry
    const isTrialEntry = await isTrialEntryUser(userId);

    if (!isTrialEntry) {
      safeNext(next);
      return;
    }

    // Check if this route is blocked
    const shouldBlock = normalizedPaths.some((pathCandidate) =>
      isBlockedRoute(method, pathCandidate)
    );
    if (shouldBlock) {
      safeRespond(res, next, 403, {
        error: 'TRIAL_ENTRY_RESTRICTION',
        message: 'Ta funkcja nie jest dostępna w Trial Entry. Załóż organizację, aby kontynuować.',
        messageEn:
          'This feature is not available in Trial Entry. Create an organization to continue.',
        cta: {
          label: 'Załóż organizację',
          path: '/trial/create-org',
        },
      });
      return;
    }

    // Attach flag for downstream use only for allowed routes.
    try {
      trialReq.isTrialEntry = true;
    } catch {
      // non-critical
    }
    safeNext(next);
  } catch (error: unknown) {
    logger.error('[TrialEntryGuard] Error:', error);
    safeNext(next, error);
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
  const isTrialEntry = safeRead(() => req.isTrialEntry === true, false);
  if (isTrialEntry) {
    safeRespond(res, next, 403, {
      error: 'ORG_REQUIRED',
      message: 'Ta funkcja wymaga organizacji. Jesteś w fazie Trial Entry.',
      cta: {
        label: 'Załóż organizację',
        path: '/trial/create-org',
      },
    });
    return;
  }

  const organizationId = normalizeUserId(safeRead(() => req.user?.organizationId, undefined));
  if (!organizationId || organizationId.length > MAX_USER_ID_LENGTH) {
    safeRespond(res, next, 403, {
      error: 'ORG_REQUIRED',
      message: 'Brak kontekstu organizacji.',
    });
    return;
  }

  safeNext(next);
};

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (_newDeps: Partial<Dependencies>): void => {
  // No longer needed - using DbPromise directly
};
