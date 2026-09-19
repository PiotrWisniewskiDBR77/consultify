import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { impersonateUser, writeConfirmation } = vi.hoisted(() => ({
  impersonateUser: vi.fn((req: any, res: any) =>
    res.status(200).json({ userId: req.body.userId })
  ),
  writeConfirmation: vi.fn().mockResolvedValue({ changes: 1 }),
}));

vi.mock('../../controllers/SuperAdminController.js', () => ({
  default: new Proxy(
    { impersonateUser },
    {
      get(target, property) {
        return property in target
          ? target[property as keyof typeof target]
          : (_req: any, res: any) => res.status(501).json({ error: 'unused test handler' });
      },
    }
  ),
}));
vi.mock('../../utils/DbPromise.js', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  run: (...args: any[]) => writeConfirmation(...args),
}));
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = {
      id: 'superadmin-d117',
      role: 'SUPERADMIN',
      organizationId: 'platform',
      isSuperAdmin: true,
      superadminCapabilities: ['support_ops'],
    };
    req.userId = 'superadmin-d117';
    next();
  },
}));
vi.mock('../../middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: () => void) => next(),
  requireSuperAdminCapability:
    () => (_req: any, _res: any, next: () => void) =>
      next(),
}));
vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/superadminAuditMonitor.middleware.js', () => ({
  superadminAuditMonitor: (_req: any, _res: any, next: () => void) => next(),
}));

const app = async () => {
  const { default: router } = await import('../superadmin.routes.js');
  const instance = express();
  instance.use(express.json());
  instance.use('/api/superadmin', router);
  return instance;
};

describe('D-117 impersonation confirmation ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeConfirmation.mockResolvedValue({ changes: 1 });
  });

  it('consumes confirmation before the strict body schema and reaches the controller', async () => {
    const response = await request(await app()).post('/api/superadmin/impersonate').send({
      userId: 'target-user',
      confirmation: true,
      reason: 'Support investigation',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: 'target-user' });
    expect(writeConfirmation).toHaveBeenCalledOnce();
    expect(impersonateUser).toHaveBeenCalledOnce();
  });

  it('still rejects a request without explicit confirmation', async () => {
    const response = await request(await app())
      .post('/api/superadmin/impersonate')
      .send({ userId: 'target-user', reason: 'Support investigation' });

    expect(response.status).toBe(428);
    expect(response.body.code).toBe('CONFIRMATION_REQUIRED');
    expect(impersonateUser).not.toHaveBeenCalled();
  });
});
