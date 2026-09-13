import { afterEach, describe, expect, it, vi } from 'vitest';

import { V8ExecutionControlApi } from '../execution-control';

describe('Execution forecast canonical UI client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends Initiative forecast intent only to the Runtime-v1 writer with CAS and request identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'APPLIED',
        aggregateVersion: 8,
        response: {
          initiativeId: 'initiative/a',
          before: { forecastStartDate: null, forecastEndDate: '2026-09-30' },
          after: { forecastStartDate: null, forecastEndDate: '2026-10-15' },
          receiptId: 'history-1',
          observedAt: '2026-09-13T09:00:00.000Z',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await V8ExecutionControlApi.interveneReplan({
      entityType: 'INITIATIVE',
      entityId: 'initiative/a',
      expectedVersion: 7,
      clientRequestId: 'forecast-ui-1',
      forecastEndDate: '2026-10-15',
      reason: 'Supplier delivery moved',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/initiatives/runtime-v1/initiatives/initiative%2Fa/forecast',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          expectedVersion: 7,
          clientRequestId: 'forecast-ui-1',
          forecastEndDate: '2026-10-15',
          reason: 'Supplier delivery moved',
        }),
      })
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/api/v8/execution-control');
  });
});
