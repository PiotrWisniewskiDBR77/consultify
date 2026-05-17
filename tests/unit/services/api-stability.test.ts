import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n', () => ({
  default: {
    language: 'en',
    t: (key: string) => key,
  },
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('@/services/tokenService', () => ({
  tokenService: {
    getToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    refreshToken: vi.fn(() => null),
  },
}));

describe('Api stability containment', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('opens a local circuit for repeated conversation endpoint failures', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'missing' }), { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const { Api } = await import('@/services/api');

    await expect(Api.updateConversation('conv-404', { title: 'New title' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(Api.updateConversation('conv-404', { title: 'Retry title' })).rejects.toMatchObject(
      {
        status: 404,
        data: expect.objectContaining({ code: 'CLIENT_TRANSPORT_CIRCUIT_OPEN' }),
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('consultify:transportCircuit:v1')).toContain(
      '/api/conversations/conv-404'
    );
  });

  it('backs off demo status after a 429 without a second network hit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    const { Api } = await import('@/services/api');

    await expect(Api.getDemoStatus()).resolves.toEqual({ success: false, isDemoMode: false });
    await expect(Api.getDemoStatus()).resolves.toEqual({ success: false, isDemoMode: false });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('consultify-endpoint-backoff')).toContain('demo-status');
    expect(sessionStorage.getItem('consultify:transportCircuit:v1')).toContain('/api/demo/status');
  });
});
