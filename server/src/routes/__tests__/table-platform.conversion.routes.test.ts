/**
 * HTTP-shape tests for `table-platform.conversion.routes.ts`.
 *
 * Strategy: import the actual router and walk its handler stack directly
 * (same pattern as `table-platform.routes.test.ts`). Avoids `app.listen()`.
 *
 * Covers: happy path (convert), missing auth → 401, missing org → 403,
 * cross-org conversion (IDOR) → 404, invalid body → 400.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConvertTable = vi.fn();
const mockGetConversion = vi.fn();
const mockListConversions = vi.fn();

vi.mock('../../services/tablePlatform/TableArtifactConversionService.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/tablePlatform/TableArtifactConversionService.js')
  >('../../services/tablePlatform/TableArtifactConversionService.js');
  return {
    ...actual,
    default: {
      convertTable: (...args: unknown[]) => mockConvertTable(...args),
      getConversion: (...args: unknown[]) => mockGetConversion(...args),
      listConversions: (...args: unknown[]) => mockListConversions(...args),
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
  featureFlags: { ENABLE_TABLE_ARTIFACT_CONVERSION: true },
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
  return res;
}

async function importRouter(): Promise<any> {
  const mod = await import('../table-platform.conversion.routes.js');
  return mod.default;
}

async function runRoute(path: string, method: string, req: any, res: any): Promise<void> {
  const router = await importRouter();
  const stack = (router as any).stack as any[];
  for (const layer of stack) {
    if (res.body !== undefined) return;
    if (layer.route) {
      const routePath = layer.route.path as string;
      if (routePath !== path) continue;
      if (!layer.route.methods?.[method.toLowerCase()]) continue;
      for (const innerLayer of layer.route.stack) {
        if (res.body !== undefined) return;
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

describe('table-platform.conversion.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /tables/:tableId/convert', () => {
    it('happy path: returns 202 with conversion payload', async () => {
      const conversion = { conversionId: 'conv-1', status: 'succeeded', artifactRunId: 'run-1' };
      mockConvertTable.mockResolvedValue(conversion);

      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { target: 'document', workspaceId: 'ws-1' },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/convert', 'POST', req, res);

      expect(res.statusCode).toBe(202);
      expect(res.body).toEqual({ data: conversion });
      expect(mockConvertTable).toHaveBeenCalledWith(
        expect.objectContaining({
          tableId: 'table-1',
          organizationId: 'org-A',
          workspaceId: 'ws-1',
          initiatedBy: 'user-1',
          target: 'document',
        })
      );
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { target: 'document', workspaceId: 'ws-1' },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/convert', 'POST', req, res);

      expect(res.statusCode).toBe(401);
      expect(mockConvertTable).not.toHaveBeenCalled();
    });

    it('missing organization context → 403', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { target: 'document', workspaceId: 'ws-1' },
        organizationId: undefined,
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/convert', 'POST', req, res);

      expect(res.statusCode).toBe(403);
      expect(mockConvertTable).not.toHaveBeenCalled();
    });

    it('missing workspaceId → 400', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { target: 'document' },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/convert', 'POST', req, res);

      expect(res.statusCode).toBe(400);
      expect(mockConvertTable).not.toHaveBeenCalled();
    });
  });

  describe('GET /table-conversions/:conversionId', () => {
    it('happy path: returns 200 with conversion', async () => {
      const conversion = { id: 'conv-1', organization_id: 'org-A', status: 'succeeded' };
      mockGetConversion.mockResolvedValue(conversion);

      const req = createMockReq({
        method: 'GET',
        params: { conversionId: 'conv-1' },
      });
      const res = createMockRes();
      await runRoute('/table-conversions/:conversionId', 'GET', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ data: conversion });
      expect(mockGetConversion).toHaveBeenCalledWith('conv-1', 'org-A');
    });

    it('cross-org conversion (IDOR) → 404 (service returns null when org mismatches)', async () => {
      // Route trusts the service to scope by organizationId; service returns
      // null for a conversion that belongs to a different org.
      mockGetConversion.mockResolvedValue(null);

      const req = createMockReq({
        method: 'GET',
        params: { conversionId: 'conv-in-other-org' },
        organizationId: 'org-A',
      });
      const res = createMockRes();
      await runRoute('/table-conversions/:conversionId', 'GET', req, res);

      expect(res.statusCode).toBe(404);
      expect(mockGetConversion).toHaveBeenCalledWith('conv-in-other-org', 'org-A');
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'GET',
        params: { conversionId: 'conv-1' },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/table-conversions/:conversionId', 'GET', req, res);

      expect(res.statusCode).toBe(401);
      expect(mockGetConversion).not.toHaveBeenCalled();
    });
  });

  describe('GET /tables/:tableId/conversions', () => {
    it('happy path: returns 200 with conversions list', async () => {
      const rows = [{ id: 'conv-1' }, { id: 'conv-2' }];
      mockListConversions.mockResolvedValue(rows);

      const req = createMockReq({
        method: 'GET',
        params: { tableId: 'table-1' },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/conversions', 'GET', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ data: rows });
      expect(mockListConversions).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-A', tableId: 'table-1' })
      );
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'GET',
        params: { tableId: 'table-1' },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/conversions', 'GET', req, res);

      expect(res.statusCode).toBe(401);
    });
  });
});
