import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const register = vi.fn();
const report = vi.fn();
const list = vi.fn();
const reconcile = vi.fn();
const getCase = vi.fn();

vi.mock('../../../services/v8/transformationRuntimeCapabilityService.js', () => ({
  registerRuntimeCapability: register,
  reportRuntimeEvidence: report,
  listRuntimeCapabilities: list,
  reconcileTransformationPlan: reconcile,
}));
vi.mock('../../../services/v8/transformationCaseService.js', async () => {
  class TransformationCaseOperationError extends Error {
    constructor(
      public code: string,
      public httpStatus: number,
      message: string
    ) {
      super(message);
    }
  }
  return {
    TransformationCaseOperationError,
    getTransformationCase: getCase,
    listTransformationCases: vi.fn(),
  };
});

async function app(role = 'OWNER') {
  const { default: router } = await import('../transformation-cases.routes.js');
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => {
    (req as unknown as { v8Context: Record<string, unknown> }).v8Context = {
      organizationId: 'org-a',
      userId: 'actor-a',
      userRole: role,
      isSuperAdmin: false,
    };
    next();
  });
  server.use('/api/v8/transformation-cases', router);
  return server;
}

describe('Transformation runtime capability routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCase.mockResolvedValue({
      transformationCaseId: 'case-a',
      organizationId: 'org-a',
      initiatedByUserId: 'actor-a',
      projectId: null,
    });
  });

  it('derives tenant and actor for registration and ignores hostile body identity', async () => {
    register.mockResolvedValue({
      lifecycleStage: 'initial_ideas',
      derivedStatus: 'EVIDENCE_MISSING',
    });
    const response = await request(await app())
      .put('/api/v8/transformation-cases/runtime-capabilities/registration')
      .send({
        lifecycleStage: 'initial_ideas',
        capabilityKey: 'ideas.materialize',
        ownerModule: 'Ideas',
        evidenceContract: { requiredChecks: ['adapter_registered'] },
        organizationId: 'org-foreign',
        actorUserId: 'attacker',
      });
    expect(response.status).toBe(200);
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-a', actorUserId: 'actor-a' })
    );
  });

  it('blocks non-admin evidence mutation', async () => {
    const response = await request(await app('CONSULTANT'))
      .post('/api/v8/transformation-cases/runtime-capabilities/evidence')
      .send({
        lifecycleStage: 'initial_ideas',
        evidence: {},
      });
    expect(response.status).toBe(403);
    expect(report).not.toHaveBeenCalled();
  });

  it('lists and reconciles only inside the authenticated tenant', async () => {
    list.mockResolvedValue([]);
    reconcile.mockResolvedValue({
      changedSteps: 0,
      idempotentReplay: true,
      registryDigest: 'digest',
    });
    expect(
      (await request(await app()).get('/api/v8/transformation-cases/case-a/runtime-capabilities'))
        .status
    ).toBe(200);
    expect(list).toHaveBeenCalledWith('org-a');
    const response = await request(await app())
      .post('/api/v8/transformation-cases/case-a/runtime-capabilities/reconcile')
      .send({ organizationId: 'org-foreign' });
    expect(response.status).toBe(200);
    expect(reconcile).toHaveBeenCalledWith({
      organizationId: 'org-a',
      transformationCaseId: 'case-a',
      actorUserId: 'actor-a',
    });
  });
});
