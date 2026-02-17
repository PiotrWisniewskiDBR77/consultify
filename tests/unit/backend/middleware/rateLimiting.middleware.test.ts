import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

describe('RateLimiting Middleware (Genuine)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let next: NextFunction;
  let jsonFn: any;
  let statusFn: any;
  let setHeaderFn: any;
  let middlewareModule: any;

  beforeEach(async () => {
    vi.resetModules(); // Clear module cache to allow re-evaluation of top-level consts
    vi.stubEnv('NODE_ENV', 'production'); // Force prod to ensure strict limits

    // Dynamically import AFTER setting env
    middlewareModule = await import('../../../../server/src/middleware/rateLimiting.middleware.js');

    mockReq = {
      ip: '127.0.0.1',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' } as any,
    };

    jsonFn = vi.fn().mockReturnThis();
    statusFn = vi.fn().mockReturnThis();
    setHeaderFn = vi.fn();

    mockRes = {
      status: statusFn,
      json: jsonFn,
      setHeader: setHeaderFn,
    };

    next = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('should set rate limit headers', () => {
    mockReq.ip = '10.0.0.1';

    middlewareModule.defaultRateLimiter(mockReq as Request, mockRes as Response, next);

    expect(setHeaderFn).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
    expect(setHeaderFn).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
    expect(setHeaderFn).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    expect(next).toHaveBeenCalled();
  });

  it('should block requests when limit is exceeded', () => {
    mockReq.ip = '10.0.0.2';

    // In PROD: aiRateLimiter max is 30
    const Limit = 30;

    // Consume all tokens
    for (let i = 0; i < Limit; i++) {
      middlewareModule.aiRateLimiter(mockReq as Request, mockRes as Response, next);
    }

    // Reset mocks to verify the blocking call
    next = vi.fn();
    statusFn.mockClear();
    jsonFn.mockClear();

    // Next request should be blocked
    middlewareModule.aiRateLimiter(mockReq as Request, mockRes as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(statusFn).toHaveBeenCalledWith(429);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'RATE_LIMIT_EXCEEDED',
      })
    );
  });

  it('should track usage by user ID if present', () => {
    mockReq.user = { id: 'u-123' } as any;

    middlewareModule.aiRateLimiter(mockReq as Request, mockRes as Response, next);

    const calls = setHeaderFn.mock.calls;
    const remainingArg = calls.find((c: any) => c[0] === 'X-RateLimit-Remaining');
    const remaining = remainingArg ? remainingArg[1] : -1;

    // Max is 30. Remaining should be 29.
    expect(remaining).toBe(29);
  });

  it('should distinguish between different users', () => {
    // User A
    const reqA = { ...mockReq, user: { id: 'user-A' } as any };
    const resA = { ...mockRes, setHeader: vi.fn() } as any;
    middlewareModule.aiRateLimiter(reqA, resA, next);
    const remA = resA.setHeader.mock.calls.find((c: any) => c[0] === 'X-RateLimit-Remaining')[1];

    // User B
    const reqB = { ...mockReq, user: { id: 'user-B' } as any };
    const resB = { ...mockRes, setHeader: vi.fn() } as any;
    middlewareModule.aiRateLimiter(reqB, resB, next);
    const remB = resB.setHeader.mock.calls.find((c: any) => c[0] === 'X-RateLimit-Remaining')[1];

    // Both start fresh at 29
    expect(remA).toBe(29);
    expect(remB).toBe(29);
  });
});
