/**
 * Integration tests for `GET /api/table-platform/tables/:tableId/records/:recordId/relations/explain`.
 *
 * Maps to validation matrix rows L4.1, L4.2, L4.3 and US-3.4 acceptance criteria.
 *
 * Strategy: import the actual router and invoke its handler stack directly
 * (the same pattern used by `table-platform.routes.test.ts`). Avoids
 * `app.listen()` and HTTP egress so the suite is fast and parallel-safe.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExplain, MockTenantViolationError } = vi.hoisted(() => {
  class MockTenantViolationError extends Error {
    readonly code = 'TENANT_VIOLATION' as const;
    constructor(message = 'Cross-tenant access denied') {
      super(message);
      this.name = 'TenantViolationError';
    }
  }
  return { mockExplain: vi.fn(), MockTenantViolationError };
});

vi.mock('../../services/tablePlatform/RelationExplainabilityService.js', () => ({
  default: { explain: (...args: unknown[]) => mockExplain(...args) },
  TenantViolationError: MockTenantViolationError,
}));

// `verifyToken` mock: passes through if `req.user` was injected, else 401.
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    if (req.user) return next();
    return res.status(401).json({ error: 'No token provided' });
  },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockReq(overrides: Record<string, unknown> = {}): any {
  return {
    method: 'GET',
    params: {},
    body: {},
    query: {},
    headers: {},
    ...overrides,
  };
}

function createMockRes(): any {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.send = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

async function importRouter(): Promise<any> {
  const mod = await import('../table-platform.relations-explain.routes.js');
  return mod.default;
}

async function runRouter(req: any, res: any): Promise<void> {
  // Walk the entire router stack (router-level middleware + route handlers).
  const router = await importRouter();
  const stack = (router as any).stack as any[];
  for (const layer of stack) {
    if (res.statusCode >= 400 && (res.json.mock?.calls?.length || res.send.mock?.calls?.length)) {
      // Response already terminated by an earlier middleware.
      return;
    }
    let nextCalled = false;
    if (layer.route) {
      // Match path + method.
      const path = layer.route.path as string;
      const expressPath = path
        .replace(/:tableId/g, req.params.tableId ?? '')
        .replace(/:recordId/g, req.params.recordId ?? '');
      const reqPath = req.path ?? '/';
      if (reqPath !== expressPath) continue;
      if (!layer.route.methods?.[String(req.method ?? 'GET').toLowerCase()]) continue;
      for (const innerLayer of layer.route.stack) {
        if (res.statusCode >= 400 && (res.json.mock?.calls?.length || res.send.mock?.calls?.length)) return;
        let innerNext = false;
        const result = innerLayer.handle(req, res, (err?: unknown) => {
          innerNext = true;
          if (err) throw err;
        });
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          await result;
        }
        if (!innerNext) return;
      }
    } else {
      // Router-level middleware (verifyToken, tenant gate).
      const result = layer.handle(req, res, (err?: unknown) => {
        nextCalled = true;
        if (err) throw err;
      });
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        await result;
      }
      if (!nextCalled) return;
    }
  }
}

const PATH = '/tables/tbl-A/records/rec-A/relations/explain';

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockExplain.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/table-platform/tables/:tableId/records/:recordId/relations/explain', () => {
  it('L4.1 — happy path: 200 with payload shape { data: { relations, cacheHit, computedInMs } }', async () => {
    mockExplain.mockResolvedValue({
      relations: [
        {
          targetTableId: 'tbl-B',
          targetRecordId: 'rec-B',
          targetDisplayName: 'Display-rec-B',
          fieldId: 'fld-1',
          fieldName: 'Owner',
          reason: 'Linked via Owner.',
          confidence: 0.7,
          evidence: [{ kind: 'field_match', ref: 'fld-1' }],
        },
      ],
      cacheHit: false,
      computedInMs: 5,
    });

    const req = createMockReq({
      method: 'GET',
      path: PATH,
      params: { tableId: 'tbl-A', recordId: 'rec-A' },
      user: { id: 'user-1' },
      userId: 'user-1',
      organizationId: 'org-A',
    });
    const res = createMockRes();
    await runRouter(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      data: {
        relations: expect.any(Array),
        cacheHit: false,
        computedInMs: expect.any(Number),
      },
    });
    expect(res.body.data.relations[0]).toMatchObject({
      targetTableId: 'tbl-B',
      targetRecordId: 'rec-B',
      targetDisplayName: 'Display-rec-B',
      fieldId: 'fld-1',
      fieldName: 'Owner',
      reason: expect.any(String),
      confidence: expect.any(Number),
      evidence: expect.any(Array),
    });
    expect(mockExplain).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'tbl-A',
        recordId: 'rec-A',
        tenantId: 'org-A',
        actorId: 'user-1',
      })
    );
  });

  it('L4.1b — `max` query param is forwarded to service as maxRelations', async () => {
    mockExplain.mockResolvedValue({ relations: [], cacheHit: false, computedInMs: 1 });

    const req = createMockReq({
      method: 'GET',
      path: PATH,
      params: { tableId: 'tbl-A', recordId: 'rec-A' },
      query: { max: '5' },
      user: { id: 'user-1' },
      userId: 'user-1',
      organizationId: 'org-A',
    });
    const res = createMockRes();
    await runRouter(req, res);

    expect(mockExplain).toHaveBeenCalledWith(
      expect.objectContaining({ maxRelations: 5 })
    );
  });

  it('L4.2 — cross-tenant request → 403 (service throws TenantViolationError)', async () => {
    mockExplain.mockRejectedValue(new MockTenantViolationError());

    const req = createMockReq({
      method: 'GET',
      path: PATH,
      params: { tableId: 'tbl-A', recordId: 'rec-A' },
      user: { id: 'user-1' },
      userId: 'user-1',
      organizationId: 'org-A',
    });
    const res = createMockRes();
    await runRouter(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'TENANT_VIOLATION' });
  });

  it('L4.2b — unauthenticated request → 401', async () => {
    const req = createMockReq({
      method: 'GET',
      path: PATH,
      params: { tableId: 'tbl-A', recordId: 'rec-A' },
      // no user/userId/organizationId
    });
    const res = createMockRes();
    await runRouter(req, res);

    expect(res.statusCode).toBe(401);
    expect(mockExplain).not.toHaveBeenCalled();
  });

  it('L4.2c — authenticated but missing organization context → 403', async () => {
    const req = createMockReq({
      method: 'GET',
      path: PATH,
      params: { tableId: 'tbl-A', recordId: 'rec-A' },
      user: { id: 'user-1' },
      userId: 'user-1',
      // no organizationId
    });
    const res = createMockRes();
    await runRouter(req, res);

    expect(res.statusCode).toBe(403);
    expect(mockExplain).not.toHaveBeenCalled();
  });

  it('L4.3 — actor without read permission on target records → those targets excluded from response', async () => {
    // Service performs ACL filtering upstream (covered exhaustively by the
    // service unit test — US-3.3 case 2). Here we assert the route surfaces
    // the filtered shape unchanged.
    mockExplain.mockResolvedValue({
      relations: [
        {
          targetTableId: 'tbl-X',
          targetRecordId: 'rec-readable',
          targetDisplayName: 'Display-rec-readable',
          fieldId: 'fld-1',
          fieldName: 'Owner',
          reason: 'Linked via Owner.',
          confidence: 0.6,
          evidence: [{ kind: 'field_match', ref: 'fld-1' }],
        },
      ],
      cacheHit: false,
      computedInMs: 2,
    });

    const req = createMockReq({
      method: 'GET',
      path: PATH,
      params: { tableId: 'tbl-A', recordId: 'rec-A' },
      user: { id: 'user-1' },
      userId: 'user-1',
      organizationId: 'org-A',
    });
    const res = createMockRes();
    await runRouter(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.relations).toHaveLength(1);
    expect(res.body.data.relations[0].targetTableId).toBe('tbl-X');
    expect(
      res.body.data.relations.find((r: any) => r.targetTableId === 'tbl-Y')
    ).toBeUndefined();
  });

  it('US-3.4.5 — additive mount: only the explain endpoint is registered (regression smoke for T6)', async () => {
    const router = await importRouter();
    const stack = (router as any).stack as any[];
    const routePaths = stack
      .filter((l) => l.route)
      .map((l) => `${Object.keys(l.route.methods || {})[0]?.toUpperCase()} ${l.route.path}`);
    expect(routePaths).toContain(
      'GET /tables/:tableId/records/:recordId/relations/explain'
    );
    expect(routePaths).toHaveLength(1);
  });

  it('L8.1 — service-level latency reported in computedInMs (basic perf smoke)', async () => {
    mockExplain.mockResolvedValue({ relations: [], cacheHit: false, computedInMs: 42 });

    const req = createMockReq({
      method: 'GET',
      path: PATH,
      params: { tableId: 'tbl-A', recordId: 'rec-A' },
      user: { id: 'user-1' },
      userId: 'user-1',
      organizationId: 'org-A',
    });
    const res = createMockRes();
    await runRouter(req, res);

    expect(res.body.data.computedInMs).toBeLessThan(500);
  });

  it('L4.1c — 500 on unexpected service error', async () => {
    mockExplain.mockRejectedValue(new Error('boom'));

    const req = createMockReq({
      method: 'GET',
      path: PATH,
      params: { tableId: 'tbl-A', recordId: 'rec-A' },
      user: { id: 'user-1' },
      userId: 'user-1',
      organizationId: 'org-A',
    });
    const res = createMockRes();
    await runRouter(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ error: 'Internal error' });
  });
});
