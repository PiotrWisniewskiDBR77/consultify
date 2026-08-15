import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRunsByOrg = vi.fn();
const mockGetActiveRuns = vi.fn();
const mockCreateRun = vi.fn();
const mockCheckRunExpiration = vi.fn();
const mockGetRun = vi.fn();
const mockGetRunTransitions = vi.fn();
const mockGetProposalsByRun = vi.fn();
const mockCreateProposal = vi.fn();
const mockSubmitForReview = vi.fn();
const mockApproveRun = vi.fn();
const mockRejectRun = vi.fn();
const mockApplyRun = vi.fn();
const mockCompleteRun = vi.fn();
const mockReplanFromRejection = vi.fn();
const mockResolveProposalsBatch = vi.fn();
const mockResolveProposal = vi.fn();
const mockGetToolUsageByRun = vi.fn();
const mockListArtifactsForUserByExecutionRunId = vi.fn();

vi.mock('../../../server/src/services/v8/executionSpineService.js', () => ({
  getRunsByOrg: (...args: unknown[]) => mockGetRunsByOrg(...args),
  getActiveRuns: (...args: unknown[]) => mockGetActiveRuns(...args),
  createRun: (...args: unknown[]) => mockCreateRun(...args),
  checkRunExpiration: (...args: unknown[]) => mockCheckRunExpiration(...args),
  getRun: (...args: unknown[]) => mockGetRun(...args),
  getRunTransitions: (...args: unknown[]) => mockGetRunTransitions(...args),
  getProposalsByRun: (...args: unknown[]) => mockGetProposalsByRun(...args),
  createProposal: (...args: unknown[]) => mockCreateProposal(...args),
  submitForReview: (...args: unknown[]) => mockSubmitForReview(...args),
  approveRun: (...args: unknown[]) => mockApproveRun(...args),
  rejectRun: (...args: unknown[]) => mockRejectRun(...args),
  applyRun: (...args: unknown[]) => mockApplyRun(...args),
  completeRun: (...args: unknown[]) => mockCompleteRun(...args),
  replanFromRejection: (...args: unknown[]) => mockReplanFromRejection(...args),
  resolveProposalsBatch: (...args: unknown[]) => mockResolveProposalsBatch(...args),
  resolveProposal: (...args: unknown[]) => mockResolveProposal(...args),
}));

vi.mock('../../../server/src/services/v8/toolGovernanceService.js', () => ({
  getToolUsageByRun: (...args: unknown[]) => mockGetToolUsageByRun(...args),
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  listArtifactsForUserByExecutionRunId: (...args: unknown[]) =>
    mockListArtifactsForUserByExecutionRunId(...args),
}));

import executionRoutes from '../../../server/src/routes/v8/execution.routes.js';

const ORG = '11111111-1111-4111-8111-111111111111';
const UID = '22222222-2222-4222-8222-222222222222';
const RUN_ID = '33333333-3333-4333-8333-333333333333';

function createApp(userRole: string = 'ADMIN'): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.v8Context = {
      organizationId: ORG,
      userId: UID,
      userRole,
      isSuperAdmin: false,
    };
    next();
  });
  app.use('/api/v8/execution', executionRoutes);
  return app;
}

describe('Execution Routes (/api/v8/execution)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRunExpiration.mockResolvedValue(false);
    mockGetRun.mockResolvedValue({
      runId: RUN_ID,
      organizationId: ORG,
      state: 'planning',
    });
    mockGetProposalsByRun.mockResolvedValue([{ proposalId: 'prop-1' }, { proposalId: 'prop-2' }]);
    mockGetToolUsageByRun.mockResolvedValue({ invocations: [], traces: [] });
    mockListArtifactsForUserByExecutionRunId.mockResolvedValue([{ artifactId: 'art-1' }]);
  });

  it('lists active runs through the governed execution route', async () => {
    mockGetActiveRuns.mockResolvedValue([{ runId: RUN_ID }]);

    const res = await request(createApp()).get('/api/v8/execution/runs?active=true');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ runId: RUN_ID }]);
    expect(mockGetActiveRuns).toHaveBeenCalledWith(ORG, undefined);
  });

  it('creates a run with org and user injected from v8 context', async () => {
    mockCreateRun.mockResolvedValue({ runId: RUN_ID, organizationId: ORG, initiatorUserId: UID });

    const res = await request(createApp()).post('/api/v8/execution/runs').send({
      contextSnapshotId: '44444444-4444-4444-8444-444444444444',
      goal: 'Review proposal chain',
      metadata: { source: 'test' },
    });

    expect(res.status).toBe(201);
    expect(mockCreateRun).toHaveBeenCalledWith({
      contextSnapshotId: '44444444-4444-4444-8444-444444444444',
      goal: 'Review proposal chain',
      metadata: { source: 'test' },
      organizationId: ORG,
      initiatorUserId: UID,
    });
  });

  it('rejects run rejection without a reason', async () => {
    const res = await request(createApp()).post(`/api/v8/execution/runs/${RUN_ID}/reject`).send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(mockRejectRun).not.toHaveBeenCalled();
  });

  it('prevents resolving proposals that do not belong to the run', async () => {
    const res = await request(createApp())
      .post(`/api/v8/execution/runs/${RUN_ID}/proposals/resolve-batch`)
      .send({
        proposalIds: ['prop-1', 'prop-foreign'],
        status: 'approved',
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PROPOSAL_NOT_FOUND');
    expect(mockResolveProposalsBatch).not.toHaveBeenCalled();
  });

  it('resolves a run-scoped proposal through the route layer', async () => {
    mockResolveProposal.mockResolvedValue({ proposalId: 'prop-1', status: 'approved' });

    const res = await request(createApp())
      .post(`/api/v8/execution/runs/${RUN_ID}/proposals/prop-1/resolve`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ proposalId: 'prop-1', status: 'approved' });
    expect(mockResolveProposal).toHaveBeenCalledWith('prop-1', 'approved', UID);
  });

  it('returns tool usage for a run when run is visible to the user', async () => {
    mockListArtifactsForUserByExecutionRunId.mockResolvedValue([{ artifactId: 'art-1' }]);
    mockGetToolUsageByRun.mockResolvedValue({
      invocations: [{ invocationId: 'inv-1', toolId: 'tool-1', approvalResult: 'allowed' }],
      traces: [],
    });

    const res = await request(createApp('USER')).get(`/api/v8/execution/runs/${RUN_ID}/tool-usage`);

    expect(res.status).toBe(200);
    expect(mockGetToolUsageByRun).toHaveBeenCalledWith(RUN_ID, ORG);
    expect(res.body.data.invocations.length).toBe(1);
  });

  it('denies tool usage when run is not visible to a non-privileged user (no leakage)', async () => {
    mockListArtifactsForUserByExecutionRunId.mockResolvedValue([]);

    const res = await request(createApp('USER')).get(`/api/v8/execution/runs/${RUN_ID}/tool-usage`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RUN_NOT_FOUND');
    expect(mockGetToolUsageByRun).not.toHaveBeenCalled();
  });

  it('returns output pointers for a run when visible', async () => {
    mockListArtifactsForUserByExecutionRunId.mockResolvedValue([
      { artifactId: 'art-1', outputType: 'report', originRecordId: 'report-1', resolvedTitle: 'Report 1' },
    ]);

    const res = await request(createApp('USER')).get(`/api/v8/execution/runs/${RUN_ID}/outputs?limit=10`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('denies output pointers when run is not visible to a non-privileged user (no leakage)', async () => {
    mockListArtifactsForUserByExecutionRunId.mockResolvedValue([]);

    const res = await request(createApp('USER')).get(`/api/v8/execution/runs/${RUN_ID}/outputs?limit=10`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RUN_NOT_FOUND');
  });
});
