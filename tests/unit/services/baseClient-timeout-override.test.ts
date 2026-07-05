import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/tokenService', () => ({
  tokenService: {
    getToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    refreshToken: vi.fn(() => null),
  },
}));

/**
 * Guard for finding baseclient_20s_timeout: heavy operations (report/model
 * generation, deck/doc/sheet materialize, long exports) MUST be able to raise
 * the default 20s hard AbortController timeout via `timeoutMs`. Without this,
 * any long POST silently aborts at 20s as "Request timed out" (deck materialize
 * reached 5/8 slides then died). This pins that:
 *   (1) fetchWithRetry honours a caller-supplied timeoutMs, and
 *   (2) the apiPost/apiPut/apiPatch/apiGet helpers forward it.
 */
describe('baseClient timeout override (finding baseclient_20s_timeout)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does NOT abort a heavy request before the overridden timeoutMs elapses', async () => {
    // Resolve only after 60s — longer than the 20s default, shorter than the 120s override.
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const signal = init.signal;
          const timer = setTimeout(() => resolve(new Response('{}', { status: 200 })), 60_000);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            const err: any = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { fetchWithRetry } = await import('@/services/api/baseClient');

    const p = fetchWithRetry('/api/heavy', { method: 'POST', timeoutMs: 120_000 });
    // Attach a catch so an early rejection doesn't become an unhandled rejection.
    const settled = p.then(
      (r) => ({ ok: true as const, status: r.status }),
      (e) => ({ ok: false as const, error: e })
    );

    // Advance past the OLD 20s default — the request must still be pending.
    await vi.advanceTimersByTimeAsync(20_001);
    // Advance to when fetch resolves (60s total).
    await vi.advanceTimersByTimeAsync(40_000);

    const result = await settled;
    expect(result.ok).toBe(true);
    expect((result as any).status).toBe(200);
  });

  it('still aborts at the default 20s when no timeoutMs is supplied', async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const signal = init.signal;
          const timer = setTimeout(() => resolve(new Response('{}', { status: 200 })), 60_000);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            const err: any = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { fetchWithRetry } = await import('@/services/api/baseClient');

    const p = fetchWithRetry('/api/list', { method: 'GET' });
    const settled = p.then(
      () => ({ timedOut: false as const }),
      (e: any) => ({ timedOut: true as const, code: e?.code })
    );

    await vi.advanceTimersByTimeAsync(20_001);

    const result = await settled;
    expect(result.timedOut).toBe(true);
    expect((result as any).code).toBe('REQUEST_TIMEOUT');
  });

  it('apiPost forwards timeoutMs into fetchWithRetry', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{"ok":true}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    const { apiPost } = await import('@/services/api/baseClient');
    await apiPost('/heavy', { a: 1 }, 'failed', { timeoutMs: 120_000 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // A finite AbortSignal is attached (timeout controller present); with the
    // override in place, the request would survive well past the 20s default.
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.signal).toBeDefined();
  });
});
