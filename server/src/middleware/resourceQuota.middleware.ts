import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';
import logger from '../utils/Logger.js';
import { queryOne } from '../utils/queryHelpers.js';

const getOrgId = (req: AuthRequest) => req.user?.organizationId;

export const checkMemoryQuota = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.status(403).json({ error: 'No organization found' });
    return;
  }

  try {
    const orgPlan = await queryOne(
      'SELECT subscription_plan_id FROM organizations WHERE id = ?',
      [orgId]
    );
    if (!orgPlan || !(orgPlan as Record<string, unknown>).subscription_plan_id) {
      next();
      return;
    }

    const plan = await queryOne('SELECT id, memory_limit_mb FROM subscription_plans WHERE id = ?', [
      (orgPlan as Record<string, unknown>).subscription_plan_id,
    ]);
    const memoryLimit = (plan as Record<string, unknown> | null)?.memory_limit_mb as number | null;
    if (!memoryLimit) {
      next();
      return;
    }

    const usage = await queryOne(
      'SELECT memory_usage_mb_current, cpu_usage_percent_avg FROM organization_resource_usage WHERE organization_id = ?',
      [orgId]
    );
    if (!usage) {
      res.status(500).json({ error: 'Organization data not found' });
      return;
    }

    const current = (usage as Record<string, unknown>).memory_usage_mb_current as number;
    if (current > memoryLimit) {
      res.status(429).json({
        error: 'Memory quota exceeded',
        details: {
          current,
          limit: memoryLimit,
          message: `Organization ${orgId} exceeded its memory quota`,
        },
      });
      return;
    }

    next();
  } catch (error) {
    logger.warn('[ResourceQuota] Memory quota check failed', error as Error);
    next();
  }
};

export const checkCPUQuota = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.status(403).json({ error: 'No organization found' });
    return;
  }

  try {
    const orgPlan = await queryOne(
      'SELECT subscription_plan_id FROM organizations WHERE id = ?',
      [orgId]
    );
    if (!orgPlan || !(orgPlan as Record<string, unknown>).subscription_plan_id) {
      next();
      return;
    }

    const plan = await queryOne('SELECT id, cpu_quota_percent FROM subscription_plans WHERE id = ?', [
      (orgPlan as Record<string, unknown>).subscription_plan_id,
    ]);
    const cpuLimit = (plan as Record<string, unknown> | null)?.cpu_quota_percent as number | null;
    if (!cpuLimit && cpuLimit !== 0) {
      next();
      return;
    }

    const usage = await queryOne(
      'SELECT cpu_usage_percent_avg FROM organization_resource_usage WHERE organization_id = ?',
      [orgId]
    );
    if (!usage) {
      res.status(500).json({ error: 'Organization data not found' });
      return;
    }

    const current = (usage as Record<string, unknown>).cpu_usage_percent_avg as number;
    if (current > cpuLimit) {
      res.status(429).json({
        error: 'CPU quota exceeded',
        details: {
          current,
          limit: cpuLimit,
          message: `Organization ${orgId} exceeded its CPU quota`,
        },
      });
      return;
    }

    next();
  } catch (error) {
    logger.warn('[ResourceQuota] CPU quota check failed', error as Error);
    next();
  }
};

export const checkBudgetQuota = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.status(403).json({ error: 'No organization found' });
    return;
  }

  try {
    const orgBudget = await queryOne(
      'SELECT monthly_budget_usd, budget_spent_current_period FROM organizations WHERE id = ?',
      [orgId]
    );
    if (!orgBudget) {
      res.status(500).json({ error: 'Organization not found' });
      return;
    }

    const monthlyBudget = (orgBudget as Record<string, unknown>).monthly_budget_usd as number | null;
    const spent = (orgBudget as Record<string, unknown>).budget_spent_current_period as number | null;

    if (!monthlyBudget && monthlyBudget !== 0) {
      next();
      return;
    }

    if ((spent || 0) > monthlyBudget) {
      res.status(429).json({
        error: 'Monthly budget exceeded',
        details: {
          spent: spent || 0,
          limit: monthlyBudget,
          message: `Organization ${orgId} exceeded its monthly budget`,
        },
      });
      return;
    }

    next();
  } catch (error) {
    logger.warn('[ResourceQuota] Budget quota check failed', error as Error);
    next();
  }
};

export default {
  checkMemoryQuota,
  checkCPUQuota,
  checkBudgetQuota,
};
