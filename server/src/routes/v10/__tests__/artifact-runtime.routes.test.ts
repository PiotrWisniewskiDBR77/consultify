import type { RequestHandler } from 'express';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type {
  ArtifactRuntimeApprovalEvaluateResponse,
  ArtifactRuntimeMutationPlanResponse,
  ArtifactRuntimeServiceContract,
} from '../../../types/v10/artifact-runtime.js';

type MockAuthRequest = {
  userId?: string;
  organizationId?: string;
  userRole?: string;
  user?: {
    id?: string;
    organizationId?: string;
    role?: string;
  };
};

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: ((req: MockAuthRequest, _res: unknown, next: () => void) => {
    req.userId = 'route-user';
    req.organizationId = 'route-org';
    req.userRole = 'ADMIN';
    req.user = {
      id: 'route-user',
      organizationId: 'route-org',
      role: 'ADMIN',
    };
    next();
  }) satisfies RequestHandler,
}));

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  requireV8OrgContext: ((_req: unknown, _res: unknown, next: () => void) =>
    next()) satisfies RequestHandler,
}));

vi.mock('../../../middleware/v8FeatureGate.middleware.js', () => ({
  v8OutputsGate: ((_req: unknown, _res: unknown, next: () => void) =>
    next()) satisfies RequestHandler,
}));

import { ArtifactRuntimeInputError } from '../../../services/v10/artifact/artifactRuntimeService.js';
import { createArtifactRuntimeRouter } from '../artifact-runtime.routes.js';

function createApp(service: ArtifactRuntimeServiceContract) {
  const app = express();
  app.use(express.json());
  app.use('/api/v10/artifact-runtime', createArtifactRuntimeRouter(service));
  return app;
}

function createServiceStub(): ArtifactRuntimeServiceContract {
  return {
    planMutation: vi.fn<(input: unknown) => ArtifactRuntimeMutationPlanResponse>(),
    applyMutation: vi.fn<(input: unknown) => unknown>(),
    planExport: vi.fn<(input: unknown) => unknown>(),
    planComment: vi.fn<(input: unknown) => unknown>(),
    fingerprintTemplate: vi.fn<(input: unknown) => unknown>(),
    evaluateApprovals: vi.fn<(input: unknown) => ArtifactRuntimeApprovalEvaluateResponse>(),
  };
}

describe('artifact-runtime.routes', () => {
  it('injects auth scope into mutation plan requests', async () => {
    const service = createServiceStub();
    vi.mocked(service.planMutation).mockReturnValue({
      scope: {
        tenantId: 'route-org',
        userId: 'route-user',
        userRole: 'ADMIN',
      },
      runId: 'run-1',
      status: 'ready',
      scopeVerdict: { kind: 'whole_artifact' },
      selectedOpIndices: [],
      acceptedOpIndices: [],
      rejectedOpIndices: [],
      callerTokenIssued: true,
    });

    const res = await request(createApp(service))
      .post('/api/v10/artifact-runtime/mutations/plan')
      .send({
        command: 'Update this',
        scope: { tenantId: 'spoof-org', userId: 'spoof-user', userRole: 'VIEWER' },
      });

    expect(res.status).toBe(200);
    expect(service.planMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: {
          tenantId: 'route-org',
          userId: 'route-user',
          userRole: 'ADMIN',
        },
      })
    );
    expect(res.body.data.scope.tenantId).toBe('route-org');
  });

  it('maps service validation errors to 422 responses', async () => {
    const service = createServiceStub();
    vi.mocked(service.planComment).mockImplementation(() => {
      throw new ArtifactRuntimeInputError(
        'ARTIFACT_RUNTIME_BAD_COMMENT',
        'comment payload is invalid'
      );
    });

    const res = await request(createApp(service))
      .post('/api/v10/artifact-runtime/comments/plan')
      .send({ comment: { id: 'comment-1' }, notificationIntents: [] });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ARTIFACT_RUNTIME_BAD_COMMENT');
    expect(res.body.error).toBe('comment payload is invalid');
  });

  it('exposes the approvals evaluate surface', async () => {
    const service = createServiceStub();
    vi.mocked(service.evaluateApprovals).mockReturnValue({
      scope: {
        tenantId: 'route-org',
        userId: 'route-user',
        userRole: 'ADMIN',
      },
      requiredReviewer: 'legal',
      resolvedByRuleId: 'legal-review',
      matchedRuleIds: ['legal-review'],
      defaultRouteUsed: false,
      invariants: {
        restrictedRequiresCiso: true,
        legalTagRequiresLegal: true,
        cfoArtifactRequiresFinance: true,
        defaultRoutesForStandardPersonas: true,
        routingCoverage: true,
        baselineNotWeakened: true,
      },
    });

    const res = await request(createApp(service))
      .post('/api/v10/artifact-runtime/approvals/evaluate')
      .send({
        context: { contentTags: ['legal'] },
        routingTable: { tenantId: 't', rules: [], defaultRoute: 'default' },
      });

    expect(res.status).toBe(200);
    expect(service.evaluateApprovals).toHaveBeenCalledOnce();
    expect(res.body.data.requiredReviewer).toBe('legal');
  });
});
