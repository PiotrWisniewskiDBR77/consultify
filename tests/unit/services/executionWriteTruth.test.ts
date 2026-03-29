import { describe, expect, it, vi } from 'vitest';

import { refreshExecutionWriteTruth } from '@/services/executionWriteTruth';

describe('executionWriteTruth', () => {
  it('always queues a governed execution truth refresh after a write', async () => {
    const queueExecutionTruthRefresh = vi.fn();
    const refreshExecutiveSnapshot = vi.fn();

    await refreshExecutionWriteTruth({
      activeTab: 'timeline',
      currentProjectId: 'proj-1',
      queueExecutionTruthRefresh,
      refreshExecutiveSnapshot,
    });

    expect(queueExecutionTruthRefresh).toHaveBeenCalledTimes(1);
    expect(refreshExecutiveSnapshot).not.toHaveBeenCalled();
  });

  it('refreshes the executive snapshot when the operator is on the active list lane', async () => {
    const queueExecutionTruthRefresh = vi.fn();
    const refreshExecutiveSnapshot = vi.fn().mockResolvedValue(undefined);

    await refreshExecutionWriteTruth({
      activeTab: 'list',
      currentProjectId: 'proj-1',
      queueExecutionTruthRefresh,
      refreshExecutiveSnapshot,
    });

    expect(queueExecutionTruthRefresh).toHaveBeenCalledTimes(1);
    expect(refreshExecutiveSnapshot).toHaveBeenCalledWith({ refresh: true });
  });

  it('skips executive snapshot refresh when project context is missing', async () => {
    const queueExecutionTruthRefresh = vi.fn();
    const refreshExecutiveSnapshot = vi.fn();

    await refreshExecutionWriteTruth({
      activeTab: 'list',
      currentProjectId: null,
      queueExecutionTruthRefresh,
      refreshExecutiveSnapshot,
    });

    expect(queueExecutionTruthRefresh).toHaveBeenCalledTimes(1);
    expect(refreshExecutiveSnapshot).not.toHaveBeenCalled();
  });
});
