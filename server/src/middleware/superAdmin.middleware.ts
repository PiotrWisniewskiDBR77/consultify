/**
 * Super Admin Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Verifies user has SUPERADMIN privileges.
 * Checks both token and database for role verification.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthRequest } from './auth.middleware';
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
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies;

const getDeps = (): Dependencies => {
    if (!deps) {
        const defaultJwt = await import('jsonwebtoken.js').then(m => m.default || m);
        const defaultConfig = await import('../../config.js').then(m => m.default || m);
        
        deps = {
            jwt: defaultJwt,
            config: defaultConfig,
        };
    }
    return deps;
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Verify Super Admin - Checks token and database for SUPERADMIN role
 */
export const verifySuperAdmin = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    const { jwt: jwtLib, config, db } = getDeps();
    
    const headers = req.headers || {};
    const token = headers['authorization'];
    
    if (!token) {
        res.status(403).json({ error: 'No token provided' });
        return;
    }

    const cleanToken = typeof token === 'string' && token.startsWith('Bearer ')
        ? token.split(' ')[1]
        : typeof token === 'string' ? token : '';

    jwtLib.verify(cleanToken, config.JWT_SECRET, async (err, decoded) => {
        if (err) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const payload = decoded as JWTPayload;
        
        // Check role from token first
        let userRole = payload.role;

        // If role is not SUPERADMIN, check database as fallback (in case role was changed)
        if (userRole !== 'SUPERADMIN' && userRole !== 'SUPER_ADMIN') {
            console.log(`[SuperAdmin Middleware] Initial role check failed for: ${userRole}`);
            try {
                const user = await dbGet<UserRow>('SELECT role FROM users WHERE id = ?', [payload.id]);

                if (user && (user.role === 'SUPERADMIN' || user.role === 'SUPER_ADMIN')) {
                    // Role was changed in database, update decoded token
                    console.log('[SuperAdmin Middleware] Role promoted via DB check');
                    userRole = user.role;
                    payload.role = user.role;
                } else {
                    console.log('[SuperAdmin Middleware] DB check validated non-superadmin role:', user?.role);
                }
            } catch (dbErr) {
                console.error('[SuperAdmin Middleware] Database check error:', dbErr);
                // Continue with token role if DB check fails
            }
        }

        if (userRole !== 'SUPERADMIN' && userRole !== 'SUPER_ADMIN') {
            console.log(`[SuperAdmin Middleware] Access Denied. Role: ${userRole}`);
            res.status(403).json({ error: 'Requires Super Admin privileges' });
            return;
        }

        req.userId = payload.id;
        req.userRole = userRole;
        req.organizationId = payload.organizationId || payload.organization_id;
        req.user = {
            id: payload.id,
            role: userRole,
            organizationId: req.organizationId,
            isSuperAdmin: true,
        };
        
        next();
    });
};

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
    deps = { ...getDeps(), ...newDeps };
};

