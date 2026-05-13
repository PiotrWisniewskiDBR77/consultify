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
const FRAMEWORK_ID_MAX_LEN = 64;
const ORG_ID_MAX_LEN = 128;
const FRAMEWORK_PARAM_NAME_MAX_LEN = 64;
const FRAMEWORK_ACCESS_LEVEL_MAX_LEN = 32;
const FRAMEWORK_REASON_MAX_LEN = 512;
const FRAMEWORK_UPGRADE_CTA_MAX_LEN = 512;
const VALID_FRAMEWORK_ACCESS_LEVELS = new Set(['locked', 'trial', 'full', 'educational']);
const FRAMEWORK_ID_PATTERN = /^[A-Z0-9][A-Z0-9._-]*$/;

const sendJsonIfHeadersOpen = (
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>
): boolean => {
  if (safeRead(() => res.headersSent, false)) return false;
  try {
    res.status(statusCode).json(payload);
    return true;
  } catch (error) {
    logger.warn('[FrameworkGate] Failed to write JSON response', error);
    return false;
  }
};

const respondOrNextOnWriteFailure = (
  res: Response,
  next: NextFunction,
  statusCode: number,
  payload: Record<string, unknown>,
  fallbackMessage: string
): void => {
  const sent = sendJsonIfHeadersOpen(res, statusCode, payload);
  if (!sent && !safeRead(() => res.headersSent, false)) {
    next(new Error(fallbackMessage));
  }
};

const isSafeParamName = (value: string): boolean =>
  value.length > 0 &&
  value.length <= FRAMEWORK_PARAM_NAME_MAX_LEN &&
  /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
const isWellFormedFrameworkId = (frameworkId: string): boolean =>
  frameworkId.length > 0 &&
  frameworkId.length <= FRAMEWORK_ID_MAX_LEN &&
  FRAMEWORK_ID_PATTERN.test(frameworkId);
const clampOptionalString = (value: unknown, maxChars: number): string | undefined => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;
  return normalized.slice(0, maxChars);
};
const isEntitlementResultRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const sanitizeAccessLevel = (value: unknown): string => {
  const normalized = clampOptionalString(value, FRAMEWORK_ACCESS_LEVEL_MAX_LEN)?.toLowerCase();
  if (!normalized || !VALID_FRAMEWORK_ACCESS_LEVELS.has(normalized)) return 'locked';
  return normalized;
};
const buildFrameworkDeniedPayload = (framework: string, result: Record<string, unknown>) => ({
  error: 'FRAMEWORK_ACCESS_DENIED',
  framework,
  accessLevel: sanitizeAccessLevel(result.accessLevel),
  reason: clampOptionalString(result.reason, FRAMEWORK_REASON_MAX_LEN),
  upgradeCTA: clampOptionalString(result.upgradeCTA, FRAMEWORK_UPGRADE_CTA_MAX_LEN),
});
const buildFrameworkAccessAttachment = (result: Record<string, unknown>) => ({
  allowed: true,
  accessLevel: sanitizeAccessLevel(result.accessLevel),
  requiresLegalNotice: result.requiresLegalNotice === true,
});

const readOrgId = (req: AuthRequest): string | undefined =>
  normalizeOptionalString(safeRead(() => (req as Request & { organizationId?: string }).organizationId, undefined)) ||
  normalizeOptionalString(safeRead(() => req.user?.organizationId, undefined)) ||
  normalizeOptionalString(
    safeRead(() => (req.user as { organization_id?: string } | undefined)?.organization_id, undefined)
  );
const readBoundedOrgId = (req: AuthRequest): string | undefined => {
  const orgId = readOrgId(req);
  if (!orgId) return undefined;
  if (orgId.length > ORG_ID_MAX_LEN) return undefined;
  return orgId;
};

export function requireFrameworkAccess(frameworkId: string) {
  const normalizedFrameworkId = normalizeOptionalString(frameworkId);
  const canonicalFrameworkId = safeRead(
    () => normalizedFrameworkId?.toLocaleUpperCase('en-US'),
    undefined as string | undefined
  );
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (
      !canonicalFrameworkId ||
      canonicalFrameworkId.length > FRAMEWORK_ID_MAX_LEN ||
      !isWellFormedFrameworkId(canonicalFrameworkId)
    ) {
      respondOrNextOnWriteFailure(
        res,
        next,
        500,
        {
          error: 'FRAMEWORK_GATE_MISCONFIGURED',
        },
        'Failed to write framework gate misconfiguration response'
      );
      return;
    }
    const orgId = readBoundedOrgId(req);
    if (!orgId) {
      respondOrNextOnWriteFailure(
        res,
        next,
        401,
        { error: 'UNAUTHORIZED' },
        'Failed to write framework gate unauthorized response'
      );
      return;
    }
    try {
      const result = await FrameworkEntitlementService.checkAccess(orgId, canonicalFrameworkId);
      if (!isEntitlementResultRecord(result)) {
        logger.warn('[FrameworkGate] checkAccess returned non-object result', {
          framework: canonicalFrameworkId,
        });
        const sent = sendJsonIfHeadersOpen(res, 503, {
          error: 'FRAMEWORK_ACCESS_CHECK_UNAVAILABLE',
          framework: canonicalFrameworkId,
        });
        if (!sent && !safeRead(() => res.headersSent, false)) {
          next(new Error('Framework access check returned invalid payload'));
        }
        return;
      }
      if (typeof result.allowed !== 'boolean') {
        logger.warn('[FrameworkGate] checkAccess returned malformed allowed flag', {
          framework: canonicalFrameworkId,
        });
        const sent = sendJsonIfHeadersOpen(res, 503, {
          error: 'FRAMEWORK_ACCESS_CHECK_UNAVAILABLE',
          framework: canonicalFrameworkId,
        });
        if (!sent && !safeRead(() => res.headersSent, false)) {
          next(new Error('Framework access check returned invalid payload'));
        }
        return;
      }
      if (!result.allowed) {
        safeRead(() => {
          logger.info(
            `[FrameworkGate] Blocked org=${clampOptionalString(orgId, 128) ?? '(unknown)'} from ${canonicalFrameworkId}: ${
              clampOptionalString(result.reason, FRAMEWORK_REASON_MAX_LEN) ?? ''
            }`
          );
        }, undefined);
        respondOrNextOnWriteFailure(
          res,
          next,
          403,
          buildFrameworkDeniedPayload(canonicalFrameworkId, result),
          'Failed to write framework gate denied response'
        );
        return;
      }
      req.frameworkAccess = buildFrameworkAccessAttachment(result);
      next();
    } catch (error) {
      logger.warn('[FrameworkGate] checkAccess failed', error);
      const sent = sendJsonIfHeadersOpen(res, 503, {
        error: 'FRAMEWORK_ACCESS_CHECK_UNAVAILABLE',
        framework: canonicalFrameworkId,
      });
      if (!sent && !safeRead(() => res.headersSent, false)) {
        next(error instanceof Error ? error : new Error('Framework access check failed'));
      }
    }
  };
}

export function requireDynamicFrameworkAccess(paramName = 'frameworkId') {
  const normalizedParamName = normalizeOptionalString(paramName);
  if (!normalizedParamName || !isSafeParamName(normalizedParamName)) {
    return async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      respondOrNextOnWriteFailure(
        res,
        next,
        500,
        {
          error: 'FRAMEWORK_GATE_MISCONFIGURED',
        },
        'Failed to write dynamic framework gate misconfiguration response'
      );
    };
  }
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const orgId = readBoundedOrgId(req);
    const fwId =
      normalizeOptionalString(safeRead(() => req.params?.[normalizedParamName], undefined)) ||
      normalizeOptionalString(
        safeRead(() => {
          const body = req.body as Record<string, unknown> | undefined;
          if (!body) return undefined;
          return body[normalizedParamName] ?? body.frameworkId;
        }, undefined)
      );
    if (!orgId) {
      respondOrNextOnWriteFailure(
        res,
        next,
        401,
        { error: 'UNAUTHORIZED' },
        'Failed to write dynamic framework gate unauthorized response'
      );
      return;
    }
    if (!fwId) {
      respondOrNextOnWriteFailure(
        res,
        next,
        400,
        { error: 'BAD_REQUEST', message: 'Framework ID required' },
        'Failed to write dynamic framework id required response'
      );
      return;
    }
    const canonicalFwId = safeRead(() => fwId.toLocaleUpperCase('en-US'), '');
    if (
      !canonicalFwId ||
      canonicalFwId.length > FRAMEWORK_ID_MAX_LEN ||
      !isWellFormedFrameworkId(canonicalFwId)
    ) {
      respondOrNextOnWriteFailure(
        res,
        next,
        400,
        { error: 'BAD_REQUEST', message: 'Invalid framework ID' },
        'Failed to write dynamic invalid framework id response'
      );
      return;
    }
    try {
      const result = await FrameworkEntitlementService.checkAccess(orgId, canonicalFwId);
      if (!isEntitlementResultRecord(result)) {
        logger.warn('[FrameworkGate] dynamic checkAccess returned non-object result', {
          framework: canonicalFwId,
        });
        const sent = sendJsonIfHeadersOpen(res, 503, {
          error: 'FRAMEWORK_ACCESS_CHECK_UNAVAILABLE',
          framework: canonicalFwId,
        });
        if (!sent && !safeRead(() => res.headersSent, false)) {
          next(new Error('Dynamic framework access check returned invalid payload'));
        }
        return;
      }
      if (typeof result.allowed !== 'boolean') {
        logger.warn('[FrameworkGate] dynamic checkAccess returned malformed allowed flag', {
          framework: canonicalFwId,
        });
        const sent = sendJsonIfHeadersOpen(res, 503, {
          error: 'FRAMEWORK_ACCESS_CHECK_UNAVAILABLE',
          framework: canonicalFwId,
        });
        if (!sent && !safeRead(() => res.headersSent, false)) {
          next(new Error('Dynamic framework access check returned invalid payload'));
        }
        return;
      }
      if (!result.allowed) {
        safeRead(() => {
          logger.info(
            `[FrameworkGate] Blocked org=${clampOptionalString(orgId, 128) ?? '(unknown)'} from ${canonicalFwId}: ${
              clampOptionalString(result.reason, FRAMEWORK_REASON_MAX_LEN) ?? ''
            }`
          );
        }, undefined);
        respondOrNextOnWriteFailure(
          res,
          next,
          403,
          buildFrameworkDeniedPayload(canonicalFwId, result),
          'Failed to write dynamic framework gate denied response'
        );
        return;
      }
      req.frameworkAccess = buildFrameworkAccessAttachment(result);
      next();
    } catch (error) {
      logger.warn('[FrameworkGate] dynamic checkAccess failed', error);
      const sent = sendJsonIfHeadersOpen(res, 503, {
        error: 'FRAMEWORK_ACCESS_CHECK_UNAVAILABLE',
        framework: canonicalFwId,
      });
      if (!sent && !safeRead(() => res.headersSent, false)) {
        next(error instanceof Error ? error : new Error('Dynamic framework access check failed'));
      }
    }
  };
}
