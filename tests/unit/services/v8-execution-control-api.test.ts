import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8ExecutionControlApi } from '@/services/api/v8/execution-control';
import { v8Get } from '@/services/api/v8/client';

describe('V8ExecutionControlApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests risk signals from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ signals: [], count: 0 });

    await V8ExecutionControlApi.getRiskSignals('proj-1');

    expect(v8Get).toHaveBeenCalledWith('/execution-control/risk-signals', {
      projectId: 'proj-1',
    });
  });

  it('requests timeline warnings from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ warnings: [], total: 0 });

    await V8ExecutionControlApi.getTimelineWarnings('proj-1');

    expect(v8Get).toHaveBeenCalledWith('/execution-control/timeline-warnings', {
      projectId: 'proj-1',
    });
  });

  it('requests delay signals from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ signals: [], count: 0, source: 'live' });

    await V8ExecutionControlApi.getDelaySignals({
      projectId: 'proj-1',
      persisted: true,
      severity: 'CRITICAL',
    });

    expect(v8Get).toHaveBeenCalledWith('/execution-control/delay-signals', {
      projectId: 'proj-1',
      persisted: 'true',
      severity: 'CRITICAL',
    });
  });

  it('requests portfolio budget summary from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ summary: null });

    await V8ExecutionControlApi.getBudgetPortfolio('proj-1');

    expect(v8Get).toHaveBeenCalledWith('/execution-control/budget/portfolio', {
      projectId: 'proj-1',
    });
  });

  it('requests overspend signals from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ signals: [], count: 0 });

    await V8ExecutionControlApi.getOverspendSignals('proj-1');

    expect(v8Get).toHaveBeenCalledWith('/execution-control/budget/overspend-signals', {
      projectId: 'proj-1',
    });
  });

  it('requests capacity leveling alerts from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ alerts: [] });

    await V8ExecutionControlApi.getCapacityLevelingAlerts();

    expect(v8Get).toHaveBeenCalledWith('/execution-control/capacity/leveling-alerts');
  });

  it('requests capacity timeline from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ weeks: [] });

    await V8ExecutionControlApi.getCapacityTimeline('init-1');

    expect(v8Get).toHaveBeenCalledWith('/execution-control/capacity/timeline', {
      initiativeId: 'init-1',
    });
  });
});
