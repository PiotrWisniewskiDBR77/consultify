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
});
