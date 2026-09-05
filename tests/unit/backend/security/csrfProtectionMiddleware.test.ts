/**
 * L1 Unit Tests: csrfProtectionMiddleware / getCsrfMode
 * (CSRF Faza 1 — evidence/sec-20260905/04_CSRF_FAZA1_RAPORT.md)
 *
 * Targets the CSRF_MODE gate itself (off/report/enforce), not just the
 * underlying double-submit comparison (already fully covered by
 * csrfMiddleware.test.ts). A mutation that deletes the `mode === 'off'`
 * early-return must fail the 'off' suite below — see the RED→GREEN proof
 * in evidence/sec-20260905/04_CSRF_FAZA1_RAPORT.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { warnMock } = vi.hoisted(() => ({ warnMock: vi.fn() }));
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: warnMock,
    http: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  __resetCsrfViolationLogRateLimitForTests,
  csrfProtectionMiddleware,
  getCsrfMode,
} from '../../../../server/src/middleware/csrf.middleware';

function createMocks(
  overrides: {
    method?: string;
    path?: string;
    cookies?: Record<string, string>;
    headers?: Record<string, unknown>;
  } = {}
) {
  const req = {
    method: overrides.method || 'GET',
    path: overrides.path || '/api/test',
    cookies: overrides.cookies || {},
    headers: overrides.headers || {},
  } as any;
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

const CANONICAL_A = 'a'.repeat(64);
const CANONICAL_B = 'b'.repeat(64);

describe('getCsrfMode', () => {
  const original = process.env.CSRF_MODE;
  afterEach(() => {
    if (original === undefined) delete process.env.CSRF_MODE;
    else process.env.CSRF_MODE = original;
  });

  it('defaults to off when unset', () => {
    delete process.env.CSRF_MODE;
    expect(getCsrfMode()).toBe('off');
  });

  it('defaults to off for unknown values (fail safe)', () => {
    process.env.CSRF_MODE = 'bogus';
    expect(getCsrfMode()).toBe('off');
  });

  it('reads "report"', () => {
    process.env.CSRF_MODE = 'report';
    expect(getCsrfMode()).toBe('report');
  });

  it('reads "enforce"', () => {
    process.env.CSRF_MODE = 'enforce';
    expect(getCsrfMode()).toBe('enforce');
  });

  it('is case/whitespace tolerant', () => {
    process.env.CSRF_MODE = '  REPORT  ';
    expect(getCsrfMode()).toBe('report');
  });
});

describe('csrfProtectionMiddleware', () => {
  const originalMode = process.env.CSRF_MODE;
  const originalEnableInTests = process.env.ENABLE_CSRF_IN_TESTS;

  beforeEach(() => {
    process.env.ENABLE_CSRF_IN_TESTS = 'true';
    warnMock.mockClear();
    __resetCsrfViolationLogRateLimitForTests();
  });

  afterEach(() => {
    if (originalMode === undefined) delete process.env.CSRF_MODE;
    else process.env.CSRF_MODE = originalMode;
    if (originalEnableInTests === undefined) delete process.env.ENABLE_CSRF_IN_TESTS;
    else process.env.ENABLE_CSRF_IN_TESTS = originalEnableInTests;
  });

  describe('mode = off (default)', () => {
    beforeEach(() => {
      delete process.env.CSRF_MODE;
    });

    it('allows a mutating request with no token at all (2xx path — next() called)', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/projects' });
      csrfProtectionMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('logs zero csrf_violation lines', () => {
      const { req, res, next } = createMocks({ method: 'DELETE', path: '/api/projects/1' });
      csrfProtectionMiddleware(req, res, next);
      expect(warnMock).not.toHaveBeenCalled();
    });

    it('does not even read the CSRF cookie/header (short-circuits before shouldEnforceInCurrentEnv)', () => {
      // Regression guard for the exact mutation named in the report: if the
      // `if (mode === 'off') return next();` line is removed, this test
      // starts failing because ENABLE_CSRF_IN_TESTS=true would let the rest
      // of the function run and reject the missing token instead.
      const { req, res, next } = createMocks({ method: 'PUT', path: '/api/x' });
      csrfProtectionMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('mode = report', () => {
    beforeEach(() => {
      process.env.CSRF_MODE = 'report';
    });

    it('allows (2xx path) a mutating request with a missing token', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/projects' });
      csrfProtectionMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('logs exactly one structured csrf_violation line for a missing token', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/projects' });
      csrfProtectionMiddleware(req, res, next);
      expect(warnMock).toHaveBeenCalledTimes(1);
      const [message, meta] = warnMock.mock.calls[0];
      expect(message).toBe('csrf_violation');
      expect(meta).toMatchObject({
        event: 'csrf_violation',
        method: 'POST',
        path: '/api/projects',
        reason: 'CSRF_MISSING',
        mode: 'report',
      });
    });

    it('logs CSRF_INVALID reason for a mismatched token, still calls next()', () => {
      const { req, res, next } = createMocks({
        method: 'PUT',
        path: '/api/projects/1',
        cookies: { csrf_token: CANONICAL_A },
        headers: { 'x-csrf-token': CANONICAL_B },
      });
      csrfProtectionMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(warnMock).toHaveBeenCalledWith(
        'csrf_violation',
        expect.objectContaining({ reason: 'CSRF_INVALID', mode: 'report' })
      );
    });

    it('does not log and calls next() when cookie and header match', () => {
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/projects',
        cookies: { csrf_token: CANONICAL_A },
        headers: { 'x-csrf-token': CANONICAL_A },
      });
      csrfProtectionMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(warnMock).not.toHaveBeenCalled();
    });

    it('never logs for safe methods (GET/HEAD/OPTIONS) even with no token', () => {
      for (const method of ['GET', 'HEAD', 'OPTIONS']) {
        warnMock.mockClear();
        const { req, res, next } = createMocks({ method, path: '/api/projects' });
        csrfProtectionMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(warnMock).not.toHaveBeenCalled();
      }
    });

    it('rate-limits to one log per second per method+path', () => {
      const first = createMocks({ method: 'POST', path: '/api/hot-loop' });
      const second = createMocks({ method: 'POST', path: '/api/hot-loop' });
      csrfProtectionMiddleware(first.req, first.res, first.next);
      csrfProtectionMiddleware(second.req, second.res, second.next);
      expect(warnMock).toHaveBeenCalledTimes(1);
      expect(first.next).toHaveBeenCalled();
      expect(second.next).toHaveBeenCalled();
    });

    it('does not apply the rate limit across different paths', () => {
      const a = createMocks({ method: 'POST', path: '/api/hot-loop-a' });
      const b = createMocks({ method: 'POST', path: '/api/hot-loop-b' });
      csrfProtectionMiddleware(a.req, a.res, a.next);
      csrfProtectionMiddleware(b.req, b.res, b.next);
      expect(warnMock).toHaveBeenCalledTimes(2);
    });

    it('is a no-op (no log, no block) for an exempt path like /api/auth/login', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/auth/login' });
      csrfProtectionMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(warnMock).not.toHaveBeenCalled();
    });

    it('is a no-op for a Bearer-only request with no CSRF cookie (server-to-server / pre-session ticket)', () => {
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/auth/mfa-enrollment/verify-setup',
        headers: { authorization: 'Bearer some.scoped.ticket' },
      });
      csrfProtectionMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(warnMock).not.toHaveBeenCalled();
    });

    it('still validates a Bearer request that ALSO carries a CSRF cookie (browser session, not a bare API client)', () => {
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/projects',
        cookies: { csrf_token: CANONICAL_A },
        headers: { authorization: 'Bearer session.jwt', 'x-csrf-token': CANONICAL_B },
      });
      csrfProtectionMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(warnMock).toHaveBeenCalledWith(
        'csrf_violation',
        expect.objectContaining({ reason: 'CSRF_INVALID' })
      );
    });
  });

  describe('mode = enforce', () => {
    beforeEach(() => {
      process.env.CSRF_MODE = 'enforce';
    });

    it('rejects a mutating request with a missing token (403 CSRF_MISSING)', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/projects' });
      csrfProtectionMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CSRF_MISSING' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects a mismatched token (403 CSRF_INVALID)', () => {
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/projects',
        cookies: { csrf_token: CANONICAL_A },
        headers: { 'x-csrf-token': CANONICAL_B },
      });
      csrfProtectionMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CSRF_INVALID' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('accepts a matching token (2xx path)', () => {
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/projects',
        cookies: { csrf_token: CANONICAL_A },
        headers: { 'x-csrf-token': CANONICAL_A },
      });
      csrfProtectionMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('never logs csrf_violation in enforce mode (blocking, not reporting)', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/projects' });
      csrfProtectionMiddleware(req, res, next);
      expect(warnMock).not.toHaveBeenCalled();
    });

    it('allows safe methods without a token', () => {
      const { req, res, next } = createMocks({ method: 'GET', path: '/api/projects' });
      csrfProtectionMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows a Bearer-only request with no CSRF cookie', () => {
      const { req, res, next } = createMocks({
        method: 'DELETE',
        path: '/api/service-accounts/1',
        headers: { authorization: 'Bearer service.account.jwt' },
      });
      csrfProtectionMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('skips validation in test mode when ENABLE_CSRF_IN_TESTS is not set (any mode)', () => {
    it('report mode: allows and does not log', () => {
      delete process.env.ENABLE_CSRF_IN_TESTS;
      process.env.CSRF_MODE = 'report';
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/projects' });
      csrfProtectionMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(warnMock).not.toHaveBeenCalled();
    });

    it('enforce mode: allows without a token', () => {
      delete process.env.ENABLE_CSRF_IN_TESTS;
      process.env.CSRF_MODE = 'enforce';
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/projects' });
      csrfProtectionMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
