/**
 * B1 (M09) — Whiteboard facilitation observer read-only enforcement.
 *
 * A user assigned the 'observer' role in an ACTIVE facilitation session
 * (tool_session_id = `whiteboard:<ideaId>`) must be blocked from mutating the shared
 * board: PUT /my-ideas/:id/map and POST /my-ideas/:id/map/sync return 403
 * WHITEBOARD_OBSERVER_READONLY. Facilitator / participant / no-role / no-active-session
 * are ALL unchanged (write proceeds → 200) so single-player editing and the A1
 * canonical-owner write path are untouched.
 *
 * Mock-based (no DB), mirrors my-work.map-object-limit.contract.test.ts. The observer
 * gate issues a single queryAll against tool_facilitation_roles JOIN
 * tool_facilitation_sessions; the mock discriminates by SQL text so the gate result is
 * independent of unrelated queryAll call ordering.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockQueryOne = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown>>());
const mockQueryRun = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());
const mockQueryAll = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown[]>>());

// Controls what the observer-gate queryAll returns for this test run.
const observerState = vi.hoisted(() => ({ role: null as string | null }));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: (...a: Parameters<typeof mockQueryOne>) => mockQueryOne(...a),
  queryRun: (...a: Parameters<typeof mockQueryRun>) => mockQueryRun(...a),
  // Discriminate the observer-gate query by SQL text; everything else → [].
  queryAll: (sql: string, params: unknown[]) => {
    if (typeof sql === 'string' && sql.includes('tool_facilitation_roles')) {
      return Promise.resolve(observerState.role ? [{ role_name: observerState.role }] : []);
    }
    return mockQueryAll(sql, params);
  },
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

const IDEA_ID = 'idea-obs-01';
const USER_ID = 'user-1';
const NODE = { id: 'n1', type: 'idea', position: { x: 0, y: 0 }, data: { label: 'Alpha' } };
const EDGE = { id: 'e1', source: 'n1', target: 'n1' };

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

/**
 * Prime queryOne for the write path: 1st call resolves the canonical owner (idea exists),
 * 2nd call returns the existing (or absent) map row. Owner === USER_ID so this is the
 * single-owner path; observer enforcement is orthogonal to ownership.
 */
function primeWritePath(existingMap: unknown = null) {
  mockQueryOne
    .mockResolvedValueOnce({ id: IDEA_ID, title: 'Board', ownerUserId: USER_ID })
    .mockResolvedValueOnce(existingMap);
}

describe('B1 (M09) — whiteboard observer read-only enforcement', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    observerState.role = null;
    mockQueryOne.mockResolvedValue(null);
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockQueryAll.mockResolvedValue([]);
  });

  // ── PUT /my-ideas/:id/map ─────────────────────────────────────────────────────

  it('observer → PUT /map is rejected 403 WHITEBOARD_OBSERVER_READONLY', async () => {
    observerState.role = 'observer';
    primeWritePath();

    const res = await request(buildApp())
      .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
      .send({ nodes: [NODE], edges: [EDGE] });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('WHITEBOARD_OBSERVER_READONLY');
  });

  it('participant → PUT /map proceeds (200, unchanged)', async () => {
    observerState.role = 'participant';
    primeWritePath();

    const res = await request(buildApp())
      .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
      .send({ nodes: [NODE], edges: [EDGE] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('facilitator → PUT /map proceeds (200, unchanged)', async () => {
    observerState.role = 'facilitator';
    primeWritePath();

    const res = await request(buildApp())
      .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
      .send({ nodes: [NODE], edges: [EDGE] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('no active facilitation session → PUT /map proceeds (200, unchanged)', async () => {
    observerState.role = null; // no role row → not observer
    primeWritePath();

    const res = await request(buildApp())
      .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
      .send({ nodes: [NODE], edges: [EDGE] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ── POST /my-ideas/:id/map/sync ───────────────────────────────────────────────

  it('observer → POST /map/sync is rejected 403 WHITEBOARD_OBSERVER_READONLY', async () => {
    observerState.role = 'observer';
    primeWritePath();

    const res = await request(buildApp())
      .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
      .send({ nodes: [NODE], edges: [EDGE] });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('WHITEBOARD_OBSERVER_READONLY');
  });

  it('participant → POST /map/sync proceeds (200, unchanged)', async () => {
    observerState.role = 'participant';
    primeWritePath();

    const res = await request(buildApp())
      .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
      .send({ nodes: [NODE], edges: [EDGE] });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('no active facilitation session → POST /map/sync proceeds (200, unchanged)', async () => {
    observerState.role = null;
    primeWritePath();

    const res = await request(buildApp())
      .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
      .send({ nodes: [NODE], edges: [EDGE] });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
