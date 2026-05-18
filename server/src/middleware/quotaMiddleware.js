/**
 * Quota Middleware
 * Enforces token and storage quotas before allowing API requests
 */

import usageService from '../services/usageService.js';
import logger from '../utils/Logger.js';

const MAX_METADATA_LEN = 256;

const safeRead = (reader, fallback) => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const safeNext = (next) => {
  if (typeof next === 'function') {
    next();
  }
};

const safeResponder = (res, next, statusCode, payload) => {
  const headersSent = safeRead(() => res?.headersSent === true, false);
  if (headersSent) {
    safeNext(next);
    return false;
  }
  try {
    const statusFn = safeRead(() => res?.status, undefined);
    if (typeof statusFn !== 'function') {
      safeNext(next);
      return false;
    }
    const target = statusFn.call(res, statusCode);
    const jsonFn = safeRead(() => target?.json || res?.json, undefined);
    if (typeof jsonFn !== 'function') {
      safeNext(next);
      return false;
    }
    jsonFn.call(target || res, payload);
    return true;
  } catch {
    safeNext(next);
    return false;
  }
};

const normalizeOrgId = (req) => {
  const userOrg =
    safeRead(() => req?.user?.organizationId, '') || safeRead(() => req?.user?.organization_id, '');
  const requestOrg = safeRead(() => req?.organizationId, '');
  const orgId = String(userOrg || requestOrg || '').trim();
  return orgId || null;
};

const normalizeUserId = (req) => {
  const userId = safeRead(() => req?.user?.id, '') || safeRead(() => req?.userId, '');
  const normalized = String(userId || '').trim();
  return normalized || undefined;
};

const normalizeBounded = (value, fallback = '') => {
  const normalized = String(value || fallback).trim();
  return normalized.slice(0, MAX_METADATA_LEN);
};

/**
 * Middleware to enforce token quota on AI endpoints
 */
async function enforceTokenQuota(req, res, next) {
  try {
    const orgId = normalizeOrgId(req);

    if (!orgId) {
      safeResponder(res, next, 401, { error: 'Unauthorized - no organization' });
      return;
    }

    const quota = await usageService.checkQuota(orgId, 'token');

    // Attach quota info to request for later use
    req.quotaInfo = quota;

    if (!quota.allowed) {
      safeResponder(res, next, 429, {
        error: 'Token quota exceeded',
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

    // Warn if approaching limit (>80%)
    if (quota.percentage >= 80 && quota.percentage < 100) {
      try {
        if (typeof res?.set === 'function') {
          res.set('X-Quota-Warning', 'true');
          res.set('X-Quota-Percentage', quota.percentage.toString());
        }
      } catch {
        // best-effort only
      }
    }

    safeNext(next);
  } catch (error) {
    logger.error('Quota check error:', error);
    // Allow request to proceed on quota check failure (fail open)
    safeNext(next);
  }
}

/**
 * Middleware to enforce storage quota on upload endpoints
 */
async function enforceStorageQuota(req, res, next) {
  try {
    const orgId = normalizeOrgId(req);

    if (!orgId) {
      safeResponder(res, next, 401, { error: 'Unauthorized - no organization' });
      return;
    }

    const quota = await usageService.checkQuota(orgId, 'storage');

    req.storageQuotaInfo =
      quota && typeof quota === 'object'
        ? quota
        : { allowed: true, used: 0, limit: 0, percentage: 0 };

    if (req.storageQuotaInfo.allowed === false) {
      safeResponder(res, next, 429, {
        error: 'Storage quota exceeded',
        code: 'STORAGE_QUOTA_EXCEEDED',
        usage: {
          usedGB: (Number(req.storageQuotaInfo.used || 0) / (1024 * 1024 * 1024)).toFixed(2),
          limitGB: (Number(req.storageQuotaInfo.limit || 0) / (1024 * 1024 * 1024)).toFixed(2),
          percentage: Number(req.storageQuotaInfo.percentage || 0),
        },
        message:
          'Your organization has exceeded the storage limit. Please upgrade your plan or delete unused files.',
        upgradeUrl: '/settings?tab=billing',
      });
      return;
    }

    safeNext(next);
  } catch (error) {
    logger.error('Storage quota check error:', error);
    safeNext(next);
  }
}

/**
 * Record token usage after AI response
 * Call this AFTER the AI response is sent
 */
async function recordTokenUsageAfterResponse(req, res, tokens, action) {
  try {
    const orgId = normalizeOrgId(req);
    const userId = normalizeUserId(req);

    if (orgId && Number.isFinite(tokens) && tokens > 0) {
      await usageService.recordTokenUsage(orgId, userId, tokens, action, {
        endpoint: normalizeBounded(safeRead(() => req.path, ''), 'unknown') || 'unknown',
        model: normalizeBounded(safeRead(() => req.body?.model, ''), 'default') || 'default',
      });
    }
  } catch (error) {
    logger.error('Failed to record token usage:', error);
  }
}

/**
 * Record storage usage after file upload
 */
async function recordStorageAfterUpload(req, bytes, action = 'upload') {
  try {
    const orgId = normalizeOrgId(req);

    if (orgId && Number.isFinite(bytes) && bytes > 0) {
      await usageService.recordStorageUsage(orgId, bytes, action, {
        endpoint: normalizeBounded(safeRead(() => req.path, ''), 'unknown') || 'unknown',
        filename: normalizeBounded(safeRead(() => req.file?.originalname, ''), ''),
      });
    }
  } catch (error) {
    logger.error('Failed to record storage usage:', error);
  }
}

export {
  enforceTokenQuota,
  enforceStorageQuota,
  recordTokenUsageAfterResponse,
  recordStorageAfterUpload,
};

export default {
  enforceTokenQuota,
  enforceStorageQuota,
  recordTokenUsageAfterResponse,
  recordStorageAfterUpload,
};
