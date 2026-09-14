import { afterEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/services/api');

import { Api, API_URL, clearGlobalTransportFailure, resetAuthLoopGuard } from '@/services/api';

describe('superadmin system health client route', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the guarded detailed endpoint removed from the public base route', async () => {
    localStorage.clear();
    localStorage.setItem('token', 'superadmin-token');
    clearGlobalTransportFailure();
    resetAuthLoopGuard();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'healthy', services: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await Api.getSystemHealth();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API_URL}/system-health/detailed`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: 'Bearer superadmin-token' }),
    });
  });
});
