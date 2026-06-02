import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/personalTasksCache', () => ({
  clearPersonalTasksCache: vi.fn(),
}));

describe('tokenService stability containment', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
    delete (window as typeof window & { __consultifyTokenServiceInitialized__?: unknown })
      .__consultifyTokenServiceInitialized__;
  });

  it('persists refresh backoff across a soft reload', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'temporary' }), { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('refreshToken', 'refresh-token');

    const firstImport = await import('@/services/tokenService');

    await expect(firstImport.tokenService.refreshToken()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('consultify:authRefreshBackoff:v1')).toContain('blockedUntil');

    vi.resetModules();
    const secondImport = await import('@/services/tokenService');

    await expect(secondImport.tokenService.refreshToken()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not initialize on module import and only initializes once when requested', async () => {
    vi.useFakeTimers();
    const tokenModule = await import('@/services/tokenService');
    const initSpy = vi.spyOn(tokenModule.tokenService, 'init');

    await vi.runAllTimersAsync();
    expect(initSpy).not.toHaveBeenCalled();

    tokenModule.initializeTokenServiceOnce();
    tokenModule.initializeTokenServiceOnce();

    await vi.advanceTimersByTimeAsync(250);
    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(
      (window as typeof window & { __consultifyTokenServiceInitialized__?: unknown })
        .__consultifyTokenServiceInitialized__
    ).toBe(true);
  });

  it('skips refresh attempts while the auth loop guard is open', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('refreshToken', 'refresh-token');
    sessionStorage.setItem(
      'consultify:authLoopGuard:v1',
      JSON.stringify({ blockedUntil: Date.now() + 60_000 })
    );

    const tokenModule = await import('@/services/tokenService');

    await expect(tokenModule.tokenService.refreshToken()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
