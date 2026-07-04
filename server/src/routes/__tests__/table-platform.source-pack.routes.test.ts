/**
 * HTTP-shape tests for `table-platform.source-pack.routes.ts`.
 *
 * Strategy: import the actual router and walk its handler stack directly
 * (same pattern as `table-platform.routes.test.ts`). Avoids `app.listen()`.
 *
 * Covers: happy path (find-candidates / get pack), missing auth → 401,
 * missing org → 403, cross-org pack (IDOR) → 404, invalid body → 400.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindCandidates = vi.fn();
const mockCreatePack = vi.fn();
const mockGetPack = vi.fn();
const mockListPacks = vi.fn();
const mockMarkPackUsed = vi.fn();

vi.mock('../../services/tablePlatform/SourcePackBuilderService.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/tablePlatform/SourcePackBuilderService.js')
  >('../../services/tablePlatform/SourcePackBuilderService.js');
  return {
    ...actual,
    default: {
      findCandidates: (...args: unknown[]) => mockFindCandidates(...args),
      createPack: (...args: unknown[]) => mockCreatePack(...args),
      getPack: (...args: unknown[]) => mockGetPack(...args),
      listPacks: (...args: unknown[]) => mockListPacks(...args),
      markPackUsed: (...args: unknown[]) => mockMarkPackUsed(...args),
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
  featureFlags: { ENABLE_TABLE_SOURCE_PACK: true },
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
  const mod = await import('../table-platform.source-pack.routes.js');
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

describe('table-platform.source-pack.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /tables/:tableId/source-pack/find-candidates', () => {
    it('happy path: returns 200 with candidates', async () => {
      const candidates = [{ recordId: 'rec-1', score: 0.9 }];
      mockFindCandidates.mockResolvedValue(candidates);

      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { query: 'revenue', verifiedOnly: true },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/source-pack/find-candidates', 'POST', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ data: candidates });
      expect(mockFindCandidates).toHaveBeenCalledWith(
        expect.objectContaining({
          tableId: 'table-1',
          organizationId: 'org-A',
          query: 'revenue',
          verifiedOnly: true,
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
      await runRoute('/tables/:tableId/source-pack/find-candidates', 'POST', req, res);

      expect(res.statusCode).toBe(401);
      expect(mockFindCandidates).not.toHaveBeenCalled();
    });

    it('missing organization context → 403', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: {},
        organizationId: undefined,
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/source-pack/find-candidates', 'POST', req, res);

      expect(res.statusCode).toBe(403);
      expect(mockFindCandidates).not.toHaveBeenCalled();
    });

    it('missing tableId param → 400', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: '' },
        body: {},
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/source-pack/find-candidates', 'POST', req, res);

      expect(res.statusCode).toBe(400);
      expect(mockFindCandidates).not.toHaveBeenCalled();
    });
  });

  describe('POST /tables/:tableId/source-pack/create', () => {
    it('happy path: returns 201 with created pack', async () => {
      const pack = { id: 'pack-1', name: 'Q3 sources' };
      mockCreatePack.mockResolvedValue(pack);

      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { name: 'Q3 sources', candidateRecordIds: ['rec-1', 'rec-2'] },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/source-pack/create', 'POST', req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ data: pack });
    });

    it('missing name → 400', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { candidateRecordIds: ['rec-1'] },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/source-pack/create', 'POST', req, res);

      expect(res.statusCode).toBe(400);
      expect(mockCreatePack).not.toHaveBeenCalled();
    });

    it('empty candidateRecordIds → 400', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { name: 'Q3 sources', candidateRecordIds: [] },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/source-pack/create', 'POST', req, res);

      expect(res.statusCode).toBe(400);
      expect(mockCreatePack).not.toHaveBeenCalled();
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { tableId: 'table-1' },
        body: { name: 'x', candidateRecordIds: ['rec-1'] },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/source-pack/create', 'POST', req, res);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /source-packs/:packId', () => {
    it('happy path: returns 200 with pack', async () => {
      const pack = { id: 'pack-1', organization_id: 'org-A', name: 'Q3 sources' };
      mockGetPack.mockResolvedValue(pack);

      const req = createMockReq({
        method: 'GET',
        params: { packId: 'pack-1' },
      });
      const res = createMockRes();
      await runRoute('/source-packs/:packId', 'GET', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ data: pack });
      expect(mockGetPack).toHaveBeenCalledWith('pack-1', 'org-A');
    });

    it('pack belonging to another org (IDOR) → 404 (service scopes by org and returns null)', async () => {
      mockGetPack.mockResolvedValue(null);

      const req = createMockReq({
        method: 'GET',
        params: { packId: 'pack-in-other-org' },
      });
      const res = createMockRes();
      await runRoute('/source-packs/:packId', 'GET', req, res);

      expect(res.statusCode).toBe(404);
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'GET',
        params: { packId: 'pack-1' },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/source-packs/:packId', 'GET', req, res);

      expect(res.statusCode).toBe(401);
      expect(mockGetPack).not.toHaveBeenCalled();
    });
  });

  describe('GET /tables/:tableId/source-packs', () => {
    it('happy path: returns 200 with pack list', async () => {
      const packs = [{ id: 'pack-1' }, { id: 'pack-2' }];
      mockListPacks.mockResolvedValue(packs);

      const req = createMockReq({
        method: 'GET',
        params: { tableId: 'table-1' },
      });
      const res = createMockRes();
      await runRoute('/tables/:tableId/source-packs', 'GET', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ data: packs });
      expect(mockListPacks).toHaveBeenCalledWith(
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
      await runRoute('/tables/:tableId/source-packs', 'GET', req, res);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /source-packs/:packId/used', () => {
    it('happy path: returns 200', async () => {
      mockMarkPackUsed.mockResolvedValue({ id: 'pack-1', used_count: 3 });

      const req = createMockReq({
        method: 'POST',
        params: { packId: 'pack-1' },
      });
      const res = createMockRes();
      await runRoute('/source-packs/:packId/used', 'POST', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ data: { id: 'pack-1', used_count: 3 } });
      expect(mockMarkPackUsed).toHaveBeenCalledWith('pack-1', 'org-A');
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { packId: 'pack-1' },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/source-packs/:packId/used', 'POST', req, res);

      expect(res.statusCode).toBe(401);
      expect(mockMarkPackUsed).not.toHaveBeenCalled();
    });
  });
});
