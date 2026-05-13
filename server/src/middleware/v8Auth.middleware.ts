import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';

export interface V8RequestContext {
  organizationId: string;
  userId: string;
  userRole: string;
  isSuperAdmin: boolean;
}
const MAX_V8_ORG_USER_ID_CHARS = 256;
const MAX_V8_USER_ROLE_CHARS = 128;
const DISALLOWED_V8_ID_CONTROL_CHARS = /[\u0000-\u001F\u007F\u0085\u2028\u2029]/;
const DISALLOWED_V8_ROLE_CONTROL_CHARS_GLOBAL = /[\u0000-\u001F\u007F]/g;

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
const normalizeBoundedId = (value: unknown): string | undefined => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;
  if (normalized.length > MAX_V8_ORG_USER_ID_CHARS) return undefined;
  if (DISALLOWED_V8_ID_CONTROL_CHARS.test(normalized)) return undefined;
  return normalized;
};

const normalizeBoundedRole = (value: unknown): string => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return '';
  const cleaned = normalized.replace(DISALLOWED_V8_ROLE_CONTROL_CHARS_GLOBAL, '');
  if (!cleaned) return '';
  return cleaned.length > MAX_V8_USER_ROLE_CHARS
    ? cleaned.slice(0, MAX_V8_USER_ROLE_CHARS)
    : cleaned;
};

const safeSetHeader = (res: Response, name: string, value: string): void => {
  try {
    res.setHeader(name, value);
  } catch {
    // best-effort on deny path metadata
  }
};
const applyV8NoStoreHeaders = (res: Response): void => {
  safeSetHeader(res, 'Cache-Control', 'no-store');
  safeSetHeader(res, 'Pragma', 'no-cache');
  safeSetHeader(res, 'Expires', '0');
  safeSetHeader(res, 'X-Content-Type-Options', 'nosniff');
  safeSetHeader(res, 'Content-Type', 'application/json; charset=utf-8');
};

const responseWriteBlocked = (res: Response): boolean =>
  safeRead(() => res.headersSent, false) ||
  safeRead(() => (res as Response & { writableEnded?: boolean }).writableEnded, false) ||
  safeRead(() => (res as Response & { destroyed?: boolean }).destroyed, false);

const safeNext = (res: Response, next: NextFunction): void => {
  if (!responseWriteBlocked(res)) {
    next();
  }
};

const sendV8Forbidden = (
  res: Response,
  body: { error: string; code: string }
): void => {
  try {
    if (responseWriteBlocked(res)) return;
    applyV8NoStoreHeaders(res);
    res.status(403).json(body);
  } catch {
    try {
      if (!res.headersSent && typeof (res as Response & { sendStatus?: (code: number) => Response }).sendStatus === 'function') {
        (res as Response & { sendStatus: (code: number) => Response }).sendStatus(403);
      }
    } catch {
      // fail-closed: auth middleware deny path should never throw
    }
  }
};

const resolveOrganizationId = (req: AuthRequest): string | undefined =>
  normalizeBoundedId(safeRead(() => req.organizationId, undefined as unknown)) ||
  normalizeBoundedId(safeRead(() => req.user?.organizationId, undefined as unknown)) ||
  normalizeBoundedId(
    safeRead(
      () => (req.user as { organization_id?: string } | undefined)?.organization_id,
      undefined as unknown
    )
  );

const resolveUserId = (req: AuthRequest): string | undefined =>
  normalizeBoundedId(safeRead(() => req.userId, undefined as unknown)) ||
  normalizeBoundedId(safeRead(() => req.user?.id, undefined as unknown));

/**
 * Ensures the request has a valid organizationId for V8 operations.
 * V8 services require org-scoped access — this middleware rejects
 * requests without org context early.
 */
export const requireV8OrgContext = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const organizationId = resolveOrganizationId(req);
  if (!organizationId) {
    if (responseWriteBlocked(res)) return;
    sendV8Forbidden(res, {
      error: 'V8 operations require organization context',
      code: 'V8_MISSING_ORG_CONTEXT',
    });
    return;
  }
  safeNext(res, next);
};

/**
 * Extracts and validates the V8 request context, attaching it to the request
 * for use by downstream route handlers.
 */
export const attachV8Context = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const organizationId = resolveOrganizationId(req);
  const userId = resolveUserId(req);
  const userRole = normalizeBoundedRole(safeRead(() => req.userRole, undefined as unknown));
  const isSuperAdmin = safeRead(() => req.user?.isSuperAdmin === true, false);

  if (!organizationId) {
    if (responseWriteBlocked(res)) return;
    sendV8Forbidden(res, {
      error: 'V8 operations require organization context',
      code: 'V8_MISSING_ORG_CONTEXT',
    });
    return;
  }
  if (!userId) {
    if (responseWriteBlocked(res)) return;
    sendV8Forbidden(res, {
      error: 'V8 operations require user context',
      code: 'V8_MISSING_USER_CONTEXT',
    });
    return;
  }

  const v8Context: V8RequestContext = {
    organizationId,
    userId,
    userRole,
    isSuperAdmin,
  };
  const attached = safeRead(() => {
    Object.freeze(v8Context);
    (req as any).v8Context = v8Context;
    return true;
  }, false);
  if (!attached) {
    if (responseWriteBlocked(res)) return;
    sendV8Forbidden(res, {
      error: 'V8 context could not be attached to the request',
      code: 'V8_CONTEXT_ATTACH_FAILED',
    });
    return;
  }
  safeNext(res, next);
};

/**
 * Helper to extract V8 context from a request.
 * Throws if context is not attached (middleware not applied).
 */
export function getV8Context(req: AuthRequest): V8RequestContext {
  const ctx = safeRead(
    () => (req as any).v8Context as Partial<V8RequestContext> | undefined,
    undefined
  );
  const organizationId = normalizeBoundedId(safeRead(() => ctx?.organizationId, undefined));
  const userId = normalizeBoundedId(safeRead(() => ctx?.userId, undefined));
  if (!ctx || !organizationId || !userId) {
    throw new Error('V8 context not attached. Ensure attachV8Context middleware is applied.');
  }
  return {
    organizationId,
    userId,
    userRole: normalizeBoundedRole(safeRead(() => ctx.userRole, undefined)),
    isSuperAdmin: safeRead(() => ctx.isSuperAdmin === true, false),
  };
}

export default { requireV8OrgContext, attachV8Context, getV8Context };
