import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

/**
 * Guard for finding baseclient_20s_timeout, applied to the SECOND fetch client
 * (src/services/api.ts). Heavy AI/generation POSTs routed through `Api.*` methods
 * (studio generate, meeting-notes, initiative generation, wave5 artifacts, …)
 * must be able to raise the default 20s hard AbortController timeout via
 * `timeoutMs`. Before this fix `api.ts` hardcoded 20s/25s and silently dropped
 * any `timeoutMs` the call site passed, so heavy calls aborted mid-flight as
 * "Request timed out" (the same failure mode that killed deck materialize).
 *
 * This pins that api.ts `fetchWithRetryInner` honours a per-call `timeoutMs`.
 * We exercise it through the public `Api.generateStudioDiagram` method, which
 * passes `timeoutMs: 120000`.
 */
describe('api.ts timeout override (finding baseclient_20s_timeout)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does NOT abort a heavy Api.generateStudioDiagram before the 120s override elapses', async () => {
    // Resolves at 60s — past the OLD 20s default, well within the 120s override.
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const signal = init.signal;
          const timer = setTimeout(
            () =>
              resolve(
                new Response(JSON.stringify({ nodes: [], edges: [], diagramType: 'flow' }), {
                  status: 200,
                })
              ),
            60_000
          );
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            const err: any = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { Api } = await import('@/services/api');

    const p = Api.generateStudioDiagram('draw me an org chart', 'flow');
    const settled = p.then(
      (r) => ({ ok: true as const, r }),
      (e) => ({ ok: false as const, error: e })
    );

    // Past the OLD 20s default — must still be pending because of the override.
    await vi.advanceTimersByTimeAsync(20_001);
    // To when fetch resolves (60s total).
    await vi.advanceTimersByTimeAsync(40_000);

    const result = await settled;
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    // Unknown option must NOT leak onto the fetch init (it is consumed, not spread).
    expect((init as any).timeoutMs).toBeUndefined();
    expect(init.signal).toBeDefined();
  });

  it('still aborts a default (no-override) request at the 20s hard timeout', async () => {
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

    const { Api } = await import('@/services/api');

    // getConversations is a plain list GET with no override — keeps the 20s cap.
    const p = Api.getConversations();
    const settled = p.then(
      () => ({ timedOut: false as const }),
      (e: any) => ({ timedOut: true as const, code: e?.code })
    );

    await vi.advanceTimersByTimeAsync(20_001);

    const result = await settled;
    expect(result.timedOut).toBe(true);
    expect((result as any).code).toBe('REQUEST_TIMEOUT');
  });
});
