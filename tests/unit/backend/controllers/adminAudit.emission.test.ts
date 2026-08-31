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
const changeMemberRoleViaIam = vi.fn();
const removeMemberViaIam = vi.fn();

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
}));

vi.mock('../../../../server/src/services/orgPeopleIamService.js', () => ({
  changeOrganizationMemberRoleAtomicallyViaIam: (...args: any[]) =>
    changeMemberRoleViaIam(...args),
  removeOrganizationMemberAtomicallyViaIam: (...args: any[]) => removeMemberViaIam(...args),
}));

vi.mock('../../../../server/src/services/organizationService.js', () => ({
  getMembers: (...args: any[]) => getMembers(...args),
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
    changeMemberRoleViaIam.mockReset().mockResolvedValue({ denied: false });
    removeMemberViaIam.mockReset().mockResolvedValue({ denied: false });
  });

  it('emits update_member_role with correct action + actor on a role change', async () => {
    getMembers.mockResolvedValue([
      { user_id: 'admin-1', role: 'ADMIN' },
      { user_id: 'member-1', role: 'MEMBER' },
    ]);

    const req: any = {
      params: { orgId: 'org-1', memberId: 'member-1' },
      body: { role: 'ADMIN' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const res = createResponse();

    await OrganizationController.updateMemberRole(req, res, vi.fn());

    expect(changeMemberRoleViaIam).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        organizationId: 'org-1',
        targetMemberId: 'member-1',
        newRole: 'ADMIN',
      })
    );
    expect(res.statusCode).toBe(200);
  });

  it('is fail-closed: atomic IAM failure does not report a successful role change', async () => {
    getMembers.mockResolvedValue([
      { user_id: 'admin-1', role: 'ADMIN' },
      { user_id: 'member-1', role: 'MEMBER' },
    ]);
    changeMemberRoleViaIam.mockRejectedValue(new Error('audit DB down'));

    const req: any = {
      params: { orgId: 'org-1', memberId: 'member-1' },
      body: { role: 'ADMIN' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const res = createResponse();

    const next = vi.fn();
    await OrganizationController.updateMemberRole(req, res, next);

    expect(changeMemberRoleViaIam).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'audit DB down' }));
    expect(res.statusCode).toBe(200);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('emits remove_member on a successful member removal', async () => {
    getMembers.mockResolvedValue([
      { user_id: 'admin-1', role: 'ADMIN' },
      { user_id: 'member-1', role: 'MEMBER' },
    ]);

    const req: any = {
      params: { orgId: 'org-1', memberId: 'member-1' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const res = createResponse();

    await OrganizationController.removeMember(req, res, vi.fn());

    expect(removeMemberViaIam).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        organizationId: 'org-1',
        targetMemberId: 'member-1',
      })
    );
  });
});
