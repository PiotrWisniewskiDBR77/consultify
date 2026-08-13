import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Context = vi.fn();
const mockRequireCaseAccess = vi.fn();
const mockGetRunBinding = vi.fn();
const mockRecordGatewayEvaluation = vi.fn();
const mockGetGatewayEvaluation = vi.fn();
const mockListGatewayEvaluationsForCase = vi.fn();

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: (...args: unknown[]) => mockGetV8Context(...args),
}));

vi.mock('../../../services/caseWorkspace/caseWorkspaceAuthContext.js', async () => {
  const actual = await vi.importActual<typeof import('../../../services/caseWorkspace/caseWorkspaceAuthContext.js')>(
    '../../../services/caseWorkspace/caseWorkspaceAuthContext.js'
  );
  return { ...actual, requireCaseAccess: (...args: unknown[]) => mockRequireCaseAccess(...args) };
});

vi.mock('../../../services/caseWorkspace/runBindingService.js', () => ({
  getRunBinding: (...args: unknown[]) => mockGetRunBinding(...args),
}));

vi.mock('../../../services/caseWorkspace/executionGraphService.js', () => ({
  recordGatewayEvaluation: (...args: unknown[]) => mockRecordGatewayEvaluation(...args),
  getGatewayEvaluation: (...args: unknown[]) => mockGetGatewayEvaluation(...args),
  listGatewayEvaluationsForRun: vi.fn(),
  listGatewayEvaluationsForCase: (...args: unknown[]) => mockListGatewayEvaluationsForCase(...args),
  recordNodeResultAcceptance: vi.fn(),
  getNodeResultAcceptance: vi.fn(),
  listNodeResultAcceptancesForRun: vi.fn(),
  listNodeResultAcceptancesForCase: vi.fn(),
}));

import executionGraphRoutes from '../executionGraph.routes.js';
import { errorHandlerMiddleware } from '../../../utils/ErrorHandler.js';

const ORG = 'org-1';
const USER = 'user-1';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8/case-workspace', executionGraphRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('caseWorkspace execution-graph routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetV8Context.mockReturnValue({ organizationId: ORG, userId: USER, userRole: 'ADMIN', isSuperAdmin: false });
    mockRequireCaseAccess.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
  });

  it('rejects a record-gateway-evaluation body missing outcomeStatus with 400', async () => {
    const res = await request(createApp())
      .post('/api/v8/case-workspace/runs/run-1/gateway-evaluations')
      .send({ nodeRunId: 'node-1', gatewayNodeType: 'DECISION_GATEWAY', evaluationInputSnapshot: {}, evaluatedAt: '2026-01-01T00:00:00.000Z' });
    expect(res.status).toBe(400);
    expect(mockRecordGatewayEvaluation).not.toHaveBeenCalled();
  });

  it('resolves the owning caseId via runBindingService before authorizing a runId-scoped route, and 404s when the run has no binding', async () => {
    mockGetRunBinding.mockResolvedValue(null);
    const res = await request(createApp())
      .post('/api/v8/case-workspace/runs/run-missing/gateway-evaluations')
      .send({
        nodeRunId: 'node-1',
        gatewayNodeType: 'DECISION_GATEWAY',
        evaluationInputSnapshot: {},
        outcomeStatus: 'BRANCH_SELECTED',
        evaluatedAt: '2026-01-01T00:00:00.000Z',
      });
    expect(res.status).toBe(404);
    expect(mockRecordGatewayEvaluation).not.toHaveBeenCalled();
  });

  it('maps gateway_evaluation_determinism_conflict to 409', async () => {
    mockGetRunBinding.mockResolvedValue({ runId: 'run-1', caseId: 'case-1' });
    mockRecordGatewayEvaluation.mockRejectedValue(new Error('gateway_evaluation_determinism_conflict'));
    const res = await request(createApp())
      .post('/api/v8/case-workspace/runs/run-1/gateway-evaluations')
      .send({
        nodeRunId: 'node-1',
        gatewayNodeType: 'DECISION_GATEWAY',
        evaluationInputSnapshot: {},
        outcomeStatus: 'BRANCH_SELECTED',
        evaluatedAt: '2026-01-01T00:00:00.000Z',
      });
    expect(res.status).toBe(409);
  });

  it('checks case access using the found row before returning getGatewayEvaluation by id', async () => {
    mockGetGatewayEvaluation.mockResolvedValue({ nodeRunId: 'node-1', caseId: 'case-1' });
    const res = await request(createApp()).get('/api/v8/case-workspace/gateway-evaluations/node-1');
    expect(res.status).toBe(200);
    expect(mockRequireCaseAccess).toHaveBeenCalledWith(USER, 'case-1');
  });

  it('checks case access before listing gateway evaluations for a case', async () => {
    mockListGatewayEvaluationsForCase.mockResolvedValue([]);
    const res = await request(createApp()).get('/api/v8/case-workspace/cases/case-1/gateway-evaluations');
    expect(res.status).toBe(200);
    expect(mockRequireCaseAccess).toHaveBeenCalledWith(USER, 'case-1');
  });
});
