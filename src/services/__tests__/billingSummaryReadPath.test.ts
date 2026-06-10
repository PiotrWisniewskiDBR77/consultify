/**
 * @vitest-environment jsdom
 *
 * Read-path coverage for the core (non-Stripe) billing summary endpoints that
 * remain live under decision D8: GET /billing/current and GET /billing/usage.
 *
 * These are the honest, DB-backed reads the billing UI relies on while
 * self-serve payments are deferred. The tests pin:
 *   - the correct URL + method are hit,
 *   - a 200 JSON body is returned as-is,
 *   - a non-OK response throws using the server-provided error message.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api, API_URL } from '../api';

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('billing summary read path', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('auth_token', 'test-token');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('getCurrentBilling GETs /billing/current and returns the body', async () => {
    const payload = { plan: 'starter', status: 'active' };
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(payload));
    vi.stubGlobal('fetch', fetchMock);

    const result = await Api.getCurrentBilling();

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/billing/current`);
    // Default fetch method is GET (no method override on a read).
    expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('getUsage GETs /billing/usage and returns the body', async () => {
    const payload = { aiCalls: 12, storageMb: 340 };
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(payload));
    vi.stubGlobal('fetch', fetchMock);

    const result = await Api.getUsage();

    expect(result).toEqual(payload);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/billing/usage`);
  });

  it('throws with the server error message when /billing/current is not OK', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeJsonResponse({ error: 'Billing unavailable' }, 500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(Api.getCurrentBilling()).rejects.toThrow('Billing unavailable');
  });
});
