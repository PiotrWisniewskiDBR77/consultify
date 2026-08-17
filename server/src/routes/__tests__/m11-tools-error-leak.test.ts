/**
 * M11 Narzędzia (Tools) — ERROR-RESPONSE INFO-DISCLOSURE regression.
 *
 * The generate-initiatives handler previously reflected the raw thrown error
 * message (`genError.message`) into both the persisted failure_reason and the
 * 500 response body (`failureReason`). A DB-driver / internal error string in a
 * 5xx body leaks schema/structure to the client.
 *
 * Fixed: the handler now logs the real error server-side and returns a generic
 * message + stable code (`TOOL_GENERATION_FAILED`) while PRESERVING the
 * FE-expected response shape (error / failureReason / batchId / status).
 *
 * Tests run against mocked DB + auth — no real network or DB.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();
const mockGetTableColumns = vi.fn();
const mockGenerateFromSession = vi.fn();
const mockPersistInitiatives = vi.fn();

const ORG_A = 'aaa00000-0000-4000-8000-000000000001';
const USER_A = 'user-a-111';

// Raw internal/DB error text that must NEVER reach the client body.
const RAW_DB_ERROR =
  'error: column "answers_json" does not exist in relation "tool_sessions" at character 42';

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

vi.mock('../../services/ToolInitiativeService.js', () => ({
  default: {
    generateFromSession: (...a: unknown[]) => mockGenerateFromSession(...a),
    persistInitiatives: (...a: unknown[]) => mockPersistInitiatives(...a),
  },
}));

async function buildToolsApp(): Promise<Express> {
  const mod = await import('../tools.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/tools', mod.default);
  return app;
}

// A DoD-satisfied, APPROVED session so the handler reaches the generation step.
const approvedSession = {
  id: 'tool-owned',
  organization_id: ORG_A,
  project_id: null,
  tool_type: 'dynamic-swot',
  name: 'SWOT',
  status: 'APPROVED',
  completion_percent: 100,
  confidence_avg: 5,
  answers_json: JSON.stringify({ q1: 'a' }),
  missing_items_json: null,
  runtime_contract_json: null,
  dod_status: 'passed',
};

describe('M11 ERR-LEAK — generate-initiatives 500 never reflects raw error text', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    mockGetTableColumns.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ changes: 1, rowCount: 1 });
    // Idempotency batch lookup → no existing batch; session lookup → approved.
    mockQueryOne.mockImplementation((sql: string) => {
      if (/FROM\s+tool_initiative_batches/i.test(String(sql))) return Promise.resolve(null);
      if (/FROM\s+tool_sessions/i.test(String(sql))) return Promise.resolve({ ...approvedSession });
      return Promise.resolve(null);
    });
    mockQueryAll.mockResolvedValue([]);
    // Force the generation error path with a raw DB-driver-style message.
    mockGenerateFromSession.mockRejectedValue(new Error(RAW_DB_ERROR));
    mockPersistInitiatives.mockResolvedValue([]);
  });

  it('→ 500 with generic message + stable code, raw error text absent from body', async () => {
    const app = await buildToolsApp();

    const res = await request(app)
      .post('/api/tools/tool-owned/generate-initiatives')
      .send({ methodologyId: 'mece', count: 3 });

    expect(res.status).toBe(500);

    // Shape preserved: FE-expected top-level keys still present.
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('failureReason');
    expect(res.body).toHaveProperty('batchId');
    expect(res.body.status).toBe('FAILED');

    // Stable code present.
    expect(res.body.code).toBe('TOOL_GENERATION_FAILED');

    // Generic, non-leaky values.
    expect(res.body.error).toBe('Initiative generation failed');
    expect(res.body.failureReason).toBe('Initiative generation failed');

    // The raw DB/internal error text leaks NOWHERE in the serialized body.
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(RAW_DB_ERROR);
    expect(serialized).not.toContain('column "answers_json"');
    expect(serialized).not.toContain('relation "tool_sessions"');

    // The persisted failure_reason is generic too (it is surfaced to the org
    // owner via getToolSession) — never the raw driver text.
    const failedUpdate = mockQueryRun.mock.calls.find(
      (c) =>
        /UPDATE\s+tool_sessions/i.test(String(c?.[0])) && /failure_reason/i.test(String(c?.[0]))
    );
    expect(failedUpdate).toBeTruthy();
    expect(failedUpdate?.[1]).toContain('Initiative generation failed');
    expect(JSON.stringify(failedUpdate?.[1])).not.toContain(RAW_DB_ERROR);
  });
});
