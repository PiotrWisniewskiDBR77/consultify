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
const MAX_RESOURCE_QUOTA_ORG_ID_CHARS = 128;
const MAX_RESOURCE_QUOTA_PLAN_ID_CHARS = 256;

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);

const readFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'bigint') {
    if (value > MAX_SAFE_INTEGER_BIGINT || value < MIN_SAFE_INTEGER_BIGINT) return undefined;
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
const isPlainObjectRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = safeRead(() => Object.getPrototypeOf(value), null as object | null);
  return prototype === Object.prototype || prototype === null;
};

const responseAlreadyCommitted = (res: Response): boolean =>
  safeRead(() => res.headersSent, false) ||
  safeRead(() => (res as Response & { writableEnded?: boolean }).writableEnded === true, false) ||
  safeRead(() => (res as Response & { finished?: boolean }).finished === true, false) ||
  safeRead(() => (res as Response & { destroyed?: boolean }).destroyed === true, false);

const invokeNext = (next: NextFunction, phase: string): void => {
  if (typeof next !== 'function') return;
  try {
    const result: unknown = next();
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      void Promise.resolve(result as PromiseLike<unknown>).catch((error) => {
        logger.warn('[ResourceQuota] next() rejected', { phase, error });
      });
    }
  } catch (error) {
    logger.warn('[ResourceQuota] next() threw', { phase, error });
  }
};
const readSubscriptionPlanId = (orgPlan: Record<string, unknown> | null): string | undefined => {
  if (!orgPlan) return undefined;
  const raw = orgPlan.subscription_plan_id;
  if (typeof raw === 'string') return normalizeOptionalString(raw);
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'bigint') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return String(parsed);
  }
  return undefined;
};

const shouldSkipCommittedResponse = (res: Response, next: NextFunction): boolean => {
  if (responseAlreadyCommitted(res)) {
    invokeNext(next, 'response-committed');
    return true;
  }
  return false;
};
const invokeNextIfStillWritable = (res: Response, next: NextFunction, phase: string): void => {
  if (shouldSkipCommittedResponse(res, next)) return;
  invokeNext(next, phase);
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
    if (statusCode === 429) {
      safeRead(() => {
        res.setHeader('Retry-After', '60');
        return true;
      }, false);
    }
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
const toLoggableError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
};

const getOrgId = (req: AuthRequest): string | undefined =>
  normalizeOptionalString(safeRead(() => req.user?.organizationId, undefined)) ||
  normalizeOptionalString(
    safeRead(
      () => (req.user as { organization_id?: string } | undefined)?.organization_id,
      undefined
    )
  );

export const checkMemoryQuota = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (shouldSkipCommittedResponse(res, next)) return;
  const orgId = getOrgId(req);
  if (!orgId) {
    sendJsonIfOpen(res, next, 403, { error: 'No organization found' }, 'auth');
    return;
  }
  if (orgId.length > MAX_RESOURCE_QUOTA_ORG_ID_CHARS) {
    sendJsonIfOpen(res, next, 400, { error: 'Invalid organization context' }, 'auth');
    return;
  }

  try {
    const orgPlan = await queryOne(
      'SELECT subscription_plan_id FROM organization_billing WHERE organization_id = ?',
      [orgId]
    );
    if (orgPlan !== null && !isPlainObjectRecord(orgPlan)) {
      sendJsonIfOpen(res, next, 500, { error: 'Billing data is unavailable' }, 'data');
      return;
    }
    const subscriptionPlanId = readSubscriptionPlanId(orgPlan as Record<string, unknown> | null);
    if (!subscriptionPlanId) {
      invokeNextIfStillWritable(res, next, 'memory-no-plan');
      return;
    }
    if (subscriptionPlanId.length > MAX_RESOURCE_QUOTA_PLAN_ID_CHARS) {
      sendJsonIfOpen(res, next, 400, { error: 'Invalid billing context' }, 'auth');
      return;
    }

    const plan = await queryOne('SELECT id, memory_limit_mb FROM subscription_plans WHERE id = ?', [
      subscriptionPlanId,
    ]);
    if (shouldSkipCommittedResponse(res, next)) return;
    if (plan !== null && !isPlainObjectRecord(plan)) {
      sendJsonIfOpen(res, next, 500, { error: 'Billing data is unavailable' }, 'data');
      return;
    }
    const memoryLimit = readFiniteNumber(
      (plan as Record<string, unknown> | null)?.memory_limit_mb as unknown
    );
    if (memoryLimit === undefined || memoryLimit < 0) {
      invokeNextIfStillWritable(res, next, 'memory-invalid-limit');
      return;
    }

    const usage = await queryOne(
      'SELECT memory_usage_mb_current, cpu_usage_percent_avg FROM organization_resource_usage WHERE organization_id = ?',
      [orgId]
    );
    if (shouldSkipCommittedResponse(res, next)) return;
    if (!isPlainObjectRecord(usage)) {
      sendJsonIfOpen(res, next, 500, { error: 'Organization data not found' }, 'data');
      return;
    }

    const current = readFiniteNumber((usage as Record<string, unknown>).memory_usage_mb_current);
    if (current === undefined) {
      invokeNextIfStillWritable(res, next, 'memory-invalid-current');
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

    invokeNextIfStillWritable(res, next, 'memory-pass');
  } catch (error) {
    logger.warn('[ResourceQuota] Memory quota check failed', toLoggableError(error));
    invokeNextIfStillWritable(res, next, 'memory-catch');
  }
};

export const checkCPUQuota = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (shouldSkipCommittedResponse(res, next)) return;
  const orgId = getOrgId(req);
  if (!orgId) {
    sendJsonIfOpen(res, next, 403, { error: 'No organization found' }, 'auth');
    return;
  }
  if (orgId.length > MAX_RESOURCE_QUOTA_ORG_ID_CHARS) {
    sendJsonIfOpen(res, next, 400, { error: 'Invalid organization context' }, 'auth');
    return;
  }

  try {
    const orgPlan = await queryOne(
      'SELECT subscription_plan_id FROM organization_billing WHERE organization_id = ?',
      [orgId]
    );
    if (orgPlan !== null && !isPlainObjectRecord(orgPlan)) {
      sendJsonIfOpen(res, next, 500, { error: 'Billing data is unavailable' }, 'data');
      return;
    }
    const subscriptionPlanId = readSubscriptionPlanId(orgPlan as Record<string, unknown> | null);
    if (!subscriptionPlanId) {
      invokeNextIfStillWritable(res, next, 'cpu-no-plan');
      return;
    }
    if (subscriptionPlanId.length > MAX_RESOURCE_QUOTA_PLAN_ID_CHARS) {
      sendJsonIfOpen(res, next, 400, { error: 'Invalid billing context' }, 'auth');
      return;
    }

    const plan = await queryOne(
      'SELECT id, cpu_quota_percent FROM subscription_plans WHERE id = ?',
      [subscriptionPlanId]
    );
    if (shouldSkipCommittedResponse(res, next)) return;
    if (plan !== null && !isPlainObjectRecord(plan)) {
      sendJsonIfOpen(res, next, 500, { error: 'Billing data is unavailable' }, 'data');
      return;
    }
    const cpuLimit = readFiniteNumber(
      (plan as Record<string, unknown> | null)?.cpu_quota_percent as unknown
    );
    if (cpuLimit === undefined || cpuLimit < 0) {
      invokeNextIfStillWritable(res, next, 'cpu-invalid-limit');
      return;
    }

    const usage = await queryOne(
      'SELECT cpu_usage_percent_avg FROM organization_resource_usage WHERE organization_id = ?',
      [orgId]
    );
    if (shouldSkipCommittedResponse(res, next)) return;
    if (!isPlainObjectRecord(usage)) {
      sendJsonIfOpen(res, next, 500, { error: 'Organization data not found' }, 'data');
      return;
    }

    const current = readFiniteNumber((usage as Record<string, unknown>).cpu_usage_percent_avg);
    if (current === undefined) {
      invokeNextIfStillWritable(res, next, 'cpu-invalid-current');
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

    invokeNextIfStillWritable(res, next, 'cpu-pass');
  } catch (error) {
    logger.warn('[ResourceQuota] CPU quota check failed', toLoggableError(error));
    invokeNextIfStillWritable(res, next, 'cpu-catch');
  }
};

export const checkBudgetQuota = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (shouldSkipCommittedResponse(res, next)) return;
  const orgId = getOrgId(req);
  if (!orgId) {
    sendJsonIfOpen(res, next, 403, { error: 'No organization found' }, 'auth');
    return;
  }
  if (orgId.length > MAX_RESOURCE_QUOTA_ORG_ID_CHARS) {
    sendJsonIfOpen(res, next, 400, { error: 'Invalid organization context' }, 'auth');
    return;
  }

  try {
    const orgBudget = await queryOne(
      'SELECT monthly_budget_usd, budget_spent_current_period FROM organizations WHERE id = ?',
      [orgId]
    );
    if (shouldSkipCommittedResponse(res, next)) return;
    if (!isPlainObjectRecord(orgBudget)) {
      sendJsonIfOpen(res, next, 500, { error: 'Organization not found' }, 'data');
      return;
    }

    const monthlyBudget = readFiniteNumber(
      (orgBudget as Record<string, unknown>).monthly_budget_usd
    );
    const spentRaw = readFiniteNumber(
      (orgBudget as Record<string, unknown>).budget_spent_current_period
    );
    const spent = spentRaw ?? 0;

    if (monthlyBudget === undefined) {
      invokeNextIfStillWritable(res, next, 'budget-missing-limit');
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

    invokeNextIfStillWritable(res, next, 'budget-pass');
  } catch (error) {
    logger.warn('[ResourceQuota] Budget quota check failed', toLoggableError(error));
    invokeNextIfStillWritable(res, next, 'budget-catch');
  }
};

export default {
  checkMemoryQuota,
  checkCPUQuota,
  checkBudgetQuota,
};
