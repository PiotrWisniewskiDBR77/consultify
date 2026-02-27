import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';

const { mockRun, mockLogger } = vi.hoisted(() => ({
  mockRun: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: mockLogger,
}));

vi.mock('../../../../server/src/utils/DbPromise.js', async () => {
  const actual = await vi.importActual('../../../../server/src/utils/DbPromise.js');
  return {
    ...(actual as any),
    run: mockRun,
  };
});

type Req = {
  headers: Record<string, string>;
  body?: any;
  query?: any;
  cookies?: any;
  path?: string;
  user?: any;
  userId?: string;
  organizationId?: string;
};

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('auth.middleware E2E_MODE bypass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.E2E_MODE = 'true';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
  });

  it('bypasses signature verification for e2e tokens and uses safe defaults', async () => {
    mockRun
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error('db down'));

    vi.resetModules();
    const { verifyToken, setDependencies } = await import(
      '../../../../server/src/middleware/auth.middleware.ts'
    );

    const jwtMock = {
      decode: vi.fn(() => ({ e2e: true, id: 'e2e-user-1' })),
      verify: vi.fn(),
    };

    setDependencies({
      jwt: jwtMock as any,
      config: { JWT_SECRET: 'secret' },
      PermissionService: { can: vi.fn(() => true) } as any,
      dbGet: vi.fn(),
    });

    const req: Req = { headers: { authorization: 'Bearer e2e-token' }, body: {}, query: {} };
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await verifyToken(req as any, res, next);

    expect(jwtMock.verify).not.toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(expect.objectContaining({ id: 'e2e-user-1' }));

    const secondCallArgs = mockRun.mock.calls[1]?.[1] as unknown[] | undefined;
    expect(secondCallArgs).toEqual(
      expect.arrayContaining([
        'e2e-user-1',
        'e2e-org-id',
        'e2e@local.test',
        'ADMIN',
        'E2E',
        'User',
      ])
    );
  });

  it('falls back to normal verification when token is not an e2e token', async () => {
    vi.resetModules();
    const { verifyToken, setDependencies } = await import(
      '../../../../server/src/middleware/auth.middleware.ts'
    );

    const jwtMock = {
      decode: vi.fn(() => ({ e2e: false, id: 'not-e2e' })),
      verify: vi.fn((_t: string, _s: string, cb: any) => cb(null, { id: 'u1' })),
    };

    setDependencies({
      jwt: jwtMock as any,
      config: { JWT_SECRET: 'secret' },
      PermissionService: { can: vi.fn(() => true) } as any,
      dbGet: vi.fn(),
    });

    const req: Req = { headers: { authorization: 'Bearer normal-token' }, body: {}, query: {} };
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await verifyToken(req as any, res, next);

    expect(jwtMock.verify).toHaveBeenCalledWith('normal-token', 'secret', expect.any(Function));
    expect(next).toHaveBeenCalled();
  });
});

