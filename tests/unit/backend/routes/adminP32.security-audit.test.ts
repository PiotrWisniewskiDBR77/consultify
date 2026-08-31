/**
 * BUG A / H2.12 — security-policy save emits an admin audit entry.
 *
 * PUT /api/admin/security must persist an `update_security_policy` audit event
 * carrying the acting admin and the org. CI-collected copy under tests/.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();
const logAction = vi.fn();
const getLogs = vi.fn();

let mockUserRole = 'admin';

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = {
      id: 'user-1',
      organizationId: 'org-1',
      role: mockUserRole,
      isSuperAdmin: String(mockUserRole).toLowerCase() === 'superadmin',
    };
    req.userRole = mockUserRole;
    next();
  },
}));

vi.mock('../../../../server/src/services/adminAuditService.js', () => ({
  default: {
    logAction: (...args: any[]) => logAction(...args),
    getLogs: (...args: any[]) => getLogs(...args),
  },
}));

async function createApp(): Promise<Express> {
  const adminP32Routes = (
    await import('../../../../server/src/routes/adminP32.routes.ts')
  ).default;
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminP32Routes);
  return app;
}

describe('PUT /api/admin/security — audit emission (BUG A / H2.12)', () => {
  beforeEach(() => {
    mockUserRole = 'admin';
    dbAll.mockReset();
    dbGet.mockReset();
    dbRun.mockReset();
    logAction.mockReset();
    getLogs.mockReset();
    dbRun.mockResolvedValue({ changes: 1 });
    dbAll.mockResolvedValue([]);
    dbGet.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    logAction.mockResolvedValue({ id: 'audit-1', persisted: true });
  });

  it('emits update_security_policy with the acting admin + org', async () => {
    const app = await createApp();

    const res = await request(app)
      .put('/api/admin/security')
      .send({ passwordPolicy: 'strong', sessionTimeoutMinutes: 30 });

    expect(res.status).toBe(200);
    expect(logAction).toHaveBeenCalled();
    const arg = logAction.mock.calls.find(
      (c) => c[0]?.actionType === 'update_security_policy'
    )?.[0];
    expect(arg).toBeTruthy();
    expect(arg.adminId).toBe('user-1');
    expect(arg.details).toMatchObject({ orgId: 'org-1' });
  });
});
