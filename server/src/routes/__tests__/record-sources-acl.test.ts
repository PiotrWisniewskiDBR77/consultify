/**
 * ACL + dispatch tests for table-platform.record-sources.routes (Block B · EPIC-T8 · S2).
 *
 * Strategy mirrors `template-lifecycle-acl.test.ts`: import the route module
 * with auth/permissions/services mocked, walk the route layer's stack with a
 * minimal req/res harness, and verify status codes + service invocations.
 *
 * Tenancy invariant under test: source-scoped routes (`/sources/:sourceId/...`)
 * resolve the source via `RecordSourcesService.getSource(sourceId, orgId)`. A
 * cross-tenant actor sees a 404 (existence is hidden), and the underlying
 * mutation services are NEVER reached.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListForRecord = vi.fn();
const mockCreateSource = vi.fn();
const mockGetSource = vi.fn();
const mockUpdateSource = vi.fn();
const mockMarkVerified = vi.fn();
const mockDeleteSource = vi.fn();

vi.mock('../../services/tablePlatform/RecordSourcesService.js', () => ({
  default: {
    MAX_SOURCES_PER_RECORD: 50,
    listSourcesForRecord: (...args: unknown[]) => mockListForRecord(...args),
    createSource: (...args: unknown[]) => mockCreateSource(...args),
    getSource: (...args: unknown[]) => mockGetSource(...args),
    updateSource: (...args: unknown[]) => mockUpdateSource(...args),
    markVerified: (...args: unknown[]) => mockMarkVerified(...args),
    deleteSource: (...args: unknown[]) => mockDeleteSource(...args),
  },
}));

// Auth middleware. We don't mount it via router-level `use()` in the tests;
// runFullChain only walks the per-route stack. Provide a no-op shape so the
// router module loads.
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

// Permissions service: requireRecordAccess simulates real behaviour:
//   - 401 if no user
//   - 403 if no organizationId
//   - allows otherwise (we test cross-tenant via the service-side org filter)
vi.mock('../../services/tablePlatform/PermissionsService.js', () => ({
  default: {
    requireRecordAccess: (req: any, res: any, next: any) => {
      if (!req.user || !req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (!req.organizationId) {
        return res.status(403).json({ error: 'Organization context required' });
      }
      return next();
    },
  },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockRes(): any {
  const res: any = { statusCode: 200 };
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

function createMockReq(overrides: Record<string, unknown> = {}): any {
  return {
    method: 'POST',
    params: {},
    body: {},
    query: {},
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  };
}

async function importRouter(): Promise<any> {
  const mod = await import('../table-platform.record-sources.routes.js');
  return mod.default;
}

function findRoute(router: any, method: string, path: string): any {
  return router.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method.toLowerCase()]
  );
}

async function runFullChain(layer: any, req: any, res: any): Promise<void> {
  const handlers = layer.route.stack;
  for (const handler of handlers) {
    let nextCalled = false;
    let nextErr: unknown = null;
    await new Promise<void>((resolve) => {
      const result = handler.handle(req, res, (err?: unknown) => {
        nextCalled = true;
        nextErr = err;
        resolve();
      });
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).then(
          () => {
            if (!nextCalled) resolve();
          },
          () => resolve()
        );
      } else if (!nextCalled) {
        setImmediate(() => resolve());
      }
    });
    if (nextErr) throw nextErr;
    if (!nextCalled) return;
  }
}

const RECORD_ID = 'rec-1';
const SOURCE_ID = 'src-1';
const SAMPLE_SOURCE = {
  id: SOURCE_ID,
  organization_id: 'org-A',
  record_id: RECORD_ID,
  source_type: 'manual',
  source_uri: 'https://example.org/doc',
  source_metadata: {},
  confidence_contribution: 0.7,
  created_by: 'user-A',
  created_at: '2026-05-08T12:00:00.000Z',
  last_verified_at: null,
  last_verified_by: null,
  archived_at: null,
};

function tenantReq(overrides: Record<string, unknown> = {}) {
  return createMockReq({
    userId: 'user-A',
    organizationId: 'org-A',
    user: { id: 'user-A' },
    ...overrides,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Record Sources routes — record-scoped', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListForRecord.mockResolvedValue([SAMPLE_SOURCE]);
    mockCreateSource.mockResolvedValue(SAMPLE_SOURCE);
    mockGetSource.mockResolvedValue(SAMPLE_SOURCE);
    mockUpdateSource.mockResolvedValue(SAMPLE_SOURCE);
    mockMarkVerified.mockResolvedValue({
      ...SAMPLE_SOURCE,
      last_verified_at: '2026-05-08T13:00:00.000Z',
      last_verified_by: 'user-A',
    });
    mockDeleteSource.mockResolvedValue({
      ...SAMPLE_SOURCE,
      archived_at: '2026-05-08T13:00:00.000Z',
    });
  });

  it('GET /records/:recordId/sources — happy path 200, scopes by org', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'get', '/records/:recordId/sources');
    expect(layer).toBeDefined();

    const req = tenantReq({ method: 'GET', params: { recordId: RECORD_ID } });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(200);
    expect(mockListForRecord).toHaveBeenCalledWith(RECORD_ID, 'org-A', {
      includeArchived: false,
      sourceTypes: undefined,
    });
  });

  it('GET /records/:recordId/sources?sourceType=document,manual — passes typed list', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'get', '/records/:recordId/sources');

    const req = tenantReq({
      method: 'GET',
      params: { recordId: RECORD_ID },
      query: { sourceType: 'document,manual' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(200);
    expect(mockListForRecord).toHaveBeenCalledWith(RECORD_ID, 'org-A', {
      includeArchived: false,
      sourceTypes: ['document', 'manual'],
    });
  });

  it('GET /records/:recordId/sources rejects unknown sourceType filter (400)', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'get', '/records/:recordId/sources');

    const req = tenantReq({
      method: 'GET',
      params: { recordId: RECORD_ID },
      query: { sourceType: 'banana' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(400);
    expect(mockListForRecord).not.toHaveBeenCalled();
  });

  it('POST /records/:recordId/sources — 201 with valid body', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/records/:recordId/sources');
    expect(layer).toBeDefined();

    const req = tenantReq({
      params: { recordId: RECORD_ID },
      body: {
        sourceType: 'manual',
        sourceUri: 'https://example.org/doc',
        sourceMetadata: { kind: 'note' },
        confidenceContribution: 0.7,
      },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(201);
    expect(mockCreateSource).toHaveBeenCalledWith({
      recordId: RECORD_ID,
      organizationId: 'org-A',
      sourceType: 'manual',
      sourceUri: 'https://example.org/doc',
      sourceMetadata: { kind: 'note' },
      confidenceContribution: 0.7,
      createdBy: 'user-A',
    });
  });

  it('POST /records/:recordId/sources — invalid sourceType returns 400 without calling service', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/records/:recordId/sources');

    const req = tenantReq({
      params: { recordId: RECORD_ID },
      body: { sourceType: 'banana' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(400);
    expect(mockCreateSource).not.toHaveBeenCalled();
  });

  it('POST /records/:recordId/sources — RECORD_SOURCES_CAP_EXCEEDED maps to 409', async () => {
    mockCreateSource.mockRejectedValueOnce(
      Object.assign(new Error('cap 50 exceeded'), { code: 'RECORD_SOURCES_CAP_EXCEEDED' })
    );
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/records/:recordId/sources');

    const req = tenantReq({
      params: { recordId: RECORD_ID },
      body: { sourceType: 'manual' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(409);
  });

  it('POST /records/:recordId/sources — RECORD_NOT_FOUND maps to 404 (cross-tenant)', async () => {
    mockCreateSource.mockRejectedValueOnce(
      Object.assign(new Error('Record not found'), { code: 'RECORD_NOT_FOUND' })
    );
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/records/:recordId/sources');

    const req = tenantReq({
      params: { recordId: RECORD_ID },
      body: { sourceType: 'manual' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(404);
  });

  it('record-scoped GET — missing organizationId returns 403 (org guard)', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'get', '/records/:recordId/sources');

    const req = createMockReq({
      method: 'GET',
      userId: 'user-A',
      user: { id: 'user-A' },
      params: { recordId: RECORD_ID },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(403);
    expect(mockListForRecord).not.toHaveBeenCalled();
  });
});

describe('Record Sources routes — source-scoped (cross-tenant 404)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSource.mockResolvedValue(SAMPLE_SOURCE);
    mockUpdateSource.mockResolvedValue(SAMPLE_SOURCE);
    mockMarkVerified.mockResolvedValue(SAMPLE_SOURCE);
    mockDeleteSource.mockResolvedValue({
      ...SAMPLE_SOURCE,
      archived_at: '2026-05-08T13:00:00.000Z',
    });
  });

  it('PATCH /sources/:sourceId — happy path 200', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'patch', '/sources/:sourceId');
    expect(layer).toBeDefined();

    const req = tenantReq({
      method: 'PATCH',
      params: { sourceId: SOURCE_ID },
      body: { sourceUri: 'https://example.org/doc-v2' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(200);
    expect(mockUpdateSource).toHaveBeenCalledWith(SOURCE_ID, 'org-A', 'user-A', {
      sourceUri: 'https://example.org/doc-v2',
    });
  });

  it('PATCH /sources/:sourceId — cross-tenant 404 (getSource returns null)', async () => {
    mockGetSource.mockResolvedValueOnce(null);
    const router = await importRouter();
    const layer = findRoute(router, 'patch', '/sources/:sourceId');

    const req = tenantReq({
      method: 'PATCH',
      params: { sourceId: SOURCE_ID },
      body: { sourceUri: 'x' },
      organizationId: 'org-B',
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(404);
    expect(mockUpdateSource).not.toHaveBeenCalled();
  });

  it('PATCH /sources/:sourceId — out-of-range confidence returns 400 (no service call)', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'patch', '/sources/:sourceId');

    const req = tenantReq({
      method: 'PATCH',
      params: { sourceId: SOURCE_ID },
      body: { confidenceContribution: 'not-a-number' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(400);
    expect(mockUpdateSource).not.toHaveBeenCalled();
  });

  it('POST /sources/:sourceId/verify — happy path 200, audits via markVerified', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/sources/:sourceId/verify');
    expect(layer).toBeDefined();

    const req = tenantReq({
      params: { sourceId: SOURCE_ID },
      body: {},
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(200);
    expect(mockMarkVerified).toHaveBeenCalledWith(SOURCE_ID, 'org-A', 'user-A');
  });

  it('POST /sources/:sourceId/verify — cross-tenant 404 (getSource returns null)', async () => {
    mockGetSource.mockResolvedValueOnce(null);
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/sources/:sourceId/verify');

    const req = tenantReq({
      params: { sourceId: SOURCE_ID },
      body: {},
      organizationId: 'org-B',
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(404);
    expect(mockMarkVerified).not.toHaveBeenCalled();
  });

  it('DELETE /sources/:sourceId — soft-delete 200, returns archived row', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'delete', '/sources/:sourceId');
    expect(layer).toBeDefined();

    const req = tenantReq({
      method: 'DELETE',
      params: { sourceId: SOURCE_ID },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(200);
    expect(mockDeleteSource).toHaveBeenCalledWith(SOURCE_ID, 'org-A', 'user-A');
    expect(res.body.archived_at).toBe('2026-05-08T13:00:00.000Z');
  });

  it('DELETE /sources/:sourceId — cross-tenant 404 (getSource returns null)', async () => {
    mockGetSource.mockResolvedValueOnce(null);
    const router = await importRouter();
    const layer = findRoute(router, 'delete', '/sources/:sourceId');

    const req = tenantReq({
      method: 'DELETE',
      params: { sourceId: SOURCE_ID },
      organizationId: 'org-B',
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    expect(res.statusCode).toBe(404);
    expect(mockDeleteSource).not.toHaveBeenCalled();
  });
});
