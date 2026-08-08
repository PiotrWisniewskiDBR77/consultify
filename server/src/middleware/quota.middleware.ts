/**
 * Quota Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Enforces token and storage quotas before allowing API requests.
 * Integrates with AccessPolicyService for trial-aware enforcement.
 */

import { NextFunction, Request, Response } from 'express';

import usageService from '../services/usageService.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface UsageService {
  checkQuota: (
    orgId: string,
    type: 'token' | 'storage'
  ) => Promise<{
    allowed: boolean;
    used: number;
    limit: number;
    percentage: number;
  }>;
  recordTokenUsage: (
    orgId: string,
    userId: string,
    tokens: number,
    action: string,
    metadata?: Record<string, unknown>
  ) => Promise<unknown>;
  recordStorageUsage: (
    orgId: string,
    bytes: number,
    action: string,
    metadata?: Record<string, unknown>
  ) => Promise<unknown>;
}

interface QuotaInfo {
  allowed: boolean;
  used: number;
  limit: number;
  percentage: number;
}

interface QuotaRequest extends AuthRequest {
  quotaInfo?: QuotaInfo;
  storageQuotaInfo?: QuotaInfo;
}

interface Dependencies {
  usageService: UsageService;
}

// ==========================================
// CONSTANTS
// ==========================================

const ORG_ID_MAX_LEN = 256;
const ACTION_MAX_LEN = 128;
const STRING_FIELD_MAX_LEN = 512;
const TOKEN_MAX = 50_000_000;

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies = { usageService };

let accessPolicyService: any = null;
async function getAccessPolicyService() {
  if (accessPolicyService) return accessPolicyService;
  try {
    const mod = await import('../services/accessPolicyService.js');
    accessPolicyService = mod.default || mod;
    return accessPolicyService;
  } catch (error) {
    logger.error('[QuotaMiddleware] Failed to load AccessPolicyService:', error);
    throw error;
  }
}

// ==========================================
// HELPERS
// ==========================================

function safeGet<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function isResponseCommitted(res: any): boolean {
  return (
    safeGet(() => res.headersSent, false) ||
    safeGet(() => res.writableEnded, false) ||
    safeGet(() => res.finished, false) ||
    safeGet(() => res.closed, false)
  );
}

function sanitizeFinite(n: unknown, fallback = 0): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return fallback;
  return v;
}

function safeOrgId(req: any): string | undefined {
  const fromUser = safeGet(() => req.user?.organizationId, undefined);
  if (fromUser !== undefined) return fromUser;
  return safeGet(() => req.organizationId, undefined);
}

function safeUserId(req: any): string | undefined {
  const fromUser = safeGet(() => req.user?.id, undefined);
  if (fromUser !== undefined) return fromUser;
  return safeGet(() => req.userId, undefined);
}

function safeBody(req: any): any {
  return safeGet(() => req.body, {});
}

function safeFile(req: any): any {
  return safeGet(() => req.file, undefined);
}

function truncate(s: string | undefined, max: number): string | undefined {
  if (s === undefined) return undefined;
  return String(s).slice(0, max);
}

function writeHeader(res: any, name: string, value: string): void {
  try {
    if (typeof res.set === 'function') {
      res.set(name, value);
      return;
    }
  } catch {
    // fall through to setHeader
  }
  try {
    if (typeof res.setHeader === 'function') {
      res.setHeader(name, value);
    }
  } catch {
    // swallow header write failures
  }
}

function safeQuotaPayload(raw: any, orgId: string): QuotaInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  try {
    const allowed = safeGet(() => raw.allowed, undefined);
    const used = safeGet(() => raw.used, undefined);
    const limit = safeGet(() => raw.limit, undefined);
    const percentage = safeGet(() => raw.percentage, undefined);
    if (typeof allowed !== 'boolean') return null;
    return {
      allowed,
      used: sanitizeFinite(used),
      limit: sanitizeFinite(limit),
      percentage: sanitizeFinite(percentage),
    };
  } catch {
    return null;
  }
}

/** Returns true if the 401 was successfully written; false if it failed (caller should call next). */
function writeUnauthorized(res: any, logKey: string, next: () => void): boolean {
  if (isResponseCommitted(res)) {
    return false;
  }
  if (typeof res.status !== 'function') {
    logger.error(logKey);
    return false;
  }
  try {
    res.status(401).json({ error: 'Unauthorized - no organization' });
    return true;
  } catch {
    logger.error(logKey);
    return false;
  }
}

function writeError(res: any, status: number, body: Record<string, unknown>): void {
  if (isResponseCommitted(res)) return;
  try {
    res.status(status).json(body);
  } catch {
    // swallow
  }
}

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Middleware to enforce token quota on AI endpoints.
 * Checks both subscription-level quota (usageService) and trial-level budget (AccessPolicyService).
 */
export async function enforceTokenQuota(
  req: QuotaRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const orgId = safeOrgId(req);

  if (!orgId) {
    const wrote = writeUnauthorized(
      res,
      '[QuotaMiddleware] Failed to write token unauthorized response',
      next
    );
    if (!wrote) {
      try {
        next();
      } catch {
        /* swallow */
      }
    }
    return;
  }

  if (orgId.length > ORG_ID_MAX_LEN) {
    writeError(res, 401, { error: 'Unauthorized - invalid organization' });
    return;
  }

  try {
    let aps: any;
    try {
      aps = await getAccessPolicyService();
    } catch {
      writeError(res, 503, {
        error: 'Access policy is temporarily unavailable',
        errorCode: 'ACCESS_POLICY_UNAVAILABLE',
        code: 'ACCESS_POLICY_UNAVAILABLE',
      });
      return;
    }

    let accessResult: any;
    try {
      accessResult = await aps.checkAccess(orgId, 'ai_call');
    } catch (policyErr) {
      logger.error('[QuotaMiddleware] Access policy check failed:', policyErr);
      writeError(res, 503, {
        error: 'Access policy is temporarily unavailable',
        errorCode: 'ACCESS_POLICY_UNAVAILABLE',
        code: 'ACCESS_POLICY_UNAVAILABLE',
      });
      return;
    }

    if (!accessResult || typeof accessResult.allowed !== 'boolean') {
      logger.error('[QuotaMiddleware] Invalid access policy payload', { orgId });
      writeError(res, 503, {
        error: 'Access policy is temporarily unavailable',
        errorCode: 'ACCESS_POLICY_UNAVAILABLE',
        code: 'ACCESS_POLICY_UNAVAILABLE',
      });
      return;
    }

    if (!accessResult.allowed) {
      writeError(res, 429, {
        error: accessResult.reason,
        errorCode: accessResult.errorCode,
        code: accessResult.errorCode,
        message: accessResult.reason,
        upgradeUrl: '/settings?tab=billing',
        upgradeCta:
          accessResult.errorCode === 'AI_TOKEN_BUDGET_EXCEEDED'
            ? 'Add payment method'
            : 'Upgrade plan',
      });
      return;
    }

    const { usageService: svc } = deps;
    let rawQuota: any;
    try {
      rawQuota = await svc.checkQuota(orgId, 'token');
    } catch (quotaErr) {
      logger.error('Quota check error:', quotaErr);
      if (!isResponseCommitted(res)) {
        writeError(res, 503, {
          error: 'Token quota service unavailable',
          errorCode: 'QUOTA_CHECK_UNAVAILABLE',
          code: 'QUOTA_CHECK_UNAVAILABLE',
        });
      } else {
        try {
          next();
        } catch {
          /* swallow */
        }
      }
      return;
    }

    const quota = safeQuotaPayload(rawQuota, orgId);
    if (!quota) {
      logger.error('[QuotaMiddleware] Invalid token quota payload', { orgId });
      writeError(res, 503, {
        error: 'Token quota service unavailable',
        errorCode: 'QUOTA_CHECK_UNAVAILABLE',
        code: 'QUOTA_CHECK_UNAVAILABLE',
      });
      return;
    }

    req.quotaInfo = quota;

    if (!quota.allowed) {
      if (isResponseCommitted(res)) {
        try {
          next();
        } catch {
          /* swallow */
        }
        return;
      }
      writeError(res, 429, {
        error: 'Token quota exceeded',
        errorCode: 'QUOTA_EXCEEDED',
        code: 'QUOTA_EXCEEDED',
        usage: {
          used: quota.used,
          limit: quota.limit,
          percentage: quota.percentage,
        },
        message:
          'Your organization has exceeded the monthly token limit. Please upgrade your plan or wait for the next billing cycle.',
        upgradeUrl: '/settings?tab=billing',
      });
      return;
    }

    if (Number.isFinite(quota.percentage) && quota.percentage >= 80 && quota.percentage < 100) {
      writeHeader(res as any, 'X-Quota-Warning', 'true');
      writeHeader(res as any, 'X-Quota-Percentage', quota.percentage.toString());
    }

    try {
      next();
    } catch {
      /* swallow downstream next errors */
    }
  } catch (error: unknown) {
    logger.error('Quota check error:', error);
    if (!isResponseCommitted(res)) {
      writeError(res, 503, {
        error: 'Token quota service unavailable',
        errorCode: 'QUOTA_CHECK_UNAVAILABLE',
        code: 'QUOTA_CHECK_UNAVAILABLE',
      });
    } else {
      try {
        next();
      } catch {
        /* swallow */
      }
    }
  }
}

/**
 * Middleware to enforce storage quota on upload endpoints.
 * Checks both subscription-level quota and trial-level limits.
 */
export async function enforceStorageQuota(
  req: QuotaRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const orgId = safeOrgId(req);

  if (!orgId) {
    writeError(res, 401, { error: 'Unauthorized - no organization' });
    return;
  }

  if (orgId.length > ORG_ID_MAX_LEN) {
    writeError(res, 401, { error: 'Unauthorized - invalid organization' });
    return;
  }

  try {
    let aps: any;
    try {
      aps = await getAccessPolicyService();
    } catch {
      writeError(res, 503, {
        error: 'Access policy is temporarily unavailable',
        errorCode: 'ACCESS_POLICY_UNAVAILABLE',
        code: 'ACCESS_POLICY_UNAVAILABLE',
      });
      return;
    }

    let accessResult: any;
    try {
      accessResult = await aps.checkAccess(orgId, 'upload');
    } catch (policyErr) {
      logger.error('[QuotaMiddleware] Storage access policy check failed:', policyErr);
      writeError(res, 503, {
        error: 'Access policy is temporarily unavailable',
        errorCode: 'ACCESS_POLICY_UNAVAILABLE',
        code: 'ACCESS_POLICY_UNAVAILABLE',
      });
      return;
    }

    if (!accessResult || typeof accessResult.allowed !== 'boolean') {
      logger.error('[QuotaMiddleware] Invalid access policy payload', { orgId });
      writeError(res, 503, {
        error: 'Access policy is temporarily unavailable',
        errorCode: 'ACCESS_POLICY_UNAVAILABLE',
        code: 'ACCESS_POLICY_UNAVAILABLE',
      });
      return;
    }

    if (!accessResult.allowed) {
      writeError(res, 429, {
        error: accessResult.reason,
        errorCode: accessResult.errorCode,
        code: accessResult.errorCode,
        message: accessResult.reason,
        upgradeUrl: '/settings?tab=billing',
      });
      return;
    }

    const { usageService: svc } = deps;
    let rawQuota: any;
    try {
      rawQuota = await svc.checkQuota(orgId, 'storage');
    } catch (quotaErr) {
      logger.error('Storage quota check error:', quotaErr);
      if (!isResponseCommitted(res)) {
        writeError(res, 503, {
          error: 'Storage quota service unavailable',
          errorCode: 'STORAGE_QUOTA_CHECK_UNAVAILABLE',
          code: 'STORAGE_QUOTA_CHECK_UNAVAILABLE',
        });
      } else {
        try {
          next();
        } catch {
          /* swallow */
        }
      }
      return;
    }

    const quota = safeQuotaPayload(rawQuota, orgId);
    if (!quota) {
      logger.error('[QuotaMiddleware] Invalid storage quota payload', { orgId });
      writeError(res, 503, {
        error: 'Storage quota service unavailable',
        errorCode: 'STORAGE_QUOTA_CHECK_UNAVAILABLE',
        code: 'STORAGE_QUOTA_CHECK_UNAVAILABLE',
      });
      return;
    }

    req.storageQuotaInfo = quota;

    if (!quota.allowed) {
      if (isResponseCommitted(res)) {
        try {
          next();
        } catch {
          /* swallow */
        }
        return;
      }
      const usedBytes = Math.max(0, quota.used);
      const limitBytes = Math.max(0, quota.limit);
      writeError(res, 429, {
        error: 'Storage quota exceeded',
        errorCode: 'STORAGE_QUOTA_EXCEEDED',
        code: 'STORAGE_QUOTA_EXCEEDED',
        usage: {
          usedGB: (usedBytes / (1024 * 1024 * 1024)).toFixed(2),
          limitGB: (limitBytes / (1024 * 1024 * 1024)).toFixed(2),
          percentage: quota.percentage,
        },
        message:
          'Your organization has exceeded the storage limit. Please upgrade your plan or delete unused files.',
        upgradeUrl: '/settings?tab=billing',
      });
      return;
    }

    try {
      next();
    } catch {
      /* swallow downstream next errors */
    }
  } catch (error: unknown) {
    logger.error('Storage quota check error:', error);
    if (!isResponseCommitted(res)) {
      writeError(res, 503, {
        error: 'Storage quota service unavailable',
        errorCode: 'STORAGE_QUOTA_CHECK_UNAVAILABLE',
        code: 'STORAGE_QUOTA_CHECK_UNAVAILABLE',
      });
    } else {
      try {
        next();
      } catch {
        /* swallow */
      }
    }
  }
}

/**
 * Record token usage after AI response
 * Call this AFTER the AI response is sent
 */
export async function recordTokenUsageAfterResponse(
  req: QuotaRequest,
  _res: Response,
  tokens: number,
  action: string
): Promise<void> {
  try {
    const { usageService: svc } = deps;

    const orgId = safeOrgId(req);
    const userId = safeUserId(req);
    const body = safeBody(req);

    if (!orgId || !userId) return;
    if (orgId.length > ORG_ID_MAX_LEN) return;

    const rawTokens = Number(tokens);
    if (!Number.isFinite(rawTokens) || rawTokens <= 0) return;
    const safeTokens = Math.min(rawTokens, TOKEN_MAX);

    const safeAction = String(action).slice(0, ACTION_MAX_LEN);
    const endpoint = truncate(
      safeGet(() => req.path, ''),
      STRING_FIELD_MAX_LEN
    );
    const model =
      truncate(
        safeGet(() => (body as { model?: string })?.model, undefined) ?? 'default',
        STRING_FIELD_MAX_LEN
      ) ?? 'default';

    await svc.recordTokenUsage(orgId, userId, safeTokens, safeAction, {
      endpoint,
      model,
    });
  } catch (error: unknown) {
    logger.error('Failed to record token usage:', error);
  }
}

/**
 * Record storage usage after file upload
 */
export async function recordStorageAfterUpload(
  req: Request & { file?: { originalname?: string } },
  bytes: number,
  action = 'upload'
): Promise<void> {
  try {
    const { usageService: svc } = deps;

    const orgId = safeOrgId(req as any);

    if (!orgId) return;
    if (orgId.length > ORG_ID_MAX_LEN) return;

    const rawBytes = Number(String(bytes).trim());
    if (!Number.isFinite(rawBytes) || rawBytes <= 0) return;

    const file = safeFile(req);

    const safeAction = String(action).slice(0, ACTION_MAX_LEN);
    const endpoint = truncate(
      safeGet(() => req.path, ''),
      STRING_FIELD_MAX_LEN
    );
    const filename = truncate(
      safeGet(() => file?.originalname, undefined),
      STRING_FIELD_MAX_LEN
    );

    await svc.recordStorageUsage(orgId, rawBytes, safeAction, {
      endpoint,
      filename,
    });
  } catch (error: unknown) {
    logger.error('Failed to record storage usage:', error);
  }
}

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
  deps = { ...deps, ...newDeps };
};
