/**
 * Plan Limits Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Enforces subscription plan limits (projects, storage, members, etc.)
 */

import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';

// ==========================================
// TYPES
// ==========================================

interface Database {
    get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
}

interface OrganizationRow {
    plan?: string;
    status?: string;
}

interface CountRow {
    count: number;
}

interface PlanLimits {
    max_projects?: number;
    max_storage_mb?: number;
    can_use_advanced_models?: number;
    max_members?: number;
}

interface Dependencies {
    db: Database;
}

// ==========================================
// CONSTANTS
// ==========================================

/**
 * Plan Limits Configuration
 */
export const PLAN_LIMITS: Record<string, PlanLimits> = {
    free: {
        max_projects: 1,
        max_storage_mb: 100,
        can_use_advanced_models: 0, // 0 = false
        max_members: 1
    },
    pro: {
        max_projects: 10,
        max_storage_mb: 5000,
        can_use_advanced_models: 1,
        max_members: 5
    },
    enterprise: {
        max_projects: 9999,
        max_storage_mb: 100000,
        can_use_advanced_models: 1,
        max_members: 9999
    }
};

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
// MIDDLEWARE
// ==========================================

/**
 * Middleware to check plan limits
 * Usage: router.post('/projects', checkPlanLimit('max_projects'), createProject);
 * 
 * @param limitKey - Key to check in PLAN_LIMITS (e.g., 'max_projects')
 */
export const checkPlanLimit = (limitKey: keyof PlanLimits) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { db } = getDeps();
            
            const orgId = req.user?.organizationId || req.user?.organization_id;
            if (!orgId) {
                res.status(403).json({ error: 'No organization found' });
                return;
            }

            // 1. Get Organization Plan
            const org = await new Promise<OrganizationRow | null>((resolve, reject) => {
                db.get('SELECT plan, status FROM organizations WHERE id = ?', [orgId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row as OrganizationRow | null);
                });
            });

            if (!org) {
                res.status(404).json({ error: 'Organization not found' });
                return;
            }

            // Allow trial as pro
            const plan = (org.status === 'trial') ? 'pro' : (org.plan || 'free');
            const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
            const limitValue = limits[limitKey];

            if (limitValue === undefined) {
                // Limit not defined for this plan? Allow or Log warning.
                console.warn(`Limit key ${limitKey} not found for plan ${plan}`);
                next();
                return;
            }

            // 2. Check current usage
            let currentCount = 0;

            if (limitKey === 'max_projects') {
                const result = await new Promise<CountRow>((resolve, reject) => {
                    db.get('SELECT COUNT(*) as count FROM projects WHERE organization_id = ? AND status != "archived"', [orgId], (err, row) => {
                        if (err) reject(err);
                        else resolve(row as CountRow);
                    });
                });
                currentCount = result.count;
            } else if (limitKey === 'max_members') {
                const result = await new Promise<CountRow>((resolve, reject) => {
                    db.get('SELECT COUNT(*) as count FROM users WHERE organization_id = ?', [orgId], (err, row) => {
                        if (err) reject(err);
                        else resolve(row as CountRow);
                    });
                });
                currentCount = result.count;
            }
            // Add other checks (storage, models) here as needed

            // 3. Enforce
            if (currentCount >= (limitValue as number)) {
                res.status(403).json({
                    error: `Plan limit reached: ${limitKey}. Current: ${currentCount}, Limit: ${limitValue}. Upgrade to Pro/Enterprise for more.`
                });
                return;
            }

            next();
        } catch (error) {
            console.error('Plan limit check error:', error);
            res.status(500).json({ error: 'Failed to verify plan limits' });
        }
    };
};

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
    deps = { ...getDeps(), ...newDeps };
};

