import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateBase = vi.fn();
const mockGetBase = vi.fn();
const mockUpdateBase = vi.fn();
const mockDeleteBase = vi.fn();
const mockCreateTable = vi.fn();
const mockCreateField = vi.fn();
const mockCreateRecord = vi.fn();
const mockListRecords = vi.fn();
const mockGetRecord = vi.fn();
const mockDeleteField = vi.fn();
const mockUpdateView = vi.fn();
const mockLockView = vi.fn();
const mockUnlockView = vi.fn();
const mockGetUserRole = vi.fn();
const mockCanAccessBase = vi.fn();

vi.mock('../../services/tablePlatform/MetadataService.js', () => ({
  default: {
    createBase: (...args: unknown[]) => mockCreateBase(...args),
    getBase: (...args: unknown[]) => mockGetBase(...args),
    updateBase: (...args: unknown[]) => mockUpdateBase(...args),
    deleteBase: (...args: unknown[]) => mockDeleteBase(...args),
    createTable: (...args: unknown[]) => mockCreateTable(...args),
    createField: (...args: unknown[]) => mockCreateField(...args),
    deleteField: (...args: unknown[]) => mockDeleteField(...args),
    updateView: (...args: unknown[]) => mockUpdateView(...args),
    lockView: (...args: unknown[]) => mockLockView(...args),
    unlockView: (...args: unknown[]) => mockUnlockView(...args),
  },
}));

vi.mock('../../services/tablePlatform/RecordsService.js', () => ({
  default: {
    createRecord: (...args: unknown[]) => mockCreateRecord(...args),
    listRecords: (...args: unknown[]) => mockListRecords(...args),
    getRecord: (...args: unknown[]) => mockGetRecord(...args),
    deleteRecord: vi.fn(),
    updateRecord: vi.fn(),
  },
}));

vi.mock('../../services/tablePlatform/PermissionsService.js', () => ({
  default: {
    requireBaseAccess: (_req: any, _res: any, next: () => void) => next(),
    requireTableAccess: (_req: any, _res: any, next: () => void) => next(),
    requireFieldAccess: (_req: any, _res: any, next: () => void) => next(),
    requireRecordAccess: (_req: any, _res: any, next: () => void) => next(),
    requireViewAccess: (_req: any, _res: any, next: () => void) => next(),
    getUserRole: (...args: unknown[]) => mockGetUserRole(...args),
    canAccessBase: (...args: unknown[]) => mockCanAccessBase(...args),
    requireRoles: (...roles: string[]) => {
      return async (req: any, res: any, next: () => void) => {
        const userId = req.userId;
        const orgId = req.organizationId;
        const baseId = req.params?.baseId || 'base-1';

        const role: string | null = await mockGetUserRole(baseId, userId);
        if (role) {
          if (roles.includes(role)) {
            (req as any).userRole = role;
            next();
          } else {
            res.status(403).json({
              error: `Access denied. Required roles: ${roles.join(', ')}. Current role: ${role}`,
            });
          }
        } else {
          const hasLegacy: boolean = await mockCanAccessBase(userId, orgId, baseId);
          if (hasLegacy) {
            (req as any).userRole = 'base_owner';
            next();
          } else {
            res.status(403).json({
              error: `Access denied. Required roles: ${roles.join(', ')}. Current role: none`,
            });
          }
        }
      };
    },
    SCHEMA_ROLES: ['base_owner', 'schema_editor'] as const,
    DATA_ROLES: ['base_owner', 'schema_editor', 'data_editor'] as const,
    VIEW_ROLES: ['base_owner', 'schema_editor', 'view_editor'] as const,
    INTERFACE_ROLES: ['base_owner', 'schema_editor', 'interface_builder'] as const,
    ALL_ROLES: [
      'base_owner',
      'schema_editor',
      'data_editor',
      'view_editor',
      'interface_builder',
      'viewer',
      'form_submitter',
    ] as const,
  },
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../config/FeatureFlags.js', () => ({
  featureFlags: { ENABLE_TABLE_PLATFORM_RECORDS_API: true },
}));

vi.mock('../../services/tablePlatform/ErrorHandling.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/tablePlatform/ErrorHandling.js')
  >('../../services/tablePlatform/ErrorHandling.js');
  return actual;
});

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }),
}));

function createMockReq(overrides: Record<string, unknown> = {}): any {
  return {
    params: {},
    body: {},
    query: {},
    userId: 'user-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

function createMockRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

async function importRouter() {
  const mod = await import('../../routes/table-platform.routes.js');
  return mod.default;
}

async function runMiddlewareChain(handlers: any[], req: any, res: any): Promise<void> {
  for (const handler of handlers) {
    let nextCalled = false;
    await handler.handle(req, res, () => {
      nextCalled = true;
    });
    if (!nextCalled) return;
  }
}

describe('Table Platform Routes — handler logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. POST /bases → 201 with base
  it('POST /bases returns 201 with created base', async () => {
    const base = { id: 'b-1', name: 'Test Base' };
    mockCreateBase.mockResolvedValue(base);

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/bases' && l.route?.methods?.post
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      body: { workspaceId: 'ws-1', name: 'Test Base' },
    });
    const res = createMockRes();
    await layer!.route!.stack[0].handle(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(base);
  });

  // 2. GET /bases/:id → 200 with base
  it('GET /bases/:baseId returns 200 with base', async () => {
    const base = { id: 'b-1', name: 'Base', tables: [] };
    mockGetBase.mockResolvedValue(base);

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/bases/:baseId' && l.route?.methods?.get
    );
    expect(layer).toBeDefined();

    const req = createMockReq({ params: { baseId: 'b-1' } });
    const res = createMockRes();
    const handlers = layer!.route!.stack;
    await handlers[handlers.length - 1].handle(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(base);
  });

  // 3. POST /bases/:id/tables → 201 with table
  it('POST /bases/:baseId/tables returns 201 with table', async () => {
    const table = { id: 't-1', name: 'Tasks', base_id: 'b-1' };
    mockCreateTable.mockResolvedValue(table);

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/bases/:baseId/tables' && l.route?.methods?.post
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { baseId: 'b-1' },
      body: { name: 'Tasks' },
    });
    const res = createMockRes();
    const handlers = layer!.route!.stack;
    await handlers[handlers.length - 1].handle(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(table);
  });

  // 4. POST /tables/:id/fields → 201 with field
  it('POST /tables/:tableId/fields returns 201 with field', async () => {
    const field = { id: 'f-1', name: 'Status', field_type: 'singleSelect' };
    mockCreateField.mockResolvedValue(field);

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/tables/:tableId/fields' && l.route?.methods?.post
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { tableId: 't-1' },
      body: { name: 'Status', fieldType: 'singleSelect' },
    });
    const res = createMockRes();
    const handlers = layer!.route!.stack;
    await handlers[handlers.length - 1].handle(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(field);
  });

  // 5. POST /tables/:id/records → 201 with record
  it('POST /tables/:tableId/records returns 201 with record', async () => {
    const record = { id: 'r-1', table_id: 't-1', data: { Name: 'Test' } };
    mockCreateRecord.mockResolvedValue(record);

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/tables/:tableId/records' && l.route?.methods?.post
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { tableId: 't-1' },
      body: { data: { Name: 'Test' } },
    });
    const res = createMockRes();
    const handlers = layer!.route!.stack;
    await handlers[handlers.length - 1].handle(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(record);
  });

  // 6. GET /tables/:id/records → 200 with records array
  it('GET /tables/:tableId/records returns 200 with records', async () => {
    const listResult = { records: [{ id: 'r-1' }], total: 1, hasMore: false };
    mockListRecords.mockResolvedValue(listResult);

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/tables/:tableId/records' && l.route?.methods?.get
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { tableId: 't-1' },
      query: {},
    });
    const res = createMockRes();
    const handlers = layer!.route!.stack;
    await handlers[handlers.length - 1].handle(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(listResult);
  });

  // 7. POST /tables/:id/records/query → 200 (tested via route existence)
  it('POST /tables/:tableId/records/query route exists', async () => {
    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/tables/:tableId/records/query' && l.route?.methods?.post
    );
    expect(layer).toBeDefined();
  });

  // 8. PATCH /bases/:id → 200
  it('PATCH /bases/:baseId returns 200 with updated base', async () => {
    const base = { id: 'b-1', name: 'Updated' };
    mockUpdateBase.mockResolvedValue(base);

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/bases/:baseId' && l.route?.methods?.patch
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { baseId: 'b-1' },
      body: { name: 'Updated' },
    });
    const res = createMockRes();
    const handlers = layer!.route!.stack;
    await handlers[handlers.length - 1].handle(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(base);
  });

  // 9. DELETE /bases/:id → 204
  it('DELETE /bases/:baseId returns 204', async () => {
    mockDeleteBase.mockResolvedValue(true);

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/bases/:baseId' && l.route?.methods?.delete
    );
    expect(layer).toBeDefined();

    const req = createMockReq({ params: { baseId: 'b-1' } });
    const res = createMockRes();
    const handlers = layer!.route!.stack;
    await handlers[handlers.length - 1].handle(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  // 10. Invalid base ID → 404
  it('GET /bases/:baseId returns 404 for nonexistent base', async () => {
    mockGetBase.mockResolvedValue(null);

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/bases/:baseId' && l.route?.methods?.get
    );

    const req = createMockReq({ params: { baseId: 'nonexistent' } });
    const res = createMockRes();
    const handlers = layer!.route!.stack;
    await handlers[handlers.length - 1].handle(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ── Part 1: Role-based access control ─────────────────────────────────────────

describe('Role-based access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserRole.mockReset();
    mockCanAccessBase.mockReset();
  });

  it('denies schema edit (create field) for viewer role', async () => {
    mockGetUserRole.mockResolvedValue('viewer');

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/tables/:tableId/fields' && l.route?.methods?.post
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { tableId: 't-1' },
      body: { name: 'NewField', fieldType: 'singleLineText' },
    });
    const res = createMockRes();
    await runMiddlewareChain(layer!.route!.stack, req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('viewer') })
    );
  });

  it('denies schema edit (delete field) for data_editor role', async () => {
    mockGetUserRole.mockResolvedValue('data_editor');

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/fields/:fieldId' && l.route?.methods?.delete
    );
    expect(layer).toBeDefined();

    const req = createMockReq({ params: { fieldId: 'f-1' } });
    const res = createMockRes();
    await runMiddlewareChain(layer!.route!.stack, req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('data_editor') })
    );
  });

  it('allows schema edit for schema_editor role', async () => {
    mockGetUserRole.mockResolvedValue('schema_editor');
    const field = { id: 'f-new', name: 'Status', field_type: 'singleSelect' };
    mockCreateField.mockResolvedValue(field);

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/tables/:tableId/fields' && l.route?.methods?.post
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { tableId: 't-1' },
      body: { name: 'Status', fieldType: 'singleSelect' },
    });
    const res = createMockRes();
    await runMiddlewareChain(layer!.route!.stack, req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(field);
  });

  it('denies record create for form_submitter role', async () => {
    mockGetUserRole.mockResolvedValue('form_submitter');

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/tables/:tableId/records' && l.route?.methods?.post
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { tableId: 't-1' },
      body: { data: { Name: 'Test' } },
    });
    const res = createMockRes();
    await runMiddlewareChain(layer!.route!.stack, req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('form_submitter') })
    );
  });

  it('allows record create for data_editor role', async () => {
    mockGetUserRole.mockResolvedValue('data_editor');
    const record = { id: 'r-new', table_id: 't-1', data: { Name: 'New' } };
    mockCreateRecord.mockResolvedValue(record);

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/tables/:tableId/records' && l.route?.methods?.post
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { tableId: 't-1' },
      body: { data: { Name: 'New' } },
    });
    const res = createMockRes();
    await runMiddlewareChain(layer!.route!.stack, req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(record);
  });

  it('denies view edit for viewer role', async () => {
    mockGetUserRole.mockResolvedValue('viewer');

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/views/:viewId' && l.route?.methods?.patch
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { viewId: 'v-1' },
      body: { name: 'Renamed View' },
    });
    const res = createMockRes();
    await runMiddlewareChain(layer!.route!.stack, req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('viewer') })
    );
  });

  it('allows view edit for view_editor role', async () => {
    mockGetUserRole.mockResolvedValue('view_editor');
    const view = { id: 'v-1', name: 'Renamed', view_type: 'grid' };
    mockUpdateView.mockResolvedValue(view);

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/views/:viewId' && l.route?.methods?.patch
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { viewId: 'v-1' },
      body: { name: 'Renamed' },
    });
    const res = createMockRes();
    await runMiddlewareChain(layer!.route!.stack, req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(view);
  });

  it('denies interface edit for data_editor role', async () => {
    mockGetUserRole.mockResolvedValue('data_editor');

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/interfaces/:interfaceId/layout' && l.route?.methods?.put
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { interfaceId: 'iface-1' },
      body: { blocks: [], theme: {} },
    });
    const res = createMockRes();
    await runMiddlewareChain(layer!.route!.stack, req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('data_editor') })
    );
  });

  it('falls back to legacy check when user has no tp_base_members entry', async () => {
    mockGetUserRole.mockResolvedValue(null);
    mockCanAccessBase.mockResolvedValue(true);
    const field = { id: 'f-legacy', name: 'LegacyField', field_type: 'singleLineText' };
    mockCreateField.mockResolvedValue(field);

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/tables/:tableId/fields' && l.route?.methods?.post
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { tableId: 't-1' },
      body: { name: 'LegacyField', fieldType: 'singleLineText' },
    });
    const res = createMockRes();
    await runMiddlewareChain(layer!.route!.stack, req, res);

    expect(mockCanAccessBase).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(field);
  });
});

// ── Part 2: View/Interface locks ──────────────────────────────────────────────

describe('View/Interface locks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserRole.mockResolvedValue('view_editor');
  });

  it('prevents editing a locked view', async () => {
    const { PermissionError } = await import('../../services/tablePlatform/ErrorHandling.js');
    mockUpdateView.mockRejectedValue(
      new PermissionError('View is locked by user user-2. Unlock it before editing.')
    );

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/views/:viewId' && l.route?.methods?.patch
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { viewId: 'v-locked' },
      body: { name: 'Attempt rename' },
    });
    const res = createMockRes();
    await runMiddlewareChain(layer!.route!.stack, req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('View is locked') })
    );
  });

  it('allows locking a view', async () => {
    mockLockView.mockResolvedValue(undefined);

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/views/:viewId/lock' && l.route?.methods?.post
    );
    expect(layer).toBeDefined();

    const req = createMockReq({ params: { viewId: 'v-1' } });
    const res = createMockRes();
    await runMiddlewareChain(layer!.route!.stack, req, res);

    expect(mockLockView).toHaveBeenCalledWith('v-1', 'user-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('prevents unlocking by a different user', async () => {
    const { PermissionError } = await import('../../services/tablePlatform/ErrorHandling.js');
    mockUnlockView.mockRejectedValue(
      new PermissionError('Only the user who locked this view can unlock it.')
    );

    const router = await importRouter();
    const layer = router.stack.find(
      (l: any) => l.route?.path === '/views/:viewId/unlock' && l.route?.methods?.post
    );
    expect(layer).toBeDefined();

    const req = createMockReq({
      params: { viewId: 'v-locked' },
      userId: 'user-other',
    });
    const res = createMockRes();
    await runMiddlewareChain(layer!.route!.stack, req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Only the user who locked this view can unlock it'),
      })
    );
  });
});
