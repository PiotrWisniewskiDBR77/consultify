/**
 * HTTP-shape tests for `table-platform.record-sources.routes.ts`.
 *
 * Strategy: import the actual router and walk its handler stack directly
 * (same pattern as `table-platform.routes.test.ts`). Avoids `app.listen()`.
 *
 * Covers: happy path (list sources), missing auth → 401, missing org → 403,
 * cross-org record/source (IDOR) → 403/404, invalid input → 400.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListSourcesForRecord = vi.fn();
const mockCreateSource = vi.fn();
const mockGetSource = vi.fn();
const mockUpdateSource = vi.fn();
const mockMarkVerified = vi.fn();
const mockDeleteSource = vi.fn();
const mockRequireRecordAccess = vi.fn();

vi.mock('../../services/tablePlatform/RecordSourcesService.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/tablePlatform/RecordSourcesService.js')
  >('../../services/tablePlatform/RecordSourcesService.js');
  return {
    ...actual,
    default: {
      listSourcesForRecord: (...args: unknown[]) => mockListSourcesForRecord(...args),
      createSource: (...args: unknown[]) => mockCreateSource(...args),
      getSource: (...args: unknown[]) => mockGetSource(...args),
      updateSource: (...args: unknown[]) => mockUpdateSource(...args),
      markVerified: (...args: unknown[]) => mockMarkVerified(...args),
      deleteSource: (...args: unknown[]) => mockDeleteSource(...args),
    },
  };
});

vi.mock('../../services/tablePlatform/PermissionsService.js', () => ({
  default: {
    requireRecordAccess: (req: any, res: any, next: any) => mockRequireRecordAccess(req, res, next),
  },
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    if (req.__noAuth) {
      return res.status(401).json({ error: 'No token provided' });
    }
    next();
  },
  requireSuperAdmin: (_req: any, _res: any, next: any) => next(),
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
  const mod = await import('../table-platform.record-sources.routes.js');
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

describe('table-platform.record-sources.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: permission check passes through.
    mockRequireRecordAccess.mockImplementation((_req: any, _res: any, next: any) => next());
  });

  describe('GET /records/:recordId/sources', () => {
    it('happy path: returns 200 with sources array', async () => {
      const sources = [{ id: 'src-1', record_id: 'rec-1', source_type: 'manual' }];
      mockListSourcesForRecord.mockResolvedValue(sources);

      const req = createMockReq({
        method: 'GET',
        params: { recordId: 'rec-1' },
      });
      const res = createMockRes();
      await runRoute('/records/:recordId/sources', 'GET', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(sources);
      expect(mockListSourcesForRecord).toHaveBeenCalledWith(
        'rec-1',
        'org-A',
        expect.objectContaining({ includeArchived: false })
      );
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'GET',
        params: { recordId: 'rec-1' },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/records/:recordId/sources', 'GET', req, res);

      expect(res.statusCode).toBe(401);
      expect(mockListSourcesForRecord).not.toHaveBeenCalled();
    });

    it('missing organization context → 403', async () => {
      const req = createMockReq({
        method: 'GET',
        params: { recordId: 'rec-1' },
        organizationId: undefined,
      });
      const res = createMockRes();
      await runRoute('/records/:recordId/sources', 'GET', req, res);

      expect(res.statusCode).toBe(403);
      expect(mockListSourcesForRecord).not.toHaveBeenCalled();
    });

    it('record in another org (IDOR) → blocked by requireRecordAccess (404)', async () => {
      mockRequireRecordAccess.mockImplementation((_req: any, res: any) => {
        res.status(404).json({ error: 'Record not found' });
      });

      const req = createMockReq({
        method: 'GET',
        params: { recordId: 'rec-in-other-org' },
      });
      const res = createMockRes();
      await runRoute('/records/:recordId/sources', 'GET', req, res);

      expect(res.statusCode).toBe(404);
      expect(mockListSourcesForRecord).not.toHaveBeenCalled();
    });

    it('invalid sourceType query filter → 400', async () => {
      const req = createMockReq({
        method: 'GET',
        params: { recordId: 'rec-1' },
        query: { sourceType: 'not-a-real-type' },
      });
      const res = createMockRes();
      await runRoute('/records/:recordId/sources', 'GET', req, res);

      expect(res.statusCode).toBe(400);
      expect(mockListSourcesForRecord).not.toHaveBeenCalled();
    });
  });

  describe('POST /records/:recordId/sources', () => {
    it('happy path: returns 201 with created source', async () => {
      const created = { id: 'src-new', record_id: 'rec-1', source_type: 'manual' };
      mockCreateSource.mockResolvedValue(created);

      const req = createMockReq({
        method: 'POST',
        params: { recordId: 'rec-1' },
        body: { sourceType: 'manual' },
      });
      const res = createMockRes();
      await runRoute('/records/:recordId/sources', 'POST', req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual(created);
    });

    it('missing sourceType → 400', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { recordId: 'rec-1' },
        body: {},
      });
      const res = createMockRes();
      await runRoute('/records/:recordId/sources', 'POST', req, res);

      expect(res.statusCode).toBe(400);
      expect(mockCreateSource).not.toHaveBeenCalled();
    });

    it('invalid sourceType value → 400', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { recordId: 'rec-1' },
        body: { sourceType: 'hacker_injected_type' },
      });
      const res = createMockRes();
      await runRoute('/records/:recordId/sources', 'POST', req, res);

      expect(res.statusCode).toBe(400);
      expect(mockCreateSource).not.toHaveBeenCalled();
    });

    it('record in another org (IDOR) → blocked by requireRecordAccess', async () => {
      mockRequireRecordAccess.mockImplementation((_req: any, res: any) => {
        res.status(404).json({ error: 'Record not found' });
      });

      const req = createMockReq({
        method: 'POST',
        params: { recordId: 'rec-in-other-org' },
        body: { sourceType: 'manual' },
      });
      const res = createMockRes();
      await runRoute('/records/:recordId/sources', 'POST', req, res);

      expect(res.statusCode).toBe(404);
      expect(mockCreateSource).not.toHaveBeenCalled();
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'POST',
        params: { recordId: 'rec-1' },
        body: { sourceType: 'manual' },
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/records/:recordId/sources', 'POST', req, res);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('PATCH /sources/:sourceId (attachSourceRecord flow)', () => {
    it('happy path: returns 200 with updated source', async () => {
      mockGetSource.mockResolvedValue({ id: 'src-1', record_id: 'rec-1', organization_id: 'org-A' });
      const updated = { id: 'src-1', sourceUri: 'https://new-uri.example.com' };
      mockUpdateSource.mockResolvedValue(updated);

      const req = createMockReq({
        method: 'PATCH',
        params: { sourceId: 'src-1' },
        body: { sourceUri: 'https://new-uri.example.com' },
      });
      const res = createMockRes();
      await runRoute('/sources/:sourceId', 'PATCH', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(updated);
      expect(mockGetSource).toHaveBeenCalledWith('src-1', 'org-A');
    });

    it('source belonging to another org (IDOR) → 404, does not leak existence', async () => {
      // getSource is itself org-scoped (WHERE id=$1 AND organization_id=$2);
      // for a foreign-org source it resolves to null.
      mockGetSource.mockResolvedValue(null);

      const req = createMockReq({
        method: 'PATCH',
        params: { sourceId: 'src-in-other-org' },
        body: { sourceUri: 'https://evil.example.com' },
      });
      const res = createMockRes();
      await runRoute('/sources/:sourceId', 'PATCH', req, res);

      expect(res.statusCode).toBe(404);
      expect(mockUpdateSource).not.toHaveBeenCalled();
    });

    it('invalid sourceMetadata (non-object) → 400', async () => {
      mockGetSource.mockResolvedValue({ id: 'src-1', record_id: 'rec-1', organization_id: 'org-A' });

      const req = createMockReq({
        method: 'PATCH',
        params: { sourceId: 'src-1' },
        body: { sourceMetadata: 'not-an-object' },
      });
      const res = createMockRes();
      await runRoute('/sources/:sourceId', 'PATCH', req, res);

      expect(res.statusCode).toBe(400);
      expect(mockUpdateSource).not.toHaveBeenCalled();
    });

    it('no auth → 401', async () => {
      const req = createMockReq({
        method: 'PATCH',
        params: { sourceId: 'src-1' },
        body: {},
        __noAuth: true,
      });
      const res = createMockRes();
      await runRoute('/sources/:sourceId', 'PATCH', req, res);

      expect(res.statusCode).toBe(401);
      expect(mockGetSource).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /sources/:sourceId', () => {
    it('happy path: returns 200 with archived source', async () => {
      mockGetSource.mockResolvedValue({ id: 'src-1', record_id: 'rec-1', organization_id: 'org-A' });
      const archived = { id: 'src-1', archived_at: '2026-07-04T00:00:00.000Z' };
      mockDeleteSource.mockResolvedValue(archived);

      const req = createMockReq({
        method: 'DELETE',
        params: { sourceId: 'src-1' },
      });
      const res = createMockRes();
      await runRoute('/sources/:sourceId', 'DELETE', req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(archived);
    });

    it('source in another org (IDOR) → 404', async () => {
      mockGetSource.mockResolvedValue(null);

      const req = createMockReq({
        method: 'DELETE',
        params: { sourceId: 'src-in-other-org' },
      });
      const res = createMockRes();
      await runRoute('/sources/:sourceId', 'DELETE', req, res);

      expect(res.statusCode).toBe(404);
      expect(mockDeleteSource).not.toHaveBeenCalled();
    });
  });
});
