import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const accessMocks = vi.hoisted(() => ({
  resolveEffectiveAccess: vi.fn(),
  hasEffectiveCapability: vi.fn(),
}));

const serviceMocks = vi.hoisted(() => ({
  approveProposal: vi.fn(),
  createDraft: vi.fn(),
  createProposal: vi.fn(),
  getDraft: vi.fn(),
  getProposal: vi.fn(),
  listDrafts: vi.fn(),
  listProposals: vi.fn(),
  rejectProposal: vi.fn(),
  requiredCapabilityForTarget: vi.fn(),
  saveDraftAsArtifact: vi.fn(),
  updateDraft: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  emitAuditEvent: vi.fn(),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = req.headers['x-test-role']
      ? { id: 'user-1', organizationId: 'org-1', role: String(req.headers['x-test-role']) }
      : { id: 'user-1', organizationId: 'org-1', role: 'USER' };
    next();
  },
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (req: any, _res: any, next: any) => {
    req.emitAuditEvent = auditMocks.emitAuditEvent;
    next();
  },
}));

vi.mock('../../../server/src/services/effectiveAccessService.js', () => ({
  resolveEffectiveAccess: (...args: any[]) => accessMocks.resolveEffectiveAccess(...args),
  hasEffectiveCapability: (...args: any[]) => accessMocks.hasEffectiveCapability(...args),
}));

vi.mock('../../../server/src/services/workCanvasService.js', () => ({
  approveProposal: (...args: any[]) => serviceMocks.approveProposal(...args),
  createDraft: (...args: any[]) => serviceMocks.createDraft(...args),
  createProposal: (...args: any[]) => serviceMocks.createProposal(...args),
  getDraft: (...args: any[]) => serviceMocks.getDraft(...args),
  getProposal: (...args: any[]) => serviceMocks.getProposal(...args),
  listDrafts: (...args: any[]) => serviceMocks.listDrafts(...args),
  listProposals: (...args: any[]) => serviceMocks.listProposals(...args),
  rejectProposal: (...args: any[]) => serviceMocks.rejectProposal(...args),
  requiredCapabilityForTarget: (...args: any[]) => serviceMocks.requiredCapabilityForTarget(...args),
  saveDraftAsArtifact: (...args: any[]) => serviceMocks.saveDraftAsArtifact(...args),
  updateDraft: (...args: any[]) => serviceMocks.updateDraft(...args),
}));

import workCanvasRoutes from '../../../server/src/routes/work-canvas.routes.js';

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    organizationId: 'org-1',
    createdBy: 'user-1',
    conversationId: 'conv-1',
    kind: 'markdown',
    title: 'Canvas draft',
    content: '# Draft',
    sources: [],
    provenance: {},
    projectId: 'project-1',
    ownerId: 'user-1',
    artifactId: null,
    artifactRunId: null,
    artifactVersion: null,
    saveState: 'unsaved',
    lifecycleState: 'draft',
    dirtyState: 'dirty',
    visibility: 'project',
    auditStatus: 'not_required',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proposal-1',
    draftId: 'draft-1',
    organizationId: 'org-1',
    createdBy: 'user-1',
    target: 'task',
    title: 'Task: Canvas draft',
    summary: 'Proposal generated from canvas draft.',
    status: 'proposed',
    payload: {},
    requiredCapability: 'canvas.convert.task',
    targetObjectId: null,
    readBack: null,
    auditEventId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('/api/work-canvas routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/work-canvas', workCanvasRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode || err.status || 500).json({
      error: err.message,
      code: err.code,
    });
  });

  beforeEach(() => {
    Object.values(accessMocks).forEach((mock) => mock.mockReset());
    Object.values(serviceMocks).forEach((mock) => mock.mockReset());
    auditMocks.emitAuditEvent.mockReset();
    auditMocks.emitAuditEvent.mockResolvedValue('audit-1');

    accessMocks.resolveEffectiveAccess.mockResolvedValue({
      rawProjectRole: 'PROJECT_LEADER',
      capabilities: ['canvas.draft.create', 'canvas.convert.task', 'artifact.create'],
    });
    accessMocks.hasEffectiveCapability.mockImplementation((access, capability) =>
      Boolean(access.capabilities?.includes(capability))
    );
    serviceMocks.requiredCapabilityForTarget.mockImplementation((target) =>
      target === 'task' ? 'canvas.convert.task' : 'artifact.create'
    );
    serviceMocks.getDraft.mockResolvedValue(makeDraft());
    serviceMocks.getProposal.mockResolvedValue(makeProposal());
    serviceMocks.listProposals.mockResolvedValue([]);
  });

  it('rejects draft creation without canvas.draft.create', async () => {
    accessMocks.hasEffectiveCapability.mockReturnValue(false);

    const res = await request(app).post('/api/work-canvas/drafts').send({
      conversationId: 'conv-1',
      projectId: 'project-1',
      title: 'Draft',
      content: '# Draft',
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CANVAS_CAPABILITY_REQUIRED');
    expect(serviceMocks.createDraft).not.toHaveBeenCalled();
  });

  it('rejects project-scoped reads when membership is missing', async () => {
    accessMocks.resolveEffectiveAccess.mockResolvedValue({
      rawProjectRole: null,
      capabilities: ['project.view'],
    });

    const res = await request(app).get('/api/work-canvas/drafts/draft-1');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CANVAS_PROJECT_SCOPE_REQUIRED');
  });

  it('rejects conversion proposal without target conversion capability', async () => {
    accessMocks.hasEffectiveCapability.mockImplementation((_access, capability) =>
      capability === 'project.view'
    );

    const res = await request(app).post('/api/work-canvas/drafts/draft-1/proposals').send({
      target: 'task',
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CANVAS_CAPABILITY_REQUIRED');
    expect(serviceMocks.createProposal).not.toHaveBeenCalled();
  });

  it('rejects save-as-artifact without artifact.create', async () => {
    accessMocks.hasEffectiveCapability.mockImplementation((_access, capability) =>
      capability === 'project.view'
    );

    const res = await request(app).post('/api/work-canvas/drafts/draft-1/save-as-artifact');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CANVAS_CAPABILITY_REQUIRED');
    expect(serviceMocks.saveDraftAsArtifact).not.toHaveBeenCalled();
  });

  it('rejects project retarget when actor lacks target project membership', async () => {
    accessMocks.resolveEffectiveAccess
      .mockResolvedValueOnce({
        rawProjectRole: 'PROJECT_LEADER',
        capabilities: ['canvas.draft.create'],
      })
      .mockResolvedValueOnce({
        rawProjectRole: null,
        capabilities: ['canvas.draft.create'],
      });

    const res = await request(app).put('/api/work-canvas/drafts/draft-1').send({
      projectId: 'project-2',
      title: 'Move draft',
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CANVAS_PROJECT_SCOPE_REQUIRED');
    expect(serviceMocks.updateDraft).not.toHaveBeenCalled();
  });

  it('reject proposal does not call approve/domain mutation path', async () => {
    const rejected = makeProposal({
      status: 'rejected',
      readBack: { status: 'rejected', targetObjectId: null },
    });
    serviceMocks.rejectProposal.mockResolvedValue(rejected);

    const res = await request(app).post('/api/work-canvas/proposals/proposal-1/reject').send({
      reason: 'Not now',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(serviceMocks.rejectProposal).toHaveBeenCalledWith(
      expect.objectContaining({ proposalId: 'proposal-1', reason: 'Not now' })
    );
    expect(serviceMocks.approveProposal).not.toHaveBeenCalled();
  });

  it('approve proposal returns structured read-back from domain commit', async () => {
    const approved = makeProposal({
      status: 'approved',
      targetObjectId: 'task-1',
      readBack: {
        status: 'todo',
        target: 'task',
        targetObjectId: 'task-1',
        projectId: 'project-1',
        assigneeId: 'user-1',
        auditEventId: 'audit-1',
      },
    });
    serviceMocks.approveProposal.mockResolvedValue(approved);

    const res = await request(app).post('/api/work-canvas/proposals/proposal-1/approve');

    expect(res.status).toBe(200);
    expect(res.body.readBack).toEqual(
      expect.objectContaining({
        targetObjectId: 'task-1',
        projectId: 'project-1',
        assigneeId: 'user-1',
        auditEventId: 'audit-1',
      })
    );
    expect(serviceMocks.approveProposal).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'user-1', proposalId: 'proposal-1' })
    );
    expect(auditMocks.emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'work_canvas.proposal.approved',
        resourceType: 'work_canvas_proposal',
      })
    );
  });

  it('save-as-artifact returns canonical V8 artifact read-back', async () => {
    serviceMocks.saveDraftAsArtifact.mockResolvedValue({
      draft: makeDraft({
        saveState: 'saved',
        artifactId: 'artifact-1',
        artifactRunId: 'run-1',
        artifactVersion: 1,
      }),
      readBack: {
        status: 'saved',
        targetObjectId: 'artifact-1',
        artifactId: 'artifact-1',
        artifactRunId: 'run-1',
        artifactVersion: 1,
      },
    });

    const res = await request(app).post('/api/work-canvas/drafts/draft-1/save-as-artifact');

    expect(res.status).toBe(200);
    expect(res.body.readBack).toEqual(
      expect.objectContaining({ artifactId: 'artifact-1', artifactRunId: 'run-1' })
    );
  });

  it('V8 save failure returns failed draft without ghost artifact read-back', async () => {
    serviceMocks.saveDraftAsArtifact.mockRejectedValue(
      Object.assign(new Error('materialization failed'), {
        statusCode: 502,
        code: 'V8_ARTIFACT_SAVE_FAILED',
        draft: makeDraft({ saveState: 'failed', artifactId: null }),
      })
    );

    const res = await request(app).post('/api/work-canvas/drafts/draft-1/save-as-artifact');

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('V8_ARTIFACT_SAVE_FAILED');
  });

  it('surfaces stale proposal approve as 409 without route-level mutation fallback', async () => {
    serviceMocks.approveProposal.mockRejectedValue(
      Object.assign(new Error('Canvas proposal is stale'), {
        statusCode: 409,
        code: 'STALE_CANVAS_PROPOSAL',
      })
    );

    const res = await request(app).post('/api/work-canvas/proposals/proposal-1/approve');

    expect(res.status).toBe(409);
    expect(serviceMocks.approveProposal).toHaveBeenCalledTimes(1);
  });
});
