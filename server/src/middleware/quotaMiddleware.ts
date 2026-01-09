// @ts-nocheck
/**
 * Quota Middleware
 * Enforces token and storage quotas before allowing API requests
 */

import { Request, Response, NextFunction } from 'express';
import usageService from '../services/usageService.js';

interface QuotaInfo {
    allowed: boolean;
    used: number;
    limit: number;
    percentage: number;
}

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        organizationId?: string;
        organization_id?: string;
    };
    quotaInfo?: QuotaInfo;
    storageQuotaInfo?: QuotaInfo;
    file?: {
        originalname?: string;
    };
}

/**
 * Middleware to enforce token quota on AI endpoints
 */
async function enforceTokenQuota(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const orgId = req.user?.organizationId || req.user?.organization_id;

        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized - no organization' });
            return;
        }

        const quota = await usageService.checkQuota(orgId, 'token');

        // Attach quota info to request for later use
        req.quotaInfo = quota;

        if (!quota.allowed) {
            res.status(429).json({
                error: 'Token quota exceeded',
                code: 'QUOTA_EXCEEDED',
                usage: {
                    used: quota.used,
                    limit: quota.limit,
                    percentage: quota.percentage
                },
                message: 'Your organization has exceeded the monthly token limit. Please upgrade your plan or wait for the next billing cycle.',
                upgradeUrl: '/settings?tab=billing'
            });
            return;
        }

        // Warn if approaching limit (>80%)
        if (quota.percentage >= 80 && quota.percentage < 100) {
            res.set('X-Quota-Warning', 'true');
            res.set('X-Quota-Percentage', quota.percentage.toString());
        }

        next();
    } catch (error) {
        console.error('Quota check error:', error);
        // Allow request to proceed on quota check failure (fail open)
        next();
    }
}

/**
 * Middleware to enforce storage quota on upload endpoints
 */
async function enforceStorageQuota(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const orgId = req.user?.organizationId || req.user?.organization_id;

        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized - no organization' });
            return;
        }

        const quota = await usageService.checkQuota(orgId, 'storage');

        req.storageQuotaInfo = quota;

        if (!quota.allowed) {
            res.status(429).json({
                error: 'Storage quota exceeded',
                code: 'STORAGE_QUOTA_EXCEEDED',
                usage: {
                    usedGB: (quota.used / (1024 * 1024 * 1024)).toFixed(2),
                    limitGB: (quota.limit / (1024 * 1024 * 1024)).toFixed(2),
                    percentage: quota.percentage
                },
                message: 'Your organization has exceeded the storage limit. Please upgrade your plan or delete unused files.',
                upgradeUrl: '/settings?tab=billing'
            });
            return;
        }

        next();
    } catch (error) {
        console.error('Storage quota check error:', error);
        next();
    }
}

/**
 * Record token usage after AI response
 * Call this AFTER the AI response is sent
 */
async function recordTokenUsageAfterResponse(req: AuthenticatedRequest, res: Response, tokens: number, action: string): Promise<void> {
    try {
        const orgId = req.user?.organizationId || req.user?.organization_id;
        const userId = req.user?.id;

        if (orgId && tokens > 0) {
            await usageService.recordTokenUsage(orgId, userId, tokens, action, {
                endpoint: req.path,
                model: (req.body as Record<string, unknown>)?.model || 'default'
            });
        }
    } catch (error) {
        console.error('Failed to record token usage:', error);
    }
}

/**
 * Record storage usage after file upload
 */
async function recordStorageAfterUpload(req: AuthenticatedRequest, bytes: number, action = 'upload'): Promise<void> {
    try {
        const orgId = req.user?.organization_id;

        if (orgId && bytes > 0) {
            await usageService.recordStorageUsage(orgId, bytes, action, {
                endpoint: req.path,
                filename: req.file?.originalname
            });
        }
    } catch (error) {
        console.error('Failed to record storage usage:', error);
    }
}

export {
    enforceTokenQuota,
    enforceStorageQuota,
    recordTokenUsageAfterResponse,
    recordStorageAfterUpload
};

export default {
    enforceTokenQuota,
    enforceStorageQuota,
    recordTokenUsageAfterResponse,
    recordStorageAfterUpload
};

