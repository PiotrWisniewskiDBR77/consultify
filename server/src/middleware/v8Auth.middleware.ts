import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';

export interface V8RequestContext {
  organizationId: string;
  userId: string;
  userRole: string;
  isSuperAdmin: boolean;
}

const MAX_ID_LENGTH = 256;
const MAX_ROLE_LENGTH = 128;
const UNICODE_LINE_SEPARATORS = new Set([133, 8232, 8233]);

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    const value = reader();
    return value === undefined || value === null ? fallback : value;
  } catch {
    return fallback;
  }
};

const isCallable = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === 'function';

const isConnectionClosed = (req: AuthRequest, res: Response): boolean =>
  Boolean(
    // NOTE: req.destroyed is intentionally excluded — the JSON body-parser marks
    // the IncomingMessage stream as destroyed after consuming the body for POST/PATCH
    // requests. The underlying socket is still open; checking req.destroyed here
    // would cause all mutations to short-circuit without calling next() (and
    // without sending a response) → every v8 POST/PATCH/DELETE hangs until the
    // Cloudflare 524 timeout. Regression history: re-added in 46a1674000 to make a
    // unit test pass, which silently broke every v8 mutation on demo. DO NOT re-add.
    // Use socket.destroyed (actual network state) and response state instead.
    safeRead(() => (req as any).socket?.destroyed, false) ||
    safeRead(() => (res as any).writableEnded, false) ||
    safeRead(() => (res as any).headersSent, false)
  );

const hasForbiddenControlChars = (value: string): boolean => {
  for (const char of value) {
    const code = char.codePointAt(0);
    if (typeof code !== 'number') continue;
    if ((code >= 0 && code <= 31) || code === 127 || UNICODE_LINE_SEPARATORS.has(code)) {
      return true;
    }
  }
  return false;
};

const stripForbiddenControlChars = (value: string): string => {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0);
    if (typeof code !== 'number') continue;
    if ((code >= 0 && code <= 31) || code === 127 || UNICODE_LINE_SEPARATORS.has(code)) {
      continue;
    }
    out += char;
  }
  return out;
};

const sanitizeId = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  if (hasForbiddenControlChars(value)) return '';
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_ID_LENGTH) return '';
  return normalized;
};

const sanitizeRole = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return stripForbiddenControlChars(value).trim().slice(0, MAX_ROLE_LENGTH);
};

const writeDenyHeaders = (res: Response): void => {
  const setHeader = safeRead(() => (res as any).setHeader, undefined);
  if (!isCallable(setHeader)) return;
  setHeader.call(res, 'Cache-Control', 'no-store');
  setHeader.call(res, 'Pragma', 'no-cache');
  setHeader.call(res, 'Expires', '0');
  setHeader.call(res, 'X-Content-Type-Options', 'nosniff');
  setHeader.call(res, 'Content-Type', 'application/json; charset=utf-8');
};

const deny = (res: Response, code: string): void => {
  if (
    safeRead(() => (res as any).headersSent, false) ||
    safeRead(() => (res as any).writableEnded, false)
  ) {
    return;
  }
  writeDenyHeaders(res);
  const statusFn = safeRead(() => (res as any).status, undefined);
  const jsonFn = safeRead(() => (res as any).json, undefined);
  if (isCallable(statusFn) && isCallable(jsonFn)) {
    statusFn.call(res, 403);
    jsonFn.call(res, {
      error:
        code === 'V8_MISSING_USER_CONTEXT'
          ? 'V8 operations require user context'
          : code === 'V8_CONTEXT_ATTACH_FAILED'
            ? 'Unable to attach V8 context'
            : 'V8 operations require organization context',
      code,
    });
  }
};

const safeNext = (next: NextFunction): void => {
  if (isCallable(next)) next();
};

const resolveOrganizationId = (req: AuthRequest): string =>
  sanitizeId(
    safeRead(() => req.organizationId, '') ||
      safeRead(() => (req as any).organizationId, '') ||
      safeRead(() => (req as any).user?.organizationId, '') ||
      safeRead(() => (req as any).user?.organization_id, '')
  );

const resolveUserId = (req: AuthRequest): string =>
  sanitizeId(
    safeRead(() => req.userId, '') ||
      safeRead(() => (req as any).userId, '') ||
      safeRead(() => (req as any).user?.id, '')
  );

/**
 * Ensures the request has a valid organizationId for V8 operations.
 * V8 services require org-scoped access — this middleware rejects
 * requests without org context early.
 */
export const requireV8OrgContext = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (isConnectionClosed(req, res)) {
    return;
  }
  if (!resolveOrganizationId(req)) {
    deny(res, 'V8_MISSING_ORG_CONTEXT');
    return;
  }
  safeNext(next);
};

/**
 * Extracts and validates the V8 request context, attaching it to the request
 * for use by downstream route handlers.
 */
export const attachV8Context = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (isConnectionClosed(req, res)) {
    return;
  }

  const organizationId = resolveOrganizationId(req);
  if (!organizationId) {
    deny(res, 'V8_MISSING_ORG_CONTEXT');
    return;
  }

  const userId = resolveUserId(req);
  if (!userId) {
    deny(res, 'V8_MISSING_USER_CONTEXT');
    return;
  }

  const context: V8RequestContext = Object.freeze({
    organizationId,
    userId,
    userRole: sanitizeRole(
      safeRead(() => req.userRole, '') || safeRead(() => (req as any).userRole, '')
    ),
    isSuperAdmin: Boolean(safeRead(() => (req as any).user?.isSuperAdmin, false)),
  });

  try {
    (req as any).v8Context = context;
  } catch {
    deny(res, 'V8_CONTEXT_ATTACH_FAILED');
    return;
  }

  safeNext(next);
};

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Helper to extract V8 context from a request.
 * Throws if context is not attached (middleware not applied).
 */
export function getV8Context(req: AuthRequest): V8RequestContext {
  let ctx: unknown;
  try {
    if (!hasOwn(req as object, 'v8Context')) {
      throw new Error('missing');
    }
    ctx = (req as any).v8Context;
  } catch {
    throw new Error('V8 context not attached. Ensure attachV8Context middleware is applied.');
  }
  if (!ctx || typeof ctx !== 'object') {
    throw new Error('V8 context not attached. Ensure attachV8Context middleware is applied.');
  }
  const candidate = ctx as Partial<V8RequestContext>;
  if (!sanitizeId(candidate.organizationId) || !sanitizeId(candidate.userId)) {
    throw new Error('V8 context not attached. Ensure attachV8Context middleware is applied.');
  }
  return {
    organizationId: sanitizeId(candidate.organizationId),
    userId: sanitizeId(candidate.userId),
    userRole: sanitizeRole(candidate.userRole),
    isSuperAdmin: Boolean(candidate.isSuperAdmin),
  };
}

export default { requireV8OrgContext, attachV8Context, getV8Context };
