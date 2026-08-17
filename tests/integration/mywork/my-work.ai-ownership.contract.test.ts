/**
 * M08 L-03 — ownership guard on Idea-Table AI endpoints.
 *
 * ai-suggestions / ai-table-action / ai-fill take an :id from the path and call
 * an LLM. Without an ownership check, an attacker can burn the org's LLM budget
 * on arbitrary idea UUIDs (cost vector — context comes from the body so it is
 * not a data leak). The guard verifies the idea is owned by user+org first:
 *   - unknown / cross-org idea → 404 and the LLM service is NOT invoked;
 *   - owned idea → request proceeds to the service.
 *
 * Mock-based: no real DB. Same mock strategy as the other my-work contract tests.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown>>());
const mockQueryRun = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<{ changes: number }>>());
const mockQueryAll = vi.hoisted(() => vi.fn<[string, unknown[]], Promise<unknown[]>>());

const mockGenerateSuggestions = vi.hoisted(() => vi.fn());
const mockGenerateTableAction = vi.hoisted(() => vi.fn());
const mockGenerateAIFill = vi.hoisted(() => vi.fn());
const mockGenerateIdeaAI = vi.hoisted(() => vi.fn());

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: (...a: Parameters<typeof mockQueryOne>) => mockQueryOne(...a),
  queryRun: (...a: Parameters<typeof mockQueryRun>) => mockQueryRun(...a),
  queryAll: (...a: Parameters<typeof mockQueryAll>) => mockQueryAll(...a),
  run: (...a: Parameters<typeof mockQueryRun>) => mockQueryRun(...a),
  query: (...a: Parameters<typeof mockQueryAll>) => mockQueryAll(...a),
  queryFirst: vi.fn().mockResolvedValue(null),
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
  getTableColumns: () => Promise.resolve(new Set<string>()),
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

// LLM service — spies so we can assert it is NOT reached when the guard rejects.
vi.mock('../../../server/src/services/ideaAISuggestionsService.js', () => ({
  generateSuggestions: (...a: unknown[]) => mockGenerateSuggestions(...a),
  generateTableAction: (...a: unknown[]) => mockGenerateTableAction(...a),
  generateAIFill: (...a: unknown[]) => mockGenerateAIFill(...a),
}));

vi.mock('../../../server/src/services/ideaAIGeneratorService.js', () => ({
  generateIdeaAI: (...a: unknown[]) => mockGenerateIdeaAI(...a),
}));

import myWorkRoutes from '../../../server/src/routes/my-work.routes.ts';

const USER_ID = 'user-1';
const ORG_ID = 'org-1';
const OWNED_ROW = { ok: 1 };

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

const AI_ENDPOINTS = [
  {
    name: 'ai-suggestions',
    path: (id: string) => `/api/my-work/my-ideas/${id}/ai-suggestions`,
    body: { context: { title: 'x' }, mode: 'passive', language: 'en' },
    spy: mockGenerateSuggestions,
  },
  {
    name: 'ai-table-action',
    path: (id: string) => `/api/my-work/my-ideas/${id}/ai-table-action`,
    body: { command: 'add a column', schema: [], language: 'en' },
    spy: mockGenerateTableAction,
  },
  {
    name: 'ai-fill',
    path: (id: string) => `/api/my-work/my-ideas/${id}/ai-fill`,
    body: { prompt: 'fill it', rows: [], language: 'en' },
    spy: mockGenerateAIFill,
  },
  {
    name: 'ai-generate',
    path: (id: string) => `/api/my-work/my-ideas/${id}/ai-generate`,
    body: { generatorType: 'table_columns', tool: 'table', context: { title: 'x' } },
    spy: mockGenerateIdeaAI,
  },
] as const;

describe('M08 L-03 — AI endpoint ownership guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryOne.mockResolvedValue(null);
    mockQueryAll.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockGenerateSuggestions.mockResolvedValue({ suggestions: [] });
    mockGenerateTableAction.mockResolvedValue({ type: 'noop' });
    mockGenerateAIFill.mockResolvedValue([]);
    mockGenerateIdeaAI.mockResolvedValue({ proposals: [] });
  });

  for (const ep of AI_ENDPOINTS) {
    it(`${ep.name}: unknown/cross-org idea → 404 and LLM is NOT called`, async () => {
      mockQueryOne.mockResolvedValue(null); // ownership SELECT finds nothing

      const res = await request(buildApp()).post(ep.path('someone-elses-idea')).send(ep.body);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
      expect(ep.spy).not.toHaveBeenCalled();
    });

    it(`${ep.name}: owned idea → guard passes and LLM is invoked`, async () => {
      mockQueryOne.mockResolvedValue(OWNED_ROW); // ownership SELECT succeeds

      const res = await request(buildApp()).post(ep.path('my-idea')).send(ep.body);

      expect(res.status).toBe(200);
      expect(ep.spy).toHaveBeenCalledTimes(1);
    });

    it(`${ep.name}: ownership SELECT is scoped to user_id AND organization_id`, async () => {
      mockQueryOne.mockResolvedValue(OWNED_ROW);

      await request(buildApp()).post(ep.path('my-idea')).send(ep.body);

      const ownershipCall = mockQueryOne.mock.calls.find(([sql]) =>
        /FROM my_ideas WHERE id = \? AND user_id = \? AND organization_id = \?/i.test(
          sql as string
        )
      );
      expect(ownershipCall).toBeDefined();
      expect(ownershipCall![1]).toEqual(['my-idea', USER_ID, ORG_ID]);
    });
  }
});
