import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWithRetry, handleResponse } = vi.hoisted(() => ({
  fetchWithRetry: vi.fn(),
  handleResponse: vi.fn(),
}));

vi.mock('../baseClient', () => ({ fetchWithRetry, handleResponse }));

import { getMyWorkContextSummary } from '../myWorkContext';

describe('getMyWorkContextSummary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the authenticated typed API client and returns its checked payload', async () => {
    const response = new Response('{}', { status: 200 });
    const summary = { totalOpenTasks: 3, pendingDecisionCount: 1 };
    fetchWithRetry.mockResolvedValue(response);
    handleResponse.mockResolvedValue(summary);

    await expect(getMyWorkContextSummary()).resolves.toEqual(summary);
    expect(fetchWithRetry).toHaveBeenCalledWith('/api/my-work/context-summary');
    expect(handleResponse).toHaveBeenCalledWith(response, 'GET My Work context summary');
  });
});
