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
    userId: string | undefined,
    tokens: number,
    action: string,
    metadata: Record<string, unknown>
  ) => Promise<void>;
  recordStorageUsage: (
    orgId: string,
    bytes: number,
    action: string,
    metadata: Record<string, unknown>
  ) => Promise<void>;
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

const MAX_RECORDED_TOKENS = 50_000_000;
const MAX_RECORDED_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_ACCESS_POLICY_STRING_CHARS = 512;
const MAX_RECORD_ACTION_CHARS = 128;
const MAX_RECORD_METADATA_CHARS = 512;

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies = { usageService };

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

const safeSetHeader = (res: Response, name: string, value: string): void => {
  try {
    if (typeof res.set === 'function') {
      res.set(name, value);
      return;
    }
    if (typeof (res as Response & { setHeader?: (n: string, v: string) => void }).setHeader === 'function') {
      (res as Response & { setHeader: (n: string, v: string) => void }).setHeader(name, value);
    }
  } catch {
    // Quota warnings are optional metadata only.
  }
};
const sendQuotaJson = (
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>,
  writeErrorLogLabel: string
): boolean => {
  if (safeRead(() => res.headersSent, false)) return false;
  try {
    res.status(statusCode).json(payload);
    return true;
  } catch {
    logger.error(writeErrorLogLabel);
    return false;
  }
};

const finiteNumberOrZero = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const isValidQuotaInfo = (value: unknown): value is QuotaInfo =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as QuotaInfo).allowed === 'boolean' &&
  typeof (value as QuotaInfo).used === 'number' &&
  typeof (value as QuotaInfo).limit === 'number' &&
  typeof (value as QuotaInfo).percentage === 'number';

const finitePositiveRecordAmount = (value: number, max: number): number | undefined => {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const normalized = Math.min(Math.floor(value), max);
  return normalized > 0 ? normalized : undefined;
};

const bytesToGbString = (value: unknown): string =>
  (finiteNumberOrZero(value) / (1024 * 1024 * 1024)).toFixed(2);
const truncateString = (value: string, maxChars: number): string =>
  value.length > maxChars ? value.slice(0, maxChars) : value;
const normalizeAccessPolicyResult = (
  value: unknown
): { allowed: boolean; reason: string; errorCode: string } | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.allowed !== 'boolean') return null;
  const reasonRaw = normalizeOptionalString(candidate.reason) || '';
  const errorCodeRaw = normalizeOptionalString(candidate.errorCode) || '';
  return {
    allowed: candidate.allowed,
    reason: truncateString(reasonRaw || 'Access denied', MAX_ACCESS_POLICY_STRING_CHARS),
    errorCode: truncateString(errorCodeRaw || 'ACCESS_POLICY_DENIED', MAX_ACCESS_POLICY_STRING_CHARS),
  };
};

const toQuotaWarningPercentage = (value: unknown): number | undefined => {
  const normalized = finiteNumberOrZero(value);
  if (normalized < 80 || normalized >= 100) return undefined;
  return normalized;
};

const readOrgId = (req: QuotaRequest): string | undefined =>
  normalizeOptionalString(safeRead(() => req.user?.organizationId, undefined as unknown)) ||
  normalizeOptionalString(
    safeRead(() => (req.user as { organization_id?: string } | undefined)?.organization_id, undefined as unknown)
  ) ||
  normalizeOptionalString(safeRead(() => req.organizationId, undefined as unknown));

const readUserId = (req: QuotaRequest): string | undefined =>
  normalizeOptionalString(safeRead(() => req.user?.id, undefined as unknown)) ||
  normalizeOptionalString(safeRead(() => req.userId, undefined as unknown));

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
  try {
    const { usageService } = deps;
    const orgId = readOrgId(req);

    if (!orgId) {
      sendQuotaJson(
        res,
        401,
        { error: 'Unauthorized - no organization' },
        '[QuotaMiddleware] Failed to write token unauthorized response'
      );
      return;
    }

    try {
      const aps = await getAccessPolicyService();
      const accessResult = normalizeAccessPolicyResult(await aps.checkAccess(orgId, 'ai_call'));
      if (!accessResult) {
        logger.error('[QuotaMiddleware] Invalid access policy payload', { orgId });
        sendQuotaJson(
          res,
          503,
          {
            error: 'Access policy is temporarily unavailable',
            errorCode: 'ACCESS_POLICY_UNAVAILABLE',
            code: 'ACCESS_POLICY_UNAVAILABLE',
          },
          '[QuotaMiddleware] Failed to write token access-policy unavailable response'
        );
        return;
      }
      if (!accessResult.allowed) {
        sendQuotaJson(
          res,
          429,
          {
            error: accessResult.reason,
            errorCode: accessResult.errorCode,
            code: accessResult.errorCode,
            message: accessResult.reason,
            upgradeUrl: '/settings?tab=billing',
            upgradeCta:
              accessResult.errorCode === 'AI_TOKEN_BUDGET_EXCEEDED'
                ? 'Add payment method'
                : 'Upgrade plan',
          },
          '[QuotaMiddleware] Failed to write token access-policy deny response'
        );
        return;
      }
    } catch (policyErr) {
      logger.error('[QuotaMiddleware] Access policy check failed:', policyErr);
      sendQuotaJson(
        res,
        503,
        {
          error: 'Access policy is temporarily unavailable',
          errorCode: 'ACCESS_POLICY_UNAVAILABLE',
          code: 'ACCESS_POLICY_UNAVAILABLE',
        },
        '[QuotaMiddleware] Failed to write token access-policy failure response'
      );
      return;
    }

    const quotaCandidate = await usageService.checkQuota(orgId, 'token');
    if (!isValidQuotaInfo(quotaCandidate)) {
      logger.error('[QuotaMiddleware] Invalid token quota payload', { orgId });
      sendQuotaJson(
        res,
        503,
        {
          error: 'Token quota service unavailable',
          errorCode: 'QUOTA_CHECK_UNAVAILABLE',
          code: 'QUOTA_CHECK_UNAVAILABLE',
        },
        '[QuotaMiddleware] Failed to write token quota unavailable response'
      );
      return;
    }
    const quota: QuotaInfo = {
      allowed: quotaCandidate.allowed,
      used: finiteNumberOrZero(quotaCandidate.used),
      limit: finiteNumberOrZero(quotaCandidate.limit),
      percentage: finiteNumberOrZero(quotaCandidate.percentage),
    };
    req.quotaInfo = quota;

    if (!quota.allowed) {
      sendQuotaJson(
        res,
        429,
        {
          error: 'Token quota exceeded',
          errorCode: 'QUOTA_EXCEEDED',
          code: 'QUOTA_EXCEEDED',
          usage: {
            used: finiteNumberOrZero(quota.used),
            limit: finiteNumberOrZero(quota.limit),
            percentage: finiteNumberOrZero(quota.percentage),
          },
          message:
            'Your organization has exceeded the monthly token limit. Please upgrade your plan or wait for the next billing cycle.',
          upgradeUrl: '/settings?tab=billing',
        },
        '[QuotaMiddleware] Failed to write token quota exceeded response'
      );
      return;
    }

    const warningPercentage = toQuotaWarningPercentage(quota.percentage);
    if (warningPercentage !== undefined) {
      safeSetHeader(res, 'X-Quota-Warning', 'true');
      safeSetHeader(res, 'X-Quota-Percentage', String(Math.round(warningPercentage)));
    }

    next();
  } catch (error: unknown) {
    logger.error('Quota check error:', error);
    sendQuotaJson(
      res,
      503,
      {
        error: 'Token quota service unavailable',
        errorCode: 'QUOTA_CHECK_UNAVAILABLE',
        code: 'QUOTA_CHECK_UNAVAILABLE',
      },
      '[QuotaMiddleware] Failed to write token quota catch-all response'
    );
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
  try {
    const { usageService } = deps;
    const orgId = readOrgId(req);

    if (!orgId) {
      sendQuotaJson(
        res,
        401,
        { error: 'Unauthorized - no organization' },
        '[QuotaMiddleware] Failed to write storage unauthorized response'
      );
      return;
    }

    try {
      const aps = await getAccessPolicyService();
      const accessResult = normalizeAccessPolicyResult(await aps.checkAccess(orgId, 'upload'));
      if (!accessResult) {
        logger.error('[QuotaMiddleware] Invalid access policy payload', { orgId });
        sendQuotaJson(
          res,
          503,
          {
            error: 'Access policy is temporarily unavailable',
            errorCode: 'ACCESS_POLICY_UNAVAILABLE',
            code: 'ACCESS_POLICY_UNAVAILABLE',
          },
          '[QuotaMiddleware] Failed to write storage access-policy unavailable response'
        );
        return;
      }
      if (!accessResult.allowed) {
        sendQuotaJson(
          res,
          429,
          {
            error: accessResult.reason,
            errorCode: accessResult.errorCode,
            code: accessResult.errorCode,
            message: accessResult.reason,
            upgradeUrl: '/settings?tab=billing',
          },
          '[QuotaMiddleware] Failed to write storage access-policy deny response'
        );
        return;
      }
    } catch (policyErr) {
      logger.error('[QuotaMiddleware] Storage access policy check failed:', policyErr);
      sendQuotaJson(
        res,
        503,
        {
          error: 'Access policy is temporarily unavailable',
          errorCode: 'ACCESS_POLICY_UNAVAILABLE',
          code: 'ACCESS_POLICY_UNAVAILABLE',
        },
        '[QuotaMiddleware] Failed to write storage access-policy failure response'
      );
      return;
    }

    const quotaCandidate = await usageService.checkQuota(orgId, 'storage');
    if (!isValidQuotaInfo(quotaCandidate)) {
      logger.error('[QuotaMiddleware] Invalid storage quota payload', { orgId });
      sendQuotaJson(
        res,
        503,
        {
          error: 'Storage quota service unavailable',
          errorCode: 'STORAGE_QUOTA_CHECK_UNAVAILABLE',
          code: 'STORAGE_QUOTA_CHECK_UNAVAILABLE',
        },
        '[QuotaMiddleware] Failed to write storage quota unavailable response'
      );
      return;
    }
    const quota: QuotaInfo = {
      allowed: quotaCandidate.allowed,
      used: finiteNumberOrZero(quotaCandidate.used),
      limit: finiteNumberOrZero(quotaCandidate.limit),
      percentage: finiteNumberOrZero(quotaCandidate.percentage),
    };
    req.storageQuotaInfo = quota;

    if (!quota.allowed) {
      sendQuotaJson(
        res,
        429,
        {
          error: 'Storage quota exceeded',
          errorCode: 'STORAGE_QUOTA_EXCEEDED',
          code: 'STORAGE_QUOTA_EXCEEDED',
          usage: {
            usedGB: bytesToGbString(quota.used),
            limitGB: bytesToGbString(quota.limit),
            percentage: finiteNumberOrZero(quota.percentage),
          },
          message:
            'Your organization has exceeded the storage limit. Please upgrade your plan or delete unused files.',
          upgradeUrl: '/settings?tab=billing',
        },
        '[QuotaMiddleware] Failed to write storage quota exceeded response'
      );
      return;
    }

    next();
  } catch (error: unknown) {
    logger.error('Storage quota check error:', error);
    sendQuotaJson(
      res,
      503,
      {
        error: 'Storage quota service unavailable',
        errorCode: 'STORAGE_QUOTA_CHECK_UNAVAILABLE',
        code: 'STORAGE_QUOTA_CHECK_UNAVAILABLE',
      },
      '[QuotaMiddleware] Failed to write storage quota catch-all response'
    );
  }
}

/**
 * Record token usage after AI response
 * Call this AFTER the AI response is sent
 */
export async function recordTokenUsageAfterResponse(
  req: QuotaRequest,
  res: Response,
  tokens: number,
  action: string
): Promise<void> {
  try {
    const { usageService } = deps;

    const orgId = readOrgId(req);
    const userId = readUserId(req);
    const normalizedAction = truncateString(
      normalizeOptionalString(action) || 'unknown',
      MAX_RECORD_ACTION_CHARS
    );
    const endpoint = truncateString(
      normalizeOptionalString(safeRead(() => req.path, undefined as unknown)) || '',
      MAX_RECORD_METADATA_CHARS
    );
    const model = truncateString(
      normalizeOptionalString(
        safeRead(() => (req.body as { model?: string })?.model, undefined as unknown)
      ) || 'default',
      MAX_RECORD_METADATA_CHARS
    );

    const safeTokens = finitePositiveRecordAmount(tokens, MAX_RECORDED_TOKENS);
    if (orgId && safeTokens !== undefined) {
      await usageService.recordTokenUsage(orgId, userId, safeTokens, normalizedAction, {
        endpoint,
        model,
      });
    }
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
    const { usageService } = deps;

    const orgId = readOrgId(req as QuotaRequest);
    const normalizedAction = truncateString(
      normalizeOptionalString(action) || 'upload',
      MAX_RECORD_ACTION_CHARS
    );
    const endpoint = truncateString(
      normalizeOptionalString(safeRead(() => req.path, undefined as unknown)) || '',
      MAX_RECORD_METADATA_CHARS
    );
    const filename = truncateString(
      normalizeOptionalString(safeRead(() => req.file?.originalname, undefined as unknown)) || '',
      MAX_RECORD_METADATA_CHARS
    );

    const safeBytes = finitePositiveRecordAmount(bytes, MAX_RECORDED_BYTES);
    if (orgId && safeBytes !== undefined) {
      await usageService.recordStorageUsage(orgId, safeBytes, normalizedAction, {
        endpoint,
        filename: filename || undefined,
      });
    }
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
