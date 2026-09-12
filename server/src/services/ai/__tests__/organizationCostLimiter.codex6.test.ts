import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ensureDefaultOrganizationCostBudget, checkBudget } = vi.hoisted(() => ({
  ensureDefaultOrganizationCostBudget: vi.fn(),
  checkBudget: vi.fn(),
}));

vi.mock('../../aiBudgetService.js', () => ({
  default: { ensureDefaultOrganizationCostBudget, checkBudget },
}));

import {
  enforceOrganizationCostLimit,
  isOrganizationCostLimiterEnabled,
} from '../organizationCostLimiter.js';

describe('CODEX6 organization AI cost limiter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is default OFF and only an explicit true enables it', () => {
    expect(isOrganizationCostLimiterEnabled(undefined)).toBe(false);
    expect(isOrganizationCostLimiterEnabled('false')).toBe(false);
    expect(isOrganizationCostLimiterEnabled('true')).toBe(true);
  });

  it('provisions the $50 monthly default and allows an organization below it', async () => {
    ensureDefaultOrganizationCostBudget.mockResolvedValue({ budgetLimit: 50, currentUsage: 12 });
    checkBudget.mockResolvedValue({ allowed: true, warnings: [] });
    await expect(enforceOrganizationCostLimit('org-1', 'user-1')).resolves.toBeUndefined();
    expect(ensureDefaultOrganizationCostBudget).toHaveBeenCalledWith('org-1', 'user-1', 50);
  });

  it('blocks before provider use with an understandable organization-scoped message', async () => {
    ensureDefaultOrganizationCostBudget.mockResolvedValue({ budgetLimit: 50, currentUsage: 50 });
    checkBudget.mockResolvedValue({ allowed: false, warnings: ['cost budget exceeded'] });
    await expect(enforceOrganizationCostLimit('org-1', 'user-1')).rejects.toMatchObject({
      code: 'AI_BUDGET_EXHAUSTED',
      statusCode: 403,
      isBudgetError: true,
      retryable: false,
      message: expect.stringContaining('$50 monthly AI budget'),
      budgetStatus: expect.objectContaining({ scope: 'Organization', budgetLimit: 50 }),
    });
  });
});
