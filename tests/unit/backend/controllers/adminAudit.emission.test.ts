/**
 * Admin audit emission on real admin actions (H2.12 / BUG A) — CI-collected copy.
 *
 * Proves the M24 Admin surfaces emit an audit entry and that emission is
 * fail-safe (a throwing audit service must not block the membership mutation).
 *
 * NOTE: lives under tests/ (not server/src/**\/__tests__) because CI only
 * collects tests/unit|integration|components.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OrganizationController from '../../../../server/src/controllers/OrganizationController.ts';

const dbGet = vi.fn();
const getMembers = vi.fn();
const updateMemberRole = vi.fn();
const removeMember = vi.fn();
const logAction = vi.fn();

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
}));

vi.mock('../../../../server/src/services/adminAuditService.js', () => ({
  default: {
    logAction: (...args: any[]) => logAction(...args),
  },
}));

vi.mock('../../../../server/src/services/organizationService.js', () => ({
  getMembers: (...args: any[]) => getMembers(...args),
  updateMemberRole: (...args: any[]) => updateMemberRole(...args),
  removeMember: (...args: any[]) => removeMember(...args),
  normalizeOrganizationRole: (role?: string) => {
    const n = String(role || '')
      .trim()
      .toUpperCase();
    if (n === 'OWNER') return 'OWNER';
    if (n === 'ADMIN') return 'ADMIN';
    if (n === 'GUEST' || n === 'VIEWER') return 'GUEST';
    return 'MEMBER';
  },
}));

vi.mock('../../../../server/src/services/orgPeopleIamService.js', () => ({
  changeOrganizationMemberRoleViaIam: vi.fn(async () => ({ ok: true })),
  removeOrganizationMemberViaIam: vi.fn(async () => ({ ok: true })),
  addOrganizationMemberViaIam: vi.fn(async () => ({ ok: true })),
}));

function createResponse() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: any) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('Admin audit emission (BUG A / H2.12)', () => {
  beforeEach(() => {
    dbGet.mockReset();
    getMembers.mockReset();
    updateMemberRole.mockReset();
    removeMember.mockReset();
    logAction.mockReset();
    logAction.mockResolvedValue({ id: 'audit-1', persisted: true });
  });

  it('emits update_member_role with correct action + actor on a role change', async () => {
    getMembers.mockResolvedValue([
      { user_id: 'admin-1', role: 'ADMIN' },
      { user_id: 'member-1', role: 'MEMBER' },
    ]);
    updateMemberRole.mockResolvedValue({ success: true });

    const req: any = {
      params: { orgId: 'org-1', memberId: 'member-1' },
      body: { role: 'ADMIN' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const res = createResponse();

    await OrganizationController.updateMemberRole(req, res, vi.fn());

    expect(updateMemberRole).toHaveBeenCalled();
    expect(logAction).toHaveBeenCalledTimes(1);
    const arg = logAction.mock.calls[0][0];
    expect(arg.actionType).toBe('update_member_role');
    expect(arg.adminId).toBe('admin-1');
    expect(arg.details).toMatchObject({ orgId: 'org-1', targetUserId: 'member-1' });
    expect(res.statusCode).toBe(200);
  });

  it('is fail-safe: audit throwing does NOT block the role change (still 200)', async () => {
    getMembers.mockResolvedValue([
      { user_id: 'admin-1', role: 'ADMIN' },
      { user_id: 'member-1', role: 'MEMBER' },
    ]);
    updateMemberRole.mockResolvedValue({ success: true });
    logAction.mockRejectedValue(new Error('audit DB down'));

    const req: any = {
      params: { orgId: 'org-1', memberId: 'member-1' },
      body: { role: 'ADMIN' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const res = createResponse();

    await OrganizationController.updateMemberRole(req, res, vi.fn());

    // The mutation ran and the response is a success despite the audit failure.
    expect(updateMemberRole).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('emits remove_member on a successful member removal', async () => {
    getMembers.mockResolvedValue([
      { user_id: 'admin-1', role: 'ADMIN' },
      { user_id: 'member-1', role: 'MEMBER' },
    ]);
    removeMember.mockResolvedValue({ success: true });

    const req: any = {
      params: { orgId: 'org-1', memberId: 'member-1' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const res = createResponse();

    await OrganizationController.removeMember(req, res, vi.fn());

    expect(removeMember).toHaveBeenCalled();
    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction.mock.calls[0][0].actionType).toBe('remove_member');
  });
});
