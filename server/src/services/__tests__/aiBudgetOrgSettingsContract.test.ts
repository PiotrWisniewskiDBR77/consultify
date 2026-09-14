import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  budgets: [] as Array<Record<string, unknown>>,
  settings: null as Record<string, unknown> | null,
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: database.all,
  get: database.get,
  run: database.run,
}));

import aiBudgetService from '../aiBudgetService.js';

describe('organization AI settings budget authority', () => {
  beforeEach(() => {
    database.budgets = [];
    database.settings = null;
    database.all.mockReset().mockImplementation(async (sql: string) =>
      sql.includes('FROM ai_budgets') ? database.budgets : []
    );
    database.get.mockReset().mockImplementation(async (sql: string) =>
      sql.includes('FROM organization_ai_settings') ? database.settings : null
    );
    database.run.mockReset().mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('INSERT INTO ai_budgets')) {
        database.budgets.push({
          id: params[0],
          organization_id: params[1],
          user_id: null,
          budget_type: 'cost',
          period: 'monthly',
          budget_limit: params[2],
          hard_limit: params[3],
          current_usage: params[4],
          is_active: true,
        });
      }
      return { changes: 1 };
    });
  });

  it('uses the saved organization setting as the sole organization cost limit', async () => {
    database.settings = { monthly_budget_usd: 10, hard_limit_usd: 10, freeze_on_limit: true };
    database.budgets = [{
      id: 'legacy-budget', organization_id: 'org-a', user_id: null,
      budget_type: 'cost', period: 'monthly', budget_limit: 5,
      current_usage: 9, hard_limit: true, is_active: true,
    }];

    expect((await aiBudgetService.checkBudget('org-a', 'user-a', { tokens: 0, cost: 0 })).allowed).toBe(true);
    database.budgets.find((row) => String(row.id).startsWith('org-settings'))!.current_usage = 10;
    expect((await aiBudgetService.checkBudget('org-a', 'user-a', { tokens: 0, cost: 0 })).allowed).toBe(false);

    database.settings = { monthly_budget_usd: 20, hard_limit_usd: 20, freeze_on_limit: true };
    expect((await aiBudgetService.checkBudget('org-a', 'user-a', { tokens: 0, cost: 0 })).allowed).toBe(true);
  });

  it('creates the $50 organization ledger contract for a new organization', async () => {
    const result = await aiBudgetService.checkBudget('org-new', 'user-a', { tokens: 0, cost: 0 });
    expect(result.allowed).toBe(true);
    expect(database.budgets).toContainEqual(
      expect.objectContaining({ budget_limit: 50, budget_type: 'cost', period: 'monthly' })
    );
  });
});
