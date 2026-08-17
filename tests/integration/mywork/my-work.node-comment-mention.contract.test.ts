/**
 * B2 — POST /my-ideas/:id/map/nodes/:nodeId/comments with @mentions must fan out
 * a `whiteboard.mention` notification to each mentioned ORG member (and only org
 * members). Contract test: mock queryHelpers (no DB), organizationService.getMembers
 * (the org roster / scoping boundary) and notificationService.send (assert args).
 *
 * Mirrors the map-orgread contract harness.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown>>());
const mockQueryRun = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());
const mockQueryAll = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown[]>>());
const mockRun = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());
const mockGetMembers = vi.hoisted(() => vi.fn<[string], Promise<unknown[]>>());
const mockNotifySend = vi.hoisted(() => vi.fn<[Record<string, unknown>], Promise<string>>());

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: (...a: Parameters<typeof mockQueryOne>) => mockQueryOne(...a),
  queryRun: (...a: Parameters<typeof mockQueryRun>) => mockQueryRun(...a),
  queryAll: (...a: Parameters<typeof mockQueryAll>) => mockQueryAll(...a),
  run: (...a: Parameters<typeof mockRun>) => mockRun(...a),
  query: (...a: Parameters<typeof mockQueryAll>) => mockQueryAll(...a),
  queryFirst: vi.fn().mockResolvedValue(null),
  queryParallel: vi.fn().mockResolvedValue([]),
  transaction: vi.fn().mockResolvedValue(undefined),
  buildInPlaceholders: (v: unknown[]) => v.map(() => '?').join(', '),
  buildOrgFilter: vi.fn().mockReturnValue('1=1'),
  buildUserFilter: vi.fn().mockReturnValue('1=1'),
  parseJsonFields: vi.fn((r: unknown) => r),
  transformRow: vi.fn((r: unknown) => r),
  enablePerformanceTracking: vi.fn(),
  disablePerformanceTracking: vi.fn(),
  getTableColumns: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: () => Promise.resolve(new Set(['id', 'idea_id', 'node_id', 'organization_id'])),
}));

// req.user = user-1 / org-1 (comment author).
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'admin', name: 'Piotr Owner' };
    next();
  },
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  validateOrgMembership: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireSuperAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (req: any, _res: unknown, next: () => void) => {
    req.emitAuditEvent = vi.fn().mockResolvedValue('audit-id');
    next();
  },
}));
vi.mock('../../../server/src/services/AuditEventsService.js', () => ({
  default: { log: vi.fn().mockResolvedValue('audit-id') },
}));
vi.mock('../../../server/src/services/inboxService.js', () => ({
  default: { addItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock('../../../server/src/services/notificationService.js', () => ({
  default: { send: (...a: Parameters<typeof mockNotifySend>) => mockNotifySend(...a) },
}));
vi.mock('../../../server/src/services/organizationService.js', () => ({
  getMembers: (...a: Parameters<typeof mockGetMembers>) => mockGetMembers(...a),
}));
vi.mock('../../../server/src/services/organizationContext/OrganizationContextService.js', () => ({
  default: { getContext: vi.fn().mockResolvedValue(null) },
}));
vi.mock('../../../server/src/services/tablePlatform/ProjectionService.js', () => ({
  default: { project: vi.fn() },
}));
vi.mock('../../../server/src/services/taskAssignmentService.js', () => ({ default: { assign: vi.fn() } }));
vi.mock('../../../server/src/services/taskWorkflowService.js', () => ({
  normalizeTaskStatus: vi.fn((s: string) => s),
  validateTaskStatusTransition: vi.fn().mockReturnValue({ valid: true }),
}));
vi.mock('../../../server/src/services/workloadCapacityService.js', () => ({
  getCapacityOverview: vi.fn().mockResolvedValue({}),
  getOverloadAlerts: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../server/src/services/ideaClusterService.js', () => ({
  createOutcomeFromCluster: vi.fn(),
  materializeClusters: vi.fn(),
}));
vi.mock('../../../server/src/services/inboxAiAssistService.js', () => ({
  InboxAiAssistItemSchema: { parse: vi.fn() },
  runInboxAiAssist: vi.fn(),
}));
vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  featureFlags: { ENABLE_TABLE_PLATFORM_RECORDS_API: true, ENABLE_INBOX_AI_ASSIST: false },
}));

import myWorkRoutes from '../../../server/src/routes/my-work.routes.ts';

const IDEA_ID = 'idea-wb-01';
const NODE_ID = 'node-42';

const ORG_MEMBERS = [
  { user_id: 'user-1', first_name: 'Piotr', last_name: 'Owner', email: 'piotr@acme.io' },
  { user_id: 'user-anna', first_name: 'Anna', last_name: 'Kowalska', email: 'anna@acme.io' },
  { user_id: 'user-bob', first_name: 'Bob', last_name: 'Nowak', email: 'bob@acme.io' },
];

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

function post(body: Record<string, unknown>) {
  return request(buildApp())
    .post(`/api/my-work/my-ideas/${IDEA_ID}/map/nodes/${NODE_ID}/comments`)
    .send(body);
}

describe('B2 — whiteboard node comment @mention → notification', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRun.mockResolvedValue({ changes: 1 });
    mockQueryAll.mockResolvedValue([]);
    mockGetMembers.mockResolvedValue(ORG_MEMBERS);
    mockNotifySend.mockResolvedValue('notif-id');
  });

  it('notifies each mentioned ORG member with correct args (type/entity/actor)', async () => {
    const res = await post({
      text: 'good point @user-anna and @user-bob, please look',
      mentions: ['user-anna', 'user-bob'],
    });

    expect(res.status).toBe(201);
    expect(mockNotifySend).toHaveBeenCalledTimes(2);

    const recipients = mockNotifySend.mock.calls.map((c) => (c[0] as any).userId).sort();
    expect(recipients).toEqual(['user-anna', 'user-bob']);

    const first = mockNotifySend.mock.calls[0][0] as any;
    expect(first).toMatchObject({
      organizationId: 'org-1',
      type: 'whiteboard.mention',
      entityType: 'idea',
      entityId: IDEA_ID,
      relatedObjectType: 'idea_node',
      relatedObjectId: NODE_ID,
      actorId: 'user-1',
    });
    expect(first.metadata).toMatchObject({ ideaId: IDEA_ID, nodeId: NODE_ID });
  });

  it('does NOT notify a mentioned user outside the org (org-scoping boundary)', async () => {
    const res = await post({
      text: 'hey @outsider and @user-anna',
      mentions: ['outsider', 'user-anna'],
    });

    expect(res.status).toBe(201);
    expect(mockNotifySend).toHaveBeenCalledTimes(1);
    expect((mockNotifySend.mock.calls[0][0] as any).userId).toBe('user-anna');
  });

  it('does NOT notify the author for a self-mention', async () => {
    const res = await post({ text: 'note to self @user-1', mentions: ['user-1'] });
    expect(res.status).toBe(201);
    expect(mockNotifySend).not.toHaveBeenCalled();
  });

  it('a comment with no mentions sends no notifications', async () => {
    const res = await post({ text: 'plain comment, no tags' });
    expect(res.status).toBe(201);
    expect(mockNotifySend).not.toHaveBeenCalled();
  });

  it('still persists the comment (201) even if notification send throws', async () => {
    mockNotifySend.mockRejectedValue(new Error('notify down'));
    const res = await post({ text: '@user-anna ping', mentions: ['user-anna'] });
    expect(res.status).toBe(201);
    expect(res.body.comment?.id).toBeTruthy();
  });
});
