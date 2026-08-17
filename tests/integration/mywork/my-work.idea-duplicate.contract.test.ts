/**
 * Fala6 — POST /my-ideas/:id/duplicate contract.
 *
 * Duplicating an idea clones the source my_ideas row into a fresh record (new id,
 * title + " (kopia)"/" (copy)"), copies the canonical my_idea_maps document, and
 * deliberately DROPS promotion state (promoted_to / promoted_entity_id; a
 * 'promoted' stage resets to 'seed'). The OWNER guard (user_id + organization_id)
 * means a foreign / cross-org id resolves to no row → 404, so nobody duplicates
 * someone else's idea. Mirrors the map-orgread harness (mock queryHelpers, no DB).
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

// Union set spanning my_ideas content columns + my_idea_maps columns. The endpoint
// only calls `.has()`; `is_canonical` is present but harmless because the shared
// flag stays OFF (see FeatureFlags mock), so the legacy (owner-row) path is used.
const SCHEMA_COLS = new Set([
  // my_ideas
  'id', 'user_id', 'organization_id', 'title', 'body', 'tags',
  'source_type', 'source_conversation_id', 'source_message_id',
  'seed_text', 'ai_expansion', 'research_data', 'creative_proposals', 'summary_data',
  'potential', 'complexity', 'area', 'priority', 'branch',
  'action_contract_json', 'source_pack_json', 'evidence_refs_json', 'folder_id',
  'is_favorite', 'last_opened_at', 'promoted_to', 'promoted_entity_id', 'stage',
  'created_at', 'updated_at',
  // my_idea_maps
  'idea_id', 'nodes_json', 'edges_json', 'version', 'schema_version',
  'preferred_tool', 'extensions_json', 'is_canonical', 'last_editor_user_id',
]);

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: () => Promise.resolve(SCHEMA_COLS),
}));

// req.user = user-1 / org-1
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

const SRC_ID = 'idea-src-01';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

// A source idea carrying promotion state we must NOT copy.
function sourceIdea(overrides: Record<string, unknown> = {}) {
  return {
    id: SRC_ID,
    user_id: 'user-1',
    organization_id: 'org-1',
    title: 'Growth plan',
    body: 'Body text',
    tags: '["a","b"]',
    stage: 'active',
    area: 'growth',
    priority: 70,
    potential: 'high',
    promoted_to: 'initiative',
    promoted_entity_id: 'init-9',
    ...overrides,
  };
}

const SOURCE_MAP = {
  nodesJson: JSON.stringify([{ id: 'n1', type: 'idea', position: { x: 0, y: 0 }, data: { label: 'A' } }]),
  edgesJson: JSON.stringify([]),
  preferredTool: 'mindmap',
  extensionsJson: '{}',
  schemaVersion: 3,
};

// Shape the final SELECT of the new row returns.
function newRow(id: string, title: string) {
  return {
    id,
    title,
    body: 'Body text',
    tags: '["a","b"]',
    stage: 'active',
    area: 'growth',
    priority: 70,
    promotedTo: null,
    action_contract_json: '{}',
    source_pack_json: '{}',
    evidence_refs_json: '[]',
    folderId: null,
    isFavorite: 0,
    createdAt: '2026-07-22T00:00:00Z',
    updatedAt: '2026-07-22T00:00:00Z',
  };
}

function ideaInsertCall() {
  const call = mockQueryRun.mock.calls.find((c) => /INSERT INTO my_ideas/i.test(String(c[0])));
  if (!call) return null;
  const sql = String(call[0]);
  const cols = sql
    .replace(/[\s\S]*INSERT INTO my_ideas\s*\(/i, '')
    .replace(/\)[\s\S]*/, '')
    .split(',')
    .map((s) => s.trim());
  return { sql, cols, params: call[1] as unknown[] };
}

describe('Fala6 — POST /my-ideas/:id/duplicate contract', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockQueryAll.mockResolvedValue([]);
    mockRun.mockResolvedValue({ changes: 1 });
    mockQueryRun.mockResolvedValue({ changes: 1 });
  });

  it('clones idea (title suffix) + copies the map, dropping promotion state', async () => {
    mockQueryOne
      .mockResolvedValueOnce(sourceIdea()) // source lookup
      .mockResolvedValueOnce(SOURCE_MAP) // source canonical map
      .mockImplementationOnce(async (_sql, params) =>
        newRow(String((params as unknown[])[0]), 'Growth plan (copy)')
      ); // final new-row SELECT

    const res = await request(buildApp()).post(`/api/my-work/my-ideas/${SRC_ID}/duplicate`);

    expect(res.status).toBe(201);
    expect(String(res.body.title)).toBe('Growth plan (copy)');

    const insert = ideaInsertCall();
    expect(insert).not.toBeNull();
    // Promotion state must never be copied into the new idea.
    expect(insert!.cols).not.toContain('promoted_to');
    expect(insert!.cols).not.toContain('promoted_entity_id');
    // Content columns ARE copied.
    expect(insert!.cols).toContain('body');
    expect(insert!.cols).toContain('tags');

    // The map document was cloned into a second INSERT.
    const mapInsert = mockQueryRun.mock.calls.find((c) =>
      /INSERT INTO my_idea_maps/i.test(String(c[0]))
    );
    expect(mapInsert).toBeDefined();
    // New idea id (INSERT #1 param 0) is the idea_id of the cloned map row.
    const newId = insert!.params[0];
    expect(mapInsert![1]).toContain(newId);
  });

  it("resets a 'promoted' source stage to 'seed' on the copy", async () => {
    mockQueryOne
      .mockResolvedValueOnce(sourceIdea({ stage: 'promoted' }))
      .mockResolvedValueOnce(null) // no map
      .mockImplementationOnce(async (_sql, params) =>
        newRow(String((params as unknown[])[0]), 'Growth plan (copy)')
      );

    const res = await request(buildApp()).post(`/api/my-work/my-ideas/${SRC_ID}/duplicate`);

    expect(res.status).toBe(201);
    const insert = ideaInsertCall();
    expect(insert).not.toBeNull();
    const stageIdx = insert!.cols.indexOf('stage');
    expect(stageIdx).toBeGreaterThanOrEqual(0);
    expect(insert!.params[stageIdx]).toBe('seed');
  });

  it('polish language yields a "(kopia)" suffix', async () => {
    mockQueryOne
      .mockResolvedValueOnce(sourceIdea())
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async (_sql, params) =>
        newRow(String((params as unknown[])[0]), 'Growth plan (kopia)')
      );

    const res = await request(buildApp()).post(
      `/api/my-work/my-ideas/${SRC_ID}/duplicate?language=pl`
    );

    expect(res.status).toBe(201);
    const insert = ideaInsertCall();
    const titleIdx = insert!.cols.indexOf('title');
    expect(String(insert!.params[titleIdx])).toBe('Growth plan (kopia)');
  });

  it('cross-org / foreign idea → 404 and writes nothing', async () => {
    mockQueryOne.mockResolvedValueOnce(null); // owner guard misses

    const res = await request(buildApp()).post(`/api/my-work/my-ideas/${SRC_ID}/duplicate`);

    expect(res.status).toBe(404);
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('idea without a map still duplicates (only the idea row is inserted)', async () => {
    mockQueryOne
      .mockResolvedValueOnce(sourceIdea())
      .mockResolvedValueOnce(null) // no map row
      .mockImplementationOnce(async (_sql, params) =>
        newRow(String((params as unknown[])[0]), 'Growth plan (copy)')
      );

    const res = await request(buildApp()).post(`/api/my-work/my-ideas/${SRC_ID}/duplicate`);

    expect(res.status).toBe(201);
    const mapInsert = mockQueryRun.mock.calls.find((c) =>
      /INSERT INTO my_idea_maps/i.test(String(c[0]))
    );
    expect(mapInsert).toBeUndefined();
    // exactly one write: the idea INSERT.
    expect(mockQueryRun).toHaveBeenCalledTimes(1);
  });
});
