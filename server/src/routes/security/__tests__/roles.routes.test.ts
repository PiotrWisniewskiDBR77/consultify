import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import rolesRoutes from '../roles.routes.js';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();
const resolveEffectiveAccess = vi.fn();
const hasEffectiveCapability = vi.fn();

let mockRole = 'OWNER';
let mockCapabilityAllowed = true;

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = {
      id: 'user-1',
      organizationId: 'org-1',
      role: mockRole,
    };
    req.organizationId = 'org-1';
    req.userRole = mockRole;
    next();
  },
}));

vi.mock('../../../services/effectiveAccessService.js', () => ({
  resolveEffectiveAccess: (...args: any[]) => resolveEffectiveAccess(...args),
  hasEffectiveCapability: (...args: any[]) => hasEffectiveCapability(...args),
}));

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/security/roles', rolesRoutes);
  return app;
}

describe('security roles routes validation', () => {
  beforeEach(() => {
    mockRole = 'OWNER';
    mockCapabilityAllowed = true;
    dbAll.mockReset();
    dbGet.mockReset();
    dbRun.mockReset();
    resolveEffectiveAccess.mockReset();
    hasEffectiveCapability.mockReset();

    resolveEffectiveAccess.mockResolvedValue({ capabilities: ['admin.project_roles.manage'] });
    hasEffectiveCapability.mockImplementation(() => mockCapabilityAllowed);

    dbRun.mockResolvedValue({ success: true, changes: 1 });
    dbGet.mockResolvedValue({ id: 'role-1' });
    dbAll.mockResolvedValue([]);
  });

  it('returns 403 when caller lacks admin.project_roles.manage', async () => {
    mockCapabilityAllowed = false;
    const app = createApp();
    const res = await request(app).get('/api/security/roles');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PROJECT_ROLES_MANAGE_REQUIRED');
  });

  it('rejects POST with missing role name', async () => {
    const app = createApp();
    const res = await request(app).post('/api/security/roles').send({});
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toContain('Role name is required');
  });

  it('rejects POST with empty roleKey', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/security/roles')
      .send({
        roleKey: '   ',
        name: 'Auditor',
        permissions: ['project.view'],
      });
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toContain('roleKey');
  });

  it('rejects POST with non-array capabilities', async () => {
    const app = createApp();
    const res = await request(app).post('/api/security/roles').send({
      name: 'Auditor',
      capabilities: 'project.view',
    });
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toContain('array');
  });

  it('accepts POST with name + capabilities (deduplicates)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/security/roles')
      .send({
        name: 'Auditor',
        capabilities: ['project.view', 'project.view'],
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO security_roles'),
      expect.arrayContaining(['org-1', 'Auditor', JSON.stringify(['project.view'])])
    );
  });

  it('rejects PUT with no updatable fields', async () => {
    const app = createApp();
    const res = await request(app).put('/api/security/roles/role-1').send({});
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toContain('No updatable fields');
  });

  it('rejects PUT with invalid permissions type', async () => {
    const app = createApp();
    const res = await request(app).put('/api/security/roles/role-1').send({
      permissions: 'bad',
    });
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toContain('array');
  });
});
