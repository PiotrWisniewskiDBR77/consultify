// @vitest-environment node

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryAllMock = vi.fn();
const queryRunMock = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  validateOrgMembership: (_req: any, _res: any, next: any) => next(),
  verifyToken: (req: any, _res: any, next: any) => {
    if (req.get('x-test-auth') === 'none') {
      req.user = undefined;
    } else {
      req.user = { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' };
    }
    next();
  },
  requireRole:
    (..._roles: string[]) =>
    (_req: any, _res: any, next: any) =>
      next(),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: any[]) => queryAllMock(...args),
  queryRun: (...args: any[]) => queryRunMock(...args),
  queryOne: vi.fn(async () => null),
}));

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(async (table: string) => {
    if (table === 'link_graph_edges') {
      return new Set([
        'id',
        'organization_id',
        'created_by',
        'source_type',
        'source_id',
        'target_type',
        'target_id',
        'relation',
        'container_type',
        'container_id',
        'block_id',
        'created_at',
      ]);
    }
    return new Set(['id']);
  }),
}));

vi.mock('../../../server/src/services/AuditEventsService.js', () => ({
  default: {
    log: vi.fn(async () => 'audit-event-1'),
  },
}));

import myWorkRoutes from '../../../server/src/routes/my-work.routes.ts';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

describe('my-work link graph fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    queryAllMock.mockResolvedValue([]);
    queryRunMock.mockResolvedValue({ changes: 1 });
  });

  it('returns coded 401 with correlation parity when user context is missing', async () => {
    const res = await request(app)
      .get('/api/my-work/link-graph/backlinks?type=task&id=t-1')
      .set('x-test-auth', 'none')
      .set('X-Correlation-ID', 'pack10s2-mywork-unauthorized-1');

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('MY_WORK_UNAUTHORIZED');
    expect(res.body.error.message).toBe('Authentication is required to access My Work.');
    expect(res.body.correlationId).toBe('pack10s2-mywork-unauthorized-1');
    expect(res.headers['x-correlation-id']).toBe('pack10s2-mywork-unauthorized-1');
  });

  it('returns coded 400 for incomplete backlinks query', async () => {
    const res = await request(app)
      .get('/api/my-work/link-graph/backlinks?type=task')
      .set('X-Correlation-ID', 'pack10s2-mywork-backlinks-invalid-1');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('MY_WORK_LINK_GRAPH_QUERY_INCOMPLETE');
    expect(res.body.error.message).toBe('Both type and id query parameters are required.');
    expect(res.body.correlationId).toBe('pack10s2-mywork-backlinks-invalid-1');
  });

  it('returns coded 400 for invalid edge payload without leaking zod details', async () => {
    const res = await request(app)
      .post('/api/my-work/link-graph/edges')
      .send({ source: { type: 'task' }, target: { type: 'idea', id: 'i-1' } })
      .set('X-Correlation-ID', 'pack10s2-mywork-edge-invalid-1');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('MY_WORK_LINK_GRAPH_PAYLOAD_INVALID');
    expect(res.body.error.message).toBe('Link graph edge payload is invalid.');
    expect(res.body.correlationId).toBe('pack10s2-mywork-edge-invalid-1');
    expect(JSON.stringify(res.body)).not.toContain('Expected');
  });
});
