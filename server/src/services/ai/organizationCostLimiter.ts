import aiBudgetService from '../aiBudgetService.js';

export const DEFAULT_ORGANIZATION_AI_MONTHLY_BUDGET_USD = 50;

export function isOrganizationCostLimiterEnabled(
  value = process.env.AI_BUDGETS_ENABLED
): boolean {
  return String(value || '').trim().toLowerCase() === 'true';
}

export class OrganizationAiBudgetExhaustedError extends Error {
  readonly code = 'AI_BUDGET_EXHAUSTED';
  readonly statusCode = 403;
  readonly isBudgetError = true;
  readonly retryable = false;
  readonly budgetStatus: Record<string, unknown>;

  constructor(limitUsd: number, currentUsage: number) {
    super(
      `Your organization has used its $${limitUsd} monthly AI budget. Existing work remains available. Ask an administrator to raise the budget or wait for the next monthly reset.`
    );
    this.name = 'OrganizationAiBudgetExhaustedError';
    this.budgetStatus = {
      currentUsage,
      budgetLimit: limitUsd,
      usagePercent: limitUsd > 0 ? (currentUsage / limitUsd) * 100 : 100,
      scope: 'Organization',
      period: 'monthly',
    };
  }
}

export async function enforceOrganizationCostLimit(
  organizationId: string,
  userId: string
): Promise<void> {
  const budget = await aiBudgetService.ensureDefaultOrganizationCostBudget(
    organizationId,
    userId,
    DEFAULT_ORGANIZATION_AI_MONTHLY_BUDGET_USD
  );
  const check = await aiBudgetService.checkBudget(organizationId, userId, { tokens: 0, cost: 0 });
  if (!check.allowed) {
    const limit = 'budgetLimit' in budget
      ? Number(budget.budgetLimit)
      : DEFAULT_ORGANIZATION_AI_MONTHLY_BUDGET_USD;
    const currentUsage = 'currentUsage' in budget ? Number(budget.currentUsage) : limit;
    throw new OrganizationAiBudgetExhaustedError(
      limit || DEFAULT_ORGANIZATION_AI_MONTHLY_BUDGET_USD,
      currentUsage || 0
    );
  }
}
