import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSharedView = vi.fn();
const mockVerifySharePassword = vi.fn();
const mockExecuteQuery = vi.fn();
const mockResolveView = vi.fn();
const mockDbQuery = vi.fn();

vi.mock('../../services/tablePlatform/MetadataService.js', () => ({
  default: {
    getSharedView: (...args: unknown[]) => mockGetSharedView(...args),
    verifySharePassword: (...args: unknown[]) => mockVerifySharePassword(...args),
  },
}));

vi.mock('../../services/tablePlatform/ViewQueryEngine.js', () => ({
  default: {
    executeQuery: (...args: unknown[]) => mockExecuteQuery(...args),
  },
  resolveView: (...args: unknown[]) => mockResolveView(...args),
}));

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({ query: (...args: unknown[]) => mockDbQuery(...args) }),
}));

vi.mock('../../services/tablePlatform/PermissionsService.js', () => ({
  default: {
    requireBaseAccess: (_req: any, _res: any, next: () => void) => next(),
    requireTableAccess: (_req: any, _res: any, next: () => void) => next(),
    requireFieldAccess: (_req: any, _res: any, next: () => void) => next(),
    requireRecordAccess: (_req: any, _res: any, next: () => void) => next(),
    requireViewAccess: (_req: any, _res: any, next: () => void) => next(),
    getUserRole: vi.fn(),
    canAccessBase: vi.fn(),
    requireRoles: () => (_req: any, _res: any, next: () => void) => next(),
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
    requireGovernedModelAccess: (_req: any, _res: any, next: () => void) => next(),
  },
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: () => void) => next(),
  requireSuperAdmin: (_req: any, _res: any, next: () => void) => next(),
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

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockReq(overrides: Record<string, unknown> = {}): any {
  return {
    params: {},
    body: {},
    query: {},
    headers: {},
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

async function importPublicFormRouter() {
  const mod = await import('../../routes/table-platform.routes.js');
  return mod.publicFormRouter;
}

function findLayer(router: any, path: string, method: 'get' | 'post') {
  return router.stack.find((l: any) => l.route?.path === path && l.route?.methods?.[method]);
}

async function callRecordsRoute(req: any, res: any) {
  const router = await importPublicFormRouter();
  const layer = findLayer(router, '/public/views/:token/records', 'get');
  expect(layer).toBeDefined();
  const handlers = layer!.route!.stack;
  await handlers[handlers.length - 1].handle(req, res, vi.fn());
}

const TABLE_FIELDS = [
  { id: 'fld-name', name: 'Name', field_type: 'singleLineText' },
  { id: 'fld-status', name: 'Status', field_type: 'singleSelect' },
  { id: 'fld-secret', name: 'Internal Notes', field_type: 'longText' },
];

const BASE_VIEW_DATA = {
  viewId: 'view-1',
  tableId: 'table-1',
  viewName: 'Shared Grid',
  viewType: 'grid',
  config: {},
  tableName: 'Projects',
  fields: TABLE_FIELDS,
  hasPassword: false,
  _sharePassword: null,
};

describe('publicFormRouter GET /public/views/:token/records', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQuery.mockResolvedValue({ rows: TABLE_FIELDS });
  });

  it('returns 404 when the shared view does not exist or is expired', async () => {
    mockGetSharedView.mockResolvedValue(null);

    const req = createMockReq({ params: { token: 'nonexistent-token' } });
    const res = createMockRes();
    await callRecordsRoute(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('not found') })
    );
    expect(mockExecuteQuery).not.toHaveBeenCalled();
  });

  it('requires a password and does not leak records when none/incorrect is provided', async () => {
    mockGetSharedView.mockResolvedValue({ ...BASE_VIEW_DATA, _sharePassword: 'hashed-pw' });
    mockVerifySharePassword.mockResolvedValue(false);

    const req = createMockReq({ params: { token: 'protected-token' } });
    const res = createMockRes();
    await callRecordsRoute(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VIEW_PASSWORD_REQUIRED' })
    );
    expect(mockExecuteQuery).not.toHaveBeenCalled();

    // Wrong password behaves identically to no password: still gated, still no data.
    mockVerifySharePassword.mockResolvedValue(false);
    const req2 = createMockReq({
      params: { token: 'protected-token' },
      headers: { 'x-share-password': 'wrong-pw' },
    });
    const res2 = createMockRes();
    await callRecordsRoute(req2, res2);

    expect(res2.status).toHaveBeenCalledWith(401);
    expect(mockExecuteQuery).not.toHaveBeenCalled();
  });

  it('grants access once the correct password is supplied', async () => {
    mockGetSharedView.mockResolvedValue({ ...BASE_VIEW_DATA, _sharePassword: 'hashed-pw' });
    mockVerifySharePassword.mockResolvedValue(true);
    mockResolveView.mockResolvedValue({ fields: ['fld-name', 'fld-status'] });
    mockExecuteQuery.mockResolvedValue({
      records: [{ id: 'r-1', data: { 'fld-name': 'Alpha', 'fld-status': 'Open' } }],
      total: 1,
      hasMore: false,
    });

    const req = createMockReq({
      params: { token: 'protected-token' },
      headers: { 'x-share-password': 'correct-pw' },
    });
    const res = createMockRes();
    await callRecordsRoute(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        records: [{ id: 'r-1', data: { 'fld-name': 'Alpha', 'fld-status': 'Open' } }],
      })
    );
  });

  it('applies the view filter config so only matching records come back (via ViewQueryEngine)', async () => {
    mockGetSharedView.mockResolvedValue(BASE_VIEW_DATA);
    // Simulate a view configured with a filter (status = Open). ViewQueryEngine
    // is the one applying it against the DB — the route's job is to make sure
    // it's actually invoked with the view's fields/viewId, which we assert on.
    mockResolveView.mockResolvedValue({
      filters: { logic: 'and', rules: [{ fieldId: 'fld-status', operator: 'equals', value: 'Open' }] },
      fields: ['fld-name', 'fld-status'],
    });
    mockExecuteQuery.mockResolvedValue({
      records: [{ id: 'r-1', data: { 'fld-name': 'Alpha', 'fld-status': 'Open' } }],
      total: 1,
      hasMore: false,
    });

    const req = createMockReq({ params: { token: 'filtered-token' } });
    const res = createMockRes();
    await callRecordsRoute(req, res);

    expect(mockExecuteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'table-1',
        viewId: 'view-1',
        fields: ['fld-name', 'fld-status'],
      })
    );
    // No userRole should ever be threaded through on the public route.
    const callArgs = mockExecuteQuery.mock.calls[0][0];
    expect(callArgs.userRole).toBeUndefined();

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.records).toEqual([
      { id: 'r-1', data: { 'fld-name': 'Alpha', 'fld-status': 'Open' } },
    ]);
  });

  it('never returns a hidden field even if the underlying query result includes it', async () => {
    mockGetSharedView.mockResolvedValue(BASE_VIEW_DATA);
    // View only exposes Name + Status; "Internal Notes" (fld-secret) is hidden.
    mockResolveView.mockResolvedValue({ fields: ['fld-name', 'fld-status'] });
    // Simulate the engine (or its grouped-query code path) leaking the raw
    // r.data column alongside the projection — the route must still strip it.
    mockExecuteQuery.mockResolvedValue({
      records: [
        {
          id: 'r-1',
          data: {
            'fld-name': 'Alpha',
            'fld-status': 'Open',
            'fld-secret': 'Do not leak this',
          },
        },
      ],
      total: 1,
      hasMore: false,
    });

    const req = createMockReq({ params: { token: 'hidden-field-token' } });
    const res = createMockRes();
    await callRecordsRoute(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.records).toHaveLength(1);
    expect(payload.records[0].data).toEqual({ 'fld-name': 'Alpha', 'fld-status': 'Open' });
    expect(payload.records[0].data).not.toHaveProperty('fld-secret');
    // The returned field metadata list must also omit the hidden field.
    expect(payload.fields.map((f: any) => f.id)).toEqual(['fld-name', 'fld-status']);
    expect(payload.fields.find((f: any) => f.id === 'fld-secret')).toBeUndefined();
  });

  it('strips hidden fields from grouped results too (defense against ViewQueryEngine group-path leak)', async () => {
    mockGetSharedView.mockResolvedValue(BASE_VIEW_DATA);
    mockResolveView.mockResolvedValue({ fields: ['fld-name'], groupBy: 'fld-status' });
    mockExecuteQuery.mockResolvedValue({
      records: [],
      total: 1,
      hasMore: false,
      groups: [
        {
          value: 'Open',
          count: 1,
          records: [
            {
              id: 'r-1',
              data: { 'fld-name': 'Alpha', 'fld-status': 'Open', 'fld-secret': 'leak me not' },
            },
          ],
        },
      ],
    });

    const req = createMockReq({ params: { token: 'grouped-token' } });
    const res = createMockRes();
    await callRecordsRoute(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.groups[0].records[0].data).toEqual({ 'fld-name': 'Alpha' });
    expect(payload.groups[0].records[0].data).not.toHaveProperty('fld-secret');
    expect(payload.groups[0].records[0].data).not.toHaveProperty('fld-status');
  });

  it('falls back to all table fields when the view has no visible-fields restriction configured', async () => {
    mockGetSharedView.mockResolvedValue(BASE_VIEW_DATA);
    mockResolveView.mockResolvedValue({ fields: undefined });
    mockExecuteQuery.mockResolvedValue({
      records: [
        {
          id: 'r-1',
          data: { 'fld-name': 'Alpha', 'fld-status': 'Open', 'fld-secret': 'visible by design' },
        },
      ],
      total: 1,
      hasMore: false,
    });

    const req = createMockReq({ params: { token: 'unrestricted-token' } });
    const res = createMockRes();
    await callRecordsRoute(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.records[0].data).toEqual({
      'fld-name': 'Alpha',
      'fld-status': 'Open',
      'fld-secret': 'visible by design',
    });
    expect(payload.fields).toHaveLength(3);
  });
});
