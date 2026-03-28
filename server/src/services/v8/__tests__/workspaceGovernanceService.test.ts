import { beforeEach, describe, expect, it, vi } from 'vitest';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true, changes: 1 });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  checkPermission,
  classifyContent,
  getComplianceHistory,
  getContentClassifications,
  getGovernanceDashboard,
  getPermissions,
  getUserRole,
  grantPermission,
  revokePermission,
  runComplianceCheck,
} from '../workspaceGovernanceService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const WORKSPACE_ID = 'ws-workspace-001';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const USER_ID_2 = '00000000-0000-4000-8000-000000000004';
const GRANTER_ID = '00000000-0000-4000-8000-000000000002';
const PERM_ID = '00000000-0000-4000-8000-pppppppppppp';
const SESSION_ID = '00000000-0000-4000-8000-00000000aa01';

function makePermissionRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    permission_id: PERM_ID,
    workspace_id: WORKSPACE_ID,
    organization_id: ORG_ID,
    user_id: USER_ID,
    role: 'editor',
    granted_by: GRANTER_ID,
    granted_at: '2026-03-23T10:00:00.000Z',
    revoked_at: null,
    ...overrides,
  };
}

function makeContentGovRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    record_id: '00000000-0000-4000-8000-cccccccccccc',
    session_id: SESSION_ID,
    organization_id: ORG_ID,
    resource_ref: 'ctx:shared',
    classification: 'internal',
    retention_days: 365,
    classified_by: USER_ID,
    classified_at: '2026-03-23T11:00:00.000Z',
    ...overrides,
  };
}

function makeComplianceRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    check_id: '00000000-0000-4000-8000-kkkkkkkkkkkk',
    session_id: SESSION_ID,
    organization_id: ORG_ID,
    check_type: 'content.classification.present',
    passed: 1,
    details: 'ok',
    checked_at: '2026-03-23T12:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true, changes: 1 });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
});

// ==========================================
// TESTS
// ==========================================

describe('grantPermission', () => {
  it('inserts a workspace permission row', async () => {
    const result = await grantPermission({
      workspaceId: WORKSPACE_ID,
      organizationId: ORG_ID,
      userId: USER_ID,
      role: 'editor',
      grantedBy: GRANTER_ID,
    });

    expect(result.workspaceId).toBe(WORKSPACE_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.userId).toBe(USER_ID);
    expect(result.role).toBe('editor');
    expect(result.grantedBy).toBe(GRANTER_ID);
    expect(result.revokedAt).toBeNull();
    expect(result.permissionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_workspace_permissions');
  });
});

describe('revokePermission', () => {
  it('throws when permission is missing', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(revokePermission(PERM_ID, ORG_ID)).rejects.toThrow('not found');
  });

  it('returns existing row when already revoked', async () => {
    mockDbGet.mockResolvedValueOnce(makePermissionRow({ revoked_at: '2026-03-23T09:00:00.000Z' }));

    const result = await revokePermission(PERM_ID, ORG_ID);

    expect(result.revokedAt).toBe('2026-03-23T09:00:00.000Z');
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('sets revoked_at when active', async () => {
    mockDbGet
      .mockResolvedValueOnce(makePermissionRow())
      .mockResolvedValueOnce(makePermissionRow({ revoked_at: '2026-03-23T15:00:00.000Z' }));

    const result = await revokePermission(PERM_ID, ORG_ID);

    expect(result.revokedAt).toBe('2026-03-23T15:00:00.000Z');
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE v8_workspace_permissions');
  });
});

describe('getPermissions', () => {
  it('returns mapped active permissions', async () => {
    mockDbAll.mockResolvedValueOnce([
      makePermissionRow({ permission_id: '00000000-0000-4000-8000-0000000000a1', role: 'viewer' }),
      makePermissionRow({
        permission_id: '00000000-0000-4000-8000-0000000000a2',
        user_id: USER_ID_2,
        role: 'admin',
      }),
    ]);

    const list = await getPermissions(WORKSPACE_ID, ORG_ID);

    expect(list).toHaveLength(2);
    expect(list[0].role).toBe('viewer');
    expect(list[1].role).toBe('admin');
    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('revoked_at IS NULL');
  });
});

describe('getUserRole', () => {
  it('returns null when no grants', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const role = await getUserRole(WORKSPACE_ID, USER_ID, ORG_ID);
    expect(role).toBeNull();
  });

  it('returns highest role among active grants', async () => {
    mockDbAll.mockResolvedValueOnce([{ role: 'viewer' }, { role: 'admin' }]);

    const role = await getUserRole(WORKSPACE_ID, USER_ID, ORG_ID);
    expect(role).toBe('admin');
  });
});

describe('checkPermission', () => {
  it('returns false when user has no role', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const ok = await checkPermission(WORKSPACE_ID, USER_ID, 'context.read', ORG_ID);
    expect(ok).toBe(false);
  });

  it('allows guest for context.read', async () => {
    mockDbAll.mockResolvedValueOnce([{ role: 'guest' }]);

    const ok = await checkPermission(WORKSPACE_ID, USER_ID, 'context.read', ORG_ID);
    expect(ok).toBe(true);
  });

  it('denies guest for session.create', async () => {
    mockDbAll.mockResolvedValueOnce([{ role: 'guest' }]);

    const ok = await checkPermission(WORKSPACE_ID, USER_ID, 'session.create', ORG_ID);
    expect(ok).toBe(false);
  });

  it('allows editor for session.create', async () => {
    mockDbAll.mockResolvedValueOnce([{ role: 'editor' }]);

    const ok = await checkPermission(WORKSPACE_ID, USER_ID, 'session.create', ORG_ID);
    expect(ok).toBe(true);
  });

  it('allows viewer for decision.vote but not decision.close', async () => {
    mockDbAll.mockResolvedValueOnce([{ role: 'viewer' }]);
    await expect(checkPermission(WORKSPACE_ID, USER_ID, 'decision.vote', ORG_ID)).resolves.toBe(
      true
    );

    mockDbAll.mockResolvedValueOnce([{ role: 'viewer' }]);
    await expect(checkPermission(WORKSPACE_ID, USER_ID, 'decision.close', ORG_ID)).resolves.toBe(
      false
    );
  });
});

describe('classifyContent', () => {
  it('inserts a content governance record', async () => {
    const result = await classifyContent({
      sessionId: SESSION_ID,
      organizationId: ORG_ID,
      resourceRef: 'doc:brief',
      classification: 'confidential',
      retentionDays: 90,
      classifiedBy: USER_ID,
    });

    expect(result.sessionId).toBe(SESSION_ID);
    expect(result.classification).toBe('confidential');
    expect(result.retentionDays).toBe(90);
    expect(mockDbRun.mock.calls[0][0] as string).toContain('INSERT INTO v8_content_governance');
  });
});

describe('getContentClassifications', () => {
  it('returns records for session', async () => {
    mockDbAll.mockResolvedValueOnce([makeContentGovRow()]);

    const rows = await getContentClassifications(SESSION_ID, ORG_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0].resourceRef).toBe('ctx:shared');
  });
});

describe('runComplianceCheck', () => {
  it('throws when session missing', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      runComplianceCheck(SESSION_ID, ORG_ID, 'content.classification.present')
    ).rejects.toThrow('Session');
  });

  it('records fail when no classifications and checkType is content.classification.present', async () => {
    mockDbGet
      .mockResolvedValueOnce({ workspace_id: WORKSPACE_ID })
      .mockResolvedValueOnce({ cnt: 0 });

    const result = await runComplianceCheck(SESSION_ID, ORG_ID, 'content.classification.present');

    expect(result.passed).toBe(false);
    expect(result.details).toContain('No content classification');
    expect(mockDbRun.mock.calls[0][0] as string).toContain('INSERT INTO v8_compliance_checks');
    const params = mockDbRun.mock.calls[0][1] as unknown[];
    expect(params[4]).toBe(0);
  });

  it('records pass when classifications exist', async () => {
    mockDbGet
      .mockResolvedValueOnce({ workspace_id: WORKSPACE_ID })
      .mockResolvedValueOnce({ cnt: 2 });

    const result = await runComplianceCheck(SESSION_ID, ORG_ID, 'content.classification.present');

    expect(result.passed).toBe(true);
    const params = mockDbRun.mock.calls[0][1] as unknown[];
    expect(params[4]).toBe(1);
  });

  it('evaluates workspace.permissions.configured', async () => {
    mockDbGet
      .mockResolvedValueOnce({ workspace_id: WORKSPACE_ID })
      .mockResolvedValueOnce({ cnt: 1 });

    const result = await runComplianceCheck(SESSION_ID, ORG_ID, 'workspace.permissions.configured');

    expect(result.passed).toBe(true);
    expect(result.details).toContain('permission');
  });
});

describe('getComplianceHistory', () => {
  it('returns mapped rows', async () => {
    mockDbAll.mockResolvedValueOnce([makeComplianceRow({ passed: 0 })]);

    const hist = await getComplianceHistory(SESSION_ID, ORG_ID);
    expect(hist).toHaveLength(1);
    expect(hist[0].passed).toBe(false);
  });
});

describe('getGovernanceDashboard', () => {
  it('aggregates permissions, classifications, and compliance rate', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        { role: 'editor', cnt: 2 },
        { role: 'viewer', cnt: 1 },
      ])
      .mockResolvedValueOnce([
        { classification: 'internal', cnt: 3 },
        { classification: 'public', cnt: 1 },
      ]);

    mockDbGet.mockResolvedValueOnce({ passed_sum: 3, total: 4 });

    const dash = await getGovernanceDashboard(WORKSPACE_ID, ORG_ID);

    expect(dash.permissionCountByRole.editor).toBe(2);
    expect(dash.permissionCountByRole.viewer).toBe(1);
    expect(dash.permissionCountByRole.owner).toBe(0);
    expect(dash.contentClassificationCounts.internal).toBe(3);
    expect(dash.contentClassificationCounts.public).toBe(1);
    expect(dash.totalComplianceChecks).toBe(4);
    expect(dash.compliancePassRate).toBeCloseTo(0.75);
  });

  it('returns null pass rate when no compliance checks', async () => {
    mockDbAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockDbGet.mockResolvedValueOnce({ passed_sum: null, total: 0 });

    const dash = await getGovernanceDashboard(WORKSPACE_ID, ORG_ID);

    expect(dash.compliancePassRate).toBeNull();
    expect(dash.totalComplianceChecks).toBe(0);
  });
});
