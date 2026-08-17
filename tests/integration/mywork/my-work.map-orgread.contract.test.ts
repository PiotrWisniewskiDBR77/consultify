/**
 * M09 L-01 / A1 (D-WB-2) — GET /my-ideas/:id/map canonical-owner read.
 *
 * A 2nd org member opening a colleague's whiteboard must get 200 with the owner's
 * canonical board (not 404), matching the row PUT/sync now write to (see
 * resolveCanonicalMapOwner in my-work.routes.ts). Owner / single-player path is
 * unchanged (ownerUserId === viewer's own id). Idea outside the org → 404. Mirrors
 * the map-sync contract harness (mock queryHelpers, no DB).
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown>>());
const mockQueryRun = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());
const mockQueryAll = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown[]>>());
const mockRun = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());

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
  getTableColumns: () =>
    Promise.resolve(
      new Set([
        'id', 'idea_id', 'user_id', 'organization_id', 'nodes_json', 'edges_json',
        'version', 'preferred_tool', 'extensions_json', 'created_at', 'updated_at',
      ])
    ),
}));

// req.user = user-1 / org-1 (the *viewer*).
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'admin' };
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
vi.mock('../../../server/src/services/inboxService.js', () => ({ default: { addItem: vi.fn(), removeItem: vi.fn() } }));
vi.mock('../../../server/src/services/notificationService.js', () => ({ default: { send: vi.fn(), createNotification: vi.fn() } }));
vi.mock('../../../server/src/services/organizationContext/OrganizationContextService.js', () => ({ default: { getContext: vi.fn().mockResolvedValue(null) } }));
vi.mock('../../../server/src/services/tablePlatform/ProjectionService.js', () => ({ default: { project: vi.fn() } }));
vi.mock('../../../server/src/services/taskAssignmentService.js', () => ({ default: { assign: vi.fn() } }));
vi.mock('../../../server/src/services/taskWorkflowService.js', () => ({ normalizeTaskStatus: vi.fn((s: string) => s), validateTaskStatusTransition: vi.fn().mockReturnValue({ valid: true }) }));
vi.mock('../../../server/src/services/workloadCapacityService.js', () => ({ getCapacityOverview: vi.fn().mockResolvedValue({}), getOverloadAlerts: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../server/src/services/ideaClusterService.js', () => ({ createOutcomeFromCluster: vi.fn(), materializeClusters: vi.fn() }));
vi.mock('../../../server/src/services/inboxAiAssistService.js', () => ({ InboxAiAssistItemSchema: { parse: vi.fn() }, runInboxAiAssist: vi.fn() }));
vi.mock('../../../server/src/config/FeatureFlags.js', () => ({ featureFlags: { ENABLE_TABLE_PLATFORM_RECORDS_API: true, ENABLE_INBOX_AI_ASSIST: false } }));

import myWorkRoutes from '../../../server/src/routes/my-work.routes.ts';

const IDEA_ID = 'idea-shared-01';
const NODE = { id: 'n1', type: 'idea', position: { x: 0, y: 0 }, data: { label: 'Alpha' } };
const OWNER_MAP = {
  id: 'map-owner',
  version: 4,
  nodesJson: JSON.stringify([NODE]),
  edgesJson: JSON.stringify([]),
  preferredTool: 'whiteboard',
  extensionsJson: '{}',
  schemaVersion: 1,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

describe('M09 L-01 / A1 (D-WB-2) — GET /map canonical-owner read', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockQueryAll.mockResolvedValue([]);
    mockRun.mockResolvedValue({ changes: 1 });
  });

  it('2nd org member (non-owner) reads the idea owner canonical board → 200', async () => {
    mockQueryOne
      // idea exists in org, owned by owner-9 (viewer is user-1)
      .mockResolvedValueOnce({ id: IDEA_ID, title: 'Shared board', ownerUserId: 'owner-9' })
      // canonical-owner (owner-9) row read directly — no viewer-row lookup anymore
      .mockResolvedValueOnce(OWNER_MAP);

    const res = await request(buildApp()).get(`/api/my-work/my-ideas/${IDEA_ID}/map`);

    expect(res.status).toBe(200);
    expect(res.body.map?.nodes?.length).toBe(1);
    expect(res.body.isDefault).toBeFalsy();
    // exactly 2 queries: idea (resolves canonical owner) + owner's map row
    expect(mockQueryOne).toHaveBeenCalledTimes(2);
  });

  it('owner reads own board (canonical owner === viewer) → 200', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: IDEA_ID, title: 'Mine', ownerUserId: 'user-1' })
      .mockResolvedValueOnce(OWNER_MAP); // own (== canonical) row found

    const res = await request(buildApp()).get(`/api/my-work/my-ideas/${IDEA_ID}/map`);

    expect(res.status).toBe(200);
    expect(res.body.map?.nodes?.length).toBe(1);
    // exactly 2 queries: idea + canonical map row (owner === viewer here)
    expect(mockQueryOne).toHaveBeenCalledTimes(2);
  });

  it('idea outside the org → 404 (no cross-org leak)', async () => {
    mockQueryOne.mockResolvedValueOnce(null); // idea not found in org

    const res = await request(buildApp()).get(`/api/my-work/my-ideas/${IDEA_ID}/map`);

    expect(res.status).toBe(404);
  });

  it('member opens a colleague board that has no saved map yet → 200 default (not 404)', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: IDEA_ID, title: 'Empty shared', ownerUserId: 'owner-9' })
      .mockResolvedValueOnce(null); // owner has no map row either

    const res = await request(buildApp()).get(`/api/my-work/my-ideas/${IDEA_ID}/map`);

    expect(res.status).toBe(200);
    expect(res.body.isDefault).toBe(true);
  });
});
