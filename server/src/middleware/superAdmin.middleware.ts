/* eslint-disable no-control-regex -- These middleware sanitizers intentionally reject ASCII control characters. */
/**
 * Super Admin Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Verifies user has SUPERADMIN privileges.
 * Checks both token and database for role verification.
 */

import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { VerifyOptions } from 'jsonwebtoken';

import config from '../config/Config.js';
import { get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface JWTPayload {
  id: string;
  role?: string;
  organizationId?: string;
  organization_id?: string;
  superadminCapabilities?: string[];
}

// Database interface no longer needed - using DbPromise directly

interface UserRow {
  role?: string;
}

interface Dependencies {
  jwt: typeof jwt;
  config: { JWT_SECRET: string; JWT_ISSUER?: string; JWT_AUDIENCE?: string };
  dbGet: <T>(sql: string, params?: any[]) => Promise<T | undefined>;
}

export const SUPERADMIN_CAPABILITIES = [
  'platform_ops',
  'security_ops',
  'billing_ops',
  'support_ops',
  'ai_ops',
] as const;

export type SuperAdminCapability = (typeof SUPERADMIN_CAPABILITIES)[number];
const MAX_SUPERADMIN_JWT_CHARS = 8192;
const MAX_SUPERADMIN_SUBJECT_ID_CHARS = 256;
const MAX_SUPERADMIN_ORGANIZATION_ID_CHARS = 256;
const MAX_SUPERADMIN_ROLE_CLAIM_CHARS = 128;
const MAX_SUPERADMIN_CAPABILITY_RAW_ARRAY_ENTRIES = 8192;
const MAX_SUPERADMIN_CAPABILITY_CLAIM_ENTRIES = 64;
const MAX_SUPERADMIN_JWT_SEGMENT_CHARS = 6144;
const MAX_SUPERADMIN_AUTHORIZATION_HEADER_VALUES = 32;
const SUPERADMIN_JWS_COMPACT_TOKEN_PATTERN = /^[A-Za-z0-9._-]+$/;
const SUPERADMIN_TOKEN_CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const SUPERADMIN_TOKEN_DISALLOWED_UNICODE = /[\u2028\u2029\uFEFF]/;
const SUPERADMIN_JWT_VERIFY_OPTIONS: VerifyOptions = {
  algorithms: ['HS256'],
  clockTolerance: 30,
};
const isSuperAdminCompactJwtShape = (value: string): boolean => {
  const segments = value.split('.');
  if (segments.length !== 3) return false;
  return segments.every(
    (segment) => segment.length > 0 && segment.length <= MAX_SUPERADMIN_JWT_SEGMENT_CHARS
  );
};

const normalizeSuperAdminRole = (role?: string): string => {
  const normalized = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  // Supported aliases: SUPERADMIN, SUPER_ADMIN, superadmin, super_admin.
  if (normalized === 'superadmin' || normalized === 'super_admin' || normalized === 'super-admin') {
    return 'superadmin';
  }

  return normalized;
};

const normalizeCapability = (capability?: string): SuperAdminCapability | null => {
  const normalized = String(capability || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_') as SuperAdminCapability;
  return SUPERADMIN_CAPABILITIES.includes(normalized) ? normalized : null;
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const readClaimValue = (
  payload: Record<string, unknown> | null | undefined,
  claimKey: string
): unknown => {
  if (!payload) return undefined;
  try {
    return payload[claimKey];
  } catch {
    return undefined;
  }
};

const readOptionalStringClaim = (
  payload: Record<string, unknown> | null | undefined,
  claimKey: string
): string | undefined => normalizeOptionalString(readClaimValue(payload, claimKey));

const readOptionalStringArrayClaim = (
  payload: Record<string, unknown> | null | undefined,
  claimKey: string
): string[] | undefined => {
  const value = readClaimValue(payload, claimKey);
  if (!Array.isArray(value)) return undefined;
  return value
    .slice(0, MAX_SUPERADMIN_CAPABILITY_RAW_ARRAY_ENTRIES)
    .filter((entry): entry is string => typeof entry === 'string');
};

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const safeWrite = (writer: () => void): boolean => {
  try {
    writer();
    return true;
  } catch {
    return false;
  }
};
const containsUnsafeSuperAdminIdentifierChars = (value: string): boolean =>
  SUPERADMIN_TOKEN_CONTROL_CHARS.test(value) || SUPERADMIN_TOKEN_DISALLOWED_UNICODE.test(value);

export const getSuperAdminCapabilities = (
  role?: string,
  explicitCapabilities?: string[]
): SuperAdminCapability[] => {
  const normalizedRole = normalizeSuperAdminRole(role);
  const hasExplicitCapabilityOverride =
    Array.isArray(explicitCapabilities) && explicitCapabilities.length > 0;
  const normalizedExplicit = Array.isArray(explicitCapabilities)
    ? explicitCapabilities.map(normalizeCapability).filter(Boolean)
    : [];

  // Honor explicit capability subsets when they contain at least one valid capability.
  // Empty or malformed capability arrays should not accidentally strip a real superadmin
  // down to zero access.
  if (hasExplicitCapabilityOverride && normalizedExplicit.length > 0) {
    return Array.from(new Set(normalizedExplicit)) as SuperAdminCapability[];
  }

  if (normalizedRole === 'superadmin') {
    return [...SUPERADMIN_CAPABILITIES];
  }

  return [];
};

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies = {
  jwt,
  config,
  dbGet,
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Verify Super Admin - Checks token and database for SUPERADMIN role
 */
export const verifySuperAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { jwt: jwtLib, config: depsConfig, dbGet: db } = deps;
  const jwtSecret = normalizeOptionalString(depsConfig.JWT_SECRET);
  const jwtIssuer = normalizeOptionalString(depsConfig.JWT_ISSUER);
  const jwtAudience = normalizeOptionalString(depsConfig.JWT_AUDIENCE);
  if (!jwtSecret) {
    logger.error('[SuperAdmin Middleware] JWT_SECRET is not configured');
    res.status(500).json({
      error: 'Authentication configuration unavailable',
      code: 'AUTH_CONFIGURATION',
      guidance: 'Contact platform support and retry after configuration is restored.',
    });
    return;
  }

  let token: unknown;
  try {
    token = req.headers?.['authorization'];
  } catch {
    token = undefined;
  }

  if (!token) {
    res.status(401).json({
      error: 'Authorization token required',
      code: 'UNAUTHORIZED',
      guidance: 'Sign in with a platform superadmin account and retry.',
    });
    return;
  }

  const parseAuthorizationToken = (raw: unknown): string | undefined => {
    if (typeof raw !== 'string') return undefined;
    const normalized = normalizeOptionalString(raw);
    if (!normalized) return undefined;
    if (normalized.startsWith('Bearer ')) {
      return normalizeOptionalString(normalized.slice(7));
    }
    return undefined;
  };

  if (Array.isArray(token) && token.length > MAX_SUPERADMIN_AUTHORIZATION_HEADER_VALUES) {
    res.status(401).json({
      error: 'Authorization token required',
      code: 'UNAUTHORIZED',
      guidance: 'Sign in with a platform superadmin account and retry.',
    });
    return;
  }

  const cleanToken =
    typeof token === 'string'
      ? parseAuthorizationToken(token) || ''
      : Array.isArray(token)
        ? token
            .map(parseAuthorizationToken)
            .find((candidate): candidate is string => Boolean(candidate)) || ''
        : '';

  if (!cleanToken) {
    res.status(401).json({
      error: 'Authorization token required',
      code: 'UNAUTHORIZED',
      guidance: 'Sign in with a platform superadmin account and retry.',
    });
    return;
  }
  if (cleanToken.length > MAX_SUPERADMIN_JWT_CHARS) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
      guidance: 'Refresh your session and retry.',
    });
    return;
  }
  if (
    SUPERADMIN_TOKEN_CONTROL_CHARS.test(cleanToken) ||
    SUPERADMIN_TOKEN_DISALLOWED_UNICODE.test(cleanToken)
  ) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
      guidance: 'Refresh your session and retry.',
    });
    return;
  }
  if (!SUPERADMIN_JWS_COMPACT_TOKEN_PATTERN.test(cleanToken)) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
      guidance: 'Refresh your session and retry.',
    });
    return;
  }
  if (!isSuperAdminCompactJwtShape(cleanToken)) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
      guidance: 'Refresh your session and retry.',
    });
    return;
  }

  try {
    const verifyOptions: VerifyOptions = {
      ...SUPERADMIN_JWT_VERIFY_OPTIONS,
      ...(jwtIssuer ? { issuer: jwtIssuer } : {}),
      ...(jwtAudience ? { audience: jwtAudience } : {}),
    };
    const decoded = await new Promise<JWTPayload>((resolve, reject) => {
      jwtLib.verify(cleanToken, jwtSecret, verifyOptions, (err: any, decoded: any) => {
        if (err) return reject(err);
        resolve(decoded as JWTPayload);
      });
    });
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        guidance: 'Refresh your session and retry.',
      });
      return;
    }
    const decodedClaims = decoded as unknown as Record<string, unknown>;
    const decodedUserId = readOptionalStringClaim(decodedClaims, 'id');
    if (!decodedUserId) {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        guidance: 'Refresh your session and retry.',
      });
      return;
    }
    if (decodedUserId.length > MAX_SUPERADMIN_SUBJECT_ID_CHARS) {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        guidance: 'Refresh your session and retry.',
      });
      return;
    }
    if (containsUnsafeSuperAdminIdentifierChars(decodedUserId)) {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        guidance: 'Refresh your session and retry.',
      });
      return;
    }
    const decodedJwtSub = readOptionalStringClaim(decodedClaims, 'sub');
    if (decodedJwtSub) {
      if (decodedJwtSub.length > MAX_SUPERADMIN_SUBJECT_ID_CHARS) {
        res.status(401).json({
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
          guidance: 'Refresh your session and retry.',
        });
        return;
      }
      if (decodedJwtSub !== decodedUserId) {
        res.status(401).json({
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
          guidance: 'Refresh your session and retry.',
        });
        return;
      }
    }
    const tokenRole = readOptionalStringClaim(decodedClaims, 'role');
    if (tokenRole && tokenRole.length > MAX_SUPERADMIN_ROLE_CLAIM_CHARS) {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        guidance: 'Refresh your session and retry.',
      });
      return;
    }
    const tokenOrganizationId =
      readOptionalStringClaim(decodedClaims, 'organizationId') ||
      readOptionalStringClaim(decodedClaims, 'organization_id') ||
      '';
    if (tokenOrganizationId.length > MAX_SUPERADMIN_ORGANIZATION_ID_CHARS) {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        guidance: 'Refresh your session and retry.',
      });
      return;
    }
    if (tokenOrganizationId && containsUnsafeSuperAdminIdentifierChars(tokenOrganizationId)) {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        guidance: 'Refresh your session and retry.',
      });
      return;
    }
    const tokenSuperadminCapabilities = (
      readOptionalStringArrayClaim(decodedClaims, 'superadminCapabilities') || []
    )
      .slice(0, MAX_SUPERADMIN_CAPABILITY_RAW_ARRAY_ENTRIES)
      .slice(0, MAX_SUPERADMIN_CAPABILITY_CLAIM_ENTRIES);

    // Check role from token first, but ALWAYS verify against DB to prevent stale privilege tokens.
    let userRole = tokenRole;

    let dbRole: string | undefined;
    try {
      const user = await db<UserRow>('SELECT role FROM users WHERE id = ?', [decodedUserId]);
      dbRole = normalizeOptionalString(user?.role);
    } catch (dbError) {
      logger.error('[SuperAdmin Middleware] Database check error:', dbError);
      res.status(403).json({
        error: 'Requires Super Admin privileges',
        code: 'INSUFFICIENT_PLATFORM_ROLE',
        guidance: 'Use a platform superadmin session to access this control plane.',
      });
      return;
    }

    // Enforce DB role as source of truth for superadmin elevation.
    const effectiveRole = dbRole;

    if (normalizeSuperAdminRole(effectiveRole) !== 'superadmin') {
      logger.info(`[SuperAdmin Middleware] Access Denied. Role: ${effectiveRole}`);
      res.status(403).json({
        error: 'Requires Super Admin privileges',
        code: 'INSUFFICIENT_PLATFORM_ROLE',
        guidance: 'Use a platform superadmin session to access this control plane.',
      });
      return;
    }

    userRole = effectiveRole;

    // Attach super admin status to request (fail-closed if request mutators/accessors throw)
    const normalizedRequestRole =
      normalizeSuperAdminRole(userRole) === 'superadmin' ? 'SUPERADMIN' : (userRole as any);
    const capabilities = getSuperAdminCapabilities(userRole, tokenSuperadminCapabilities);
    const existingUser = safeRead(() => req.user, undefined as AuthRequest['user']);

    if (existingUser) {
      const updatedInPlace =
        safeWrite(() => {
          existingUser.isSuperAdmin = true;
        }) &&
        safeWrite(() => {
          existingUser.role = normalizedRequestRole;
        }) &&
        safeWrite(() => {
          existingUser.organizationId = tokenOrganizationId;
        }) &&
        safeWrite(() => {
          existingUser.superadminCapabilities = capabilities;
        });
      if (!updatedInPlace) {
        res.status(401).json({
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
          guidance: 'Refresh your session and retry.',
        });
        return;
      }
    } else {
      const assigned = safeWrite(() => {
        req.user = {
          id: decodedUserId,
          email: '',
          name: '',
          role: normalizedRequestRole,
          organizationId: tokenOrganizationId,
          isSuperAdmin: true,
          superadminCapabilities: capabilities,
        };
      });
      if (!assigned) {
        res.status(401).json({
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
          guidance: 'Refresh your session and retry.',
        });
        return;
      }
    }
    const contextAssigned =
      safeWrite(() => {
        req.userId = decodedUserId;
      }) &&
      safeWrite(() => {
        req.userRole = userRole;
      }) &&
      safeWrite(() => {
        req.organizationId = tokenOrganizationId;
      });
    if (!contextAssigned) {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        guidance: 'Refresh your session and retry.',
      });
      return;
    }

    next();
  } catch (err: any) {
    const errorName =
      err && typeof err === 'object' && 'name' in err
        ? String((err as { name?: unknown }).name)
        : 'UnknownError';
    logger.warn('[SuperAdmin Middleware] JWT verification failed', {
      code: 'SUPERADMIN_JWT_VERIFY_FAILED',
      errorName,
    });
    res.status(401).json({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
      guidance: 'Refresh your session and retry.',
    });
  }
};

export const requireSuperAdminCapability =
  (...requiredCapabilities: SuperAdminCapability[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (requiredCapabilities.length === 0) {
      logger.error(
        '[SuperAdmin Middleware] requireSuperAdminCapability invoked with empty capability list'
      );
      res.status(500).json({
        error: 'Authentication policy misconfigured',
        code: 'SUPERADMIN_CAPABILITY_GATE_MISCONFIGURED',
        guidance: 'Contact platform support and retry after the policy is corrected.',
      });
      return;
    }
    const knownCapabilities = new Set<string>(SUPERADMIN_CAPABILITIES);
    const unknownCapabilities = requiredCapabilities.filter(
      (capability) => !knownCapabilities.has(capability)
    );
    if (unknownCapabilities.length > 0) {
      logger.error(
        '[SuperAdmin Middleware] requireSuperAdminCapability invoked with unknown capabilities',
        {
          code: 'SUPERADMIN_CAPABILITY_GATE_MISCONFIGURED',
          unknownCapabilities,
        }
      );
      res.status(500).json({
        error: 'Authentication policy misconfigured',
        code: 'SUPERADMIN_CAPABILITY_GATE_MISCONFIGURED',
        guidance: 'Contact platform support and retry after the policy is corrected.',
      });
      return;
    }
    if (!safeRead(() => req.user?.isSuperAdmin === true, false)) {
      res.status(403).json({
        error: 'Requires platform superadmin authentication context',
        code: 'SUPERADMIN_CONTEXT_REQUIRED',
        guidance: 'Complete superadmin authentication before accessing capability-gated routes.',
      });
      return;
    }
    const granted = new Set(
      getSuperAdminCapabilities(
        normalizeOptionalString(safeRead(() => req.userRole, undefined)) ||
          normalizeOptionalString(safeRead(() => req.user?.role, undefined)),
        safeRead(() => req.user?.superadminCapabilities, undefined) || []
      )
    );

    const hasCapability = requiredCapabilities.some((capability) => granted.has(capability));
    if (hasCapability) {
      next();
      return;
    }

    res.status(403).json({
      error: 'Requires additional platform capability',
      code: 'INSUFFICIENT_PLATFORM_CAPABILITY',
      guidance: `Use a privileged session with one of: ${requiredCapabilities.join(', ')}.`,
      requiredCapabilities,
      grantedCapabilities: Array.from(granted),
    });
  };

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
  deps = { ...deps, ...newDeps };
};
