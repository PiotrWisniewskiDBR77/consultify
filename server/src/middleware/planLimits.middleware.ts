/**
 * Plan Limits Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Plan limit checking middleware
 */

import type { NextFunction, Request, Response } from 'express';

import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

type AccessPolicyServiceLike = {
  checkAccess: (
    organizationId: string,
    action: 'create_project'
  ) => Promise<{ allowed: boolean; reason?: string; errorCode?: string }>;
};

const LIMIT_ACTION_MAP: Record<string, 'create_project' | undefined> = {
  max_projects: 'create_project',
};

let accessPolicyService: AccessPolicyServiceLike | null = null;

const MAX_ORG_ID_LENGTH = 128;
const MAX_LIMIT_KEY_LENGTH = 128;
const MAX_ERROR_LENGTH = 512;
const MAX_ERROR_CODE_LENGTH = 64;

async function getAccessPolicyService(): Promise<AccessPolicyServiceLike> {
  if (accessPolicyService) return accessPolicyService;
  const mod = await import('../services/accessPolicyService.js');
  accessPolicyService = (mod.default || mod) as AccessPolicyServiceLike;
  return accessPolicyService;
}

function isCommitted(res: Response): boolean {
  return Boolean((res as any).headersSent || (res as any).writableEnded);
}

function safeString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLen) return null;
  return normalized;
}

function boundedString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

function safeNext(next: NextFunction, error?: unknown): void {
  if (typeof next !== 'function') return;
  try {
    if (error !== undefined) next(error as any);
    else next();
  } catch {
    // Swallow next() failures to keep middleware fail-safe.
  }
}

function tryWriteJson(
  res: Response,
  statusCode: number,
  body: Record<string, unknown>
): Error | null {
  if (isCommitted(res)) return null;
  try {
    const statusWriter = (res as any).status;
    if (typeof statusWriter !== 'function') {
      return new Error('Response status writer is not callable');
    }
    const target = statusWriter.call(res, statusCode);
    const jsonWriter = target?.json;
    if (typeof jsonWriter !== 'function') return null;
    jsonWriter.call(target, body);
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

function resolveOrganizationId(authReq: AuthRequest): string | null {
  let fromReq: unknown;
  try {
    fromReq = (authReq as any).organizationId;
  } catch {
    fromReq = undefined;
  }

  let userValue: any = undefined;
  try {
    userValue = (authReq as any).user;
  } catch {
    userValue = undefined;
  }

  const fromUser = userValue?.organizationId ?? userValue?.organization_id;
  return safeString(fromReq ?? fromUser, MAX_ORG_ID_LENGTH);
}

export function setAccessPolicyServiceForTests(service: AccessPolicyServiceLike | null): void {
  accessPolicyService = service;
}

/**
 * Check plan limit middleware factory
 */
export const checkPlanLimit = (limitKey: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (isCommitted(res)) return;

    const normalizedLimitKey = safeString(limitKey, MAX_LIMIT_KEY_LENGTH);
    if (!normalizedLimitKey) {
      const writeErr = tryWriteJson(res, 500, {
        error: 'Plan limit misconfigured',
        errorCode: 'PLAN_LIMIT_KEY_INVALID',
        code: 'PLAN_LIMIT_KEY_INVALID',
      });
      if (writeErr) safeNext(next, writeErr);
      return;
    }

    const action = LIMIT_ACTION_MAP[normalizedLimitKey];
    if (!action) {
      if (!isCommitted(res)) safeNext(next);
      return;
    }

    const authReq = req as AuthRequest;
    const organizationId = resolveOrganizationId(authReq);
    if (!organizationId) {
      tryWriteJson(res, 401, {
        error: 'Unauthorized',
        errorCode: 'ORG_CONTEXT_REQUIRED',
        code: 'ORG_CONTEXT_REQUIRED',
      });
      return;
    }

    try {
      const service = await getAccessPolicyService();
      if (!service || typeof service.checkAccess !== 'function') {
        tryWriteJson(res, 503, {
          error: 'Plan limit service unavailable',
          errorCode: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
          code: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
        });
        return;
      }
      const result = await service.checkAccess(organizationId, action);
      if (!result || typeof result !== 'object' || typeof result.allowed !== 'boolean') {
        tryWriteJson(res, 503, {
          error: 'Plan limit service unavailable',
          errorCode: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
          code: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
        });
        return;
      }
      if (!result.allowed) {
        const reason = boundedString(result.reason, MAX_ERROR_LENGTH) ?? 'Plan limit reached';
        const code = boundedString(result.errorCode, MAX_ERROR_CODE_LENGTH) ?? 'PLAN_LIMIT_REACHED';
        tryWriteJson(res, 429, {
          error: reason,
          errorCode: code,
          code,
        });
        return;
      }
      if (!isCommitted(res)) safeNext(next);
    } catch (error) {
      logger.error('[PlanLimits] Failed to enforce plan limit:', error);
      const writeErr = tryWriteJson(res, 503, {
        error: 'Plan limit service unavailable',
        errorCode: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
        code: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
      });
      if (writeErr) safeNext(next, error);
    }
  };
};

export default checkPlanLimit;
