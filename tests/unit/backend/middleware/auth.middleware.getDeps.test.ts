import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';

type Req = {
  headers: Record<string, string>;
  body?: any;
  query?: any;
  cookies?: any;
  path?: string;
  user?: any;
  userId?: string;
  organizationId?: string;
  can?: (capability: string) => boolean;
};

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('auth.middleware getDeps (dynamic import fallbacks)', () => {
  it('uses jsonwebtoken module object when default export is missing', async () => {
    vi.resetModules();

    const jwtMock = {
      verify: vi.fn((_token: string, _secret: string, cb: any) => cb(null, { id: 'u1' })),
      decode: vi.fn(),
    };

    vi.doMock('jsonwebtoken', () => jwtMock);
    vi.doMock('../../../../server/src/config/Config.js', () => ({ JWT_SECRET: 's1' }));
    vi.doMock('../../../../server/src/services/permissionService.js', () => ({ can: vi.fn(() => true) }));

    const { verifyToken } = await import('../../../../server/src/middleware/auth.middleware.ts');

    const req: Req = { headers: { authorization: 'Bearer t1' }, body: {}, query: {}, cookies: {} };
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await verifyToken(req as any, res, next);
    expect(jwtMock.verify).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('uses Config default export when config export is missing', async () => {
    vi.resetModules();

    const jwtMock = {
      verify: vi.fn((_token: string, _secret: string, cb: any) => cb(null, { id: 'u2' })),
      decode: vi.fn(),
    };

    vi.doMock('jsonwebtoken', () => jwtMock);
    vi.doMock('../../../../server/src/config/Config.js', () => ({ default: { JWT_SECRET: 's2' } }));
    vi.doMock('../../../../server/src/services/permissionService.js', () => ({ can: vi.fn(() => true) }));

    const { verifyToken } = await import('../../../../server/src/middleware/auth.middleware.ts');

    const req: Req = { headers: { authorization: 'Bearer t2' }, body: {}, query: {}, cookies: {} };
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await verifyToken(req as any, res, next);
    expect(jwtMock.verify).toHaveBeenCalledWith('t2', 's2', expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  it('uses Config module object when both config and default are missing', async () => {
    vi.resetModules();

    const jwtMock = {
      verify: vi.fn((_token: string, _secret: string, cb: any) => cb(null, { id: 'u3' })),
      decode: vi.fn(),
    };

    vi.doMock('jsonwebtoken', () => jwtMock);
    vi.doMock('../../../../server/src/config/Config.js', () => ({ JWT_SECRET: 's3' }));
    vi.doMock('../../../../server/src/services/permissionService.js', () => ({ can: vi.fn(() => true) }));

    const { verifyToken } = await import('../../../../server/src/middleware/auth.middleware.ts');

    const req: Req = { headers: { authorization: 'Bearer t3' }, body: {}, query: {}, cookies: {} };
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await verifyToken(req as any, res, next);
    expect(jwtMock.verify).toHaveBeenCalledWith('t3', 's3', expect.any(Function));
    expect(next).toHaveBeenCalled();
  });
});

