import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8PlanningApi } from '@/services/api/v8/planning';
import { v8Get } from '@/services/api/v8/client';

describe('V8PlanningApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests pending decision chains from the V8 planning namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      pendingDecisionChains: [
        {
          chainId: 'chain-1',
          organizationId: 'org-1',
          initiativeId: 'init-1',
          chainType: 'sequential',
          decisions: [{ decisionId: 'd-1', title: 'Approve scope', role: 'sponsor', status: 'pending' }],
          status: 'pending',
          createdAt: '2026-03-25T00:00:00Z',
          updatedAt: '2026-03-25T00:00:00Z',
          metadata: {},
        },
      ],
    });

    const data = await V8PlanningApi.getPendingDecisions();

    expect(v8Get).toHaveBeenCalledWith('/planning/pending-decisions');
    expect(data.pendingDecisionChains).toHaveLength(1);
    expect(data.pendingDecisionChains[0]?.decisions[0]?.status).toBe('pending');
  });
});
