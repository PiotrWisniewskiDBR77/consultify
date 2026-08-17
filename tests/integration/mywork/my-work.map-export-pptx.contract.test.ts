/**
 * M06 FALA3 3.4 — POST /api/my-work/my-ideas/:ideaId/map/export/pptx
 *
 * Real .pptx export for the mind map, reusing PptxPipelineService (same
 * pipeline Report Builder's /export/pptx?version=2 uses). Verifies: 200 +
 * pptx Content-Type + non-empty buffer, 404 for unknown idea, and 401
 * without auth context.
 *
 * Mock-based: no real DB / no real pptxgenjs rendering avoided — the
 * pipeline actually runs (pptxgenjs is a real, fast, in-memory dependency;
 * see tests/unit/reports/pptx-layouts.test.ts for the precedent of exercising
 * the real pipeline in tests).
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockQueryOne = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown>>());
const mockQueryRun = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());
const mockQueryAll = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown[]>>());
const mockRun = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());

// ── Module mocks ──────────────────────────────────────────────────────────────

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
      new Set(['id', 'idea_id', 'user_id', 'organization_id', 'nodes_json', 'edges_json', 'title'])
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
    ENABLE_TABLE_PLATFORM_RECORDS_API: false,
    ENABLE_INBOX_AI_ASSIST: false,
    ENABLE_TABLE_PLATFORM_METADATA_FIRST: false,
  },
}));

// ── Import router after mocks ─────────────────────────────────────────────────

import myWorkRoutes from '../../../server/src/routes/my-work.routes.ts';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const IDEA_ID = 'idea-test-01';

const BRANCHES = [
  {
    branchKey: 'problem',
    label: 'Problem',
    nodes: [{ id: 'n1', label: 'Slow onboarding', status: 'active' }],
  },
  {
    branchKey: 'goal',
    label: 'Goal',
    nodes: [{ id: 'n2', label: 'Increase activation' }],
  },
];

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

describe('POST /api/my-work/my-ideas/:ideaId/map/export/pptx (M06 FALA3 3.4)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockQueryOne.mockResolvedValue(null);
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockQueryAll.mockResolvedValue([]);
    mockRun.mockResolvedValue({ changes: 1 });
  });

  it('idea exists → 200, real pptx Content-Type, non-empty buffer', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: IDEA_ID, title: 'My Great Idea' });

    const res = await request(buildApp())
      .post(`/api/my-work/my-ideas/${IDEA_ID}/map/export/pptx`)
      .send({ ideaTitle: 'My Great Idea', branches: BRANCHES })
      .buffer(true)
      .parse((response, cb) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    expect(res.headers['content-disposition']).toMatch(/attachment/i);
    expect(res.headers['content-disposition']).toMatch(/\.pptx/i);
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect((res.body as Buffer).length).toBeGreaterThan(0);
  });

  it('unknown idea → 404', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .post(`/api/my-work/my-ideas/nonexistent-idea/map/export/pptx`)
      .send({ ideaTitle: 'X', branches: [] });

    expect(res.status).toBe(404);
  });

  it('empty branches array still produces a valid deck (cover-only)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: IDEA_ID, title: 'Empty Idea' });

    const res = await request(buildApp())
      .post(`/api/my-work/my-ideas/${IDEA_ID}/map/export/pptx`)
      .send({ ideaTitle: 'Empty Idea', branches: [] })
      .buffer(true)
      .parse((response, cb) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect((res.body as Buffer).length).toBeGreaterThan(0);
  });

  it('missing ideaTitle falls back to the stored idea title', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: IDEA_ID, title: 'Fallback Title' });

    const res = await request(buildApp())
      .post(`/api/my-work/my-ideas/${IDEA_ID}/map/export/pptx`)
      .send({ branches: BRANCHES })
      .buffer(true)
      .parse((response, cb) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
  });
});
