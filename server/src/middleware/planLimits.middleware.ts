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

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const coercePublicString = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
};
const MAX_PLAN_LIMIT_ORG_ID_CHARS = 128;
const MAX_PLAN_LIMIT_REASON_CHARS = 512;
const MAX_PLAN_LIMIT_ERROR_CODE_CHARS = 64;
const MAX_PLAN_LIMIT_KEY_CHARS = 128;

const coerceBoundedPublicString = (
  value: unknown,
  fallback: string,
  maxChars: number
): string => {
  const normalized = coercePublicString(value, fallback);
  return normalized.length > maxChars ? normalized.slice(0, maxChars) : normalized;
};

const isAccessCheckResponse = (
  value: unknown
): value is { allowed?: unknown; reason?: unknown; errorCode?: unknown } =>
  typeof value === 'object' && value !== null;

const readOrganizationId = (req: AuthRequest): string | undefined =>
  normalizeOptionalString(safeRead(() => req.organizationId, undefined)) ||
  normalizeOptionalString(safeRead(() => req.user?.organizationId, undefined)) ||
  normalizeOptionalString(safeRead(() => req.user?.organization_id, undefined));
const sendPlanLimitsJson = (
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>
): boolean => {
  if (safeRead(() => res.headersSent, false)) return false;
  try {
    const statusBinder = safeRead(() => (res as Response & { status?: unknown }).status, undefined);
    if (typeof statusBinder !== 'function') {
      logger.warn('[PlanLimits] Response status writer unavailable');
      return false;
    }
    const statusResult = (statusBinder as (code: number) => unknown).call(res, statusCode);
    const jsonWriter = safeRead(
      () => (statusResult as { json?: unknown } | undefined)?.json,
      undefined
    );
    if (typeof jsonWriter !== 'function') {
      logger.warn('[PlanLimits] Response json writer unavailable');
      return false;
    }
    (jsonWriter as (payload: Record<string, unknown>) => unknown).call(statusResult, payload);
    return true;
  } catch {
    return false;
  }
};
const responseCommitted = (res: Response): boolean =>
  safeRead(() => res.headersSent || res.writableEnded, false);
const invokeNext = (nextFn: NextFunction, error?: unknown): void => {
  if (typeof nextFn !== 'function') {
    logger.error('[PlanLimits] next is not a function; skipping');
    return;
  }
  try {
    if (error !== undefined) {
      nextFn(error);
      return;
    }
    nextFn();
  } catch (syncError) {
    logger.error('[PlanLimits] next() threw synchronously:', syncError);
  }
};

async function getAccessPolicyService(): Promise<AccessPolicyServiceLike | null> {
  if (accessPolicyService) return accessPolicyService;
  const mod = await import('../services/accessPolicyService.js');
  const candidate = (mod.default || mod) as { checkAccess?: unknown };
  if (typeof candidate !== 'object' || candidate === null || typeof candidate.checkAccess !== 'function') {
    logger.error('[PlanLimits] Access policy module export missing checkAccess');
    return null;
  }
  accessPolicyService = candidate as AccessPolicyServiceLike;
  return accessPolicyService;
}

/**
 * Check plan limit middleware factory
 */
export const checkPlanLimit = (limitKey: string) => {
  const normalizedLimitKey = normalizeOptionalString(limitKey);
  if (normalizedLimitKey && normalizedLimitKey.length > MAX_PLAN_LIMIT_KEY_CHARS) {
    return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      logger.error('[PlanLimits] Limit key exceeds max length');
      const sent = sendPlanLimitsJson(res, 500, {
        error: 'Plan limit misconfigured',
        errorCode: 'PLAN_LIMIT_KEY_INVALID',
        code: 'PLAN_LIMIT_KEY_INVALID',
      });
      if (!sent && !safeRead(() => res.headersSent, false)) {
        invokeNext(next, new Error('Plan limit key misconfiguration response failed'));
      }
    };
  }
  if (!normalizedLimitKey) {
    return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      logger.error('[PlanLimits] Invalid limit key configuration');
      const sent = sendPlanLimitsJson(res, 500, {
        error: 'Plan limit misconfigured',
        errorCode: 'PLAN_LIMIT_KEY_INVALID',
        code: 'PLAN_LIMIT_KEY_INVALID',
      });
      if (!sent && !safeRead(() => res.headersSent, false)) {
        invokeNext(next, new Error('Plan limit key misconfiguration response failed'));
      }
    };
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const action = LIMIT_ACTION_MAP[normalizedLimitKey];
    if (!action) {
      if (safeRead(() => res.headersSent || res.writableEnded, false)) {
        logger.warn(
          '[PlanLimits] Unknown plan limit key; response already committed; skipping next()'
        );
        return;
      }
      invokeNext(next);
      return;
    }

    const authReq = req as AuthRequest;
    const organizationId = readOrganizationId(authReq);
    if (!organizationId || organizationId.length > MAX_PLAN_LIMIT_ORG_ID_CHARS) {
      if (safeRead(() => res.headersSent || res.writableEnded, false)) {
        logger.warn('[PlanLimits] Organization context missing but response already committed');
        return;
      }
      sendPlanLimitsJson(res, 401, {
        error: 'Unauthorized',
        errorCode: 'ORG_CONTEXT_REQUIRED',
        code: 'ORG_CONTEXT_REQUIRED',
      });
      return;
    }
    if (responseCommitted(res)) {
      logger.warn('[PlanLimits] Skipping plan check; response already committed');
      return;
    }

    try {
      const service = await getAccessPolicyService();
      if (responseCommitted(res)) {
        logger.warn('[PlanLimits] Response committed after service resolve; skipping plan check response');
        return;
      }
      if (!service) {
        sendPlanLimitsJson(res, 503, {
          error: 'Plan limit service unavailable',
          errorCode: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
          code: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
        });
        return;
      }
      const checkAccess = safeRead(
        () => (service as { checkAccess?: unknown }).checkAccess,
        undefined
      );
      if (typeof checkAccess !== 'function') {
        logger.error('[PlanLimits] Access policy service missing checkAccess');
        sendPlanLimitsJson(res, 503, {
          error: 'Plan limit service unavailable',
          errorCode: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
          code: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
        });
        return;
      }

      const result = await (checkAccess as AccessPolicyServiceLike['checkAccess'])(
        organizationId,
        action
      );
      if (responseCommitted(res)) {
        logger.warn('[PlanLimits] Response committed after access check; skipping plan response');
        return;
      }
      if (!isAccessCheckResponse(result)) {
        logger.error('[PlanLimits] Invalid checkAccess response shape');
        sendPlanLimitsJson(res, 503, {
          error: 'Plan limit service unavailable',
          errorCode: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
          code: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
        });
        return;
      }
      if (result.allowed !== true && result.allowed !== false) {
        logger.error('[PlanLimits] Invalid checkAccess response: allowed must be boolean');
        sendPlanLimitsJson(res, 503, {
          error: 'Plan limit service unavailable',
          errorCode: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
          code: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
        });
        return;
      }

      if (!result.allowed) {
        const errorCode = coerceBoundedPublicString(
          result.errorCode,
          'PLAN_LIMIT_REACHED',
          MAX_PLAN_LIMIT_ERROR_CODE_CHARS
        );
        sendPlanLimitsJson(res, 429, {
          error: coerceBoundedPublicString(
            result.reason,
            'Plan limit reached',
            MAX_PLAN_LIMIT_REASON_CHARS
          ),
          errorCode,
          code: errorCode,
        });
        return;
      }
      if (safeRead(() => res.headersSent || res.writableEnded, false)) {
        logger.warn('[PlanLimits] Response already committed; skipping next() after allow');
        return;
      }
      invokeNext(next);
    } catch (error) {
      logger.error('[PlanLimits] Failed to enforce plan limit:', error);
      const sent = sendPlanLimitsJson(res, 503, {
        error: 'Plan limit service unavailable',
        errorCode: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
        code: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
      });
      if (!sent && !safeRead(() => res.headersSent, false)) {
        invokeNext(next, error instanceof Error ? error : new Error('Plan limit enforcement failed'));
      }
    }
  };
};

export const setAccessPolicyServiceForTests = (
  service: AccessPolicyServiceLike | null
): void => {
  accessPolicyService = service;
};

export default checkPlanLimit;
