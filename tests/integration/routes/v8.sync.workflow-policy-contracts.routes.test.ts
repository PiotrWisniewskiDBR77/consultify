import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGetMock = vi.fn();
const dbRunMock = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', async () => {
  const actual = await vi.importActual<any>('../../../server/src/utils/DbPromise.js');
  return {
    ...actual,
    get: (...args: any[]) => dbGetMock(...args),
    run: (...args: any[]) => dbRunMock(...args),
    all: vi.fn(async () => []),
  };
});

import syncRoutes from '../../../server/src/routes/v8/sync.routes.js';

describe('v8 sync workflow-policy contracts', () => {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'ADMIN' };
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    req.v8Context = {
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: 'ADMIN',
      isSuperAdmin: false,
    };
    next();
  });
  app.use('/api/v8/sync', syncRoutes);

  beforeEach(() => {
    vi.clearAllMocks();
    dbGetMock.mockResolvedValue(null);
    dbRunMock.mockResolvedValue({ changes: 1 });
  });

  it('returns coded 404 when workflow policy integration is missing', async () => {
    const res = await request(app).get('/api/v8/sync/integrations/int-missing/workflow-policy');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('SYNC_WORKFLOW_POLICY_INTEGRATION_NOT_FOUND');
  });

  it('returns coded 400 when workflow policy payload is invalid', async () => {
    const res = await request(app)
      .post('/api/v8/sync/integrations/int-1/workflow-policy')
      .send({ policy: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SYNC_WORKFLOW_POLICY_INVALID');
  });

  it('returns coded 503 when workflow policy read fails', async () => {
    dbGetMock.mockRejectedValueOnce(new Error('db-down'));

    const res = await request(app).get('/api/v8/sync/integrations/int-1/workflow-policy');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SYNC_WORKFLOW_POLICY_READ_FAILED');
  });

  it('returns coded 503 when workflow policy update fails', async () => {
    dbGetMock.mockResolvedValueOnce({ id: 'int-1' });
    dbRunMock.mockRejectedValueOnce(new Error('db-write-failed'));

    const res = await request(app)
      .post('/api/v8/sync/integrations/int-1/workflow-policy')
      .send({ policy: 'paused', reason: 'maintenance' });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SYNC_WORKFLOW_POLICY_UPDATE_FAILED');
  });
});
