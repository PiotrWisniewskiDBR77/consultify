/**
 * Trial Entry Guard Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Blocks organization-requiring actions for users in TRIAL_ENTRY status.
 * Users in Trial Entry can talk to AI and explore methodology, but cannot:
 * - Create initiatives
 * - Invite team members
 * - Upload data
 * - Generate reports
 * - Access dashboard features
 */

import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';

// ==========================================
// TYPES
// ==========================================

interface Database {
    get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
}

interface UserRow {
    user_status?: string;
}

interface BlockedRoute {
    method: string;
    path: RegExp;
}

interface TrialRequest extends AuthRequest {
    isTrialEntry?: boolean;
}

interface Dependencies {
    db: Database;
}

// ==========================================
// CONSTANTS
// ==========================================

/**
 * List of blocked routes for Trial Entry users
 */
export const BLOCKED_ROUTES: BlockedRoute[] = [
    // Initiative creation/modification
    { method: 'POST', path: /^\/api\/initiatives/ },
    { method: 'PUT', path: /^\/api\/initiatives/ },
    { method: 'DELETE', path: /^\/api\/initiatives/ },

    // Team invitations
    { method: 'POST', path: /^\/api\/organizations\/.*\/invite/ },
    { method: 'POST', path: /^\/api\/invitations/ },

    // Data upload
    { method: 'POST', path: /^\/api\/upload/ },
    { method: 'POST', path: /^\/api\/ingestion/ },

    // Report generation
    { method: 'POST', path: /^\/api\/reports/ },
    { method: 'GET', path: /^\/api\/reports\/.*\/export/ },

    // Roadmap creation
    { method: 'POST', path: /^\/api\/roadmap/ },

    // Assessment submission (can view demo, not submit real)
    { method: 'POST', path: /^\/api\/assessment\/submit/ },

    // AI memory write (allowed to chat, not persist)
    { method: 'POST', path: /^\/api\/ai\/memory/ },
    { method: 'POST', path: /^\/api\/knowledge/ }
];

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies;

const getDeps = (): Dependencies => {
    if (!deps) {
        const defaultDb = require('../../database');
        deps = { db: defaultDb };
    }
    return deps;
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Check if user is in Trial Entry status
 */
export async function isTrialEntryUser(userId: string): Promise<boolean> {
    const { db } = getDeps();
    
    return new Promise<boolean>((resolve, reject) => {
        db.get(
            `SELECT user_status FROM users WHERE id = ?`,
            [userId],
            (err, row) => {
                if (err) return reject(err);
                const userRow = row as UserRow | undefined;
                resolve(userRow?.user_status === 'TRIAL_ENTRY');
            }
        );
    });
}

/**
 * Check if route is blocked for Trial Entry users
 */
function isBlockedRoute(method: string, path: string): boolean {
    return BLOCKED_ROUTES.some(route =>
        route.method === method && route.path.test(path)
    );
}

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Trial Entry Guard Middleware
 * 
 * Must be used AFTER auth middleware.
 */
export const trialEntryGuard = async (
    req: TrialRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Skip if no user (auth middleware not applied or failed)
        if (!req.user?.id) {
            next();
            return;
        }

        // Check if user is in Trial Entry
        const isTrialEntry = await isTrialEntryUser(req.user.id);

        if (!isTrialEntry) {
            next();
            return;
        }

        // Attach flag for downstream use
        req.isTrialEntry = true;

        // Check if this route is blocked
        if (isBlockedRoute(req.method, req.path)) {
            res.status(403).json({
                error: 'TRIAL_ENTRY_RESTRICTION',
                message: 'Ta funkcja nie jest dostępna w Trial Entry. Załóż organizację, aby kontynuować.',
                messageEn: 'This feature is not available in Trial Entry. Create an organization to continue.',
                cta: {
                    label: 'Załóż organizację',
                    path: '/trial/create-org'
                }
            });
            return;
        }

        next();
    } catch (error) {
        console.error('[TrialEntryGuard] Error:', error);
        next(error);
    }
};

/**
 * Middleware to require organization context
 * Use on routes that absolutely need an organization
 */
export const requireOrgContext = async (
    req: TrialRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    if (req.isTrialEntry) {
        res.status(403).json({
            error: 'ORG_REQUIRED',
            message: 'Ta funkcja wymaga organizacji. Jesteś w fazie Trial Entry.',
            cta: {
                label: 'Załóż organizację',
                path: '/trial/create-org'
            }
        });
        return;
    }

    if (!req.user?.organization_id) {
        res.status(403).json({
            error: 'ORG_REQUIRED',
            message: 'Brak kontekstu organizacji.'
        });
        return;
    }

    next();
};

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
    deps = { ...getDeps(), ...newDeps };
};

