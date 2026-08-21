import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Delete: vi.fn(),
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8PostMultipart: vi.fn(),
  v8Put: vi.fn(),
}));

vi.mock('@/services/api/baseClient', () => ({
  fetchWithRetry: vi.fn(),
  getHeaders: vi.fn(() => ({ Authorization: 'Bearer test' })),
  handleResponse: vi.fn(),
}));

import { fetchWithRetry, handleResponse } from '@/services/api/baseClient';
import { V8FinanceApi } from '@/services/api/v8/finance';

describe('V8FinanceApi budget initiative unlink', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends exact CAS body and stable idempotency key through DELETE', async () => {
    const response = { ok: true } as Response;
    vi.mocked(fetchWithRetry).mockResolvedValue(response);
    vi.mocked(handleResponse).mockResolvedValue({
      data: {
        budgetId: 'budget/1',
        initiativeId: 'initiative/1',
        budgetVersion: 3,
        removedLinkSnapshot: {
          revenueUplift: '12',
          costSavings: '7',
          capexRequired: '3',
        },
        replay: false,
      },
    });

    const result = await V8FinanceApi.unlinkBudgetInitiative(
      'budget/1',
      'initiative/1',
      2,
      'unlink-key'
    );

    expect(fetchWithRetry).toHaveBeenCalledWith(
      '/api/v8/finance/budgets/budget%2F1/initiatives/initiative%2F1',
      {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test', 'Idempotency-Key': 'unlink-key' },
        body: JSON.stringify({ expectedVersion: 2 }),
      }
    );
    expect(handleResponse).toHaveBeenCalledWith(response, 'V8 DELETE budget initiative link');
    expect(result.budgetVersion).toBe(3);
  });
});
