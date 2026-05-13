import type { NextFunction, Response } from 'express';

import { getV8Flags, isV8Enabled, isV8ShadowMode } from '../services/v8/featureFlagService.js';
import Logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

const allowImplicitOrgRowsFallback = () => process.env.NODE_ENV !== 'production';
const MAX_V8_ORG_ID_CHARS = 128;
const V8_ORG_ID_CONTROL_CHARS = /[\x00-\x1f\x7f]/;

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};
const isInvalidOrgToken = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized === 'null' || normalized === 'undefined' || normalized === 'none';
};
const sendV8Json = (res: Response, statusCode: number, payload: Record<string, unknown>): void => {
  if (safeRead(() => res.headersSent, false)) return;
  try {
    const statusBinder = safeRead(() => (res as Response & { status?: unknown }).status, undefined);
    if (typeof statusBinder !== 'function') {
      Logger.warn('[v8:featureGate] V8 gate response invalid', {
        code: 'V8_GATE_RESPONSE_INVALID',
        statusCode,
      });
      return;
    }
    const statusResult = (statusBinder as (code: number) => unknown).call(res, statusCode);
    const jsonWriter = safeRead(
      () => (statusResult as { json?: unknown } | undefined)?.json,
      undefined
    );
    if (typeof jsonWriter !== 'function') {
      Logger.warn('[v8:featureGate] V8 gate response invalid', {
        code: 'V8_GATE_RESPONSE_INVALID',
        statusCode,
      });
      return;
    }
    (jsonWriter as (payload: Record<string, unknown>) => unknown).call(statusResult, payload);
  } catch (error) {
    Logger.warn('[v8:featureGate] V8 gate response write failed', {
      code: 'V8_GATE_RESPONSE_WRITE_FAILED',
      statusCode,
      error,
    });
  }
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};
const isUnsafeOrgId = (value: string): boolean =>
  value.length > MAX_V8_ORG_ID_CHARS || V8_ORG_ID_CONTROL_CHARS.test(value);

const readOrgId = (req: AuthRequest): string | undefined =>
  normalizeOptionalString(safeRead(() => req.organizationId, undefined)) ||
  normalizeOptionalString(safeRead(() => req.user?.organizationId, undefined)) ||
  normalizeOptionalString(safeRead(() => req.user?.organization_id, undefined));

const safeNext = (res: Response, next: NextFunction): void => {
  if (!safeRead(() => res.headersSent, true)) {
    if (typeof next !== 'function') {
      Logger.warn('[v8:featureGate] next is not callable', { code: 'V8_GATE_NEXT_INVALID' });
      return;
    }
    try {
      next();
    } catch (error) {
      next(error as Error);
    }
  }
};

/**
 * Pre-auth gate: checks only the global V8 toggle.
 * Runs BEFORE verifyToken so it can short-circuit without auth overhead.
 * Org-level checks happen later via `v8OrgGate` (after auth sets organizationId).
 */
export const v8FeatureGate = (_req: AuthRequest, res: Response, next: NextFunction): void => {
  const globalEnabled = process.env.ENABLE_V8_GLOBAL === 'true';
  if (!globalEnabled) {
    sendV8Json(res, 404, { error: 'V8 features not available', code: 'V8_DISABLED' });
    return;
  }
  safeNext(res, next);
};

/**
 * Post-auth gate: checks org-level V8 enablement and sets shadow mode flag.
 * Must run AFTER verifyToken (needs req.organizationId).
 */
export const v8OrgGate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const orgId = readOrgId(req);
  if (!orgId || isInvalidOrgToken(orgId) || isUnsafeOrgId(orgId)) {
    sendV8Json(res, 400, { error: 'Organization context required for V8', code: 'V8_MISSING_ORG' });
    return;
  }

  try {
    const enabled = await isV8Enabled(orgId);
    if (!enabled) {
      const flags = await getV8Flags(orgId);
      if (Object.keys(flags).length === 0 && allowImplicitOrgRowsFallback()) {
        Logger.warn('[v8:featureGate] Allowing org without explicit V8 flag rows', {
          organizationId: orgId,
        });
        (req as any).v8ShadowMode = await isV8ShadowMode(orgId);
        safeNext(res, next);
        return;
      }

      sendV8Json(res, 404, {
        error: 'V8 not enabled for this organization',
        code: 'V8_ORG_DISABLED',
      });
      return;
    }

    (req as any).v8ShadowMode = await isV8ShadowMode(orgId);
  } catch (error) {
    (req as any).v8ShadowMode = false;
    Logger.warn('[v8:featureGate] V8 org gate evaluation failed', {
      organizationId: orgId,
      code: 'V8_GATE_EVAL_FAILED',
      error,
    });
  }

  safeNext(res, next);
};

/**
 * Post-auth gate for a specific V8 module.
 * Use this when a route is part of the frozen V8/V8.1 package but lives
 * outside the `/api/v8/*` namespace and still needs module-accurate gating.
 */
export const createV8ModuleGate =
  (module: string) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const orgId = readOrgId(req);
    if (!orgId || isInvalidOrgToken(orgId) || isUnsafeOrgId(orgId)) {
      sendV8Json(res, 400, { error: 'Organization context required for V8', code: 'V8_MISSING_ORG' });
      return;
    }

    try {
      const enabled = await isV8Enabled(orgId, module);
      if (!enabled) {
        const flags = await getV8Flags(orgId);
        if (Object.keys(flags).length === 0 && allowImplicitOrgRowsFallback()) {
          Logger.warn('[v8:featureGate] Allowing module for org without explicit V8 flag rows', {
            organizationId: orgId,
            module,
          });
          (req as any).v8ShadowMode = await isV8ShadowMode(orgId);
          safeNext(res, next);
          return;
        }

        sendV8Json(res, 404, {
          error: `V8 module "${module}" not enabled for this organization`,
          code: 'V8_MODULE_DISABLED',
        });
        return;
      }

      (req as any).v8ShadowMode = await isV8ShadowMode(orgId);
    } catch (error) {
      (req as any).v8ShadowMode = false;
      Logger.warn('[v8:featureGate] V8 module gate evaluation failed', {
        organizationId: orgId,
        module,
        code: 'V8_MODULE_GATE_EVAL_FAILED',
        error,
      });
    }

    safeNext(res, next);
  };

export const v8OutputsGate = createV8ModuleGate('outputs');

export default v8FeatureGate;
