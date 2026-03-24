import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyTokenMock = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    verifyTokenMock(req);
    next();
  },
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: any) => next(),
}));

const createArtifactRunFromChatMock = vi.fn();
const acceptArtifactRunPlanMock = vi.fn();
const retryArtifactRunMock = vi.fn();
const getArtifactRunMock = vi.fn();

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  createArtifactRunFromChat: (...args: any[]) => createArtifactRunFromChatMock(...args),
  acceptArtifactRunPlan: (...args: any[]) => acceptArtifactRunPlanMock(...args),
  retryArtifactRun: (...args: any[]) => retryArtifactRunMock(...args),
  getArtifactRun: (...args: any[]) => getArtifactRunMock(...args),
}));

import artifactRunsRouter from '../../../server/src/routes/artifact-runs.routes.js';

describe('artifact-runs routes (HTTP contract; artifactRegistryService mocked)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/artifact-runs', artifactRunsRouter);

  beforeEach(() => {
    verifyTokenMock.mockReset();
    createArtifactRunFromChatMock.mockReset();
    acceptArtifactRunPlanMock.mockReset();
    retryArtifactRunMock.mockReset();
    getArtifactRunMock.mockReset();
    verifyTokenMock.mockImplementation((req: any) => {
      req.user = { id: 'user-1', organizationId: 'org-1' };
    });
  });

  it('POST /api/artifact-runs/from-chat returns persisted artifact run envelope', async () => {
    createArtifactRunFromChatMock.mockResolvedValue({
      artifactRunId: 'ar-1',
      executionRunId: 'exec-1',
      artifactPlan: {
        artifactFamily: 'sheet',
        outputType: 'sheet',
        titleHint: 'Structured sheet draft',
        governancePath: 'execution_spine',
        visibilityScope: 'private',
      },
      run: { runId: 'ar-1', runStatus: 'planned' },
    });

    const res = await request(app).post('/api/artifact-runs/from-chat').send({
      conversationId: 'conv-1',
      contextSnapshotId: 'ctx-1',
      goal: 'Create an Excel model',
      requestedArtifactFamily: 'sheet',
      requestedOutputType: 'sheet',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        artifactRunId: 'ar-1',
        executionRunId: 'exec-1',
      }),
    );
  });

  it('POST /api/artifact-runs/:runId/accept-plan returns updated run', async () => {
    acceptArtifactRunPlanMock.mockResolvedValue({
      runId: 'ar-1',
      runStatus: 'proposal_created',
      proposalId: 'proposal-1',
    });

    const res = await request(app).post('/api/artifact-runs/ar-1/accept-plan').send({});

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        runId: 'ar-1',
        runStatus: 'proposal_created',
      }),
    );
  });
});
