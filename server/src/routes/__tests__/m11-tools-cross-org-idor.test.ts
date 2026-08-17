/**
 * M11 Narzędzia (Tools) — cross-org IDOR contract tests.
 *
 * Mirrors routes/__tests__/cross-org-idor.test.ts. Every M11 by-id read/write on
 * the tool→initiative chain must be gated by the authenticated org so that a
 * foreign-org toolId resolves to 404/no-op rather than leaking or mutating
 * another org's tool session.
 *
 * Coverage:
 *   HOLE (fixed) — GET /tools/:toolId/generated-initiatives leaked a foreign
 *     org's generated-initiative titles/statuses (no parent-ownership check).
 *   CONFIRMED-safe regression guards for the org-scoped siblings:
 *     - GET    /tools/:toolId                  → 404 cross-org
 *     - PUT    /tools/:toolId                  → 404 cross-org, no UPDATE
 *     - POST   /tools/:toolId/promote          → 404 cross-org, no promotion write
 *     - DELETE /tools/:toolId/comments/:id     → 404 cross-org, no DELETE
 *
 * Tests run against mocked DB + auth — no real network or DB.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Top-level mock fns (declared before vi.mock factories) ──────────────────

const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();
const mockGetTableColumns = vi.fn();

let mockUser: {
  id: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
} | null = null;

const ORG_A = 'aaa00000-0000-4000-8000-000000000001';
const USER_A = 'user-a-111';

// ── Middleware mocks (hoisted) ───────────────────────────────────────────────

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

vi.mock('../../middleware/auditsStrictMembership.middleware.js', () => ({
  requireActiveTenantMembership: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (req: any, res: any, next: () => void) => {
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

// Validation passes through — IDOR is about org-scope, not body shape.
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

// ── Service dep mocks (kept inert; the controller is the unit under test) ────

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

vi.mock('../../services/ToolInitiativeService.js', () => ({
  default: {
    generateFromSession: vi.fn().mockResolvedValue([]),
    persistInitiatives: vi.fn().mockResolvedValue([]),
  },
}));

// ── App builder ──────────────────────────────────────────────────────────────

async function buildToolsApp(): Promise<Express> {
  const mod = await import('../tools.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/tools', mod.default);
  return app;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOLE (fixed) — GET /tools/:toolId/generated-initiatives parent-ownership gate
// ═══════════════════════════════════════════════════════════════════════════

describe('M11 HOLE — GET /tools/:toolId/generated-initiatives is org-scoped', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    mockQueryAll.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ changes: 0, rowCount: 0 });
    mockGetTableColumns.mockResolvedValue([]);
  });

  it('→ 404 for a foreign-org toolId and never runs the initiatives JOIN query', async () => {
    // Parent tool_sessions ownership lookup returns null → not owned by caller.
    mockQueryOne.mockResolvedValue(null);
    const app = await buildToolsApp();

    const res = await request(app).get('/api/tools/tool-from-org-b/generated-initiatives');

    expect(res.status).toBe(404);

    // Ownership SELECT ran org-scoped against the caller's org.
    const ownershipCall = mockQueryOne.mock.calls.find(
      (c) =>
        /FROM\s+tool_sessions/i.test(String(c?.[0])) &&
        /AND\s+organization_id\s*=\s*\?/i.test(String(c?.[0]))
    );
    expect(ownershipCall).toBeTruthy();
    expect(ownershipCall?.[1]).toEqual(['tool-from-org-b', ORG_A]);

    // The foreign org's initiative listing was NOT issued.
    const leakQuery = mockQueryAll.mock.calls.find((c) =>
      /FROM\s+tool_initiative_links/i.test(String(c?.[0]))
    );
    expect(leakQuery).toBeFalsy();
  });

  it('→ 200 + listing when the tool session is owned by the caller', async () => {
    mockQueryOne.mockResolvedValue({ id: 'tool-owned' });
    mockQueryAll.mockResolvedValue([{ id: 'init-1', title: 'X', status: 'DRAFT' }]);
    const app = await buildToolsApp();

    const res = await request(app).get('/api/tools/tool-owned/generated-initiatives');

    expect(res.status).toBe(200);
    expect(res.body.initiatives).toHaveLength(1);
    const listQuery = mockQueryAll.mock.calls.find((c) =>
      /FROM\s+tool_initiative_links/i.test(String(c?.[0]))
    );
    expect(listQuery).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONFIRMED-safe — org-scoped siblings reject cross-org by-id access
// ═══════════════════════════════════════════════════════════════════════════

describe('M11 CONFIRMED-safe — tool session by-id endpoints are org-scoped', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    mockQueryAll.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ changes: 0, rowCount: 0 });
    mockGetTableColumns.mockResolvedValue([]);
    // Default: every parent lookup misses (foreign-org).
    mockQueryOne.mockResolvedValue(null);
  });

  it('GET /tools/:toolId → 404 cross-org (org-scoped SELECT)', async () => {
    const app = await buildToolsApp();
    const res = await request(app).get('/api/tools/tool-from-org-b');
    expect(res.status).toBe(404);
    const scoped = mockQueryOne.mock.calls.find(
      (c) =>
        /FROM\s+tool_sessions/i.test(String(c?.[0])) &&
        /AND\s+organization_id\s*=\s*\?/i.test(String(c?.[0]))
    );
    expect(scoped?.[1]).toEqual(['tool-from-org-b', ORG_A]);
  });

  it('PUT /tools/:toolId → 404 cross-org and runs no UPDATE', async () => {
    const app = await buildToolsApp();
    const res = await request(app)
      .put('/api/tools/tool-from-org-b')
      .send({ answers: {}, completionPercent: 100, confidenceAvg: 5, status: 'REVIEW' });

    expect(res.status).toBe(404);
    const update = mockQueryRun.mock.calls.find((c) =>
      /UPDATE\s+tool_sessions/i.test(String(c?.[0]))
    );
    expect(update).toBeFalsy();
  });

  it('POST /tools/:toolId/promote → 404 cross-org and writes no downstream artifact', async () => {
    const app = await buildToolsApp();
    const res = await request(app)
      .post('/api/tools/tool-from-org-b/promote')
      .send({ outputType: 'initiative', title: 'cross-org promotion attempt' });

    expect(res.status).toBe(404);
    const ownership = mockQueryOne.mock.calls.find(
      (c) =>
        /FROM\s+tool_sessions/i.test(String(c?.[0])) &&
        /AND\s+organization_id\s*=\s*\?/i.test(String(c?.[0]))
    );
    expect(ownership?.[1]).toEqual(['tool-from-org-b', ORG_A]);
    const promote = mockQueryRun.mock.calls.find((c) =>
      /INSERT\s+INTO\s+initiatives/i.test(String(c?.[0]))
    );
    expect(promote).toBeFalsy();
  });

  it('DELETE /tools/:toolId/comments/:commentId → 404 cross-org and runs no DELETE', async () => {
    // ensureToolCommentsSchema CREATE TABLE → queryRun; comment lookup → queryOne null.
    const app = await buildToolsApp();
    const res = await request(app).delete('/api/tools/tool-from-org-b/comments/comment-from-org-b');

    expect(res.status).toBe(404);
    const lookup = mockQueryOne.mock.calls.find(
      (c) =>
        /FROM\s+tool_comments/i.test(String(c?.[0])) &&
        /AND\s+organization_id\s*=\s*\?/i.test(String(c?.[0]))
    );
    expect(lookup?.[1]).toEqual(['comment-from-org-b', 'tool-from-org-b', ORG_A]);
    const del = mockQueryRun.mock.calls.find((c) =>
      /DELETE\s+FROM\s+tool_comments\s+WHERE\s+id/i.test(String(c?.[0]))
    );
    expect(del).toBeFalsy();
  });

  it('GET /tools/:toolId without auth → 401', async () => {
    mockUser = null;
    const app = await buildToolsApp();
    const res = await request(app).get('/api/tools/tool-x');
    expect(res.status).toBe(401);
  });
});
