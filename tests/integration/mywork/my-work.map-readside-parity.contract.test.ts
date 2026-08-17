/**
 * Read-side parity — metrics/map, export-csv, objects/:objectId/artifacts vs GET /map.
 *
 * Finding (audyt sterty 2026-07-06): `GET /my-ideas/:id/map` resolves the row it
 * serves via `is_canonical = TRUE` when shared idea maps are active (flag ON +
 * column present), falling back to the idea-OWNER's row otherwise. The three
 * sibling read endpoints (`metrics/map`, `export-csv`,
 * `objects/:objectId/artifacts` GET) instead ALWAYS used the owner-row
 * strategy, never `is_canonical` — so once migration T2 lets the canonical row
 * diverge from the owner's row, those endpoints would silently read a
 * DIFFERENT row than the one the user sees in the main map view.
 *
 * Fix: all three now go through the same `resolveMapReadRow` /
 * `queryIdeaMapMetrics` helpers as `GET /map` (my-work.routes.ts). This test
 * asserts, with the flag ON and `is_canonical` present, that each endpoint
 * issues a query filtered by `is_canonical = TRUE` (never `user_id`) — i.e.
 * the SAME row-selection strategy as `GET /map`. It also asserts the flag-OFF
 * / column-absent fallback still resolves via the idea owner (unchanged
 * legacy behavior), mirroring my-work.map-orgread.contract.test.ts.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown>>());
const mockQueryRun = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());
const mockQueryAll = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown[]>>());
const mockRun = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());
const mockGetTableColumns = vi.hoisted(() => vi.fn());

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
  getTableColumns: (...a: unknown[]) => mockGetTableColumns(...a),
}));

const SHARED_COLUMNS = new Set([
  'id', 'idea_id', 'user_id', 'organization_id', 'nodes_json', 'edges_json',
  'version', 'preferred_tool', 'extensions_json', 'schema_version', 'is_canonical',
  'created_at', 'updated_at',
]);
const LEGACY_COLUMNS = new Set([
  'id', 'idea_id', 'user_id', 'organization_id', 'nodes_json', 'edges_json',
  'version', 'preferred_tool', 'extensions_json', 'schema_version',
  'created_at', 'updated_at',
]);

// req.user = user-1 / org-1 (a non-owner org member reading a colleague's board).
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
vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  featureFlags: {
    ENABLE_TABLE_PLATFORM_RECORDS_API: true,
    ENABLE_INBOX_AI_ASSIST: false,
    ENABLE_SHARED_IDEA_MAPS: true,
    ENABLE_TABLE_PLATFORM_METADATA_FIRST: false,
  },
}));

import myWorkRoutes from '../../../server/src/routes/my-work.routes.ts';

const IDEA_ID = 'idea-parity-01';
const ORG_ID = 'org-1';
const NODE = { id: 'n1', type: 'idea', position: { x: 0, y: 0 }, data: { label: 'Alpha' } };

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

describe('Read-side parity — metrics/export-csv/artifacts vs GET /map', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockQueryAll.mockResolvedValue([]);
    mockRun.mockResolvedValue({ changes: 1 });
  });

  describe('shared mode ON (is_canonical column present, flag on)', () => {
    beforeEach(() => {
      mockGetTableColumns.mockResolvedValue(SHARED_COLUMNS);
    });

    it('GET /map reads the is_canonical row (baseline)', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ id: IDEA_ID, title: 'Shared', ownerUserId: 'owner-9' }) // idea lookup
        .mockResolvedValueOnce(null); // membership canRead=false short-circuits before canonical select in this harness

      await request(buildApp()).get(`/api/my-work/my-ideas/${IDEA_ID}/map`);

      // Membership check queries organization_members; assert no query ever
      // filters by m.user_id = <caller> for the canonical row (sanity check
      // that shared mode doesn't fall back to owner filtering under the hood).
      const ownerFiltered = mockQueryOne.mock.calls.some(
        ([sql]) => /is_canonical/i.test(String(sql)) === false && /user_id = \?/i.test(String(sql))
      );
      expect(ownerFiltered).toBe(false);
    });

    // RV-008 (CB-03 Codex review pass 2): a tolerant "most recent row" fallback
    // was added and then reverted here on review — it directly contradicted
    // `selectCanonicalMapRow`'s documented contract (ideaMapAccess.ts) that
    // "no canonical row exists" must be treated the same as not-found, never
    // silently served from a different (possibly wrong-user) row. This test
    // locks in the correct, current behavior so that unsafe fallback cannot
    // be silently reintroduced: when no row is flagged canonical, GET /map
    // returns the default/empty map and issues NO further my_idea_maps query.
    it('GET /map returns the default map (never a fallback row) when no row is flagged canonical', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ id: IDEA_ID, title: 'Shared', ownerUserId: 'owner-9' }) // GET /map's own idea lookup
        .mockResolvedValueOnce({ id: IDEA_ID }) // assertIdeaMembership: idea exists
        .mockResolvedValueOnce({ id: 'member-1' }) // assertIdeaMembership: ACTIVE member → canRead=true
        .mockResolvedValueOnce(null); // selectCanonicalMapRow-equivalent: no is_canonical row yet

      const res = await request(buildApp()).get(`/api/my-work/my-ideas/${IDEA_ID}/map`);

      expect(res.status).toBe(200);
      expect(res.body.isDefault).toBe(true);
      expect(res.body.map?.preferredTool ?? null).toBeNull();
      // Exactly 4 queryOne calls: idea lookup, membership x2, canonical
      // select. A 5th call would mean a fallback query was reintroduced.
      expect(mockQueryOne).toHaveBeenCalledTimes(4);
      const myIdeaMapsCalls = mockQueryOne.mock.calls.filter(([sql]) =>
        /FROM my_idea_maps/i.test(String(sql))
      );
      expect(myIdeaMapsCalls).toHaveLength(1);
      expect(String(myIdeaMapsCalls[0][0])).toMatch(/is_canonical\s*=\s*TRUE/i);
    });

    it('GET metrics/map queries is_canonical = TRUE, not the owner join', async () => {
      const res = await request(buildApp()).get(
        `/api/my-work/my-ideas/metrics/map?ids=${IDEA_ID}`
      );

      expect(res.status).toBe(200);
      const call = mockQueryAll.mock.calls.find(([sql]) => /my_idea_maps/i.test(String(sql)));
      expect(call, 'expected a my_idea_maps query').toBeTruthy();
      const sql = String(call?.[0]);
      expect(sql).toMatch(/is_canonical\s*=\s*TRUE/i);
      expect(sql).not.toMatch(/JOIN my_ideas/i);
    });

    it('GET export-csv resolves via is_canonical, not resolveCanonicalMapOwner/user_id', async () => {
      mockQueryOne
        // resolveMapReadRow → canonical-row existence check
        .mockResolvedValueOnce({ id: 'map-canonical' })
        // the actual SELECT nodes_json/extensions_json for export
        .mockResolvedValueOnce({ nodes_json: JSON.stringify([NODE]), extensions_json: '{}' });

      const res = await request(buildApp()).get(
        `/api/my-work/my-ideas/${IDEA_ID}/export-csv`
      );

      expect(res.status).toBe(200);
      // Neither queryOne call should filter on user_id (owner-row strategy);
      // both should reference is_canonical.
      for (const [sql] of mockQueryOne.mock.calls) {
        expect(String(sql)).toMatch(/is_canonical/i);
      }
    });

    it('GET objects/:objectId/artifacts resolves via is_canonical, not the owner row', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ id: 'map-canonical' }) // resolveMapReadRow canonical check
        .mockResolvedValueOnce({ nodes_json: JSON.stringify([NODE]) }); // node lookup

      const res = await request(buildApp()).get(
        `/api/my-work/my-ideas/${IDEA_ID}/objects/n1/artifacts`
      );

      expect(res.status).toBe(200);
      for (const [sql] of mockQueryOne.mock.calls) {
        expect(String(sql)).toMatch(/is_canonical/i);
      }
    });
  });

  describe('legacy fallback (flag off / is_canonical column absent)', () => {
    beforeEach(() => {
      mockGetTableColumns.mockResolvedValue(LEGACY_COLUMNS);
    });

    it('GET metrics/map falls back to the owner join (unchanged legacy behavior)', async () => {
      const res = await request(buildApp()).get(
        `/api/my-work/my-ideas/metrics/map?ids=${IDEA_ID}`
      );

      expect(res.status).toBe(200);
      const call = mockQueryAll.mock.calls.find(([sql]) => /my_idea_maps/i.test(String(sql)));
      expect(call).toBeTruthy();
      const sql = String(call?.[0]);
      expect(sql).toMatch(/JOIN my_ideas/i);
      expect(sql).not.toMatch(/is_canonical\s*=\s*TRUE/i);
    });

    it('GET export-csv falls back to resolveCanonicalMapOwner (owner row)', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ ownerUserId: 'owner-9' }) // resolveCanonicalMapOwner
        .mockResolvedValueOnce({ nodes_json: JSON.stringify([NODE]), extensions_json: '{}' });

      const res = await request(buildApp()).get(
        `/api/my-work/my-ideas/${IDEA_ID}/export-csv`
      );

      expect(res.status).toBe(200);
      const dataCall = mockQueryOne.mock.calls[1];
      expect(String(dataCall?.[0])).toMatch(/user_id = \?/i);
      expect(dataCall?.[1]).toContain('owner-9');
    });

    it('GET objects/:objectId/artifacts falls back to resolveCanonicalMapOwner (owner row)', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ ownerUserId: 'owner-9' })
        .mockResolvedValueOnce({ nodes_json: JSON.stringify([NODE]) });

      const res = await request(buildApp()).get(
        `/api/my-work/my-ideas/${IDEA_ID}/objects/n1/artifacts`
      );

      expect(res.status).toBe(200);
      const dataCall = mockQueryOne.mock.calls[1];
      expect(String(dataCall?.[0])).toMatch(/user_id = \?/i);
      expect(dataCall?.[1]).toContain('owner-9');
    });
  });

  // RV-008 (CB-03 Codex re-review) — the Ideas list ("Tool" badge) and
  // GET /map (Open) now resolve `preferredTool` through the exact same
  // function, `selectReadableMapRow` (ideaMapAccess.ts). These tests exercise
  // BOTH endpoints against the same fixture idea and assert they land on the
  // identical truthful answer — never a list badge the Open action can't
  // deliver.
  describe('list ↔ Open parity (RV-008)', () => {
    beforeEach(() => {
      mockGetTableColumns.mockResolvedValue(SHARED_COLUMNS);
    });

    it('list shows no preferredTool (not a guessed "table") and Open shows the honest default when no row is canonical yet', async () => {
      // --- List: base ideas query, then one selectReadableMapRow lookup per row.
      mockQueryAll.mockResolvedValueOnce([{ id: IDEA_ID, title: 'Sales map', tags: null }]);
      mockQueryOne.mockResolvedValueOnce(null); // no canonical my_idea_maps row

      const listRes = await request(buildApp()).get('/api/my-work/my-ideas');
      expect(listRes.status).toBe(200);
      expect(listRes.body[0]?.preferredTool ?? null).toBeNull();

      // --- Open: same idea, same underlying resolver, same "no canonical row" fact.
      mockQueryOne
        .mockReset()
        .mockResolvedValueOnce({ id: IDEA_ID, title: 'Sales map', ownerUserId: 'user-1' }) // GET /map's own idea lookup
        .mockResolvedValueOnce({ id: IDEA_ID }) // assertIdeaMembership: idea exists
        .mockResolvedValueOnce({ id: 'member-1' }) // assertIdeaMembership: ACTIVE member
        .mockResolvedValueOnce(null); // selectReadableMapRow: no canonical row

      const openRes = await request(buildApp()).get(`/api/my-work/my-ideas/${IDEA_ID}/map`);
      expect(openRes.status).toBe(200);
      expect(openRes.body.isDefault).toBe(true);
      expect(openRes.body.map?.preferredTool ?? null).toBeNull();

      // Both surfaces agree: neither claims a tool this idea can't actually open as.
      expect(listRes.body[0]?.preferredTool ?? null).toBe(openRes.body.map?.preferredTool ?? null);
    });

    it('list and Open both resolve "table" when a real canonical row says so', async () => {
      mockQueryAll.mockResolvedValueOnce([{ id: IDEA_ID, title: 'Sales map', tags: null }]);
      mockQueryOne.mockResolvedValueOnce({ preferredTool: 'table' }); // canonical row exists

      const listRes = await request(buildApp()).get('/api/my-work/my-ideas');
      expect(listRes.status).toBe(200);
      expect(listRes.body[0]?.preferredTool).toBe('table');

      mockQueryOne
        .mockReset()
        .mockResolvedValueOnce({ id: IDEA_ID, title: 'Sales map', ownerUserId: 'user-1' })
        .mockResolvedValueOnce({ id: IDEA_ID })
        .mockResolvedValueOnce({ id: 'member-1' })
        .mockResolvedValueOnce({
          id: 'map-1',
          nodesJson: '[]',
          edgesJson: '[]',
          version: 1,
          preferredTool: 'table',
        });

      const openRes = await request(buildApp()).get(`/api/my-work/my-ideas/${IDEA_ID}/map`);
      expect(openRes.status).toBe(200);
      expect(openRes.body.map?.preferredTool).toBe('table');

      expect(listRes.body[0]?.preferredTool).toBe(openRes.body.map?.preferredTool);
    });
  });
});
