/**
 * Quota Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Enforces token and storage quotas before allowing API requests.
 * Integrates with AccessPolicyService for trial-aware enforcement.
 */

import { NextFunction, Request, Response } from 'express';

import usageService from '../../services/usageService.js';
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
    const orgId = req.user?.organizationId;

    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized - no organization' });
      return;
    }

    try {
      const aps = await getAccessPolicyService();
      const accessResult = await aps.checkAccess(orgId, 'ai_call');
      if (!accessResult.allowed) {
        res.status(429).json({
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
    } catch (policyErr) {
      logger.error('[QuotaMiddleware] Access policy check failed:', policyErr);
      res.status(503).json({
        error: 'Access policy is temporarily unavailable',
        errorCode: 'ACCESS_POLICY_UNAVAILABLE',
        code: 'ACCESS_POLICY_UNAVAILABLE',
      });
      return;
    }

    const quota = await usageService.checkQuota(orgId, 'token');
    req.quotaInfo = quota;

    if (!quota.allowed) {
      res.status(429).json({
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

    if (quota.percentage >= 80 && quota.percentage < 100) {
      res.set('X-Quota-Warning', 'true');
      res.set('X-Quota-Percentage', quota.percentage.toString());
    }

    next();
  } catch (error: unknown) {
    logger.error('Quota check error:', error);
    res.status(503).json({
      error: 'Token quota service unavailable',
      errorCode: 'QUOTA_CHECK_UNAVAILABLE',
      code: 'QUOTA_CHECK_UNAVAILABLE',
    });
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
    const orgId = req.user?.organizationId;

    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized - no organization' });
      return;
    }

    try {
      const aps = await getAccessPolicyService();
      const accessResult = await aps.checkAccess(orgId, 'upload');
      if (!accessResult.allowed) {
        res.status(429).json({
          error: accessResult.reason,
          errorCode: accessResult.errorCode,
          code: accessResult.errorCode,
          message: accessResult.reason,
          upgradeUrl: '/settings?tab=billing',
        });
        return;
      }
    } catch (policyErr) {
      logger.error('[QuotaMiddleware] Storage access policy check failed:', policyErr);
      res.status(503).json({
        error: 'Access policy is temporarily unavailable',
        errorCode: 'ACCESS_POLICY_UNAVAILABLE',
        code: 'ACCESS_POLICY_UNAVAILABLE',
      });
      return;
    }

    const quota = await usageService.checkQuota(orgId, 'storage');
    req.storageQuotaInfo = quota;

    if (!quota.allowed) {
      res.status(429).json({
        error: 'Storage quota exceeded',
        errorCode: 'STORAGE_QUOTA_EXCEEDED',
        code: 'STORAGE_QUOTA_EXCEEDED',
        usage: {
          usedGB: (quota.used / (1024 * 1024 * 1024)).toFixed(2),
          limitGB: (quota.limit / (1024 * 1024 * 1024)).toFixed(2),
          percentage: quota.percentage,
        },
        message:
          'Your organization has exceeded the storage limit. Please upgrade your plan or delete unused files.',
        upgradeUrl: '/settings?tab=billing',
      });
      return;
    }

    next();
  } catch (error: unknown) {
    logger.error('Storage quota check error:', error);
    res.status(503).json({
      error: 'Storage quota service unavailable',
      errorCode: 'STORAGE_QUOTA_CHECK_UNAVAILABLE',
      code: 'STORAGE_QUOTA_CHECK_UNAVAILABLE',
    });
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

    const orgId = req.user?.organizationId;
    const userId = req.user?.id;

    if (orgId && tokens > 0) {
      await usageService.recordTokenUsage(orgId, userId, tokens, action, {
        endpoint: req.path,
        model: (req.body as { model?: string })?.model || 'default',
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

    const orgId = (req as AuthRequest).user?.organizationId;

    if (orgId && bytes > 0) {
      await usageService.recordStorageUsage(orgId, bytes, action, {
        endpoint: req.path,
        filename: req.file?.originalname,
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
