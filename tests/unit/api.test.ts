import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  recordGlobalTransportFailure,
  clearGlobalTransportFailure,
  maybeGetGlobalBlockedTransportResponse,
  shouldBypassGlobalCircuit,
  normalizeTransportPath,
} from '../../src/services/api';

// The global test setup (tests/setup.ts) auto-mocks `@/services/api` and the
// relative alias. `vi.unmock` alone is not sufficient here because the global
// factory still shadows the named circuit-breaker exports for this file, so the
// import of `clearGlobalTransportFailure` (and friends) resolves to undefined.
// Re-point both module specifiers at the real implementation so every named
// export — including `clearGlobalTransportFailure` — resolves correctly.
vi.unmock('../../src/services/api');
vi.unmock('@/services/api');
vi.mock('@/services/api', async (importActual) => {
  const actual = await importActual<typeof import('../../src/services/api')>();
  return { ...actual };
});
vi.mock('../../src/services/api', async (importActual) => {
  const actual = await importActual<typeof import('../../src/services/api')>();
  return { ...actual };
});

describe('Frontend API Circuit Breaker (Transport Safeguard)', () => {
  beforeEach(() => {
    clearGlobalTransportFailure();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should ignore 404 and 401 errors from triggering circuit', () => {
    recordGlobalTransportFailure('/api/some-endpoint', 404);
    expect(maybeGetGlobalBlockedTransportResponse('/api/some-endpoint')).toBeNull();

    recordGlobalTransportFailure('/api/some-endpoint', 401);
    expect(maybeGetGlobalBlockedTransportResponse('/api/some-endpoint')).toBeNull();
  });

  it('should trigger circuit on 502 or Network Error', () => {
    for (let i = 0; i < 6; i++) {
      recordGlobalTransportFailure('/api/some-endpoint', 502);
    }
    const blocked = maybeGetGlobalBlockedTransportResponse('/api/some-endpoint');
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
  });

  it('should clear circuit on clearGlobalTransportFailure', () => {
    for (let i = 0; i < 6; i++) {
      recordGlobalTransportFailure('/api/some-endpoint', 502);
    }
    expect(maybeGetGlobalBlockedTransportResponse('/api/some-endpoint')).not.toBeNull();

    clearGlobalTransportFailure('/api/some-endpoint');
    expect(maybeGetGlobalBlockedTransportResponse('/api/some-endpoint')).toBeNull();
  });

  it('should bypass Interview and Tools endpoints', () => {
    expect(shouldBypassGlobalCircuit('/api/interview/sessions')).toBe(true);
    expect(shouldBypassGlobalCircuit('/api/v8/interview/sessions?projectId=abc')).toBe(true);
    expect(shouldBypassGlobalCircuit('/api/tools/list')).toBe(true);
    expect(shouldBypassGlobalCircuit('/api/education/library')).toBe(true);
    expect(shouldBypassGlobalCircuit('/api/audits/list')).toBe(true);
    expect(shouldBypassGlobalCircuit('/api/discovery-tools/known-tools')).toBe(true);
    expect(shouldBypassGlobalCircuit('/api/users/me')).toBe(false);
  });

  it('should not block bypassed endpoints even if circuit is open', () => {
    for (let i = 0; i < 6; i++) {
      recordGlobalTransportFailure('/api/some-endpoint', 502);
    }
    expect(maybeGetGlobalBlockedTransportResponse('/api/interview/sessions')).toBeNull();
  });

  it('normalizes absolute URLs and query strings before bypass matching', () => {
    expect(
      normalizeTransportPath('https://demo.consultify.ai/api/interview/sessions?x=1#top')
    ).toBe('/api/interview/sessions');
    expect(shouldBypassGlobalCircuit('https://demo.consultify.ai/api/tools/list?x=1')).toBe(true);
  });
});
