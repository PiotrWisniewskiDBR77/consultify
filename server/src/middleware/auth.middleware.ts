// @ts-nocheck
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
    config: { JWT_SECRET: string };
    PermissionService: {
        can: (user: AuthenticatedUser, capability: string, context?: { organizationId?: string }) => boolean;
    };
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
            (m) => m.default || m,
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
            return 'owner';
        case 'user':
            return 'team_member';
        case 'client':
            return 'guest';
        case 'manager':
            return 'project_manager';
        default:
            return role as UserRole;
    }
};

/**
 * Attach user data to request
 */
const attachUser = async (decoded: JWTPayload, req: AuthRequest, next: NextFunction): Promise<void> => {
    const { PermissionService } = await getDeps();

    req.userId = decoded.id;
    req.userRole = decoded.role || decoded.userRole;
    req.organizationId = decoded.organizationId;

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
    req.can = (capability: string): boolean => {
        return PermissionService.can(user, capability, {
            organizationId: req.organizationId,
        });
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
    next: NextFunction,
): Promise<void> => {
    const { dbGet } = await getDeps();

    if (!decoded.jti) {
        // No jti - older token format, just continue
        await attachUser(decoded, req, next);
        return;
    }

    try {
        // Check if specific token is revoked
        const revokedToken = await dbGet<{ jti: string }>('SELECT jti FROM revoked_tokens WHERE jti = ?', [
            decoded.jti,
        ]);

        if (revokedToken) {
            res.status(401).json({ error: 'Token has been revoked' });
            return;
        }

        // Check for "revoke-all" marker for this user
        const revokeAllRow = await dbGet<{ jti: string }>(
            "SELECT jti FROM revoked_tokens WHERE user_id = ? AND reason = 'revoke-all' AND expires_at > datetime('now')",
            [decoded.id],
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
export const verifyToken = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    console.log(`[AuthMiddleware] Verifying token for path: ${req.path}`);
    const { jwt: jwtLib, config } = await getDeps();
    console.log('[AuthMiddleware] Deps loaded');

    const token = extractToken(req);
    console.log('[AuthMiddleware] Token extracted:', token ? 'YES' : 'NO');

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

    try {
        const { jwt: jwtLib, config } = await getDeps();
        
        if (!config || !config.JWT_SECRET) {
            logger.error(`[AuthMiddleware] CRITICAL: config object is ${typeof config}, keys: ${config ? Object.keys(config) : 'none'}, JWT_SECRET is ${config?.JWT_SECRET ? 'present' : 'missing'}`);
        }

        logger.info(`[AuthMiddleware] Verifying token: ${token.substring(0, 10)}... with secret length: ${config.JWT_SECRET?.length}`);

        const decoded = await new Promise<JWTPayload>((resolve, reject) => {
            jwtLib.verify(token, config.JWT_SECRET, (err: any, decoded: any) => {
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
});

/**
 * Optional auth - attaches user if token present, but doesn't require it
 */
export const optionalAuth = asyncHandler(
    async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
        const { jwt: jwtLib, config } = await getDeps();

        const token = extractToken(req);

        if (!token) {
            return next();
        }

        jwtLib.verify(token, config.JWT_SECRET, async (err: any, decoded: any) => {
            if (err) {
                // Invalid token, but optional - continue without user
                return next();
            }

            // Attach user without revocation check for optional auth
            await attachUser(decoded as JWTPayload, req, next);
        });
    },
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
