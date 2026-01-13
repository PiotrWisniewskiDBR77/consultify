/**
 * Memory Quota Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Enforces memory usage limits based on subscription plan
 */

import { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth.middleware.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

// ==========================================
// TYPES
// ==========================================

interface SubscriptionPlan {
  id: string;
  memory_limit_mb?: number;
  cpu_quota_percent?: number;
  max_concurrent_ai_jobs?: number;
}

interface OrganizationUsage {
  memory_usage_mb_current: number;
  cpu_usage_percent_avg: number;
}

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Check if organization is within memory quota
 * NOTE: Actual memory tracking requires production-level monitoring infrastructure
 */
export const checkMemoryQuota = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(403).json({ error: 'No organization found' });
      return;
    }

    // Get organization's subscription plan
    const org = await queryHelpers.queryOne<{ subscription_plan_id?: string }>(
      'SELECT subscription_plan_id FROM organization_billing WHERE organization_id = ?',
      [orgId]
    );

    if (!org?.subscription_plan_id) {
      // No plan set, allow request (default behavior)
      logger.warn(`[MemoryQuota] No subscription plan found for org ${orgId}`);
      next();
      return;
    }

    // Get plan limits
    const plan = await queryHelpers.queryOne<SubscriptionPlan>(
      'SELECT id, memory_limit_mb, cpu_quota_percent, max_concurrent_ai_jobs FROM subscription_plans WHERE id = ?',
      [org.subscription_plan_id]
    );

    if (!plan?.memory_limit_mb) {
      // No memory limit defined, allow request
      next();
      return;
    }

    // Get current memory usage
    const usage = await queryHelpers.queryOne<OrganizationUsage>(
      'SELECT memory_usage_mb_current, cpu_usage_percent_avg FROM organizations WHERE id = ?',
      [orgId]
    );

    if (!usage) {
      logger.error(`[MemoryQuota] Organization ${orgId} not found`);
      res.status(500).json({ error: 'Organization data not found' });
      return;
    }

    // Check if memory quota exceeded
    if (usage.memory_usage_mb_current > plan.memory_limit_mb) {
      logger.warn(
        `[MemoryQuota] Memory quota exceeded for org ${orgId}: ${usage.memory_usage_mb_current}MB / ${plan.memory_limit_mb}MB`
      );
      res.status(429).json({
        error: 'Memory quota exceeded',
        details: {
          current: usage.memory_usage_mb_current,
          limit: plan.memory_limit_mb,
          message:
            'Your organization has exceeded its memory quota. Please upgrade your plan or reduce resource usage.',
        },
      });
      return;
    }

    // All good, proceed
    next();
  } catch (error: unknown) {
    logger.error('[MemoryQuota] Error checking memory quota:', error);
    // Don't block requests on quota check errors
    next();
  }
};

/**
 * Check CPU quota (similar to memory quota)
 */
export const checkCPUQuota = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(403).json({ error: 'No organization found' });
      return;
    }

    // Get organization's subscription plan
    const org = await queryHelpers.queryOne<{ subscription_plan_id?: string }>(
      'SELECT subscription_plan_id FROM organization_billing WHERE organization_id = ?',
      [orgId]
    );

    if (!org?.subscription_plan_id) {
      next();
      return;
    }

    // Get plan limits
    const plan = await queryHelpers.queryOne<SubscriptionPlan>(
      'SELECT id, cpu_quota_percent FROM subscription_plans WHERE id = ?',
      [org.subscription_plan_id]
    );

    if (!plan?.cpu_quota_percent) {
      next();
      return;
    }

    // Get current CPU usage
    const usage = await queryHelpers.queryOne<OrganizationUsage>(
      'SELECT cpu_usage_percent_avg FROM organizations WHERE id = ?',
      [orgId]
    );

    if (!usage) {
      res.status(500).json({ error: 'Organization data not found' });
      return;
    }

    // Check if CPU quota exceeded
    if (usage.cpu_usage_percent_avg > plan.cpu_quota_percent) {
      logger.warn(
        `[CPUQuota] CPU quota exceeded for org ${orgId}: ${usage.cpu_usage_percent_avg}% / ${plan.cpu_quota_percent}%`
      );
      res.status(429).json({
        error: 'CPU quota exceeded',
        details: {
          current: usage.cpu_usage_percent_avg,
          limit: plan.cpu_quota_percent,
          message:
            'Your organization has exceeded its CPU quota. Please upgrade your plan or reduce resource usage.',
        },
      });
      return;
    }

    next();
  } catch (error: unknown) {
    logger.error('[CPUQuota] Error checking CPU quota:', error);
    next();
  }
};

/**
 * Check budget quota (integration with BudgetTrackingService)
 */
export const checkBudgetQuota = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(403).json({ error: 'No organization found' });
      return;
    }

    // Get budget status
    const org = await queryHelpers.queryOne<{
      monthly_budget_usd?: number;
      budget_spent_current_period: number;
    }>('SELECT monthly_budget_usd, budget_spent_current_period FROM organizations WHERE id = ?', [
      orgId,
    ]);

    if (!org) {
      res.status(500).json({ error: 'Organization not found' });
      return;
    }

    // If no budget set, allow
    if (!org.monthly_budget_usd) {
      next();
      return;
    }

    // Check if budget exceeded
    if (org.budget_spent_current_period > org.monthly_budget_usd) {
      logger.warn(
        `[BudgetQuota] Budget exceeded for org ${orgId}: $${org.budget_spent_current_period} / $${org.monthly_budget_usd}`
      );
      res.status(429).json({
        error: 'Monthly budget exceeded',
        details: {
          spent: org.budget_spent_current_period,
          limit: org.monthly_budget_usd,
          message:
            'Your organization has exceeded its monthly budget. Please upgrade your plan or wait for the next billing period.',
        },
      });
      return;
    }

    next();
  } catch (error: unknown) {
    logger.error('[BudgetQuota] Error checking budget quota:', error);
    next();
  }
};
