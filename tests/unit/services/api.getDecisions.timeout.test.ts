import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';

describe('Api.getDecisions timeout contract', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.setItem('token', 'signed-test-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('aborts a hanging request at 20 seconds with a stable timeout code', async () => {
    let observedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        observedSignal = init?.signal as AbortSignal;
        return new Promise<Response>((_resolve, reject) => {
          observedSignal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        });
      })
    );

    const pending = Api.getDecisions();
    const rejection = expect(pending).rejects.toMatchObject({
      message: 'Decision request timed out',
      code: 'DECISIONS_REQUEST_TIMEOUT',
    });
    await vi.advanceTimersByTimeAsync(20_000);

    await rejection;
    expect(observedSignal?.aborted).toBe(true);
  });

  it('clears the timeout after a successful response', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ decisions: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    await expect(Api.getDecisions()).resolves.toEqual([]);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });
});
