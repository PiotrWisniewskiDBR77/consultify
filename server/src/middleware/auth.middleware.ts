/**
 * Authentication Middleware
 * Enterprise SaaS Architecture - TypeScript Backend Auth
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// ==========================================
// TYPES
// ==========================================

export interface JWTPayload {
    id: string;
    email?: string;
    role?: string;
    userRole?: string;
    organizationId?: string;
    organization_id?: string;
    isSuperAdmin?: boolean;
    impersonatorId?: string;
    jti?: string;
    iat?: number;
    exp?: number;
}

export interface AuthenticatedUser {
    id: string;
    email?: string;
    role: string;
    organizationId?: string;
    isSuperAdmin: boolean;
    impersonatorId?: string;
}

export interface AuthRequest extends Request {
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
    db: {
        get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
    };
    PermissionService: {
        can: (user: AuthenticatedUser, capability: string, context?: { organizationId?: string }) => boolean;
    };
}

let deps: Dependencies;

// Lazy initialization to avoid circular dependencies
const getDeps = (): Dependencies => {
    if (!deps) {
        const defaultJwt = require('jsonwebtoken');
        const defaultConfig = require('../../config');
        const defaultDb = require('../../database');
        const defaultPermissionService = require('../../services/permissionService');
        
        deps = {
            jwt: defaultJwt,
            config: defaultConfig,
            db: defaultDb,
            PermissionService: defaultPermissionService,
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
 * Attach user data to request
 */
const attachUser = (
    decoded: JWTPayload,
    req: AuthRequest,
    next: NextFunction
): void => {
    const { PermissionService } = getDeps();
    
    req.userId = decoded.id;
    req.userRole = decoded.role || decoded.userRole;
    req.organizationId = decoded.organizationId || decoded.organization_id;
    
    const user: AuthenticatedUser = {
        id: decoded.id,
        email: decoded.email,
        role: req.userRole || 'user',
        organizationId: req.organizationId,
        isSuperAdmin: decoded.isSuperAdmin || false,
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
const checkTokenRevocation = (
    decoded: JWTPayload,
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    const { db } = getDeps();
    
    if (!decoded.jti) {
        // No jti - older token format, just continue
        attachUser(decoded, req, next);
        return;
    }
    
    // Check if specific token is revoked
    db.get(
        'SELECT jti FROM revoked_tokens WHERE jti = ?',
        [decoded.jti],
        (dbErr, row) => {
            if (dbErr) {
                console.error('Error checking revoked tokens:', dbErr);
                // Continue anyway - don't block on DB errors
            }
            
            if (row) {
                res.status(401).json({ error: 'Token has been revoked' });
                return;
            }
            
            // Check for "revoke-all" marker for this user
            db.get(
                "SELECT jti FROM revoked_tokens WHERE user_id = ? AND reason = 'revoke-all' AND expires_at > datetime('now')",
                [decoded.id],
                (dbErr2, revokeAllRow: { jti: string } | undefined) => {
                    if (dbErr2) {
                        console.error('Error checking revoke-all:', dbErr2);
                    }
                    
                    if (revokeAllRow) {
                        // Check if token was issued before the revoke-all
                        const revokeTime = parseInt(revokeAllRow.jti.split('-').pop() || '0', 10);
                        const tokenIssuedAt = (decoded.iat || 0) * 1000;
                        
                        if (tokenIssuedAt < revokeTime) {
                            res.status(401).json({ 
                                error: 'All sessions have been revoked. Please log in again.' 
                            });
                            return;
                        }
                    }
                    
                    // Token is valid
                    attachUser(decoded, req, next);
                }
            );
        }
    );
};

// ==========================================
// MAIN MIDDLEWARE
// ==========================================

/**
 * Verify JWT token and attach user to request
 */
export const verifyToken = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    const { jwt: jwtLib, config } = getDeps();
    
    const token = extractToken(req);
    
    if (!token) {
        // Test mode bypass
        if (process.env.NODE_ENV === 'test' && process.env.ENABLE_TEST_AUTH_BYPASS === 'true') {
            req.user = {
                id: 'test-user-id',
                role: 'client',
                organizationId: 'test-org-id',
                isSuperAdmin: false,
            };
            req.userId = 'test-user-id';
            req.organizationId = 'test-org-id';
            return next();
        }
        
        res.status(403).json({ error: 'No token provided' });
        return;
    }
    
    jwtLib.verify(token, config.JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                res.status(401).json({ error: 'Token expired' });
                return;
            }
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        
        checkTokenRevocation(decoded as JWTPayload, req, res, next);
    });
};

/**
 * Optional auth - attaches user if token present, but doesn't require it
 */
export const optionalAuth = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    const { jwt: jwtLib, config } = getDeps();
    
    const token = extractToken(req);
    
    if (!token) {
        return next();
    }
    
    jwtLib.verify(token, config.JWT_SECRET, (err, decoded) => {
        if (err) {
            // Invalid token, but optional - continue without user
            return next();
        }
        
        // Attach user without revocation check for optional auth
        attachUser(decoded as JWTPayload, req, next);
    });
};

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
export const requireSuperAdmin = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
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
export const requireOrganization = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
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
    deps = { ...getDeps(), ...newDeps };
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default verifyToken;


