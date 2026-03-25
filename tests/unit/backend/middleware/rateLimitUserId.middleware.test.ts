import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

describe('rateLimitUserIdMiddleware', () => {
  let verifyMock: ReturnType<typeof vi.fn>;
  let decodeMock: ReturnType<typeof vi.fn>;
  let rateLimitUserIdMiddleware: (req: Request, res: Response, next: NextFunction) => void;

  beforeEach(async () => {
    vi.resetModules();
    verifyMock = vi.fn();
    decodeMock = vi.fn();

    vi.doMock('jsonwebtoken', () => ({
      default: { verify: verifyMock, decode: decodeMock },
      verify: verifyMock,
      decode: decodeMock,
    }));

    const mod = await import('../../../../server/src/middleware/rateLimitUserId.middleware.js');
    rateLimitUserIdMiddleware = mod.rateLimitUserIdMiddleware;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function makeReq(opts: {
    authorization?: string;
    cookies?: Record<string, unknown>;
  }): Request & { _rateLimitUserId?: string } {
    return {
      headers: opts.authorization ? { authorization: opts.authorization } : {},
      cookies: opts.cookies,
    } as any;
  }

  it('calls next when no token exists (even if secret is set)', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    const req = makeReq({});
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req._rateLimitUserId).toBeUndefined();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('calls next when secret is missing (even if token exists)', () => {
    // Ensure we don't inherit a JWT secret from the test environment
    vi.stubEnv('JWT_SECRET', '');
    const req = makeReq({ authorization: 'Bearer token' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req._rateLimitUserId).toBeUndefined();
    expect(verifyMock).not.toHaveBeenCalled();
    expect(decodeMock).toHaveBeenCalledWith('token');
  });

  it('extracts Bearer token and sets _rateLimitUserId when decoded contains id', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue({ id: 'u-123' });
    const req = makeReq({ authorization: 'Bearer jwt-token' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(verifyMock).toHaveBeenCalledWith('jwt-token', 'secret');
    expect(req._rateLimitUserId).toBe('u-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses raw Authorization header value when it is not Bearer-prefixed', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue({ id: 'u-raw' });
    const req = makeReq({ authorization: 'raw-jwt-token' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(verifyMock).toHaveBeenCalledWith('raw-jwt-token', 'secret');
    expect(req._rateLimitUserId).toBe('u-raw');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to cookies.access_token and cookies.token', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue({ id: 'u-cookie' });
    const next = vi.fn();

    const req1 = makeReq({ cookies: { access_token: 'cookie-access' } });
    rateLimitUserIdMiddleware(req1, {} as Response, next);
    expect(verifyMock).toHaveBeenCalledWith('cookie-access', 'secret');
    expect(req1._rateLimitUserId).toBe('u-cookie');

    verifyMock.mockClear();
    const req2 = makeReq({ cookies: { token: 'cookie-token' } });
    rateLimitUserIdMiddleware(req2, {} as Response, next);
    expect(verifyMock).toHaveBeenCalledWith('cookie-token', 'secret');
    expect(req2._rateLimitUserId).toBe('u-cookie');
  });

  it('uses sub as a fallback identifier', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue({ sub: 'u-1' });
    const req = makeReq({ authorization: 'Bearer jwt-token' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(req._rateLimitUserId).toBe('u-1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not set user id when decoded payload has no supported identifier', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue({ email: 'user@example.com' });
    const req = makeReq({ authorization: 'Bearer jwt-token' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(req._rateLimitUserId).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ignores invalid/expired tokens (verify throws) and continues', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockImplementation(() => {
      throw new Error('invalid token');
    });
    const req = makeReq({ authorization: 'Bearer bad-token' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(req._rateLimitUserId).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to decoded id when verify throws', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockImplementation(() => {
      throw new Error('invalid token');
    });
    decodeMock.mockReturnValue({ id: 'u-decoded' });
    const req = makeReq({ authorization: 'Bearer expired-jwt' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(req._rateLimitUserId).toBe('u-decoded');
    expect(decodeMock).toHaveBeenCalledWith('expired-jwt');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses decoded userId when secret is unavailable', () => {
    vi.stubEnv('JWT_SECRET', '');
    decodeMock.mockReturnValue({ userId: 'u-fallback' });
    const req = makeReq({ authorization: 'Bearer token' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(req._rateLimitUserId).toBe('u-fallback');
    expect(verifyMock).not.toHaveBeenCalled();
    expect(decodeMock).toHaveBeenCalledWith('token');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ignores empty cookie tokens', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    const req = makeReq({ cookies: { access_token: '' } });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(req._rateLimitUserId).toBeUndefined();
    expect(verifyMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
