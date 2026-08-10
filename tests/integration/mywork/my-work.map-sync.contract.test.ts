/**
 * M05 L-08 — S2 + S3 + S6 contract tests for Ideas workspace persistence.
 *
 * S2: Round-trip map sync — POST /my-ideas/:id/map/sync creates map on first
 *     call and succeeds; subsequent calls with correct baseVersion update it.
 * S3: Optimistic concurrency — stale baseVersion → 409 with conflict payload
 *     that includes currentVersion so the client can rehydrate (not a silent overwrite).
 * S6: Snapshot 201 — POST /my-ideas/:id/map/snapshots persists and returns id.
 *
 * Mock-based: no real DB needed. Mocks queryHelpers and heavy service imports.
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

// Primary data access — controlled per test
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

// Schema helpers — plain arrow fn so vi.resetAllMocks() in beforeEach doesn't clear it
vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: () =>
    Promise.resolve(
      new Set(['id', 'idea_id', 'user_id', 'organization_id', 'nodes_json', 'edges_json',
               'version', 'preferred_tool', 'extensions_json', 'created_at', 'updated_at'])
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

// Heavy services — stub exports to prevent transitive DB inits
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

const IDEA_ID = 'idea-test-01';
const USER_ID = 'user-1';
const ORG_ID = 'org-1';

const NODE = { id: 'n1', type: 'idea', position: { x: 0, y: 0 }, data: { label: 'Alpha' } };
const EDGE = { id: 'e1', source: 'n1', target: 'n1' };

const EXISTING_MAP_V2 = {
  id: 'map-1',
  version: 2,
  nodesJson: JSON.stringify([NODE]),
  edgesJson: JSON.stringify([EDGE]),
  preferredTool: null,
  extensionsJson: '{}',
  schemaVersion: 1,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('M05 L-08 — Ideas workspace persistence contracts (S2/S3/S6)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: idea exists, no map yet, run/queryRun succeed
    mockQueryOne.mockResolvedValue(null);
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockQueryAll.mockResolvedValue([]);
    mockRun.mockResolvedValue({ changes: 1 });
  });

  // ── S2: Round-trip map sync ────────────────────────────────────────────────

  describe('S2 — map/sync round-trip', () => {
    it('POST /map/sync (new map, no baseVersion) → 200 success', async () => {
      // Idea exists
      mockQueryOne
        .mockResolvedValueOnce({ id: IDEA_ID, title: 'Test', ownerUserId: USER_ID, user_id: USER_ID, organization_id: ORG_ID })
        // No existing map (first sync)
        .mockResolvedValueOnce(null);

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
        .send({ nodes: [NODE], edges: [EDGE] });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(typeof res.body.version).toBe('number');
    });

    it('POST /map/sync with matching baseVersion → 200 and incremented version', async () => {
      // Idea exists
      mockQueryOne
        .mockResolvedValueOnce({ id: IDEA_ID, title: 'Test', ownerUserId: USER_ID })
        // Existing map at version 2
        .mockResolvedValueOnce(EXISTING_MAP_V2);

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
        .send({ nodes: [NODE], edges: [EDGE], baseVersion: 2 });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.version).toBe(3); // 2 + 1
    });

    it('POST /map/sync with unknown idea → 404', async () => {
      // Idea not found
      mockQueryOne.mockResolvedValueOnce(null);

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/nonexistent/map/sync`)
        .send({ nodes: [], edges: [], baseVersion: 1 });

      // 404 (not found) or 400 (bad id — "nonexistent" may not pass id guard)
      expect([400, 404]).toContain(res.status);
    });

    it('POST /map/sync missing nodes → 400', async () => {
      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
        .send({ edges: [EDGE] }); // no nodes

      expect(res.status).toBe(400);
    });
  });

  // ── S3: 409 concurrency conflict ──────────────────────────────────────────

  describe('S3 — 409 concurrency conflict (optimistic lock)', () => {
    it('stale baseVersion → 409 with conflict payload (not silent overwrite)', async () => {
      // Idea exists
      mockQueryOne
        .mockResolvedValueOnce({ id: IDEA_ID, title: 'Test', ownerUserId: USER_ID })
        // Existing map at version 2; client sends baseVersion=1 (stale)
        .mockResolvedValueOnce(EXISTING_MAP_V2);

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
        .send({ nodes: [NODE], edges: [EDGE], baseVersion: 1 }); // stale

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/conflict/i);
      expect(res.body.currentVersion).toBe(2);
    });

    it('409 body includes server map so client can rehydrate', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ id: IDEA_ID, title: 'Test', ownerUserId: USER_ID })
        .mockResolvedValueOnce(EXISTING_MAP_V2);

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
        .send({ nodes: [], edges: [], baseVersion: 1 });

      expect(res.status).toBe(409);
      // map field present — client can merge/diff
      expect(res.body.map).toBeDefined();
      expect(res.body.map.version).toBe(2);
    });

    it('correct baseVersion after conflict → 200 (can recover)', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ id: IDEA_ID, title: 'Test', ownerUserId: USER_ID })
        .mockResolvedValueOnce(EXISTING_MAP_V2); // version 2 — matches baseVersion=2

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
        .send({ nodes: [NODE], edges: [EDGE], baseVersion: 2 }); // correct

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  // ── M09: cross-tool empty-overwrite guard ──────────────────────────────────
  // The Ideas tools share ONE my_idea_maps doc. A background tool runtime (e.g. the mindmap
  // mounted while the user works on the whiteboard) must not blank a populated board with an
  // empty save. A SAME-tool empty save is a legitimate "delete all" and must still go through.
  describe('M09 — cross-tool empty-overwrite guard', () => {
    const EXISTING_WHITEBOARD_MAP_V2 = {
      id: 'map-1',
      version: 2,
      nodesJson: JSON.stringify([
        { id: 'wb1', type: 'stickyNote', position: { x: 1, y: 1 }, data: { label: 'work' } },
      ]),
      edgesJson: '[]',
      preferredTool: 'whiteboard',
      extensionsJson: '{}',
      schemaVersion: 1,
    };

    it('empty save from a DIFFERENT tool over a populated board → 409 EMPTY_RESET_BLOCKED (data preserved)', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ id: IDEA_ID, title: 'Test', ownerUserId: USER_ID })
        .mockResolvedValueOnce(EXISTING_WHITEBOARD_MAP_V2);

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
        .send({
          nodes: [],
          edges: [],
          baseVersion: 2,
          preferredTool: 'mindmap',
          extensions: { surfaceState: { activeTool: 'mindmap' } },
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('IDEA_MAP_EMPTY_RESET_BLOCKED');
      // The populated whiteboard node is returned intact (never overwritten).
      expect(res.body.map?.nodes?.length).toBe(1);
    });

    it('empty save from the SAME tool (delete-all) is allowed → 200', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ id: IDEA_ID, title: 'Test', ownerUserId: USER_ID })
        .mockResolvedValueOnce(EXISTING_WHITEBOARD_MAP_V2);

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
        .send({ nodes: [], edges: [], baseVersion: 2, preferredTool: 'whiteboard' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  // ── S6: Snapshot 201 ──────────────────────────────────────────────────────

  describe('S6 — snapshot creation returns 201', () => {
    // E12 (10.4): POST /map/snapshots now verifies the idea belongs to the
    // caller's org (SELECT id FROM my_ideas WHERE id=? AND organization_id=?)
    // before writing — previously this endpoint ran zero SELECTs before the
    // INSERT. Every "should succeed" case below must stub that lookup to
    // resolve the idea; the 400 cases never reach it (schema validation
    // short-circuits first).
    it('POST /map/snapshots → 201 with snapshot id', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: IDEA_ID });
      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/snapshots`)
        .send({ label: 'Milestone v1', nodes: [NODE], edges: [EDGE] });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(typeof res.body.snapshot?.id).toBe('string');
      expect(res.body.snapshot?.id.length).toBeGreaterThan(0);
      expect(res.body.snapshot?.label).toBe('Milestone v1');
      expect(res.body.snapshot?.nodeCount).toBe(1);
      expect(res.body.snapshot?.edgeCount).toBe(1);
    });

    it('POST /map/snapshots calls queryHelpers.run (INSERT INTO snapshots)', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: IDEA_ID });
      await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/snapshots`)
        .send({ label: 'Check insert', nodes: [NODE], edges: [] });

      expect(mockRun).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO my_idea_map_snapshots/i),
        expect.any(Array)
      );
    });

    it('POST /map/snapshots with missing label → 400', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: IDEA_ID });
      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/snapshots`)
        .send({ nodes: [], edges: [] }); // label missing

      expect(res.status).toBe(400);
      expect(mockRun).not.toHaveBeenCalled();
    });

    it('POST /map/snapshots with empty label → 400', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: IDEA_ID });
      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/snapshots`)
        .send({ label: '', nodes: [], edges: [] });

      expect(res.status).toBe(400);
    });

    it('POST /map/snapshots → 404 when the idea does not belong to the caller org', async () => {
      mockQueryOne.mockResolvedValueOnce(null);
      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/snapshots`)
        .send({ label: 'Should not persist', nodes: [], edges: [] });

      expect(res.status).toBe(404);
      expect(mockRun).not.toHaveBeenCalled();
    });
  });
});
