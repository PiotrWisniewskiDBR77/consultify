import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Context = vi.fn();
const mockRequireCaseAccess = vi.fn();
const mockCreateWait = vi.fn();
const mockGetWait = vi.fn();
const mockResolveWait = vi.fn();
const mockListWaitsForCase = vi.fn();

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: (...args: unknown[]) => mockGetV8Context(...args),
}));

vi.mock('../../../services/caseWorkspace/caseWorkspaceAuthContext.js', async () => {
  const actual = await vi.importActual<typeof import('../../../services/caseWorkspace/caseWorkspaceAuthContext.js')>(
    '../../../services/caseWorkspace/caseWorkspaceAuthContext.js'
  );
  return { ...actual, requireCaseAccess: (...args: unknown[]) => mockRequireCaseAccess(...args) };
});

vi.mock('../../../services/caseWorkspace/waitSubscriptionService.js', () => ({
  createWait: (...args: unknown[]) => mockCreateWait(...args),
  getWait: (...args: unknown[]) => mockGetWait(...args),
  resolveWait: (...args: unknown[]) => mockResolveWait(...args),
  provideHumanInput: vi.fn(),
  cancelWait: vi.fn(),
  listWaitsForRun: vi.fn(),
  listWaitsForCase: (...args: unknown[]) => mockListWaitsForCase(...args),
}));

import waitSubscriptionsRoutes from '../waitSubscriptions.routes.js';
import { errorHandlerMiddleware } from '../../../utils/ErrorHandler.js';

const ORG = 'org-1';
const USER = 'user-1';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8/case-workspace', waitSubscriptionsRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('caseWorkspace wait routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetV8Context.mockReturnValue({ organizationId: ORG, userId: USER, userRole: 'ADMIN', isSuperAdmin: false });
    mockRequireCaseAccess.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
  });

  it('requires either body.correlationKey or an Idempotency-Key header to create a wait', async () => {
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/waits')
      .send({ waitType: 'HUMAN', runId: 'run-1' });
    expect(res.status).toBe(400);
    expect(mockCreateWait).not.toHaveBeenCalled();
  });

  it('threads an Idempotency-Key header into createWait.correlationKey when body omits it', async () => {
    mockCreateWait.mockResolvedValue({ waitId: 'cwwait-1', caseId: 'case-1' });
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/waits')
      .set('Idempotency-Key', 'corr-1')
      .send({ waitType: 'HUMAN', runId: 'run-1' });
    expect(res.status).toBe(201);
    expect(mockCreateWait).toHaveBeenCalledWith(
      expect.objectContaining({ correlationKey: 'corr-1', caseId: 'case-1' }),
      USER
    );
  });

  it('rejects an invalid waitType enum with 400', async () => {
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/waits')
      .send({ waitType: 'NOT_A_TYPE', correlationKey: 'corr-1' });
    expect(res.status).toBe(400);
  });

  it('resolves the owning caseId via getWait before authorizing resolve, and 404s when missing', async () => {
    mockGetWait.mockResolvedValue(null);
    const res = await request(createApp())
      .post('/api/v8/case-workspace/waits/wait-missing/resolve')
      .send({ satisfiedByEventId: 'evt-1', expectedVersion: 1 });
    expect(res.status).toBe(404);
    expect(mockResolveWait).not.toHaveBeenCalled();
  });

  it('maps wait_claim_fenced to 409', async () => {
    mockGetWait.mockResolvedValue({ waitId: 'wait-1', caseId: 'case-1' });
    mockResolveWait.mockRejectedValue(new Error('wait_claim_fenced'));
    const res = await request(createApp())
      .post('/api/v8/case-workspace/waits/wait-1/resolve')
      .send({ satisfiedByEventId: 'evt-1', expectedVersion: 1 });
    expect(res.status).toBe(409);
  });

  it('checks case access before listing waits for a case', async () => {
    mockListWaitsForCase.mockResolvedValue([]);
    const res = await request(createApp()).get('/api/v8/case-workspace/cases/case-1/waits');
    expect(res.status).toBe(200);
    expect(mockRequireCaseAccess).toHaveBeenCalledWith(USER, 'case-1');
  });
});
