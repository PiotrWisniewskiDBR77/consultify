/**
 * DP-3 (T4) — shared/canonical idea-map HTTP route contracts.
 *
 * Verifies the ENABLE_SHARED_IDEA_MAPS=ON path of my-work.routes.ts:
 *   - A non-owner ACTIVE org member may GET / sync / PUT the SINGLE canonical
 *     row (selected by is_canonical, NOT by user_id), and every write stamps
 *     last_editor_user_id = the acting user.
 *   - A non-member is refused (404, matching legacy "Idea not found" shape).
 *   - GET reads the canonical row regardless of which user calls.
 *   - The OCC contract (baseVersion → 409) and response shapes are unchanged.
 *
 * The complementary flag-OFF behavior is covered by
 * my-work.map-sync.contract.test.ts (must stay green); this file only asserts
 * the ON path so the two mock strategies never collide.
 *
 * Mock-based: queryHelpers.queryOne is the single data seam. `assertIdeaMembership`
 * / `selectCanonicalMapRow` (ideaMapAccess.ts) reach the DB through the route's
 * `ideaMapAccessDb` adapter, which forwards to queryHelpers.queryOne — so every
 * DB read in shared mode is a queryOne call we control in sequence.
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

// Schema helpers — plain arrow fn so vi.resetAllMocks() doesn't clear it.
// CRITICAL: includes is_canonical + last_editor_user_id so the shared path is active.
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
        'schema_version',
        'created_at',
        'updated_at',
        'is_canonical',
        'last_editor_user_id',
      ])
    ),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    // Acting user is a NON-OWNER member (owner is 'owner-1').
    req.userId = 'member-2';
    req.organizationId = 'org-1';
    req.user = { id: 'member-2', organizationId: 'org-1', role: 'member' };
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
  default: { project: vi.fn(), getFullProjection: vi.fn().mockResolvedValue(null) },
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

// Flag ON — the whole point of this suite.
vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  featureFlags: {
    ENABLE_TABLE_PLATFORM_RECORDS_API: true,
    ENABLE_TABLE_PLATFORM_METADATA_FIRST: false,
    ENABLE_INBOX_AI_ASSIST: false,
    ENABLE_SHARED_IDEA_MAPS: true,
  },
}));

// ── Import router after mocks ─────────────────────────────────────────────────

import myWorkRoutes from '../../../server/src/routes/my-work.routes.ts';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const IDEA_ID = 'idea-shared-01';
const ORG_ID = 'org-1';
const OWNER_ID = 'owner-1';
const MEMBER_ID = 'member-2'; // the acting (non-owner) user

const NODE = { id: 'n1', type: 'idea', position: { x: 0, y: 0 }, data: { label: 'Alpha' } };
const EDGE = { id: 'e1', source: 'n1', target: 'n1' };

const IDEA_ROW = { id: IDEA_ID, title: 'Shared board', user_id: OWNER_ID, ownerUserId: OWNER_ID };
const MEMBER_ROW = { id: 'membership-row-1' };

// Canonical row created by the OWNER, at version 2 — the acting member never
// owned it but must be able to read/write it in shared mode.
const CANONICAL_MAP_V2 = {
  id: 'canonical-map-1',
  version: 2,
  nodes_json: JSON.stringify([NODE]),
  edges_json: JSON.stringify([EDGE]),
  nodesJson: JSON.stringify([NODE]),
  edgesJson: JSON.stringify([EDGE]),
  preferred_tool: 'mindmap',
  preferredTool: 'mindmap',
  extensions_json: '{}',
  extensionsJson: '{}',
  schema_version: 1,
  schemaVersion: 1,
  updated_at: '2026-07-04T00:00:00.000Z',
  updatedAt: '2026-07-04T00:00:00.000Z',
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DP-3 (T4) — shared/canonical idea-map routes (ENABLE_SHARED_IDEA_MAPS=ON)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockQueryOne.mockResolvedValue(null);
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockQueryAll.mockResolvedValue([]);
    mockRun.mockResolvedValue({ changes: 1 });
  });

  // ── POST /map/sync — non-owner member persists to canonical row ─────────────

  describe('POST /map/sync', () => {
    it('non-owner ACTIVE member syncs → 200, writes canonical row, stamps last_editor', async () => {
      mockQueryOne
        // assertIdeaMembership: idea exists in org
        .mockResolvedValueOnce({ id: IDEA_ID })
        // assertIdeaMembership: user is ACTIVE member
        .mockResolvedValueOnce(MEMBER_ROW)
        // route: existing canonical row @ v2
        .mockResolvedValueOnce(CANONICAL_MAP_V2);

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
        .send({ nodes: [NODE], edges: [EDGE], baseVersion: 2 });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.version).toBe(3); // 2 + 1

      // The UPDATE must target the canonical row (is_canonical), not user_id,
      // and must set last_editor_user_id to the acting member.
      const updateCall = mockQueryRun.mock.calls.find(([sql]) =>
        /UPDATE my_idea_maps/i.test(String(sql))
      );
      expect(updateCall).toBeDefined();
      const [updateSql, updateParams] = updateCall!;
      expect(String(updateSql)).toMatch(/is_canonical = TRUE/i);
      expect(String(updateSql)).toMatch(/last_editor_user_id = \?/i);
      expect(String(updateSql)).not.toMatch(/AND user_id = \?/i); // no per-user targeting
      expect(updateParams).toContain(MEMBER_ID);
      expect(updateParams).not.toContain(OWNER_ID);
    });

    it('non-member → 404 (no persistence)', async () => {
      mockQueryOne
        // assertIdeaMembership: idea exists in org
        .mockResolvedValueOnce({ id: IDEA_ID })
        // assertIdeaMembership: NOT an ACTIVE member
        .mockResolvedValueOnce(null);

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
        .send({ nodes: [NODE], edges: [EDGE], baseVersion: 2 });

      expect(res.status).toBe(404);
      expect(mockQueryRun).not.toHaveBeenCalled();
    });

    it('stale baseVersion on canonical row → 409 (OCC contract preserved)', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ id: IDEA_ID }) // idea exists
        .mockResolvedValueOnce(MEMBER_ROW) // active member
        .mockResolvedValueOnce(CANONICAL_MAP_V2); // canonical @ v2

      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
        .send({ nodes: [NODE], edges: [EDGE], baseVersion: 1 }); // stale

      expect(res.status).toBe(409);
      expect(res.body.currentVersion).toBe(2);
      expect(mockQueryRun).not.toHaveBeenCalled();
    });
  });

  // ── PUT /map — non-owner member persists to canonical row ───────────────────

  describe('PUT /map', () => {
    it('non-owner ACTIVE member PUT → 200, canonical UPDATE with matching baseVersion', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ id: IDEA_ID }) // membership: idea exists
        .mockResolvedValueOnce(MEMBER_ROW) // membership: active member
        .mockResolvedValueOnce(CANONICAL_MAP_V2); // existing canonical @ v2

      const res = await request(buildApp())
        .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
        .send({ nodes: [NODE, { ...NODE, id: 'n2' }], edges: [EDGE], baseVersion: 2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.version).toBe(3);

      const updateCall = mockQueryRun.mock.calls.find(([sql]) =>
        /UPDATE my_idea_maps/i.test(String(sql))
      );
      expect(updateCall).toBeDefined();
      const [updateSql, updateParams] = updateCall!;
      expect(String(updateSql)).toMatch(/is_canonical = TRUE/i);
      expect(String(updateSql)).toMatch(/last_editor_user_id = \?/i);
      // OCC version guard preserved on the canonical UPDATE.
      expect(String(updateSql)).toMatch(/version = \?/i);
      expect(updateParams).toContain(MEMBER_ID);
    });

    it('non-member PUT → 404 (no persistence)', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ id: IDEA_ID }) // idea exists
        .mockResolvedValueOnce(null); // not a member

      const res = await request(buildApp())
        .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
        .send({ nodes: [NODE], edges: [EDGE], baseVersion: 2 });

      expect(res.status).toBe(404);
      expect(mockQueryRun).not.toHaveBeenCalled();
    });

    it('new canonical map is created with is_canonical=TRUE + last_editor', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ id: IDEA_ID }) // membership: idea exists
        .mockResolvedValueOnce(MEMBER_ROW) // membership: active member
        .mockResolvedValueOnce(null); // no existing canonical row → INSERT path

      const res = await request(buildApp())
        .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
        .send({ nodes: [NODE], edges: [EDGE] }); // no baseVersion (first write)

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const insertCall = mockQueryRun.mock.calls.find(([sql]) =>
        /INSERT INTO my_idea_maps/i.test(String(sql))
      );
      expect(insertCall).toBeDefined();
      const [insertSql, insertParams] = insertCall!;
      expect(String(insertSql)).toMatch(/is_canonical/i);
      expect(String(insertSql)).toMatch(/last_editor_user_id/i);
      expect(insertParams).toContain(MEMBER_ID);
    });
  });

  // ── GET /map — canonical read independent of caller ─────────────────────────

  describe('GET /map', () => {
    it('non-owner member reads the OWNER-created canonical row (by is_canonical)', async () => {
      mockQueryOne
        // idea existence (ORG-scoped read in handler)
        .mockResolvedValueOnce(IDEA_ROW)
        // assertIdeaMembership: idea exists
        .mockResolvedValueOnce({ id: IDEA_ID })
        // assertIdeaMembership: active member
        .mockResolvedValueOnce(MEMBER_ROW)
        // canonical row
        .mockResolvedValueOnce(CANONICAL_MAP_V2);

      const res = await request(buildApp()).get(`/api/my-work/my-ideas/${IDEA_ID}/map`);

      expect(res.status).toBe(200);
      expect(res.body.isDefault).toBe(false);
      expect(res.body.map.version).toBe(2);

      // The canonical SELECT must not filter by user_id.
      const canonicalSelect = mockQueryOne.mock.calls.find(([sql]) =>
        /is_canonical = TRUE/i.test(String(sql))
      );
      expect(canonicalSelect).toBeDefined();
      const [, selectParams] = canonicalSelect!;
      expect(selectParams).not.toContain(MEMBER_ID);
      expect(selectParams).not.toContain(OWNER_ID);
      expect(selectParams).toEqual([IDEA_ID, ORG_ID]);
    });

    it('non-member GET → 404', async () => {
      mockQueryOne
        .mockResolvedValueOnce(IDEA_ROW) // idea exists in org
        .mockResolvedValueOnce({ id: IDEA_ID }) // membership: idea exists
        .mockResolvedValueOnce(null); // membership: not a member

      const res = await request(buildApp()).get(`/api/my-work/my-ideas/${IDEA_ID}/map`);

      expect(res.status).toBe(404);
    });
  });
});
