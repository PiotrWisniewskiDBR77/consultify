/**
 * Artifacts — Teresa → Outputs draft path (Module 09, P1-3).
 *
 * Proves `POST /api/artifacts/runs/from-chat`:
 *   - returns 201 with an `artifactRunId` when auth is valid, delegating to
 *     `artifactRegistryService.planArtifactFromChat`;
 *   - returns 401 when no auth token is present.
 *
 * This is the server end of the Teresa→Outputs handoff that the Outputs hub
 * client wires (V8ArtifactRunControl post-materialize → /presentations).
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockUser: { id: string; role: string; organizationId: string } | null = {
  id: 'user-1',
  role: 'ADMIN',
  organizationId: 'org-1',
};

const planArtifactFromChatMock = vi.fn();

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = mockUser;
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

vi.mock('../../../../server/src/middleware/v8Auth.middleware.js', () => ({
  requireV8OrgContext: (req: any, res: any, next: () => void) => {
    if (!req.organizationId) {
      res.status(403).json({ error: 'Organization access required' });
      return;
    }
    next();
  },
  attachV8Context: (_req: any, _res: any, next: () => void) => next(),
  getV8Context: () => ({}),
  default: {},
}));

vi.mock('../../../../server/src/middleware/v8FeatureGate.middleware.js', () => ({
  v8OutputsGate: (_req: any, _res: any, next: () => void) => next(),
  v8FeatureGate: (_req: any, _res: any, next: () => void) => next(),
  createV8ModuleGate: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/services/v8/artifactRegistryService.js', () => ({
  planArtifactFromChat: (...args: any[]) => planArtifactFromChatMock(...args),
}));

async function buildApp() {
  const { default: router } = await import('../../../../server/src/routes/artifacts.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/artifacts', router);
  return app;
}

describe('POST /api/artifacts/runs/from-chat — Teresa → Outputs draft path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' };
  });

  it('returns 201 with an artifactRunId when auth is valid', async () => {
    planArtifactFromChatMock.mockResolvedValue({
      artifactRunId: 'run-123',
      run: { runId: 'run-123' },
    });

    const app = await buildApp();
    const res = await request(app)
      .post('/api/artifacts/runs/from-chat')
      .send({
        conversationId: 'conv-1',
        goal: 'Draft a steering committee deck',
        requestedOutputType: 'presentation',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ artifactRunId: 'run-123' });
    expect(planArtifactFromChatMock).toHaveBeenCalledTimes(1);
    expect(planArtifactFromChatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        conversationId: 'conv-1',
        goal: 'Draft a steering committee deck',
        requestedOutputType: 'presentation',
      })
    );
  });

  it('returns 401 when no auth token is present', async () => {
    mockUser = null;
    const app = await buildApp();

    const res = await request(app)
      .post('/api/artifacts/runs/from-chat')
      .send({ conversationId: 'conv-1', goal: 'x', requestedOutputType: 'report' });

    expect(res.status).toBe(401);
    expect(planArtifactFromChatMock).not.toHaveBeenCalled();
  });
});
