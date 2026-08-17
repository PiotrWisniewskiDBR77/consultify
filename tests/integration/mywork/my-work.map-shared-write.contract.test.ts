/**
 * A1 (D-WB-2) — shared canonical board WRITE for idea maps (multiplayer persistence).
 *
 * The idea-owner's my_idea_maps row is the canonical document. A member of the SAME org
 * who is NOT the idea owner must write-through to that owner's row (mirrors the GET
 * org-read fallback at "M09 L-01"). Optimistic locking (version + baseVersion → 409)
 * must remain meaningful when two DIFFERENT users write the same idea, because they now
 * contend on ONE row instead of two per-user rows.
 *
 * Scenarios:
 *   (a) non-owner from same org PUT/sync → 200 and the WRITE targets the OWNER's row
 *   (b) version conflict between two users → 409 with rehydration payload
 *   (c) user from another org → 404 (no cross-org write)
 *   (d) owner writing own map → unchanged behavior (still targets own row)
 *
 * Mock-based (no DB), mirroring the map-sync / map-orgread contract harnesses. The
 * viewer is user-1 / org-1; the idea owner is owner-9 (a different user in org-1).
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
        'version', 'preferred_tool', 'extensions_json', 'schema_version', 'created_at', 'updated_at',
      ])
    ),
}));

// req.user = user-1 / org-1 (the *viewer* / non-owner writer).
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

const IDEA_ID = 'idea-shared-write-01';
const VIEWER_ID = 'user-1'; // non-owner writer (from auth mock)
const OWNER_ID = 'owner-9'; // idea owner — canonical row owner
const ORG_ID = 'org-1';

const NODE = { id: 'n1', type: 'idea', position: { x: 0, y: 0 }, data: { label: 'Alpha' } };
const EDGE = { id: 'e1', source: 'n1', target: 'n1' };

const OWNER_MAP_V2 = {
  id: 'map-owner',
  version: 2,
  nodes_json: JSON.stringify([NODE]),
  edges_json: JSON.stringify([EDGE]),
  preferred_tool: 'whiteboard',
  extensions_json: '{}',
  schema_version: 3,
  // sync handler aliases:
  nodesJson: JSON.stringify([NODE]),
  edgesJson: JSON.stringify([EDGE]),
  preferredTool: 'whiteboard',
  extensionsJson: '{}',
  schemaVersion: 3,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

/** Assert the write targeted the OWNER's user_id, not the viewer's. */
function writeTargetedOwner() {
  const writeCall = mockQueryRun.mock.calls.find(([sql]) =>
    /INSERT INTO my_idea_maps|UPDATE my_idea_maps/i.test(String(sql))
  );
  expect(writeCall, 'expected an INSERT/UPDATE on my_idea_maps').toBeTruthy();
  const params = (writeCall?.[1] as unknown[]) || [];
  expect(params).toContain(OWNER_ID);
  expect(params).not.toContain(VIEWER_ID);
}

describe('A1 (D-WB-2) — shared canonical board WRITE', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockQueryAll.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockRun.mockResolvedValue({ changes: 1 });
  });

  // (a) non-owner PUT → 200 and the write targets the owner's canonical row.
  it('PUT /map: non-owner from same org → 200 and writes to the OWNER row', async () => {
    mockQueryOne
      // resolveCanonicalMapOwner → idea owned by owner-9 (org-scoped)
      .mockResolvedValueOnce({ ownerUserId: OWNER_ID })
      // existing map lookup by canonicalUserId (owner-9) → v2
      .mockResolvedValueOnce(OWNER_MAP_V2);

    const res = await request(buildApp())
      .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
      .send({ nodes: [NODE], edges: [EDGE], baseVersion: 2 });

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(3);
    writeTargetedOwner();
  });

  it('POST /map/sync: non-owner from same org → 200 and writes to the OWNER row', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ ownerUserId: OWNER_ID }) // canonical owner
      .mockResolvedValueOnce(OWNER_MAP_V2); // existing map (owner row) v2

    const res = await request(buildApp())
      .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
      .send({ nodes: [NODE], edges: [EDGE], baseVersion: 2 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.version).toBe(3);
    writeTargetedOwner();
  });

  it('PUT /map: non-owner, owner has no map row yet → INSERTs the OWNER canonical row', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ ownerUserId: OWNER_ID }) // canonical owner
      .mockResolvedValueOnce(null); // owner has no map row → INSERT branch (new doc, no baseVersion needed)

    const res = await request(buildApp())
      .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
      .send({ nodes: [NODE], edges: [EDGE] });

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    const insertCall = mockQueryRun.mock.calls.find(([sql]) =>
      /INSERT INTO my_idea_maps/i.test(String(sql))
    );
    expect(insertCall).toBeTruthy();
    // New row is created under the OWNER, not the viewer.
    expect((insertCall?.[1] as unknown[]) || []).toContain(OWNER_ID);
    expect((insertCall?.[1] as unknown[]) || []).not.toContain(VIEWER_ID);
  });

  // (b) version conflict between two users on the same canonical row → 409.
  it('PUT /map: stale baseVersion from second user → 409 with rehydration payload', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ ownerUserId: OWNER_ID })
      .mockResolvedValueOnce(OWNER_MAP_V2); // owner row at v2; viewer sends baseVersion=1

    const res = await request(buildApp())
      .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
      .send({ nodes: [NODE], edges: [EDGE], baseVersion: 1 });

    expect(res.status).toBe(409);
    expect(res.body.currentVersion).toBe(2);
    expect(res.body.map?.version).toBe(2);
  });

  it('POST /map/sync: stale baseVersion from second user → 409', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ ownerUserId: OWNER_ID })
      .mockResolvedValueOnce(OWNER_MAP_V2);

    const res = await request(buildApp())
      .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
      .send({ nodes: [NODE], edges: [EDGE], baseVersion: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/conflict/i);
    expect(res.body.currentVersion).toBe(2);
  });

  it('PUT /map: mid-air UPDATE race (changes=0) → 409 (row moved under us)', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ ownerUserId: OWNER_ID })
      .mockResolvedValueOnce(OWNER_MAP_V2)
      // conflict re-fetch after 0-row UPDATE
      .mockResolvedValueOnce({
        id: 'map-owner',
        version: 5,
        nodesJson: JSON.stringify([NODE]),
        edgesJson: '[]',
        preferredTool: 'whiteboard',
        extensionsJson: '{}',
        schemaVersion: 3,
      });
    // baseVersion matches v2 (passes pre-check) but UPDATE affects 0 rows (someone bumped to v5)
    mockQueryRun.mockResolvedValueOnce({ changes: 0 });

    const res = await request(buildApp())
      .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
      .send({ nodes: [NODE], edges: [EDGE], baseVersion: 2 });

    expect(res.status).toBe(409);
    expect(res.body.currentVersion).toBe(5);
  });

  // Z18 (Fala 4): POST /map/sync had a read-then-act gap — the pre-check compared
  // baseVersion against a SELECT taken before the UPDATE, but the UPDATE's WHERE
  // clause carried no version guard, so a write landing in between was silently
  // clobbered. This mirrors the PUT /map "mid-air UPDATE race" test above to lock
  // in the same atomic-UPDATE-with-version-guard fix for the sync endpoint.
  it('POST /map/sync: mid-air UPDATE race (changes=0) → 409 (row moved under us)', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ ownerUserId: OWNER_ID })
      .mockResolvedValueOnce(OWNER_MAP_V2)
      // conflict re-fetch after 0-row UPDATE
      .mockResolvedValueOnce({
        id: 'map-owner',
        version: 5,
        nodesJson: JSON.stringify([NODE]),
        edgesJson: '[]',
        preferredTool: 'whiteboard',
        extensionsJson: '{}',
        schemaVersion: 3,
      });
    // baseVersion matches v2 (passes pre-check) but UPDATE affects 0 rows (someone bumped to v5)
    mockQueryRun.mockResolvedValueOnce({ changes: 0 });

    const res = await request(buildApp())
      .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
      .send({ nodes: [NODE], edges: [EDGE], baseVersion: 2 });

    expect(res.status).toBe(409);
    expect(res.body.currentVersion).toBe(5);
    // The UPDATE statement itself must carry the version guard (not just the pre-check).
    const updateCall = mockQueryRun.mock.calls.find(([sql]) =>
      /UPDATE my_idea_maps/i.test(String(sql))
    );
    expect(String(updateCall?.[0])).toMatch(/AND version = \?/i);
  });

  // (c) cross-org → 404, no write.
  it('PUT /map: idea in another org (resolver returns null) → 404, no write', async () => {
    mockQueryOne.mockResolvedValueOnce(null); // resolveCanonicalMapOwner → not found in org

    const res = await request(buildApp())
      .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
      .send({ nodes: [NODE], edges: [EDGE], baseVersion: 1 });

    expect(res.status).toBe(404);
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('POST /map/sync: idea in another org → 404, no write', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .post(`/api/my-work/my-ideas/${IDEA_ID}/map/sync`)
      .send({ nodes: [NODE], edges: [EDGE], baseVersion: 1 });

    expect(res.status).toBe(404);
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  // (d) owner writes own map → still resolves to self (unchanged behavior).
  it('PUT /map: owner writing own board → 200 and writes to own (== canonical) row', async () => {
    // For the owner, resolveCanonicalMapOwner returns the viewer's own id (user-1 owns it).
    mockQueryOne
      .mockResolvedValueOnce({ ownerUserId: VIEWER_ID }) // viewer IS the owner
      .mockResolvedValueOnce({ ...OWNER_MAP_V2 });

    const res = await request(buildApp())
      .put(`/api/my-work/my-ideas/${IDEA_ID}/map`)
      .send({ nodes: [NODE], edges: [EDGE], baseVersion: 2 });

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(3);
    const writeCall = mockQueryRun.mock.calls.find(([sql]) =>
      /UPDATE my_idea_maps/i.test(String(sql))
    );
    expect((writeCall?.[1] as unknown[]) || []).toContain(VIEWER_ID);
  });
});
