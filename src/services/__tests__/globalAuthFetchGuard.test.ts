/**
 * auth-401-po-resecie (2026-09-08): direct-fetch API modules (e.g.
 * `initiatives-execution/runtimeApi.ts`) call `fetch()` without ever going
 * through `tokenService`'s refresh/logout chain. This guard patches
 * `window.fetch` once so an unhandled 401 on a protected `/api/*` path still
 * feeds the existing `auth-error` -> refresh -> `auth:token-expired` -> logout
 * recovery chain, instead of leaving the UI silently "logged in" forever
 * while every call 401s (the exact defect measured on staging after a
 * password reset).
 *
 * These tests exercise ONLY the guard's own decision (dispatch `auth-error`
 * or not) — the refresh/logout chain itself is covered by tokenService's own
 * tests and by `App.tsx`'s `auth:token-expired` listener.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installGlobalAuthFetchGuard } from '../globalAuthFetchGuard';

const FLAG = '__consultifyGlobalAuthFetchGuardInstalled__';

function resetGuardInstallFlag() {
  delete (window as typeof window & Record<string, unknown>)[FLAG];
}

function mockFetchResolving(status: number): ReturnType<typeof vi.fn> {
  return vi.fn(async () => new Response(null, { status }));
}

describe('installGlobalAuthFetchGuard', () => {
  const originalFetch = window.fetch;

  beforeEach(() => {
    resetGuardInstallFlag();
    window.fetch = originalFetch;
  });

  afterEach(() => {
    resetGuardInstallFlag();
    window.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('dispatches auth-error on a 401 from a protected /api/* path', async () => {
    window.fetch = mockFetchResolving(401) as unknown as typeof fetch;
    installGlobalAuthFetchGuard();

    const seen = vi.fn();
    window.addEventListener('auth-error', seen);

    await window.fetch('/api/initiatives/runtime-v1/execution-cases/c1/work');

    expect(seen).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth-error', seen);
  });

  it('does NOT dispatch auth-error on a 200 from a protected /api/* path', async () => {
    window.fetch = mockFetchResolving(200) as unknown as typeof fetch;
    installGlobalAuthFetchGuard();

    const seen = vi.fn();
    window.addEventListener('auth-error', seen);

    await window.fetch('/api/initiatives');

    expect(seen).not.toHaveBeenCalled();
    window.removeEventListener('auth-error', seen);
  });

  // This is the mutation-test target: `/api/auth/login` (and refresh/logout/
  // register/forgot-password/reset-password/health/ready) must stay exempt —
  // a failed login attempt is not a stale session, and a 401 from `/refresh`
  // itself must not re-trigger the very chain that called it. Delete the
  // `/api/auth/login` entry from `AUTH_ALLOWLIST_PREFIXES` in
  // `globalAuthFetchGuard.ts` and this test goes RED.
  it('does NOT dispatch auth-error on a 401 from /api/auth/login (allowlisted)', async () => {
    window.fetch = mockFetchResolving(401) as unknown as typeof fetch;
    installGlobalAuthFetchGuard();

    const seen = vi.fn();
    window.addEventListener('auth-error', seen);

    await window.fetch('/api/auth/login', { method: 'POST' });

    expect(seen).not.toHaveBeenCalled();
    window.removeEventListener('auth-error', seen);
  });

  it('does NOT dispatch auth-error on a 401 from /api/auth/refresh (allowlisted)', async () => {
    window.fetch = mockFetchResolving(401) as unknown as typeof fetch;
    installGlobalAuthFetchGuard();

    const seen = vi.fn();
    window.addEventListener('auth-error', seen);

    await window.fetch('/api/auth/refresh', { method: 'POST' });

    expect(seen).not.toHaveBeenCalled();
    window.removeEventListener('auth-error', seen);
  });

  it('is idempotent: installing twice still only patches fetch once', async () => {
    window.fetch = mockFetchResolving(401) as unknown as typeof fetch;
    installGlobalAuthFetchGuard();
    const patchedOnce = window.fetch;
    installGlobalAuthFetchGuard();
    expect(window.fetch).toBe(patchedOnce);
  });
});
