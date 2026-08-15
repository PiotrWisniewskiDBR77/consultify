import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockVerifyToken = vi.fn((req, _res, next) => {
  req.user = { id: 'actor', organizationId: 'org-1', role: 'ADMIN' };
  req.organizationId = 'org-1';
  next();
});
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockQueryAll = vi.fn();
const mockResolveEffectiveAccess = vi.fn();

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
}));

vi.mock('../../../../server/src/services/effectiveAccessService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../server/src/services/effectiveAccessService.js')>();
  return {
    ...actual,
    ensureProjectRoleTemplateSchema: vi.fn(),
    seedFactoryRoleTemplates: vi.fn(),
    resolveEffectiveAccess: (...args: unknown[]) => mockResolveEffectiveAccess(...args),
    hasEffectiveCapability: () => true,
  };
});

describe('access role builder guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear queued one-shot rows from guardrail tests that deliberately return
    // before querying. Otherwise a factory-clone test can consume a stale row.
    mockQueryOne.mockReset();
    mockResolveEffectiveAccess.mockResolvedValue({
      capabilities: ['admin.project_roles.manage'],
      platformRole: null,
    });
    mockQueryRun.mockResolvedValue({ success: true, changes: 1 });
    mockQueryAll.mockResolvedValue([]);
  });

  async function app() {
    const { default: accessRoutes } = await import('../../../../server/src/routes/access.routes.js');
    const app = express();
    app.use(express.json());
    app.use('/access', accessRoutes);
    return app;
  }

  it('previews capability diffs before update', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'tpl-1',
      organization_id: 'org-1',
      role_key: 'TASK_ASSIGNEE',
      capabilities_json: JSON.stringify(['project.view', 'task.view.assigned']),
    });

    const res = await request(await app())
      .post('/access/project-role-templates/tpl-1/preview')
      .send({ capabilities: ['project.view', 'task.update.assigned'] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      allowed: true,
      diff: {
        added: ['task.update.assigned'],
        removed: ['task.view.assigned'],
      },
    });
  });

  it('rejects forbidden platform capability mutations', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'tpl-1',
      organization_id: 'org-1',
      role_key: 'TASK_ASSIGNEE',
      capabilities_json: JSON.stringify(['project.view']),
      is_required: 1,
    });

    const res = await request(await app())
      .put('/access/project-role-templates/tpl-1')
      .send({ capabilities: ['project.view', 'superadmin.access'] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ROLE_TEMPLATE_GUARDRAIL');
    expect(mockQueryRun).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE project_role_templates'),
      expect.anything()
    );
  });

  it('requires fallback role for custom roles', async () => {
    const res = await request(await app())
      .post('/access/project-role-templates')
      .send({ roleKey: 'CUSTOM_REVIEW_ASSISTANT', capabilities: ['project.view'] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FALLBACK_ROLE_REQUIRED');
  });

  it('clone-on-writes factory template instead of mutating it', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'factory-task',
        organization_id: null,
        role_key: 'TASK_ASSIGNEE',
        label: 'Task Assignee',
        description: '',
        is_required: 1,
        is_enabled: 1,
        capabilities_json: JSON.stringify(['project.view']),
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'org-template',
        organization_id: 'org-1',
        role_key: 'TASK_ASSIGNEE',
      });

    const res = await request(await app())
      .put('/access/project-role-templates/factory-task')
      .send({ label: 'Task Delivery', capabilities: ['project.view', 'task.view.assigned'] });

    expect(res.status).toBe(200);
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO project_role_templates'),
      expect.arrayContaining(['org-1', 'TASK_ASSIGNEE'])
    );
    const updateCall = mockQueryRun.mock.calls.find((call) =>
      String(call[0]).includes('WHERE id = ? AND organization_id = ?')
    );
    expect(updateCall).toBeTruthy();
    expect(updateCall?.[1]).toEqual(
      expect.arrayContaining([expect.stringMatching(/^org_org-1_task_assignee_/), 'org-1'])
    );
  });
});
