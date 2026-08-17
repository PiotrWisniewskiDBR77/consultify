/**
 * P13 A5 — Whiteboard object limit enforcement (>500 hard cap).
 *
 * Scenario: Backend guard rejects nodes_json > 500 with 422 WHITEBOARD_OBJECT_LIMIT_EXCEEDED.
 * Tests cover both PUT /my-ideas/:id/map and POST /my-ideas/:id/map/sync.
 *
 * Mock-based: no real DB needed.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockQueryOne = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown>>());
const mockQueryRun = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());
const mockQueryAll = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown[]>>());

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: (...a: Parameters<typeof mockQueryOne>) => mockQueryOne(...a),
  queryRun: (...a: Parameters<typeof mockQueryRun>) => mockQueryRun(...a),
  queryAll: (...a: Parameters<typeof mockQueryAll>) => mockQueryAll(...a),
  run: vi.fn().mockResolvedValue({ changes: 1 }),
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
        'id',
        'idea_id',
        'user_id',
        'organization_id',
        'nodes_json',
        'edges_json',
        'version',
        'preferred_tool',
        'extensions_json',
        'created_at',
        'updated_at',
      ])
    ),
}));

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

// Heavy services — stub
vi.mock('../../../server/src/services/inboxService.js', () => ({
  default: { addItem: vi.fn(), removeItem: vi.fn() },
}));

vi.mock('../../../server/src/services/notificationService.js', () => ({
  default: { send: vi.fn(), createNotification: vi.fn() },
}));

vi.mock('../../../server/src/services/organizationContext/OrganizationContextService.js', () => ({
  default: { getContext: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../../server/src/services/tablePlatform/ProjectionService.js', () => ({
  default: { project: vi.fn() },
}));

vi.mock('../../../server/src/services/taskAssignmentService.js', () => ({
  default: { assign: vi.fn() },
}));

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
  featureFlags: {
    ENABLE_TABLE_PLATFORM_RECORDS_API: true,
    ENABLE_INBOX_AI_ASSIST: false,
  },
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import myWorkRoutes from '../../../server/src/routes/my-work.routes.ts';

// ── Fixtures ────────────────────────────────────────────────────────────────────

const IDEA_ID = 'idea-test-01';
const USER_ID = 'user-1';
const ORG_ID = 'org-1';

// Helper: generate N nodes
function generateNodes(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    type: 'stickyNote',
    position: { x: i * 10, y: 0 },
    data: { label: `Note ${i}` },
  }));
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('P13 A5 — Whiteboard object limit (422 hard cap at >500)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockQueryOne.mockResolvedValue(null);
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockQueryAll.mockResolvedValue([]);
  });

  // ── PUT /my-ideas/:id/map limit guard ──────────────────────────────────────

  describe('PUT /my-ideas/:id/map — hard cap at 500 nodes', () => {
    it('PUT with 500 nodes → 200 (at limit, allowed)', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ ownerUserId: USER_ID }) // resolveCanonicalMapOwner
        .mockResolvedValueOnce(null); // no existing map

      const nodes = generateNodes(500);

      const res = await request(buildApp())
        .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
        .send({ nodes, edges: [], baseVersion: null });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('PUT with 501 nodes → 422 WHITEBOARD_OBJECT_LIMIT_EXCEEDED', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: IDEA_ID, title: 'Test' }); // idea exists

      const nodes = generateNodes(501);

      const res = await request(buildApp())
        .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
        .send({ nodes, edges: [], baseVersion: null });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('WHITEBOARD_OBJECT_LIMIT_EXCEEDED');
      expect(res.body.current).toBe(501);
      expect(res.body.limit).toBe(500);
      expect(res.body.error).toMatch(/Object limit exceeded/i);
    });

    it('PUT with 750 nodes → 422 (far over limit)', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: IDEA_ID, title: 'Test' });

      const nodes = generateNodes(750);

      const res = await request(buildApp())
        .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
        .send({ nodes, edges: [], baseVersion: null });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('WHITEBOARD_OBJECT_LIMIT_EXCEEDED');
      expect(res.body.current).toBe(750);
    });
  });

  // ── POST /my-ideas/:id/map/sync limit guard ────────────────────────────────

  describe('POST /my-ideas/:id/map/sync — hard cap at 500 nodes', () => {
    it('POST /sync with 500 nodes → 200 (at limit, allowed)', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ ownerUserId: USER_ID }) // resolveCanonicalMapOwner
        .mockResolvedValueOnce(null); // no existing map

      const nodes = generateNodes(500);

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
        .send({ nodes, edges: [], baseVersion: null });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('POST /sync with 501 nodes → 422 WHITEBOARD_OBJECT_LIMIT_EXCEEDED', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: IDEA_ID, title: 'Test' }); // idea exists

      const nodes = generateNodes(501);

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
        .send({ nodes, edges: [], baseVersion: 1 });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('WHITEBOARD_OBJECT_LIMIT_EXCEEDED');
      expect(res.body.current).toBe(501);
      expect(res.body.limit).toBe(500);
    });

    it('POST /sync with 750 nodes → 422 (far over)', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: IDEA_ID, title: 'Test' });

      const nodes = generateNodes(750);

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
        .send({ nodes, edges: [], baseVersion: 1 });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('WHITEBOARD_OBJECT_LIMIT_EXCEEDED');
      expect(res.body.current).toBe(750);
    });
  });
});
