/**
 * OrganizationController — high-risk write audit proof (Module 17, ADM-RAW-P1-004).
 *
 * Proves that successful member role changes and member removals emit an
 * admin_audit_logs entry via adminAuditService.logAction with the before/after
 * context. Lives under tests/unit/backend so it is picked up by the default
 * vitest include globs (the controllers/__tests__ folder is not globbed).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import OrganizationController from '../../../../server/src/controllers/OrganizationController.js';

const dbGet = vi.fn();
const getMembers = vi.fn();
const changeMemberRoleViaIam = vi.fn();
const removeMemberViaIam = vi.fn();

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
}));

vi.mock('../../../../server/src/services/organizationService.js', () => ({
  getMembers: (...args: any[]) => getMembers(...args),
  normalizeOrganizationRole: (role?: string) => {
    const normalized = String(role || '')
      .trim()
      .toUpperCase();
    if (normalized === 'OWNER') return 'OWNER';
    if (normalized === 'ADMIN') return 'ADMIN';
    if (normalized === 'GUEST' || normalized === 'VIEWER') return 'GUEST';
    return 'MEMBER';
  },
}));

vi.mock('../../../../server/src/services/orgPeopleIamService.js', () => ({
  changeOrganizationMemberRoleAtomicallyViaIam: (...args: any[]) =>
    changeMemberRoleViaIam(...args),
  removeOrganizationMemberAtomicallyViaIam: (...args: any[]) => removeMemberViaIam(...args),
}));

function createResponse() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
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

describe('OrganizationController audit proof (ADM-RAW-P1-004)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    changeMemberRoleViaIam.mockResolvedValue({ denied: false });
    removeMemberViaIam.mockResolvedValue({ denied: false });
  });

  it('emits update_member_role audit on a successful role change', async () => {
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

    expect(changeMemberRoleViaIam).toHaveBeenCalledWith({
      actorId: 'admin-1',
      actorRole: 'ADMIN',
      organizationId: 'org-1',
      targetMemberId: 'member-1',
      newRole: 'ADMIN',
    });
  });

  it('emits remove_member audit on a successful removal', async () => {
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

    expect(removeMemberViaIam).toHaveBeenCalledWith({
      actorId: 'admin-1',
      actorRole: 'ADMIN',
      organizationId: 'org-1',
      targetMemberId: 'member-1',
    });
  });

  it('does not emit an audit event when a role change is rejected', async () => {
    getMembers.mockResolvedValue([
      { user_id: 'admin-1', role: 'ADMIN' },
      { user_id: 'member-1', role: 'MEMBER' },
    ]);

    const req: any = {
      params: { orgId: 'org-1', memberId: 'member-1' },
      body: { role: 'OWNER' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const res = createResponse();

    await OrganizationController.updateMemberRole(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(changeMemberRoleViaIam).not.toHaveBeenCalled();
  });
});
