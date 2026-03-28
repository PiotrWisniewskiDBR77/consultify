import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/planning', () => ({
  V8PlanningApi: {
    getInitiative: vi.fn(),
    getGateReadiness: vi.fn(),
    getStatusHistory: vi.fn(),
    getHistory: vi.fn(),
  },
}));

import { Api } from '@/services/api';
import {
  createInitiativeWriteTruth,
  getInitiativeStatusPreflightTruth,
  refreshInitiativeWriteTruth,
} from '@/services/initiativeWriteTruth';
import { V8PlanningApi } from '@/services/api/v8/planning';

describe('initiativeWriteTruth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('derives transition and blocking items from governed gate readiness', async () => {
    vi.mocked(V8PlanningApi.getGateReadiness).mockResolvedValue({
      currentStatus: 'DRAFT',
      userRoles: ['PMO'],
      availableTransitions: [
        {
          targetStatus: 'REVIEW',
          gate: null,
          requiredRoles: [],
          assignedApprovers: [],
          canCurrentUserExecute: true,
          hasAssignedApprover: true,
        },
      ],
      readiness: [
        { key: 'owner', label: 'Owner assigned', pass: false, severity: 'blocking' },
        { key: 'budget', label: 'Budget estimated', pass: true, severity: 'warning' },
      ],
      allBlocking: false,
      allWarnings: false,
    } as any);

    const result = await getInitiativeStatusPreflightTruth('init-1', 'REVIEW');

    expect(result.transition?.targetStatus).toBe('REVIEW');
    expect(result.blockingItems).toEqual(['Owner assigned']);
  });

  it('hydrates a newly created initiative through governed read truth', async () => {
    vi.mocked(Api.post).mockResolvedValue({ id: 'init-1' });
    vi.mocked(V8PlanningApi.getInitiative).mockResolvedValue({ id: 'init-1', name: 'Alpha' } as any);
    vi.mocked(V8PlanningApi.getGateReadiness).mockResolvedValue(null as any);
    vi.mocked(V8PlanningApi.getStatusHistory).mockResolvedValue([]);
    vi.mocked(V8PlanningApi.getHistory).mockResolvedValue([]);

    const result = await createInitiativeWriteTruth({ title: 'Alpha' });

    expect(Api.post).toHaveBeenCalledWith('/initiatives', { title: 'Alpha' });
    expect(V8PlanningApi.getInitiative).toHaveBeenCalledWith('init-1');
    expect(result.createdId).toBe('init-1');
    expect(result.truth.initiative?.name).toBe('Alpha');
  });

  it('falls back to legacy initiative governance reads when V8 reads fail', async () => {
    vi.mocked(V8PlanningApi.getInitiative).mockRejectedValue(new Error('v8 down'));
    vi.mocked(V8PlanningApi.getGateReadiness).mockRejectedValue(new Error('v8 down'));
    vi.mocked(V8PlanningApi.getStatusHistory).mockRejectedValue(new Error('v8 down'));
    vi.mocked(V8PlanningApi.getHistory).mockRejectedValue(new Error('v8 down'));
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ id: 'init-1', name: 'Legacy Alpha' })
      .mockResolvedValueOnce({ readiness: [{ key: 'owner', pass: true }], availableTransitions: [] })
      .mockResolvedValueOnce({ history: [{ id: 'status-1' }] })
      .mockResolvedValueOnce({ events: [{ id: 'evt-1' }] });

    const result = await refreshInitiativeWriteTruth('init-1');

    expect(result.initiative?.name).toBe('Legacy Alpha');
    expect(result.gateReadiness?.readiness).toHaveLength(1);
    expect(result.statusHistory).toEqual([{ id: 'status-1' }]);
    expect(result.history).toEqual([{ id: 'evt-1' }]);
  });
});
