import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DEC-2026-08-25-17 — HTTP-layer proof, on top of the effectiveAccessService
 * unit tests. Deliberately does NOT mock effectiveAccessService (unlike
 * server/src/routes/security/__tests__/roles.routes.test.ts and
 * tests/unit/backend/routes/accessRoleBuilder.security.test.ts, which both
 * stub hasEffectiveCapability to a fixed boolean and so never exercise the
 * real ADMIN-vs-OWNER decision). Only the DB layer (queryHelpers) and auth
 * middleware are mocked — resolveEffectiveAccess/hasEffectiveCapability run
 * for real, the same code path access.routes.ts's requireRoleTemplateManage
 * actually calls.
 *
 * Live evidence this guards: with the ADMIN branch of resolveEffectiveAccess
 * granting the bare '*' wildcard, an ADMIN calling a project-role-template
 * mutation endpoint got 200 instead of 403.
 */

const dbQueryOne = vi.fn();
const dbQueryRun = vi.fn().mockResolvedValue(undefined);
let user: any = { id: 'u1', organizationId: 'org-1', role: 'ADMIN' };

vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => dbQueryOne(...args),
  queryRun: (...args: unknown[]) => dbQueryRun(...args),
}));
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    if (!user) return res.status(401).end();
    req.user = user;
    req.organizationId = user.organizationId;
    req.userRole = user.role;
    next();
  },
}));

const app = async () => {
  const { default: accessRoutes } = await import('../access.routes.js');
  const a = express();
  a.use(express.json());
  a.use('/api/access', accessRoutes);
  return a;
};

describe('access.routes.ts — project-role-template mutation gate (real effectiveAccessService)', () => {
  beforeEach(() => {
    vi.resetModules();
    user = { id: 'u1', organizationId: 'org-1', role: 'ADMIN' };
    dbQueryOne.mockReset();
    dbQueryRun.mockReset().mockResolvedValue(undefined);
  });

  it('ADMIN gets 403 PROJECT_ROLES_MANAGE_REQUIRED on a role-template mutation endpoint', async () => {
    user = { id: 'u-admin', organizationId: 'org-1', role: 'ADMIN' };
    // First (only) queryOne call: readApplicationRole's org membership lookup.
    dbQueryOne.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });

    const res = await request(await app())
      .post('/api/access/project-role-templates/tpl-1/preview')
      .send({ capabilities: ['project.view'] });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      code: 'PROJECT_ROLES_MANAGE_REQUIRED',
      required: 'admin.project_roles.manage',
    });
    // Denied before ever reaching the template lookup.
    expect(dbQueryOne).toHaveBeenCalledTimes(1);
  });

  it('OWNER gets past the gate (200) on the same endpoint', async () => {
    user = { id: 'u-owner', organizationId: 'org-1', role: 'OWNER' };
    dbQueryOne
      .mockResolvedValueOnce({ role: 'OWNER', status: 'ACTIVE' }) // readApplicationRole
      .mockResolvedValueOnce({
        id: 'tpl-1',
        organization_id: 'org-1',
        capabilities_json: JSON.stringify(['project.view']),
      }); // template lookup, reached only once the gate passes

    const res = await request(await app())
      .post('/api/access/project-role-templates/tpl-1/preview')
      .send({ capabilities: ['project.view', 'task.update.assigned'] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      allowed: true,
      diff: { added: ['task.update.assigned'], removed: [] },
    });
  });

  it('a non-admin MEMBER also gets 403 on the same endpoint (no new hole opened)', async () => {
    user = { id: 'u-member', organizationId: 'org-1', role: 'MEMBER' };
    dbQueryOne.mockResolvedValueOnce({ role: 'USER', status: 'ACTIVE' });

    const res = await request(await app())
      .post('/api/access/project-role-templates/tpl-1/preview')
      .send({ capabilities: ['project.view'] });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PROJECT_ROLES_MANAGE_REQUIRED');
  });
});
