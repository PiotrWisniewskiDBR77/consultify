/**
 * Authentication Middleware
 * Enterprise SaaS Architecture - TypeScript Backend Auth
 */

import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { AuthenticatedRequest, AuthenticatedUser as GlobalUser, UserRole } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

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
  isSuperAdmin?: boolean;
  impersonatorId?: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser extends GlobalUser {
  isDemo?: boolean;
  impersonatorId?: string;
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
  const r = role.toLowerCase();
  switch (r) {
    case 'admin':
      return 'administrator';
    case 'superadmin':
    case 'super_admin':
      return 'owner';
    case 'user':
      return 'team_member';
    case 'member':
      return 'team_member';
    case 'client':
      return 'guest';
    case 'guest':
      return 'guest';
    case 'manager':
      return 'project_manager';
    default:
      return role as UserRole;
  }
};

const normalizePermissionRole = (role?: string): string => {
  if (!role) return 'VIEWER';
  const r = role.toString().trim().toUpperCase();
  switch (r) {
    case 'OWNER':
    case 'SUPER_ADMIN':
    case 'SUPERADMIN':
      return 'SUPERADMIN';
    case 'ADMINISTRATOR':
    case 'ADMIN':
      return 'ADMIN';
    case 'PROJECT_MANAGER':
    case 'MANAGER':
      return 'PROJECT_MANAGER';
    case 'TEAM_MEMBER':
    case 'MEMBER':
    case 'USER':
      return 'TEAM_MEMBER';
    case 'VIEWER':
    case 'GUEST':
    case 'CLIENT':
      return 'VIEWER';
    default:
      return r;
  }
};

/**
 * Attach user data to request
 */
const attachUser = async (
  decoded: JWTPayload,
  req: AuthRequest,
  next: NextFunction
): Promise<void> => {
  const { PermissionService } = await getDeps();

  req.userId = decoded.id;
  req.userRole = decoded.role || decoded.userRole;
  req.organizationId = decoded.organizationId || (decoded as any).organization_id;

  const user: AuthenticatedUser = {
    id: decoded.id,
    email: decoded.email || '',
    name: decoded.name || 'User',
    role: mapRole(req.userRole),
    organizationId: req.organizationId || '',
    isSuperAdmin: decoded.isSuperAdmin || false,
    isDemo: (decoded as any).isDemo || false,
    impersonatorId: decoded.impersonatorId,
  };

  req.user = user;

  // Attach permission helper
  const permissionRole = normalizePermissionRole(decoded.role || decoded.userRole || user.role);
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
 * Check if token has been revoked
 */
const checkTokenRevocation = async (
  decoded: JWTPayload,
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { dbGet } = await getDeps();

  if (!decoded.jti) {
    // No jti - older token format, just continue
    await attachUser(decoded, req, next);
    return;
  }

  try {
    // Check if specific token is revoked
    const revokedToken = await dbGet<{ jti: string }>(
      'SELECT jti FROM revoked_tokens WHERE jti = ?',
      [decoded.jti]
    );

    if (revokedToken) {
      res.status(401).json({ error: 'Token has been revoked' });
      return;
    }

    // Check for "revoke-all" marker for this user
    const revokeAllRow = await dbGet<{ jti: string }>(
      "SELECT jti FROM revoked_tokens WHERE user_id = ? AND reason = 'revoke-all' AND expires_at > datetime('now')",
      [decoded.id]
    );

    if (revokeAllRow) {
      // Check if token was issued before the revoke-all
      const revokeTime = parseInt(revokeAllRow.jti.split('-').pop() || '0', 10);
      const tokenIssuedAt = (decoded.iat || 0) * 1000;

      if (tokenIssuedAt < revokeTime) {
        res.status(401).json({
          error: 'All sessions have been revoked. Please log in again.',
        });
        return;
      }
    }

    // Token is valid
    await attachUser(decoded, req, next);
  } catch (dbErr) {
    logger.error('Error checking revoked tokens:', dbErr);
    // Continue anyway - don't block on DB errors
    await attachUser(decoded, req, next);
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
    if (process.env.E2E_MODE === 'true') {
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
          await attachUser(decoded, req, next);
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

      logger.info(
        `[AuthMiddleware] Verifying token: ${token.substring(0, 10)}... with secret length: ${jwtSecret?.length}`
      );

      const decoded = await new Promise<JWTPayload>((resolve, reject) => {
        jwtLib.verify(token, jwtSecret, (err: any, decoded: any) => {
          if (err) return reject(err);
          resolve(decoded as JWTPayload);
        });
      });

      await checkTokenRevocation(decoded, req, res, next);
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
      await attachUser(decoded as JWTPayload, req, next);
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

    if (!roles.includes(req.user.role)) {
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

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default verifyToken;
