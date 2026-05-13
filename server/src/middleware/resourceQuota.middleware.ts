import type { NextFunction, Response } from 'express';

import logger from '../utils/Logger.js';
import { queryOne } from '../utils/queryHelpers.js';
import type { AuthRequest } from './auth.middleware.js';

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const readFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'bigint') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const responseAlreadyCommitted = (res: Response): boolean =>
  safeRead(() => res.headersSent, false) ||
  safeRead(() => (res as Response & { writableEnded?: boolean }).writableEnded === true, false) ||
  safeRead(() => (res as Response & { finished?: boolean }).finished === true, false);

const invokeNext = (next: NextFunction, phase: string): void => {
  if (typeof next !== 'function') return;
  try {
    next();
  } catch (error) {
    logger.warn('[ResourceQuota] next() threw', { phase, error });
  }
};

const shouldSkipCommittedResponse = (res: Response, next: NextFunction): boolean => {
  if (responseAlreadyCommitted(res)) {
    invokeNext(next, 'response-committed');
    return true;
  }
  return false;
};
const sendJsonIfOpen = (
  res: Response,
  next: NextFunction,
  statusCode: number,
  payload: Record<string, unknown>,
  kind: 'memory' | 'cpu' | 'budget' | 'auth' | 'data'
): boolean => {
  if (shouldSkipCommittedResponse(res, next)) return false;
  try {
    res.status(statusCode).json(payload);
    return true;
  } catch (error) {
    logger.warn('[ResourceQuota] Response write failed', { kind, statusCode, error });
    if (responseAlreadyCommitted(res)) return false;
    invokeNext(next, `write-failure-${kind}`);
    return false;
  }
};
const safeQuotaMessage = (label: string): string => `${label} quota exceeded for this organization`;
const logQuotaExceeded = (
  kind: 'memory' | 'cpu' | 'budget',
  organizationId: string,
  current: number,
  limit: number
): void => {
  logger.warn('[ResourceQuota] Quota exceeded', { kind, organizationId, current, limit });
};

const getOrgId = (req: AuthRequest): string | undefined =>
  normalizeOptionalString(safeRead(() => req.user?.organizationId, undefined)) ||
  normalizeOptionalString(
    safeRead(() => (req.user as { organization_id?: string } | undefined)?.organization_id, undefined)
  );

export const checkMemoryQuota = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (shouldSkipCommittedResponse(res, next)) return;
  const orgId = getOrgId(req);
  if (!orgId) {
    sendJsonIfOpen(res, next, 403, { error: 'No organization found' }, 'auth');
    return;
  }

  try {
    const orgPlan = await queryOne(
      'SELECT subscription_plan_id FROM organization_billing WHERE organization_id = ?',
      [orgId]
    );
    if (!orgPlan || !(orgPlan as Record<string, unknown>).subscription_plan_id) {
      invokeNext(next, 'memory-no-plan');
      return;
    }

    const plan = await queryOne('SELECT id, memory_limit_mb FROM subscription_plans WHERE id = ?', [
      (orgPlan as Record<string, unknown>).subscription_plan_id,
    ]);
    const memoryLimit = readFiniteNumber(
      (plan as Record<string, unknown> | null)?.memory_limit_mb as unknown
    );
    if (memoryLimit === undefined || memoryLimit < 0) {
      invokeNext(next, 'memory-invalid-limit');
      return;
    }

    const usage = await queryOne(
      'SELECT memory_usage_mb_current, cpu_usage_percent_avg FROM organization_resource_usage WHERE organization_id = ?',
      [orgId]
    );
    if (shouldSkipCommittedResponse(res, next)) return;
    if (!usage) {
      sendJsonIfOpen(res, next, 500, { error: 'Organization data not found' }, 'data');
      return;
    }

    const current = readFiniteNumber((usage as Record<string, unknown>).memory_usage_mb_current);
    if (current === undefined) {
      invokeNext(next, 'memory-invalid-current');
      return;
    }
    if (current > memoryLimit) {
      logQuotaExceeded('memory', orgId, current, memoryLimit);
      sendJsonIfOpen(
        res,
        next,
        429,
        {
        error: 'Memory quota exceeded',
        details: {
          current,
          limit: memoryLimit,
          message: safeQuotaMessage('Memory'),
        },
      },
        'memory'
      );
      return;
    }

    invokeNext(next, 'memory-pass');
  } catch (error) {
    logger.warn('[ResourceQuota] Memory quota check failed', error as Error);
    if (responseAlreadyCommitted(res)) return;
    invokeNext(next, 'memory-catch');
  }
};

export const checkCPUQuota = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (shouldSkipCommittedResponse(res, next)) return;
  const orgId = getOrgId(req);
  if (!orgId) {
    sendJsonIfOpen(res, next, 403, { error: 'No organization found' }, 'auth');
    return;
  }

  try {
    const orgPlan = await queryOne(
      'SELECT subscription_plan_id FROM organization_billing WHERE organization_id = ?',
      [orgId]
    );
    if (!orgPlan || !(orgPlan as Record<string, unknown>).subscription_plan_id) {
      invokeNext(next, 'cpu-no-plan');
      return;
    }

    const plan = await queryOne(
      'SELECT id, cpu_quota_percent FROM subscription_plans WHERE id = ?',
      [(orgPlan as Record<string, unknown>).subscription_plan_id]
    );
    const cpuLimit = readFiniteNumber(
      (plan as Record<string, unknown> | null)?.cpu_quota_percent as unknown
    );
    if (cpuLimit === undefined || cpuLimit < 0) {
      invokeNext(next, 'cpu-invalid-limit');
      return;
    }

    const usage = await queryOne(
      'SELECT cpu_usage_percent_avg FROM organization_resource_usage WHERE organization_id = ?',
      [orgId]
    );
    if (shouldSkipCommittedResponse(res, next)) return;
    if (!usage) {
      sendJsonIfOpen(res, next, 500, { error: 'Organization data not found' }, 'data');
      return;
    }

    const current = readFiniteNumber((usage as Record<string, unknown>).cpu_usage_percent_avg);
    if (current === undefined) {
      invokeNext(next, 'cpu-invalid-current');
      return;
    }
    if (current > cpuLimit) {
      logQuotaExceeded('cpu', orgId, current, cpuLimit);
      sendJsonIfOpen(
        res,
        next,
        429,
        {
        error: 'CPU quota exceeded',
        details: {
          current,
          limit: cpuLimit,
          message: safeQuotaMessage('CPU'),
        },
      },
        'cpu'
      );
      return;
    }

    invokeNext(next, 'cpu-pass');
  } catch (error) {
    logger.warn('[ResourceQuota] CPU quota check failed', error as Error);
    if (responseAlreadyCommitted(res)) return;
    invokeNext(next, 'cpu-catch');
  }
};

export const checkBudgetQuota = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (shouldSkipCommittedResponse(res, next)) return;
  const orgId = getOrgId(req);
  if (!orgId) {
    sendJsonIfOpen(res, next, 403, { error: 'No organization found' }, 'auth');
    return;
  }

  try {
    const orgBudget = await queryOne(
      'SELECT monthly_budget_usd, budget_spent_current_period FROM organizations WHERE id = ?',
      [orgId]
    );
    if (shouldSkipCommittedResponse(res, next)) return;
    if (!orgBudget) {
      sendJsonIfOpen(res, next, 500, { error: 'Organization not found' }, 'data');
      return;
    }

    const monthlyBudget = readFiniteNumber((orgBudget as Record<string, unknown>).monthly_budget_usd);
    const spentRaw = readFiniteNumber(
      (orgBudget as Record<string, unknown>).budget_spent_current_period
    );
    const spent = spentRaw ?? 0;

    if (monthlyBudget === undefined) {
      invokeNext(next, 'budget-missing-limit');
      return;
    }

    if (spent > monthlyBudget) {
      logQuotaExceeded('budget', orgId, spent, monthlyBudget);
      sendJsonIfOpen(
        res,
        next,
        429,
        {
        error: 'Monthly budget exceeded',
        details: {
          spent,
          limit: monthlyBudget,
          message: safeQuotaMessage('Monthly budget'),
        },
      },
        'budget'
      );
      return;
    }

    invokeNext(next, 'budget-pass');
  } catch (error) {
    logger.warn('[ResourceQuota] Budget quota check failed', error as Error);
    if (responseAlreadyCommitted(res)) return;
    invokeNext(next, 'budget-catch');
  }
};

export default {
  checkMemoryQuota,
  checkCPUQuota,
  checkBudgetQuota,
};
