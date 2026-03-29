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

vi.mock('../../../server/src/middleware/v8Auth.middleware.js', () => ({
  requireV8OrgContext: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/v8FeatureGate.middleware.js', () => ({
  v8OutputsGate: (_req: any, _res: any, next: any) => next(),
}));

const createArtifactRunFromChatMock = vi.fn();
const acceptArtifactRunPlanMock = vi.fn();
const materializeArtifactRunMock = vi.fn();
const retryArtifactRunMock = vi.fn();
const getArtifactRunMock = vi.fn();
const listArtifactRunHistoryMock = vi.fn();

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  createArtifactRunFromChat: (...args: any[]) => createArtifactRunFromChatMock(...args),
  acceptArtifactRunPlan: (...args: any[]) => acceptArtifactRunPlanMock(...args),
  materializeArtifactRun: (...args: any[]) => materializeArtifactRunMock(...args),
  retryArtifactRun: (...args: any[]) => retryArtifactRunMock(...args),
  getArtifactRun: (...args: any[]) => getArtifactRunMock(...args),
  listArtifactRunHistory: (...args: any[]) => listArtifactRunHistoryMock(...args),
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
    materializeArtifactRunMock.mockReset();
    retryArtifactRunMock.mockReset();
    getArtifactRunMock.mockReset();
    listArtifactRunHistoryMock.mockReset();
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

  it('GET /api/artifact-runs/:runId returns persisted run when present', async () => {
    getArtifactRunMock.mockResolvedValue({
      runId: 'ar-1',
      runStatus: 'planned',
      executionRunId: 'exec-1',
    });

    const res = await request(app).get('/api/artifact-runs/ar-1');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        runId: 'ar-1',
        runStatus: 'planned',
      }),
    );
  });

  it('GET /api/artifact-runs/:runId returns 404 when missing', async () => {
    getArtifactRunMock.mockResolvedValue(null);

    const res = await request(app).get('/api/artifact-runs/ar-missing');

    expect(res.status).toBe(404);
    expect(res.body).toEqual(expect.objectContaining({ error: 'ArtifactRun not found' }));
  });

  it('GET /api/artifact-runs/:runId/history returns the retry chain for a run', async () => {
    listArtifactRunHistoryMock.mockResolvedValue([
      { runId: 'ar-1', runStatus: 'completed', retryOfRunId: null },
      { runId: 'ar-2', runStatus: 'planned', retryOfRunId: 'ar-1' },
    ]);

    const res = await request(app).get('/api/artifact-runs/ar-2/history');

    expect(res.status).toBe(200);
    expect(listArtifactRunHistoryMock).toHaveBeenCalledWith({
      runId: 'ar-2',
      organizationId: 'org-1',
    });
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ runId: 'ar-1' }),
        expect.objectContaining({ runId: 'ar-2' }),
      ])
    );
  });

  it('POST /api/artifact-runs/:runId/materialize passes report materialization params through', async () => {
    materializeArtifactRunMock.mockResolvedValue({
      runId: 'ar-1',
      artifactId: 'artifact-1',
      runStatus: 'completed',
      completedAt: '2026-03-24T10:03:00.000Z',
    });

    const res = await request(app).post('/api/artifact-runs/ar-1/materialize').send({
      title: 'Board report',
      sourceType: 'INTERVIEW',
      sourceId: 'interview-7',
      sourceName: 'Founder interview',
      templateId: 'tpl-1',
      config: { audience: 'board' },
    });

    expect(res.status).toBe(200);
    expect(materializeArtifactRunMock).toHaveBeenCalledWith({
      runId: 'ar-1',
      organizationId: 'org-1',
      actorUserId: 'user-1',
      title: 'Board report',
      description: undefined,
      sourceType: 'INTERVIEW',
      sourceId: 'interview-7',
      sourceName: 'Founder interview',
      templateId: 'tpl-1',
      config: { audience: 'board' },
    });
    expect(res.body.data).toEqual(
      expect.objectContaining({
        runId: 'ar-1',
        artifactId: 'artifact-1',
        runStatus: 'completed',
      }),
    );
  });

  it('POST /api/artifact-runs/:runId/retry returns a new persisted retry envelope', async () => {
    retryArtifactRunMock.mockResolvedValue({
      runId: 'ar-2',
      runStatus: 'planned',
      retryOfRunId: 'ar-1',
    });

    const res = await request(app).post('/api/artifact-runs/ar-1/retry').send({});

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        runId: 'ar-2',
        retryOfRunId: 'ar-1',
      }),
    );
  });
});
