/**
 * subscriberDashboardClient.test
 *
 * Pure-logic + jsdom test suite for the read-only subscriber dashboard
 * client. Vitest's default `jsdom` environment supplies `window`,
 * `sessionStorage`, and `history`; the SSR assertions explicitly
 * unset `globalThis.window` to verify the helpers no-op without a DOM.
 *
 * `fetch` is stubbed via `vi.stubGlobal` so we can assert the exact
 * URL/headers without any real network traffic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ClientSubscriberSnapshot,
  extractTokenFromHash,
  fetchSubscriberDashboard,
  scrubTokenFromHash,
  sessionTokenStore,
  SUBSCRIBER_DASHBOARD_PATH,
  SUBSCRIBER_TOKEN_STORAGE_KEY,
  validateSnapshot,
} from '../subscriberDashboardClient';

const VALID_TOKEN = 'a'.repeat(64);
const ANOTHER_VALID_TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function buildSnapshot(
  overrides: Partial<ClientSubscriberSnapshot> = {}
): ClientSubscriberSnapshot {
  return {
    subscription: {
      id: 'sub_123',
      channel: 'webhook',
      target: 'https://hooks.sl****abcd',
      minSeverity: 'P1',
      active: true,
      secretRotatedAt: '2026-01-01T00:00:00.000Z',
    },
    signature: {
      algorithm: 'HMAC-SHA256',
      secretLastRotatedAt: '2026-01-01T00:00:00.000Z',
      daysSinceRotation: 30,
      rotationDueWithinDays: null,
    },
    delivery: {
      last7Days: { sent: 5, failed: 0, suppressed: 0, dryRun: 0 },
      last30Days: { sent: 20, failed: 1, suppressed: 0, dryRun: 0 },
      lastDispatchAt: '2026-05-06T12:00:00.000Z',
      lastFailureAt: null,
      consecutiveFailures: 0,
    },
    recentDispatches: [
      {
        id: 'dispatch_1',
        dispatchedAt: '2026-05-06T12:00:00.000Z',
        status: 'sent',
        httpStatus: 200,
        toVerdict: 'BLOCKED_P0',
        deckIdMasked: 'deck****',
        signaturePresent: true,
        signatureAlgorithm: 'HMAC-SHA256',
      },
    ],
    health: { overall: 'healthy', reasons: [] },
    warnings: [],
    ...overrides,
  };
}

beforeEach(() => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.clear();
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ----------------------------------------------------------------------------
// extractTokenFromHash
// ----------------------------------------------------------------------------

describe('extractTokenFromHash', () => {
  it('returns the token from a #token=<64-hex> hash', () => {
    expect(extractTokenFromHash(`#token=${VALID_TOKEN}`)).toBe(VALID_TOKEN);
  });

  it('returns null for a hash with no token key', () => {
    expect(extractTokenFromHash('#foo=bar')).toBeNull();
  });

  it('returns null for a token shorter than 64 hex chars', () => {
    expect(extractTokenFromHash('#token=abc123')).toBeNull();
  });

  it('returns null for a token with non-hex characters', () => {
    const bad = 'g'.repeat(64);
    expect(extractTokenFromHash(`#token=${bad}`)).toBeNull();
  });

  it('handles multi-key hashes (token first or later)', () => {
    expect(extractTokenFromHash(`#token=${VALID_TOKEN}&debug=1`)).toBe(VALID_TOKEN);
    expect(extractTokenFromHash(`#debug=1&token=${ANOTHER_VALID_TOKEN}`)).toBe(ANOTHER_VALID_TOKEN);
  });

  it('returns null for empty / non-string input', () => {
    expect(extractTokenFromHash('')).toBeNull();
    expect(extractTokenFromHash('#')).toBeNull();
    expect(extractTokenFromHash(undefined as unknown as string)).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// sessionTokenStore
// ----------------------------------------------------------------------------

describe('sessionTokenStore', () => {
  it('rejects a malformed token format on saveToken', () => {
    sessionTokenStore.saveToken('not-a-real-token');
    expect(window.sessionStorage.getItem(SUBSCRIBER_TOKEN_STORAGE_KEY)).toBeNull();
    expect(sessionTokenStore.hasToken()).toBe(false);
  });

  it('rejects an uppercase hex string on saveToken (must be lowercase)', () => {
    const upper = 'A'.repeat(64);
    sessionTokenStore.saveToken(upper);
    expect(window.sessionStorage.getItem(SUBSCRIBER_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('accepts and round-trips a valid 64-hex token', () => {
    sessionTokenStore.saveToken(VALID_TOKEN);
    expect(sessionTokenStore.getToken()).toBe(VALID_TOKEN);
    expect(sessionTokenStore.hasToken()).toBe(true);
  });

  it('returns null from getToken when nothing is saved', () => {
    expect(sessionTokenStore.getToken()).toBeNull();
    expect(sessionTokenStore.hasToken()).toBe(false);
  });

  it('clearToken removes the storage entry', () => {
    sessionTokenStore.saveToken(VALID_TOKEN);
    sessionTokenStore.clearToken();
    expect(sessionTokenStore.getToken()).toBeNull();
    expect(window.sessionStorage.getItem(SUBSCRIBER_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('never persists to localStorage', () => {
    sessionTokenStore.saveToken(VALID_TOKEN);
    expect(window.localStorage.getItem(SUBSCRIBER_TOKEN_STORAGE_KEY)).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// fetchSubscriberDashboard
// ----------------------------------------------------------------------------

function makeJsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

describe('fetchSubscriberDashboard', () => {
  it('returns unauthorized when the response is HTTP 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeJsonResponse({ reason: 'token_not_found' }, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSubscriberDashboard({ token: VALID_TOKEN });
    expect(result.status).toBe('unauthorized');
    expect(result.reason).toBe('token_not_found');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(SUBSCRIBER_DASHBOARD_PATH);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${VALID_TOKEN}`);
    expect(init.credentials).toBe('omit');
  });

  it('returns forbidden on HTTP 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeJsonResponse({}, { status: 403 })));
    const result = await fetchSubscriberDashboard({ token: VALID_TOKEN });
    expect(result.status).toBe('forbidden');
  });

  it('returns rate_limited on HTTP 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeJsonResponse({}, { status: 429 })));
    const result = await fetchSubscriberDashboard({ token: VALID_TOKEN });
    expect(result.status).toBe('rate_limited');
  });

  it('returns storage_unavailable on HTTP 503', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeJsonResponse({}, { status: 503 })));
    const result = await fetchSubscriberDashboard({ token: VALID_TOKEN });
    expect(result.status).toBe('storage_unavailable');
  });

  it('returns network_error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const result = await fetchSubscriberDashboard({ token: VALID_TOKEN });
    expect(result.status).toBe('network_error');
    expect(result.reason).toBe('network down');
  });

  it('returns ok with normalized data on a successful response', async () => {
    const snap = buildSnapshot();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeJsonResponse({ success: true, data: snap }, { status: 200 }))
    );

    const result = await fetchSubscriberDashboard({ token: VALID_TOKEN });
    expect(result.status).toBe('ok');
    expect(result.data).toBeDefined();
    expect(result.data?.subscription.id).toBe('sub_123');
    expect(result.data?.health.overall).toBe('healthy');
    expect(result.data?.recentDispatches).toHaveLength(1);
  });

  it('rejects the response when the payload shape is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          makeJsonResponse(
            { success: true, data: { subscription: 'not an object' } },
            { status: 200 }
          )
        )
    );

    const result = await fetchSubscriberDashboard({ token: VALID_TOKEN });
    expect(result.status).toBe('network_error');
    expect(result.reason).toBe('invalid_payload');
  });

  it('rejects malformed token before attempting network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchSubscriberDashboard({ token: 'bad' });
    expect(result.status).toBe('unauthorized');
    expect(result.reason).toBe('invalid_token_format');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honors a custom baseUrl for embeddable hosts', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeJsonResponse({ data: buildSnapshot() }, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchSubscriberDashboard({
      token: VALID_TOKEN,
      baseUrl: 'https://api.example.com',
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`https://api.example.com${SUBSCRIBER_DASHBOARD_PATH}`);
  });
});

// ----------------------------------------------------------------------------
// scrubTokenFromHash
// ----------------------------------------------------------------------------

describe('scrubTokenFromHash', () => {
  it('replaces the URL hash via history.replaceState in a browser', () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    scrubTokenFromHash();
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    const args = replaceStateSpy.mock.calls[0];
    // 3rd arg is the URL — should NOT contain the token hash anymore.
    expect(args[2]).toBeDefined();
    expect(String(args[2])).not.toContain('token=');
  });

  it('is SSR-safe (no-op when window is undefined)', () => {
    const originalWindow = (globalThis as { window?: unknown }).window;
    try {
      // Temporarily blank out window so the helper goes through the SSR
      // guard. The function must not throw or touch any global.
      (globalThis as { window?: unknown }).window = undefined;
      expect(() => scrubTokenFromHash()).not.toThrow();
    } finally {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });
});

// ----------------------------------------------------------------------------
// validateSnapshot — defense in depth
// ----------------------------------------------------------------------------

describe('validateSnapshot', () => {
  it('returns null for non-object input', () => {
    expect(validateSnapshot(null)).toBeNull();
    expect(validateSnapshot('string')).toBeNull();
    expect(validateSnapshot(42)).toBeNull();
  });

  it('rejects unknown health.overall values', () => {
    const snap = buildSnapshot();
    const bad = { ...snap, health: { ...snap.health, overall: 'on_fire' } };
    expect(validateSnapshot(bad)).toBeNull();
  });

  it('drops dispatches with unknown statuses but keeps valid ones', () => {
    // We intentionally construct the payload as `unknown` so the
    // malformed second entry slips past the TS check; the runtime
    // validator should drop it while keeping the valid first row.
    const baseSnap = buildSnapshot();
    const malformedDispatch: unknown = {
      id: 'x',
      dispatchedAt: '2026-01-01T00:00:00.000Z',
      status: 'WAT',
    };
    const malformedPayload: unknown = {
      ...baseSnap,
      recentDispatches: [...baseSnap.recentDispatches, malformedDispatch],
    };
    const result = validateSnapshot(malformedPayload);
    expect(result).not.toBeNull();
    expect(result?.recentDispatches).toHaveLength(1);
  });

  it('produces a JSON-serializable result', () => {
    const result = validateSnapshot(buildSnapshot());
    expect(result).not.toBeNull();
    const roundTripped = JSON.parse(JSON.stringify(result));
    expect(roundTripped).toEqual(result);
  });
});
