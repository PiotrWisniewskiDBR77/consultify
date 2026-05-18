/**
 * Framework Entitlement Middleware
 * Enforces framework-level access on API routes.
 */
import { NextFunction, Request, Response } from 'express';

import FrameworkEntitlementService from '../services/frameworkEntitlementService.js';
import logger from '../utils/Logger.js';

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string; role?: string };
  frameworkAccess?: { allowed: boolean; accessLevel: string; requiresLegalNotice: boolean };
}

type EntitlementResult = {
  allowed: boolean;
  accessLevel?: string;
  requiresLegalNotice?: boolean;
  reason?: string;
  upgradeCTA?: string;
};

const CHECK_TIMEOUT_MS = 8000;
const MAX_ORG_ID_LENGTH = 128;
const MAX_FRAMEWORK_ID_LENGTH = 64;
const MAX_PAYLOAD_FIELD_LENGTH = 512;

function isCommitted(res: Response): boolean {
  return Boolean((res as any).headersSent || (res as any).writableEnded);
}

function safeNext(next: NextFunction, error?: unknown): void {
  if (typeof next !== 'function') return;
  try {
    if (error !== undefined) next(error as any);
    else next();
  } catch {
    // swallow to keep middleware safe
  }
}

function safeString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLen) return null;
  return normalized;
}

function boundedString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

function normalizeFrameworkId(value: unknown): string | null {
  const normalized = safeString(value, MAX_FRAMEWORK_ID_LENGTH);
  if (!normalized) return null;
  if (!/^[a-z0-9_-]+$/i.test(normalized)) return null;
  try {
    return normalized.toLocaleUpperCase('en-US');
  } catch {
    return null;
  }
}

function normalizeAccessLevel(value: unknown): string {
  return value === 'full' || value === 'limited' || value === 'locked' ? value : 'locked';
}

function sanitizeResultPayload(raw: EntitlementResult): EntitlementResult {
  return {
    allowed: raw.allowed,
    accessLevel: normalizeAccessLevel(raw.accessLevel),
    requiresLegalNotice: raw.requiresLegalNotice === true,
    reason: boundedString(raw.reason, MAX_PAYLOAD_FIELD_LENGTH) ?? 'Access denied',
    upgradeCTA: boundedString(raw.upgradeCTA, MAX_PAYLOAD_FIELD_LENGTH) ?? '',
  };
}

function resolveOrgId(req: AuthRequest): string | null {
  let reqOrg: unknown;
  try {
    reqOrg = (req as any).organizationId;
  } catch {
    reqOrg = undefined;
  }
  let user: any;
  try {
    user = (req as any).user;
  } catch {
    user = undefined;
  }
  let userOrg: unknown;
  try {
    userOrg = user?.organizationId;
  } catch {
    userOrg = undefined;
  }
  if (!userOrg) {
    try {
      userOrg = user?.organization_id;
    } catch {
      userOrg = undefined;
    }
  }
  const orgId = safeString(reqOrg ?? userOrg, MAX_ORG_ID_LENGTH);
  return orgId;
}

function writeJsonSafely(
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>
): Error | null {
  if (isCommitted(res)) return null;
  try {
    const statusWriter = (res as any).status;
    if (typeof statusWriter !== 'function') {
      return new Error('Response status writer is not callable');
    }
    const target = statusWriter.call(res, statusCode);
    const jsonWriter = target?.json;
    if (typeof jsonWriter !== 'function') {
      return null;
    }
    jsonWriter.call(target, payload);
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = CHECK_TIMEOUT_MS): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('FRAMEWORK_ACCESS_TIMEOUT')), timeoutMs);
    }),
  ]);
}

async function runCheckAccess(orgId: string, framework: string): Promise<EntitlementResult | null> {
  const result = await withTimeout(
    FrameworkEntitlementService.checkAccess(orgId, framework),
    CHECK_TIMEOUT_MS
  );
  if (!result || typeof result !== 'object' || typeof (result as any).allowed !== 'boolean') {
    return null;
  }
  return sanitizeResultPayload(result as EntitlementResult);
}

function writeServiceUnavailable(res: Response, framework: string): Error | null {
  return writeJsonSafely(res, 503, {
    error: 'FRAMEWORK_ACCESS_CHECK_UNAVAILABLE',
    framework,
  });
}

function resolveDynamicFrameworkId(req: AuthRequest, paramName: string): unknown {
  let fromParams: unknown;
  try {
    fromParams = req.params?.[paramName];
  } catch {
    fromParams = undefined;
  }
  if (fromParams !== undefined) return fromParams;
  const body = req.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    if (Object.prototype.hasOwnProperty.call(body, paramName)) return (body as any)[paramName];
    if (Object.prototype.hasOwnProperty.call(body, 'frameworkId')) return (body as any).frameworkId;
  }
  return undefined;
}

export function requireFrameworkAccess(frameworkId: string) {
  const normalizedFramework = normalizeFrameworkId(frameworkId);
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!normalizedFramework) {
      const writeErr = writeJsonSafely(res, 500, { error: 'FRAMEWORK_GATE_MISCONFIGURED' });
      if (writeErr) safeNext(next, writeErr);
      return;
    }
    const orgId = resolveOrgId(req);
    if (!orgId) {
      const writeErr = writeJsonSafely(res, 401, { error: 'UNAUTHORIZED' });
      if (writeErr) safeNext(next, writeErr);
      return;
    }
    if ((req as any).aborted || (req as any).socket?.destroyed) {
      writeServiceUnavailable(res, normalizedFramework);
      return;
    }

    try {
      const result = await runCheckAccess(orgId, normalizedFramework);
      if (!result) {
        writeServiceUnavailable(res, normalizedFramework);
        return;
      }

      if (isCommitted(res)) {
        safeNext(next, new Error('Response already committed before framework access attach'));
        return;
      }

      if (!result.allowed) {
        try {
          logger.info(
            `[FrameworkGate] Blocked org=${orgId} from ${normalizedFramework}: ${result.reason || 'denied'}`
          );
        } catch {
          // ignore logger failures
        }
        const writeErr = writeJsonSafely(res, 403, {
          error: 'FRAMEWORK_ACCESS_DENIED',
          framework: normalizedFramework,
          accessLevel: result.accessLevel,
          reason: result.reason,
          upgradeCTA: result.upgradeCTA,
        });
        if (writeErr) safeNext(next, writeErr);
        return;
      }

      req.frameworkAccess = {
        allowed: true,
        accessLevel: result.accessLevel || 'locked',
        requiresLegalNotice: result.requiresLegalNotice === true,
      };
      safeNext(next);
    } catch (error) {
      if ((error as Error)?.message === 'FRAMEWORK_ACCESS_TIMEOUT') {
        logger.warn('[FrameworkGate] checkAccess timed out', {
          framework: normalizedFramework,
          timeoutMs: CHECK_TIMEOUT_MS,
          orgId,
        });
      }
      const writeErr = writeServiceUnavailable(res, normalizedFramework);
      if (writeErr) safeNext(next, error);
    }
  };
}

export function requireDynamicFrameworkAccess(paramName = 'frameworkId') {
  const validParamName = /^[A-Za-z0-9_]{1,64}$/.test(paramName);
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!validParamName) {
      const writeErr = writeJsonSafely(res, 500, { error: 'FRAMEWORK_GATE_MISCONFIGURED' });
      if (writeErr) safeNext(next, writeErr);
      return;
    }
    const orgId = resolveOrgId(req);
    const fwIdRaw = resolveDynamicFrameworkId(req, paramName);
    const hasFrameworkCandidate = typeof fwIdRaw === 'string' && String(fwIdRaw).trim().length > 0;
    const fwId = normalizeFrameworkId(fwIdRaw);
    if (!orgId) {
      const writeErr = writeJsonSafely(res, 401, { error: 'UNAUTHORIZED' });
      if (writeErr) safeNext(next, writeErr);
      return;
    }
    if (!fwId) {
      const writeErr = writeJsonSafely(res, 400, {
        error: 'BAD_REQUEST',
        message: hasFrameworkCandidate ? 'Invalid framework ID' : 'Framework ID required',
      });
      if (writeErr) safeNext(next, writeErr);
      return;
    }
    if ((req as any).aborted || (req as any).socket?.destroyed) {
      writeServiceUnavailable(res, fwId);
      return;
    }

    try {
      const result = await runCheckAccess(orgId, fwId);
      if (!result) {
        writeServiceUnavailable(res, fwId);
        return;
      }

      if (isCommitted(res)) {
        safeNext(next, new Error('Response already committed before framework access attach'));
        return;
      }

      if (!result.allowed) {
        const writeErr = writeJsonSafely(res, 403, {
          error: 'FRAMEWORK_ACCESS_DENIED',
          framework: fwId,
          accessLevel: result.accessLevel,
          reason: result.reason,
          upgradeCTA: result.upgradeCTA,
        });
        if (writeErr) safeNext(next, writeErr);
        return;
      }

      req.frameworkAccess = {
        allowed: true,
        accessLevel: result.accessLevel || 'locked',
        requiresLegalNotice: result.requiresLegalNotice === true,
      };
      safeNext(next);
    } catch (error) {
      if ((error as Error)?.message === 'FRAMEWORK_ACCESS_TIMEOUT') {
        logger.warn('[FrameworkGate] checkAccess timed out', {
          framework: fwId,
          timeoutMs: CHECK_TIMEOUT_MS,
          orgId,
        });
      }
      const writeErr = writeServiceUnavailable(res, fwId);
      if (writeErr) safeNext(next, error);
    }
  };
}
