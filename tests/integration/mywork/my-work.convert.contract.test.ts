/**
 * M05 L-08 — S5 contract test for idea→entity conversion.
 *
 * S5: POST /my-ideas/:id/convert with target='initiative' creates an initiative,
 *     promotes the idea, and returns { promotedTo, promotedEntityId, created }.
 *     Invalid targets → 400. Unknown idea → 404.
 *
 * Mock-based: no real DB needed. Same mock strategy as map-sync contract tests.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockQueryOne = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown>>());
const mockQueryRun = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());
const mockQueryAll = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown[]>>());
const mockRun     = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne:  (...a: Parameters<typeof mockQueryOne>)  => mockQueryOne(...a),
  queryRun:  (...a: Parameters<typeof mockQueryRun>)  => mockQueryRun(...a),
  queryAll:  (...a: Parameters<typeof mockQueryAll>)  => mockQueryAll(...a),
  run:       (...a: Parameters<typeof mockRun>)       => mockRun(...a),
  query:     (...a: Parameters<typeof mockQueryAll>)  => mockQueryAll(...a),
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

// Table-aware getTableColumns — plain arrow fn so vi.resetAllMocks() won't clear it.
// - 'initiatives': return core columns so INSERT builds correctly
// - 'tool_sessions': return empty → triggers ENABLE_TEST_GATEWAY mock-gateway path
// - 'link_graph_edges': return empty → linkGraphAddEdge returns null (no-op)
vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: (tableName: string) => {
    if (tableName === 'initiatives') {
      return Promise.resolve(
        new Set(['id', 'organization_id', 'name', 'summary', 'area',
                 'owner_execution_id', 'owner_business_id', 'sponsor_id',
                 'source_type', 'source_id'])
      );
    }
    // tool_sessions + link_graph_edges + everything else → empty → mock fallback
    return Promise.resolve(new Set<string>());
  },
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

// ── Import router after mocks ─────────────────────────────────────────────────

import myWorkRoutes from '../../../server/src/routes/my-work.routes.ts';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const IDEA_ID = 'idea-convert-01';
const USER_ID = 'user-1';
const ORG_ID = 'org-1';

const IDEA_ROW = {
  id: IDEA_ID,
  title: 'Test Conversion Idea',
  body: 'An idea about improving processes.',
  tags: '[]',
  seedText: null,
  aiExpansion: 'AI-generated expansion text.',
  summaryData: null,
  potential: null,
  complexity: null,
  area: 'operations',
  priority: null,
  stage: 'raw',
  promotedTo: null,
  promotedEntityId: null,
  user_id: USER_ID,
  organization_id: ORG_ID,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('M05 L-08 — S5: idea→entity conversion contracts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockQueryOne.mockResolvedValue(null);
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockQueryAll.mockResolvedValue([]);
    mockRun.mockResolvedValue({ changes: 1 });
  });

  describe('S5a — convert idea to initiative', () => {
    it('POST /convert with target=initiative → 200 with promotedTo + initiativeId', async () => {
      mockQueryOne.mockResolvedValueOnce(IDEA_ROW);

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/convert`)
        .send({ target: 'initiative' });

      expect(res.status).toBe(200);
      expect(res.body.promotedTo).toBe('initiative');
      expect(typeof res.body.promotedEntityId).toBe('string');
      expect(res.body.promotedEntityId.length).toBeGreaterThan(0);
      expect(res.body.created?.initiativeId).toBe(res.body.promotedEntityId);
    });

    it('INSERT INTO initiatives is called with the org_id', async () => {
      mockQueryOne.mockResolvedValueOnce(IDEA_ROW);

      await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/convert`)
        .send({ target: 'initiative' });

      const initiativeInsert = mockQueryRun.mock.calls.find(([sql]) =>
        /INSERT INTO initiatives/i.test(sql as string)
      );
      expect(initiativeInsert).toBeDefined();
      // Params must include orgId so there is no org-blind INSERT
      expect(initiativeInsert![1]).toContain(ORG_ID);
    });

    it('my_ideas promoted_to is updated after conversion', async () => {
      mockQueryOne.mockResolvedValueOnce(IDEA_ROW);

      await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/convert`)
        .send({ target: 'initiative' });

      const promoteUpdate = mockQueryRun.mock.calls.find(([sql]) =>
        /UPDATE my_ideas.*promoted_to/is.test(sql as string)
      );
      expect(promoteUpdate).toBeDefined();
    });
  });

  describe('S5b — validation', () => {
    it('unknown target → 400', async () => {
      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/convert`)
        .send({ target: 'invalid_target' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid target/i);
    });

    it('missing target → 400', async () => {
      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/convert`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('S5c — not found', () => {
    it('unknown idea → 404', async () => {
      mockQueryOne.mockResolvedValueOnce(null); // idea not found

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/nonexistent-idea/convert`)
        .send({ target: 'initiative' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });
});
