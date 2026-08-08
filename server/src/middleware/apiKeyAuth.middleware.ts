/* eslint-disable no-control-regex -- These middleware sanitizers intentionally reject ASCII control characters. */
/**
 * API Key Authentication Middleware
 * Enterprise SaaS Architecture - API Security
 *
 * Authenticates requests using API keys for programmatic access.
 *
 * Usage:
 * - Authorization: Bearer ck_<key>
 * - X-API-Key: ck_<key>
 *
 * Features:
 * - Rate limiting per key
 * - Permission validation
 * - IP whitelist check
 * - Usage tracking
 */

import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

import { API_KEY_PERMISSIONS, ApiKey, ApiKeyService } from '../services/apiKeyService.js';
import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

type ResolvedApiKey = {
  kind: 'org' | 'user';
  id: string;
  organizationId: string;
  userId?: string;
  permissions: string[];
  rateLimit: number;
};

interface ApiKeyRequest extends Request {
  apiKey?: ResolvedApiKey;
  organizationId?: string;
  userId?: string;
}

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
    res.setHeader(name, value);
  } catch {
    // Non-critical: rate-limit headers are best-effort metadata only.
  }
};
const responseWriteBlocked = (res: Response): boolean =>
  safeRead(() => res.headersSent, false) ||
  safeRead(() => (res as Response & { writableEnded?: boolean }).writableEnded, false);
const MIN_API_KEY_CHARS = 12;
const MAX_API_KEY_CHARS = 512;
const MAX_API_KEY_TRANSPORT_SLACK_CHARS = 128;
const MAX_BEARER_AUTHORIZATION_CHARS =
  'Bearer '.length + MAX_API_KEY_CHARS + MAX_API_KEY_TRANSPORT_SLACK_CHARS;
const MAX_X_API_KEY_HEADER_CHARS = MAX_API_KEY_CHARS + MAX_API_KEY_TRANSPORT_SLACK_CHARS;
const DEFAULT_API_KEY_RATE_LIMIT = 60;
const MAX_API_KEY_RATE_LIMIT = 1_000_000;
const API_KEY_ATTEMPT_FINGERPRINT_CHARS = 16;
const MAX_FORWARDED_FOR_SCAN_CHARS = 512;
const API_KEY_UNSAFE_TRANSPORT_CHARS = /[\u0000-\u001F\u007F\s]/;
const isSafeApiKeyTransport = (value: string): boolean =>
  !API_KEY_UNSAFE_TRANSPORT_CHARS.test(value);
const applyNoStoreHeaders = (res: Response): void => {
  safeSetHeader(res, 'Cache-Control', 'no-store');
  safeSetHeader(res, 'Pragma', 'no-cache');
};
const setApiKeyAuthChallengeHeader = (res: Response): void => {
  safeSetHeader(res, 'WWW-Authenticate', 'Bearer realm="consultify-api", error="invalid_token"');
};
const sendApiKeyJsonIfOpen = (
  res: Response,
  statusCode: number,
  body: Record<string, unknown>,
  options?: { noStore?: boolean; withAuthChallenge?: boolean }
): boolean => {
  if (responseWriteBlocked(res)) return false;
  if (options?.noStore) {
    applyNoStoreHeaders(res);
  }
  if (options?.withAuthChallenge) {
    setApiKeyAuthChallengeHeader(res);
  }
  try {
    res.status(statusCode).json(body);
    return true;
  } catch {
    return false;
  }
};
const clampApiKeyRateLimit = (rawLimit: unknown): number => {
  const numeric = typeof rawLimit === 'number' ? rawLimit : Number(rawLimit);
  if (!Number.isFinite(numeric) || numeric < 1) return DEFAULT_API_KEY_RATE_LIMIT;
  return Math.min(Math.trunc(numeric), MAX_API_KEY_RATE_LIMIT);
};

// ==========================================
// RATE LIMITING (In-memory, per-key)
// ==========================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(
  keyId: string,
  limit: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window

  let entry = rateLimitStore.get(keyId);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(keyId, entry);
  }

  entry.count++;
  const remaining = Math.max(0, limit - entry.count);

  return {
    allowed: entry.count <= limit,
    remaining,
    resetAt: entry.resetAt,
  };
}

// Cleanup old entries periodically
const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [keyId, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(keyId);
    }
  }
}, 60 * 1000); // Every minute
rateLimitCleanupTimer.unref?.();

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Authenticate request using API key
 * Extracts key from Authorization header or X-API-Key header
 */
export async function apiKeyAuth(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      sendApiKeyJsonIfOpen(
        res,
        401,
        {
          error: 'API key required',
          message: 'Provide API key via Authorization: Bearer ck_<key> or X-API-Key header.',
          code: 'API_KEY_REQUIRED',
        },
        { noStore: true, withAuthChallenge: true }
      );
      return;
    }
    if (apiKey.length < MIN_API_KEY_CHARS) {
      sendApiKeyJsonIfOpen(
        res,
        401,
        {
          error: 'Invalid API key',
          message: 'The provided API key is invalid, expired, or not authorized for this IP.',
          code: 'API_KEY_INVALID',
        },
        { noStore: true, withAuthChallenge: true }
      );
      return;
    }
    if (apiKey.length > MAX_API_KEY_CHARS) {
      sendApiKeyJsonIfOpen(
        res,
        401,
        {
          error: 'Invalid API key',
          message: 'The provided API key is invalid, expired, or not authorized for this IP.',
          code: 'API_KEY_INVALID',
        },
        { noStore: true, withAuthChallenge: true }
      );
      return;
    }
    if (!isSafeApiKeyTransport(apiKey)) {
      sendApiKeyJsonIfOpen(
        res,
        401,
        {
          error: 'Invalid API key',
          message: 'The provided API key is invalid, expired, or not authorized for this IP.',
          code: 'API_KEY_INVALID',
        },
        { noStore: true, withAuthChallenge: true }
      );
      return;
    }

    // Get client IP
    const ip = getClientIp(req);

    // Validate key (org keys first, then user keys)
    const validatedKey = await resolveApiKey(apiKey, ip);

    if (!validatedKey) {
      logger.warn('[APIKeyAuth] Invalid API key attempt', {
        ip,
        keyFingerprint: apiKeyAttemptFingerprint(apiKey),
      });
      sendApiKeyJsonIfOpen(
        res,
        401,
        {
          error: 'Invalid API key',
          message: 'The provided API key is invalid, expired, or not authorized for this IP.',
          code: 'API_KEY_INVALID',
        },
        { noStore: true, withAuthChallenge: true }
      );
      return;
    }
    if (!isResolvedApiKey(validatedKey)) {
      logger.warn('[APIKeyAuth] Rejected malformed resolved API key', { ip });
      sendApiKeyJsonIfOpen(
        res,
        401,
        {
          error: 'Invalid API key',
          message: 'The provided API key is invalid, expired, or not authorized for this IP.',
          code: 'API_KEY_INVALID',
        },
        { noStore: true, withAuthChallenge: true }
      );
      return;
    }
    const effectiveRateLimit = clampApiKeyRateLimit(validatedKey.rateLimit);

    // Check rate limit
    const rateLimit = checkRateLimit(`${validatedKey.kind}:${validatedKey.id}`, effectiveRateLimit);

    safeSetHeader(res, 'X-RateLimit-Limit', effectiveRateLimit.toString());
    safeSetHeader(res, 'X-RateLimit-Remaining', rateLimit.remaining.toString());
    safeSetHeader(res, 'X-RateLimit-Reset', Math.ceil(rateLimit.resetAt / 1000).toString());

    if (!rateLimit.allowed) {
      const retryAfterSec = Math.max(0, Math.ceil((rateLimit.resetAt - Date.now()) / 1000));
      if (responseWriteBlocked(res)) return;
      applyNoStoreHeaders(res);
      safeSetHeader(res, 'Retry-After', retryAfterSec.toString());
      sendApiKeyJsonIfOpen(
        res,
        429,
        {
          error: 'Rate limit exceeded',
          message: `API key rate limit of ${effectiveRateLimit} requests/minute exceeded.`,
          retryAfter: retryAfterSec,
          code: 'API_KEY_RATE_LIMITED',
        },
        { noStore: true }
      );
      return;
    }

    // Attach to request
    req.apiKey = validatedKey;
    req.organizationId = validatedKey.organizationId;
    req.userId = validatedKey.userId;
    if (responseWriteBlocked(res)) {
      logger.warn('[APIKeyAuth] Response already committed before downstream handlers', { ip });
      return;
    }

    next();
  } catch (error) {
    logger.error('[APIKeyAuth] Authentication error:', error);
    const sent = sendApiKeyJsonIfOpen(
      res,
      500,
      {
        error: 'Authentication error',
        message: 'An unexpected error occurred while validating the API key.',
        code: 'API_KEY_AUTH_INTERNAL_ERROR',
      },
      { noStore: true }
    );
    if (!sent && !responseWriteBlocked(res)) {
      next(error instanceof Error ? error : new Error('API key authentication failed'));
    }
  }
}

/**
 * Require specific API key permission
 */
export function requireApiKeyPermission(permission: string) {
  const normalizedPermission = normalizeOptionalString(permission);
  return (req: ApiKeyRequest, res: Response, next: NextFunction): void => {
    if (responseWriteBlocked(res)) return;
    if (!normalizedPermission) {
      sendApiKeyJsonIfOpen(
        res,
        500,
        {
          error: 'Authentication policy misconfigured',
          message: 'API key permission gate is missing a valid permission identifier.',
          code: 'API_KEY_PERMISSION_CONFIG',
        },
        { noStore: true }
      );
      return;
    }
    if (!req.apiKey) {
      sendApiKeyJsonIfOpen(
        res,
        401,
        {
          error: 'API key authentication required',
          message: 'Authenticate with a valid API key before calling this endpoint.',
          code: 'API_KEY_CONTEXT_MISSING',
        },
        { noStore: true, withAuthChallenge: true }
      );
      return;
    }

    if (!hasPermission(req.apiKey, normalizedPermission)) {
      sendApiKeyJsonIfOpen(
        res,
        403,
        {
          error: 'Permission denied',
          message: `This action requires the '${normalizedPermission}' permission.`,
          code: 'API_KEY_FORBIDDEN',
          yourPermissions: Array.isArray(req.apiKey.permissions) ? req.apiKey.permissions : [],
        },
        { noStore: true }
      );
      return;
    }

    next();
  };
}

/**
 * Optional API key auth - continues if no key provided
 */
export async function optionalApiKeyAuth(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    // No key provided, continue without
    next();
    return;
  }
  if (!isSafeApiKeyTransport(apiKey)) {
    sendApiKeyJsonIfOpen(
      res,
      401,
      {
        error: 'Invalid API key',
        message: 'The provided API key is invalid, expired, or not authorized for this IP.',
        code: 'API_KEY_INVALID',
      },
      { noStore: true, withAuthChallenge: true }
    );
    return;
  }

  // If key provided, validate it
  await apiKeyAuth(req, res, next);
}

/**
 * Combined auth - accepts either JWT or API key
 */
export function hybridAuth(
  jwtMiddleware: (req: Request, res: Response, next: NextFunction) => void | Promise<void>
) {
  return async (req: ApiKeyRequest, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = extractApiKey(req);

    if (apiKey) {
      // Use API key auth
      await apiKeyAuth(req, res, next);
    } else {
      // Fall back to JWT auth
      try {
        await Promise.resolve(jwtMiddleware(req, res, next));
      } catch (error) {
        next(error instanceof Error ? error : new Error('JWT middleware failed'));
      }
    }
  };
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function hasPermission(key: ResolvedApiKey, permission: string): boolean {
  const permissions = Array.isArray(key.permissions) ? key.permissions : [];
  if (permissions.includes(API_KEY_PERMISSIONS.FULL_ACCESS)) return true;
  return permissions.includes(permission);
}

async function resolveApiKey(plainTextKey: string, ip?: string): Promise<ResolvedApiKey | null> {
  const orgKey = await ApiKeyService.validateKey(plainTextKey, ip);
  if (orgKey) {
    return {
      kind: 'org',
      id: orgKey.id,
      organizationId: orgKey.organizationId,
      permissions: orgKey.permissions,
      rateLimit: orgKey.rateLimit,
    };
  }

  return await validateUserApiKey(plainTextKey);
}

type UserApiKeyRow = {
  id: string;
  user_id: string;
  key_hash: string;
  permissions: string | null;
  rate_limit: number | null;
};

function sha256(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

const apiKeyAttemptFingerprint = (raw: string): string =>
  sha256(raw).slice(0, API_KEY_ATTEMPT_FINGERPRINT_CHARS);

const isResolvedApiKey = (value: ResolvedApiKey): boolean => {
  if (!value || typeof value !== 'object') return false;
  if (value.kind !== 'org' && value.kind !== 'user') return false;
  if (!normalizeOptionalString(value.id)) return false;
  if (!normalizeOptionalString(value.organizationId)) return false;
  if (value.kind === 'user' && !normalizeOptionalString(value.userId)) return false;
  if (
    !Array.isArray(value.permissions) ||
    !value.permissions.every((entry) => typeof entry === 'string')
  ) {
    return false;
  }
  return value.rateLimit !== undefined && value.rateLimit !== null;
};

async function validateUserApiKey(plainTextKey: string): Promise<ResolvedApiKey | null> {
  // Backwards-compatible: older rows stored plaintext `ck_...` in `key_hash`.
  const raw = plainTextKey.startsWith('ck_') ? plainTextKey.slice(3) : plainTextKey;
  const hashed = sha256(raw);

  const row = await dbGet<UserApiKeyRow>(
    `SELECT id, user_id, key_hash, permissions, rate_limit
     FROM user_api_keys
     WHERE is_active = 1
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       AND (key_hash = ? OR key_hash = ?)
     LIMIT 1`,
    [hashed, plainTextKey],
    { fallback: false }
  );

  if (!row) return null;

  const orgRow = await dbGet<{ organization_id: string }>(
    `SELECT organization_id FROM users WHERE id = ? LIMIT 1`,
    [row.user_id],
    { fallback: false }
  );
  const organizationId = orgRow?.organization_id;
  if (!organizationId) return null;

  // If legacy plaintext matched, upgrade in place to hashed storage.
  if (row.key_hash === plainTextKey) {
    await dbRun(
      `UPDATE user_api_keys SET key_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [hashed, row.id],
      { fallback: false }
    );
  }

  await dbRun(
    `UPDATE user_api_keys SET last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [row.id],
    { fallback: false }
  );

  let permissions: string[] = [];
  try {
    permissions = row.permissions ? (JSON.parse(row.permissions) as string[]) : [];
  } catch {
    permissions = [];
  }

  return {
    kind: 'user',
    id: row.id,
    organizationId,
    userId: row.user_id,
    permissions,
    rateLimit: Number(row.rate_limit || 1000),
  };
}

/**
 * Extract API key from request
 */
function extractApiKey(req: Request): string | null {
  const normalizeApiKeyCandidate = (value: unknown): string | null => {
    const normalized = normalizeOptionalString(value);
    return normalized?.startsWith('ck_') ? normalized : null;
  };
  const extractBearerToken = (value: string): string | null => {
    const match = /^Bearer\s+/i.exec(value);
    if (!match) return null;
    const bearerToken = normalizeOptionalString(value.slice(match[0].length));
    return normalizeApiKeyCandidate(bearerToken);
  };

  // Check Authorization header (Bearer token)
  const authHeader = safeRead(
    () => req.headers.authorization,
    undefined as string | string[] | undefined
  );
  if (typeof authHeader === 'string' && authHeader.length <= MAX_BEARER_AUTHORIZATION_CHARS) {
    const normalizedBearer = extractBearerToken(authHeader);
    if (normalizedBearer) return normalizedBearer;
  }
  if (Array.isArray(authHeader)) {
    for (const headerValue of authHeader) {
      if (typeof headerValue !== 'string') continue;
      if (headerValue.length > MAX_BEARER_AUTHORIZATION_CHARS) continue;
      const normalizedBearer = extractBearerToken(headerValue);
      if (normalizedBearer) return normalizedBearer;
      const normalizedHeader = normalizeApiKeyCandidate(headerValue);
      if (normalizedHeader) return normalizedHeader;
    }
  }

  // Check X-API-Key header
  const xApiKey = safeRead(() => req.headers['x-api-key'], undefined as unknown);
  if (typeof xApiKey === 'string' && xApiKey.length <= MAX_X_API_KEY_HEADER_CHARS) {
    const normalizedApiKey = normalizeApiKeyCandidate(xApiKey);
    if (normalizedApiKey) {
      return normalizedApiKey;
    }
  }
  if (Array.isArray(xApiKey)) {
    for (const keyCandidate of xApiKey) {
      if (typeof keyCandidate === 'string' && keyCandidate.length > MAX_X_API_KEY_HEADER_CHARS) {
        continue;
      }
      const normalizedApiKey = normalizeApiKeyCandidate(keyCandidate);
      if (normalizedApiKey) return normalizedApiKey;
    }
  }

  // Check query parameter (not recommended, but supported)
  const queryKey = safeRead(() => req.query.api_key, undefined as unknown);
  if (typeof queryKey === 'string' && queryKey.length <= MAX_X_API_KEY_HEADER_CHARS) {
    const normalizedQueryKey = normalizeApiKeyCandidate(queryKey);
    if (normalizedQueryKey) {
      return normalizedQueryKey;
    }
  }
  if (Array.isArray(queryKey)) {
    for (const keyCandidate of queryKey) {
      if (typeof keyCandidate === 'string' && keyCandidate.length > MAX_X_API_KEY_HEADER_CHARS) {
        continue;
      }
      const normalizedQueryKey = normalizeApiKeyCandidate(keyCandidate);
      if (normalizedQueryKey) return normalizedQueryKey;
    }
  }

  return null;
}

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
  const stripIpv4Port = (value: string): string => {
    if (!/^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(value)) return value;
    const [host] = value.split(':');
    return host || value;
  };
  const normalizeClientIp = (value: string): string => {
    const normalized = normalizeOptionalString(value) || '';
    if (!normalized) return '';
    const lower = normalized.toLowerCase();
    const unwrapped = lower.startsWith('::ffff:') ? normalized.slice('::ffff:'.length) : normalized;
    return stripIpv4Port(unwrapped);
  };

  const forwarded = safeRead(() => req.headers['x-forwarded-for'], undefined as unknown);
  const capForwardedScan = (value: string): string =>
    value.length > MAX_FORWARDED_FOR_SCAN_CHARS
      ? value.slice(0, MAX_FORWARDED_FOR_SCAN_CHARS)
      : value;
  if (typeof forwarded === 'string') {
    const candidate = normalizeClientIp(capForwardedScan(forwarded).split(',')[0] || '');
    if (candidate) return candidate;
  }
  if (Array.isArray(forwarded)) {
    for (const forwardedEntry of forwarded) {
      if (typeof forwardedEntry !== 'string') continue;
      const candidate = normalizeClientIp(capForwardedScan(forwardedEntry).split(',')[0] || '');
      if (candidate) return candidate;
    }
  }
  const reqIp = normalizeClientIp(safeRead<string | undefined>(() => req.ip, undefined) || '');
  if (reqIp) return reqIp;
  const socketIp = normalizeClientIp(
    safeRead<string | undefined>(() => req.socket?.remoteAddress, undefined) || ''
  );
  return socketIp || 'unknown';
}

// ==========================================
// EXPORTS
// ==========================================

export { API_KEY_PERMISSIONS, ApiKeyRequest };

export default {
  apiKeyAuth,
  requireApiKeyPermission,
  optionalApiKeyAuth,
  hybridAuth,
};
