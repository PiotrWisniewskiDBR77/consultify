/**
 * Plan Limits Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Enforces subscription plan limits (projects, storage, members, etc.)
 */

import { NextFunction, Response } from 'express';

import { getDatabase } from '../database/Database.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface Database {
  get: (
    sql: string,
    params: unknown[],
    callback: (err: Error | null, row: unknown) => void
  ) => void;
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
  max_memory_mb?: number;
  max_cpu_percent?: number;
  max_concurrent_ai_jobs?: number;
}

interface Dependencies {
  db: Database;
}

// ==========================================
// CONSTANTS
// ==========================================

/**
 * Plan Limits Configuration
 * Updated Jan 11, 2026 - Added memory, CPU, and concurrent job limits
 */
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    max_projects: 1,
    max_storage_mb: 100,
    can_use_advanced_models: 0, // 0 = false
    max_members: 1,
    max_memory_mb: 512,
    max_cpu_percent: 20,
    max_concurrent_ai_jobs: 2,
  },
  pro: {
    max_projects: 10,
    max_storage_mb: 5000,
    can_use_advanced_models: 1,
    max_members: 5,
    max_memory_mb: 2048,
    max_cpu_percent: 50,
    max_concurrent_ai_jobs: 10,
  },
  enterprise: {
    max_projects: 9999,
    max_storage_mb: 100000,
    can_use_advanced_models: 1,
    max_members: 9999,
    max_memory_mb: 8192,
    max_cpu_percent: 100,
    max_concurrent_ai_jobs: 50,
  },
};

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies = {
  db: getDatabase() as unknown as Database,
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
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(403).json({ error: 'No organization found' });
        return;
      }

      // 1. Get Organization Plan
      const org = await queryHelpers.queryOne<OrganizationRow>(
        'SELECT plan, status FROM organizations WHERE id = ?',
        [orgId]
      );

      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      // Allow trial as pro
      const plan = org.status === 'trial' ? 'pro' : org.plan || 'free';
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
      const limitValue = limits[limitKey];

      if (limitValue === undefined) {
        // Limit not defined for this plan? Allow or Log warning.
        logger.warn(`Limit key ${limitKey} not found for plan ${plan}`);
        next();
        return;
      }

      // 2. Check current usage
      let currentCount = 0;

      if (limitKey === 'max_projects') {
        const result = await queryHelpers.queryOne<CountRow>(
          'SELECT COUNT(*) as count FROM projects WHERE organization_id = ? AND status != "archived"',
          [orgId]
        );
        currentCount = result?.count || 0;
      } else if (limitKey === 'max_members') {
        const result = await queryHelpers.queryOne<CountRow>(
          'SELECT COUNT(*) as count FROM users WHERE organization_id = ?',
          [orgId]
        );
        currentCount = result?.count || 0;
      }
      // Add other checks (storage, models) here as needed

      // 3. Enforce
      if (currentCount >= (limitValue as number)) {
        res.status(403).json({
          error: `Plan limit reached: ${limitKey}. Current: ${currentCount}, Limit: ${limitValue}. Upgrade to Pro/Enterprise for more.`,
        });
        return;
      }

      next();
    } catch (error: unknown) {
      logger.error('Plan limit check error:', error);
      res.status(500).json({ error: 'Failed to verify plan limits' });
    }
  };
};

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
  deps = { ...deps, ...newDeps };
};
