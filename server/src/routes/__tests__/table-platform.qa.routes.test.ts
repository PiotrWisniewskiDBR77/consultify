/**
 * HTTP-shape tests for `table-platform.qa.routes.ts`.
 *
 * Strategy: import the actual router and walk its handler stack directly
 * (same pattern as `table-platform.routes.test.ts`). Avoids `app.listen()`.
 *
 * Covers: happy path (recompute), missing auth → 401, missing org → 403,
 * cross-org table (IDOR, via service TENANT_VIOLATION) → 403, invalid
 * body → 400.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockComputeReport = vi.fn();
const mockGetLatestReport = vi.fn();
const mockMarkSuggestionInapplicable = vi.fn();

vi.mock('../../services/tablePlatform/TableQaService.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/tablePlatform/TableQaService.js')
  >('../../services/tablePlatform/TableQaService.js');
  return {
    ...actual,
    default: {
      computeReport: (...args: unknown[]) => mockComputeReport(...args),
      getLatestReport: (...args: unknown[]) => mockGetLatestReport(...args),
      markSuggestionInapplicable: (...args: unknown[]) => mockMarkSuggestionInapplicable(...args),
    },
  };
});

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    if (req.__noAuth) {
      return res.status(401).json({ error: 'No token provided' });
    }
    next();
  },
  requireSuperAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../config/FeatureFlags.js', () => ({
  featureFlags: { ENABLE_TABLE_QA_ENGINE: true },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function createMockReq(overrides: Record<string, unknown> = {}): any {
  return {
    method: 'GET',
    params: {},
    body: {},
    query: {},
    headers: {},
    user: { id: 'user-1' },
    userId: 'user-1',
    organizationId: 'org-A',
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
  res.end = vi.fn(() => {
    res.ended = true;
    return res;
  });
  return res;
}

async function importRouter(): Promise<any> {
  const mod = await import('../table-platform.qa.routes.js');
  return mod.default;
}

async function runRoute(path: string, method: string, req: any, res: any): Promise<void> {
  const router = await importRouter();
  const stack = (router as any).stack as any[];
  for (const layer of stack) {
    if (res.body !== undefined || res.ended) return;
    if (layer.route) {
      const routePath = layer.route.path as string;
      if (routePath !== path) continue;
      if (!layer.route.methods?.[method.toLowerCase()]) continue;
      for (const innerLayer of layer.route.stack) {
        if (res.body !== undefined || res.ended) return;
        let nextCalled = false;
        await innerLayer.handle(req, res, (err?: unknown) => {
          nextCalled = true;
          if (err) throw err;
        });
        if (!nextCalled) return;
      }
    } else {
      let nextCalled = false;
      await layer.handle(req, res, (err?: unknown) => {
        nextCalled = true;
        if (err) throw err;
      });
      if (!nextCalled) return;
    }
  }
}

describe('table-platform.qa.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /tables/:tableId/qa/recompute', () => {
    it('happy path: returns 200 with qa report', async () => {
      const report = { tableId: 'table-1', overallScore: 0.9, axes: [] };
      mockComputeReport.mockResolvedValue(report);

      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { triggerKind: 'on_demand' },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/qa/recompute', 'POST', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ data: report });
      expect(mockComputeReport).toHaveBeenCalledWith(
        expect.objectContaining({
          tableId: 'table-1',
          organizationId: 'org-A',
          computedBy: 'user-1',
          triggerKind: 'on_demand',
        })
      );
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: {},
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/qa/recompute', 'POST', req, res);

      expect(res.statusCode).toBe(401);
      expect(mockComputeReport).not.toHaveBeenCalled();
    });

    it('missing organization context → 403', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: {},
        organizationId: undefined,
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/qa/recompute', 'POST', req, res);

      expect(res.statusCode).toBe(403);
      expect(mockComputeReport).not.toHaveBeenCalled();
    });

    it('table belonging to another org (IDOR) → 403 via service TenantViolation-style error', async () => {
      const { TableQaError } = await import('../../services/tablePlatform/TableQaService.js');
      mockComputeReport.mockRejectedValue(
        new TableQaError('TENANT_VIOLATION', 'Table not in actor organization', 403)
      );

      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-in-other-org' },
        body: {},
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/qa/recompute', 'POST', req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({ code: 'TENANT_VIOLATION' });
    });

    it('invalid triggerKind falls back to on_demand (defensive default, not a hard 400)', async () => {
      const report = { tableId: 'table-1', overallScore: 1 };
      mockComputeReport.mockResolvedValue(report);

      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { triggerKind: 'not-a-real-trigger' },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/qa/recompute', 'POST', req, res);

      expect(res.statusCode).toBe(200);
      expect(mockComputeReport).toHaveBeenCalledWith(
        expect.objectContaining({ triggerKind: 'on_demand' })
      );
    });

    it('missing tableId param → 400', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: '' },
        body: {},
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/qa/recompute', 'POST', req, res);

      expect(res.statusCode).toBe(400);
      expect(mockComputeReport).not.toHaveBeenCalled();
    });
  });

  describe('GET /tables/:tableId/qa/latest', () => {
    it('happy path: returns 200 with the latest report', async () => {
      const report = { tableId: 'table-1', overallScore: 0.8 };
      mockGetLatestReport.mockResolvedValue(report);

      const req = createMockReq({
        method: 'GET',
        params: { tableId: 'table-1' },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/qa/latest', 'GET', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ data: report });
      expect(mockGetLatestReport).toHaveBeenCalledWith('table-1', 'org-A');
    });

    it('no report yet → 204 (not leaking a 404/error)', async () => {
      mockGetLatestReport.mockResolvedValue(null);

      const req = createMockReq({
        method: 'GET',
        params: { tableId: 'table-1' },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/qa/latest', 'GET', req, res);

      expect(res.statusCode).toBe(204);
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'GET',
        params: { tableId: 'table-1' },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/qa/latest', 'GET', req, res);

      expect(res.statusCode).toBe(401);
      expect(mockGetLatestReport).not.toHaveBeenCalled();
    });
  });

  describe('POST /tables/:tableId/qa/suggestions/:suggestionId/inapplicable', () => {
    it('happy path: returns 200', async () => {
      mockMarkSuggestionInapplicable.mockResolvedValue({ dismissed: true });

      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1', suggestionId: 'sugg-1' },
        body: { fingerprint: 'fp-1' },
      });
      const res = createMockRes();
      await runRoute(
        '/tables/:tableId/qa/suggestions/:suggestionId/inapplicable',
        'POST',
        req,
        res
      );

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ data: { dismissed: true } });
    });

    it('missing fingerprint → 400', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1', suggestionId: 'sugg-1' },
        body: {},
      });
      const res = createMockRes();
      await runRoute(
        '/tables/:tableId/qa/suggestions/:suggestionId/inapplicable',
        'POST',
        req,
        res
      );

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ code: 'FINGERPRINT_REQUIRED' });
      expect(mockMarkSuggestionInapplicable).not.toHaveBeenCalled();
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1', suggestionId: 'sugg-1' },
        body: { fingerprint: 'fp-1' },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute(
        '/tables/:tableId/qa/suggestions/:suggestionId/inapplicable',
        'POST',
        req,
        res
      );

      expect(res.statusCode).toBe(401);
    });
  });
});
