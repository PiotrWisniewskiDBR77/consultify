/**
 * Super Admin Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Verifies user has SUPERADMIN privileges.
 * Checks both token and database for role verification.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../../config.js';
import type { AuthRequest } from './auth.middleware.js';
import { get as dbGet } from '../utils/DbPromise.js';

// ==========================================
// TYPES
// ==========================================

interface JWTPayload {
    id: string;
    role?: string;
    organizationId?: string;
    organization_id?: string;
}

// Database interface no longer needed - using DbPromise directly

interface UserRow {
    role?: string;
}

interface Dependencies {
    jwt: typeof jwt;
    config: { JWT_SECRET: string };
    dbGet: <T>(sql: string, params?: any[]) => Promise<T | undefined>;
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies = {
    jwt,
    config,
    dbGet
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

    const headers = req.headers || {};
    const token = headers['authorization'];

    if (!token) {
        res.status(403).json({ error: 'No token provided' });
        return;
    }

    const cleanToken = typeof token === 'string' && token.startsWith('Bearer ')
        ? token.split(' ')[1]
        : typeof token === 'string' ? token : '';

    try {
        const decoded = await new Promise<JWTPayload>((resolve, reject) => {
            jwtLib.verify(cleanToken, depsConfig.JWT_SECRET, (err, decoded) => {
                if (err) return reject(err);
                resolve(decoded as JWTPayload);
            });
        });

        // Check role from token first
        let userRole = decoded.role;

        // If role is not SUPERADMIN, check database as fallback (in case role was changed)
        if (userRole !== 'SUPERADMIN' && userRole !== 'SUPER_ADMIN') {
            console.log(`[SuperAdmin Middleware] Initial role check failed for: ${userRole}`);

            try {
                const user = await db<UserRow>('SELECT role FROM users WHERE id = ?', [decoded.id]);

                if (user && (user.role === 'SUPERADMIN' || user.role === 'SUPER_ADMIN')) {
                    console.log('[SuperAdmin Middleware] Role promoted via DB check');
                    userRole = user.role;
                } else {
                    console.log(`[SuperAdmin Middleware] DB check validated non-superadmin role: ${user?.role}`);
                    console.log(`[SuperAdmin Middleware] Access Denied. Role: ${user?.role || userRole}`);
                    res.status(403).json({ error: 'Requires Super Admin privileges' });
                    return;
                }
            } catch (dbError) {
                console.error('[SuperAdmin Middleware] Database check error:', dbError);
                // If DB check fails, we fall back to token role which failed check
                res.status(403).json({ error: 'Requires Super Admin privileges' });
                return;
            }
        }

        // If after all checks, the role is still not SUPERADMIN, deny access
        if (userRole !== 'SUPERADMIN' && userRole !== 'SUPER_ADMIN') {
            console.log(`[SuperAdmin Middleware] Access Denied. Role: ${userRole}`);
            res.status(403).json({ error: 'Requires Super Admin privileges' });
            return;
        }

        // Attach super admin status to request
        if (req.user) {
            req.user.isSuperAdmin = true;
            req.user.role = (userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN') ? 'owner' : userRole as any;
            req.user.organizationId = decoded.organizationId || decoded.organization_id || '';
        } else {
            req.user = {
                id: decoded.id,
                email: '',
                name: '',
                role: (userRole === 'SUPERADMIN' || userRole === 'SUPER_ADMIN') ? 'owner' : userRole as any,
                organizationId: decoded.organizationId || decoded.organization_id || '',
                isSuperAdmin: true
            };
        }
        req.userId = decoded.id;
        req.userRole = userRole;
        req.organizationId = decoded.organizationId || decoded.organization_id;

        next();
    } catch (err) {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
    deps = { ...deps, ...newDeps };
};

