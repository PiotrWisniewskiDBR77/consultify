import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';

import config from '../../../../server/src/config/Config.js';

type Req = {
  headers: Record<string, string>;
  body?: unknown;
  query?: unknown;
  cookies?: unknown;
  path?: string;
  user?: unknown;
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

describe('auth.middleware getDeps (runtime sanity)', () => {
  it('verifies a real JWT using Config.JWT_SECRET and attaches req.user', async () => {
    const prev = { ...process.env };
    try {
      process.env.NODE_ENV = 'test';
      process.env.E2E_MODE = 'false';
      process.env.ENABLE_TEST_AUTH_BYPASS = 'false';

      const token = jwt.sign(
        {
          id: 'u1',
          role: 'ADMIN',
          organizationId: 'org-1',
          email: 'u1@local.test',
          name: 'User One',
          // no jti -> skip revocation DB checks
        },
        config.JWT_SECRET
      );

      const { verifyToken } = await import('../../../../server/src/middleware/auth.middleware.ts?getdeps_runtime=1');

      const req: Req = { headers: { authorization: `Bearer ${token}` }, body: {}, query: {}, cookies: {} };
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      await verifyToken(req as any, res, next);

      expect(next).toHaveBeenCalled();
      expect((req as any).user?.id).toBe('u1');
      expect((req as any).organizationId).toBe('org-1');
    } finally {
      process.env = prev;
    }
  });

  it('returns 401 for an invalid token', async () => {
    const prev = { ...process.env };
    try {
      process.env.NODE_ENV = 'test';
      process.env.E2E_MODE = 'false';
      process.env.ENABLE_TEST_AUTH_BYPASS = 'false';

      const { verifyToken } = await import('../../../../server/src/middleware/auth.middleware.ts?getdeps_runtime_invalid=1');

      const req: Req = { headers: { authorization: 'Bearer not-a-jwt' }, body: {}, query: {}, cookies: {} };
      const res: any = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      await verifyToken(req as any, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    } finally {
      process.env = prev;
    }
  });
});

