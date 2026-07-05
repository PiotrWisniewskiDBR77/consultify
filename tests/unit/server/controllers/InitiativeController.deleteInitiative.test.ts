import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn(),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  getTableColumns: undefined,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { InitiativeController } from '../../../../server/src/controllers/InitiativeController.js';

function createRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

const OWNER = 'user-owner';
const ORG = 'org-1';

function existingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'init-1',
    status: 'DRAFT',
    owner_business_id: OWNER,
    owner_execution_id: null,
    sponsor_id: null,
    created_by: OWNER,
    ...overrides,
  };
}

describe('InitiativeController.deleteInitiative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRun.mockResolvedValue(undefined);
  });

  it('401 when organization is missing', async () => {
    const req: any = { user: null, params: { id: 'init-1' } };
    const res = createRes();
    await InitiativeController.deleteInitiative(req, res as any, vi.fn() as any);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it('404 when the initiative does not resolve in the caller org (cross-org indistinguishable)', async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const req: any = {
      user: { id: OWNER, organizationId: ORG, role: 'ADMIN' },
      params: { id: 'init-x' },
    };
    const res = createRes();
    await InitiativeController.deleteInitiative(req, res as any, vi.fn() as any);
    expect(res.status).toHaveBeenCalledWith(404);
    // org-scoped SELECT: id + orgId bound
    expect(mockQueryOne).toHaveBeenCalledWith(expect.any(String), ['init-x', ORG]);
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('403 when the caller is neither owner nor admin', async () => {
    mockQueryOne.mockResolvedValueOnce(
      existingRow({ owner_business_id: 'someone-else', created_by: 'someone-else' })
    );
    const req: any = {
      user: { id: 'random-user', organizationId: ORG, role: 'USER' },
      params: { id: 'init-1' },
    };
    const res = createRes();
    await InitiativeController.deleteInitiative(req, res as any, vi.fn() as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INITIATIVE_DELETE_FORBIDDEN' })
    );
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('409 when the initiative is in an active status (EXECUTING)', async () => {
    mockQueryOne.mockResolvedValueOnce(existingRow({ status: 'EXECUTING' }));
    const req: any = {
      user: { id: OWNER, organizationId: ORG, role: 'USER' },
      params: { id: 'init-1' },
    };
    const res = createRes();
    await InitiativeController.deleteInitiative(req, res as any, vi.fn() as any);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INITIATIVE_DELETE_INVALID_STATE', status: 'EXECUTING' })
    );
    // no destructive query ran
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('409 for APPROVED as well (not just EXECUTING)', async () => {
    mockQueryOne.mockResolvedValueOnce(existingRow({ status: 'APPROVED' }));
    const req: any = {
      user: { id: OWNER, organizationId: ORG, role: 'OWNER' },
      params: { id: 'init-1' },
    };
    const res = createRes();
    await InitiativeController.deleteInitiative(req, res as any, vi.fn() as any);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('deletes a DRAFT owned by the caller (org-scoped hard delete)', async () => {
    mockQueryOne.mockResolvedValueOnce(existingRow({ status: 'DRAFT' }));
    const req: any = {
      user: { id: OWNER, organizationId: ORG, role: 'USER' },
      params: { id: 'init-1' },
    };
    const res = createRes();
    await InitiativeController.deleteInitiative(req, res as any, vi.fn() as any);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, initiativeId: 'init-1' })
    );
    // the final delete is org-scoped
    const deleteCall = mockQueryRun.mock.calls.find((c) =>
      String(c[0]).includes('DELETE FROM initiatives')
    );
    expect(deleteCall).toBeTruthy();
    expect(deleteCall?.[1]).toEqual(['init-1', ORG]);
  });

  it('deletes a CANCELLED initiative for an org admin who is not the owner', async () => {
    mockQueryOne.mockResolvedValueOnce(
      existingRow({ status: 'CANCELLED', owner_business_id: 'other', created_by: 'other' })
    );
    const req: any = {
      user: { id: 'admin-user', organizationId: ORG, role: 'ADMIN' },
      params: { id: 'init-1' },
    };
    const res = createRes();
    await InitiativeController.deleteInitiative(req, res as any, vi.fn() as any);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });
});
