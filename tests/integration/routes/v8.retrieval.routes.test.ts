import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRequestsByOrg = vi.fn();
const mockCreateRetrievalRequest = vi.fn();
const mockGetRequest = vi.fn();
const mockRunPipeline = vi.fn();
const mockLogRetrievalTrace = vi.fn();
const mockGetTracesByRequest = vi.fn();
const mockGetTracesByConversation = vi.fn();
const mockGetTracesBySnapshot = vi.fn();

vi.mock('../../../server/src/services/v8/governedRetrievalService.js', () => ({
  getRequestsByOrg: (...args: unknown[]) => mockGetRequestsByOrg(...args),
  createRetrievalRequest: (...args: unknown[]) => mockCreateRetrievalRequest(...args),
  getRequest: (...args: unknown[]) => mockGetRequest(...args),
  runPipeline: (...args: unknown[]) => mockRunPipeline(...args),
  logRetrievalTrace: (...args: unknown[]) => mockLogRetrievalTrace(...args),
  getTracesByRequest: (...args: unknown[]) => mockGetTracesByRequest(...args),
  getTracesByConversation: (...args: unknown[]) => mockGetTracesByConversation(...args),
  getTracesBySnapshot: (...args: unknown[]) => mockGetTracesBySnapshot(...args),
}));

import retrievalRoutes from '../../../server/src/routes/v8/retrieval.routes.js';

const ORG = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '55555555-5555-4555-8555-555555555555';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.v8Context = {
      organizationId: ORG,
      userId: '22222222-2222-4222-8222-222222222222',
      userRole: 'ADMIN',
      isSuperAdmin: false,
    };
    next();
  });
  app.use('/api/v8/retrieval', retrievalRoutes);
  return app;
}

describe('Retrieval Routes (/api/v8/retrieval)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequest.mockResolvedValue({
      requestId: REQUEST_ID,
      organizationId: ORG,
      consumerClass: 'chat',
      query: 'board deck',
      searchPreset: 'workspace_broad',
      status: 'pending',
    });
  });

  it('creates a retrieval request with org injected from v8 context', async () => {
    mockCreateRetrievalRequest.mockResolvedValue({ requestId: REQUEST_ID, organizationId: ORG });

    const res = await request(createApp()).post('/api/v8/retrieval/requests').send({
      contextSnapshotId: '66666666-6666-4666-8666-666666666666',
      consumerClass: 'chat',
      query: 'board deck',
      searchPreset: 'workspace_broad',
    });

    expect(res.status).toBe(201);
    expect(mockCreateRetrievalRequest).toHaveBeenCalledWith({
      contextSnapshotId: '66666666-6666-4666-8666-666666666666',
      consumerClass: 'chat',
      query: 'board deck',
      searchPreset: 'workspace_broad',
      organizationId: ORG,
    });
  });

  it('returns 404 when a retrieval request does not exist', async () => {
    mockGetRequest.mockResolvedValue(null);

    const res = await request(createApp()).get(`/api/v8/retrieval/requests/${REQUEST_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('REQUEST_NOT_FOUND');
  });

  it('runs the governed retrieval pipeline for a persisted request', async () => {
    mockRunPipeline.mockResolvedValue({
      results: [{ sourceRef: 'doc-1', rankPosition: 0 }],
      denied: [],
      stages: [],
    });

    const res = await request(createApp())
      .post(`/api/v8/retrieval/requests/${REQUEST_ID}/pipeline`)
      .send({
        sources: [
          {
            sourceRef: 'doc-1',
            connectorId: null,
            scopeType: 'workspace',
            sensitivityLabel: 'internal',
            freshnessAt: new Date().toISOString(),
            tenantId: ORG,
            aclCheckedAt: new Date().toISOString(),
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(mockRunPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: REQUEST_ID, organizationId: ORG }),
      expect.any(Array),
    );
  });

  it('rejects pipeline execution when sources are missing', async () => {
    const res = await request(createApp())
      .post(`/api/v8/retrieval/requests/${REQUEST_ID}/pipeline`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(mockRunPipeline).not.toHaveBeenCalled();
  });

  it('logs traces through the request-scoped route', async () => {
    mockLogRetrievalTrace.mockResolvedValue({ traceId: 'trace-1', requestId: REQUEST_ID });

    const res = await request(createApp())
      .post(`/api/v8/retrieval/requests/${REQUEST_ID}/traces`)
      .send({
        snapshotId: '77777777-7777-4777-8777-777777777777',
        conversationId: '88888888-8888-4888-8888-888888888888',
        consumerClass: 'chat',
        presetUsed: 'workspace_broad',
        scopeResolutionSummary: {
          tenantId: ORG,
          projectId: null,
          scopeTypes: ['workspace'],
          sensitivityCeiling: 'internal',
          privacyMode: false,
        },
        pipelineStages: [],
        candidatesConsidered: 1,
        resultsReturned: 1,
        results: [],
        deniedEntries: [],
        freshnessWarnings: [],
        totalLatencyMs: 42,
      });

    expect(res.status).toBe(201);
    expect(mockLogRetrievalTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: REQUEST_ID,
        organizationId: ORG,
      }),
    );
  });
});
