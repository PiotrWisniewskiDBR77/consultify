/**
 * Quota Middleware
 * Enforces token and storage quotas before allowing API requests
 */

import usageService from '../services/usageService.js';

const safeRead = (reader, fallback) => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const normalizeOptionalString = (value) => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};
const MAX_METADATA_STRING_CHARS = 256;
const clampMetadataString = (value, fallback = '') => {
  const normalized = normalizeOptionalString(value);
  const source = normalized || fallback;
  if (source.length <= MAX_METADATA_STRING_CHARS) return source;
  return source.slice(0, MAX_METADATA_STRING_CHARS);
};

const readOrgId = (req) =>
  normalizeOptionalString(safeRead(() => req.user?.organizationId, undefined)) ||
  normalizeOptionalString(safeRead(() => req.user?.organization_id, undefined)) ||
  normalizeOptionalString(safeRead(() => req.organizationId, undefined));

const readUserId = (req) =>
  normalizeOptionalString(safeRead(() => req.user?.id, undefined)) ||
  normalizeOptionalString(safeRead(() => req.userId, undefined));

const readPath = (req) =>
  normalizeOptionalString(safeRead(() => req.path, undefined)) ||
  normalizeOptionalString(safeRead(() => req.originalUrl, undefined)) ||
  'unknown';

const readModel = (req) =>
  clampMetadataString(safeRead(() => req.body?.model, undefined), 'default');
const callNext = (next) => {
  if (typeof next === 'function') next();
};

const safeSetHeader = (res, headerName, value) => {
  try {
    if (typeof res.set === 'function') {
      res.set(headerName, value);
      return;
    }
    if (typeof res.setHeader === 'function') {
      res.setHeader(headerName, value);
    }
  } catch {
    // best effort only
  }
};

const sendJsonIfHeadersOpen = (res, statusCode, payload) => {
  if (safeRead(() => res.headersSent, false)) return false;
  try {
    if (typeof res.status !== 'function') return false;
    const chain = res.status(statusCode);
    if (!chain || typeof chain.json !== 'function') return false;
    chain.json(payload);
    return true;
  } catch {
    return false;
  }
};
const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};
const normalizeQuotaCheck = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      allowed: true,
      used: 0,
      limit: 0,
      remaining: 0,
      percentage: 0,
      overageEnabled: false,
      overageRate: undefined,
    };
  }
  return {
    ...raw,
    allowed: raw.allowed === true,
    used: toFiniteNumber(raw.used),
    limit: toFiniteNumber(raw.limit),
    remaining: toFiniteNumber(raw.remaining),
    percentage: toFiniteNumber(raw.percentage),
  };
};

/**
 * Middleware to enforce token quota on AI endpoints
 */
async function enforceTokenQuota(req, res, next) {
  try {
    const orgId = readOrgId(req);

    if (!orgId) {
      if (!sendJsonIfHeadersOpen(res, 401, { error: 'Unauthorized - no organization' })) {
        callNext(next);
      }
      return;
    }

    const quota = normalizeQuotaCheck(await usageService.checkQuota(orgId, 'token'));

    // Attach quota info to request for later use
    req.quotaInfo = quota;

    if (!quota.allowed) {
      if (
        !sendJsonIfHeadersOpen(res, 429, {
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
      })
      ) {
        callNext(next);
      }
      return;
    }

    // Warn if approaching limit (>80%)
    if (quota.percentage >= 80 && quota.percentage < 100) {
      safeSetHeader(res, 'X-Quota-Warning', 'true');
      safeSetHeader(res, 'X-Quota-Percentage', quota.percentage.toString());
    }

    callNext(next);
  } catch (error) {
    console.error('Quota check error:', error);
    // Allow request to proceed on quota check failure (fail open)
    callNext(next);
  }
}

/**
 * Middleware to enforce storage quota on upload endpoints
 */
async function enforceStorageQuota(req, res, next) {
  try {
    const orgId = readOrgId(req);

    if (!orgId) {
      if (!sendJsonIfHeadersOpen(res, 401, { error: 'Unauthorized - no organization' })) {
        callNext(next);
      }
      return;
    }

    const quota = normalizeQuotaCheck(await usageService.checkQuota(orgId, 'storage'));

    req.storageQuotaInfo = quota;

    if (!quota.allowed) {
      if (
        !sendJsonIfHeadersOpen(res, 429, {
        error: 'Storage quota exceeded',
        code: 'STORAGE_QUOTA_EXCEEDED',
        usage: {
          usedGB: (quota.used / (1024 * 1024 * 1024)).toFixed(2),
          limitGB: (quota.limit / (1024 * 1024 * 1024)).toFixed(2),
          percentage: quota.percentage,
        },
        message:
          'Your organization has exceeded the storage limit. Please upgrade your plan or delete unused files.',
        upgradeUrl: '/settings?tab=billing',
      })
      ) {
        callNext(next);
      }
      return;
    }

    callNext(next);
  } catch (error) {
    console.error('Storage quota check error:', error);
    callNext(next);
  }
}

/**
 * Record token usage after AI response
 * Call this AFTER the AI response is sent
 */
async function recordTokenUsageAfterResponse(req, res, tokens, action) {
  try {
    const orgId = readOrgId(req);
    const userId = readUserId(req);
    const tokenCount = Number(tokens);

    if (orgId && Number.isFinite(tokenCount) && tokenCount > 0) {
      await usageService.recordTokenUsage(orgId, userId, tokenCount, action, {
        endpoint: readPath(req),
        model: readModel(req),
      });
    }
  } catch (error) {
    console.error('Failed to record token usage:', error);
  }
}

/**
 * Record storage usage after file upload
 */
async function recordStorageAfterUpload(req, bytes, action = 'upload') {
  try {
    const orgId = readOrgId(req);
    const byteCount = Number(bytes);

    if (orgId && Number.isFinite(byteCount) && byteCount > 0) {
      await usageService.recordStorageUsage(orgId, byteCount, action, {
        endpoint: readPath(req),
        filename: clampMetadataString(safeRead(() => req.file?.originalname, undefined), ''),
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
  recordStorageAfterUpload,
};

export default {
  enforceTokenQuota,
  enforceStorageQuota,
  recordTokenUsageAfterResponse,
  recordStorageAfterUpload,
};
