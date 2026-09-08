/**
 * auth-401-po-resecie (2026-09-08): `RouterSync` is the single authority for
 * the "not authenticated on a protected route" -> /login redirect, and it
 * always wins a race against a `navigate()` called elsewhere in the same
 * commit (e.g. App.tsx's `auth:token-expired` handler) — confirmed live in
 * the browser: the direct navigate got silently overwritten by RouterSync's
 * own `?redirect=` navigation. This tiny sessionStorage handoff lets a caller
 * that is about to end the local session leave a reason RouterSync itself
 * appends to the redirect it was always going to perform anyway.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  consumePendingLoginRedirectReason,
  setPendingLoginRedirectReason,
} from '../authRedirectReason';

const STORAGE_KEY = 'consultify:pendingLoginRedirectReason:v1';

describe('authRedirectReason', () => {
  afterEach(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    vi.useRealTimers();
  });

  it('round-trips a freshly set reason', () => {
    setPendingLoginRedirectReason('session_expired');
    expect(consumePendingLoginRedirectReason()).toBe('session_expired');
  });

  it('clears the flag after one read (never leaks into a second redirect)', () => {
    setPendingLoginRedirectReason('session_expired');
    consumePendingLoginRedirectReason();
    expect(consumePendingLoginRedirectReason()).toBeNull();
  });

  it('returns null when nothing was set', () => {
    expect(consumePendingLoginRedirectReason()).toBeNull();
  });

  it('ignores a malformed stored value instead of throwing', () => {
    sessionStorage.setItem(STORAGE_KEY, 'not json');
    expect(consumePendingLoginRedirectReason()).toBeNull();
  });

  // Mutation-test target: bump MAX_AGE_MS's comparison direction/threshold in
  // authRedirectReason.ts and this test goes RED — a reason from a much
  // earlier, unrelated session must never leak into a later redirect.
  it('ignores a reason older than 10s', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    setPendingLoginRedirectReason('session_expired');
    vi.setSystemTime(10_001);
    expect(consumePendingLoginRedirectReason()).toBeNull();
  });

  it('honors a reason set just under the 10s bound', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    setPendingLoginRedirectReason('password_reset');
    vi.setSystemTime(9_999);
    expect(consumePendingLoginRedirectReason()).toBe('password_reset');
  });
});
