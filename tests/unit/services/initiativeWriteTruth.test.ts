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

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  submitSourceProposal: vi.fn(),
  registerSourceProposal: vi.fn(),
  readRegisteredInitiative: vi.fn(),
}));

import { Api } from '@/services/api';
import {
  createInitiativeWriteTruth,
  getInitiativeStatusPreflightTruth,
  refreshInitiativeWriteTruth,
} from '@/services/initiativeWriteTruth';
import { V8PlanningApi } from '@/services/api/v8/planning';
import {
  readRegisteredInitiative,
  registerSourceProposal,
  submitSourceProposal,
} from '@/services/initiatives-execution/runtimeApi';

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

  it('creates through proposal and registration then trusts cold aggregate readback', async () => {
    vi.mocked(submitSourceProposal).mockResolvedValue({} as any);
    vi.mocked(registerSourceProposal).mockResolvedValue({} as any);
    vi.mocked(readRegisteredInitiative).mockResolvedValue({
      version: 1,
      updatedAt: '2026-08-21T00:00:00.000Z',
      initiative: {
        initiativeId: 'init-cold',
        lifecycleState: 'REGISTERED_DRAFT',
        title: 'Alpha',
        projectId: 'project-1',
        readiness: 'NOT_EVALUATED',
        source: {
          proposalId: 'proposal-1',
          proposalVersion: 1,
          sourceType: 'MANUAL_HUB',
          sourceId: 'manual-1',
          sourceVersion: 1,
        },
      },
    });

    const result = await createInitiativeWriteTruth({
      projectId: 'project-1',
      initiativeOwnerId: 'owner-1',
      title: 'Alpha',
      problem: 'Problem Alpha',
    });

    expect(Api.post).not.toHaveBeenCalled();
    expect(submitSourceProposal).toHaveBeenCalledOnce();
    expect(registerSourceProposal).toHaveBeenCalledOnce();
    expect(readRegisteredInitiative).toHaveBeenCalledOnce();
    expect(result.createdId).toBe(vi.mocked(readRegisteredInitiative).mock.calls[0]?.[0]);
    expect(result.truth.initiative?.title).toBe('Alpha');
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
