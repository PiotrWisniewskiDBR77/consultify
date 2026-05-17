import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installQueryFailureWebPerf } from '@/lib/installQueryFailureWebPerf';

describe('installQueryFailureWebPerf contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks settled query failures with namespaced key fingerprint', async () => {
    const mark = vi.fn();
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: { mark },
    });

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0 },
      },
    });
    const unsubscribe = installQueryFailureWebPerf(client);

    await expect(
      client.fetchQuery({
        queryKey: ['pack08', 's5', { a: 1 }],
        queryFn: async () => {
          throw new Error('boom');
        },
      })
    ).rejects.toThrow('boom');

    expect(mark).toHaveBeenCalledTimes(1);
    const queryMark = String(mark.mock.calls[0]?.[0]);
    expect(queryMark.startsWith('consultify:rq-error:')).toBe(true);
    expect(queryMark).toContain('pack08');
    expect(queryMark.length).toBeLessThanOrEqual(120);
    unsubscribe();
  });

  it('marks mutation failures and stays fail-soft when performance is missing', async () => {
    const mark = vi.fn();
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: { mark },
    });

    const client = new QueryClient({
      defaultOptions: {
        mutations: { retry: 0 },
      },
    });
    const unsubscribe = installQueryFailureWebPerf(client);

    await expect(
      client.getMutationCache().build(client, {
        mutationKey: ['mutation', 'pack08-s5'],
        mutationFn: async () => {
          throw new Error('mutation fail');
        },
      }).execute(undefined)
    ).rejects.toThrow('mutation fail');

    expect(mark).toHaveBeenCalledTimes(1);
    const mutationMark = String(mark.mock.calls[0]?.[0]);
    expect(mutationMark.startsWith('consultify:mt-error:')).toBe(true);

    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: undefined,
    });

    await expect(
      client.fetchQuery({
        queryKey: ['pack08', 'missing-performance'],
        queryFn: async () => {
          throw new Error('no performance');
        },
      })
    ).rejects.toThrow('no performance');

    unsubscribe();
  });
});

