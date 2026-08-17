// @vitest-environment node

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryAllMock = vi.fn();
const queryRunMock = vi.fn();
const orgContextBuildMock = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  validateOrgMembership: (_req: any, _res: any, next: any) => next(),
  verifyToken: (req: any, _res: any, next: any) => {
    if (req.get('x-test-auth') === 'none') {
      req.user = undefined;
      req.userId = undefined;
      req.organizationId = undefined;
    } else {
      req.user = { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' };
      req.userId = 'u-1';
      req.organizationId = 'org-1';
      req.db = req.get('x-test-db') === 'none' ? null : req.db;
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
  getTableColumns: vi.fn(async () => new Set(['id'])),
}));

vi.mock('../../../server/src/services/AuditEventsService.js', () => ({
  default: { log: vi.fn(async () => 'audit-event-1') },
}));

vi.mock('../../../server/src/services/inboxService.js', () => ({
  default: { getInboxStats: vi.fn(async () => ({})) },
}));

vi.mock('../../../server/src/services/organizationContext/OrganizationContextService.js', () => ({
  default: {
    buildResolvedContext: (...args: any[]) => orgContextBuildMock(...args),
    recordChatMessage: vi.fn(async () => ({ itemId: 'ctx-1' })),
  },
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  listMyWorkArtifacts: vi.fn(async () => ({ mine: [], review: [], recent: [] })),
}));

vi.mock('../../../server/src/services/homeCoverFeedService.js', () => ({
  getAiNews: vi.fn(async () => []),
  pickTipOfDay: vi.fn(() => ({ appTip: 'tip', aiPlaybookTip: 'playbook' })),
}));

vi.mock('../../../server/src/services/v8/executionVisibilityService.js', () => ({
  rollupSignals: vi.fn(async () => ({ byType: new Map(), byInitiative: new Map(), total: 0 })),
}));

vi.mock('../../../server/src/services/v8/collaborationRoomService.js', () => ({
  getActiveRoomsByOrg: vi.fn(async () => []),
  getRoomHealth: vi.fn(async () => null),
}));

vi.mock('../../../server/src/services/v8/planningContinuityService.js', () => ({
  getPendingDecisions: vi.fn(async () => []),
}));

vi.mock('../../../server/src/services/ideaClusterService.js', () => ({
  materializeClusters: vi.fn(async () => []),
  createOutcomeFromCluster: vi.fn(async () => ({})),
}));

vi.mock('../../../server/src/services/tablePlatform/ProjectionService.js', () => ({
  default: {},
}));

vi.mock('../../../server/src/validators/ideaWorkspaceGraph.validators.js', () => ({
  ensureLatestSchema: vi.fn(async () => ({})),
  normalizeGraphForStorage: vi.fn((v: any) => v),
  validateAndNormalizeGraph: vi.fn((v: any) => v),
}));

import myWorkRoutes from '../../../server/src/routes/my-work.routes.ts';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

describe('my-work home fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    queryAllMock.mockResolvedValue([]);
    queryRunMock.mockResolvedValue({ changes: 1 });
    orgContextBuildMock.mockResolvedValue({
      profile: {},
      strategic: { priorities: [] },
      operations: { constraints: [] },
    });
  });

  it('returns coded 503 with correlation parity when Home v2 db is unavailable', async () => {
    const res = await request(app)
      .get('/api/my-work/home/v2')
      .set('x-test-db', 'none')
      .set('X-Correlation-ID', 'pack10s5-mywork-home-db-unavailable-1');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('MY_WORK_HOME_DATABASE_UNAVAILABLE');
    expect(res.body.error.message).toBe('My Work Home data is temporarily unavailable.');
    expect(res.body.correlationId).toBe('pack10s5-mywork-home-db-unavailable-1');
  });

  it('returns coded 500 for Home brief failures without leaking internals', async () => {
    queryAllMock.mockRejectedValueOnce(new Error('INTERNAL_SECRET_DB'));
    const res = await request(app)
      .get('/api/my-work/home/brief')
      .set('X-Correlation-ID', 'pack10s5-mywork-home-brief-fail-1');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('MY_WORK_HOME_BRIEF_READ_FAILED');
    expect(res.body.error.message).toBe('Failed to load My Work brief.');
    expect(res.body.correlationId).toBe('pack10s5-mywork-home-brief-fail-1');
    expect(JSON.stringify(res.body)).not.toContain('INTERNAL_SECRET_DB');
  });
});
