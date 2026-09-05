/**
 * CSRF fetch interceptor — Faza 1
 * (evidence/sec-20260905/03_CSRF_MFA_PROPOZYCJA.md, 04_CSRF_FAZA1_RAPORT.md)
 *
 * Targets the interceptor's method/origin gating, not the network — the
 * mock fetch below never talks to a real server. See
 * `__resetCsrfFetchInterceptorForTests` usage: every test reinstalls onto a
 * fresh mock so tests don't leak state through the module-level cache.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetCsrfFetchInterceptorForTests,
  CSRF_HEADER_NAME,
  installCsrfFetchInterceptor,
  resetCsrfTokenCache,
} from '../csrfClient';

const TOKEN = 'a'.repeat(64);

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('CSRF fetch interceptor', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetCsrfFetchInterceptorForTests();
    resetCsrfTokenCache();
    mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/csrf-token') {
        return jsonResponse({ token: TOKEN });
      }
      return jsonResponse({ ok: true });
    });
    window.fetch = mockFetch as unknown as typeof fetch;
    installCsrfFetchInterceptor();
  });

  afterEach(() => {
    __resetCsrfFetchInterceptorForTests();
  });

  it('attaches x-csrf-token to a POST to /api/*', async () => {
    await window.fetch('/api/projects', { method: 'POST', body: '{}' });

    const mutatingCall = mockFetch.mock.calls.find(([u]) => u === '/api/projects');
    expect(mutatingCall).toBeDefined();
    const [, init] = mutatingCall!;
    const headers = new Headers(init.headers);
    expect(headers.get(CSRF_HEADER_NAME)).toBe(TOKEN);
  });

  it('does NOT attach x-csrf-token to a GET to /api/*', async () => {
    await window.fetch('/api/projects', { method: 'GET' });

    const call = mockFetch.mock.calls.find(([u]) => u === '/api/projects');
    expect(call).toBeDefined();
    const [, init] = call!;
    const headers = new Headers(init?.headers);
    expect(headers.has(CSRF_HEADER_NAME)).toBe(false);
    // GET must never trigger the token prefetch either.
    expect(mockFetch.mock.calls.some(([u]) => u === '/api/csrf-token')).toBe(false);
  });

  it('does NOT attach x-csrf-token to a GET with no explicit method (defaults to GET)', async () => {
    await window.fetch('/api/projects');
    const call = mockFetch.mock.calls.find(([u]) => u === '/api/projects');
    const [, init] = call!;
    const headers = new Headers(init?.headers);
    expect(headers.has(CSRF_HEADER_NAME)).toBe(false);
  });

  it('attaches the header for PUT, PATCH and DELETE too', async () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      mockFetch.mockClear();
      await window.fetch('/api/projects/1', { method });
      const call = mockFetch.mock.calls.find(([u]) => u === '/api/projects/1');
      const headers = new Headers(call![1]?.headers);
      expect(headers.get(CSRF_HEADER_NAME)).toBe(TOKEN);
    }
  });

  it('does not attach the header to a mutating request to a different origin', async () => {
    await window.fetch('https://evil.example.com/api/steal', { method: 'POST' });
    const call = mockFetch.mock.calls.find(([u]) => u === 'https://evil.example.com/api/steal');
    expect(call).toBeDefined();
    const headers = new Headers(call![1]?.headers);
    expect(headers.has(CSRF_HEADER_NAME)).toBe(false);
  });

  it('caches the token across multiple mutating requests (fetches /api/csrf-token once)', async () => {
    await window.fetch('/api/a', { method: 'POST' });
    await window.fetch('/api/b', { method: 'POST' });
    const tokenFetches = mockFetch.mock.calls.filter(([u]) => u === '/api/csrf-token');
    expect(tokenFetches).toHaveLength(1);
  });

  it('re-fetches the token after a 403 CSRF_INVALID response', async () => {
    let mutatingCallCount = 0;
    mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/csrf-token') {
        return jsonResponse({ token: TOKEN });
      }
      mutatingCallCount += 1;
      if (mutatingCallCount === 1) {
        return jsonResponse({ code: 'CSRF_INVALID', message: 'CSRF token invalid' }, { status: 403 });
      }
      return jsonResponse({ ok: true });
    });
    window.fetch = mockFetch as unknown as typeof fetch;
    __resetCsrfFetchInterceptorForTests();
    resetCsrfTokenCache();
    installCsrfFetchInterceptor();

    await window.fetch('/api/projects', { method: 'POST' });
    await window.fetch('/api/projects', { method: 'POST' });

    const tokenFetches = mockFetch.mock.calls.filter(([u]) => u === '/api/csrf-token');
    // Once for the first mutating call, once again after the 403 CSRF_INVALID.
    expect(tokenFetches).toHaveLength(2);
  });

  it('does not attach a header when the token endpoint fails (fails open, matches CSRF_MISSING report path)', async () => {
    mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/csrf-token') {
        return jsonResponse({}, { status: 500 });
      }
      return jsonResponse({ ok: true });
    });
    window.fetch = mockFetch as unknown as typeof fetch;
    __resetCsrfFetchInterceptorForTests();
    resetCsrfTokenCache();
    installCsrfFetchInterceptor();

    await window.fetch('/api/projects', { method: 'POST' });
    const call = mockFetch.mock.calls.find(([u]) => u === '/api/projects');
    const headers = new Headers(call![1]?.headers);
    expect(headers.has(CSRF_HEADER_NAME)).toBe(false);
  });
});
