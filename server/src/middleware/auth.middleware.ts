/**
 * Authentication Middleware
 * Enterprise SaaS Architecture - TypeScript Backend Auth
 */

import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { AuthenticatedRequest, AuthenticatedUser as GlobalUser, UserRole } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import { normalizeApplicationRole, normalizePlatformRole } from '../utils/roleNormalization.js';
import { DEMO_SESSION_ORG_HEADER } from './demoGuard.middleware.js';

// Used by security integrity gate and to ensure test bypasses never run in prod.
const isProductionEnv = process.env.NODE_ENV === 'production';

const getForcedSuperAdminEmails = (): Set<string> => {
  const raw = String(process.env.FORCE_SUPERADMIN_EMAILS || '');
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
};

type UserSessionCompatibility = {
  activityColumn: 'last_activity_at' | 'last_active_at' | 'created_at';
  hasIsActive: boolean;
};

let userSessionCompatibilityPromise: Promise<UserSessionCompatibility> | null = null;

async function getUserSessionCompatibility(): Promise<UserSessionCompatibility> {
  if (!userSessionCompatibilityPromise) {
    userSessionCompatibilityPromise = getTableColumns('user_sessions')
      .then((columns) => {
        const activityColumn: UserSessionCompatibility['activityColumn'] = columns.has(
          'last_activity_at'
        )
          ? 'last_activity_at'
          : columns.has('last_active_at')
            ? 'last_active_at'
            : 'created_at';

        return {
          activityColumn,
          hasIsActive: columns.has('is_active'),
        };
      })
      .catch(() => ({
        activityColumn: 'created_at',
        hasIsActive: false,
      }));
  }

  return await userSessionCompatibilityPromise;
}

// ==========================================
// TYPES
// ==========================================

export interface JWTPayload {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  userRole?: string;
  organizationId?: string;
  organization_id?: string;
  isSuperAdmin?: boolean;
  /** DEMO org users — used when X-Demo-Mode is dropped (e.g. strict CORS preflight). */
  isDemo?: boolean;
  impersonatorId?: string;
  impersonator_id?: string;
  impersonationSessionId?: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser extends GlobalUser {
  isDemo?: boolean;
  impersonatorId?: string;
  impersonationSessionId?: string;
}

export interface AuthRequest extends AuthenticatedRequest {
  userId?: string;
  userRole?: string;
  organizationId?: string;
  user?: AuthenticatedUser;
  isDemo?: boolean;
  can?: (capability: string) => boolean;
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

interface Dependencies {
  jwt: typeof jwt;
  config: { JWT_SECRET: string } | { JWT_SECRET?: string } | any;
  PermissionService: any; // PermissionService has many methods, we only use 'can'
  dbGet: <T>(sql: string, params?: any[]) => Promise<T | undefined>;
}

let deps: Dependencies;

// Lazy initialization to avoid circular dependencies
const getDeps = async (): Promise<Dependencies> => {
  if (!deps) {
    const defaultJwt = await import('jsonwebtoken').then((m) => m.default || m);
    const configModule = await import('../config/Config.js');
    const defaultConfig = configModule.config || configModule.default || configModule;
    const defaultPermissionService = await import('../services/permissionService.js').then(
      (m) => m.default || m
    );

    deps = {
      jwt: defaultJwt,
      config: defaultConfig,
      PermissionService: defaultPermissionService,
      dbGet: dbGet,
    };
  }
  return deps;
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Extract token from request
 */
const extractToken = (req: AuthRequest): string | null => {
  const authHeader = req.headers['authorization'];

  // Try Authorization header first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  if (authHeader) {
    return authHeader;
  }

  // Try cookie (common browser auth)
  // NOTE: cookie-parser (or compatible) should populate `req.cookies`.
  // This gate is enforced by scripts/security/verify-security-integrity.ts
  const cookieToken = (req as any).cookies?.access_token || (req as any).cookies?.token;
  if (typeof cookieToken === 'string' && cookieToken.length > 0) return cookieToken;

  // Try body or query (legacy support)
  const bodyToken = req.body?.token;
  if (bodyToken) return bodyToken;

  const queryToken = req.query?.token;
  if (typeof queryToken === 'string') return queryToken;

  return null;
};

/**
 * Map legacy role strings to standardized UserRole enum
 */
const mapRole = (role?: string): UserRole => {
  if (!role) return 'team_member';
  const platformRole = normalizePlatformRole(role);
  if (platformRole === 'SUPERADMIN') return 'superadmin';

  const applicationRole = normalizeApplicationRole(role);
  if (applicationRole === 'OWNER') return 'owner';
  if (applicationRole === 'ADMIN') return 'administrator';
  if (applicationRole === 'GUEST') return 'guest';
  return 'team_member';
};

const normalizePermissionRole = (role?: string): string => {
  if (!role) return 'VIEWER';
  const r = role.toString().trim().toUpperCase();
  switch (r) {
    case 'SUPER_ADMIN':
    case 'SUPERADMIN':
      return 'SUPERADMIN';
    case 'OWNER':
      return 'OWNER';
    case 'ADMINISTRATOR':
    case 'ADMIN':
      return 'ADMIN';
    case 'PROJECT_MANAGER':
    case 'MANAGER':
      return 'PROJECT_MANAGER';
    case 'TEAM_MEMBER':
    case 'MEMBER':
    case 'USER':
      return 'USER';
    case 'VIEWER':
    case 'GUEST':
    case 'CLIENT':
      return 'VIEWER';
    default:
      return r;
  }
};

const splitDisplayName = (name?: string): { firstName?: string; lastName?: string } => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return {};
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: firstName || undefined,
    lastName: rest.length > 0 ? rest.join(' ') : undefined,
  };
};

const READ_ONLY_IMPERSONATION_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const READ_ONLY_IMPERSONATION_PATHS = new Set([
  '/api/auth/revert-impersonation',
  '/api/auth/logout',
]);

/**
 * Attach user data to request
 */
const attachUser = async (
  decoded: JWTPayload,
  req: AuthRequest,
  next: NextFunction,
  res?: Response
): Promise<void> => {
  const { PermissionService, dbGet } = await getDeps();
  const requestedDemoSessionOrgId = String(req.get?.(DEMO_SESSION_ORG_HEADER) || '').trim();
  const isDemoHeader = String(req.get?.('X-Demo-Mode') || '').toLowerCase() === 'true';
  const requestedOrgContextId = String(
    req.get?.('x-org-context') || req.get?.('x-organization-id') || ''
  ).trim();
  let resolvedOrganizationId =
    isDemoHeader && requestedDemoSessionOrgId
      ? requestedDemoSessionOrgId
      : decoded.organizationId || (decoded as any).organization_id;
  let resolvedUserRole = decoded.role || decoded.userRole;

  // Respect the UI-selected organization when the user is a valid active member.
  if (!isDemoHeader && requestedOrgContextId) {
    try {
      const membership = await dbGet<{ role?: string; status?: string }>(
        `SELECT role, status
         FROM organization_members
         WHERE user_id = ? AND organization_id = ?
         LIMIT 1`,
        [decoded.id, requestedOrgContextId]
      );
      if (membership && String(membership.status || '').toUpperCase() === 'ACTIVE') {
        resolvedOrganizationId = requestedOrgContextId;
        if (membership.role) {
          resolvedUserRole = normalizeApplicationRole(membership.role);
        }
      }
    } catch {
      // Fall back to the token organization if membership lookup is unavailable.
    }
  }

  req.userId = decoded.id;
  req.userRole = resolvedUserRole;
  req.organizationId = resolvedOrganizationId;

  // Permanent role fix for selected internal accounts:
  // even if a stale token says ADMIN, treat them as SUPERADMIN for authorization.
  try {
    const normalizedEmail = String(decoded.email || '')
      .trim()
      .toLowerCase();
    const forcedEmails = getForcedSuperAdminEmails();
    if (!isProductionEnv && normalizedEmail && forcedEmails.has(normalizedEmail)) {
      req.userRole = 'SUPERADMIN';
      decoded.isSuperAdmin = true;
    }
  } catch {
    // ignore
  }

  if (!normalizePlatformRole(req.userRole)) {
    req.userRole = normalizeApplicationRole(req.userRole);
  }

  const user: AuthenticatedUser = {
    id: decoded.id,
    email: decoded.email || '',
    name: decoded.name || 'User',
    ...splitDisplayName(decoded.name || 'User'),
    role: mapRole(req.userRole),
    organizationId: req.organizationId || '',
    isSuperAdmin: decoded.isSuperAdmin || false,
    isDemo: Boolean(decoded.isDemo) || isDemoHeader,
    impersonatorId: decoded.impersonatorId || decoded.impersonator_id,
    impersonationSessionId: decoded.impersonationSessionId,
  };

  req.user = user;

  const isImpersonating = Boolean(user.impersonatorId);
  const isReadOnlyMethod = READ_ONLY_IMPERSONATION_METHODS.has(
    String(req.method || '').toUpperCase()
  );
  const isAllowedImpersonationWrite = READ_ONLY_IMPERSONATION_PATHS.has(req.path);
  if (isImpersonating && !isReadOnlyMethod && !isAllowedImpersonationWrite) {
    if (res) {
      res.status(403).json({
        error: 'Impersonation sessions are read-only. End session to perform actions as yourself.',
        code: 'IMPERSONATION_READ_ONLY',
        guidance: 'Stop impersonation and retry the action from your own superadmin session.',
      });
      return;
    }
  }

  // Attach permission helper
  const permissionRole = normalizePermissionRole(
    req.userRole || decoded.role || decoded.userRole || user.role
  );
  req.can = (capability: string): boolean => {
    return PermissionService.can(
      {
        ...user,
        role: permissionRole as UserRole,
      },
      capability,
      {
        organizationId: req.organizationId,
      }
    );
  };

  next();
};

/**
 * V4-ENT-01: Session hardening — track activity & validate active sessions.
 * Runs fire-and-forget after attachUser so it doesn't add latency.
 */
const trackSessionActivity = (req: AuthRequest, res: Response): void => {
  if (!req.userId) return;
  const userId = req.userId;

  (async () => {
    try {
      const { activityColumn, hasIsActive } = await getUserSessionCompatibility();
      const activeFilter = hasIsActive ? `AND is_active = true` : '';
      const session = await dbGet<{ id: string; is_active?: boolean | number | null }>(
        `SELECT id${hasIsActive ? ', is_active' : ''}
         FROM user_sessions
         WHERE user_id = ?
           ${activeFilter}
         ORDER BY ${activityColumn} DESC LIMIT 1`,
        [userId]
      );

      if (session) {
        if (hasIsActive && session.is_active !== true && session.is_active !== 1) return;
        res.setHeader('X-Session-Id', session.id);
        if (activityColumn !== 'created_at') {
          await dbRun(`UPDATE user_sessions SET ${activityColumn} = NOW() WHERE id = ?`, [
            session.id,
          ]);
        }
      }
    } catch {
      // Non-critical — don't break auth flow on session tracking errors
    }
  })();
};

// In-memory cache for revoked-token lookups to avoid hitting slow DB on every request.
// Entries expire after REVOKE_CACHE_TTL_MS. On token revocation the server restarts
// or the cache naturally expires, so the window is acceptably short.
const REVOKE_CACHE_TTL_MS = 60_000;
const _revokeCache = new Map<string, { revoked: boolean; ts: number }>();
const _revokeAllCache = new Map<string, { jti: string | null; ts: number }>();

// In-flight dedup: prevents N concurrent DB hits for the same lookup during request bursts
const _revokeInflight = new Map<string, Promise<boolean>>();
const _revokeAllInflight = new Map<string, Promise<{ jti: string | null }>>();

function getCachedRevoke(jti: string): boolean | undefined {
  const entry = _revokeCache.get(jti);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > REVOKE_CACHE_TTL_MS) {
    _revokeCache.delete(jti);
    return undefined;
  }
  return entry.revoked;
}

function getCachedRevokeAll(userId: string): { jti: string | null } | undefined {
  const entry = _revokeAllCache.get(userId);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > REVOKE_CACHE_TTL_MS) {
    _revokeAllCache.delete(userId);
    return undefined;
  }
  return { jti: entry.jti };
}

/**
 * Check if token has been revoked.
 * Uses in-flight dedup so concurrent requests for the same token/user
 * share a single DB query instead of each hitting the database.
 */
const checkTokenRevocation = async (
  decoded: JWTPayload,
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { dbGet } = await getDeps();

  if (!decoded.jti) {
    await attachUser(decoded, req, next, res);
    return;
  }

  try {
    // Check if specific token is revoked (with cache + in-flight dedup)
    let isRevoked = getCachedRevoke(decoded.jti);
    if (isRevoked === undefined) {
      let inflight = _revokeInflight.get(decoded.jti);
      if (!inflight) {
        inflight = dbGet<{ jti: string }>('SELECT jti FROM revoked_tokens WHERE jti = ?', [
          decoded.jti,
        ])
          .then((row) => {
            const revoked = !!row;
            _revokeCache.set(decoded.jti!, { revoked, ts: Date.now() });
            _revokeInflight.delete(decoded.jti!);
            return revoked;
          })
          .catch((err) => {
            _revokeInflight.delete(decoded.jti!);
            throw err;
          });
        _revokeInflight.set(decoded.jti, inflight);
      }
      isRevoked = await inflight;
    }

    if (isRevoked) {
      res.status(401).json({ error: 'Token has been revoked' });
      return;
    }

    // Check for "revoke-all" marker for this user (with cache + in-flight dedup)
    let revokeAllEntry = getCachedRevokeAll(decoded.id);
    if (revokeAllEntry === undefined) {
      let inflight = _revokeAllInflight.get(decoded.id);
      if (!inflight) {
        inflight = dbGet<{ jti: string }>(
          "SELECT jti FROM revoked_tokens WHERE user_id = ? AND reason = 'revoke-all' AND expires_at > NOW()",
          [decoded.id]
        )
          .then((row) => {
            const entry = { jti: row?.jti ?? null };
            _revokeAllCache.set(decoded.id, { jti: entry.jti, ts: Date.now() });
            _revokeAllInflight.delete(decoded.id);
            return entry;
          })
          .catch((err) => {
            _revokeAllInflight.delete(decoded.id);
            throw err;
          });
        _revokeAllInflight.set(decoded.id, inflight);
      }
      revokeAllEntry = await inflight;
    }

    if (revokeAllEntry.jti) {
      const revokeTime = parseInt(revokeAllEntry.jti.split('-').pop() || '0', 10);
      const tokenIssuedAt = (decoded.iat || 0) * 1000;

      if (tokenIssuedAt < revokeTime) {
        res.status(401).json({
          error: 'All sessions have been revoked. Please log in again.',
        });
        return;
      }
    }

    // Token is valid
    await attachUser(decoded, req, next, res);
  } catch (dbErr) {
    logger.error('Error checking revoked tokens:', dbErr);
    await attachUser(decoded, req, next, res);
  }
};

// ==========================================
// MAIN MIDDLEWARE
// ==========================================

/**
 * Verify JWT token and attach user to request
 */
export const verifyToken = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    logger.debug(`[AuthMiddleware] Verifying token for path: ${req.path}`);
    const { jwt: jwtLib, config } = await getDeps();

    const token = extractToken(req);
    logger.debug(`[AuthMiddleware] Token extracted: ${token ? 'YES' : 'NO'}`);

    if (!token) {
      // Test mode bypass
      if (process.env.NODE_ENV === 'test' && process.env.ENABLE_TEST_AUTH_BYPASS === 'true') {
        // Only set default test user if not already set by another middleware
        if (!req.user) {
          req.user = {
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@example.com',
            role: 'guest',
            organizationId: 'test-org-id',
            isSuperAdmin: false,
            isDemo: false,
          };
          req.userId = 'test-user-id';
          req.organizationId = 'test-org-id';
        }
        return next();
      }

      res.status(401).json({ error: 'No token provided' });
      return;
    }

    // --------------------------------------------------------------------
    // E2E MODE AUTH BYPASS (deterministic Playwright runtime tests)
    // --------------------------------------------------------------------
    // In E2E_MODE we allow a JWT-like token that is NOT signature-verified,
    // but MUST contain an explicit `e2e: true` claim. This is safe because:
    // - It is gated behind E2E_MODE (never enabled in production)
    // - It still requires the client to send a token (frontend uses it)
    //
    // This enables CI Playwright runtime tests without relying on seeded
    // credentials or secrets in CI.
    if (!isProductionEnv && process.env.E2E_MODE === 'true') {
      try {
        const decoded = jwtLib.decode(token) as JWTPayload | null;
        if (decoded && (decoded as any).e2e === true && decoded.id) {
          // Best-effort: ensure the E2E user/org exist in DB so that
          // downstream routes that rely on FK / joins (e.g. conversations)
          // can operate normally during runtime tests.
          try {
            const { run } = await import('../utils/DbPromise.js');
            const orgId =
              decoded.organizationId || (decoded as any).organization_id || 'e2e-org-id';
            const userRole = (decoded.role || decoded.userRole || 'ADMIN').toString().toUpperCase();
            await run(
              `
                INSERT INTO organizations (id, name, plan, status)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
              `,
              [orgId, 'E2E Organization', 'enterprise', 'active']
            );
            await run(
              `
                INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
              `,
              [
                decoded.id,
                orgId,
                decoded.email || 'e2e@local.test',
                // Not used in E2E token mode (no login), but keep schema happy.
                'e2e-not-used',
                userRole,
                'active',
                (decoded.name || 'E2E').toString().split(' ')[0] || 'E2E',
                (decoded.name || 'User').toString().split(' ').slice(1).join(' ') || 'User',
              ]
            );
          } catch (seedErr) {
            logger.warn('[AuthMiddleware] E2E seed failed (continuing):', seedErr);
          }

          // Attach without signature verification / revocation checks
          await attachUser(decoded, req, next, res);
          return;
        }
      } catch (e) {
        // Ignore and fall through to normal verification
      }
    }

    try {
      const { jwt: jwtLib, config } = await getDeps();

      const jwtSecret =
        (config as { JWT_SECRET: string })?.JWT_SECRET || (config as any)?.JWT_SECRET;
      if (!config || !jwtSecret) {
        logger.error(
          `[AuthMiddleware] CRITICAL: config object is ${typeof config}, keys: ${config ? Object.keys(config) : 'none'}, JWT_SECRET is ${config?.JWT_SECRET ? 'present' : 'missing'}`
        );
      }

      logger.debug(
        `[AuthMiddleware] Verifying token: ${token.substring(0, 10)}... with secret length: ${jwtSecret?.length}`
      );

      const decoded = await new Promise<JWTPayload>((resolve, reject) => {
        jwtLib.verify(token, jwtSecret, (err: any, decoded: any) => {
          if (err) return reject(err);
          resolve(decoded as JWTPayload);
        });
      });

      await checkTokenRevocation(decoded, req, res, next);
      trackSessionActivity(req, res);
    } catch (err: any) {
      logger.error('[AuthMiddleware] Verification failed:', err.message);
      if (err.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token expired' });
        return;
      }
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }
);

/**
 * Compatibility middleware used across legacy routes.
 * Assumes `verifyToken` (or another auth layer) already attached `req.user`.
 */
export const isAuthenticated = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user) {
    next();
    return;
  }
  res.status(401).json({ error: 'Authentication required' });
};

/**
 * Optional auth - attaches user if token present, but doesn't require it
 */
export const optionalAuth = asyncHandler(
  async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    const { jwt: jwtLib, config } = await getDeps();
    const jwtSecret = (config as { JWT_SECRET: string })?.JWT_SECRET || (config as any)?.JWT_SECRET;

    const token = extractToken(req);

    if (!token || !jwtSecret) {
      return next();
    }

    jwtLib.verify(token, jwtSecret, async (err: any, decoded: any) => {
      if (err) {
        // Invalid token, but optional - continue without user
        return next();
      }

      // Attach user without revocation check for optional auth
      await attachUser(decoded as JWTPayload, req, next, _res);
    });
  }
);

/**
 * Require specific role
 */
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const effectiveRole = String(req.userRole || req.user.role || '');
    const grantedRoles = req.user.isSuperAdmin
      ? Array.from(new Set([effectiveRole, req.user.role, 'SUPERADMIN', 'superadmin']))
      : [effectiveRole, req.user.role];

    if (!roles.some((role) => grantedRoles.includes(role))) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

/**
 * Require super admin
 */
export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!req.user.isSuperAdmin) {
    res.status(403).json({ error: 'Super admin access required' });
    return;
  }

  next();
};

/**
 * Require organization context
 */
export const requireOrganization = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.organizationId) {
    res.status(403).json({ error: 'Organization context required' });
    return;
  }

  next();
};

/**
 * Validate that the user still has an active membership in the org from their JWT.
 * Uses in-memory cache (60s TTL) to avoid per-request DB hits.
 */
const _membershipCache = new Map<string, { valid: boolean; ts: number }>();
const MEMBERSHIP_CACHE_TTL_MS = 60_000;

export const validateOrgMembership = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.userId || req.user?.id;
    const orgId = req.organizationId;

    if (!userId || !orgId) {
      return next();
    }

    // SuperAdmins bypass membership checks
    if (req.user?.isSuperAdmin) {
      return next();
    }

    const cacheKey = `${userId}:${orgId}`;
    const cached = _membershipCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < MEMBERSHIP_CACHE_TTL_MS) {
      if (!cached.valid) {
        res.status(403).json({
          error: 'You no longer have access to this organization',
          code: 'ORG_MEMBERSHIP_REVOKED',
        });
        return;
      }
      return next();
    }

    try {
      const membership = await dbGet<{ status: string }>(
        `SELECT status FROM organization_members WHERE user_id = ? AND organization_id = ?`,
        [userId, orgId]
      );

      const valid = !!membership && membership.status === 'ACTIVE';
      _membershipCache.set(cacheKey, { valid, ts: Date.now() });

      if (!valid) {
        res.status(403).json({
          error: 'You no longer have access to this organization',
          code: 'ORG_MEMBERSHIP_REVOKED',
        });
        return;
      }

      next();
    } catch {
      // On DB error, allow request through (fail-open) to avoid blocking all requests
      next();
    }
  }
);

/**
 * Require specific permission capability
 */
export const requirePermission = (capability: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!req.can || !req.can(capability)) {
      res.status(403).json({
        error: 'Permission denied',
        required: capability,
      });
      return;
    }

    next();
  };
};

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
  if (!deps) {
    deps = {} as Dependencies;
  }
  deps = { ...deps, ...newDeps };
};

/**
 * Internal helpers exposed for unit testing.
 * Not part of the public middleware API.
 */
export const __private__ = {
  extractToken,
  mapRole,
  normalizePermissionRole,
  getDeps,
  resetRevocationCachesForTests: () => {
    _revokeCache.clear();
    _revokeAllCache.clear();
  },
  resetDepsForTests: () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deps = undefined as any;
  },
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default verifyToken;
