/**
 * H1.4 Tools → Inicjatywy — ROUND-TRIP source back-reference.
 *
 * Verifies the FULL tool→initiative materialization path end-to-end at the
 * route level: POST /api/tools/:toolId/generate-initiatives →
 * ToolController.generateInitiatives → (REAL) ToolInitiativeService.persistInitiatives
 * → INSERT INTO initiatives with source_type='tool' + source_id=<toolSessionId>.
 *
 * Unlike m11-tools-*.test.ts (which mock ToolInitiativeService entirely and so
 * never exercise the persistence), this test uses the REAL service and only
 * mocks the AI pipeline + the DB driver (queryHelpers). That is what makes the
 * back-reference assertion meaningful: if persistInitiatives stopped writing
 * source_type/source_id (or the callback were a no-op that never persisted),
 * this test goes RED.
 *
 * Runs against mocked DB + AI + auth — no real network or DB.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();
const mockGetTableColumns = vi.fn();
const mockAiProcess = vi.fn();

const ORG_A = 'aaa00000-0000-4000-8000-000000000001';
const USER_A = 'user-a-111';
const TOOL_ID = 'tool-owned-backref';

let mockUser: {
  id: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
} | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess:
    () =>
    (req: any, res: any, next: () => void) => {
      if (!req.user) return res.status(401).json({ error: 'No token' });
      next();
    },
}));

vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
  validateParams: () => (_req: any, _res: any, next: () => void) => next(),
  validateQuery: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  queryFirst: (...a: unknown[]) => mockQueryOne(...a),
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
  getTableColumns: (...a: unknown[]) => mockGetTableColumns(...a),
}));

vi.mock('../../services/KnownToolsService.js', () => ({
  default: {
    getKnownToolAvailability: vi.fn().mockResolvedValue({ exists: false, isActive: true }),
    listKnownTools: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

vi.mock('../../services/organizationContext/OrganizationContextService.js', () => ({
  default: { recordToolSession: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../services/permissionService.js', () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
}));

// REAL ToolInitiativeService — but its AI dependency is stubbed to return a
// deterministic initiative payload, so persistInitiatives runs for real and
// executes the initiatives INSERT (the code under test for the back-ref).
vi.mock('../../services/ai/AIPipeline.js', () => ({
  AIPipeline: {
    getInstance: () => ({
      process: (...a: unknown[]) => mockAiProcess(...a),
    }),
  },
}));

async function buildToolsApp(): Promise<Express> {
  const mod = await import('../tools.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/tools', mod.default);
  return app;
}

// A DoD-satisfied, APPROVED session so the handler reaches generation + persist.
const approvedSession = {
  id: TOOL_ID,
  organization_id: ORG_A,
  project_id: null,
  tool_type: 'dynamic-swot',
  name: 'SWOT',
  status: 'APPROVED',
  completion_percent: 100,
  confidence_avg: 5,
  answers_json: JSON.stringify({ q1: 'a' }),
  context_snapshot: JSON.stringify({ org: { name: 'Acme' } }),
  missing_items_json: null,
  runtime_contract_json: null,
  dod_status: 'passed',
};

describe('H1.4 Tools→Inicjatywy — initiative carries source_type=tool + source_id=<toolSessionId>', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Direct-INSERT persistence path (funnel disabled) writes the explicit
    // source_type/source_id columns we assert on.
    delete process.env.INITIATIVE_FUNNEL_ENABLED;
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    mockGetTableColumns.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ changes: 1, rowCount: 1 });
    // Session lookup → approved; idempotency batch lookup → none.
    mockQueryOne.mockImplementation((sql: string) => {
      if (/FROM\s+tool_initiative_batches/i.test(String(sql))) return Promise.resolve(null);
      if (/FROM\s+tool_sessions/i.test(String(sql))) return Promise.resolve({ ...approvedSession });
      return Promise.resolve(null);
    });
    mockQueryAll.mockResolvedValue([]);
    // Deterministic AI output so the real service persists a known initiative.
    mockAiProcess.mockResolvedValue({
      content: JSON.stringify({
        initiatives: [
          {
            title: 'Redukcja czasu cyklu',
            description: 'Skróć cykl obsługi zamówienia o 30%.',
            category: 'Operations',
            priority: 'P1',
            risk: 'Medium',
          },
        ],
      }),
    });
  });

  it('POST /generate-initiatives → 200 GENERATED and initiatives INSERT binds back to the tool session', async () => {
    const app = await buildToolsApp();

    const res = await request(app)
      .post(`/api/tools/${TOOL_ID}/generate-initiatives`)
      .send({ methodologyId: 'impact-feasibility', count: 1 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('GENERATED');
    expect(Array.isArray(res.body.initiatives)).toBe(true);
    expect(res.body.initiatives.length).toBe(1);
    const createdId = res.body.initiatives[0].id;
    expect(createdId).toBeTruthy();

    // Locate the real INSERT INTO initiatives issued by persistInitiatives.
    const initiativeInsert = mockQueryRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+initiatives\b/i.test(String(c?.[0]))
    );
    expect(initiativeInsert).toBeTruthy();

    const sql = String(initiativeInsert?.[0]);
    const params = (initiativeInsert?.[1] || []) as unknown[];
    // The column list must include the source back-ref columns.
    expect(sql).toMatch(/source_type/i);
    expect(sql).toMatch(/source_id/i);

    // And the bound values must actually be the tool back-reference — not null,
    // not some other source. This is the assertion that fails if the back-ref
    // is ever dropped or the callback stops materializing.
    expect(params).toContain('tool');
    expect(params).toContain(TOOL_ID);

    // Sanity: the persisted initiative id is the one returned to the client.
    expect(params).toContain(createdId);

    // The tool_initiative_links row ties the same initiative to the tool session.
    const linkInsert = mockQueryRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+tool_initiative_links\b/i.test(String(c?.[0]))
    );
    expect(linkInsert).toBeTruthy();
    expect((linkInsert?.[1] || []) as unknown[]).toContain(TOOL_ID);
    expect((linkInsert?.[1] || []) as unknown[]).toContain(createdId);
  });
});
