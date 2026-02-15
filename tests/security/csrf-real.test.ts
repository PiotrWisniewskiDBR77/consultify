import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  csrfTokenMiddleware,
  csrfValidationMiddleware,
  getCsrfTokenHandler,
} from '../../server/src/middleware/csrf.middleware';

describe('Real CSRF Middleware (P0)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const createRes = () => {
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, unknown>,
      cookies: [] as Array<{ name: string; value: string; options: any }>,
      body: undefined as unknown,
      setHeader(name: string, value: unknown) {
        res.headers[String(name).toLowerCase()] = value;
      },
      cookie(name: string, value: string, options: any) {
        res.cookies.push({ name, value, options });
        return res;
      },
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(payload: unknown) {
        res.body = payload;
        return res;
      },
    };
    return res;
  };

  const createReq = (overrides: Partial<any> = {}) => {
    const req: any = {
      method: 'GET',
      path: '/api/somewhere',
      secure: false,
      cookies: {},
      headers: {},
      ...overrides,
    };
    return req;
  };

  it('does not enforce by default in tests (ENABLE_CSRF_IN_TESTS != true)', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENABLE_CSRF_IN_TESTS', 'false');

    const req = createReq({ method: 'POST' });
    const res = createRes();
    const next = vi.fn();

    csrfValidationMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('sets csrf cookie when missing (csrfTokenMiddleware)', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENABLE_CSRF_IN_TESTS', 'true');

    const req = createReq({ cookies: {} });
    const res = createRes();
    const next = vi.fn();

    csrfTokenMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.cookies.length).toBe(1);
    expect(res.cookies[0].name).toBe('csrf_token');
    expect(typeof res.cookies[0].value).toBe('string');
    expect(res.cookies[0].value.length).toBe(64);
  });

  it('blocks unsafe method without cookie/header (CSRF_MISSING)', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENABLE_CSRF_IN_TESTS', 'true');

    const req = createReq({ method: 'POST', path: '/api/projects', cookies: {}, headers: {} });
    const res = createRes();
    const next = vi.fn();

    csrfValidationMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ code: 'CSRF_MISSING', message: 'CSRF token missing' });
  });

  it('blocks when cookie/header mismatch (CSRF_INVALID)', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENABLE_CSRF_IN_TESTS', 'true');

    const req = createReq({
      method: 'POST',
      path: '/api/projects',
      cookies: { csrf_token: 'a'.repeat(64) },
      headers: { 'x-csrf-token': 'b'.repeat(64) },
    });
    const res = createRes();
    const next = vi.fn();

    csrfValidationMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ code: 'CSRF_INVALID', message: 'CSRF token invalid' });
  });

  it('allows when cookie/header match', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENABLE_CSRF_IN_TESTS', 'true');

    const tok = 'c'.repeat(64);
    const req = createReq({
      method: 'POST',
      path: '/api/projects',
      cookies: { csrf_token: tok },
      headers: { 'x-csrf-token': tok },
    });
    const res = createRes();
    const next = vi.fn();

    csrfValidationMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('exempts auth login path from validation', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENABLE_CSRF_IN_TESTS', 'true');

    const req = createReq({ method: 'POST', path: '/api/auth/login', cookies: {}, headers: {} });
    const res = createRes();
    const next = vi.fn();

    csrfValidationMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('getCsrfTokenHandler returns a non-static token even when enforcement is disabled', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENABLE_CSRF_IN_TESTS', 'false');

    const req = createReq({ cookies: {} });
    const res = createRes();

    getCsrfTokenHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof (res.body as any).token).toBe('string');
    expect((res.body as any).token.length).toBe(64);
  });
});
