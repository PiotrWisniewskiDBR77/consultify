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

  it('treats whitespace-only JWT_SECRET as missing and uses decode path', () => {
    vi.stubEnv('JWT_SECRET', '   ');
    decodeMock.mockReturnValue({ id: 'u-whitespace-secret' });
    const req = makeReq({ authorization: 'Bearer token' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(verifyMock).not.toHaveBeenCalled();
    expect(decodeMock).toHaveBeenCalledWith('token');
    expect(req._rateLimitUserId).toBe('u-whitespace-secret');
    expect(next).toHaveBeenCalledTimes(1);
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

  it('extracts bearer token case-insensitively', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue({ id: 'u-ci' });
    const req = makeReq({ authorization: 'bearer jwt-token-ci' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(verifyMock).toHaveBeenCalledWith('jwt-token-ci', 'secret');
    expect(req._rateLimitUserId).toBe('u-ci');
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

  it('falls back to cookies.token when cookies.access_token accessor throws', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue({ id: 'u-cookie-fallback' });
    const cookies: any = {};
    Object.defineProperty(cookies, 'access_token', {
      configurable: true,
      get: () => {
        throw new Error('access_token getter failed');
      },
    });
    Object.defineProperty(cookies, 'token', {
      configurable: true,
      get: () => 'cookie-token-fallback',
    });
    const req = makeReq({ cookies });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(verifyMock).toHaveBeenCalledWith('cookie-token-fallback', 'secret');
    expect(req._rateLimitUserId).toBe('u-cookie-fallback');
    expect(next).toHaveBeenCalledTimes(1);
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

  it('continues when decode throws on no-secret path', () => {
    vi.stubEnv('JWT_SECRET', '');
    decodeMock.mockImplementation(() => {
      throw new Error('decode failed');
    });
    const req = makeReq({ authorization: 'Bearer token' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req._rateLimitUserId).toBeUndefined();
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

  it('trims bearer token and normalized decoded id before assigning rate limit user id', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue({ id: '  u-trimmed  ' });
    const req = makeReq({ authorization: 'Bearer   token-with-spaces   ' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(verifyMock).toHaveBeenCalledWith('token-with-spaces', 'secret');
    expect(req._rateLimitUserId).toBe('u-trimmed');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('continues extraction from cookies when authorization header accessor throws', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue({ id: 'u-cookie-fallback' });
    const req = makeReq({ cookies: { token: 'cookie-token-fallback' } });
    Object.defineProperty(req, 'headers', {
      configurable: true,
      get: () => {
        throw new Error('headers getter failed');
      },
    });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(verifyMock).toHaveBeenCalledWith('cookie-token-fallback', 'secret');
    expect(req._rateLimitUserId).toBe('u-cookie-fallback');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('extracts token from authorization header array', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue({ id: 'u-array' });
    const req: any = {
      headers: { authorization: ['Bearer array-token', 'Bearer ignored'] },
    };
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(verifyMock).toHaveBeenCalledWith('array-token', 'secret');
    expect(req._rateLimitUserId).toBe('u-array');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('continues when decoded id accessor throws (fail-open)', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue(
      Object.defineProperty({}, 'id', {
        configurable: true,
        enumerable: true,
        get() {
          throw new Error('id getter failed');
        },
      })
    );
    const req = makeReq({ authorization: 'Bearer accessor-token' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req._rateLimitUserId).toBeUndefined();
  });

  it('continues when assigning _rateLimitUserId throws (fail-open)', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue({ id: 'u-assign-throw' });
    const req = makeReq({ authorization: 'Bearer assign-throw-token' });
    Object.defineProperty(req, '_rateLimitUserId', {
      configurable: true,
      get() {
        return undefined;
      },
      set() {
        throw new Error('setter failed');
      },
    });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req._rateLimitUserId).toBeUndefined();
  });

  it('skips parsing when token is longer than safety threshold', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    const req = makeReq({ authorization: `Bearer ${'a'.repeat(8200)}` });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req._rateLimitUserId).toBeUndefined();
    expect(verifyMock).not.toHaveBeenCalled();
    expect(decodeMock).not.toHaveBeenCalled();
  });

  it('does not assign _rateLimitUserId when decoded id exceeds max length', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue({ id: 'x'.repeat(257) });
    const req = makeReq({ authorization: 'Bearer long-id-token' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req._rateLimitUserId).toBeUndefined();
  });

  it('does not assign _rateLimitUserId when decoded id contains disallowed control characters', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue({ id: 'u-\n1' });
    const req = makeReq({ authorization: 'Bearer control-id-token' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(verifyMock).toHaveBeenCalledWith('control-id-token', 'secret');
    expect(req._rateLimitUserId).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('assigns _rateLimitUserId when decoded id is exactly max length boundary', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    verifyMock.mockReturnValue({ id: 'x'.repeat(256) });
    const req = makeReq({ authorization: 'Bearer boundary-id-token' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req._rateLimitUserId).toBe('x'.repeat(256));
  });

  it('continues request flow when req getter throws before token extraction', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    const req = makeReq({ authorization: 'Bearer token' });
    Object.defineProperty(req, 'headers', {
      configurable: true,
      get() {
        throw new Error('headers unavailable');
      },
    });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req._rateLimitUserId).toBeUndefined();
    expect(verifyMock).not.toHaveBeenCalled();
    expect(decodeMock).not.toHaveBeenCalled();
  });

  it('skips jwt parsing when token contains newline control character', () => {
    vi.stubEnv('JWT_SECRET', 'secret');
    const req = makeReq({ authorization: 'Bearer header\npayload' });
    const next = vi.fn();

    rateLimitUserIdMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req._rateLimitUserId).toBeUndefined();
    expect(verifyMock).not.toHaveBeenCalled();
    expect(decodeMock).not.toHaveBeenCalled();
  });
});
