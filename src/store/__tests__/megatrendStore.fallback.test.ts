import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMegatrendStore } from '../megatrendStore';

/**
 * F3b (pomiar DEC-463, 2026-09-10): the server degrades an unmapped industry
 * to 'general' with a 200 response instead of a 503 — see
 * server/src/routes/megatrend.routes.ts and server/src/models/megatrend.ts.
 * The fallback rides on two response headers (X-Megatrend-Fallback-Industry /
 * X-Megatrend-Requested-Industry) because the JSON body must stay a plain
 * array for backward compatibility. This locks in the client side of that
 * contract: `fallback` state is populated from the headers, and cleared on a
 * normal (non-fallback) response or a new fetch.
 */
function jsonResponse(body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: true,
    clone() {
      return this;
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(headers),
  } as unknown as Response;
}

describe('useMegatrendStore.fetchMegatrends — fallback notice (F3b / DEC-463)', () => {
  beforeEach(() => {
    useMegatrendStore.setState({ megatrends: [], loading: false, error: null, fallback: null });
    vi.restoreAllMocks();
  });

  it('sets fallback from response headers when the server degraded to general', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          [
            {
              id: 'mg-gen-1',
              label: 'Agentic AI',
              description: 'desc',
              type: 'Technology',
              baseImpactScore: 82,
              initialRing: 'On the Horizon',
            },
          ],
          {
            'X-Megatrend-Fallback-Industry': 'general',
            'X-Megatrend-Requested-Industry': 'financial',
          }
        )
      )
    );

    await useMegatrendStore.getState().fetchMegatrends('financial');

    const state = useMegatrendStore.getState();
    expect(state.megatrends).toHaveLength(1);
    expect(state.fallback).toEqual({ requestedIndustry: 'financial', fallbackIndustry: 'general' });
    expect(state.error).toBeNull();
  });

  it('leaves fallback null on an ordinary (non-fallback) response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse([
          {
            id: 'mg-mfg-1',
            label: 'Industrial AI',
            description: 'desc',
            type: 'Technology',
            baseImpactScore: 85,
            initialRing: 'Now',
          },
        ])
      )
    );

    await useMegatrendStore.getState().fetchMegatrends('Manufacturing');

    expect(useMegatrendStore.getState().fallback).toBeNull();
  });

  it('clears a stale fallback at the start of the next fetch', async () => {
    useMegatrendStore.setState({
      fallback: { requestedIndustry: 'financial', fallbackIndustry: 'general' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse([{ id: 'mg-1', label: 'x', type: 'Technology' }]))
    );

    const promise = useMegatrendStore.getState().fetchMegatrends('Manufacturing');
    // Fallback (and error) must be reset synchronously when the fetch starts,
    // not only once it resolves — otherwise a slow request keeps showing a
    // stale notice from the PREVIOUS industry while loading.
    expect(useMegatrendStore.getState().fallback).toBeNull();
    await promise;
    expect(useMegatrendStore.getState().fallback).toBeNull();
  });
});
