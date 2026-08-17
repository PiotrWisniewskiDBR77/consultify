/**
 * E12 (10.4) — Idea confidentiality gate on the AI-prompt and export endpoints.
 *
 * Before this program `my_ideas` carried no confidentiality/sensitivity concept
 * at all — POST .../map/ai-suggestions, .../map/gap-analysis, .../map/expand
 * and .../map/export/pptx all sent idea title/seed-text/node-labels into an
 * LLM prompt or an exported document unconditionally. This file proves the
 * new `confidentiality` column (server/migrations/20260810_idea_confidentiality.sql
 * — additive, NOT applied to any database by this change) actually blocks
 * those four surfaces server-side once an idea is marked 'restricted', and
 * that an unmigrated environment (column absent) keeps today's exact
 * behavior — the fail-open contract server/src/services/ideaConfidentiality.ts
 * documents.
 *
 * Mock-based: no real DB. Same mock strategy as the other my-work contract tests.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown>>());
const mockQueryRun = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());
const mockQueryAll = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown[]>>());
const mockRun = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());

// Column presence is table-specific: only 'my_ideas' knows 'confidentiality'.
// Mutable per-test so the "column absent" fail-open case can flip it off.
const tableColumns = vi.hoisted(() => ({
  my_ideas: new Set([
    'id',
    'title',
    'seed_text',
    'body',
    'ai_expansion',
    'organization_id',
    'user_id',
    'confidentiality',
  ]),
  my_idea_maps: new Set(['id', 'idea_id', 'user_id', 'organization_id', 'nodes_json', 'edges_json']),
}));

const mockCallText = vi.hoisted(() => vi.fn().mockResolvedValue({ content: '[]' }));
const mockModelSelect = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'm1', provider: 'anthropic' }));
const mockGenerateFromUnifiedJson = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ buffer: Buffer.from('pptx'), filename: 'x.pptx' })
);

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
  getTableColumns: (table: string) =>
    Promise.resolve((tableColumns as Record<string, Set<string>>)[table] || new Set<string>()),
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
    ENABLE_SHARED_IDEA_MAPS: false,
  },
}));

// The AI/prompt-building endpoints dynamically `import()` these — vi.mock still
// intercepts dynamic imports the same as static ones.
vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: { callText: (...a: unknown[]) => mockCallText(...a) },
}));
vi.mock('../../../server/src/services/ai/modelRouter.js', () => ({
  default: { select: (...a: unknown[]) => mockModelSelect(...a) },
}));
vi.mock('../../../server/src/services/ai/responseLanguage.js', () => ({
  resolveResponseLanguage: () => 'en',
  languageInstruction: () => '',
}));
vi.mock('../../../server/src/services/mindmap/mindMapToUnifiedReport.js', () => ({
  mapMindMapToUnifiedReport: vi.fn().mockReturnValue({}),
}));
vi.mock('../../../server/src/services/report/pptx/PptxPipelineService.js', () => ({
  PptxPipelineService: class {
    generateFromUnifiedJson(...a: unknown[]) {
      return mockGenerateFromUnifiedJson(...a);
    }
  },
}));

import myWorkRoutes from '../../../server/src/routes/my-work.routes.ts';

const IDEA_ID = 'idea-conf-01';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

function ideaRow(confidentiality: string) {
  return { id: IDEA_ID, title: 'Sensitive plan', seedText: 'seed', confidentiality };
}

describe('E12 (10.4) — Idea confidentiality gate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    tableColumns.my_ideas = new Set([
      'id',
      'title',
      'seed_text',
      'body',
      'ai_expansion',
      'organization_id',
      'user_id',
      'confidentiality',
    ]);
    mockQueryOne.mockResolvedValue(null);
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockQueryAll.mockResolvedValue([]);
    mockRun.mockResolvedValue({ changes: 1 });
    mockCallText.mockResolvedValue({ content: '[]' });
    mockModelSelect.mockResolvedValue({ id: 'm1', provider: 'anthropic' });
    mockGenerateFromUnifiedJson.mockResolvedValue({ buffer: Buffer.from('pptx'), filename: 'x.pptx' });
  });

  describe('restricted idea → 403, LLM/export never invoked', () => {
    it('POST /map/ai-suggestions', async () => {
      mockQueryOne.mockResolvedValueOnce({ confidentiality: 'restricted' });
      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/ai-suggestions`)
        .send({ seedText: 'x', mapNodes: [] });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('IDEA_CONFIDENTIALITY_BLOCKED');
      expect(mockCallText).not.toHaveBeenCalled();
    });

    it('POST /map/gap-analysis', async () => {
      mockQueryOne.mockResolvedValueOnce({ confidentiality: 'restricted' });
      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/gap-analysis`)
        .send({ seedText: 'x', mapNodes: [] });

      expect(res.status).toBe(403);
      expect(mockCallText).not.toHaveBeenCalled();
    });

    it('POST /map/expand', async () => {
      mockQueryOne.mockResolvedValueOnce({ confidentiality: 'restricted' });
      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/expand`)
        .send({ count: 3 });

      expect(res.status).toBe(403);
      expect(mockCallText).not.toHaveBeenCalled();
    });

    it('POST /map/export/pptx', async () => {
      mockQueryOne.mockResolvedValueOnce({ confidentiality: 'restricted' });
      const res = await request(buildApp())
        .post(`/api/my-work/my-ideas/${IDEA_ID}/map/export/pptx`)
        .send({ ideaTitle: 'X', branches: [] });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('IDEA_CONFIDENTIALITY_BLOCKED');
      expect(mockGenerateFromUnifiedJson).not.toHaveBeenCalled();
    });
  });

  it('standard idea → ai-suggestions proceeds and the LLM is invoked', async () => {
    // First queryOne = confidentiality lookup, second = the idea row the
    // handler fetches once the gate passes.
    mockQueryOne
      .mockResolvedValueOnce({ confidentiality: 'standard' })
      .mockResolvedValueOnce(ideaRow('standard'));

    const res = await request(buildApp())
      .post(`/api/my-work/my-ideas/${IDEA_ID}/map/ai-suggestions`)
      .send({ seedText: 'x', mapNodes: [] });

    expect(res.status).toBe(200);
    expect(mockCallText).toHaveBeenCalledTimes(1);
  });

  it('unmigrated environment (column absent) fails open — ai-suggestions proceeds unchanged', async () => {
    tableColumns.my_ideas = new Set(['id', 'title', 'seed_text', 'organization_id', 'user_id']);
    // getIdeaConfidentiality short-circuits on the missing column, so the
    // ONLY queryOne call this request makes is the handler's own idea fetch.
    mockQueryOne.mockResolvedValueOnce(ideaRow('standard'));

    const res = await request(buildApp())
      .post(`/api/my-work/my-ideas/${IDEA_ID}/map/ai-suggestions`)
      .send({ seedText: 'x', mapNodes: [] });

    expect(res.status).toBe(200);
    expect(mockCallText).toHaveBeenCalledTimes(1);
  });
});
