/**
 * Plan Limits Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Plan limit checking middleware
 */

import type { NextFunction, Request, Response } from 'express';

import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

type AccessPolicyServiceLike = {
  checkAccess: (
    organizationId: string,
    action: 'create_project'
  ) => Promise<{ allowed: boolean; reason?: string; errorCode?: string }>;
};

const LIMIT_ACTION_MAP: Record<string, 'create_project' | undefined> = {
  max_projects: 'create_project',
};

let accessPolicyService: AccessPolicyServiceLike | null = null;

async function getAccessPolicyService(): Promise<AccessPolicyServiceLike> {
  if (accessPolicyService) return accessPolicyService;
  const mod = await import('../services/accessPolicyService.js');
  accessPolicyService = (mod.default || mod) as AccessPolicyServiceLike;
  return accessPolicyService;
}

/**
 * Check plan limit middleware factory
 */
export const checkPlanLimit = (limitKey: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const action = LIMIT_ACTION_MAP[limitKey];
    if (!action) {
      next();
      return;
    }

    const authReq = req as AuthRequest;
    const organizationId = authReq.organizationId || authReq.user?.organizationId;
    if (!organizationId) {
      res.status(401).json({ error: 'Unauthorized', errorCode: 'ORG_CONTEXT_REQUIRED' });
      return;
    }

    try {
      const service = await getAccessPolicyService();
      const result = await service.checkAccess(organizationId, action);
      if (!result.allowed) {
        res.status(429).json({
          error: result.reason || 'Plan limit reached',
          errorCode: result.errorCode || 'PLAN_LIMIT_REACHED',
          code: result.errorCode || 'PLAN_LIMIT_REACHED',
        });
        return;
      }
      next();
    } catch (error) {
      logger.error('[PlanLimits] Failed to enforce plan limit:', error);
      res.status(503).json({
        error: 'Plan limit service unavailable',
        errorCode: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
        code: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
      });
    }
  };
};

export default checkPlanLimit;
